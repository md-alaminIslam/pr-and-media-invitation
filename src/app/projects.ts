import { DocModel, emptyDoc, serializeDoc } from '../editor/doc';
import { fileToDoc } from '../editor/importers';
import { Store } from '../editor/store';
import { PROJECT_DOCS, blankDocs, standardDocs } from '../editor/templates';
import { StudioItem, validName } from '../utils/studioServer';
import { EXAMPLE_DOCUMENTS, fetchExampleFile } from '../utils/exampleDocuments';

export interface ProjectSummary { name: string; docs: string[]; modified: number; size: number }

export function summarizeProjects(items: StudioItem[]): ProjectSummary[] {
  const projects = new Map<string, ProjectSummary>();
  for (const item of items) {
    const parts = item.path.split('/');
    if (item.type === 'folder' && parts.length === 1) {
      const p = projects.get(item.path) || { name: item.path, docs: [], modified: 0, size: 0 };
      p.modified = Math.max(p.modified, item.modified);
      projects.set(item.path, p);
    }
  }
  for (const item of items) {
    const parts = item.path.split('/');
    if (item.type === 'file' && parts.length === 2 && projects.has(parts[0]) && /\.html$/i.test(parts[1])) {
      const p = projects.get(parts[0])!;
      p.docs.push(parts[1]);
      p.modified = Math.max(p.modified, item.modified);
      p.size += item.size || 0;
    }
  }
  return [...projects.values()].sort((a, b) => b.modified - a.modified);
}

/** Make a file/folder name safe for the server and unique among `taken`. */
export function uniqueName(wanted: string, taken: Iterable<string>, suffix = ''): string {
  const set = new Set(Array.from(taken, t => t.toLowerCase()));
  const base = wanted.replace(/[^\p{L}\p{M}\p{N} _\-.()&]+/gu, ' ').replace(/\s+/g, ' ').replace(/^\.+/, '').trim().slice(0, 100) || 'Untitled';
  let name = base + suffix, n = 2;
  while (set.has(name.toLowerCase())) name = `${base} (${n++})${suffix}`;
  return name;
}

export { validName };

export type TemplateId = 'standard' | 'blank' | 'bimox' | 'upload';

const EXAMPLE_FILE: Record<string, string> = {
  'invitation-bn': 'Invitation (Bangla).html', 'invitation-en': 'Invitation (English).html',
  'press-release-bn': 'Press Release (Bangla).html', 'press-release-en': 'Press Release (English).html',
};

export async function buildDocs(template: TemplateId, uploads: File[] = []): Promise<{ file: string; model: DocModel }[]> {
  if (template === 'standard') return standardDocs().map(d => ({ file: d.spec.file, model: d.model }));
  if (template === 'blank') return blankDocs().map(d => ({ file: d.spec.file, model: d.model }));
  if (template === 'bimox') {
    return Promise.all(EXAMPLE_DOCUMENTS.map(async ex => {
      const model = await fileToDoc(await fetchExampleFile(ex));
      const spec = PROJECT_DOCS.find(p => p.file === EXAMPLE_FILE[ex.type])!;
      model.title = ex.title; model.lang = spec.lang;
      return { file: spec.file, model };
    }));
  }
  const taken: string[] = [];
  const out: { file: string; model: DocModel }[] = [];
  for (const f of uploads) {
    const model = await fileToDoc(f);
    const file = uniqueName(f.name.replace(/\.[^.]+$/, ''), taken, '.html');
    taken.push(file);
    out.push({ file, model });
  }
  return out;
}

export async function createProject(store: Store, name: string, existing: string[], template: TemplateId, uploads: File[] = []): Promise<{ project: string; first: string }> {
  const docs = await buildDocs(template, uploads);
  if (!docs.length) throw new Error('Add at least one file.');
  const project = uniqueName(name, existing);
  await store.mkdir(project);
  for (const d of docs) await store.save(`${project}/${d.file}`, serializeDoc(d.model), null, 'create');
  return { project, first: docs[0].file };
}

export function blankDoc(lang: 'bn' | 'en'): DocModel {
  return emptyDoc(lang === 'bn' ? 'নতুন ডকুমেন্ট' : 'New document', lang);
}

export const DETECT_FLAG = 'savor-detect-on-open:';
/** Ask the project screen to look for shared fields the first time it opens. */
export const requestDetectOnOpen = (project: string) => { try { sessionStorage.setItem(DETECT_FLAG + project, '1'); } catch {} };
