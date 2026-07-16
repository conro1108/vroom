// The track catalog, in progression order: each entry unlocks the next.
// Layout safety (in-bounds, no self-overlapping road) is enforced by
// tracks.test.ts, so new layouts can be sketched against the tests.
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
    id: "speedway",
    name: "Sunny Speedway",
    roadWidth: 74,
    worldWidth: 1500,
    worldHeight: 960,
    points: [
      { x: 280, y: 210 },
      { x: 750, y: 150 },
      { x: 1200, y: 210 },
      { x: 1350, y: 470 },
      { x: 1200, y: 760 },
      { x: 900, y: 800 },
      { x: 750, y: 710 },
      { x: 600, y: 800 },
      { x: 300, y: 760 },
      { x: 150, y: 470 },
    ],
  },
  {
    id: "serpent",
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
    name: "Clover Knot",
    roadWidth: 50,
    worldWidth: 1120,
    worldHeight: 1120,
    points: gear(560, 560, 410, 260, 6),
  },
  {
    id: "gauntlet",
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
];

export function trackDefById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
