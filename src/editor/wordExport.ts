// Build a Word document from the laid-out A4 sheets. Every paragraph gets its
// real font, size, colour, alignment, line height and spacing (measured from the
// page), boxes become shaded table cells, and pages break where the studio breaks
// them — so the Word file looks like the print preview.

import {
  AlignmentType, BorderStyle, Document as DocxDocument, ImageRun, LineRuleType, Paragraph, ShadingType,
  Table, TableCell, TableLayoutType, TableRow, TextRun, UnderlineType, VerticalAlign, WidthType,
} from 'docx';
import type { DocModel } from './doc';
import { PAGE_H_PX, PX_PER_IN } from './paginate';

type Block = Paragraph | Table;
const TW = 15; // twips per CSS pixel (1440 / 96)
const tw = (px: number) => Math.max(0, Math.round(px * TW));

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE']);

function hex(color: string): string | undefined {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m) return undefined;
  if (m[4] !== undefined && parseFloat(m[4]) < 0.05) return undefined;
  return [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const firstFont = (family: string) => family.split(',')[0].replace(/["']/g, '').trim();

// Bangla is drawn with the "complex script" font in Word. Web fonts (Hind Siliguri, Noto…) aren't
// installed with Word, so Bangla falls back to Nirmala UI, which every Windows PC has.
// Unicode Bangla fonts only (Bijoy fonts like SutonnyMJ would turn Unicode text into garbage).
const BN_FONT = /nirmala|vrinda|kalpurush|siyam|solaiman|shonar|bangla|bengali|siliguri|tiro|lohit|mukti|akaash/i;
const WEB_ONLY = /hind siliguri|noto|tiro/i;
function runFonts(family: string) {
  const list = family.split(',').map(f => f.replace(/["']/g, '').trim()).filter(Boolean);
  const latin = list.find(f => !WEB_ONLY.test(f) && !/MJ$|sutonny/i.test(f) && !/^(serif|sans-serif|monospace|system-ui)$/i.test(f)) || 'Times New Roman';
  const bn = list.find(f => BN_FONT.test(f) && !WEB_ONLY.test(f) && !/MJ$|sutonny/i.test(f)) || 'Nirmala UI';
  return { ascii: latin, hAnsi: latin, eastAsia: latin, cs: bn };
}

function hasBlockChild(el: Element) {
  return Array.from(el.children).some(c => BLOCK_TAGS.has(c.tagName));
}

function isBox(el: HTMLElement, cs: CSSStyleDeclaration) {
  return el.classList.contains('sv-textbox') || !!hex(cs.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat((cs as any)[`border${s}Width`]) > 0 && (cs as any)[`border${s}Style`] !== 'none');
}

function alignment(a: string) {
  if (a === 'center') return AlignmentType.CENTER;
  if (a === 'right' || a === 'end') return AlignmentType.RIGHT;
  if (a === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

interface Ctx { win: Window; pageTop: (y: number) => number; contentTop: number }

/** Text runs for an inline subtree. */
function runs(node: Node, ctx: Ctx, out: (TextRun | ImageRun)[], under: { u: boolean; s: boolean }, lead: { start: boolean }) {
  if (node.nodeType === 3) {
    let text = (node.textContent || '').replace(/[\t\n\r ]+/g, ' ');
    if (lead.start) text = text.replace(/^ +/, '');
    if (!text) return;
    lead.start = text.endsWith(' ');
    const el = node.parentElement!;
    const cs = ctx.win.getComputedStyle(el);
    const bg = hex(cs.backgroundColor);
    out.push(new TextRun({
      text,
      font: runFonts(cs.fontFamily),
      size: Math.max(2, Math.round(parseFloat(cs.fontSize) * 0.75 * 2)),
      bold: (parseInt(cs.fontWeight, 10) || 400) >= 600,
      italics: cs.fontStyle === 'italic',
      underline: under.u ? { type: UnderlineType.SINGLE } : undefined,
      strike: under.s,
      color: hex(cs.color),
      shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
      superScript: cs.verticalAlign === 'super' || undefined,
      subScript: cs.verticalAlign === 'sub' || undefined,
    }));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  if (el.tagName === 'BR') { out.push(new TextRun({ break: 1 })); lead.start = true; return; }
  if (el.tagName === 'IMG') {
    const img = el as HTMLImageElement;
    const m = img.src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i);
    if (m) {
      const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      const type = (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) as 'png' | 'jpg' | 'gif' | 'bmp';
      out.push(new ImageRun({ type, data: bytes, transformation: { width: Math.round(img.width), height: Math.round(img.height) } }));
    }
    return;
  }
  const cs = ctx.win.getComputedStyle(el);
  if (cs.display === 'none') return;
  const line = cs.textDecorationLine || '';
  const next = { u: under.u || line.includes('underline'), s: under.s || line.includes('line-through') };
  el.childNodes.forEach(c => runs(c, ctx, out, next, lead));
}

/** A paragraph for a block element, placed `gap` px below what came before it. */
function paragraph(el: HTMLElement, ctx: Ctx, gap: number, pageBreak: boolean, prefix?: string, indentPx = 0): Paragraph {
  const cs = ctx.win.getComputedStyle(el);
  const children: (TextRun | ImageRun)[] = [];
  if (prefix) children.push(new TextRun({ text: prefix, font: runFonts(cs.fontFamily), size: Math.round(parseFloat(cs.fontSize) * 1.5) }));
  runs(el, ctx, children, { u: false, s: false }, { start: true });
  const fontPx = parseFloat(cs.fontSize) || 16;
  const lineHeight = cs.lineHeight === 'normal' ? fontPx * 1.2 : parseFloat(cs.lineHeight);
  const bg = hex(cs.backgroundColor);
  const left = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.paddingLeft) || 0) + indentPx;
  const right = (parseFloat(cs.marginRight) || 0) + (parseFloat(cs.paddingRight) || 0);
  return new Paragraph({
    children: children.length ? children : [new TextRun({ text: '', size: Math.round(fontPx * 1.5) })],
    alignment: alignment(cs.textAlign),
    spacing: { before: pageBreak ? 0 : tw(gap), after: 0, line: Math.max(20, tw(lineHeight)), lineRule: LineRuleType.EXACT },
    indent: { left: tw(left), right: tw(right), firstLine: tw(parseFloat(cs.textIndent) || 0) },
    shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
    pageBreakBefore: pageBreak || undefined,
    widowControl: false,
  });
}

const NONE = { style: BorderStyle.NONE, size: 0, color: 'auto' };

function border(cs: CSSStyleDeclaration, side: 'Top' | 'Right' | 'Bottom' | 'Left') {
  const w = parseFloat((cs as any)[`border${side}Width`]) || 0;
  const style = (cs as any)[`border${side}Style`];
  if (!w || style === 'none' || style === 'hidden') return NONE;
  return { style: style === 'dashed' ? BorderStyle.DASHED : style === 'dotted' ? BorderStyle.DOTTED : BorderStyle.SINGLE, size: Math.max(2, Math.round(w * 6)), color: hex((cs as any)[`border${side}Color`]) || '000000' };
}

/** A spacer paragraph exactly `px` tall (tables can't carry space before them). */
const spacer = (px: number) => new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: Math.max(20, tw(px)), lineRule: LineRuleType.EXACT } });

function cellBlocks(el: HTMLElement, ctx: Ctx): Block[] {
  const inner: Block[] = [];
  blocks(el, ctx, inner, el.getBoundingClientRect().top + (parseFloat(ctx.win.getComputedStyle(el).paddingTop) || 0));
  if (!inner.length || inner[inner.length - 1] instanceof Table) inner.push(new Paragraph({ children: [] }));
  return inner;
}

function boxTable(el: HTMLElement, ctx: Ctx): Table {
  const cs = ctx.win.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const bg = hex(cs.backgroundColor);
  const width = tw(r.width);
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    indent: { size: tw(parseFloat(cs.marginLeft) || 0), type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
        margins: { top: tw(parseFloat(cs.paddingTop) || 0), bottom: tw(parseFloat(cs.paddingBottom) || 0), left: tw(parseFloat(cs.paddingLeft) || 0), right: tw(parseFloat(cs.paddingRight) || 0), marginUnitType: WidthType.DXA },
        borders: { top: border(cs, 'Top'), right: border(cs, 'Right'), bottom: border(cs, 'Bottom'), left: border(cs, 'Left') },
        children: cellBlocks(el, ctx),
      })],
    })],
  });
}

function dataTable(el: HTMLTableElement, ctx: Ctx): Table {
  const cs = ctx.win.getComputedStyle(el);
  const total = el.getBoundingClientRect().width;
  const firstRow = el.rows[0];
  const cols = firstRow ? Array.from(firstRow.cells).map(c => tw(c.getBoundingClientRect().width)) : [tw(total)];
  return new Table({
    width: { size: tw(total), type: WidthType.DXA },
    columnWidths: cols,
    layout: TableLayoutType.FIXED,
    indent: { size: tw(parseFloat(cs.marginLeft) || 0), type: WidthType.DXA },
    rows: Array.from(el.rows).map(row => new TableRow({
      children: Array.from(row.cells).map(cell => {
        const c = ctx.win.getComputedStyle(cell);
        const bg = hex(c.backgroundColor);
        return new TableCell({
          width: { size: tw(cell.getBoundingClientRect().width), type: WidthType.DXA },
          columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          verticalAlign: c.verticalAlign === 'middle' ? VerticalAlign.CENTER : c.verticalAlign === 'bottom' ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
          shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: 'auto' } : undefined,
          margins: { top: tw(parseFloat(c.paddingTop) || 0), bottom: tw(parseFloat(c.paddingBottom) || 0), left: tw(parseFloat(c.paddingLeft) || 0), right: tw(parseFloat(c.paddingRight) || 0), marginUnitType: WidthType.DXA },
          borders: { top: border(c, 'Top'), right: border(c, 'Right'), bottom: border(c, 'Bottom'), left: border(c, 'Left') },
          children: cellBlocks(cell, ctx),
        });
      }),
    })),
  });
}

/**
 * Convert the block children of `container` in order. `prevBottom` is where the
 * previous block ended (px, viewport), so each block keeps its exact distance.
 */
function blocks(container: Element, ctx: Ctx, out: Block[], prevBottom: number): number {
  const push = (el: HTMLElement, make: (gap: number, pageBreak: boolean) => Block | Block[]) => {
    const r = el.getBoundingClientRect();
    if (!r.height && !r.width) return;
    const pageBreak = el.hasAttribute('data-sv-pb') && ctx.pageTop(r.top) > ctx.pageTop(prevBottom);
    const gap = pageBreak ? 0 : r.top - prevBottom;
    const made = make(gap, pageBreak);
    (Array.isArray(made) ? made : [made]).forEach(b => out.push(b));
    prevBottom = r.bottom;
  };
  let inlineRun: Node[] = [];
  const flushInline = () => {
    const nodes = inlineRun; inlineRun = [];
    if (!nodes.some(n => (n.textContent || '').trim() || (n.nodeType === 1 && (n as Element).tagName === 'IMG'))) return;
    // Wrap loose inline content in a temporary paragraph so it can be measured.
    const p = container.ownerDocument!.createElement('p');
    p.style.margin = '0';
    container.insertBefore(p, nodes[0]);
    nodes.forEach(n => p.appendChild(n));
    push(p, (gap, pb) => paragraph(p, ctx, gap, pb));
    nodes.forEach(n => container.insertBefore(n, p));
    p.remove();
  };
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType !== 1) { if (node.nodeType === 3) inlineRun.push(node); continue; }
    const el = node as HTMLElement;
    if (!BLOCK_TAGS.has(el.tagName)) { inlineRun.push(el); continue; }
    flushInline();
    const cs = ctx.win.getComputedStyle(el);
    if (cs.display === 'none') continue;
    const tag = el.tagName;
    if (tag === 'HR') {
      if (el.classList.contains('sv-page-break')) continue; // the next block carries the break
      push(el, gap => new Paragraph({ children: [], spacing: { before: tw(gap), after: 0, line: 20, lineRule: LineRuleType.EXACT }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(cs.borderTopColor) || 'A1A1AA' } } }));
    } else if (tag === 'UL' || tag === 'OL') {
      const pad = parseFloat(cs.paddingLeft) || 0;
      Array.from(el.children).forEach((li, i) => {
        if (li.tagName !== 'LI') return;
        push(li as HTMLElement, (gap, pb) => paragraph(li as HTMLElement, ctx, gap, pb, tag === 'OL' ? `${i + 1}. ` : '• ', pad));
      });
    } else if (tag === 'TABLE') {
      push(el, (gap, pb) => {
        const t = dataTable(el as HTMLTableElement, ctx);
        return gap > 1 || pb ? [pb ? new Paragraph({ children: [], pageBreakBefore: true, spacing: { line: 20, lineRule: LineRuleType.EXACT } }) : spacer(gap), t] : t;
      });
    } else if (tag === 'DIV' && isBox(el, cs) && hasBlockChild(el)) {
      push(el, (gap, pb) => {
        const t = boxTable(el, ctx);
        return gap > 1 || pb ? [pb ? new Paragraph({ children: [], pageBreakBefore: true, spacing: { line: 20, lineRule: LineRuleType.EXACT } }) : spacer(gap), t] : t;
      });
    } else if (hasBlockChild(el)) {
      prevBottom = blocks(el, ctx, out, prevBottom);
    } else {
      push(el, (gap, pb) => paragraph(el, ctx, gap, pb));
    }
  }
  flushInline();
  return prevBottom;
}

/** Build the Word document from a laid-out sheet frame (see renderSheets). */
export async function buildDocx(model: DocModel, doc: Document): Promise<DocxDocument> {
  const win = doc.defaultView!;
  const m = model.margins;
  const bodyTop = doc.body.getBoundingClientRect().top;
  const ctx: Ctx = {
    win,
    pageTop: y => Math.floor((y - bodyTop + 0.5) / PAGE_H_PX),
    contentTop: bodyTop + m.top * PX_PER_IN,
  };
  const out: Block[] = [];
  blocks(doc.body, ctx, out, ctx.contentTop);
  if (!out.length || out[out.length - 1] instanceof Table) out.push(new Paragraph({ children: [] }));
  const cs = win.getComputedStyle(doc.body);
  return new DocxDocument({
    creator: 'SAVOR Media Studio',
    title: model.title,
    styles: { default: { document: { run: { font: runFonts(cs.fontFamily), size: Math.round(model.fontSize * 2) }, paragraph: { spacing: { before: 0, after: 0 } } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: Math.round(m.top * 1440), right: Math.round(m.right * 1440), bottom: Math.round(m.bottom * 1440), left: Math.round(m.left * 1440), header: 0, footer: 0 },
        },
      },
      children: out,
    }],
  });
}
