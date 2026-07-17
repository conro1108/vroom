// The track catalog. The main line runs in order — a podium (top 3) on each
// track opens the next — and bonus tracks branch off it, demanding an
// outright win somewhere. Layout safety (in-bounds, no self-overlapping
// road) is enforced by tracks.test.ts, so new layouts can be sketched
// against the tests.
import type { TrackDef } from "./track";

function gear(cx: number, cy: number, outer: number, inner: number, lobes: number) {
  const pts = [];
  for (let k = 0; k < lobes * 2; k++) {
    const a = (k / (lobes * 2)) * Math.PI * 2;
    const r = k % 2 === 0 ? outer : inner;
    pts.push({ x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r) });
  }
  return pts;
}

export const TRACKS: TrackDef[] = [
  {
    id: "meadow",
    name: "Meadow Loop",
    roadWidth: 62,
    worldWidth: 1400,
    worldHeight: 1000,
    points: [
      { x: 320, y: 210 },
      { x: 700, y: 150 },
      { x: 1060, y: 230 },
      { x: 1185, y: 460 },
      { x: 1090, y: 720 },
      { x: 860, y: 790 },
      { x: 700, y: 620 },
      { x: 540, y: 780 },
      { x: 300, y: 830 },
      { x: 170, y: 600 },
      { x: 210, y: 380 },
    ],
  },
  {
    // A true oval: two long straights joined by wide sweeping ends, no
    // inward pinch — distinct from meadow's looping shape, built for speed.
    id: "speedway",
    unlock: { track: "meadow", result: "podium" },
    name: "Sunny Speedway",
    roadWidth: 74,
    worldWidth: 1600,
    worldHeight: 1000,
    points: [
      { x: 420, y: 260 },
      { x: 610, y: 260 },
      { x: 800, y: 260 },
      { x: 990, y: 260 },
      { x: 1180, y: 260 },
      { x: 1350, y: 330 },
      { x: 1420, y: 500 },
      { x: 1350, y: 670 },
      { x: 1180, y: 740 },
      { x: 990, y: 740 },
      { x: 800, y: 740 },
      { x: 610, y: 740 },
      { x: 420, y: 740 },
      { x: 250, y: 670 },
      { x: 180, y: 500 },
      { x: 250, y: 330 },
    ],
  },
  {
    id: "serpent",
    unlock: { track: "speedway", result: "podium" },
    name: "Serpent Run",
    roadWidth: 58,
    worldWidth: 1550,
    worldHeight: 850,
    points: [
      { x: 220, y: 260 },
      { x: 420, y: 160 },
      { x: 650, y: 300 },
      { x: 880, y: 160 },
      { x: 1110, y: 300 },
      { x: 1330, y: 180 },
      { x: 1460, y: 330 },
      { x: 1380, y: 540 },
      { x: 1250, y: 680 },
      { x: 1000, y: 590 },
      { x: 750, y: 700 },
      { x: 500, y: 590 },
      { x: 300, y: 700 },
      { x: 150, y: 520 },
    ],
  },
  {
    id: "switchback",
    unlock: { track: "serpent", result: "podium" },
    name: "Switchback Pass",
    roadWidth: 56,
    worldWidth: 1420,
    worldHeight: 1000,
    points: [
      { x: 340, y: 200 },
      { x: 700, y: 180 },
      { x: 1020, y: 200 },
      { x: 1160, y: 340 },
      { x: 1020, y: 480 },
      { x: 700, y: 500 },
      { x: 380, y: 480 },
      { x: 250, y: 620 },
      { x: 380, y: 760 },
      { x: 700, y: 740 },
      { x: 1020, y: 760 },
      { x: 1240, y: 800 },
      { x: 1330, y: 540 },
      { x: 1300, y: 240 },
      { x: 1140, y: 100 },
      { x: 700, y: 80 },
      { x: 330, y: 90 },
      { x: 210, y: 130 },
    ],
  },
  {
    id: "knot",
    unlock: { track: "switchback", result: "podium" },
    name: "Clover Knot",
    roadWidth: 50,
    worldWidth: 1120,
    worldHeight: 1120,
    points: gear(560, 560, 410, 260, 6),
  },
  {
    id: "gauntlet",
    unlock: { track: "knot", result: "podium" },
    name: "The Gauntlet",
    roadWidth: 60,
    worldWidth: 1800,
    worldHeight: 1200,
    points: [
      { x: 250, y: 180 },
      { x: 800, y: 130 },
      { x: 1350, y: 170 },
      { x: 1660, y: 380 },
      { x: 1580, y: 660 },
      { x: 1320, y: 740 },
      { x: 1180, y: 580 },
      { x: 1000, y: 540 },
      { x: 880, y: 700 },
      { x: 1000, y: 900 },
      { x: 650, y: 980 },
      { x: 350, y: 1000 },
      { x: 150, y: 780 },
      { x: 220, y: 560 },
      { x: 140, y: 340 },
    ],
  },
  {
    // Bonus branch: a wide kidney-bean lagoon with one soft inward bay —
    // flowing and fast, the reward for a first win on the oval.
    id: "lagoon",
    unlock: { track: "speedway", result: "win" },
    name: "Lost Lagoon",
    roadWidth: 64,
    worldWidth: 1300,
    worldHeight: 1000,
    points: [
      { x: 200, y: 500 },
      { x: 280, y: 300 },
      { x: 450, y: 190 },
      { x: 650, y: 280 },
      { x: 850, y: 190 },
      { x: 1020, y: 300 },
      { x: 1100, y: 500 },
      { x: 1010, y: 700 },
      { x: 830, y: 800 },
      { x: 650, y: 830 },
      { x: 470, y: 800 },
      { x: 290, y: 700 },
    ],
  },
  {
    // Bonus branch: chicane wiggles across the top, one flat-out straight
    // home — the victory lap for conquering The Gauntlet.
    id: "rally",
    unlock: { track: "gauntlet", result: "win" },
    name: "Rally Ridge",
    roadWidth: 54,
    worldWidth: 1700,
    worldHeight: 900,
    points: [
      { x: 250, y: 220 },
      { x: 450, y: 160 },
      { x: 650, y: 260 },
      { x: 850, y: 160 },
      { x: 1050, y: 260 },
      { x: 1250, y: 160 },
      { x: 1450, y: 240 },
      { x: 1550, y: 420 },
      { x: 1480, y: 620 },
      { x: 1250, y: 700 },
      { x: 850, y: 720 },
      { x: 450, y: 700 },
      { x: 220, y: 620 },
      { x: 150, y: 420 },
    ],
  },
];

export function trackDefById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
