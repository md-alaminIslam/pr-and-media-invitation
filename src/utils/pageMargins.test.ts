import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAGE_MARGINS, clampMargin, docxPageMargins, loadPageMargins, marginError, normalizeMargins, printPageCss, savePageMargins, PAGE_MARGINS_KEY } from './pageMargins';

test('clampMargin keeps values within range and rounds', () => {
  assert.equal(clampMargin(0.756, 1), 0.76);
  assert.equal(clampMargin(-1, 1), 0);
  assert.equal(clampMargin(9, 1), 3);
  assert.equal(clampMargin('1.25', 1), 1.25);
  assert.equal(clampMargin('abc', 1), 1);
});

test('marginError rejects margins that leave no room on A4', () => {
  assert.equal(marginError(DEFAULT_PAGE_MARGINS), null);
  assert.match(marginError({ top: 1, bottom: 1, left: 3.5, right: 3.5 })!, /text width/);
  assert.equal(marginError({ top: 3, bottom: 3, left: 1, right: 1 }), null);
});

test('normalizeMargins falls back to defaults for bad input', () => {
  assert.deepEqual(normalizeMargins(null), DEFAULT_PAGE_MARGINS);
  assert.deepEqual(normalizeMargins({ top: 0.5, right: 'x' }), { top: 0.5, right: 1, bottom: 1, left: 1 });
  assert.deepEqual(normalizeMargins({ top: 9, right: 3, bottom: 9, left: 3 }), { top: 3, right: 3, bottom: 3, left: 3 });
});

test('margins round-trip through storage', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  savePageMargins({ top: 0.5, right: 0.75, bottom: 1.5, left: 0.25 }, storage);
  assert.ok(store.has(PAGE_MARGINS_KEY));
  assert.deepEqual(loadPageMargins(storage), { top: 0.5, right: 0.75, bottom: 1.5, left: 0.25 });
});

test('conversions for print CSS and Word', () => {
  const m = { top: 0.5, right: 0.75, bottom: 1, left: 1.25 };
  assert.match(printPageCss(m), /margin: 0\.5in 0\.75in 1in 1\.25in/);
  assert.deepEqual(docxPageMargins(m), { top: 720, right: 1080, bottom: 1440, left: 1800 });
});
