// Find the shared values inside documents and link them.
// Works on the document's text (block boundaries and <br> become "\n"),
// then wraps each hit in <span data-field="…" data-fmt="…"> without changing
// the visible text. Browser-only (uses the DOM).

import { BN_MONTHS, EN_MONTHS, Guest, Lang, ProjectValues, TextKey, acronymToBn, emptyValues, newId, prefixToBn, toEnDigits } from './values';
import { detectSeparator, parseGuest, prefixRe, splitGuestList } from './guestParse';
import { translateFormField } from '../utils/formTranslation';
import { translateGuestField } from '../utils/guestTranslation';

const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'TR', 'TABLE', 'BLOCKQUOTE', 'UL', 'OL', 'HR', 'PRE']);

interface Seg { node: Text; start: number; end: number }
interface Index { text: string; segs: Seg[]; taken: [number, number][] }

function buildIndex(root: Element): Index {
  let text = '';
  const segs: Seg[] = [];
  const taken: [number, number][] = [];
  const nl = () => { if (text && !text.endsWith('\n')) text += '\n'; };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = node.textContent || '';
      segs.push({ node: node as Text, start: text.length, end: text.length + t.length });
      text += t;
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName === 'BR') { text += '\n'; return; }
    const block = BLOCK.has(el.tagName);
    if (block) nl();
    const start = text.length;
    el.childNodes.forEach(walk);
    if (el.hasAttribute('data-field') || el.hasAttribute('data-guest')) taken.push([start, text.length]);
    if (block) nl();
  };
  root.childNodes.forEach(walk);
  return { text, segs, taken };
}

function isFree(idx: Index, start: number, end: number) {
  return !idx.taken.some(([a, b]) => start < b && end > a);
}

function pointAt(idx: Index, offset: number, isEnd: boolean): [Text, number] | null {
  for (const s of idx.segs) {
    if (isEnd ? offset > s.start && offset <= s.end : offset >= s.start && offset < s.end) return [s.node, offset - s.start];
  }
  return null;
}

/** Wrap text [start,end) in a span with the given attributes. Text is unchanged. */
function wrap(root: Element, start: number, end: number, attrs: Record<string, string>): HTMLElement | null {
  const idx = buildIndex(root);
  // Trim whitespace and line breaks at the edges.
  while (start < end && /\s/.test(idx.text[start])) start++;
  while (end > start && /\s/.test(idx.text[end - 1])) end--;
  if (end <= start || !isFree(idx, start, end)) return null;
  const a = pointAt(idx, start, false), b = pointAt(idx, end, true);
  if (!a || !b) return null;
  const doc = root.ownerDocument!;
  const range = doc.createRange();
  range.setStart(a[0], a[1]);
  range.setEnd(b[0], b[1]);
  const span = doc.createElement('span');
  for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  // Remove empty shells left by splitting.
  root.querySelectorAll('span:empty,strong:empty,b:empty,em:empty,i:empty,u:empty').forEach(e => { if (!e.hasAttribute('data-field')) e.remove(); });
  return span;
}

/* ---------------------------------------------------------------- */

export interface Found { key: string; value: any; raw: string; fmt?: string; det: string }
export interface DocResult { body: string; lang: Lang; found: Found[]; chief: Guest | null; special: Guest[]; specialSep?: string }

let detCounter = 0;
const det = () => 'd' + (++detCounter);

const EN_MONTH_RE = EN_MONTHS.join('|');
const BN_MONTH_RE = BN_MONTHS.join('|');
const CITY_EN = "Dhaka|Chattogram|Chittagong|Sylhet|Khulna|Rajshahi|Barishal|Barisal|Rangpur|Mymensingh|Gazipur|Narayanganj|Cox's Bazar|Comilla|Cumilla|Savar";
const CITY_BN = 'ঢাকা|চট্টগ্রাম|সিলেট|খুলনা|রাজশাহী|বরিশাল|রংপুর|ময়মনসিংহ|গাজীপুর|নারায়ণগঞ্জ|কক্সবাজার|কুমিল্লা|সাভার';

function iso(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function toGuest(p: ReturnType<typeof parseGuest>, lang: Lang): Guest {
  const bi = (s: string) => (lang === 'bn' ? { en: '', bn: s, bnCustom: true } : { en: s, bn: '' });
  return { id: newId(), prefixes: p.prefixes.map(bi), name: bi(p.name), postfixes: p.postfixes.map(bi), designation: bi(p.designation) };
}

function isBold(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (/^(STRONG|B|H\d)$/.test(e.tagName)) return true;
    const w = (e as HTMLElement).style?.fontWeight;
    if (w && (w === 'bold' || +w >= 600)) return true;
  }
  return false;
}

/** Detect and link values in one document body. */
export function detectDocument(body: string, lang: Lang): DocResult {
  const t = document.createElement('template');
  t.innerHTML = body;
  const root = document.createElement('div');
  root.appendChild(t.content);
  const found: Found[] = [];
  const out: DocResult = { body, lang, found, chief: null, special: [] };
  const add = (key: string, start: number, end: number, value: any, fmt?: string, extra: Record<string, string> = {}): string | null => {
    const id = det();
    const attrs: Record<string, string> = { 'data-field': key, 'data-det': id, ...extra };
    if (fmt) attrs['data-fmt'] = fmt;
    const idx = buildIndex(root);
    const raw = idx.text.slice(start, end).trim();
    if (!wrap(root, start, end, attrs)) return null;
    found.push({ key, value, raw, fmt, det: id });
    return id;
  };
  const text = () => buildIndex(root);
  const each = (re: RegExp, fn: (m: RegExpExecArray, idx: Index) => void) => {
    const idx = text();
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(idx.text))) { matches.push(m); if (!re.global) break; }
    // Apply from the end so earlier offsets stay valid even though text never changes.
    for (const mm of matches.reverse()) fn(mm, idx);
  };

  /* 1. Contact block: anchored on the phone line. */
  {
    const idx = text();
    const phoneRe = /(?:RSVP|Mobile|Phone|Cell|Contact|Tel|মোবাইল|ফোন|যোগাযোগ)\s*[:ঃ]\s*(\+?[0-9০-৯][0-9০-৯ \-]{6,}[0-9০-৯])/g;
    let last: RegExpExecArray | null = null, m: RegExpExecArray | null;
    while ((m = phoneRe.exec(idx.text))) last = m;
    if (last) {
      const pStart = last.index + last[0].length - last[1].length;
      const before = idx.text.slice(0, last.index);
      const lines: { s: number; e: number; t: string }[] = [];
      let pos = before.length;
      while (lines.length < 3 && pos > 0) {
        const nlAt = before.lastIndexOf('\n', pos - 1);
        const s = nlAt + 1;
        const line = before.slice(s, pos);
        if (line.trim()) lines.push({ s, e: pos, t: line.trim() });
        pos = nlAt < 0 ? 0 : nlAt;
      }
      const label = /^(message sender|massage sender|media contact|contact|sender|বার্তা প্রেরক|যোগাযোগ|প্রেরক)\s*[:ঃ]?$/i;
      const ok = (l: { t: string }) => l.t.length < 80 && !label.test(l.t) && !/[:ঃ]\s*$/.test(l.t) && !/[.।]$/.test(l.t);
      const usable = [] as typeof lines;
      for (const l of lines) { if (!ok(l)) break; usable.push(l); }
      // From the bottom: organization, title, name (2 lines → title, name).
      const keys: TextKey[] = usable.length >= 3 ? ['contactOrg', 'contactTitle', 'contactName'] : usable.length === 2 ? ['contactTitle', 'contactName'] : [];
      add('contactPhone', pStart, pStart + last[1].length, toEnDigits(last[1]).trim());
      keys.forEach((k, i) => add(k, usable[i].s, usable[i].e, usable[i].t));
    }
  }

  /* 2. Guests. */
  {
    const idx = text();
    const chiefRe = lang === 'bn' ? /প্রধান অতিথি\s*(?:হিসেবে)?\s*[:ঃ]?\s*/ : /Chief Guest\s*[:：]?\s*/i;
    const specialRe = lang === 'bn' ? /বিশেষ অতিথি(?:বৃন্দ)?\s*(?:হিসেবে)?\s*[:ঃ]?\s*/ : /Special Guests?\s*[:：]?\s*/i;
    const endRe = lang === 'bn'
      ? /\s*,?\s*(?:উক্ত\s|এছাড়া|উপস্থিত\s*(?:থাকবেন|ছিলেন|থেকে)|অনুষ্ঠানে\s+সরকারি)|\n/
      : /\s*,?\s*(?:will also be present|will be present|were (?:also )?present|also attended|were in attendance|graced the occasion)|\n/i;
    const cm = chiefRe.exec(idx.text);
    const sm = specialRe.exec(idx.text);
    const specialStart = sm ? sm.index + sm[0].length : -1;
    if (cm) {
      const s = cm.index + cm[0].length;
      let e = idx.text.length;
      const stop = endRe.exec(idx.text.slice(s));
      if (stop) e = s + stop.index;
      if (sm && sm.index > s && sm.index < e) {
        e = sm.index;
        while (e > s && /[\s,.;।]/.test(idx.text[e - 1])) e--;
      }
      // Chief guest phrase: drop a trailing sentence that is not part of the guest.
      const seg = idx.text.slice(s, e);
      const sentenceEnd = seg.search(lang === 'bn' ? /।/ : /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Md|Engr|Lt|Col|Gen|Capt|Maj|Brig|St))\.(?=\s+[A-Z][a-z])/);
      if (sentenceEnd > 0) e = s + sentenceEnd;
      while (e > s && /[\s,.;।]/.test(idx.text[e - 1])) e--;
      if (e > s && prefixRe(lang).test(idx.text.slice(s))) {
        const g = toGuest(parseGuest(idx.text.slice(s, e), lang), lang);
        out.chief = g;
        const id = add('chiefGuest', s, e, g);
        const span = id ? root.querySelector(`[data-det="${id}"]`) : null;
        const strong = span ? isBold(span.querySelector('strong,b,[style*="bold"],[style*="font-weight"]')) : false;
        if (span && strong) span.setAttribute('data-bold', '1');
      }
    }
    if (sm) {
      const idx2 = text();
      const s = specialStart;
      const stop = endRe.exec(idx2.text.slice(s));
      let e = stop ? s + stop.index : idx2.text.length;
      while (e > s && /[\s,.;।]/.test(idx2.text[e - 1])) e--;
      const seg = idx2.text.slice(s, e);
      const ranges = splitGuestList(seg, lang);
      if (ranges.length) {
        const sep = detectSeparator(seg, ranges);
        out.special = ranges.map(r => toGuest(parseGuest(seg.slice(r.start, r.end), lang), lang));
        out.specialSep = sep;
        // Inner guest spans first (so the order numbers show), then the list.
        for (let i = ranges.length - 1; i >= 0; i--) wrap(root, s + ranges[i].start, s + ranges[i].end, { 'data-guest': String(i + 1) });
        const listStart = s + ranges[0].start, listEnd = s + ranges[ranges.length - 1].end;
        // The list span must contain the guest spans: wrap with taken check disabled by clearing data-guest marks temporarily.
        root.querySelectorAll('[data-guest]').forEach(g => g.setAttribute('data-guest-tmp', g.getAttribute('data-guest')!));
        root.querySelectorAll('[data-guest]').forEach(g => g.removeAttribute('data-guest'));
        const id = det();
        const firstGuest = root.querySelector('[data-guest-tmp="1"]');
        const bold = isBold(firstGuest?.querySelector('strong,b,[style*="bold"],[style*="font-weight"]') || null);
        const span = wrap(root, listStart, listEnd, { 'data-field': 'specialGuests', 'data-sep': sep, 'data-det': id, ...(bold ? { 'data-bold': '1' } : {}) });
        root.querySelectorAll('[data-guest-tmp]').forEach(g => { g.setAttribute('data-guest', g.getAttribute('data-guest-tmp')!); g.removeAttribute('data-guest-tmp'); });
        if (span) found.push({ key: 'specialGuests', value: out.special, raw: seg, det: id });
      }
    }
  }

  /* 3. Visiting hours (before times, so its times are not taken as the event time). */
  each(lang === 'bn' ? /প্রতিদিন\s+((?:সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)[^।\n]*?পর্যন্ত)/g : /daily\s+from\s+([^.\n]+(?:AM|PM|am|pm))/g, (m, idx) => {
    const s = m.index + m[0].length - m[1].length;
    if (isFree(idx, s, s + m[1].length)) add('visitingHours', s, s + m[1].length, m[1].trim());
  });

  /* 4. Dates. */
  const dates: { s: number; e: number; iso: string; fmt: string }[] = [];
  {
    const idx = text();
    const res: RegExp[] = lang === 'bn'
      ? [new RegExp(`([০-৯0-9]{1,2})(ই|শে|লা|রা|ঠা)?\\s+(${BN_MONTH_RE})(?:(,?\\s*)([০-৯0-9]{4}))?`, 'g')]
      : [new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?\\s+(${EN_MONTH_RE})(?:(,?\\s+)((?:19|20)\\d{2}))?\\b`, 'g'), new RegExp(`\\b(${EN_MONTH_RE})\\s+(\\d{1,2})(st|nd|rd|th)?(?:(,?\\s+)((?:19|20)\\d{2}))?\\b`, 'g')];
    const docYear = (() => { const y = idx.text.match(lang === 'bn' ? /[০-৯]{4}/ : /\b(?:19|20)\d{2}\b/); return y ? +toEnDigits(y[0]) : new Date().getFullYear(); })();
    res.forEach((re, ri) => {
      let m: RegExpExecArray | null;
      while ((m = re.exec(idx.text))) {
        if (!isFree(idx, m.index, m.index + m[0].length)) continue;
        let day: number, month: number, year: number | null, fmt: string;
        if (lang === 'bn') {
          day = +toEnDigits(m[1]); month = BN_MONTHS.indexOf(m[3]); year = m[5] ? +toEnDigits(m[5]) : null;
          fmt = 'D' + (m[2] || '') + ' MMMM' + (year ? (m[4]?.includes(',') ? ', ' : ' ') + 'YYYY' : '');
        } else if (ri === 0) {
          day = +m[1]; month = EN_MONTHS.indexOf(m[3]); year = m[5] ? +m[5] : null;
          fmt = 'D' + (m[2] ? '[' + m[2] + ']' : '') + ' MMMM' + (year ? (m[4]?.includes(',') ? ', ' : ' ') + 'YYYY' : '');
        } else {
          month = EN_MONTHS.indexOf(m[1]); day = +m[2]; year = m[5] ? +m[5] : null;
          fmt = 'MMMM D' + (m[3] ? '[' + m[3] + ']' : '') + (year ? (m[4]?.includes(',') ? ', ' : ' ') + 'YYYY' : '');
        }
        if (day < 1 || day > 31 || month < 0) continue;
        dates.push({ s: m.index, e: m.index + m[0].length, iso: iso(year || docYear, month, day), fmt: fmt.replace(/\[(st|nd|rd|th)\]/, '') });
      }
    });
    dates.sort((a, b) => a.s - b.s);
    const firstText = idx.text.trimStart();
    const lead = idx.text.length - firstText.length;
    dates.forEach((d, i) => {
      const before = idx.text.slice(Math.max(0, d.s - 12), d.s);
      let key = 'eventDate';
      if (i === 0 && d.s - lead < 30 && !/(?:program|schedule|অনুষ্ঠানসূচি)/i.test(idx.text.slice(0, d.s))) key = 'issueDate';
      if (/(?:\bto|থেকে|–|-)\s*$/i.test(before) && i > 0) key = 'endDate';
      (d as any).key = key;
    });
    for (const d of [...dates].reverse()) add((d as any).key, d.s, d.e, d.iso, d.fmt);
  }

  /* 5. Event time. */
  each(lang === 'bn'
    ? /(সকাল|দুপুর|বিকাল|বিকেল|সন্ধ্যা|রাত)\s*([০-৯0-9]{1,2})(?:([.:])([০-৯0-9]{2}))?\s*(ঘটিকায়|টায়|টা)?/g
    : /\b(\d{1,2})([:.])(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/g, (m, idx) => {
    if (!isFree(idx, m.index, m.index + m[0].length)) return;
    const after = idx.text.slice(m.index + m[0].length, m.index + m[0].length + 8);
    const before = idx.text.slice(Math.max(0, m.index - 8), m.index);
    if (/^\s*(?:to|থেকে|-|–)/i.test(after) || /(?:from|to|থেকে)\s*$/i.test(before)) return;
    let H: number, M: string, fmt: string;
    if (lang === 'bn') {
      const h = +toEnDigits(m[2]); M = m[4] ? toEnDigits(m[4]) : '00';
      const pm = /দুপুর|বিকাল|বিকেল|সন্ধ্যা/.test(m[1]) || (m[1] === 'রাত' && h >= 6 && h < 12);
      H = pm && h < 12 ? h + 12 : h;
      fmt = 'P ' + (m[4] ? 'h' + m[3] + 'mm' : 'h') + (m[5] ? (m[5] === 'ঘটিকায়' ? ' ' : '') + m[5] : '');
    } else {
      const h = +m[1]; M = m[3];
      const pm = /p/i.test(m[4]);
      H = pm ? (h % 12) + 12 : h % 12;
      fmt = 'h' + m[2] + 'mm ' + (/\./.test(m[4]) ? m[4] : m[4].toUpperCase() === m[4] ? 'A' : 'A');
    }
    add('eventTime', m.index, m.index + m[0].length, `${String(H).padStart(2, '0')}:${M}`, fmt);
  });

  /* 6. Hall number. */
  each(lang === 'bn' ? /হল\s*([-–]?)\s*([০-৯0-9]{1,2})(?![০-৯0-9])/g : /\bHall\s*([-–]?)\s*(\d{1,2})\b/gi, (m, idx) => {
    if (!isFree(idx, m.index, m.index + m[0].length)) return;
    const n = +toEnDigits(m[2]);
    const word = lang === 'bn' ? 'হল' : m[0].match(/^hall/i)![0];
    const fmt = word + (m[1] ? m[1] : ' ') + (m[2].length === 2 ? '{nn}' : '{n}');
    add('hall', m.index, m.index + m[0].length, n, fmt);
  });

  /* 7. Edition, short name, year. */
  each(lang === 'bn' ? /([০-৯0-9]{1,2})(ম|য়|র্থ|ষ্ঠ|তম)(?=[\s"“”'’])/g : /\b(\d{1,2})(st|nd|rd|th)\b(?=\s+(?:Edition|[A-Z]))/g, (m, idx) => {
    if (isFree(idx, m.index, m.index + m[0].length)) add('edition', m.index, m.index + m[0].length, +toEnDigits(m[1]), 'ordinal');
  });
  each(/(?:^|[\s"“'–-])([A-Z][A-Z0-9]{2,9}|[ঀ-৿]{2,12})\s+((?:19|20|১৯|২০)[0-9০-৯]{2}|20[0-9০-৯]{2})(?![0-9০-৯])/g, (m, idx) => {
    const word = m[1];
    if (EN_MONTHS.some(x => x.toUpperCase() === word) || BN_MONTHS.includes(word)) return;
    if (/[ঀ-৿]/.test(word) && !/(?:ম|য়|র্থ|ষ্ঠ|তম)\s*$/.test(idx.text.slice(Math.max(0, m.index - 6), m.index + 1))) return; // Bangla short name only right after an edition
    const ws = m.index + m[0].indexOf(word);
    const ys = m.index + m[0].length - m[2].length;
    if (!isFree(idx, ws, ys + m[2].length)) return;
    add('year', ys, ys + m[2].length, +toEnDigits(m[2]));
    add('shortName', ws, ws + word.length, word);
  });

  /* 8. Exhibition full name (Latin text appears in Bangla documents too). */
  each(/(?:[A-Z][\w'’&.-]*|&)(?:\s+(?:[A-Z][\w'’&.-]*|and|And|&|of|on|the|for)){2,10}\s+(?:Expo|Exhibition|Fair|Show|Summit|Festival|Conference|Congress|Forum)\b/g, (m, idx) => {
    let s = m.index, str = m[0];
    const lead = str.match(/^(?:(?:The|Inauguration|Inaugural|Ceremony|Edition|of|the|Request|to|send|Journalist|International Exhibition)\s+)+/);
    if (lead) { s += lead[0].length; str = str.slice(lead[0].length); }
    if (str.split(/\s+/).length < 3 || !isFree(idx, s, s + str.length)) return;
    add('exhibitionName', s, s + str.length, str);
  });
  if (lang === 'bn') each(/বাংলাদেশ(?:\s+[ঀ-৿]+){1,7}?\s+(?:এক্সপো|প্রদর্শনী|মেলা)/g, (m, idx) => {
    if (isFree(idx, m.index, m.index + m[0].length)) add('exhibitionName', m.index, m.index + m[0].length, m[0]);
  });

  /* 9. Venue: text ending in a city, starting after a hall number, "at", "Place:", "স্থান:" or "আয়োজনে". */
  {
    const idx = text();
    const cityRe = new RegExp(`(?:${lang === 'bn' ? CITY_BN : CITY_EN})`, 'g');
    let m: RegExpExecArray | null;
    const hits: { s: number; e: number }[] = [];
    while ((m = cityRe.exec(idx.text))) {
      const end = m.index + m[0].length;
      const windowStart = Math.max(0, end - 160);
      const win = idx.text.slice(windowStart, end);
      const markers = lang === 'bn'
        ? [/স্থান\s*[:ঃ]\s*/g, /আয়োজনে\s+/g, /ঘটিকায়\s+/g, /\n/g]
        : [/(?:Place|Venue)\s*:\s*/g, /\bat\s+(?:the\s+)?/g, /\n/g];
      let best = -1;
      for (const r of markers) { let mm: RegExpExecArray | null; while ((mm = r.exec(win))) best = Math.max(best, mm.index + mm[0].length); }
      if (best < 0) continue;
      let s = windowStart + best;
      // Skip a leading linked hall ("Hall-04, ").
      const pre = idx.taken.find(([a, b]) => a <= s + 2 && b > s);
      if (pre) { s = pre[1]; while (/[\s,]/.test(idx.text[s] || '')) s++; }
      const str = idx.text.slice(s, end);
      if (str.length < 8 || str.length > 140 || /[.।:]/.test(str.replace(/\(.*?\)/g, ''))) continue;
      if (!isFree(idx, s, end)) continue; // e.g. a venue with the hall in the middle: leave it for manual linking
      hits.push({ s, e: end });
    }
    for (const h of hits.reverse()) {
      const v = idx.text.slice(h.s, h.e).trim();
      add('venue', h.s, h.e, v);
    }
  }

  /* 10. Organizer (company names not already linked). */
  each(lang === 'bn'
    ? /([ঀ-৿]+(?:\s+[ঀ-৿]+){0,4}\s+(?:লিমিটেড|লিঃ))/g
    : /\b([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,5}\s+(?:Limited|Ltd\.?|Inc\.?|Corporation|Company|Foundation|Association))\b/g, (m, idx) => {
    let s = m.index, str = m[1];
    if (lang === 'bn') { const words = str.split(' '); while (words.length > 3) { words.shift(); } s = m.index + m[0].length - words.join(' ').length; str = words.join(' '); }
    if (isFree(idx, s, s + str.length)) add('organizer', s, s + str.length, str);
  });

  root.querySelectorAll('span[data-field]').forEach(sp => { if (sp.getAttribute('data-field') === 'edition') sp.setAttribute('data-fmt', 'ordinal'); });
  out.body = root.innerHTML;
  return out;
}

/* ---------------------------------------------------------------- */

export interface Conflict { key: string; doc: string; lang: Lang; found: string; shared: string; det: string }

export interface DetectionSummary {
  values: ProjectValues;
  bodies: Record<string, string>;
  conflicts: Conflict[];
  counts: Record<string, number>;
  warnings: string[];
}

function mostCommon<T>(list: T[], key: (v: T) => string): T | undefined {
  const counts = new Map<string, { n: number; v: T }>();
  for (const v of list) { const k = key(v); const c = counts.get(k); if (c) c.n++; else counts.set(k, { n: 1, v }); }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.v;
}

function translateGuestPart(en: string, kind: 'nameEn' | 'designationEn') { return en ? translateGuestField(en, kind) : ''; }

/** Fill missing Bangla parts of a guest from English (offline, marked auto). */
export function fillGuestBangla(g: Guest): Guest {
  return {
    ...g,
    prefixes: g.prefixes.map(p => (p.bn ? p : { ...p, bn: prefixToBn(p.en) || p.en, bnCustom: false })),
    postfixes: g.postfixes.map(p => (p.bn ? p : { ...p, bn: acronymToBn(p.en), bnCustom: false })),
    name: g.name.bn ? g.name : { ...g.name, bn: translateGuestPart(g.name.en, 'nameEn'), bnCustom: false },
    designation: g.designation.bn ? g.designation : { ...g.designation, bn: translateGuestPart(g.designation.en, 'designationEn'), bnCustom: false },
  };
}

function mergeGuest(en: Guest | undefined, bn: Guest | undefined): Guest | null {
  if (!en && !bn) return null;
  const base: Guest = en ? JSON.parse(JSON.stringify(en)) : { id: newId(), prefixes: [], name: { en: '', bn: '' }, postfixes: [], designation: { en: '', bn: '' } };
  if (bn) {
    base.name.bn = bn.name.bn; base.name.bnCustom = true;
    base.designation.bn = bn.designation.bn; base.designation.bnCustom = true;
    const pre = Math.max(base.prefixes.length, bn.prefixes.length);
    base.prefixes = Array.from({ length: pre }, (_, i) => ({ en: base.prefixes[i]?.en || '', bn: bn.prefixes[i]?.bn || '', bnCustom: !!bn.prefixes[i] }));
    const post = Math.max(base.postfixes.length, bn.postfixes.length);
    base.postfixes = Array.from({ length: post }, (_, i) => ({ en: base.postfixes[i]?.en || '', bn: bn.postfixes[i]?.bn || '', bnCustom: !!bn.postfixes[i] }));
  }
  return fillGuestBangla(base);
}

/** Detect in all documents and merge into one set of shared values. */
export function detectProject(docs: { file: string; lang: Lang; body: string }[]): DetectionSummary {
  const results = docs.map(d => ({ file: d.file, ...detectDocument(d.body, d.lang) }));
  const values = emptyValues();
  const conflicts: Conflict[] = [];
  const counts: Record<string, number> = {};
  const warnings: string[] = [];
  const all = results.flatMap(r => r.found.map(f => ({ ...f, file: r.file, lang: r.lang })));
  for (const f of all) counts[f.key] = (counts[f.key] || 0) + 1;

  const scalarKeys = ['edition', 'year', 'hall', 'eventDate', 'endDate', 'issueDate', 'eventTime', 'contactPhone'];
  for (const key of scalarKeys) {
    const list = all.filter(f => f.key === key);
    const top = mostCommon(list, f => String(f.value));
    if (!top) continue;
    (values as any)[key] = top.value;
    for (const f of list) if (String(f.value) !== String(top.value)) conflicts.push({ key, doc: f.file, lang: f.lang, found: f.raw, shared: String(top.value), det: f.det });
  }
  const textKeys: TextKey[] = ['exhibitionName', 'shortName', 'venue', 'organizer', 'visitingHours', 'contactName', 'contactTitle', 'contactOrg'];
  for (const key of textKeys) {
    const bi: { en: string; bn: string; bnCustom?: boolean } = { en: '', bn: '' };
    for (const lang of ['en', 'bn'] as Lang[]) {
      const list = all.filter(f => f.key === key && f.lang === lang);
      const top = mostCommon(list, f => String(f.value).replace(/\s+/g, ' ').trim());
      if (!top) continue;
      bi[lang] = String(top.value).replace(/\s+/g, ' ').trim();
      for (const f of list) if (String(f.value).replace(/\s+/g, ' ').trim() !== bi[lang]) conflicts.push({ key, doc: f.file, lang, found: f.raw, shared: bi[lang], det: f.det });
    }
    if (!bi.en && !bi.bn) continue;
    if (bi.bn) bi.bnCustom = true;
    else if (bi.en) bi.bn = key.startsWith('contactName') ? translateGuestField(bi.en, 'nameEn') : translateFormField(bi.en, key + 'En');
    values.text[key] = bi;
  }

  // Guests: English lists give the parts, Bangla lists give the Bangla text, aligned by order.
  const enDocs = results.filter(r => r.lang === 'en'), bnDocs = results.filter(r => r.lang === 'bn');
  const longest = (rs: typeof results) => rs.map(r => r.special).sort((a, b) => b.length - a.length)[0] || [];
  const enList = longest(enDocs), bnList = longest(bnDocs);
  const n = Math.max(enList.length, bnList.length);
  values.specialGuests = Array.from({ length: n }, (_, i) => mergeGuest(enList[i], bnList[i])!).filter(Boolean);
  values.chiefGuest = mergeGuest(enDocs.find(r => r.chief)?.chief || undefined, bnDocs.find(r => r.chief)?.chief || undefined);
  const lengths = results.filter(r => r.special.length).map(r => `${r.file.replace(/\.html$/, '')}: ${r.special.length}`);
  if (new Set(results.filter(r => r.special.length).map(r => r.special.length)).size > 1) warnings.push(`Special guest count differs between documents (${lengths.join(', ')}). All documents will use the same list of ${n}.`);
  const bodies = Object.fromEntries(results.map(r => [r.file, r.body]));
  return { values, bodies, conflicts, counts, warnings };
}

/** After review: keep chosen conflicts as per-document text, drop detection markers. */
export function finalizeBodies(bodies: Record<string, string>, keepCustom: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [file, body] of Object.entries(bodies)) {
    const t = document.createElement('template');
    t.innerHTML = body;
    t.content.querySelectorAll('[data-det]').forEach(el => {
      if (keepCustom.has(el.getAttribute('data-det')!)) el.setAttribute('data-override', '1');
      el.removeAttribute('data-det');
    });
    out[file] = t.innerHTML;
  }
  return out;
}
