import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatChiefGuestBn,
  formatChiefGuestEn,
  formatSpecialGuestsBn,
  formatSpecialGuestsEn,
  generateMediaInvitationBn,
  generateMediaInvitationEn,
  generatePressReleaseBn,
  generatePressReleaseEn,
} from './documentGenerator';
import { bimox2025Preset } from './presets';

test('formatChiefGuestBn combines name, honors, and designation', () => {
  const result = formatChiefGuestBn({
    nameBn: 'রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা',
    nameEn: 'Rear Admiral Mohammad Musa',
    honorsBn: 'OSP, NPP',
    honorsEn: 'OSP, NPP',
    designationBn: 'সহকারী নৌবাহিনী প্রধান (অপারেশনস)',
    designationEn: 'Assistant Chief of Naval Staff (O)',
  });
  assert.equal(
    result,
    'রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা, OSP, NPP, সহকারী নৌবাহিনী প্রধান (অপারেশনস)'
  );
});

test('formatSpecialGuestsBn properly joins multiple guests with commas and এবং', () => {
  const sampleGuests = [
    {
      id: '1',
      nameBn: 'জনাব মাসুদ আলী খান',
      nameEn: 'Mr Masud Ali Khan',
      honorsBn: '',
      honorsEn: '',
      designationBn: 'সহ-সভাপতি',
      designationEn: 'Vice President',
    },
    {
      id: '2',
      nameBn: 'জনাব মো: ফায়জুল আলম',
      nameEn: 'Mr Md Faizul Alam',
      honorsBn: '',
      honorsEn: '',
      designationBn: 'ব্যবস্থাপনা পরিচালক',
      designationEn: 'Managing Director',
    },
  ];
  const formatted = formatSpecialGuestsBn(sampleGuests);
  assert.ok(formatted.includes('এবং জনাব মো: ফায়জুল আলম'));
  assert.ok(formatted.includes('জনাব মাসুদ আলী খান'));
});

test('formatSpecialGuestsEn formats English list with and', () => {
  const sampleGuests = [
    {
      id: '1',
      nameBn: '',
      nameEn: 'Mr. John Doe',
      honorsBn: '',
      honorsEn: '',
      designationBn: '',
      designationEn: 'Director',
    },
    {
      id: '2',
      nameBn: '',
      nameEn: 'Ms. Jane Smith',
      honorsBn: '',
      honorsEn: '',
      designationBn: '',
      designationEn: 'Chairperson',
    },
  ];
  const formatted = formatSpecialGuestsEn(sampleGuests);
  assert.ok(formatted.includes('Mr. John Doe, Director, and Ms. Jane Smith, Chairperson'));
});

test('generateMediaInvitationBn includes chief guest, dates, and venue', () => {
  const doc = generateMediaInvitationBn(bimox2025Preset);
  assert.ok(doc.includes('রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা'));
  assert.ok(doc.includes('৩০শে অক্টোবর ২০২৫'));
  assert.ok(doc.includes('আইসিসিবি'));
  assert.ok(doc.includes('সেভার ইন্টারন্যাশনাল লিমিটেড'));
});

test('generatePressReleaseEn includes chief guest and special guests', () => {
  const doc = generatePressReleaseEn(bimox2025Preset);
  assert.ok(doc.includes('Rear Admiral Mohammad Musa'));
  assert.ok(doc.includes('Rear Admiral Md. Ziaul Hoque'));
  assert.ok(doc.includes('Savor International Limited'));
  assert.ok(doc.includes('PRESS RELEASE'));
});

test('parsePrTextHeuristic parses event title, chief guest, and dates', async () => {
  const { parsePrTextHeuristic } = await import('./textParser.ts');
  const sampleDocxText = `
তারিখঃ ২৮শে অক্টোবর, ২০২৫
বরাবর, প্রধান বার্তা সম্পাদক
বিষয়: "৭ম BIMOX 2025" শীর্ষক আন্তর্জাতিক প্রদর্শনী
সেভার ইন্টারন্যাশনাল লিমিটেড, আগামী ৩০শে অক্টোবর ২০২৫ তারিখে সকাল ১০.০০ ঘটিকায়
এই অনুষ্ঠানে প্রধান অতিথি হিসেবে রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা, OSP, NPP, সহকারী নৌবাহিনী প্রধান উপস্থিত থেকে অনুষ্ঠান উদ্বোধন করবেন।
स्थान: हॉल-०४, আইসিসিবি, কুড়িল, ঢাকা
  `;
  const parsed = parsePrTextHeuristic(sampleDocxText);
  assert.ok(parsed.chiefGuest.nameBn.includes('রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা'));
  assert.ok(parsed.eventDateBn.includes('৩০শে অক্টোবর ২০২৫'));
  assert.ok(parsed.inaugurationTimeBn.includes('১০.০০'));
});


test('reference imports never inherit sample guests or dates', async () => {
  const { parsePrTextHeuristic } = await import('./textParser.ts');
  const parsed = parsePrTextHeuristic('A new exhibition');
  assert.equal(parsed.chiefGuest.nameBn, '');
  assert.equal(parsed.eventDateBn, '');
  assert.equal(parsed.specialGuests.length, 0);
});
