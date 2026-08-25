# CLAUDE.md

vroom is a mobile-first pixel-art arcade racing game (a PWA, deployed
statically on Vercel). One thumb: drag sideways to steer, hold to go. The
whole point is feel — a satisfying, slightly drift-y car you want to keep
lapping.

TypeScript + Vite, no framework. `src/game/` is pure logic (physics, track,
tuning), `src/render/` draws the pixel-art world to canvas, `src/ui/` handles
input, HUD, and the dev panel. Tests are Vitest, colocated as `*.test.ts`.
Keep the suite small and under ~2s; no balance sims or exhaustive edge cases
in `npm test` — balance checks live in `scripts/`.

## Map — read this instead of grepping

`src/main.ts` is the only stateful module: it owns the mode machine
(`menu → countdown → racing → finished`, plus `calibrating`), steps every
`game/` system in `loop()`, and hands poses to `render/` and `ui/`. Everything
else is a pure function library with a header comment explaining its model.

| Concern | File |
|---|---|
| Feel numbers (physics, camera, steer, volume); load/save | `game/tuning.ts` |
| Car physics step, boost guide steer | `game/physics.ts` |
| Vehicle handling presets + custom car | `game/vehicles.ts` |
| Track geometry: spline sampling, surface/progress queries, lap tracker | `game/track.ts` |
| Track catalog (layout builders: dogbone/street/serpentine/hook/circuit) | `game/tracks.ts` |
| Cups (4-track series, points, grid), roster | `game/cups.ts` |
| Speed classes, cup unlock rules, save file | `game/progression.ts` |
| Lap/race records per (track, class) | `game/records.ts` |
| Race lap/split state | `game/race.ts` |
| AI opponents (skill spread, separation, positions) | `game/opponents.ts` |
| Pure-pursuit bot driver (also used by balance scripts) | `game/botdriver.ts` |
| Items: boxes, boost tiers, rocket/missile/crown/oil, spin | `game/items.ts` |
| Slipstream / drift boost | `game/draft.ts`, `game/driftboost.ts` |
| Ghost lap record + replay | `game/ghost.ts` |
| Feel-calibration A/B taste test | `game/calibrate.ts` + `ui/calibrate.ts` |
| World painting, camera, skids, confetti | `render/scene.ts` |
| Pixel maps, car frame pre-rotation | `render/sprites.ts` |
| Per-cup world palettes | `render/themes.ts` |
| Touch/keyboard steering | `ui/input.ts` |
| Menu (class → vehicle → cup map) | `ui/menu.ts` |
| HUD, results card, minimap | `ui/hud.ts`, `ui/results.ts`, `ui/minimap.ts` |
| Dev tuning panel | `ui/devpanel.ts` |
| Pixel UI icons / wordmark / track thumbnails | `ui/icons.ts`, `ui/wordmark.ts`, `ui/trackshape.ts` |
| Synthesized WebAudio (engine, drift, doppler vrooms) | `audio/audio.ts` |
| All styling | `style.css` |

Conventions that make targeting cheap: each module's first comment block is
its model — read it before the code. Section breaks are `// ---- name ----`.
Comments explain *why*; don't add ones that restate code.

`npm run dev` / `npm test` / `npm run build`. `npm run icons` regenerates PWA
icons from a dedicated icon pixel map in `scripts/make-icons.mjs` (icon art
is its own scene, independent of the in-game sprites).

## Feel values live in Tuning — hard rule

Every number that shapes how the game feels (physics, camera, steering
sensitivity) belongs in the `Tuning` object in `src/game/tuning.ts`, exposed
as a slider in `src/ui/devpanel.ts`. Never hardcode a feel value elsewhere —
the in-app panel is how feel gets iterated on-device, and its "copy json"
output gets pasted back into `DEFAULT_TUNING`.

## Sprite rendering

Never rotate sprite art with `ctx.rotate()` at draw time — it shears pixels
off the grid. Car rotation is pre-rendered into quantized frames by
`buildCarFrames` in `src/render/sprites.ts`; new rotating art goes through the
same path. Unit tests can't catch visual regressions: verify rendering changes
with a headless-browser screenshot before calling them done.
