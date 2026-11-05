import test from 'node:test';
import assert from 'node:assert/strict';
import {translateFormField,updateTranslatedPair} from './formTranslation';
import {emptyUploadWorkspace} from './uploadWorkspace';

test('date and time translation uses Bangla months, weekdays and correct AM/PM periods',()=>{
 assert.equal(translateFormField('26 November 2026, Thursday','eventDateEn'),'২৬ নভেম্বর ২০২৬, বৃহস্পতিবার');
 assert.equal(translateFormField('10:30 AM','inaugurationTimeEn'),'সকাল ১০:৩০টা');
 assert.equal(translateFormField('daily from 10:00 AM to 7:00 PM','visitingHoursEn'),'প্রতিদিন সকাল ১০:০০টা থেকে সন্ধ্যা ৭:০০টা');
 assert.equal(translateFormField('12:00 PM','inaugurationTimeEn'),'দুপুর ১২:০০টা');
 assert.equal(translateFormField('12:00 AM','inaugurationTimeEn'),'রাত ১২:০০টা');
 assert.equal(translateFormField('26th to 28th November 2026','eventDurationEn'),'২৬ থেকে ২৮ নভেম্বর ২০২৬');
});
test('event, venue, recipient, sender and highlight English fields generate Bangla',()=>{
 assert.equal(translateFormField('Renewable Energy Exhibition','eventTitleEn'),'নবায়নযোগ্য জ্বালানি প্রদর্শনী');
 assert.equal(translateFormField('Hall-2, International Convention City Bashundhara (ICCB), Kuril, Dhaka','venueEn'),'হল-২, আন্তর্জাতিক কনভেনশন সিটি বসুন্ধরা (আইসিসিবি), কুড়িল, ঢাকা');
 assert.equal(translateFormField('General Manager','sender.designationEn'),'মহাব্যবস্থাপক');
 assert.equal(translateFormField('Chief News Editor','mediaAddresseeEn'),'প্রধান বার্তা সম্পাদক');
 assert.equal(translateFormField('Solar energy and energy storage','highlight.textEn'),'সৌরবিদ্যুৎ ও জ্বালানি সংরক্ষণ');
});
test('every form pair updates atomically, clears when English clears and retains manual corrections',()=>{
 const blank=emptyUploadWorkspace();
 for(const field of ['issueDate','eventDate','inaugurationTime','eventDuration','visitingHours','eventTitle','edition','scope','organizer','venue','mediaAddressee']) {
  const first=updateTranslatedPair(blank,field+'En','26 November 2026','');
  assert.equal((first.next as any)[field+'Bn'],'২৬ নভেম্বর ২০২৬');
  const manual=updateTranslatedPair(first.next,field+'Bn','সংশোধিত বাংলা','',first.corrections);
  const repeated=updateTranslatedPair(manual.next,field+'En','26 November 2026','',manual.corrections);
  assert.equal((repeated.next as any)[field+'Bn'],'সংশোধিত বাংলা');
  const clear=updateTranslatedPair(repeated.next,field+'En','','',repeated.corrections);
  assert.equal((clear.next as any)[field+'Bn'],'');
 }
 const sender=updateTranslatedPair(blank.sender,'designationEn','General Manager','sender.');
 assert.equal(sender.next.designationBn,'মহাব্যবস্থাপক');
 const phone=updateTranslatedPair(sender.next,'phone','01709653955','sender.');
 assert.equal(phone.next.phone,'01709653955');
 assert.equal(phone.next.designationBn,'মহাব্যবস্থাপক');
});
test('unfamiliar terms stay readable and Bangla manual edits do not change English',()=>{
 assert.equal(translateFormField('QuantumX','eventTitleEn'),'QuantumX');
 const result=updateTranslatedPair({textEn:'Solar energy',textBn:''},'textBn','সৌরশক্তি','highlight.');
 assert.equal(result.next.textEn,'Solar energy');
 assert.equal(translateFormField('Solar energy','highlight.textEn',result.corrections),'সৌরশক্তি');
});
