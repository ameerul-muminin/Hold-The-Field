// Test helpers only: build synthetic columnar climates.

const DAY_MS = 86400000;

/**
 * @param {number} firstYear
 * @param {number} years
 * @param {(year:number, doy:number)=>number} rainFn mm/day
 * @param {(year:number, doy:number)=>number} [tmaxFn]
 * @returns {object} columnar climate like data/climate/<region>.json
 */
export function synth(firstYear, years, rainFn, tmaxFn = () => 32) {
  const t0 = Date.UTC(firstYear, 0, 1);
  const t1 = Date.UTC(firstYear + years, 0, 1);
  const n = Math.round((t1 - t0) / DAY_MS);
  const rain = [], tmax = [], tmin = [], soil = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(t0 + i * DAY_MS);
    const year = d.getUTCFullYear();
    const doy = Math.round((d - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
    rain.push(rainFn(year, doy));
    const tx = tmaxFn(year, doy);
    tmax.push(tx);
    tmin.push(tx - 9);
    soil.push(0.6);
  }
  return {
    id: 'test', region: 'test', sample: true, start: `${firstYear}-01-01`, n,
    points: { farm: { lat: 24.6, lon: 88.5 }, upstream: { lat: 24.6, lon: 88.5 } },
    rainFarm: rain, rainUp: rain.slice(), tmax, tmin, soil, soilTop: soil.slice(), rad: rain.map(() => 18),
  };
}

export const RICE = {
  name: 'Boro rice', family: 'cereal', days: 115, kc: [1.05, 1.2, 0.9], stageShare: [0.2, 0.45, 0.35],
  ky: 1.1, heatC: 35, legume: false, residue: 'high', rootDepth: 'medium', irrigated: true,
  price: 1, market: 'x', forage: 'some', cover: 'low', organicMatter: 'medium',
};
export const MUNG = {
  name: 'Mung bean', family: 'legume', days: 70, kc: [0.4, 1.05, 0.6], stageShare: [0.25, 0.5, 0.25],
  ky: 1.15, heatC: 38, legume: true, residue: 'medium', rootDepth: 'deep', irrigated: false,
  price: null, market: null, forage: 'some', cover: 'high', organicMatter: 'high',
};
export const MUSTARD = { ...MUNG, name: 'Mustard', family: 'brassica', days: 100, legume: false, ky: null, rootDepth: 'deep' };
export const CROPS = { rice: RICE, mung: MUNG, mustard: MUSTARD };
