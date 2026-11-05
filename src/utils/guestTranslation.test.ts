import test from 'node:test';
import assert from 'node:assert/strict';
import {translateGuestField as t,rememberGuestCorrection,needsGuestReview} from './guestTranslation';
import {translateEnglishToBangla,PHRASE_DICTIONARY,WORD_DICTIONARY} from './transliteration';

const jobs: [string,string][] = [
 ['Software developer','সফটওয়্যার ডেভেলপার'],
 ['Software engineer','সফটওয়্যার প্রকৌশলী'],
 ['Senior Software Engineer','জ্যেষ্ঠ সফটওয়্যার প্রকৌশলী'],
 ['Web Developer','ওয়েব ডেভেলপার'],
 ['Full-stack Developer','ফুল স্ট্যাক ডেভেলপার'],
 ['Frontend Developer','ফ্রন্ট এন্ড ডেভেলপার'],
 ['Backend Developer','ব্যাক এন্ড ডেভেলপার'],
 ['Data Analyst','ডেটা বিশ্লেষক'],
 ['Network Engineer','নেটওয়ার্ক প্রকৌশলী'],
 ['Project Manager','প্রকল্প ব্যবস্থাপক'],
 ['Assistant Manager, Digital Marketing','সহকারী ব্যবস্থাপক, ডিজিটাল মার্কেটিং'],
 ['Senior Executive, Sales & Marketing','জ্যেষ্ঠ নির্বাহী, বিক্রয় ও বিপণন'],
 ['Manager, Accounts & Admin','ব্যবস্থাপক, হিসাব ও প্রশাসন'],
 ['Asst. Manager, Digital Marketing','সহকারী ব্যবস্থাপক, ডিজিটাল মার্কেটিং'],
 ['Sr. Executive, HR','জ্যেষ্ঠ নির্বাহী, মানবসম্পদ'],
 ['Graphic Designer','গ্রাফিক ডিজাইনার'],
 ['Chief Accountant','প্রধান হিসাবরক্ষক'],
 ['Finance Officer','অর্থ কর্মকর্তা'],
 ['Professor','অধ্যাপক'],
 ['Associate Professor','সহযোগী অধ্যাপক'],
 ['Assistant Professor','সহকারী অধ্যাপক'],
 ['Medical Officer','চিকিৎসা কর্মকর্তা'],
 ['Public Relations Officer','জনসংযোগ কর্মকর্তা'],
 ['Chief Reporter','প্রধান প্রতিবেদক'],
 ['Photojournalist','ফটোসাংবাদিক'],
 ['Savor International Limited','সেভার ইন্টারন্যাশনাল লিমিটেড'],
 ['Rear Admiral Mohammad Musa','রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা'],
];
for(const [en,bn] of jobs) test(`professional field: ${en}`,()=>{
 for(const field of ['honorsEn','designationEn'] as const) assert.equal(t(en,field),bn);
});

test('unknown professional terms stay readable in English and require review',()=>{
 assert.equal(t('QuantumX Specialist','designationEn'),'QuantumX Specialist');
 assert.ok(needsGuestReview('QuantumX Specialist','designationEn'));
 assert.equal(needsGuestReview('Software developer','designationEn'),false);
 assert.equal(t('Manager, ZephyrLabs','designationEn'),'ব্যবস্থাপক, ZephyrLabs');
});

test('saved manual corrections are reused without overwriting official spelling',()=>{
 const corrections=rememberGuestCorrection(undefined,'Mr. Lam','nameEn','জনাব ল্যাম');
 assert.equal(t(' Mr.  LAM ','nameEn',corrections),'জনাব ল্যাম');
 assert.equal(needsGuestReview('Mr. Lam','nameEn',corrections),false);
 assert.notEqual(t('Mr. Limon','nameEn',corrections),'জনাব ল্যাম');
 const next=rememberGuestCorrection(corrections,'QuantumX Specialist','designationEn','কোয়ান্টামএক্স বিশেষজ্ঞ');
 assert.equal(t('QuantumX Specialist','designationEn',next),'কোয়ান্টামএক্স বিশেষজ্ঞ');
 assert.equal(needsGuestReview('QuantumX Specialist','designationEn',next),false);
 assert.equal(t('Software developer','honorsEn',next),'সফটওয়্যার ডেভেলপার');
});

test('blank input and explicit blank correction never restore an old translation',()=>{
 for(const field of ['nameEn','honorsEn','designationEn'] as const) assert.equal(t('',field),'');
 const corrections=rememberGuestCorrection(undefined,'Mr. Lam','nameEn','');
 assert.equal(t('Mr. Lam','nameEn',corrections),'');
});

test('all dictionary entries work with punctuation and abbreviations',()=>{
 for(const [en,bn] of Object.entries({...PHRASE_DICTIONARY,...WORD_DICTIONARY})) {
  assert.equal(translateEnglishToBangla(en),bn,en);
 }
});
