// Offline English → Bangla for shared values, with a glossary that remembers
// every Bangla correction you make (names, designations, venues…).

import { translateFormField } from '../utils/formTranslation';
import { translateGuestField } from '../utils/guestTranslation';
import { Bi, Guest, TextKey, acronymToBn, prefixToBn } from './values';

const KEY = 'savor-studio-glossary-v1';
let glossary: Record<string, string> | null = null;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function load(): Record<string, string> {
  if (glossary) return glossary;
  try { glossary = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { glossary = {}; }
  return glossary!;
}

export function remember(en: string, bn: string) {
  if (!en.trim() || !bn.trim()) return;
  const g = load();
  g[norm(en)] = bn.trim();
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}

export function fromGlossary(en: string): string | undefined {
  return load()[norm(en)];
}

export type TextKind = 'name' | 'designation' | 'text';

export function kindOf(key: TextKey | 'guestName' | 'guestDesignation'): TextKind {
  if (key === 'contactName' || key === 'guestName') return 'name';
  if (key === 'contactTitle' || key === 'guestDesignation') return 'designation';
  return 'text';
}

/** Offline Bangla for an English value. */
export function autoBn(en: string, kind: TextKind, fieldKey = ''): string {
  if (!en.trim()) return '';
  const g = fromGlossary(en);
  if (g) return g;
  if (kind === 'name') return translateGuestField(en, 'nameEn');
  if (kind === 'designation') return translateGuestField(en, 'designationEn');
  return translateFormField(en, fieldKey ? fieldKey + 'En' : 'text');
}

/* Auto-translate while typing: off, the offline dictionary, or an AI provider (applied by the project screen). */
export type AutoMode = { on: boolean; engine: string }; // engine: 'offline' | provider id
const MODE_KEY = 'savor-studio-auto-translate';
let mode: AutoMode = (() => { try { return JSON.parse(localStorage.getItem(MODE_KEY) || '') as AutoMode; } catch { return { on: true, engine: 'offline' }; } })();
if (!mode || typeof mode.on !== 'boolean') mode = { on: true, engine: 'offline' };
export const getAutoMode = () => mode;
export function setAutoMode(m: AutoMode) { mode = m; try { localStorage.setItem(MODE_KEY, JSON.stringify(m)); } catch {} }

/** Set the English side; Bangla follows automatically (offline mode) unless it was typed by hand. */
export function withEn(b: Bi | undefined, en: string, kind: TextKind, fieldKey = ''): Bi {
  const cur = b || { en: '', bn: '' };
  // English unchanged, or auto-translate off: the Bangla stays as it is.
  if (en === cur.en || !mode.on) return { en, bn: cur.bn, bnCustom: cur.bnCustom };
  // The English changed, so the old Bangla no longer matches — even if it was typed by hand.
  if (mode.engine !== 'offline') return { en, bn: cur.bn, bnCustom: false }; // the AI watcher fills it in
  const bn = autoBn(en, kind, fieldKey);
  return /[\u0980-\u09FF]/.test(bn) || !cur.bn ? { en, bn, bnCustom: false } : { en, bn: cur.bn, bnCustom: cur.bnCustom };
}

/** Set the Bangla side by hand (remembered for next time). */
export function withBn(b: Bi | undefined, bn: string): Bi {
  const cur = b || { en: '', bn: '' };
  if (cur.en && bn) remember(cur.en, bn);
  return { en: cur.en, bn, bnCustom: bn !== '' };
}

export function prefixBi(en: string): Bi {
  const g = fromGlossary(en);
  return { en, bn: g || prefixToBn(en) || en, bnCustom: false };
}

export function postfixBi(en: string): Bi {
  const g = fromGlossary(en);
  return { en, bn: g || acronymToBn(en), bnCustom: false };
}

/** Re-translate a whole guest offline (only parts that are not custom, unless forced). */
export function autoGuest(g: Guest, force = false): Guest {
  const t = (b: Bi, kind: TextKind) => (b.bnCustom && !force ? b : { ...b, bn: autoBn(b.en, kind) || b.bn, bnCustom: false });
  return {
    ...g,
    prefixes: g.prefixes.map(p => (p.bnCustom && !force ? p : { ...p, bn: fromGlossary(p.en) || prefixToBn(p.en) || p.bn || p.en, bnCustom: false })),
    postfixes: g.postfixes.map(p => (p.bnCustom && !force ? p : { ...p, bn: fromGlossary(p.en) || acronymToBn(p.en), bnCustom: false })),
    name: t(g.name, 'name'),
    designation: t(g.designation, 'designation'),
  };
}
