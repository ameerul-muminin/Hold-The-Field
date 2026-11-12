// Soil health indicator from rotation traits only (not weather). An indicator, not a measurement.

/** The one weights table. Maximum total is 100. */
export const SOIL_WEIGHTS = {
  legume: 25,
  residue: { low: 5, medium: 12, high: 20 },
  bare: 20,
  diversity: { 1: 0, 2: 12, 3: 20 },
  rootDepth: { deep: 15, medium: 8 },
};

const uniqueCrops = (rotation, crops) => {
  const ids = [...new Set((rotation.slots || []).map((s) => s.crop))];
  return ids.map((id) => crops[id]).filter(Boolean);
};

/**
 * Days a year the field carries no crop: 365 minus the sum of crop days, min 0.
 * @param {object} rotation rotation with slots
 * @param {object} crops crops.json by id
 * @returns {number}
 */
export function bareDays(rotation, crops) {
  let used = 0;
  for (const s of rotation.slots || []) used += crops[s.crop]?.days ?? 0;
  return Math.max(0, 365 - used);
}

/**
 * The parts of the soil indicator.
 * @param {object} rotation rotation with slots
 * @param {object} crops crops.json by id
 * @returns {{legume:number, residue:number, bare:number, diversity:number, rootDepth:number, bareDays:number, total:number}}
 */
export function soilBreakdown(rotation, crops) {
  const list = uniqueCrops(rotation, crops);
  const W = SOIL_WEIGHTS;
  const legume = list.some((c) => c.legume) ? W.legume : 0;
  const residue = Math.max(0, ...list.map((c) => W.residue[c.residue] ?? 0));
  const bd = bareDays(rotation, crops);
  const bare = W.bare * (1 - Math.min(365, bd) / 365);
  const fam = new Set(list.map((c) => c.family).filter(Boolean)).size;
  const diversity = fam >= 3 ? W.diversity[3] : (W.diversity[fam] ?? 0);
  const rootDepth = list.some((c) => c.rootDepth === 'deep') ? W.rootDepth.deep
    : list.some((c) => c.rootDepth === 'medium') ? W.rootDepth.medium : 0;
  const total = Math.max(0, Math.min(100, legume + residue + bare + diversity + rootDepth));
  return { legume, residue, bare, diversity, rootDepth, bareDays: bd, total };
}

/**
 * Soil health indicator 0-100.
 * @param {object} rotation rotation with slots
 * @param {object} crops crops.json by id
 * @returns {number}
 */
export function soilScore(rotation, crops) {
  return soilBreakdown(rotation, crops).total;
}
