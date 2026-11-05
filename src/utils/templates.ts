import {sanitizeHtml,htmlToText} from './richHtml';
import { syncNarrativeGuests } from './narrativeGuests';
import { DocumentData, DocumentType, GuestItem } from '../types';

export type SingleDocumentType = Exclude<DocumentType, 'dual-invitation' | 'dual-press-release'>;
export interface DocumentTemplate { filename: string; text: string; html?: string; }
export const DOCUMENT_SLOTS: {type: SingleDocumentType; label: string}[] = [
  {type:'invitation-bn',label:'মিডিয়া ইনভিটেশন — বাংলা'},
  {type:'invitation-en',label:'Media Invitation — English'},
  {type:'press-release-bn',label:'প্রেস রিলিজ — বাংলা'},
  {type:'press-release-en',label:'Press Release — English'},
];
// Recognize editable placeholders in both new uploads and already-saved documents.
export function bindGuestPlaceholders(text: string, type: SingleDocumentType): string {
  const lang=type.endsWith('-bn')?'Bn':'En';
  const resolve = (original: string, label: string) => {
    if (/^(chiefGuest|guest|guestIndex|specialGuests|event)\./.test(label.trim())) return original;
    const normalized=label.toLowerCase().replace(/[_’']/g,' ').replace(/\s+/g,' ').trim();
    const chief=/chief\s*guest|প্রধান\s*অতিথি/.test(normalized);
    const special=/special\s*guests?|বিশেষ\s*অতিথি/.test(normalized);
    if (!chief && !special) return original;
    const hasName=/name|নাম/.test(normalized);
    const hasDesignation=/designation|position|পদবী|পদবি|organization|প্রতিষ্ঠান/.test(normalized);
    const honors=/honou?rs?|degrees?|titles?|সম্মাননা|ডিগ্রি/.test(normalized);
    const field=hasDesignation ? (hasName?'full':'designation') : honors ? 'honors' : hasName ? 'name' : 'full';
    if (chief) return `{{chiefGuest.${field}${lang}}}`;
    const ordinal=normalized.match(/(?:guest|অতিথি(?:র|দের)?)\s*#?\s*([0-9০-৯]+)/);
    if (ordinal) {
      const number=Number(ordinal[1].replace(/[০-৯]/g, d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d))));
      if(number>0) return `{{guestIndex.${number-1}.${field}${lang}}}`;
    }
    return `{{specialGuests.${field}${lang}}}`;
  };
  return text.replace(/\[([^\[\]\n]+)\]|\{\{([^{}\n]+)\}\}|\{([^{}\n]+)\}/g,(original, square, double, single)=>resolve(original,square || double || single));
}
function guestValue(guest: Partial<GuestItem> | undefined, field: string): string {
  if (!guest) return '';
  if (field==='fullBn' || field==='fullEn') {
    const lang=field.endsWith('Bn')?'Bn':'En';
    return ['name','honors','designation'].map(key=>String((guest as any)[key+lang] || '')).filter(Boolean).join(', ');
  }
  return /^(name|designation|honors)(Bn|En)$/.test(field) ? String((guest as any)[field] || '') : '';
}
export function renderTemplate(data: DocumentData, type: DocumentType): string | null {
  const template = data.templates?.[type as SingleDocumentType];
  if (!template) return data.uploadsOnly ? '' : null;
  if(template.html) return htmlToText(renderHtmlTemplate(data,type)!);
  return renderTemplateText(template.text,data,type);
}
export function renderTemplateText(text:string,data:DocumentData,type:DocumentType,narrative=true):string {
  const placeholders=bindGuestPlaceholders(text,type as SingleDocumentType);
  const bound=narrative?syncNarrativeGuests(placeholders,data,type.endsWith('-bn')?'Bn':'En'):placeholders;
  const result=bound.replace(/\{\{([^{}]+)\}\}/g, (original, key: string) => {
    const [group, field, guestField] = key.trim().split('.');
    if (group === 'chiefGuest') return guestValue(data.chiefGuest,field);
    if (group === 'guest') return guestValue(data.specialGuests.find(g=>g.id===field),guestField);
    if (group === 'guestIndex') return guestValue(data.specialGuests[Number(field)],guestField);
    if (group === 'specialGuests') {
      const values=data.specialGuests.map(g=>guestValue(g,field)).filter(Boolean);
      if(values.length<2) return values[0] || '';
      return values.slice(0,-1).join(', ')+(field.endsWith('Bn')?' এবং ':' and ')+values.at(-1);
    }
    if (group === 'event' && typeof (data as any)[field] === 'string') return (data as any)[field];
    return original;
  });
  // Templates often already include a courtesy title immediately before the name.
  return result.replace(/জনাব[ \t]+জনাব[ \t]+/g,'জনাব ').replace(/\bMr\.[ \t]+Mr\.[ \t]+/gi,'Mr. ').replace(/\bMs\.[ \t]+Ms\.[ \t]+/gi,'Ms. ');
}
// Replace all recognized guest fields in one pass, longest first, without changing surrounding text.
export function bindGuestText(text: string, data: DocumentData): string {
  const bindings = new Map<string,string>();
  const add = (guest: object, prefix: string) => {
    for (const [field, value] of Object.entries(guest)) {
      if (/^(name|designation)(Bn|En)$/.test(field) && typeof value === 'string' && value.trim().length > 2 && !bindings.has(value)) bindings.set(value, `{{${prefix}.${field}}}`);
    }
  };
  add(data.chiefGuest, 'chiefGuest');
  data.specialGuests.forEach(g => add(g, `guest.${g.id}`));
  if (!bindings.size) return text;
  const escaped = [...bindings.keys()].sort((a,b) => b.length-a.length).map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'g');
  return text.replace(pattern, match => bindings.get(match)!);
}

export function renderHtmlTemplate(data:DocumentData,type:DocumentType):string|null {
 const html=data.templates?.[type as SingleDocumentType]?.html;if(!html)return null;
 const doc=new DOMParser().parseFromString(sanitizeHtml(html),'text/html');
 const lang=type.endsWith('-bn')?'Bn':'En';
 const aliases=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let alias;
 while(alias=aliases.nextNode())alias.textContent=bindGuestPlaceholders(alias.textContent || '',type as SingleDocumentType);
 // Replace literal guest clauses inside leaf paragraphs while retaining surrounding styling.
 for(const block of doc.body.querySelectorAll('p,div,li,blockquote,h1,h2,h3,h4,h5,h6,td,th')) {
  if(block.querySelector('p,div,li,blockquote,h1,h2,h3,h4,h5,h6,td,th'))continue;
  const before=block.textContent || '';const after=syncNarrativeGuests(before,data,lang,false);
  if(before===after)continue;
  let start=0;while(start<before.length && before[start]===after[start])start++;
  let end=0;while(end<before.length-start && before[before.length-1-end]===after[after.length-1-end])end++;
  const walker=doc.createTreeWalker(block,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let node;while(node=walker.nextNode())nodes.push(node as Text);
  let offset=0;let from:Text|undefined;let to:Text|undefined;let fromOffset=0;let toOffset=0;
  for(const node of nodes){const limit=offset+node.length;if(!from && start<=limit){from=node;fromOffset=start-offset;}if(before.length-end<=limit){to=node;toOffset=before.length-end-offset;break;}offset=limit;}
  if(from&&to){const range=doc.createRange();range.setStart(from,fromOffset);range.setEnd(to,toOffset);range.deleteContents();range.insertNode(doc.createTextNode(after.slice(start,after.length-end)));}
 }
 const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode())node.textContent=renderTemplateText(node.textContent || '',data,type,false);
 // Keep added guest lists visible when the upload did not include a guest section.
 const source=htmlToText(html);
 const all=syncNarrativeGuests(source,data,lang);const noAdd=syncNarrativeGuests(source,data,lang,false);
 const extra=all.startsWith(noAdd)?all.slice(noAdd.length).trim():'';
 if(extra){for(const line of extra.split('\n')){const p=doc.createElement('p');p.textContent=line;doc.body.append(p);}}
 return sanitizeHtml(doc.body.innerHTML);
}
