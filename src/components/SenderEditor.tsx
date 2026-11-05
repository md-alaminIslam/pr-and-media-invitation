import React from 'react';
import {DocumentData} from '../types';
import {updateTranslatedPair} from '../utils/formTranslation';
import {BilingualField,EditorSection} from './BilingualField';
export function SenderEditor({data,onChange}: {data:DocumentData;onChange:(data:DocumentData)=>void}) {
 const update=(field:string,value:string)=>{const result=updateTranslatedPair(data.sender,field,value,'sender.',data.translationCorrections);onChange({...data,sender:result.next,translationCorrections:result.corrections});};
 const recipient=(field:string,value:string)=>{const result=updateTranslatedPair(data,field,value,'',data.translationCorrections);onChange({...result.next,translationCorrections:result.corrections});};
 return <EditorSection title="প্রেরক ও মিডিয়া প্রাপক (Sender & Addressee)">
  <BilingualField label="Media Addressee" banglaLabel="মিডিয়া প্রাপক" english={data.mediaAddresseeEn} bangla={data.mediaAddresseeBn} onEnglish={v=>recipient('mediaAddresseeEn',v)} onBangla={v=>recipient('mediaAddresseeBn',v)}/>
  <BilingualField label="Sender Name" banglaLabel="প্রেরকের নাম" english={data.sender.nameEn} bangla={data.sender.nameBn} onEnglish={v=>update('nameEn',v)} onBangla={v=>update('nameBn',v)}/>
  <BilingualField label="Sender Designation" banglaLabel="প্রেরকের পদবী" english={data.sender.designationEn} bangla={data.sender.designationBn} onEnglish={v=>update('designationEn',v)} onBangla={v=>update('designationBn',v)}/>
  <BilingualField label="Sender Organization" banglaLabel="প্রেরকের প্রতিষ্ঠান" english={data.sender.organizationEn} bangla={data.sender.organizationBn} onEnglish={v=>update('organizationEn',v)} onBangla={v=>update('organizationBn',v)}/>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
   <label className="text-xs font-medium">Mobile / RSVP<input aria-label="Mobile / RSVP" value={data.sender.phone} onChange={e=>update('phone',e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 mt-1"/></label>
   <label className="text-xs font-medium">Email (optional)<input aria-label="Email" type="email" value={data.sender.email} onChange={e=>update('email',e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 mt-1"/></label>
  </div>
 </EditorSection>;
}
