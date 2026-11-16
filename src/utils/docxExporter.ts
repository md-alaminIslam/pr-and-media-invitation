import {htmlToWordParagraphs} from './richDocx';
import { renderHtmlTemplate, renderTemplate } from './templates';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
} from 'docx';
import { DocumentData, DocumentType } from '../types';
import { DEFAULT_PAGE_MARGINS, PageMargins, docxPageMargins } from './pageMargins';
import {
  formatChiefGuestBn,
  formatChiefGuestEn,
  formatSpecialGuestsBn,
  formatSpecialGuestsEn,
} from './documentGenerator';

export async function exportToDocx(data: DocumentData, type: DocumentType, margins: PageMargins = DEFAULT_PAGE_MARGINS): Promise<Blob> {
  const properties = { page: { margin: docxPageMargins(margins) } };
  const rich=renderHtmlTemplate(data,type);
  if(rich!==null)return Packer.toBlob(new Document({sections:[{properties,children:htmlToWordParagraphs(rich)}]}));
  const custom = renderTemplate(data, type);
  if (custom !== null) {
    const font = type.endsWith('-bn') ? 'Hind Siliguri' : 'Times New Roman';
    return Packer.toBlob(new Document({sections:[{properties,children:custom.split('\n').map(line=>new Paragraph({children:[new TextRun({text:line,font,size:24})],spacing:{after:120,line:360}}))}]}));
  }
  const isBangla = type === 'invitation-bn' || type === 'press-release-bn';
  const isInvitation = type === 'invitation-bn' || type === 'invitation-en';

  const fontName = isBangla ? 'Kalpurush' : 'Times New Roman';
  const defaultSize = 24; // 12pt (docx uses half-points: 24 = 12pt)
  const headingSize = 28; // 14pt

  const paragraphs: (Paragraph | Table)[] = [];

  if (type === 'invitation-bn') {
    // Media Invitation Bangla
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `তারিখঃ ${data.issueDateBn || '২৮শে অক্টোবর, ২০২৫'}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'বরাবর,\n' + (data.mediaAddresseeBn || 'প্রধান বার্তা সম্পাদক'),
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `বিষয়: "${data.editionBn || data.eventTitleBn}" শীর্ষক আন্তর্জাতিক প্রদর্শনীর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'প্রিয় মহোদয়,',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.organizerBn || 'সেভার ইন্টারন্যাশনাল লিমিটেড'}, আগামী `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `${data.eventDateBn || '৩০শে অক্টোবর ২০২৫'}`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: ` তারিখে ${data.inaugurationTimeBn || 'সকাল ১০.০০ ঘটিকায়'} `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `${data.venueBn || 'ইন্টারন্যাশনাল কনভেনশন সিটি বসুন্ধরা (ICCB)'}`,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `, ${data.scopeBn || 'বাংলাদেশের সবচেয়ে বড় আন্তর্জাতিক মেরিটাইম ও অফশোর শিল্পের প্রদর্শনী'} `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `“${data.eventTitleBn}”`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: ` এর ${data.editionBn ? data.editionBn + ' আসরের' : ''} উদ্বোধনের আয়োজন করতে যাচ্ছে।`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'এই অনুষ্ঠানে প্রধান অতিথি হিসেবে ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatChiefGuestBn(data.chiefGuest) || 'প্রধান অতিথি',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: ' উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন বলে বিশেষ সম্মতি প্রদান করেছেন। দেশ-বিদেশের বহু বিশিষ্ট ব্যক্তি ও প্রতিষ্ঠান এই গুরুত্বপূর্ণ প্রদর্শনীতে অংশগ্রহণ করবেন।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'এই আন্তর্জাতিক প্রদর্শনীতে প্রদর্শিত হবে—',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    // Bullet points
    for (const h of data.highlights.filter(item => item.textBn.trim())) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${h.textBn}`,
              font: fontName,
              size: defaultSize,
            }),
          ],
          indent: { left: 360 },
          spacing: { after: 80 },
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'প্রদর্শনীটি সংশ্লিষ্ট শিল্পের সাথে বৈশ্বিক বাজারের একটি অনন্য সেতুবন্ধন তৈরি করবে এবং বিনিয়োগ, প্রযুক্তি ও বাণিজ্য উন্নয়নে নতুন দিগন্ত উন্মোচন করবে।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { before: 160, after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'আপনার সম্মানিত সংবাদপত্র/সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটো সাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীতভাবে অনুরোধ জানাচ্ছি।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240, line: 360 },
      }),
      // Program Schedule Table / Box
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'অনুষ্ঠানসূচি',
                        font: fontName,
                        size: defaultSize,
                        bold: true,
                      }),
                    ],
                    spacing: { after: 80 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `উদ্বোধনী অনুষ্ঠান: "${data.eventTitleBn}"`,
                        font: fontName,
                        size: defaultSize,
                        bold: true,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `স্থান: ${data.venueBn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `তারিখ: ${data.eventDateBn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `সময়: ${data.inaugurationTimeBn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                  }),
                ],
                shading: {
                  fill: 'F1F5F9',
                  type: ShadingType.CLEAR,
                },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
              }),
            ],
          }),
        ],
      }),
      // Sender sign-off
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.sender.nameBn}\n${data.sender.designationBn}\n${data.sender.organizationBn}\nমোবাইল: ${data.sender.phone}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { before: 300, line: 320 },
      })
    );
  } else if (type === 'invitation-en') {
    // Media Invitation English
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Date: ${data.issueDateEn || '28 October, 2025'}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `To,\n${data.mediaAddresseeEn || 'Chief Reporter'}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Subject: "Request to send Journalist to the inauguration ceremony of International Exhibition – "${data.editionEn || data.eventTitleEn}"`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Dear Sir/Madam,',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.organizerEn || 'Savor International Limited'} is pleased to invite you to the `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `Inauguration Ceremony of the ${data.editionEn || ''} of ${data.eventTitleEn}`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: `, scheduled to be held on `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `${data.eventDateEn || '30 October 2025'} at ${data.inaugurationTimeEn || '10:00 AM'}`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: ` at the ${data.venueEn || 'Hall 4, International Convention City Bashundhara (ICCB), Kuril, Dhaka'}.`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'The event will be inaugurated by ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatChiefGuestEn(data.chiefGuest) || 'Chief Guest',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: ', with distinguished guests from government and private sectors, industry leaders, entrepreneurs, and international delegates in attendance.',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'The exhibition will feature:',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    // Bullets
    for (const h of data.highlights.filter(item => item.textEn.trim())) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${h.textEn}`,
              font: fontName,
              size: defaultSize,
            }),
          ],
          indent: { left: 360 },
          spacing: { after: 80 },
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'This international exhibition will create a unique platform connecting Bangladesh’s industry with the global market, opening new opportunities in investment, technology, and trade.',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { before: 160, after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'We sincerely request your esteemed media house to kindly send a reporter and a photojournalist to cover the event.',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 240, line: 360 },
      }),
      // Schedule Box
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Program Schedule',
                        font: fontName,
                        size: defaultSize,
                        bold: true,
                      }),
                    ],
                    spacing: { after: 80 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Inaugural Ceremony "${data.editionEn ? data.editionEn + ' ' : ''}${data.eventTitleEn}"`,
                        font: fontName,
                        size: defaultSize,
                        bold: true,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Place: ${data.venueEn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Date: ${data.eventDateEn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                    spacing: { after: 60 },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Time: ${data.inaugurationTimeEn}`,
                        font: fontName,
                        size: defaultSize,
                      }),
                    ],
                  }),
                ],
                shading: {
                  fill: 'FEF3C7',
                  type: ShadingType.CLEAR,
                },
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.sender.nameEn}\n${data.sender.designationEn}\n${data.sender.organizationEn}\nRSVP: ${data.sender.phone}`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { before: 300, line: 320 },
      })
    );
  } else if (type === 'press-release-bn') {
    // Press Release Bangla
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.eventDateBn || '৩০ অক্টোবর, ২০২৫'}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'সংবাদ বিজ্ঞপ্তি',
            font: fontName,
            size: headingSize,
            bold: true,
            underline: {},
          }),
        ],
        spacing: { after: 280 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `আজ ${data.eventDateBn || 'আজ'}, ${data.organizerBn}-এর আয়োজনে ${data.venueBn}-এ অনুষ্ঠিত হলো ${data.scopeBn} `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `“${data.editionBn || data.eventTitleBn}”`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: `-এর উদ্বোধনী অনুষ্ঠান।`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: data.highlights.map(h => h.textBn).filter(Boolean).join(', ') +
              ' প্রযুক্তিকে কেন্দ্র করে আয়োজিত এই প্রদর্শনীতে অংশ নিচ্ছে দেশি-বিদেশি শীর্ষস্থানীয় কোম্পানি, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধি দল।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatChiefGuestBn(data.chiefGuest) || 'প্রধান অতিথি',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: '। বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatSpecialGuestsBn(data.specialGuests) || 'দেশি-বিদেশি বিশিষ্ট অতিথিবৃন্দ',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: '।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'প্রদর্শনীতে বিভিন্ন প্রযুক্তি ও উদ্ভাবন প্রদর্শনের পাশাপাশি আন্তর্জাতিক B2B ও B2G মিটিং, সেমিনার ও প্যানেল আলোচনা অনুষ্ঠিত হচ্ছে, যেখানে শীর্ষ ব্যক্তিবর্গ অংশ নিচ্ছেন।',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `এই প্রদর্শনী ${data.eventDurationBn || data.eventDateBn} পর্যন্ত ${data.visitingHoursBn || 'প্রতিদিন সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত'} সকল দর্শকের জন্য উন্মুক্ত থাকবে।`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 280, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `বার্তা প্রেরক\n${data.sender.nameBn}\n${data.sender.designationBn}\n${data.sender.organizationBn}\nমোবাইল: ${data.sender.phone}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { before: 200, line: 320 },
      })
    );
  } else {
    // Press Release English
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.eventDateEn || '30 October, 2025'}`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: 'PRESS RELEASE',
            font: fontName,
            size: headingSize,
            bold: true,
            underline: {},
          }),
        ],
        spacing: { after: 280 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `The inauguration ceremony of `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `"${data.eventTitleEn}"`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: `, ${data.scopeEn}, was held today, ${data.eventDateEn || 'October 30, 2025'}, at the ${data.venueEn}. The event has been organized by `,
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: `${data.organizerEn}.`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Focused on ${data.highlights.map(h => h.textEn).filter(Boolean).join(', ').toLowerCase()}, the exhibition brings together leading companies from home and abroad, along with investors, technologists, and business representatives.`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'The exhibition was inaugurated by ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatChiefGuestEn(data.chiefGuest) || 'Chief Guest',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: '. Special Guests included ',
            font: fontName,
            size: defaultSize,
          }),
          new TextRun({
            text: formatSpecialGuestsEn(data.specialGuests) || 'distinguished dignitaries',
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
          new TextRun({
            text: '.',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'The exhibition features the latest maritime innovations and technologies, along with international B2B and B2G meetings, seminars, and panel discussions, with active participation from top industry leaders from Bangladesh and the global maritime sector.',
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 200, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `The exhibition is open to all visitors from ${data.eventDurationEn || 'October 30 to November 1, 2025'}, ${data.visitingHoursEn || 'daily from 10:00 AM to 7:00 PM'}.`,
            font: fontName,
            size: defaultSize,
          }),
        ],
        spacing: { after: 280, line: 360 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Message sender\n${data.sender.nameEn}\n${data.sender.designationEn}\n${data.sender.organizationEn}\nRSVP: ${data.sender.phone}`,
            font: fontName,
            size: defaultSize,
            bold: true,
          }),
        ],
        spacing: { before: 200, line: 320 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties,
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
