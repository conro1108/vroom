// The shared audio graph everything plugs into: the two buses, the master chain
// and the looped noise buffers. Only sound.ts builds one, so the rest of src/audio
// can assume a live context.

export interface Rig {
  ctx: BaseAudioContext;
  sfx: GainNode;
  music: GainNode;
  out: GainNode;
  white: AudioBuffer;
  crackle: AudioBuffer; // sparse exhaust pops
  gravel: AudioBuffer; // lumpy low rumble
}

export function buildRig(ctx: BaseAudioContext): Rig {
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  const mix = ctx.createGain();
  mix.gain.value = 0.72;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 8;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  // The compressor's attack lets the front of a transient through and it adds
  // makeup gain, so a stack of impacts can still overshoot without this.
  const clip = ctx.createWaveShaper();
  clip.curve = softClip(1.2);
  const out = ctx.createGain();
  sfx.connect(mix);
  music.connect(mix);
  mix.connect(comp).connect(clip).connect(out).connect(ctx.destination);
  return {
    ctx, sfx, music, out,
    white: buffer(ctx, 2, () => Math.random() * 2 - 1),
    crackle: crackleBuffer(ctx),
    gravel: gravelBuffer(ctx),
  };
}

export function softClip(drive: number, n = 1024) {
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) curve[i] = (Math.tanh(((i / (n - 1)) * 2 - 1) * drive) / norm) * 0.97;
  return curve;
}

/** Writes a param only when it moved, since engine() would otherwise grow the timeline every frame. */
export function glide(p: AudioParam, last: { v: number }, v: number, t: number, tc: number) {
  if (Math.abs(v - last.v) <= Math.abs(last.v) * 0.004 + 1e-4) return;
  last.v = v;
  p.setTargetAtTime(v, t, tc);
}

export function loop(rig: Rig, buf: AudioBuffer) {
  const s = rig.ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start();
  return s;
}

/** One-shot noise burst from a random point in the shared buffer. */
export function burst(rig: Rig, t: number, dur: number) {
  const s = rig.ctx.createBufferSource();
  s.buffer = rig.white;
  s.start(t, Math.random() * 1.5, dur);
  return s;
}

function buffer(ctx: BaseAudioContext, seconds: number, f: (i: number) => number) {
  const b = ctx.createBuffer(1, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = f(i);
  return b;
}

function crackleBuffer(ctx: BaseAudioContext) {
  let hit = 0;
  let next = 0;
  return buffer(ctx, 3, (i) => {
    if (i >= next) {
      hit = 0.35 + Math.random() * 0.65;
      next = i + ctx.sampleRate * (0.035 + Math.random() * Math.random() * 0.2);
    }
    hit *= 0.9975;
    return (Math.random() * 2 - 1) * hit;
  });
}

function gravelBuffer(ctx: BaseAudioContext) {
  let lp = 0;
  let lump = 0;
  return buffer(ctx, 2, (i) => {
    if (i % 900 === 0) lump = 0.3 + Math.random() * 0.7;
    lp += ((Math.random() * 2 - 1) * lump - lp) * 0.06;
    return lp * 4;
  });
}
