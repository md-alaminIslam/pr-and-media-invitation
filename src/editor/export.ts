// Export a document. PDF, print and Word are all made from the same A4 sheet
// layout the canvas and the print preview show, so every format matches.

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Packer } from 'docx';
import { DocModel, FONT_LINK, serializeDoc } from './doc';
import { PAGE_H_PX, PAGE_W_PX, flowBoxes, paginate, sheetCss } from './paginate';
import { buildDocx } from './wordExport';

export const safeName = (title: string) => (title.trim() || 'document').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadHtml(model: DocModel) {
  downloadBlob(new Blob([serializeDoc(model)], { type: 'text/html;charset=utf-8' }), safeName(model.title) + '.html');
}

/** Make sure the document fonts are available in the app page. */
export function ensureDocFonts() {
  if (document.querySelector('link[data-sv-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = FONT_LINK; link.setAttribute('data-sv-fonts', '1');
  document.head.appendChild(link);
}

const marginCss = (m: DocModel['margins']) => `${m.top}in ${m.right}in ${m.bottom}in ${m.left}in`;

/** Extra CSS so print uses our sheets: no browser page margin, our padding, backgrounds kept. */
function printCss(model: DocModel): string {
  return `@page{size:A4;margin:0}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{html,body{margin:0!important}body.sv-doc{padding:${marginCss(model.margins)}!important;width:210mm!important;max-width:none!important}}`;
}

export interface Rendered { frame: HTMLIFrameElement; doc: Document; pages: number; remove: () => void }

/**
 * Lay a document out as gap-less A4 sheets in a hidden frame, exactly like the
 * canvas and print preview (same CSS, same text-box handling, same page breaks).
 */
export function renderSheets(model: DocModel): Promise<Rendered> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: PAGE_W_PX + 'px', height: PAGE_H_PX + 'px', border: '0', visibility: 'hidden' });
    frame.srcdoc = serializeDoc(model).replace('</head>', `<style>${sheetCss(0)}\n${printCss(model)}</style></head>`);
    const timer = window.setTimeout(() => reject(new Error('The document took too long to lay out.')), 30000);
    frame.onload = async () => {
      try {
        const d = frame.contentDocument!;
        try { await d.fonts.ready; } catch {}
        await new Promise(r => setTimeout(r, 60));
        flowBoxes(d);
        const pages = paginate(d, model.margins, 0);
        frame.style.height = Math.ceil(pages * PAGE_H_PX) + 'px';
        window.clearTimeout(timer);
        resolve({ frame, doc: d, pages, remove: () => frame.remove() });
      } catch (e) { window.clearTimeout(timer); reject(e); }
    };
    document.body.appendChild(frame);
  });
}

/** PDF: each A4 sheet is drawn as one PDF page, edge to edge — nothing is cut or moved. */
export async function downloadPdf(model: DocModel) {
  const r = await renderSheets(model);
  try {
    r.frame.style.visibility = 'visible';
    const scale = 2;
    const height = Math.ceil(r.pages * PAGE_H_PX);
    const canvas = await html2canvas(r.doc.body, {
      scale, useCORS: true, logging: false, backgroundColor: '#ffffff',
      width: Math.round(PAGE_W_PX), height, windowWidth: Math.round(PAGE_W_PX), windowHeight: height, scrollX: 0, scrollY: 0,
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const slice = document.createElement('canvas');
    const pagePx = PAGE_H_PX * scale;
    slice.width = canvas.width;
    slice.height = Math.round(pagePx);
    const ctx = slice.getContext('2d')!;
    for (let k = 0; k < r.pages; k++) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(k * pagePx), canvas.width, Math.round(pagePx), 0, 0, slice.width, slice.height);
      if (k > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
    }
    pdf.save(safeName(model.title) + '.pdf');
  } finally { r.remove(); }
}

/** Print through the browser from the same sheets ("Save as PDF" gives a text PDF). */
export async function printDoc(model: DocModel): Promise<void> {
  const r = await renderSheets(model);
  r.frame.style.visibility = 'visible';
  const win = r.frame.contentWindow!;
  await new Promise(res => setTimeout(res, 150));
  win.focus();
  win.print();
  setTimeout(() => r.remove(), 1500);
}

/** Word: real paragraphs and tables measured from the sheets, so pages break in the same places. */
export async function downloadDocx(model: DocModel) {
  const r = await renderSheets(model);
  try {
    const doc = await buildDocx(model, r.doc);
    downloadBlob(await Packer.toBlob(doc), safeName(model.title) + '.docx');
  } finally { r.remove(); }
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
