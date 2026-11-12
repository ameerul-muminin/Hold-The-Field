// One crop slot in one year: water demand, rain, heat and (haor) flood, combined into a yield INDEX
// (0-1 against the crop's own potential, not tonnes). Simplified model; see docs/DATA.md.
import { expand, seasonSlice } from './climate.js';
import { et0Hargreaves, dayOfYear } from './et0.js';
import { autoplay } from '../sim/engine.js';
import { floodConfig } from '../sim/config.js';

/** Share of the season in the initial and middle stages when a crop has no sourced stage lengths. */
export const DEFAULT_STAGES = [0.2, 0.6, 0.2];
/** Root-zone water the soil can hold for the crop, mm, when the farmer has not said what the soil is. */
export const DEFAULT_HOLD_MM = 100;
const DAY_MS = 86400000;
const dn = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY_MS);

/**
 * FAO-56 crop coefficient on day d of a crop of `days` days.
 * @param {{kc:number[], stageShare:number[], days:number}} crop
 * @param {number} d zero-based day in the window
 * @returns {number}
 */
export function kcOn(crop, d) {
  const [kIni, kMid, kEnd] = crop.kc;
  const [sIni, sMid] = crop.stageShare ?? DEFAULT_STAGES;
  const f = d / crop.days;
  if (f < sIni) return kIni;
  if (f < sIni + sMid) return kMid;
  const late = 1 - sIni - sMid;
  const t = late > 0 ? Math.min(1, (f - sIni - sMid) / late) : 1;
  return kMid + (kEnd - kMid) * t;
}

/**
 * Run one slot against one year of weather.
 * @param {{crop:string, sow:string}} slot sow is 'MM-DD'
 * @param {object} crop an entry of crops.json
 * @param {object} clim columnar climate (raw or expanded)
 * @param {number} year year of the sowing date; the window may run into the next year
 * @param {{hold?:number, canIrrigate?:boolean, flood?:{cfg?:object, variety?:string}}} [opts]
 * `hold` is the root-zone store capacity in mm.
 * @returns {object|null} null when the window runs past (or starts before) the data
 */
export function runSlot(slot, crop, clim, year, opts = {}) {
  const c = expand(clim);
  const hold = opts.hold ?? DEFAULT_HOLD_MM;
  const canIrrigate = opts.canIrrigate ?? true;
  const sowIso = `${year}-${slot.sow}`;
  const i0 = dn(sowIso) - dn(c.start);
  const iEnd = i0 + crop.days - 1;
  if (i0 < 0 || iEnd >= c.n) return null;

  // Root-zone water store (mm). It starts at NASA's root-zone wetness (GWETROOT, 0-1) on the sowing day, fills
  // with rain up to its capacity (the rest runs off or drains) and is drawn down by the crop. Days when the
  // store cannot meet the crop's demand add to the gap. One layer, no percolation or capillary rise.
  let demandMm = 0, rainMm = 0, gapMm = 0, midDays = 0, hotDays = 0;
  const wet0 = c.soil && Number.isFinite(c.soil[i0]) ? c.soil[i0] : 0.5;
  let store = hold * Math.max(0, Math.min(1, wet0));
  const [sIni, sMid] = crop.stageShare ?? DEFAULT_STAGES;
  for (let d = 0; d < crop.days; d++) {
    const i = i0 + d;
    const et0 = et0Hargreaves(c.tmax[i], c.tmin[i], c.lat, dayOfYear(c.dateAt(i)));
    const etc = kcOn(crop, d) * et0;
    demandMm += etc;
    rainMm += c.rainFarm[i];
    store = Math.min(hold, store + c.rainFarm[i]);
    const eta = Math.min(etc, store);
    store -= eta;
    gapMm += etc - eta;
    const f = d / crop.days;
    if (f >= sIni && f < sIni + sMid) {
      midDays++;
      if (crop.heatC != null && c.tmax[i] > crop.heatC) hotDays++;
    }
  }

  const irrigated = !!crop.irrigated && canIrrigate;
  const usedDefaultKy = !irrigated && crop.ky == null;
  const ky = crop.ky ?? 1.0;
  let water = 1, waterMm = 0;
  if (irrigated) waterMm = gapMm;
  else water = demandMm > 0 ? Math.max(0, 1 - (ky * gapMm) / demandMm) : 1;

  const share = crop.heatC != null && midDays > 0 ? hotDays / midDays : 0;
  const heat = 1 - Math.min(0.5, share);

  let flood = 1;
  if (opts.flood) {
    const cfg = opts.flood.cfg ?? floodConfig();
    const variety = opts.flood.variety ?? (crop.days >= 105 ? 'long' : 'short');
    const sliceStart = c.dateAt(Math.max(0, i0 - 35));
    const lastNeeded = Math.min(c.n - 1, i0 + cfg.varieties[variety].fieldDays);
    const data = seasonSlice(c, sliceStart, c.dateAt(lastNeeded));
    const st = autoplay(data, cfg, 'rahim', variety, sowIso);
    flood = st.alive ? 1 : 0;
  }
  const lost = flood === 0;
  const yieldIndex = water * heat * flood;
  return {
    crop: slot.crop, year, sowIso, endIso: c.dateAt(iEnd),
    demandMm, rainMm, gapMm, waterMm, water, heat, flood, yieldIndex, lost, usedDefaultKy,
  };
}
