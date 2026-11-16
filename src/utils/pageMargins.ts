/** Page margins for printed output (browser print, PDF and Word), in inches. */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarginSide = keyof PageMargins;
export const MARGIN_SIDES: MarginSide[] = ['top', 'right', 'bottom', 'left'];

/** A4 paper size in inches. */
export const A4_WIDTH_IN = 210 / 25.4;
export const A4_HEIGHT_IN = 297 / 25.4;
export const MIN_MARGIN_IN = 0;
export const MAX_MARGIN_IN = 3;
/** Smallest width/height of the printable area that is allowed to remain. */
export const MIN_CONTENT_IN = 2;

export const DEFAULT_PAGE_MARGINS: PageMargins = { top: 1, right: 1, bottom: 1, left: 1 };

export const MARGIN_PRESETS: { id: string; label: string; margins: PageMargins }[] = [
  { id: 'normal', label: 'Normal (1")', margins: { top: 1, right: 1, bottom: 1, left: 1 } },
  { id: 'narrow', label: 'Narrow (0.5")', margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } },
  { id: 'moderate', label: 'Moderate (1" / 0.75")', margins: { top: 1, right: 0.75, bottom: 1, left: 0.75 } },
  { id: 'wide', label: 'Wide (1" / 2")', margins: { top: 1, right: 2, bottom: 1, left: 2 } },
];

export const PAGE_MARGINS_KEY = 'savor-page-margins-v1';

const round = (n: number) => Math.round(n * 100) / 100;

/** Clamp a single value to the allowed margin range, rounded to 0.01 inch. */
export function clampMargin(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return round(Math.min(MAX_MARGIN_IN, Math.max(MIN_MARGIN_IN, n)));
}

/** Returns an error message if the margins leave too little room on A4, otherwise null. */
export function marginError(m: PageMargins): string | null {
  if (A4_WIDTH_IN - m.left - m.right < MIN_CONTENT_IN) return `Left + right margins must leave at least ${MIN_CONTENT_IN}" of text width (A4 is ${round(A4_WIDTH_IN)}" wide).`;
  if (A4_HEIGHT_IN - m.top - m.bottom < MIN_CONTENT_IN) return `Top + bottom margins must leave at least ${MIN_CONTENT_IN}" of text height (A4 is ${round(A4_HEIGHT_IN)}" tall).`;
  return null;
}

/** Normalise untrusted input (e.g. from localStorage) into valid margins. */
export function normalizeMargins(input: unknown): PageMargins {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const m = {} as PageMargins;
  for (const side of MARGIN_SIDES) m[side] = clampMargin(src[side], DEFAULT_PAGE_MARGINS[side]);
  return marginError(m) ? { ...DEFAULT_PAGE_MARGINS } : m;
}

export function loadPageMargins(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): PageMargins {
  try { return normalizeMargins(JSON.parse(storage?.getItem(PAGE_MARGINS_KEY) || 'null')); }
  catch { return { ...DEFAULT_PAGE_MARGINS }; }
}

export function savePageMargins(m: PageMargins, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(PAGE_MARGINS_KEY, JSON.stringify(m)); } catch { /* storage unavailable */ }
}

export const inchesToMm = (inches: number) => inches * 25.4;
/** Word measures page margins in twentieths of a point (1440 per inch). */
export const inchesToTwips = (inches: number) => Math.round(inches * 1440);
/** CSS pixels at 96 DPI. */
export const inchesToPx = (inches: number) => inches * 96;

/** CSS `@page` rule applying the margins to browser printing. */
export function printPageCss(m: PageMargins): string {
  return `@media print { @page { size: A4 portrait; margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; } }`;
}

export function docxPageMargins(m: PageMargins) {
  return { top: inchesToTwips(m.top), right: inchesToTwips(m.right), bottom: inchesToTwips(m.bottom), left: inchesToTwips(m.left) };
}
