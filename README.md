# vroom

A cute pixel-art racing game for your thumb. Drag sideways to steer, hold to
go, drift the corners, beat your best lap.

TypeScript + Vite PWA, no framework. Deploys statically (Vercel auto-detects
Vite; `npm run build` → `dist/`).

## Run it

```
npm install
npm run dev
```

Desktop controls: arrows / WASD. Mobile: one thumb — hold to throttle, and
drag so the stick points where you want to go on screen; the car steers
itself toward that direction.

## Tuning the feel

Tap the ⚙ button in-game for live sliders over every physics/camera/steering
lever. Values persist locally; "copy json" exports them for pasting back into
`DEFAULT_TUNING` (`src/game/tuning.ts`).

## Test

```
npm test
```
