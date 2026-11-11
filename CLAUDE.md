# Agrocene: working notes for Claude Code

Team Anthropocene, NASA Space Apps 2026 Chattogram. Challenge: "Field Shift: Adapting Farms with NASA Data".
Web build: static ES modules, no build step, three.js vendored in `vendor/`. Live: https://agrocene.vercel.app
Submission repo: github.com/ameerul-muminin/Hold-The-Field (remote `fork`). Work on branch `rotation-lab`.

## What we are building now
The Rotation Lab (`lab.html`, `src/lab/`, `src/rotation/`): replays 3+ crop rotations against 25 real years of NASA
data. It is built. Tonight's work is `docs/NEXT.md`, in order, one task per session. Design and copy rules:
`docs/DESIGN.md`. Background: `docs/SPEC.md`, `docs/VALIDATION.md`. Do not redesign the engine; if it is wrong, stop and say so.

## Commands
- Test: `node --test` (all tests must pass before a task is done)
- Run: `python -m http.server 5173`, open http://localhost:5173
- Data: `python data-pipeline/fetch_climate.py --region all` (needs internet), then `npm run build-lab` once N5 exists

## Hard rules
- Never edit `src/sim/*` or `src/game/session.js`. They mirror the Java build. Import from them only.
- New work goes in `src/rotation/` (pure, no DOM), `src/ui/rotation.js`, `data/`, `data-pipeline/`.
- No invented numbers. A crop or rotation value has a source URL or is `null`. Synthetic data carries `"sample": true`
  and a SAMPLE badge on screen.
- Never name a NASA dataset in UI or docs unless it is in `data/` and used by code.
- Every new English string needs an entry in `lang/bn-web.txt` ("English => Bengali"), marked unreviewed.
- Display name is Hashem (code still says "Rahim"; `persona()` in `src/i18n.js` maps it). Nodi is his daughter.
- No names, faces or voices of anyone under 18 anywhere.
- Existing files are CRLF. Keep line endings as they are.
- No new dependencies, no build step, no backend.
- Old demo loops must still work: haor 2017, Hashem's way loses the crop; Scout mode with short boro saves 80%.
  Test hook: `window.__agrocene`.

## Working style (token budget is tight)
- Read only the files the task names. Do not scan `game/` (Java) or `src/world/` unless the task says so.
- Use the `test-runner` agent to run tests; it reports failures only.
- Small commits, one per task: `T3: ET0 and season model`. Never push without being asked.
- After each task: tick it in `docs/TASKS.md` and add one line to the AI log table in `docs/AI_USAGE.md`
  (date, model, task, what the AI produced, who reviewed). NASA requires this record.
- When compacting, keep: the current task id, files changed, failing tests.

## Deadlines (Asia/Dhaka)
Fri 13 Nov 6:30 PM: 240 s video with working demo, datasets said aloud. Sat 14 Nov 9:00 AM: NASA project page
submitted with the 30 s video. Judged on Impact, Creativity, Validity, Relevance, Presentation (20 each).
