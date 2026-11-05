import React, { useRef, useState } from 'react';
import {HtmlVisualEditor} from './HtmlVisualEditor';
import {sanitizeHtml,htmlToText,textToHtml} from '../utils/richHtml';
import mammoth from 'mammoth/mammoth.browser';
import { UploadCloud, FileCheck2, X } from 'lucide-react';
import { DocumentData, DocumentType } from '../types';
import { submitUploadedFiles } from '../utils/uploadWorkspace';
import { bindGuestText, bindGuestPlaceholders, DOCUMENT_SLOTS, DocumentTemplate, SingleDocumentType } from '../utils/templates';

export function TemplateUploads({data,onChange,onSelect}: {data:DocumentData;onChange:(data:DocumentData)=>void;onSelect:(type:DocumentType)=>void}) {
  const [pending,setPending] = useState<Partial<Record<SingleDocumentType,DocumentTemplate>>>({});
  const [editing,setEditing] = useState<SingleDocumentType|null>(null);
  const [busy,setBusy] = useState<SingleDocumentType|null>(null);
  const [message,setMessage] = useState('');
  const [visual,setVisual]=useState(true);
  const [binding,setBinding] = useState('chiefGuest.nameBn');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const upload = async (type:SingleDocumentType, input:HTMLInputElement) => {
    const file = input.files?.[0]; if (!file) return;
    setBusy(type); setMessage('');
    try {
      if (file.size > 10*1024*1024) throw new Error('সর্বোচ্চ ১০ MB ফাইল দিন।');
      let text: string;let html:string|undefined;
      if (/\.docx$/i.test(file.name)) text = (await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;
      else if (/\.html?$/i.test(file.name)) {html=sanitizeHtml(await file.text());text=htmlToText(html);}
      else if (/\.txt$/i.test(file.name)) text = await file.text();
      else throw new Error('Word (.docx), TXT বা HTML (.html/.htm) ফাইল দিন।');
      if (!text.trim()) throw new Error('ফাইলে কোনো পাঠযোগ্য লেখা পাওয়া যায়নি।');
      setPending(previous=>({...previous,[type]:{filename:file.name,text,...(html?{html}:{})}}));
      setMessage('ফাইল নির্বাচন হয়েছে। সব ফাইল নির্বাচন শেষে নিচের সাবমিট বাটন চাপুন।');

    } catch(e:any) { setMessage(e.message); }
    finally {setBusy(null);input.value='';}
  };
  const submit = () => {
    try {
      const next=submitUploadedFiles(pending);
      onChange(next);
      onSelect(DOCUMENT_SLOTS.find(slot=>next.templates?.[slot.type])!.type);
      setPending({}); setEditing(null);
      setMessage('সাবমিট হয়েছে। আগের সব তথ্য সরিয়ে শুধু নির্বাচিত ফাইলগুলো প্রয়োগ করা হয়েছে। প্রধান/বিশেষ অতিথির নামের চিহ্নিত জায়গা এখন ফিল্ড থেকে স্বয়ংক্রিয়ভাবে আপডেট হবে।');
    } catch (e:any) {setMessage(e.message);}
  };
  const selectedCount=Object.keys(pending).length;
  const updateText = (text:string) => {if(editing && data.templates?.[editing]) onChange({...data,templates:{...data.templates,[editing]:{...data.templates[editing]!,text,html:undefined}}});};
  const insertBinding = () => {
    const textarea=textRef.current; if(!textarea || !editing) return;
    const text=data.templates?.[editing]?.text || '';
    updateText(text.slice(0,textarea.selectionStart)+`{{${binding}}}`+text.slice(textarea.selectionEnd));
  };
  return <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 no-print">
    <div className="flex gap-2 items-center mb-1"><UploadCloud className="w-4 h-4 text-teal-700"/><h3 className="font-bold text-sm">চারটি ডকুমেন্টের আলাদা ফাইল</h3></div>
    <p className="text-xs text-slate-500 mb-3">ফাইল নির্বাচন করুন → সাবমিট করুন। সাবমিট করলে আগের সব তথ্য ও ফাইল বাদ যাবে; শুধু এইবার নির্বাচিত ফাইলগুলো থাকবে। Word/TXT/HTML আপলোড করুন। HTML-এর সাধারণ ইনলাইন স্টাইল, টেবিল ও লিস্ট Visual Editor-এ সম্পাদনা করা যাবে। বাইরের স্টাইলশিট ও স্ক্রিপ্ট নেওয়া হয় না।</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {DOCUMENT_SLOTS.map(({type,label})=><div key={type} className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
        <h4 className="text-xs font-bold mb-2">{label}</h4>
        <p className="text-xs text-slate-500 truncate mb-2">{pending[type]?.filename || (selectedCount ? 'এই নতুন সেটে নির্বাচিত হয়নি' : data.templates?.[type]?.filename || 'কোনো ফাইল যোগ করা হয়নি')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="cursor-pointer text-xs text-teal-800 font-semibold border border-teal-200 rounded-lg px-2 py-1 bg-white">{busy===type?'পড়া হচ্ছে…':'ফাইল আপলোড'}<input aria-label={`${label} ফাইল আপলোড`} type="file" accept=".docx,.txt,.html,.htm" disabled={busy!==null} className="sr-only" onChange={e=>upload(type,e.currentTarget)}/></label>
          {pending[type] && <button aria-label={`${label} নির্বাচন বাতিল`} onClick={()=>setPending(current=>{const next={...current};delete next[type];return next;})} className="text-xs text-rose-700">নির্বাচন বাতিল</button>}
          {!selectedCount && data.templates?.[type] && <><button className="text-xs text-blue-700" onClick={()=>{setEditing(type);setBinding(`chiefGuest.name${type.endsWith('-bn')?'Bn':'En'}`);onSelect(type);}}>Visual Editor / লেখা</button><button aria-label={`${label} সরান`} onClick={()=>{const templates={...data.templates};delete templates[type];onChange({...data,templates});if(editing===type)setEditing(null);}}><X className="w-3.5 h-3.5"/></button></>}
        </div>
      </div>)}
    </div>
    <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{selectedCount}টি নতুন ফাইল নির্বাচিত। সাবমিটের পরে আগের সেট থাকবে না।</p><button onClick={submit} disabled={!selectedCount || busy!==null} className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><FileCheck2 className="w-4 h-4"/>সাবমিট ও প্রয়োগ করুন</button></div>
    {message && <p role="status" className="text-xs text-teal-800 mt-3">{message}</p>}
    {!selectedCount && editing && data.templates?.[editing] && <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex justify-between mb-2"><strong className="text-sm">{DOCUMENT_SLOTS.find(s=>s.type===editing)?.label}</strong><button onClick={()=>setEditing(null)} aria-label="টেমপ্লেট এডিটর বন্ধ করুন"><X className="w-4 h-4"/></button></div>
      <p className="text-xs text-slate-500 mb-2">[প্রধান অতিথির নাম], [Chief Guest Name] ও বিশেষ অতিথির নামের চিহ্নিত জায়গাগুলো স্বয়ংক্রিয়ভাবে আপডেট হবে। প্রধান/বিশেষ অতিথির পরিচয়সহ লেখা পুরোনো নামও স্বয়ংক্রিয়ভাবে বদলাবে। অন্য জায়গার নাম সিলেক্ট করে অতিথির সঙ্গে যুক্ত করুন।</p>
      <div className="flex flex-wrap gap-2 mb-2"><select aria-label="টেমপ্লেটে যুক্ত করার অতিথি" className="border border-slate-300 p-2 rounded-lg text-xs" value={binding} onChange={e=>setBinding(e.target.value)}>
        {(['Bn','En'] as const).flatMap(lang=>[<option key={`chief-${lang}`} value={`chiefGuest.name${lang}`}>প্রধান অতিথি — {lang==='Bn'?'বাংলা':'English'}</option>,...data.specialGuests.map((g,i)=><option key={`${g.id}-${lang}`} value={`guest.${g.id}.name${lang}`}>বিশেষ অতিথি {i+1} — {lang==='Bn'?'বাংলা':'English'}</option>)])}
      </select><button disabled={visual} onClick={insertBinding} className="bg-teal-700 text-white text-xs px-3 py-2 rounded-lg">নাম যুক্ত করুন</button><button onClick={()=>(()=>{const template=data.templates![editing]!;if(template.html){const doc=new DOMParser().parseFromString(template.html,'text/html');const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())node.textContent=bindGuestText(bindGuestPlaceholders(node.textContent || '',editing),data);const html=sanitizeHtml(doc.body.innerHTML);onChange({...data,templates:{...data.templates,[editing]:{...template,html,text:htmlToText(html)}}});}else updateText(bindGuestText(bindGuestPlaceholders(template.text,editing),data));})()} className="text-xs border border-slate-300 rounded-lg px-3">চেনা নামগুলো যুক্ত করুন</button></div>
      <div className="flex gap-2 mb-3"><button onClick={()=>setVisual(true)} className={`text-xs px-3 py-2 rounded-lg ${visual?'bg-teal-700 text-white':'border'}`}>Visual Editor</button><button onClick={()=>setVisual(false)} className={`text-xs px-3 py-2 rounded-lg ${!visual?'bg-teal-700 text-white':'border'}`}>সাধারণ লেখা / নামের সংযোগ</button></div>{!visual && <p className="text-xs text-amber-700 mb-2">সাধারণ লেখার ঘরে সম্পাদনা করলে এই ডকুমেন্টের HTML স্টাইল বাদ যাবে। স্টাইল রাখতে Visual Editor ব্যবহার করুন।</p>}
      {visual ? <HtmlVisualEditor key={editing} binding={binding} html={data.templates[editing]!.html || textToHtml(data.templates[editing]!.text)} onChange={html=>onChange({...data,templates:{...data.templates,[editing]:{...data.templates![editing]!,html,text:htmlToText(html)}}})}/> : <textarea aria-label="আপলোড করা ডকুমেন্টের লেখা" ref={textRef} value={data.templates[editing]!.text} onChange={e=>updateText(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 min-h-56 text-sm leading-7"/>}
    </div>}
  </section>;
}
