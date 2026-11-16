// Write shared values into documents (live DOM or saved HTML) and read
// direct edits back out of them. Browser-only.

import { FIELD, GuestSep, Lang, ProjectValues, TextKey, slotHtml } from './values';

const norm = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** Update every linked slot under `root`. Returns true when something changed. */
export function applyValuesToRoot(root: ParentNode, lang: Lang, values: ProjectValues, opts: { lockStructured?: boolean } = {}): boolean {
  let changed = false;
  root.querySelectorAll<HTMLElement>('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field')!;
    const def = FIELD.get(key);
    if (!def) return;
    if (opts.lockStructured) {
      // In the editor, only plain-text fields are typed into directly; the rest are edited in the panel.
      if (def.type !== 'text' && def.type !== 'phone') el.setAttribute('contenteditable', 'false');
    }
    if (el.hasAttribute('data-override')) return;
    const html = slotHtml(values, key, lang, {
      fmt: el.getAttribute('data-fmt') || undefined,
      sep: (el.getAttribute('data-sep') as GuestSep) || undefined,
      bold: el.getAttribute('data-bold') === '1',
    });
    if (def.type === 'text' || def.type === 'phone') {
      // Text slots: compare text so we don't disturb formatting or the caret.
      const tmp = document.createElement('span'); tmp.innerHTML = html;
      if (norm(el.textContent || '') === norm(tmp.textContent || '')) return;
    } else if (el.innerHTML === html) return;
    el.innerHTML = html;
    changed = true;
  });
  return changed;
}

export function applyValuesToBody(body: string, lang: Lang, values: ProjectValues): string {
  if (!body.includes('data-field')) return body;
  const t = document.createElement('template');
  t.innerHTML = body;
  return applyValuesToRoot(t.content, lang, values) ? t.innerHTML : body;
}

/** Text typed straight into linked text fields that differs from the shared value. */
export function readInlineEdits(root: ParentNode, lang: Lang, values: ProjectValues): { key: string; text: string }[] {
  const edits = new Map<string, string>();
  root.querySelectorAll<HTMLElement>('[data-field]').forEach(el => {
    if (el.hasAttribute('data-override')) return;
    const key = el.getAttribute('data-field')!;
    const def = FIELD.get(key);
    if (!def || (def.type !== 'text' && def.type !== 'phone')) return;
    const text = norm(el.textContent || '');
    const current = def.type === 'phone' ? values.contactPhone : (lang === 'bn' ? values.text[key as TextKey]?.bn : values.text[key as TextKey]?.en) || '';
    if (text !== norm(current) && !/^\[.*\]$/.test(text) && !edits.has(key)) edits.set(key, text);
  });
  return [...edits].map(([key, text]) => ({ key, text }));
}

export interface SlotInfo { key: string; count: number; overrides: number }

/** How often each field is used in a body (and how many places keep their own text). */
export function slotUsage(body: string): Record<string, { count: number; overrides: number }> {
  const out: Record<string, { count: number; overrides: number }> = {};
  const re = /<span\b[^>]*\bdata-field="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const e = (out[m[1]] ||= { count: 0, overrides: 0 });
    e.count++;
    if (/\bdata-override="1"/.test(m[0])) e.overrides++;
  }
  return out;
}

/** Remove the per-document override of a field so it follows the shared value again. */
export function clearOverrides(body: string, key: string): string {
  const t = document.createElement('template');
  t.innerHTML = body;
  let changed = false;
  t.content.querySelectorAll(`[data-field="${key}"][data-override]`).forEach(el => { el.removeAttribute('data-override'); changed = true; });
  return changed ? t.innerHTML : body;
}

/** Strip editor-only attributes before saving. */
export const cleanEditorHtml = (html: string) => html.replace(/\scontenteditable="false"/g, '');
