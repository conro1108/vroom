// All game sound is synthesized live with WebAudio — no audio assets, so it
// stays tiny and matches the pixel-art / chiptune vibe. Four voices:
//   - engine: a continuous grumbling putter that revs up with speed/throttle
//   - launch: a one-shot rev off the line (extra sparkle on a rocket start)
//   - drift:  a filtered-noise tire screech that swells with sideways slide
//   - whoosh: a stereo doppler swipe when an opponent zips past you
//
// The synth constants below are sound-design values (like the sprite palette in
// input.ts), not gameplay feel — the one player-facing feel knob, master
// volume, lives in Tuning and is passed in via setVolume().

import type { ItemKind } from "../game/items";

// ---- pure mappings (unit-tested; no WebAudio needed) ----

const IDLE_HZ = 44; // engine pitch at a dead stop — low for a growly rumble
const REV_HZ = 150; // extra pitch at full speed
const THROTTLE_HZ = 28; // extra pitch from flooring it (revs before speed builds)

/** Engine oscillator pitch (Hz) from how fast we're going and how hard we're on it. */
export function engineFreq(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return IDLE_HZ + frac * REV_HZ + clamp01(throttle) * THROTTLE_HZ;
}

/** Base engine loudness (0..1, pre master-volume). A present, growly rumble now
 *  — audible at idle and thickening under throttle/speed — but still well below
 *  the doppler vrooms, which stay the loud, fun peaks of the mix. */
export function engineGain(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return 0.032 + clamp01(throttle) * 0.038 + frac * 0.055;
}

/** Tremolo rate (Hz) of the grumble: a slow lopey chug at idle that smooths
 *  into a fast buzz at speed. Deep at idle so it reads as pistons firing —
 *  the mechanical chug, not a smooth hum. */
export function engineTremolo(forwardSpeed: number, maxSpeed: number): { rate: number; depth: number } {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return { rate: 7 + frac * 32, depth: 0.11 * (1 - frac * 0.55) };
}

/** Lowpass cutoff (Hz) for the engine. Opens up more than the old hum did so
 *  the sawtooth's harmonics come through as a mechanical buzz/growl, but stays
 *  low enough at idle to keep a throaty low end rather than a thin whine. */
export function engineCutoff(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return 340 + frac * 900 + clamp01(throttle) * 260;
}

/** Tire-screech loudness (0..1) from how much the car is sliding sideways.
 *  Tires start protesting *before* the drift break-point — grip complaining as
 *  you lean on it — and keep swelling once you're actually drifting (which is
 *  the more hardcore, louder end). Scaled to the car's own driftThreshold so it
 *  tracks whatever grip the current tuning has. */
export function driftGain(lateralSpeed: number, driftThreshold: number): number {
  const slip = Math.abs(lateralSpeed);
  const floor = driftThreshold * 0.45; // squeal begins here, below the break-point
  const full = driftThreshold * 2; // deep into a drift = full screech
  return clamp01((slip - floor) / Math.max(1, full - floor));
}

export const PASS_RADIUS = 72; // px: how close a car has to be to whoosh
const PASS_MIN_REL_SPEED = 55; // px/s of relative speed for it to read as "zipping" past

/** Strength (0..1) of a pass-by whoosh from how near and how fast the other car
 *  goes by, or 0 if it's too far or too slow relative to you to count. */
export function passStrength(distPx: number, relSpeed: number): number {
  if (distPx > PASS_RADIUS || Math.abs(relSpeed) < PASS_MIN_REL_SPEED) return 0;
  const near = 1 - distPx / PASS_RADIUS;
  const fast = clamp01((Math.abs(relSpeed) - PASS_MIN_REL_SPEED) / 180);
  return clamp01(near * 0.7 + fast * 0.6);
}

export interface Observer {
  x: number;
  y: number;
}

/** Place a few stationary "listeners" at the *dramatic* spots on the loop —
 *  the apex of a tight corner, or the middle of a long straight where you're
 *  flat-out — sitting just off the road (alternating sides). Crossing near one
 *  fires the doppler vroom, like a spectator hearing you rip past the place
 *  where the racing is tensest. Falls back to even spacing on a shapeless loop. */
export function observerPoints(samples: Observer[], count: number, offset: number): Observer[] {
  const n = samples.length;
  if (n < 2 || count < 1) return [];
  const picks = dramaticIndices(samples, count);
  const out: Observer[] = [];
  for (let k = 0; k < picks.length; k++) {
    const i = picks[k]!;
    const a = samples[i]!;
    const b = samples[(i + 1) % n]!;
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const side = k % 2 === 0 ? 1 : -1; // alternate which side of the road they stand on
    out.push({ x: a.x - ty * offset * side, y: a.y + tx * offset * side });
  }
  return out;
}

/** Turn magnitude (radians) of the corner around sample i, measured over a
 *  ±w window so a dense polyline reads as corners not micro-jitter. */
function windowedTurn(samples: Observer[], i: number, w: number): number {
  const n = samples.length;
  const a = samples[(i - w + n) % n]!;
  const b = samples[i]!;
  const c = samples[(i + w) % n]!;
  let d = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/** Fraction of the loop's tightest bend a spot must reach to count as a "tight
 *  corner." Below this it's a gentle sweeper or a straight — no vroom there. */
const TIGHT_FRAC = 0.55;

/** Pick up to `count` sample indices at the loop's tightest corners — one at the
 *  apex of each distinct bend, since the vroom is a trackside listener at the
 *  hairpins where the racing is tensest. A track with fewer sharp corners than
 *  `count` gets fewer listeners rather than one parked on a straight, and two
 *  never land on the same corner. */
function dramaticIndices(samples: Observer[], count: number): number[] {
  const n = samples.length;
  const w = Math.max(1, Math.floor(n / 48));
  const turn = samples.map((_, i) => windowedTurn(samples, i, w));
  const maxTurn = Math.max(1e-6, ...turn);

  // Uniformly-curved loop (a circle, or a square that's all corners and no
  // straights): there are no distinct bends to single out, so fall back to
  // even spacing so it still gets its full set of listeners.
  const tight = turn.map((t) => t >= TIGHT_FRAC * maxTurn);
  if (tight.every(Boolean)) {
    return Array.from({ length: count }, (_, k) => Math.floor((k * n) / count));
  }

  // Group the loop's contiguous "tight" stretches into runs (one per bend,
  // wrapping across the start/end seam), keeping each run's apex — the single
  // sharpest sample — and how tight that apex is.
  const start = tight.findIndex((t, i) => t && !tight[(i - 1 + n) % n]!);
  const apexes: { i: number; turn: number }[] = [];
  if (start >= 0) {
    let apex = -1;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (tight[i]) {
        if (apex < 0 || turn[i]! > turn[apex]!) apex = i;
      } else if (apex >= 0) {
        apexes.push({ i: apex, turn: turn[apex]! });
        apex = -1;
      }
    }
    if (apex >= 0) apexes.push({ i: apex, turn: turn[apex]! });
  }

  // Take the tightest corners, up to count. Fewer corners than count → fewer.
  return apexes
    .sort((a, b) => b.turn - a.turn)
    .slice(0, count)
    .map((c) => c.i)
    .sort((a, b) => a - b);
}

/** Stereo pan (-1 left .. 1 right) for an object at world offset (dx,dy) given
 *  the camera looks along the car's heading. Cars sliding by on your right
 *  whoosh on the right. */
export function panForOffset(dx: number, dy: number, heading: number): number {
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return 0;
  // On a y-down canvas the driver's right is forward rotated CCW: (-sin, cos).
  const right = (dy * Math.cos(heading) - dx * Math.sin(heading)) / dist;
  return clamp(right, -1, 1);
}

// ---- the live synth ----

export interface EngineFrame {
  active: boolean; // engine audible this frame (racing / countdown / calibrating)
  forwardSpeed: number;
  maxSpeed: number;
  throttle: number; // 0..1
  lateralSpeed: number; // px/s sideways
  driftThreshold: number; // px/s of slide where this tuning breaks into a drift
}

export interface GameAudio {
  /** Feed the continuous voices (engine + drift) once per rendered frame. */
  update(f: EngineFrame): void;
  /** One-shot rev off the line; rocket start gets extra pitch and sparkle. */
  launch(rocket: boolean): void;
  /** One-shot doppler swipe as an opponent passes; pan -1..1, strength 0..1. */
  whoosh(pan: number, strength: number): void;
  /** Cheery "get" when you grab an item box. */
  pickup(): void;
  /** The distinct noise for firing/using a held item. */
  item(kind: ItemKind): void;
  /** Comedic descending "wah" when a hit spins you out. */
  spun(): void;
  /** Air-rush swell when a slipstream charge pays off into a boost. */
  slipstream(): void;
  /** Louder engine-flavored doppler vroom, fired as you rip past an observer;
   *  pan points toward the listener (-1 left .. 1 right), strength 0..1,
   *  seconds sets how drawn-out the flyby is. */
  vroom(pan: number, strength: number, seconds: number): void;
  /** Master volume, 0..1 (0 mutes). Comes from Tuning.soundVolume. */
  setVolume(v: number): void;
  /** Resume the context from a user gesture (mobile autoplay unlock). */
  resume(): void;
}

type Ctx = AudioContext;

function makeNoiseBuffer(ctx: Ctx): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * Build the live audio engine. If WebAudio is unavailable (SSR / tests / no
 * permission), returns a no-op so callers never have to guard.
 */
export function createAudio(volume: number): GameAudio {
  const AC: typeof AudioContext | undefined =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AC) return noopAudio();

  let ctx: Ctx;
  try {
    ctx = new AC();
  } catch {
    return noopAudio();
  }

  let master = clamp01(volume);
  const masterGain = ctx.createGain();
  masterGain.gain.value = master;
  masterGain.connect(ctx.destination);

  const noise = makeNoiseBuffer(ctx);

  // --- persistent engine voice ---
  // A pair of sawtooths (rich in harmonics = mechanical/buzzy) that beat
  // against each other for a rough motor grind, plus a sine sub for body. A
  // deep tremolo chops the whole thing into a piston-y chug.
  const engOsc = ctx.createOscillator();
  engOsc.type = "sawtooth";
  const engOsc2 = ctx.createOscillator(); // a detuned twin so it grinds/beats
  engOsc2.type = "sawtooth";
  engOsc2.detune.value = 26; // a touch sharp — the roughness that reads as gears
  const engSub = ctx.createOscillator(); // an octave down for a little body
  engSub.type = "sine";
  const engFilter = ctx.createBiquadFilter();
  engFilter.type = "lowpass";
  engFilter.frequency.value = 500;
  const engGain = ctx.createGain();
  engGain.gain.value = 0;
  // tremolo LFO modulates the engine gain to make the chug
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(engGain.gain);
  engOsc.connect(engFilter);
  engOsc2.connect(engFilter);
  engSub.connect(engFilter);
  engFilter.connect(engGain).connect(masterGain);
  engOsc.start();
  engOsc2.start();
  engSub.start();
  lfo.start();

  // --- persistent drift voice ---
  const driftSrc = ctx.createBufferSource();
  driftSrc.buffer = noise;
  driftSrc.loop = true;
  const driftFilter = ctx.createBiquadFilter();
  driftFilter.type = "bandpass";
  driftFilter.frequency.value = 1200;
  driftFilter.Q.value = 6;
  const driftGainNode = ctx.createGain();
  driftGainNode.gain.value = 0;
  driftSrc.connect(driftFilter).connect(driftGainNode).connect(masterGain);
  driftSrc.start();

  const resume = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  };

  return {
    resume,
    setVolume(v) {
      master = clamp01(v);
      masterGain.gain.setTargetAtTime(master, ctx.currentTime, 0.02);
    },
    update(f) {
      if (master <= 0) return;
      const now = ctx.currentTime;
      const targetEng = f.active ? engineGain(f.forwardSpeed, f.maxSpeed, f.throttle) : 0;
      const freq = engineFreq(f.forwardSpeed, f.maxSpeed, f.throttle);
      const trem = engineTremolo(f.forwardSpeed, f.maxSpeed);
      // ~30ms smoothing so parameter changes glide instead of zippering
      engOsc.frequency.setTargetAtTime(freq, now, 0.03);
      engOsc2.frequency.setTargetAtTime(freq, now, 0.03);
      engSub.frequency.setTargetAtTime(freq / 2, now, 0.03);
      engFilter.frequency.setTargetAtTime(engineCutoff(f.forwardSpeed, f.maxSpeed, f.throttle), now, 0.03);
      engGain.gain.setTargetAtTime(targetEng, now, 0.05);
      lfo.frequency.setTargetAtTime(trem.rate, now, 0.05);
      lfoDepth.gain.setTargetAtTime(f.active ? trem.depth * targetEng * 6 : 0, now, 0.05);

      driftGainNode.gain.setTargetAtTime(
        f.active ? driftGain(f.lateralSpeed, f.driftThreshold) * 0.45 : 0,
        now,
        0.04
      );
      driftFilter.frequency.setTargetAtTime(
        1100 + clamp01(f.forwardSpeed / Math.max(1, f.maxSpeed)) * 1300,
        now,
        0.04
      );
    },
    launch(rocket) {
      if (master <= 0) return;
      resume();
      const now = ctx.currentTime;
      const top = rocket ? 340 : 210; // lower top for a growlier pull-off
      // rev sweep
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1900; // a touch darker to match the lower rev
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.52, now + 0.05); // louder off the line
      g.gain.exponentialRampToValueAtTime(0.0001, now + (rocket ? 0.5 : 0.38));
      osc.frequency.setValueAtTime(70, now);
      osc.frequency.exponentialRampToValueAtTime(top, now + (rocket ? 0.4 : 0.3));
      osc.connect(filt).connect(g).connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.6);

      // tire chirp off the line
      chirp(ctx, noise, masterGain, now, 0.12, 0.25);

      // rocket-start sparkle: three ascending blips
      if (rocket) {
        [660, 880, 1180].forEach((hz, i) => blip(ctx, masterGain, now + 0.08 + i * 0.07, hz, 0.18));
      }
    },
    whoosh(pan, strength) {
      if (master <= 0 || strength <= 0) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(350, now);
      bp.frequency.exponentialRampToValueAtTime(1500, now + 0.16);
      bp.frequency.exponentialRampToValueAtTime(300, now + 0.34);
      const g = ctx.createGain();
      const peak = 0.28 * clamp01(strength);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      let out: AudioNode = g;
      // sweep the pan across the stereo field toward the side it passed on
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        const side = clamp(pan, -1, 1);
        panner.pan.setValueAtTime(-side * 0.7, now);
        panner.pan.linearRampToValueAtTime(side * 0.9, now + 0.34);
        g.connect(panner);
        out = panner;
      }
      src.connect(bp).connect(g);
      out.connect(masterGain);
      src.start(now);
      src.stop(now + 0.4);
    },
    pickup() {
      if (master <= 0) return;
      resume();
      const now = ctx.currentTime;
      // a bright two-note ping — the "you got it" jingle
      blip(ctx, masterGain, now, 660, 0.16);
      blip(ctx, masterGain, now + 0.08, 990, 0.18);
    },
    item(kind) {
      if (master <= 0) return;
      resume();
      const now = ctx.currentTime;
      if (kind === "turbo") {
        // rising power-up whoosh: a swept-bright noise plus an up-glide tone
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(300, now);
        bp.frequency.exponentialRampToValueAtTime(2600, now + 0.34);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, now);
        ng.gain.exponentialRampToValueAtTime(0.3, now + 0.08);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        src.connect(bp).connect(ng).connect(masterGain);
        src.start(now);
        src.stop(now + 0.45);
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(220, now);
        o.frequency.exponentialRampToValueAtTime(880, now + 0.32);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.13, now + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        o.connect(g).connect(masterGain);
        o.start(now);
        o.stop(now + 0.4);
      } else if (kind === "oil") {
        // a wet splat: short lowpassed noise that dives dark
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(1200, now);
        lp.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        src.connect(lp).connect(g).connect(masterGain);
        src.start(now);
        src.stop(now + 0.25);
      } else {
        // a fired shot (rocket / missile / crown): a zappy down-swept "pew"
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(900, now);
        o.frequency.exponentialRampToValueAtTime(180, now + 0.22);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1;
        bp.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        o.connect(bp).connect(g).connect(masterGain);
        o.start(now);
        o.stop(now + 0.3);
        chirp(ctx, noise, masterGain, now, 0.18, 0.22); // launch hiss
        // the crown gets a little regal fanfare on top
        if (kind === "crown") {
          [784, 988, 1319].forEach((hz, i) => blip(ctx, masterGain, now + 0.05 + i * 0.06, hz, 0.15));
        }
      }
    },
    spun() {
      if (master <= 0) return;
      resume();
      const now = ctx.currentTime;
      // a comedic descending "waaah" as you lose it
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(400, now);
      o.frequency.exponentialRampToValueAtTime(120, now + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      o.connect(lp).connect(g).connect(masterGain);
      o.start(now);
      o.stop(now + 0.5);
    },
    slipstream() {
      if (master <= 0) return;
      resume();
      const now = ctx.currentTime;
      // Pure air, no tone: a wide band of noise that swells in from nothing and
      // sweeps up as the pocket of still air lets go and shoves you forward.
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.7; // wide = airy rush rather than the whistly pass-by whoosh
      bp.frequency.setValueAtTime(240, now);
      bp.frequency.exponentialRampToValueAtTime(3200, now + 0.42);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.32, now + 0.22); // slow swell, quick let-go
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      src.connect(bp).connect(g).connect(masterGain);
      src.start(now);
      src.stop(now + 0.55);
      // a soft low thump under it — the shove in the back
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(120, now);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.3);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.16, now + 0.1);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
      o.connect(og).connect(masterGain);
      o.start(now);
      o.stop(now + 0.4);
    },
    vroom(pan, strength, seconds) {
      if (master <= 0 || strength <= 0) return;
      resume();
      const now = ctx.currentTime;
      // An F1 flyby heard from trackside: a high metallic scream that HOLDS an
      // elevated pitch as the car bears down on you, then snaps down the instant
      // it passes ("nyeeeeEEE-yowwwm") and fades darker as it tears away. The
      // whole thing scales with `seconds` — a quick zip to a long drawn-out pass.
      // peakT is closest approach: loudest, brightest, and the pitch drop.
      // The pass sits deep in the window (peakT) so the buildup is a long, slow
      // low gather — "mmmmmmmMM" — that dwarfs the pass itself, then one hard
      // crack and a quick "owww" fade away. Buildup ~6x the recede.
      const d = clamp(seconds, 0.2, 4);
      const peakT = d * (6 / 7);
      const endT = d;
      const stop = now + endT + 0.08;
      const s = clamp01(strength);
      const peak = 1.0 * s; // the loud crack at the pass
      // Doppler pitch: elevated approaching, depressed receding. The snap-down
      // happens over `dropDur` centred on the pass — tighter = a sharper zip-by.
      const baseHz = 150 + s * 50; // a screaming fundamental (F1, not muscle car)
      const approachHz = baseHz * 3.6; // a high wail bearing down — wider swing
      const recedeHz = baseHz * 0.2; // and a deeper drop as it tears away
      const dropDur = clamp(d * 0.13, 0.05, 0.22); // sharp, so the pass really cracks

      // Brightness climbs to the pass, then muffles over the long recede tail.
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(6000, now + peakT);
      lp.frequency.exponentialRampToValueAtTime(700, now + endT);
      // Loudness eases up smoothly out of near-silence, spikes at the pass, then
      // decays over the long tail — no held plateau, which is what made it read
      // as a symmetric parabola before.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + peakT);
      g.gain.exponentialRampToValueAtTime(0.0001, now + endT);
      lp.connect(g);

      // Three saw layers make a rich metallic scream — the fundamental, a
      // slightly detuned twin that beats/shimmers, and an octave-up wail for the
      // piercing top — plus a quiet sub sine so it isn't thin.
      const layers: { type: OscillatorType; mul: number; gain: number }[] = [
        { type: "sawtooth", mul: 1, gain: 1 },
        { type: "sawtooth", mul: 1.007, gain: 0.7 },
        { type: "sawtooth", mul: 2, gain: 0.32 },
        { type: "sine", mul: 0.5, gain: 0.28 },
      ];
      const oscs = layers.map((L) => {
        const o = ctx.createOscillator();
        o.type = L.type;
        const og = ctx.createGain();
        og.gain.value = L.gain;
        dopplerSweep(o.frequency, now, approachHz * L.mul, recedeHz * L.mul, peakT, dropDur, endT);
        o.connect(og).connect(lp);
        return o;
      });

      // an airy noise layer for the "tearing past" body
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true; // so a long vroom doesn't run past the 2s buffer
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(700, now);
      bp.frequency.exponentialRampToValueAtTime(2600, now + peakT);
      bp.frequency.exponentialRampToValueAtTime(500, now + endT);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(peak * 0.3, now + peakT);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + endT);
      src.connect(bp).connect(ng);

      // sweep the whole thing across the stereo field, front-past-to-behind
      if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        const side = clamp(pan, -1, 1);
        panner.pan.setValueAtTime(-side * 0.85, now);
        panner.pan.linearRampToValueAtTime(side * 0.95, now + endT);
        g.connect(panner);
        ng.connect(panner);
        panner.connect(masterGain);
      } else {
        g.connect(masterGain);
        ng.connect(masterGain);
      }
      oscs.forEach((o) => {
        o.start(now);
        o.stop(stop);
      });
      src.start(now);
      src.stop(stop);
    },
  };
}

/** Doppler pitch contour for a flyby: ease gently up to the elevated `approach`
 *  pitch as the car gathers on you, snap down hard to `recede` over a short
 *  `dropDur` centred on closest approach (`peakT`), then keep gliding down a
 *  touch through the long recede tail (out to `endT`) as it shrinks into the
 *  distance. The gentle-in / hard-drop / long-out shape is the signature of the
 *  trackside F1 scream — a symmetric swell reads as a siren instead. */
function dopplerSweep(
  p: AudioParam,
  at: number,
  approach: number,
  recede: number,
  peakT: number,
  dropDur: number,
  endT: number
): void {
  const dropStart = Math.max(0.01, peakT - dropDur * 0.5);
  p.setValueAtTime(approach * 0.82, at); // start a touch low...
  p.exponentialRampToValueAtTime(approach, at + dropStart); // ...ease up as it gathers
  p.exponentialRampToValueAtTime(recede, at + dropStart + dropDur); // hard snap-down at the pass
  p.exponentialRampToValueAtTime(recede * 0.8, at + endT); // keep sinking down the long tail
}

function chirp(ctx: Ctx, noise: AudioBuffer, out: AudioNode, at: number, dur: number, level: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(2400, at);
  bp.frequency.exponentialRampToValueAtTime(900, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.05);
}

function blip(ctx: Ctx, out: AudioNode, at: number, hz: number, level: number): void {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = hz;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + 0.12);
}

function noopAudio(): GameAudio {
  return {
    update() {},
    launch() {},
    whoosh() {},
    pickup() {},
    item() {},
    spun() {},
    slipstream() {},
    vroom() {},
    setVolume() {},
    resume() {},
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
