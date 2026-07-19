// Touch steering, two modes:
//  - "joystick" (default): the drag vector from touch-down points where you
//    want to go ON SCREEN; the car steers toward that world direction. This
//    keeps thumb and screen agreeing even when the car drives toward you.
//  - "dragx": raw horizontal drag = steer left/right relative to the car's
//    nose (full lock at tuning.steerRangePx). Old-school, disorienting with
//    a fixed camera; kept as a dev-panel experiment.
// With holdToGo, the thumb is also the throttle. Arrows / WASD on desktop.
import type { CarInput } from "../game/physics";
import type { Tuning } from "../game/tuning";

export interface InputRig {
  read(heading: number): CarInput;
}

/**
 * Steer toward a desired screen/world direction. Returns -1..1: proportional
 * to the heading error, saturating at lockRad radians of error.
 */
export function joystickSteer(
  dx: number,
  dy: number,
  heading: number,
  deadzonePx: number,
  lockRad: number
): number {
  if (Math.hypot(dx, dy) < deadzonePx) return 0;
  let diff = Math.atan2(dy, dx) - heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return clamp(diff / lockRad, -1, 1);
}

// --- the on-screen stick: a pixel-art arcade joystick drawn in 3/4 view ---
// A squashed base plate with a socket, a shaft that leans with your thumb,
// and a ball top. Redrawn each frame onto a tiny buffer blitted at an
// integer scale so it stays on the same pixel grid as the game world.

const STICK_SIZE = 44; // buffer px
const STICK_SCALE = 3; // css px per buffer px
const MAX_LEAN_PX = 26; // css px of drag for full visual lean

const STICK_COLORS = {
  outline: "#3a2b20",
  plate: "#e5d5b8",
  plateLight: "#f6efdc",
  socket: "#43342a",
  ball: "#e0532f",
  ballDark: "#b23f22",
  ballLight: "#f0885f",
};

function drawStick(ctx: CanvasRenderingContext2D, dxCss: number, dyCss: number): void {
  ctx.clearRect(0, 0, STICK_SIZE, STICK_SIZE);
  const len = Math.hypot(dxCss, dyCss);
  const k = len > MAX_LEAN_PX ? MAX_LEAN_PX / len : 1;
  const lx = (dxCss * k) / STICK_SCALE;
  const ly = (dyCss * k) / STICK_SCALE;
  const cx = STICK_SIZE / 2;
  const cy = STICK_SIZE / 2 + 8;

  // base plate: ellipse with a rim outline and a lit top edge
  const a = 13;
  const b = 7;
  for (let y = -b; y <= b; y++) {
    for (let x = -a; x <= a; x++) {
      const d = (x / a) ** 2 + (y / b) ** 2;
      if (d > 1) continue;
      let color = STICK_COLORS.plate;
      if (d > 0.72) color = STICK_COLORS.outline;
      else if (y < -2 && d < 0.5) color = STICK_COLORS.plateLight;
      ctx.fillStyle = color;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  // socket the shaft rises from
  for (let y = -2; y <= 2; y++) {
    for (let x = -4; x <= 4; x++) {
      if ((x / 4) ** 2 + (y / 2) ** 2 > 1) continue;
      ctx.fillStyle = STICK_COLORS.socket;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  // ball leans with the thumb; vertical lean is squashed by the 3/4 view
  const bx = Math.round(cx + lx);
  const by = Math.round(cy - 13 + ly * 0.55);

  // shaft from socket to just under the ball
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const sx = Math.round(cx + (bx - cx) * t);
    const sy = Math.round(cy - 1 + (by + 3 - (cy - 1)) * t);
    ctx.fillStyle = STICK_COLORS.outline;
    ctx.fillRect(sx - 1, sy, 2, 2);
  }

  // ball top: outline ring, shaded belly, glint
  const r = 5;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d2 = x * x + y * y;
      if (d2 > r * r) continue;
      let color = STICK_COLORS.ball;
      if (d2 > (r - 1) * (r - 1)) color = STICK_COLORS.outline;
      else if (x + y >= 4) color = STICK_COLORS.ballDark;
      else if ((x + 2) ** 2 + (y + 2) ** 2 <= 2) color = STICK_COLORS.ballLight;
      ctx.fillStyle = color;
      ctx.fillRect(bx + x, by + y, 1, 1);
    }
  }
}

export function createInput(target: HTMLElement, tuning: Tuning): InputRig {
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let curX = 0;
  let curY = 0;
  let touching = false;

  const keys = new Set<string>();

  const stick = document.createElement("canvas");
  stick.id = "stick";
  stick.width = STICK_SIZE;
  stick.height = STICK_SIZE;
  stick.style.width = `${STICK_SIZE * STICK_SCALE}px`;
  stick.style.height = `${STICK_SIZE * STICK_SCALE}px`;
  stick.hidden = true;
  document.body.appendChild(stick);
  const stickCtx = stick.getContext("2d")!;

  // Mouse-primary devices (desktop browsers) steer with the arrow keys, so the
  // on-screen stick is just idle clutter there — suppress it entirely, including
  // during a mouse drag. Mouse steering still works; it just isn't drawn.
  const mousePrimary = window.matchMedia("(hover: hover) and (pointer: fine)");

  // In fixed mode the stick lives bottom-right and survives lifting the
  // thumb — re-touching steers from the same center, so no orientation reset.
  const fixedCenter = () => ({ x: window.innerWidth - 138, y: window.innerHeight - 165 });
  const fixedActive = () =>
    tuning.fixedStick && tuning.steerMode === "joystick" && !mousePrimary.matches;
  const stickCenter = () => (fixedActive() ? fixedCenter() : { x: originX, y: originY });

  const updateIndicator = () => {
    const fixed = fixedActive();
    stick.hidden = mousePrimary.matches || (!touching && !fixed);
    if (stick.hidden) return;
    const c = stickCenter();
    stick.style.left = `${c.x}px`;
    stick.style.top = `${c.y}px`;
    stick.style.opacity = touching ? "1" : "0.85";
    drawStick(stickCtx, touching ? curX - c.x : 0, touching ? curY - c.y : 0);
  };

  target.addEventListener("pointerdown", (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    originX = curX = e.clientX;
    originY = curY = e.clientY;
    touching = true;
    target.setPointerCapture(e.pointerId);
    updateIndicator();
  });

  target.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    curX = e.clientX;
    curY = e.clientY;
    updateIndicator();
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    touching = false;
    updateIndicator();
  };
  target.addEventListener("pointerup", release);
  target.addEventListener("pointercancel", release);

  window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  return {
    read(heading: number): CarInput {
      updateIndicator(); // mode/anchor can change from the dev panel or resize
      let steer = 0;
      if (touching) {
        const c = stickCenter();
        steer =
          tuning.steerMode === "joystick"
            ? joystickSteer(
                curX - c.x,
                curY - c.y,
                heading,
                tuning.joystickDeadzonePx,
                (tuning.joystickLockDeg * Math.PI) / 180
              )
            : clamp((curX - originX) / tuning.steerRangePx, -1, 1);
      }
      if (keys.has("arrowleft") || keys.has("a")) steer -= 1;
      if (keys.has("arrowright") || keys.has("d")) steer += 1;

      const keyThrottle = keys.has("arrowup") || keys.has("w");
      const keyBrake = keys.has("arrowdown") || keys.has("s");
      const touchThrottle = tuning.holdToGo ? touching : true;

      return {
        steer: clamp(steer, -1, 1),
        throttle: keyThrottle || touchThrottle ? 1 : 0,
        brake: keyBrake ? 1 : 0,
      };
    },
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
