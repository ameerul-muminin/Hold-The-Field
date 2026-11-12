// Rotation Lab, small phones (N5): the SMS texts and the lite pages. Pure, no DOM; scripts/build-lab.mjs writes the files.
// Lite pages are Bangla, no JavaScript, no web fonts, no images, under 20 KB, so they open in Opera Mini and on a
// KaiOS button phone. The texts use the i18n tables, so the caller loads Bangla first (loadLanguages).
import { f, t, num, date } from '../i18n.js';
import {
  REGIONS, REGION_NAMES, CROP_SHORT, plain, finding, saferWay, cropWord, rankItems, prioFor, failedYearList,
} from './view.js';

export const SMS_BN_MAX = 134;     // Bangla is 70 characters a part; two parts joined carry 67 each
export const SMS_EN_MAX = 160;     // one Latin-script part
export const LITE_MAX_BYTES = 20 * 1024;

/** Banglish (Bangla in English letters) for the SMS. NOT reviewed by a native speaker yet. */
const PLACE_EN = { haor: 'Sunamganj haor', barind: 'Barind', coast: 'Satkhira uposhul' };
const CROP_EN = { boro_long: 'Boro dhan', boro_short: 'Chhoto boro dhan', t_aman: 'Aman dhan', mustard: 'Sorisha', lentil: 'Moshur', sunflower: 'Surjomukhi' };

const uniq = (xs) => [...new Set(xs)];
const cropsOf = (rotation) => uniq(rotation.slots.map((s) => s.crop));
const whatBn = (rotation) => cropsOf(rotation).map((c) => t(CROP_SHORT[c] ?? c)).join(' + ');
const whatEn = (rotation) => cropsOf(rotation).map((c) => CROP_EN[c] ?? c).join(' + ');

/**
 * The 2-part Bangla text and the Latin-script text for one region's default answer.
 * @param {string} region
 * @param {{id:string, rotation:object, result:object}[]} items from the precomputed (default) answer
 * @returns {{variant:'safer'|'none'|'fine', bn:string, en:string}}
 */
export function smsTexts(region, items) {
  const ex = items.find((i) => i.rotation.existing);
  if (!ex) throw new Error(`${region}: no existing rotation`);
  const s = ex.result.summary, n = s.n;
  const safer = saferWay(items);
  const place = t(REGION_NAMES[region]), placeEn = PLACE_EN[region];
  if (s.failedYears === 0) {
    return {
      variant: 'fine',
      bn: f('{}: in {} years, {} had no bad year. Ask your extension officer.', place, n, whatBn(ex.rotation)),
      en: `${placeEn}: ${n} bochorer moddhe ${whatEn(ex.rotation)} kono bochor kharap jeto na. Krishi kormokortake jiggesh korun.`,
    };
  }
  if (!safer) {
    return {
      variant: 'none',
      bn: f('{}: in {} years, {} had {} bad years. We found no safer way. Ask your extension officer.', place, n, whatBn(ex.rotation), s.failedYears),
      en: `${placeEn}: ${n} bochorer moddhe ${whatEn(ex.rotation)} ${s.failedYears} bochor kharap jeto. Er cheye nirapod upay pai ni. Krishi kormokortake jiggesh korun.`,
    };
  }
  return {
    variant: 'safer',
    bn: f('{}: in {} years, {} had {} bad years. {}: {} years. Ask your extension officer.',
      place, n, whatBn(ex.rotation), s.failedYears, whatBn(safer.rotation), safer.result.summary.failedYears),
    en: `${placeEn}: ${n} bochorer moddhe ${whatEn(ex.rotation)} ${s.failedYears} bochor kharap jeto. ${whatEn(safer.rotation)}: ${safer.result.summary.failedYears} bochor. Krishi kormokortake jiggesh korun.`,
  };
}

/** Throws if a text would not fit. Called by the build, so a long place name or crop name fails loudly. */
export function checkSms(region, sms) {
  if (sms.bn.length > SMS_BN_MAX) throw new Error(`${region}: Bangla SMS is ${sms.bn.length} characters (max ${SMS_BN_MAX}): ${sms.bn}`);
  if (sms.en.length > SMS_EN_MAX) throw new Error(`${region}: Latin SMS is ${sms.en.length} characters (max ${SMS_EN_MAX}): ${sms.en}`);
  if (/[^\x20-\x7e]/.test(sms.en)) throw new Error(`${region}: Latin SMS has a non-ASCII character: ${sms.en}`);
}

export const smsHref = (text) => `sms:?body=${encodeURIComponent(text)}`;
export const liteHref = (region) => `lite/${region}.html`;

// ---------------------------------------------------------------- lite pages
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = (tpl, ...v) => esc(f(tpl, ...v));
const T = (s) => esc(num(t(s)));

/** {text, vals} from the engine -> plain words, translated (the same as the Lab's lineText, unescaped). */
function lineText(l) {
  const p = plain(l);
  const vals = p.vals.map((v) => (typeof v === 'string' && !/^[\d\s.,-]+$/.test(v) ? t(v) : v));
  return f(p.text, ...vals);
}

const CSS = 'body{margin:0 auto;max-width:36em;padding:0 1em 2em;font:17px/1.55 sans-serif;color:#2b2822;background:#f5f3e6}'
  + 'h1{font-size:1.4em;margin:.8em 0 .2em}h2{font-size:1.2em;margin:1.4em 0 .3em;border-bottom:1px solid #999}h3{font-size:1.05em;margin:0}'
  + 'a{color:#1d4f91;padding:.3em 0;display:inline-block}li{margin:0 0 1em}.k{border:1px solid #666;padding:.1em .5em}.m{color:#555;font-size:.9em}'
  + '.s{border:1px solid #666;padding:.5em;word-break:break-word}';

function shell(title, body) {
  return `<!doctype html>
<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body>
${body}
</body></html>
`;
}

/**
 * One region's lite page.
 * @param {{region:string, items:object[], sms:{bn:string,en:string}, facts:object, sample?:boolean}} o items: default answer
 */
export function liteHTML({ region, items, sms, facts, sample = false }) {
  const ex = items.find((i) => i.rotation.existing);
  const safer = saferWay(items);
  const fd = finding(ex.result, {
    word: cropWord(ex.rotation),
    saferName: safer ? `“${t(safer.rotation.label)}”` : null,
    saferFailed: safer?.result.summary.failedYears ?? 0,
  });
  const rows = rankItems(items, prioFor('safety'));
  const byId = new Map(items.map((i) => [i.id, i]));
  const ways = rows.map((row) => {
    const it = byId.get(row.id), s = it.result.summary, water = Math.round(s.waterMedianMm);
    const bad = failedYearList(it.result);
    return `<li><h3>${T(it.rotation.label)}</h3>${it.rotation.existing ? `<p class="m">${T('What you grow now')}</p>` : ''}${(it.rotation.notModelled || []).map((n) => `<p class="m">${T(plain({ text: n, vals: [] }).text)}</p>`).join('')}
<p>${L('{} of {} years, the {} came home.', s.n - s.failedYears, s.n, t(cropWord(it.rotation)))}${bad.length ? ` ${L('Hardest years: {}.', bad.join(', '))}` : ''}</p>
<p>${L('Your field lies empty {} days a year.', s.bareDays)} ${water >= 1 ? L('Water you must pump: about {} mm a year.', water) : T('No pumped water needed.')}</p></li>`;
  }).join('\n');
  const other = REGIONS.filter((r) => r !== region).map((r) => `<a href="${r}.html">${T(REGION_NAMES[r])}</a>`).join(' · ');
  const weather = f('Weather: {}, {} to {}, at {}, {}. Downloaded {}.', t(facts.source), facts.first, facts.last, facts.lat, facts.lon, facts.fetched ? date(facts.fetched) : '-');
  return shell(`${t('Your field, year by year')} · ${t(REGION_NAMES[region])}`, `<h1>${T('Your field, year by year')}</h1>
<p><b>${T(REGION_NAMES[region])}</b></p>
${sample ? `<p><b class="k">${T('SAMPLE DATA  -  real NASA data not loaded yet')}</b></p>` : ''}
<h2>${T('What the satellite saw')}</h2>
<p class="m">${L('What you grow now: {}', t(ex.rotation.label))}</p>
${fd.say.map((l) => `<p>${esc(lineText(l))}</p>`).join('\n')}
<h2>${T('Other ways to plant')}</h2>
<p class="m">${T('Safest first. We look back at past NASA weather and see how each way of planting would have done.')}</p>
<ol>
${ways}
</ol>
<h2>${T('By SMS, for a button phone')}</h2>
<p>${T('The phone in your hand may not open a website. A short message still reaches you. Your extension officer can send it or read it out.')}</p>
<p class="s" lang="bn">${esc(sms.bn)}</p>
<p><a href="${esc(smsHref(sms.bn))}">${T('Send by SMS')} (${T('Bangla letters')})</a></p>
<p class="s" lang="en">${esc(sms.en)}</p>
<p><a href="${esc(smsHref(sms.en))}">${T('Send by SMS')} (${T('English letters')})</a></p>
<h2>${T('Where these numbers come from')}</h2>
<p class="m">${esc(weather)}</p>
<p class="m">${T('NASA POWER: weather records NASA builds from satellites and models, for every place on Earth, every day since 1981.')} ${T('Each number covers a square about 50 km wide.')}</p>
<p class="m">${T('This is a simple model on NASA weather. You know your field better.')} ${T('Ask your extension officer before you change crops.')}</p>
<p><a href="../lab.html#${region}/ways">${T('Open the full page')}</a></p>
<p class="m">${other}</p>`);
}

export function liteIndexHTML() {
  return shell(t('Your field, year by year'), `<h1>${T('Your field, year by year')}</h1>
<h2>${T('Where is your field?')}</h2>
<ul>
${REGIONS.map((r) => `<li><a href="${r}.html">${T(REGION_NAMES[r])}</a></li>`).join('\n')}
</ul>
<p class="m">${T('We look back at past NASA weather. We see how each way of planting would have done.')}</p>
<p><a href="../lab.html">${T('Open the full page')}</a></p>`);
}
