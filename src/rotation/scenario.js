// What-if climate: less rain, hotter. Not a forecast. Never mutates its input.

const RAIN_COLS = ['rainFarm', 'rainUp', 'rainImerg'];
const TEMP_COLS = ['tmax', 'tmin'];

/**
 * @param {object} climate columnar (raw or expanded) climate
 * @param {{rainPct?: number, tempC?: number}} [what] rainPct: -20 means 20% less rain; tempC: degrees added
 * @returns {object} a new climate; arrays are copies
 */
export function perturb(climate, { rainPct = 0, tempC = 0 } = {}) {
  const out = { ...climate };
  if (climate.points) out.points = JSON.parse(JSON.stringify(climate.points));
  for (const k of Object.keys(climate)) if (Array.isArray(climate[k])) out[k] = climate[k].slice();
  const f = Math.max(0, 1 + rainPct / 100);
  for (const k of RAIN_COLS) if (out[k]) out[k] = out[k].map((v) => v * f);
  for (const k of TEMP_COLS) if (out[k]) out[k] = out[k].map((v) => v + tempC);
  // keep rainUp a distinct, scaled array even when it was a shared copy of rainFarm
  return out;
}
