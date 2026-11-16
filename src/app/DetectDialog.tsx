import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DetectionSummary } from '../editor/detect';
import { FIELD, FIELD_DEFS, formatDate, formatHall, formatTime, ordinal } from '../editor/values';
import { shortDocLabel } from '../editor/templates';
import { Button, Dialog, cn } from '../ui/ui';
import { GROUP_COLOR } from './GlobalFieldsPanel';

function preview(s: DetectionSummary, key: string): string {
  const v = s.values;
  switch (key) {
    case 'edition': return v.edition ? `${ordinal(v.edition, 'en')} · ${ordinal(v.edition, 'bn')}` : '';
    case 'year': return v.year ? String(v.year) : '';
    case 'hall': return v.hall ? formatHall(v.hall, 'en', 'Hall {n}') : '';
    case 'eventDate': case 'endDate': case 'issueDate': return formatDate((v as any)[key], 'en');
    case 'eventTime': return formatTime(v.eventTime, 'en');
    case 'contactPhone': return v.contactPhone;
    case 'chiefGuest': return v.chiefGuest ? `${v.chiefGuest.prefixes.map(p => p.en).join(' ')} ${v.chiefGuest.name.en}`.trim() : '';
    case 'specialGuests': return v.specialGuests.length ? `${v.specialGuests.length} guests` : '';
    default: { const t = (v.text as any)[key]; return t ? [t.en, t.bn].filter(Boolean).join(' · ') : ''; }
  }
}

export function DetectDialog({ summary, open, onClose, onApply }: { summary: DetectionSummary | null; open: boolean; onClose: () => void; onApply: (keep: Set<string>) => void }) {
  const [keep, setKeep] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setKeep(new Set()); }, [open, summary]);
  if (!summary) return null;
  const foundKeys = FIELD_DEFS.filter(f => summary.counts[f.key]);
  const missing = FIELD_DEFS.filter(f => !summary.counts[f.key]);
  return (
    <Dialog open={open} onClose={onClose} width="max-w-3xl" title="Shared fields found in your documents"
      description="Check what was found. Linked values change everywhere at once from the Shared fields panel."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-autofocus onClick={() => onApply(keep)}>Link {foundKeys.length} fields</Button></>}>
      <div className="sv-scroll -mx-6 max-h-[60vh] space-y-5 overflow-y-auto px-6">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {foundKeys.map(f => (
            <div key={f.key} className="flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', GROUP_COLOR[f.group].dot)} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-800">{f.label}<span className="text-[11px] font-normal text-zinc-400">{summary.counts[f.key]} places</span></p>
                <p className="truncate text-[12px] text-zinc-500" title={preview(summary, f.key)}>{preview(summary, f.key)}</p>
              </div>
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            </div>
          ))}
        </div>
        {!!missing.length && <p className="text-[12.5px] text-zinc-500">Not found: {missing.map(m => m.label).join(', ')}. You can link these later: select the text in a document and use <strong>Field</strong> in the toolbar.</p>}
        {summary.warnings.map((w, i) => <p key={i} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</p>)}
        {!!summary.conflicts.length && (
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-900">{summary.conflicts.length} places differ from the shared value</h3>
            <p className="mb-2 text-[12.5px] text-zinc-500">By default they will be changed to the shared value so all documents match. Tick a row to keep that document's own text instead.</p>
            <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
              {summary.conflicts.map(c => (
                <label key={c.det} className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-zinc-50">
                  <input type="checkbox" className="mt-1 size-3.5 accent-indigo-600" checked={keep.has(c.det)} onChange={e => setKeep(k => { const n = new Set(k); e.target.checked ? n.add(c.det) : n.delete(c.det); return n; })} />
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    <p className="text-zinc-500">{FIELD.get(c.key)?.label} · {shortDocLabel(c.doc)}</p>
                    <p><span className="text-zinc-400">Found </span><span className="font-medium text-zinc-900">{c.found}</span></p>
                    <p><span className="text-zinc-400">Shared </span><span className="text-zinc-700">{c.key.endsWith('Date') ? formatDate(c.shared, c.lang) : c.key === 'eventTime' ? formatTime(c.shared, c.lang) : c.shared}</span></p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-zinc-500">{keep.has(c.det) ? 'Keep own text' : 'Use shared'}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
