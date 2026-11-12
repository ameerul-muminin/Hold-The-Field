import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REGIONS } from './view.js';
import { SMS_BN_MAX, SMS_EN_MAX, LITE_MAX_BYTES, smsHref } from './lite.js';
import { buildAll, loadBangla } from '../../scripts/build-lab.mjs';
import { withLanguage } from '../i18n.js';
import { smsTexts } from './lite.js';
import { itemsFromPre } from './pre.js';

const root = new URL('../../', import.meta.url);
const built = await buildAll();

test('the committed data/lab and lite files are what the build writes now (run npm run build-lab)', () => {
  for (const [rel, text] of Object.entries(built)) {
    assert.equal(fs.readFileSync(new URL(rel, root), 'utf8'), text, `${rel} is out of date`);
  }
});

for (const region of REGIONS) {
  test(`${region}: SMS fits (Bangla 2 parts, Latin 1 part) and the Bangla text is Bangla`, () => {
    const { sms } = JSON.parse(built[`data/lab/${region}.json`]);
    assert.ok(sms.bn.length <= SMS_BN_MAX, `${sms.bn.length} characters: ${sms.bn}`);
    assert.ok(sms.en.length <= SMS_EN_MAX, `${sms.en.length} characters: ${sms.en}`);
    assert.match(sms.bn, /[ঀ-৿]/);
    assert.doesNotMatch(sms.bn, /[A-Za-z]{3,}/, 'a Bangla text with English words has no Bengali entry in lang/bn-web.txt');
    assert.doesNotMatch(sms.en, /[^\x20-\x7e]/);
  });

  test(`${region}: the lite page is plain HTML under 20 KB with no script, font, image or stylesheet link`, () => {
    const html = built[`lite/${region}.html`];
    assert.ok(Buffer.byteLength(html) <= LITE_MAX_BYTES);
    assert.match(html, /^<!doctype html>\n<html lang="bn">/);
    assert.doesNotMatch(html, /<script|<img|<link|<svg|@font-face|@import|url\(|https?:\/\//i);
    assert.match(html, /name="viewport"/);
    assert.match(html, /href="sms:\?body=/);
  });
}

test('the lite pages have no English left over (every sentence has a Bengali entry)', () => {
  for (const region of REGIONS) {
    const text = built[`lite/${region}.html`].replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
    const words = text.match(/[A-Za-z]{4,}/g) || [];
    const allowed = new Set(['NASA', 'POWER', 'body', 'bochorer', 'moddhe', 'kharap', 'jeto', 'Krishi', 'kormokortake', 'jiggesh', 'korun', 'bochor', 'Sunamganj', 'haor', 'Barind', 'Satkhira', 'uposhul', 'Boro', 'dhan', 'Aman', 'Chhoto', 'boro', 'Sorisha', 'Moshur', 'Surjomukhi', 'Daily', 'community', 'nirapod', 'upay', 'cheye', 'kono', 'jeto', 'pai', 'bhalo']);
    assert.deepEqual(words.filter((w) => !allowed.has(w)), [], region);
  }
});

test('smsHref makes a sms: link that carries the whole text', () => {
  const text = 'হাওর: ২৫ বছর, 5 & 6';
  assert.equal(decodeURIComponent(smsHref(text).slice('sms:?body='.length)), text);
});

test('the Bangla SMS is Bangla even while the page is in English', async () => {
  await loadBangla();
  const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, root), 'utf8'));
  const entries = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith('_')));
  const pre = read('data/lab/haor.json'), crops = entries(read('data/crops.json')), rot = entries(read('data/rotations.json'));
  const items = itemsFromPre(pre, rot.haor, crops);
  const onEnglishPage = withLanguage('en', () => withLanguage('bn', () => smsTexts('haor', items)));
  assert.equal(onEnglishPage.bn, pre.sms.bn);
  assert.match(onEnglishPage.bn, /[\u0980-\u09FF]/);
});
