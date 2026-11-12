---
name: bn-strings
description: Finds English UI strings that have no Bengali entry in lang/bn-web.txt. Use after UI work.
tools: Read, Grep, Glob
model: haiku
maxTurns: 8
---
Read `src/i18n.js` to learn how strings are looked up. Search `src/ui/` and `src/rotation/evidence.js` for
user-visible English strings. Report each one missing from `lang/bn-web.txt` as `file:line  "string"`.
Do not translate and do not edit files.
