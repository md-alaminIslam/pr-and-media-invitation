import { DocModel, emptyDoc, guessLang, parseDoc } from './doc';
import { docxToHtml } from './docx';
import { sanitizeEditorHtml } from './sanitize';

export const ACCEPTED_UPLOADS = '.docx,.html,.htm,.txt,.md';
const MAX_UPLOAD = 25 * 1024 * 1024;

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function textToBody(text: string): string {
  return text.split(/\r?\n/).map(line => `<p>${line.trim() ? escapeHtml(line) : '<br>'}</p>`).join('');
}

const baseTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled';

/** Convert an uploaded file into an editable HTML document. */
export async function fileToDoc(file: File): Promise<DocModel> {
  if (file.size > MAX_UPLOAD) throw new Error(`“${file.name}” is larger than 25 MB.`);
  const name = file.name.toLowerCase();
  const title = baseTitle(file.name);
  if (name.endsWith('.docx')) {
    const result = await docxToHtml(await file.arrayBuffer());
    const body = sanitizeEditorHtml(result.html) || '<p><br></p>';
    const text = body.replace(/<[^>]+>/g, ' ');
    const model = emptyDoc(result.title || title, guessLang(text), body);
    if (result.margins) model.margins = result.margins;
    if (result.font) model.font = result.font;
    if (result.fontSize && result.fontSize >= 6 && result.fontSize <= 72) model.fontSize = result.fontSize;
    return model;
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) return parseDoc(await file.text(), title);
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    return emptyDoc(title, guessLang(text), textToBody(text));
  }
  if (name.endsWith('.doc')) throw new Error(`“${file.name}” is an old Word format. Open it in Word and save as .docx, then upload again.`);
  if (name.endsWith('.pdf')) throw new Error(`PDF files can't be edited. Upload the original Word (.docx) file instead.`);
  throw new Error(`“${file.name}” is not supported. Upload Word (.docx), HTML or text files.`);
}
