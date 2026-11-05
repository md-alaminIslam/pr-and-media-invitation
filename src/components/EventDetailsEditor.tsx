import React from 'react';
import {DocumentData} from '../types';
import {updateTranslatedPair} from '../utils/formTranslation';
import {BilingualField,EditorSection} from './BilingualField';
export function EventDetailsEditor({data,onChange}: {data:DocumentData;onChange:(data:DocumentData)=>void}) {
 const update=(field:string,value:string)=>{const result=updateTranslatedPair(data,field,value,'',data.translationCorrections);onChange({...result.next,translationCorrections:result.corrections});};
 return <EditorSection title="ভেন্যু ও অনুষ্ঠান (Event & Venue)">
  <BilingualField label="Event Full Title" banglaLabel="প্রদর্শনীর পূর্ণ নাম" english={data.eventTitleEn} bangla={data.eventTitleBn} onEnglish={v=>update("eventTitleEn",v)} onBangla={v=>update("eventTitleBn",v)}/>
  <BilingualField label="Edition / Short Title" banglaLabel="আসর / সংক্ষিপ্ত শিরোনাম" english={data.editionEn} bangla={data.editionBn} onEnglish={v=>update("editionEn",v)} onBangla={v=>update("editionBn",v)}/>
  <BilingualField label="Scope / Industry Description" banglaLabel="প্রদর্শনীর ক্ষেত্র / পরিচয়" english={data.scopeEn} bangla={data.scopeBn} onEnglish={v=>update("scopeEn",v)} onBangla={v=>update("scopeBn",v)} multiline/>
  <BilingualField label="Organizer Organization" banglaLabel="আয়োজক প্রতিষ্ঠান" english={data.organizerEn} bangla={data.organizerBn} onEnglish={v=>update("organizerEn",v)} onBangla={v=>update("organizerBn",v)}/>
  <BilingualField label="Venue & Hall Location" banglaLabel="স্থান ও ভেন্যুর ঠিকানা" english={data.venueEn} bangla={data.venueBn} onEnglish={v=>update("venueEn",v)} onBangla={v=>update("venueBn",v)} multiline/>
 </EditorSection>;
}
