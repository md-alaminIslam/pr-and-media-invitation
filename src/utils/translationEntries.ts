import {DocumentData} from '../types';
export interface TranslationEntry {id:string;text:string;before:string;label:string}
export function collectTranslationEntries(data:DocumentData):TranslationEntry[] {
 const entries:TranslationEntry[]=[];
 const add=(obj:any,prefix:string,label:string)=>{for(const key of Object.keys(obj)){if(key.endsWith('En')&&typeof obj[key]==='string'&&obj[key].trim()&&typeof obj[key.slice(0,-2)+'Bn']==='string')entries.push({id:prefix+key,text:obj[key],before:obj[key.slice(0,-2)+'Bn'],label:label+key.replace(/En$/,'')});}};
 add(data,'','');add(data.chiefGuest,'chiefGuest.','প্রধান অতিথি: ');add(data.sender,'sender.','প্রেরক: ');
 data.specialGuests.forEach((g,i)=>add(g,`specialGuests.${g.id}.`,`বিশেষ অতিথি ${i+1}: `));data.highlights.forEach((h,i)=>add(h,`highlights.${h.id}.`,`মূল আকর্ষণ ${i+1}: `));
 return entries;
}
function target(data:DocumentData,id:string):{obj:any;key:string}|null {
 const parts=id.split('.');if(parts.length===1)return {obj:data,key:parts[0]};
 if(['chiefGuest','sender'].includes(parts[0])&&parts.length===2)return {obj:(data as any)[parts[0]],key:parts[1]};
 if(['specialGuests','highlights'].includes(parts[0])&&parts.length===3){const obj=(data as any)[parts[0]].find((item:any)=>item.id===parts[1]);if(obj)return {obj,key:parts[2]};}return null;
}
export function applyTranslationResults(data:DocumentData,entries:TranslationEntry[],results:{id:string;text:string}[]) {
 const next=structuredClone(data);let applied=0;let skipped=0;
 for(const result of results){const source=entries.find(e=>e.id===result.id);const item=target(next,result.id);if(!source||!item||item.obj[item.key]!==source.text||item.obj[item.key.slice(0,-2)+'Bn']!==source.before){skipped++;continue;}item.obj[item.key.slice(0,-2)+'Bn']=result.text;applied++;}
 return {data:next,applied,skipped};
}
// Gemini mode waits for a reviewed result instead of displaying an offline translation as Gemini.
export function retainBanglaUntilReview(previous:DocumentData,incoming:DocumentData):DocumentData {
 const next=structuredClone(incoming);
 for(const entry of collectTranslationEntries(incoming)){const old=target(previous,entry.id);const current=target(next,entry.id);if(old&&current&&old.obj[old.key]!==entry.text)current.obj[current.key.slice(0,-2)+'Bn']=old.obj[old.key.slice(0,-2)+'Bn'];}
 return next;
}
