// Tests for "My field today" (src/field/advice.js). The 24 sim tests live in src/sim/engine.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advise, overall, floodOdds, plusDays } from './advice.js';

const calendar = JSON.parse(readFileSync(new URL('../../data/haor-flood-calendar.json', import.meta.url), 'utf8'));
const day = (date, o = {}) => ({ date, rain: 3, tmax: 30, tmin: 22, rh: 75, soil: 0.8, rainUp: 5, ...o });
const week = (o = {}, from = 1) => Array.from({ length: 7 }, (_, k) => day(`2026-10-${String(from + k).padStart(2, '0')}`, o));
const byId = (cards, id) => cards.find((c) => c.id === id);

test('field: calm weather gives no warnings', () => {
  const cards = advise(week(), { upstream: true });
  assert.equal(overall(cards), 'ok');
  assert.equal(byId(cards, 'cold'), undefined);
});

test('field: hill rain uses the scout thresholds and only shows upstream of a haor', () => {
  const days = week();
  days.at(-1).rainUp = 160;
  assert.equal(byId(advise(days, { upstream: true }), 'hills').level, 'act');
  days.at(-1).rainUp = 110;
  assert.equal(byId(advise(days, { upstream: true }), 'hills').level, 'watch');
  assert.equal(byId(advise(days, { upstream: false }), 'hills'), undefined);
});

test('field: dry soil after a rainless week asks for irrigation', () => {
  const cards = advise(week({ rain: 0, soil: 0.55 }));
  assert.equal(byId(cards, 'soil').level, 'act');
  assert.equal(cards[0].level, 'act');       // worst first
});

test('field: heat, cold and damp weather', () => {
  assert.equal(byId(advise(week({ tmax: 38 })), 'heat').level, 'act');
  assert.equal(byId(advise(week({ tmax: 35.5 })), 'heat').level, 'watch');
  assert.equal(byId(advise(week({ tmin: 11 })), 'cold').level, 'act');
  assert.equal(byId(advise(week({ rh: 92, tmin: 24 })), 'damp').level, 'watch');
});

test('field: rain is compared with the monthly normal', () => {
  const clim = Array(12).fill(10);          // 70 mm in a normal week
  assert.equal(byId(advise(week({ rain: 1 }), { clim }), 'rain').level, 'watch');
  assert.equal(byId(advise(week({ rain: 10 }), { clim }), 'rain').level, 'ok');
  assert.equal(byId(advise(week({ rain: 10 }), { clim }), 'rain').normal, 70);
});

test('field: the flood calendar matches 2017 and favours an earlier harvest', () => {
  const y2017 = calendar.years.find((y) => y.year === 2017);
  assert.equal(y2017.firstWarning, '2017-03-31');     // the same day as the game's FLOOD WARNING
  const early = floodOdds(calendar, plusDays('2026-12-01', 125));
  const late = floodOdds(calendar, plusDays('2026-12-01', 150));
  assert.equal(early.total, calendar.years.length);
  assert.ok(early.warned < late.warned);
  assert.equal(early.earliest, '2017-03-31');
});
