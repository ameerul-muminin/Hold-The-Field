import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  REGIONS, dataEntries, yearClass, lostYears, headline, sourceParts, groupGaps, collectSources,
  computeAll, rankItems, evidenceFor, uniqueCrops, oneDecimal,
} from './view.js';

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const crops = dataEntries(read('data/crops.json'));
const rots = dataEntries(read('data/rotations.json'));
const y = (yieldIndex, lost = false) => ({ year: 2000, yieldIndex, slots: [{ crop: 'x', yieldIndex, gapMm: 0, lost }] });

test('dataEntries skips underscore keys', () => {
  assert.deepEqual(Object.keys(dataEntries({ _a: 1, b: 2 })), ['b']);
  assert.ok(!('_about' in crops));
  assert.deepEqual(Object.keys(rots).sort(), [...REGIONS].sort());
});

test('yearClass thresholds', () => {
  assert.equal(yearClass(y(0.9, true)), 'lost');
  assert.equal(yearClass(y(0.49)), 'poor');
  assert.equal(yearClass(y(0.5)), 'fair');
  assert.equal(yearClass(y(0.79)), 'fair');
  assert.equal(yearClass(y(0.8)), 'good');
});

test('headline picks the right sentence', () => {
  const mk = (years, failedYears) => ({ years, summary: { n: years.length, failedYears } });
  const a = headline(mk([{ ...y(0, true), year: 2004 }, { ...y(1), year: 2005 }], 1), 'R');
  assert.match(a.text, /lost its crop/);
  assert.deepEqual(a.vals, [2, 'R', 1, '2004']);
  assert.match(headline(mk([y(0.3)], 1), 'R').text, /poor years/);
  assert.match(headline(mk([y(0.9)], 0), 'R').text, /every year/);
  assert.deepEqual(lostYears(mk([{ ...y(0, true), year: 7 }], 1)), [7]);
});

test('sourceParts splits URL and note', () => {
  assert.deepEqual(sourceParts('https://a.org/x (note here)'), { url: 'https://a.org/x', rest: '(note here)' });
  assert.deepEqual(sourceParts('https://a.org/x'), { url: 'https://a.org/x', rest: '' });
  assert.equal(sourceParts('Assumption: needs a source.').url, null);
});

test('groupGaps groups by parameter', () => {
  const g = groupGaps([
    { text: 'No sourced value for {} of {}', vals: ['price', 'A'] },
    { text: 'No sourced value for {} of {}', vals: ['price', 'B'] },
    { text: 'No sourced value for {} of {}', vals: ['ky', 'A'] },
    { text: 'No salinity data', vals: [] },
  ]);
  assert.deepEqual(g.groups, [{ param: 'price', crops: ['A', 'B'] }, { param: 'ky', crops: ['A'] }]);
  assert.equal(g.rest.length, 1);
});

test('collectSources lists rotation and crop sources once', () => {
  const r = rots.barind[0];
  const s = collectSources(r, crops);
  assert.ok(s.length > 3);
  assert.equal(new Set(s.map((e) => e.url + e.rest)).size, s.length);
  assert.equal(s[0].url, r.source);
});

test('oneDecimal', () => { assert.equal(oneDecimal(1.04), '1'); assert.equal(oneDecimal(1.26), '1.3'); });

for (const region of REGIONS) {
  const file = new URL(`../../data/climate/${region}.json`, import.meta.url);
  test(`real replay and ranking, ${region}`, { skip: !existsSync(file) }, () => {
    const climate = JSON.parse(readFileSync(file, 'utf8'));
    const base = { region, rotations: rots[region], crops, climate };
    const all = computeAll({ ...base, answers: { soil: 'loam', canIrrigate: true } });
    assert.equal(all.items.length, rots[region].length);
    for (const it of all.items) assert.ok(it.result.summary.n > 15);
    const rows = rankItems(all.items, { safety: 100, yield: 50, water: 50, soil: 50 });
    assert.equal(rows.length, all.items.length);
    const ev = evidenceFor(all.items[1], all.items[0], crops, climate, rows[0].top);
    assert.ok(ev.gaps.length && ev.localReview.length === 5);
    // a limit that bans a crop pushes conflicting rotations last
    const banned = uniqueCrops(rots[region]).find((c) => rots[region].some((r) => !r.existing && r.slots.some((s) => s.crop === c)));
    const lim = computeAll({ ...base, answers: { cannotSell: [banned] }, whatIf: { rainPct: -20, tempC: 1 } });
    const r2 = rankItems(lim.items, { safety: 100, yield: 0, water: 0, soil: 0 });
    assert.equal(r2[r2.length - 1].conflict, true);
  });
}

test('no irrigation makes irrigated crops riskier or equal', () => {
  const climate = JSON.parse(readFileSync(new URL('../../data/climate/barind.json', import.meta.url), 'utf8'));
  const a = computeAll({ region: 'barind', rotations: rots.barind, crops, climate, answers: { canIrrigate: true } });
  const b = computeAll({ region: 'barind', rotations: rots.barind, crops, climate, answers: { canIrrigate: false } });
  assert.ok(b.items[0].result.summary.failedYears >= a.items[0].result.summary.failedYears);
});
