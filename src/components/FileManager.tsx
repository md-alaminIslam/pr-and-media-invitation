import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FilePlus2, FileText, Folder, FolderOpen, FolderPlus, History, Pencil, RefreshCw, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { StudioItem, StudioVersion, TreeNode, baseName, buildTree, displayName, joinPath, parentPath, studioApi, validName, withJson } from '../utils/studioServer';

type Editing =
  | { kind: 'new-file'; folder: string; blank: boolean; value: string }
  | { kind: 'new-folder'; folder: string; value: string }
  | { kind: 'rename'; path: string; type: 'file' | 'folder'; value: string };

interface Props {
  open: boolean;
  onClose: () => void;
  currentPath: string | null;
  refreshToken: number;
  onOpenFile: (path: string) => void;
  onCreate: (path: string, blank: boolean) => Promise<void>;
  onImport: (path: string, content: unknown) => Promise<void>;
  onMoved: (from: string, to: string) => void;
  onDeleted: (path: string) => void;
  onRestoreVersion: (path: string, content: unknown, id: string) => void;
}

const timeFormat = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const when = (seconds: number) => seconds ? timeFormat.format(new Date(seconds * 1000)) : '';
const versionLabel = (id: string) => {
  const m = id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  return m ? timeFormat.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))) : id;
};

export function FileManager(props: Props) {
  const { open, onClose, currentPath, refreshToken } = props;
  const [items, setItems] = useState<StudioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editError, setEditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<StudioVersion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await studioApi.list()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open, refreshToken]);

  // Keep the open file's folders expanded.
  useEffect(() => {
    if (!currentPath) return;
    setExpanded(prev => {
      const next = new Set(prev);
      let p = parentPath(currentPath);
      while (p) { next.add(p); p = parentPath(p); }
      return next;
    });
    setSelectedFolder(parentPath(currentPath));
  }, [currentPath]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, editing, onClose]);

  const tree = useMemo(() => buildTree(items), [items]);
  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? items.filter(i => i.type === 'file' && i.path.toLowerCase().includes(q)) : [];
  }, [items, filter]);

  const startEdit = (next: Editing) => { setEditing(next); setEditError(''); setConfirmDelete(null); };

  const submitEdit = async () => {
    if (!editing || busy) return;
    const nameError = validName(editing.value.replace(/\.json$/i, ''));
    if (nameError) { setEditError(nameError); return; }
    setBusy(true); setEditError('');
    try {
      if (editing.kind === 'new-file') {
        const path = withJson(joinPath(editing.folder, editing.value));
        await props.onCreate(path, editing.blank);
        if (editing.folder) setExpanded(prev => new Set(prev).add(editing.folder));
      } else if (editing.kind === 'new-folder') {
        const path = joinPath(editing.folder, editing.value);
        await studioApi.mkdir(path);
        setExpanded(prev => { const n = new Set(prev); if (editing.folder) n.add(editing.folder); n.add(path); return n; });
        setSelectedFolder(path);
      } else {
        const name = editing.type === 'file' ? withJson(editing.value.trim()) : editing.value.trim();
        const to = joinPath(parentPath(editing.path), name);
        if (to !== editing.path) {
          await studioApi.move(editing.path, to);
          props.onMoved(editing.path, to);
        }
      }
      setEditing(null);
      await load();
    } catch (e: any) { setEditError(e.message); }
    finally { setBusy(false); }
  };

  const doDelete = async (path: string) => {
    setBusy(true);
    try { await studioApi.remove(path); props.onDeleted(path); setConfirmDelete(null); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const download = async (path: string) => {
    try {
      const file = await studioApi.read(path);
      const url = URL.createObjectURL(new Blob([JSON.stringify(file.content, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = baseName(path); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { setError(e.message); }
  };

  const importFile = async (file: File) => {
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('ফাইলটি অনেক বড় (সর্বোচ্চ ৪ MB)।');
      const content = JSON.parse(await file.text());
      if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('এটি Media Studio-র ড্রাফট ফাইল নয়।');
      const clean = file.name.replace(/\.json$/i, '').replace(/[^\p{L}\p{M}\p{N} _\-.()&]+/gu, ' ').trim() || 'Imported';
      await props.onImport(withJson(joinPath(selectedFolder, clean)), content);
      await load();
    } catch (e: any) { setError(e instanceof SyntaxError ? 'JSON ফাইলটি পড়া যায়নি।' : e.message); }
  };

  const showVersions = async (path: string) => {
    setVersionsFor(path); setVersions(null);
    try { setVersions(await studioApi.versions(path)); }
    catch (e: any) { setError(e.message); setVersionsFor(null); }
  };

  const restore = async (id: string) => {
    if (!versionsFor) return;
    setBusy(true);
    try {
      const v = await studioApi.version(versionsFor, id);
      props.onRestoreVersion(versionsFor, v.content, id);
      setVersionsFor(null);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const toggle = (path: string) => setExpanded(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  const editRow = (depth: number, placeholder: string) => editing && (
    <div className="px-2 py-1.5" style={{ paddingLeft: 8 + depth * 16 }}>
      <form onSubmit={e => { e.preventDefault(); void submitEdit(); }} className="flex gap-1">
        <input
          autoFocus
          aria-label={placeholder}
          value={editing.value}
          placeholder={placeholder}
          onChange={e => setEditing({ ...editing, value: e.target.value } as Editing)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
          className="flex-1 min-w-0 border border-blue-300 rounded-md px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button type="submit" disabled={busy} className="px-2 py-1 text-xs rounded-md bg-blue-600 text-white disabled:opacity-50">ঠিক আছে</button>
        <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 text-xs rounded-md border">বাতিল</button>
      </form>
      {editError && <p role="alert" className="text-xs text-red-600 mt-1">{editError}</p>}
    </div>
  );

  const iconButton = (label: string, onClick: () => void, icon: React.ReactNode, danger = false) => (
    <button type="button" title={label} aria-label={label} onClick={e => { e.stopPropagation(); onClick(); }}
      className={`p-1 rounded hover:bg-white ${danger ? 'text-red-600' : 'text-slate-500 hover:text-slate-900'}`}>{icon}</button>
  );

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isOpen = expanded.has(node.path);
    const isCurrent = node.path === currentPath;
    const renaming = editing?.kind === 'rename' && editing.path === node.path;
    const row = renaming ? editRow(depth, node.type === 'file' ? 'ফাইলের নতুন নাম' : 'ফোল্ডারের নতুন নাম') : (
      <div
        role="button"
        tabIndex={0}
        data-path={node.path}
        onClick={() => { if (node.type === 'folder') { toggle(node.path); setSelectedFolder(node.path); } else props.onOpenFile(node.path); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).click(); }}
        className={`group flex items-center gap-1.5 pr-1 py-1.5 rounded-md cursor-pointer text-sm ${isCurrent ? 'bg-blue-100 text-blue-900 font-semibold' : node.type === 'folder' && selectedFolder === node.path ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {node.type === 'folder'
          ? <>{isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}{isOpen ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 shrink-0" />}</>
          : <><span className="w-3.5 shrink-0" /><FileText className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} /></>}
        <span className="truncate flex-1" title={node.path}>{node.type === 'file' ? displayName(node.path) : node.name}</span>
        {node.type === 'file' && <span className="text-[10px] text-slate-400 group-hover:hidden whitespace-nowrap">{when(node.modified)}</span>}
        <span className="hidden group-hover:flex group-focus-within:flex items-center">
          {node.type === 'folder' && iconButton('এই ফোল্ডারে নতুন ফাইল', () => { setExpanded(p => new Set(p).add(node.path)); startEdit({ kind: 'new-file', folder: node.path, blank: true, value: '' }); }, <FilePlus2 className="w-3.5 h-3.5" />)}
          {node.type === 'folder' && iconButton('এই ফোল্ডারে নতুন ফোল্ডার', () => { setExpanded(p => new Set(p).add(node.path)); startEdit({ kind: 'new-folder', folder: node.path, value: '' }); }, <FolderPlus className="w-3.5 h-3.5" />)}
          {node.type === 'file' && iconButton('আগের ভার্সন', () => void showVersions(node.path), <History className="w-3.5 h-3.5" />)}
          {node.type === 'file' && iconButton('ডাউনলোড', () => void download(node.path), <Download className="w-3.5 h-3.5" />)}
          {iconButton('নাম বদলান', () => startEdit({ kind: 'rename', path: node.path, type: node.type, value: node.type === 'file' ? displayName(node.path) : node.name }), <Pencil className="w-3.5 h-3.5" />)}
          {iconButton('মুছুন', () => { setEditing(null); setConfirmDelete(node.path); }, <Trash2 className="w-3.5 h-3.5" />, true)}
        </span>
      </div>
    );
    return (
      <div key={node.path}>
        {row}
        {confirmDelete === node.path && (
          <div className="mx-2 my-1 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-800" style={{ marginLeft: 8 + depth * 16 }}>
            {node.type === 'folder' ? 'ফোল্ডার ও এর ভেতরের সব ফাইল মুছবেন?' : 'ফাইলটি মুছবেন?'} সার্ভারের ট্র্যাশে ৩০ দিন থাকবে।
            <div className="flex gap-2 mt-1.5">
              <button disabled={busy} onClick={() => void doDelete(node.path)} className="px-2 py-0.5 rounded bg-red-600 text-white disabled:opacity-50">হ্যাঁ, মুছুন</button>
              <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 rounded border border-red-200 bg-white">না</button>
            </div>
          </div>
        )}
        {node.type === 'folder' && isOpen && (
          <>
            {editing && editing.kind !== 'rename' && editing.folder === node.path && editRow(depth + 1, editing.kind === 'new-folder' ? 'নতুন ফোল্ডারের নাম' : 'নতুন ফাইলের নাম')}
            {node.children.map(child => renderNode(child, depth + 1))}
            {!node.children.length && !(editing && editing.kind !== 'rename' && editing.folder === node.path) && <p className="text-xs text-slate-400 py-1" style={{ paddingLeft: 30 + depth * 16 }}>খালি ফোল্ডার</p>}
          </>
        )}
      </div>
    );
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 no-print" aria-modal="true" role="dialog" aria-label="ফাইল ম্যানেজার">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute left-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="font-bold text-slate-900">ফাইল ম্যানেজার</h2>
            <p className="text-xs text-slate-500">ফাইল খুলে কাজ করুন — পরিবর্তন অটো সেভ হয়।</p>
          </div>
          <div className="flex items-center gap-1">
            <button title="রিফ্রেশ" aria-label="রিফ্রেশ" onClick={() => void load()} className="p-1.5 rounded hover:bg-slate-100"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button title="বন্ধ করুন" aria-label="বন্ধ করুন" onClick={onClose} className="p-1.5 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="px-3 py-2 border-b space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => startEdit({ kind: 'new-file', folder: selectedFolder, blank: true, value: '' })} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white px-2 py-2"><FilePlus2 className="w-3.5 h-3.5" />নতুন ফাঁকা ফাইল</button>
            <button onClick={() => startEdit({ kind: 'new-file', folder: selectedFolder, blank: false, value: '' })} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 px-2 py-2"><Save className="w-3.5 h-3.5" />বর্তমান কাজ সেভ</button>
            <button onClick={() => startEdit({ kind: 'new-folder', folder: selectedFolder, value: '' })} className="flex items-center justify-center gap-1.5 text-xs rounded-lg border px-2 py-1.5"><FolderPlus className="w-3.5 h-3.5" />নতুন ফোল্ডার</button>
            <button onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-1.5 text-xs rounded-lg border px-2 py-1.5"><Upload className="w-3.5 h-3.5" />JSON ইমপোর্ট</button>
            <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
          </div>
          <p className="text-[11px] text-slate-500">নতুন ফাইল/ফোল্ডার যাবে: <strong>{selectedFolder || 'মূল ফোল্ডার'}</strong>{selectedFolder && <button className="ml-1 underline" onClick={() => setSelectedFolder('')}>মূলে নিন</button>}</p>
          <label className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="ফাইল খুঁজুন" aria-label="ফাইল খুঁজুন" className="flex-1 text-sm outline-none" />
          </label>
        </div>

        {error && <p role="alert" className="mx-3 mt-2 p-2 text-xs rounded-md bg-red-50 text-red-700 border border-red-200">{error}</p>}

        <div className="flex-1 overflow-y-auto p-2">
          {filter.trim() ? (
            matches.length ? matches.map(m => (
              <button key={m.path} onClick={() => props.onOpenFile(m.path)} className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${m.path === currentPath ? 'bg-blue-100 font-semibold' : 'hover:bg-slate-100'}`}>
                <FileText className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{m.path.replace(/\.json$/i, '')}</span>
              </button>
            )) : <p className="text-sm text-slate-500 p-2">কোনো ফাইল মেলেনি।</p>
          ) : (
            <>
              {editing && editing.kind !== 'rename' && editing.folder === '' && editRow(0, editing.kind === 'new-folder' ? 'নতুন ফোল্ডারের নাম' : 'নতুন ফাইলের নাম')}
              {tree.map(node => renderNode(node, 0))}
              {!loading && !tree.length && !editing && <p className="text-sm text-slate-500 p-2">এখনো কোনো ফাইল নেই। “নতুন ফাঁকা ফাইল” বা “বর্তমান কাজ সেভ” চাপুন।</p>}
            </>
          )}
        </div>

        {versionsFor && (
          <div className="border-t bg-slate-50 max-h-[45%] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-slate-50 border-b">
              <p className="text-xs font-semibold truncate">আগের ভার্সন: {displayName(versionsFor)}</p>
              <button aria-label="ভার্সন তালিকা বন্ধ" onClick={() => setVersionsFor(null)} className="p-1 rounded hover:bg-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            {versions === null ? <p className="text-xs p-3 text-slate-500">লোড হচ্ছে…</p>
              : !versions.length ? <p className="text-xs p-3 text-slate-500">এখনো আগের ভার্সন নেই। কাজ চলাকালে প্রতি ৫ মিনিটে একটি ভার্সন রাখা হয়।</p>
              : versions.map(v => (
                <div key={v.id} className="flex items-center justify-between px-3 py-1.5 text-xs border-b last:border-0">
                  <span>{versionLabel(v.id)}</span>
                  <button disabled={busy} onClick={() => void restore(v.id)} className="px-2 py-0.5 rounded border bg-white hover:bg-blue-50 disabled:opacity-50">এটি ফিরিয়ে আনুন</button>
                </div>
              ))}
          </div>
        )}
      </aside>
    </div>
  );
}
