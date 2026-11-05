import { translateEnglishToBangla } from './transliteration';
export type GuestEnglishField = 'nameEn' | 'honorsEn' | 'designationEn';
export type TranslationCorrections = Record<string,string>;
export function correctionKey(text: string, field: GuestEnglishField): string {
  return `${field}:${text.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}
export function translateGuestField(text: string, field: GuestEnglishField, corrections: TranslationCorrections = {}): string {
  if (!text.trim()) return '';
  const key=correctionKey(text,field);
  if (Object.prototype.hasOwnProperty.call(corrections,key)) return corrections[key];
  return translateEnglishToBangla(text,{phoneticFallback:field==='nameEn'});
}
export function needsGuestReview(text: string, field: GuestEnglishField, corrections: TranslationCorrections = {}): boolean {
  if (!text.trim() || Object.prototype.hasOwnProperty.call(corrections,correctionKey(text,field))) return false;
  return /[A-Za-z]/.test(translateEnglishToBangla(text,{phoneticFallback:false}));
}
export function rememberGuestCorrection(corrections: TranslationCorrections | undefined, english: string, field: GuestEnglishField, bangla: string): TranslationCorrections {
  if (!english.trim()) return corrections || {};
  return {...corrections,[correctionKey(english,field)]:bangla};
}
