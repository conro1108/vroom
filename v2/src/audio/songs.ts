// The six tunes, one per world, as data music.ts plays. Harmony and hooks are
// written out by hand so they sound composed; music.ts adds what makes each pass
// differ (the improvised S section, fills, ghost notes, the final-lap lift).
//
// Notation: a section's `chords` is one entry per bar, split on spaces into half
// bars. `lead` is bars of 4, 8 or 16 tokens: a note, "-" to hold, "." to rest.
// Pattern lines have one character per 16th and repeat: digits are chord degrees
// (1, 3, 5, 7, 8 = octave), "x" a hit, "-" holds, "." rests.

export interface FmPatch {
  kind: "fm";
  ratio: number; // modulator : carrier
  index: number; // brightness at the start of a note
  indexEnd: number;
  indexDecay: number; // seconds to get there
  a: number; d: number; s: number; r: number;
}

export interface OscPatch {
  kind: "osc";
  wave: OscillatorType;
  detune: number; // cents between the two oscillators
  a: number; d: number; s: number; r: number;
}

export type Patch = FmPatch | OscPatch;

export interface Part {
  patch: Patch;
  level: number;
  cut?: number; // lowpass on the whole part
  pan?: number;
  echo?: number; // send to the tempo delay
}

export interface Song {
  title: string;
  key: number; // midi root
  scale: number[]; // semitones above the key, for the improvised section
  bpm: number;
  swing: number; // share of a 16th the offbeats lag
  lift: number; // semitones up on the final lap
  trim: number; // evens out loudness between tunes
  form: string; // section letters; S improvises over A's changes
  sections: Record<string, { chords: string; lead: string }>;
  lead: Part;
  bass: Part;
  comp: Part;
  arp: Part;
  bassLow: number; // lowest midi note of the bass register
  compLow: number;
  arpLow: number;
  arpIn: string; // sections with the arp; the final lap always has it
  lines: { bass: string; comp: string; arp: string };
  drums: { kick: string; snare: string; hat: string; open: string; tom: string; level: number; tomHz: number };
}

// ---- patches ----

const brass: FmPatch = { kind: "fm", ratio: 1, index: 3.4, indexEnd: 1.2, indexDecay: 0.22, a: 0.012, d: 0.3, s: 0.72, r: 0.09 };
const slap: FmPatch = { kind: "fm", ratio: 1, index: 5, indexEnd: 0.5, indexDecay: 0.1, a: 0.002, d: 0.16, s: 0.5, r: 0.05 };
const roundBass: FmPatch = { kind: "fm", ratio: 2, index: 1.5, indexEnd: 0.5, indexDecay: 0.12, a: 0.003, d: 0.2, s: 0.7, r: 0.06 };
const tine: FmPatch = { kind: "fm", ratio: 7, index: 1.3, indexEnd: 0.05, indexDecay: 0.16, a: 0.002, d: 0.5, s: 0.3, r: 0.12 };
const steel: FmPatch = { kind: "fm", ratio: 2, index: 1.9, indexEnd: 0.25, indexDecay: 0.2, a: 0.002, d: 0.32, s: 0.22, r: 0.1 };
const glass: FmPatch = { kind: "fm", ratio: 3.5, index: 2.4, indexEnd: 0.2, indexDecay: 0.35, a: 0.002, d: 0.7, s: 0.22, r: 0.25 };
const saz: FmPatch = { kind: "fm", ratio: 3, index: 2.8, indexEnd: 0.35, indexDecay: 0.08, a: 0.002, d: 0.22, s: 0.32, r: 0.07 };
const marimba: FmPatch = { kind: "fm", ratio: 4, index: 1.8, indexEnd: 0.01, indexDecay: 0.04, a: 0.002, d: 0.16, s: 0.02, r: 0.05 };
const pluck: FmPatch = { kind: "fm", ratio: 5, index: 1.5, indexEnd: 0.05, indexDecay: 0.07, a: 0.002, d: 0.12, s: 0.08, r: 0.05 };
const synLead: OscPatch = { kind: "osc", wave: "sawtooth", detune: 10, a: 0.012, d: 0.25, s: 0.75, r: 0.14 };
const pulse: OscPatch = { kind: "osc", wave: "square", detune: 7, a: 0.008, d: 0.2, s: 0.7, r: 0.1 };
const gateSquare: OscPatch = { kind: "osc", wave: "square", detune: 4, a: 0.002, d: 0.07, s: 0.25, r: 0.04 };
const pad: OscPatch = { kind: "osc", wave: "sawtooth", detune: 12, a: 0.14, d: 0.5, s: 0.85, r: 0.4 };
const stab: OscPatch = { kind: "osc", wave: "sawtooth", detune: 9, a: 0.004, d: 0.12, s: 0.4, r: 0.08 };

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// ---- tunes ----

export const SONGS: Record<string, Song> = {
  // Big sunny Daytona rock: FM brass over slap bass, the one that sets the tone.
  meadow: {
    title: "Green Light", key: 67, scale: MAJOR, bpm: 152, swing: 0, lift: 2, trim: 0.84, form: "AABAS",
    sections: {
      A: {
        chords: "Gmaj7 | D/F# | Em7 | Cmaj7 D | Gmaj7 | D/F# | Em7 A7 | Cmaj7 D",
        lead: `G5 - B5 D6 - B5 D6 E6 | F#6 - - E6 D6 - A5 - | B5 - E6 - D6 B5 - G5 | A5 - G5 E5 F#5 - D5 - |
               G5 - B5 D6 - B5 D6 E6 | F#6 - - E6 D6 - F#6 A6 | G6 - F#6 E6 C#6 - E6 G6 | E6 - D6 C6 D6 - - -`,
      },
      B: {
        chords: "Em7 | Bm7 | Cmaj7 | G/B | Am7 | D7 | Bm7 E7 | Am7 D7",
        lead: `E5 - G5 B5 - - A5 G5 | F#5 - - - D5 - F#5 A5 | G5 - E5 C6 - - B5 A5 | B5 - - - G5 - A5 B5 |
               C6 - B5 A5 - E6 - - | D6 - C6 A5 - F#5 - A5 | B5 - A5 F#5 G#5 - B5 D6 | C6 - B5 A5 F#5 - A5 C6`,
      },
    },
    lead: { patch: brass, level: 0.17, cut: 4200, echo: 0.2 },
    bass: { patch: slap, level: 0.27, cut: 2600 },
    comp: { patch: tine, level: 0.07, pan: -0.2, echo: 0.15 },
    arp: { patch: marimba, level: 0.06, pan: 0.25, echo: 0.1 },
    bassLow: 40, compLow: 62, arpLow: 74, arpIn: "BS",
    lines: { bass: "1..1..8.1.5.8.7.", comp: "..x..x....x..x..", arp: "1.3.5.8.5.3.1.3." },
    drums: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", open: "..............x.", tom: "", level: 1, tomHz: 180 },
  },

  // Slow heat: Phrygian dominant over a drone, hand drums and a plucked lead.
  desert: {
    title: "Mirage", key: 62, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 128, swing: 0.08, lift: 1, trim: 1.0, form: "AABS",
    sections: {
      A: {
        chords: "D | Eb/D | Cm | D | D | Eb/D | Gm | Cm D",
        lead: `A5 - Bb5 A5 F#5 - Eb5 D5 | Eb5 - G5 Bb5 - A5 G5 - | C5 Eb5 G5 - Ab5 G5 Eb5 C5 | D5 - - - - A4 C5 D5 |
               A5 - Bb5 A5 F#5 - Eb5 D5 | Eb5 - G5 Bb5 - A5 G5 - | Bb5 A5 G5 - D5 - G5 Bb5 | C6 Bb5 G5 Eb5 F#5 - D5 -`,
      },
      B: {
        chords: "Gm | F | Eb | D | Gm | Bb | Cm | D7",
        lead: `G5 - - Bb5 D6 - C6 Bb5 | A5 - - C6 F5 - - G5 | G5 - Bb5 - Eb6 - D6 C6 | F#5 - A5 - D6 - - - |
               D6 - Eb6 D6 Bb5 - G5 - | F5 - Bb5 - D6 - C6 Bb5 | C6 - Bb5 G5 Eb5 - G5 - | F#5 - A5 C6 Eb6 - D6 -`,
      },
    },
    lead: { patch: saz, level: 0.24, pan: 0.05, echo: 0.3 },
    bass: { patch: roundBass, level: 0.25, cut: 1200 },
    comp: { patch: pad, level: 0.03, cut: 800, pan: -0.15 },
    arp: { patch: pluck, level: 0.09, pan: -0.3, echo: 0.2 },
    bassLow: 38, compLow: 57, arpLow: 69, arpIn: "S",
    lines: { bass: "1...1..5...1..8.", comp: "x---------------", arp: "1..3..5.8..5..3." },
    drums: { kick: "x.....x...x.....", snare: "........x.......", hat: "..x...x...x...x.", open: "", tom: "x..x..x.x.x..x.x", level: 0.95, tomHz: 210 },
  },

  // Beach bar calypso: steel drum lead, offbeat skank, a lazy shuffle.
  tide: {
    title: "Low Tide", key: 70, scale: MAJOR, bpm: 124, swing: 0.16, lift: 2, trim: 0.94, form: "AABAS",
    sections: {
      A: {
        chords: "Bb | F/A | Gm7 | Eb F | Bb | Dm7 G7 | Cm7 F7 | Bb F7",
        lead: `F5 Bb5 - D6 - C6 Bb5 - | A5 C6 - F6 - Eb6 C6 - | Bb5 D6 - G6 - F6 D6 - | Eb6 - D6 C6 C6 - A5 - |
               F5 Bb5 - D6 - C6 Bb5 - | A5 D6 - F6 G6 - F6 D6 | Eb6 - D6 C6 A5 - C6 Eb6 | D6 - Bb5 - C6 - - -`,
      },
      B: {
        chords: "Ebmaj7 | Dm7 | Cm7 | F7 | Ebmaj7 | Edim | Bb/F | F7",
        lead: `G5 Bb5 - D6 - - C6 Bb5 | A5 - F5 - D6 - C6 A5 | G5 - Eb5 - C6 - Bb5 G5 | A5 - C6 - Eb6 - - - |
               G6 - F6 D6 - Eb6 D6 Bb5 | Bb5 - G5 E5 - G5 Bb5 Db6 | D6 - - F6 - D6 Bb5 - | C6 - A5 - C6 Eb6 - -`,
      },
    },
    lead: { patch: steel, level: 0.25, pan: 0.1, echo: 0.28 },
    bass: { patch: roundBass, level: 0.29, cut: 1400 },
    comp: { patch: stab, level: 0.05, cut: 2000, pan: -0.25 },
    arp: { patch: marimba, level: 0.1, pan: 0.3, echo: 0.12 },
    bassLow: 41, compLow: 62, arpLow: 72, arpIn: "AS",
    lines: { bass: "1..1..5...8.5.3.", comp: "..x...x...x...x.", arp: "1.3.5.3.8.5.3.5." },
    drums: { kick: "x..x..x...x..x..", snare: "....x..x....x...", hat: "x.xxx.xxx.xxx.xx", open: "", tom: "..........x..x.x", level: 0.8, tomHz: 420 },
  },

  // Ice-rink eurobeat: octave bass, 16th-note crystal arps, glass bells.
  frost: {
    title: "Black Ice", key: 66, scale: MINOR, bpm: 164, swing: 0, lift: 1, trim: 0.84, form: "AABAS",
    sections: {
      A: {
        chords: "F#m | D | A | C#m | F#m | D | Bm7 | C#7",
        lead: `C#6 - A5 F#5 C#6 - B5 A5 | A5 - F#5 D5 A5 - B5 C#6 | E6 - C#6 A5 E6 - D6 C#6 | B5 - G#5 E5 G#5 - B5 C#6 |
               F#6 - E6 C#6 F#6 - G#6 A6 | A6 - F#6 D6 A6 - G#6 F#6 | F#6 - E6 D6 B5 - D6 - | F6 - C#6 G#5 B5 - F6 -`,
      },
      B: {
        chords: "Bm7 | E | Amaj7 | Dmaj7 | Bm7 | C#m7 | Dmaj7 E | C#7",
        lead: `D6 - - - F#6 - E6 D6 | B5 - - - G#5 - B5 - | C#6 - - - E6 - G#6 - | F#6 - - - - - A6 - |
               A6 - G#6 F#6 - D6 - - | G#6 - - E6 - C#6 - - | F#6 - E6 D6 E6 - G#6 - | G#6 - - - - - - -`,
      },
    },
    lead: { patch: glass, level: 0.2, echo: 0.3 },
    bass: { patch: slap, level: 0.24, cut: 1800 },
    comp: { patch: pad, level: 0.026, cut: 1500, pan: -0.15 },
    arp: { patch: pluck, level: 0.085, pan: 0.3, echo: 0.15 },
    bassLow: 38, compLow: 57, arpLow: 69, arpIn: "ABS",
    lines: { bass: "1.8.1.8.1.8.1.8.", comp: "x---------------", arp: "1358853113588531" },
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", open: "..x...x...x...x.", tom: "", level: 0.9, tomHz: 200 },
  },

  // Synthwave at sunset: galloping bass, wide saws, a lazy lead.
  dusk: {
    title: "Afterglow", key: 60, scale: MINOR, bpm: 118, swing: 0, lift: 2, trim: 1.26, form: "AABS",
    sections: {
      A: {
        chords: "Cm | Ab | Eb | Bb | Cm | Ab | Fm | Gsus4 G7",
        lead: `G5 - - Eb5 - G5 C6 - | C6 - - Bb5 Ab5 - Eb5 - | G5 - - Bb5 - G5 Eb6 - | D6 - - C6 Bb5 - F5 - |
               G5 - - Eb5 - G5 C6 - | C6 - - Eb6 - D6 C6 - | Ab5 - C6 - F6 - Eb6 C6 | C6 - - - B5 - D6 -`,
      },
      B: {
        chords: "Ab | Bb | Gm | Cm | Ab | Bb | Gm | G7",
        lead: `Eb6 - - - C6 - Eb6 - | D6 - - - Bb5 - D6 F6 | G6 - - - - F6 D6 Bb5 | C6 - - - - - G5 Bb5 |
               C6 - Eb6 - Ab6 - G6 Eb6 | F6 - D6 - Bb6 - Ab6 F6 | G6 - - F6 - D6 Bb5 - | B5 - D6 - F6 - - -`,
      },
    },
    lead: { patch: synLead, level: 0.085, cut: 2600, echo: 0.42 },
    bass: { patch: { ...stab, wave: "sawtooth", d: 0.09, s: 0.5 }, level: 0.1, cut: 620 },
    comp: { patch: pad, level: 0.028, cut: 1300, pan: -0.2, echo: 0.2 },
    arp: { patch: pulse, level: 0.03, cut: 2200, pan: 0.35, echo: 0.3 },
    bassLow: 36, compLow: 58, arpLow: 72, arpIn: "B",
    lines: { bass: "1.11.11.1.11.11.", comp: "x---------------", arp: "1.5.8.5.3.5.8.5." },
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", open: "", tom: "", level: 1.05, tomHz: 150 },
  },

  // Majestic and weightless: Lydian shimmer, gated squares, trance offbeat sub.
  cosmos: {
    title: "Event Horizon", key: 63, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 138, swing: 0, lift: 2, trim: 1.0, form: "AABAS",
    sections: {
      A: {
        chords: "Ebmaj7 | F/Eb | Gm7 | Dm7 | Ebmaj7 | F/Eb | Cm7 | F Dm7",
        lead: `Bb5 - D6 - G6 - F6 D6 | A5 - C6 - F6 - Eb6 C6 | D6 - G6 - Bb6 - A6 G6 | F6 - - - A6 - - - |
               G6 - Bb6 - D7 - C7 Bb6 | A6 - C7 - A6 F6 - C6 | Eb6 - G6 - Bb6 - G6 Eb6 | F6 - A6 - A6 - - -`,
      },
      B: {
        chords: "Abmaj7 | Bb/Ab | Gm7 | Cm7 | Fm7 | Bb7 | Ebmaj7 | F",
        lead: `C6 - Eb6 - G6 - Ab6 G6 | F6 - D6 - Bb5 - D6 F6 | G6 - - D6 - Bb5 - G5 | Eb6 - - G6 - Bb6 - - |
               Ab6 - G6 F6 - C6 - Ab5 | Bb5 - D6 - F6 - Ab6 - | G6 - - - Bb6 - - - | A6 - - - C7 - - -`,
      },
    },
    lead: { patch: pulse, level: 0.065, cut: 2800, echo: 0.4 },
    bass: { patch: roundBass, level: 0.29, cut: 900 },
    comp: { patch: pad, level: 0.024, cut: 1800, pan: 0.15, echo: 0.25 },
    arp: { patch: gateSquare, level: 0.042, cut: 3000, pan: -0.3, echo: 0.3 },
    bassLow: 39, compLow: 60, arpLow: 72, arpIn: "ABS",
    lines: { bass: "..1...1...1...1.", comp: "x---------------", arp: "1358135813581358" },
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", open: "", tom: "", level: 0.9, tomHz: 200 },
  },
};
