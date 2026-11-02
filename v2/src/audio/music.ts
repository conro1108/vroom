// The soundtrack: a lookahead sequencer that plays a Song, plus its synth voices.
//
// Model: pump() runs off a timer and schedules whole 16th-note steps a little
// ahead on the audio clock, so timing never depends on the frame rate. Each note
// is a few short-lived nodes feeding per-part buses that are built once per song.
import { burst, type Rig } from "./rig";
import { SONGS, type Part, type Patch, type Song } from "./songs";

const LOOKAHEAD = 0.26; // survives a phone's timer stalling for most of a frame budget
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Chord {
  root: number; // pitch class
  bass: number;
  tones: number[]; // semitones above root
}

interface Note { midi: number; steps: number }

interface Bar {
  chords: Chord[];
  lead: Map<number, Note>;
}

interface Bus { in: GainNode; level: number }

// ---- parsing ----

function pitchClass(n: string) {
  return (PC[n[0]!]! + (n[1] === "#" ? 1 : n[1] === "b" ? -1 : 0) + 12) % 12;
}

function parseChord(s: string): Chord {
  const m = /^([A-G][#b]?)(maj7|m7|m|7|sus4|dim)?(?:\/([A-G][#b]?))?$/.exec(s);
  if (!m) throw new Error(`bad chord ${s}`);
  const tones = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m: [0, 3, 7], "7": [0, 4, 7, 10], sus4: [0, 5, 7], dim: [0, 3, 6] }[m[2] ?? ""] ?? [0, 4, 7];
  const root = pitchClass(m[1]!);
  return { root, bass: m[3] ? pitchClass(m[3]) : root, tones };
}

function midiOf(n: string) {
  const m = /^([A-G][#b]?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return pitchClass(m[1]!) + (Number(m[2]) + 1) * 12;
}

function parseLead(bar: string) {
  const tokens = bar.trim().split(/\s+/);
  const stride = 16 / tokens.length;
  const out = new Map<number, Note>();
  let cur: Note | null = null;
  tokens.forEach((tok, i) => {
    if (tok === "-") {
      if (cur) cur.steps += stride;
    } else if (tok === ".") {
      cur = null;
    } else {
      cur = { midi: midiOf(tok), steps: stride };
      out.set(i * stride, cur);
    }
  });
  return out;
}

function parseSection(s: { chords: string; lead: string }): Bar[] {
  const chords = s.chords.split("|");
  const leads = s.lead.split("|");
  return chords.map((c, i) => ({ chords: c.trim().split(/\s+/).map(parseChord), lead: parseLead(leads[i]!) }));
}

// ---- the improvised section ----

/** Reuses the hook's rhythm, so a random walk still sounds like this tune's phrasing. */
function improvise(song: Song, hook: Bar[], rand: () => number): Bar[] {
  const notes = hook.flatMap((b) => [...b.lead.values()].map((n) => n.midi));
  const lo = Math.min(...notes);
  const hi = Math.max(...notes);
  const pitches: number[] = [];
  for (let m = lo; m <= hi; m++) if (song.scale.includes(((m - song.key) % 12 + 12) % 12)) pitches.push(m);
  let at = Math.floor(pitches.length / 2);
  return hook.map((bar, b) => {
    const rhythm = hook[b % 4]!.lead;
    const lead = new Map<number, Note>();
    for (const [step, n] of rhythm) {
      at = Math.max(0, Math.min(pitches.length - 1, at + Math.round((rand() - 0.5) * 5)));
      let midi = pitches[at]!;
      const chord = bar.chords[step < 8 || bar.chords.length === 1 ? 0 : 1]!;
      if (step % 8 === 0 || n.steps >= 4) midi = nearestTone(midi, chord);
      lead.set(step, { midi, steps: n.steps });
    }
    return { chords: bar.chords, lead };
  });
}

function nearestTone(midi: number, c: Chord) {
  for (let d = 0; d < 7; d++) {
    for (const m of [midi - d, midi + d]) {
      if (c.tones.includes(((m - c.root) % 12 + 12) % 12)) return m;
    }
  }
  return midi;
}

/** Harmony voice: the nearest chord tone at least a third below, so it can't clash. */
function twinOf(midi: number, c: Chord) {
  for (let m = midi - 3; m > midi - 10; m--) {
    if (c.tones.includes(((m - c.root) % 12 + 12) % 12)) return m;
  }
  return midi - 12;
}

function degree(c: Chord, digit: string, low: number, slash: boolean) {
  const base = low + ((((slash ? c.bass : c.root) - low) % 12) + 12) % 12;
  const t = c.tones;
  switch (digit) {
    case "3": return low + ((c.root + t[1]! - low) % 12 + 12) % 12;
    case "5": return low + ((c.root + t[2]! - low) % 12 + 12) % 12;
    case "7": return low + ((c.root + t[t.length > 3 ? 3 : 2]! - low) % 12 + 12) % 12;
    case "8": return base + 12;
    default: return base;
  }
}

function holdOf(line: string, i: number) {
  let n = 1;
  while (line[(i + n) % line.length] === "-" && n < 16) n++;
  return n;
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- sequencer ----

export class Music {
  private ctx: BaseAudioContext;
  private song: Song | null = null;
  private theme = "";
  private key = 60;
  private sections: Record<string, Bar[]> = {};
  private bus!: GainNode;
  private parts!: { lead: Bus; bass: Bus; comp: Bus; arp: Bus; drums: Bus; hat: BiquadFilterNode; snare: BiquadFilterNode };
  private rand = Math.random;
  private nextT = 0;
  private form = 0;
  private bar = 0;
  private step = 0;
  private bars = 0;
  private current: Bar[] = [];
  private bpm = 120;
  private transpose = 0;
  private lifted = false;
  private liftPending = false;
  private crashNext = false;
  private seed = (Math.random() * 1e9) | 0;
  /** Skip building notes while muted; the song keeps its place. */
  silent = false;

  constructor(private rig: Rig) {
    this.ctx = rig.ctx;
  }

  get playing() {
    return this.song !== null;
  }

  /** Holds through the silent countdown, so GO lands in the key of what follows. */
  get root() {
    return this.key + this.transpose;
  }

  /** `fresh` restarts from the top with a crash even if this tune is already on. */
  play(theme: string, fresh = false) {
    if (!fresh && this.song && theme === this.theme) {
      this.lifted = this.liftPending = false;
      this.transpose = 0;
      this.bpm = this.song.bpm;
      return;
    }
    this.stop(0.12);
    const song = SONGS[theme] ?? SONGS.meadow!;
    this.theme = theme;
    this.song = song;
    this.key = song.key;
    this.bpm = song.bpm;
    this.transpose = 0;
    this.lifted = this.liftPending = false;
    this.rand = mulberry(this.seed++);
    this.sections = Object.fromEntries(Object.entries(song.sections).map(([k, v]) => [k, parseSection(v)]));
    this.buildBuses(song);
    this.form = this.bar = this.step = this.bars = 0;
    this.enter();
    this.crashNext = fresh;
    this.nextT = this.ctx.currentTime + 0.06;
  }

  stop(fade = 0.5) {
    if (!this.song) return;
    this.song = null;
    const bus = this.bus;
    bus.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    if (typeof setTimeout === "function") setTimeout(() => bus.disconnect(), (fade + 0.4) * 1000);
  }

  /** Final lap: back to the hook at the next bar, up a key, a touch faster, everything in. */
  lift() {
    if (this.song && !this.lifted) this.liftPending = true;
  }

  pump() {
    if (!this.song) return;
    const now = this.ctx.currentTime;
    if (this.nextT < now) this.nextT = now + 0.02;
    while (this.nextT < now + LOOKAHEAD) {
      const dur = 15 / this.bpm;
      if (this.step === 0 && this.liftPending) this.applyLift();
      if (!this.silent) this.play16th(this.nextT + (this.step % 2 ? this.song.swing * dur : 0), dur);
      this.advance();
      this.nextT += dur;
    }
  }

  private applyLift() {
    const song = this.song!;
    this.liftPending = false;
    this.lifted = true;
    this.transpose = song.lift;
    this.bpm = song.bpm * 1.05;
    this.form = this.bar = 0;
    this.enter();
    this.crashNext = true;
  }

  private enter() {
    const song = this.song!;
    const name = song.form[this.form % song.form.length]!;
    this.current = name === "S" ? improvise(song, this.sections.A!, this.rand) : this.sections[name]!;
    if (name !== "A" || this.form > 0) this.crashNext = true;
  }

  private advance() {
    if (++this.step < 16) return;
    this.step = 0;
    this.bars++;
    if (++this.bar >= this.current.length) {
      this.bar = 0;
      this.form = (this.form + 1) % this.song!.form.length;
      this.enter();
    }
  }

  private play16th(t: number, dur: number) {
    const song = this.song!;
    const bar = this.current[this.bar]!;
    const s = this.step;
    const at = this.bars * 16 + s;
    const chord = bar.chords[s < 8 || bar.chords.length === 1 ? 0 : 1]!;
    const up = this.transpose;
    const { lead, bass, comp, arp } = this.parts;

    // ---- drums ----
    const last = this.bar === this.current.length - 1;
    if (this.crashNext && s === 0) {
      this.crash(t);
      this.crashNext = false;
    }
    this.drums(song, at, s, t, last && s >= 8);

    // ---- bass ----
    const b = song.lines.bass[at % song.lines.bass.length]!;
    if (/\d/.test(b)) {
      const held = holdOf(song.lines.bass, at % song.lines.bass.length);
      this.note(song.bass.patch, bass, degree(chord, b, song.bassLow, true) + up, t, dur * (held + 0.5), 1);
    }

    // ---- chords ----
    const c = song.lines.comp[at % song.lines.comp.length];
    if (c === "x") {
      const held = holdOf(song.lines.comp, at % song.lines.comp.length);
      // the bass has the root, so a four-note chord can spare it
      const tones = chord.tones.length > 3 ? chord.tones.slice(1) : chord.tones;
      for (const tone of tones) {
        const m = song.compLow + ((chord.root + tone - song.compLow) % 12 + 12) % 12;
        this.note(song.comp.patch, comp, m + up, t, dur * held, 1);
      }
    }

    // ---- arp ----
    const name = song.form[this.form]!;
    if (this.lifted || song.arpIn.includes(name)) {
      const a = song.lines.arp[at % song.lines.arp.length]!;
      if (/\d/.test(a)) this.note(song.arp.patch, arp, degree(chord, a, song.arpLow, false) + up, t, dur * 1.2, s % 4 === 0 ? 1 : 0.8);
    }

    // ---- lead ----
    const n = bar.lead.get(s);
    if (n) {
      const accent = s % 8 === 0 ? 1 : 0.86;
      const len = dur * n.steps * 0.96;
      this.note(song.lead.patch, lead, n.midi + up, t, len, accent);
      if (this.lifted) this.note(song.lead.patch, lead, twinOf(n.midi, chord) + up, t, len, accent * 0.62);
    }
  }

  private drums(song: Song, at: number, s: number, t: number, fillBar: boolean) {
    const d = song.drums;
    const fill = fillBar && this.fill(s, t, song);
    const hit = (line: string) => line.length > 0 && line[at % line.length] === "x";
    if (hit(d.kick)) this.kick(t);
    if (!fill && hit(d.snare)) this.snare(t, 1);
    if (!fill && s % 4 === 3 && this.rand() < 0.1) this.snare(t, 0.3);
    const lifted = this.lifted && s % 2 === 1;
    if (hit(d.hat) || lifted) this.hat(t, 0.04, (lifted ? 0.5 : 0.8) + this.rand() * 0.2);
    if (hit(d.open)) this.hat(t, 0.17, 0.8);
    if (hit(d.tom)) this.tom(t, d.tomHz * (s % 8 === 0 ? 0.62 : 1));
  }

  /** The last half bar of every section: a choice of roll, so repeats don't line up. */
  private fill(s: number, t: number, song: Song) {
    const kind = (this.bars >> 3) % 3;
    const on = kind === 0 ? s >= 12 || s % 2 === 0 : kind === 1 ? s % 3 === 2 : s >= 12;
    if (!on) return false;
    if (kind === 2) this.tom(t, song.drums.tomHz * (1.5 - (s - 12) * 0.22));
    else this.snare(t, 0.45 + (s - 8) * 0.07);
    return true;
  }

  // ---- buses ----

  private buildBuses(song: Song) {
    const { ctx } = this;
    this.bus = ctx.createGain();
    this.bus.gain.value = song.trim;
    this.bus.connect(this.rig.music);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = (60 / song.bpm) * 0.75; // dotted eighth, the arcade echo
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(this.bus);

    const part = (p: Part): Bus => {
      const g = ctx.createGain();
      let tail: AudioNode = g;
      if (p.cut) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = p.cut;
        f.Q.value = 0.8;
        tail = tail.connect(f);
      }
      if (p.pan && ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = p.pan;
        tail = tail.connect(pan);
      }
      tail.connect(this.bus);
      if (p.echo) {
        const send = ctx.createGain();
        send.gain.value = p.echo;
        tail.connect(send).connect(delay);
      }
      return { in: g, level: p.level };
    };

    const drumIn = ctx.createGain();
    drumIn.gain.value = song.drums.level;
    drumIn.connect(this.bus);
    const hat = ctx.createBiquadFilter();
    hat.type = "highpass";
    hat.frequency.value = 7200;
    hat.connect(drumIn);
    const snare = ctx.createBiquadFilter();
    snare.type = "bandpass";
    snare.frequency.value = 1900;
    snare.Q.value = 0.7;
    snare.connect(drumIn);

    this.parts = {
      lead: part(song.lead), bass: part(song.bass), comp: part(song.comp), arp: part(song.arp),
      drums: { in: drumIn, level: 1 }, hat, snare,
    };
  }

  // ---- voices ----

  private note(p: Patch, bus: Bus, midi: number, t: number, dur: number, vel: number) {
    const { ctx } = this;
    const f = hz(midi);
    const end = t + dur;
    const stop = end + p.r * 2.5;
    const amp = ctx.createGain();
    const peak = bus.level * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + p.a);
    amp.gain.setTargetAtTime(peak * p.s, t + p.a, p.d / 3);
    amp.gain.setTargetAtTime(0, end, p.r / 3);
    amp.connect(bus.in);

    if (p.kind === "fm") {
      const c = ctx.createOscillator();
      const m = ctx.createOscillator();
      const depth = ctx.createGain();
      c.frequency.value = f;
      m.frequency.value = f * p.ratio;
      depth.gain.setValueAtTime(f * p.index, t);
      depth.gain.exponentialRampToValueAtTime(Math.max(0.01, f * p.indexEnd), t + p.indexDecay);
      m.connect(depth).connect(c.frequency);
      c.connect(amp);
      c.start(t);
      m.start(t);
      c.stop(stop);
      m.stop(stop);
      return;
    }
    for (const sign of [-1, 1]) {
      const o = ctx.createOscillator();
      o.type = p.wave;
      o.frequency.value = f;
      o.detune.value = (sign * p.detune) / 2;
      o.connect(amp);
      o.start(t);
      o.stop(stop);
    }
  }

  private kick(t: number) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.parts.drums.in);
    o.start(t);
    o.stop(t + 0.22);
    this.hat(t, 0.008, 0.5); // the click is what survives a phone speaker
  }

  private snare(t: number, v: number) {
    const { ctx } = this;
    const n = burst(this.rig, t, 0.17);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(g).connect(this.parts.snare);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const b = ctx.createGain();
    b.gain.setValueAtTime(0.16 * v, t);
    b.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(b).connect(this.parts.drums.in);
    o.start(t);
    o.stop(t + 0.11);
  }

  private hat(t: number, dur: number, v: number) {
    const n = burst(this.rig, t, dur + 0.01);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(g).connect(this.parts.hat);
  }

  private crash(t: number) {
    const n = burst(this.rig, t, 1.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
    n.connect(g).connect(this.parts.hat);
  }

  private tom(t: number, f: number) {
    const { ctx } = this;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.68, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(this.parts.drums.in);
    o.start(t);
    o.stop(t + 0.18);
  }
}
