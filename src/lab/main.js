// Rotation Lab page. Draws the screen and wires the controls; the numbers come from src/rotation/ through view.js.
import { loadLanguages, setLanguage, onLanguage, language, t, f, num, date } from '../i18n.js';
import { BRAND } from '../brand.js';
import {
  REGIONS, REGION_NAMES, PRIORITIES, GAP_WORDS, PARAM_WORDS, WHY_RANK, SOIL_CHOICES,
  dataEntries, yearClass, headline, groupGaps, collectSources, uniqueCrops, computeAll, rankItems,
  evidenceFor, dataFacts, oneDecimal, pct,
} from './view.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (s) => esc(num(t(s)));
const F = (tpl, ...v) => esc(f(tpl, ...v));
const signed = (v) => (v > 0 ? `+${v}` : String(v));

const state = {
  region: 'haor', soil: '', canIrrigate: true, cannotSell: [], noMachine: [],
  rainPct: 0, tempC: 0,
  prio: Object.fromEntries(PRIORITIES.map((p) => [p.key, p.default])),
  open: {}, picked: {}, status: 'loading',
};
const results = { items: [], rows: [], opts: null };
window.__lab = { state, results };

let crops = {}, rotationsByRegion = {};
const climates = new Map();      // region -> climate | null (missing)
let token = 0;

// ---------------------------------------------------------------- helpers
/** Replace innerHTML but keep keyboard focus on the same control (matched by data-fid). */
function setHTML(el, html) {
  const a = document.activeElement;
  const fid = a && el.contains(a) ? a.dataset.fid : null;
  el.innerHTML = html;
  if (fid) [...el.querySelectorAll('[data-fid]')].find((n) => n.dataset.fid === fid)?.focus();
}
const cropName = (id) => t(crops[id]?.name ?? id);
const climate = () => climates.get(state.region) || null;
const regionRotations = () => rotationsByRegion[state.region] || [];

/** A {text, vals} line from the engine -> translated text. String values are translated, numbers are not. */
function lineText(l) {
  const vals = l.vals.map((v) => (typeof v === 'string' && !/^[\d\s.,-]+$/.test(v) ? t(v) : v));
  return F(l.text, ...vals);
}

// ---------------------------------------------------------------- sections
function renderHeader() {
  const bn = language() === 'bn';
  setHTML($('top'), `
    <div class="brand"><b>${esc(BRAND.name)}</b><h1>${T('Rotation Lab')}</h1></div>
    <div class="top-actions">
      <div class="seg" role="group" aria-label="${esc(t('Language'))}">
        <button type="button" data-act="lang" data-v="en" data-fid="lang-en" aria-pressed="${!bn}" lang="en">EN</button>
        <button type="button" data-act="lang" data-v="bn" data-fid="lang-bn" aria-pressed="${bn}" lang="bn">বাংলা</button>
      </div>
      <a class="btn" href="./">${T('Back to the game')}</a>
    </div>`);
  document.title = `${BRAND.name} · ${t('Rotation Lab')}`;
}

function renderRegion() {
  setHTML($('sec-region'), `
    <div class="card">
      <h2 class="h2" id="h-region">${T('Where is your field?')}</h2>
      <div class="regions">${REGIONS.map((r) => `
        <button type="button" class="region" data-act="region" data-v="${r}" data-region="${r}" data-fid="region-${r}" aria-pressed="${state.region === r}">${T(REGION_NAMES[r])}</button>`).join('')}
      </div>
    </div>`);
}

function renderField() {
  const ids = uniqueCrops(regionRotations());
  const pressed = (list, id) => list.includes(id);
  setHTML($('sec-field'), `
    <div class="card">
      <h2 class="h2" id="h-field">${T('Your field')}</h2>
      <p class="q">${T('What is your soil?')}</p>
      <div class="choices" role="group" aria-label="${esc(t('What is your soil?'))}">${SOIL_CHOICES.map(([v, label]) => `
        <button type="button" class="chip" data-act="soil" data-v="${v}" data-fid="soil-${v || 'none'}" aria-pressed="${state.soil === v}">${T(label)}</button>`).join('')}
      </div>
      <p class="tiny faint" style="margin-top:6px">${T('Your soil, as you told us')}</p>
      <p class="q">${T('Can you irrigate in the dry season?')}</p>
      <div class="choices" role="group" aria-label="${esc(t('Can you irrigate in the dry season?'))}">
        <button type="button" class="chip" data-act="irrigate" data-v="1" data-fid="irr-yes" aria-pressed="${state.canIrrigate}">${T('Yes')}</button>
        <button type="button" class="chip" data-act="irrigate" data-v="0" data-fid="irr-no" aria-pressed="${!state.canIrrigate}">${T('No')}</button>
      </div>
      <button type="button" class="disc" data-act="toggle" data-k="limits" data-fid="disc-limits" aria-expanded="${!!state.open.limits}" aria-controls="pn-limits">${T('My limits')}</button>
      <div class="disc-body" id="pn-limits" ${state.open.limits ? '' : 'hidden'}>
        <p class="small muted">${T('Tick what does not work for you. A rotation that needs it stays on the list, marked, and ranks last.')}</p>
        ${ids.map((id) => `
        <div class="limit-row"><b>${esc(cropName(id))}</b>
          <div class="choices">
            <button type="button" class="chip stop" data-act="limit" data-kind="cannotSell" data-crop="${esc(id)}" data-fid="ls-${esc(id)}" aria-pressed="${pressed(state.cannotSell, id)}">${T('Cannot sell')}</button>
            <button type="button" class="chip stop" data-act="limit" data-kind="noMachine" data-crop="${esc(id)}" data-fid="lm-${esc(id)}" aria-pressed="${pressed(state.noMachine, id)}">${T('No machine')}</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`);
}

function whatIfReadouts() {
  return {
    rain: F('Rain: {}%', signed(state.rainPct)),
    heat: F('Heat: {} °C', signed(state.tempC)),
  };
}
function renderWhatIf() {
  const r = whatIfReadouts();
  setHTML($('sec-whatif'), `
    <div class="card">
      <button type="button" class="disc" style="margin-top:0" data-act="toggle" data-k="whatif" data-fid="disc-whatif" aria-expanded="${!!state.open.whatif}" aria-controls="pn-whatif">${T('What if? Not a forecast')}</button>
      <div class="disc-body" id="pn-whatif" ${state.open.whatif ? '' : 'hidden'}>
        <p class="small muted">${T('This changes the past NASA weather to test your options. It does not say what will happen.')}</p>
        <div class="slider"><label for="in-rain">${T('Rain change')}</label><output id="out-rain" for="in-rain">${r.rain}</output>
          <input type="range" id="in-rain" data-act="whatif" data-key="rainPct" min="-40" max="20" step="10" value="${state.rainPct}" /></div>
        <div class="slider"><label for="in-heat">${T('Hotter')}</label><output id="out-heat" for="in-heat">${r.heat}</output>
          <input type="range" id="in-heat" data-act="whatif" data-key="tempC" min="0" max="3" step="0.5" value="${state.tempC}" /></div>
      </div>
    </div>`);
}

function renderPrio() {
  setHTML($('sec-prio'), `
    <div class="card">
      <h2 class="h2" id="h-prio">${T('What matters most to you?')}</h2>
      <p class="small muted">${T('Move the sliders. The cards below re-order.')}</p>
      ${PRIORITIES.map((p) => `
      <div class="slider"><label for="pr-${p.key}">${T(p.label)}</label><output id="po-${p.key}" for="pr-${p.key}">${esc(num(state.prio[p.key]))}</output>
        <input type="range" id="pr-${p.key}" data-act="prio" data-key="${p.key}" min="0" max="100" step="5" value="${state.prio[p.key]}" /></div>`).join('')}
    </div>`);
}

function renderStatus() {
  const el = $('status');
  if (state.status === 'loading') el.innerHTML = `<p class="status">${T('Loading NASA data…')}</p>`;
  else if (state.status === 'missing') el.innerHTML = `<p class="status warn">${T('NASA data for this region has not been downloaded yet')}</p>`;
  else if (state.status === 'error') el.innerHTML = `<p class="status warn">${T('Something went wrong. Please reload the page.')}</p>`;
  else el.innerHTML = '';
}

function renderHeadline() {
  const el = $('sec-head');
  const ex = results.items.find((i) => i.rotation.existing);
  if (state.status !== 'ready' || !ex) { el.innerHTML = ''; return; }
  const h = headline(ex.result, `“${t(ex.rotation.label)}”`);
  el.innerHTML = `<div class="card headline"><p>${F(h.text, ...h.vals)}</p>
    <p class="tiny muted">${T('This is the pattern farmers use now, replayed on past NASA weather.')}</p></div>`;
}

function detailHTML(item, year) {
  const y = item.result.years.find((r) => r.year === year);
  if (!y) return '';
  return `<h4>${F('Year {}', year)}</h4><ul>${y.slots.map((s) => {
    const name = cropName(s.crop);
    if (s.lost) return `<li>${F('{}: lost to flood', name)}</li>`;
    return `<li>${F('{}: {}% of its well-watered potential', name, pct(s.yieldIndex))} · ${F('Water shortage {} mm', Math.round(s.gapMm))}</li>`;
  }).join('')}</ul>`;
}

// For a card below first place, say what holds it back: the priority where it gives up the most score.
const WHY_LOW = {
  safety: 'It ranks lower mostly because it loses the crop in more years.',
  yield: 'It ranks lower mostly because it brings in less harvest.',
  water: 'It ranks lower mostly because it needs more irrigation water.',
  soil: 'It ranks lower mostly because it does less for the soil.',
};
function weakest(row, prio) {
  const keys = Object.keys(WHY_LOW).filter((k) => !(row.flat || []).includes(k));
  if (!keys.length) return 'safety';
  const sum = keys.reduce((s, k) => s + (prio[k] || 0), 0) || 1;
  let worst = keys[0], gap = -1;
  for (const k of keys) {
    const g = (prio[k] || 0) / sum - (row.parts?.[k] ?? 0);
    if (g > gap) { gap = g; worst = k; }
  }
  return worst;
}

const YEAR_LABEL = { lost: 'Lost crop', poor: 'Poor year', fair: 'Fair year', good: 'Good year' };

function evidenceHTML(item, baseline, row) {
  const ev = evidenceFor(item, baseline, crops, climate(), row?.conflict ? null : row?.top);
  const block = (title, lines) => (lines.length ? `<div><h4>${T(title)}</h4><ul>${lines.join('')}</ul></div>` : '');
  const why = ev.why.map((l) => `<li>${lineText(l)}</li>`);
  const evid = ev.evidence.map((l) => `<li>${lineText(l)}</li>`);
  let ben = ev.benefits.map((l) => `<li>${lineText(l)}</li>`);
  if (!ben.length && item.rotation.existing) ben = [`<li>${T('This is what farmers do now. The other options are compared with it.')}</li>`];
  const g = groupGaps(ev.gaps);
  const gaps = [
    ...g.groups.map((x) => `<li>${F('No sourced value for {} of {}', t(GAP_WORDS[x.param] ?? x.param), x.crops.map((c) => t(c)).join(', '))}</li>`),
    ...uniqueCrops([item.rotation]).filter((id) => crops[id]?.kyProxy).map((id) => `<li>${esc(cropName(id))}: ${T(crops[id].kyProxy)}</li>`),
    ...g.rest.map((l) => `<li>${lineText(l)}</li>`),
  ];
  const local = ev.localReview.map((l) => `<li>${lineText(l)}</li>`);
  const sources = collectSources(item.rotation, crops).map((s) => {
    const label = s.crops.length ? `${s.crops.map((c) => t(c)).join(', ')} · ${s.params.map((p) => t(PARAM_WORDS[p] ?? p)).join(', ')}` : t('Cropping pattern');
    const link = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : '';
    return `<li><span class="src-for">${esc(label)}</span>${link}${s.rest ? ` <span class="tiny faint">${esc(s.rest)}</span>` : ''}</li>`;
  });
  return `<div class="ev-body">
    ${block('Why it is suggested', why)}${block('Evidence', evid)}${block('What it may offer', ben)}
    ${block('What we do not know', gaps)}${block('Ask locally first', local)}
    <div class="src"><h4>${T('Sources')}</h4><ul>${sources.join('')}</ul></div>
  </div>`;
}

function cardHTML(row, idx, baseline) {
  const item = results.items.find((i) => i.id === row.id);
  const { rotation, result } = item;
  const s = result.summary;
  const picked = state.picked[row.id];
  const open = !!state.open['ev:' + row.id];
  const years = result.years;
  const why = rotation.conflict
    ? `<p class="why">${T('It ranks last because it conflicts with what you told us.')}</p>`
    : (row.top && Object.values(state.prio).some((v) => v > 0) ? `<p class="why">${T(idx === 0 ? WHY_RANK[row.top] : WHY_LOW[weakest(row, state.prio)])}</p>` : '');
  const notes = [...(rotation.notModelled || []), ...(rotation.sowNote ? [rotation.sowNote] : [])];
  return `<li class="card rot${rotation.existing ? ' existing' : ''}${rotation.conflict ? ' conflict' : ''}" data-rot="${esc(row.id)}">
    <div class="rot-head">
      <span class="rank" role="img" aria-label="${F('Rank {}', idx + 1)}">${esc(num(idx + 1))}</span>
      <div><h3>${T(rotation.label)}</h3>${rotation.existing ? `<span class="badge">${T('What farmers do now')}</span>` : ''}</div>
    </div>
    ${rotation.share ? `<p class="share">${T(rotation.share)}</p>` : ''}
    <div>
      <div class="strip" role="group" aria-label="${esc(t('Year by year results'))}">${years.map((y) => {
        const c = yearClass(y);
        return `<button type="button" class="yr yr-${c}" data-act="year" data-rot="${esc(row.id)}" data-year="${y.year}" data-fid="yr-${esc(row.id)}-${y.year}" aria-pressed="${picked === y.year}" aria-label="${esc(num(y.year) + ': ' + t(YEAR_LABEL[c]))}"><span></span></button>`;
      }).join('')}</div>
      <div class="strip-ends" aria-hidden="true"><span>${esc(num(years[0]?.year ?? ''))}</span><span>${esc(num(years[years.length - 1]?.year ?? ''))}</span></div>
    </div>
    <div class="legend" aria-hidden="true">${['good', 'fair', 'poor', 'lost'].map((c) => `<span><i style="background:var(--${c === 'good' ? 'good' : c === 'fair' ? 'fair' : c === 'poor' ? 'poor' : 'bad'})"></i>${T(YEAR_LABEL[c])}</span>`).join('')}</div>
    <div class="yr-detail" id="yd-${esc(row.id)}" aria-live="polite" ${picked ? '' : 'hidden'}>${picked ? detailHTML(item, picked) : ''}</div>
    <p class="came">${F('Came through {} of {} years', s.n - s.failedYears, s.n)}</p>
    <dl class="tiles">
      <div class="tile"><dt>${T('Harvest')}</dt><dd>${F('{} of {} crops a year', oneDecimal(s.harvestMedian), s.crops)}</dd></div>
      <div class="tile"><dt>${T('Irrigation water')}</dt><dd>${F('{} mm a year', Math.round(s.waterMedianMm))}</dd></div>
      <div class="tile"><dt>${T('Soil health')}</dt><dd>${F('{} / 100', Math.round(s.soilScore))}<span class="tiny">${T('indicator, not a measurement')}</span></dd></div>
      <div class="tile"><dt>${T('Bare field')}</dt><dd>${F('{} days a year', s.bareDays)}</dd></div>
    </dl>
    ${why}
    ${rotation.conflict ? `<p class="conflict-note">${F('Conflicts with what you told us: {}', rotation.conflictCrops.map(cropName).join(', '))}</p>` : ''}
    ${notes.length ? `<div class="notes">${notes.map((n) => `<p>${T(n)}</p>`).join('')}</div>` : ''}
    <button type="button" class="disc" style="margin-top:0" data-act="toggle" data-k="ev:${esc(row.id)}" data-fid="ev-${esc(row.id)}" aria-expanded="${open}" aria-controls="ev-${esc(row.id)}">${T('Evidence')}</button>
    <div id="ev-${esc(row.id)}" ${open ? '' : 'hidden'}>${open ? evidenceHTML(item, baseline, row) : ''}</div>
  </li>`;
}

function renderCards() {
  const el = $('cards');
  if (state.status !== 'ready') { el.innerHTML = ''; return; }
  results.rows = rankItems(results.items, state.prio);
  const baseline = results.items.find((i) => i.rotation.existing);
  setHTML(el, results.rows.map((row, i) => cardHTML(row, i, baseline)).join(''));
}

function renderFooter() {
  const c = climate();
  let data = '';
  if (c) {
    const d = dataFacts(c);
    data = `<p>${F('Data: {}, {} to {}. Farm point: {}, {}. Fetched {}.', t(d.source), d.first, d.last, d.lat, d.lon, d.fetched ? date(d.fetched) : '-')} ${T('One NASA POWER grid cell is about 50 km wide.')}</p>`;
  } else data = `<p>${T('One NASA POWER grid cell is about 50 km wide.')}</p>`;
  $('foot').innerHTML = `<p>${T('A simplified model on NASA data. It supports your judgement; it does not replace it. Ask your agricultural extension officer before you change crops.')}</p>${data}`;
}

function renderAll() {
  renderHeader(); renderRegion(); renderField(); renderWhatIf(); renderPrio();
  renderStatus(); renderHeadline(); renderCards(); renderFooter();
}

// ---------------------------------------------------------------- data flow
async function getClimate(region) {
  if (climates.has(region)) return climates.get(region);
  let c = null;
  try {
    const res = await fetch(`data/climate/${region}.json`);
    if (res.ok) c = await res.json();
  } catch { c = null; }
  if (c && !(Array.isArray(c.rainFarm) && c.start)) c = null;
  climates.set(region, c);
  return c;
}

/** Replay everything for the current region, answers and what-if. Does not re-render the controls. */
function recompute() {
  const c = climate();
  if (!c) { state.status = 'missing'; results.items = []; results.rows = []; return; }
  try {
    const out = computeAll({
      region: state.region, rotations: regionRotations(), crops, climate: c,
      answers: { soil: state.soil || undefined, canIrrigate: state.canIrrigate, cannotSell: state.cannotSell, noMachine: state.noMachine },
      whatIf: { rainPct: state.rainPct, tempC: state.tempC },
    });
    results.items = out.items; results.opts = out.opts;
    state.status = 'ready';
  } catch (e) {
    console.error(e);
    state.status = 'error'; results.items = [];
  }
}

function refreshResults() {
  recompute();
  renderStatus(); renderHeadline(); renderCards(); renderFooter();
}

async function chooseRegion(region) {
  const my = ++token;
  state.region = region;
  state.cannotSell = []; state.noMachine = []; state.picked = {};
  Object.keys(state.open).filter((k) => k.startsWith('ev:')).forEach((k) => delete state.open[k]);
  state.status = 'loading'; results.items = [];
  renderRegion(); renderField(); renderStatus(); renderHeadline(); renderCards(); renderFooter();
  await getClimate(region);
  if (my !== token) return;
  refreshResults();
}

// ---------------------------------------------------------------- events
function toggleList(list, id) { const i = list.indexOf(id); if (i < 0) list.push(id); else list.splice(i, 1); }

document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'lang') { if (b.dataset.v !== language()) setLanguage(b.dataset.v); return; }
  if (act === 'region') { if (b.dataset.v !== state.region) chooseRegion(b.dataset.v); return; }
  if (act === 'soil') { state.soil = b.dataset.v; renderField(); refreshResults(); return; }
  if (act === 'irrigate') { state.canIrrigate = b.dataset.v === '1'; renderField(); refreshResults(); return; }
  if (act === 'limit') {
    toggleList(b.dataset.kind === 'cannotSell' ? state.cannotSell : state.noMachine, b.dataset.crop);
    renderField(); refreshResults(); return;
  }
  if (act === 'toggle') {
    const k = b.dataset.k;
    state.open[k] = !state.open[k];
    b.setAttribute('aria-expanded', String(state.open[k]));
    const panel = $(b.getAttribute('aria-controls'));
    if (k.startsWith('ev:')) {
      const id = k.slice(3);
      if (state.open[k]) {
        const item = results.items.find((i) => i.id === id);
        const row = results.rows.find((r) => r.id === id);
        panel.innerHTML = evidenceHTML(item, results.items.find((i) => i.rotation.existing), row);
      } else panel.innerHTML = '';
    }
    panel.hidden = !state.open[k];
    return;
  }
  if (act === 'year') {
    const id = b.dataset.rot, year = Number(b.dataset.year);
    state.picked[id] = state.picked[id] === year ? null : year;
    const card = b.closest('.rot');
    card.querySelectorAll('.yr').forEach((n) => n.setAttribute('aria-pressed', String(Number(n.dataset.year) === state.picked[id])));
    const box = $('yd-' + id);
    const item = results.items.find((i) => i.id === id);
    box.innerHTML = state.picked[id] ? detailHTML(item, state.picked[id]) : '';
    box.hidden = !state.picked[id];
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.dataset.act === 'prio') {
    state.prio[el.dataset.key] = Number(el.value);
    $('po-' + el.dataset.key).textContent = num(el.value);
    renderCards();
  } else if (el.dataset.act === 'whatif') {
    state[el.dataset.key] = Number(el.value);          // readout only; the replay runs on release (change)
    const r = whatIfReadouts();
    $('out-rain').textContent = r.rain; $('out-heat').textContent = r.heat;
  }
});
document.addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.dataset.act === 'whatif') {
    state[e.target.dataset.key] = Number(e.target.value);
    refreshResults();
  }
});

// ---------------------------------------------------------------- start
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function init() {
  await loadLanguages();
  document.documentElement.lang = language();
  onLanguage(() => { renderAll(); });
  renderAll();
  try {
    const [c, r] = await Promise.all([fetchJson('data/crops.json'), fetchJson('data/rotations.json')]);
    crops = dataEntries(c); rotationsByRegion = dataEntries(r);
  } catch (e) {
    console.error(e);
    state.status = 'error'; renderStatus();
    return;
  }
  await chooseRegion(state.region);
}
init();
