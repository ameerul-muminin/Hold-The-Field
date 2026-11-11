// Rotation Lab page. Four steps, one question each:
//   1 where   Where is your field?
//   2 saw     What the satellite saw about what you grow now
//   3 ways    Other ways to plant (What do you fear most?), plus two side doors: your field, what if
//   4 way     One way in detail
// The step lives in the URL hash (#haor/ways, #haor/way/short) so the phone's back button walks back.
// The numbers come from src/rotation/ through view.js; this file only draws and wires.
import { loadLanguages, setLanguage, onLanguage, language, t, f, num, date, monthName } from '../i18n.js';
import { BRAND } from '../brand.js';
import {
  REGIONS, REGION_NAMES, PRIORITIES, GAP_WORDS, PARAM_WORDS, WHY_RANK, WHY_LOW, SOIL_CHOICES, CROP_SHORT,
  dataEntries, yearClass, finding, saferWay, cropWord, plain, soilWord, prioFor, groupGaps, collectSources,
  uniqueCrops, computeAll, rankItems, evidenceFor, dataFacts, oneDecimal, pct, cropCalendar, YEAR_DAYS, memoryAgreement, GOOD_AT, FAIR_AT,
} from './view.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (s) => esc(num(t(s)));
const F = (tpl, ...v) => esc(f(tpl, ...v));
const signed = (v) => (v > 0 ? `+${v}` : String(v));
const STEPS = ['where', 'saw', 'ways', 'way'];

const state = {
  step: 'where', region: 'haor', way: null,
  fear: 'safety',
  soil: '', canIrrigate: true, cannotSell: [], noMachine: [],
  rainPct: 0, tempC: 0,
  prio: prioFor('safety'),
  open: {}, picked: {}, status: 'loading',
  memory: loadMemory(),
};
// What the farmer remembers lives on this phone only: { region: { year: true|false } }.
function memoryKey() { return `${BRAND.storageKey}-lab-memory`; }
function loadMemory() {
  try {
    const m = JSON.parse(localStorage.getItem(memoryKey()) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch { return {}; }
}
function saveMemory() {
  try { localStorage.setItem(memoryKey(), JSON.stringify(state.memory)); } catch { /* private window: it just will not be kept */ }
}

const results = { items: [], rows: [], opts: null, clim: null };
window.__lab = { state, results, go: (step, way) => go(step, way) };

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
const cropShort = (id) => t(CROP_SHORT[id] ?? crops[id]?.name ?? id);
const climate = () => climates.get(state.region) || null;
const regionRotations = () => rotationsByRegion[state.region] || [];
const existing = () => results.items.find((i) => i.rotation.existing) || null;
const itemById = (id) => results.items.find((i) => i.id === id) || null;
const isFlood = () => state.region === 'haor';

/** A {text, vals} line -> plain words, translated. String values are translated, numbers are not. */
function lineText(l) {
  const p = plain(l);
  const vals = p.vals.map((v) => (typeof v === 'string' && !/^[\d\s.,-]+$/.test(v) ? t(v) : v));
  return F(p.text, ...vals);
}
const noteText = (s) => T(plain({ text: s, vals: [] }).text);

// ---------------------------------------------------------------- routing
function hashFor(step, way) {
  if (step === 'where') return '#';
  return `#${state.region}/${step}${step === 'way' && way ? `/${way}` : ''}`;
}
function parseHash() {
  const [region, step, way] = location.hash.replace(/^#/, '').split('/');
  if (!REGIONS.includes(region)) return { step: 'where' };
  return { region, step: STEPS.includes(step) && step !== 'where' ? step : 'saw', way: way || null };
}
/** Move to a step and push it on the history, so back works. */
function go(step, way = null) {
  const h = hashFor(step, way);
  if (location.hash !== h && !(h === '#' && !location.hash)) history.pushState(null, '', h === '#' ? location.pathname + location.search : h);
  show(step, way, true);
}
function show(step, way, moveFocus) {
  if (step === 'way' && !itemById(way)) step = results.items.length ? 'ways' : step;
  state.step = step; state.way = step === 'way' ? way : null;
  renderSteps();
  if (moveFocus) {
    const h = document.querySelector(`#step-${step} [data-step-title]`);
    if (h) { h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
}
window.addEventListener('popstate', () => route(false));
async function route(moveFocus) {
  const r = parseHash();
  if (r.region && r.region !== state.region) await loadRegion(r.region);
  show(r.step, r.way, moveFocus);
}

// ---------------------------------------------------------------- header and footer
function renderHeader() {
  const bn = language() === 'bn';
  setHTML($('top'), `
    <div class="brand"><b>${esc(BRAND.name)}</b><h1 class="h1">${T('Your field, year by year')}</h1></div>
    <div class="top-actions">
      <div class="seg" role="group" aria-label="${esc(t('Language'))}">
        <button type="button" data-act="lang" data-v="bn" data-fid="lang-bn" aria-pressed="${bn}" lang="bn">বাংলা</button>
        <button type="button" data-act="lang" data-v="en" data-fid="lang-en" aria-pressed="${!bn}" lang="en">English</button>
      </div>
    </div>`);
  document.title = `${BRAND.name} · ${t('Your field, year by year')}`;
}

function renderFooter() {
  const c = climate();
  const facts = c ? dataFacts(c) : null;
  const data = facts
    ? `<p>${F('Weather: {}, {} to {}, at {}, {}. Downloaded {}.', t(facts.source), facts.first, facts.last, facts.lat, facts.lon, facts.fetched ? date(facts.fetched) : '-')}</p>`
    : '';
  $('foot').innerHTML = `
    <p>${T('This is a simple model on NASA weather. You know your field better.')} ${T('Ask your extension officer before you change crops.')}</p>
    ${data}
    <p>${T('NASA POWER: weather records NASA builds from satellites and models, for every place on Earth, every day since 1981.')}
      ${T('Each number covers a square about 50 km wide.')}</p>
    <p><a href="./">${T('Back to the game')}</a></p>`;
}

function stepMark(n) {
  return `<p class="step-no">${F('Step {} of {}', n, 4)}</p>`;
}

function statusHTML() {
  if (state.status === 'loading') return `<p class="status">${T('Reading the NASA weather records…')}</p>`;
  if (state.status === 'missing') return `<p class="status warn">${T('We do not have the weather for this place yet.')}</p>`;
  if (state.status === 'error') return `<p class="status warn">${T('Something went wrong. Please open the page again.')}</p>`;
  return '';
}

// ---------------------------------------------------------------- step 1: where
function renderWhere() {
  return `${stepMark(1)}
    <h2 class="h2" id="h-where" tabindex="-1" data-step-title>${T('Where is your field?')}</h2>
    <p class="lede">${T('We look back at past NASA weather. We see how each way of planting would have done.')}</p>
    <div class="regions" role="group" aria-labelledby="h-where">${REGIONS.map((r) => `
      <button type="button" class="region" data-act="region" data-v="${r}" data-region="${r}" data-fid="region-${r}" aria-pressed="${state.region === r && results.items.length > 0}">${T(REGION_NAMES[r])}</button>`).join('')}
    </div>`;
}

// ---------------------------------------------------------------- step 2: what the satellite saw
function renderSaw() {
  const ex = existing();
  const head = `${stepMark(2)}
    <h2 class="h2" id="h-saw" tabindex="-1" data-step-title>${T('What the satellite saw')}</h2>`;
  if (state.status !== 'ready' || !ex) return head + statusHTML();
  const safer = saferWay(results.items);
  const fd = finding(ex.result, {
    word: cropWord(ex.rotation),
    saferName: safer ? `“${t(safer.rotation.label)}”` : null,
    saferFailed: safer?.result.summary.failedYears ?? 0,
  });
  const facts = dataFacts(climate());
  const what = [...new Set(ex.rotation.slots.map((s) => s.crop))].map(cropShort).join(' + ');
  const sat = [
    { text: 'NASA POWER · {}-{}', vals: [facts.first, facts.last] },
    { text: '{}, {}', vals: [what, t(REGION_NAMES[state.region])] },
    ...fd.sat,
  ];
  return `${head}
    <p class="small muted">${F('What you grow now: {}', t(ex.rotation.label))}</p>
    <div class="sat" role="group" aria-label="${esc(t('What the satellite saw'))}">
      ${sat.map((l) => `<p>${lineText(l)}</p>`).join('')}
      ${fd.safer ? `<p class="sat-last">${T('Someone is listening.')}</p>` : ''}
    </div>
    ${nasaTerm()}
    <div class="say">${fd.say.map((l) => `<p>${lineText(l)}</p>`).join('')}</div>
    ${sideDoor('memory', 'Is this what you remember?', memoryPanel(ex))}
    <div class="step-actions">
      <button type="button" class="btn primary" data-act="go" data-v="ways" data-fid="to-ways">${T(fd.safer ? 'Show me the safer way' : 'Show me other ways to plant')}</button>
      <button type="button" class="btn" data-act="go" data-v="where" data-fid="to-where">${T('Change place')}</button>
    </div>`;
}

// ---------------------------------------------------------------- step 3: other ways to plant
function whyLine(row, idx) {
  const item = itemById(row.id);
  if (item.rotation.conflict) return T('Last, because you said it will not work for you.');
  if (idx === 0) return T(row.top === 'safety' && isFlood() ? WHY_RANK.safetyFlood : WHY_RANK[row.top]);
  return T(WHY_LOW[weakest(row, state.prio)]);
}
// For a card below first place, what holds it back: the priority where it gives up the most score.
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

const YEAR_LABEL = { lost: 'Lost to flood', poor: 'Thin year', fair: 'Fair year', good: 'Good year' };
const cameHome = (item) => {
  const s = item.result.summary;
  return F('{} of {} years, the {} came home.', s.n - s.failedYears, s.n, t(cropWord(item.rotation)));
};
function stripHTML(item, interactive) {
  const years = item.result.years;
  const picked = state.picked[item.id];
  const cells = years.map((y) => {
    const c = yearClass(y);
    const label = esc(num(y.year) + ': ' + t(YEAR_LABEL[c]));
    return interactive
      ? `<button type="button" class="yr yr-${c}" data-act="year" data-rot="${esc(item.id)}" data-year="${y.year}" data-fid="yr-${esc(item.id)}-${y.year}" aria-pressed="${picked === y.year}" aria-label="${label}"><span></span><span class="yr-n" aria-hidden="true">${esc(num(String(y.year).slice(2)))}</span></button>`
      : `<span class="yr yr-${c}"><span></span></span>`;
  }).join('');
  return `<div class="strip"${interactive ? ` role="group" aria-label="${esc(t('Year by year'))}"` : ' aria-hidden="true"'}>${cells}</div>
    <div class="strip-ends" aria-hidden="true"><span>${esc(num(years[0]?.year ?? ''))}</span><span>${esc(num(years[years.length - 1]?.year ?? ''))}</span></div>`;
}
const legendHTML = () => `<div class="legend" aria-hidden="true">${['good', 'fair', 'poor', 'lost'].map((c) => `<span><i class="yr-${c}"></i>${T(YEAR_LABEL[c])}</span>`).join('')}</div>${colourTerm()}`;

function wayCard(row, idx) {
  const item = itemById(row.id);
  const { rotation } = item;
  return `<li class="card rot${rotation.existing ? ' existing' : ''}${rotation.conflict ? ' conflict' : ''}">
    <button type="button" class="way" data-act="open" data-v="${esc(row.id)}" data-fid="way-${esc(row.id)}">
      <span class="rot-head">
        <span class="rank" aria-hidden="true">${esc(num(idx + 1))}</span>
        <span><span class="h3">${T(rotation.label)}</span>${rotation.existing ? `<span class="badge">${T('What you grow now')}</span>` : ''}</span>
      </span>
      <span class="came">${cameHome(item)}</span>
      ${stripHTML(item, false)}
      <span class="why">${whyLine(row, idx)}</span>
      <span class="more">${T('Look closer')}</span>
    </button>
  </li>`;
}

function fieldPanel() {
  const ids = uniqueCrops(regionRotations());
  const pressed = (list, id) => list.includes(id);
  return `
    <p class="q">${T('What is your soil?')}</p>
    <div class="choices" role="group" aria-label="${esc(t('What is your soil?'))}">${SOIL_CHOICES.map(([v, label]) => `
      <button type="button" class="chip" data-act="soil" data-v="${v}" data-fid="soil-${v || 'none'}" aria-pressed="${state.soil === v}">${T(label)}</button>`).join('')}
    </div>
    <p class="q">${T('Can you pump water in the dry season?')}</p>
    <div class="choices" role="group" aria-label="${esc(t('Can you pump water in the dry season?'))}">
      <button type="button" class="chip" data-act="irrigate" data-v="1" data-fid="irr-yes" aria-pressed="${state.canIrrigate}">${T('Yes')}</button>
      <button type="button" class="chip" data-act="irrigate" data-v="0" data-fid="irr-no" aria-pressed="${!state.canIrrigate}">${T('No')}</button>
    </div>
    <p class="q">${T('Anything that will not work for you?')}</p>
    <p class="small muted">${T('Tap it. That way stays on the list, but last.')}</p>
    ${ids.map((id) => `
    <div class="limit-row"><b>${esc(cropName(id))}</b>
      <div class="choices">
        <button type="button" class="chip stop" data-act="limit" data-kind="cannotSell" data-crop="${esc(id)}" data-fid="ls-${esc(id)}" aria-pressed="${pressed(state.cannotSell, id)}">${T('I cannot sell it')}</button>
        <button type="button" class="chip stop" data-act="limit" data-kind="noMachine" data-crop="${esc(id)}" data-fid="lm-${esc(id)}" aria-pressed="${pressed(state.noMachine, id)}">${T('No machine for it')}</button>
      </div>
    </div>`).join('')}`;
}

function whatIfReadouts() {
  return { rain: F('Rain: {}%', signed(state.rainPct)), heat: F('Heat: {} °C', signed(state.tempC)) };
}
function whatIfPanel() {
  const r = whatIfReadouts();
  return `
    <p class="small muted">${T('We change the past weather and test each way again. This is a guess, not a forecast.')}</p>
    <div class="slider"><label for="in-rain">${T('Less or more rain')}</label><output id="out-rain" for="in-rain">${r.rain}</output>
      <input type="range" id="in-rain" data-act="whatif" data-key="rainPct" min="-40" max="20" step="10" value="${state.rainPct}" /></div>
    <div class="slider"><label for="in-heat">${T('Hotter')}</label><output id="out-heat" for="in-heat">${r.heat}</output>
      <input type="range" id="in-heat" data-act="whatif" data-key="tempC" min="0" max="3" step="0.5" value="${state.tempC}" /></div>`;
}

/** A plain link that opens a panel in place. */
function sideDoor(key, label, body) {
  const open = !!state.open[key];
  return `<div class="side">
    <button type="button" class="link" data-act="toggle" data-k="${key}" data-fid="disc-${key}" aria-expanded="${open}" aria-controls="pn-${key}">${T(label)}</button>
    <div class="side-body" id="pn-${key}" ${open ? '' : 'hidden'}>${body}</div>
  </div>`;
}

/** A word the farmer may not know: one plain link that opens one plain line in place. */
function term(key, label, body) {
  const k = 't:' + key, open = !!state.open[k];
  return `<div class="term">
    <button type="button" class="link" data-act="toggle" data-k="${k}" data-fid="term-${key}" aria-expanded="${open}" aria-controls="tm-${key}">${T(label)}</button>
    <div class="term-body" id="tm-${key}" ${open ? '' : 'hidden'}>${body}</div>
  </div>`;
}
const colourTerm = () => term('colours', 'What do these colours mean?', `<ul class="facts">
    <li><b>${T(YEAR_LABEL.good)}</b>: ${F('At least {}% of a full crop.', pct(GOOD_AT))}</li>
    <li><b>${T(YEAR_LABEL.fair)}</b>: ${F('{}% to {}% of a full crop.', pct(FAIR_AT), pct(GOOD_AT))}</li>
    <li><b>${T(YEAR_LABEL.poor)}</b>: ${F('Under {}% of a full crop.', pct(FAIR_AT))}</li>
    <li><b>${T(YEAR_LABEL.lost)}</b>: ${T('The flood took the crop.')}</li>
  </ul>`);
const fullCropTerm = () => term('fullcrop', 'What is a full crop?', `<p>${T('The most this crop gives in a year with enough water. We do not count kilos.')}</p>`);
const mmTerm = () => term('mm', 'What is mm?', `<p>${T('mm is millimetres of water over the whole field. 10 mm is 1 cm.')}</p>`);
const nasaTerm = () => term('nasa', 'What is NASA POWER?', `<p>${T('NASA POWER: weather records NASA builds from satellites and models, for every place on Earth, every day since 1981.')}</p>`);

// ---- "Is this what you remember?" (N4): the farmer says which years were bad; we set it beside the replay
const remembered = () => (state.memory[state.region] ||= {});
function memoryPanel(ex) {
  const m = memoryAgreement(ex.result, remembered());
  const summary = m.answered
    ? `<p class="say-agree">${F('You and the satellite agree on {} of {} years.', m.agree, m.answered)}</p>${m.agree < m.answered ? `<p class="small muted">${T('Where we differ, you know your field better.')}</p>` : ''}`
    : '';
  const q = t('Was this a bad year for you?');
  return `<p class="small muted">${T('Tap Yes or No for the years you remember. Skip the rest.')} ${T('Your answers stay on this phone.')}</p>
    <p class="q" id="q-mem">${esc(q)}</p>
    <div aria-live="polite">${summary}</div>
    <ul class="mem">${m.rows.map((r) => `<li class="mem-row" role="group" aria-label="${esc(f('{}: Was this a bad year for you?', r.year))}">
      <b class="mem-year">${esc(num(r.year))}</b>
      <span class="seg">
        <button type="button" data-act="mem" data-year="${r.year}" data-v="1" data-fid="mem-${r.year}-y" aria-pressed="${r.said === true}">${T('Yes')}</button>
        <button type="button" data-act="mem" data-year="${r.year}" data-v="0" data-fid="mem-${r.year}-n" aria-pressed="${r.said === false}">${T('No')}</button>
      </span>
      ${r.agree === null ? '' : `<span class="mem-sat tiny muted">${T(r.agree ? 'The satellite saw it the same way.' : 'The satellite saw it differently.')}</span>`}
    </li>`).join('')}</ul>
    ${m.answered ? `<button type="button" class="link small" data-act="mem-clear" data-fid="mem-clear">${T('Clear my answers')}</button>` : ''}`;
}

function renderWays() {
  const head = `${stepMark(3)}
    <h2 class="h2" id="h-ways" tabindex="-1" data-step-title>${T('Other ways to plant')}</h2>`;
  if (state.status !== 'ready') return head + statusHTML();
  results.rows = rankItems(results.items, state.prio);
  return `${head}
    <p class="q" id="q-fear">${T('What do you fear most?')}</p>
    <div class="choices" role="group" aria-labelledby="q-fear">${PRIORITIES.map((p) => `
      <button type="button" class="chip" data-act="fear" data-v="${p.key}" data-fid="fear-${p.key}" aria-pressed="${state.fear === p.key}">${T(p.label)}</button>`).join('')}
    </div>
    ${state.rainPct || state.tempC ? `<p class="status warn">${F('What if: rain {}%, {} °C hotter. A guess, not a forecast.', signed(state.rainPct), signed(state.tempC))}</p>` : ''}
    <ol class="cards">${results.rows.map((row, i) => wayCard(row, i)).join('')}</ol>
    ${legendHTML()}
    ${sideDoor('field', 'Tell us about your field', fieldPanel())}
    ${sideDoor('whatif', 'What if the rain fails? (a guess, not a forecast)', whatIfPanel())}
    <div class="step-actions">
      <button type="button" class="btn" data-act="go" data-v="saw" data-fid="to-saw">${T('Back')}</button>
    </div>`;
}

// ---------------------------------------------------------------- step 4: one way
function detailHTML(item, year) {
  const y = item.result.years.find((r) => r.year === year);
  if (!y) return '';
  return `<p class="h4">${esc(num(year))}</p><ul>${y.slots.map((s) => {
    const name = cropName(s.crop);
    if (s.lost) return `<li>${F('{}: the flood took it.', name)}</li>`;
    const gap = Math.round(s.gapMm);
    return `<li>${F('{}: {}% of a full crop.', name, pct(s.yieldIndex))}${gap > 0 ? ` ${F('Short of water by {} mm.', gap)}` : ''}</li>`;
  }).join('')}</ul>`;
}

function evidenceHTML(item, row) {
  const ev = evidenceFor(item, existing(), crops, climate(), row?.conflict ? null : row?.top);
  const block = (title, lines) => (lines.length ? `<div><p class="h4">${T(title)}</p><ul>${lines.join('')}</ul></div>` : '');
  const li = (l) => `<li>${lineText(l)}</li>`;
  let ben = ev.benefits.map(li);
  if (!ben.length && item.rotation.existing) ben = [`<li>${T('This is what you grow now. We compare every other way with it.')}</li>`];
  const g = groupGaps(ev.gaps);
  const gaps = [
    ...g.groups.map((x) => `<li>${F('Not checked yet: {} ({}).', t(GAP_WORDS[x.param] ?? x.param), x.crops.map((c) => t(c)).join(', '))}</li>`),
    ...uniqueCrops([item.rotation]).filter((id) => crops[id]?.kyProxy).map((id) => `<li>${esc(cropName(id))}: ${T(crops[id].kyProxy)}</li>`),
    ...g.rest.map(li),
  ];
  const sources = collectSources(item.rotation, crops).map((s) => {
    const label = s.crops.length ? `${s.crops.map((c) => t(c)).join(', ')} · ${s.params.map((p) => t(PARAM_WORDS[p] ?? p)).join(', ')}` : t('This way of planting');
    const link = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : '';
    return `<li><span class="src-for">${esc(label)}</span>${link}${s.rest ? ` <span class="tiny faint">${esc(s.rest)}</span>` : ''}</li>`;
  });
  return `<div class="ev-body">
    ${block('Why we show it', ev.why.map(li))}${block('What the weather record shows', ev.evidence.map(li))}
    ${block('What it would have given you', ben)}
    ${block('What we do not know (ask before you plant)', gaps)}${block('Ask near you first', ev.localReview.map(li))}
    <div class="src"><p class="h4">${T('Where these numbers come from')}</p><ul>${sources.join('')}</ul></div>
  </div>`;
}

// ---------------------------------------------------------------- the year on one line (N3)
const at = (d) => `${((d / YEAR_DAYS) * 100).toFixed(2)}%`;
const span = (a, b) => `left:${at(a)};width:${at(b - a)}`;
const joinList = (xs) => xs.join(`${t(', ')} `);

function calendarHTML(item) {
  const cal = cropCalendar(item, crops, results.clim || climate(), { flood: isFlood() });
  const ticks = cal.months.map((d) => `<i style="left:${at(d)}"></i>`).join('');
  const quarters = [0, 3, 6, 9].map((m) => `<span style="left:${at(cal.months[m])}">${esc(monthName(m))}</span>`).join('');
  const bars = cal.bars.map((b) => {
    const big = b.segments.reduce((m, s) => (s.to - s.from > m.to - m.from ? s : m), b.segments[0]);
    return b.segments.map((s) => `<span class="cal-bar" style="${span(s.from, s.to)}">${s === big ? esc(cropShort(b.crop)) : ''}</span>`).join('');
  }).join('');
  const bands = [], lines = [], legend = [];
  for (const d of cal.dangers) {
    const name = t(cropWord({ slots: [{ crop: d.crop }] }));
    if (d.kind === 'flood') {
      if (!d.dates.length) { lines.push(`<p>${F('In these {} years the flood did not take the {}.', d.years, name)}</p>`); continue; }
      bands.push(`<span class="cal-band flood" style="${span(d.from, d.to)}"></span>`);
      legend.push('flood');
      const ds = d.dates.map((x) => x.date);
      lines.push(`<p>${F('The flood took the {} between {} and {}.', name, date(ds.reduce((a, b) => (a.slice(5) < b.slice(5) ? a : b)), false), date(ds.reduce((a, b) => (a.slice(5) > b.slice(5) ? a : b)), false))}</p>
        <ul class="cal-dates">${d.dates.map((x) => `<li>${esc(num(x.year))}: ${esc(date(x.date, false))}</li>`).join('')}</ul>`);
    } else {
      const total = d.counts.reduce((a, b) => a + b, 0);
      if (!d.months.length) { lines.push(`<p>${F('In these {} years, no day went above {} °C for the {}.', d.years, d.limitC, cropShort(d.crop))}</p>`); continue; }
      for (const m of d.months) bands.push(`<span class="cal-band heat" style="${span(cal.months[m], cal.months[m + 1] ?? YEAR_DAYS)}"></span>`);
      legend.push('heat');
      lines.push(`<p>${F('Most hot days for the {}: {}.', cropShort(d.crop), joinList(d.months.map((m) => monthName(m))))} ${F('In {} years, {} days went above {} °C.', d.years, total, d.limitC)}</p>`);
    }
  }
  const key = [['crop', 'In the field'], ['bare', 'Bare field'], ...[...new Set(legend)].map((k) => [k, k === 'flood' ? 'The flood took the crop' : 'Hot days'])];
  const label = `${t('Your field through the year')}: ${cal.bars.map((b) => cropShort(b.crop)).join(', ')}`;
  return `<div class="cal">
    <p class="h4">${T('Your field through the year')}</p>
    <div class="cal-months" aria-hidden="true">${quarters}</div>
    <div class="cal-track" role="img" aria-label="${esc(label)}">${ticks}${bars}</div>
    ${bands.length ? `<div class="cal-danger" aria-hidden="true">${bands.join('')}</div>` : ''}
    <div class="legend" aria-hidden="true">${key.map(([k, l]) => `<span><i class="cal-key ${k}"></i>${T(l)}</span>`).join('')}</div>
    <div class="cal-say">${lines.join('')}</div>
  </div>`;
}

function renderWay() {
  const item = itemById(state.way);
  const head = stepMark(4);
  if (state.status !== 'ready' || !item) return head + statusHTML();
  const { rotation } = item;
  const s = item.result.summary;
  const row = results.rows.find((r) => r.id === item.id) || rankItems(results.items, state.prio).find((r) => r.id === item.id);
  const idx = results.rows.findIndex((r) => r.id === item.id);
  const picked = state.picked[item.id];
  const open = !!state.open['ev:' + item.id];
  const water = Math.round(s.waterMedianMm);
  const notes = [...(rotation.notModelled || []), ...(rotation.sowNote ? [rotation.sowNote] : [])];
  return `${head}
    <h2 class="h2" id="h-way" tabindex="-1" data-step-title>${T(rotation.label)}</h2>
    ${rotation.existing ? `<span class="badge">${T('What you grow now')}</span>` : ''}
    <p class="small muted">${F('What you grow: {}', [...new Set(rotation.slots.map((x) => x.crop))].map(cropName).join(`${t(', then')} `))}</p>
    ${rotation.share ? `<p class="small muted">${F('How common here: {}', t(rotation.share))}</p>` : ''}
    <p class="came">${cameHome(item)}</p>
    <p class="small muted">${T('Tap a year to see what happened.')}</p>
    ${stripHTML(item, true)}
    ${legendHTML()}
    <div class="yr-detail" id="yd-${esc(item.id)}" aria-live="polite" ${picked ? '' : 'hidden'}>${picked ? detailHTML(item, picked) : ''}</div>
    ${calendarHTML(item)}
    <ul class="facts">
      <li>${s.crops === 1 ? F('In a usual year, {}% of a full crop comes home.', pct(s.harvestMedian)) : F('In a usual year, about {} of {} full crops come home.', oneDecimal(s.harvestMedian), s.crops)}</li>
      <li>${water >= 1 ? F('Water you must pump: about {} mm a year.', water) : T('No pumped water needed.')}</li>
      <li>${F('Soil: this way gives {} back to the soil.', t(soilWord(s.soilScore)))} <span class="tiny faint">${T('(our estimate, not a soil test)')}</span></li>
      <li>${F('Your field lies empty {} days a year.', s.bareDays)}</li>
    </ul>
    ${row && idx >= 0 ? `<p class="why">${whyLine(row, idx)}</p>` : ''}
    ${fullCropTerm()}${water >= 1 ? mmTerm() : ''}
    ${rotation.conflict ? `<p class="conflict-note">${F('You said this will not work for you: {}', rotation.conflictCrops.map(cropName).join(', '))}</p>` : ''}
    ${notes.length ? `<div class="notes">${notes.map((n) => `<p>${noteText(n)}</p>`).join('')}</div>` : ''}
    <button type="button" class="disc" data-act="toggle" data-k="ev:${esc(item.id)}" data-fid="ev-${esc(item.id)}" aria-expanded="${open}" aria-controls="ev-${esc(item.id)}">${T('Show me why')}</button>
    <div id="ev-${esc(item.id)}" ${open ? '' : 'hidden'}>${open ? evidenceHTML(item, row) : ''}</div>
    <div class="step-actions">
      <button type="button" class="btn" data-act="go" data-v="ways" data-fid="to-ways-back">${T('Back to other ways')}</button>
    </div>`;
}

// ---------------------------------------------------------------- draw
const RENDER = { where: renderWhere, saw: renderSaw, ways: renderWays, way: renderWay };
function renderSteps() {
  for (const step of STEPS) {
    const el = $('step-' + step);
    const on = step === state.step;
    el.hidden = !on;
    if (on) setHTML(el, RENDER[step]());
    else el.innerHTML = '';
  }
}
function renderAll() { renderHeader(); renderSteps(); renderFooter(); }

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

/** Replay everything for the current region, answers and what-if. */
function recompute() {
  const c = climate();
  if (!c) { state.status = 'missing'; results.items = []; results.rows = []; return; }
  try {
    const out = computeAll({
      region: state.region, rotations: regionRotations(), crops, climate: c,
      answers: { soil: state.soil || undefined, canIrrigate: state.canIrrigate, cannotSell: state.cannotSell, noMachine: state.noMachine },
      whatIf: { rainPct: state.rainPct, tempC: state.tempC },
    });
    results.items = out.items; results.opts = out.opts; results.clim = out.clim;
    results.rows = rankItems(results.items, state.prio);
    state.status = 'ready';
  } catch (e) {
    console.error(e);
    state.status = 'error'; results.items = []; results.rows = [];
  }
}
function refresh() { recompute(); renderSteps(); renderFooter(); }

async function loadRegion(region) {
  const my = ++token;
  state.region = region;
  state.cannotSell = []; state.noMachine = []; state.picked = {};
  Object.keys(state.open).filter((k) => k.startsWith('ev:')).forEach((k) => delete state.open[k]);
  state.status = 'loading'; results.items = []; results.rows = [];
  renderSteps(); renderFooter();
  await getClimate(region);
  if (my !== token) return false;
  recompute(); renderFooter();
  return true;
}

// ---------------------------------------------------------------- events
function toggleList(list, id) { const i = list.indexOf(id); if (i < 0) list.push(id); else list.splice(i, 1); }

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'lang') { if (b.dataset.v !== language()) setLanguage(b.dataset.v); return; }
  if (act === 'region') {
    const r = b.dataset.v;
    if (r !== state.region || state.status !== 'ready') {
      state.region = r; state.status = 'loading'; results.items = []; results.rows = [];
      go('saw');
      if (await loadRegion(r)) renderSteps();
    }
    else go('saw');
    return;
  }
  if (act === 'go') { go(b.dataset.v); return; }
  if (act === 'open') { go('way', b.dataset.v); return; }
  if (act === 'fear') { state.fear = b.dataset.v; state.prio = prioFor(state.fear); renderSteps(); return; }
  if (act === 'soil') { state.soil = b.dataset.v; refresh(); return; }
  if (act === 'irrigate') { state.canIrrigate = b.dataset.v === '1'; refresh(); return; }
  if (act === 'limit') {
    toggleList(b.dataset.kind === 'cannotSell' ? state.cannotSell : state.noMachine, b.dataset.crop);
    refresh(); return;
  }
  if (act === 'toggle') {
    const k = b.dataset.k;
    state.open[k] = !state.open[k];
    b.setAttribute('aria-expanded', String(state.open[k]));
    const panel = $(b.getAttribute('aria-controls'));
    if (k.startsWith('ev:')) {
      const id = k.slice(3);
      panel.innerHTML = state.open[k] ? evidenceHTML(itemById(id), results.rows.find((r) => r.id === id)) : '';
    }
    panel.hidden = !state.open[k];
    return;
  }
  if (act === 'mem') {
    const year = Number(b.dataset.year), say = b.dataset.v === '1', mine = remembered();
    if (mine[year] === say) delete mine[year]; else mine[year] = say;   // tap the same answer again to take it back
    saveMemory(); renderSteps(); return;
  }
  if (act === 'mem-clear') { delete state.memory[state.region]; saveMemory(); renderSteps(); return; }
  if (act === 'year') {
    const id = b.dataset.rot, year = Number(b.dataset.year);
    state.picked[id] = state.picked[id] === year ? null : year;
    b.closest('.strip').querySelectorAll('.yr').forEach((n) => n.setAttribute('aria-pressed', String(Number(n.dataset.year) === state.picked[id])));
    const box = $('yd-' + id);
    box.innerHTML = state.picked[id] ? detailHTML(itemById(id), state.picked[id]) : '';
    box.hidden = !state.picked[id];
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.dataset.act !== 'whatif') return;
  state[el.dataset.key] = Number(el.value);          // readout only; the replay runs on release (change)
  const r = whatIfReadouts();
  $('out-rain').textContent = r.rain; $('out-heat').textContent = r.heat;
});
document.addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.dataset.act === 'whatif') {
    state[e.target.dataset.key] = Number(e.target.value);
    refresh();
  }
});

// ---------------------------------------------------------------- start
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function init() {
  await loadLanguages({ fallback: 'bn' });
  document.documentElement.lang = language();
  onLanguage(() => { renderAll(); });
  renderAll();
  try {
    const [c, r] = await Promise.all([fetchJson('data/crops.json'), fetchJson('data/rotations.json')]);
    crops = dataEntries(c); rotationsByRegion = dataEntries(r);
  } catch (e) {
    console.error(e);
    state.status = 'error'; renderSteps();
    return;
  }
  const r = parseHash();
  if (r.region) await loadRegion(r.region);
  show(r.step, r.way, false);
}
init();
