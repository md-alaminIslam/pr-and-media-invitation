import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DocModel, FONT_LINK, documentCss } from '../editor/doc';
import { sanitizeEditorHtml } from '../editor/sanitize';
import { textToBody } from '../editor/importers';

export interface ToolbarState {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean;
  block: string; align: string; font: string; size: number;
  ul: boolean; ol: boolean; hasSelection: boolean; inTable: boolean;
}

export const EMPTY_STATE: ToolbarState = { bold: false, italic: false, underline: false, strike: false, block: 'p', align: 'left', font: '', size: 12, ul: false, ol: false, hasSelection: false, inTable: false };

export interface EditorApi {
  exec: (cmd: string, value?: string) => void;
  setBlock: (tag: string) => void;
  setFontSize: (pt: number) => void;
  insertHtml: (html: string) => void;
  getBody: () => string;
  setBody: (html: string) => void;
  getSelectionHtml: () => string;
  getSelectionText: () => string;
  replaceSelection: (html: string) => void;
  linkSelectionToField: (key: string) => string | null;
  doc: () => Document | null;
  tableAction: (action: 'row-above' | 'row-below' | 'col-left' | 'col-right' | 'del-row' | 'del-col' | 'del-table') => void;
  root: () => HTMLElement | null;
  focus: () => void;
}

const EDITOR_CSS = `
html{background:transparent;overflow:hidden}
body.sv-doc{margin:0;outline:none;max-width:none;min-height:297mm;caret-color:#4f46e5;
 background-color:#fff;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(297mm - 1px),#e4e4e7 calc(297mm - 1px),#e4e4e7 297mm)}
body.sv-hide-fields [data-field],body.sv-hide-fields [data-guest]{background:none!important;box-shadow:none!important;border-bottom:none!important}
body.sv-hide-fields [data-guest]::after{content:none!important}
[contenteditable="false"][data-field]{cursor:pointer}
body.sv-doc hr.sv-page-break{height:0;border:none;border-top:1.5px dashed #a5b4fc;margin:14px 0}
body.sv-doc td,body.sv-doc th{min-width:24px}
body.sv-doc table.sv-plain td,body.sv-doc table.sv-plain th{outline:1px dashed #e4e4e7;outline-offset:-1px}
body.sv-doc img:hover{outline:2px solid #a5b4fc}
::selection{background:#c7d2fe}
`;

interface Props {
  extraCss?: string;
  onFieldClick?: (key: string, override: boolean) => void;
  onLoaded?: (root: HTMLElement) => void;
  docKey: string;
  model: DocModel;
  initialBody: string;
  showFields: boolean;
  zoom: number;
  onChange: (body: string) => void;
  onState: (state: ToolbarState) => void;
  onSave: () => void;
}

export const VisualEditor = forwardRef<EditorApi, Props>(function VisualEditor({ docKey, model, initialBody, showFields, zoom, onChange, onState, onSave, extraCss, onFieldClick, onLoaded }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const lastRange = useRef<Range | null>(null);
  const changeTimer = useRef<number | undefined>(undefined);
  const cb = useRef({ onChange, onState, onSave, onFieldClick, onLoaded });
  cb.current = { onChange, onState, onSave, onFieldClick, onLoaded };
  const pendingBody = useRef<string | null>(initialBody);
  const live = useRef({ model, showFields, extraCss });
  live.current = { model, showFields, extraCss };

  const doc = () => frame.current?.contentDocument || null;
  const body = () => doc()?.body || null;

  const resize = () => {
    const f = frame.current, b = body();
    if (f && b) f.style.height = Math.max(b.scrollHeight, 1123) + 'px';
  };

  const flushChange = () => {
    window.clearTimeout(changeTimer.current);
    const b = body();
    if (b) cb.current.onChange(b.innerHTML.replace(/\scontenteditable="false"/g, ''));
  };
  const scheduleChange = () => {
    window.clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(flushChange, 300);
    resize();
  };

  const restoreSelection = () => {
    const d = doc(); const w = frame.current?.contentWindow;
    if (!d || !w) return;
    w.focus();
    const sel = d.getSelection();
    if (lastRange.current && sel && (!sel.rangeCount || !d.body.contains(sel.anchorNode))) {
      sel.removeAllRanges(); sel.addRange(lastRange.current);
    }
  };

  const computeState = () => {
    const d = doc(); if (!d) return;
    const sel = d.getSelection();
    if (sel && sel.rangeCount && d.body.contains(sel.anchorNode)) lastRange.current = sel.getRangeAt(0).cloneRange();
    let el: Element | null = sel?.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode.parentElement) : null;
    if (!el || !d.body.contains(el)) el = d.body;
    const block = el.closest('p,h1,h2,h3,h4,h5,h6,blockquote,li,pre,td,th,div') as HTMLElement | null;
    const cs = d.defaultView!.getComputedStyle(el);
    const q = (c: string) => { try { return d.queryCommandState(c); } catch { return false; } };
    cb.current.onState({
      bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
      block: block && /^(H[1-6]|BLOCKQUOTE|PRE|P)$/.test(block.tagName) ? block.tagName.toLowerCase() : 'p',
      align: block ? d.defaultView!.getComputedStyle(block).textAlign.replace('start', 'left').replace('end', 'right') : 'left',
      font: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      size: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2,
      ul: q('insertUnorderedList'), ol: q('insertOrderedList'),
      hasSelection: !!sel && !sel.isCollapsed,
      inTable: !!el.closest('td,th'),
    });
  };

  const applyCss = () => {
    const d = doc(); if (!d) return;
    const { model: m, showFields: show } = live.current;
    const style = d.getElementById('sv-doc-css');
    if (style) style.textContent = documentCss(m) + '\n' + (live.current.extraCss || '');
    d.documentElement.lang = m.lang;
    d.body.classList.toggle('sv-hide-fields', !show);
    requestAnimationFrame(resize);
  };

  // Build the editing frame once.
  useEffect(() => {
    const f = frame.current!;
    f.srcdoc = `<!DOCTYPE html><html lang="${model.lang}"><head><meta charset="utf-8"><link rel="stylesheet" href="${FONT_LINK}"><style id="sv-doc-css"></style><style>${EDITOR_CSS}</style></head><body class="sv-doc" contenteditable="true" spellcheck="true"></body></html>`;
    const onLoad = () => {
      const d = f.contentDocument!;
      ready.current = true;
      try { d.execCommand('styleWithCSS', false, 'true'); d.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
      d.addEventListener('input', scheduleChange);
      d.addEventListener('selectionchange', computeState);
      d.addEventListener('keyup', computeState);
      d.addEventListener('mouseup', computeState);
      d.addEventListener('blur', flushChange, true);
      d.addEventListener('click', e => {
        const el = (e.target as HTMLElement)?.closest?.('[data-guest],[data-field]') as HTMLElement | null;
        if (!el) return;
        const field = el.closest('[data-field]') as HTMLElement | null;
        const key = el.hasAttribute('data-guest') ? `specialGuests:${el.getAttribute('data-guest')}` : field?.getAttribute('data-field');
        if (key) cb.current.onFieldClick?.(key, !!field?.hasAttribute('data-override'));
      });
      d.addEventListener('keydown', e => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); flushChange(); cb.current.onSave(); return; }
        if (e.key === 'Tab') {
          e.preventDefault();
          const inList = (d.getSelection()?.anchorNode?.parentElement)?.closest('li');
          if (inList) d.execCommand(e.shiftKey ? 'outdent' : 'indent');
          else if (!e.shiftKey) d.execCommand('insertHTML', false, '<span style="display:inline-block;width:0.5in"></span>');
          scheduleChange();
        }
      });
      d.addEventListener('paste', e => {
        const html = e.clipboardData?.getData('text/html');
        const text = e.clipboardData?.getData('text/plain') || '';
        e.preventDefault();
        if (html) d.execCommand('insertHTML', false, sanitizeEditorHtml(html.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi, '')));
        else if (/\n/.test(text)) d.execCommand('insertHTML', false, textToBody(text));
        else d.execCommand('insertText', false, text);
        scheduleChange();
      });
      d.fonts?.ready.then(resize);
      new (d.defaultView as any).ResizeObserver(resize).observe(d.body);
      applyCss();
      if (pendingBody.current !== null) { d.body.innerHTML = pendingBody.current || '<p><br></p>'; pendingBody.current = null; }
      cb.current.onLoaded?.(d.body);
      resize();
      computeState();
    };
    f.addEventListener('load', onLoad, { once: true });
    return () => { window.clearTimeout(changeTimer.current); };
  }, []);

  // Switch document.
  useEffect(() => {
    if (!ready.current) { pendingBody.current = initialBody; return; }
    const b = body(); if (!b) return;
    b.innerHTML = initialBody || '<p><br></p>';
    lastRange.current = null;
    cb.current.onLoaded?.(b);
    applyCss();
    frame.current?.closest('.sv-canvas')?.scrollTo?.({ top: 0 });
    computeState();
  }, [docKey]);

  useEffect(() => { if (ready.current) applyCss(); }, [model.font, model.fontSize, model.margins.top, model.margins.right, model.margins.bottom, model.margins.left, model.lang, showFields, extraCss]);

  useImperativeHandle(ref, () => ({
    exec: (cmd, value) => {
      const d = doc(); if (!d) return;
      restoreSelection();
      d.execCommand(cmd, false, value);
      scheduleChange(); computeState();
    },
    setBlock: tag => {
      const d = doc(); if (!d) return;
      restoreSelection();
      d.execCommand('formatBlock', false, `<${tag}>`);
      scheduleChange(); computeState();
    },
    setFontSize: pt => {
      const d = doc(); if (!d) return;
      restoreSelection();
      d.execCommand('fontSize', false, '7');
      d.body.querySelectorAll('font[size="7"]').forEach(el => {
        const span = d.createElement('span');
        span.style.fontSize = pt + 'pt';
        while (el.firstChild) span.appendChild(el.firstChild);
        el.replaceWith(span);
      });
      d.body.querySelectorAll<HTMLElement>('[style*="xxx-large"]').forEach(el => { el.style.fontSize = pt + 'pt'; });
      scheduleChange(); computeState();
    },
    insertHtml: html => {
      const d = doc(); if (!d) return;
      restoreSelection();
      d.execCommand('insertHTML', false, html);
      scheduleChange(); computeState();
    },
    getBody: () => (body()?.innerHTML ?? '').replace(/\scontenteditable="false"/g, ''),
    doc: () => doc(),
    setBody: html => { const b = body(); if (b) { b.innerHTML = html || '<p><br></p>'; scheduleChange(); } },
    getSelectionHtml: () => {
      const d = doc(); const sel = d?.getSelection();
      const range = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : lastRange.current;
      if (!d || !range || range.collapsed) return '';
      const div = d.createElement('div'); div.appendChild(range.cloneContents());
      return div.innerHTML;
    },
    getSelectionText: () => {
      const d = doc(); const sel = d?.getSelection();
      const range = sel && sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : lastRange.current;
      return range && !range.collapsed ? range.toString() : '';
    },
    replaceSelection: html => {
      const d = doc(); if (!d) return;
      restoreSelection();
      d.execCommand('insertHTML', false, html);
      scheduleChange();
    },
    linkSelectionToField: key => {
      const d = doc(); if (!d) return null;
      restoreSelection();
      const sel = d.getSelection();
      if (!sel || sel.isCollapsed) return null;
      const text = sel.toString().replace(/\s+$/, '');
      const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      d.execCommand('insertHTML', false, `<span data-field="${key}">${safe}</span>`);
      scheduleChange();
      return text;
    },
    tableAction: action => {
      const d = doc(); if (!d) return;
      restoreSelection();
      const cell = (d.getSelection()?.anchorNode as Node | null);
      const td = (cell?.nodeType === 1 ? cell as Element : cell?.parentElement)?.closest('td,th') as HTMLTableCellElement | null;
      if (!td) return;
      const row = td.parentElement as HTMLTableRowElement;
      const table = td.closest('table') as HTMLTableElement;
      const index = td.cellIndex;
      if (action === 'row-above' || action === 'row-below') {
        const nr = row.cloneNode(true) as HTMLTableRowElement;
        nr.querySelectorAll('td,th').forEach(c => { c.innerHTML = '<br>'; });
        row.parentElement!.insertBefore(nr, action === 'row-above' ? row : row.nextSibling);
      } else if (action === 'col-left' || action === 'col-right') {
        Array.from(table.rows).forEach(r => {
          const ref = r.cells[Math.min(index, r.cells.length - 1)];
          const c = d.createElement(ref?.tagName.toLowerCase() || 'td'); c.innerHTML = '<br>';
          if (ref) r.insertBefore(c, action === 'col-left' ? ref : ref.nextSibling); else r.appendChild(c);
        });
      } else if (action === 'del-row') {
        row.remove(); if (!table.rows.length) table.remove();
      } else if (action === 'del-col') {
        Array.from(table.rows).forEach(r => r.cells[Math.min(index, r.cells.length - 1)]?.remove());
        if (!table.rows[0]?.cells.length) table.remove();
      } else table.remove();
      scheduleChange();
    },
    root: () => body(),
    focus: () => restoreSelection(),
  }));

  return (
    <div style={{ zoom } as React.CSSProperties} className="mx-auto w-[210mm]">
      <div className="overflow-hidden rounded-sm bg-white shadow-page ring-1 ring-zinc-200/70">
        <iframe ref={frame} title="Document editor" className="block w-[210mm] border-0 bg-white" style={{ height: '297mm' }} />
      </div>
    </div>
  );
});
