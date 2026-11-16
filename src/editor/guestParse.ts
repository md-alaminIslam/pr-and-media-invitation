// Split a guest phrase like
//   "Rear Admiral Dr. Khandakar Akhter Hossain, NBP, NUP, ndc, psc, PhD, Vice-Chancellor, Bangladesh Maritime University"
// into prefixes / name / postfixes / designation. Pure string logic (testable).

import { BN_PREFIXES, EN_PREFIXES, type Lang, isBnAcronym } from './values';

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const enPrefixRe = new RegExp('^(?:' + [...EN_PREFIXES].sort((a, b) => b.length - a.length).map(escRe).join('|') + ')(?=\\s|$)');
const bnPrefixRe = new RegExp('^(?:' + [...BN_PREFIXES].sort((a, b) => b.length - a.length).map(escRe).join('|') + ')(?=\\s|$)');

export const prefixRe = (lang: Lang) => (lang === 'bn' ? bnPrefixRe : enPrefixRe);

const LOWER_POSTFIX = new Set(['ndc', 'psc', 'ncc', 'afwc', 'rcds', 'mdc', 'ndu', 'acsc', 'fawc', 'nswc', 'awc', 'hdmc', 'ldmc', 'pcgm', 'phd', 'mphil', 'mba', 'mbbs', 'fcps', 'frcs', 'peng', 'sgp', 'aceo']);
const NOT_POSTFIX = new Set(['CEO', 'CFO', 'COO', 'CTO', 'CIO', 'MD', 'DMD', 'AMD', 'CMD', 'DG', 'ADG', 'GM', 'DGM', 'AGM', 'VC', 'ED', 'EVP', 'SVP', 'VP', 'SEVP', 'DIG', 'IGP', 'UNO', 'DC', 'SP', 'OC']);

export function isEnPostfix(token: string): boolean {
  const t = token.trim();
  if (!/^\(?[A-Za-z]{2,6}\)?$/.test(t)) return false;
  const bare = t.replace(/[()]/g, '');
  if (NOT_POSTFIX.has(bare)) return false;
  if (LOWER_POSTFIX.has(bare.toLowerCase())) return true;
  return (bare.match(/[A-Z]/g)?.length || 0) >= 2;
}

export interface ParsedGuest { prefixes: string[]; name: string; postfixes: string[]; designation: string }

export function parseGuest(text: string, lang: Lang): ParsedGuest {
  let rest = text.replace(/\s+/g, ' ').trim().replace(/[\s,.।]+$/, '');
  const prefixes: string[] = [];
  const re = prefixRe(lang);
  for (let i = 0; i < 4; i++) {
    const m = rest.match(re);
    if (!m) break;
    prefixes.push(m[0]);
    rest = rest.slice(m[0].length).trim();
  }
  const parts = rest.split(/\s*,\s*/);
  const name = (parts.shift() || '').trim();
  const postfixes: string[] = [];
  while (parts.length && (lang === 'bn' ? isBnAcronym(parts[0]) : isEnPostfix(parts[0]))) postfixes.push(parts.shift()!.trim());
  return { prefixes, name, postfixes, designation: parts.join(', ').trim() };
}

/** Find where each guest starts in a list segment: the start and after each ", " / ". " / "। " that is followed by a prefix. */
export function splitGuestList(segment: string, lang: Lang): { start: number; end: number }[] {
  const re = prefixRe(lang);
  const starts: number[] = [];
  const sepRe = lang === 'bn' ? /[,।.]\s+/g : /[,.;]\s+/g;
  let lead = segment.match(/^\s*/)![0].length;
  starts.push(lead);
  let m: RegExpExecArray | null;
  while ((m = sepRe.exec(segment))) {
    const pos = m.index + m[0].length;
    // "Mr. Md." — a period inside a prefix/abbreviation is not a separator.
    if (m[0][0] === '.' && /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Engr|Md|Mohd|Lt|Col|Gen|Brig|Capt|Maj|St|Jr|Sr|No|H\.E)$/.test(segment.slice(0, m.index))) continue;
    if (re.test(segment.slice(pos))) starts.push(pos);
  }
  return starts.map((s, i) => {
    let end = i + 1 < starts.length ? starts[i + 1] : segment.length;
    while (end > s && /[\s,.;।]/.test(segment[end - 1])) end--;
    return { start: s, end };
  }).filter(r => r.end > r.start);
}

/** Separator style used between guests in a segment. */
export function detectSeparator(segment: string, ranges: { start: number; end: number }[]): 'comma' | 'period' | 'and' {
  let commas = 0, periods = 0, and = false;
  for (let i = 0; i + 1 < ranges.length; i++) {
    const gap = segment.slice(ranges[i].end, ranges[i + 1].start);
    if (/\band\b|এবং|ও\s*$/.test(gap) && i + 2 === ranges.length) and = true;
    if (/[.।]/.test(gap)) periods++; else commas++;
  }
  if (and) return 'and';
  return periods > commas ? 'period' : 'comma';
}
