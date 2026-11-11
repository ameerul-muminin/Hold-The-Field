// Rotation Lab: pure helpers (no DOM). main.js draws; everything that can be tested without a browser lives here.
import { applyFarmer } from '../rotation/farmer.js';
import { perturb } from '../rotation/scenario.js';
import { replay } from '../rotation/replay.js';
import { rank } from '../rotation/rank.js';
import { evidenceCard } from '../rotation/evidence.js';
import { expand } from '../rotation/climate.js';

export const REGIONS = ['haor', 'barind', 'coast'];
export const REGION_NAMES = { haor: 'Sunamganj haor', barind: 'Barind Tract', coast: 'Satkhira coast' };

/** The four sliders: label on the slider, short phrase for sentences. */
export const PRIORITIES = [
  { key: 'safety', label: 'Fewer lost years', short: 'fewer lost years', default: 100 },
  { key: 'yield', label: 'More harvest', short: 'more harvest', default: 50 },
  { key: 'water', label: 'Less irrigation water', short: 'less irrigation water', default: 50 },
  { key: 'soil', label: 'Healthier soil', short: 'healthier soil', default: 50 },
];

/** Plain words for the empty fields of crops.json. */
export const GAP_WORDS = {
  ky: 'response to water shortage', heatC: 'heat limit', price: 'price', market: 'market',
  forage: 'fodder value', cover: 'erosion cover', organicMatter: 'organic matter',
};
/** Plain words for the sourced fields of crops.json. */
export const PARAM_WORDS = {
  days: 'days in the field', kc: 'water need', stageShare: 'growth stages', ky: 'response to water shortage',
  heatC: 'heat limit', rootDepth: 'root depth', irrigated: 'irrigation',
};
/** One sentence per reason a rotation ranks where it does. */
export const WHY_RANK = {
  safety: 'It ranks here mostly because it has fewer lost years.',
  yield: 'It ranks here mostly because it gives more harvest.',
  water: 'It ranks here mostly because it needs less irrigation water.',
  soil: 'It ranks here mostly because it is better for the soil.',
};
export const SOIL_CHOICES = [['clay', 'Clay'], ['loam', 'Loam'], ['sandy', 'Sandy'], ['', 'Not sure']];

/** Entries of a JSON object without the keys that start with an underscore. */
export function dataEntries(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.startsWith('_')));
}

/** 'lost' (any crop lost), 'poor' (< 0.5), 'fair' (< 0.8), else 'good'. */
export function yearClass(y) {
  if (y.slots.some((s) => s.lost)) return 'lost';
  if (y.yieldIndex < 0.5) return 'poor';
  if (y.yieldIndex < 0.8) return 'fair';
  return 'good';
}

export const lostYears = (result) => result.years.filter((y) => y.slots.some((s) => s.lost)).map((y) => y.year);

/** Headline for the region, computed from the existing rotation's replay. Text is an English template. */
export function headline(result, regionName) {
  const n = result.summary.n;
  const lost = lostYears(result);
  if (lost.length) return { text: 'In {} years of NASA data, {} lost its crop in {} years: {}', vals: [n, regionName, lost.length, lost.join(', ')] };
  const failed = result.summary.failedYears;
  if (failed > 0) return { text: 'In {} years of NASA data, {} had {} poor years', vals: [n, regionName, failed] };
  return { text: 'In {} years of NASA data, {} came through every year', vals: [n, regionName] };
}

/** '(https://x.org/a (note)' style source text -> the URL at the start and the rest. url is null when none. */
export function sourceParts(s) {
  const m = /^\s*(https?:\/\/[^\s)]+)\s*(.*)$/s.exec(String(s ?? ''));
  return m ? { url: m[1], rest: m[2].trim() } : { url: null, rest: String(s ?? '').trim() };
}

/** Group the 'No sourced value for {} of {}' gaps: one entry per parameter listing the crops. */
export function groupGaps(gaps) {
  const groups = new Map();
  const rest = [];
  for (const g of gaps) {
    if (g.text === 'No sourced value for {} of {}') {
      const [param, crop] = g.vals;
      if (!groups.has(param)) groups.set(param, []);
      if (!groups.get(param).includes(crop)) groups.get(param).push(crop);
    } else rest.push(g);
  }
  return { groups: [...groups].map(([param, crops]) => ({ param, crops })), rest };
}

/** Distinct sources for a rotation: its own and each crop's. Same text is listed once. */
export function collectSources(rotation, crops) {
  const out = new Map();
  const add = (str, crop, param) => {
    if (!str) return;
    if (!out.has(str)) out.set(str, { ...sourceParts(str), crops: [], params: [] });
    const e = out.get(str);
    if (crop && !e.crops.includes(crop)) e.crops.push(crop);
    if (param && !e.params.includes(param)) e.params.push(param);
  };
  add(rotation.source, null, null);
  const ids = [...new Set((rotation.slots || []).map((s) => s.crop))];
  for (const id of ids) {
    const c = crops[id];
    if (!c?.source) continue;
    for (const [param, str] of Object.entries(c.source)) add(str, c.name, param);
  }
  return [...out.values()];
}

/** Every crop id used by a region's rotations, in first-seen order. */
export const uniqueCrops = (rotations) => [...new Set(rotations.flatMap((r) => r.slots.map((s) => s.crop)))];

/**
 * Replay every rotation of a region for the farmer's answers and the what-if.
 * @returns {{opts:object, items:{id:string, rotation:object, result:object}[]}}
 */
export function computeAll({ region, rotations, crops, climate, answers = {}, whatIf = {} }) {
  const adj = applyFarmer(rotations, crops, answers);
  const rainPct = whatIf.rainPct || 0, tempC = whatIf.tempC || 0;
  const clim = rainPct || tempC ? perturb(climate, { rainPct, tempC }) : climate;
  const opts = { ...adj.opts, floodRegion: region === 'haor' };
  const items = adj.rotations.map((rotation) => ({ id: rotation.id, rotation, result: replay(rotation, crops, clim, opts) }));
  return { opts, items };
}

/** Rank rows for the sliders (0..100 each). */
export function rankItems(items, prio) {
  const p = {};
  for (const k of ['safety', 'yield', 'water', 'soil']) p[k] = Math.max(0, Math.min(100, Number(prio[k]) || 0)) / 100;
  return rank(items.map((i) => ({ id: i.id, summary: i.result.summary, conflict: i.rotation.conflict })), p);
}

/** The five evidence blocks of one rotation. topKey is the rank row's top (a PRIORITIES key) or null. */
export function evidenceFor(item, baselineItem, crops, climate, topKey) {
  const c = expand(climate);
  const top = PRIORITIES.find((p) => p.key === topKey)?.short;
  return evidenceCard(item.rotation, item.result, crops, item.rotation.existing ? null : baselineItem?.result ?? null, {
    firstYear: c.firstYear, lastYear: c.lastYear, top, datasets: ['NASA POWER rain and temperature'],
  });
}

/** Facts for the data line in the footer. */
export function dataFacts(climate) {
  const c = expand(climate);
  const p = climate.points?.farm || {};
  return { source: climate.source || 'NASA POWER', first: c.firstYear, last: c.lastYear, lat: p.lat ?? c.lat, lon: p.lon, fetched: climate.fetched || null };
}

/** Number with at most one decimal, no trailing .0. */
export const oneDecimal = (x) => String(Math.round(x * 10) / 10);
export const pct = (x) => Math.round(x * 100);
