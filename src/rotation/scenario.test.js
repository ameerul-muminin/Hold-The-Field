import test from 'node:test';
import assert from 'node:assert/strict';
import { perturb } from './scenario.js';
import { synth } from './testutil.js';

test('perturb scales rain, shifts temperature, never mutates', () => {
  const c = synth(2001, 1, () => 10);
  const before = JSON.stringify(c);
  const p = perturb(c, { rainPct: -20, tempC: 2 });
  assert.equal(JSON.stringify(c), before);
  assert.equal(p.rainFarm[0], 8);
  assert.equal(p.rainUp[0], 8);
  assert.equal(p.tmax[0], 34);
  assert.equal(p.tmin[0], 25);
  assert.notEqual(p.rainFarm, c.rainFarm);
  assert.equal(c.rainFarm[0], 10);
});

test('perturb with defaults is an equal copy', () => {
  const c = synth(2001, 1, () => 3);
  assert.deepEqual(perturb(c), c);
});
