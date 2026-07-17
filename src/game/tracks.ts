// The track catalog. Tracks are grouped into cups by game/cups.ts — the
// catalog itself is pure geometry. Layout safety (in-bounds, no
// self-overlapping road) is enforced by tracks.test.ts, so new layouts can
// be sketched against the tests. `unlock` on a def is legacy (cup unlocking
// replaced it) and intentionally absent from newer tracks.
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

/** A wavy ring: ellipse rx/ry with `lobes` radial sine bumps of `amp` (0..~0.2). */
function ring(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pts: number,
  lobes: number,
  amp: number,
  phase = 0
) {
  const out = [];
  for (let k = 0; k < pts; k++) {
    const a = (k / pts) * Math.PI * 2;
    const m = 1 + amp * Math.sin(lobes * a + phase);
    out.push({ x: Math.round(cx + Math.cos(a) * rx * m), y: Math.round(cy + Math.sin(a) * ry * m) });
  }
  return out;
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

  // --- Sprout Cup extras ---
  {
    // Gentle five-petal flower: wide, forgiving, teaches flowing lines.
    id: "daisy",
    name: "Daisy Ring",
    roadWidth: 60,
    worldWidth: 1400,
    worldHeight: 1000,
    points: ring(700, 490, 470, 330, 15, 5, 0.12),
  },

  // --- Dune Cup ---
  {
    // A shimmering near-oval with a lazy lean — flat out almost everywhere.
    id: "mirage",
    name: "Mirage Oval",
    roadWidth: 70,
    worldWidth: 1600,
    worldHeight: 900,
    points: ring(800, 445, 590, 290, 14, 2, 0.06, 0.9),
  },
  {
    // Seven quick flicks strung around the ring, like a snake's track in sand.
    id: "sidewinder",
    name: "Sidewinder",
    roadWidth: 54,
    worldWidth: 1450,
    worldHeight: 920,
    points: ring(725, 460, 500, 300, 21, 7, 0.13),
  },
  {
    // Four hard lobes of scorched hardpan — a blunter, faster clover.
    id: "scorch",
    name: "Scorch Flats",
    roadWidth: 58,
    worldWidth: 1250,
    worldHeight: 1250,
    points: gear(625, 625, 480, 330, 4),
  },

  // --- Tide Cup ---
  {
    // Three soft bays around a headland — rhythm track by the sea.
    id: "cove",
    name: "Sandy Cove",
    roadWidth: 62,
    worldWidth: 1400,
    worldHeight: 1050,
    points: ring(700, 520, 460, 335, 12, 3, 0.16, 0.5),
  },
  {
    // Two long plank straights joined by round piers — pure speed.
    id: "boardwalk",
    name: "Boardwalk Sprint",
    roadWidth: 66,
    worldWidth: 1700,
    worldHeight: 820,
    points: [
      { x: 420, y: 220 },
      { x: 650, y: 220 },
      { x: 880, y: 220 },
      { x: 1110, y: 220 },
      { x: 1340, y: 240 },
      { x: 1500, y: 330 },
      { x: 1550, y: 450 },
      { x: 1480, y: 560 },
      { x: 1300, y: 610 },
      { x: 1060, y: 610 },
      { x: 820, y: 610 },
      { x: 580, y: 610 },
      { x: 360, y: 590 },
      { x: 210, y: 500 },
      { x: 160, y: 400 },
      { x: 240, y: 290 },
    ],
  },
  {
    // Six ripples over the reef shelf — busy but shallow angles.
    id: "reef",
    name: "Reef Loop",
    roadWidth: 56,
    worldWidth: 1440,
    worldHeight: 1000,
    points: ring(720, 500, 480, 330, 18, 6, 0.1),
  },
  {
    // A pinched peanut around the point break — two bowls, one waist.
    id: "breaker",
    name: "Breaker Bay",
    roadWidth: 60,
    worldWidth: 1550,
    worldHeight: 900,
    points: ring(775, 450, 530, 300, 14, 2, 0.17, Math.PI / 2),
  },

  // --- Frost Cup extras ---
  {
    // Four sweeping bends carved by old ice — long, committed corners.
    id: "glacier",
    name: "Glacier Run",
    roadWidth: 58,
    worldWidth: 1450,
    worldHeight: 1000,
    points: ring(725, 500, 490, 325, 16, 4, 0.13, 0.6),
  },
  {
    // A five-point star of frozen spears — the knot's colder cousin.
    id: "icicle",
    name: "Icicle Knot",
    roadWidth: 50,
    worldWidth: 1150,
    worldHeight: 1150,
    points: gear(575, 575, 430, 290, 5),
  },
  {
    // Three long drops with heavy compressions between them.
    id: "avalanche",
    name: "Avalanche Drop",
    roadWidth: 54,
    worldWidth: 1400,
    worldHeight: 1020,
    points: ring(700, 510, 470, 335, 12, 3, 0.19, Math.PI / 3),
  },

  // --- Dusk Cup extras ---
  {
    // Eight shallow kinks under the stars — high speed, never straight.
    id: "starlight",
    name: "Starlight Circuit",
    roadWidth: 52,
    worldWidth: 1500,
    worldHeight: 1000,
    points: ring(750, 500, 520, 340, 24, 8, 0.09),
  },
];

export function trackDefById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
