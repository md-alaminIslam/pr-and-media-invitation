import React from 'react';
import {Plus,Trash2} from 'lucide-react';
import {DocumentData} from '../types';
import {updateTranslatedPair} from '../utils/formTranslation';
import {BilingualField,EditorSection} from './BilingualField';
export function HighlightsEditor({data,onChange}: {data:DocumentData;onChange:(data:DocumentData)=>void}) {
 const update=(id:string,field:string,value:string)=>{
  const item=data.highlights.find(h=>h.id===id);if(!item)return;
  const result=updateTranslatedPair(item,field,value,'highlight.',data.translationCorrections);
  onChange({...data,highlights:data.highlights.map(h=>h.id===id?result.next:h),translationCorrections:result.corrections});
 };
 return <EditorSection title="মূল আকর্ষণ (Exhibition Highlights)">
  {data.highlights.map((item,i)=><div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
   <div className="flex justify-between mb-2"><span className="text-xs font-semibold">Highlight {i+1}</span><button aria-label={`মূল আকর্ষণ ${i+1} মুছুন`} onClick={()=>onChange({...data,highlights:data.highlights.filter(h=>h.id!==item.id)})}><Trash2 className="w-4 h-4 text-rose-600"/></button></div>
   <BilingualField label={`Highlight ${i+1}`} banglaLabel={`মূল আকর্ষণ ${i+1}`} english={item.textEn} bangla={item.textBn} onEnglish={v=>update(item.id,'textEn',v)} onBangla={v=>update(item.id,'textBn',v)} multiline/>
  </div>)}
  <button onClick={()=>onChange({...data,highlights:[...data.highlights,{id:`hl-${Date.now()}-${Math.random().toString(36).slice(2)}`,textEn:'',textBn:''}]})} className="flex items-center gap-2 bg-teal-700 text-white px-3 py-2 rounded-lg text-xs"><Plus className="w-4 h-4"/>আকর্ষণ যোগ করুন</button>
 </EditorSection>;
}
