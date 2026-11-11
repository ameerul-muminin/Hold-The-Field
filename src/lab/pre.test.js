import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REGIONS, dataEntries, computeAll, yearClass, cropCalendar, rankItems, prioFor } from './view.js';
import { precompute, itemsFromPre, needsClimate, round4, PRE_ANSWERS } from './pre.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const crops = dataEntries(read('data/crops.json'));
const rotations = dataEntries(read('data/rotations.json'));

test('needsClimate: only soil, no pumping and what-if need the climate file', () => {
  assert.equal(needsClimate({}), false);
  assert.equal(needsClimate({ soil: '', canIrrigate: true, rainPct: 0, tempC: 0 }), false);
  assert.equal(needsClimate({ soil: 'clay' }), true);
  assert.equal(needsClimate({ canIrrigate: false }), true);
  assert.equal(needsClimate({ rainPct: -20 }), true);
  assert.equal(needsClimate({ tempC: 1.5 }), true);
});

test('round4 rounds numbers at any depth and leaves the rest alone', () => {
  assert.deepEqual(round4({ a: 0.123456, b: [1.00004, 'x', null, true], c: { d: 2 } }), { a: 0.1235, b: [1, 'x', null, true], c: { d: 2 } });
});

for (const region of REGIONS) {
  test(`${region}: the precomputed answer gives the same ranking, year classes and counts as a live replay`, () => {
    const climate = read(`data/climate/${region}.json`);
    const pre = precompute({ region, rotations: rotations[region], crops, climate });
    const live = computeAll({ region, rotations: rotations[region], crops, climate, answers: PRE_ANSWERS });
    const items = itemsFromPre(JSON.parse(JSON.stringify(pre)), rotations[region], crops);
    assert.equal(items.length, live.items.length);
    for (const [i, it] of items.entries()) {
      const lv = live.items[i];
      assert.equal(it.id, lv.id);
      assert.deepEqual(it.result.years.map(yearClass), lv.result.years.map(yearClass));
      assert.deepEqual(it.result.years.map((y) => y.year), lv.result.years.map((y) => y.year));
      assert.equal(it.result.summary.failedYears, lv.result.summary.failedYears);
      assert.equal(it.result.summary.bareDays, lv.result.summary.bareDays);
      assert.equal(Math.round(it.result.summary.waterMedianMm), Math.round(lv.result.summary.waterMedianMm));
      assert.equal(Math.round(it.result.summary.harvestMedian * 100), Math.round(lv.result.summary.harvestMedian * 100));
      assert.deepEqual(it.calendar, cropCalendar(lv, crops, live.clim, { flood: region === 'haor' }));
    }
    for (const prio of ['safety', 'yield', 'water', 'soil']) {
      assert.deepEqual(rankItems(items, prioFor(prio)).map((r) => r.id), rankItems(live.items, prioFor(prio)).map((r) => r.id));
    }
  });
}

test('itemsFromPre flags a way the farmer cannot sell without replaying', () => {
  const region = 'haor';
  const pre = precompute({ region, rotations: rotations[region], crops, climate: read(`data/climate/${region}.json`) });
  const items = itemsFromPre(pre, rotations[region], crops, { cannotSell: ['mustard'] });
  assert.deepEqual(items.map((i) => [i.id, i.rotation.conflict]), [['existing', false], ['short', false], ['mustard', true]]);
});

test('itemsFromPre returns null for a stale or foreign file', () => {
  const region = 'haor';
  const pre = precompute({ region, rotations: rotations[region], crops, climate: read(`data/climate/${region}.json`) });
  assert.equal(itemsFromPre(null, rotations[region], crops), null);
  assert.equal(itemsFromPre({ ...pre, v: 0 }, rotations[region], crops), null);
  assert.equal(itemsFromPre({ ...pre, items: pre.items.slice(1) }, rotations[region], crops), null);
  assert.equal(itemsFromPre(pre, rotations.barind, crops), null);
});
