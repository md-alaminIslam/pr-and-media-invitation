import {sanitizeHtml} from './richHtml';
import { DocumentData } from '../types';
import { blankPreset } from './presets';
import { bindGuestText, bindGuestPlaceholders, DOCUMENT_SLOTS, DocumentTemplate, SingleDocumentType } from './templates';

export function emptyUploadWorkspace(): DocumentData {
  const data=structuredClone(blankPreset);
  data.uploadsOnly=true;
  data.specialGuests=[]; data.highlights=[];
  data.mediaAddresseeBn=''; data.mediaAddresseeEn='';
  data.templates={};
  return data;
}
export function submitUploadedFiles(files: Partial<Record<SingleDocumentType,DocumentTemplate>>): DocumentData {
  const entries=DOCUMENT_SLOTS.filter(slot=>files[slot.type]?.text.trim());
  if(!entries.length) throw new Error('প্রথমে অন্তত একটি ফাইল নির্বাচন করুন।');
  const data=emptyUploadWorkspace();
  // Only explicit guest labels are extracted. Never carry fields from a previous workspace.
  for(const {type} of entries) {
    const text=files[type]!.text;
    const lang=type.endsWith('-bn')?'Bn':'En';
    const match=text.match(lang==='Bn' ? /(?:প্রধান\s*অতিথি)\s*[:ঃ]\s*([^\n]+)/ : /(?:chief\s*guest)\s*:\s*([^\n]+)/i);
    if(match && !/[\[\]{}]/.test(match[1]) && !data.chiefGuest[`name${lang}`]) data.chiefGuest[`name${lang}`]=match[1].split(',')[0].trim();
  }
  for(const {type} of entries) data.templates![type]={...files[type]!,text:bindGuestText(bindGuestPlaceholders(files[type]!.text,type),data),...(files[type]!.html?{html:sanitizeHtml(files[type]!.html!)}:{})};
  return data;
}
