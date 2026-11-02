// One-shot sounds: car events and race cues. Each sound is a handful of short-lived
// nodes that stop themselves. Musical cues take the current song's root so they
// land in key instead of on top of it.
import type { CarEvent } from "../sim/car";
import { burst, type Rig } from "./rig";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const MIN_GAP = 0.07; // walls fire on consecutive steps when grinding

export class Sfx {
  private echo: GainNode;
  private lastWall = -1;
  private lastLand = -1;

  constructor(private rig: Rig) {
    const { ctx, sfx } = rig;
    // One shared slap echo gives pings and chimes some air for three nodes.
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.3;
    const d = ctx.createDelay(0.5);
    d.delayTime.value = 0.17;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.echo.connect(d).connect(fb).connect(d);
    d.connect(sfx);
  }

  event(e: CarEvent) {
    switch (e.type) {
      case "drift": return this.chirp();
      case "tier": return this.tier(e.tier);
      case "boost": return this.boost(e.tier);
      case "wall": return this.wall(e.hit);
      case "land": return this.land(e.drop);
      case "fall": return this.fall();
      case "respawn": return this.respawn();
    }
  }

  beep(root: number, go: boolean) {
    const t = this.now;
    // the sum of two squares an octave apart is the arcade cabinet countdown tone
    const n = 72 + ((root - 72) % 12 + 12) % 12;
    if (!go) {
      this.voice("square", hz(n + 12), t, 0.14, 0.11, 0.004, true);
      this.voice("square", hz(n), t, 0.14, 0.07, 0.004);
      return;
    }
    for (const [i, off] of [0, 12, 19, 24].entries()) this.voice("square", hz(n + 12 + off), t + i * 0.012, 0.62, 0.085, 0.004, true);
    this.voice("sawtooth", hz(n - 12), t, 0.5, 0.09, 0.004);
  }

  lapChime(root: number) {
    const t = this.now;
    const n = 84 + ((root - 84) % 12 + 12) % 12;
    [0, 7, 12].forEach((off, i) => this.bell(hz(n + off), t + i * 0.09, 0.55, 0.13));
  }

  /** Brass stab, up-run and a crash: the moment the race is suddenly serious. */
  finalLap(root: number) {
    const t = this.now;
    const n = 60 + ((root - 60) % 12 + 12) % 12;
    for (const off of [0, 7, 12, 16]) {
      this.voice("sawtooth", hz(n + off), t, 0.26, 0.055, 0.008);
      this.voice("sawtooth", hz(n + off) * 1.004, t + 0.3, 0.46, 0.06, 0.008);
    }
    [12, 16, 19, 24, 28, 31].forEach((off, i) => this.bell(hz(n + 12 + off), t + 0.05 + i * 0.055, 0.32, 0.09));
    this.noise(t + 0.3, 0.9, 0.09, "highpass", 5000);
  }

  private get now() {
    return this.rig.ctx.currentTime;
  }

  // ---- car ----

  private chirp() {
    const t = this.now;
    this.sweep("triangle", 720, 1500, t, 0.07, 0.09);
    this.noise(t, 0.05, 0.05, "bandpass", 2200);
  }

  private tier(tier: number) {
    const t = this.now;
    // climbing pentatonic: one note per tier reached, always ending higher
    const run = [[81], [81, 88], [81, 88, 93]][Math.min(3, tier) - 1] ?? [81];
    run.forEach((n, i) => this.bell(hz(n + tier * 2), t + i * 0.055, 0.32, 0.12 + tier * 0.012));
  }

  private boost(tier: number) {
    const t = this.now;
    const big = tier >= 3;
    const pad = tier === 4;
    const dur = pad ? 0.8 : 0.42 + tier * 0.11;
    const level = pad ? 0.28 : 0.15 + tier * 0.04;

    const src = burst(this.rig, t, dur);
    const f = this.rig.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(pad ? 5600 : 3800, t + dur * 0.35);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = this.env(t, 0.03, dur, level);
    src.connect(f).connect(g).connect(this.rig.sfx);

    this.sweep("sine", big ? 170 : 130, 42, t, big ? 0.26 : 0.17, big ? 0.46 : 0.3);
    if (big) this.sweep("sawtooth", 220, 1100, t, 0.3, 0.05);
    if (pad) {
      for (const [i, n] of [76, 83, 88].entries()) this.voice("sawtooth", hz(n), t + i * 0.035, 0.24, 0.04, 0.005, true);
    }
  }

  private wall(hit: number) {
    const t = this.now;
    if (t - this.lastWall < MIN_GAP) return;
    this.lastWall = t;
    const h = Math.max(0.15, Math.min(1, hit));
    this.noise(t, 0.09 + h * 0.13, 0.16 + h * 0.34, "lowpass", 1100 + h * 2600);
    this.sweep("square", 130, 44, t, 0.09 + h * 0.08, 0.1 + h * 0.26);
    if (h > 0.35) {
      // inharmonic pair reads as bent metal rather than a note
      this.voice("triangle", 1170, t, 0.13, 0.06 * h, 0.001);
      this.voice("triangle", 1737, t, 0.1, 0.05 * h, 0.001);
    }
  }

  private land(drop: number) {
    const t = this.now;
    if (t - this.lastLand < MIN_GAP) return;
    this.lastLand = t;
    // a drift hop comes down at about 3.4 m/s and should be a touch, not a thump
    const d = Math.min(1, Math.max(0, (drop - 2) / 16));
    this.sweep("sine", 110 + d * 40, 42, t, 0.1 + d * 0.16, 0.14 + d * 0.5);
    this.noise(t, 0.05 + d * 0.09, 0.05 + d * 0.16, "lowpass", 700);
  }

  private fall() {
    const t = this.now;
    const o = this.rig.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.9);
    const lfo = this.rig.ctx.createOscillator();
    lfo.frequency.value = 7;
    const depth = this.rig.ctx.createGain();
    depth.gain.value = 24;
    lfo.connect(depth).connect(o.detune);
    const g = this.env(t, 0.02, 0.9, 0.13);
    o.connect(g).connect(this.rig.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1);
    lfo.stop(t + 1);
  }

  private respawn() {
    const t = this.now;
    [72, 79, 84].forEach((n, i) => this.voice("square", hz(n), t + i * 0.06, 0.09, 0.07, 0.003, true));
  }

  // ---- voices ----

  private env(t: number, attack: number, dur: number, level: number) {
    const g = this.rig.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private voice(type: OscillatorType, f: number, t: number, dur: number, level: number, attack: number, echo = false) {
    const o = this.rig.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.env(t, attack, dur, level);
    o.connect(g).connect(this.rig.sfx);
    if (echo) g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sweep(type: OscillatorType, a: number, b: number, t: number, dur: number, level: number) {
    const o = this.rig.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(a, t);
    o.frequency.exponentialRampToValueAtTime(b, t + dur);
    const g = this.env(t, 0.003, dur, level);
    o.connect(g).connect(this.rig.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Two-operator bell: cheap, and a sine alone vanishes under the engine. */
  private bell(f: number, t: number, dur: number, level: number) {
    const { ctx } = this.rig;
    const c = ctx.createOscillator();
    const m = ctx.createOscillator();
    c.frequency.value = f;
    m.frequency.value = f * 3.01;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(f * 1.5, t);
    depth.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
    m.connect(depth).connect(c.frequency);
    const g = this.env(t, 0.002, dur, level);
    c.connect(g).connect(this.rig.sfx);
    g.connect(this.echo);
    c.start(t);
    m.start(t);
    c.stop(t + dur + 0.02);
    m.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, level: number, type: BiquadFilterType, freq: number) {
    const src = burst(this.rig, t, dur + 0.02);
    const f = this.rig.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.env(t, 0.002, dur, level);
    src.connect(f).connect(g).connect(this.rig.sfx);
  }
}
