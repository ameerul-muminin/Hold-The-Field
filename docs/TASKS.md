# Tasks: Rotation Lab

One task = one Claude Code session. Start each with:
`Read docs/SPEC.md and do task T<n> from docs/TASKS.md.` When done: tick the box, add one line to the
AI log in `docs/AI_USAGE.md`, then `/clear`.

Model column: S = Sonnet (default), O = Opus (only if Sonnet fails twice), F = Fable (review only), H = human.

## Must (the submission fails Relevance without these)

- [ ] **T1 Climate fetcher** (S). `data-pipeline/fetch_climate.py` per SPEC "Data contract". First make one small
  request to confirm every POWER parameter name, including `IMERG_PRECTOT`; record the result in `docs/DATA.md`.
  Write `data/climate/{haor,barind,coast}.json`. Add `src/rotation/climate.js` (load + expand to days) with tests.
  Done when: 3 files exist, `sample: false`, tests pass.
- [ ] **T2 Crops and rotations** (H: Yaminur, with S for formatting). Fill `data/crops.json` and
  `data/rotations.json`. Every number has a source URL or is `null`. Three or more rotations per region, one existing.
  Done when: the `number-checker` agent reports zero unsourced values.
- [ ] **T3 ET0 and season model** (S). `src/rotation/et0.js`, `season.js` with tests (FAO-56 worked example;
  a dry year gives a bigger gap than a wet year; an irrigated crop keeps yield but uses water).
- [ ] **T4 Replay** (S). `src/rotation/replay.js`, `soil.js` with tests. Haor flood factor reuses `src/sim` autoplay.
  Check: haor existing rotation is lost in 2017.
- [ ] **T5 Rank, evidence, farmer inputs** (S). `rank.js`, `evidence.js`, `scenario.js`, `farmer.js` with tests.
- [ ] **R1 Review** (F). Run the `spec-reviewer` agent on `src/rotation/`. Fix what it finds before any UI.
- [ ] **T6 Rotation Lab screen** (S). `src/ui/rotation.js` per SPEC "The screen", items 1 to 5 and 8.
  Reuse `src/ui/chart.js` and theme. Done when: works at 360 px wide, loops 1 and 2 of the old demo still work.
- [ ] **T7 Bengali** (S + H). Add every new string to `lang/bn-web.txt`; run the `bn-strings` agent. Native review: Marwa.

## Should (these move Validity and NASA-data scores)

- [ ] **T8 What-if sliders** (S). SPEC screen item 6.
- [ ] **T9 NDVI** (S). `data-pipeline/fetch_ndvi.py`, `data/ndvi/*.json`, SPEC screen item 7. Verify the API first.
- [ ] **T10 Validation doc** (S + H). `docs/VALIDATION.md` backtest table. Yaminur supplies documented bad years.
- [ ] **T11 Barind real drought year** (S). Pick it from the climate file, refetch with `fetch_power.py`,
  recalibrate per `docs/DATA.md`, remove the SAMPLE badge. Sim numbers change: update Java `Config` too or
  leave the desktop build on the old file and say so in the README.
- [ ] **T12 Field test** (H). 3 to 5 farmers or one extension officer, Thursday. Notes in `docs/FIELD_TEST.md`.
- [ ] **R2 Review** (F). `spec-reviewer` on the whole diff. Then record the demo.

## Submission (Fri 13 Nov 6:30 PM video 2; Sat 14 Nov morning NASA page + 30 s video)

- [ ] **T13 README + NASA page text** (S, then H edits). Datasets with their job, AI use, references, links.
- [ ] **T14 Video 2** (H). New demo loop 3 is now real: Rotation Lab. Datasets said aloud. Subtitles.
- [ ] **T15 30-second video** (H).
- [ ] **T16 Checks** (H). Repo link and video links open in a private window. Every member on the NASA team page.

## Stretch (only after R2)

- [ ] SMAP, GRACE-FO, SRTM through AppEEARS (needs a NASA Earthdata login).
- [ ] Any-location mode: live POWER fetch for a tapped point (pattern exists in `src/field/power.js`).

## Schedule

| Day | Target |
|---|---|
| Tue 10 | T1, T3; Yaminur starts T2; book the field test |
| Wed 11 | T2 done, T4, T5, R1, start T6 |
| Thu 12 | T6, T7, T8, T9, T12 field test, T10 |
| Fri 13 | T11, R2, T13, record and upload video 2 by 6:30 PM |
| Sat 14 | NASA page submitted and 30 s video by 9:00 AM, T16 |
