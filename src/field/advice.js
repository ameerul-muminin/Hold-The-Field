// "My field today": turns the last weeks of NASA POWER data for one place into a few plain advice cards, and the
// 25-year flood calendar into odds for a harvest date. Pure functions, no DOM. The flood and dry-soil levels are the
// game scout's own thresholds (src/sim/config.js, read only), so the tool and the game say the same thing.
import { FLOOD, DROUGHT } from '../sim/config.js';

export const RANK = { ok: 0, watch: 1, act: 2 };
const HEAT_WATCH_C = 35;        // rice flowers lose grain above about 35 C
const COLD_WATCH_C = 15, COLD_ACT_C = 12;
const HEAVY_3DAY_MM = 100;
const DAMP_RH = 88, DAMP_TMIN = 20;

const tail = (days, k) => days.slice(Math.max(0, days.length - k));
const sum = (days, key) => days.reduce((s, d) => s + (d[key] ?? 0), 0);
const round = (v, k = 0) => Math.round(v * 10 ** k) / 10 ** k;

/**
 * days: oldest first, complete days only: { date, rain, tmax, tmin, rh, soil, rainUp? }.
 * opts.upstream: the place has hills upstream (rainUp is filled). opts.clim: 12 monthly normals of rain, mm/day.
 * Returns cards, worst first: { id, level: 'ok'|'watch'|'act', icon, title, value, line, normal? }.
 */
export function advise(days, { upstream = false, clim = null } = {}) {
  if (!days?.length) return [];
  const last = days.at(-1), d3 = tail(days, 3), d7 = tail(days, 7);
  const cards = [];

  if (upstream) {
    const up3 = sum(d3, 'rainUp');
    const level = up3 >= FLOOD.warningMm ? 'act' : up3 >= FLOOD.watchMm ? 'watch' : 'ok';
    cards.push({ id: 'hills', level, icon: 'rain', title: 'Rain in the hills', value: ['{} mm in 3 days', round(up3)],
      line: { ok: 'Calm. No flood signal from upstream.', watch: 'Heavy rain upstream. Check your bund.',
        act: 'Flood warning: water can reach the haor in about 2 days. Raise the bund, cut rice that is 80% ripe.' }[level] });
  }

  const rain7 = sum(d7, 'rain'), rain3 = sum(d3, 'rain');
  const month = Number(last.date.slice(5, 7)) - 1;
  const normal7 = clim ? clim[month] * 7 : null;
  let rainLevel = 'ok', rainLine = 'Close to normal for this time of year.';
  if (rain3 >= HEAVY_3DAY_MM) { rainLevel = 'act'; rainLine = 'Very heavy rain. Open the drains; protect seedbeds and vegetables.'; }
  else if (normal7 != null && normal7 >= 10 && rain7 < normal7 * 0.4) { rainLevel = 'watch'; rainLine = 'Much less rain than normal.'; }
  else if (normal7 != null && rain7 >= 50 && rain7 > normal7 * 2.5) { rainLevel = 'watch'; rainLine = 'Much more rain than normal. Keep the drains open.'; }
  else if (normal7 == null) rainLine = null;
  cards.push({ id: 'rain', level: rainLevel, icon: 'drop', title: 'Rain at your field', value: ['{} mm in 7 days', round(rain7)],
    line: rainLine, normal: normal7 != null ? round(normal7) : null });

  // the drought scout: rain of the last 7 days and today's root-zone wetness
  const soilLevel = rain7 < DROUGHT.dryWarnMm && last.soil < DROUGHT.soilWarn ? 'act'
    : rain7 < DROUGHT.dryWatchMm && last.soil < DROUGHT.soilWatch ? 'watch' : 'ok';
  cards.push({ id: 'soil', level: soilLevel, icon: 'soil', title: 'Soil water', value: ['{}% wet', Math.round(last.soil * 100)],
    line: { ok: 'The soil holds enough water.', watch: 'The soil is starting to dry. Plan your irrigation.',
      act: 'The soil is drying fast. Irrigate the rice; save water for flowering.' }[soilLevel] });

  const tmax = Math.max(...d3.map((d) => d.tmax));
  const heat = tmax >= DROUGHT.heatC ? 'act' : tmax >= HEAT_WATCH_C ? 'watch' : 'ok';
  cards.push({ id: 'heat', level: heat, icon: 'thermo', title: 'Heat', value: ['{} °C max', round(tmax)],
    line: { ok: 'No heat stress.', watch: 'Hot days. Flowering rice can lose grain above 35 °C.',
      act: 'Very hot. Keep 5 cm of water in flowering rice; work in the cool morning.' }[heat] });

  const tmin = Math.min(...d3.map((d) => d.tmin ?? 99));
  if (tmin <= COLD_WATCH_C) {
    cards.push({ id: 'cold', level: tmin <= COLD_ACT_C ? 'act' : 'watch', icon: 'thermo', title: 'Cold nights', value: ['{} °C min', round(tmin)],
      line: 'Cold can harm seedlings. Cover seedbeds with clear polythene at night.' });
  }

  const rh = sum(d3, 'rh') / d3.length, warmNights = sum(d3, 'tmin') / d3.length;
  if (rh >= DAMP_RH && warmNights >= DAMP_TMIN) {
    cards.push({ id: 'damp', level: 'watch', icon: 'rain', title: 'Damp and warm', value: ['{}% humid', Math.round(rh)],
      line: 'Leaf diseases spread in this weather. Walk the field and check the leaves.' });
  }

  return cards.sort((a, b) => RANK[b.level] - RANK[a.level]);
}

/** The worst level among the cards. */
export const overall = (cards) => cards.reduce((w, c) => (RANK[c.level] > RANK[w] ? c.level : w), 'ok');

/** ISO date plus n days. */
export function plusDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * For a harvest date, how often warning-level (and watch-level) rain reached the hills before it, year by year.
 * Only the month and day of the harvest matter. calendar: data/haor-flood-calendar.json.
 */
export function floodOdds(calendar, harvestIso) {
  const md = harvestIso.slice(5);
  const before = (iso) => iso && iso.slice(5) <= md;
  const years = calendar.years.map((y) => ({
    year: y.year,
    status: before(y.firstWarning) ? 'warning' : before(y.firstWatch) ? 'watch' : 'clear',
  }));
  const earliest = calendar.years.filter((y) => y.firstWarning).sort((a, b) => a.firstWarning.slice(5).localeCompare(b.firstWarning.slice(5)))[0];
  return {
    years,
    total: years.length,
    warned: years.filter((y) => y.status === 'warning').length,
    watched: years.filter((y) => y.status !== 'clear').length,
    earliest: earliest ? earliest.firstWarning : null,
  };
}
