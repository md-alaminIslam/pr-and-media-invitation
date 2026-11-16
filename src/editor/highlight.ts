// How linked values look while editing (never saved, printed or exported):
// each value has its own colour (thin border, thick underline or light fill); the selected value is light red.

import { FIELD_DEFS, colorFor } from './values';

const MAX_GUESTS = 60;

export type HighlightMode = 'outline' | 'underline' | 'fill';

/** Base look of a value in its own colour, per mode. */
const look = (mode: HighlightMode, c: string) =>
  mode === 'underline' ? `box-shadow:0 3px 0 ${c};border-radius:0`
  : mode === 'fill' ? `background:${c}2e;box-shadow:none;border-radius:2px`
  : `box-shadow:0 0 0 1px ${c}b0;border-radius:2px`;
const hoverLook = (mode: HighlightMode, c: string) =>
  mode === 'underline' ? `box-shadow:0 4px 0 ${c}!important`
  : mode === 'fill' ? `background:${c}55!important`
  : `box-shadow:0 0 0 2px ${c}!important`;

export function highlightCss(scope = 'body.sv-doc ', mode: HighlightMode = 'outline'): string {
  const rules: string[] = [];
  for (const f of FIELD_DEFS) {
    if (f.key === 'specialGuests') continue;
    const c = colorFor(f.key);
    rules.push(`${scope}[data-field="${f.key}"]{${look(mode, c)}}`);
  }
  rules.push(`${scope}[data-field="specialGuests"]{box-shadow:none;background:none}`);
  for (let i = 1; i <= MAX_GUESTS; i++) {
    const c = colorFor(`specialGuests:${i}`);
    rules.push(`${scope}[data-guest="${i}"]{${look(mode, c)}}${scope}[data-guest="${i}"]::after{color:${c}}`);
  }
  rules.push(`${scope}[data-guest]::after{content:attr(data-guest);font-size:.62em;font-weight:700;vertical-align:super;line-height:0;margin-left:1px;font-family:Inter,sans-serif}`);
  rules.push(`${scope}[data-override]{box-shadow:none!important;background:none!important;outline:1px dashed #d97706;outline-offset:1px}`);
  return rules.join('\n');
}

const sel = (scope: string, key: string) => (key.startsWith('specialGuests:') ? `${scope}[data-guest="${key.split(':')[1]}"]` : `${scope}[data-field="${key}"]`);

/** Hovered value: thicker border in its own colour. Selected value: light red. */
export function focusCss(hoverKey: string | null, selectedKey: string | null, scope = 'body.sv-doc ', mode: HighlightMode = 'outline'): string {
  const rules: string[] = [];
  if (hoverKey && hoverKey !== selectedKey) rules.push(`${sel(scope, hoverKey)}{${hoverLook(mode, colorFor(hoverKey))}}`);
  if (selectedKey) rules.push(`${sel(scope, selectedKey)}{background:rgba(239,68,68,.16)!important;box-shadow:${mode === 'underline' ? '0 3px 0 #ef4444' : '0 0 0 1.5px #ef4444'}!important}`);
  return rules.join('\n');
}
