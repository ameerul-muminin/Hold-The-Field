import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSlot, kcOn } from './season.js';
import { synth, RICE, MUNG, MUSTARD } from './testutil.js';
import { floodConfig } from '../sim/config.js';

// 2001 dry, 2002 wet, 2003 dry again
const clim = synth(2001, 3, (y) => (y === 2002 ? 15 : 0));
const slot = { crop: 'mung', sow: '03-01' };

test('kc ramps: ini, mid, then linear to end', () => {
  assert.equal(kcOn(MUNG, 0), 0.4);
  assert.equal(kcOn(MUNG, 35), 1.05);
  assert.ok(kcOn(MUNG, 60) < 1.05 && kcOn(MUNG, 60) > 0.6);
});

test('a dry year has a larger gap than a wet year', () => {
  const dry = runSlot(slot, MUNG, clim, 2001);
  const wet = runSlot(slot, MUNG, clim, 2002);
  assert.ok(dry.gapMm > wet.gapMm);
  assert.ok(dry.demandMm > 0);
  assert.equal(dry.sowIso, '2001-03-01');
});

test('irrigated crop keeps water 1 but reports waterMm', () => {
  const r = runSlot({ crop: 'rice', sow: '01-05' }, RICE, clim, 2001);
  assert.equal(r.water, 1);
  assert.ok(r.waterMm > 0);
  assert.equal(r.waterMm, r.gapMm);
});

test('canIrrigate:false lowers yield in a dry year', () => {
  const s = { crop: 'rice', sow: '01-05' };
  const yes = runSlot(s, RICE, clim, 2001, { canIrrigate: true });
  const no = runSlot(s, RICE, clim, 2001, { canIrrigate: false });
  assert.ok(no.yieldIndex < yes.yieldIndex);
  assert.equal(no.waterMm, 0);
});

test('rainfed water factor falls with the gap; default ky is flagged', () => {
  const r = runSlot({ crop: 'mustard', sow: '03-01' }, MUSTARD, clim, 2001);
  assert.equal(r.usedDefaultKy, true);
  assert.ok(r.water < 1);
  assert.equal(runSlot(slot, MUNG, clim, 2001).usedDefaultKy, false);
});

test('heat factor drops when the middle stage is hot; null heatC gives 1', () => {
  const hot = synth(2001, 1, () => 5, () => 45);
  assert.equal(runSlot(slot, MUNG, hot, 2001).heat, 0.5);
  assert.equal(runSlot(slot, { ...MUNG, heatC: null }, hot, 2001).heat, 1);
});

test('a slot running past the data returns null', () => {
  assert.equal(runSlot({ crop: 'rice', sow: '12-20' }, RICE, clim, 2003), null);
  assert.equal(runSlot(slot, MUNG, clim, 2000), null);
});

test('window may cross into next year', () => {
  const r = runSlot({ crop: 'rice', sow: '12-20' }, RICE, clim, 2001);
  assert.equal(r.endIso.slice(0, 4), '2002');
});

test('REAL haor 2017 data: 115-day boro sown 01-05 with flood is lost', () => {
  const d = JSON.parse(readFileSync(new URL('../../data/haor-2017.json', import.meta.url), 'utf8'));
  const climate = {
    id: 'haor-2017', start: d.days[0].date, n: d.days.length, points: d.points,
    rainFarm: d.days.map((x) => x.rainFarm), rainUp: d.days.map((x) => x.rainUp),
    tmax: d.days.map((x) => x.tmax), tmin: d.days.map((x) => x.tmax - 9), soil: d.days.map((x) => x.soil),
  };
  const r = runSlot({ crop: 'boro', sow: '01-05' }, RICE, climate, 2017, { flood: { cfg: floodConfig(), variety: 'long' } });
  assert.ok(r);
  assert.equal(r.lost, true);
  assert.equal(r.yieldIndex, 0);
  const noFlood = runSlot({ crop: 'boro', sow: '01-05' }, RICE, climate, 2017);
  assert.equal(noFlood.lost, false);
});
