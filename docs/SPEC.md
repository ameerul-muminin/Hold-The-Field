# Replay Engine spec (Rotation Lab)

Owner: Azman. Lead: Fable. Status: v2, 11 Nov 2026 (built; see "Changes in v2" at the end). Tasks live in `docs/TASKS.md`.

## Why this exists

The challenge (Field Shift) asks for a decision-support tool that **compares at least three crop rotations,
including the existing one**, and for each one explains: why it was suggested, what evidence supports it,
what benefits it may offer, where information gaps exist, and what needs local review. The NASA video adds:
"compare rotations, reveal trade-offs, understand risk, make uncertainty visible."

Agrocene today replays ONE season (haor 2017) and compares variety x transplant date. The Rotation Lab adds the
missing piece: replay each rotation against every real year in the NASA record and show the spread.

One sentence for the pitch: **"We replayed each rotation against 25 real years of NASA weather."**

## Non-negotiables

1. `src/sim/*` and `src/game/session.js` are frozen. The Rotation Lab may IMPORT from `src/sim`, never edit it.
2. New code is additive: `src/rotation/` (pure functions, no DOM), `src/ui/rotation.js` (screen), `data/climate/`,
   `data/ndvi/`, `data/crops.json`, `data/rotations.json`.
3. No invented numbers. Every crop or rotation parameter has a `source` URL or is `null` and shown as a gap.
4. Every output is labelled an indicator from a simplified model. The tool supports the farmer, it does not decide.
5. Web build only. The Java desktop build is frozen for the hackathon.
6. No build step, no new dependencies. Static ES modules, `node --test`.

## Data contract

### `data/climate/<region>.json` (written by `data-pipeline/fetch_climate.py`)

Columnar, one value per day, all arrays the same length `n`:

```json
{
  "id": "barind-climate", "region": "barind", "sample": false,
  "source": "NASA POWER Daily API, community AG",
  "parameters": {"rainFarm": "PRECTOTCORR", "tmax": "T2M_MAX", "tmin": "T2M_MIN",
                 "soil": "GWETROOT", "soilTop": "GWETTOP", "rad": "ALLSKY_SFC_SW_DWN"},
  "points": {"farm": {"lat": 24.6, "lon": 88.5}, "upstream": {"lat": 24.6, "lon": 88.5}},
  "start": "2001-01-01", "n": 9131, "fetched": "2026-11-10", "missing_values_filled": 0,
  "rainFarm": [], "rainUp": [], "tmax": [], "tmin": [], "soil": [], "soilTop": [], "rad": []
}
```

- Regions: `haor`, `barind`, `coast` from `data-pipeline/regions.json`. Years 2001-01-01 to 2025-12-31.
- `rainUp` is the upstream point for the haor, a copy of `rainFarm` elsewhere.
- Optional extra column `rainImerg` (POWER parameter `IMERG_PRECTOT`, GPM IMERG) **if the API returns it**.
  The fetcher must test this first and record the outcome in `docs/DATA.md`. Do not assume it exists.
- Missing values (-999) are filled as in `fetch_power.py` and counted.

### `data/ndvi/<region>.json` (written by `data-pipeline/fetch_ndvi.py`)

MODIS MOD13Q1 250 m 16-day NDVI at the farm point. Candidate source: ORNL DAAC MODIS subset REST API
(no login). Verify the endpoint and band name before writing the fetcher.

```json
{"id": "barind-ndvi", "product": "MOD13Q1", "point": {"lat": 24.6, "lon": 88.5},
 "fetched": "2026-11-10", "series": [{"date": "2001-01-01", "ndvi": 0.41}]}
```

### `data/crops.json`

```json
{"mungbean": {
  "name": "Mung bean", "family": "legume", "days": 70,
  "kc": [0.4, 1.05, 0.6], "stageShare": [0.25, 0.5, 0.25],
  "ky": 1.15, "heatC": 38, "floodTolerantDays": 0,
  "legume": true, "residue": "medium", "rootDepth": "medium",
  "irrigated": false, "price": null,
  "source": {"days": "URL", "kc": "URL", "ky": "URL", "heatC": "URL"}
}}
```

- `kc`: FAO-56 crop coefficients (initial, mid, end). `ky`: FAO-33 yield response factor.
- A missing value is `null` with no source. The UI lists it under "Information gaps".

### `data/rotations.json`

```json
{"barind": [
  {"id": "existing", "existing": true, "label": "Fallow - Fallow - T. Aman",
   "slots": [{"crop": "t_aman", "sow": "07-25"}],
   "source": "URL"},
  {"id": "pulse", "label": "Chickpea - Fallow - T. Aman",
   "slots": [{"crop": "chickpea", "sow": "11-25"}, {"crop": "t_aman", "sow": "07-25"}],
   "source": "URL"}
]}
```

At least three rotations per region, exactly one with `"existing": true`. Candidates below are for Yaminur
to confirm or replace with sourced patterns (BRRI, BARI, DAE, published cropping-pattern studies):

| Region | Existing (confirm) | Candidates (confirm) |
|---|---|---|
| Haor | Boro - Fallow - Fallow | Short-duration boro; Mustard then late boro |
| Barind | Boro - Fallow - T. Aman, or Fallow - Fallow - T. Aman | Mustard - Mung bean - T. Aman; Chickpea or lentil - Fallow - T. Aman |
| Coast | Fallow - Fallow - T. Aman | Sunflower - Fallow - T. Aman; Mung bean - Fallow - T. Aman |

## The model (`src/rotation/`)

All pure functions. Same data in, same result out. Simplified on purpose; every simplification is listed in
`docs/DATA.md` under "Known simplifications".

### `et0.js`
`et0Hargreaves(tmax, tmin, lat, dayOfYear)` in mm/day (FAO-56 eq. 52; extraterrestrial radiation from latitude and
day of year). Tests: known FAO-56 worked example within 5%.

### `season.js`
For one crop slot in one year: the daily window from `sow` for `days`. Per day: `etc = kc(stage) * et0`.
- `demandMm` = sum of `etc`.
- `rainMm` = sum of `rainFarm`, each day capped at that day's `etc + 5` (the rest runs off).
- `gapMm` = max(0, demandMm - rainMm). This is the irrigation the crop would need.
- Water factor: irrigated crop = 1 (and `gapMm` counts as water used); rainfed = `max(0, 1 - ky * gapMm / demandMm)`.
- Heat factor: share of days above `heatC` in the middle stage; factor = `1 - min(0.5, share)`.
- Flood factor (haor only): build a one-season slice with `rainUp` and run the existing
  `autoplay(data, floodConfig(), 'rahim', ...)` from `src/sim/engine.js`. Lost crop = 0. Do not copy the flood maths.
- `yieldIndex` = water * heat * flood, 0 to 1. It is an index against the crop's own potential, not tonnes.

### `replay.js`
`replay(rotation, crops, climate)` returns one row per year plus a summary:

```js
{ years: [{ year, slots: [{crop, yieldIndex, gapMm, lost}], yieldIndex, waterMm, failed }],
  summary: { n, median, p10, p90, failedYears, waterMedianMm, bareDays, soilScore, worstYears: [] } }
```

- Year `yieldIndex` = mean over slots. `failed` = any slot lost or year index below 0.5.
- A slot whose window runs past the data is skipped and the year is dropped from `n`.

### `soil.js`
`soilScore(rotation, crops)` 0 to 100, from rotation traits only (not weather): legume in the rotation, residue
returned, bare-field days, crop-family diversity (pest-cycle break), root depth mix. Weights live in one
exported table. Label on screen: "Soil health indicator, not a measurement."

### `farmer.js` (farmer inputs: the farmer-centred part)
Three plain questions before the cards, each with pictures and one tap, no typing:
1. **Soil**: clay, loam or sandy. Sets how much rain the field holds: the daily rain cap in `season.js` becomes
   `etc + hold`, with `hold` per soil type in one sourced table. Default comes from a per-region value
   (source: SRDI or BARC soil maps, Yaminur). The screen says "your soil, as you told us".
2. **Water**: "Can you irrigate in the dry season?" yes or no. If no, every crop is treated as rainfed, so
   irrigated rotations show their real risk.
3. **Limits**: "I cannot sell..." and "I have no machine for..." tick lists built from the crops in play.
   A rotation that breaks a limit stays visible but is marked "conflicts with what you told us" and ranks last.
`applyFarmer(crops, rotations, answers)` returns adjusted copies. Pure function, tested.

Extra crop traits in `crops.json` for the priorities the challenge names, each sourced or `null`:
`forage` (none, some, good), `cover` (erosion protection: low, medium, high), `organicMatter` (low, medium, high),
`market` (free text from a local source, or `null` = information gap).

### `rank.js`
`rank(results, priorities)`; priorities = weights for `safety` (1 - failedYears/n), `yield` (median),
`water` (low waterMedianMm), `soil` (soilScore), each 0 to 1 from the farmer's sliders. Metrics are min-max
normalised across the compared rotations. Returns order plus the per-metric contribution, so the UI can say WHY.

### `evidence.js`
`evidenceCard(rotation, result, crops, baseline)` returns the five blocks the challenge lists, built from
numbers, never free text:
1. `why`: which priority it serves best.
2. `evidence`: "Survived 21 of 25 years (2001-2025, NASA POWER rain and temperature)". Dataset named every time.
3. `benefits`: compared with the existing rotation (water saved in mm, soil indicator change, bare days cut).
4. `gaps`: every `null` in `crops.json` for its crops, plus fixed gaps (no market prices, no salinity data,
   no pest or disease model, one grid cell is about 50 km for POWER).
5. `localReview`: fixed checklist (seed availability, irrigation access, market, labour, extension officer).

### `scenario.js` (cheap, high value)
`perturb(climate, {rainPct, tempC})` returns a new climate object. Drives two sliders: "less rain" and "hotter".
Labelled "what-if, not a forecast".

## The screen (`src/ui/rotation.js`)

Entry: a "Rotation Lab" button on the title screen and on the debrief. Mobile first, Bengali ready.

1. Region picker (haor, Barind, coast), then the three farmer questions from `farmer.js`.
2. Three or more rotation cards, the existing one marked "what farmers do now".
3. Per card: a strip of 25 small squares, one per year (green ok, orange poor, red lost). This is the
   "uncertainty made visible" element. Tap a square for that year's detail.
4. Priority sliders: safety, yield, water, soil. Cards re-order live, with one line saying why.
5. Evidence card (the five blocks) opens from any rotation.
6. What-if sliders (rain, heat).
7. NDVI strip under the calendar when `data/ndvi` exists: "what the satellite saw" against the modelled crop
   calendar. Caption: one MODIS pixel is 250 m and mixes several fields.
8. Footer on every view: "A simplified model on NASA data. Ask your extension officer before you change crops."

## NASA data and its job

| Dataset | Job in the tool | Tier |
|---|---|---|
| NASA POWER (PRECTOTCORR, T2M_MAX, T2M_MIN, ALLSKY_SFC_SW_DWN) | 25-year replay: rain, heat, crop water demand | Must |
| NASA POWER GWETROOT / GWETTOP | Soil wetness context and the existing drought scenario | Must |
| GPM IMERG (via POWER `IMERG_PRECTOT` if available) | Second rain record for extreme-rain days; shows where sources disagree | Should |
| MODIS MOD13Q1 NDVI | Observed green and bare periods, checks the modelled calendar | Should |
| SMAP, GRACE-FO, SRTM | Soil moisture check, Barind groundwater trend, elevation | Stretch (needs Earthdata login, AppEEARS) |

Never claim a dataset on screen, in the video or on the NASA page unless it is in `data/` and used by code.

## Validation (goes in `docs/VALIDATION.md`)

1. Backtest: list the years the model marks failed per region; compare with documented flood and drought years
   (sources from Yaminur). Report hits and misses honestly.
2. Barind: pick the real drought year from the climate file, refetch it as a season, remove the SAMPLE label.
3. Field test: 3 to 5 farmers or one extension officer use the Rotation Lab on a phone. Record what they could
   not understand. `docs/FIELD_TEST.md`.

## Out of scope

New 3D work, the Java build, accounts, a backend, salinity mechanics for the coast (state it as a gap).

## Changes in v2 (as built, 11 Nov)

- The Rotation Lab is a standalone page, `lab.html` + `src/lab/` + `styles/lab.css`, linked from the title screen,
  not a screen inside the game. It loads without the 3D world, so it is fast on a cheap phone and cannot break the game.
- Water: `season.js` uses a root-zone water store with day-to-day carryover, started from NASA GWETROOT on the sowing
  day. `hold` is the store capacity in mm (default 100; clay 140, loam 110, sandy 60, all placeholders).
- Yield metric for ranking is `harvestMedian`: crop-seasons brought home per year, so an extra crop counts.
- Rank rows carry `flat`: metrics equal across all rotations, which are never given as the reason for a rank.
- Crops in use: boro (long, short), T. Aman, mustard, lentil, sunflower. Mung bean and chickpea were dropped
  because no sourced field duration was found.
- Not built: NDVI strip (no data yet), GPM (not available from POWER), SMAP / GRACE / SRTM.

