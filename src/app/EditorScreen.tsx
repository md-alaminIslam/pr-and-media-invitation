import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Cloud, CloudOff, Code2, Copy, Download, Eye, EyeOff, FileCode2, FileDown, FilePlus2, FileText,
  FileType2, History, Languages, Loader2, MoreHorizontal, PanelRight, Pencil, Plus, Printer, RotateCcw, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { Store } from '../editor/store';
import { DocModel, FONTS, parseDoc, serializeDoc } from '../editor/doc';
import { FIELD_BY_KEY, FIELDS, collectFieldValues, isPlaceholder, writeField, writeFieldInDom } from '../editor/fields';
import { ACCEPTED_UPLOADS, fileToDoc } from '../editor/importers';
import { docOrder, shortDocLabel } from '../editor/templates';
import { copyText, downloadDocx, downloadHtml, downloadPdf, ensureDocFonts, printDoc } from '../editor/export';
import { geminiAvailable, getPasscode, passcodeRequired, setPasscode, translateBody, translateFields, translateFragment } from '../editor/translate';
import { MARGIN_PRESETS, MARGIN_SIDES, clampMargin } from '../utils/pageMargins';
import { StudioError, StudioVersion } from '../utils/studioServer';
import { Badge, Button, Dialog, IconButton, Input, Label, Menu, MenuItem, Segmented, Select, Spinner, cn, relativeTime, useConfirm, useToast } from '../ui/ui';
import { EMPTY_STATE, EditorApi, ToolbarState, VisualEditor } from './VisualEditor';
import { Toolbar } from './Toolbar';
import { FieldsPanel, offlineBangla } from './FieldsPanel';
import { Logo, RenameDialog } from './HomeScreen';
import { blankDoc, uniqueName } from './projects';

type Status = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
interface OpenDoc { file: string; model: DocModel; etag: string | null; dirty: boolean; status: Status; error?: string; savedAt?: number }

const prettyHtml = (html: string) => html
  .replace(/>\s*(<(?:p|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|hr|div|figure|pre)\b)/g, '>\n$1')
  .replace(/(<\/(?:p|h[1-6]|ul|ol|table|thead|tbody|tr|blockquote|div|figure|pre)>)(?!\n)/g, '$1\n');

export function EditorScreen({ store, project, file, onNavigate, onClose }: { store: Store; project: string; file?: string; onNavigate: (file: string) => void; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [docs, setDocs] = useState<OpenDoc[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const docsRef = useRef<OpenDoc[]>([]);
  docsRef.current = docs || [];
  const active = useMemo(() => (docs || []).find(d => d.file === file) || (docs || [])[0], [docs, file]);
  const activeFile = active?.file;
  const editor = useRef<EditorApi>(null);
  const [tbState, setTbState] = useState<ToolbarState>(EMPTY_STATE);
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [code, setCode] = useState('');
  const [codeDirty, setCodeDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const [panel, setPanel] = useState<'fields' | 'page' | 'history' | null>(() => (window.innerWidth >= 1180 ? 'fields' : null));
  const [showFields, setShowFields] = useState(true);
  const [zoomPref, setZoomPref] = useState<'fit' | number>('fit');
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<string | null>(null);
  const [renameProject, setRenameProject] = useState(false);
  const [passOpen, setPassOpen] = useState<null | (() => void)>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadMode = useRef<{ kind: 'add' } | { kind: 'replace'; file: string }>({ kind: 'add' });
  const timers = useRef<Record<string, number>>({});
  const gemini = geminiAvailable();

  const pathOf = (f: string) => `${project}/${f}`;

  /* ---------- Load ---------- */
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const items = await store.list();
      const files = items.filter(i => i.type === 'file' && i.path.startsWith(project + '/') && !i.path.slice(project.length + 1).includes('/')).map(i => i.path.slice(project.length + 1));
      if (!items.some(i => i.type === 'folder' && i.path === project)) throw new StudioError('This project no longer exists.', 404);
      const loaded = await Promise.all(files.map(async f => {
        const r = await store.read(pathOf(f));
        return { file: f, model: parseDoc(r.content, f.replace(/\.html$/i, '')), etag: r.etag, dirty: false, status: 'saved' as Status, savedAt: r.modified * 1000 };
      }));
      loaded.sort((a, b) => docOrder(a.file) - docOrder(b.file) || a.file.localeCompare(b.file));
      setDocs(loaded);
    } catch (e: any) { setLoadError(e?.message || 'Could not open this project.'); setDocs([]); }
  }, [project, store]);
  useEffect(() => { ensureDocFonts(); void load(); }, [load]);

  /* ---------- Saving ---------- */
  const patch = (f: string, fn: (d: OpenDoc) => OpenDoc) => setDocs(prev => prev && prev.map(d => (d.file === f ? fn(d) : d)));
  const updateModel = (f: string, fn: (m: DocModel) => DocModel) => patch(f, d => {
    const model = fn(d.model);
    return model === d.model ? d : { ...d, model, dirty: true, status: d.status === 'conflict' ? 'conflict' : 'pending' };
  });

  const save = useCallback(async (f: string, overwrite = false): Promise<boolean> => {
    const d = docsRef.current.find(x => x.file === f);
    if (!d || (!d.dirty && !overwrite) || d.status === 'saving' || (d.status === 'conflict' && !overwrite)) return !d || !d.dirty;
    const model = d.model;
    patch(f, x => ({ ...x, dirty: false, status: 'saving' }));
    try {
      const r = await store.save(pathOf(f), serializeDoc(model), overwrite ? null : d.etag);
      patch(f, x => ({ ...x, etag: r.etag, savedAt: Date.now(), status: x.dirty ? 'pending' : 'saved', error: undefined }));
      return true;
    } catch (e: any) {
      const conflict = e instanceof StudioError && e.status === 409 && e.code === 'sms_conflict';
      patch(f, x => ({ ...x, dirty: true, status: conflict ? 'conflict' : 'error', error: e?.message }));
      return false;
    }
  }, [project, store]);

  // Autosave each changed document ~1s after the last edit.
  useEffect(() => {
    for (const d of docs || []) {
      if (d.dirty && d.status === 'pending') {
        window.clearTimeout(timers.current[d.file]);
        timers.current[d.file] = window.setTimeout(() => void save(d.file), 1000);
      }
    }
  }, [docs, save]);

  const flushEditor = () => {
    if (mode === 'visual' && activeFile && editor.current) {
      const body = editor.current.getBody();
      updateModel(activeFile, m => (m.body === body ? m : { ...m, body }));
    }
  };

  const saveAll = async () => {
    flushEditor();
    await new Promise(r => setTimeout(r, 0));
    const results = await Promise.all(docsRef.current.filter(d => d.dirty).map(d => save(d.file)));
    if (results.every(Boolean)) toast('All changes saved');
  };

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => { if (docsRef.current.some(d => d.dirty || d.status === 'saving')) { e.preventDefault(); e.returnValue = ''; } };
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveAll(); } };
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('beforeunload', onLeave); window.removeEventListener('keydown', onKey); };
  });

  /* ---------- Canvas size / zoom ---------- */
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setCanvasWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [docs !== null]);
  const zoom = zoomPref === 'fit' ? Math.max(0.4, Math.min(1.25, (canvasWidth - 64) / 794)) : zoomPref;

  /* ---------- Switching ---------- */
  const switchTo = (f: string) => {
    if (f === activeFile) return;
    if (mode === 'code') applyCode();
    else flushEditor();
    onNavigate(f);
  };

  /* ---------- Fields ---------- */
  const values = useMemo(() => collectFieldValues((docs || []).map(d => ({ lang: d.model.lang, body: d.model.body }))), [docs]);
  const usage = useMemo(() => {
    const u: Record<string, number> = {};
    for (const d of docs || []) for (const def of FIELDS) if (d.model.body.includes(`data-field="${def.key}"`)) u[def.key] = (u[def.key] || 0) + 1;
    return u;
  }, [docs]);

  const setField = (key: string, lang: 'en' | 'bn', text: string) => {
    const def = FIELD_BY_KEY.get(key);
    for (const d of docsRef.current) {
      if (!def?.shared && d.model.lang !== lang) continue;
      if (d.file === activeFile && mode === 'visual' && editor.current?.root()) {
        if (writeFieldInDom(editor.current.root()!, key, text)) {
          const body = editor.current.getBody();
          updateModel(d.file, m => ({ ...m, body }));
        }
      } else {
        updateModel(d.file, m => { const body = writeField(m.body, key, text); return body === m.body ? m : { ...m, body }; });
      }
    }
  };

  const fillOffline = () => {
    let n = 0;
    for (const def of FIELDS) {
      if (def.shared || !usage[def.key]) continue;
      const v = values[def.key];
      if (!v?.en || isPlaceholder(v.en) || (v.bn && !isPlaceholder(v.bn))) continue;
      const bn = offlineBangla(def, v.en);
      if (bn) { setField(def.key, 'bn', bn); n++; }
    }
    toast(n ? `Filled ${n} Bangla field${n > 1 ? 's' : ''}` : 'No empty Bangla fields to fill', { tone: n ? 'success' : 'info', description: n ? 'Check names and spellings before publishing.' : undefined });
  };

  const withPasscode = (run: () => void) => {
    if (passcodeRequired() && !getPasscode()) setPassOpen(() => run);
    else run();
  };

  const geminiError = (e: any) => {
    if (e instanceof StudioError && e.status === 401) { setPasscode(''); toast('Gemini passcode is incorrect', { tone: 'error' }); return; }
    toast('Gemini translation failed', { tone: 'error', description: e?.message });
  };

  const fillGemini = () => withPasscode(async () => {
    const items = FIELDS.filter(def => !def.shared && usage[def.key] && values[def.key]?.en && !isPlaceholder(values[def.key].en))
      .map(def => ({ id: def.key, text: values[def.key].en }));
    if (!items.length) { toast('Fill in the English fields first', { tone: 'info' }); return; }
    setBusy('fields');
    try {
      const result = await translateFields(items);
      for (const [key, text] of Object.entries(result)) setField(key, 'bn', text);
      toast(`Gemini translated ${Object.keys(result).length} fields`, { description: 'Review names and designations before publishing.' });
    } catch (e) { geminiError(e); } finally { setBusy(null); }
  });

  /* ---------- Code view ---------- */
  const enterCode = () => {
    if (!active) return;
    const body = editor.current?.getBody() ?? active.model.body;
    const model = { ...active.model, body };
    updateModel(active.file, m => (m.body === body ? m : { ...m, body }));
    setCode(serializeDoc({ ...model, body: prettyHtml(body) }));
    setCodeDirty(false);
    setMode('code');
  };
  const applyCode = () => {
    if (!active || !codeDirty) return;
    const parsed = parseDoc(code, active.model.title);
    updateModel(active.file, () => parsed);
    setCodeDirty(false);
    setReload(r => r + 1);
  };
  const changeMode = (m: 'visual' | 'code') => {
    if (m === mode) return;
    if (m === 'code') enterCode(); else { applyCode(); setMode('visual'); }
  };

  /* ---------- Documents ---------- */
  const replaceActiveModel = (f: string, model: DocModel) => {
    updateModel(f, () => model);
    if (f === activeFile) setReload(r => r + 1);
  };

  const onUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    const target = uploadMode.current;
    setBusy('upload');
    try {
      if (target.kind === 'replace') {
        const model = await fileToDoc(list[0]);
        replaceActiveModel(target.file, model);
        toast(`Replaced with “${list[0].name}”`);
      } else {
        let first = '';
        for (const f of Array.from(list)) {
          const model = await fileToDoc(f);
          const name = uniqueName(f.name.replace(/\.[^.]+$/, ''), docsRef.current.map(d => d.file.replace(/\.html$/i, '')), '.html');
          const r = await store.save(pathOf(name), serializeDoc(model), null, 'create');
          setDocs(prev => [...(prev || []), { file: name, model, etag: r.etag, dirty: false, status: 'saved', savedAt: Date.now() }]);
          first ||= name;
        }
        if (first) { flushEditor(); onNavigate(first); }
        toast(list.length > 1 ? `Added ${list.length} documents` : `Added “${list[0].name}”`);
      }
    } catch (e: any) { toast('Upload failed', { tone: 'error', description: e?.message }); }
    finally { setBusy(null); }
  };

  const addBlank = async (lang: 'bn' | 'en') => {
    const name = uniqueName(lang === 'bn' ? 'নতুন ডকুমেন্ট' : 'New document', docsRef.current.map(d => d.file.replace(/\.html$/i, '')), '.html');
    const model = blankDoc(lang);
    try {
      const r = await store.save(pathOf(name), serializeDoc(model), null, 'create');
      setDocs(prev => [...(prev || []), { file: name, model, etag: r.etag, dirty: false, status: 'saved', savedAt: Date.now() }]);
      flushEditor(); onNavigate(name);
    } catch (e: any) { toast('Could not add document', { tone: 'error', description: e?.message }); }
  };

  const deleteDoc = async (f: string) => {
    if (!(await confirm({ title: `Delete “${f.replace(/\.html$/i, '')}”?`, description: store.kind === 'server' ? 'It moves to the server trash for 30 days.' : 'It will be removed from this browser.', confirm: 'Delete', danger: true }))) return;
    try {
      window.clearTimeout(timers.current[f]);
      await store.remove(pathOf(f));
      const rest = docsRef.current.filter(d => d.file !== f);
      setDocs(rest);
      if (f === activeFile && rest[0]) onNavigate(rest[0].file);
      toast('Document deleted');
    } catch (e: any) { toast('Could not delete', { tone: 'error', description: e?.message }); }
  };

  /* ---------- Gemini document translation ---------- */
  const translateSelection = () => withPasscode(async () => {
    const html = editor.current?.getSelectionHtml();
    if (!html) { toast('Select some text first', { tone: 'info' }); return; }
    setBusy('translate');
    try { editor.current?.replaceSelection(await translateFragment(html)); toast('Selection translated to Bangla'); }
    catch (e) { geminiError(e); } finally { setBusy(null); }
  });

  const makeBangla = () => withPasscode(async () => {
    if (!active) return;
    flushEditor();
    const source = docsRef.current.find(d => d.file === active.file)!;
    const targetName = /\(English\)\.html$/i.test(source.file) ? source.file.replace(/\(English\)\.html$/i, '(Bangla).html') : source.file.replace(/\.html$/i, '') + ' (Bangla).html';
    const existing = docsRef.current.find(d => d.file === targetName);
    if (existing && !(await confirm({ title: `Replace “${targetName.replace(/\.html$/i, '')}”?`, description: 'Its current content will be replaced by the Gemini translation. The previous version stays in History.', confirm: 'Translate and replace' }))) return;
    setBusy('translate');
    try {
      let progress = '';
      const body = await translateBody(source.model.body, (done, total) => { progress = `${done}/${total}`; setBusy('translate:' + progress); });
      const model: DocModel = { ...source.model, body, lang: 'bn', title: existing?.model.title || source.model.title, font: existing?.model.font || FONTS[0].value };
      if (existing) {
        replaceActiveModel(existing.file, model);
      } else {
        const r = await store.save(pathOf(targetName), serializeDoc(model), null, 'create');
        setDocs(prev => [...(prev || []), { file: targetName, model, etag: r.etag, dirty: false, status: 'saved', savedAt: Date.now() }]);
      }
      onNavigate(targetName);
      if (existing) setReload(r => r + 1);
      toast('Bangla version ready', { description: 'Review it carefully — especially names and designations.' });
    } catch (e) { geminiError(e); } finally { setBusy(null); }
  });

  /* ---------- Versions ---------- */
  const [versions, setVersions] = useState<StudioVersion[] | null>(null);
  useEffect(() => {
    if (panel !== 'history' || !activeFile) return;
    setVersions(null);
    store.versions(pathOf(activeFile)).then(setVersions).catch(() => setVersions([]));
  }, [panel, activeFile]);
  const restoreVersion = async (id: string) => {
    if (!activeFile) return;
    if (!(await confirm({ title: 'Restore this version?', description: 'The current content is kept as a version too, so you can switch back.', confirm: 'Restore' }))) return;
    try {
      const content = await store.version(pathOf(activeFile), id);
      replaceActiveModel(activeFile, parseDoc(content, active!.model.title));
      toast('Version restored');
    } catch (e: any) { toast('Could not restore', { tone: 'error', description: e?.message }); }
  };

  /* ---------- Export ---------- */
  const currentModel = (): DocModel | null => {
    if (!active) return null;
    if (mode === 'code') { try { return parseDoc(code, active.model.title); } catch { return active.model; } }
    return { ...active.model, body: editor.current?.getBody() ?? active.model.body };
  };
  const runExport = async (kind: 'html' | 'docx' | 'pdf' | 'print' | 'copy') => {
    const m = currentModel(); if (!m) return;
    setBusy('export');
    try {
      if (kind === 'html') downloadHtml(m);
      else if (kind === 'docx') await downloadDocx(m);
      else if (kind === 'pdf') await downloadPdf(m);
      else if (kind === 'print') await printDoc(m);
      else { await copyText(serializeDoc(m)); toast('HTML copied to clipboard'); }
    } catch (e: any) { toast('Export failed', { tone: 'error', description: e?.message }); }
    finally { setBusy(null); }
  };

  /* ---------- Status ---------- */
  const all = docs || [];
  const conflict = all.find(d => d.status === 'conflict');
  const errored = all.find(d => d.status === 'error');
  const saving = all.some(d => d.status === 'saving');
  const pending = all.some(d => d.status === 'pending');
  const lastSaved = Math.max(0, ...all.map(d => d.savedAt || 0));

  const statusEl = conflict ? (
    <span className="flex items-center gap-1.5 text-[13px] text-amber-700"><AlertTriangle className="size-4" />Changed elsewhere
      <Menu width="w-64" items={[
        { label: 'Load the other version', icon: <RotateCcw />, onSelect: async () => { const r = await store.read(pathOf(conflict.file)); patch(conflict.file, d => ({ ...d, model: parseDoc(r.content, d.model.title), etag: r.etag, dirty: false, status: 'saved' })); if (conflict.file === activeFile) setReload(x => x + 1); } },
        { label: 'Keep mine (overwrite)', icon: <Check />, onSelect: () => void save(conflict.file, true) },
      ]} trigger={p => <Button size="sm" variant="ghost" {...p}>Resolve<ChevronDown className="size-3.5" /></Button>} />
    </span>
  ) : errored ? (
    <span className="flex items-center gap-1.5 text-[13px] text-red-600" title={errored.error}><CloudOff className="size-4" />Not saved<Button size="sm" variant="ghost" onClick={() => void save(errored.file)}>Retry</Button></span>
  ) : saving ? <span className="flex items-center gap-1.5 text-[13px] text-zinc-500"><Loader2 className="size-4 animate-spin" />Saving…</span>
    : pending ? <span className="flex items-center gap-1.5 text-[13px] text-zinc-500"><Cloud className="size-4" />Unsaved changes</span>
      : <span className="flex items-center gap-1.5 text-[13px] text-zinc-500" title={lastSaved ? new Date(lastSaved).toLocaleString() : ''}><Cloud className="size-4 text-emerald-600" />Saved{lastSaved ? <span className="hidden text-zinc-400 md:inline">· {relativeTime(lastSaved / 1000)}</span> : null}</span>;

  const translateItems: MenuItem[] = [
    { label: 'Gemini (English → Bangla)', heading: true },
    { label: 'Translate selection', icon: <Languages />, disabled: !gemini || !tbState.hasSelection || mode !== 'visual', onSelect: translateSelection, hint: !gemini ? 'Off' : undefined },
    { label: active && /\(Bangla\)/i.test(active.file) ? 'Make Bangla version (from this doc)' : 'Make Bangla version of this doc', icon: <Sparkles />, disabled: !gemini || !active, onSelect: makeBangla },
    { label: 'Translate fields', icon: <Sparkles />, disabled: !gemini, onSelect: fillGemini },
    { separator: true, label: '' },
    { label: 'Offline', heading: true },
    { label: 'Fill empty Bangla fields', icon: <Languages />, onSelect: fillOffline },
    ...(!gemini ? [{ separator: true, label: '' }, { label: 'Gemini: add an API key in WordPress → Settings → Media Studio', disabled: true }] as MenuItem[] : []),
  ];

  const exportItems: MenuItem[] = [
    { label: 'Download PDF', icon: <FileDown />, onSelect: () => void runExport('pdf') },
    { label: 'Download Word (.docx)', icon: <FileType2 />, onSelect: () => void runExport('docx') },
    { label: 'Download HTML', icon: <FileCode2 />, onSelect: () => void runExport('html') },
    { separator: true, label: '' },
    { label: 'Print / Save as PDF', icon: <Printer />, hint: 'best quality', onSelect: () => void runExport('print') },
    { label: 'Copy HTML code', icon: <Copy />, onSelect: () => void runExport('copy') },
  ];

  /* ---------- Render ---------- */
  if (docs === null) return <div className="flex h-full items-center justify-center"><Spinner className="size-6" /></div>;

  return (
    <div className="flex h-full flex-col bg-zinc-100">
      {/* App bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3">
        <IconButton label="All projects" onClick={async () => { flushEditor(); if (mode === 'code') applyCode(); await new Promise(r => setTimeout(r, 0)); await Promise.all(docsRef.current.filter(d => d.dirty).map(d => save(d.file))); onClose(); }}><ArrowLeft className="size-4" /></IconButton>
        <div className="hidden sm:block"><Logo compact /></div>
        <div className="min-w-0">
          <Menu width="w-52" items={[
            { label: 'Rename project', icon: <Pencil />, onSelect: () => setRenameProject(true) },
            { label: 'Save all now', icon: <Check />, hint: 'Ctrl+S', onSelect: () => void saveAll() },
          ]} trigger={p => (
            <button {...p} className="flex max-w-[30vw] items-center gap-1 rounded-md px-2 py-1 text-[15px] font-semibold text-zinc-900 hover:bg-zinc-100">
              <span className="truncate">{project}</span><ChevronDown className="size-4 shrink-0 text-zinc-400" />
            </button>
          )} />
        </div>
        <div className="ml-1 hidden md:block">{statusEl}</div>
        <div className="ml-auto flex items-center gap-1.5">
          {busy?.startsWith('translate') && <Badge tone="indigo"><Loader2 className="size-3 animate-spin" />Translating {busy.split(':')[1] || ''}</Badge>}
          <Segmented label="Editor mode" value={mode} onChange={changeMode} options={[
            { value: 'visual', label: <><Pencil className="size-3.5" /><span className="hidden lg:inline">Visual</span></>, title: 'Visual editor' },
            { value: 'code', label: <><Code2 className="size-3.5" /><span className="hidden lg:inline">HTML</span></>, title: 'Edit HTML code' },
          ]} />
          <Menu align="end" width="w-72" items={translateItems} trigger={p => <Button size="sm" variant="outline" {...p}><Languages className="size-4" /><span className="hidden lg:inline">Translate</span><ChevronDown className="size-3.5 text-zinc-400" /></Button>} />
          <Menu align="end" width="w-60" items={exportItems} trigger={p => <Button size="sm" variant="primary" loading={busy === 'export'} {...p}><Download className="size-4" /><span className="hidden sm:inline">Export</span></Button>} />
          <IconButton label={panel ? 'Hide side panel' : 'Show side panel'} active={!!panel} onClick={() => setPanel(p => (p ? null : 'fields'))}><PanelRight className="size-4" /></IconButton>
        </div>
      </header>

      {/* Document tabs */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-zinc-200 bg-zinc-50/80 px-3">
        <nav role="tablist" aria-label="Documents" className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {docs.map(d => {
            const on = d.file === activeFile;
            return (
              <div key={d.file} className={cn('group flex h-8 shrink-0 items-center rounded-lg pl-3 pr-1 text-[13px] transition-colors', on ? 'bg-white font-medium text-zinc-900 shadow-soft ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-zinc-200/60')}>
                <button role="tab" aria-selected={on} onClick={() => switchTo(d.file)} className="flex items-center gap-2" title={d.file}>
                  <FileText className={cn('size-3.5', on ? 'text-indigo-600' : 'text-zinc-400')} />
                  <span className="max-w-[180px] truncate">{shortDocLabel(d.file)}</span>
                  {(d.status === 'pending' || d.status === 'saving') && <span className="size-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
                  {(d.status === 'error' || d.status === 'conflict') && <span className="size-1.5 rounded-full bg-red-500" title={d.error || 'Not saved'} />}
                </button>
                <Menu width="w-56" items={[
                  { label: 'Rename', icon: <Pencil />, onSelect: () => setRenameDoc(d.file) },
                  { label: 'Replace with upload…', icon: <Upload />, onSelect: () => { uploadMode.current = { kind: 'replace', file: d.file }; if (d.file !== activeFile) switchTo(d.file); uploadRef.current?.click(); } },
                  { label: 'Download HTML', icon: <FileCode2 />, onSelect: () => downloadHtml(d.file === activeFile ? currentModel()! : d.model) },
                  { separator: true, label: '' },
                  { label: 'Delete document', icon: <Trash2 />, danger: true, onSelect: () => void deleteDoc(d.file) },
                ]} trigger={p => <button {...p} aria-label={`Actions for ${d.file}`} className={cn('ml-1 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700', !on && 'opacity-0 group-hover:opacity-100')}><MoreHorizontal className="size-3.5" /></button>} />
              </div>
            );
          })}
          <Menu width="w-56" items={[
            { label: 'Blank Bangla document', icon: <FilePlus2 />, onSelect: () => void addBlank('bn') },
            { label: 'Blank English document', icon: <FilePlus2 />, onSelect: () => void addBlank('en') },
            { separator: true, label: '' },
            { label: 'Upload Word / HTML…', icon: <Upload />, onSelect: () => { uploadMode.current = { kind: 'add' }; uploadRef.current?.click(); } },
          ]} trigger={p => <IconButton label="Add document" {...p} className="ml-1 shrink-0"><Plus className="size-4" /></IconButton>} />
          <input ref={uploadRef} type="file" multiple accept={ACCEPTED_UPLOADS} className="hidden" onChange={e => { void onUpload(e.target.files); e.target.value = ''; }} />
        </nav>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <IconButton label={showFields ? 'Hide field highlights' : 'Show field highlights'} active={showFields} onClick={() => setShowFields(s => !s)}>{showFields ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</IconButton>
          <select aria-label="Zoom" value={String(zoomPref)} onChange={e => setZoomPref(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
            className="h-8 rounded-md border-0 bg-transparent px-2 text-[13px] text-zinc-600 hover:bg-zinc-200/60 focus:outline-none">
            <option value="fit">Fit ({Math.round(zoom * 100)}%)</option>
            {[0.5, 0.75, 0.9, 1, 1.25, 1.5].map(z => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
          </select>
        </div>
      </div>

      {mode === 'visual' && active && <Toolbar api={editor} state={tbState} disabled={busy === 'upload'}
        fieldValue={key => { const v = values[key]; const t = v ? (active.model.lang === 'bn' ? v.bn : v.en) : ''; return t && !isPlaceholder(t) ? t : ''; }}
        onFieldLinked={(key, text) => setTimeout(() => setField(key, active.model.lang, text), 350)} />}

      <div className="flex min-h-0 flex-1">
        <div ref={canvasRef} className="sv-canvas sv-scroll relative min-w-0 flex-1 overflow-auto">
          {loadError ? (
            <div className="mx-auto mt-20 max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-soft">
              <AlertTriangle className="mx-auto size-6 text-red-500" />
              <p className="mt-2 font-medium">{loadError}</p>
              <div className="mt-4 flex justify-center gap-2"><Button onClick={onClose}>Back to projects</Button><Button variant="primary" onClick={load}>Try again</Button></div>
            </div>
          ) : !active ? (
            <div className="mx-auto mt-20 max-w-md text-center">
              <FileText className="mx-auto size-8 text-zinc-400" />
              <p className="mt-3 font-medium">This project has no documents</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => void addBlank('bn')}>Blank Bangla</Button>
                <Button onClick={() => void addBlank('en')}>Blank English</Button>
                <Button variant="primary" onClick={() => { uploadMode.current = { kind: 'add' }; uploadRef.current?.click(); }}><Upload className="size-4" />Upload</Button>
              </div>
            </div>
          ) : mode === 'visual' ? (
            <div className="px-8 py-8">
              <VisualEditor ref={editor} docKey={`${active.file}:${reload}`} model={active.model} initialBody={active.model.body} showFields={showFields} zoom={zoom}
                onChange={body => updateModel(active.file, m => (m.body === body ? m : { ...m, body }))} onState={setTbState} onSave={() => void saveAll()} />
              <p className="mx-auto mt-3 w-fit text-[11px] text-zinc-400">Grey lines mark approximate A4 page breaks · Ctrl+S saves now</p>
            </div>
          ) : (
            <div className="flex h-full flex-col p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[13px] text-zinc-600">HTML of <strong>{active.file}</strong>. Edit directly — changes apply when you switch back to Visual.</p>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => void copyText(code).then(() => toast('HTML copied'))}><Copy className="size-3.5" />Copy</Button>
                  <Button size="sm" variant="primary" disabled={!codeDirty} onClick={() => { applyCode(); toast('HTML applied'); }}><Check className="size-3.5" />Apply</Button>
                </div>
              </div>
              <textarea aria-label="HTML code" spellCheck={false} value={code} onChange={e => { setCode(e.target.value); setCodeDirty(true); }}
                onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; setCode(code.slice(0, s) + '  ' + code.slice(t.selectionEnd)); setCodeDirty(true); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); } }}
                className="sv-scroll min-h-0 flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[12.5px] leading-relaxed text-zinc-100 shadow-pop outline-none focus:ring-4 focus:ring-indigo-200" />
            </div>
          )}
        </div>

        {panel && active && (
          <aside className="sv-scroll flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-zinc-50 max-lg:absolute max-lg:bottom-0 max-lg:right-0 max-lg:top-[140px] max-lg:z-30 max-lg:shadow-pop">
            <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2 backdrop-blur">
              <Segmented label="Side panel" value={panel} onChange={setPanel} options={[
                { value: 'fields', label: 'Fields' }, { value: 'page', label: 'Page' }, { value: 'history', label: 'History' },
              ]} />
              <IconButton label="Close panel" className="ml-auto" onClick={() => setPanel(null)}><X className="size-4" /></IconButton>
            </div>
            <div className="p-4">
              {panel === 'fields' && <FieldsPanel values={values} usage={usage} onChange={setField} onFillOffline={fillOffline} onFillGemini={fillGemini} geminiOk={gemini} geminiBusy={busy === 'fields'}
                onInsert={key => { const def = FIELD_BY_KEY.get(key)!; editor.current?.insertHtml(`<span data-field="${key}">[${def.placeholder?.[active.model.lang] || def.label}]</span>&nbsp;`); }} />}
              {panel === 'page' && <PagePanel model={active.model} onChange={fn => updateModel(active.file, fn)} />}
              {panel === 'history' && (
                <div className="space-y-3">
                  <p className="text-[13px] text-zinc-500">Earlier versions of <strong>{shortDocLabel(active.file)}</strong>. A version is kept every 5 minutes while you work (last 30).</p>
                  {store.kind !== 'server' ? <p className="rounded-lg bg-zinc-100 px-3 py-2 text-[13px] text-zinc-600">Version history is available when using the studio on the website.</p>
                    : versions === null ? <Spinner /> : !versions.length ? <p className="text-[13px] text-zinc-500">No earlier versions yet.</p> : (
                      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
                        {versions.map(v => {
                          const m = v.id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
                          const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
                          return (
                            <li key={v.id} className="flex items-center gap-2 px-3 py-2">
                              <History className="size-4 text-zinc-400" />
                              <span className="flex-1 text-[13px]">{date ? date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : v.id}</span>
                              <Button size="sm" variant="ghost" onClick={() => void restoreVersion(v.id)}>Restore</Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="flex items-center border-t border-zinc-200 bg-white px-3 py-1.5 md:hidden">{statusEl}</div>

      <RenameDialog open={!!renameDoc} onClose={() => setRenameDoc(null)} initial={(renameDoc || '').replace(/\.html$/i, '')} title="Rename document"
        onSubmit={async name => {
          const from = renameDoc!;
          const to = uniqueName(name, docsRef.current.filter(d => d.file !== from).map(d => d.file.replace(/\.html$/i, '')), '.html');
          if (to === from) return;
          await save(from);
          await store.move(pathOf(from), pathOf(to));
          setDocs(prev => prev && prev.map(d => (d.file === from ? { ...d, file: to } : d)));
          if (from === activeFile) onNavigate(to);
          toast('Document renamed');
        }} />
      <RenameDialog open={renameProject} onClose={() => setRenameProject(false)} initial={project} title="Rename project"
        onSubmit={async name => {
          await saveAll();
          const items = await store.list();
          const to = uniqueName(name, items.filter(i => i.type === 'folder' && !i.path.includes('/') && i.path !== project).map(i => i.path));
          if (to !== project) { await store.move(project, to); location.hash = `#/p/${encodeURIComponent(to)}/${encodeURIComponent(activeFile || '')}`; }
        }} />
      <PasscodeDialog open={!!passOpen} onClose={() => setPassOpen(null)} onDone={() => { const run = passOpen; setPassOpen(null); run?.(); }} />
    </div>
  );
}

function PagePanel({ model, onChange }: { model: DocModel; onChange: (fn: (m: DocModel) => DocModel) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="pp-title">Document title</Label>
        <Input id="pp-title" value={model.title} onChange={e => { const v = e.target.value; onChange(m => ({ ...m, title: v })); }} />
      </div>
      <div className="space-y-1.5">
        <Label>Language</Label>
        <Segmented label="Language" value={model.lang} onChange={lang => onChange(m => ({ ...m, lang }))} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
        <p className="text-[12px] text-zinc-500">Decides which value linked fields show.</p>
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="pp-font">Default font</Label>
          <Select id="pp-font" value={FONTS.find(f => f.value === model.font)?.value || ''} onChange={e => { const v = e.target.value; if (v) onChange(m => ({ ...m, font: v })); }}>
            {!FONTS.some(f => f.value === model.font) && <option value="">{model.font.split(',')[0].replace(/['"]/g, '')}</option>}
            {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-size">Size (pt)</Label>
          <Input id="pp-size" type="number" min={6} max={72} step={0.5} value={model.fontSize} onChange={e => { const v = Number(e.target.value); if (v >= 6 && v <= 72) onChange(m => ({ ...m, fontSize: v })); }} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Page margins (inches) · A4</Label>
        <div className="flex flex-wrap gap-1.5">
          {MARGIN_PRESETS.map(p => (
            <button key={p.id} onClick={() => onChange(m => ({ ...m, margins: { ...p.margins } }))}
              className={cn('rounded-full border px-2.5 py-1 text-[12px]', MARGIN_SIDES.every(s => p.margins[s] === model.margins[s]) ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300')}>{p.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MARGIN_SIDES.map(side => (
            <label key={side} className="space-y-1">
              <span className="block text-[11px] capitalize text-zinc-500">{side}</span>
              <Input type="number" min={0} max={3} step={0.05} value={model.margins[side]} className="h-8 px-2 text-[13px]"
                onChange={e => { const v = clampMargin(Number(e.target.value), model.margins[side]); onChange(m => ({ ...m, margins: { ...m.margins, [side]: v } })); }} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function PasscodeDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Gemini passcode" description="This studio asks for a passcode before using Gemini. You only need to enter it once on this computer." width="max-w-sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { setPasscode(value.trim()); onDone(); }} disabled={!value.trim()}>Continue</Button></>}>
      <form onSubmit={e => { e.preventDefault(); if (value.trim()) { setPasscode(value.trim()); onDone(); } }}>
        <Input data-autofocus type="password" value={value} onChange={e => setValue(e.target.value)} aria-label="Passcode" />
      </form>
    </Dialog>
  );
}
