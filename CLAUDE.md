# CLAUDE.md

vroom is a mobile-first pixel-art arcade racing game (a PWA, deployed
statically on Vercel). One thumb: drag sideways to steer, hold to go. The
whole point is feel — a satisfying, slightly drift-y car you want to keep
lapping.

TypeScript + Vite, no framework. `src/game/` is pure logic (physics, track,
tuning), `src/render/` draws the pixel-art world to canvas, `src/ui/` handles
input, HUD, and the dev panel. Tests are Vitest, colocated as `*.test.ts`.

`npm run dev` / `npm test` / `npm run build`. `npm run icons` regenerates PWA
icons from the car pixel map (keep `scripts/make-icons.mjs` and
`src/render/sprites.ts` in sync).

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

This project merges straight to `main` — no feature branches or PRs.

Always commit and push after completing a piece of work, without asking for
confirmation first. Always `git pull` before pushing, in case downstream
changes have landed — this is still single-threaded on `main`, just cheap
insurance.
