import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, validName, withJson, joinPath, parentPath, displayName } from './studioServer';
import { normalizeDraft } from './draft';
import { emptyUploadWorkspace, submitUploadedFiles } from './uploadWorkspace';

test('file names allow Bangla and common punctuation but not hidden or path names', () => {
  assert.equal(validName('বিমক্স ২০২৬ মিডিয়া'), null);
  assert.equal(validName('BIMOX (2026) & Co_v2.1'), null);
  assert.ok(validName(''));
  assert.ok(validName('.hidden'));
  assert.ok(validName('a/b'));
  assert.ok(validName('bad<name>'));
});

test('path helpers', () => {
  assert.equal(withJson('a'), 'a.json');
  assert.equal(withJson('a.JSON'), 'a.JSON');
  assert.equal(joinPath('', 'x'), 'x');
  assert.equal(joinPath('A/B', ' x '), 'A/B/x');
  assert.equal(parentPath('A/B/x.json'), 'A/B');
  assert.equal(parentPath('x.json'), '');
  assert.equal(displayName('A/বিমক্স.json'), 'বিমক্স');
});

test('tree puts folders first, nests files, and creates missing parent folders', () => {
  const tree = buildTree([
    { path: 'Projects', type: 'folder', modified: 1 },
    { path: 'Projects/b.json', type: 'file', modified: 2 },
    { path: 'Projects/a.json', type: 'file', modified: 2 },
    { path: 'Projects/Old', type: 'folder', modified: 1 },
    { path: 'Loose/deep/x.json', type: 'file', modified: 3 },
    { path: 'root.json', type: 'file', modified: 3 },
  ]);
  assert.deepEqual(tree.map(n => n.path), ['Loose', 'Projects', 'root.json']);
  const projects = tree.find(n => n.path === 'Projects')!;
  assert.deepEqual(projects.children.map(n => n.name), ['Old', 'a.json', 'b.json']);
  assert.equal(tree[0].children[0].children[0].path, 'Loose/deep/x.json');
});

test('studio files round-trip through normalizeDraft', () => {
  const data = submitUploadedFiles({ 'invitation-en': { filename: 'mine.txt', text: 'Chief Guest: Ms. Rahman\nHello' } });
  const loaded = normalizeDraft(JSON.parse(JSON.stringify(data)));
  assert.equal(loaded.chiefGuest.nameEn, data.chiefGuest.nameEn);
  assert.deepEqual(Object.keys(loaded.templates!), ['invitation-en']);
  assert.deepEqual(normalizeDraft(null), emptyUploadWorkspace());
  assert.deepEqual(normalizeDraft('garbage'), emptyUploadWorkspace());
});
