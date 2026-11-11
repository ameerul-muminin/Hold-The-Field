// Rotation Lab: pure helpers (no DOM). main.js draws; everything that can be tested without a browser lives here.
import { applyFarmer } from '../rotation/farmer.js';
import { perturb } from '../rotation/scenario.js';
import { replay } from '../rotation/replay.js';
import { rank } from '../rotation/rank.js';
import { evidenceCard } from '../rotation/evidence.js';
import { expand } from '../rotation/climate.js';

export const REGIONS = ['haor', 'barind', 'coast'];
export const REGION_NAMES = { haor: 'Sunamganj haor', barind: 'Barind Tract', coast: 'Satkhira coast' };

/** "What do you fear most?" One choice; it gets weight 100, the other three keep 50 (the old default).
 *  label is the chip, short what a way does well on that count (used in "Where it does best: {}."). */
export const PRIORITIES = [
  { key: 'safety', label: 'Losing the crop', short: 'fewer lost years', default: 100 },
  { key: 'yield', label: 'A small harvest', short: 'more harvest', default: 50 },
  { key: 'water', label: 'Pumping water', short: 'less pumped water', default: 50 },
  { key: 'soil', label: 'Tired soil', short: 'more back to the soil', default: 50 },
];
export const FEAR_WEIGHT = 100, OTHER_WEIGHT = 50;
/** Slider weights for one fear. */
export const prioFor = (fear) => Object.fromEntries(PRIORITIES.map((p) => [p.key, p.key === fear ? FEAR_WEIGHT : OTHER_WEIGHT]));

/** Plain words for the empty fields of crops.json. */
export const GAP_WORDS = {
  ky: 'how it takes a dry spell', heatC: 'how much heat it takes', price: 'the price', market: 'who buys it',
  forage: 'its value as cattle feed', cover: 'how well it holds the soil', organicMatter: 'what it gives back to the soil',
};
/** Plain words for the sourced fields of crops.json. */
export const PARAM_WORDS = {
  days: 'days in the field', kc: 'water it needs', stageShare: 'how it grows', ky: 'how it takes a dry spell',
  heatC: 'how much heat it takes', rootDepth: 'root depth', irrigated: 'pumped water',
};
/** Why the first card is first. safety has a flood-region version. */
export const WHY_RANK = {
  safety: 'Safest in the bad years.',
  safetyFlood: 'Safest in the flood years.',
  yield: 'Brings home the most harvest.',
  water: 'Needs the least pumped water.',
  soil: 'Gives the most back to the soil.',
};
/** For a card below first place: what holds it back. */
export const WHY_LOW = {
  safety: 'Failed in more years.',
  yield: 'Brings home less harvest.',
  water: 'Needs more pumped water.',
  soil: 'Gives less back to the soil.',
};
export const SOIL_CHOICES = [['clay', 'Clay'], ['loam', 'Loam'], ['sandy', 'Sandy'], ['', 'Not sure']];

/** Short crop names for sentences and the satellite panel; the full name stays in crops.json. */
export const CROP_SHORT = {
  boro_long: 'Boro rice', boro_short: 'Short boro rice', t_aman: 'Aman rice',
  mustard: 'Mustard', lentil: 'Lentil', sunflower: 'Sunflower',
};
/** One word for a crop inside a sentence ("the rice came home"). */
const CROP_WORD = { boro_long: 'rice', boro_short: 'rice', t_aman: 'rice', mustard: 'mustard', lentil: 'lentil', sunflower: 'sunflower' };

/** 'rice' when every crop of the rotation is rice, else 'crop'. */
export function cropWord(rotation) {
  const words = [...new Set((rotation?.slots || []).map((s) => CROP_WORD[s.crop] ?? 'crop'))];
  return words.length === 1 ? words[0] : 'crop';
}

/** Engine sentences (src/rotation/evidence.js templates) in the Lab's plain voice. Same {} order. */
export const PLAIN = {
  'Serves your {} priority best': 'Where it does best: {}.',
  'Came through {} of {} years ({} to {})': '{} of {} years, the crop came home ({} to {}).',
  'Data: {}': 'Weather: {}.',
  'Worst years: {}': 'Hardest years: {}.',
  'Uses about {} mm less irrigation water a year': 'About {} mm less water to pump each year.',
  'Soil health indicator up {} points ({} to {})': 'Gives more back to the soil: {} points more ({} to {}, our estimate).',
  '{} fewer bare-field days a year': 'The field lies empty {} fewer days a year.',
  '{} fewer failed years out of {}': '{} fewer bad years, out of {}.',
  'No advantage over what you grow now in this model': 'In these years, it did no better than what you grow now.',
  'No market prices in the model': 'We do not know your market price. Ask before you plant.',
  'No salinity data': 'We have no salt readings for your field.',
  'No pest or disease model': 'We do not count pests or disease.',
  'One NASA POWER grid cell is about {} km wide; your field can differ': 'The weather is for a square about {} km wide. Your field can differ.',
  'Rain-shortage losses use a default response for some crops': 'For some crops, we used a standard guess for dry spells.',
  'Seed availability': 'Can you get the seed?',
  'Irrigation access': 'Can you get pump water on time?',
  'Market': 'Will someone buy it, and at what price?',
  'Labour and machines': 'Are there hands and machines when you need them?',
  'Talk to your extension officer': 'Talk to your extension officer.',
  // data notes from rotations.json
  'Deepwater (broadcast) Aman rice is not modelled': 'We cannot check the deepwater Aman part yet.',
  'Sowing date is an assumption: it depends on when the haor water leaves the field.': 'We guessed the sowing date. It depends on when the water leaves your field.',
  'Mustard and late boro dates are assumptions fitted between the Aman harvest and the next Aman.': 'We guessed the mustard and late boro dates, to fit between two Aman crops.',
};
/** {text, vals} from the engine -> same line in plain words. Unknown lines pass through. */
export const plain = (l) => (PLAIN[l.text] ? { text: PLAIN[l.text], vals: l.vals } : l);

/** 'little' / 'some' / 'a lot' for the 0..100 soil estimate. */
export function soilWord(score) {
  if (score >= 50) return 'a lot';
  if (score >= 30) return 'some';
  return 'little';
}

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

export const failedYearList = (result) => result.years.filter((y) => y.failed ?? ['lost', 'poor'].includes(yearClass(y))).map((y) => y.year);

/**
 * Step 2: what the satellite record says about what the farmer grows now. All numbers come from the replay.
 * @param {object} result replay of the existing rotation
 * @param {{word:string, saferName?:string|null, saferFailed?:number}} o word: 'rice' / 'crop'; saferName: label of a
 *   way that failed in fewer years, if any
 * @returns {{kind:'lost'|'thin'|'fine', sat:object[], say:object[], safer:boolean}} lines are {text, vals}
 */
export function finding(result, { word = 'crop', saferName = null, saferFailed = 0 } = {}) {
  const s = result.summary, n = s.n;
  const lost = lostYears(result);
  const L = (text, ...vals) => ({ text, vals });
  const sat = [], say = [];
  let kind;
  if (lost.length) {
    kind = 'lost';
    sat.push(L('Lost to flood: {} of {} years', lost.length, n), L(lost.join('  ')));
    say.push(L('In {} years, the flood took this {} {} times: {}.', n, word, lost.length, lost.join(', ')));
  } else if (s.failedYears > 0) {
    kind = 'thin';
    const thin = failedYearList(result);
    sat.push(L('Thin years: {} of {}', s.failedYears, n), L(thin.join('  ')));
    say.push(L('In {} years, the {} was thin {} times: {}.', n, word, s.failedYears, thin.join(', ')));
  } else {
    kind = 'fine';
    sat.push(L('Crop came home: {} of {} years', n, n), L('Field empty: {} days a year', s.bareDays));
    say.push(L('In {} years, your {} came home every year.', n, word));
    say.push(L('But your field lies empty {} days a year.', s.bareDays));
    if (s.waterMedianMm >= 1) say.push(L('You pump about {} mm of water a year for it.', Math.round(s.waterMedianMm)));
  }
  const safer = !!saferName;
  if (safer) {
    say.push(saferFailed > 0
      ? L('{} would have failed in {} of these years.', saferName, saferFailed)
      : L('{} would have come home every year.', saferName));
  }
  return { kind, sat, say, safer };
}

/** The way that failed in the fewest years, if it beats the existing one (no conflicts). */
export function saferWay(items) {
  const ex = items.find((i) => i.rotation.existing);
  if (!ex) return null;
  let best = null;
  for (const i of items) {
    if (i === ex || i.rotation.conflict) continue;
    if (i.result.summary.failedYears < ex.result.summary.failedYears && (!best || i.result.summary.failedYears < best.result.summary.failedYears)) best = i;
  }
  return best;
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
  const top = PRIORITIES.find((p) => p.key === topKey)?.short ?? null;
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
