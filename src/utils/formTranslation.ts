import { translateEnglishToBangla } from './transliteration';
import { translateGuestField } from './guestTranslation';

const terms: Record<string,string> = {
  'iccb':'আইসিসিবি',
  'renewable energy exhibition':'নবায়নযোগ্য জ্বালানি প্রদর্শনী',
  'electric vehicle':'ইলেকট্রিক ভেহিকল', 'medical expo':'মেডিকেল এক্সপো',
  'water management':'পানি ব্যবস্থাপনা', 'power and lighting':'বিদ্যুৎ ও আলোকসজ্জা',
  'food processing':'খাদ্য প্রক্রিয়াজাতকরণ', 'ship repair technologies':'জাহাজ মেরামত প্রযুক্তি',
  'ship recycling':'জাহাজ পুনর্ব্যবহার', 'shipbuilding':'জাহাজ নির্মাণ',
  'solar energy':'সৌরবিদ্যুৎ', 'solar panels':'সোলার প্যানেল', 'energy storage':'জ্বালানি সংরক্ষণ',
  'free entry for all visitors':'সকল দর্শনার্থীর জন্য প্রবেশ উন্মুক্ত',
  'free entry':'প্রবেশ বিনামূল্যে', 'expo village':'এক্সপো ভিলেজ',
  'international exhibition':'আন্তর্জাতিক প্রদর্শনী', 'international medical expo':'আন্তর্জাতিক মেডিকেল এক্সপো',
  'chief news editor':'প্রধান বার্তা সম্পাদক',
  'january':'জানুয়ারি','february':'ফেব্রুয়ারি','march':'মার্চ','april':'এপ্রিল','may':'মে','june':'জুন',
  'july':'জুলাই','august':'আগস্ট','september':'সেপ্টেম্বর','october':'অক্টোবর','november':'নভেম্বর','december':'ডিসেম্বর',
  'sunday':'রবিবার','monday':'সোমবার','tuesday':'মঙ্গলবার','wednesday':'বুধবার','thursday':'বৃহস্পতিবার','friday':'শুক্রবার','saturday':'শনিবার',
  'jan':'জানুয়ারি','feb':'ফেব্রুয়ারি','mar':'মার্চ','apr':'এপ্রিল','jun':'জুন','jul':'জুলাই','aug':'আগস্ট','sep':'সেপ্টেম্বর','sept':'সেপ্টেম্বর','oct':'অক্টোবর','nov':'নভেম্বর','dec':'ডিসেম্বর',
  'daily':'প্রতিদিন','from':'থেকে','to':'থেকে','and':'ও','until':'পর্যন্ত',
  'renewable':'নবায়নযোগ্য','energy':'জ্বালানি','technology':'প্রযুক্তি','technologies':'প্রযুক্তি',
  'solutions':'সমাধান','products':'পণ্য','equipment':'সরঞ্জাম','packaging':'প্যাকেজিং',
  'construction':'নির্মাণ','water':'পানি','medical':'মেডিকেল','expo':'এক্সপো','solar':'সোলার',
};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp('(?<![A-Za-z])(?:'+Object.keys(terms).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![A-Za-z])','gi');
export const banglaDigits=(text:string)=>text.replace(/[0-9]/g,d=>'০১২৩৪৫৬৭৮৯'[Number(d)]);
export function formCorrectionKey(field:string,text:string) {return `form:${field}:${text.trim().replace(/\s+/g,' ').toLowerCase()}`;}
export function translateFormField(text:string,field:string,corrections:Record<string,string>={}):string {
  if(!text.trim()) return '';
  const key=formCorrectionKey(field,text);
  if(Object.hasOwn(corrections,key)) return corrections[key];
  if(field==='sender.nameEn') return translateGuestField(text,'nameEn',corrections);

  let value=text.trim();
  if (['issueDateEn','eventDateEn','eventDurationEn','inaugurationTimeEn','visitingHoursEn'].includes(field)) value=value.replace(/\bfrom\s+/gi,'');
  // Explicit AM/PM labels avoid guessing dates or a timezone.
  value=value.replace(/\b(\d{1,2})([:.][0-5]\d)?\s*([ap])\.?m\.?\b/gi,(_,h,m,period)=>{
    const hour=Number(h);const prefix=period.toLowerCase()==='a'?(hour===12?'রাত':'সকাল'):(hour===12 || hour<4?'দুপুর':hour<6?'বিকাল':hour<8?'সন্ধ্যা':'রাত');
    return prefix+' '+h+(m||'')+'টা';
  });
  value=value.replace(/\b(\d+)(?:st|nd|rd|th)\b/gi,'$1');
  value=value.replace(pattern,word=>terms[word.toLowerCase()]);
  return banglaDigits(translateEnglishToBangla(value,{phoneticFallback:false}));
}
export function updateTranslatedPair<T extends object>(object:T,field:string,value:string,scope:string,corrections:Record<string,string>={}) {
  const next={...object,[field]:value};
  let remembered=corrections;
  if(field.endsWith('En')) (next as any)[field.slice(0,-2)+'Bn']=translateFormField(value,scope+field,corrections);
  if(field.endsWith('Bn')) {
    const english=String((object as any)[field.slice(0,-2)+'En'] || '');
    if(english.trim()) remembered={...corrections,[formCorrectionKey(scope+field.slice(0,-2)+'En',english)]:value};
  }
  return {next,corrections:remembered};
}
