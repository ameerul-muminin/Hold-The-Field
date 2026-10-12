// "My field today": live NASA POWER data for a farmer's place in a few plain cards (calm / keep watch / act now),
// and for the haor a harvest planner built on 25 years of NASA rain in the hills. Read aloud and share buttons,
// because the people who need this most read on a phone, in Bengali, and pass news on by message.
import { t, f, date, num, language } from '../i18n.js';
import { BRAND } from '../brand.js';
import { advise, overall, floodOdds, plusDays } from '../field/advice.js';
import { PLACES, recent, rainNormals, floodCalendar } from '../field/power.js';
import { Chart } from './chart.js';
import { COLORS, icon } from './theme.js';
import { open, mount, langSwitch, wireLang, currentScreen } from './screens.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = (s) => esc(t(s));
const LEVEL = { ok: 'All calm', watch: 'Keep watch', act: 'Act now' };
const LENGTHS = [110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170];
const HELPLINE = '16123';

function defaultSowing() {
  const now = new Date(), y = now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y}-12-01`;
}

const state = { placeId: 'haor', mine: null, data: new Map(), loading: false, error: null, sow: defaultSowing(), length: 150, calendar: null };
const placeKey = (p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;

export function fieldScreen({ onClose, notice }) {
  const place = () => (state.placeId === 'mine' ? state.mine : PLACES.find((p) => p.id === state.placeId));
  floodCalendar().then((c) => { state.calendar = c; if (currentScreen() === 'field') render(); });

  async function load(force = false) {
    const p = place();
    if (!p || (!force && state.data.has(placeKey(p)))) return render();
    state.loading = true; state.error = null; render();
    try {
      const [rec, clim] = await Promise.all([recent(p), rainNormals(p)]);
      state.data.set(placeKey(p), { rec, clim });
    } catch {
      state.error = 'Could not reach NASA POWER. Check the internet and try again.';
    }
    state.loading = false;
    if (currentScreen() === 'field') render();
  }

  function cardsFor(d) { return d ? advise(d.rec.days, { upstream: d.rec.upstream, clim: d.clim }) : []; }

  function summaryText(p, d, cards) {
    const lines = [`${BRAND.name} · ${t('My field today')} · ${placeName(p)}`, f('NASA data to {}', date(d.rec.through))];
    lines.push(`${t(LEVEL[overall(cards)])}`);
    for (const c of cards) lines.push(`${t(c.title)}: ${f(...c.value)}. ${c.line ? t(c.line) : ''}`.trim());
    return lines.join('\n');
  }

  function speak(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/·/g, ','));
    const want = language() === 'bn' ? 'bn' : 'en';
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(want));
    if (want === 'bn' && !voice) { notice?.('This phone has no Bengali voice. Install one in the phone\'s settings (text-to-speech).'); return; }
    if (voice) u.voice = voice;
    u.lang = voice?.lang || (want === 'bn' ? 'bn-BD' : 'en-US');
    u.rate = 0.95;
    synth.speak(u);
  }

  async function share(text) {
    const url = `${location.origin}${location.pathname}#field`;
    try {
      if (navigator.share) { await navigator.share({ title: t('My field today'), text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      notice?.('Copied. Paste it in a message.');
    } catch { /* the person closed the share sheet */ }
  }

  function locate() {
    if (!navigator.geolocation) { state.error = 'Location is not available. Pick a place instead.'; return render(); }
    state.loading = true; state.error = null; render();
    navigator.geolocation.getCurrentPosition((pos) => {
      const r2 = (v) => Math.round(v * 100) / 100;
      state.mine = { id: 'mine', name: 'My location', lat: r2(pos.coords.latitude), lon: r2(pos.coords.longitude) };
      state.placeId = 'mine';
      state.loading = false;
      load();
    }, () => {
      state.loading = false;
      state.error = 'Location is off. Pick a place instead.';
      render();
    }, { timeout: 15000, maximumAge: 600000 });
  }

  const placeName = (p) => (p.id === 'mine' ? `${t('My location')} (${num(p.lat.toFixed(2))}, ${num(p.lon.toFixed(2))})` : t(p.name));

  function card(c) {
    return `<div class="fcard lvl-${c.level}">
      <div class="fc-icon">${icon(c.icon)}</div>
      <div class="fc-body">
        <div class="fc-top"><b>${T(c.title)}</b><span class="fc-tag">${T(LEVEL[c.level])}</span></div>
        <div class="fc-val">${esc(f(...c.value))}${c.normal != null ? `<span>${esc(f('normal {} mm', c.normal))}</span>` : ''}</div>
        ${c.line ? `<p>${T(c.line)}</p>` : ''}
      </div>
    </div>`;
  }

  function planner() {
    const cal = state.calendar;
    if (!cal) return '';
    const harvest = plusDays(state.sow, state.length);
    const odds = floodOdds(cal, harvest);
    const level = odds.warned === 0 ? 'ok' : odds.warned <= 2 ? 'watch' : 'act';
    const tip = (y) => `${y.year}: ${t(y.status === 'warning' ? 'flood-warning rain first' : y.status === 'watch' ? 'heavy rain first' : 'harvest first')}`;
    return `<section class="planner">
      <h3>${T('Plan your boro harvest')}</h3>
      <div class="plan-inputs">
        <label><span>${T('Sow the seedbed')}</span><input type="date" id="fSow" value="${esc(state.sow)}"></label>
        <label><span>${T('Seed to harvest')}</span><select id="fLen">${LENGTHS.map((n) => `<option value="${n}" ${n === state.length ? 'selected' : ''}>${esc(f('{} days', n))}</option>`).join('')}</select></label>
        <div class="harvest"><span>${T('Harvest date')}</span><b>${esc(date(harvest, false))}</b></div>
      </div>
      <div class="odds lvl-${level}"><b>${esc(f('{} of {} years', num(odds.warned), num(odds.total)))}</b>
        <span>${esc(f('NASA saw flood-warning rain in the hills before {}.', date(harvest, false)))}</span></div>
      <div class="years" role="img" aria-label="${esc(f('{} of {} years', odds.warned, odds.total))}">${odds.years.map((y) => `<i class="${y.status}" title="${esc(tip(y))}"><em>${esc(num(String(y.year).slice(2)))}</em></i>`).join('')}</div>
      <div class="years-key small muted"><span><i class="warning"></i>${T('flood-warning rain first')}</span><span><i class="watch"></i>${T('heavy rain first')}</span><span><i class="clear"></i>${T('harvest first')}</span></div>
      <p class="small muted">${esc(f('Earliest flood-warning rain in {} years: {}. A shorter rice or an earlier seedbed moves the harvest out of danger.', num(odds.total), odds.earliest ? date(odds.earliest) : '-'))}</p>
    </section>`;
  }

  function render() {
    const p = place(), d = p ? state.data.get(placeKey(p)) : null;
    const cards = cardsFor(d), lvl = overall(cards);
    const worst = cards[0];
    const chips = [...PLACES, ...(state.mine ? [state.mine] : [])].map((x) =>
      `<button class="pchip ${state.placeId === x.id ? 'on' : ''}" data-place="${x.id}">${esc(x.id === 'mine' ? t('My location') : t(x.name))}</button>`).join('');
    const ago = d ? Math.max(0, Math.round((Date.now() - Date.parse(d.rec.through)) / 86400000)) : 0;
    const h = mount('field', `
      <section class="card panel field" role="dialog" aria-label="${T('My field today')}">
        <div class="field-head">
          <div><h2>${T('My field today')}</h2><p class="sub">${p ? esc(placeName(p)) : ''}</p></div>
          ${langSwitch()}
        </div>
        <div class="places">${chips}<button class="pchip locate" id="fLocate">${icon('satellite')} ${T('Use my location')}</button></div>
        ${state.error ? `<div class="field-error">${T(state.error)} ${d ? '' : `<button class="linkbtn" data-reload>${T('Try again')}</button>`}</div>` : ''}
        ${state.loading && !d ? `<div class="field-loading">${T('Asking NASA POWER…')}</div>` : ''}
        ${d ? `
          <div class="verdict lvl-${lvl}">
            <b>${T(LEVEL[lvl])}</b>
            <span>${lvl === 'ok' ? T('Nothing in the NASA data needs action.') : T(worst.title)}</span>
            <small>${esc(f('NASA data to {} ({} days ago)', date(d.rec.through), ago))}${d.rec.stale ? ` · ${T('offline copy')}` : ''} · <button class="linkbtn" data-reload ${state.loading ? 'disabled' : ''}>${T(state.loading ? 'Loading…' : 'Refresh')}</button></small>
          </div>
          <div class="fcards">${cards.map(card).join('')}</div>
          <div id="fChart" class="field-chart"></div>
          ${d.rec.upstream ? planner() : ''}` : ''}
        <p class="field-note">${T('NASA POWER satellite and model data. It shows what already happened, it is not a forecast.')}
          ${T('Questions? Ask your local agriculture officer, or call the Krishi Call Centre:')} <a href="tel:${HELPLINE}">${esc(num(HELPLINE))}</a></p>
        <div class="panel-foot">
          <span class="foot-left">
            ${d && window.speechSynthesis ? `<button class="btn" id="fSpeak">${icon('sound')} ${T('Listen')}</button>` : ''}
            ${d ? `<button class="btn" id="fShare">${T('Share')}</button>` : ''}
          </span>
          <button class="btn primary" id="fClose">${T('Close')}</button>
        </div>
      </section>`);
    wireLang(h);
    h.querySelectorAll('[data-place]').forEach((b) => b.onclick = () => { state.placeId = b.dataset.place; state.error = null; load(); });
    h.querySelector('#fLocate').onclick = locate;
    h.querySelectorAll('[data-reload]').forEach((b) => b.onclick = () => load(true));
    h.querySelector('#fClose').onclick = () => { window.speechSynthesis?.cancel(); onClose(); };
    if (d) {
      const text = summaryText(p, d, cards);
      h.querySelector('#fSpeak')?.addEventListener('click', () => speak(text));
      h.querySelector('#fShare').onclick = () => share(text);
      const days = d.rec.days, n = days.length;
      const chart = new Chart('Rain each day (mm)');
      Object.assign(chart, { days: n, visibleUntil: n - 1, cursorDay: n - 1, dates: days.map((x) => date(x.date, false)) });
      if (d.rec.upstream) chart.areaOf('Hills upstream', days.map((x) => x.rainUp), COLORS.rain, 'mm').line('Your field', days.map((x) => x.rain), COLORS.good, 'mm');
      else chart.areaOf('Your field', days.map((x) => x.rain), COLORS.rain, 'mm');
      chart.mount(h.querySelector('#fChart'));
      requestAnimationFrame(() => chart.draw());
      const sow = h.querySelector('#fSow'), len = h.querySelector('#fLen');
      if (sow) sow.onchange = () => { if (sow.value) { state.sow = sow.value; render(); } };
      if (len) len.onchange = () => { state.length = Number(len.value); render(); };
    }
  }

  open('field', render);
  load();
}
