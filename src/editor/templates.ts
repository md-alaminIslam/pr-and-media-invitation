import { DocLang, DocModel, emptyDoc } from './doc';
import { Lang, RETIRED_FIELDS, emptyValues, slotHtml } from './values';

export interface ProjectDocSpec { file: string; title: string; lang: DocLang; kind: 'invitation' | 'press' }

/** The four documents every new project starts with (file names inside the project folder). */
export const PROJECT_DOCS: ProjectDocSpec[] = [
  { file: 'Invitation (Bangla).html', title: 'মিডিয়া ইনভিটেশন', lang: 'bn', kind: 'invitation' },
  { file: 'Invitation (English).html', title: 'Media Invitation', lang: 'en', kind: 'invitation' },
  { file: 'Press Release (Bangla).html', title: 'সংবাদ বিজ্ঞপ্তি', lang: 'bn', kind: 'press' },
  { file: 'Press Release (English).html', title: 'Press Release', lang: 'en', kind: 'press' },
];

export function docOrder(file: string): number {
  const i = PROJECT_DOCS.findIndex(d => d.file === file);
  return i < 0 ? 100 : i;
}

export function shortDocLabel(file: string): string {
  const known = PROJECT_DOCS.find(d => d.file === file);
  if (known) return `${known.kind === 'invitation' ? 'Invitation' : 'Press release'} · ${known.lang === 'bn' ? 'বাংলা' : 'EN'}`;
  return file.replace(/\.html$/i, '');
}

/** A linked slot, pre-filled with its placeholder. */
function slot(lang: Lang, key: string, attrs: Record<string, string> = {}): string {
  if (RETIRED_FIELDS.has(key)) return slotHtml(emptyValues(), key, lang, { fmt: attrs.fmt }); // plain text, not shared
  const a = Object.entries(attrs).map(([k, v]) => ` data-${k}="${v}"`).join('');
  return `<span data-field="${key}"${a}>${slotHtml(emptyValues(), key, lang, { fmt: attrs.fmt })}</span>`;
}

const J = 'text-align:justify';

function invitationEn(): string {
  const s = (k: string, a?: Record<string, string>) => slot('en', k, a);
  return `
<p style="text-align:right">Date: ${s('issueDate', { fmt: 'D MMMM, YYYY' })}</p>
<p>To<br>Chief Reporter</p>
<p><strong>Subject: Request to send a journalist to the inauguration ceremony of “${s('edition', { fmt: 'ordinal' })} ${s('shortName')} ${s('year')}”</strong></p>
<p>Dear Sir/Madam,</p>
<p style="${J}">${s('organizer')} is pleased to invite you to the inauguration ceremony of the ${s('edition', { fmt: 'ordinal' })} edition of ${s('exhibitionName')} – ${s('shortName')} ${s('year')}, scheduled to be held on ${s('eventDate', { fmt: 'D MMMM, YYYY' })} at ${s('eventTime', { fmt: 'h:mm A' })} at ${s('hall', { fmt: 'Hall-{nn}' })}, ${s('venue')}.</p>
<p style="${J}">The ceremony will be inaugurated by Chief Guest: ${s('chiefGuest')}. Special Guests: ${s('specialGuests', { sep: 'comma' })} will also be present at the ceremony.</p>
<p style="${J}">We sincerely request your esteemed media house to kindly send a reporter and a photojournalist to cover the event.</p>
<p><strong>Program schedule</strong><br>Inaugural ceremony: “${s('edition', { fmt: 'ordinal' })} ${s('exhibitionName')} – ${s('shortName')} ${s('year')}”<br>Place: ${s('hall', { fmt: 'Hall-{nn}' })}, ${s('venue')}<br>Date: ${s('eventDate', { fmt: 'D MMMM, YYYY' })}<br>Time: ${s('eventTime', { fmt: 'h.mm A' })}</p>
<p>${s('contactName')}<br>${s('contactTitle')}<br>${s('contactOrg')}<br>RSVP: ${s('contactPhone')}</p>`;
}

function invitationBn(): string {
  const s = (k: string, a?: Record<string, string>) => slot('bn', k, a);
  return `
<p style="text-align:right">তারিখঃ ${s('issueDate', { fmt: 'D MMMM, YYYY' })}</p>
<p>বরাবর<br>প্রধান বার্তা সম্পাদক</p>
<p><strong>বিষয়: “${s('edition', { fmt: 'ordinal' })} ${s('shortName')} ${s('year')}” শীর্ষক আন্তর্জাতিক প্রদর্শনীর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।</strong></p>
<p>প্রিয় মহোদয়,</p>
<p style="${J}">${s('organizer')}, আগামী ${s('eventDate', { fmt: 'D MMMM, YYYY' })} তারিখে ${s('eventTime', { fmt: 'P h.mm ঘটিকায়' })} ${s('venue')}, ${s('hall', { fmt: 'হল-{nn}' })}-এ “${s('exhibitionName')} – ${s('shortName')} ${s('year')}” এর ${s('edition', { fmt: 'ordinal' })} আসরের উদ্বোধনের আয়োজন করতে যাচ্ছে।</p>
<p style="${J}">অনুষ্ঠানটি উদ্বোধন করবেন প্রধান অতিথি: ${s('chiefGuest')}। বিশেষ অতিথি: ${s('specialGuests', { sep: 'comma' })} উপস্থিত থাকবেন।</p>
<p style="${J}">আপনার সম্মানিত সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটোসাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীত অনুরোধ জানাচ্ছি।</p>
<p><strong>অনুষ্ঠানসূচি</strong><br>উদ্বোধনী অনুষ্ঠান: “${s('edition', { fmt: 'ordinal' })} ${s('shortName')} ${s('year')}”<br>স্থান: ${s('hall', { fmt: 'হল-{nn}' })}, ${s('venue')}<br>তারিখ: ${s('eventDate', { fmt: 'D MMMM, YYYY' })}<br>সময়: ${s('eventTime', { fmt: 'P h.mm ঘটিকায়' })}</p>
<p>${s('contactName')}<br>${s('contactTitle')}<br>${s('contactOrg')}<br>মোবাইল: ${s('contactPhone')}</p>`;
}

function pressEn(): string {
  const s = (k: string, a?: Record<string, string>) => slot('en', k, a);
  return `
<p>${s('issueDate', { fmt: 'D MMMM, YYYY' })}</p>
<h1 style="text-align:center">PRESS RELEASE</h1>
<p style="${J}">The inauguration ceremony of “${s('exhibitionName')} – ${s('shortName')} ${s('year')}” was held today, ${s('eventDate', { fmt: 'MMMM D, YYYY' })}, at ${s('venue')}. The event has been organized by ${s('organizer')}.</p>
<p style="${J}">The exhibition was inaugurated by Chief Guest: ${s('chiefGuest', { bold: '1' })}. Special Guests: ${s('specialGuests', { sep: 'comma', bold: '1' })} were also present at the ceremony.</p>
<p style="${J}">The exhibition brings together leading companies from home and abroad, along with investors, technologists and business representatives.</p>
<p style="${J}">The exhibition is open to all visitors from ${s('eventDate', { fmt: 'MMMM D' })} to ${s('endDate', { fmt: 'MMMM D, YYYY' })}, daily from ${s('visitingHours')}.</p>
<p>Message sender<br>${s('contactName')}<br>${s('contactTitle')}<br>${s('contactOrg')}<br>RSVP: ${s('contactPhone')}</p>`;
}

function pressBn(): string {
  const s = (k: string, a?: Record<string, string>) => slot('bn', k, a);
  return `
<p>তারিখঃ ${s('issueDate', { fmt: 'D MMMM, YYYY' })}</p>
<h1 style="text-align:center">সংবাদ বিজ্ঞপ্তি</h1>
<p style="${J}">আজ ${s('eventDate', { fmt: 'D MMMM YYYY' })}, ${s('organizer')}-এর আয়োজনে ${s('venue')}-এ অনুষ্ঠিত হলো “${s('edition', { fmt: 'ordinal' })} ${s('shortName')} ${s('year')}”–এর উদ্বোধনী অনুষ্ঠান।</p>
<p style="${J}">প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি: ${s('chiefGuest', { bold: '1' })}। বিশেষ অতিথি: ${s('specialGuests', { sep: 'comma', bold: '1' })}।</p>
<p style="${J}">প্রদর্শনীতে দেশি-বিদেশি শীর্ষস্থানীয় প্রতিষ্ঠান, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধিরা অংশ নিচ্ছেন।</p>
<p style="${J}">প্রদর্শনীটি ${s('eventDate', { fmt: 'D MMMM' })} থেকে ${s('endDate', { fmt: 'D MMMM, YYYY' })} পর্যন্ত প্রতিদিন ${s('visitingHours')} সকল দর্শনার্থীর জন্য উন্মুক্ত থাকবে।</p>
<p>বার্তা প্রেরক<br>${s('contactName')}<br>${s('contactTitle')}<br>${s('contactOrg')}<br>মোবাইল: ${s('contactPhone')}</p>`;
}

export interface ProjectTemplate {
  id: 'standard' | 'blank' | 'bimox' | 'upload';
  name: string;
  description: string;
}

export const TEMPLATES: ProjectTemplate[] = [
  { id: 'standard', name: 'Event invitation & press release', description: 'Bangla and English letters with shared fields for the exhibition, dates, guests and contact.' },
  { id: 'bimox', name: 'BIMOX 2026 sample', description: 'The four real BIMOX 2026 documents. Shared fields are found automatically.' },
  { id: 'blank', name: 'Blank', description: 'Four empty pages: invitation and press release in Bangla and English.' },
  { id: 'upload', name: 'From my files', description: 'Upload Word, HTML or text files. Shared fields are found automatically.' },
];

export function standardDocs(): { spec: ProjectDocSpec; model: DocModel }[] {
  const bodies: Record<string, () => string> = {
    'Invitation (Bangla).html': invitationBn, 'Invitation (English).html': invitationEn,
    'Press Release (Bangla).html': pressBn, 'Press Release (English).html': pressEn,
  };
  return PROJECT_DOCS.map(spec => ({ spec, model: emptyDoc(spec.title, spec.lang, bodies[spec.file]().trim()) }));
}

export function blankDocs(): { spec: ProjectDocSpec; model: DocModel }[] {
  return PROJECT_DOCS.map(spec => ({ spec, model: emptyDoc(spec.title, spec.lang) }));
}
