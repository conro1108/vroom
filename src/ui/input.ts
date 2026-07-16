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

export function createInput(target: HTMLElement, tuning: Tuning): InputRig {
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let curX = 0;
  let curY = 0;
  let touching = false;

  const keys = new Set<string>();

  const ring = document.createElement("div");
  ring.id = "stick-ring";
  const nub = document.createElement("div");
  nub.id = "stick-nub";
  ring.hidden = nub.hidden = true;
  document.body.append(ring, nub);

  const updateIndicator = () => {
    ring.hidden = nub.hidden = !touching;
    if (!touching) return;
    ring.style.left = `${originX}px`;
    ring.style.top = `${originY}px`;
    const dx = curX - originX;
    const dy = curY - originY;
    const len = Math.hypot(dx, dy);
    const max = 26; // keep the nub visually inside the ring
    const k = len > max ? max / len : 1;
    nub.style.left = `${originX + dx * k}px`;
    nub.style.top = `${originY + dy * k}px`;
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
      let steer = 0;
      if (touching) {
        steer =
          tuning.steerMode === "joystick"
            ? joystickSteer(
                curX - originX,
                curY - originY,
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
