// Precompute the Rotation Lab's default answer for each region (N5, docs/DESIGN.md "Small phones").
//   data/lab/<region>.json   what the Lab draws by default, a few KB, so the 300 KB climate file is not downloaded
//   lite/<region>.html       Bangla page with no JavaScript, fonts or images, under 20 KB
//   lite/index.html          the three places
// Run after data/climate/*.json, data/crops.json or data/rotations.json change:  npm run build-lab
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLanguages } from '../src/i18n.js';
import { REGIONS, dataEntries } from '../src/lab/view.js';
import { precompute, itemsFromPre } from '../src/lab/pre.js';
import { smsTexts, checkSms, liteHTML, liteIndexHTML, LITE_MAX_BYTES } from '../src/lab/lite.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** Load the Bangla tables the way the browser does (the i18n module reads them with fetch). Bangla is the default. */
export async function loadBangla() {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const file = path.join(ROOT, String(url));
    return fs.existsSync(file) ? { ok: true, text: async () => fs.readFileSync(file, 'utf8') } : { ok: false };
  };
  try { await loadLanguages({ fallback: 'bn' }); } finally { globalThis.fetch = real; }
}

/** Everything the build writes, as { 'relative/path': text }. Pure apart from reading the data files. */
export async function buildAll() {
  await loadBangla();
  const crops = dataEntries(readJson('data/crops.json'));
  const rotations = dataEntries(readJson('data/rotations.json'));
  const files = {};
  for (const region of REGIONS) {
    const climate = readJson(`data/climate/${region}.json`);
    const pre = precompute({ region, rotations: rotations[region], crops, climate });
    const items = itemsFromPre(pre, rotations[region], crops);
    const sms = smsTexts(region, items);
    checkSms(region, sms);
    pre.sms = { bn: sms.bn, en: sms.en };
    files[`data/lab/${region}.json`] = JSON.stringify(pre);
    const html = liteHTML({ region, items, sms, facts: pre.facts, sample: pre.sample });
    const bytes = Buffer.byteLength(html);
    if (bytes > LITE_MAX_BYTES) throw new Error(`lite/${region}.html is ${bytes} bytes (max ${LITE_MAX_BYTES})`);
    files[`lite/${region}.html`] = html;
  }
  files['lite/index.html'] = liteIndexHTML();
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildAll();
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    console.log(`${rel}  ${Buffer.byteLength(text)} bytes`);
  }
}
