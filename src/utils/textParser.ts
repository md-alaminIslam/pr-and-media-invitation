import { DocumentData, GuestItem, HighlightItem } from '../types';
import { blankPreset } from './presets';

/**
 * Heuristic parser that extracts PR and Media Invitation fields directly from text.
 * Serves as an instant, zero-latency fallback if the AI model experiences 503 spikes or network delay.
 */
export function parsePrTextHeuristic(rawText: string): DocumentData {
  const result: DocumentData = JSON.parse(JSON.stringify(blankPreset));
  result.specialGuests = [];
  result.highlights = [];
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Detect Event Title & Edition
  // E.g. "BEVMX 2025", "BIMOX 2025", "Bangladesh International..."
  const titleMatch = text.match(/(?:“|")([^”"]+Expo[^”"]*|[^”"]+BIMOX[^”"]*|[^”"]+BEVMX[^”"]*|[^”"]+২০২৫[^”"]*|[^”"]+2025[^”"]*|[^”"]+2026[^”"]*)(?:”|")/i);
  if (titleMatch) {
    result.eventTitleBn = titleMatch[1].trim();
    result.eventTitleEn = titleMatch[1].trim();
  }

  const editionMatch = text.match(/([০-৯0-9]+(?:ম|th|rd|st|nd)?\s+[A-Za-z0-9\s–-]+202[4-9])/i);
  if (editionMatch) {
    result.editionBn = editionMatch[1].trim();
    result.editionEn = editionMatch[1].trim();
  }

  // 2. Issue Date
  // E.g. "তারিখঃ ২৮শে অক্টোবর, ২০২৫" or "Date: 28 October, 2025"
  const issueDateBnMatch = text.match(/তারিখ[ঃ:]\s*([০-৯A-Za-z\s,–-]+(?:অক্টোবর|নভেম্বর|ডিসেম্বর|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|২০২[০-৯]|202[0-9]))/i);
  if (issueDateBnMatch) {
    result.issueDateBn = issueDateBnMatch[1].trim();
  }
  const issueDateEnMatch = text.match(/Date[:\s]+([0-9]{1,2}\s+[A-Za-z]+,?\s+202[0-9])/i);
  if (issueDateEnMatch) {
    result.issueDateEn = issueDateEnMatch[1].trim();
  }

  // 3. Event / Inauguration Date
  const eventDateBnMatch = text.match(/আগামী\s+([^\n]+?)\s+তারিখে/);
  if (eventDateBnMatch) result.eventDateBn = eventDateBnMatch[1].trim();

  // 4. Time
  const timeBnMatch = text.match(/(সকাল|দুপুর|বিকাল|সন্ধ্যা)\s*([০-৯0-9.:]+)\s*ঘটিকায়/i);
  if (timeBnMatch) {
    result.inaugurationTimeBn = `${timeBnMatch[1]} ${timeBnMatch[2]} ঘটিকায়`;
  }
  const timeEnMatch = text.match(/([0-9]{1,2}[:.][0-9]{2}\s*(?:AM|PM))/i);
  if (timeEnMatch) {
    result.inaugurationTimeEn = timeEnMatch[1].trim();
  }

  // 5. Venue
  const venueBnMatch = text.match(/(?:স্থান|ভেন্যু)[:\s]+([^\n]+)/i);
  if (venueBnMatch) {
    result.venueBn = venueBnMatch[1].trim();
  } else {
    const venueInText = text.match(/(ইন্টারন্যাশনাল\s+কনভেনশন\s+সিটি[^\n,]+,\s*[^\n,]+,\s*ঢাকা|[^\n,]*ICCB[^\n,]*)/i);
    if (venueInText) result.venueBn = venueInText[1].trim();
  }

  // 6. Chief Guest (প্রধান অতিথি)
  // E.g. "প্রধান অতিথি হিসেবে ... উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন"
  const chiefGuestBnMatch = text.match(/প্রধান\s+অতিথি\s+হিসেবে\s+([^\n]+?)\s+উপস্থিত\s+থেকে/i);
  if (chiefGuestBnMatch) {
    const rawCg = chiefGuestBnMatch[1].trim();
    const parts = rawCg.split(',').map(p => p.trim());
    if (parts.length > 0) {
      result.chiefGuest.nameBn = parts[0];
      result.chiefGuest.nameEn = parts[0]; // fallback
      if (parts.length > 1) {
        result.chiefGuest.honorsBn = parts[1];
        result.chiefGuest.honorsEn = parts[1];
      }
      if (parts.length > 2) {
        result.chiefGuest.designationBn = parts.slice(2).join(', ');
        result.chiefGuest.designationEn = parts.slice(2).join(', ');
      }
    }
  } else {
    // English pattern: "The event will be inaugurated by [name], [honors], [designation] with"
    const chiefGuestEnMatch = text.match(/inaugurated by\s+([^,]+),\s*([^,]+),\s*([^\n.]+?)\s*(?:with distinguished|, with|\.)/i);
    if (chiefGuestEnMatch) {
      result.chiefGuest.nameEn = chiefGuestEnMatch[1].trim();
      result.chiefGuest.honorsEn = chiefGuestEnMatch[2].trim();
      result.chiefGuest.designationEn = chiefGuestEnMatch[3].trim();
    }
  }

  // 7. Special Guests (বিশেষ অতিথি)
  // E.g. "বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন ...।" or "Special Guests included ... ."
  const specialGuestsBnMatch = text.match(/বিশেষ\s+অতিথি\s+হিসেবে\s+উপস্থিত\s+ছিলেন\s+([^\n.]+)/i);
  if (specialGuestsBnMatch) {
    const rawSgText = specialGuestsBnMatch[1].trim();
    // Split by comma or "এবং"
    const guestChunks = rawSgText.split(/এবং|,/).map(s => s.trim()).filter(Boolean);
    const parsedGuests: GuestItem[] = [];
    
    // Group tokens or create guest items
    for (let i = 0; i < guestChunks.length; i++) {
      const chunk = guestChunks[i];
      if (chunk.length < 3) continue;
      parsedGuests.push({
        id: `sg-parsed-${i}`,
        nameBn: chunk,
        nameEn: chunk,
        honorsBn: '',
        honorsEn: '',
        designationBn: '',
        designationEn: '',
      });
    }
    if (parsedGuests.length > 0) {
      result.specialGuests = parsedGuests;
    }
  }

  // 8. Highlights (Bullet points)
  // Look for lines starting with •, -, *, or numbered items
  const bulletLines = lines.filter(l => /^[•\-\*\d+\.]\s+/.test(l));
  if (bulletLines.length > 0) {
    result.highlights = bulletLines.map((line, idx) => {
      const cleaned = line.replace(/^[•\-\*\d+\.]\s+/, '').trim();
      return {
        id: `hl-parsed-${idx}`,
        textBn: cleaned,
        textEn: cleaned,
      };
    });
  }

  // 9. Sender Details
  // E.g. "বার্তা প্রেরক ... আবিদ হোসেন ... মহাব্যবস্থাপক ... মোবাইল: ০১৭০৯৬৫৩৯৫৫"
  const phoneMatch = text.match(/(?:মোবাইল|Mobile|RSVP|Phone)[:\s]*([0-9+–\s]{11,15})/i);
  if (phoneMatch) {
    result.sender.phone = phoneMatch[1].trim();
  }

  const senderIndex = lines.findIndex(l => /বার্তা\s*প্রেরক|Message\s*sender/i.test(l));
  if (senderIndex !== -1 && lines.length > senderIndex + 1) {
    const nameLine = lines[senderIndex + 1];
    if (nameLine && !nameLine.includes(':')) {
      result.sender.nameBn = nameLine;
      result.sender.nameEn = nameLine;
    }
    if (lines.length > senderIndex + 2) {
      const desLine = lines[senderIndex + 2];
      if (desLine && !desLine.includes(':')) {
        result.sender.designationBn = desLine;
        result.sender.designationEn = desLine;
      }
    }
  }

  return result;
}
