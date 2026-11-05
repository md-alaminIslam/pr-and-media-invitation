/**
 * High-Accuracy Bilingual English-to-Bangla PR Translation & Transliteration Engine
 * 
 * Specifically optimized for Bangladeshi formal press releases, media invitations,
 * military titles, governmental ministries, business designations, and Bengali names.
 * Features:
 * 1. Multi-word phrase translation (Ministries, Designations, Trade Bodies, Organizations)
 * 2. Extensive single-word dictionary (Honorifics, Names, Corporate terms, Honors)
 * 3. Full phonetic English-to-Bangla script transliterator for arbitrary words (no English letters left behind)
 * 4. Punctuation, degrees, and number normalization
 */

// 1. Multi-Word Phrases (Sorted by length descending at runtime)
export const PHRASE_DICTIONARY: Record<string, string> = {
  // Military Ranks & Positions
  'assistant chief of naval staff (operations)': 'সহকারী নৌবাহিনী প্রধান (অপারেশনস)',
  'assistant chief of naval staff (o)': 'সহকারী নৌবাহিনী প্রধান (অপারেশনস)',
  'assistant chief of naval staff': 'সহকারী নৌবাহিনী প্রধান',
  'chief of naval staff': 'নৌবাহিনী প্রধান',
  'assistant chief of army staff': 'সহকারী সেনাবাহিনী প্রধান',
  'chief of army staff': 'সেনাবাহিনী প্রধান',
  'assistant chief of air staff': 'সহকারী বিমান বাহিনী প্রধান',
  'chief of air staff': 'বিমান বাহিনী প্রধান',
  'director general, bangladesh coast guard': 'মহাপরিচালক, বাংলাদেশ কোস্ট গার্ড',
  'director general': 'মহাপরিচালক',
  'bangladesh coast guard': 'বাংলাদেশ কোস্ট গার্ড',
  'bangladesh navy': 'বাংলাদেশ নৌবাহিনী',
  'bangladesh army': 'বাংলাদেশ সেনাবাহিনী',
  'bangladesh air force': 'বাংলাদেশ বিমান বাহিনী',
  'bangladesh police': 'বাংলাদেশ পুলিশ',
  'inspector general of police': 'পুলিশ মহাপরিদর্শক (আইজিপি)',
  'additional inspector general of police': 'অতিরিক্ত আইজিপি',
  'rear admiral': 'রিয়ার অ্যাডমিরাল',
  'vice admiral': 'ভাইস অ্যাডমিরাল',
  'major general': 'মেজর জেনারেল',
  'brigadier general': 'ব্রিগেডিয়ার জেনারেল',
  'lieutenant general': 'লেফটেন্যান্ট জেনারেল',
  'lieutenant colonel': 'লেফটেন্যান্ট কর্নেল',
  'lieutenant commander': 'লেফটেন্যান্ট কমান্ডার',
  'sub lieutenant': 'সাব লেফটেন্যান্ট',

  // Government & Administration
  "interim government of the people's republic of bangladesh": 'গণপ্রজাতন্ত্রী বাংলাদেশ অন্তর্বর্তীকালীন সরকার',
  'interim government of bangladesh': 'বাংলাদেশ অন্তর্বর্তীকালীন সরকার',
  'interim government': 'অন্তর্বর্তীকালীন সরকার',
  "government of the people's republic of bangladesh": 'গণপ্রজাতন্ত্রী বাংলাদেশ সরকার',
  'government of bangladesh': 'বাংলাদেশ সরকার',
  'chief adviser': 'প্রধান উপদেষ্টা',
  'chief advisor': 'প্রধান উপদেষ্টা',
  'special assistant to the chief adviser': 'প্রধান উপদেষ্টার বিশেষ সহকারী',
  'special assistant': 'বিশেষ সহকারী',
  'senior secretary': 'জ্যেষ্ঠ সচিব',
  'additional secretary': 'অতিরিক্ত সচিব',
  'joint secretary': 'যুগ্ম সচিব',
  'deputy secretary': 'উপ-সচিব',
  'assistant secretary': 'সহকারী সচিব',
  'deputy commissioner': 'জেলা প্রশাসক',
  'divisional commissioner': 'বিভাগীয় কমিশনার',
  'member of parliament': 'সংসদ সদস্য',
  'high commissioner': 'হাই কমিশনার',
  'deputy high commissioner': 'উপ-হাই কমিশনার',
  'ambassador extraordinary and plenipotentiary': 'অসাধারণ ও পূর্ণক্ষমতাপ্রাপ্ত রাষ্ট্রদূত',
  'consul general': 'কনসাল জেনারেল',
  'embassy of bangladesh': 'বাংলাদেশ দূতাবাস',
  'high commission of bangladesh': 'বাংলাদেশ হাই কমিশন',

  // Ministries of Bangladesh
  'ministry of shipping': 'নৌপরিবহন মন্ত্রণালয়',
  'ministry of labour and employment': 'শ্রম ও কর্মসংস্থান মন্ত্রণালয়',
  'ministry of labour & employment': 'শ্রম ও কর্মসংস্থান মন্ত্রণালয়',
  'ministry of labor & employment': 'শ্রম ও কর্মসংস্থান মন্ত্রণালয়',
  'ministry of labor and employment': 'শ্রম ও কর্মসংস্থান মন্ত্রণালয়',
  'ministry of commerce': 'বাণিজ্য মন্ত্রণালয়',
  'ministry of industries': 'শিল্প মন্ত্রণালয়',
  'ministry of foreign affairs': 'পররাষ্ট্র মন্ত্রণালয়',
  'ministry of finance': 'অর্থ মন্ত্রণালয়',
  'ministry of home affairs': 'স্বরাষ্ট্র মন্ত্রণালয়',
  'ministry of power, energy and mineral resources': 'বিদ্যুৎ, জ্বালানি ও খনিজ সম্পদ মন্ত্রণালয়',
  'ministry of power, energy & mineral resources': 'বিদ্যুৎ, জ্বালানি ও খনিজ সম্পদ মন্ত্রণালয়',
  'ministry of posts, telecommunications and information technology': 'ডাক, টেলিযোগাযোগ ও তথ্যপ্রযুক্তি মন্ত্রণালয়',
  'ministry of civil aviation and tourism': 'বেসামরিক বিমান পরিবহন ও পর্যটন মন্ত্রণালয়',
  'ministry of road transport and bridges': 'সড়ক পরিবহন ও সেতু মন্ত্রণালয়',
  'ministry of agriculture': 'কৃষি মন্ত্রণালয়',
  'ministry of planning': 'পরিকল্পনা মন্ত্রণালয়',
  'ministry of health and family welfare': 'স্বাস্থ্য ও পরিবার কল্যাণ মন্ত্রণালয়',
  'ministry of education': 'শিক্ষা মন্ত্রণালয়',
  'ministry of science and technology': 'বিজ্ঞান ও প্রযুক্তি মন্ত্রণালয়',
  'ministry of environment, forest and climate change': 'পরিবেশ, বন ও জলবায়ু পরিবর্তন মন্ত্রণালয়',
  'ministry of housing and public works': 'গৃহায়ন ও গণপূর্ত মন্ত্রণালয়',
  'ministry of water resources': 'পানিসম্পদ মন্ত্রণালয়',
  'ministry of disaster management and relief': 'দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়',
  'ministry of textiles and jute': 'বস্ত্র ও পাট মন্ত্রণালয়',
  'ministry of fisheries and livestock': 'মৎস্য ও প্রাণিসম্পদ মন্ত্রণালয়',
  'ministry of railways': 'রেলপথ মন্ত্রণালয়',
  'ministry of information and broadcasting': 'তথ্য ও সম্প্রচার মন্ত্রণালয়',
  'ministry of youth and sports': 'যুব ও ক্রীড়া মন্ত্রণালয়',
  'ministry of cultural affairs': 'সংস্কৃতি বিষয়ক মন্ত্রণালয়',
  'ministry of land': 'ভূমি মন্ত্রণালয়',
  'ministry of law, justice and parliamentary affairs': 'আইন, বিচার ও সংসদ বিষয়ক মন্ত্রণালয়',

  // Trade Associations & Chambers
  'federation of bangladesh chambers of commerce and industry': 'এফবিসিসিআই',
  'bangladesh china chamber of commerce & industry': 'বাংলাদেশ চায়না চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'bangladesh china chamber of commerce and industry': 'বাংলাদেশ চায়না চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'dhaka chamber of commerce & industry': 'ঢাকা চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'dhaka chamber of commerce and industry': 'ঢাকা চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'chittagong chamber of commerce & industry': 'চট্টগ্রাম চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'chamber of commerce & industry': 'চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'chamber of commerce and industry': 'চেম্বার অব কমার্স অ্যান্ড ইন্ডাস্ট্রি',
  'chamber of commerce': 'চেম্বার অব কমার্স',
  'the nautical institute of bangladesh': 'দ্য নটিক্যাল ইনস্টিটিউট অব বাংলাদেশ',
  'the nautical institute': 'দ্য নটিক্যাল ইনস্টিটিউট',
  'ex-chairman': 'সাবেক চেয়ারম্যান',
  'former chairman': 'সাবেক চেয়ারম্যান',
  'vice chairman': 'ভাইস চেয়ারম্যান',

  // Professional terms have explicit spellings; do not derive these from English letters.
  'software developer': 'সফটওয়্যার ডেভেলপার',
  'software engineer': 'সফটওয়্যার প্রকৌশলী',
  'senior software engineer': 'জ্যেষ্ঠ সফটওয়্যার প্রকৌশলী',
  'junior software developer': 'জুনিয়র সফটওয়্যার ডেভেলপার',
  'web developer': 'ওয়েব ডেভেলপার',
  'web designer': 'ওয়েব ডিজাইনার',
  'full stack developer': 'ফুল স্ট্যাক ডেভেলপার',
  'full-stack developer': 'ফুল স্ট্যাক ডেভেলপার',
  'front end developer': 'ফ্রন্ট এন্ড ডেভেলপার',
  'front-end developer': 'ফ্রন্ট এন্ড ডেভেলপার',
  'frontend developer': 'ফ্রন্ট এন্ড ডেভেলপার',
  'back end developer': 'ব্যাক এন্ড ডেভেলপার',
  'back-end developer': 'ব্যাক এন্ড ডেভেলপার',
  'backend developer': 'ব্যাক এন্ড ডেভেলপার',
  'mobile app developer': 'মোবাইল অ্যাপ ডেভেলপার',
  'application developer': 'অ্যাপ্লিকেশন ডেভেলপার',
  'software development': 'সফটওয়্যার ডেভেলপমেন্ট',
  'data analyst': 'ডেটা বিশ্লেষক',
  'data scientist': 'ডেটা বিজ্ঞানী',
  'system administrator': 'সিস্টেম অ্যাডমিনিস্ট্রেটর',
  'systems administrator': 'সিস্টেম অ্যাডমিনিস্ট্রেটর',
  'network engineer': 'নেটওয়ার্ক প্রকৌশলী',
  'technical support': 'কারিগরি সহায়তা',
  'quality assurance': 'মান নিশ্চিতকরণ',
  'quality control': 'মান নিয়ন্ত্রণ',
  'project manager': 'প্রকল্প ব্যবস্থাপক',
  'project director': 'প্রকল্প পরিচালক',
  'product manager': 'পণ্য ব্যবস্থাপক',
  'brand manager': 'ব্র্যান্ড ব্যবস্থাপক',
  'marketing manager': 'বিপণন ব্যবস্থাপক',
  'sales manager': 'বিক্রয় ব্যবস্থাপক',
  'account manager': 'অ্যাকাউন্ট ম্যানেজার',
  'chief accountant': 'প্রধান হিসাবরক্ষক',
  'accounts officer': 'হিসাব কর্মকর্তা',
  'finance officer': 'অর্থ কর্মকর্তা',
  'medical officer': 'চিকিৎসা কর্মকর্তা',
  'medical director': 'চিকিৎসা পরিচালক',
  'assistant professor': 'সহকারী অধ্যাপক',
  'associate professor': 'সহযোগী অধ্যাপক',
  'head of department': 'বিভাগীয় প্রধান',
  'head of accounts': 'হিসাব বিভাগের প্রধান',
  'head of human resources': 'মানবসম্পদ বিভাগের প্রধান',
  'head of sales': 'বিক্রয় বিভাগের প্রধান',
  'team leader': 'দলনেতা',
  'team lead': 'দলনেতা',
  'digital marketer': 'ডিজিটাল মার্কেটার',
  'graphic design': 'গ্রাফিক ডিজাইন',
  'graphics designer': 'গ্রাফিক ডিজাইনার',
  'video editor': 'ভিডিও সম্পাদক',
  'content writer': 'কনটেন্ট লেখক',
  'managing editor': 'ব্যবস্থাপনা সম্পাদক',
  'chief reporter': 'প্রধান প্রতিবেদক',
  'staff reporter': 'নিজস্ব প্রতিবেদক',
  'photo journalist': 'ফটোসাংবাদিক',
  'photojournalist': 'ফটোসাংবাদিক',
  'sales representative': 'বিক্রয় প্রতিনিধি',
  'customer service executive': 'গ্রাহকসেবা নির্বাহী',
  'customer relationship manager': 'গ্রাহক সম্পর্ক ব্যবস্থাপক',
  'public relations officer': 'জনসংযোগ কর্মকর্তা',
  'event coordinator': 'ইভেন্ট সমন্বয়কারী',
  'event manager': 'ইভেন্ট ম্যানেজার',
  'supply chain manager': 'সরবরাহ শৃঙ্খল ব্যবস্থাপক',
  'bachelor of science': 'বিজ্ঞান স্নাতক',
  'master of science': 'বিজ্ঞান স্নাতকোত্তর',
  'master of business administration': 'ব্যবসায় প্রশাসনে স্নাতকোত্তর',
  'bachelor of business administration': 'ব্যবসায় প্রশাসনে স্নাতক',

  // Common business departments and job titles: translate meaning before phonetics.
  'assistant manager': 'সহকারী ব্যবস্থাপক',
  'deputy manager': 'উপ-ব্যবস্থাপক',
  'senior manager': 'জ্যেষ্ঠ ব্যবস্থাপক',
  'senior executive': 'জ্যেষ্ঠ নির্বাহী',
  'junior executive': 'কনিষ্ঠ নির্বাহী',
  'marketing executive': 'বিপণন নির্বাহী',
  'sales executive': 'বিক্রয় নির্বাহী',
  'sales and marketing': 'বিক্রয় ও বিপণন',
  'sales & marketing': 'বিক্রয় ও বিপণন',
  'digital marketing': 'ডিজিটাল মার্কেটিং',
  'digital marketing manager': 'ডিজিটাল মার্কেটিং ব্যবস্থাপক',
  'digital marketing executive': 'ডিজিটাল মার্কেটিং নির্বাহী',
  'head of digital marketing': 'ডিজিটাল মার্কেটিং প্রধান',
  'business development': 'ব্যবসা উন্নয়ন',
  'human resources': 'মানবসম্পদ',
  'human resource': 'মানবসম্পদ',
  'human resources and administration': 'মানবসম্পদ ও প্রশাসন',
  'human resources & administration': 'মানবসম্পদ ও প্রশাসন',
  'accounts and admin': 'হিসাব ও প্রশাসন',
  'accounts & admin': 'হিসাব ও প্রশাসন',
  'accounts and administration': 'হিসাব ও প্রশাসন',
  'accounts & administration': 'হিসাব ও প্রশাসন',
  'finance and accounts': 'অর্থ ও হিসাব',
  'finance & accounts': 'অর্থ ও হিসাব',
  'public relations': 'জনসংযোগ',
  'customer service': 'গ্রাহকসেবা',
  'customer support': 'গ্রাহক সহায়তা',
  'information technology': 'তথ্যপ্রযুক্তি',
  'supply chain': 'সরবরাহ শৃঙ্খল',
  'social media': 'সামাজিক যোগাযোগমাধ্যম',
  'content creator': 'কনটেন্ট নির্মাতা',
  'graphic designer': 'গ্রাফিক ডিজাইনার',
  'event management': 'ইভেন্ট ম্যানেজমেন্ট',

  // Corporate & Executive Designations
  'chief executive officer': 'প্রধান নির্বাহী কর্মকর্তা (সিইও)',
  'chief operating officer': 'প্রধান পরিচালন কর্মকর্তা (সিওও)',
  'chief financial officer': 'প্রধান অর্থ কর্মকর্তা (সিএফও)',
  'chief technology officer': 'প্রধান প্রযুক্তি কর্মকর্তা (সিটিও)',
  'chief marketing officer': 'প্রধান বিপণন কর্মকর্তা',
  'managing director': 'ব্যবস্থাপনা পরিচালক',
  'deputy managing director': 'উপ-ব্যবস্থাপনা পরিচালক',
  'senior vice president': 'জ্যেষ্ঠ সহ-সভাপতি',
  'executive vice president': 'নির্বাহী সহ-সভাপতি',
  'vice president': 'সহ-সভাপতি',
  'executive director': 'নির্বাহী পরিচালক',
  'independent director': 'স্বতন্ত্র পরিচালক',
  'general manager': 'মহাব্যবস্থাপক',
  'deputy general manager': 'উপ-মহাব্যবস্থাপক',
  'assistant general manager': 'সহকারী মহাব্যবস্থাপক',
  'country manager': 'কান্ট্রি ম্যানেজার',
  'country director': 'কান্ট্রি ডিরেক্টর',
  'head of marketing': 'বিপণন প্রধান',
  'head of operations': 'অপারেশনস প্রধান',
  'head of business': 'বাণিজ্যিক প্রধান',
  'founder & ceo': 'প্রতিষ্ঠাতা ও সিইও',
  'founder and ceo': 'প্রতিষ্ঠাতা ও সিইও',
  'co-founder': 'সহ-প্রতিষ্ঠাতা',
  'guest of honour': 'সম্মানিত অতিথি',
  'guest of honor': 'সম্মানিত অতিথি',
  'chief guest': 'প্রধান অতিথি',
  'special guest': 'বিশেষ অতিথি',
  'keynote speaker': 'মূল প্রবন্ধ উপস্থাপক',

  // Corporate suffixes & forms
  'savor international limited': 'সেভার ইন্টারন্যাশনাল লিমিটেড',
  'international limited': 'ইন্টারন্যাশনাল লিমিটেড',
  'private limited': 'প্রাইভেট লিমিটেড',
  'pvt ltd': 'প্রাইভেট লিমিটেড',
  'pvt. ltd.': 'প্রাইভেট লিমিটেড',
  'convention center': 'কনভেনশন সেন্টার',
  'convention centre': 'কনভেনশন সেন্টার',
  'conference center': 'সম্মেলন কেন্দ্র',
  'international convention city bashundhara': 'আন্তর্জাতিক কনভেনশন সিটি বসুন্ধরা',
  'bangabandhu international conference center': 'বঙ্গবন্ধু আন্তর্জাতিক সম্মেলন কেন্দ্র',

  // Common Academic / Military honors
  'osp, npp, rcds, afwc, psc, phd': 'ওএসপি, এনপিপি, আরসিডিসি, এএফডব্লিউসি, পিএসসি, পিএইচডি',
  'osp, ndc, afwc, psc': 'ওএসপি, এনডিসি, এএফডব্লিউসি, পিএসসি',
};

// 2. Single Words & Common Titles / Names
export const WORD_DICTIONARY: Record<string, string> = {
  // Titles & Honorifics
  'mr': 'জনাব',
  'mr.': 'জনাব',
  'mrs': 'বেগম',
  'mrs.': 'বেগম',
  'ms': 'জনাবা',
  'ms.': 'জনাবা',
  'dr': 'ড.',
  'dr.': 'ড.',
  'prof': 'অধ্যাপক',
  'prof.': 'অধ্যাপক',
  'professor': 'অধ্যাপক',
  'engr': 'প্রকৌশলী',
  'engr.': 'প্রকৌশলী',
  'engineer': 'প্রকৌশলী',
  'capt': 'ক্যাপ্টেন',
  'capt.': 'ক্যাপ্টেন',
  'captain': 'ক্যাপ্টেন',
  'adv': 'অ্যাডভোকেট',
  'adv.': 'অ্যাডভোকেট',
  'advocate': 'অ্যাডভোকেট',
  'admiral': 'অ্যাডমিরাল',
  'rear': 'রিয়ার',
  'vice': 'ভাইস',
  'major': 'মেজর',
  'general': 'জেনারেল',
  'brigadier': 'ব্রিগেডিয়ার',
  'colonel': 'কর্নেল',
  'lieutenant': 'লেফটেন্যান্ট',
  'commander': 'কমান্ডার',
  'minister': 'মন্ত্রী',
  'advisor': 'উপদেষ্টা',
  'adviser': 'উপদেষ্টা',
  'secretary': 'সচিব',
  'director': 'পরিচালক',
  'chairman': 'চেয়ারম্যান',
  'president': 'সভাপতি',
  'manager': 'ব্যবস্থাপক',
  'software': 'সফটওয়্যার',
  'developer': 'ডেভেলপার',
  'web': 'ওয়েব',
  'designer': 'ডিজাইনার',
  'programmer': 'প্রোগ্রামার',
  'programming': 'প্রোগ্রামিং',
  'technical': 'কারিগরি',
  'technology': 'প্রযুক্তি',
  'technologies': 'প্রযুক্তি',
  'engineering': 'প্রকৌশল',
  'architect': 'স্থপতি',
  'accountant': 'হিসাবরক্ষক',
  'auditor': 'নিরীক্ষক',
  'lecturer': 'প্রভাষক',
  'researcher': 'গবেষক',
  'journalist': 'সাংবাদিক',
  'reporter': 'প্রতিবেদক',
  'editor': 'সম্পাদক',
  'photographer': 'আলোকচিত্রী',
  'producer': 'প্রযোজক',
  'principal': 'অধ্যক্ষ',
  'treasurer': 'কোষাধ্যক্ষ',
  'member': 'সদস্য',
  'partner': 'অংশীদার',
  'owner': 'স্বত্বাধিকারী',
  'proprietor': 'স্বত্বাধিকারী',
  'digital': 'ডিজিটাল',
  'marketing': 'বিপণন',
  'sales': 'বিক্রয়',
  'executive': 'নির্বাহী',
  'officer': 'কর্মকর্তা',
  'finance': 'অর্থ',
  'accounts': 'হিসাব',
  'accounting': 'হিসাবরক্ষণ',
  'administration': 'প্রশাসন',
  'admin': 'প্রশাসন',
  'operations': 'অপারেশনস',
  'procurement': 'ক্রয়',
  'development': 'উন্নয়ন',
  'department': 'বিভাগ',
  'coordinator': 'সমন্বয়কারী',
  'supervisor': 'তত্ত্বাবধায়ক',
  'and': 'ও',
  'founder': 'প্রতিষ্ঠাতা',
  'assistant': 'সহকারী',
  'chief': 'প্রধান',
  'senior': 'জ্যেষ্ঠ',
  'deputy': 'উপ-',
  'joint': 'যুগ্ম',
  'additional': 'অতিরিক্ত',
  'honourable': 'মাননীয়',
  'honorable': 'মাননীয়',
  "hon'ble": 'মাননীয়',
  'ambassador': 'রাষ্ট্রদূত',
  'retd': '(অব.)',
  'retd.': '(অব.)',
  'retired': '(অব.)',

  // Corporate & Organization
  'limited': 'লিমিটেড',
  'ltd': 'লিমিটেড',
  'ltd.': 'লিমিটেড',
  'company': 'কোম্পানি',
  'co.': 'কোং',
  'corporation': 'কর্পোরেশন',
  'group': 'গ্রুপ',
  'enterprise': 'এন্টারপ্রাইজ',
  'enterprises': 'এন্টারপ্রাইজ',
  'international': 'ইন্টারন্যাশনাল',
  'intl': 'ইন্টারন্যাশনাল',
  'intl.': 'ইন্টারন্যাশনাল',
  'industries': 'ইন্ডাস্ট্রিজ',
  'holdings': 'হোল্ডিংস',
  'marine': 'মেরিন',
  'offshore': 'অফশোর',
  'maritime': 'মেরিটাইম',
  'expo': 'এক্সপো',
  'exhibition': 'প্রদর্শনী',
  'convention': 'কনভেনশন',
  'city': 'সিটি',
  'center': 'সেন্টার',
  'centre': 'সেন্টার',
  'hall': 'হল',
  'curator': 'কিউরেটর',
  'consultant': 'পরামর্শক',

  // Locations
  'bangladesh': 'বাংলাদেশ',
  'dhaka': 'ঢাকা',
  'chattogram': 'চট্টগ্রাম',
  'chittagong': 'চট্টগ্রাম',
  'khulna': 'খুলনা',
  'rajshahi': 'রাজশাহী',
  'sylhet': 'সিলেট',
  'barishal': 'বরিশাল',
  'rangpur': 'রংপুর',
  'mymensingh': 'ময়মনসিংহ',
  'bashundhara': 'বসুন্ধরা',
  'kuril': 'কুড়িল',

  // Names (Initials, First names, Surnames)
  'm': 'এম.',
  'm.': 'এম.',
  'md': 'মো:',
  'md.': 'মো:',
  'a': 'এ.',
  'a.': 'এ.',
  'k': 'কে.',
  'k.': 'কে.',
  's': 'এস.',
  's.': 'এস.',
  'h': 'এইচ.',
  'h.': 'এইচ.',
  'r': 'আর.',
  'r.': 'আর.',
  'mohammad': 'মোহাম্মদ',
  'mohammed': 'মোহাম্মদ',
  'muhammad': 'মুহাম্মদ',
  'musa': 'মুসা',
  'sakhawat': 'সাখাওয়াত',
  'shakhawat': 'সাখাওয়াত',
  'hossain': 'হোসেন',
  'hussain': 'হোসেন',
  'rahman': 'রহমান',
  'ahmed': 'আহমেদ',
  'ahmad': 'আহমাদ',
  'hasan': 'হাসান',
  'hassan': 'হাসান',
  'mahmud': 'মাহমুদ',
  'ziaul': 'জিয়াউল',
  'hoque': 'হক',
  'haque': 'হক',
  'masud': 'মাসুদ',
  'ali': 'আলী',
  'khan': 'খান',
  'faizul': 'ফায়জুল',
  'alam': 'আলম',
  'shafiqul': 'শফিকুল',
  'islam': 'ইসলাম',
  'bhuiyan': 'ভূঁইয়া',
  'abid': 'আবিদ',
  'edgars': 'এডগার্স',
  'dzenis': 'ডজেনিস',
  'rigas': 'রিগাস',
  'dizelis': 'ডিজেলিস',
  'nautika': 'নটিকা',
  'yunus': 'ইউনূস',
  'kalam': 'কালাম',
  'azad': 'আজাদ',
  'chowdhury': 'চৌধুরী',
  'miah': 'মিয়া',
  'sarkar': 'সরকার',
  'shikder': 'শিকদার',
  'talukder': 'তালুকদার',
  'barua': 'বড়ুয়া',
  'chakma': 'চাকমা',
  'roy': 'রায়',
  'dey': 'দে',
  'dhar': 'ধর',
  'das': 'দাস',
  'bhowmik': 'ভৌমিক',
  'majumder': 'মজুমদার',
  'chatterjee': 'চ্যাটার্জি',
  'banerjee': 'ব্যানার্জি',
  'mukherjee': 'মুখার্জি',
  'ganguly': 'গাঙ্গুলি',
  'sen': 'সেন',
  'gupta': 'গুপ্ত',
  'dutta': 'দত্ত',
  'quader': 'কাদের',
  'kader': 'কাদের',
  'jalil': 'জলিল',
  'khaleque': 'খালেক',
  'mannan': 'মান্নান',
  'matin': 'মতিন',
  'latif': 'লতিফ',
  'razzaq': 'রাজ্জাক',
  'shams': 'শামস',
  'shamsul': 'শামসুল',
  'nurul': 'নুরুল',
  'monir': 'মনির',
  'monirul': 'মনিরুল',
  'jahangir': 'জাহাঙ্গীর',
  'alamgir': 'আলমগীর',
  'shahid': 'শহীদ',
  'shaheed': 'শহীদ',
  'saiful': 'সাইফুল',
  'kamrul': 'কামরুল',
  'enamul': 'এনামুল',
  'sirajul': 'সিরাজুল',
  'amin': 'আমিন',
  'aminul': 'আমিনুল',
  'habib': 'হাবিব',
  'habibur': 'হাবিবুর',
  'salim': 'সেলিম',
  'selim': 'সেলিম',
  'sohel': 'সোহেল',
  'tanvir': 'তানভীর',
  'shahriar': 'শাহরিয়ার',
  'faisal': 'ফয়সাল',
  'fahim': 'ফাহিম',
  'nayeem': 'নাঈম',
  'naim': 'নাঈম',
  'asif': 'আসিফ',
  'sakib': 'সাকিব',
  'shakib': 'সাকিব',
  'tamim': 'তামিম',
  'mushfiq': 'মুশফিক',
  'nasir': 'নাসির',
  'rubel': 'রুবেল',
  'sumon': 'সুমন',
  'sujon': 'সুজন',
  'anwar': 'আনোয়ার',
  'anowar': 'আনোয়ার',
  'delwar': 'দেলোয়ার',
  'sarwar': 'সারোয়ার',
  'monjur': 'মঞ্জুর',
  'manzur': 'মঞ্জুর',
  'harun': 'হারুন',
  'rasheed': 'রশীদ',
  'rashid': 'রশীদ',
  'reza': 'রেজা',
  'hafiz': 'হাফিজ',
  'farooq': 'ফারুক',
  'faruk': 'ফারুক',
  'mahbub': 'মাহবুব',
  'mahfuz': 'মাহফুজ',
  'iqbal': 'ইকবাল',
  'jamil': 'জামিল',
  'sabbir': 'সাব্বির',
  'shakil': 'শাকিল',
  'kamal': 'কামাল',
  'jamal': 'জামাল',
  'kazi': 'কাজী',
  'syed': 'সৈয়দ',
  'sheikh': 'শেখ',
  'shah': 'শাহ',
  'tareque': 'তারেক',
  'tareq': 'তারিক',
  'tariq': 'তারিক',
  'tarique': 'তারেক',
  'mehedi': 'মেহেদী',
  'zaman': 'জামান',
  'wahid': 'ওয়াহিদ',
  'wahed': 'ওয়াহেদ',
  'rana': 'রানা',
  'sohag': 'সোহাগ',
  'shuvo': 'শুভ',
  'ayon': 'অয়ন',
  'noyon': 'নয়ন',
  'akash': 'আকাশ',
  'bijoy': 'বিজয়',
  'joy': 'জয়',
  'milon': 'মিলন',
  'rabiul': 'রবিউল',
  'sajib': 'সজীব',
  'shajib': 'সজীব',
  'polash': 'পলাশ',
  'shimul': 'শিমুল',
  'shaon': 'শাওন',
  'tania': 'তানিয়া',
  'nadia': 'নাদিয়া',
  'sharmin': 'শারমিন',
  'nasrin': 'নাসরিন',
  'farhana': 'ফারহানা',
  'fatema': 'ফাতেমা',
  'nusrat': 'নুসরাত',
  'sadia': 'সাদিয়া',
  'sumaiya': 'সুমাইয়া',
  'sabina': 'সাবিনা',
  'yasmin': 'ইয়াসমিন',
  'salma': 'সালমা',
  'rokeya': 'রোকেয়া',
  'khaleda': 'খালেদা',
  'hasina': 'হাসিনা',
  'rahima': 'রহিমা',
  'jannat': 'জান্নাত',
  'jannatul': 'জান্নাতুল',
  'ferdous': 'ফেরদৌস',
  'ferdousi': 'ফেরদৌসী',
  'marufa': 'মারুফা',
  'mim': 'মীম',
  'shirin': 'শিরিন',
  'shila': 'শীলা',
  'munni': 'মুন্নি',
  'poly': 'পলি',
  'keya': 'কেয়া',
  'tithi': 'তিথি',
  'peter': 'পিটার',
  'haas': 'হাস',
  'smith': 'স্মিথ',
  'beximco': 'বেক্সিমকো',

  // Honors
  'osp': 'ওএসপি',
  'npp': 'এনপিপি',
  'rcds': 'আরসিডিসি',
  'afwc': 'এএফডব্লিউসি',
  'psc': 'পিএসসি',
  'ndc': 'এনডিসি',
  'phd': 'পিএইচডি',
  'afni': 'এএফএনআই',
  'fcps': 'এফসিপিএস',
  'mbbs': 'এমবিবিএস',
  'msc': 'এমএসসি',
  'bsc': 'বিএসসি',
  'mba': 'এমবিএ',
  'bba': 'বিবিএ',

  // Connectors
  '&': 'অ্যান্ড',
  'or': 'বা',
};

// 3. Phonetic Consonants & Vowels for words not in dictionary
const PHONETIC_CONSONANTS: Array<[string, string]> = [
  ['kkhy', 'ক্ষ্য'], ['kkh', 'ক্ষ'], ['shh', 'ষ'], ['chh', 'ছ'],
  ['kh', 'খ'], ['gh', 'ঘ'], ['ng', 'ঙ'], ['ch', 'চ'], ['jh', 'ঝ'],
  ['th', 'থ'], ['dh', 'ধ'], ['ph', 'ফ'], ['bh', 'ভ'], ['sh', 'শ'],
  ['k', 'ক'], ['g', 'গ'], ['j', 'জ'], ['z', 'জ'], ['t', 'ট'],
  ['d', 'ড'], ['n', 'ন'], ['p', 'প'], ['f', 'ফ'], ['b', 'ব'],
  ['v', 'ভ'], ['m', 'ম'], ['y', 'য়'], ['r', 'র'], ['l', 'ল'],
  ['w', 'ওয়'], ['s', 'স'], ['h', 'হ'], ['c', 'ক'], ['q', 'ক'], ['x', 'ক্স']
];

const PHONETIC_VOWELS = {
  initial: {
    'aa': 'আ', 'a': 'আ', 'i': 'ই', 'ee': 'ঈ', 'u': 'উ', 'oo': 'উ',
    'e': 'এ', 'ai': 'ঐ', 'oi': 'ঐ', 'o': 'ও', 'ou': 'ঔ', 'au': 'ঔ'
  } as Record<string, string>,
  kar: {
    'aa': 'া', 'a': 'া', 'i': 'ি', 'ee': 'ী', 'u': 'ু', 'oo': 'ূ',
    'e': 'ে', 'ai': 'ৈ', 'oi': 'ৈ', 'o': 'ো', 'ou': 'ৌ', 'au': 'ৌ'
  } as Record<string, string>,
};

/**
 * Phonetically converts a single English word into natural Bengali script
 */
export function phoneticWordToBangla(word: string): string {
  if (!word) return '';
  const lower = word.toLowerCase();
  
  // Direct dictionary check first
  if (WORD_DICTIONARY[lower]) {
    return WORD_DICTIONARY[lower];
  }

  let result = '';
  let i = 0;
  let prevIsConsonant = false;

  while (i < lower.length) {
    // 1. Try vowels
    let matchedVowel: string | null = null;
    for (const v of ['aa', 'ee', 'oo', 'ai', 'oi', 'ou', 'au', 'a', 'i', 'u', 'e', 'o']) {
      if (lower.startsWith(v, i)) {
        matchedVowel = v;
        break;
      }
    }

    if (matchedVowel) {
      if (prevIsConsonant) {
        result += PHONETIC_VOWELS.kar[matchedVowel] || '';
      } else {
        result += PHONETIC_VOWELS.initial[matchedVowel] || '';
      }
      i += matchedVowel.length;
      prevIsConsonant = false;
      continue;
    }

    // 2. Try consonants
    let matchedConsonant: string | null = null;
    for (const [c, bn] of PHONETIC_CONSONANTS) {
      if (lower.startsWith(c, i)) {
        matchedConsonant = bn;
        i += c.length;
        break;
      }
    }

    if (matchedConsonant) {
      result += matchedConsonant;
      prevIsConsonant = true;
      continue;
    }

    // 3. Fallback for non-alphabetic characters
    result += lower[i];
    i++;
    prevIsConsonant = false;
  }

  return result;
}

/**
 * High-Accuracy Translator & Transliteration function:
 * Converts English text (Names, Designations, Organizations, Honors) into proper Bengali.
 */
export function translateEnglishToBangla(text: string, options: { phoneticFallback?: boolean } = {}): string {
  if (!text || !text.trim()) return '';

  let result = text.trim();
  // Expand job-title abbreviations without altering initials in personal names.
  result = result.replace(/\bAsst\.?\s+(?=Manager|General|Director|Secretary)/gi, 'Assistant ');
  result = result.replace(/\bSr\.?\s+(?=Manager|Executive|Officer|Director)/gi, 'Senior ');
  result = result.replace(/\bJr\.?\s+(?=Manager|Executive|Officer)/gi, 'Junior ');
  result = result.replace(/\bHR\b/gi, 'Human Resources');
  result = result.replace(/\bIT\b/g, 'Information Technology');

  // Step 1: Normalize common abbreviations before matching
  result = result.replace(/\(\s*Retd\.?\s*\)/gi, '(অব.)');
  result = result.replace(/\bRetd\b\.?/gi, '(অব.)');
  result = result.replace(/\bRetired\b/gi, '(অব.)');
  result = result.replace(/\(\s*O\s*\)/gi, '(অপারেশনস)');
  result = result.replace(/\(\s*Operations\s*\)/gi, '(অপারেশনস)');
  result = result.replace(/\bGroupNautika\b/gi, 'গ্রুপনটিকা');

  // Step 2: Replace multi-word phrases (longest first)
  const phrases = Object.keys(PHRASE_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+');
    const regex = new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'gi');
    result = result.replace(regex, PHRASE_DICTIONARY[phrase]);
  }

  // Step 3: Replace single words from dictionary (longest first)
  const words = Object.keys(WORD_DICTIONARY).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'gi');
    result = result.replace(regex, WORD_DICTIONARY[word]);
  }

  // Step 4: Transliterate any remaining English words [a-zA-Z]+ to Bengali script
  result = result.replace(/[a-zA-Z]+/g, (match) => {
    return options.phoneticFallback === false ? match : phoneticWordToBangla(match);
  });

  // Step 5: Post-processing and cleanup
  result = result.replace(/জনাব\./g, 'জনাব');
  result = result.replace(/ক্যাপ্টেন\./g, 'ক্যাপ্টেন');
  result = result.replace(/প্রকৌশলী\./g, 'প্রকৌশলী');
  result = result.replace(/মো:\./g, 'মো:');
  result = result.replace(/\.{2,}/g, '.');
  result = result.replace(/:\.+/g, ':');
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

// Backward-compatible alias
export const quickTransliterateEnglishToBangla = translateEnglishToBangla;
