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

// ---- pure mappings (unit-tested; no WebAudio needed) ----

const IDLE_HZ = 60; // engine pitch at a dead stop
const REV_HZ = 175; // extra pitch at full speed
const THROTTLE_HZ = 28; // extra pitch from flooring it (revs before speed builds)

/** Engine oscillator pitch (Hz) from how fast we're going and how hard we're on it. */
export function engineFreq(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return IDLE_HZ + frac * REV_HZ + clamp01(throttle) * THROTTLE_HZ;
}

/** Base engine loudness (0..1, pre master-volume). Deliberately near-silent —
 *  normal driving is flat, so a constant drone just grates. This is a
 *  barely-there hum; the doppler vrooms do all the loud, fun work. */
export function engineGain(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return 0.006 + clamp01(throttle) * 0.008 + frac * 0.014;
}

/** Tremolo rate (Hz) of the grumble: a slow lopey putter at idle that smooths
 *  into a fast buzz at speed. This is what reads as "cute engine." */
export function engineTremolo(forwardSpeed: number, maxSpeed: number): { rate: number; depth: number } {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return { rate: 6 + frac * 30, depth: 0.06 * (1 - frac * 0.6) };
}

/** Lowpass cutoff (Hz) for the idle hum. Kept low so the ongoing engine stays
 *  soft and un-buzzy — it barely opens up with revs on purpose. */
export function engineCutoff(forwardSpeed: number, maxSpeed: number, throttle: number): number {
  const frac = clamp01(forwardSpeed / Math.max(1, maxSpeed));
  return 260 + frac * 700 + clamp01(throttle) * 180;
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

/** Scatter a few stationary "listeners" around the loop, sitting just off the
 *  road (alternating sides). Crossing near one fires the doppler vroom — like a
 *  spectator hearing you rip past — which gives the sound a sporadic, positional
 *  feel instead of firing on every steering input. */
export function observerPoints(samples: Observer[], count: number, offset: number): Observer[] {
  const n = samples.length;
  if (n < 2 || count < 1) return [];
  const out: Observer[] = [];
  for (let k = 0; k < count; k++) {
    const i = Math.floor(((k + 0.5) / count) * n) % n; // spread around, skip the start line
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
  const engOsc = ctx.createOscillator();
  engOsc.type = "triangle"; // soft, un-buzzy — this is only a faint idle hum
  const engSub = ctx.createOscillator(); // an octave down for a little body
  engSub.type = "sine";
  const engFilter = ctx.createBiquadFilter();
  engFilter.type = "lowpass";
  engFilter.frequency.value = 500;
  const engGain = ctx.createGain();
  engGain.gain.value = 0;
  // tremolo LFO modulates the engine gain to make the putter
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(engGain.gain);
  engOsc.connect(engFilter);
  engSub.connect(engFilter);
  engFilter.connect(engGain).connect(masterGain);
  engOsc.start();
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
      const top = rocket ? 420 : 260;
      // rev sweep
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (rocket ? 0.5 : 0.38));
      osc.frequency.setValueAtTime(90, now);
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
    vroom(pan, strength, seconds) {
      if (master <= 0 || strength <= 0) return;
      resume();
      const now = ctx.currentTime;
      // An F1 flyby heard from trackside: a high metallic scream that HOLDS an
      // elevated pitch as the car bears down on you, then snaps down the instant
      // it passes ("nyeeeeEEE-yowwwm") and fades darker as it tears away. The
      // whole thing scales with `seconds` — a quick zip to a long drawn-out pass.
      // peakT is closest approach: loudest, brightest, and the pitch drop.
      const d = clamp(seconds, 0.2, 4);
      const peakT = d * 0.52;
      const endT = d;
      const stop = now + endT + 0.08;
      const s = clamp01(strength);
      const peak = 0.5 * s;
      // Doppler pitch: elevated approaching, depressed receding. The snap-down
      // happens over `dropDur` centred on the pass — tighter = a sharper zip-by.
      const baseHz = 300 + s * 90; // a screaming fundamental (F1, not muscle car)
      const approachHz = baseHz * 1.5;
      const recedeHz = baseHz * 0.62;
      const dropDur = clamp(d * 0.2, 0.08, 0.35);

      // Brightness peaks at the pass and muffles as it recedes.
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(6000, now + peakT);
      lp.frequency.exponentialRampToValueAtTime(900, now + endT);
      // Loudness swells in, holds loud across the pass, then fades receding.
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + Math.max(0.02, peakT - dropDur * 0.5));
      g.gain.setValueAtTime(peak, now + peakT + dropDur * 0.5);
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
        dopplerSweep(o.frequency, now, approachHz * L.mul, recedeHz * L.mul, peakT, dropDur);
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

/** Doppler pitch contour for a flyby: hold the elevated `approach` pitch while
 *  the car bears down, then snap down to the depressed `recede` pitch over a
 *  short `dropDur` window centred on closest approach (`peakT`), and stay there
 *  as it tears away. The near-instant drop through the pass is the signature of
 *  the trackside F1 scream — a smooth symmetric swell reads as a siren instead. */
function dopplerSweep(
  p: AudioParam,
  at: number,
  approach: number,
  recede: number,
  peakT: number,
  dropDur: number
): void {
  const dropStart = Math.max(0.01, peakT - dropDur * 0.5);
  p.setValueAtTime(approach, at);
  p.setValueAtTime(approach, at + dropStart); // hold elevated through the approach
  p.exponentialRampToValueAtTime(recede, at + dropStart + dropDur); // snap down at the pass
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
