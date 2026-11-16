import { DocumentData } from '../types';
import { blankPreset } from './presets';
import { emptyUploadWorkspace, submitUploadedFiles } from './uploadWorkspace';
import { renderTemplate, DOCUMENT_SLOTS } from './templates';
import { translateEnglishToBangla } from './transliteration';
import { translateGuestField } from './guestTranslation';

/**
 * Turn any saved draft (browser storage, a studio file, or a JSON backup)
 * into valid working data. Unknown or broken input gives an empty workspace.
 */
export function normalizeDraft(saved: any): DocumentData {
  try {
    if (saved && typeof saved === 'object' && saved.uploadsOnly !== true) {
      const files: any = {};
      for (const {type} of DOCUMENT_SLOTS) {
        if (saved.templates?.[type]?.text) files[type] = {...saved.templates[type], text:renderTemplate(saved,type)};
      }
      return Object.keys(files).length ? submitUploadedFiles(files) : emptyUploadWorkspace();
    }
    if (saved && typeof saved === 'object') {
      for (const guest of [saved.chiefGuest, ...(Array.isArray(saved.specialGuests) ? saved.specialGuests : [])]) {
        if (!guest) continue;
        for (const field of ['honorsBn','designationBn']) {
          if (typeof guest[field] === 'string') {
            const enField = field.replace(/Bn$/, 'En') as 'honorsEn' | 'designationEn';
            const english = guest[enField];
            if (typeof english === 'string' && english && guest[field] === translateEnglishToBangla(english)) guest[field] = translateGuestField(english,enField,saved.translationCorrections);
            guest[field] = guest[field].replace(/ডিগিটাল মারকেটিঙ/g, 'ডিজিটাল মার্কেটিং').replace(/সোফটওয়ারে ডেভেলোপের/g, 'সফটওয়্যার ডেভেলপার');
          }
        }
      }
    }
    if (saved && typeof saved.eventTitleEn === 'string' && saved.chiefGuest && saved.sender && Array.isArray(saved.specialGuests) && Array.isArray(saved.highlights)) return { ...blankPreset, ...saved };
  } catch {}
  return emptyUploadWorkspace();
}
