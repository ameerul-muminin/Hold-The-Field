import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFarmer, SOIL_HOLD } from './farmer.js';
import { CROPS } from './testutil.js';

const rots = [
  { id: 'a', slots: [{ crop: 'rice', sow: '01-05' }] },
  { id: 'b', slots: [{ crop: 'mung', sow: '03-01' }, { crop: 'mustard', sow: '11-20' }] },
];

test('soil sets hold; irrigation answer passes through', () => {
  const r = applyFarmer(rots, CROPS, { soil: 'sandy', canIrrigate: false, cannotSell: [], noMachine: [] });
  assert.equal(r.opts.hold, SOIL_HOLD.sandy);
  assert.equal(r.opts.canIrrigate, false);
});

test('conflicts are flagged on copies, inputs untouched', () => {
  const r = applyFarmer(rots, CROPS, { soil: 'clay', canIrrigate: true, cannotSell: ['mung'], noMachine: ['rice'] });
  assert.equal(r.rotations[0].conflict, true);
  assert.deepEqual(r.rotations[0].conflictCrops, ['rice']);
  assert.deepEqual(r.rotations[1].conflictCrops, ['mung']);
  assert.equal(rots[0].conflict, undefined);
});

test('no limits means no conflicts', () => {
  const r = applyFarmer(rots, CROPS, { soil: 'loam', canIrrigate: true, cannotSell: [], noMachine: [] });
  assert.ok(r.rotations.every((x) => !x.conflict));
});
