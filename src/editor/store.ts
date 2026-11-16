// Document storage. On WordPress (/media-studio) files live on the server;
// anywhere else (GitHub Pages, local dev) they live in this browser (IndexedDB).

import { StudioError, StudioItem, StudioVersion, getStudioConfig, studioApi } from '../utils/studioServer';

export interface StoredFile { content: string; etag: string; modified: number }

export interface Store {
  kind: 'server' | 'browser';
  list(): Promise<StudioItem[]>;
  read(path: string): Promise<StoredFile>;
  save(path: string, content: string, etag?: string | null, mode?: 'save' | 'create'): Promise<{ etag: string; modified: number }>;
  remove(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  versions(path: string): Promise<StudioVersion[]>;
  version(path: string, id: string): Promise<string>;
}

const serverStore: Store = {
  kind: 'server',
  list: () => studioApi.list(),
  read: async path => { const f = await studioApi.read(path); return { content: f.content, etag: f.etag, modified: f.modified }; },
  save: async (path, content, etag, mode) => { const r = await studioApi.save(path, content, etag, mode); return { etag: r.etag, modified: r.modified }; },
  remove: async path => { await studioApi.remove(path); },
  mkdir: async path => { await studioApi.mkdir(path); },
  move: async (from, to) => { await studioApi.move(from, to); },
  versions: path => studioApi.versions(path),
  version: async (path, id) => (await studioApi.version(path, id)).content,
};

/* ---------- Browser (IndexedDB) store ---------- */

interface Row { path: string; type: 'file' | 'folder'; content?: string; etag?: string; modified: number }

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('savor-media-studio', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'path' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(d => new Promise<T>((resolve, reject) => {
    const t = d.transaction('files', mode);
    const req = run(t.objectStore('files'));
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
  }));
}

const allRows = () => tx<Row[]>('readonly', s => s.getAll() as IDBRequest<Row[]>);
const getRow = (path: string) => tx<Row | undefined>('readonly', s => s.get(path) as IDBRequest<Row | undefined>);
const putRow = (row: Row) => tx<IDBValidKey>('readwrite', s => s.put(row));
const delRow = (path: string) => tx<undefined>('readwrite', s => s.delete(path) as IDBRequest<undefined>);

async function hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

const parentOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

const browserStore: Store = {
  kind: 'browser',
  list: async () => (await allRows()).map(r => ({ path: r.path, type: r.type, modified: r.modified, size: r.content?.length })),
  read: async path => {
    const row = await getRow(path);
    if (!row || row.type !== 'file') throw new StudioError('File not found.', 404);
    return { content: row.content || '', etag: row.etag || '', modified: row.modified };
  },
  save: async (path, content, etag, mode = 'save') => {
    const row = await getRow(path);
    if (row && mode === 'create') throw new StudioError('A file with this name already exists.', 409, 'sms_exists');
    if (row && etag && row.etag !== etag) throw new StudioError('This document was changed somewhere else.', 409, 'sms_conflict');
    const parent = parentOf(path);
    if (parent && (await getRow(parent))?.type !== 'folder') throw new StudioError('Folder not found.', 404);
    const next: Row = { path, type: 'file', content, etag: await hash(content), modified: Math.floor(Date.now() / 1000) };
    await putRow(next);
    return { etag: next.etag!, modified: next.modified };
  },
  remove: async path => {
    for (const r of await allRows()) if (r.path === path || r.path.startsWith(path + '/')) await delRow(r.path);
  },
  mkdir: async path => {
    if (await getRow(path)) throw new StudioError('A folder or file with this name already exists.', 409, 'sms_exists');
    await putRow({ path, type: 'folder', modified: Math.floor(Date.now() / 1000) });
  },
  move: async (from, to) => {
    if (await getRow(to)) throw new StudioError('A file or folder with this name already exists.', 409, 'sms_exists');
    for (const r of await allRows()) {
      if (r.path === from || r.path.startsWith(from + '/')) {
        await delRow(r.path);
        await putRow({ ...r, path: to + r.path.slice(from.length) });
      }
    }
  },
  versions: async () => [],
  version: async () => { throw new StudioError('Version history is only available on the server.', 404); },
};

export function getStore(): Store {
  return getStudioConfig() ? serverStore : browserStore;
}
