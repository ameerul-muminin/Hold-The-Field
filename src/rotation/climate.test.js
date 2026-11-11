import test from 'node:test';
import assert from 'node:assert/strict';
import { expand, seasonSlice } from './climate.js';
import { synth } from './testutil.js';

test('expand: dates, index, years', () => {
  const c = expand(synth(2001, 2, () => 1));
  assert.equal(c.n, 730);
  assert.equal(c.firstYear, 2001);
  assert.equal(c.lastYear, 2002);
  assert.equal(c.dateAt(0), '2001-01-01');
  assert.equal(c.dateAt(364), '2001-12-31');
  assert.equal(c.indexOf('2001-01-02'), 1);
  assert.equal(c.indexOf('2000-12-31'), -1);
  assert.equal(c.indexOf('2030-01-01'), c.n - 1);
});

test('seasonSlice has the shape of haor-2017.json days', () => {
  const s = seasonSlice(synth(2001, 1, () => 2), '2001-02-01', '2001-02-10');
  assert.equal(s.days.length, 10);
  assert.deepEqual(Object.keys(s.days[0]).sort(), ['date', 'rainFarm', 'rainUp', 'soil', 'tmax']);
  assert.equal(s.days[0].date, '2001-02-01');
});

test('seasonSlice clamps to the data', () => {
  const s = seasonSlice(synth(2001, 1, () => 2), '2000-12-01', '2001-01-03');
  assert.equal(s.days.length, 3);
});
