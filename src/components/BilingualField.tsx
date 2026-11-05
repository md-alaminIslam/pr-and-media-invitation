import {TranslationModeContext} from './TranslationModeContext';
import React, {useId,useContext} from 'react';
export function BilingualField({label,banglaLabel,english,bangla,onEnglish,onBangla,multiline=false}: {
 label:string;banglaLabel:string;english:string;bangla:string;onEnglish:(v:string)=>void;onBangla:(v:string)=>void;multiline?:boolean;
}) {
 const mode=useContext(TranslationModeContext);const id=useId();const Input=multiline?'textarea':'input';
 const style='w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white';
 return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <div><label htmlFor={id+'en'} className="block text-xs font-semibold text-slate-700 mb-1">{label} (English)</label><Input id={id+'en'} lang="en" value={english || ''} onChange={e=>onEnglish(e.target.value)} placeholder="Write in English" className={style}/></div>
  <div><label htmlFor={id+'bn'} className="block text-xs font-medium text-slate-700 mb-1">{banglaLabel} (বাংলা)</label><Input id={id+'bn'} lang="bn" value={bangla || ''} onChange={e=>onBangla(e.target.value)} placeholder={mode==='gemini'?'Gemini অনুবাদ যাচাই করে প্রয়োগ করুন':'স্বয়ংক্রিয় বাংলা; প্রয়োজন হলে সংশোধন করুন'} className={style}/>{/[A-Za-z]/.test(bangla || '') && <p className="text-[11px] text-amber-700 mt-1">অপরিচিত শব্দ ইংরেজিতে রাখা হয়েছে। সঠিক বাংলা লিখে সংশোধন করুন।</p>}</div>
 </div>;
}
export function EditorSection({title,children}: {title:string;children:React.ReactNode}) {
 const mode=useContext(TranslationModeContext);
 return <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"><div className="bg-slate-50 px-4 py-3 border-b border-slate-200"><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="text-[11px] text-slate-500 mt-1">{mode==='gemini'?'ইংরেজিতে লিখুন → উপরের Gemini অনুবাদ বাটন চাপুন → যাচাই করে প্রয়োগ করুন।':'ইংরেজিতে লিখুন → বাংলা স্বয়ংক্রিয়ভাবে পূরণ হবে। বাংলা সংশোধন করা যাবে এবং একই ইংরেজির জন্য মনে থাকবে।'}</p></div><div className="p-4 space-y-4">{children}</div></section>;
}
