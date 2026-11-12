// "My own field" (N7): the farmer taps "Use my location"; the browser fetches 25 years of NASA POWER daily weather for
// that point and the Lab replays the nearest region's ways of planting on it. The flash-flood rule applies only inside
// the haor basin. The last answer for a point is kept on this phone, so it still opens with no signal.
// toClimate() and nearestRegion() are pure (tested); fetchFieldClimate() does the network and storage.
import { BRAND } from '../brand.js';
import { PLACES, inHaorBasin } from '../field/power.js';

const DAILY = 'https://power.larc.nasa.gov/api/temporal/daily/point';
/** Same parameters and fill rules as data-pipeline/fetch_climate.py, so a field file looks like data/climate/*.json. */
export const PARAM_MAP = { rainFarm: 'PRECTOTCORR', tmax: 'T2M_MAX', tmin: 'T2M_MIN', soil: 'GWETROOT', soilTop: 'GWETTOP', rad: 'ALLSKY_SFC_SW_DWN' };
const DEFAULTS = { rainFarm: 0, tmax: 30, tmin: 21, soil: 0.5, soilTop: 0.5 };
const DIGITS = { rainFarm: 1, tmax: 1, tmin: 1, soil: 3, soilTop: 3, rad: 2, rainUp: 1 };
export const UPSTREAM = { lat: 25.27, lon: 91.73 };     // Meghalaya hills above the haor (data-pipeline/regions.json)
export const FIRST = '2001-01-01', LAST = '2025-12-31';  // the same 25 years as the region files

const DAY_MS = 86400000;
const missing = (v) => v == null || !Number.isFinite(Number(v)) || Number(v) <= -998;
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10).replaceAll('-', '');

/** Two decimals (about 1 km): enough for a 50 km weather square, and we never keep the exact spot. */
export const roundPoint = ({ lat, lon }) => ({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });

/** Distance in km between two points (haversine). */
export function km(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The region whose ways of planting we borrow (nearest of the three), and whether the flood rule applies here. */
export function nearestRegion(point) {
  let best = null;
  for (const p of PLACES) {
    const d = km(point, p);
    if (!best || d < best.km) best = { region: p.id, km: Math.round(d) };
  }
  return { ...best, flood: inHaorBasin(point.lat, point.lon) };
}

/**
 * POWER {param: {YYYYMMDD: value}} -> a columnar climate file shaped like data/climate/<region>.json.
 * Missing values are filled exactly as the Python pipeline fills them (and counted).
 * @param {object} p POWER parameter object for the farm point
 * @param {object|null} up {YYYYMMDD: value} rain upstream, or null to copy the farm rain
 */
export function toClimate(p, up, { lat, lon, start = FIRST, end = LAST, fetched = new Date().toISOString().slice(0, 10), flood = false } = {}) {
  const a = Date.parse(start + 'T00:00:00Z'), b = Date.parse(end + 'T00:00:00Z');
  const cols = { rainFarm: [], rainUp: [], tmax: [], tmin: [], soil: [], soilTop: [], rad: [] };
  let fills = 0, prevRad = null;
  for (let ms = a; ms <= b; ms += DAY_MS) {
    const k = keyOf(ms);
    for (const [name, par] of Object.entries(PARAM_MAP)) {
      const v = p?.[par]?.[k];
      if (missing(v)) fills++;
      if (name === 'rad') {
        const rad = missing(v) ? (prevRad ?? 15) : Number(v);
        prevRad = rad;
        cols.rad.push(round(rad, DIGITS.rad));
      } else {
        cols[name].push(round(missing(v) ? DEFAULTS[name] : Number(v), DIGITS[name]));
      }
    }
    if (up) {
      const v = up[k];
      if (missing(v)) fills++;
      cols.rainUp.push(round(missing(v) ? 0 : Number(v), DIGITS.rainUp));
    } else {
      cols.rainUp.push(cols.rainFarm.at(-1));
    }
  }
  const n = cols.rainFarm.length;
  return {
    id: 'my-field-climate', region: 'mine', sample: false, source: 'NASA POWER Daily API, community AG',
    parameters: { ...PARAM_MAP },
    points: { farm: { lat, lon }, upstream: flood ? { ...UPSTREAM } : { lat, lon } },
    start, n, fetched, missing_values_filled: fills,
    ...cols,
  };
}

const storeKey = ({ lat, lon }) => `${BRAND.storageKey}-lab-field-${lat.toFixed(2)},${lon.toFixed(2)}`;
const lastKey = () => `${BRAND.storageKey}-lab-field-last`;
function remember(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
function recall(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }

/** The last field this phone looked at ({lat, lon}), or null. */
export const lastField = () => recall(lastKey());

async function getParams(pt, params, signal) {
  const q = new URLSearchParams({ parameters: params.join(','), community: 'AG', latitude: pt.lat, longitude: pt.lon, start: FIRST.replaceAll('-', ''), end: LAST.replaceAll('-', ''), format: 'JSON' });
  const r = await fetch(`${DAILY}?${q}`, { signal });
  if (!r.ok) throw new Error(`POWER ${r.status}`);
  const p = (await r.json())?.properties?.parameter;
  if (!p) throw new Error('POWER returned no data');
  // Same rule as data-pipeline/fetch_climate.py: a parameter POWER left out is an error, never a silent fill.
  for (const name of params) if (!p[name] || !Object.keys(p[name]).length) throw new Error(`POWER returned no ${name}`);
  return p;
}

/**
 * 25 years of NASA POWER for one point. Uses the copy on this phone if there is one (the past does not change);
 * otherwise fetches and keeps it. Resolves to { climate, point, near, cached }. Throws when offline with no copy.
 */
/** More than this share of missing values and we refuse to replay: it would be our fills, not NASA's record. */
export const MAX_FILL_SHARE = 0.02;

export async function fetchFieldClimate(raw, { timeoutMs = 90000 } = {}) {
  const point = roundPoint(raw);
  const near = nearestRegion(point);
  remember(lastKey(), point);
  const old = recall(storeKey(point));
  if (old?.rainFarm?.length && old.start === FIRST) return { climate: old, point, near, cached: true };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const [farm, up] = await Promise.all([
      getParams(point, Object.values(PARAM_MAP), ctl.signal),
      near.flood ? getParams(UPSTREAM, ['PRECTOTCORR'], ctl.signal).then((p) => p.PRECTOTCORR) : null,
    ]);
    const climate = toClimate(farm, up, { ...point, flood: near.flood });
    if (climate.missing_values_filled > MAX_FILL_SHARE * climate.n * (Object.keys(PARAM_MAP).length + 1)) {
      throw new Error(`POWER record has ${climate.missing_values_filled} missing values`);
    }
    remember(storeKey(point), climate);   // about 300 KB; if the phone is full it is simply not kept
    return { climate, point, near, cached: false };
  } finally {
    clearTimeout(timer);
  }
}
