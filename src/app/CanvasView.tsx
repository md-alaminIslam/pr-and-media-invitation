import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { IconButton, cn } from '../ui/ui';

/** Figma-style canvas: pan by dragging the background or scrolling, Ctrl/⌘ + scroll to zoom.
 *  Pages are live editors; their wheel events are forwarded here via `forwardWheel`. */
export interface CanvasApi { forwardWheel: (e: WheelEvent, frame: HTMLIFrameElement) => void; fit: () => void }

const PAGE_W = 794; // 210mm at 96dpi
const GAP = 72;

export const CanvasView = forwardRef<CanvasApi, { pages: { key: string; label: React.ReactNode; node: React.ReactNode; active?: boolean }[] }>(function CanvasView({ pages }, ref) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, z: 0.45 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [panning, setPanning] = useState(false);

  const fit = () => {
    const vp = viewport.current, c = content.current;
    if (!vp || !c) return;
    const w = c.offsetWidth, h = Math.min(c.offsetHeight, 1123 * 2 + GAP + 60);
    const z = Math.max(0.1, Math.min(1.2, Math.min((vp.clientWidth - 64) / w, (vp.clientHeight - 48) / h)));
    setView({ z, x: (vp.clientWidth - w * z) / 2, y: 24 });
  };
  useEffect(() => {
    if (fitted.current || !pages.length) return;
    const t = setTimeout(() => { fit(); fitted.current = true; }, 120);
    return () => clearTimeout(t);
  }, [pages.length]);

  const zoomAt = (factor: number, cx: number, cy: number) => setView(v => {
    const z = Math.max(0.1, Math.min(3, v.z * factor));
    const k = z / v.z;
    return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
  });
  const zoomCenter = (factor: number) => { const vp = viewport.current!; zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); };

  const wheel = (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; deltaX: number; deltaY: number; clientX: number; clientY: number }) => {
    const vp = viewport.current; if (!vp) return;
    const r = vp.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    else setView(v => ({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey ? 0 : e.deltaY) }));
  };

  useImperativeHandle(ref, () => ({
    fit,
    forwardWheel: (e, frame) => {
      // Convert the iframe's coordinates into page coordinates.
      const fr = frame.getBoundingClientRect();
      const scale = fr.width / (frame.offsetWidth || 1);
      wheel({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, deltaX: e.deltaX, deltaY: e.deltaY, clientX: fr.left + e.clientX * scale, clientY: fr.top + e.clientY * scale });
    },
  }));

  useEffect(() => {
    const vp = viewport.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheel(e); };
    vp.addEventListener('wheel', onWheel, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomCenter(1.2); }
      else if (e.key === '-') { e.preventDefault(); zoomCenter(1 / 1.2); }
      else if (e.key === '0') { e.preventDefault(); fit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { vp.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey); };
  }, []);

  const cols = pages.length > 1 ? 2 : 1;

  return (
    <div ref={viewport} className={cn('sv-canvas relative h-full w-full touch-none overflow-hidden', panning ? 'cursor-grabbing' : 'cursor-grab')}
      onPointerDown={e => {
        if (e.button !== 0 && e.button !== 1) return;
        if ((e.target as HTMLElement).closest('button,input,select,textarea,a')) return;
        drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false };
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 3) return;
        if (!d.moved) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setPanning(true); }
        d.moved = true;
        setView(v => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
      }}
      onPointerUp={e => { drag.current = null; setPanning(false); (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); }}>
      <div ref={content} className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <div className="grid items-start" style={{ gridTemplateColumns: `repeat(${cols}, ${PAGE_W}px)`, gap: GAP }}>
          {pages.map(p => (
            <div key={p.key}>
              <div className="mb-3 flex items-center gap-2 px-1 text-[15px] font-semibold text-zinc-700" style={{ width: PAGE_W }}>{p.label}</div>
              <div className={cn('cursor-auto rounded-sm transition-shadow', p.active && 'ring-4 ring-indigo-300/70')}>{p.node}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-pop">
        <IconButton label="Zoom out" shortcut="Ctrl+−" onClick={() => zoomCenter(1 / 1.2)}><Minus className="size-4" /></IconButton>
        <button onClick={() => setView(v => { const vp = viewport.current!; const k = 1 / v.z; return { z: 1, x: vp.clientWidth / 2 - (vp.clientWidth / 2 - v.x) * k, y: vp.clientHeight / 2 - (vp.clientHeight / 2 - v.y) * k }; })}
          className="w-14 rounded-md py-1 text-center text-[12.5px] tabular-nums text-zinc-700 hover:bg-zinc-100" title="Zoom to 100%">{Math.round(view.z * 100)}%</button>
        <IconButton label="Zoom in" shortcut="Ctrl+=" onClick={() => zoomCenter(1.2)}><Plus className="size-4" /></IconButton>
        <IconButton label="Fit all pages" shortcut="Ctrl+0" onClick={fit}><Maximize2 className="size-4" /></IconButton>
      </div>
      <p className="pointer-events-none absolute bottom-5 left-4 rounded-md bg-white/80 px-2 py-1 text-[11.5px] text-zinc-500 backdrop-blur">Click a page to type · Drag the background or scroll to move · Ctrl + scroll to zoom</p>
    </div>
  );
});
