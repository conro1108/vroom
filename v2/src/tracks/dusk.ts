// Dusk Cup: "precision". Street circuits with walls a door-width away: every corner
// is the setup for the next one, so one wrong line costs you the two after it.
import { L, R, S, type Landmark, type TrackDef } from "../sim/course";
import type { Cup } from "./index";

const street = { theme: "dusk", edge: "wall" as const, runoff: 2.5 };

const arches = (from: number, to: number, n: number): Landmark[] =>
  Array.from({ length: n }, (_, k) => ({ kind: "neonarch", at: from + ((to - from) * k) / (n - 1), side: 0 }));

// Welcome. The grid: square corners, one enormous seafront straight to learn braking on.
const harbour: TrackDef = {
  ...street,
  id: "harbour",
  name: "Harbour Lights",
  blurb: "One long seafront, then the old town. Brake for the lighthouse.",
  width: 12,
  pieces: [
    S(340),
    R(110, 24),
    S(100),
    R(70, 28),
    S(150, { y: 5 }),
    L(90, 22),
    S(90, { y: 7 }),
    R(90, 22),
    S(130, { y: 3 }),
    R(90, 22),
    S(80),
    L(60, 30),
    R(60, 30),
    S(120, { y: 0 }),
    R(90, 24),
    S(70),
  ],
  landmarks: [
    { kind: "skyring", at: 0.095, side: 160 },
    ...arches(0.03, 0.2, 6),
    { kind: "lighthouse", at: 0.245, side: -44 },
    { kind: "harbourcrane", at: 0.14, side: -38, yaw: 1.57 },
    { kind: "harbourcrane", at: 0.17, side: -38, yaw: 1.57 },
    { kind: "billboard", at: 0.42, side: -20, yaw: 1.57 },
    { kind: "billboard", at: 0.62, side: 20, yaw: 1.57 },
    { kind: "ferris", at: 0.72, side: -70, yaw: 0.5 },
  ],
};

// Twist. A figure-eight on two levels: the flyover crest throws you at a hairpin.
const flyover: TrackDef = {
  ...street,
  id: "flyover",
  name: "Flyover",
  blurb: "You'll drive under this road, then over it, flat out, into a hairpin.",
  width: 11,
  pieces: [
    S(230),
    R(90, 22),
    S(60),
    L(50, 20),
    R(50, 20),
    S(60),
    R(120, 20),
    S(50),
    L(45, 22),
    R(45, 22),
    S(70, { y: 4 }),
    R(60, 30, { y: 9 }),
    S(240, { y: 11, bridge: true }),
    L(90, 24, { y: 10, bridge: true }),
    S(150, { y: 2, bridge: true }),
    L(150, 19),
    S(120, { y: 0 }),
    R(60, 26),
    L(90, 22),
    S(140),
  ],
  landmarks: [
    { kind: "skyring", at: 0, side: 60 },
    { kind: "billboard", at: 0.64, side: 26, yaw: 1.57 },
    { kind: "billboard", at: 0.69, side: -26, yaw: 1.57 },
    { kind: "neonarch", at: 0.635, side: 0 },
    { kind: "neonarch", at: 0.66, side: 0 },
    { kind: "lighthouse", at: 0.8, side: -97 },
    { kind: "ferris", at: 0.35, side: 66, yaw: 0.4 },
  ],
};

// Oddball. Half the lap underground: blind S-bends you can only learn, then daylight.
const lastTrain: TrackDef = {
  ...street,
  id: "lasttrain",
  name: "Last Train",
  blurb: "Blind bends under the city, then out over the bay at full tilt.",
  width: 11,
  pieces: [
    S(170),
    S(110, { tunnel: true }),
    L(40, 28, { tunnel: true }),
    R(80, 24, { tunnel: true }),
    L(40, 28, { tunnel: true }),
    S(130, { tunnel: true }),
    R(50, 26, { tunnel: true }),
    L(50, 26, { tunnel: true }),
    S(100, { tunnel: true, y: 2 }),
    S(240, { y: 12, bridge: true }),
    R(90, 24, { y: 12, bridge: true }),
    S(90, { y: 12, bridge: true }),
    R(90, 24, { y: 9, bridge: true }),
    S(200, { y: 2, bridge: true }),
    L(60, 26, { y: 0 }),
    R(60, 26),
    S(240),
    R(90, 22),
    S(70),
    R(90, 22),
    S(90),
  ],
  landmarks: [
    { kind: "skyring", at: 0.16, side: 90 },
    { kind: "metrosign", at: 0.092, side: 0 },
    { kind: "metrosign", at: 0.345, side: 0 },
    ...arches(0.36, 0.42, 3),
    { kind: "lighthouse", at: 0.44, side: 46 },
    { kind: "ferris", at: 0.57, side: 145, yaw: 0.4 },
    { kind: "billboard", at: 0.7, side: 22, yaw: 1.57 },
  ],
};

// Showpiece. Three linked corners, a kink, the esses, then a cloverleaf over your
// own entry and a chicane on the way down.
const nightfall: TrackDef = {
  ...street,
  id: "nightfall",
  name: "Nightfall GP",
  blurb: "No room, no rest. Get turn one wrong and you've lost turn three.",
  width: 10.5,
  runoff: 2,
  pieces: [
    S(280, { w: 12 }),
    L(95, 19, { w: 10.5 }),
    S(50),
    R(65, 22),
    S(36),
    L(115, 19),
    S(130, { y: 3 }),
    R(35, 30),
    L(35, 30),
    S(50),
    L(35, 24, { y: 2 }),
    S(70),
    R(50, 20),
    L(100, 19),
    R(50, 20),
    S(90),
    R(270, 28, { y: 12, bridge: true }),
    S(120, { y: 8, bridge: true }),
    L(45, 22, { y: 6 }),
    R(90, 20),
    L(45, 22),
    S(100, { y: 0 }),
    L(90, 20),
    S(60),
  ],
  landmarks: [
    { kind: "skyring", at: 0.09, side: -190 },
    ...arches(0.02, 0.12, 4),
    { kind: "billboard", at: 0.2, side: 24, yaw: 1.57 },
    { kind: "billboard", at: 0.33, side: -28, yaw: 1.57 },
    { kind: "billboard", at: 0.55, side: 24, yaw: 1.57 },
    { kind: "ferris", at: 0.72, side: -62 },
    { kind: "lighthouse", at: 0.42, side: 60 },
  ],
};

export const CUP_DUSK: Cup = {
  id: "dusk",
  name: "Dusk Cup",
  theme: "dusk",
  idea: "precision",
  scale: 1.25,
  difficulty: 0.98,
  tracks: [harbour, flyover, lastTrain, nightfall],
};
