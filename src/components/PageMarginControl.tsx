import React, { useEffect, useRef, useState } from 'react';
import { Link2, Link2Off, RotateCcw, Scan } from 'lucide-react';
import {
  DEFAULT_PAGE_MARGINS,
  MARGIN_PRESETS,
  MARGIN_SIDES,
  MAX_MARGIN_IN,
  MarginSide,
  PageMargins,
  clampMargin,
  marginError,
} from '../utils/pageMargins';

const SIDE_LABELS: Record<MarginSide, string> = {
  top: 'উপরে (Top)',
  right: 'ডানে (Right)',
  bottom: 'নিচে (Bottom)',
  left: 'বামে (Left)',
};

interface Props {
  margins: PageMargins;
  onChange: (m: PageMargins) => void;
}

const sameAll = (m: PageMargins) => MARGIN_SIDES.every(s => m[s] === m.top);
const fmt = (n: number) => `${n}"`;

/** Toolbar button + popover for setting page margins (in inches) of printed output. */
export const PageMarginControl: React.FC<Props> = ({ margins, onChange }) => {
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState(() => sameAll(margins));
  // Text drafts let the user type freely (e.g. "0." or "") before a value is committed.
  const [drafts, setDrafts] = useState<Record<MarginSide, string>>(() => toDrafts(margins));
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  /** Validate and save; `syncDrafts` rewrites the input text (skip it while the user is typing). */
  const apply = (next: PageMargins, syncDrafts = true) => {
    const err = marginError(next);
    setError(err);
    if (!err) onChange(next);
    if (syncDrafts) setDrafts(toDrafts(err ? margins : next));
  };

  const commit = (side: MarginSide, raw: string, syncDrafts: boolean) => {
    const value = clampMargin(raw, margins[side]);
    apply(linked ? { top: value, right: value, bottom: value, left: value } : { ...margins, [side]: value }, syncDrafts);
  };

  const summary = sameAll(margins)
    ? fmt(margins.top)
    : `${fmt(margins.top)} ${fmt(margins.right)} ${fmt(margins.bottom)} ${fmt(margins.left)}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        title="প্রিন্ট, PDF ও Word পৃষ্ঠার মার্জিন (ইঞ্চি)"
      >
        <Scan className="w-3.5 h-3.5" />
        মার্জিন <span className="font-mono text-[11px] text-slate-500">{summary}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Page margins" className="absolute right-0 top-full mt-2 z-40 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-900">পৃষ্ঠার মার্জিন (ইঞ্চি)</h4>
            <button
              type="button"
              onClick={() => setLinked(l => !l)}
              aria-pressed={linked}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold cursor-pointer ${linked ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-300 text-slate-600'}`}
              title={linked ? 'চার দিকেই একই মার্জিন' : 'প্রতিটি দিক আলাদা'}
            >
              {linked ? <Link2 className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
              {linked ? 'সব দিক এক' : 'আলাদা'}
            </button>
          </div>
          <p className="text-slate-500 mb-3">A4 পৃষ্ঠা · প্রিন্ট, PDF ও Word — তিনটিতেই প্রযোজ্য।</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {MARGIN_SIDES.map(side => (
              <label key={side} className="flex flex-col gap-1">
                <span className="text-slate-600 font-medium">{SIDE_LABELS[side]}</span>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:border-teal-500">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={MAX_MARGIN_IN}
                    step={0.05}
                    value={drafts[side]}
                    disabled={linked && side !== 'top'}
                    onChange={e => {
                      const v = e.target.value;
                      setDrafts(d => linked ? { top: v, right: v, bottom: v, left: v } : { ...d, [side]: v });
                      if (v.trim() !== '' && Number.isFinite(parseFloat(v))) commit(side, v, false);
                    }}
                    onBlur={e => commit(side, e.target.value, true)}
                    className="w-full px-2 py-1.5 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <span className="px-2 text-slate-400 bg-slate-50 border-l border-slate-200 py-1.5">in</span>
                </div>
              </label>
            ))}
          </div>

          {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {MARGIN_PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setLinked(sameAll(p.margins)); apply(p.margins); }}
                className="px-2 py-1 rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setLinked(true); apply({ ...DEFAULT_PAGE_MARGINS }); }}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> ডিফল্ট (1") এ ফিরুন
          </button>
        </div>
      )}
    </div>
  );
};

function toDrafts(m: PageMargins): Record<MarginSide, string> {
  return { top: String(m.top), right: String(m.right), bottom: String(m.bottom), left: String(m.left) };
}
