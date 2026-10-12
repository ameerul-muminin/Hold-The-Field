// Live NASA POWER data for "My field today": the last weeks of daily weather at one point (plus the hills upstream
// for the haor) and the long-term monthly rain normals. Called from the browser (POWER allows it); the last good
// answer is kept on this device so the screen still works offline.
import { BRAND } from '../brand.js';

const DAILY = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const CLIMATE = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
const PARAMS = { PRECTOTCORR: 'rain', T2M_MAX: 'tmax', T2M_MIN: 'tmin', RH2M: 'rh', GWETROOT: 'soil' };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const UPSTREAM = { lat: 25.27, lon: 91.73 };     // Meghalaya hills above the haor (data-pipeline/regions.json)

export const PLACES = [
  { id: 'haor', name: 'Sunamganj haor', lat: 25.07, lon: 91.40 },
  { id: 'barind', name: 'Barind Tract', lat: 24.60, lon: 88.50 },
  { id: 'coast', name: 'Satkhira Coast', lat: 22.72, lon: 89.07 },
];

/** North-eastern haor basin, whose flash floods come from rain on the Meghalaya hills. */
export const inHaorBasin = (lat, lon) => lat >= 24.3 && lat <= 25.3 && lon >= 90.6 && lon <= 91.9;

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
const iso = (k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}`;
const key = (kind, lat, lon) => `${BRAND.storageKey}-field-${kind}-${lat.toFixed(2)},${lon.toFixed(2)}`;
const missing = (v) => v == null || v <= -998;

function remember(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } }
function recall(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }

async function getJson(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`POWER ${r.status}`);
  return r.json();
}

/**
 * Daily data for a place, oldest first, complete days only (POWER runs a few days behind).
 * Resolves to { days, upstream, through, fetched, stale } or throws if there is no data at all.
 */
export async function recent(place, { days = 40, timeoutMs = 25000 } = {}) {
  const { lat, lon } = place;
  const upstream = place.id === 'haor' || inHaorBasin(lat, lon);
  const cacheKey = key('daily', lat, lon);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const end = new Date(), start = new Date(Date.now() - days * 86400000);
    const q = (pt, params) => `${DAILY}?${new URLSearchParams({ parameters: params.join(','), community: 'AG', latitude: pt.lat, longitude: pt.lon, start: ymd(start), end: ymd(end), format: 'JSON' })}`;
    const [farm, up] = await Promise.all([
      getJson(q(place, Object.keys(PARAMS)), ctl.signal),
      upstream ? getJson(q(UPSTREAM, ['PRECTOTCORR']), ctl.signal) : null,
    ]);
    const p = farm?.properties?.parameter;
    if (!p?.PRECTOTCORR) throw new Error('POWER returned no data');
    const upRain = up?.properties?.parameter?.PRECTOTCORR;
    const out = [];
    for (const k of Object.keys(p.PRECTOTCORR).sort()) {
      const row = { date: iso(k) };
      let ok = true;
      for (const [name, field] of Object.entries(PARAMS)) {
        const v = p[name]?.[k];
        if (missing(v)) { if (name !== 'T2M_MIN' && name !== 'RH2M') ok = false; } else row[field] = Number(v);
      }
      if (upstream) { const v = upRain?.[k]; if (missing(v)) ok = false; else row.rainUp = Number(v); }
      if (ok) out.push(row);
    }
    if (!out.length) throw new Error('POWER returned no complete days');
    const result = { days: out, upstream, through: out.at(-1).date, fetched: new Date().toISOString(), stale: false };
    remember(cacheKey, result);
    return result;
  } catch (e) {
    const old = recall(cacheKey);
    if (old?.days?.length) return { ...old, stale: true };
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Long-term mean rain for each month at a place, mm/day (12 numbers), or null. Kept on this device for good. */
export async function rainNormals({ lat, lon }) {
  const cacheKey = key('clim', lat, lon);
  const old = recall(cacheKey);
  if (Array.isArray(old) && old.length === 12) return old;
  try {
    const body = await getJson(`${CLIMATE}?${new URLSearchParams({ parameters: 'PRECTOTCORR', community: 'AG', latitude: lat, longitude: lon, format: 'JSON' })}`);
    const m = body?.properties?.parameter?.PRECTOTCORR;
    if (!m) return null;
    const out = MONTHS.map((k) => (missing(m[k]) ? 0 : Number(m[k])));
    remember(cacheKey, out);
    return out;
  } catch { return null; }
}

let calendar = null;
/** The 25-year haor flood calendar (data/haor-flood-calendar.json, built by data-pipeline/fetch_flood_calendar.py). */
export async function floodCalendar() {
  if (!calendar) calendar = fetch('data/haor-flood-calendar.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return calendar;
}
