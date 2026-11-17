import React, { useEffect, useRef, useState } from 'react';
import { Scan } from 'lucide-react';
import { cn } from '../ui/ui';
import { MARGIN_PRESETS, MARGIN_SIDES, MarginSide, PageMargins, clampMargin } from '../utils/pageMargins';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Page margins (inches, A4) as a small button with a popover. `value` null = documents differ. */
export function MarginControl({ value, onChange, title, align = 'start', className }: {
  value: PageMargins | null;
  onChange: (fn: (m: PageMargins) => PageMargins) => void;
  title: string;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc); };
  }, [open]);

  const same = value && MARGIN_SIDES.every(s => value[s] === value.top);
  const summary = !value ? 'Mixed' : same ? `${fmt(value.top)}"` : `${fmt(value.top)} ${fmt(value.right)} ${fmt(value.bottom)} ${fmt(value.left)}"`;
  const setSide = (side: MarginSide, raw: string) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) return;
    onChange(m => ({ ...m, [side]: clampMargin(n, m[side]) }));
  };

  return (
    <div ref={box} data-no-pan className={cn('relative', className)} onPointerDown={e => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(o => !o)} title={title} aria-expanded={open}
        className={cn('flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium tabular-nums', open ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-800')}>
        <Scan className="size-3.5" />Margins <span className="font-normal text-zinc-500">{summary}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={title} className={cn('absolute top-9 z-40 w-[264px] rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-pop', align === 'end' ? 'right-0' : 'left-0')}>
          <p className="mb-2 text-[12px] font-semibold text-zinc-800">{title}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {MARGIN_SIDES.map(side => (
              <label key={side} className="space-y-0.5">
                <span className="block text-[10.5px] capitalize text-zinc-500">{side}</span>
                <input type="number" min={0} max={3} step={0.05} value={value ? value[side] : ''} placeholder="–"
                  onChange={e => setSide(side, e.target.value)}
                  className="h-8 w-full rounded-md border border-zinc-200 px-1.5 text-[12.5px] tabular-nums focus:border-indigo-400 focus:outline-none" />
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10.5px] text-zinc-500">All sides</span>
            <input type="number" min={0} max={3} step={0.05} placeholder="in" aria-label="Set all four margins"
              onChange={e => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) onChange(() => { const v = clampMargin(n, 1); return { top: v, right: v, bottom: v, left: v }; }); }}
              className="h-7 w-16 rounded-md border border-zinc-200 px-1.5 text-[12px] tabular-nums focus:border-indigo-400 focus:outline-none" />
            <span className="text-[10.5px] text-zinc-400">inches · A4</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {MARGIN_PRESETS.map(pr => (
              <button key={pr.id} type="button" onClick={() => onChange(() => ({ ...pr.margins }))}
                className={cn('rounded-full border px-2 py-0.5 text-[11px]', value && MARGIN_SIDES.every(s => pr.margins[s] === value[s]) ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300')}>{pr.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
