import React from 'react';
import {DocumentData} from '../types';
import {updateTranslatedPair} from '../utils/formTranslation';
import {BilingualField,EditorSection} from './BilingualField';
export function DateTimeEditor({data,onChange}: {data:DocumentData;onChange:(data:DocumentData)=>void}) {
 const update=(field:string,value:string)=>{const result=updateTranslatedPair(data,field,value,'',data.translationCorrections);onChange({...result.next,translationCorrections:result.corrections});};
 return <EditorSection title="তারিখ ও সময় (Date & Time)">
  <BilingualField label="Issue Date" banglaLabel="জারির তারিখ" english={data.issueDateEn} bangla={data.issueDateBn} onEnglish={v=>update("issueDateEn",v)} onBangla={v=>update("issueDateBn",v)}/>
  <BilingualField label="Inauguration Date" banglaLabel="উদ্বোধনের তারিখ" english={data.eventDateEn} bangla={data.eventDateBn} onEnglish={v=>update("eventDateEn",v)} onBangla={v=>update("eventDateBn",v)}/>
  <BilingualField label="Inauguration Time" banglaLabel="উদ্বোধনের সময়" english={data.inaugurationTimeEn} bangla={data.inaugurationTimeBn} onEnglish={v=>update("inaugurationTimeEn",v)} onBangla={v=>update("inaugurationTimeBn",v)}/>
  <BilingualField label="Duration" banglaLabel="প্রদর্শনীর মেয়াদ" english={data.eventDurationEn} bangla={data.eventDurationBn} onEnglish={v=>update("eventDurationEn",v)} onBangla={v=>update("eventDurationBn",v)}/>
  <BilingualField label="Visiting Hours" banglaLabel="দর্শনার্থীর সময়" english={data.visitingHoursEn} bangla={data.visitingHoursBn} onEnglish={v=>update("visitingHoursEn",v)} onBangla={v=>update("visitingHoursBn",v)}/>
 </EditorSection>;
}
