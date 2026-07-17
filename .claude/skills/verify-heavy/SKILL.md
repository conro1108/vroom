---
name: verify-heavy
description: Launch vroom headless and drive it end-to-end (menu → race → results) to verify changes at the real surface. Only for large UI changes — expensive (screenshots burn a lot of tokens), do not invoke for routine work; `npm test` covers game logic.
---

# Verifying vroom (heavy, browser-driven)

Only invoke this for large UI changes — rendering/visuals, layout, or feel
changes where unit tests genuinely can't catch what's wrong. For routine
game-logic changes, `npm test` (Vitest) is enough.

1. `npx vite --port 5199 --strictPort` (background).
2. Playwright isn't a repo dep: `npm init -y && npm i playwright` in a temp
   dir (browsers are usually already in the ms-playwright cache).
3. Run `drive.mjs` (in this directory) from that temp dir:
   `BASE=http://localhost:5199/ SHOTS=./shots node drive.mjs`
   It screenshots the menu/settings, races a full 3-lap race on Meadow Loop
   with a keyboard autopilot (~90s), checks results badges, unlock, reset,
   and record persistence across reload, then screenshots every track world.
4. Read the screenshots — unit tests can't catch visual regressions.

Gotchas:
- `window.__vroom` (dev-only hook in `main.ts`) exposes car/track/mode for
  the autopilot; it drives via real key events (`w`/`a`/`d`), not by poking
  state.
- Overlays (`#menu`, `#results`) use the `hidden` attribute; any CSS that
  sets `display` on them must keep a `[hidden] { display: none }` override
  or an invisible layer eats all pointer events.
- Use a mobile-ish viewport (390×700) — the game is mobile-first.
