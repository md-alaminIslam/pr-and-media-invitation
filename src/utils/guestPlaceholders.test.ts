import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import { emptyUploadWorkspace, submitUploadedFiles } from './uploadWorkspace';
import { renderTemplate, DOCUMENT_SLOTS, bindGuestPlaceholders } from './templates';
import { translateGuestField } from './guestTranslation';
import { exportToDocx } from './docxExporter';
import { generateMediaInvitationBn,generateMediaInvitationEn,generatePressReleaseBn,generatePressReleaseEn } from './documentGenerator';

function fourFiles() {
 const files:any={};
 for(const {type} of DOCUMENT_SLOTS) files[type]={filename:type+'.txt',text:type+'\n'+(type.endsWith('-bn')?'প্রদর্শনীর উদ্বোধন করেন প্রধান অতিথি জনাব [প্রধান অতিথির নাম]। বিশেষ অতিথি হিসেবে উপস্থিত ছিলেন [বিশেষ অতিথিদের নাম ও পদবী]।':'Chief Guest: [Chief Guest Name]. Special Guests: [Special Guests Names and Designations].')};
 return files;
}

test('reported placeholders update all four documents, copied text and Word output',async()=>{
 const data=submitUploadedFiles(fourFiles());
 assert.equal(data.chiefGuest.nameEn,''); // a placeholder must never become the guest name
 data.chiefGuest.nameEn='Mr. Al-amin Islam';
 data.chiefGuest.nameBn=translateGuestField(data.chiefGuest.nameEn,'nameEn');
 data.specialGuests=[{id:'sg-1',nameEn:'Mr. Kamal Hossain',nameBn:'জনাব কামাল হোসেন',designationEn:'Manager',designationBn:'ব্যবস্থাপক'}];
 const generators=[generateMediaInvitationBn,generateMediaInvitationEn,generatePressReleaseBn,generatePressReleaseEn];
 for(const [index,{type}] of DOCUMENT_SLOTS.entries()) {
   const text=renderTemplate(data,type)!;
   assert.ok(text.includes(type.endsWith('-bn')?'জনাব আল-আমিন ইসলাম':'Mr. Al-amin Islam'));
   assert.ok(text.includes(type.endsWith('-bn')?'জনাব কামাল হোসেন, ব্যবস্থাপক':'Mr. Kamal Hossain, Manager'));
   assert.ok(!text.includes('[প্রধান অতিথির নাম]')); assert.ok(!text.includes('[Chief Guest Name]'));
   assert.ok(!text.includes('জনাব জনাব'));
   assert.equal(generators[index](data),text);
   const blob=await exportToDocx(data,type);
   const word=await mammoth.extractRawText({buffer:Buffer.from(await blob.arrayBuffer())});
   assert.ok(word.value.includes(type.endsWith('-bn')?'জনাব আল-আমিন ইসলাম':'Mr. Al-amin Islam'));
 }
 data.chiefGuest.nameEn='Mr. Lam'; data.chiefGuest.nameBn='জনাব ল্যাম';
 for(const {type} of DOCUMENT_SLOTS) {
   const text=renderTemplate(data,type)!;
   assert.ok(text.includes(type.endsWith('-bn')?'জনাব ল্যাম':'Mr. Lam'));
   assert.ok(!text.includes('Al-amin')); assert.ok(!text.includes('আল-আমিন'));
 }
});

test('previously uploaded raw placeholders update immediately without another upload',()=>{
 const data=emptyUploadWorkspace();
 data.templates=fourFiles();
 data.chiefGuest.nameEn='Mr. Alamin';data.chiefGuest.nameBn='জনাব আলামিন';
 for(const {type} of DOCUMENT_SLOTS) assert.ok(renderTemplate(data,type)!.includes(type.endsWith('-bn')?'জনাব আলামিন':'Mr. Alamin'));
});

test('indexed special guest placeholders use the corresponding guest and clear after removal',()=>{
 const data=emptyUploadWorkspace();
 data.templates={'invitation-en':{filename:'test.txt',text:'[Special Guest 1 Name] / [Special Guest 2 Name]'}};
 data.specialGuests=[{id:'one',nameEn:'First',nameBn:'প্রথম',designationEn:'',designationBn:''},{id:'two',nameEn:'Second',nameBn:'দ্বিতীয়',designationEn:'',designationBn:''}];
 assert.equal(renderTemplate(data,'invitation-en'),'First / Second');
 data.specialGuests=[];assert.equal(renderTemplate(data,'invitation-en'),' / ');
});

test('placeholder aliases are language-aware and leave unrelated text intact',()=>{
 assert.equal(bindGuestPlaceholders('[প্রধান অতিথির নাম ও পদবী]','press-release-bn'),'{{chiefGuest.fullBn}}');
 assert.equal(bindGuestPlaceholders('{{chief_guest_name}}','invitation-en'),'{{chiefGuest.nameEn}}');
 assert.equal(bindGuestPlaceholders('[Name of the Chief Guest]','invitation-en'),'{{chiefGuest.nameEn}}');
 assert.equal(bindGuestPlaceholders('[Chief Guest Designation]','invitation-en'),'{{chiefGuest.designationEn}}');
 assert.equal(bindGuestPlaceholders('[EVENT TITLE] {{chiefGuest.nameEn}}','invitation-en'),'[EVENT TITLE] {{chiefGuest.nameEn}}');
});
