import { DocLang, DocModel, emptyDoc } from './doc';
import { FIELD_BY_KEY, fieldSpan } from './fields';

let LANG: DocLang = 'en';
/** Field span pre-filled with a visible [placeholder] (or a real default value). */
const f = (key: string, value?: string) => fieldSpan(key, value ?? `[${FIELD_BY_KEY.get(key)?.placeholder?.[LANG] || key}]`);

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

const J = 'text-align:justify';

const invitationEn = () => `
<p style="text-align:right">Date: ${f('issueDate')}</p>
<p>To<br>${f('mediaAddressee', 'Chief Reporter')}</p>
<p><strong>Subject: Request to cover the inauguration of “${f('eventTitle')}”</strong></p>
<p>Dear Sir/Madam,</p>
<p style="${J}">${f('organizer')} is pleased to invite you to the inauguration ceremony of the ${f('edition')} of ${f('eventTitle')}, ${f('scope')}, to be held on ${f('eventDate')} at ${f('eventTime')} at ${f('venue')}.</p>
<p style="${J}">The event will be inaugurated by ${f('chiefGuestName')}, ${f('chiefGuestTitle')}, as Chief Guest. ${f('specialGuests')} will attend as Special Guests, along with industry leaders, entrepreneurs and international delegates.</p>
<p style="${J}">We would be grateful if your esteemed media house could kindly send a reporter and a photojournalist to cover the event.</p>
<p><strong>Programme schedule</strong></p>
<table class="sv-plain" style="width:auto">
<tr><td style="padding:2pt 12pt 2pt 0"><strong>Event</strong></td><td style="padding:2pt 0">${f('eventTitle')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>Venue</strong></td><td style="padding:2pt 0">${f('venue')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>Date</strong></td><td style="padding:2pt 0">${f('eventDate')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>Time</strong></td><td style="padding:2pt 0">${f('eventTime')}</td></tr>
</table>
<p>Sincerely,</p>
<p><strong>${f('senderName')}</strong><br>${f('senderTitle')}<br>${f('senderOrg')}<br>RSVP: ${f('senderPhone')}<br>${f('senderEmail')}</p>`;

const invitationBn = () => `
<p style="text-align:right">তারিখ: ${f('issueDate')}</p>
<p>বরাবর<br>${f('mediaAddressee', 'প্রধান বার্তা সম্পাদক')}</p>
<p><strong>বিষয়: “${f('eventTitle')}” এর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।</strong></p>
<p>প্রিয় মহোদয়,</p>
<p style="${J}">${f('organizer')} আগামী ${f('eventDate')} ${f('eventTime')} ${f('venue')}-এ ${f('scope')} “${f('eventTitle')}” এর ${f('edition')} উদ্বোধনী অনুষ্ঠানের আয়োজন করতে যাচ্ছে।</p>
<p style="${J}">অনুষ্ঠানে প্রধান অতিথি হিসেবে ${f('chiefGuestName')}, ${f('chiefGuestTitle')} উপস্থিত থেকে প্রদর্শনীর উদ্বোধন করবেন। বিশেষ অতিথি হিসেবে উপস্থিত থাকবেন ${f('specialGuests')}।</p>
<p style="${J}">আপনার সম্মানিত সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটোসাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীত অনুরোধ জানাচ্ছি।</p>
<p><strong>অনুষ্ঠানসূচি</strong></p>
<table class="sv-plain" style="width:auto">
<tr><td style="padding:2pt 12pt 2pt 0"><strong>অনুষ্ঠান</strong></td><td style="padding:2pt 0">${f('eventTitle')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>স্থান</strong></td><td style="padding:2pt 0">${f('venue')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>তারিখ</strong></td><td style="padding:2pt 0">${f('eventDate')}</td></tr>
<tr><td style="padding:2pt 12pt 2pt 0"><strong>সময়</strong></td><td style="padding:2pt 0">${f('eventTime')}</td></tr>
</table>
<p>বার্তা প্রেরক</p>
<p><strong>${f('senderName')}</strong><br>${f('senderTitle')}<br>${f('senderOrg')}<br>মোবাইল: ${f('senderPhone')}<br>${f('senderEmail')}</p>`;

const pressEn = () => `
<p style="text-align:right">${f('eventDate')}</p>
<h1 style="text-align:center">PRESS RELEASE</h1>
<p style="text-align:center"><strong>${f('eventTitle')} inaugurated at ${f('venue')}</strong></p>
<p style="${J}">The inauguration ceremony of the ${f('edition')} of “${f('eventTitle')}”, ${f('scope')}, was held today, ${f('eventDate')}, at ${f('venue')}. The event has been organized by ${f('organizer')}.</p>
<p style="${J}">${f('chiefGuestName')}, ${f('chiefGuestTitle')}, inaugurated the exhibition as Chief Guest. ${f('specialGuests')} were present as Special Guests.</p>
<p style="${J}">The exhibition brings together leading companies from home and abroad, along with investors, technologists and business representatives, with B2B meetings, seminars and panel discussions.</p>
<p style="${J}">The exhibition is open to all visitors until ${f('eventDuration')}, ${f('visitingHours')}.</p>
<p>Message sender</p>
<p><strong>${f('senderName')}</strong><br>${f('senderTitle')}<br>${f('senderOrg')}<br>${f('senderPhone')}<br>${f('senderEmail')}</p>`;

const pressBn = () => `
<p style="text-align:right">${f('eventDate')}</p>
<h1 style="text-align:center">সংবাদ বিজ্ঞপ্তি</h1>
<p style="text-align:center"><strong>${f('venue')}-এ “${f('eventTitle')}” এর উদ্বোধন</strong></p>
<p style="${J}">আজ ${f('eventDate')}, ${f('organizer')}-এর আয়োজনে ${f('venue')}-এ ${f('scope')} “${f('eventTitle')}” এর ${f('edition')} উদ্বোধনী অনুষ্ঠান অনুষ্ঠিত হয়েছে।</p>
<p style="${J}">প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি ${f('chiefGuestName')}, ${f('chiefGuestTitle')}। বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন ${f('specialGuests')}।</p>
<p style="${J}">প্রদর্শনীতে দেশি-বিদেশি শীর্ষস্থানীয় প্রতিষ্ঠান, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধিরা অংশ নিচ্ছেন। পাশাপাশি B2B মিটিং, সেমিনার ও প্যানেল আলোচনা অনুষ্ঠিত হচ্ছে।</p>
<p style="${J}">প্রদর্শনীটি ${f('eventDuration')} পর্যন্ত ${f('visitingHours')} সকল দর্শনার্থীর জন্য উন্মুক্ত থাকবে।</p>
<p>বার্তা প্রেরক</p>
<p><strong>${f('senderName')}</strong><br>${f('senderTitle')}<br>${f('senderOrg')}<br>মোবাইল: ${f('senderPhone')}<br>${f('senderEmail')}</p>`;

export interface ProjectTemplate {
  id: 'standard' | 'blank' | 'bimox' | 'upload';
  name: string;
  description: string;
}

export const TEMPLATES: ProjectTemplate[] = [
  { id: 'standard', name: 'Event invitation & press release', description: 'Ready-to-fill Bangla and English letters with linked fields for guests, dates and venue.' },
  { id: 'bimox', name: 'BIMOX 2026 sample', description: 'The four real BIMOX 2026 documents, converted from Word with their layout.' },
  { id: 'blank', name: 'Blank', description: 'Four empty pages: invitation and press release in Bangla and English.' },
  { id: 'upload', name: 'From my files', description: 'Upload Word, HTML or text files. Each becomes an editable document.' },
];

export function standardDocs(): { spec: ProjectDocSpec; model: DocModel }[] {
  const bodies: Record<string, () => string> = {
    'Invitation (Bangla).html': invitationBn, 'Invitation (English).html': invitationEn,
    'Press Release (Bangla).html': pressBn, 'Press Release (English).html': pressEn,
  };
  return PROJECT_DOCS.map(spec => { LANG = spec.lang; return { spec, model: emptyDoc(spec.title, spec.lang, bodies[spec.file]().trim()) }; });
}

export function blankDocs(): { spec: ProjectDocSpec; model: DocModel }[] {
  return PROJECT_DOCS.map(spec => ({ spec, model: emptyDoc(spec.title, spec.lang) }));
}
