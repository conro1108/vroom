// Cosmos Cup: "everything at once, somewhere ridiculous". Ribbon roads over nothing:
// off the edge is a fall, so roads are wide, and the tightest corners get rails.
import { L, R, S, type Feature, type Piece, type PieceOpts, type TrackDef } from "../sim/course";
import type { Cup } from "./index";

const space = { theme: "cosmos", edge: "void" as const, runoff: 0.3 };
/** Barriers need to sit on the kerb: there's no ground for a verge out here. */
const rail: PieceOpts = { edge: "wall", runoff: 1.2 };
/** A full-width ramp, so no line through it misses the jump. The pad just before it
 *  is what gets a car over from a standing start: a respawn lands right there. */
const ramp = (at: number, pad: number): Feature[] => [
  { kind: "boost", at: pad, d: 0 },
  ...[-0.62, 0, 0.62].map((d) => ({ kind: "kicker" as const, at, d })),
];

// Welcome. Huge, safe, and then the floor falls away.
const starlight: TrackDef = {
  ...space,
  id: "starlight",
  name: "Starlight Ribbon",
  blurb: "There's no ground out here. Try not to look down.",
  width: 16,
  pieces: [
    S(260),
    R(90, 32, { ...rail }),
    S(230, { y: -36 }),
    L(60, 38, { ...rail }),
    S(100),
    R(150, 30, { ...rail, y: -20 }),
    S(130, { y: -8 }),
    R(35, 38),
    L(35, 38),
    S(130, { y: 2 }),
    R(60, 44, { bank: 10 }),
    S(90, { y: 14 }),
    R(120, 28, { ...rail }),
    S(190, { y: 0 }),
  ],
  landmarks: [
    { kind: "ringplanet", at: 0.32, side: 460, scale: 1.3 },
    { kind: "stargate", at: 0.235, side: 0 },
    { kind: "moon", at: 0.08, side: -220, scale: 1.4 },
    { kind: "gasgiant", at: 0.75, side: 700, scale: 1.6 },
    { kind: "asteroidbelt", at: 0.5, side: -285, yaw: 0.2 },
    { kind: "crystalroid", at: 0.4, side: -46 },
    { kind: "crystalroid", at: 0.45, side: 60, scale: 1.3 },
    ...[0.62, 0.66, 0.7].map((at) => ({ kind: "ringgate", at, side: 0 })),
  ],
};

const STAR_H = 18;
// Rise on the climb, leave the ramp, sail over the strand below, drop back for the
// hairpin.
const strand = (run: number): Piece[] => [
  S(run, { y: 0 }),
  S(75, { y: STAR_H }),
  S(30, { items: ramp(0.93, 0.65) }),
  S(16, { gap: true, y: STAR_H - 3 }),
  S(104, { y: 2 }),
  R(144, 26, { ...rail, y: 0 }),
];

// Twist. The lap is a five-pointed star, weaving over and under itself: each climb
// ends in a jump across the road you were on a moment ago.
const pentastar: TrackDef = {
  ...space,
  id: "pentastar",
  name: "Pentastar",
  blurb: "Look at the map. Now drive it. Five jumps, five hairpins, one star.",
  width: 15,
  pieces: [...strand(50), ...strand(105), ...strand(105), ...strand(105), ...strand(105), S(55)],
  landmarks: [
    { kind: "lavaworld", at: 0.3, side: 420, scale: 1.4 },
    { kind: "moon", at: 0.1, side: -160 },
    { kind: "gasgiant", at: 0.7, side: -640, scale: 1.4 },
    { kind: "spacestation", at: 0.5, side: -280, yaw: 0.8 },
    ...[0.19, 0.39, 0.59, 0.79, 0.99].map((at) => ({ kind: "crystalroid", at, side: -70, scale: 1.1 })),
    ...[0.1, 0.3, 0.5, 0.7, 0.9].map((at) => ({ kind: "ringgate", at, side: 0, scale: 1.2 })),
  ],
};

// Oddball. Circle the drain: a tightening spiral round a black hole, then out
// underneath it all. Corners barely descend, because the car unsticks if they do.
const drain: TrackDef = {
  ...space,
  id: "drain",
  name: "Gravity Well",
  blurb: "The road spirals in, the radius tightens, and there's only one way out.",
  width: 15,
  pieces: [
    S(240),
    R(360, 76, { y: -22, bank: 14 }),
    R(270, 54, { y: -36, bank: 16 }),
    R(260, 36, { ...rail, y: -44 }),
    S(300, { y: -64, items: [{ kind: "boost", at: 0.75, d: 0 }] }),
    S(90, { y: -50, items: [{ kind: "boost", at: 0.5, d: 0 }] }),
    L(30, 30, { ...rail }),
    R(60, 30, { ...rail, y: -40 }),
    L(30, 30, { ...rail }),
    S(90, { y: -24 }),
    R(100, 34, { ...rail, y: -12 }),
    S(80),
    R(90, 34, { ...rail, y: 0 }),
    S(120),
  ],
  landmarks: [
    { kind: "blackhole", at: 0.47, side: 40, scale: 1.25 },
    { kind: "ringplanet", at: 0.915, side: 665, scale: 1.2 },
    { kind: "stargate", at: 0.09, side: 0 },
    { kind: "asteroidbelt", at: 0.75, side: -200 },
    ...[0.68, 0.72, 0.76].map((at) => ({ kind: "ringgate", at, side: 0 })),
  ],
};

const SLOT = 0.49; // middle of the finale's narrow straight

// Finale. A greatest-hits lap: crest jump, banked bowl, fork, slot, the climb, and
// over your own road twice.
const longWayHome: TrackDef = {
  ...space,
  id: "longwayhome",
  name: "The Long Way Home",
  blurb: "Every trick in the book, in order, over nothing at all.",
  width: 16,
  pieces: [
    S(150),
    S(120, { y: 16 }),
    S(50, { items: ramp(0.96, 0.8) }),
    S(16, { gap: true, y: 13 }),
    S(150, { y: -10 }),
    R(240, 40, { y: -14, bank: 20 }),
    S(70, { w: 28 }),
    S(140, { y: -30, isle: { d: 0, half: 3 } }),
    S(60, { w: 12 }),
    S(150, { ...rail }),
    L(85, 24, { ...rail }),
    R(85, 24, { ...rail }),
    S(70, { w: 16 }),
    L(60, 34, { ...rail }),
    S(120, { y: -6 }),
    R(60, 22, { ...rail, w: 13 }),
    L(120, 22, { ...rail }),
    R(60, 22, { ...rail, y: 10, w: 16 }),
    S(130, { y: 30 }),
    L(90, 26, { ...rail }),
    S(70),
    R(30, 30, { ...rail }),
    L(30, 30, { ...rail }),
    S(140, { y: 2 }),
    L(90, 26, { ...rail, y: 0 }),
    S(120),
  ],
  landmarks: [
    { kind: "stargate", at: 0.145, side: 0, scale: 0.9 },
    { kind: "ringplanet", at: 0.315, side: 545, scale: 1.2 },
    { kind: "lavaworld", at: 0.75, side: -600, scale: 1.2 },
    { kind: "gasgiant", at: 0.05, side: -760, scale: 1.5 },
    { kind: "floatisle", at: 0.86, side: 70 },
    { kind: "floatisle", at: 0.95, side: -90, scale: 0.7 },
    { kind: "asteroidbelt", at: 0.39, side: -365, yaw: 0.9 },
    { kind: "canyonwall", at: SLOT, side: 22 },
    { kind: "canyonwall", at: SLOT, side: -22, yaw: Math.PI },
  ],
};

export const CUP_COSMOS: Cup = {
  id: "cosmos",
  name: "Cosmos Cup",
  theme: "cosmos",
  idea: "everything at once",
  scale: 1.32,
  difficulty: 1.0,
  tracks: [starlight, pentastar, drain, longWayHome],
};
