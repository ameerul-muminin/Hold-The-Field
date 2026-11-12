// Replay a rotation against every year of a climate record.
import { expand } from './climate.js';
import { runSlot } from './season.js';
import { soilScore, bareDays } from './soil.js';

/**
 * Percentile of a sorted ascending array by linear interpolation.
 * @param {number[]} sorted ascending
 * @param {number} p 0..1
 * @returns {number|null} null for an empty array
 */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const sortedCopy = (a) => a.slice().sort((x, y) => x - y);

/**
 * @param {{slots: {crop:string, sow:string, flood?:boolean}[]}} rotation
 * @param {object} crops crops.json by id
 * @param {object} climate columnar climate
 * @param {{hold?:number, canIrrigate?:boolean, floodRegion?:boolean}} [opts]
 * @returns {{years: object[], summary: object}} years dropped when any slot runs past the data are excluded
 */
export function replay(rotation, crops, climate, opts = {}) {
  const c = expand(climate);
  const years = [];
  let usedDefaultKy = false;
  for (let year = c.firstYear; year <= c.lastYear; year++) {
    const slots = [];
    let ok = true;
    for (const slot of rotation.slots) {
      const o = { hold: opts.hold, canIrrigate: opts.canIrrigate };
      if (opts.floodRegion && slot.flood) o.flood = {};
      const r = runSlot(slot, crops[slot.crop], c, year, o);
      if (!r) { ok = false; break; }
      if (r.usedDefaultKy) usedDefaultKy = true;
      slots.push(r);
    }
    if (!ok || !slots.length) continue;
    const yieldIndex = slots.reduce((s, r) => s + r.yieldIndex, 0) / slots.length;
    years.push({
      year,
      slots: slots.map(({ crop, yieldIndex: y, gapMm, lost }) => ({ crop, yieldIndex: y, gapMm, lost })),
      yieldIndex,
      harvest: slots.reduce((s, r) => s + r.yieldIndex, 0),   // crop-seasons brought home this year
      waterMm: slots.reduce((s, r) => s + r.waterMm, 0),
      failed: slots.some((r) => r.lost) || yieldIndex < 0.5,
    });
  }
  const ys = sortedCopy(years.map((y) => y.yieldIndex));
  const hs = sortedCopy(years.map((y) => y.harvest));
  const ws = sortedCopy(years.map((y) => y.waterMm));
  const worstYears = years.slice().sort((a, b) => a.yieldIndex - b.yieldIndex || a.year - b.year).slice(0, 3).map((y) => y.year);
  return {
    years,
    summary: {
      n: years.length,
      median: percentile(ys, 0.5), p10: percentile(ys, 0.1), p90: percentile(ys, 0.9),
      harvestMedian: percentile(hs, 0.5), crops: rotation.slots.length,
      failedYears: years.filter((y) => y.failed).length,
      waterMedianMm: percentile(ws, 0.5),
      bareDays: bareDays(rotation, crops),
      soilScore: soilScore(rotation, crops),
      worstYears, usedDefaultKy,
    },
  };
}
