import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Pencil, Plus } from 'lucide-react';
import { DocModel, documentCss } from '../editor/doc';
import { FIELD_DEFS } from '../editor/values';
import { shortDocLabel } from '../editor/templates';
import { GROUP_COLOR } from './GlobalFieldsPanel';
import type { PDoc } from './useProject';
import { Badge, IconButton, cn } from '../ui/ui';

/** Highlight CSS shared by the canvas pages and the editor. */
export function fieldHighlightCss(scope = ''): string {
  const rules: string[] = [];
  for (const f of FIELD_DEFS) {
    const c = GROUP_COLOR[f.group];
    rules.push(`${scope}[data-field="${f.key}"]{background:${c.tint};box-shadow:inset 0 -1.5px 0 ${c.hex}99;border-radius:2px}`);
  }
  rules.push(`${scope}[data-field="specialGuests"],${scope}[data-field="chiefGuest"]{background:none;box-shadow:none}`);
  rules.push(`${scope}[data-field="chiefGuest"]{background:${GROUP_COLOR.chief.tint};box-shadow:inset 0 -1.5px 0 ${GROUP_COLOR.chief.hex}99}`);
  rules.push(`${scope}[data-guest]{background:${GROUP_COLOR.special.tint};box-shadow:inset 0 -1.5px 0 ${GROUP_COLOR.special.hex}99;border-radius:2px}`);
  rules.push(`${scope}[data-guest]::after{content:attr(data-guest);font-size:.62em;font-weight:700;vertical-align:super;line-height:0;color:${GROUP_COLOR.special.hex};margin-left:1px;font-family:Inter,sans-serif}`);
  rules.push(`${scope}[data-override]{box-shadow:none!important;border-bottom:1.5px dashed #d97706}`);
  rules.push(`${scope}[data-field]{cursor:pointer}`);
  return rules.join('\n');
}

const PAGE_W = 794; // 210mm at 96dpi
const GAP = 72;

function DocPage({ doc, hoverKey, selectedKey, flash, onFieldHover, onFieldClick, onOpen, showHighlights }: {
  doc: PDoc; hoverKey: string | null; selectedKey: string | null; flash: { keys: string[]; n: number };
  onFieldHover: (k: string | null) => void; onFieldClick: (k: string) => void; onOpen: () => void; showHighlights: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const shadow = useRef<ShadowRoot | null>(null);
  const page = useRef<HTMLDivElement | null>(null);
  const dynamic = useRef<HTMLStyleElement | null>(null);
  const base = useRef<HTMLStyleElement | null>(null);
  const prevBody = useRef('');
  // Callbacks change every render; listeners read the latest ones.
  const cbs = useRef({ onFieldHover, onFieldClick, onOpen });
  cbs.current = { onFieldHover, onFieldClick, onOpen };

  useLayoutEffect(() => {
    if (!host.current || shadow.current) return;
    const root = host.current.attachShadow({ mode: 'open' });
    shadow.current = root;
    base.current = document.createElement('style');
    dynamic.current = document.createElement('style');
    page.current = document.createElement('div');
    page.current.className = 'sv-doc page';
    root.append(base.current, dynamic.current, page.current);
    const keyOf = (t: EventTarget | null) => {
      const el = (t as HTMLElement)?.closest?.('[data-guest],[data-field]') as HTMLElement | null;
      if (!el) return null;
      if (el.hasAttribute('data-guest')) return `specialGuests:${el.getAttribute('data-guest')}`;
      return el.getAttribute('data-field');
    };
    let last: string | null = null;
    root.addEventListener('mouseover', e => { const k = keyOf(e.target); if (k !== last) { last = k; cbs.current.onFieldHover(k); } });
    host.current.addEventListener('mouseleave', () => { last = null; cbs.current.onFieldHover(null); });
    root.addEventListener('click', e => { const k = keyOf(e.target); if (k) cbs.current.onFieldClick(k); });
    root.addEventListener('dblclick', () => cbs.current.onOpen());
  }, []);

  const m: DocModel = doc.model;
  useEffect(() => {
    if (!base.current) return;
    base.current.textContent = `${documentCss(m)}
:host{display:block}
.page{box-sizing:border-box;width:210mm;min-height:297mm;padding:${m.margins.top}in ${m.margins.right}in ${m.margins.bottom}in ${m.margins.left}in;background:#fff;overflow:hidden}
@keyframes svflash{0%{background:rgba(250,204,21,.65)}100%{}}
.sv-flash{animation:svflash 1.1s ease-out}
${showHighlights ? fieldHighlightCss('.page ') : '.page [data-guest]::after{content:none}'}`;
  }, [m.font, m.fontSize, m.margins.top, m.margins.right, m.margins.bottom, m.margins.left, showHighlights]);

  useEffect(() => {
    if (!page.current || prevBody.current === m.body) return;
    prevBody.current = m.body;
    page.current.innerHTML = m.body.replace(/\scontenteditable="false"/g, '');
  }, [m.body]);

  // Flash the values that just changed.
  useEffect(() => {
    if (!page.current || !flash.keys.length) return;
    const sel = flash.keys.map(k => `[data-field="${k}"]`).join(',');
    page.current.querySelectorAll(sel).forEach(el => { el.classList.remove('sv-flash'); void (el as HTMLElement).offsetWidth; el.classList.add('sv-flash'); });
  }, [flash.n]);

  // Hover / selection ring on every occurrence.
  useEffect(() => {
    if (!dynamic.current) return;
    const sel = (k: string) => k.startsWith('specialGuests:') ? `[data-guest="${k.split(':')[1]}"]` : `[data-field="${k}"]`;
    const rules: string[] = [];
    const active = [hoverKey, selectedKey].filter(Boolean) as string[];
    if (active.length && showHighlights) {
      rules.push(`.page [data-field]:not(${active.map(sel).join(',')}),.page [data-guest]:not(${active.map(sel).join(',')}){filter:saturate(.25);opacity:.9}`);
      for (const k of active) rules.push(`.page ${sel(k)}{outline:2px solid #4f46e5;outline-offset:1px;filter:none;opacity:1}`);
    }
    dynamic.current.textContent = rules.join('\n');
  }, [hoverKey, selectedKey, showHighlights]);

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2 px-1" style={{ width: PAGE_W }}>
        <span className="text-[15px] font-semibold text-zinc-800">{shortDocLabel(doc.file)}</span>
        {doc.model.lang === 'bn' ? <Badge tone="indigo">বাংলা</Badge> : <Badge>English</Badge>}
        {(doc.status === 'pending' || doc.status === 'saving') && <span className="size-1.5 rounded-full bg-amber-400" />}
        <button onClick={onOpen} onPointerDown={e => e.stopPropagation()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 shadow-soft hover:bg-zinc-50">
          <Pencil className="size-3.5" />Edit document
        </button>
      </div>
      <div ref={host} className="rounded-sm bg-white shadow-page ring-1 ring-zinc-200/70" style={{ width: PAGE_W }} />
    </div>
  );
}

export function CanvasView({ docs, hoverKey, selectedKey, flash, onFieldHover, onFieldClick, onOpen, showHighlights }: {
  docs: PDoc[]; hoverKey: string | null; selectedKey: string | null; flash: { keys: string[]; n: number };
  onFieldHover: (k: string | null) => void; onFieldClick: (k: string) => void; onOpen: (file: string) => void; showHighlights: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, z: 0.45 });
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [space, setSpace] = useState(false);

  const fit = () => {
    const vp = viewport.current, c = content.current;
    if (!vp || !c) return;
    const w = c.scrollWidth, h = c.scrollHeight;
    const z = Math.max(0.1, Math.min(1.2, Math.min((vp.clientWidth - 64) / w, (vp.clientHeight - 64) / h)));
    setView({ z, x: (vp.clientWidth - w * z) / 2, y: 32 });
  };
  useEffect(() => {
    if (fitted.current || !docs.length) return;
    const t = setTimeout(() => { fit(); fitted.current = true; }, 60);
    return () => clearTimeout(t);
  }, [docs.length]);

  const zoomAt = (factor: number, cx: number, cy: number) => setView(v => {
    const z = Math.max(0.1, Math.min(3, v.z * factor));
    const k = z / v.z;
    return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
  });
  const zoomCenter = (factor: number) => { const vp = viewport.current!; zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); };

  useEffect(() => {
    const vp = viewport.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
      else setView(v => ({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey ? 0 : e.deltaY) }));
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if (typing) return;
      if (e.code === 'Space') { setSpace(e.type === 'keydown'); if (e.type === 'keydown') e.preventDefault(); }
      if (e.type !== 'keydown') return;
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomCenter(1.2); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomCenter(1 / 1.2); }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); fit(); }
      if (!e.ctrlKey && !e.metaKey && e.shiftKey && e.key === '!') fit();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => { vp.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
  }, []);

  const cols = docs.length > 1 ? 2 : 1;

  return (
    <div ref={viewport} className={cn('sv-canvas relative h-full w-full touch-none overflow-hidden select-none', space || drag.current ? 'cursor-grabbing' : 'cursor-grab')}
      onPointerDown={e => {
        if (e.button !== 0 && e.button !== 1) return;
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        if (!d.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); // capture only once it is a pan, so clicks still reach fields
        d.moved = true;
        setView(v => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      }}
      onPointerUp={e => {
        const d = drag.current; drag.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        if (d?.moved) { // Swallow the click that ends a pan.
          const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
          window.addEventListener('click', stop, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', stop, { capture: true } as any), 0);
        }
      }}>
      <div ref={content} className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <div className="grid items-start" style={{ gridTemplateColumns: `repeat(${cols}, ${PAGE_W}px)`, gap: GAP }}>
          {docs.map(d => (
            <DocPage key={d.file} doc={d} hoverKey={hoverKey} selectedKey={selectedKey} flash={flash} showHighlights={showHighlights}
              onFieldHover={onFieldHover} onFieldClick={onFieldClick} onOpen={() => onOpen(d.file)} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-pop" onPointerDown={e => e.stopPropagation()}>
        <IconButton label="Zoom out" shortcut="Ctrl+−" onClick={() => zoomCenter(1 / 1.2)}><Minus className="size-4" /></IconButton>
        <button onClick={() => setView(v => { const vp = viewport.current!; const k = 1 / v.z; return { z: 1, x: vp.clientWidth / 2 - (vp.clientWidth / 2 - v.x) * k, y: vp.clientHeight / 2 - (vp.clientHeight / 2 - v.y) * k }; })}
          className="w-14 rounded-md py-1 text-center text-[12.5px] tabular-nums text-zinc-700 hover:bg-zinc-100" title="Zoom to 100%">{Math.round(view.z * 100)}%</button>
        <IconButton label="Zoom in" shortcut="Ctrl+=" onClick={() => zoomCenter(1.2)}><Plus className="size-4" /></IconButton>
        <IconButton label="Fit all pages" shortcut="Ctrl+0" onClick={fit}><Maximize2 className="size-4" /></IconButton>
      </div>
      <p className="pointer-events-none absolute bottom-5 left-4 text-[11.5px] text-zinc-400">Drag or scroll to move · Ctrl + scroll to zoom · Double-click a page to edit it</p>
    </div>
  );
}
