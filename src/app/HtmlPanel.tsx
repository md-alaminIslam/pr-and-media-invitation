import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, X } from 'lucide-react';
import { DocModel } from '../editor/doc';
import { FIELD, FIELD_DEFS, Lang, ProjectValues, guestText, scalarText } from '../editor/values';
import { IconButton, cn } from '../ui/ui';

/* ---------- Building the code ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const noDashes = (s: string) => s.replace(/--+/g, '–'); // keep HTML comments valid

function valueLabel(key: string, lang: Lang): string {
  const def = FIELD.get(key);
  return def ? `${def.label} (shared)` : key;
}

/** One document's body as readable HTML: one block per line, every shared value labelled. */
function bodyCode(body: string, values: ProjectValues): string {
  const t = document.createElement('template');
  t.innerHTML = body;
  const n = values.specialGuests.length;
  t.content.querySelectorAll<HTMLElement>('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field')!;
    el.setAttribute('data-label', key === 'specialGuests' ? `Special guests list (shared, ${n} in order)` : key === 'chiefGuest' ? 'Chief guest (shared)' : valueLabel(key, 'en'));
  });
  t.content.querySelectorAll<HTMLElement>('[data-guest]').forEach(el => {
    const i = +(el.getAttribute('data-guest') || 0);
    el.setAttribute('data-label', `Special guest ${i} of ${n}`);
  });
  const blocks: string[] = [];
  t.content.childNodes.forEach(node => {
    const html = node.nodeType === 1 ? (node as Element).outerHTML : node.nodeType === 3 ? esc(node.textContent || '') : '';
    if (html.trim()) blocks.push(html.replace(/<br>(?!\n)/g, '<br>\n'));
  });
  return blocks.join('\n\n');
}

function valuesSummary(values: ProjectValues, lang: Lang): string {
  const lines: string[] = [];
  for (const f of FIELD_DEFS) {
    if (f.type === 'guest' || f.type === 'guests') continue;
    const v = f.key === 'contactPhone' ? values.contactPhone : scalarText(values, f.key, lang);
    lines.push(`    ${(f.label + ':').padEnd(22)} ${v || '(empty)'}`);
  }
  lines.push(`    ${'Chief guest:'.padEnd(22)} ${values.chiefGuest ? guestText(values.chiefGuest, lang) : '(none)'}`);
  lines.push(`    Special guests — printed in this exact order (${values.specialGuests.length}):`);
  values.specialGuests.forEach((g, i) => lines.push(`      ${String(i + 1).padStart(2)}. ${guestText(g, lang)}`));
  return noDashes(lines.join('\n'));
}

export interface CodeDoc { file: string; label: string; model: DocModel }

export function buildCode(lang: Lang, docs: CodeDoc[], values: ProjectValues): string {
  const mine = docs.filter(d => d.model.lang === lang);
  const head = `<!--
  ${lang === 'en' ? 'ENGLISH' : 'BANGLA (বাংলা)'} DOCUMENTS · ${mine.length} document${mine.length === 1 ? '' : 's'}: ${noDashes(mine.map(d => d.label).join(' · '))}

  HOW THIS WORKS
  • Each <section data-document="…"> is one whole document. Edit any HTML inside it.
  • Text inside <span data-field="…"> is a SHARED VALUE. Change it here and it changes in
    all four documents. ${lang === 'en' ? 'The Bangla documents are re-translated when Auto-translate is on.' : 'Bangla you type here is kept as your own translation.'}
  • <span data-guest="N"> is special guest number N. The number is the printed order.
  • data-label="…" only explains what a value is. It is not saved.
  • Don't remove or rename the <section> tags.

  SHARED VALUES RIGHT NOW (${lang === 'en' ? 'English' : 'Bangla'})
${valuesSummary(values, lang)}
-->`;
  const parts = mine.map((d, i) => `

<!-- ════════ DOCUMENT ${i + 1} of ${mine.length}: ${noDashes(d.label)} · file "${noDashes(d.file)}" · ${lang === 'en' ? 'English' : 'Bangla'} ════════ -->
<section data-document="${esc(d.file)}">
${bodyCode(d.model.body, values)}
</section>
<!-- ════════ END OF DOCUMENT ${i + 1}: ${noDashes(d.label)} ════════ -->`);
  return head + parts.join('');
}

/** Split edited code back into document bodies (file → body), without the labels and line breaks we added. */
export function parseCode(code: string): Map<string, string> {
  const t = document.createElement('template');
  t.innerHTML = code;
  const out = new Map<string, string>();
  t.content.querySelectorAll<HTMLElement>('section[data-document]').forEach(sec => {
    sec.querySelectorAll('[data-label]').forEach(el => el.removeAttribute('data-label'));
    // Whitespace-only text between blocks and the line breaks after <br> were only for reading.
    Array.from(sec.childNodes).forEach(n => { if (n.nodeType === 3 && !(n.textContent || '').trim()) n.remove(); });
    sec.querySelectorAll('br').forEach(br => {
      const next = br.nextSibling;
      if (next && next.nodeType === 3) next.textContent = (next.textContent || '').replace(/^\n/, '');
    });
    out.set(sec.getAttribute('data-document') || '', sec.innerHTML);
  });
  return out;
}

/* ---------- Panel ---------- */

function CodeBox({ lang, code, onApply }: { lang: Lang; code: string; onApply: (code: string) => void }) {
  const [text, setText] = useState(code);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // Follow the documents unless you're in the middle of editing here.
  useEffect(() => { if (!focused && !pending) setText(code); }, [code, focused, pending]);
  const change = (v: string) => {
    setText(v);
    setPending(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { onApply(v); setPending(false); }, 900);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', lang === 'en' ? 'bg-zinc-200 text-zinc-700' : 'bg-indigo-100 text-indigo-700')}>{lang === 'en' ? 'English' : 'বাংলা · Bangla'}</span>
        <span className="text-[11px] text-zinc-500">{pending ? 'Applying…' : focused ? 'Editing — changes apply as you type' : 'Up to date'}</span>
      </div>
      <textarea value={text} spellCheck={false} aria-label={lang === 'en' ? 'English documents HTML' : 'Bangla documents HTML'}
        onChange={e => change(e.target.value)} onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (pending) { window.clearTimeout(timer.current); onApply(text); setPending(false); } }}
        className="sv-scroll mx-2 mb-2 min-h-0 flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-100 outline-none focus:ring-4 focus:ring-indigo-200"
        lang={lang} />
    </div>
  );
}

export function HtmlPanel({ docs, values, onApply, onClose }: {
  docs: CodeDoc[];
  values: ProjectValues;
  /** Called with the documents whose HTML changed. */
  onApply: (changes: { file: string; body: string }[]) => void;
  onClose: () => void;
}) {
  const en = useMemo(() => buildCode('en', docs, values), [docs, values]);
  const bn = useMemo(() => buildCode('bn', docs, values), [docs, values]);
  const apply = (code: string) => {
    const parsed = parseCode(code);
    const changes: { file: string; body: string }[] = [];
    parsed.forEach((body, file) => {
      const d = docs.find(x => x.file === file);
      if (!d) return;
      // Compare against our own rendering, so untouched documents are left alone.
      const original = parseCode(`<section data-document="${esc(file)}">\n${bodyCode(d.model.body, values)}\n</section>`).get(file);
      if (body !== original) changes.push({ file, body });
    });
    if (changes.length) onApply(changes);
  };
  return (
    <aside className="flex w-[min(560px,38vw)] min-w-[320px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-100">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-zinc-200 bg-white px-2">
        <Code2 className="size-4 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-800">HTML · all documents</span>
        <IconButton label="Close HTML panel" className="ml-auto" onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      <CodeBox lang="en" code={en} onApply={apply} />
      <div className="mx-3 h-px bg-zinc-300" />
      <CodeBox lang="bn" code={bn} onApply={apply} />
    </aside>
  );
}
