# Agrocene (Hold the Field) — working notes for Claude Code

Team Anthropocene, NASA Space Apps 2026 Chattogram, challenge "Field Shift: Adapting Farms with NASA Data".
Web build: static ES modules, no build step, three.js vendored in vendor/. Live: https://agrocene.vercel.app
Branch to work on: `agrocene-web` (fork: ameerul-muminin/Hold-The-Field). Org repo main only changes when PR #2 is merged.

## Hard rules
- Do NOT change game logic: src/sim/*, src/game/session.js. Numbers must stay in step with the Java desktop build (game/). `node --test` must stay at 24 passing.
- Display name is Hashem (code and shared Bengali files still say "Rahim"; persona() in src/i18n.js maps it). Nodi is his daughter.
- Every new English string needs a Bengali entry in lang/bn-web.txt ("English => বাংলা"). Mark unreviewed Bengali; a native speaker must review.
- Video script rules: no under-18 faces/names/voices; subtitles on every line; the video is under 240 s.
- Barind data is a labelled SAMPLE until a real documented drought year is fetched. Keep the SAMPLE badge.
- Files in the working tree are CRLF (Windows). Keep that.

## Demo path that Marwa records (do not break without telling the team)
Loop 1: Play -> Back to December -> plan screen (Hashem's way is the default) -> Start Season -> 8x -> Space. Expect: WATCH 22 Feb (false alarm), WATCH 30 Mar, FLOOD WARNING 31 Mar, flood 1 Apr, crop lost 4 Apr, clock stops 9 Apr, 0%.
Loop 2: Back to December -> Scout mode -> Short-duration boro -> usual 5 Jan -> Start. 30 Mar press 1 (raise bund), 31 Mar press 2 (harvest 94% -> 80%), water over bund 2 Apr, debrief 80% vs 0%, "SOMEONE IS LISTENING."
Test hook: window.__agrocene (advance(n), useSlot(0)=raise bund, useSlot(1)=harvest, showDebrief(), setLanguage()).
If the UI is redesigned, loop 1/2 must be re-recorded and Agrocene_Demo_Recording_Marwa.pdf updated. Ask the team before merging a redesign.

## To do (priority order)
1. UI overhaul: modern, calm, Apple-like design (type scale, spacing, glass panels, motion), fewer words everywhere ("onek beshi text" was the team's feedback). Keep the colour language: Hashem = warm orange (bad), Scout = green (good), haor blue, Barind yellow, coast cyan.
2. 3D polish: the world (src/world/world.js, textures.js) is low-poly. Better terrain and water, rice with more geometry (instancing), soft shadows, sky/fog, flood water that visibly rises, camera easing. Keep 60 fps on a mid laptop; fall back gracefully on mobile.
3. HUD fixes: mid-size window feed CSS overlap; post-harvest label ("Rice 94% ready to cut") and "2 day(s)" plural.
4. Barind: replace sample data with a real documented drought year (NASA POWER, data-pipeline/).
5. Bengali native review of lang/bn-web.txt; check debrief closing lines against the challenge script (F23 "Bonna ebaro elo, kintu foshol noshto holo na").
6. Facts to verify before they go on screen: 150 vs 125 days (35-day seedbed is an assumption: BRAND.seedbedDays), 174 mm in 72 h (NASA POWER 31 Mar 2017), STAT 1-4 in the script.
7. Release: tag v1.1.0, README links (Vercel, YouTube unlisted, NASA team page), Vercel pointed at the team repo, PR #2 merged or write access given.

## Deadlines
Video hard deadline was 10 Oct 11:59 PM; the local lead said updates are allowed until 14 Oct (unconfirmed for the video). Final submission = YouTube Unlisted link + agrocene.vercel.app + repo.
