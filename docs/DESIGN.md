# Rotation Lab: design and copy direction

The first build works but looks like every AI-made dashboard: dark glass cards, pills, generic sentences.
This file is the fix. Read it before touching `lab.html`, `styles/lab.css`, `src/lab/` or any user-facing string.

## Who it is for

Hashem, a boro farmer in the Sunamganj haor, on a cheap Android phone outdoors, slow 3G, reads Bangla, not English.
Second reader: the extension officer who shows it to 30 farmers in a courtyard. Third: a NASA judge on a laptop.
Design for Hashem; the judge will respect that.

## The look: our film, not a dashboard

Taken from frames of our own prescreening film (`Agrocene_FINAL_1080p.mp4`), not invented. The Lab must look like
the film's title cards and its "NOW / NOVEMBER" notebook slide (3:20), because that is our hand.

- **Paper.** Background `#f5f3e6` (title-card paper); a slightly darker sheet `#ede6d4` for inset panels.
  Ink `#474036` for text and lines (the film's pencil is warm dark brown, never pure black).
  A light page is also what reads in sunlight. No blur, no gradients, no glass.
- **Colour is a wash, and only where it means something** (all sampled from the film, soft and chalky):
  water / flood `#85a99d` and `#9aabac`; crop came home `#91a87c`; a thin year `#9d9975`;
  dry or tired soil `#a78b70`; region tints haor `#a9baae`, Barind `#987c61`. Lost crop = the flood wash laid
  over the square, plus a pencil cross, not a bright red. Nothing else is coloured. No blue accent buttons.
- **Pencil boxes.** Panels are drawn like the film's diagram boxes (2:40): a thin ink outline, a second faint
  offset line, 2-3 px corners, no shadow. Section breaks are a hand-ruled line. Selected = filled with ink, paper text.
- **Lettering.** The film uses rough brush capitals for titles (AGROCENE, NOW, BARIND) and a handwritten script for
  notes. Ask Zawad which fonts the film used and use those for Latin headings and labels; if unknown, pick the
  closest open fonts and show him. Bangla body text stays in a clean, highly legible face (`Hind Siliguri`),
  17 px, line-height 1.65: a farmer must read it easily; style is for headings only. System fallbacks always.
- **The satellite's voice.** The film opens on black with monospace capitals typed out
  ("NASA POWER · DAILY RAINFALL ... NO ONE IS LISTENING.") and closes with "SOMEONE IS LISTENING."
  The Lab's headline finding uses exactly this device: a black panel, monospace, typed line by line:
  `NASA POWER · 2001-2025` / `BORO RICE, SUNAMGANJ HAOR` / `LOST TO FLOOD: 5 OF 25 YEARS` /
  `2004 2010 2016 2017 2022` / then, when the safer way of planting is shown, `SOMEONE IS LISTENING.`
  All numbers come from the replay, never typed in by hand. This is the only dark element on the page.
- **Drawings.** Reuse the film's own art where it helps (Hashem's hand with seed at 1:20, the torn calendar at 1:28,
  the three-region map at 1:36). Exported small (each under 20 KB). No icon packs, no emoji.
- **The map is the region picker.** The film's hand-drawn Bangladesh with Barind, Haor and Coast (1:36) is how the
  farmer picks a region: tap the wash. Plain buttons underneath for accessibility and small phones.
- **One question per screen.** Flow: (1) Where is your field? (the map) (2) The satellite's finding about what
  you grow now. (3) Other ways to plant, side by side. (4) One of them in detail.
  "Your field" questions and "What if" live behind one plain link each, not in the main path.
- **Bangla is the default language.** English is the toggle.

## Motion (use Emil Kowalski's skills: `emil-design-eng`, `animate`, `choreograph`, `review-animations`)

One moment earns animation: **the replay.** When a result appears, the 25 year-squares fill in left to right,
about 40 ms apart, like years passing; a lost year lands with a short blue wash. Everything else is still or a
150 ms fade. Only `transform` and `opacity`. Honour `prefers-reduced-motion` (show the final state at once).
Also run `mobile-native` (tap feedback, safe areas, no hover-only states) and `break-ui` (long Bangla labels,
8 rotations, a year with no data).

## Copy rules

Write the way a good extension officer talks to Hashem across a tea stall. Then translate; do not write English
first and Bangla as an afterthought. Marwa reviews every Bangla line.

1. Say what happened, with the number and the year. "In 25 years, the flood took this rice 5 times."
2. Speak to "you". Never "the user", "farmers", "stakeholders".
3. Twelve words or fewer per sentence. One idea per sentence.
4. No model words on the main path: not "indicator", "priority", "evidence", "scenario", "index", "potential",
   "strategy", "rotation" (say "way of planting" / "what you grow through the year").
5. Never promise. "would have", "in these 25 years", not "will".
6. Banned: optimise, leverage, insight, seamless, empower, unlock, journey, solution, robust, holistic,
   "It ranks here mostly because". No exclamation marks.
7. Honest limits in the same plain voice: "We do not know your market price. Ask before you plant."
8. Echo the film where it is true. The film ends "The water still came. But this year, the rice was home."

| Now | Rewrite |
|---|---|
| Came through 24 of 25 years | 24 of 25 years, the rice came home. |
| In 25 years of NASA data, "Boro - Fallow - Fallow" lost its crop in 5 years | In 25 years, the flood took this rice 5 times: 2004, 2010, 2016, 2017, 2022. |
| What matters most to you? Fewer lost years | What do you fear most? Losing the crop |
| Soil health 13 / 100, indicator, not a measurement | Soil: this way gives little back to the soil. (our estimate, not a soil test) |
| Evidence | Show me why |
| What we do not know | What we do not know (ask before you plant) |
| It ranks here mostly because it has fewer lost years. | Safest in the flood years. |
| Irrigation water 244 mm a year | Water you must pump: about 244 mm a year (a knee-deep field, once) -- only if the comparison is checked |
| What if? Not a forecast | What if the rain fails? (a guess, not a forecast) |

Explain a term only where it appears, in one line, on tap: "NASA POWER: weather records NASA builds from satellites
and models, for every place on Earth, every day since 1981."

## Small phones

- Budget: the page plus one region must be under 150 KB on the wire and usable on a 320 px screen.
  Do not download the 300 KB climate file for the default view: precompute each region's default result
  (`scripts/build-lab.mjs` -> `data/lab/<region>.json`, a few KB). Load the climate file only for "What if",
  soil or irrigation changes.
- **Lite pages:** `lite/<region>.html`, generated by the same script. Bangla, no JavaScript, no web fonts, no images,
  under 20 KB, plain semantic HTML. They must work in Opera Mini and on a KaiOS button phone browser.
- **Button phones with no browser:** an SMS-sized summary per region on the lite page and behind a "Send by SMS"
  link (`sms:?body=`) in the Lab. Bangla SMS is 70 characters per part, so write a 2-part Bangla text (max 134
  characters) AND a Latin-script (Banglish) version that fits 160. The extension officer sends or reads it out.
  Say this honestly on the page: the phone in Hashem's hand may not open a website; the message still reaches him.
- Tap targets 48 px. The 25 year-squares are too small to tap: make the strip scroll sideways with 28 px squares,
  or open a year list on tap.
