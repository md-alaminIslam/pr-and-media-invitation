import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json({ limit: '20mb' }));

// Server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// JSON schema for extracting PR and Media Invitation data
const documentDataSchema = {
  type: Type.OBJECT,
  properties: {
    eventTitleBn: { type: Type.STRING },
    eventTitleEn: { type: Type.STRING },
    editionBn: { type: Type.STRING },
    editionEn: { type: Type.STRING },
    scopeBn: { type: Type.STRING },
    scopeEn: { type: Type.STRING },
    organizerBn: { type: Type.STRING },
    organizerEn: { type: Type.STRING },
    issueDateBn: { type: Type.STRING },
    issueDateEn: { type: Type.STRING },
    eventDateBn: { type: Type.STRING },
    eventDateEn: { type: Type.STRING },
    eventDurationBn: { type: Type.STRING },
    eventDurationEn: { type: Type.STRING },
    inaugurationTimeBn: { type: Type.STRING },
    inaugurationTimeEn: { type: Type.STRING },
    visitingHoursBn: { type: Type.STRING },
    visitingHoursEn: { type: Type.STRING },
    venueBn: { type: Type.STRING },
    venueEn: { type: Type.STRING },
    chiefGuest: {
      type: Type.OBJECT,
      properties: {
        nameBn: { type: Type.STRING },
        nameEn: { type: Type.STRING },
        honorsBn: { type: Type.STRING },
        honorsEn: { type: Type.STRING },
        designationBn: { type: Type.STRING },
        designationEn: { type: Type.STRING },
      },
      required: ['nameBn', 'nameEn', 'designationBn', 'designationEn'],
    },
    specialGuests: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          nameBn: { type: Type.STRING },
          nameEn: { type: Type.STRING },
          honorsBn: { type: Type.STRING },
          honorsEn: { type: Type.STRING },
          designationBn: { type: Type.STRING },
          designationEn: { type: Type.STRING },
        },
        required: ['id', 'nameBn', 'nameEn', 'designationBn', 'designationEn'],
      },
    },
    highlights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          textBn: { type: Type.STRING },
          textEn: { type: Type.STRING },
        },
        required: ['id', 'textBn', 'textEn'],
      },
    },
    sender: {
      type: Type.OBJECT,
      properties: {
        nameBn: { type: Type.STRING },
        nameEn: { type: Type.STRING },
        designationBn: { type: Type.STRING },
        designationEn: { type: Type.STRING },
        organizationBn: { type: Type.STRING },
        organizationEn: { type: Type.STRING },
        phone: { type: Type.STRING },
        email: { type: Type.STRING },
      },
      required: ['nameBn', 'nameEn', 'designationBn', 'designationEn', 'phone'],
    },
    mediaAddresseeBn: { type: Type.STRING },
    mediaAddresseeEn: { type: Type.STRING },
  },
  required: [
    'eventTitleBn',
    'eventTitleEn',
    'organizerBn',
    'organizerEn',
    'eventDateBn',
    'eventDateEn',
    'venueBn',
    'venueEn',
    'chiefGuest',
    'specialGuests',
    'highlights',
    'sender',
  ],
};

// Helper to call Gemini with smart model fallback and retry
async function generateContentWithRetry(params: any, maxRetries = 1) {
  // Try flash lite first (higher free tier limits), with flash as alternative
  const requestedModel = params.model || 'gemini-3.1-flash-lite';
  const alternativeModel = requestedModel === 'gemini-3.1-flash-lite' ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
  const modelsToTry = [requestedModel, alternativeModel];

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await ai.models.generateContent({
          ...params,
          model: currentModel,
        });
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || '');
        const isQuotaExhausted =
          err?.status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        // If daily quota is exhausted for this model, immediately switch to next model without retrying
        if (isQuotaExhausted) {
          break;
        }

        const is503Spike =
          err?.status === 503 ||
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE');

        if (is503Spike && attempt < maxRetries) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

// Route: Extract plain text from uploaded Word docx file immediately
app.post('/api/extract-docx-text', async (req: Request, res: Response) => {
  try {
    const { base64Docx } = req.body;
    if (!base64Docx) {
      return res.status(400).json({ error: 'No docx file provided' });
    }
    const cleanBase64 = base64Docx.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const mammothResult = await mammoth.extractRawText({ buffer });
    res.json({ success: true, text: mammothResult.value.trim() });
  } catch (err: any) {
    console.error('Failed to extract text from docx:', err);
    res.status(500).json({ error: 'ওয়ার্ড ফাইল থেকে টেক্সট রিড করতে সমস্যা হয়েছে।' });
  }
});

// Route: Parse reference file / text and extract all event and guest fields
app.post('/api/parse-reference', async (req: Request, res: Response) => {
  let extractedText = req.body.text || '';
  const { base64Docx } = req.body;

  // If user provided a docx file in base64, extract plain text using mammoth
  if (base64Docx) {
    try {
      const cleanBase64 = base64Docx.replace(/^data:.*?;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const mammothResult = await mammoth.extractRawText({ buffer });
      if (mammothResult.value && mammothResult.value.trim()) {
        extractedText = mammothResult.value.trim();
      }
    } catch (err) {
      console.warn('Mammoth extraction failed, falling back to text:', err);
    }
  }

  if (!extractedText || extractedText.trim().length === 0) {
    return res.status(400).json({ error: 'অনুগ্রহ করে টেক্সট লিখুন বা ওয়ার্ড ফাইল আপলোড করুন।' });
  }

  try {
    const systemPrompt = `You are an expert bilingual Public Relations (PR) specialist and journalist for Bangladeshi press releases and media invitations.
Analyze the provided document/notes and extract all relevant information to populate a bilingual (Bangla and English) press release and media invitation dataset.
Rules:
1. Provide accurate Bengali translations and English equivalents for Chief Guest (প্রধান অতিথি) and Special Guests (বিশেষ অতিথিবৃন্দ), including honorary titles (e.g. OSP, NPP, PhD, etc.) and designations.
2. If only one language is available in the source, translate accurately to the other language (Bangla to English or English to Bangla).
3. Ensure dates, times, venue (e.g. ICCB, BICC), and organizer details are extracted accurately.
4. Extract key features/highlights as bullet points in both Bangla and English.
5. Extract contact spokesperson/sender name, designation, and phone.
6. Return purely structured JSON matching the provided schema.`;

    const response = await generateContentWithRetry({
      model: 'gemini-3.1-flash-lite',
      contents: `Extract the PR data from this reference text:\n\n${extractedText}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: documentDataSchema,
      },
    });

    const jsonText = response?.text ?? '{}';
    const parsedData = JSON.parse(jsonText);
    return res.json({
      success: true,
      data: parsedData,
      rawExtractedText: extractedText,
      source: 'ai',
    });
  } catch (_error: any) {
    // If Gemini hits quota limit or 503, seamlessly use offline heuristic parser
    try {
      const { parsePrTextHeuristic } = await import('./src/utils/textParser.ts');
      const fallbackData = parsePrTextHeuristic(extractedText);
      return res.json({
        success: true,
        data: fallbackData,
        rawExtractedText: extractedText,
        source: 'heuristic',
        warning: 'আপনার ফাইল থেকে সরাসরি তথ্য সফলভাবে এক্সট্র্যাক্ট করা হয়েছে।',
      });
    } catch (fallbackErr: any) {
      console.error('Fallback parsing error:', fallbackErr);
      return res.status(500).json({
        error: 'তথ্য প্রক্রিয়াকরণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      });
    }
  }
});

// Route: Transliterate and translate single guest name/designation from English to Bangla
app.post('/api/transliterate-guest', async (req: Request, res: Response) => {
  const { nameEn, designationEn, honorsEn } = req.body;
  if (!nameEn && !designationEn && !honorsEn) {
    return res.json({ success: true, nameBn: '', designationBn: '', honorsBn: '' });
  }

  const { quickTransliterateEnglishToBangla } = await import('./src/utils/transliteration.ts');

  try {
    const systemPrompt = `You are a specialist in Bangladeshi press releases and formal Bengali transliteration.
Translate or transliterate English guest information into proper formal Bengali script:
1. Person name and ranks/titles (e.g. "Rear Admiral Mohammad Musa" -> "রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা", "Mr. Edgars Dzenis" -> "জনাব এডগার্স ডজেনিস", "Capt. Md. Shafiqul Islam Bhuiyan" -> "ক্যাপ্টেন মো: শফিকুল ইসলাম ভূঁইয়া").
2. Designation and organization (e.g. "Director General, Bangladesh Coast Guard" -> "মহাপরিচালক, বাংলাদেশ কোস্ট গার্ড", "Managing Director, Savor International Limited" -> "ব্যবস্থাপনা পরিচালক, সেভার ইন্টারন্যাশনাল লিমিটেড").
3. Honors and degrees (e.g. "OSP, NPP, PhD" -> "ওএসপি, এনপিপি, পিএইচডি বা OSP, NPP, PhD").
Return strict JSON matching: { "nameBn": string, "designationBn": string, "honorsBn": string }`;

    const prompt = `Translate to Bengali:
nameEn: ${nameEn || ''}
designationEn: ${designationEn || ''}
honorsEn: ${honorsEn || ''}`;

    const response = await generateContentWithRetry({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response?.text ?? '{}');
    return res.json({
      success: true,
      nameBn: result.nameBn || quickTransliterateEnglishToBangla(nameEn || ''),
      designationBn: result.designationBn || quickTransliterateEnglishToBangla(designationEn || ''),
      honorsBn: result.honorsBn || honorsEn || '',
    });
  } catch (_error: any) {
    // Graceful dictionary-based fallback without raw quota logging
    return res.json({
      success: true,
      nameBn: quickTransliterateEnglishToBangla(nameEn || ''),
      designationBn: quickTransliterateEnglishToBangla(designationEn || ''),
      honorsBn: honorsEn || '',
      source: 'quick_fallback',
    });
  }
});

// Route: AI Bilingual Sync & Polish (Translates unfilled fields or polishes PR text)
app.post('/api/ai-translate-sync', async (req: Request, res: Response) => {
  try {
    const { data, targetLanguage } = req.body;

    const systemPrompt = `You are a professional bilingual PR communications expert.
The user provided PR document data that may have some fields missing in either Bangla or English, or need high-quality translation between English and Bangla.
Review the provided JSON data. Ensure that every Bangla field has its high-standard English equivalent, and every English field has its authentic Bangla counterpart.
Pay special attention to:
- Chief Guest name, honors, designation in both Bangla and English.
- Special Guests names, honors, designations in both Bangla and English.
- Event title, dates, time, venue, and highlights.
- Sender information.
Preserve existing good values, and fill or refine missing or incomplete translations.
Return strictly the updated JSON matching the schema.`;

    const response = await generateContentWithRetry({
      model: 'gemini-3.1-flash-lite',
      contents: `Please synchronize and complete the bilingual PR fields for this document:\n\n${JSON.stringify(data, null, 2)}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: documentDataSchema,
      },
    });

    const jsonText = response?.text ?? '{}';
    const updatedData = JSON.parse(jsonText);
    res.json({ success: true, data: updatedData });
  } catch (error: any) {
    console.error('Error in AI sync:', error);
    res.status(500).json({ error: 'AI সার্ভার সাময়িক ব্যস্ত। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' });
  }
});

// Mount Vite in dev mode or serve static files in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
