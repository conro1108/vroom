// Everything that sounds continuously while driving: the engine and the tyres.
//
// Model: one "rpm" derived from speed through a fake five-speed gearbox, carried
// as a single cents signal into every oscillator so the layers can never drift
// apart. Firing-pulse wavetables instead of saws go through a waveshaper whose
// drive, and a resonant filter whose cutoff, follow load. Throttle isn't in `Car`,
// so load is inferred from how the speed is changing.
import { glide, loop, softClip, type Rig } from "./rig";

const BASE_HZ = 110;

// speedFrac where each gear ends, and the Hz it runs between. Each gear starts a
// little higher than the last so an upshift drops the pitch without losing the climb.
const GEARS: { end: number; lo: number; hi: number }[] = [
  { end: 0.2, lo: 58, hi: 205 },
  { end: 0.42, lo: 112, hi: 225 },
  { end: 0.66, lo: 132, hi: 240 },
  { end: 0.88, lo: 150, hi: 250 },
  { end: 1.45, lo: 168, hi: 320 },
];
const DOWNSHIFT_MARGIN = 0.05; // hysteresis, or speed jitter at a boundary hunts between gears
const SHIFT_CUT = 0.09; // s of dropped power at each upshift
const OFF_THROTTLE = -0.08; // speedFrac/s; coasting is -0.17, hills reach about -0.05

const SCREECH_HZ = [980, 1180, 1420, 1720];

export class Engine {
  private ctx: BaseAudioContext;
  private master: GainNode;
  private pitch: ConstantSourceNode;
  private drive: GainNode;
  private filter: BiquadFilterNode;
  private body: GainNode;
  private burble: GainNode;
  private boostGain: GainNode;
  private boostBand: BiquadFilterNode;
  private screech: GainNode;
  private bandA: BiquadFilterNode;
  private bandB: BiquadFilterNode;
  private rumble: GainNode;
  private gravel: AudioBufferSourceNode;

  private last = 0;
  private prevSpeed = 0;
  private dv = 0;
  private load = 0;
  private gear = 0;
  private cutUntil = 0;
  private flare = 0;
  private live = false;
  private w = { pitch: { v: 0 }, drive: { v: 0 }, cut: { v: 0 }, body: { v: 0 }, burble: { v: 0 }, boost: { v: 0 }, band: { v: 0 }, screech: { v: 0 }, sA: { v: 0 }, sB: { v: 0 }, rumble: { v: 0 }, gravel: { v: 0 } };

  constructor(rig: Rig) {
    const ctx = (this.ctx = rig.ctx);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(rig.sfx);

    this.pitch = ctx.createConstantSource();
    this.pitch.offset.value = 0;
    this.pitch.start();

    // ---- body ----
    const mix = ctx.createGain();
    const firing = wave(ctx, [1, 0.72, 0.5, 0.42, 0.24, 0.17, 0.12, 0.09, 0.05, 0.04]);
    const cam = wave(ctx, [1, 0.35, 0.28, 0.1]); // half-order: the uneven lope of a real engine
    this.osc(firing, BASE_HZ, -7, 0.46, mix);
    this.osc(firing, BASE_HZ, 6, 0.46, mix);
    this.osc(cam, BASE_HZ / 2, 3, 0.62, mix);

    this.drive = ctx.createGain();
    this.drive.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClip(2.2);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;
    this.filter.Q.value = 4.5;
    const chest = ctx.createBiquadFilter(); // fixed exhaust resonance so it isn't just a moving filter
    chest.type = "peaking";
    chest.frequency.value = 340;
    chest.Q.value = 1.1;
    chest.gain.value = 5;
    this.body = ctx.createGain();
    this.body.gain.value = 0.06;
    mix.connect(this.drive).connect(shaper).connect(this.filter).connect(chest).connect(this.body).connect(this.master);

    // ---- off-throttle burble ----
    const pops = loop(rig, rig.crackle);
    const popBand = ctx.createBiquadFilter();
    popBand.type = "bandpass";
    popBand.frequency.value = 420;
    popBand.Q.value = 0.9;
    this.burble = gain(ctx, 0);
    pops.connect(popBand).connect(this.burble).connect(this.master);

    // ---- boost: turbo whine and hiss ----
    this.boostBand = ctx.createBiquadFilter();
    this.boostBand.type = "bandpass";
    this.boostBand.frequency.value = 2400;
    this.boostBand.Q.value = 1.4;
    this.boostGain = gain(ctx, 0);
    loop(rig, rig.white).connect(this.boostBand);
    const whine = ctx.createOscillator();
    whine.type = "triangle";
    whine.frequency.value = BASE_HZ * 4;
    this.pitch.connect(whine.detune);
    whine.start();
    whine.connect(gain(ctx, 0.5)).connect(this.boostBand);
    this.boostBand.connect(this.boostGain).connect(this.master);

    // ---- tyres ----
    this.bandA = band(ctx, SCREECH_HZ[0]!, 11);
    this.bandB = band(ctx, SCREECH_HZ[0]! * 1.5, 14);
    this.screech = gain(ctx, 0);
    const hiss = loop(rig, rig.white);
    hiss.connect(this.bandA).connect(this.screech);
    hiss.connect(this.bandB).connect(this.screech);
    this.screech.connect(this.master);

    this.gravel = loop(rig, rig.gravel);
    const dirt = ctx.createBiquadFilter();
    dirt.type = "lowpass";
    dirt.frequency.value = 420;
    this.rumble = gain(ctx, 0);
    this.gravel.connect(dirt).connect(this.rumble).connect(this.master);
  }

  /** Off on the menu, where the showcase bot is driving and nobody wants to hear it. */
  setLive(on: boolean, fade = 0.15) {
    if (on === this.live) return;
    this.live = on;
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, fade);
  }

  update(speedFrac: number, car: { boostT: number; driftDir: number; tier: number; onRoad: boolean; grounded: boolean; fallT?: number }) {
    const t = this.ctx.currentTime;
    const dt = t - this.last;
    // advance() and high-refresh screens call this far faster than a param needs
    if (dt < 0.03) return;
    this.last = t;
    if (!this.live) {
      this.prevSpeed = speedFrac;
      return;
    }

    const s = Math.max(0, speedFrac);
    const dv = (s - this.prevSpeed) / Math.min(dt, 0.1);
    this.prevSpeed = s;
    this.dv += (dv - this.dv) * Math.min(1, dt * 7);

    const boosting = car.boostT > 0;
    const driving = this.dv > OFF_THROTTLE || s > 1.02;
    const want = boosting ? 1 : s < 0.02 ? 0.25 : driving ? 1 : 0;
    this.load += (want - this.load) * Math.min(1, dt * (want > this.load ? 12 : 7));

    // ---- gearbox ----
    while (this.gear < GEARS.length - 1 && s > GEARS[this.gear]!.end) {
      this.gear++;
      this.cutUntil = t + SHIFT_CUT;
    }
    while (this.gear > 0 && s < GEARS[this.gear - 1]!.end - DOWNSHIFT_MARGIN) this.gear--;
    const g = GEARS[this.gear]!;
    const from = this.gear ? GEARS[this.gear - 1]!.end : 0;
    const r = Math.min(1, Math.max(0, (s - from) / (g.end - from)));
    let hz = g.lo * (g.hi / g.lo) ** r;

    // wheels unloaded (air, slide) let the revs run away from road speed
    const free = !car.grounded ? 0.16 : car.driftDir !== 0 ? 0.09 : !car.onRoad ? 0.05 : 0;
    this.flare += (free - this.flare) * Math.min(1, dt * (free > this.flare ? 5 : 11));
    hz *= 1 + this.flare * this.load;

    const cut = t < this.cutUntil;
    const load = cut ? 0.15 : this.load;
    const boost = boosting ? 1 : 0;
    const w = this.w;
    const cents = 1200 * Math.log2(hz / BASE_HZ);
    glide(this.pitch.offset, w.pitch, cents, t, cut ? 0.03 : 0.05);
    glide(this.drive.gain, w.drive, 0.55 + load * 0.9 + boost * 0.45, t, 0.03);
    glide(this.filter.frequency, w.cut, clamp(hz * (2.6 + load * 3.4 + boost * 9), 170, 6000), t, 0.04);
    glide(this.body.gain, w.body, (0.032 + 0.008 * this.gear + 0.029 * load + 0.008 * boost) * (cut ? 0.72 : 1), t, 0.02);

    const coast = (1 - this.load) * clamp((s - 0.12) * 3, 0, 1);
    glide(this.burble.gain, w.burble, cut ? 0.1 : coast * 0.2, t, 0.03);

    glide(this.boostGain.gain, w.boost, boost * 0.05, t, boost ? 0.03 : 0.16);
    glide(this.boostBand.frequency, w.band, clamp(hz * 11, 1500, 4800), t, 0.05);

    // ---- tyres ----
    const planted = car.grounded && !(car.fallT && car.fallT > 0);
    const sliding = car.driftDir !== 0 && planted && car.onRoad;
    const hzS = SCREECH_HZ[Math.min(3, car.tier)]! * (1 + (s - 0.8) * 0.14) * (1 + (Math.random() - 0.5) * 0.02);
    glide(this.bandA.frequency, w.sA, hzS, t, 0.05);
    glide(this.bandB.frequency, w.sB, hzS * 1.5, t, 0.05);
    glide(this.screech.gain, w.screech, sliding ? 0.75 + car.tier * 0.1 : 0, t, sliding ? 0.03 : 0.07);

    const rough = planted && !car.onRoad ? clamp(s * 2.2, 0, 1) : 0;
    glide(this.rumble.gain, w.rumble, rough * 0.2, t, 0.05);
    glide(this.gravel.playbackRate, w.gravel, 0.6 + s * 0.8, t, 0.1);
  }

  private osc(w: PeriodicWave, hz: number, detune: number, level: number, to: AudioNode) {
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(w);
    o.frequency.value = hz;
    o.detune.value = detune;
    this.pitch.connect(o.detune);
    o.connect(gain(this.ctx, level)).connect(to);
    o.start();
  }
}

function gain(ctx: BaseAudioContext, v: number) {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function band(ctx: BaseAudioContext, hz: number, q: number) {
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

function wave(ctx: BaseAudioContext, amps: number[]) {
  const n = amps.length + 1;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  amps.forEach((a, i) => (imag[i + 1] = a));
  return ctx.createPeriodicWave(real, imag);
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
