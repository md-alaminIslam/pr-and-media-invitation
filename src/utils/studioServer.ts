/** Client for the WordPress plugin's file API (only present when served from /media-studio). */

export interface StudioConfig {
  restUrl: string;
  version: string;
  gemini: boolean;
  geminiPasscode: boolean;
  pageUrl: string;
}

declare global {
  interface Window { SAVOR_STUDIO?: StudioConfig }
}

export function getStudioConfig(): StudioConfig | null {
  const c = typeof window !== 'undefined' ? window.SAVOR_STUDIO : undefined;
  return c && typeof c.restUrl === 'string' ? c : null;
}

export interface StudioItem { path: string; type: 'file' | 'folder'; size?: number; modified: number }
export interface StudioFile { path: string; content: string; etag: string; modified: number }
export interface SaveResult { path: string; etag: string; modified: number; size: number }
export interface StudioVersion { id: string; modified: number; size: number }

export class StudioError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: any) { super(message); }
}

function endpoint(route: string, query?: Record<string, string>): string {
  const cfg = getStudioConfig();
  if (!cfg) throw new StudioError('File server not available.', 0);
  // rest_url() may be pretty (/wp-json/ns/) or plain (?rest_route=/ns/).
  const url = new URL(cfg.restUrl + route, window.location.href);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.toString();
}

async function call<T>(method: string, route: string, opts: { query?: Record<string, string>; body?: unknown; headers?: Record<string, string>; timeout?: number } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint(route, opts.query), {
      method,
      credentials: 'omit',
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeout ?? 30000),
    });
  } catch (e: any) {
    throw new StudioError(e?.name === 'TimeoutError' ? 'The server is taking too long to respond.' : 'Could not reach the server. Check your internet connection.', 0);
  }
  let payload: any = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new StudioError(payload?.message || payload?.error || `Server error (${response.status})`, response.status, payload?.code, payload?.data);
  return payload as T;
}

export const studioApi = {
  list: () => call<{ items: StudioItem[] }>('GET', 'files').then(r => r.items),
  read: (path: string) => call<StudioFile>('GET', 'file', { query: { path } }),
  save: (path: string, content: string, etag?: string | null, mode: 'save' | 'create' = 'save') =>
    call<SaveResult>('PUT', 'file', { body: { path, content, etag: etag || undefined, mode } }),
  remove: (path: string) => call<{ path: string }>('DELETE', 'file', { query: { path } }),
  mkdir: (path: string) => call<{ path: string }>('POST', 'folder', { body: { path } }),
  move: (from: string, to: string) => call<{ from: string; to: string }>('POST', 'move', { body: { from, to } }),
  versions: (path: string) => call<{ versions: StudioVersion[] }>('GET', 'versions', { query: { path } }).then(r => r.versions),
  version: (path: string, id: string) => call<{ content: string }>('GET', 'version', { query: { path, id } }),
  translate: (fields: { id: string; text: string }[], passcode?: string, mode: 'fields' | 'html' = 'fields') =>
    call<{ translations: { id: string; text: string }[] }>('POST', 'translate', { body: { fields, mode }, headers: passcode ? { 'X-Studio-Passcode': passcode } : {}, timeout: 120000 }),
};

/** Path helpers shared by the file manager (mirror the server's rules). */
export const NAME_PATTERN = /^[\p{L}\p{M}\p{N} _\-.()&]+$/u;

export function validName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.startsWith('.') || n.length > 120 || !NAME_PATTERN.test(n)) return 'Use only letters, numbers, spaces and - _ . ( ) &.';
  return null;
}

export function joinPath(folder: string, name: string): string {
  return [folder, name.trim()].filter(Boolean).join('/');
}

export function withHtml(name: string): string {
  return /\.html$/i.test(name) ? name : name + '.html';
}

export function baseName(path: string): string {
  return path.split('/').pop() || path;
}

export function parentPath(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function displayName(path: string): string {
  return baseName(path).replace(/\.html$/i, '');
}

export interface TreeNode { name: string; path: string; type: 'file' | 'folder'; modified: number; size?: number; children: TreeNode[] }

/** Turn the server's flat list into a sorted tree (folders first). */
export function buildTree(items: StudioItem[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'folder', modified: 0, children: [] };
  const folders = new Map<string, TreeNode>([['', root]]);
  const ensureFolder = (path: string): TreeNode => {
    const existing = folders.get(path);
    if (existing) return existing;
    const node: TreeNode = { name: baseName(path), path, type: 'folder', modified: 0, children: [] };
    folders.set(path, node);
    ensureFolder(parentPath(path)).children.push(node);
    return node;
  };
  for (const item of [...items].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    if (item.type === 'folder') ensureFolder(item.path).modified = item.modified;
    else ensureFolder(parentPath(item.path)).children.push({ name: baseName(item.path), path: item.path, type: 'file', modified: item.modified, size: item.size, children: [] });
  }
  const sort = (node: TreeNode) => {
    node.children.sort((a, b) => a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    node.children.forEach(sort);
  };
  sort(root);
  return root.children;
}
