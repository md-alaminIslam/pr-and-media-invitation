import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { DocModel, FONT_LINK, documentCss } from '../editor/doc';
import { sanitizeEditorHtml } from '../editor/sanitize';
import { textToBody } from '../editor/importers';
import { SHEET_CSS, flowBoxes, movableBoxes, moveBox, paginate, stripPagination } from '../editor/paginate';

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
${SHEET_CSS}
html{overflow:hidden}
body.sv-doc{outline:none;caret-color:#4f46e5}
[data-sv-grip]{position:absolute;z-index:50;width:20px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#4f46e5;color:#fff;font:700 12px/1 Inter,system-ui,sans-serif;cursor:ns-resize;user-select:none;box-shadow:0 1px 3px rgba(0,0,0,.25);opacity:.85}
[data-sv-grip]:hover{opacity:1}
.sv-textbox{outline:1px dashed rgba(79,70,229,.35);outline-offset:1px}
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
  /** Canvas integration: wheel/zoom forwarding, focus and hover reporting. */
  onWheel?: (e: WheelEvent, frame: HTMLIFrameElement) => void;
  onActivate?: () => void;
  onHoverField?: (key: string | null) => void;
  onBlurDoc?: () => void;
  framed?: boolean;
}

export const VisualEditor = forwardRef<EditorApi, Props>(function VisualEditor({ docKey, model, initialBody, showFields, zoom, onChange, onState, onSave, extraCss, onFieldClick, onLoaded, onWheel, onActivate, onHoverField, onBlurDoc, framed = true }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const lastRange = useRef<Range | null>(null);
  const changeTimer = useRef<number | undefined>(undefined);
  const cb = useRef({ onChange, onState, onSave, onFieldClick, onLoaded, onWheel, onActivate, onHoverField, onBlurDoc });
  cb.current = { onChange, onState, onSave, onFieldClick, onLoaded, onWheel, onActivate, onHoverField, onBlurDoc };
  const pendingBody = useRef<string | null>(initialBody);
  const live = useRef({ model, showFields, extraCss });
  live.current = { model, showFields, extraCss };

  const doc = () => frame.current?.contentDocument || null;
  const body = () => doc()?.body || null;

  const resize = () => {
    const f = frame.current, b = body();
    if (f && b) f.style.height = Math.max(b.scrollHeight, 1123) + 'px';
  };

  // A4 sheets + movable text boxes.
  const layoutTimer = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const grips = useRef<HTMLDivElement | null>(null);
  const refreshGrips = () => {
    const d = doc(); const layer = grips.current; if (!d || !layer) return;
    const boxes = movableBoxes(d.body);
    while (layer.children.length > boxes.length) layer.lastElementChild!.remove();
    boxes.forEach((box, i) => {
      let g = layer.children[i] as HTMLDivElement | undefined;
      if (!g) {
        g = d.createElement('div');
        g.setAttribute('data-sv-grip', '');
        g.title = 'Drag to move this box up or down — text always flows below it';
        g.textContent = '⇕';
        layer.appendChild(g);
        g.addEventListener('pointerdown', e => {
          const target = (g as any).__box as HTMLElement | undefined;
          if (!target) return;
          e.preventDefault(); e.stopPropagation();
          g!.setPointerCapture(e.pointerId);
          dragging.current = true;
          const start = { y: e.clientY, top: target.getBoundingClientRect().top };
          const move = (ev: PointerEvent) => { moveBox(target, start.top + ev.clientY - start.y); refreshGrips(); resize(); };
          const up = (ev: PointerEvent) => {
            g!.removeEventListener('pointermove', move); g!.removeEventListener('pointerup', up); g!.removeEventListener('pointercancel', up);
            try { g!.releasePointerCapture(ev.pointerId); } catch {}
            dragging.current = false;
            scheduleChange(); layout();
          };
          g!.addEventListener('pointermove', move); g!.addEventListener('pointerup', up); g!.addEventListener('pointercancel', up);
        });
      }
      (g as any).__box = box;
      const r = box.getBoundingClientRect();
      const w = d.defaultView!;
      g.style.left = Math.max(2, r.left + w.scrollX - 26) + 'px';
      g.style.top = (r.top + w.scrollY) + 'px';
      g.style.height = Math.max(24, Math.min(r.height, 80)) + 'px';
    });
  };
  const layout = () => {
    window.clearTimeout(layoutTimer.current);
    layoutTimer.current = window.setTimeout(() => {
      const d = doc(); if (!d || dragging.current) return;
      paginate(d, live.current.model.margins);
      refreshGrips();
      resize();
    }, 60);
  };

  const flushChange = () => {
    window.clearTimeout(changeTimer.current);
    const b = body();
    if (b) cb.current.onChange(stripPagination(b.innerHTML.replace(/\scontenteditable="false"/g, '')));
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
    layout();
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
      f.contentWindow?.addEventListener('blur', () => { flushChange(); cb.current.onBlurDoc?.(); });
      f.contentWindow?.addEventListener('focus', () => cb.current.onActivate?.());
      d.addEventListener('mousedown', () => cb.current.onActivate?.());
      d.addEventListener('wheel', e => { if (cb.current.onWheel) { e.preventDefault(); cb.current.onWheel(e, f); } }, { passive: false });
      let lastHover: string | null = null;
      d.addEventListener('mouseover', e => {
        const el = (e.target as HTMLElement)?.closest?.('[data-guest],[data-field]') as HTMLElement | null;
        const k = !el ? null : el.hasAttribute('data-guest') ? `specialGuests:${el.getAttribute('data-guest')}` : el.getAttribute('data-field');
        if (k !== lastHover) { lastHover = k; cb.current.onHoverField?.(k); }
      });
      d.documentElement.addEventListener('mouseleave', () => { if (lastHover) { lastHover = null; cb.current.onHoverField?.(null); } });
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
      // Typing over a whole linked value (e.g. select a name and retype it) must stay inside
      // the value, or the browser drops the link and the change is never picked up.
      d.addEventListener('beforeinput', e => {
        if (!/^(insertText|insertReplacementText|insertFromPaste|deleteContentBackward|deleteContentForward|deleteByCut|deleteWordBackward|deleteWordForward)$/.test(e.inputType)) return;
        const sel = d.getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return;
        const r = sel.getRangeAt(0);
        const picked = r.toString().replace(/\s+/g, ' ').trim();
        if (!picked) return;
        const slots = Array.from(d.body.querySelectorAll<HTMLElement>('[data-guest],[data-field]')).filter(el => r.intersectsNode(el) && el.getAttribute('contenteditable') !== 'false');
        // The innermost value whose whole text is selected (a guest before its list).
        const slot = slots.reverse().find(el => (el.textContent || '').replace(/\s+/g, ' ').trim() === picked);
        if (!slot) return;
        const text = e.inputType.startsWith('delete') ? '' : (e.data ?? e.dataTransfer?.getData('text/plain') ?? '').replace(/\s*\n\s*/g, ' ');
        e.preventDefault();
        const walker = d.createTreeWalker(slot, NodeFilter.SHOW_TEXT);
        const texts: Text[] = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
        let target: Text;
        if (texts.length) {
          target = texts.find(t => t.data.trim()) || texts[0];
          target.data = text;
          texts.forEach(t => { if (t !== target) t.remove(); });
          // Drop empty wrappers left behind, but keep the one holding the text.
          slot.querySelectorAll('*').forEach(el => { if (!el.contains(target) && !(el.textContent || '').length && !/^(BR|IMG)$/.test(el.tagName)) el.remove(); });
        } else {
          target = d.createTextNode(text); slot.appendChild(target);
        }
        const nr = d.createRange(); nr.setStart(target, text.length); nr.collapse(true);
        sel.removeAllRanges(); sel.addRange(nr);
        scheduleChange(); computeState();
      });
      const layer = d.createElement('div');
      layer.setAttribute('data-sv-ui', '');
      d.documentElement.appendChild(layer); // outside <body>, so it is never saved
      grips.current = layer;
      new (d.defaultView as any).MutationObserver(() => layout()).observe(d.body, { childList: true, subtree: true, characterData: true });
      // Floating boxes (text boxes from Word) can be dragged up and down by a handle.
      d.addEventListener('paste', e => {
        const html = e.clipboardData?.getData('text/html');
        const text = e.clipboardData?.getData('text/plain') || '';
        e.preventDefault();
        if (html) d.execCommand('insertHTML', false, sanitizeEditorHtml(html.replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi, '')));
        else if (/\n/.test(text)) d.execCommand('insertHTML', false, textToBody(text));
        else d.execCommand('insertText', false, text);
        scheduleChange();
      });
      d.fonts?.ready.then(() => { if (flowBoxes(d)) scheduleChange(); layout(); });
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
    if (flowBoxes(doc()!)) scheduleChange();
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
    getBody: () => stripPagination((body()?.innerHTML ?? '').replace(/\scontenteditable="false"/g, '')),
    doc: () => doc(),
    setBody: html => { const b = body(); if (b) { b.innerHTML = html || '<p><br></p>'; flowBoxes(doc()!); scheduleChange(); layout(); } },
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
    <div style={zoom !== 1 ? ({ zoom } as React.CSSProperties) : undefined} className={framed ? 'mx-auto w-[210mm]' : 'w-[210mm]'}>
      <div className="[filter:drop-shadow(0_1px_2px_rgb(24_24_27/0.12))_drop-shadow(0_6px_14px_rgb(24_24_27/0.08))]">
        <iframe ref={frame} title="Document editor" className="block w-[210mm] border-0 bg-transparent" style={{ height: '297mm' }} />
      </div>
    </div>
  );
});
