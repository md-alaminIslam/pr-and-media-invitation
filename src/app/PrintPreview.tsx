import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { DocModel, serializeDoc } from '../editor/doc';
import { printDoc } from '../editor/export';
import { Button, IconButton, Spinner, cn } from '../ui/ui';
import { PAGE_H_PX, PAGE_W_PX, SHEET_CSS, SHEET_GAP, flowBoxes, paginate } from '../editor/paginate';

const PAGE_W = PAGE_W_PX;
const PAGE_H = PAGE_H_PX;

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

  const html = useMemo(() => {
    if (!model) return '';
    // The same sheet layout as the canvas, without highlights or editing aids.
    return serializeDoc(model).replace('</head>', `<style>${SHEET_CSS}</style></head>`);
  }, [model]);

  const frame = useRef<HTMLIFrameElement>(null);
  const [pages, setPages] = useState(1);
  const [height, setHeight] = useState(PAGE_H);
  const [measuring, setMeasuring] = useState(true);
  useEffect(() => {
    const f = frame.current; if (!f || !html || !model) return;
    setMeasuring(true);
    const onLoad = async () => {
      const d = f.contentDocument; if (!d) return;
      try { await d.fonts.ready; } catch {}
      flowBoxes(d);
      const n = paginate(d, model.margins);
      setPages(n);
      setHeight(n * (PAGE_H + SHEET_GAP) - SHEET_GAP);
      setMeasuring(false);
    };
    f.addEventListener('load', onLoad, { once: true });
    f.srcdoc = html;
    return () => f.removeEventListener('load', onLoad);
  }, [html]);

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
        {model && (
          <div className="mx-auto [filter:drop-shadow(0_1px_2px_rgb(24_24_27/0.14))_drop-shadow(0_6px_14px_rgb(24_24_27/0.1))]" style={{ width: PAGE_W * scale, height: height * scale }}>
            <iframe ref={frame} title="Print preview" sandbox="allow-same-origin" tabIndex={-1} scrolling="no"
              className="pointer-events-none block origin-top-left border-0 bg-transparent" style={{ width: PAGE_W, height, transform: `scale(${scale})` }} />
          </div>
        )}
        <p className="pb-2 text-center text-[11px] text-zinc-400">Exactly what prints, sheet by sheet — the canvas uses the same layout. A paragraph that doesn't fit at the bottom of a sheet starts on the next one.</p>
      </div>
    </aside>
  );
}
