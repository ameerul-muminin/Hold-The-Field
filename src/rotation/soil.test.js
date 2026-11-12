import test from 'node:test';
import assert from 'node:assert/strict';
import { soilScore, soilBreakdown, bareDays, SOIL_WEIGHTS } from './soil.js';
import { CROPS } from './testutil.js';

const riceOnly = { slots: [{ crop: 'rice', sow: '01-05' }] };
const legume = { slots: [{ crop: 'mung', sow: '03-01' }, { crop: 'rice', sow: '07-25' }, { crop: 'mustard', sow: '11-20' }] };

test('legume rotation scores higher than rice only', () => {
  assert.ok(soilScore(legume, CROPS) > soilScore(riceOnly, CROPS));
});

test('bare days and clamp', () => {
  assert.equal(bareDays(riceOnly, CROPS), 250);
  assert.equal(bareDays({ slots: [] }, CROPS), 365);
  const b = soilBreakdown(legume, CROPS);
  assert.ok(b.total >= 0 && b.total <= 100);
  assert.equal(b.legume, SOIL_WEIGHTS.legume);
  assert.equal(soilScore({ slots: [] }, CROPS), 0);
});
