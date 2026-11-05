import { renderHtmlTemplate, renderTemplate } from './templates';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DocumentData, DocumentType } from '../types';
import {
  formatChiefGuestBn,
  formatChiefGuestEn,
  formatSpecialGuestsBn,
  formatSpecialGuestsEn,
} from './documentGenerator';

function renderHtmlForPdf(data: DocumentData, type: DocumentType): string {
  const rich=renderHtmlTemplate(data,type);
  if(rich!==null)return '<div class="rich-document" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.8;color:#111;background:white">'+rich+'</div>';
  const custom = renderTemplate(data,type);
  if (custom !== null) {
    const escaped = custom.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return `<div style="white-space:pre-wrap;font-family:${type.endsWith('-bn') ? 'Hind Siliguri' : 'Times New Roman'},serif;font-size:16px;line-height:1.8;color:#111;background:#fff;">${escaped}</div>`;
  }
  const isBangla = type === 'invitation-bn' || type === 'press-release-bn';
  const chiefGuestBn = formatChiefGuestBn(data.chiefGuest);
  const chiefGuestEn = formatChiefGuestEn(data.chiefGuest);
  const specialGuestsBn = formatSpecialGuestsBn(data.specialGuests);
  const specialGuestsEn = formatSpecialGuestsEn(data.specialGuests);

  if (type === 'invitation-bn') {
    const bulletsHtml = data.highlights
      .filter((h) => h.textBn.trim())
      .map((h) => `<li style="margin-bottom: 6px;">${h.textBn}</li>`)
      .join('');

    return `
      <div style="font-family: 'Hind Siliguri', 'Tiro Bangla', sans-serif; font-size: 15px; color: #0f172a; line-height: 1.7; padding: 24px;">
        <div style="text-align: right; color: #334155; font-size: 14px; margin-bottom: 16px;">
          তারিখঃ ${data.issueDateBn || '২৮শে অক্টোবর, ২০২৫'}
        </div>
        <div style="margin-bottom: 16px; color: #1e293b;">
          বরাবর,<br />
          <strong>${data.mediaAddresseeBn || 'প্রধান বার্তা সম্পাদক'}</strong>
        </div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 16px; line-height: 1.4;">
          বিষয়: "${data.editionBn || data.eventTitleBn}" শীর্ষক আন্তর্জাতিক প্রদর্শনীর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।
        </div>
        <div style="margin-bottom: 12px;">প্রিয় মহোদয়,</div>
        <p style="text-align: justify; margin-bottom: 16px;">
          <strong>${data.organizerBn || 'সেভার ইন্টারন্যাশনাল লিমিটেড'}</strong>, আগামী
          <strong style="background: #fef3c7; padding: 2px 4px;">${data.eventDateBn || '৩০শে অক্টোবর ২০২৫'}</strong> তারিখে
          <strong>${data.inaugurationTimeBn || 'সকাল ১০.০০ ঘটিকায়'}</strong>
          <span>${data.venueBn || 'ইন্টারন্যাশনাল কনভেনশন সিটি বসুন্ধরা (ICCB)'}</span>,
          ${data.scopeBn || 'বাংলাদেশের সবচেয়ে বড় আন্তর্জাতিক মেরিটাইম ও অফশোর শিল্পের প্রদর্শনী'}
          <strong>“${data.eventTitleBn}”</strong> এর
          ${data.editionBn ? `${data.editionBn} আসরের` : ''} উদ্বোধনের আয়োজন করতে যাচ্ছে।
        </p>
        <p style="text-align: justify; margin-bottom: 16px;">
          এই অনুষ্ঠানে প্রধান অতিথি হিসেবে
          <strong style="background: #e0f2fe; padding: 2px 4px;">${chiefGuestBn || 'প্রধান অতিথি'}</strong>
          উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন বলে বিশেষ সম্মতি প্রদান করেছেন। দেশ-বিদেশের বহু বিশিষ্ট ব্যক্তি ও প্রতিষ্ঠান এই গুরুত্বপূর্ণ প্রদর্শনীতে অংশগ্রহণ করবেন।
        </p>
        <div style="margin-bottom: 16px;">
          <p style="font-weight: bold; margin-bottom: 8px;">এই আন্তর্জাতিক প্রদর্শনীতে প্রদর্শিত হবে—</p>
          <ul style="padding-left: 24px; margin: 0;">
            ${bulletsHtml}
          </ul>
        </div>
        <p style="text-align: justify; margin-bottom: 16px;">
          প্রদর্শনীটি সংশ্লিষ্ট শিল্পের সাথে বৈশ্বিক বাজারের একটি অনন্য সেতুবন্ধন তৈরি করবে এবং বিনিয়োগ, প্রযুক্তি ও বাণিজ্য উন্নয়নে নতুন দিগন্ত উন্মোচন করবে।
        </p>
        <p style="text-align: justify; margin-bottom: 16px;">
          আপনার সম্মানিত সংবাদপত্র/সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটো সাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীতভাবে অনুরোধ জানাচ্ছি।
        </p>
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 6px;">অনুষ্ঠানসূচি</div>
          <div style="font-weight: bold; margin-bottom: 4px;">উদ্বোধনী অনুষ্ঠান "${data.eventTitleBn}"</div>
          <div style="margin-bottom: 3px;"><strong>স্থান:</strong> ${data.venueBn}</div>
          <div style="margin-bottom: 3px;"><strong>তারিখ:</strong> <strong>${data.eventDateBn}</strong></div>
          <div><strong>সময়:</strong> <strong>${data.inaugurationTimeBn}</strong></div>
        </div>
        <div style="margin-top: 24px; line-height: 1.5;">
          <div style="font-weight: bold; font-size: 15px;">${data.sender.nameBn}</div>
          <div>${data.sender.designationBn}</div>
          <div>${data.sender.organizationBn}</div>
          <div>মোবাইল: ${data.sender.phone}</div>
          ${data.sender.email ? `<div>ইমেইল: ${data.sender.email}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (type === 'invitation-en') {
    const bulletsHtml = data.highlights
      .filter((h) => h.textEn.trim())
      .map((h) => `<li style="margin-bottom: 6px;">${h.textEn}</li>`)
      .join('');

    return `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 15px; color: #0f172a; line-height: 1.7; padding: 24px;">
        <div style="color: #334155; font-size: 14px; margin-bottom: 16px;">
          Date: ${data.issueDateEn || '28 October, 2025'}
        </div>
        <div style="margin-bottom: 16px;">
          To,<br />
          <strong>${data.mediaAddresseeEn || 'Chief Reporter'}</strong>
        </div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 16px; line-height: 1.4;">
          Subject: “Request to send Journalist to the inauguration ceremony of International Exhibition – "${data.editionEn || data.eventTitleEn}"
        </div>
        <div style="margin-bottom: 12px;">Dear Sir/Madam,</div>
        <p style="text-align: justify; margin-bottom: 16px;">
          <strong>${data.organizerEn || 'Savor International Limited'}</strong> is pleased to invite you to the
          <strong>Inauguration Ceremony of the ${data.editionEn || ''} of ${data.eventTitleEn}</strong>,
          scheduled to be held on
          <strong style="background: #fef3c7; padding: 2px 4px;">${data.eventDateEn || '30 October 2025'} at ${data.inaugurationTimeEn || '10:00 AM'}</strong>
          at the ${data.venueEn}.
        </p>
        <p style="text-align: justify; margin-bottom: 16px;">
          The event will be inaugurated by
          <strong style="background: #e0f2fe; padding: 2px 4px;">${chiefGuestEn || 'Chief Guest'}</strong>,
          with distinguished guests from government and private sectors, industry leaders, entrepreneurs, and international delegates in attendance.
        </p>
        <div style="margin-bottom: 16px;">
          <p style="font-weight: bold; margin-bottom: 8px;">The exhibition will feature:</p>
          <ul style="padding-left: 24px; margin: 0;">
            ${bulletsHtml}
          </ul>
        </div>
        <p style="text-align: justify; margin-bottom: 16px;">
          This international exhibition will create a unique platform connecting Bangladesh’s industry with the global market, opening new opportunities in investment, technology, and trade.
        </p>
        <p style="text-align: justify; margin-bottom: 16px;">
          We sincerely request your esteemed media house to kindly send a reporter and a photojournalist to cover the event.
        </p>
        <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
          <div style="font-weight: bold; margin-bottom: 6px;">Program Schedule</div>
          <div style="font-weight: bold; margin-bottom: 4px;">Inaugural Ceremony "${data.editionEn ? data.editionEn + ' ' : ''}${data.eventTitleEn}"</div>
          <div style="margin-bottom: 3px;"><strong>Place:</strong> ${data.venueEn}</div>
          <div style="margin-bottom: 3px;"><strong>Date:</strong> <strong>${data.eventDateEn}</strong></div>
          <div><strong>Time:</strong> <strong>${data.inaugurationTimeEn}</strong></div>
        </div>
        <div style="margin-top: 24px; line-height: 1.5;">
          <div style="font-weight: bold; font-size: 15px;">${data.sender.nameEn}</div>
          <div style="font-weight: bold;">${data.sender.designationEn}</div>
          <div>${data.sender.organizationEn}</div>
          <div>RSVP: ${data.sender.phone}</div>
          ${data.sender.email ? `<div>Email: ${data.sender.email}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (type === 'press-release-bn') {
    const highlightSummary = data.highlights
      .filter((h) => h.textBn.trim())
      .map((h) => h.textBn)
      .join(', ');

    return `
      <div style="font-family: 'Hind Siliguri', 'Tiro Bangla', sans-serif; font-size: 15px; color: #0f172a; line-height: 1.7; padding: 24px;">
        <div style="color: #334155; font-size: 14px; margin-bottom: 16px;">
          ${data.eventDateBn || '৩০ অক্টোবর, ২০২৫'}
        </div>
        <div style="text-align: center; font-weight: bold; font-size: 22px; text-decoration: underline; margin: 20px 0;">
          সংবাদ বিজ্ঞপ্তি
        </div>
        <p style="text-align: justify; margin-bottom: 16px;">
          <strong>আজ ${data.eventDateBn || '৩০ অক্টোবর ২০২৫'}</strong>,
          <span>${data.organizerBn}</span>-এর আয়োজনে
          <span>${data.venueBn}</span>-এ অনুষ্ঠিত হলো ${data.scopeBn}
          <strong>“${data.editionBn || data.eventTitleBn}”</strong>–এর উদ্বোধনী অনুষ্ঠান।
        </p>
        ${
          highlightSummary
            ? `<p style="text-align: justify; margin-bottom: 16px;">${highlightSummary} প্রযুক্তিকে কেন্দ্র করে আয়োজিত এই প্রদর্শনীতে অংশ নিচ্ছে দেশি-বিদেশি শীর্ষস্থানীয় কোম্পানি, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধি দল।</p>`
            : ''
        }
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
          <p style="text-align: justify; margin: 0;">
            প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি
            <strong style="background: #dbeafe; padding: 2px 4px;">${chiefGuestBn || 'প্রধান অতিথি'}</strong>।
            ${
              specialGuestsBn
                ? `বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন <strong>${specialGuestsBn}</strong>।`
                : 'অনুষ্ঠানে দেশি-বিদেশি বিশিষ্ট অতিথিবৃন্দ উপস্থিত ছিলেন।'
            }
          </p>
        </div>
        <p style="text-align: justify; margin-bottom: 16px;">
          প্রদর্শনীতে বিভিন্ন সর্বাধুনিক প্রযুক্তি ও উদ্ভাবন প্রদর্শনের পাশাপাশি আন্তর্জাতিক B2B ও B2G মিটিং, সেমিনার ও প্যানেল আলোচনা অনুষ্ঠিত হচ্ছে, যেখানে শীর্ষ ব্যক্তিবর্গ অংশ নিচ্ছেন।
        </p>
        <p style="text-align: justify; margin-bottom: 16px;">
          এই প্রদর্শনী <strong>${data.eventDurationBn || data.eventDateBn}</strong> পর্যন্ত
          <strong>${data.visitingHoursBn || 'প্রতিদিন সকাল ১০টা থেকে সন্ধ্যা ৭টা পর্যন্ত'}</strong>
          সকল দর্শকের জন্য উন্মুক্ত থাকবে।
        </p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; line-height: 1.5;">
          <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">বার্তা প্রেরক</div>
          <div style="font-weight: bold; font-size: 15px;">${data.sender.nameBn}</div>
          <div>${data.sender.designationBn}</div>
          <div>${data.sender.organizationBn}</div>
          <div>মোবাইল: ${data.sender.phone}</div>
          ${data.sender.email ? `<div>ইমেইল: ${data.sender.email}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (type === 'dual-press-release') {
    return `
      <div>
        ${renderHtmlForPdf(data, 'press-release-bn')}
        <div style="page-break-before: always; height: 1px;"></div>
        ${renderHtmlForPdf(data, 'press-release-en')}
      </div>
    `;
  }

  if (type === 'dual-invitation') {
    return `
      <div>
        ${renderHtmlForPdf(data, 'invitation-bn')}
        <div style="page-break-before: always; height: 1px;"></div>
        ${renderHtmlForPdf(data, 'invitation-en')}
      </div>
    `;
  }

  // Press Release English
  const highlightSummary = data.highlights
    .filter((h) => h.textEn.trim())
    .map((h) => h.textEn.toLowerCase())
    .join(', ');

  return `
    <div style="font-family: 'Times New Roman', Times, serif; font-size: 15px; color: #0f172a; line-height: 1.7; padding: 24px;">
      <div style="color: #334155; font-size: 14px; margin-bottom: 16px;">
        ${data.eventDateEn || '30 October, 2025'}
      </div>
      <div style="text-align: center; font-weight: bold; font-size: 22px; text-decoration: underline; margin: 20px 0;">
        PRESS RELEASE
      </div>
      <p style="text-align: justify; margin-bottom: 16px;">
        The inauguration ceremony of <strong>"${data.eventTitleEn}"</strong>, ${data.scopeEn}, was held today,
        <strong>${data.eventDateEn || 'October 30, 2025'}</strong>, at the
        <span>${data.venueEn}</span>. The event has been organized by
        <strong>${data.organizerEn}</strong>.
      </p>
      ${
        highlightSummary
          ? `<p style="text-align: justify; margin-bottom: 16px;">Focused on ${highlightSummary}, the exhibition brings together leading companies from home and abroad, along with investors, technologists, and business representatives.</p>`
          : ''
      }
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
        <p style="text-align: justify; margin: 0;">
          The exhibition was inaugurated by
          <strong style="background: #dbeafe; padding: 2px 4px;">${chiefGuestEn || 'Chief Guest'}</strong>.
          ${
            specialGuestsEn
              ? `Special Guests included <strong>${specialGuestsEn}</strong>.`
              : 'Special dignitaries and delegates attended the inauguration.'
          }
        </p>
      </div>
      <p style="text-align: justify; margin-bottom: 16px;">
        The exhibition features the latest innovations and technologies, along with international B2B and B2G meetings, seminars, and panel discussions, with active participation from top industry leaders from Bangladesh and the global maritime sector.
      </p>
      <p style="text-align: justify; margin-bottom: 16px;">
        The exhibition is open to all visitors from <strong>${data.eventDurationEn || data.eventDateEn}</strong>,
        <strong>${data.visitingHoursEn || 'daily from 10:00 AM to 7:00 PM'}</strong>.
      </p>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; line-height: 1.5;">
        <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Message sender</div>
        <div style="font-weight: bold; font-size: 15px;">${data.sender.nameEn}</div>
        <div style="font-weight: bold;">${data.sender.designationEn}</div>
        <div>${data.sender.organizationEn}</div>
        <div>RSVP: ${data.sender.phone}</div>
        ${data.sender.email ? `<div>Email: ${data.sender.email}</div>` : ''}
      </div>
    </div>
  `;
}

export async function exportToPdf(data: DocumentData, type: DocumentType): Promise<void> {
  const targetType = type;

  let filename = 'Document.pdf';
  if (targetType === 'invitation-bn') filename = `${data.editionBn || 'Media_Invitation'}_Bangla.pdf`;
  else if (targetType === 'invitation-en') filename = `${data.editionEn || 'Media_Invitation'}_English.pdf`;
  else if (targetType === 'press-release-bn') filename = `${data.editionBn || 'Press_Release'}_Bangla.pdf`;
  else if (targetType === 'press-release-en') filename = `${data.editionEn || 'Press_Release'}_English.pdf`;
  else if (targetType === 'dual-press-release') filename = `${data.editionBn || 'Press_Release'}_Bangla_English.pdf`;
  else if (targetType === 'dual-invitation') filename = `${data.editionBn || 'Media_Invitation'}_Bangla_English.pdf`;

  // Create an overlay container at (0, 0) with high z-index and explicit white background
  // Placed at 0, 0 instead of -9999px so html2canvas renders the actual content rather than a blank canvas.
  const container = document.createElement('div');
  container.id = 'pdf-render-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px'; // Standard A4 width in 96 DPI
  container.style.minHeight = '1123px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.zIndex = '999999';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  container.style.pointerEvents = 'none';
  container.innerHTML = renderHtmlForPdf(data, targetType);
  document.body.appendChild(container);

  try {
    // Wait a brief tick for fonts to be ready
    await document.fonts.ready;

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff',
      windowWidth: 794,
      onclone: (clonedDoc: Document) => {
        // Remove local stylesheets containing Tailwind v4 oklab/oklch to prevent html2canvas color parsing errors
        // Retain Google Fonts stylesheet for proper Bengali typography
        const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach((el) => {
          const href = el.getAttribute('href') || '';
          if (!href.includes('fonts.googleapis.com')) {
            el.remove();
          }
        });
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const printWidth = pageWidth - 2 * margin; // 190 mm
    const printHeight = (canvas.height * printWidth) / canvas.width;
    const usableHeight = pageHeight - 2 * margin; // 277 mm

    let heightLeft = printHeight;
    let position = margin;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, position, printWidth, printHeight);
    heightLeft -= usableHeight;

    // Additional pages if content is long
    while (heightLeft > 5) {
      position = margin - (printHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, printWidth, printHeight);
      heightLeft -= usableHeight;
    }

    pdf.save(filename.replace(/\s+/g, '_'));
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
