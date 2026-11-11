import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  REGIONS, dataEntries, yearClass, lostYears, finding, saferWay, plain, PLAIN, prioFor, cropWord, soilWord, sourceParts, groupGaps, collectSources,
  computeAll, rankItems, evidenceFor, uniqueCrops, oneDecimal, cropCalendar, gapsOf, hotDaysByMonth, floodLossDate, YEAR_DAYS,
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

test('finding picks the right sentence', () => {
  const mk = (years, failedYears, extra = {}) => ({ years, summary: { n: years.length, failedYears, bareDays: 200, waterMedianMm: 0, ...extra } });
  const a = finding(mk([{ ...y(0, true), year: 2004 }, { ...y(1), year: 2005 }], 1), { word: 'rice' });
  assert.equal(a.kind, 'lost');
  assert.match(a.say[0].text, /flood took this/);
  assert.deepEqual(a.say[0].vals, [2, 'rice', 1, '2004']);
  assert.equal(a.safer, false);
  const thin = finding(mk([{ ...y(0.3), year: 2009, failed: true }, { ...y(0.9), year: 2010, failed: false }], 1));
  assert.equal(thin.kind, 'thin');
  assert.deepEqual(thin.say[0].vals, [2, 'crop', 1, '2009']);
  const fine = finding(mk([y(0.9)], 0, { waterMedianMm: 497.2 }), { word: 'rice', saferName: 'X', saferFailed: 0 });
  assert.equal(fine.kind, 'fine');
  assert.deepEqual(fine.say.map((l) => l.vals), [[1, 'rice'], [200], [497], ['X']]);
  assert.equal(fine.safer, true);
  assert.deepEqual(lostYears(mk([{ ...y(0, true), year: 7 }], 1)), [7]);
});

test('saferWay finds the way with the fewest failed years, never a conflict', () => {
  const it = (id, failedYears, extra = {}) => ({ id, rotation: { id, ...extra }, result: { summary: { failedYears } } });
  assert.equal(saferWay([it('ex', 5, { existing: true }), it('a', 3), it('b', 1, { conflict: true }), it('c', 2)]).id, 'c');
  assert.equal(saferWay([it('ex', 0, { existing: true }), it('a', 0)]), null);
});

test('plain rewrites engine lines and keeps the placeholders', () => {
  const count = (s) => s.split('{}').length - 1;
  for (const [k, v] of Object.entries(PLAIN)) assert.equal(count(v), count(k), k);
  assert.deepEqual(plain({ text: 'Worst years: {}', vals: ['2004'] }), { text: 'Hardest years: {}.', vals: ['2004'] });
  assert.deepEqual(plain({ text: 'unknown {}', vals: [1] }), { text: 'unknown {}', vals: [1] });
});

test('banned words stay off the plain lines', () => {
  const banned = /\b(optimi[sz]e|leverage|insight|seamless|empower|unlock|journey|solution|robust|holistic|indicator|scenario|rotation)\b|It ranks here mostly because|!/i;
  for (const v of Object.values(PLAIN)) assert.doesNotMatch(v, banned, v);
});

test('one fear gets the top weight, the rest the old default', () => {
  assert.deepEqual(prioFor('safety'), { safety: 100, yield: 50, water: 50, soil: 50 });
  assert.deepEqual(prioFor('water'), { safety: 50, yield: 50, water: 100, soil: 50 });
});

test('cropWord and soilWord', () => {
  assert.equal(cropWord({ slots: [{ crop: 'boro_long' }, { crop: 't_aman' }] }), 'rice');
  assert.equal(cropWord({ slots: [{ crop: 'lentil' }, { crop: 't_aman' }] }), 'crop');
  assert.deepEqual([10, 30, 49, 50].map(soilWord), ['little', 'some', 'some', 'a lot']);
});

test('haor on the real record: the flood took boro 5 times, short boro is the safer way', { skip: !existsSync(new URL('../../data/climate/haor.json', import.meta.url)) }, () => {
  const climate = JSON.parse(readFileSync(new URL('../../data/climate/haor.json', import.meta.url), 'utf8'));
  const all = computeAll({ region: 'haor', rotations: rots.haor, crops, climate, answers: { canIrrigate: true } });
  const ex = all.items.find((i) => i.rotation.existing);
  const safer = saferWay(all.items);
  const fd = finding(ex.result, { word: cropWord(ex.rotation), saferName: safer?.rotation.label, saferFailed: safer?.result.summary.failedYears });
  assert.equal(fd.kind, 'lost');
  assert.deepEqual(lostYears(ex.result), [2004, 2010, 2016, 2017, 2022]);
  assert.equal(safer.id, 'short');
  assert.equal(fd.safer, true);
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

// ---- crop calendar (N3)
test('gapsOf returns what the segments leave bare', () => {
  assert.deepEqual(gapsOf([{ from: 10, to: 20 }]), [{ from: 0, to: 10 }, { from: 20, to: YEAR_DAYS }]);
  assert.deepEqual(gapsOf([{ from: 0, to: 100 }, { from: 100, to: YEAR_DAYS }]), []);
  assert.deepEqual(gapsOf([{ from: 5, to: 50 }, { from: 40, to: 60 }]), [{ from: 0, to: 5 }, { from: 60, to: YEAR_DAYS }]);
});

const hasClimate = (r) => existsSync(new URL(`../../data/climate/${r}.json`, import.meta.url));
const calFor = (region, id) => {
  const climate = read(`data/climate/${region}.json`);
  const out = computeAll({ region, rotations: rots[region], crops, climate });
  const item = out.items.find((i) => i.id === id);
  return { out, item, cal: cropCalendar(item, crops, out.clim, { flood: region === 'haor' }) };
};

test('calendar: a bar that runs past 31 Dec comes back in two parts', { skip: !hasClimate('haor') }, () => {
  const { cal } = calFor('haor', 'mustard');           // sown 20 Nov, 78 days
  const [a, b] = cal.bars[0].segments;
  assert.equal(a.to, YEAR_DAYS);
  assert.equal(b.from, 0);
  assert.equal((a.to - a.from) + (b.to - b.from), crops.mustard.days);
});

test('calendar: bare days are the year minus the bars', { skip: !hasClimate('barind') }, () => {
  const { cal } = calFor('barind', 'existing');
  const used = cal.bars.reduce((n, b) => n + b.segments.reduce((m, s) => m + s.to - s.from, 0), 0);
  assert.equal(cal.bareDays, YEAR_DAYS - used);
});

test('calendar, haor: flood window comes from the days the flood took the crop', { skip: !hasClimate('haor') }, () => {
  const { item, cal } = calFor('haor', 'existing');
  const d = cal.dangers[0];
  assert.equal(d.kind, 'flood');
  assert.deepEqual(d.dates.map((x) => x.year), item.result.years.filter((y) => y.slots.some((s) => s.lost)).map((y) => y.year));
  assert.ok(d.dates.length > 0);
  for (const x of d.dates) assert.ok(x.date.startsWith(String(x.year)));
  assert.ok(d.from < d.to);
  // the window sits inside the crop's own bar
  const bar = cal.bars[0].segments[0];
  assert.ok(d.from >= bar.from && d.to <= bar.to);
});

test('calendar, haor: a year the crop came home has no loss date', { skip: !hasClimate('haor') }, () => {
  const { item, out } = calFor('haor', 'existing');
  const ok = item.result.years.find((y) => !y.slots.some((s) => s.lost));
  assert.equal(floodLossDate(item.rotation.slots[0], crops.boro_long, out.clim, ok.year), null);
});

test('calendar, elsewhere: heat months match the hot-day counts, and no limit means no danger', { skip: !hasClimate('barind') }, () => {
  const { item, out, cal } = calFor('barind', 'existing');
  const boro = cal.dangers.find((d) => d.crop === 'boro_long');
  const { counts } = hotDaysByMonth(item.rotation.slots[0], crops.boro_long, out.clim);
  assert.deepEqual(boro.counts, counts);
  assert.ok(boro.months.length > 0 && boro.months.every((m) => counts[m] === Math.max(...counts)));
  // mustard has no sourced heat limit: nothing is drawn for it
  const m = calFor('barind', 'mustard_boro');
  assert.ok(!m.cal.dangers.some((d) => d.crop === 'mustard'));
});

test('calendar, elsewhere: no hot days means no window', { skip: !hasClimate('coast') }, () => {
  const { cal } = calFor('coast', 'existing');
  const aman = cal.dangers.find((d) => d.crop === 't_aman');
  assert.equal(aman.counts.reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(aman.months, []);
});
