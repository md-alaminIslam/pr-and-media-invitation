import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FolderOpen,
  Cloud,
  CloudOff,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { DocumentData, DocumentType } from './types';
import { emptyUploadWorkspace } from './utils/uploadWorkspace';
import { DOCUMENT_SLOTS } from './utils/templates';
import { normalizeDraft } from './utils/draft';
import { getStudioConfig, studioApi, StudioError, displayName } from './utils/studioServer';
import { FileManager } from './components/FileManager';
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
import { translateGuestField } from './utils/guestTranslation';
import {translateFormField} from './utils/formTranslation';
import { ReferenceModal } from './components/ReferenceModal';

type FormTab = 'guests' | 'datetime' | 'event' | 'highlights' | 'sender' | 'all';

const DRAFT_KEY = 'savor-media-studio-v1';
const LAST_FILE_KEY = 'savor-studio-last-file';
const UNSAVED_KEY = 'savor-studio-unsaved-file';
function loadDraft(): DocumentData {
  try { return normalizeDraft(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')); }
  catch { return emptyUploadWorkspace(); }
}
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
const clock = new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit' });
export default function App() {
  const studio = getStudioConfig();
  const geminiPossible = studio ? studio.gemini : (import.meta.env.VITE_STATIC_PAGES!=='true'||!!import.meta.env.VITE_SUPABASE_URL);
  const [translationProvider,setTranslationProvider]=useState<TranslationProvider>(()=>geminiPossible&&localStorage.getItem('savor-translation-provider')==='gemini'?'gemini':'offline');
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

  // ---- Studio file manager (only when served by the WordPress plugin) ----
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [listVersion] = useState(0);
  const fileRef = useRef<string | null>(null);
  const etagRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);
  const skipSaveRef = useRef<DocumentData | null>(null);
  const latestDataRef = useRef(formData);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  const markDirty = (dirty: boolean) => {
    dirtyRef.current = dirty;
    try {
      if (dirty && fileRef.current) localStorage.setItem(UNSAVED_KEY, fileRef.current);
      else localStorage.removeItem(UNSAVED_KEY);
    } catch {}
  };

  const setOpenFile = (path: string | null, etag: string | null) => {
    fileRef.current = path; etagRef.current = etag; conflictRef.current = false;
    setCurrentFile(path);
    try { path ? localStorage.setItem(LAST_FILE_KEY, path) : localStorage.removeItem(LAST_FILE_KEY); } catch {}
  };

  const loadIntoEditor = (data: DocumentData) => {
    skipSaveRef.current = data;
    latestDataRef.current = data;
    setFormData(data);
    setPreviewData(data);
    setActiveDoc(DOCUMENT_SLOTS.find(s => data.templates?.[s.type])?.type || 'invitation-bn');
  };

  /** Save the open file (queued so saves never overlap). Resolves true when nothing is left unsaved. */
  const saveNow = useCallback((overwrite = false): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const path = fileRef.current;
      if (!studio || !path) return true;
      if (!dirtyRef.current && !overwrite) return true;
      if (conflictRef.current && !overwrite) return false;
      const data = latestDataRef.current;
      markDirty(false);
      setSaveState('saving');
      try {
        const result = await studioApi.save(path, data, overwrite ? null : etagRef.current);
        if (fileRef.current !== path) return true;
        etagRef.current = result.etag; conflictRef.current = false;
        setSavedAt(Date.now()); setSaveError('');
        if (dirtyRef.current) { setSaveState('pending'); return false; }
        setSaveState('saved');
        return true;
      } catch (e: any) {
        if (fileRef.current === path) markDirty(true);
        if (e instanceof StudioError && e.status === 409 && e.code === 'sms_conflict') { conflictRef.current = true; setSaveState('conflict'); }
        else { setSaveState('error'); setSaveError(e?.message || 'সেভ হয়নি।'); }
        return false;
      }
    };
    const next = saveChain.current.then(run, run);
    saveChain.current = next.catch(() => {});
    return next;
  }, [studio]);

  // Autosave the open file shortly after each change.
  useEffect(() => {
    latestDataRef.current = formData;
    if (!studio || !fileRef.current) return;
    if (skipSaveRef.current === formData) return;
    markDirty(true);
    if (conflictRef.current) return;
    setSaveState('pending');
    const timer = setTimeout(() => { void saveNow(); }, 1200);
    return () => clearTimeout(timer);
  }, [formData]);

  const openFile = async (path: string, opts: { reload?: boolean; quiet?: boolean; keepLocal?: boolean } = {}) => {
    if (path === fileRef.current && !opts.reload) { setFileManagerOpen(false); return; }
    if (path !== fileRef.current && !(await saveNow())) {
      showToast('আগের ফাইলটি সেভ হয়নি। আগে সেভ সমস্যা ঠিক করুন।');
      return;
    }
    try {
      const file = await studioApi.read(path);
      setOpenFile(path, file.etag);
      if (opts.keepLocal) {
        // Unsaved edits from the last visit are newer than the file: keep them and save.
        markDirty(true); setSaveState('pending');
        void saveNow();
      } else {
        markDirty(false);
        loadIntoEditor(normalizeDraft(file.content));
        setSaveState('saved'); setSavedAt(file.modified * 1000); setSaveError('');
      }
      setFileManagerOpen(false);
      if (!opts.quiet) showToast(`“${displayName(path)}” খোলা হয়েছে`);
    } catch (e: any) {
      if (opts.quiet) { setOpenFile(null, null); return; }
      showToast(e?.message || 'ফাইল খোলা যায়নি।');
    }
  };

  const createFile = async (path: string, blank: boolean) => {
    if (!(await saveNow())) throw new Error('আগের ফাইলটি সেভ হয়নি। আগে সেভ সমস্যা ঠিক করুন।');
    const data = blank ? emptyUploadWorkspace() : latestDataRef.current;
    const result = await studioApi.save(path, data, null, 'create');
    setOpenFile(path, result.etag); markDirty(false);
    if (blank) loadIntoEditor(data);
    setSaveState('saved'); setSavedAt(Date.now()); setSaveError('');
    setFileManagerOpen(false);
    showToast(blank ? `নতুন ফাইল “${displayName(path)}” তৈরি হয়েছে` : `বর্তমান কাজ “${displayName(path)}” ফাইলে সেভ হয়েছে`);
  };

  const importFile = async (path: string, content: unknown) => {
    if (!(await saveNow())) throw new Error('আগের ফাইলটি সেভ হয়নি। আগে সেভ সমস্যা ঠিক করুন।');
    const data = normalizeDraft(content);
    const result = await studioApi.save(path, data, null, 'create');
    setOpenFile(path, result.etag); markDirty(false);
    loadIntoEditor(data);
    setSaveState('saved'); setSavedAt(Date.now());
    setFileManagerOpen(false);
    showToast(`“${displayName(path)}” ইমপোর্ট হয়েছে`);
  };

  const handleMoved = (from: string, to: string) => {
    const cur = fileRef.current;
    if (!cur) return;
    if (cur === from) setOpenFile(to, etagRef.current);
    else if (cur.startsWith(from + '/')) setOpenFile(to + cur.slice(from.length), etagRef.current);
  };

  const handleDeleted = (path: string) => {
    const cur = fileRef.current;
    if (cur && (cur === path || cur.startsWith(path + '/'))) {
      setOpenFile(null, null); markDirty(false); setSaveState('idle');
      showToast('খোলা ফাইলটি মুছে ফেলা হয়েছে। কাজটি এই ব্রাউজারে থাকছে।');
    }
  };

  const restoreVersion = async (path: string, content: unknown) => {
    if (fileRef.current !== path) await openFile(path, { quiet: true });
    if (fileRef.current !== path) return;
    const data = normalizeDraft(content);
    setFormData(data); setPreviewData(data);
    showToast('আগের ভার্সন ফিরিয়ে আনা হয়েছে এবং সেভ হচ্ছে।');
  };

  // Reopen the last file on load (keeping unsaved edits from the last visit).
  useEffect(() => {
    if (!studio) return;
    let last: string | null = null, unsaved: string | null = null;
    try { last = localStorage.getItem(LAST_FILE_KEY); unsaved = localStorage.getItem(UNSAVED_KEY); } catch {}
    if (last) void openFile(last, { quiet: true, keepLocal: unsaved === last });
  }, []);

  // Ctrl/Cmd+S saves now; warn before leaving with unsaved changes.
  useEffect(() => {
    if (!studio) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (fileRef.current) void saveNow(); else setFileManagerOpen(true); }
    };
    const onLeave = (e: BeforeUnloadEvent) => { if (fileRef.current && dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onLeave); };
  }, [saveNow]);

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

      {studio && (
        <div className="studio-file-bar bg-slate-900 text-slate-100 no-print">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            <button onClick={() => setFileManagerOpen(true)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 font-semibold">
              <FolderOpen className="w-4 h-4 text-amber-300" /> ফাইল ম্যানেজার
            </button>
            {currentFile ? (
              <span className="font-semibold truncate max-w-[50vw]" title={currentFile}>{currentFile.replace(/\.json$/i, '')}</span>
            ) : (
              <>
                <span className="text-amber-200">কোনো ফাইল খোলা নেই — কাজটি শুধু এই ব্রাউজারে সেভ হচ্ছে।</span>
                <button onClick={() => setFileManagerOpen(true)} className="underline font-semibold">ফাইলে সেভ করুন</button>
              </>
            )}
            {currentFile && (
              <span role="status" aria-live="polite" className="flex items-center gap-1.5 ml-auto">
                {saveState === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> সেভ হচ্ছে…</>}
                {saveState === 'pending' && <><Cloud className="w-3.5 h-3.5 text-slate-400" /> পরিবর্তন সেভ হবে…</>}
                {saveState === 'saved' && <><Cloud className="w-3.5 h-3.5 text-emerald-400" /> সেভ হয়েছে{savedAt ? ` · ${clock.format(new Date(savedAt))}` : ''}</>}
                {saveState === 'error' && <><CloudOff className="w-3.5 h-3.5 text-red-400" /> <span className="text-red-200">সেভ হয়নি: {saveError}</span> <button onClick={() => void saveNow()} className="underline font-semibold">আবার চেষ্টা</button></>}
                {saveState === 'conflict' && <><AlertTriangle className="w-3.5 h-3.5 text-amber-300" /> <span className="text-amber-200">ফাইলটি অন্য কোথাও থেকে বদলানো হয়েছে।</span>
                  <button onClick={() => void openFile(currentFile, { reload: true })} className="underline font-semibold">সার্ভারের ভার্সন খুলুন</button>
                  <button onClick={() => void saveNow(true)} className="underline font-semibold">আমার পরিবর্তন রাখুন</button></>}
              </span>
            )}
          </div>
        </div>
      )}
      {studio && (
        <FileManager
          open={fileManagerOpen}
          onClose={() => setFileManagerOpen(false)}
          currentPath={currentFile}
          refreshToken={listVersion}
          onOpenFile={path => void openFile(path)}
          onCreate={createFile}
          onImport={importFile}
          onMoved={handleMoved}
          onDeleted={handleDeleted}
          onRestoreVersion={(path, content) => void restoreVersion(path, content)}
        />
      )}

      <section className="workspace-intro max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2 no-print">
        <div><p className="eyebrow">SAVOR INTERNATIONAL LIMITED · COMMUNICATIONS</p>
        <h2 className="text-3xl font-bold tracking-tight mt-2">আপনার আয়োজন, পেশাদার বার্তায়।</h2>
        <p className="text-sm text-slate-500 mt-2">তথ্য দিন, দুই ভাষায় প্রিভিউ দেখুন এবং প্রকাশের জন্য ডাউনলোড করুন।</p></div>
        <div className="draft-actions"><span className="text-xs text-emerald-700">{studio && currentFile ? '● ফাইলে অটো সেভ' : '● ব্রাউজারে অটো সেভ'}</span><button onClick={exportDraft} className="draft-button">ড্রাফট ব্যাকআপ</button></div>
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
