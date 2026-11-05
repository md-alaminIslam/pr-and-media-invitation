import { DocumentData, GuestItem } from '../types';

type Lang = 'Bn' | 'En';
function formatGuest(guest: Partial<GuestItem>, lang:Lang):string {
  return ['name','honors','designation'].map(key=>String((guest as any)[key+lang] || '').trim()).filter(Boolean).join(', ');
}
function specialList(data:DocumentData,lang:Lang):string {
  const guests=data.specialGuests.filter(g=>g[`name${lang}`]?.trim()).map(g=>formatGuest(g,lang));
  return guests.length<2 ? guests[0] || '' : guests.slice(0,-1).join(', ')+(lang==='Bn'?' এবং ':' and ')+guests.at(-1);
}
// Replace a named guest span, preserving the following context and sentence ending.
function replaceBody(body:string,replacement:string,lang:Lang):string {
  // Explicitly bound fields are handled by the placeholder renderer.
  if (/\{\{(?:chiefGuest|guest|guestIndex|specialGuests)\./.test(body)) return body;
  const boundary=lang==='Bn'
    ? /\s+(?:এবং\s+(?:সরকার|বিভিন্ন|দেশ|দেশি|দেশী|বিশিষ্ট|অন্যান্য|সংশ্লিষ্ট|স্থানীয়|স্থানীয়|আন্তর্জাতিক|বেসরকারি)|উপস্থিত\s+(?:থেকে|থাক|ছিল|থাকবেন)|বিশেষ\s+অতিথি|অনুষ্ঠান(?:টি|ের)?\s+(?:উদ্বোধন|আয়োজন|আয়োজন)|উদ্বোধন\s+কর)/
    : /(?:\s+(?:in the presence of|in attendance|along with|together with|with distinguished|with representatives|and representatives|and distinguished|and other|as (?:the )?chief guest|will inaugurate|inaugurated (?:the|this)|special guests?)\b|\.(?=\s+(?:The|We|Your|This|It|Special|Chief)\b))/i;
  const match=boundary.exec(body);
  const rawName=(match ? body.slice(0,match.index) : body).replace(/[ ,;:]+$/,'').trim();
  // Do not rewrite a role heading or a paragraph that contains only attendance context.
  if (!rawName || !/[A-Za-z\u0980-\u09FF]/.test(rawName)) return body;
  const suffix=match?body.slice(match.index):'';
  const trailing=match?'':body.match(/[ \t]*$/)?.[0] || '';
  return replacement+suffix+trailing;
}
export function syncNarrativeGuests(text:string,data:DocumentData,lang:Lang,appendMissing=true):string {
  const chief=data.chiefGuest[`name${lang}`]?.trim()?formatGuest(data.chiefGuest,lang):'';
  const special=specialList(data,lang);
  let result=text;
  if(chief) {
    if(lang==='Bn') {
      result=result.replace(/(প্রধান\s*অতিথি(?:\s*হিসেবে)?(?:\s*উপস্থিত\s*(?:থাকবেন|ছিলেন|থাকছেন))?\s*[:ঃ]?\s*)([^।\n]+)(?=।|\n|$)/g,(_,prefix,body)=>prefix+replaceBody(body,chief,lang));
    } else {
      result=result.replace(/(chief\s*guest(?:\s+(?:will be|was|is))?\s*[:,-]?\s*)([^\n]+?)(?=\n|$)/gi,(_,prefix,body)=>{
        const finalPeriod=body.endsWith('.');
        return prefix+replaceBody(finalPeriod?body.slice(0,-1):body,chief,lang)+(finalPeriod?'.':'');
      });
      // Common invitation and press release phrasing without an explicit role label.
      result=result.replace(/((?:will be |was )?inaugurated by\s+)([^\n]+?)(?=\n|$)/gi,(_,prefix,body)=>{
        const finalPeriod=body.endsWith('.');
        return prefix+replaceBody(finalPeriod?body.slice(0,-1):body,chief,lang)+(finalPeriod?'.':'');
      });
    }
  }
  if(special) {
    if(lang==='Bn') result=result.replace(/(বিশেষ\s*অতিথি(?:বৃন্দ|দের|রা)?(?:\s*হিসেবে)?(?:\s*উপস্থিত\s*(?:থাকবেন|ছিলেন|থাকছেন))?\s*[:ঃ]?\s*)([^।\n]+)(?=।|\n|$)/g,(_,prefix,body)=>prefix+replaceBody(body,special,lang));
    else result=result.replace(/(special\s*guests?(?:\s+(?:included|include|will include|were|are|will be))?\s*[:,-]?\s*)([^\n]+?)(?=\n|$)/gi,(_,prefix,body)=>{
      const finalPeriod=body.endsWith('.');
      return prefix+replaceBody(finalPeriod?body.slice(0,-1):body,special,lang)+(finalPeriod?'.':'');
    });
  }
  // User-added guests must remain visible even when a document has no guest section.
  if(!appendMissing)return result;
  const additions:string[]=[];
  if(chief && !/\{\{(?:guest|guestIndex|specialGuests)\./.test(text) && !(lang==='Bn'?/প্রধান\s*অতিথি|chiefGuest\./:/chief\s*guest|chiefGuest\.|inaugurated by/i).test(text)) additions.push((lang==='Bn'?'প্রধান অতিথি: ':'Chief Guest: ')+chief);
  if(special && !(lang==='Bn'?/বিশেষ\s*অতিথি|specialGuests\.|guest(?:Index)?\./:/special\s*guest|specialGuests\.|guest(?:Index)?\./i).test(text)) additions.push((lang==='Bn'?'বিশেষ অতিথিবৃন্দ: ':'Special Guests: ')+special);
  return additions.length ? result+'\n\n'+additions.join('\n') : result;
}
