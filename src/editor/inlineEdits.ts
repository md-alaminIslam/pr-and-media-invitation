// Turn text typed into a page back into shared values (any document, either language).

import { InlineEdit } from './bindings';
import { parseGuest } from './guestParse';
import { Bi, Guest, Lang, ProjectValues, TextKey } from './values';
import { getAutoMode, kindOf, postfixBi, prefixBi, withBn, withEn } from './autoTranslate';

function tokens(list: Bi[], typed: string[], lang: Lang, make: (en: string) => Bi): Bi[] {
  if (lang === 'en') return typed.map((t, i) => (list[i]?.en === t ? list[i] : list[i]?.bnCustom && !getAutoMode().on ? { ...list[i], en: t } : make(t)));
  return typed.map((t, i) => ({ en: list[i]?.en || '', bn: t, bnCustom: true }));
}

export function guestFromText(g: Guest, text: string, lang: Lang): Guest {
  const p = parseGuest(text, lang);
  if (!p.name) return g;
  return {
    ...g,
    prefixes: tokens(g.prefixes, p.prefixes, lang, prefixBi),
    postfixes: tokens(g.postfixes, p.postfixes, lang, postfixBi),
    name: lang === 'en' ? withEn(g.name, p.name, 'name') : withBn(g.name, p.name),
    designation: lang === 'en' ? withEn(g.designation, p.designation, 'designation') : withBn(g.designation, p.designation),
  };
}

export function applyInlineEdits(cur: ProjectValues, edits: InlineEdit[], lang: Lang): { next: ProjectValues; keys: string[] } {
  const next: ProjectValues = { ...cur, text: { ...cur.text }, specialGuests: [...cur.specialGuests] };
  const keys: string[] = [];
  for (const e of edits) {
    if (e.kind === 'text') {
      if (e.key === 'contactPhone') next.contactPhone = e.text;
      else next.text[e.key as TextKey] = lang === 'en' ? withEn(cur.text[e.key as TextKey], e.text, kindOf(e.key as TextKey), e.key) : withBn(cur.text[e.key as TextKey], e.text);
      keys.push(e.key);
    } else if (e.kind === 'number') {
      next[e.key] = e.value;
      keys.push(e.key);
    } else if (e.index === 0 && cur.chiefGuest) {
      next.chiefGuest = guestFromText(cur.chiefGuest, e.text, lang);
      keys.push('chiefGuest');
    } else if (e.index > 0 && cur.specialGuests[e.index - 1]) {
      next.specialGuests[e.index - 1] = guestFromText(cur.specialGuests[e.index - 1], e.text, lang);
      keys.push('specialGuests');
    }
  }
  return { next, keys };
}
