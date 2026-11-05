import test from 'node:test';
import assert from 'node:assert/strict';
import { bindGuestText, renderTemplate, DOCUMENT_SLOTS } from './templates';
import { bimox2025Preset } from './presets';
import { translateEnglishToBangla } from './transliteration';
import {generateMediaInvitationBn,generateMediaInvitationEn,generatePressReleaseBn,generatePressReleaseEn} from './documentGenerator';
import { exportToDocx } from './docxExporter';

test('four independent files keep their own text while sharing updated bilingual guest names', async () => {
  const data=structuredClone(bimox2025Preset);
  data.templates={};
  for(const {type} of DOCUMENT_SLOTS) {
    const lang=type.endsWith('-bn')?'Bn':'En';
    const text=`${type}: ${data.chiefGuest[`name${lang}`]} / ${data.specialGuests[0][`name${lang}`]}`;
    data.templates[type]={filename:type+'.txt',text:bindGuestText(text,data)};
  }
  data.chiefGuest.nameEn='Mr. Alamin';
  data.chiefGuest.nameBn=translateEnglishToBangla(data.chiefGuest.nameEn);
  data.specialGuests[0].nameEn='Mr. Kamal Hossain';
  data.specialGuests[0].nameBn=translateEnglishToBangla(data.specialGuests[0].nameEn);
  const generators=[generateMediaInvitationBn,generateMediaInvitationEn,generatePressReleaseBn,generatePressReleaseEn];
  for(const [i,{type}] of DOCUMENT_SLOTS.entries()) {
    const lang=type.endsWith('-bn')?'Bn':'En';
    const text=renderTemplate(data,type)!;
    assert.ok(text.startsWith(type+':'));
    assert.ok(text.includes(data.chiefGuest[`name${lang}`]));
    assert.ok(text.includes(data.specialGuests[0][`name${lang}`]));
    assert.equal(generators[i](data),text);
    assert.ok(!text.includes('{{'));
    const blob=await exportToDocx(data,type);
    assert.ok(blob.size>1000);
  }
});

test('guest placeholders retain identity after reordering and clear after removal', () => {
  const data=structuredClone(bimox2025Preset);
  const guest=data.specialGuests[0];
  data.templates={'invitation-en':{filename:'test.txt',text:bindGuestText(guest.nameEn,data)}};
  data.specialGuests.reverse();
  assert.equal(renderTemplate(data,'invitation-en'),guest.nameEn);
  data.specialGuests=data.specialGuests.filter(g=>g.id!==guest.id);
  assert.equal(renderTemplate(data,'invitation-en'),'');
});

test('missing file falls back and unrelated text is preserved', () => {
  const data=structuredClone(bimox2025Preset);
  assert.equal(renderTemplate(data,'invitation-en'),null);
  assert.equal(bindGuestText('<p>Venue & schedule</p>',data),'<p>Venue & schedule</p>');
});
