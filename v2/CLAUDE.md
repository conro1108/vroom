# CLAUDE.md

VROOM v2 is a mobile-first 3D arcade racer: chase camera, low-poly sunny-Sega look,
one thumb (hold to go, drag to steer, stay hard over to drift, ease off to cash the
boost). It's a standalone app with no code shared with the repo root, so either can
be deleted. Vite, TypeScript, three.js for the world, Preact + signals for the UI,
static on Vercel (set the project's Root Directory to `v2`).

`npm run dev` · `npm run build` · `npm test` (`*.check.ts`, keep under 3s) ·
`npm run sim` (bot-drives every track, prints what each lap is like) ·
`node scripts/shot.mjs "track=sunrise&auto=1&skip=1" 8,20 390x844 name` (headless
screenshots at exact race times, needs dev server on :5310).

| Want to change… | File |
|---|---|
| How the car drives (numbers) | `src/sim/tuning.ts` |
| Car physics, drift, jumps, walls | `src/sim/car.ts` |
| Track format, closure, racing line | `src/sim/course.ts` |
| Bots, laps, positions | `src/sim/race.ts` |
| A cup or its tracks | `src/tracks/<cup>.ts` |
| A world's look and scatter | `src/gfx/worlds/<theme>.ts` |
| Shared props | `src/gfx/props.ts` |
| Terrain, road, barriers, bridges | `src/gfx/world.ts` |
| Car model | `src/gfx/carmodel.ts` |
| Particles, skids, speed lines | `src/gfx/fx.ts` |
| Cameras, quality scaling | `src/gfx/view.ts` |
| Touch and keyboard | `src/app/input.ts` |
| Game flow, HUD data | `src/app/game.ts` |
| Rivals, points, save, unlocks | `src/app/career.ts` |
| Menus and HUD | `src/ui/` |
| Sound | `src/audio/` |

URL knobs: `?track=<id>` jump to a race, `&auto=1` bot drives, `&skip=1` skip the
intro, `?all` unlocks every cup. `src/tracks/lab.ts` has `lab8` and `labjump`, which
exercise every course feature. `window.__game.advance(s)` steps time deterministically.

## Gotchas

- Authoring tracks: corners must total ±360° (0° for a figure-eight), and closure then
  stretches straights. If all straights are parallel it can only fix the gap along
  them. A throw from `buildCourse` is telling you the layout is impossible; never catch it.
- Flat-out cornering radius at top speed is about 45m, so a corner over ~55m isn't
  a corner: the racing line straightens it and nothing happens. `npm run sim` shows
  this as `bites`; a track with few bites is the blob problem the rebuild exists to fix.
- Road crossing itself needs >5.5m of height difference, or it throws.
- Cars locate themselves by walking the ribbon from their last sample, which is what
  makes over/unders work. Teleporting a car without setting `car.i` makes it snap back.
- The browser pane pauses `requestAnimationFrame` when hidden; a frozen game there
  usually isn't a bug. Use `shot.mjs` for anything you need to verify.
- Tests are `*.check.ts`, not `*.test.ts`: the old app's vitest at the repo root would
  otherwise pick them up.
