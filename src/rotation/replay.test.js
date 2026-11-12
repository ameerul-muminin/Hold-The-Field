import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, percentile } from './replay.js';
import { synth, CROPS } from './testutil.js';

// six years, years 3 and 5 are drought
const clim = synth(2001, 6, (y) => (y === 2003 || y === 2005 ? 0 : 8));
const rot = { id: 'r', slots: [{ crop: 'mung', sow: '03-01' }, { crop: 'rice', sow: '07-25' }] };

test('percentile interpolates', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([0, 10], 0.1), 1);
  assert.equal(percentile([], 0.5), null);
});

test('replay over six years', () => {
  const r = replay(rot, CROPS, clim);
  assert.equal(r.summary.n, 6);
  assert.equal(r.years.length, 6);
  const s = r.summary;
  assert.ok(s.p10 <= s.median && s.median <= s.p90);
  assert.ok(s.median > 0 && s.median <= 1);
  assert.equal(s.bareDays, 365 - 70 - 115);
  assert.equal(s.worstYears.length, 3);
  assert.ok(s.worstYears.includes(2003) && s.worstYears.includes(2005));
  const y03 = r.years.find((y) => y.year === 2003), y02 = r.years.find((y) => y.year === 2002);
  assert.ok(y03.yieldIndex < y02.yieldIndex);
});

test('a window past the data drops that year from n', () => {
  const late = { id: 'l', slots: [{ crop: 'rice', sow: '12-20' }] };
  const r = replay(late, CROPS, clim);
  assert.equal(r.summary.n, 5);
  assert.ok(!r.years.some((y) => y.year === 2006));
});

test('canIrrigate:false lowers the median for an irrigated rotation', () => {
  const rice = { id: 'x', slots: [{ crop: 'rice', sow: '01-05' }] };
  const dry = synth(2001, 6, () => 0);
  const a = replay(rice, CROPS, dry, { canIrrigate: true }).summary;
  const b = replay(rice, CROPS, dry, { canIrrigate: false }).summary;
  assert.ok(b.median < a.median);
  assert.ok(a.waterMedianMm > 0 && b.waterMedianMm === 0);
});
