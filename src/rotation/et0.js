// Reference evapotranspiration, FAO-56 (Allen et al. 1998). Pure functions.

const GSC = 0.0820; // solar constant, MJ m-2 min-1

/**
 * Day of year (1-366) of an ISO date.
 * @param {string} iso 'YYYY-MM-DD'
 * @returns {number}
 */
export function dayOfYear(iso) {
  const d = Date.parse(iso + 'T00:00:00Z');
  const y0 = Date.parse(iso.slice(0, 4) + '-01-01T00:00:00Z');
  return Math.round((d - y0) / 86400000) + 1;
}

/**
 * Extraterrestrial radiation, FAO-56 eq. 21.
 * @param {number} latDeg latitude in degrees, south negative
 * @param {number} doy day of year
 * @returns {number} MJ m-2 day-1
 */
export function extraterrestrialRadiation(latDeg, doy) {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const x = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(x);
  return ((24 * 60) / Math.PI) * GSC * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/**
 * Hargreaves reference evapotranspiration, FAO-56 eq. 52.
 * @param {number} tmax degC
 * @param {number} tmin degC
 * @param {number} latDeg latitude in degrees
 * @param {number} doy day of year
 * @returns {number} mm/day, never negative
 */
export function et0Hargreaves(tmax, tmin, latDeg, doy) {
  const ra = 0.408 * extraterrestrialRadiation(latDeg, doy); // mm/day
  const tmean = (tmax + tmin) / 2;
  const et = 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * ra;
  return Math.max(0, et);
}
