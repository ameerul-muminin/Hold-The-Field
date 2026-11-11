# Tonight (Wed 11 Nov): from working to winning

Built and committed: engine, real NASA data, `lab.html`. See `docs/SPEC.md` (v2 notes at the end) and
`docs/VALIDATION.md`. Tonight's work is below, in order. One task per Claude Code session, then `/clear`.
Start each with: `Read CLAUDE.md, docs/DESIGN.md and docs/NEXT.md, then do task N<n>.`
After each task: `node --test` passes, the page opens with no console errors, commit `N<n>: ...`.

Setup once: `npx skills@latest add emilkowalski/skills` (Emil Kowalski's design-engineering skills).

| # | Task | Model | Why it wins points |
|---|---|---|---|
| N1 ✓ | **Copy and flow.** Rewrite every user-facing string per `docs/DESIGN.md` "Copy rules", Bangla first, and restructure the page into the four-step flow. Update `lang/bn-web.txt` (keep "needs native review" header). Keep `window.__lab`. | Opus | Presentation, UX |
| N2 ✓ | **Paper redesign.** Rewrite `styles/lab.css` per `docs/DESIGN.md` "The look". Use skills `emil-design-eng`, `mobile-native`, then `break-ui`. Check at 320, 390 and 1280 px. | Opus | Creativity, Presentation |
| N3 | **Crop calendar.** Per rotation, a 12-month strip: each crop as a bar from sowing to harvest, bare field hatched, and the danger window drawn from the data (haor: the dates the flood took the crop in the lost years; elsewhere: the months with the most heat days above the crop's limit). Pure helper in `src/lab/view.js` with tests. The challenge asks for exactly this: "times when fields are typically bare, seasons when current crops appear more vulnerable". | Sonnet | Relevance |
| N4 | **"Is this what you remember?"** On each year of the existing rotation: "Was this a bad year for you?" Yes / No, saved on the phone (localStorage). Show "You and the satellite agree on 4 of 5 years." This is the challenge's "combining satellite and ground observations", done by the farmer. Also the plain one-tap term explanations. | Sonnet | Relevance, Validity, UX |
| N5 | **Small phones.** `scripts/build-lab.mjs`: precomputed `data/lab/<region>.json`, `lite/<region>.html` and the SMS texts, per `docs/DESIGN.md` "Small phones". Lab loads the precomputed result first. "Send by SMS" and "Print" (one-page print stylesheet for the extension officer). Add `npm run build-lab`. | Sonnet | Impact, UX |
| N6 | **The replay moment.** The 25 squares fill in as years pass; lost year gets the blue wash. Skills: `animate`, `choreograph`, then `review-animations`. Nothing else moves. | Sonnet | Presentation |
| N7 | **My own field.** "Use my location" (and a typed village is NOT needed): fetch NASA POWER for that point in the browser (pattern and cache in `src/field/power.js`), replay on it. Flood rule only inside the haor basin (`inHaorBasin`). Use the nearest region's rotations and say so. Works offline from the last answer. | Sonnet (Opus if stuck) | Impact (any farm on Earth), Relevance |
| N8 | **Review.** Run `spec-reviewer` and `number-checker`. Fix findings. Re-check old game loops 1 and 2 in the browser. Push, deploy. | Fable | Validity |

If time runs out, cut from the bottom of this list upward: N7 first, then N6. Never cut N1, N2, N5, N8.

Not tonight (human jobs): Yaminur reviews `data/crops.json` / `rotations.json` and sources the 2004, 2010, 2016
floods. Marwa reviews Bangla. Zawad: 3-4 small pencil drawings for the page if he can. Thursday: farmer test.

Hard limits that stay: no invented numbers; no dataset named unless it is in `data/` and used (today: NASA POWER
only; not GPM, not MODIS); `src/sim/*` frozen; every string in English and Bangla.
