// All state for one open project: its documents, the shared values, autosave
// and how value changes flow into every document.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Store } from '../editor/store';
import { DocModel, parseDoc, serializeDoc } from '../editor/doc';
import { docOrder } from '../editor/templates';
import { ProjectValues, emptyValues, parseValues } from '../editor/values';
import { applyValuesToBody, applyValuesToRoot, cleanEditorHtml, slotUsage } from '../editor/bindings';
import { StudioError } from '../utils/studioServer';

export type Status = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
export interface PDoc { file: string; model: DocModel; etag: string | null; dirty: boolean; status: Status; error?: string; savedAt?: number }

/** The document currently open in the visual editor (its DOM is the live copy). */
export interface LiveDoc { file: string; root: () => HTMLElement | null; getBody: () => string }

const VALUES_FILE = 'project.json';

export function useProject(store: Store, project: string) {
  const [docs, setDocs] = useState<PDoc[] | null>(null);
  const [values, setValuesState] = useState<ProjectValues>(emptyValues);
  const [hasValuesFile, setHasValuesFile] = useState(true);
  const [valuesStatus, setValuesStatus] = useState<Status>('saved');
  const [loadError, setLoadError] = useState('');
  const [changedKeys, setChangedKeys] = useState<{ keys: string[]; n: number }>({ keys: [], n: 0 });
  const docsRef = useRef<PDoc[]>([]);
  docsRef.current = docs || [];
  const valuesRef = useRef(values);
  const valuesEtag = useRef<string | null>(null);
  const valuesDirty = useRef(false);
  const live = useRef<LiveDoc | null>(null);
  const timers = useRef<Record<string, number>>({});
  const valuesTimer = useRef<number | undefined>(undefined);
  const history = useRef<{ past: ProjectValues[]; future: ProjectValues[]; lastPush: number }>({ past: [], future: [], lastPush: 0 });
  const [historyTick, setHistoryTick] = useState(0);

  const pathOf = (f: string) => `${project}/${f}`;

  /* ---------- Load ---------- */
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const items = await store.list();
      if (!items.some(i => i.type === 'folder' && i.path === project)) throw new StudioError('This project no longer exists.', 404);
      const inProject = items.filter(i => i.type === 'file' && i.path.startsWith(project + '/') && !i.path.slice(project.length + 1).includes('/')).map(i => i.path.slice(project.length + 1));
      const files = inProject.filter(f => /\.html$/i.test(f));
      const loaded = await Promise.all(files.map(async f => {
        const r = await store.read(pathOf(f));
        return { file: f, model: parseDoc(r.content, f.replace(/\.html$/i, '')), etag: r.etag, dirty: false, status: 'saved' as Status, savedAt: r.modified * 1000 };
      }));
      loaded.sort((a, b) => docOrder(a.file) - docOrder(b.file) || a.file.localeCompare(b.file));
      if (inProject.includes(VALUES_FILE)) {
        const r = await store.read(pathOf(VALUES_FILE));
        const v = parseValues(r.content);
        valuesEtag.current = r.etag;
        valuesRef.current = v;
        setValuesState(v);
        setHasValuesFile(true);
      } else {
        valuesEtag.current = null;
        valuesRef.current = emptyValues();
        setValuesState(valuesRef.current);
        setHasValuesFile(false);
      }
      setDocs(loaded);
    } catch (e: any) { setLoadError(e?.message || 'Could not open this project.'); setDocs([]); }
  }, [project, store]);
  useEffect(() => { void load(); }, [load]);

  /* ---------- Documents ---------- */
  const patch = (f: string, fn: (d: PDoc) => PDoc) => setDocs(prev => prev && prev.map(d => (d.file === f ? fn(d) : d)));
  const markDirty = (d: PDoc, model: DocModel): PDoc => (model === d.model ? d : { ...d, model, dirty: true, status: d.status === 'conflict' ? 'conflict' : 'pending' });
  const updateModel = useCallback((f: string, fn: (m: DocModel) => DocModel) => patch(f, d => markDirty(d, fn(d.model))), []);

  const save = useCallback(async (f: string, overwrite = false): Promise<boolean> => {
    const d = docsRef.current.find(x => x.file === f);
    if (!d || (!d.dirty && !overwrite) || d.status === 'saving' || (d.status === 'conflict' && !overwrite)) return !d || !d.dirty;
    const model = d.model;
    patch(f, x => ({ ...x, dirty: false, status: 'saving' }));
    try {
      const r = await store.save(pathOf(f), serializeDoc({ ...model, body: cleanEditorHtml(model.body) }), overwrite ? null : d.etag);
      patch(f, x => ({ ...x, etag: r.etag, savedAt: Date.now(), status: x.dirty ? 'pending' : 'saved', error: undefined }));
      return true;
    } catch (e: any) {
      const conflict = e instanceof StudioError && e.status === 409 && e.code === 'sms_conflict';
      patch(f, x => ({ ...x, dirty: true, status: conflict ? 'conflict' : 'error', error: e?.message }));
      return false;
    }
  }, [project, store]);

  useEffect(() => {
    for (const d of docs || []) {
      if (d.dirty && d.status === 'pending') {
        window.clearTimeout(timers.current[d.file]);
        timers.current[d.file] = window.setTimeout(() => void save(d.file), 1000);
      }
    }
  }, [docs, save]);

  /* ---------- Shared values ---------- */
  const saveValues = useCallback(async (): Promise<boolean> => {
    if (!valuesDirty.current) return true;
    valuesDirty.current = false;
    setValuesStatus('saving');
    try {
      const r = await store.save(pathOf(VALUES_FILE), JSON.stringify(valuesRef.current, null, 1), valuesEtag.current, valuesEtag.current ? 'save' : 'save');
      valuesEtag.current = r.etag;
      setHasValuesFile(true);
      setValuesStatus(valuesDirty.current ? 'pending' : 'saved');
      return true;
    } catch (e: any) {
      valuesDirty.current = true;
      // Someone else saved the values: take theirs as the base next time rather than looping.
      if (e instanceof StudioError && e.status === 409) { valuesEtag.current = null; }
      setValuesStatus('error');
      return false;
    }
  }, [project, store]);

  const scheduleValuesSave = () => {
    valuesDirty.current = true;
    setValuesStatus('pending');
    window.clearTimeout(valuesTimer.current);
    valuesTimer.current = window.setTimeout(() => void saveValues(), 900);
  };

  /** Push values into every document (the live editor DOM included). */
  const applyEverywhere = (next: ProjectValues) => {
    setDocs(prev => prev && prev.map(d => {
      if (live.current?.file === d.file) {
        const root = live.current.root();
        if (root && applyValuesToRoot(root, d.model.lang, next, { lockStructured: true })) {
          return markDirty(d, { ...d.model, body: cleanEditorHtml(live.current.getBody()) });
        }
        return d;
      }
      const body = applyValuesToBody(d.model.body, d.model.lang, next);
      return body === d.model.body ? d : markDirty(d, { ...d.model, body });
    }));
  };

  const commitValues = (next: ProjectValues, keys: string[], recordHistory = true) => {
    const prev = valuesRef.current;
    if (recordHistory) {
      const h = history.current;
      const now = Date.now();
      if (now - h.lastPush > 800) { h.past.push(prev); if (h.past.length > 80) h.past.shift(); }
      h.lastPush = now;
      h.future = [];
      setHistoryTick(t => t + 1);
    }
    valuesRef.current = next;
    setValuesState(next);
    setChangedKeys(c => ({ keys, n: c.n + 1 }));
    applyEverywhere(next);
    scheduleValuesSave();
  };

  /** Change shared values. `keys` names what changed (for the flash highlight). */
  const setValues = useCallback((fn: (v: ProjectValues) => ProjectValues, keys: string[] = []) => {
    const next = fn(valuesRef.current);
    if (next === valuesRef.current) return;
    commitValues(next, keys);
  }, []);

  const undo = () => {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(valuesRef.current);
    h.lastPush = 0;
    commitValues(prev, [], false);
    setHistoryTick(t => t + 1);
  };
  const redo = () => {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(valuesRef.current);
    h.lastPush = 0;
    commitValues(next, [], false);
    setHistoryTick(t => t + 1);
  };

  /** Replace values and document bodies at once (after detection). */
  const replaceAll = (next: ProjectValues, bodies: Record<string, string>) => {
    history.current.past.push(valuesRef.current);
    valuesRef.current = next;
    setValuesState(next);
    setDocs(prev => prev && prev.map(d => {
      const body = bodies[d.file] !== undefined ? applyValuesToBody(bodies[d.file], d.model.lang, next) : applyValuesToBody(d.model.body, d.model.lang, next);
      return body === d.model.body ? d : markDirty(d, { ...d.model, body });
    }));
    scheduleValuesSave();
  };

  /* ---------- Derived ---------- */
  const usage = useMemo(() => {
    const u: Record<string, { count: number; overrides: number; docs: string[] }> = {};
    for (const d of docs || []) {
      for (const [k, v] of Object.entries(slotUsage(d.model.body))) {
        const e = (u[k] ||= { count: 0, overrides: 0, docs: [] });
        e.count += v.count; e.overrides += v.overrides; e.docs.push(d.file);
      }
    }
    return u;
  }, [docs]);

  const all = docs || [];
  const status: Status = all.some(d => d.status === 'conflict') ? 'conflict'
    : all.some(d => d.status === 'error') || valuesStatus === 'error' ? 'error'
      : all.some(d => d.status === 'saving') || valuesStatus === 'saving' ? 'saving'
        : all.some(d => d.status === 'pending') || valuesStatus === 'pending' ? 'pending' : 'saved';
  const lastSaved = Math.max(0, ...all.map(d => d.savedAt || 0));

  const saveAll = async () => {
    if (live.current) {
      const body = cleanEditorHtml(live.current.getBody());
      const f = live.current.file;
      patch(f, d => (d.model.body === body ? d : markDirty(d, { ...d.model, body })));
      await new Promise(r => setTimeout(r, 0));
    }
    const results = await Promise.all([...docsRef.current.filter(d => d.dirty).map(d => save(d.file)), saveValues()]);
    return results.every(Boolean);
  };

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (valuesDirty.current || docsRef.current.some(d => d.dirty || d.status === 'saving')) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  return {
    docs, setDocs, docsRef, values, valuesRef, setValues, replaceAll, hasValuesFile, loadError, load,
    updateModel, patch, save, saveAll, saveValues, status, lastSaved, usage, live, changedKeys,
    undo, redo, canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0, historyTick, pathOf,
  };
}

export type ProjectState = ReturnType<typeof useProject>;
