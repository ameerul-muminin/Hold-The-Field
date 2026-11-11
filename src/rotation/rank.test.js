import test from 'node:test';
import assert from 'node:assert/strict';
import { rank } from './rank.js';

const sum = (o) => ({ n: 10, failedYears: 0, median: 0.8, waterMedianMm: 200, soilScore: 50, ...o });
const results = [
  { id: 'safe', summary: sum({ failedYears: 0, median: 0.6, waterMedianMm: 300, soilScore: 40 }) },
  { id: 'thrifty', summary: sum({ failedYears: 4, median: 0.7, waterMedianMm: 0, soilScore: 90 }) },
  { id: 'big', summary: sum({ failedYears: 2, median: 0.95, waterMedianMm: 150, soilScore: 60 }) },
];

test('ordering changes with priorities', () => {
  const a = rank(results, { safety: 1, yield: 0, water: 0, soil: 0 });
  assert.equal(a[0].id, 'safe');
  assert.equal(a[0].top, 'safety');
  const b = rank(results, { safety: 0, yield: 1, water: 0, soil: 0 });
  assert.equal(b[0].id, 'big');
  const c = rank(results, { safety: 0, yield: 0, water: 1, soil: 0 });
  assert.equal(c[0].id, 'thrifty');
  assert.equal(c[0].top, 'water');
});

test('conflict sorts last whatever its score', () => {
  const r = results.map((x) => (x.id === 'big' ? { ...x, conflict: true } : x));
  const out = rank(r, { safety: 0, yield: 1, water: 0, soil: 0 });
  assert.equal(out.at(-1).id, 'big');
});

test('equal metrics give 0.5 and ties keep input order', () => {
  const same = [{ id: 'a', summary: sum() }, { id: 'b', summary: sum() }];
  const out = rank(same, { safety: 1, yield: 1, water: 1, soil: 1 });
  assert.deepEqual(out.map((x) => x.id), ['a', 'b']);
  assert.equal(out[0].score, 0.5);
  assert.equal(out[0].parts.safety, 0.125);
});
