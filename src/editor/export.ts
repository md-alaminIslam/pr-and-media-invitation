import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document as DocxDocument, Packer } from 'docx';
import { DocModel, FONT_LINK, documentCss, serializeDoc } from './doc';
import { A4_WIDTH_IN, docxPageMargins, inchesToMm, inchesToPx } from '../utils/pageMargins';
import { htmlToWordParagraphs } from '../utils/richDocx';

const safeName = (title: string) => (title.trim() || 'document').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadHtml(model: DocModel) {
  downloadBlob(new Blob([serializeDoc(model)], { type: 'text/html;charset=utf-8' }), safeName(model.title) + '.html');
}

export async function downloadDocx(model: DocModel) {
  const doc = new DocxDocument({
    styles: { default: { document: { run: { font: model.font.split(',')[0].replace(/['"]/g, '').trim(), size: Math.round(model.fontSize * 2) } } } },
    sections: [{ properties: { page: { margin: docxPageMargins(model.margins) } }, children: htmlToWordParagraphs(model.body) }],
  });
  downloadBlob(await Packer.toBlob(doc), safeName(model.title) + '.docx');
}

/** Make sure the document fonts are available in the app page (for PDF rendering). */
export function ensureDocFonts() {
  if (document.querySelector('link[data-sv-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = FONT_LINK; link.setAttribute('data-sv-fonts', '1');
  document.head.appendChild(link);
}

export async function downloadPdf(model: DocModel) {
  ensureDocFonts();
  const m = model.margins;
  const widthPx = Math.round(inchesToPx(A4_WIDTH_IN - m.left - m.right));
  const container = document.createElement('div');
  container.className = 'sv-doc';
  Object.assign(container.style, { position: 'fixed', left: '0', top: '0', width: widthPx + 'px', zIndex: '-1', background: '#fff', pointerEvents: 'none' });
  container.innerHTML = `<style data-sv-keep>${documentCss(model)}</style>${model.body}`;
  document.body.appendChild(container);
  try {
    await document.fonts.ready;
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: widthPx,
      onclone: (cloned: Document) => {
        cloned.querySelectorAll('style:not([data-sv-keep]), link[rel="stylesheet"]').forEach(el => {
          if (!(el.getAttribute('href') || '').includes('fonts.googleapis.com')) el.remove();
        });
        const c = cloned.querySelector('.sv-doc') as HTMLElement | null;
        if (c) c.style.zIndex = '1';
      },
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const top = inchesToMm(m.top), left = inchesToMm(m.left);
    const printWidth = pdf.internal.pageSize.getWidth() - left - inchesToMm(m.right);
    const usable = pdf.internal.pageSize.getHeight() - top - inchesToMm(m.bottom);
    const mmPerPx = printWidth / canvas.width;
    const slicePx = Math.floor(usable / mmPerPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    const ctx = slice.getContext('2d')!;
    for (let offset = 0, page = 0; offset < canvas.height; offset += slicePx, page++) {
      const h = Math.min(slicePx, canvas.height - offset);
      if (page > 0 && h * mmPerPx < 5) break;
      slice.height = h;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', left, top, printWidth, h * mmPerPx);
    }
    pdf.save(safeName(model.title) + '.pdf');
  } finally {
    container.remove();
  }
}

/** Print through the browser (best quality; "Save as PDF" works here too). */
export function printDoc(model: DocModel): Promise<void> {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.srcdoc = serializeDoc(model);
    frame.onload = async () => {
      const win = frame.contentWindow!;
      try { await win.document.fonts.ready; } catch {}
      setTimeout(() => {
        win.focus(); win.print();
        setTimeout(() => { frame.remove(); resolve(); }, 1000);
      }, 250);
    };
    document.body.appendChild(frame);
  });
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
