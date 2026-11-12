// Rotation Lab, small phones (N5): the default answer for each region, computed once by scripts/build-lab.mjs and
// read by the page instead of the 300 KB climate file. Pure, no DOM. The page loads the climate file only when the
// farmer changes something the precomputed answer cannot cover (soil, pumping, what-if).
import { applyFarmer } from '../rotation/farmer.js';
import { computeAll, cropCalendar, evidenceFor, dataFacts } from './view.js';

export const PRE_VERSION = 1;
/** The answers the Lab starts with. Anything else needs the climate file. */
export const PRE_ANSWERS = { canIrrigate: true };

/** True when the precomputed answer no longer fits: a soil, no pumping, or a what-if. */
export const needsClimate = ({ soil = '', canIrrigate = true, rainPct = 0, tempC = 0 } = {}) =>
  !!soil || canIrrigate === false || !!rainPct || !!tempC;

/** Round every number to 4 decimals (the page shows whole percents and mm; the year classes cut at 0.5 and 0.8). */
export function round4(x) {
  if (typeof x === 'number') return Math.round(x * 1e4) / 1e4;
  if (Array.isArray(x)) return x.map(round4);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round4(v)]));
  return x;
}

/**
 * Everything the Lab draws by default for one region.
 * @returns {object} JSON-ready: { v, region, sample, facts, items:[{id, result, calendar, evidence}] }
 *   evidence is the card without its "why" line (that depends on the farmer's fear and is added by the page).
 */
export function precompute({ region, rotations, crops, climate }) {
  const out = computeAll({ region, rotations, crops, climate, answers: PRE_ANSWERS });
  const base = out.items.find((i) => i.rotation.existing) || null;
  return {
    v: PRE_VERSION, region, sample: climate.sample === true, facts: dataFacts(climate),
    items: out.items.map((i) => ({
      id: i.id,
      result: round4(i.result),
      calendar: cropCalendar(i, crops, out.clim, { flood: region === 'haor' }),
      evidence: evidenceFor(i, base, crops, climate, null),
    })),
  };
}

/**
 * The page's items from a precomputed region, for the farmer's can't-sell / no-machine answers (those only flag a
 * way; they do not change the replay). Returns null when the file does not match the rotations (stale file).
 */
export function itemsFromPre(pre, rotations, crops, answers = {}) {
  if (!pre || pre.v !== PRE_VERSION || !Array.isArray(pre.items)) return null;
  const byId = new Map(pre.items.map((p) => [p.id, p]));
  const adj = applyFarmer(rotations, crops, { ...PRE_ANSWERS, ...answers });
  if (adj.rotations.length !== byId.size || adj.rotations.some((r) => !byId.has(r.id))) return null;
  return adj.rotations.map((rotation) => {
    const p = byId.get(rotation.id);
    return { id: rotation.id, rotation, result: p.result, calendar: p.calendar, evidence: p.evidence };
  });
}
