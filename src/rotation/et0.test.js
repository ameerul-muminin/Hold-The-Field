import test from 'node:test';
import assert from 'node:assert/strict';
import { et0Hargreaves, extraterrestrialRadiation, dayOfYear } from './et0.js';

test('dayOfYear', () => {
  assert.equal(dayOfYear('2001-01-01'), 1);
  assert.equal(dayOfYear('2001-09-03'), 246);
  assert.equal(dayOfYear('2004-12-31'), 366);
});

test('FAO-56 Example 8: Ra at 20 S on 3 September is 32.2 MJ', () => {
  const ra = extraterrestrialRadiation(-20, 246);
  assert.ok(Math.abs(ra - 32.2) / 32.2 < 0.01, `got ${ra}`);
});

test('Bangladesh April ET0 is 4 to 7 mm/day', () => {
  const et = et0Hargreaves(36, 25, 24.6, dayOfYear('2010-04-15'));
  assert.ok(et > 4 && et < 7, `got ${et}`);
});

test('no negative ET0 when range is zero or inverted', () => {
  assert.equal(et0Hargreaves(20, 20, 24, 100), 0);
  assert.equal(et0Hargreaves(20, 25, 24, 100), 0);
});
