// Shared project fields. A field lives in documents as
//   <span data-field="eventTitle">…</span>
// English documents hold the English value and Bangla documents the Bangla
// value. The documents themselves are the source of truth: the fields panel
// reads values from them and writes edits back into every document.

import type { DocLang } from './doc';

export interface FieldDef {
  key: string;
  label: string;
  group: string;
  multiline?: boolean;
  /** Same value in both languages (phone, email). */
  shared?: boolean;
  /** Which offline translator to use. */
  kind?: 'name' | 'designation' | 'date' | 'text';
  placeholder?: { en: string; bn: string };
}

export const FIELD_GROUPS = ['Event', 'Schedule', 'Guests', 'Media & sender'] as const;

export const FIELDS: FieldDef[] = [
  { key: 'eventTitle', label: 'Event title', group: 'Event', placeholder: { en: 'Event title', bn: 'অনুষ্ঠানের নাম' } },
  { key: 'edition', label: 'Edition', group: 'Event', placeholder: { en: '10th edition', bn: '১০ম আসর' } },
  { key: 'scope', label: 'Event type / scope', group: 'Event', placeholder: { en: 'international exhibition', bn: 'আন্তর্জাতিক প্রদর্শনী' } },
  { key: 'organizer', label: 'Organizer', group: 'Event', placeholder: { en: 'Organizer', bn: 'আয়োজক' } },
  { key: 'venue', label: 'Venue', group: 'Event', placeholder: { en: 'Venue', bn: 'ভেন্যু' } },
  { key: 'issueDate', label: 'Letter date', group: 'Schedule', kind: 'date', placeholder: { en: 'Date', bn: 'তারিখ' } },
  { key: 'eventDate', label: 'Event date', group: 'Schedule', kind: 'date', placeholder: { en: 'Event date', bn: 'অনুষ্ঠানের তারিখ' } },
  { key: 'eventTime', label: 'Inauguration time', group: 'Schedule', kind: 'date', placeholder: { en: '10:00 AM', bn: 'সকাল ১০টা' } },
  { key: 'eventDuration', label: 'Runs until', group: 'Schedule', kind: 'date', placeholder: { en: 'closing date', bn: 'শেষ তারিখ' } },
  { key: 'visitingHours', label: 'Visiting hours', group: 'Schedule', kind: 'date', placeholder: { en: '10 AM to 8 PM daily', bn: 'প্রতিদিন সকাল ১০টা থেকে রাত ৮টা' } },
  { key: 'chiefGuestName', label: 'Chief guest name', group: 'Guests', kind: 'name', placeholder: { en: 'Chief guest', bn: 'প্রধান অতিথি' } },
  { key: 'chiefGuestTitle', label: 'Chief guest designation', group: 'Guests', kind: 'designation', placeholder: { en: 'Designation', bn: 'পদবি' } },
  { key: 'specialGuests', label: 'Special guests', group: 'Guests', multiline: true, placeholder: { en: 'Special guests', bn: 'বিশেষ অতিথি' } },
  { key: 'mediaAddressee', label: 'Addressed to', group: 'Media & sender', placeholder: { en: 'Chief Reporter', bn: 'প্রধান বার্তা সম্পাদক' } },
  { key: 'senderName', label: 'Sender name', group: 'Media & sender', kind: 'name', placeholder: { en: 'Sender name', bn: 'প্রেরকের নাম' } },
  { key: 'senderTitle', label: 'Sender designation', group: 'Media & sender', kind: 'designation', placeholder: { en: 'Designation', bn: 'পদবি' } },
  { key: 'senderOrg', label: 'Sender organization', group: 'Media & sender', placeholder: { en: 'Organization', bn: 'প্রতিষ্ঠান' } },
  { key: 'senderPhone', label: 'Phone', group: 'Media & sender', shared: true, placeholder: { en: '+880', bn: '+880' } },
  { key: 'senderEmail', label: 'Email', group: 'Media & sender', shared: true, placeholder: { en: 'name@example.com', bn: 'name@example.com' } },
];

export const FIELD_BY_KEY = new Map(FIELDS.map(f => [f.key, f]));

export type FieldValues = Record<string, { en: string; bn: string }>;

/** Convert a field's HTML (may contain <br>) to plain text with newlines. */
export function fieldHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>(?!$)/gi, '\n')
    .replace(/<br\s*\/?>$/i, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function fieldTextToHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function parseBody(body: string): HTMLTemplateElement {
  const t = document.createElement('template');
  t.innerHTML = body;
  return t;
}

const elementText = (el: Element) => fieldHtmlToText(el.innerHTML);

/** Read the first value of each field from a document body. Browser-only. */
export function readFields(body: string): Record<string, string> {
  const found: Record<string, string> = {};
  if (!body.includes('data-field')) return found;
  parseBody(body).content.querySelectorAll('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field')!;
    if (!(key in found)) found[key] = elementText(el);
  });
  return found;
}

/** Set the text of every element linked to `key`. Returns the new body (unchanged string if nothing matched). */
export function writeField(body: string, key: string, text: string): string {
  if (!body.includes(`data-field="${key}"`)) return body;
  const t = parseBody(body);
  let changed = false;
  t.content.querySelectorAll(`[data-field="${key}"]`).forEach(el => {
    if (elementText(el) !== text) { el.innerHTML = fieldTextToHtml(text); changed = true; }
  });
  return changed ? t.innerHTML : body;
}

/** Apply a field value to live DOM (the open editor). */
export function writeFieldInDom(root: ParentNode, key: string, text: string): boolean {
  let changed = false;
  root.querySelectorAll(`[data-field="${key}"]`).forEach(el => {
    if (elementText(el) !== text) { el.innerHTML = fieldTextToHtml(text); changed = true; }
  });
  return changed;
}

/** Merge values from several documents (by language) into panel values. */
export function collectFieldValues(docs: { lang: DocLang; body: string }[]): FieldValues {
  const values: FieldValues = {};
  for (const doc of docs) {
    const found = readFields(doc.body);
    for (const [key, value] of Object.entries(found)) {
      const entry = (values[key] ||= { en: '', bn: '' });
      const def = FIELD_BY_KEY.get(key);
      if (def?.shared) { if (!entry.en) entry.en = entry.bn = value; }
      else if (!entry[doc.lang]) entry[doc.lang] = value;
    }
  }
  return values;
}

export function fieldSpan(key: string, value = ''): string {
  return `<span data-field="${key}">${fieldTextToHtml(value)}</span>`;
}

/** Template placeholders look like “[Event title]” and count as empty. */
export function isPlaceholder(value: string): boolean {
  return /^\[[^\]]*\]$/.test(value.trim());
}
