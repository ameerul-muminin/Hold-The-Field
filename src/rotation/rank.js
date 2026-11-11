// Rank rotations by the farmer's priorities. Metrics are min-max normalised across the compared rotations.

const KEYS = ['safety', 'yield', 'water', 'soil'];

const metrics = (s) => ({
  safety: s.n ? 1 - s.failedYears / s.n : 0,
  yield: s.median ?? 0,
  water: s.waterMedianMm ?? 0,
  soil: s.soilScore ?? 0,
});

/**
 * @param {{id:string, summary:object, conflict?:boolean}[]} results
 * @param {{safety:number, yield:number, water:number, soil:number}} priorities each 0..1
 * @returns {{id:string, score:number, parts:object, top:string, conflict:boolean}[]} best first; conflicts last;
 *   ties keep input order. parts are each metric's weighted share of the score.
 */
export function rank(results, priorities) {
  const m = results.map((r) => metrics(r.summary));
  const norm = {};
  for (const k of KEYS) {
    const vals = m.map((x) => x[k]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    norm[k] = vals.map((v) => {
      if (hi === lo) return 0.5;
      const t = (v - lo) / (hi - lo);
      return k === 'water' ? 1 - t : t; // less irrigation water is better
    });
  }
  const wsum = KEYS.reduce((s, k) => s + (priorities[k] || 0), 0);
  const rows = results.map((r, i) => {
    const parts = {};
    for (const k of KEYS) parts[k] = wsum > 0 ? ((priorities[k] || 0) * norm[k][i]) / wsum : 0;
    const score = KEYS.reduce((s, k) => s + parts[k], 0);
    let top = KEYS[0];
    for (const k of KEYS) if (parts[k] > parts[top]) top = k;
    return { id: r.id, score, parts, top, conflict: !!r.conflict, _i: i };
  });
  rows.sort((a, b) => (a.conflict - b.conflict) || (b.score - a.score) || (a._i - b._i));
  return rows.map(({ _i, ...rest }) => rest);
}
