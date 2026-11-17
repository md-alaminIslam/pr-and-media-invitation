// A Media Studio document is a standalone, printable .html file.
// The model below is what the editor works with; serialize/parse convert it
// to and from the saved file.

import { DEFAULT_PAGE_MARGINS, PageMargins, normalizeMargins } from '../utils/pageMargins';
import { sanitizeEditorHtml } from './sanitize';

export type DocLang = 'bn' | 'en';

export interface DocModel {
  title: string;
  lang: DocLang;
  margins: PageMargins;
  /** Default font family for the page body. */
  font: string;
  /** Default font size in pt. */
  fontSize: number;
  body: string;
}

export const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Serif+Bengali:wght@400;600;700&family=Tiro+Bangla:ital@0;1&family=Inter:wght@400;500;600;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap';

export const FONTS: { label: string; value: string }[] = [
  { label: 'Hind Siliguri', value: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif" },
  { label: 'Noto Sans Bengali', value: "'Noto Sans Bengali', 'Hind Siliguri', sans-serif" },
  { label: 'Noto Serif Bengali', value: "'Noto Serif Bengali', 'Tiro Bangla', serif" },
  { label: 'Tiro Bangla', value: "'Tiro Bangla', 'Noto Serif Bengali', serif" },
  { label: 'SutonnyMJ / Kalpurush (installed)', value: "'Kalpurush', 'SutonnyMJ', 'Hind Siliguri', sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', 'Noto Serif', 'Noto Serif Bengali', serif" },
  { label: 'Inter', value: "'Inter', 'Hind Siliguri', sans-serif" },
  { label: 'Arial', value: "Arial, 'Hind Siliguri', sans-serif" },
  { label: 'Calibri', value: "Calibri, Carlito, 'Hind Siliguri', sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Noto Serif Bengali', serif" },
];

export const DEFAULT_FONT: Record<DocLang, string> = {
  bn: FONTS[0].value,
  en: FONTS[5].value,
};

export function emptyDoc(title: string, lang: DocLang, body = '<p><br></p>'): DocModel {
  return { title, lang, margins: { ...DEFAULT_PAGE_MARGINS }, font: DEFAULT_FONT[lang], fontSize: 12, body };
}

/** Typography shared by the editor canvas, saved files, print and PDF. */
export function documentCss(model: Pick<DocModel, 'font' | 'fontSize' | 'margins'>): string {
  const m = model.margins;
  return `
:root{color-scheme:light}
html{background:#fff}
.sv-doc{font-family:${model.font};font-size:${model.fontSize}pt;line-height:1.6;color:#111;background:#fff;word-wrap:break-word;overflow-wrap:break-word;-webkit-line-break:after-white-space}
body.sv-doc{box-sizing:border-box;margin:0 auto;max-width:210mm;min-height:297mm;padding:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}
.sv-doc p{margin:0 0 .55em}
.sv-doc h1{font-size:1.6em;line-height:1.25;margin:0 0 .5em}
.sv-doc h2{font-size:1.3em;line-height:1.3;margin:.8em 0 .45em}
.sv-doc h3{font-size:1.12em;margin:.7em 0 .4em}
.sv-doc ul,.sv-doc ol{margin:0 0 .6em;padding-left:1.6em}
.sv-doc li{margin:0 0 .2em}
.sv-doc blockquote{margin:0 0 .6em;padding-left:1em;border-left:3px solid #d4d4d8;color:#3f3f46}
.sv-doc table{border-collapse:collapse;width:100%;margin:0 0 .8em}
.sv-doc td,.sv-doc th{border:1px solid #a1a1aa;padding:4pt 6pt;vertical-align:top}
.sv-doc table.sv-plain td,.sv-doc table.sv-plain th{border:none}
.sv-doc img{max-width:100%;height:auto}
.sv-doc hr{border:none;border-top:1px solid #a1a1aa;margin:.8em 0}
.sv-doc a{color:#1d4ed8}
.sv-doc .sv-page-break{break-after:page;page-break-after:always;height:0;margin:0;border:none}
@page{size:A4;margin:${m.top}in ${m.right}in ${m.bottom}in ${m.left}in}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body.sv-doc{padding:0;max-width:none;min-height:0}.sv-doc p,.sv-doc li,.sv-doc h1,.sv-doc h2,.sv-doc h3,.sv-doc h4,.sv-doc blockquote,.sv-doc table,.sv-doc .sv-textbox,.sv-doc img{break-inside:avoid}}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function serializeDoc(model: DocModel): string {
  const m = model.margins;
  return `<!DOCTYPE html>
<html lang="${model.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SAVOR Media Studio">
<meta name="savor:margins" content="${m.top} ${m.right} ${m.bottom} ${m.left}">
<meta name="savor:font" content="${esc(model.font)}">
<meta name="savor:font-size" content="${model.fontSize}">
<title>${esc(model.title)}</title>
<link rel="stylesheet" href="${FONT_LINK}">
<style>${documentCss(model)}
</style>
</head>
<body class="sv-doc">
${model.body}
</body>
</html>
`;
}

const BANGLA = /[ঀ-৿]/g;

export function guessLang(text: string): DocLang {
  const letters = text.replace(/[\s\d\p{P}]/gu, '');
  if (!letters) return 'en';
  return (letters.match(BANGLA)?.length || 0) / letters.length > 0.25 ? 'bn' : 'en';
}

/** Parse a saved document (or any HTML / fragment) into a model. Browser-only. */
export function parseDoc(html: string, fallbackTitle = 'Untitled'): DocModel {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
  const body = sanitizeEditorHtml(doc.body?.innerHTML || '') || '<p><br></p>';
  const langAttr = (doc.documentElement.getAttribute('lang') || '').toLowerCase();
  const lang: DocLang = langAttr.startsWith('bn') ? 'bn' : langAttr.startsWith('en') ? 'en' : guessLang(doc.body?.textContent || '');
  const marginParts = meta('savor:margins').split(/\s+/).map(Number);
  const margins = marginParts.length === 4 && marginParts.every(n => Number.isFinite(n))
    ? normalizeMargins({ top: marginParts[0], right: marginParts[1], bottom: marginParts[2], left: marginParts[3] })
    : { ...DEFAULT_PAGE_MARGINS };
  const font = meta('savor:font');
  const size = Number(meta('savor:font-size'));
  return {
    title: (doc.title || '').trim() || fallbackTitle,
    lang,
    margins,
    font: font && !/[;{}<>]|url\s*\(/i.test(font) ? font : DEFAULT_FONT[lang],
    fontSize: size >= 6 && size <= 72 ? size : 12,
    body,
  };
}
