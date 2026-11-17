// Show a document as real A4 sheets, the way the printer lays it out, and keep
// floating text boxes from covering text. Shared by the editor canvas and the
// print preview so the two always match. Browser-only.

import type { PageMargins } from '../utils/pageMargins';

export const PX_PER_IN = 96;
export const PAGE_H_PX = (297 / 25.4) * PX_PER_IN;
export const PAGE_W_PX = (210 / 25.4) * PX_PER_IN;
export const SHEET_GAP = 32; // space between sheets on screen

/** Sheets: white A4 pages with a gap between them (screen only). */
export const SHEET_CSS = `
html{background:transparent}
body.sv-doc{margin:0;max-width:none;width:210mm;box-sizing:border-box;min-height:297mm;background-color:transparent;
 background-image:repeating-linear-gradient(to bottom,#fff 0,#fff ${PAGE_H_PX}px,transparent ${PAGE_H_PX}px,transparent ${PAGE_H_PX + SHEET_GAP}px)}
`;

const rectOf = (el: Element) => el.getBoundingClientRect();

/** Elements that are positioned on top of the text (Word text boxes and the like). */
function floating(body: HTMLElement): HTMLElement[] {
  return Array.from(body.querySelectorAll<HTMLElement>('[style*="absolute"]')).filter(el => el.style.position === 'absolute');
}

/**
 * Turn floating boxes into normal blocks placed where they appeared, so the text
 * after them starts below them instead of being hidden. Returns true when changed.
 */
export function flowBoxes(d: Document): boolean {
  const body = d.body;
  const boxes = floating(body);
  if (!boxes.length) return false;
  for (const box of boxes) {
    const parent = box.parentElement;
    if (!parent) continue;
    const br = rectOf(box);
    const cs = d.defaultView!.getComputedStyle(box);
    const left = parseFloat(cs.left) || 0;
    const pr = rectOf(parent);
    let prevBottom = pr.top + (parseFloat(d.defaultView!.getComputedStyle(parent).paddingTop) || 0);
    let after: Element | null = null;
    for (const s of Array.from(parent.children)) {
      if (s === box || (s as HTMLElement).style?.position === 'absolute') continue;
      const r = rectOf(s);
      if (r.height === 0 && !r.width) continue;
      if (r.bottom <= br.top + 2) { after = s; prevBottom = r.bottom; }
    }
    if (after) after.after(box); else parent.prepend(box);
    box.style.removeProperty('position');
    box.style.removeProperty('top');
    box.style.removeProperty('left');
    box.style.removeProperty('right');
    box.style.removeProperty('bottom');
    box.style.marginTop = Math.max(0, Math.round((br.top - prevBottom) * 0.75 * 10) / 10) + 'pt';
    if (left > 0.5) box.style.marginLeft = Math.round(left * 0.75 * 10) / 10 + 'pt';
    box.classList.add('sv-textbox');
  }
  // Wrappers that only existed to anchor the boxes are no longer needed.
  body.querySelectorAll<HTMLElement>('div[style]').forEach(el => {
    if ((el.getAttribute('style') || '').replace(/\s|;/g, '') === 'position:relative') el.replaceWith(...Array.from(el.childNodes));
  });
  return true;
}

/** Text boxes that can be moved up and down. */
export function movableBoxes(body: HTMLElement): HTMLElement[] {
  return Array.from(body.querySelectorAll<HTMLElement>('.sv-textbox'));
}

/** Move a box so its top lands as close as possible to `top` (viewport px) without covering text. */
export function moveBox(box: HTMLElement, top: number) {
  const parent = box.parentElement;
  if (!parent) return;
  box.removeAttribute('data-sv-pb');
  const sibs = Array.from(parent.children).filter(c => c !== box);
  box.remove();
  const cs = parent.ownerDocument.defaultView!.getComputedStyle(parent);
  let prevBottom = rectOf(parent).top + (parseFloat(cs.paddingTop) || 0);
  let after: Element | null = null;
  for (const s of sibs) {
    const r = rectOf(s);
    if (r.height === 0 && !r.width) continue;
    if (r.bottom <= top + 1) { after = s; prevBottom = r.bottom; } else break;
  }
  if (after) after.after(box); else parent.prepend(box);
  box.style.marginTop = Math.max(0, Math.round((top - prevBottom) * 0.75 * 10) / 10) + 'pt';
}

/** The blocks that move to a new sheet as a whole (like the printer does). */
function units(container: Element, out: Element[] = []): Element[] {
  for (const child of Array.from(container.children)) {
    const tag = child.tagName;
    if (tag === 'UL' || tag === 'OL') { out.push(...Array.from(child.children)); continue; }
    if (tag === 'DIV' && !child.classList.contains('sv-textbox')) {
      const st = (child as HTMLElement).getAttribute('style') || '';
      if (!/background|border|padding/.test(st) && child.children.length) { units(child, out); continue; }
    }
    out.push(child);
  }
  return out;
}

/**
 * Lay the body out as A4 sheets: any block that would cross the bottom margin of a
 * sheet starts at the top margin of the next one. Uses a generated stylesheet and
 * data-sv-pb markers, which are never saved. Returns the number of sheets.
 */
export function paginate(d: Document, margins: PageMargins): number {
  const body = d.body;
  let style = d.getElementById('sv-pages') as HTMLStyleElement | null;
  if (!style) { style = d.createElement('style'); style.id = 'sv-pages'; d.head.appendChild(style); }
  body.querySelectorAll('[data-sv-pb]').forEach(e => e.removeAttribute('data-sv-pb'));
  style.textContent = '';
  const stride = PAGE_H_PX + SHEET_GAP;
  const top = margins.top * PX_PER_IN, bottom = margins.bottom * PX_PER_IN;
  const contentTop = (k: number) => k * stride + top;
  const contentBottom = (k: number) => k * stride + PAGE_H_PX - bottom;
  const room = PAGE_H_PX - top - bottom;
  const origin = () => rectOf(body).top;
  const rules: string[] = [];
  let page = 0, n = 0, forceNext = false, last = 0;
  for (const u of units(body)) {
    if (u.tagName === 'HR' && u.classList.contains('sv-page-break')) { forceNext = true; continue; }
    const measure = () => { const r = rectOf(u); const o = origin(); return { t: r.top - o, b: r.bottom - o, h: r.height }; };
    let r = measure();
    if (!r.h) continue;
    while (r.t >= (page + 1) * stride) page++;
    let target: number | null = null;
    if (forceNext) { target = contentTop(page + 1); forceNext = false; }
    else if (r.t < contentTop(page) - 0.5 && page > 0) target = contentTop(page);
    else if (r.t >= contentBottom(page) - 0.5) target = contentTop(page + 1);
    else if (r.b > contentBottom(page) + 0.5 && r.t > contentTop(page) + 0.5 && r.h <= room) target = contentTop(page + 1);
    if (target !== null) {
      const id = String(++n);
      u.setAttribute('data-sv-pb', id);
      let mt = (parseFloat(d.defaultView!.getComputedStyle(u).marginTop) || 0) + (target - r.t);
      for (let i = 0; i < 3; i++) {
        rules[n - 1] = `[data-sv-pb="${id}"]{margin-top:${mt.toFixed(2)}px!important}`;
        style.textContent = rules.join('\n');
        r = measure();
        if (Math.abs(r.t - target) < 0.5) break;
        mt += target - r.t;
      }
      page = Math.round((target - top) / stride);
    }
    last = Math.max(last, r.b);
  }
  // Floating elements that are still absolute (e.g. images) count too.
  for (const f of floating(body)) { const r = rectOf(f); last = Math.max(last, r.bottom - origin()); }
  const pages = Math.max(1, Math.floor(Math.max(0, last - 1) / stride) + 1);
  rules.push(`body.sv-doc{min-height:${(pages * stride - SHEET_GAP).toFixed(2)}px!important}`);
  style.textContent = rules.join('\n');
  return pages;
}

/** Remove screen-only markers from saved HTML. */
export const stripPagination = (html: string) => html.replace(/\sdata-sv-pb="\d+"/g, '');
