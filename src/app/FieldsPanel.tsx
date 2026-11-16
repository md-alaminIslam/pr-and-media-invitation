import React, { useState } from 'react';
import { ChevronRight, Languages, Sparkles, Wand2 } from 'lucide-react';
import { FIELDS, FIELD_GROUPS, FieldDef, FieldValues, isPlaceholder } from '../editor/fields';
import { Badge, Button, IconButton, cn, inputClass } from '../ui/ui';
import { translateFormField } from '../utils/formTranslation';
import { translateGuestField } from '../utils/guestTranslation';

const FORM_KEY: Record<string, string> = {
  issueDate: 'issueDateEn', eventDate: 'eventDateEn', eventTime: 'inaugurationTimeEn', eventDuration: 'eventDurationEn',
  visitingHours: 'visitingHoursEn', senderName: 'sender.nameEn',
};

export function offlineBangla(def: FieldDef, english: string): string {
  if (!english.trim()) return '';
  if (def.kind === 'name') return translateGuestField(english, 'nameEn');
  if (def.kind === 'designation') return translateGuestField(english, 'designationEn');
  if (def.multiline) return english.split('\n').map(line => translateGuestField(line, 'nameEn')).join('\n');
  return translateFormField(english, FORM_KEY[def.key] || def.key + 'En');
}

interface Props {
  values: FieldValues;
  usage: Record<string, number>;
  onChange: (key: string, lang: 'en' | 'bn', text: string) => void;
  onFillOffline: () => void;
  onFillGemini: () => void;
  geminiOk: boolean;
  geminiBusy: boolean;
  onInsert: (key: string) => void;
}

function FieldInput({ def, lang, value, onChange }: { def: FieldDef; lang: 'en' | 'bn'; value: string; onChange: (v: string) => void }) {
  const shown = isPlaceholder(value) ? '' : value;
  const placeholder = def.placeholder?.[lang] || def.label;
  const common = {
    value: shown,
    placeholder,
    'aria-label': `${def.label}${def.shared ? '' : lang === 'en' ? ' (English)' : ' (Bangla)'}`,
    lang: lang === 'bn' ? 'bn' : 'en',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value || `[${placeholder}]`),
    className: cn(inputClass, 'h-8 rounded-md text-[13px]', lang === 'bn' && "font-['Hind_Siliguri']"),
  };
  return def.multiline ? <textarea rows={2} {...common} className={cn(common.className, 'h-auto py-1.5')} /> : <input {...common} />;
}

export function FieldsPanel({ values, usage, onChange, onFillOffline, onFillGemini, geminiOk, geminiBusy, onInsert }: Props) {
  const [showUnused, setShowUnused] = useState(false);
  const used = FIELDS.filter(f => usage[f.key]);
  const unused = FIELDS.filter(f => !usage[f.key]);
  const renderField = (def: FieldDef) => {
    const v = values[def.key] || { en: '', bn: '' };
    return (
      <div key={def.key} className="rounded-lg border border-zinc-200 bg-white p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-zinc-700">{def.label}</span>
          <span className="flex items-center gap-1">
            {usage[def.key] ? <Badge tone="indigo">{usage[def.key]}×</Badge> : null}
            {!def.shared && (
              <IconButton label="Fill Bangla from English (offline)" size="icon-sm" className="size-6" disabled={!v.en || isPlaceholder(v.en)}
                onClick={() => onChange(def.key, 'bn', offlineBangla(def, v.en) || v.bn)}><Languages className="size-3.5" /></IconButton>
            )}
          </span>
        </div>
        {def.shared ? <FieldInput def={def} lang="en" value={v.en || v.bn} onChange={t => { onChange(def.key, 'en', t); onChange(def.key, 'bn', t); }} /> : (
          <div className="space-y-1.5">
            <div className="flex items-start gap-1.5"><span className="mt-1.5 w-6 shrink-0 text-[10.5px] font-semibold text-zinc-400">EN</span><div className="flex-1"><FieldInput def={def} lang="en" value={v.en} onChange={t => onChange(def.key, 'en', t)} /></div></div>
            <div className="flex items-start gap-1.5"><span className="mt-1.5 w-6 shrink-0 text-[10.5px] font-semibold text-zinc-400">বাং</span><div className="flex-1"><FieldInput def={def} lang="bn" value={v.bn} onChange={t => onChange(def.key, 'bn', t)} /></div></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-zinc-500">Edit once — every document that uses a field updates instantly.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" onClick={onFillOffline} title="Fill empty Bangla fields from English using the offline dictionary"><Wand2 className="size-3.5" />Fill Bangla</Button>
          <Button size="sm" onClick={onFillGemini} disabled={!geminiOk} loading={geminiBusy} title={geminiOk ? 'Translate English fields to Bangla with Gemini' : 'Add a Gemini key in WordPress → Settings → Media Studio'}><Sparkles className="size-3.5" />Gemini</Button>
        </div>
      </div>
      {!used.length && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2.5 text-[13px] text-zinc-600">These documents have no linked fields yet. Select text in the page and use <strong>Field</strong> in the toolbar to link it, or insert a field.</p>
      )}
      {FIELD_GROUPS.map(group => {
        const list = used.filter(f => f.group === group);
        if (!list.length) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{group}</h3>
            {list.map(renderField)}
          </section>
        );
      })}
      {!!unused.length && (
        <section>
          <button onClick={() => setShowUnused(s => !s)} className="flex w-full items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
            <ChevronRight className={cn('size-3.5 transition-transform', showUnused && 'rotate-90')} />{unused.length} more fields not used in these documents
          </button>
          {showUnused && (
            <div className="mt-2">
              <p className="mb-2 text-[12px] text-zinc-500">Click to insert at the cursor in the open document.</p>
              <div className="flex flex-wrap gap-1.5">
                {unused.map(f => <button key={f.key} onMouseDown={e => e.preventDefault()} onClick={() => onInsert(f.key)} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">+ {f.label}</button>)}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
