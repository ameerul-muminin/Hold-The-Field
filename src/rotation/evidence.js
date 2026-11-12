// The five blocks the challenge asks for. Every line is {text, vals}: text is an ENGLISH TEMPLATE with {}
// placeholders, vals the values. The UI translates the template, so numbers never live inside text.

export const CROP_GAP_FIELDS = ['ky', 'heatC', 'irrigated', 'stageShare', 'residue', 'price', 'market', 'forage', 'cover', 'organicMatter'];

export const FIXED_GAPS = [
  { text: 'No market prices in the model', vals: [] },
  { text: 'No salinity data', vals: [] },
  { text: 'No pest or disease model', vals: [] },
  { text: 'No storm or waterlogging model', vals: [] },
  { text: 'Water lost by seepage and land preparation is not counted', vals: [] },
  { text: 'How much water the soil holds is our guess, not a measurement', vals: [] },
  { text: 'One NASA POWER grid cell is about {} km wide; your field can differ', vals: [50] },
];

export const DEFAULT_KY_GAP = { text: 'Rain-shortage losses use a default response for some crops', vals: [] };

export const LOCAL_REVIEW = [
  { text: 'Seed availability', vals: [] },
  { text: 'Irrigation access', vals: [] },
  { text: 'Market', vals: [] },
  { text: 'Labour and machines', vals: [] },
  { text: 'Talk to your extension officer', vals: [] },
];

const line = (text, ...vals) => ({ text, vals });

/**
 * @param {{id?:string, existing?:boolean, slots:{crop:string}[]}} rotation
 * @param {{summary:object}} result output of replay()
 * @param {object} crops crops.json by id
 * @param {{summary:object}|null} baseline replay result of the existing rotation; null for the existing one itself
 * @param {{firstYear:number, lastYear:number, top?:string, datasets:string[]}} meta
 * @returns {{why:object[], evidence:object[], benefits:object[], gaps:object[], localReview:object[]}}
 */
export function evidenceCard(rotation, result, crops, baseline, meta) {
  const s = result.summary;
  const why = meta.top ? [line('Serves your {} priority best', meta.top)] : [];

  const evidence = [
    line('Came through {} of {} years ({} to {})', s.n - s.failedYears, s.n, meta.firstYear, meta.lastYear),
    line('Data: {}', meta.datasets.join(', ')),
  ];
  // Only years that actually failed: the three lowest years of a way that never failed are still good years.
  const bad = result.years ? result.years.filter((y) => y.failed).map((y) => y.year) : (s.failedYears > 0 ? s.worstYears ?? [] : []);
  if (bad.length) evidence.push(line('Worst years: {}', bad.join(', ')));

  const benefits = [];
  if (baseline && !rotation.existing) {
    const b = baseline.summary;
    const water = b.waterMedianMm - s.waterMedianMm;
    if (water > 0.5) benefits.push(line('Uses about {} mm less irrigation water a year', Math.round(water)));
    const soil = s.soilScore - b.soilScore;
    if (soil > 0.5) benefits.push(line('Soil health indicator up {} points ({} to {})', Math.round(soil), Math.round(b.soilScore), Math.round(s.soilScore)));
    const bare = b.bareDays - s.bareDays;
    if (bare > 0) benefits.push(line('{} fewer bare-field days a year', bare));
    const failed = b.failedYears - s.failedYears;
    if (failed > 0) benefits.push(line('{} fewer failed years out of {}', failed, s.n));
    if (!benefits.length) benefits.push(line('No advantage over what you grow now in this model'));
  }

  const gaps = [];
  for (const id of [...new Set(rotation.slots.map((x) => x.crop))]) {
    const crop = crops[id];
    const name = crop?.name ?? id;
    for (const f of CROP_GAP_FIELDS) if (!crop || crop[f] == null) gaps.push(line('No sourced value for {} of {}', f, name));
  }
  gaps.push(...FIXED_GAPS.map((g) => ({ ...g, vals: [...g.vals] })));
  if (s.usedDefaultKy) gaps.push({ ...DEFAULT_KY_GAP, vals: [] });

  return { why, evidence, benefits, gaps, localReview: LOCAL_REVIEW.map((l) => ({ ...l, vals: [] })) };
}
