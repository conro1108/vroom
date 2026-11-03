// One thumb: touch anywhere and hold to go, drag sideways to steer, flick the thumb
// down while steering to drift, slide back up to cash the boost. When a drift
// starts the stick re-centres under the thumb: that spot holds the drift's middle
// arc, and nudging in or out tightens or opens it. It re-centres again as the
// drift ends, so you come out pointing straight. Without that, the thumb was
// already dragged into the turn, so every drift began near its tightest. Lifting never
// brakes: thumbs come off to regrip all the time, so a lift keeps the throttle for
// a moment, then coasts. The flick has to
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
  private lastX = 0;
  private wasDrifting = false; // the stick re-centres when this flips
  private fullL = 100;
  private fullR = 100;
  private startY = 0;
  private pull = 0;
  private trail: { t: number; y: number }[] = [];
  private flicked = false;
  private stick = 0;
  private touchDrift = false;
  private deepest = 0; // furthest the thumb has pulled down during this drift
  private coast = 0; // throttle still held after the thumb lifts
  /** Where the thumb went down and how far it's dragged, for the on-screen stick. */
  thumb: { x: number; y: number; dx: number; dy: number; f: number } | null = null;
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
      this.coast = 0; // a lift to tap pause mustn't drive on after resuming
      this.touchDrift = false;
      this.pull = 0;
      this.flicked = false;
    }
  }

  private start(e: TouchEvent) {
    if (!this.active || this.touchId !== null || (e.target as HTMLElement)?.closest?.("button,a,input,[data-noinput]")) return;
    const t = e.changedTouches[0]!;
    this.touchId = t.identifier;
    this.centre(t.clientX);
    this.startY = t.clientY;
    this.pull = 0;
    this.trail = [{ t: performance.now(), y: t.clientY }];
    this.flicked = false;
    this.stick = 0;
    this.thumb = { x: t.clientX, y: t.clientY, dx: 0, dy: 0, f: 0 };
  }

  /** Zero the stick at x. A thumb sits near its own edge of the screen, so the throw
   *  toward that edge shrinks to the room actually there: full lock fits on the glass. */
  private centre(x: number) {
    this.anchor = x;
    this.lastX = x;
    const full = throwPx();
    const margin = 18;
    this.fullR = Math.max(40, Math.min(full, innerWidth - x - margin));
    this.fullL = Math.max(40, Math.min(full, x - margin));
    this.stick = 0;
    if (this.thumb) this.thumb = { ...this.thumb, x, dx: 0, f: 0 };
  }

  private move(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      this.lastX = t.clientX;
      let dx = t.clientX - this.anchor;
      const full = dx >= 0 ? this.fullR : this.fullL;
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
      if (this.thumb) this.thumb = { ...this.thumb, dx, dy: this.pull, f: this.stick };
      e.preventDefault();
    }
  }

  private end(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.touchId) continue;
      // a lift is usually a regrip, and how thumbs naturally end a drift (so the
      // boost pays out): keep driving for a beat
      this.coast = TUNING.liftCoast;
      this.touchId = null;
      this.stick = 0;
      this.thumb = null;
    }
  }

  /** Sample once per sim step. `drifting`: the car is actually in a drift. */
  poll(dt: number, drifting = false): Input {
    const k = this.keys;
    const key = (...names: string[]) => names.some((n) => k.has(n));
    const left = key("arrowleft", "a");
    const right = key("arrowright", "d");
    const usingKeys = left || right || key("arrowup", "w", "arrowdown", "s", " ", "shift");
    const i = this.input;
    if (this.touchId !== null) {
      this.coast = 0;
      // Re-centre when the car really starts sliding (a flick at low speed or in
      // the air doesn't drift, and mustn't straighten the steering), and again when
      // it stops: a thumb nudged out to open the arc would otherwise exit the drift
      // into a hard counter-steer.
      if (drifting !== this.wasDrifting) this.centre(this.lastX);
      this.wasDrifting = drifting;
      const s = this.stick;
      i.steer = Math.sign(s) * Math.abs(s) ** TUNING.touchCurve;
      i.throttle = 1;
      i.brake = 0;
      const pull = TUNING.driftPull;
      if (!this.touchDrift && this.flicked && Math.abs(s) > TUNING.driftSteer) {
        this.touchDrift = true;
        this.deepest = this.pull;
      }
      this.flicked = false;
      if (this.touchDrift) {
        this.deepest = Math.max(this.deepest, this.pull);
        // any clear move back up ends it; no need to find where the flick began
        if (this.pull < this.deepest - TUNING.driftRelease || this.pull < pull * 0.3) this.touchDrift = false;
      }
      i.drift = this.touchDrift;
    } else if (usingKeys) {
      i.steer = (right ? 1 : 0) - (left ? 1 : 0);
      i.throttle = key("arrowdown", "s") ? 0 : 1;
      i.brake = key("arrowdown", "s") ? 1 : 0;
      i.drift = key(" ", "shift");
    } else if (this.coast > 0) {
      this.coast -= dt;
      i.steer = 0;
      i.throttle = 1;
      i.brake = 0;
      i.drift = false;
      this.touchDrift = false;
    } else {
      i.steer = 0;
      i.throttle = 0; // thumb off: coast, never brake or creep backward
      i.brake = 0;
      i.drift = false;
      this.touchDrift = false;
    }
    return i;
  }
}
