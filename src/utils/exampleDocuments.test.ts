import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { EXAMPLE_DOCUMENTS, exampleUrl, fetchExampleFile } from './exampleDocuments';
import { DOCUMENT_SLOTS } from './templates';
import { submitUploadedFiles } from './uploadWorkspace';

test('one example document for each of the four slots', () => {
  assert.deepEqual(EXAMPLE_DOCUMENTS.map(d => d.type).sort(), DOCUMENT_SLOTS.map(s => s.type).sort());
});

test('example URLs respect the deploy base path', () => {
  assert.equal(exampleUrl(EXAMPLE_DOCUMENTS[0], '/pr-and-media-invitation/'), '/pr-and-media-invitation/examples/BIMOX_2026_Media_Invitation_Bangla.docx');
  assert.equal(exampleUrl(EXAMPLE_DOCUMENTS[0], '/'), '/examples/BIMOX_2026_Media_Invitation_Bangla.docx');
});

test('example files exist, parse and load into a workspace', async () => {
  const files: any = {};
  for (const doc of EXAMPLE_DOCUMENTS) {
    const path = `public/examples/${doc.filename}`;
    assert.ok(existsSync(path), path);
    const text = (await mammoth.extractRawText({ path })).value;
    assert.ok(text.includes('BIMOX') || text.includes('বিমক্স'), doc.filename);
    files[doc.type] = { filename: doc.filename, text };
  }
  const data = submitUploadedFiles(files);
  assert.equal(Object.keys(data.templates!).length, 4);
  assert.equal(data.chiefGuest.nameEn, 'Mr. Shaikh Rabiul Alam');
  assert.equal(data.chiefGuest.nameBn, 'জনাব শেখ রবিউল আলম');
});

test('fetchExampleFile wraps the response as a named .docx File', async () => {
  const bytes = readFileSync(`public/examples/${EXAMPLE_DOCUMENTS[1].filename}`);
  const file = await fetchExampleFile(EXAMPLE_DOCUMENTS[1], (async () => new Response(bytes)) as any);
  assert.equal(file.name, EXAMPLE_DOCUMENTS[1].filename);
  assert.equal(file.size, bytes.length);
  await assert.rejects(fetchExampleFile(EXAMPLE_DOCUMENTS[1], (async () => new Response('', { status: 404 })) as any), /404/);
});
