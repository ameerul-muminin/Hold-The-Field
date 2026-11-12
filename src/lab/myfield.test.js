import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toClimate, nearestRegion, roundPoint, km, PARAM_MAP } from './myfield.js';
import { expand } from '../rotation/climate.js';

const day = (v) => ({ 20010101: v, 20010102: v, 20010103: v });
const power = (over = {}) => Object.fromEntries(Object.values(PARAM_MAP).map((p) => [p, day(over[p] ?? 1)]));

test('toClimate: columnar file shaped like data/climate/<region>.json', () => {
  const c = toClimate(power({ PRECTOTCORR: 4.24, T2M_MAX: 31.06 }), null, { lat: 24.6, lon: 88.5, start: '2001-01-01', end: '2001-01-03', fetched: '2026-11-12' });
  assert.equal(c.n, 3);
  assert.equal(c.start, '2001-01-01');
  assert.deepEqual(c.rainFarm, [4.2, 4.2, 4.2]);
  assert.deepEqual(c.rainUp, c.rainFarm, 'outside the haor basin the upstream rain is the farm rain');
  assert.deepEqual(c.tmax, [31.1, 31.1, 31.1]);
  assert.equal(c.sample, false);
  assert.equal(c.missing_values_filled, 0);
  const e = expand(c);
  assert.equal(e.firstYear, 2001);
  assert.equal(e.dateAt(2), '2001-01-03');
});

test('toClimate: fills -999 and absent days the way the Python pipeline does, and counts them', () => {
  const p = power();
  p.T2M_MAX[20010102] = -999;
  delete p.ALLSKY_SFC_SW_DWN[20010103];
  p.ALLSKY_SFC_SW_DWN[20010102] = 18.5;
  const c = toClimate(p, { 20010101: 9, 20010102: -999 }, { lat: 25, lon: 91.4, start: '2001-01-01', end: '2001-01-03', flood: true });
  assert.equal(c.tmax[1], 30);
  assert.equal(c.rad[2], 18.5, 'missing radiation repeats the day before');
  assert.deepEqual(c.rainUp, [9, 0, 0]);
  assert.equal(c.missing_values_filled, 4);
  assert.deepEqual(c.points.upstream, { lat: 25.27, lon: 91.73 });
});

test('nearestRegion: borrows the nearest region; the flood rule only inside the haor basin', () => {
  const sylhet = nearestRegion({ lat: 24.9, lon: 91.87 });
  assert.equal(sylhet.region, 'haor');
  assert.equal(sylhet.flood, true);
  const mymensingh = nearestRegion({ lat: 24.75, lon: 90.4 });
  assert.equal(mymensingh.flood, false, 'west of the basin: no flash-flood rule');
  assert.equal(nearestRegion({ lat: 24.37, lon: 88.6 }).region, 'barind');
  assert.equal(nearestRegion({ lat: 22.5, lon: 89.2 }).region, 'coast');
  assert.equal(nearestRegion({ lat: 22.5, lon: 89.2 }).flood, false);
});

test('roundPoint keeps two decimals; km is about right', () => {
  assert.deepEqual(roundPoint({ lat: 24.123456, lon: 90.98765 }), { lat: 24.12, lon: 90.99 });
  const d = km({ lat: 23.81, lon: 90.41 }, { lat: 22.36, lon: 91.78 });   // Dhaka to Chattogram, about 213 km
  assert.ok(d > 200 && d < 225, String(d));
});
