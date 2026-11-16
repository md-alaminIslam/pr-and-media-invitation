// How linked values look while editing (never saved, printed or exported):
// each value has its own thin overlay border colour; the selected value is light red.

import { FIELD_DEFS, colorFor } from './values';

const MAX_GUESTS = 60;

export function highlightCss(scope = 'body.sv-doc '): string {
  const rules: string[] = [];
  for (const f of FIELD_DEFS) {
    if (f.key === 'specialGuests') continue;
    const c = colorFor(f.key);
    rules.push(`${scope}[data-field="${f.key}"]{box-shadow:0 0 0 1px ${c}b0;border-radius:2px}`);
  }
  rules.push(`${scope}[data-field="specialGuests"]{box-shadow:none}`);
  for (let i = 1; i <= MAX_GUESTS; i++) {
    const c = colorFor(`specialGuests:${i}`);
    rules.push(`${scope}[data-guest="${i}"]{box-shadow:0 0 0 1px ${c}b0;border-radius:2px}${scope}[data-guest="${i}"]::after{color:${c}}`);
  }
  rules.push(`${scope}[data-guest]::after{content:attr(data-guest);font-size:.62em;font-weight:700;vertical-align:super;line-height:0;margin-left:1px;font-family:Inter,sans-serif}`);
  rules.push(`${scope}[data-override]{box-shadow:none!important;outline:1px dashed #d97706;outline-offset:1px}`);
  return rules.join('\n');
}

const sel = (scope: string, key: string) => (key.startsWith('specialGuests:') ? `${scope}[data-guest="${key.split(':')[1]}"]` : `${scope}[data-field="${key}"]`);

/** Hovered value: thicker border in its own colour. Selected value: light red. */
export function focusCss(hoverKey: string | null, selectedKey: string | null, scope = 'body.sv-doc '): string {
  const rules: string[] = [];
  if (hoverKey && hoverKey !== selectedKey) rules.push(`${sel(scope, hoverKey)}{box-shadow:0 0 0 2px ${colorFor(hoverKey)}!important}`);
  if (selectedKey) rules.push(`${sel(scope, selectedKey)}{background:rgba(239,68,68,.16)!important;box-shadow:0 0 0 1.5px #ef4444!important}`);
  return rules.join('\n');
}
