import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, validName, withHtml, joinPath, parentPath, displayName } from './studioServer';

test('file names allow Bangla and common punctuation but not hidden or path names', () => {
  assert.equal(validName('বিমক্স ২০২৬ মিডিয়া'), null);
  assert.equal(validName('BIMOX (2026) & Co_v2.1'), null);
  assert.ok(validName(''));
  assert.ok(validName('.hidden'));
  assert.ok(validName('a/b'));
  assert.ok(validName('bad<name>'));
});

test('path helpers', () => {
  assert.equal(withHtml('a'), 'a.html');
  assert.equal(withHtml('a.HTML'), 'a.HTML');
  assert.equal(joinPath('', 'x'), 'x');
  assert.equal(joinPath('A/B', ' x '), 'A/B/x');
  assert.equal(parentPath('A/B/x.html'), 'A/B');
  assert.equal(parentPath('x.html'), '');
  assert.equal(displayName('A/বিমক্স.html'), 'বিমক্স');
});

test('tree puts folders first, nests files, and creates missing parent folders', () => {
  const tree = buildTree([
    { path: 'Projects', type: 'folder', modified: 1 },
    { path: 'Projects/b.html', type: 'file', modified: 2 },
    { path: 'Projects/a.html', type: 'file', modified: 2 },
    { path: 'Projects/Old', type: 'folder', modified: 1 },
    { path: 'Loose/deep/x.html', type: 'file', modified: 3 },
    { path: 'root.html', type: 'file', modified: 3 },
  ]);
  assert.deepEqual(tree.map(n => n.path), ['Loose', 'Projects', 'root.html']);
  const projects = tree.find(n => n.path === 'Projects')!;
  assert.deepEqual(projects.children.map(n => n.name), ['Old', 'a.html', 'b.html']);
  assert.equal(tree[0].children[0].children[0].path, 'Loose/deep/x.html');
});

