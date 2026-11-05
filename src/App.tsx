import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Calendar,
  Building2,
  ListChecks,
  Send,
  Sparkles,
  CheckCircle,
  FileCheck2,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { DocumentData, DocumentType } from './types';
import { blankPreset } from './utils/presets';
import { emptyUploadWorkspace, submitUploadedFiles } from './utils/uploadWorkspace';
import { renderTemplate, DOCUMENT_SLOTS } from './utils/templates';
import {TranslationSettings,TranslationProvider} from './components/TranslationSettings';
import {TranslationModeContext} from './components/TranslationModeContext';
import {retainBanglaUntilReview} from './utils/translationEntries';
import { TemplateUploads } from './components/TemplateUploads';
import { Header } from './components/Header';
import { GuestEditor } from './components/GuestEditor';
import { DateTimeEditor } from './components/DateTimeEditor';
import { EventDetailsEditor } from './components/EventDetailsEditor';
import { HighlightsEditor } from './components/HighlightsEditor';
import { SenderEditor } from './components/SenderEditor';
import { DocumentPreview } from './components/DocumentPreview';
import { translateEnglishToBangla } from './utils/transliteration';
import { translateGuestField } from './utils/guestTranslation';
import {translateFormField} from './utils/formTranslation';
import { ReferenceModal } from './components/ReferenceModal';

type FormTab = 'guests' | 'datetime' | 'event' | 'highlights' | 'sender' | 'all';

const DRAFT_KEY = 'savor-media-studio-v1';
function loadDraft(): DocumentData {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (saved && saved.uploadsOnly !== true) {
      const files: any = {};
      for (const {type} of DOCUMENT_SLOTS) {
        if (saved.templates?.[type]?.text) files[type] = {...saved.templates[type], text:renderTemplate(saved,type)};
      }
      return Object.keys(files).length ? submitUploadedFiles(files) : emptyUploadWorkspace();
    }
    if (saved) {
      for (const guest of [saved.chiefGuest, ...(Array.isArray(saved.specialGuests) ? saved.specialGuests : [])]) {
        if (!guest) continue;
        for (const field of ['honorsBn','designationBn']) {
          if (typeof guest[field] === 'string') {
            const enField = field.replace(/Bn$/, 'En') as 'honorsEn' | 'designationEn';
            const english = guest[enField];
            if (typeof english === 'string' && english && guest[field] === translateEnglishToBangla(english)) guest[field] = translateGuestField(english,enField,saved.translationCorrections);
            guest[field] = guest[field].replace(/ডিগিটাল মারকেটিঙ/g, 'ডিজিটাল মার্কেটিং').replace(/সোফটওয়ারে ডেভেলোপের/g, 'সফটওয়্যার ডেভেলপার');
          }
        }
      }
    }
    if (saved && typeof saved.eventTitleEn === 'string' && saved.chiefGuest && saved.sender && Array.isArray(saved.specialGuests) && Array.isArray(saved.highlights)) return { ...blankPreset, ...saved };
  } catch {}
  return emptyUploadWorkspace();
}
export default function App() {
  const [translationProvider,setTranslationProvider]=useState<TranslationProvider>(()=>(import.meta.env.VITE_STATIC_PAGES!=='true'||!!import.meta.env.VITE_SUPABASE_URL)&&localStorage.getItem('savor-translation-provider')==='gemini'?'gemini':'offline');
  const [translationRequest,setTranslationRequest]=useState(0);
  const requestGeminiTranslation=()=>{setTranslationRequest(v=>v+1);document.getElementById('translation-settings')?.scrollIntoView({behavior:'smooth',block:'start'});};
  // Working draft form state
  const [formData, setFormData] = useState<DocumentData>(loadDraft);

  // Preview state (updated either in real-time or when user clicks submit button)
  const [previewData, setPreviewData] = useState<DocumentData>(loadDraft);

  const [activeTab, setActiveTab] = useState<FormTab>('guests');
  const [activeDoc, setActiveDoc] = useState<DocumentType>(() => DOCUMENT_SLOTS.find(s=>formData.templates?.[s.type])?.type || 'invitation-bn');
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [isAiSyncing, setIsAiSyncing] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [autoSyncPreview, setAutoSyncPreview] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Form change handler
  const handleFormChange = (incoming: DocumentData) => {
    const newData=translationProvider==='gemini'?retainBanglaUntilReview(formData,incoming):incoming;
    setFormData(newData);
    if (autoSyncPreview || newData.chiefGuest !== formData.chiefGuest || newData.specialGuests !== formData.specialGuests || newData.templates !== formData.templates) {
      setPreviewData(newData);
    }
  };

  // Explicit Submit / Update Button
  const handleManualSubmit = () => {
    setPreviewData(formData);
    setJustUpdated(true);
    showToast('প্রিভিউতে নতুন তথ্য আপডেট হয়েছে!');
    setTimeout(() => setJustUpdated(false), 2000);
  };

  // Load preset
  const handleSelectPreset = (preset: DocumentData) => {
    const next = emptyUploadWorkspace();
    setFormData(next);
    setPreviewData(next);
    showToast('নতুন ফাঁকা কাজ শুরু হয়েছে');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); }
      catch { showToast('ড্রাফট সেভ হয়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করুন।'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData]);

  const handleAiSync = async () => {
    if(translationProvider==='gemini'){requestGeminiTranslation();return;}
    setIsAiSyncing(true);
    const fill = (value: any, path = ''): any => {
      if (Array.isArray(value)) return value.map(item=>fill(item,path==='highlights.'?'highlight.':path));
      if (!value || typeof value !== 'object') return value;
      const next = { ...value };
      for (const key of Object.keys(next)) {
        if (key.endsWith('En') && typeof next[key] === 'string') {
          const bn = key.slice(0, -2) + 'Bn';
          if (bn in next && !next[bn].trim() && next[key].trim()) next[bn] = path !== 'sender.' && ['nameEn','honorsEn','designationEn'].includes(key) ? translateGuestField(next[key], key as 'nameEn' | 'honorsEn' | 'designationEn', formData.translationCorrections) : translateFormField(next[key],path+key,formData.translationCorrections);
        } else if (typeof next[key] === 'object' && key !== 'templates' && key !== 'translationCorrections') next[key] = fill(next[key],path+key+'.');
      }
      return next;
    };
    const updated = fill(formData);
    setFormData(updated); setPreviewData(updated);
    showToast('ফাঁকা বাংলা ফিল্ড পূরণ হয়েছে। প্রকাশের আগে বানান যাচাই করুন।');
    setIsAiSyncing(false);
  };

  const exportDraft = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(formData, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'savor-media-draft.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleApplyReferenceData = (extractedData: DocumentData) => {
    const next = {...extractedData, translationCorrections: {...formData.translationCorrections, ...extractedData.translationCorrections}};
    setFormData(next);
    setPreviewData(next);
    showToast('রেফারেন্স তথ্য সফলভাবে প্রয়োগ করা হয়েছে!');
  };

  return (
    <TranslationModeContext.Provider value={translationProvider}><div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Header */}
      <Header
        onSelectPreset={handleSelectPreset}
        onOpenReferenceModal={() => setIsReferenceModalOpen(true)}
        onAiSync={handleAiSync}
        isAiSyncing={isAiSyncing}
      />

      <section className="workspace-intro max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2 no-print">
        <div><p className="eyebrow">SAVOR INTERNATIONAL LIMITED · COMMUNICATIONS</p>
        <h2 className="text-3xl font-bold tracking-tight mt-2">আপনার আয়োজন, পেশাদার বার্তায়।</h2>
        <p className="text-sm text-slate-500 mt-2">তথ্য দিন, দুই ভাষায় প্রিভিউ দেখুন এবং প্রকাশের জন্য ডাউনলোড করুন।</p></div>
        <div className="draft-actions"><span className="text-xs text-emerald-700">● ব্রাউজারে অটো সেভ</span><button onClick={exportDraft} className="draft-button">ড্রাফট ব্যাকআপ</button></div>
      </section>
      {/* Main Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div id="translation-settings"><TranslationSettings provider={translationProvider} onProviderChange={p=>{setTranslationProvider(p);localStorage.setItem('savor-translation-provider',p);}} requestVersion={translationRequest} data={formData} onChange={next=>{setFormData(next);setPreviewData(next);}}/></div>
        <TemplateUploads data={formData} onChange={(next) => { setFormData(next); setPreviewData(next); }} onSelect={setActiveDoc} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form Editor (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Form Nav Tabs */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('guests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'guests'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                অতিথিবৃন্দ
              </button>

              <button
                onClick={() => setActiveTab('datetime')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'datetime'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                তারিখ ও সময়
              </button>

              <button
                onClick={() => setActiveTab('event')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'event'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                ভেন্যু ও অনুষ্ঠান
              </button>

              <button
                onClick={() => setActiveTab('highlights')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'highlights'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                মূল আকর্ষণ
              </button>

              <button
                onClick={() => setActiveTab('sender')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'sender'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                প্রেরক
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                সব ফিল্ড
              </button>
            </div>

            {/* Active Form Section */}
            <div className="space-y-4 lg:max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {(activeTab === 'guests' || activeTab === 'all') && (
                <GuestEditor onTranslateRequested={translationProvider==='gemini'?requestGeminiTranslation:undefined} data={formData} onChange={handleFormChange} />
              )}
              {(activeTab === 'datetime' || activeTab === 'all') && (
                <DateTimeEditor data={formData} onChange={handleFormChange} />
              )}
              {(activeTab === 'event' || activeTab === 'all') && (
                <EventDetailsEditor data={formData} onChange={handleFormChange} />
              )}
              {(activeTab === 'highlights' || activeTab === 'all') && (
                <HighlightsEditor data={formData} onChange={handleFormChange} />
              )}
              {(activeTab === 'sender' || activeTab === 'all') && (
                <SenderEditor data={formData} onChange={handleFormChange} />
              )}
            </div>

            <p role="status" className="text-xs text-teal-700 px-1">অতিথির নাম, পদবী ও তালিকা বদলালে চারটি ডকুমেন্টের প্রিভিউ সঙ্গে সঙ্গে আপডেট হয়।</p>
            {/* Prominent Submit / Update Button */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { if (!autoSyncPreview) setPreviewData(formData); setAutoSyncPreview(!autoSyncPreview); }}
                  className={`text-xs font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    autoSyncPreview
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                  title="টাইপ করার সাথে সাথে প্রিভিউ আপডেট হবে"
                >
                  <Zap className={`w-3.5 h-3.5 ${autoSyncPreview ? 'text-emerald-500 fill-emerald-500' : ''}`} />
                  {autoSyncPreview ? 'লাইভ সিঙ্ক চালু' : 'লাইভ সিঙ্ক বন্ধ'}
                </button>
              </div>

              <button
                onClick={handleManualSubmit}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                  justUpdated
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {justUpdated ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    প্রিভিউ আপডেট হয়েছে!
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    তথ্য অনুযায়ী প্রিভিউ আপডেট
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Document Preview (7 cols on lg) */}
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <DocumentPreview
              data={previewData}
              activeDoc={activeDoc}
              onDocChange={setActiveDoc}
            />
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center gap-2 animate-bounce-once">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Reference Import Modal */}
      <ReferenceModal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        onApplyData={handleApplyReferenceData}
      />
    </div></TranslationModeContext.Provider>
  );
}
