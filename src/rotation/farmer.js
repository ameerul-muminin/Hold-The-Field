// The farmer's three questions applied to rotations. Pure.

// PLACEHOLDERS pending a sourced table (SRDI / BARC): mm of water the root zone can hold for the crop.
export const SOIL_HOLD = { clay: 140, loam: 110, sandy: 60 };

/**
 * @param {object[]} rotations rotations with slots
 * @param {object} crops crops.json by id (kept for symmetry with the other modules)
 * @param {{soil?: string, canIrrigate?: boolean, cannotSell?: string[], noMachine?: string[]}} answers
 * @returns {{opts: {hold: (number|undefined), canIrrigate: boolean}, rotations: object[]}}
 *   hold is undefined when soil is not answered, so season.js uses its default.
 */
export function applyFarmer(rotations, crops, answers = {}) {
  const banned = new Set([...(answers.cannotSell || []), ...(answers.noMachine || [])]);
  const out = rotations.map((r) => {
    const conflictCrops = [...new Set((r.slots || []).map((s) => s.crop).filter((c) => banned.has(c)))];
    return { ...r, slots: (r.slots || []).map((s) => ({ ...s })), conflict: conflictCrops.length > 0, conflictCrops };
  });
  return {
    opts: { hold: SOIL_HOLD[answers.soil], canIrrigate: answers.canIrrigate !== false },
    rotations: out,
  };
}
