import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import { emptyUploadWorkspace } from './uploadWorkspace';
import { renderTemplate, DOCUMENT_SLOTS } from './templates';
import { exportToDocx } from './docxExporter';

const bn='সেভর ইন্টারন্যাশনাল প্রদর্শনীর আয়োজন করছে।\n\nঅনুষ্ঠানটি উদ্বোধন করবেন প্রধান অতিথি জনাব মাহবুবুর রহমান, সচিব, বাণিজ্য মন্ত্রণালয়, গণপ্রজাতন্ত্রী বাংলাদেশ সরকার এবং সরকারের বিভিন্ন দপ্তর, বেসরকারি খাত, শিল্প উদ্যোক্তা, আন্তর্জাতিক প্রতিনিধিদের উপস্থিতিতে।\n\nএটি পরবর্তী অনুচ্ছেদ।';
const en='Welcome to the exhibition.\n\nChief Guest: Mr. Mahbubur Rahman, Secretary, Ministry of Commerce, in the presence of government officials and international delegates.\n\nThis is the next paragraph.';
function workspace(){
 const data=emptyUploadWorkspace();
 for(const {type} of DOCUMENT_SLOTS) data.templates![type]={filename:type+'.txt',text:type.endsWith('-bn')?bn:en};
 return data;
}

test('exact screenshot narrative replaces old guest while preserving event text and attendance context',()=>{
 const data=workspace();
 data.chiefGuest.nameEn='Mr. Alamin Islam';data.chiefGuest.nameBn='জনাব আলামিন ইসলাম';
 data.chiefGuest.honorsEn='Assistant Manager';data.chiefGuest.honorsBn='সহকারী ব্যবস্থাপক';
 const text=renderTemplate(data,'invitation-bn')!;
 assert.ok(text.includes('প্রধান অতিথি জনাব আলামিন ইসলাম, সহকারী ব্যবস্থাপক এবং সরকারের বিভিন্ন দপ্তর'));
 assert.ok(!text.includes('মাহবুবুর'));assert.ok(!text.includes('বাণিজ্য মন্ত্রণালয়'));
 assert.ok(text.includes('এটি পরবর্তী অনুচ্ছেদ।'));
 assert.ok(text.includes('আন্তর্জাতিক প্রতিনিধিদের উপস্থিতিতে।'));
});

test('successive guest edits immediately reach all four raw documents and Word exports',async()=>{
 const data=workspace();
 data.chiefGuest.nameEn='Mr. Alamin Islam';data.chiefGuest.nameBn='জনাব আলামিন ইসলাম';
 data.chiefGuest.honorsEn='Assistant Manager';data.chiefGuest.honorsBn='সহকারী ব্যবস্থাপক';
 for(const {type} of DOCUMENT_SLOTS) {
  const text=renderTemplate(data,type)!;
  assert.ok(text.includes(type.endsWith('-bn')?'জনাব আলামিন ইসলাম, সহকারী ব্যবস্থাপক':'Mr. Alamin Islam, Assistant Manager'));
  assert.ok(!text.includes('Mahbubur'));assert.ok(!text.includes('মাহবুবুর'));
  const blob=await exportToDocx(data,type);
  const word=await mammoth.extractRawText({buffer:Buffer.from(await blob.arrayBuffer())});
  assert.ok(!word.value.includes('Mahbubur'));assert.ok(!word.value.includes('মাহবুবুর'));
 }
 data.chiefGuest.nameEn='Mr. Kamal Hossain';data.chiefGuest.nameBn='জনাব কামাল হোসেন';
 for(const {type} of DOCUMENT_SLOTS) assert.ok(renderTemplate(data,type)!.includes(type.endsWith('-bn')?'জনাব কামাল হোসেন':'Mr. Kamal Hossain'));
});

test('adding, editing and removing special guests updates a list absent from the original document',()=>{
 const data=workspace();
 data.chiefGuest.nameEn='Mr. Alamin';data.chiefGuest.nameBn='জনাব আলামিন';
 data.specialGuests=[{id:'one',nameEn:'Mr. Kamal',nameBn:'জনাব কামাল',designationEn:'Manager',designationBn:'ব্যবস্থাপক'}];
 for(const {type} of DOCUMENT_SLOTS) assert.ok(renderTemplate(data,type)!.includes(type.endsWith('-bn')?'বিশেষ অতিথিবৃন্দ: জনাব কামাল, ব্যবস্থাপক':'Special Guests: Mr. Kamal, Manager'));
 data.specialGuests=[];
 for(const {type} of DOCUMENT_SLOTS) assert.ok(!renderTemplate(data,type)!.includes('Kamal'));
});

test('literal special guest clauses replace old names and preserve later sentences',()=>{
 const data=emptyUploadWorkspace();
 data.templates={'press-release-bn':{filename:'bn.txt',text:'বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন জনাব পুরোনো নাম, পরিচালক।\nঅন্য তথ্য থাকবে।'},'press-release-en':{filename:'en.txt',text:'Special Guests included Mr. Old Name, Director. The event was successful.'}};
 data.specialGuests=[{id:'one',nameEn:'Mr. New Name',nameBn:'জনাব নতুন নাম',designationEn:'Manager',designationBn:'ব্যবস্থাপক'}];
 assert.equal(renderTemplate(data,'press-release-bn'),'বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন জনাব নতুন নাম, ব্যবস্থাপক।\nঅন্য তথ্য থাকবে।');
 assert.equal(renderTemplate(data,'press-release-en'),'Special Guests included Mr. New Name, Manager. The event was successful.');
});

test('documents are unchanged before the user supplies guest details',()=>{
 const data=workspace();
 assert.equal(renderTemplate(data,'invitation-bn'),bn);
 assert.equal(renderTemplate(data,'invitation-en'),en);
});
