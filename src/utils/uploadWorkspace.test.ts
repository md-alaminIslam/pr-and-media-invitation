import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyUploadWorkspace,submitUploadedFiles} from './uploadWorkspace';
import {DOCUMENT_SLOTS,renderTemplate} from './templates';
import {generateMediaInvitationBn,generatePressReleaseEn} from './documentGenerator';
import {translateGuestField} from './guestTranslation';

test('new workspace contains no sample event, guests, sender, venue, or documents',()=>{
 const data=emptyUploadWorkspace();
 assert.equal(data.eventTitleEn,''); assert.equal(data.chiefGuest.nameEn,'');
 assert.equal(data.sender.nameBn,''); assert.equal(data.venueBn,'');
 assert.deepEqual(data.specialGuests,[]); assert.deepEqual(data.highlights,[]);
 assert.deepEqual(data.templates,{});
 assert.equal(generateMediaInvitationBn(data),'');
 assert.equal(generatePressReleaseEn(data),'');
 assert.ok(!JSON.stringify(data).includes('BIMOX'));
});

test('submitting only English invitation never supplies missing Bangla or press releases',()=>{
 const text='MY NEW INVITATION\nDate: 15 November 2026\nWelcome everyone.';
 const data=submitUploadedFiles({'invitation-en':{filename:'mine.txt',text}});
 assert.equal(renderTemplate(data,'invitation-en'),text);
 assert.deepEqual(Object.keys(data.templates!),['invitation-en']);
 assert.equal(renderTemplate(data,'invitation-bn'),'');
 assert.equal(renderTemplate(data,'press-release-en'),'');
 assert.equal(data.eventDateBn,''); assert.equal(data.sender.phone,'');
});

test('next submitted set completely replaces the previous set and its guest details',()=>{
 const old=submitUploadedFiles({'invitation-en':{filename:'old.txt',text:'Chief Guest: Mr. Old\nOld event'}});
 const incoming={'press-release-bn':{filename:'new.txt',text:'নতুন সংবাদ বিজ্ঞপ্তি'}};
 const next=submitUploadedFiles(incoming);
 assert.equal(old.chiefGuest.nameEn,'Mr. Old');
 assert.deepEqual(Object.keys(next.templates!),['press-release-bn']);
 assert.equal(next.chiefGuest.nameEn,'');
 assert.ok(!JSON.stringify(next).includes('Old'));
 assert.equal(next.templates!['press-release-bn']!.text,incoming['press-release-bn'].text);
 // Input file selection is never changed by submission.
 assert.equal(incoming['press-release-bn'].filename,'new.txt');
});

test('four uploaded texts remain independent while labelled guest names continue to sync',()=>{
 const files:any={};
 for(const {type} of DOCUMENT_SLOTS) files[type]={filename:type+'.txt',text:type+'\n'+(type.endsWith('-bn')?'প্রধান অতিথি: জনাব কামাল হোসেন':'Chief Guest: Mr. Kamal Hossain')};
 const data=submitUploadedFiles(files);
 for(const {type} of DOCUMENT_SLOTS) assert.equal(renderTemplate(data,type),files[type].text);
 data.chiefGuest.nameEn='Mr. Alamin';
 data.chiefGuest.nameBn=translateGuestField('Mr. Alamin','nameEn');
 for(const {type} of DOCUMENT_SLOTS) {
   const text=renderTemplate(data,type)!;
   assert.ok(text.startsWith(type));
   assert.ok(text.includes(type.endsWith('-bn')?data.chiefGuest.nameBn:'Mr. Alamin'));
   assert.ok(!text.includes('Kamal')); assert.ok(!text.includes('কামাল'));
 }
});

test('empty submission is rejected so the applied workspace can stay intact',()=>{
 assert.throws(()=>submitUploadedFiles({}),/অন্তত/);
 assert.throws(()=>submitUploadedFiles({'invitation-en':{filename:'empty.txt',text:'  '}}),/অন্তত/);
});
