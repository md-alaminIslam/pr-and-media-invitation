import React,{useRef,useEffect,useState} from 'react';
import {sanitizeHtml} from '../utils/richHtml';
export function HtmlVisualEditor({html,onChange,binding}:{html:string;onChange:(html:string)=>void;binding:string}) {
 const root=useRef<HTMLDivElement>(null);const selection=useRef<Range|null>(null);const last=useRef<string>('');const [status,setStatus]=useState('');
 useEffect(()=>{if(root.current && html!==last.current){root.current.innerHTML=sanitizeHtml(html);last.current=html;}},[html]);
 const saveSelection=()=>{const s=window.getSelection();if(s?.rangeCount && root.current?.contains(s.anchorNode))selection.current=s.getRangeAt(0).cloneRange();};
 const emit=()=>{if(!root.current)return;const clean=sanitizeHtml(root.current.innerHTML);last.current=clean;onChange(clean);saveSelection();setStatus('পরিবর্তন সেভ হয়েছে');};
 const run=(cmd:string,value?:string)=>{
  root.current?.focus();const s=window.getSelection();if(selection.current && root.current?.contains(selection.current.startContainer)){s?.removeAllRanges();s?.addRange(selection.current);}
  document.execCommand('styleWithCSS',false,'true');document.execCommand(cmd,false,value);emit();
 };
 const button=(name:string,cmd:string,value?:string)=><button type="button" title={name} aria-label={name} onMouseDown={e=>e.preventDefault()} onClick={()=>run(cmd,value)} className="px-2 py-1.5 rounded hover:bg-teal-100 border border-slate-200 bg-white text-xs">{name}</button>;
 const fontSize=(size:string)=>{run('fontSize','7');for(const el of root.current?.querySelectorAll('font[size="7"],[style*="xxx-large"]') || []){(el as HTMLElement).removeAttribute('size');(el as HTMLElement).style.fontSize=size+'pt';}emit();};
 const download=()=>{const content='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body>'+sanitizeHtml(root.current?.innerHTML || html)+'</body></html>';const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='media-document.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div className="border border-slate-300 rounded-xl overflow-hidden">
  <div role="toolbar" aria-label="HTML লেখার স্টাইল" className="bg-slate-50 p-3 flex flex-wrap items-center gap-2 border-b border-slate-200">
   <select aria-label="Font family" defaultValue="" onChange={e=>run('fontName',e.target.value)} className="border rounded p-1.5 text-xs"><option value="" disabled>Font</option>{['Calibri','Arial','Times New Roman','Georgia','Hind Siliguri','Tiro Bangla','Noto Sans Bengali'].map(f=><option key={f}>{f}</option>)}</select>
   <select aria-label="Font size" defaultValue="" onChange={e=>fontSize(e.target.value)} className="border rounded p-1.5 text-xs"><option value="" disabled>Size (pt)</option>{[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(s=><option key={s} value={s}>{s}</option>)}</select>
   {button('Bold','bold')}{button('Italic','italic')}{button('Underline','underline')}{button('Strikethrough','strikeThrough')}{button('Subscript','subscript')}{button('Superscript','superscript')}
   <label className="text-xs flex items-center gap-1">Text color<input aria-label="Text color" type="color" defaultValue="#111111" onInput={e=>run('foreColor',e.currentTarget.value)} className="w-7 h-7"/></label>
   <label className="text-xs flex items-center gap-1">Highlight<input aria-label="Highlight color" type="color" defaultValue="#ffff00" onInput={e=>run('hiliteColor',e.currentTarget.value)} className="w-7 h-7"/></label>
   {button('Left','justifyLeft')}{button('Center','justifyCenter')}{button('Right','justifyRight')}{button('Justify','justifyFull')}{button('Bullets','insertUnorderedList')}{button('Numbering','insertOrderedList')}{button('Indent','indent')}{button('Outdent','outdent')}{button('Undo','undo')}{button('Redo','redo')}{button('Clear style','removeFormat')}
   <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>run('insertText','{{'+binding+'}}')} className="px-2 py-1.5 text-xs bg-teal-700 text-white rounded">নির্বাচিত জায়গায় অতিথি যুক্ত করুন</button>
   <button type="button" onClick={download} className="px-2 py-1.5 text-xs border rounded bg-white">HTML ডাউনলোড</button>
  </div>
  <p className="text-xs text-slate-500 px-4 py-2 border-b">লেখা সিলেক্ট করুন, তারপর উপরের স্টাইল বেছে নিন। অতিথির সংযোগ রাখতে {'{{chiefGuest.nameEn}}'}-এর মতো চিহ্নিত নাম ব্যবহার করুন।</p>
  <div ref={root} role="textbox" aria-label="HTML Visual Editor" aria-multiline="true" contentEditable suppressContentEditableWarning className="rich-document min-h-72 max-h-[600px] overflow-auto p-6 bg-white outline-none text-base leading-7" onInput={emit} onKeyUp={saveSelection} onMouseUp={saveSelection} onBlur={saveSelection} onPaste={e=>{e.preventDefault();const content=e.clipboardData.getData('text/html');if(content)run('insertHTML',sanitizeHtml(content));else run('insertText',e.clipboardData.getData('text/plain'));}}/>
  <p role="status" className="text-xs text-teal-700 px-4 py-2 border-t">{status || 'Visual Editor প্রস্তুত'}</p>
 </div>;
}
