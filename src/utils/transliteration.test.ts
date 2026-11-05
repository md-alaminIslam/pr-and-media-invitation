import test from 'node:test';
import assert from 'node:assert';
import { translateEnglishToBangla } from './transliteration.ts';

test('translateEnglishToBangla translates Military Ranks & Chief Guest', () => {
  const result = translateEnglishToBangla('Rear Admiral Mohammad Musa');
  assert.strictEqual(result, 'রিয়ার অ্যাডমিরাল মোহাম্মদ মুসা');
});

test('translateEnglishToBangla translates Naval Staff & Branch', () => {
  const result = translateEnglishToBangla('Assistant Chief of Naval Staff (O), Bangladesh Navy');
  assert.strictEqual(result, 'সহকারী নৌবাহিনী প্রধান (অপারেশনস), বাংলাদেশ নৌবাহিনী');
});

test('translateEnglishToBangla translates Adviser & Dual Ministries', () => {
  const result = translateEnglishToBangla('Brigadier General (Retd.) M. Sakhawat Hossain, Adviser, Ministry of Shipping and Ministry of Labour & Employment');
  assert.ok(result.includes('ব্রিগেডিয়ার জেনারেল (অব.) এম. সাখাওয়াত হোসেন'));
  assert.ok(result.includes('উপদেষ্টা'));
  assert.ok(result.includes('নৌপরিবহন মন্ত্রণালয়'));
  assert.ok(result.includes('শ্রম ও কর্মসংস্থান মন্ত্রণালয়'));
});

test('translateEnglishToBangla translates Coast Guard Director General', () => {
  const result = translateEnglishToBangla('Rear Admiral Md. Ziaul Hoque, Director General, Bangladesh Coast Guard');
  assert.strictEqual(result, 'রিয়ার অ্যাডমিরাল মো: জিয়াউল হক, মহাপরিচালক, বাংলাদেশ কোস্ট গার্ড');
});

test('translateEnglishToBangla translates Corporate Vice President & Chamber', () => {
  const result = translateEnglishToBangla('Mr. Masud Ali Khan, Vice President, Bangladesh China Chamber of Commerce & Industry');
  assert.strictEqual(result, 'জনাব মাসুদ আলী খান, সহ-সভাপতি, বাংলাদেশ চায়না চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি');
});

test('translateEnglishToBangla translates foreign guest names with phonetic converter', () => {
  const result = translateEnglishToBangla('Mr. Edgars Dzenis');
  assert.strictEqual(result, 'জনাব এডগার্স ডজেনিস');
});

test('translateEnglishToBangla translates corporate designations and nautical institute', () => {
  const result = translateEnglishToBangla('Capt. Md. Shafiqul Islam Bhuiyan, Chairman, GroupNautika, Ex-Chairman, The Nautical Institute of Bangladesh');
  assert.ok(result.includes('ক্যাপ্টেন মো: শফিকুল ইসলাম ভূঁইয়া'));
  assert.ok(result.includes('চেয়ারম্যান, গ্রুপনটিকা'));
  assert.ok(result.includes('সাবেক চেয়ারম্যান, দ্য নটিক্যাল ইনস্টিটিউট অব বাংলাদেশ'));
});

test('digital marketing title from reported screenshot uses accepted Bengali spelling', () => {
  assert.strictEqual(translateEnglishToBangla('Assistant Manager, Digital Marketing'), 'সহকারী ব্যবস্থাপক, ডিজিটাল মার্কেটিং');
  assert.strictEqual(translateEnglishToBangla('  assistant manager, DIGITAL   MARKETING  '), 'সহকারী ব্যবস্থাপক, ডিজিটাল মার্কেটিং');
});

test('common business job titles translate by meaning rather than letter sounds', () => {
  assert.strictEqual(translateEnglishToBangla('Senior Executive, Sales & Marketing'), 'জ্যেষ্ঠ নির্বাহী, বিক্রয় ও বিপণন');
  assert.strictEqual(translateEnglishToBangla('Manager, Accounts & Admin'), 'ব্যবস্থাপক, হিসাব ও প্রশাসন');
  assert.strictEqual(translateEnglishToBangla('Asst. Manager, Digital Marketing'), 'সহকারী ব্যবস্থাপক, ডিজিটাল মার্কেটিং');
  assert.strictEqual(translateEnglishToBangla('Sr. Executive, HR'), 'জ্যেষ্ঠ নির্বাহী, মানবসম্পদ');
});

test('name in screenshot stays correctly transliterated and empty input clears', () => {
  assert.strictEqual(translateEnglishToBangla('Mr. Al-amin Islam'), 'জনাব আল-আমিন ইসলাম');
  assert.strictEqual(translateEnglishToBangla(''), '');
});
