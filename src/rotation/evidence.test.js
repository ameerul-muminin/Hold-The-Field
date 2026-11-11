import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceCard, FIXED_GAPS, LOCAL_REVIEW } from './evidence.js';
import { CROPS } from './testutil.js';

const meta = { firstYear: 2001, lastYear: 2025, top: 'safety', datasets: ['NASA POWER'] };
const sum = (o) => ({ n: 25, failedYears: 4, median: 0.8, waterMedianMm: 400, soilScore: 40, bareDays: 250, worstYears: [2010, 2014, 2019], usedDefaultKy: false, ...o });
const base = { summary: sum() };

test('evidence lines are templates with values', () => {
  const rot = { id: 'p', slots: [{ crop: 'rice', sow: '01-05' }] };
  const c = evidenceCard(rot, { summary: sum() }, CROPS, base, meta);
  assert.equal(c.evidence[0].text, 'Came through {} of {} years ({} to {})');
  assert.deepEqual(c.evidence[0].vals, [21, 25, 2001, 2025]);
  assert.deepEqual(c.evidence[1].vals, ['NASA POWER']);
  for (const k of ['why', 'evidence', 'benefits', 'gaps', 'localReview']) {
    for (const l of c[k]) assert.ok(!/\d/.test(l.text), l.text);
  }
  assert.equal(c.localReview.length, 5);
  assert.equal(LOCAL_REVIEW.length, 5);
});

test('gaps list a null ky and the fixed gaps', () => {
  const rot = { id: 'm', slots: [{ crop: 'mustard', sow: '11-20' }] };
  const c = evidenceCard(rot, { summary: sum({ usedDefaultKy: true }) }, CROPS, base, meta);
  assert.ok(c.gaps.some((g) => g.text === 'No sourced value for {} of {}' && g.vals[0] === 'ky' && g.vals[1] === 'Mustard'));
  for (const f of FIXED_GAPS) assert.ok(c.gaps.some((g) => g.text === f.text));
  assert.ok(c.gaps.some((g) => /default response/.test(g.text)));
});

test('benefits only list real improvements; none says so; baseline has none', () => {
  const rot = { id: 'p', slots: [{ crop: 'rice', sow: '01-05' }] };
  const better = evidenceCard(rot, { summary: sum({ waterMedianMm: 300, soilScore: 70, bareDays: 200, failedYears: 1 }) }, CROPS, base, meta);
  assert.equal(better.benefits.length, 4);
  assert.deepEqual(better.benefits[0].vals, [100]);
  const worse = evidenceCard(rot, { summary: sum({ waterMedianMm: 500, soilScore: 30, bareDays: 300, failedYears: 9 }) }, CROPS, base, meta);
  assert.equal(worse.benefits.length, 1);
  const self = evidenceCard({ ...rot, existing: true }, base, CROPS, null, meta);
  assert.equal(self.benefits.length, 0);
});
