// One thumb: touch anywhere and hold to go, drag sideways to steer, keep it hard
// over at speed to throw the car into a drift, and ease back to cash the boost.
// The stick's anchor trails the thumb, so reversing direction responds instantly
// no matter how far you've dragged. Keyboard: arrows/WASD, Shift or Space drifts.
import type { Input } from "../sim/car";

const THROW = 62; // css px of drag for full lock
const DRIFT_IN = 0.86; // steer past this...
const DRIFT_HOLD = 0.11; // ...for this long, and the car breaks loose
const DRIFT_OUT = 0.22; // back under this (or across centre) ends it

export class Controls {
  readonly input: Input = { steer: 0, throttle: 0, brake: 0, drift: false };
  private keys = new Set<string>();
  private touchId: number | null = null;
  private anchor = 0;
  private stick = 0;
  private hard = 0;
  private touchDrift = false;
  /** Where the thumb went down and how far it's dragged, for the on-screen stick. */
  thumb: { x: number; y: number; dx: number } | null = null;

  constructor() {
    addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener("blur", () => this.keys.clear());
    const o = { passive: false } as const;
    addEventListener("touchstart", (e) => this.start(e), o);
    addEventListener("touchmove", (e) => this.move(e), o);
    addEventListener("touchend", (e) => this.end(e), o);
    addEventListener("touchcancel", (e) => this.end(e), o);
  }

  private start(e: TouchEvent) {
    if (this.touchId !== null || (e.target as HTMLElement)?.closest?.("button,a,input")) return;
    const t = e.changedTouches[0]!;
    this.touchId = t.identifier;
    this.anchor = t.clientX;
    this.stick = 0;
    this.thumb = { x: t.clientX, y: t.clientY, dx: 0 };
  }

  private move(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      let dx = t.clientX - this.anchor;
      if (Math.abs(dx) > THROW) {
        this.anchor = t.clientX - Math.sign(dx) * THROW;
        dx = t.clientX - this.anchor;
      }
      this.stick = dx / THROW;
      if (this.thumb) this.thumb = { ...this.thumb, dx };
      e.preventDefault();
    }
  }

  private end(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      this.touchId = null;
      this.stick = 0;
      this.thumb = null;
    }
  }

  /** Sample once per sim step. */
  poll(dt: number): Input {
    const k = this.keys;
    const key = (...names: string[]) => names.some((n) => k.has(n));
    const left = key("arrowleft", "a");
    const right = key("arrowright", "d");
    const usingKeys = left || right || key("arrowup", "w", "arrowdown", "s", " ", "shift");
    const i = this.input;
    if (this.touchId !== null) {
      const s = this.stick;
      i.steer = Math.sign(s) * Math.abs(s) ** 1.35;
      i.throttle = 1;
      i.brake = 0;
      if (Math.abs(s) > DRIFT_IN) this.hard += dt;
      else this.hard = 0;
      if (!this.touchDrift && this.hard > DRIFT_HOLD) {
        this.touchDrift = true;
        this.driftSide = Math.sign(s);
      }
      if (this.touchDrift && (s * this.driftSide < DRIFT_OUT)) this.touchDrift = false;
      i.drift = this.touchDrift;
    } else if (usingKeys) {
      i.steer = (right ? 1 : 0) - (left ? 1 : 0);
      i.throttle = key("arrowdown", "s") ? 0 : 1;
      i.brake = key("arrowdown", "s") ? 1 : 0;
      i.drift = key(" ", "shift");
    } else {
      i.steer = 0;
      i.throttle = 0;
      i.brake = 0.6; // thumb off: lift and scrub
      i.drift = false;
      this.touchDrift = false;
      this.hard = 0;
    }
    return i;
  }

  private driftSide = 0;
}
