// Word (.docx) → HTML converter that keeps the layout: paragraph alignment,
// spacing and indents, fonts, sizes, colours, highlights, bold/italic/underline,
// lists, tables (merged cells, borders, shading, widths), images, links,
// page breaks and page margins. Runs in the browser.

import JSZip from 'jszip';
import { PageMargins } from '../utils/pageMargins';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface DocxResult { html: string; margins: PageMargins | null; font: string | null; fontSize: number | null; title: string | null }

type Props = Record<string, string>;
interface StyleDef { type: string; name: string; basedOn?: string; p: Props; r: Props; tblBorders?: boolean }

const kids = (el: Element | null | undefined, name?: string): Element[] =>
  el ? Array.from(el.children).filter(c => !name || c.localName === name) : [];
const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] || null;
const attr = (el: Element | null | undefined, name: string): string | null =>
  el ? (el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name) ?? el.getAttribute(name)) : null;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const twipsToPt = (v: string | null) => (v && !isNaN(+v) ? +(+v / 20).toFixed(2) : null);
const isOn = (el: Element | null) => !!el && !['0', 'false', 'off', 'none'].includes((attr(el, 'val') || 'true').toLowerCase());

const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

/** Read run properties (w:rPr) into CSS-ish props. */
function readRunProps(rPr: Element | null): Props {
  const p: Props = {};
  if (!rPr) return p;
  const fonts = kid(rPr, 'rFonts');
  if (fonts) {
    const f = attr(fonts, 'ascii') || attr(fonts, 'hAnsi') || attr(fonts, 'cs') || attr(fonts, 'eastAsia');
    const cs = attr(fonts, 'cs');
    if (f) p.font = cs && cs !== f ? `'${f}', '${cs}'` : `'${f}'`;
  }
  const sz = kid(rPr, 'sz') || kid(rPr, 'szCs');
  if (sz && attr(sz, 'val')) p.size = String(+attr(sz, 'val')! / 2);
  for (const [tag, key] of [['b', 'bold'], ['bCs', 'bold'], ['i', 'italic'], ['iCs', 'italic'], ['strike', 'strike'], ['dstrike', 'strike'], ['caps', 'caps'], ['smallCaps', 'smallcaps']] as const) {
    const el = kid(rPr, tag);
    if (el) p[key] = isOn(el) ? '1' : '0';
  }
  const u = kid(rPr, 'u');
  if (u) p.underline = (attr(u, 'val') || 'single') === 'none' ? '0' : '1';
  const color = kid(rPr, 'color');
  const cv = attr(color, 'val');
  if (cv && /^[0-9a-f]{6}$/i.test(cv)) p.color = '#' + cv;
  const hl = attr(kid(rPr, 'highlight'), 'val');
  if (hl && HIGHLIGHT[hl]) p.bg = HIGHLIGHT[hl];
  const shd = attr(kid(rPr, 'shd'), 'fill');
  if (!p.bg && shd && /^[0-9a-f]{6}$/i.test(shd) && shd.toLowerCase() !== 'ffffff') p.bg = '#' + shd;
  const va = attr(kid(rPr, 'vertAlign'), 'val');
  if (va === 'superscript' || va === 'subscript') p.vert = va;
  const vanish = kid(rPr, 'vanish');
  if (vanish && isOn(vanish)) p.hidden = '1';
  const spacing = attr(kid(rPr, 'spacing'), 'val');
  if (spacing && +spacing) p.letter = String(+spacing / 20);
  return p;
}

/** Read paragraph properties (w:pPr). */
function readParaProps(pPr: Element | null): Props {
  const p: Props = {};
  if (!pPr) return p;
  const jc = attr(kid(pPr, 'jc'), 'val');
  if (jc) p.align = ({ both: 'justify', distribute: 'justify', start: 'left', end: 'right', left: 'left', right: 'right', center: 'center' } as Record<string, string>)[jc] || '';
  const sp = kid(pPr, 'spacing');
  if (sp) {
    const before = twipsToPt(attr(sp, 'before')); if (before !== null && attr(sp, 'beforeAutospacing') !== '1') p.before = String(before);
    const after = twipsToPt(attr(sp, 'after')); if (after !== null && attr(sp, 'afterAutospacing') !== '1') p.after = String(after);
    const line = attr(sp, 'line'); const rule = attr(sp, 'lineRule') || 'auto';
    if (line && +line) p.line = rule === 'auto' ? String(+(+line / 240).toFixed(2)) : `${+line / 20}pt`;
  }
  const ind = kid(pPr, 'ind');
  if (ind) {
    const left = twipsToPt(attr(ind, 'left') ?? attr(ind, 'start')); if (left) p.indLeft = String(left);
    const right = twipsToPt(attr(ind, 'right') ?? attr(ind, 'end')); if (right) p.indRight = String(right);
    const first = twipsToPt(attr(ind, 'firstLine')); if (first) p.first = String(first);
    const hanging = twipsToPt(attr(ind, 'hanging')); if (hanging) p.first = String(-hanging);
  }
  const shd = attr(kid(pPr, 'shd'), 'fill');
  if (shd && /^[0-9a-f]{6}$/i.test(shd) && shd.toLowerCase() !== 'ffffff') p.shade = '#' + shd;
  if (kid(pPr, 'pageBreakBefore') && isOn(kid(pPr, 'pageBreakBefore'))) p.pageBefore = '1';
  const bdr = kid(pPr, 'pBdr');
  if (bdr) for (const side of ['top', 'bottom', 'left', 'right']) {
    const b = kid(bdr, side);
    if (b && attr(b, 'val') && attr(b, 'val') !== 'none' && attr(b, 'val') !== 'nil') {
      const width = Math.max(0.5, (+(attr(b, 'sz') || 4)) / 8);
      const col = attr(b, 'color'); p['border-' + side] = `${width}pt solid ${col && /^[0-9a-f]{6}$/i.test(col) ? '#' + col : '#000'}`;
    }
  }
  return p;
}

function runCss(p: Props): string {
  const css: string[] = [];
  if (p.font) css.push(`font-family:${p.font}`);
  if (p.size) css.push(`font-size:${p.size}pt`);
  if (p.bold === '1') css.push('font-weight:bold');
  if (p.italic === '1') css.push('font-style:italic');
  const deco = [p.underline === '1' ? 'underline' : '', p.strike === '1' ? 'line-through' : ''].filter(Boolean).join(' ');
  if (deco) css.push(`text-decoration:${deco}`);
  if (p.color) css.push(`color:${p.color}`);
  if (p.bg) css.push(`background-color:${p.bg}`);
  if (p.caps === '1') css.push('text-transform:uppercase');
  if (p.smallcaps === '1') css.push('font-variant:small-caps');
  if (p.letter) css.push(`letter-spacing:${p.letter}pt`);
  return css.join(';');
}

function paraCss(p: Props): string {
  const css: string[] = [];
  if (p.align) css.push(`text-align:${p.align}`);
  if (p.before) css.push(`margin-top:${p.before}pt`);
  css.push(`margin-bottom:${p.after ?? '0'}pt`);
  if (p.line) css.push(`line-height:${p.line}`);
  if (p.indLeft) css.push(`margin-left:${p.indLeft}pt`);
  if (p.indRight) css.push(`margin-right:${p.indRight}pt`);
  if (p.first) css.push(`text-indent:${p.first}pt`);
  if (p.shade) css.push(`background-color:${p.shade}`);
  for (const side of ['top', 'bottom', 'left', 'right']) if (p['border-' + side]) css.push(`border-${side}:${p['border-' + side]}`);
  if (p.pageBefore) css.push('break-before:page');
  return css.join(';');
}

export async function docxToHtml(buffer: ArrayBuffer): Promise<DocxResult> {
  const zip = await JSZip.loadAsync(buffer);
  const readXml = async (path: string): Promise<Document | null> => {
    const file = zip.file(path);
    return file ? new DOMParser().parseFromString(await file.async('string'), 'application/xml') : null;
  };
  const docXml = await readXml('word/document.xml');
  if (!docXml) throw new Error('This file is not a valid Word document.');
  const stylesXml = await readXml('word/styles.xml');
  const numberingXml = await readXml('word/numbering.xml');
  const relsXml = await readXml('word/_rels/document.xml.rels');
  const coreXml = await readXml('docProps/core.xml');

  // Relationships (images, links)
  const rels = new Map<string, { target: string; external: boolean }>();
  relsXml?.querySelectorAll('Relationship').forEach(r => rels.set(r.getAttribute('Id') || '', { target: r.getAttribute('Target') || '', external: r.getAttribute('TargetMode') === 'External' }));

  // Styles and defaults
  const styles = new Map<string, StyleDef>();
  let defaultRun: Props = {}, defaultPara: Props = {};
  let defaultParaStyle = '';
  if (stylesXml) {
    const root = stylesXml.documentElement;
    const dd = kid(root, 'docDefaults');
    defaultRun = readRunProps(kid(kid(dd, 'rPrDefault'), 'rPr'));
    defaultPara = readParaProps(kid(kid(dd, 'pPrDefault'), 'pPr'));
    for (const s of kids(root, 'style')) {
      const id = attr(s, 'styleId') || '';
      const type = attr(s, 'type') || '';
      const def: StyleDef = {
        type, name: (attr(kid(s, 'name'), 'val') || id).toLowerCase(), basedOn: attr(kid(s, 'basedOn'), 'val') || undefined,
        p: readParaProps(kid(s, 'pPr')), r: readRunProps(kid(s, 'rPr')),
      };
      const tblBorders = kid(kid(s, 'tblPr'), 'tblBorders');
      if (tblBorders) def.tblBorders = kids(tblBorders).some(b => !['none', 'nil'].includes(attr(b, 'val') || 'none'));
      styles.set(id, def);
      if (type === 'paragraph' && attr(s, 'default') === '1') defaultParaStyle = id;
    }
  }
  const resolve = (id: string | null | undefined, seen = new Set<string>()): { p: Props; r: Props; name: string; tblBorders?: boolean } => {
    const s = id ? styles.get(id) : undefined;
    if (!s || seen.has(id!)) return { p: {}, r: {}, name: '' };
    seen.add(id!);
    const base = resolve(s.basedOn, seen);
    return { p: { ...base.p, ...s.p }, r: { ...base.r, ...s.r }, name: s.name, tblBorders: s.tblBorders ?? base.tblBorders };
  };

  // Numbering: numId -> abstract levels -> format
  const numFormats = new Map<string, Map<string, string>>();
  if (numberingXml) {
    const root = numberingXml.documentElement;
    const abstract = new Map<string, Map<string, string>>();
    for (const a of kids(root, 'abstractNum')) {
      const levels = new Map<string, string>();
      for (const lvl of kids(a, 'lvl')) levels.set(attr(lvl, 'ilvl') || '0', attr(kid(lvl, 'numFmt'), 'val') || 'bullet');
      abstract.set(attr(a, 'abstractNumId') || '', levels);
    }
    for (const n of kids(root, 'num')) numFormats.set(attr(n, 'numId') || '', abstract.get(attr(kid(n, 'abstractNumId'), 'val') || '') || new Map());
  }

  const images = new Map<string, string>();
  const imageData = async (rid: string): Promise<string | null> => {
    if (images.has(rid)) return images.get(rid)!;
    const rel = rels.get(rid);
    if (!rel || rel.external) return null;
    const path = rel.target.startsWith('/') ? rel.target.slice(1) : 'word/' + rel.target.replace(/^\.\//, '');
    const file = zip.file(path);
    if (!file) return null;
    const ext = (path.split('.').pop() || '').toLowerCase();
    const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' } as Record<string, string>)[ext];
    if (!mime) return null; // EMF/WMF cannot be shown in browsers.
    const url = `data:${mime};base64,${await file.async('base64')}`;
    images.set(rid, url);
    return url;
  };

  const body = kid(docXml.documentElement, 'body');

  const renderRuns = async (parent: Element, paraRun: Props): Promise<string> => {
    let html = '';
    for (const node of kids(parent)) {
      const name = node.localName;
      if (name === 'r') html += await renderRun(node, paraRun);
      else if (name === 'hyperlink') {
        const rid = node.getAttributeNS(R, 'id') || node.getAttribute('r:id');
        const anchor = attr(node, 'anchor');
        const target = rid ? rels.get(rid)?.target : anchor ? '#' + anchor : null;
        const inner = await renderRuns(node, paraRun);
        html += target && /^(https?:|mailto:|#)/i.test(target) ? `<a href="${esc(target)}">${inner}</a>` : inner;
      } else if (['ins', 'smartTag', 'customXml', 'fldSimple', 'sdtContent', 'bdo', 'dir'].includes(name)) html += await renderRuns(node, paraRun);
      else if (name === 'sdt') html += await renderRuns(kid(node, 'sdtContent') || node, paraRun);
    }
    return html;
  };

  let pendingBoxes: string[] = [];
  const pt = (v: string | null | undefined) => { const m = (v || '').match(/^(-?[\d.]+)(pt|in|px|cm|mm)?$/); if (!m) return null; const n = +m[1]; return m[2] === 'in' ? n * 72 : m[2] === 'px' ? n * 0.75 : m[2] === 'cm' ? n * 28.35 : m[2] === 'mm' ? n * 2.835 : n; };
  /** Images inline; text boxes become positioned boxes next to their paragraph. */
  const renderGraphic = async (c: Element): Promise<string> => {
    let html = '';
    const boxes = Array.from(c.getElementsByTagNameNS(W, 'txbxContent'));
    if (boxes.length) {
      for (const box of boxes) {
        const outer = pendingBoxes; pendingBoxes = [];
        const inner = await renderBlocks(kids(box).filter(k => k.localName === 'p' || k.localName === 'tbl'));
        pendingBoxes = outer;
        const css: string[] = ['box-sizing:border-box', 'padding:4pt 7pt'];
        const shape = (box.closest('shape') || c.getElementsByTagName('v:shape')[0]) as Element | null;
        const vstyle = shape?.getAttribute('style') || '';
        const prop = (name: string) => vstyle.match(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)'))?.[1];
        let left = pt(prop('margin-left')), top = pt(prop('margin-top')), width = pt(prop('width')), height = pt(prop('height'));
        const anchor = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'anchor')[0];
        if (anchor) {
          const off = (tag: string) => { const el = anchor.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', tag)[0]; const o = el?.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'posOffset')[0]; return o ? +(o.textContent || 0) / 12700 : null; };
          left = off('positionH') ?? left; top = off('positionV') ?? top;
          const ext = anchor.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
          if (ext) { width = +(ext.getAttribute('cx') || 0) / 12700 || width; height = +(ext.getAttribute('cy') || 0) / 12700 || height; }
        }
        const fill = shape?.getAttribute('fillcolor');
        if (fill && /^#[0-9a-f]{3,6}$/i.test(fill)) css.push(`background-color:${fill}`);
        if (shape && shape.getAttribute('stroked') !== 'f') css.push('border:0.75pt solid #000');
        const positioned = vstyle.includes('position:absolute') || !!anchor;
        if (positioned && top !== null) { css.push('position:absolute', `left:${(left || 0).toFixed(1)}pt`, `top:${top.toFixed(1)}pt`); }
        else css.push('margin:6pt 0');
        if (width) css.push(`width:${width.toFixed(1)}pt`);
        if (height) css.push(`min-height:${height.toFixed(1)}pt`);
        pendingBoxes.push(`<div class="sv-textbox" style="${css.join(';')}">${inner}</div>`);
      }
      return html;
    }
    const blip = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')[0];
    const rid = blip?.getAttributeNS(R, 'embed') || (c.getElementsByTagName('v:imagedata')[0]?.getAttributeNS(R, 'id')) || null;
    if (rid) {
      const src = await imageData(rid);
      if (src) {
        const extent = c.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')[0];
        const cx = Number(extent?.getAttribute('cx')), cy = Number(extent?.getAttribute('cy'));
        const size = cx && cy ? ` width="${Math.round(cx / 9525)}" height="${Math.round(cy / 9525)}"` : '';
        html += `<img src="${src}"${size} alt="">`;
      }
    }
    return html;
  };

  let pendingPageBreak = false;
  const fieldState = { inInstr: false };
  const renderRun = async (run: Element, paraRun: Props): Promise<string> => {
    const rStyle = attr(kid(kid(run, 'rPr'), 'rStyle'), 'val');
    const props = { ...paraRun, ...resolve(rStyle).r, ...readRunProps(kid(run, 'rPr')) };
    if (props.hidden === '1') return '';
    let text = '';
    for (const c of kids(run)) {
      switch (c.localName) {
        case 't': if (!fieldState.inInstr) text += esc(c.textContent || '').replace(/ {2,}/g, m => ' ' + '&nbsp;'.repeat(m.length - 1)); break;
        case 'tab': text += '<span style="display:inline-block;width:0.5in"></span>'; break;
        case 'br': if (attr(c, 'type') === 'page') pendingPageBreak = true; else text += '<br>'; break;
        case 'cr': text += '<br>'; break;
        case 'noBreakHyphen': text += '&#8209;'; break;
        case 'softHyphen': text += '&shy;'; break;
        case 'sym': { const ch = attr(c, 'char'); if (ch && /^[0-9a-f]{4}$/i.test(ch)) { const code = parseInt(ch, 16); text += code >= 0xf000 ? '•' : String.fromCharCode(code); } break; }
        case 'fldChar': { const t = attr(c, 'fldCharType'); if (t === 'begin') fieldState.inInstr = true; if (t === 'separate' || t === 'end') fieldState.inInstr = false; break; }
        case 'AlternateContent': {
          const choice = kids(c).find(k => k.localName === 'Choice') || kids(c).find(k => k.localName === 'Fallback');
          if (choice) for (const inner of kids(choice)) text += await renderGraphic(inner);
          break;
        }
        case 'drawing': case 'pict': case 'object':
          text += await renderGraphic(c);
          break;
      }
    }
    if (!text) return '';
    const css = runCss(props);
    let html = css ? `<span style="${css}">${text}</span>` : text;
    if (props.vert === 'superscript') html = `<sup>${html}</sup>`;
    if (props.vert === 'subscript') html = `<sub>${html}</sub>`;
    return html;
  };

  const renderParagraph = async (p: Element): Promise<{ html: string; numId: string | null; ilvl: number; tag: string }> => {
    const pPr = kid(p, 'pPr');
    const styleId = attr(kid(pPr, 'pStyle'), 'val') || defaultParaStyle;
    const style = resolve(styleId);
    const props = { ...defaultPara, ...style.p, ...readParaProps(pPr) };
    const runBase = { ...style.r };
    // Paragraph mark formatting does not apply to runs, so only style-level run props pass down.
    let inner = await renderRuns(p, runBase);
    const heading = /^heading (\d)$/.exec(style.name) || (style.name === 'title' ? ['', '1'] : null);
    let tag = heading ? 'h' + Math.min(+heading[1], 6) : 'p';
    if (!inner.replace(/<[^>]+>/g, '').trim() && !/<img|<br/.test(inner)) inner = '<br>';
    const numPr = kid(pPr, 'numPr') || null;
    let numId = attr(kid(numPr, 'numId'), 'val');
    if (numId === '0') numId = null;
    const ilvl = +(attr(kid(numPr, 'ilvl'), 'val') || 0);
    let css = paraCss(props);
    if (heading) css += ';font-weight:bold';
    let html = `<${tag} style="${css}">${inner}</${tag}>`;
    if (pendingBoxes.length) {
      const boxes = pendingBoxes; pendingBoxes = [];
      const absolute = boxes.some(b => b.includes('position:absolute'));
      html = absolute ? `<div style="position:relative">${html}${boxes.join('')}</div>` : html + boxes.join('');
      return { html, numId: null, ilvl: 0, tag };
    }
    return { html, numId, ilvl, tag };
  };

  const renderTable = async (tbl: Element): Promise<string> => {
    const tblPr = kid(tbl, 'tblPr');
    const style = resolve(attr(kid(tblPr, 'tblStyle'), 'val'));
    const own = kid(tblPr, 'tblBorders');
    const bordered = own ? kids(own).some(b => !['none', 'nil'].includes(attr(b, 'val') || 'none')) : !!style.tblBorders;
    const jc = attr(kid(tblPr, 'jc'), 'val');
    const tw = kid(tblPr, 'tblW');
    let width = '';
    if (tw && attr(tw, 'type') === 'pct') width = `width:${+(attr(tw, 'w') || 5000) / 50}%;`;
    else if (tw && attr(tw, 'type') === 'dxa' && +(attr(tw, 'w') || 0)) width = `width:${+attr(tw, 'w')! / 20}pt;`;
    const align = jc === 'center' ? 'margin-left:auto;margin-right:auto;' : '';
    const rows = kids(tbl, 'tr');
    // vMerge: compute rowspans by grid column.
    const grid: { el: Element; col: number; span: number; skip: boolean; rowspan: number }[][] = rows.map(tr => {
      let col = 0;
      return kids(tr, 'tc').map(tc => {
        const span = +(attr(kid(kid(tc, 'tcPr'), 'gridSpan'), 'val') || 1);
        const vm = kid(kid(tc, 'tcPr'), 'vMerge');
        const cell = { el: tc, col, span, skip: !!vm && (attr(vm, 'val') || 'continue') === 'continue', rowspan: 1 };
        col += span;
        return cell;
      });
    });
    for (let r = 0; r < grid.length; r++) for (const cell of grid[r]) {
      if (cell.skip) continue;
      for (let below = r + 1; below < grid.length; below++) {
        const next = grid[below].find(c => c.col === cell.col);
        if (next && next.skip) cell.rowspan++; else break;
      }
    }
    let html = `<table class="${bordered ? '' : 'sv-plain'}" style="border-collapse:collapse;${width}${align}">`;
    for (let r = 0; r < rows.length; r++) {
      html += '<tr>';
      for (const cell of grid[r]) {
        if (cell.skip) continue;
        const tcPr = kid(cell.el, 'tcPr');
        const css: string[] = [];
        const w = kid(tcPr, 'tcW');
        if (w && attr(w, 'type') === 'dxa' && +(attr(w, 'w') || 0)) css.push(`width:${+attr(w, 'w')! / 20}pt`);
        const fill = attr(kid(tcPr, 'shd'), 'fill');
        if (fill && /^[0-9a-f]{6}$/i.test(fill) && fill.toLowerCase() !== 'ffffff') css.push(`background-color:#${fill}`);
        const va = attr(kid(tcPr, 'vAlign'), 'val');
        if (va) css.push(`vertical-align:${va === 'center' ? 'middle' : va}`);
        const borders = kid(tcPr, 'tcBorders');
        if (borders) for (const side of ['top', 'bottom', 'left', 'right']) {
          const b = kid(borders, side) || kid(borders, side === 'left' ? 'start' : side === 'right' ? 'end' : side);
          if (!b) continue;
          const val = attr(b, 'val');
          css.push(`border-${side}:${val === 'none' || val === 'nil' ? 'none' : `${Math.max(0.5, +(attr(b, 'sz') || 4) / 8)}pt solid #${/^[0-9a-f]{6}$/i.test(attr(b, 'color') || '') ? attr(b, 'color') : '000000'}`}`);
        }
        const content = await renderBlocks(kids(cell.el).filter(c => c.localName === 'p' || c.localName === 'tbl'));
        html += `<td${cell.span > 1 ? ` colspan="${cell.span}"` : ''}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ''}${css.length ? ` style="${css.join(';')}"` : ''}>${content}</td>`;
      }
      html += '</tr>';
    }
    return html + '</table>';
  };

  const renderBlocks = async (blocks: Element[]): Promise<string> => {
    const parts: string[] = [];
    let localList: { numId: string; tag: string } | null = null;
    for (const b of blocks) {
      if (b.localName === 'p') {
        const p = await renderParagraph(b);
        if (p.numId) {
          const fmt = numFormats.get(p.numId)?.get(String(p.ilvl)) || 'bullet';
          const tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol';
          if (!localList || localList.numId !== p.numId || localList.tag !== tag) {
            if (localList) parts.push(`</${localList.tag}>`);
            const type = ({ lowerLetter: 'a', upperLetter: 'A', lowerRoman: 'i', upperRoman: 'I' } as Record<string, string>)[fmt];
            parts.push(`<${tag}${type ? ` type="${type}"` : ''} style="margin-top:0;margin-bottom:0">`);
            localList = { numId: p.numId, tag };
          }
          const inner = p.html.replace(/^<(p|h\d) style="([^"]*)">/, '').replace(/<\/(p|h\d)>$/, '');
          const styleAttr = p.html.match(/^<(?:p|h\d) style="([^"]*)">/)?.[1] || '';
          parts.push(`<li style="${styleAttr.replace(/margin-left:[^;]*;?|text-indent:[^;]*;?/g, '')}${p.ilvl ? `;margin-left:${p.ilvl * 18}pt` : ''}">${inner}</li>`);
        } else {
          if (localList) { parts.push(`</${localList.tag}>`); localList = null; }
          parts.push(p.html);
        }
        if (pendingPageBreak) { if (localList) { parts.push(`</${localList.tag}>`); localList = null; } parts.push('<hr class="sv-page-break">'); pendingPageBreak = false; }
      } else if (b.localName === 'tbl') {
        if (localList) { parts.push(`</${localList.tag}>`); localList = null; }
        parts.push(await renderTable(b));
      } else if (b.localName === 'sdt') {
        parts.push(await renderBlocks(kids(kid(b, 'sdtContent'))));
      }
    }
    if (localList) parts.push(`</${(localList as { tag: string }).tag}>`);
    return parts.join('');
  };

  const html = await renderBlocks(kids(body));

  // Page setup from the last section
  let margins: PageMargins | null = null;
  const sect = kid(body, 'sectPr');
  const pgMar = kid(sect, 'pgMar');
  if (pgMar) {
    const inch = (v: string | null) => Math.max(0, Math.min(3, +(((+(v || 1440)) / 1440).toFixed(2))));
    margins = { top: inch(attr(pgMar, 'top')), right: inch(attr(pgMar, 'right')), bottom: inch(attr(pgMar, 'bottom')), left: inch(attr(pgMar, 'left')) };
  }
  const normal = resolve(defaultParaStyle);
  const baseRun = { ...defaultRun, ...normal.r };
  const title = coreXml?.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0]?.textContent?.trim() || null;
  return {
    html,
    margins,
    font: baseRun.font ? `${baseRun.font}, 'Hind Siliguri', serif` : null,
    fontSize: baseRun.size ? +baseRun.size : null,
    title,
  };
}
