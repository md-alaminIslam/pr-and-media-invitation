import { renderTemplate } from './templates';
import { DocumentData, GuestItem } from '../types';

export function formatChiefGuestBn(chiefGuest: DocumentData['chiefGuest']): string {
  const parts = [];
  if (chiefGuest.nameBn) parts.push(chiefGuest.nameBn);
  if (chiefGuest.honorsBn) parts.push(chiefGuest.honorsBn);
  if (chiefGuest.designationBn) parts.push(chiefGuest.designationBn);
  return parts.join(', ');
}

export function formatChiefGuestEn(chiefGuest: DocumentData['chiefGuest']): string {
  const parts = [];
  if (chiefGuest.nameEn) parts.push(chiefGuest.nameEn);
  if (chiefGuest.honorsEn) parts.push(chiefGuest.honorsEn);
  if (chiefGuest.designationEn) parts.push(chiefGuest.designationEn);
  return parts.join(', ');
}

export function formatSingleGuestBn(guest: GuestItem): string {
  const parts = [];
  if (guest.nameBn) parts.push(guest.nameBn);
  if (guest.honorsBn) parts.push(guest.honorsBn);
  if (guest.designationBn) parts.push(guest.designationBn);
  return parts.join(', ');
}

export function formatSingleGuestEn(guest: GuestItem): string {
  const parts = [];
  if (guest.nameEn) parts.push(guest.nameEn);
  if (guest.honorsEn) parts.push(guest.honorsEn);
  if (guest.designationEn) parts.push(guest.designationEn);
  return parts.join(', ');
}

export function formatSpecialGuestsBn(guests: GuestItem[]): string {
  const valid = guests.filter(g => g.nameBn || g.designationBn);
  if (valid.length === 0) return '';
  if (valid.length === 1) return formatSingleGuestBn(valid[0]);
  
  const formatted = valid.map(g => formatSingleGuestBn(g));
  const allButLast = formatted.slice(0, -1).join(', ');
  const last = formatted[formatted.length - 1];
  return `${allButLast} এবং ${last}`;
}

export function formatSpecialGuestsEn(guests: GuestItem[]): string {
  const valid = guests.filter(g => g.nameEn || g.designationEn);
  if (valid.length === 0) return '';
  if (valid.length === 1) return formatSingleGuestEn(valid[0]);

  const formatted = valid.map(g => formatSingleGuestEn(g));
  const allButLast = formatted.slice(0, -1).join(', ');
  const last = formatted[formatted.length - 1];
  return `${allButLast}, and ${last}`;
}

export function generateMediaInvitationBn(data: DocumentData): string {
  const custom = renderTemplate(data, 'invitation-bn');
  if (custom !== null) return custom;
  const cg = formatChiefGuestBn(data.chiefGuest);
  const bulletLines = data.highlights
    .filter(h => h.textBn.trim())
    .map(h => `• ${h.textBn}`)
    .join('\n');

  return `তারিখঃ ${data.issueDateBn || '২৮শে অক্টোবর, ২০২৫'}

বরাবর,
${data.mediaAddresseeBn || 'প্রধান বার্তা সম্পাদক'}

বিষয়: "${data.editionBn || data.eventTitleBn}" শীর্ষক আন্তর্জাতিক প্রদর্শনীর উদ্বোধনী অনুষ্ঠানে প্রতিবেদক ও ফটোসাংবাদিক পাঠানোর অনুরোধ।

প্রিয় মহোদয়,

${data.organizerBn || 'আয়োজক প্রতিষ্ঠান'}, আগামী ${data.eventDateBn || 'তারিখে'} ${data.inaugurationTimeBn || 'সকাল ১০.০০ ঘটিকায়'} ${data.venueBn || 'ভেন্যুতে'}, ${data.scopeBn || 'গুরুত্বপূর্ণ শিল্পের প্রদর্শনী'} “${data.eventTitleBn}” এর ${data.editionBn ? data.editionBn + ' আসরের' : ''} উদ্বোধনের আয়োজন করতে যাচ্ছে।

এই অনুষ্ঠানে প্রধান অতিথি হিসেবে ${cg || 'প্রধান অতিথি'} উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন বলে বিশেষ সম্মতি প্রদান করেছেন। দেশ-বিদেশের বহু বিশিষ্ট ব্যক্তি ও প্রতিষ্ঠান এই গুরুত্বপূর্ণ প্রদর্শনীতে অংশগ্রহণ করবেন।

এই আন্তর্জাতিক প্রদর্শনীতে প্রদর্শিত হবে—
${bulletLines}

প্রদর্শনীটি সংশ্লিষ্ট শিল্পের সাথে বৈশ্বিক বাজারের একটি অনন্য সেতুবন্ধন তৈরি করবে এবং বিনিয়োগ, প্রযুক্তি ও বাণিজ্য উন্নয়নে নতুন দিগন্ত উন্মোচন করবে।

আপনার সম্মানিত সংবাদপত্র/সংবাদমাধ্যমের একজন প্রতিবেদক ও একজন ফটো সাংবাদিক পাঠিয়ে অনুষ্ঠানের সংবাদ প্রচারের জন্য বিনীতভাবে অনুরোধ জানাচ্ছি।

অনুষ্ঠানসূচি
উদ্বোধনী অনুষ্ঠান: "${data.eventTitleBn}"
স্থান: ${data.venueBn}
তারিখ: ${data.eventDateBn}
সময়: ${data.inaugurationTimeBn}

বার্তা প্রেরক
${data.sender.nameBn}
${data.sender.designationBn}
${data.sender.organizationBn}
মোবাইল: ${data.sender.phone}`;
}

export function generateMediaInvitationEn(data: DocumentData): string {
  const custom = renderTemplate(data, 'invitation-en');
  if (custom !== null) return custom;
  const cg = formatChiefGuestEn(data.chiefGuest);
  const bulletLines = data.highlights
    .filter(h => h.textEn.trim())
    .map(h => `• ${h.textEn}`)
    .join('\n');

  return `Date: ${data.issueDateEn || '28 October, 2025'}

To,
${data.mediaAddresseeEn || 'Chief Reporter'}

Subject: Request to send Journalist to the inauguration ceremony of International Exhibition – "${data.editionEn || data.eventTitleEn}"

Dear Sir/Madam,

${data.organizerEn || 'The Organizer'} is pleased to invite you to the Inauguration Ceremony of the ${data.editionEn || ''} of ${data.eventTitleEn}, scheduled to be held on ${data.eventDateEn || 'scheduled date'} at ${data.inaugurationTimeEn || '10:00 AM'} at the ${data.venueEn || 'Venue'}.

The event will be inaugurated by ${cg || 'Chief Guest'}, with distinguished guests from government and private sectors, industry leaders, entrepreneurs, and international delegates in attendance.

The exhibition will feature:
${bulletLines}

This international exhibition will create a unique platform connecting the industry with the global market, opening new opportunities in investment, technology, and trade.

We sincerely request your esteemed media house to kindly send a reporter and a photojournalist to cover the event.

Program Schedule
Inaugural Ceremony "${data.editionEn ? data.editionEn + ' ' : ''}${data.eventTitleEn}"
Place: ${data.venueEn}
Date: ${data.eventDateEn}
Time: ${data.inaugurationTimeEn}

${data.sender.nameEn}
${data.sender.designationEn}
${data.sender.organizationEn}
RSVP: ${data.sender.phone}`;
}

export function generatePressReleaseBn(data: DocumentData): string {
  const custom = renderTemplate(data, 'press-release-bn');
  if (custom !== null) return custom;
  const cg = formatChiefGuestBn(data.chiefGuest);
  const sg = formatSpecialGuestsBn(data.specialGuests);
  const highlightSummary = data.highlights
    .filter(h => h.textBn.trim())
    .map(h => h.textBn)
    .join(', ');

  const guestsSentence = sg
    ? `প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি ${cg}। বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন ${sg}।`
    : `প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি ${cg}। অনুষ্ঠানে দেশি-বিদেশি বিশিষ্ট অতিথিবৃন্দ উপস্থিত ছিলেন।`;

  return `${data.eventDateBn || '৩০ অক্টোবর, ২০২৫'}

সংবাদ বিজ্ঞপ্তি

আজ ${data.eventDateBn || 'আজ'}, ${data.organizerBn}-এর আয়োজনে ${data.venueBn}-এ অনুষ্ঠিত হলো ${data.scopeBn} “${data.editionBn || data.eventTitleBn}”-এর উদ্বোধনী অনুষ্ঠান।

${highlightSummary ? highlightSummary + ' প্রযুক্তিকে কেন্দ্র করে আয়োজিত এই প্রদর্শনীতে অংশ নিচ্ছে দেশি-বিদেশি শীর্ষস্থানীয় কোম্পানি, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধি দল।' : 'আয়োজিত এই প্রদর্শনীতে অংশ নিচ্ছে দেশি-বিদেশি শীর্ষস্থানীয় কোম্পানি, বিনিয়োগকারী, প্রযুক্তিবিদ ও ব্যবসায়ী প্রতিনিধি দল।'}

${guestsSentence}

প্রদর্শনীতে বিভিন্ন প্রযুক্তি ও উদ্ভাবন প্রদর্শনের পাশাপাশি আন্তর্জাতিক B2B ও B2G মিটিং, সেমিনার ও প্যানেল আলোচনা অনুষ্ঠিত হচ্ছে, যেখানে সংশ্লিষ্ট শিল্পের শীর্ষ ব্যক্তিবর্গ অংশ নিচ্ছেন।

এই প্রদর্শনী ${data.eventDurationBn || data.eventDateBn} পর্যন্ত ${data.visitingHoursBn || 'প্রতিদিন'} সকল দর্শকের জন্য উন্মুক্ত থাকবে।

বার্তা প্রেরক
${data.sender.nameBn}
${data.sender.designationBn}
${data.sender.organizationBn}
মোবাইল: ${data.sender.phone}`;
}

export function generatePressReleaseEn(data: DocumentData): string {
  const custom = renderTemplate(data, 'press-release-en');
  if (custom !== null) return custom;
  const cg = formatChiefGuestEn(data.chiefGuest);
  const sg = formatSpecialGuestsEn(data.specialGuests);
  const highlightSummary = data.highlights
    .filter(h => h.textEn.trim())
    .map(h => h.textEn.toLowerCase())
    .join(', ');

  const guestsSentence = sg
    ? `The exhibition was inaugurated by ${cg}. Special Guests included ${sg}.`
    : `The exhibition was inaugurated by ${cg}, with distinguished guests in attendance.`;

  return `${data.eventDateEn || '30 October, 2025'}

PRESS RELEASE

The inauguration ceremony of "${data.eventTitleEn}", ${data.scopeEn}, was held today, ${data.eventDateEn || 'today'}, at the ${data.venueEn}. The event has been organized by ${data.organizerEn}.

${highlightSummary ? `Focused on ${highlightSummary}, the exhibition brings together leading companies from home and abroad, along with investors, technologists, and business representatives.` : 'The exhibition brings together leading companies from home and abroad, along with investors, technologists, and business representatives.'}

${guestsSentence}

The exhibition features the latest innovations and technologies, along with international B2B and B2G meetings, seminars, and panel discussions, with active participation from top industry leaders.

The exhibition is open to all visitors from ${data.eventDurationEn || data.eventDateEn}, ${data.visitingHoursEn}.

Message sender
${data.sender.nameEn}
${data.sender.designationEn}
${data.sender.organizationEn}
RSVP: ${data.sender.phone}`;
}
