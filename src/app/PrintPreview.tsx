import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { DocModel, serializeDoc } from '../editor/doc';
import { printDoc } from '../editor/export';
import { Button, IconButton, Spinner, cn } from '../ui/ui';
import { A4_HEIGHT_IN, A4_WIDTH_IN } from '../utils/pageMargins';

const PX = 96; // CSS pixels per inch
const PAGE_W = A4_WIDTH_IN * PX;
const PAGE_H = A4_HEIGHT_IN * PX;

/**
 * A4 print preview: the document exactly as it is saved (no highlights), laid out at the
 * printable width and cut into A4 sheets with the document's margins.
 */
export function PrintPreview({ docs, activeFile, onPick, onClose }: {
  docs: { file: string; label: string; model: DocModel }[];
  activeFile: string | undefined;
  onPick: (file: string) => void;
  onClose: () => void;
}) {
  const current = docs.find(d => d.file === activeFile) || docs[0];
  // Follow edits, but not on every keystroke.
  const [model, setModel] = useState<DocModel | null>(current?.model || null);
  useEffect(() => {
    const t = setTimeout(() => setModel(current?.model || null), 450);
    return () => clearTimeout(t);
  }, [current?.model]);

  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(380);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = model?.margins;
  const contentW = m ? Math.round((A4_WIDTH_IN - m.left - m.right) * PX) : 600;
  const contentH = m ? Math.round((A4_HEIGHT_IN - m.top - m.bottom) * PX) : 900;
  const html = useMemo(() => {
    if (!model) return '';
    // Lay the page out like the printer does: no screen padding, printable width only.
    return serializeDoc(model).replace('</head>', `<style>html,body.sv-doc{margin:0!important;padding:0!important;max-width:none!important;min-height:0!important;width:${contentW}px!important;overflow:hidden!important;background:#fff}</style></head>`);
  }, [model, contentW]);

  // Measure how tall the content is, to know how many sheets it needs.
  const [pages, setPages] = useState(1);
  const [measuring, setMeasuring] = useState(true);
  const measure = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const f = measure.current; if (!f || !html) return;
    setMeasuring(true);
    const onLoad = async () => {
      const d = f.contentDocument; if (!d) return;
      try { await d.fonts.ready; } catch {}
      let h = d.body.scrollHeight;
      d.body.querySelectorAll<HTMLElement>('*').forEach(el => { const r = el.getBoundingClientRect(); h = Math.max(h, r.bottom + (d.defaultView?.scrollY || 0)); });
      setPages(Math.max(1, Math.min(20, Math.ceil((h - 2) / contentH))));
      setMeasuring(false);
    };
    f.addEventListener('load', onLoad, { once: true });
    f.srcdoc = html;
    return () => f.removeEventListener('load', onLoad);
  }, [html, contentH]);

  const scale = Math.min(1, (width - 32) / PAGE_W);

  return (
    <aside className="flex w-[min(460px,40vw)] min-w-[300px] shrink-0 flex-col border-l border-zinc-200 bg-zinc-100">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3">
        <Printer className="size-4 text-zinc-500" />
        <span className="text-[13px] font-semibold text-zinc-800">Print preview</span>
        <span className="text-[11.5px] text-zinc-500">A4 · {pages} page{pages > 1 ? 's' : ''}</span>
        {measuring && <Spinner className="size-3.5" />}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => model && void printDoc(model)}><Printer className="size-3.5" />Print</Button>
          <IconButton label="Close print preview" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
      </div>
      {docs.length > 1 && (
        <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1.5">
          {docs.map(d => (
            <button key={d.file} onClick={() => onPick(d.file)}
              className={cn('shrink-0 rounded-md px-2 py-1 text-[12px]', d.file === current?.file ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100')}>{d.label}</button>
          ))}
        </div>
      )}
      <div ref={box} className="sv-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <iframe ref={measure} title="" aria-hidden tabIndex={-1} sandbox="allow-same-origin" className="pointer-events-none absolute -left-[9999px] top-0 h-[400px] border-0" style={{ width: contentW }} />
        {model && Array.from({ length: pages }, (_, k) => (
          <div key={k} className="mx-auto mb-4 overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,.12),0_4px_14px_rgba(0,0,0,.08)]" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div className="relative origin-top-left" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}>
              <div className="absolute overflow-hidden" style={{ left: m!.left * PX, top: m!.top * PX, width: contentW, height: contentH }}>
                <iframe title={`Page ${k + 1}`} sandbox="allow-same-origin" tabIndex={-1} srcDoc={html} scrolling="no"
                  className="pointer-events-none block border-0" style={{ width: contentW, height: contentH * (k + 1), marginTop: -contentH * k }} />
              </div>
              <span className="absolute bottom-2 right-3 text-[11px] text-zinc-300">{k + 1}</span>
            </div>
          </div>
        ))}
        <p className="pb-2 text-center text-[11px] text-zinc-400">Exactly what prints: no highlights, document margins applied. Text that runs past a sheet continues on the next one.</p>
      </div>
    </aside>
  );
}
