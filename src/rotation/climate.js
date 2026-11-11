// Columnar NASA POWER climate files (see docs/SPEC.md "Data contract") -> a handy object, and one-season slices
// shaped like data/haor-2017.json so the existing sim can run on them. Pure: no DOM, no randomness.

const DAY_MS = 86400000;
const dn = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY_MS);
const isoOf = (d) => new Date(d * DAY_MS).toISOString().slice(0, 10);

/** Daily columns a climate file may carry. */
export const COLUMNS = ['rainFarm', 'rainUp', 'tmax', 'tmin', 'soil', 'soilTop', 'rad', 'rainImerg'];

/**
 * Expand a columnar climate file into an object with date helpers. Accepts a raw file or an already expanded one.
 * @param {object} climate columnar file: start (ISO), n, rainFarm[], tmax[], tmin[], ...
 * @returns {object} the file's columns plus n, start, lat, firstYear, lastYear, dateAt(i), indexOf(iso)
 */
export function expand(climate) {
  const cols = {};
  for (const k of COLUMNS) if (Array.isArray(climate[k])) cols[k] = climate[k];
  const n = climate.n ?? (cols.rainFarm ? cols.rainFarm.length : 0);
  if (!cols.rainUp && cols.rainFarm) cols.rainUp = cols.rainFarm;
  const start = climate.start;
  const startN = dn(start);
  const dateAt = (i) => isoOf(startN + i);
  /** Index of a date: clamped to n-1 after the end, -1 before the start. */
  const indexOf = (iso) => {
    const d = dn(iso) - startN;
    if (d < 0) return -1;
    return Math.min(d, n - 1);
  };
  return {
    id: climate.id, region: climate.region, sample: climate.sample, source: climate.source,
    points: climate.points, start, n,
    lat: climate.lat ?? climate.points?.farm?.lat ?? 24,
    firstYear: Number(start.slice(0, 4)),
    lastYear: Number(dateAt(n - 1).slice(0, 4)),
    ...cols, dateAt, indexOf,
  };
}

/**
 * Cut a date range out of a climate file as a season file shaped exactly like data/haor-2017.json
 * (days: [{date, rainUp, rainFarm, tmax, soil}]). The range is clamped to the data.
 * @param {object} climate raw or expanded climate
 * @param {string} startIso first day (ISO)
 * @param {string} endIso last day (ISO)
 * @returns {{days: object[]}}
 */
export function seasonSlice(climate, startIso, endIso) {
  const c = expand(climate);
  const a = Math.max(0, dn(startIso) - dn(c.start));
  const b = Math.min(c.n - 1, dn(endIso) - dn(c.start));
  const days = [];
  for (let i = a; i <= b; i++) {
    days.push({
      date: c.dateAt(i),
      rainUp: c.rainUp[i],
      rainFarm: c.rainFarm[i],
      tmax: c.tmax[i],
      soil: c.soil ? c.soil[i] : 0,
    });
  }
  return { days };
}
