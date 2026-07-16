# vroom

A pixel-art, mobile-first arcade racing game. Simple, satisfying, addicting — the goal.

## Status

Bootstrap stage. Currently just a canvas render loop, a touch/keyboard input rig, and
a small pure-function car physics model (`src/physics.js`) with unit tests.

## Run it

Open `index.html` directly in a browser, or serve the directory:

```
npx serve .
```

Controls: arrow keys (desktop), or touch — left edge to steer left, right half
top/bottom to throttle/brake.

## Test

```
npm test
```

Runs `src/physics.js` through Node's built-in test runner (`test/`).
