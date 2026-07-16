// One-thumb touch scheme: put a thumb down anywhere, drag sideways to steer
// (full lock at tuning.steerRangePx of drag). With holdToGo, the thumb is
// also the throttle — release to coast. Arrow keys / WASD for desktop.
import type { CarInput } from "../game/physics";
import type { Tuning } from "../game/tuning";

export interface InputRig {
  read(): CarInput;
}

export function createInput(target: HTMLElement, tuning: Tuning): InputRig {
  let pointerId: number | null = null;
  let originX = 0;
  let touchSteer = 0;
  let touching = false;

  const keys = new Set<string>();

  target.addEventListener("pointerdown", (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    originX = e.clientX;
    touchSteer = 0;
    touching = true;
    target.setPointerCapture(e.pointerId);
  });

  target.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    touchSteer = clamp((e.clientX - originX) / tuning.steerRangePx, -1, 1);
  });

  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    touchSteer = 0;
    touching = false;
  };
  target.addEventListener("pointerup", release);
  target.addEventListener("pointercancel", release);

  window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  return {
    read(): CarInput {
      let steer = touchSteer;
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
