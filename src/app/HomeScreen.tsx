import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FilePlus2, FileText, FolderOpen, LayoutTemplate, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, UploadCloud, Files } from 'lucide-react';
import { AppZoomControl, Badge, Button, Dialog, EmptyState, IconButton, Input, Label, Menu, Spinner, cn, relativeTime, useConfirm, useToast } from '../ui/ui';
import { Store } from '../editor/store';
import { ProjectSummary, TemplateId, createProject, duplicateProject, projectNameTaken, requestDetectOnOpen, summarizeProjects } from './projects';
import { TEMPLATES, shortDocLabel, docOrder } from '../editor/templates';
import { ACCEPTED_UPLOADS } from '../editor/importers';
import { validName } from '../utils/studioServer';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-soft">
        <FileText className="size-4" />
      </div>
      {!compact && <div className="leading-tight"><p className="text-[15px] font-semibold tracking-tight">Media Studio</p><p className="text-[11px] text-zinc-500">SAVOR International</p></div>}
    </div>
  );
}

const TEMPLATE_ICON: Record<TemplateId, React.ReactNode> = {
  standard: <LayoutTemplate className="size-5" />, bimox: <Sparkles className="size-5" />, blank: <FilePlus2 className="size-5" />, upload: <UploadCloud className="size-5" />,
};

function NewProjectDialog({ open, onClose, store, existing, onCreated, initialTemplate }: { open: boolean; onClose: () => void; store: Store; existing: string[]; onCreated: (project: string, first: string) => void; initialTemplate: TemplateId }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setName(''); setTemplate(initialTemplate); setFiles([]); setError(''); } }, [open]);

  const submit = async () => {
    const wanted = name.trim() || (template === 'upload' && files[0] ? files[0].name.replace(/\.[^.]+$/, '') : template === 'bimox' ? 'BIMOX 2026' : 'Untitled project');
    const nameError = validName(wanted.replace(/[^\p{L}\p{M}\p{N} _\-.()&]+/gu, ' '));
    if (nameError) { setError(nameError); return; }
    if (projectNameTaken(wanted, existing)) { setError(`A project named “${wanted.trim()}” already exists. Choose another name.`); return; }
    if (template === 'upload' && !files.length) { setError('Choose at least one file to upload.'); return; }
    setBusy(true); setError('');
    try {
      const { project, first } = await createProject(store, wanted, existing, template, files);
      if (template === 'bimox' || template === 'upload') requestDetectOnOpen(project);
      onCreated(project, first);
    } catch (e: any) { setError(e?.message || 'Could not create the project.'); }
    finally { setBusy(false); }
  };

  const addFiles = (list: FileList | null) => { if (list) setFiles(prev => [...prev, ...Array.from(list)].slice(0, 12)); };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} width="max-w-2xl" title="New project" description="A project holds the invitation and press release in Bangla and English. Everything saves automatically."
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Create project</Button></>}>
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="np-name">Project name</Label>
          <Input id="np-name" data-autofocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BIMOX 2026 or বিমক্স ২০২৬" />
        </div>
        <div className="space-y-1.5">
          <Label>Start from</Label>
          <div role="radiogroup" aria-label="Template" className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map(t => (
              <button type="button" key={t.id} role="radio" aria-checked={template === t.id} onClick={() => setTemplate(t.id)}
                className={cn('flex gap-3 rounded-xl border p-3.5 text-left transition-all', template === t.id ? 'border-indigo-500 bg-indigo-50/60 ring-4 ring-indigo-100' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50')}>
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', template === t.id ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600')}>{TEMPLATE_ICON[t.id]}</span>
                <span><span className="block text-sm font-semibold text-zinc-900">{t.name}</span><span className="mt-0.5 block text-[12.5px] leading-snug text-zinc-500">{t.description}</span></span>
              </button>
            ))}
          </div>
        </div>
        {template === 'upload' && (
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            className={cn('rounded-xl border-2 border-dashed p-5 text-center transition-colors', drag ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-300 bg-zinc-50')}>
            <UploadCloud className="mx-auto size-6 text-zinc-400" />
            <p className="mt-2 text-sm text-zinc-700"><button type="button" className="font-semibold text-indigo-600 hover:underline" onClick={() => input.current?.click()}>Choose files</button> or drag them here</p>
            <p className="mt-1 text-xs text-zinc-500">Word (.docx), HTML or text. Each file becomes an editable HTML document; layout and styles are kept.</p>
            <input ref={input} type="file" multiple accept={ACCEPTED_UPLOADS} className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            {!!files.length && (
              <ul className="mt-3 space-y-1 text-left">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm shadow-soft">
                    <FileText className="size-4 text-zinc-400" /><span className="flex-1 truncate">{f.name}</span>
                    <button type="button" className="text-xs text-zinc-500 hover:text-red-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function RenameDialog({ open, onClose, initial, title, onSubmit, submitLabel = 'Rename', description, taken }: { open: boolean; onClose: () => void; initial: string; title: string; onSubmit: (name: string) => Promise<void>; submitLabel?: string; description?: string; taken?: string[] }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setValue(initial); setError(''); } }, [open, initial]);
  const submit = async () => {
    const err = validName(value); if (err) { setError(err); return; }
    if (taken && projectNameTaken(value, taken)) { setError(`A project named “${value.trim()}” already exists. Choose another name.`); return; }
    setBusy(true);
    try { await onSubmit(value.trim()); onClose(); } catch (e: any) { setError(e?.message || 'Could not rename.'); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} width="max-w-md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>{submitLabel}</Button></>}>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <Input data-autofocus value={value} onChange={e => { setValue(e.target.value); setError(''); }} aria-label="New name" />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </Dialog>
  );
}
export { RenameDialog };

export function HomeScreen({ store, onOpen }: { store: Store; onOpen: (project: string, file?: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState<TemplateId | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const load = async () => {
    try { setProjects(summarizeProjects(await store.list())); setError(''); }
    catch (e: any) { setError(e?.message || 'Could not load projects.'); setProjects([]); }
  };
  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => (projects || []).filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);

  const remove = async (p: ProjectSummary) => {
    if (!(await confirm({ title: `Delete “${p.name}”?`, description: store.kind === 'server' ? 'The project and its documents move to the server trash and are kept for 30 days.' : 'The project and its documents will be removed from this browser.', confirm: 'Delete project', danger: true }))) return;
    try { await store.remove(p.name); toast(`Deleted “${p.name}”`); void load(); } catch (e: any) { toast('Could not delete', { tone: 'error', description: e?.message }); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <div className="relative ml-auto hidden w-64 sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" className="h-7 pl-8 text-[13px]" />
          </div>
          <AppZoomControl />
          <Button size="sm" variant="primary" onClick={() => setNewOpen('standard')}><Plus className="size-4" />New project</Button>
        </div>
      </header>

      <div className="sv-scroll min-h-0 flex-1 overflow-y-auto">
      <main className="mx-auto w-full max-w-6xl px-4 py-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Projects</h1>
            <p className="mt-1 text-sm text-zinc-500">Media invitations and press releases in Bangla and English.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setNewOpen('upload')}><UploadCloud className="size-4" />Upload documents</Button>
          </div>
        </div>

        <div className="mb-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setNewOpen(t.id)}
              className="group flex flex-col items-start rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-pop">
              <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">{TEMPLATE_ICON[t.id]}</span>
              <span className="mt-3 text-sm font-semibold text-zinc-900">{t.name}</span>
              <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-zinc-500">{t.description}</span>
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button className="font-semibold underline" onClick={load}>Retry</button></p>}

        {projects === null ? (
          <div className="flex justify-center py-20"><Spinner className="size-6" /></div>
        ) : !shown.length ? (
          query ? <p className="py-16 text-center text-sm text-zinc-500">No projects match “{query}”.</p> :
            <EmptyState icon={<FolderOpen />} title="No projects yet" description="Start from a template or upload your Word files. Everything you type saves automatically."
              action={<Button variant="primary" onClick={() => setNewOpen('standard')}><Plus className="size-4" />New project</Button>} />
        ) : (
          <>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-zinc-400">Recent</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(p => (
                <div key={p.name} className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white shadow-soft transition-all hover:border-zinc-300 hover:shadow-pop">
                  <button onClick={() => onOpen(p.name)} className="flex flex-1 flex-col p-3 text-left">
                    <div className="mb-2 flex h-16 items-end gap-1.5 overflow-hidden rounded-lg bg-gradient-to-b from-zinc-50 to-zinc-100 px-3 pt-3">
                      {(p.docs.length ? [...p.docs].sort((a, b) => docOrder(a) - docOrder(b)).slice(0, 4) : ['']).map((d, i) => (
                        <div key={i} className="h-full flex-1 rounded-t-md border border-b-0 border-zinc-200 bg-white p-2 shadow-soft">
                          <div className="h-1.5 w-2/3 rounded-full bg-zinc-200" /><div className="mt-1.5 h-1 w-full rounded-full bg-zinc-100" /><div className="mt-1 h-1 w-5/6 rounded-full bg-zinc-100" /><div className="mt-1 h-1 w-4/6 rounded-full bg-zinc-100" />
                        </div>
                      ))}
                    </div>
                    <p className="truncate pr-8 text-[15px] font-semibold text-zinc-900">{p.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-zinc-500">{p.docs.length} document{p.docs.length === 1 ? '' : 's'} · {relativeTime(p.modified)}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {[...p.docs].sort((a, b) => docOrder(a) - docOrder(b)).slice(0, 4).map(d => <Badge key={d}>{shortDocLabel(d)}</Badge>)}
                      {p.docs.length > 4 && <Badge>+{p.docs.length - 4}</Badge>}
                    </div>
                  </button>
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Menu align="end" width="w-48" items={[
                      { label: 'Open', icon: <FolderOpen />, onSelect: () => onOpen(p.name) },
                      { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(p.name) },
                      { label: 'Duplicate…', icon: <Copy />, onSelect: () => setDuplicating(p.name) },
                      { separator: true, label: '' },
                      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => void remove(p) },
                    ]} trigger={t => <IconButton label="Project actions" variant="outline" className="bg-white" {...t}><MoreHorizontal className="size-4" /></IconButton>} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200/80 py-3 text-center text-xs text-zinc-400">
        <Files className="mr-1 inline size-3.5 align-[-2px]" />
        {store.kind === 'server' ? 'Projects are saved on the server and kept with version history.' : 'Projects are saved in this browser only.'}
      </footer>
      </div>

      <NewProjectDialog open={!!newOpen} initialTemplate={newOpen || 'standard'} onClose={() => setNewOpen(null)} store={store} existing={(projects || []).map(p => p.name)}
        onCreated={project => { setNewOpen(null); toast(`Created “${project}”`); onOpen(project); }} />
      <RenameDialog open={!!renaming} onClose={() => setRenaming(null)} initial={renaming || ''} title="Rename project"
        taken={(projects || []).filter(p => p.name !== renaming).map(p => p.name)}
        onSubmit={async name => {
          if (name !== renaming) await store.move(renaming!, name);
          toast('Project renamed'); void load();
        }} />
      <DuplicateProjectDialog store={store} from={duplicating} taken={(projects || []).map(p => p.name)} onClose={() => setDuplicating(null)}
        onDone={name => { toast(`Duplicated as “${name}”`); void load(); }} />
    </div>
  );
}

export function copyName(from: string, taken: string[]): string {
  let n = `${from} copy`, i = 2;
  while (projectNameTaken(n, taken)) n = `${from} copy ${i++}`;
  return n;
}

/** Asks for a new, unique name and copies the project (documents + shared values). */
export function DuplicateProjectDialog({ store, from, taken, onClose, onDone }: { store: Store; from: string | null; taken: string[]; onClose: () => void; onDone: (name: string) => void }) {
  return (
    <RenameDialog open={!!from} onClose={onClose} initial={from ? copyName(from, taken) : ''} title={`Duplicate “${from || ''}”`} submitLabel="Duplicate"
      description="All documents and shared values are copied into a new project. Project names must be unique."
      taken={taken} onSubmit={async name => { const made = await duplicateProject(store, from!, name); onDone(made); }} />
  );
}
