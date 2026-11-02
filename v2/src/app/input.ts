// One thumb: touch anywhere and hold to go, drag sideways to steer, flick the thumb
// down while steering to drift, slide back up to cash the boost. The flick has to
// be quick and deliberate: thumbs sag and reposition constantly, and any slow
// downward drift counting as a drift made every correction a slide.
// The stick's anchor trails the thumb, so reversing direction responds instantly
// no matter how far you've dragged. Keyboard: arrows/WASD, Shift or Space drifts.
import type { Input } from "../sim/car";
import { TUNING } from "../sim/tuning";

/** css px of sideways drag for full lock on this screen. */
export const throwPx = () => Math.max(90, Math.min(innerWidth, 900) * TUNING.touchThrow);

export class Controls {
  readonly input: Input = { steer: 0, throttle: 0, brake: 0, drift: false };
  private keys = new Set<string>();
  private touchId: number | null = null;
  private anchor = 0;
  private startY = 0;
  private pull = 0;
  private trail: { t: number; y: number }[] = [];
  private flicked = false;
  private stick = 0;
  private touchDrift = false;
  /** Where the thumb went down and how far it's dragged, for the on-screen stick. */
  thumb: { x: number; y: number; dx: number; dy: number } | null = null;
  private active = false;

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

  /** Menus need their touches: tracking one would preventDefault its scroll. */
  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!on) {
      this.touchId = null;
      this.stick = 0;
      this.thumb = null;
      this.touchDrift = false;
      this.pull = 0;
      this.flicked = false;
    }
  }

  private start(e: TouchEvent) {
    if (!this.active || this.touchId !== null || (e.target as HTMLElement)?.closest?.("button,a,input,[data-noinput]")) return;
    const t = e.changedTouches[0]!;
    this.touchId = t.identifier;
    this.anchor = t.clientX;
    this.startY = t.clientY;
    this.pull = 0;
    this.trail = [{ t: performance.now(), y: t.clientY }];
    this.flicked = false;
    this.stick = 0;
    this.thumb = { x: t.clientX, y: t.clientY, dx: 0, dy: 0 };
  }

  private move(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      const full = throwPx();
      let dx = t.clientX - this.anchor;
      if (Math.abs(dx) > full) {
        this.anchor = t.clientX - Math.sign(dx) * full;
        dx = t.clientX - this.anchor;
      }
      this.stick = dx / full;
      // the drift pull's origin trails upward too, so lifting always releases it
      if (t.clientY < this.startY) this.startY = t.clientY;
      this.pull = t.clientY - this.startY;
      const now = performance.now();
      this.trail.push({ t: now, y: t.clientY });
      while (this.trail.length > 2 && now - this.trail[0]!.t > TUNING.driftFlick * 1000) this.trail.shift();
      if (t.clientY - this.trail[0]!.y >= TUNING.driftPull) this.flicked = true;
      if (this.thumb) this.thumb = { ...this.thumb, dx, dy: this.pull };
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
      i.steer = Math.sign(s) * Math.abs(s) ** TUNING.touchCurve;
      i.throttle = 1;
      i.brake = 0;
      const pull = TUNING.driftPull;
      if (!this.touchDrift && this.flicked && Math.abs(s) > TUNING.driftSteer) this.touchDrift = true;
      this.flicked = false;
      if (this.touchDrift && this.pull < pull * 0.45) this.touchDrift = false;
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
    }
    return i;
  }
}
