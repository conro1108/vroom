// The track catalog. Tracks are grouped into cups by game/cups.ts — the
// catalog itself is pure geometry. Layout safety (in-bounds, no
// self-overlapping road) is enforced by tracks.test.ts, so new layouts can
// be sketched against the tests. `unlock` on a def is legacy (cup unlocking
// replaced it) and intentionally absent from newer tracks.
//
// These are big, long courses on purpose: the fun is in having room to
// actually drive a corner sequence, not thread a wiggly ribbon. The archetypes
// that carry the catalog:
//   - serpentine(): the Switchback Pass shape — long straights joined by hard
//     hairpins, then a return leg. The most "driveable" layout we have.
//   - circuit(): a road course authored as a ring of corners in polar form.
//     Big angle gaps read as sweeps; low radii bite inward as hairpins.
//   - gear(): a star/clover of sharp lobes.
//   - hand-drawn point lists for the speed ovals and the hero courses.
import type { TrackDef, TrackPoint } from "./track";

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

/**
 * A road course authored as a ring of corners in polar form. Each entry is
 * `[angleDeg, radiusFraction]` around center (cx,cy) on an rx×ry ellipse, in
 * increasing angle. Big angle gaps become long sweeps; low radius fractions
 * bite inward as hairpins. This buys the shape variety of freehand points with
 * far less pinch risk, since everything stays inside one ellipse band.
 */
function circuit(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  corners: readonly (readonly [number, number])[]
): TrackPoint[] {
  return corners.map(([deg, rf]) => {
    const a = (deg * Math.PI) / 180;
    return { x: Math.round(cx + Math.cos(a) * rx * rf), y: Math.round(cy + Math.sin(a) * ry * rf) };
  });
}

/**
 * A switchback course — `rows` (odd) horizontal straights stacked top→down,
 * joined by hard hairpins on alternating ends, then a return leg that hugs the
 * outer right side and top back to the start. The Switchback Pass archetype,
 * generalized to fill a W×H world: straights you can attack, punctuated by real
 * hairpins. `mirror` flips it left-for-right so reused instances don't all curve
 * the same way. `rows` must be odd and ≥ 3, so the last straight ends on the
 * return side with at least one hairpin between.
 *
 * Keep straights modest (W ≲ 1800) and hairpins wide — a car that reaches top
 * speed on a long straight can't scrub enough for the 180° that follows. Note
 * hairpin width (`bulge`) is driven by row spacing, i.e. by H and `rows`, not by
 * W: a tall world or few rows makes fat hairpins that eat the straights. The
 * guards below fail loud if `rows` is invalid or the straights would invert into
 * a self-crossing pinch, rather than leaving the next author a cryptic geometry
 * test failure.
 */
function serpentine(W: number, H: number, rows: number, mirror = false): TrackPoint[] {
  if (rows < 3 || rows % 2 === 0) {
    throw new Error(`serpentine: rows must be odd and >= 3, got ${rows}`);
  }
  // Margins are generous because Catmull-Rom overshoots corners outward by a
  // good margin — the road has to stay clear of the world edge through the
  // overshoot, not just at the control points.
  const m = 240; // world margin
  const topReturn = m; // the return straight runs along the top
  const y0 = m + 210; // first zig-zag row
  const yN = H - m - 40; // last zig-zag row
  const dy = (yN - y0) / (rows - 1); // row spacing == hairpin diameter
  const bulge = 0.8 * dy; // how far a hairpin loops past the straight; > dy/2
  // makes the apex a gentle-enough 180° that the car isn't asked to turn
  // sharper than it physically can.
  const corridorGap = 110; // clear space between a right hairpin apex and the return leg
  const xL = m + bulge + 40; // left straight ends (leaves room for left hairpins)
  const xR = W - m - bulge - corridorGap; // right straight ends
  if (xL >= xR) {
    throw new Error(
      `serpentine: hairpins (bulge ${bulge.toFixed(0)}) leave no straight in a ` +
        `${W}×${H} world — widen W, or lower H / raise rows to shrink row spacing`
    );
  }
  const xRet = W - m; // return leg up the right edge
  const xMid = (xL + xR) / 2;
  const pts: TrackPoint[] = [];
  const P = (x: number, y: number) =>
    pts.push({ x: Math.round(mirror ? W - x : x), y: Math.round(y) });
  // A rounded (slightly elongated) U connecting the two straight ends dy apart,
  // as three points along a half-ellipse — a real hairpin, not a cusp.
  const hairpin = (xEnd: number, yr: number, dir: 1 | -1) => {
    P(xEnd + dir * bulge * 0.71, yr + dy * 0.146);
    P(xEnd + dir * bulge, yr + dy * 0.5);
    P(xEnd + dir * bulge * 0.71, yr + dy * 0.854);
  };
  // Start mid top-straight, not at a corner: the bot (and a real player) needs
  // clean runway either side of the line, or a twitchy car spins on the spot.
  P(xMid, y0);
  P(xR, y0);
  if (rows > 1) hairpin(xR, y0, 1); // first hairpin down on the right
  for (let r = 1; r < rows; r++) {
    const yr = y0 + r * dy;
    if (r % 2 === 0) {
      P(xL, yr);
      P(xR, yr);
      if (r < rows - 1) hairpin(xR, yr, 1); // hairpin down on the right
    } else {
      P(xR, yr);
      P(xL, yr);
      if (r < rows - 1) hairpin(xL, yr, -1); // hairpin down on the left
    }
  }
  // return: chamfer the bottom-right corner (a sharp 90° here overshoots the
  // world edge badly), run up the right edge, chamfer the top-right corner,
  // across the top and down the left edge to the top row's left end — the
  // closing span then runs along the top straight back through the start.
  P(xRet, yN - 60);
  P(xRet, topReturn + 60);
  P(xL, topReturn);
  P(xL, y0);
  return pts;
}

export const TRACKS: TrackDef[] = [
  {
    id: "meadow",
    name: "Meadow Loop",
    roadWidth: 66,
    worldWidth: 2000,
    worldHeight: 1400,
    points: [
      { x: 460, y: 320 },
      { x: 1020, y: 240 },
      { x: 1540, y: 340 },
      { x: 1720, y: 680 },
      { x: 1560, y: 1060 },
      { x: 1200, y: 1160 },
      { x: 980, y: 900 },
      { x: 720, y: 1160 },
      { x: 420, y: 1180 },
      { x: 240, y: 840 },
      { x: 320, y: 520 },
    ],
  },
  {
    // A long speed oval with a gentle chicane broken into the bottom straight,
    // so the lap has one place to think and everywhere else to hold it flat.
    id: "speedway",
    unlock: { track: "meadow", result: "podium" },
    name: "Sunny Speedway",
    roadWidth: 78,
    worldWidth: 2400,
    worldHeight: 1400,
    points: [
      { x: 560, y: 360 },
      { x: 900, y: 340 },
      { x: 1300, y: 340 },
      { x: 1700, y: 360 },
      { x: 1960, y: 470 },
      { x: 2080, y: 720 },
      { x: 1960, y: 970 },
      { x: 1700, y: 1050 },
      { x: 1420, y: 1030 },
      { x: 1240, y: 1130 },
      { x: 1060, y: 1030 },
      { x: 760, y: 1050 },
      { x: 460, y: 960 },
      { x: 340, y: 700 },
      { x: 440, y: 470 },
    ],
  },
  {
    // A snake of hairpins and sweeps around a wide ellipse — direction changes
    // with room to breathe between them.
    id: "serpent",
    unlock: { track: "speedway", result: "podium" },
    name: "Serpent Run",
    roadWidth: 60,
    worldWidth: 2300,
    worldHeight: 1300,
    points: circuit(1150, 650, 950, 500, [
      [5, 0.94],
      [30, 0.9],
      [70, 0.56],
      [108, 0.92],
      [140, 0.9],
      [180, 0.56],
      [218, 0.92],
      [250, 0.9],
      [292, 0.56],
      [330, 0.93],
    ]),
  },
  {
    id: "switchback",
    unlock: { track: "serpent", result: "podium" },
    name: "Switchback Pass",
    roadWidth: 60,
    worldWidth: 1700,
    worldHeight: 1500,
    points: serpentine(1700, 1500, 3),
  },
  {
    id: "knot",
    unlock: { track: "switchback", result: "podium" },
    name: "Clover Knot",
    roadWidth: 50,
    worldWidth: 1700,
    worldHeight: 1700,
    points: gear(850, 850, 640, 400, 6),
  },
  {
    id: "gauntlet",
    unlock: { track: "knot", result: "podium" },
    name: "The Gauntlet",
    roadWidth: 76,
    worldWidth: 2520,
    worldHeight: 1680,
    points: [
      { x: 348, y: 250 },
      { x: 1112, y: 181 },
      { x: 1877, y: 236 },
      { x: 2307, y: 528 },
      { x: 2196, y: 917 },
      { x: 1835, y: 1029 },
      { x: 1640, y: 806 },
      { x: 1390, y: 751 },
      { x: 1223, y: 973 },
      { x: 1390, y: 1251 },
      { x: 904, y: 1362 },
      { x: 487, y: 1390 },
      { x: 209, y: 1084 },
      { x: 306, y: 778 },
      { x: 195, y: 473 },
    ],
  },
  {
    // Bonus branch: a wide lagoon that flows fast until one hard inward bay,
    // the reward for a first win on the oval.
    id: "lagoon",
    unlock: { track: "speedway", result: "win" },
    name: "Lost Lagoon",
    roadWidth: 70,
    worldWidth: 2000,
    worldHeight: 1500,
    points: circuit(1000, 750, 800, 600, [
      [10, 0.95],
      [45, 0.92],
      [95, 0.68],
      [135, 0.94],
      [180, 0.5],
      [225, 0.9],
      [270, 0.95],
      [315, 0.7],
      [345, 0.92],
    ]),
  },
  {
    // Bonus branch: a chicane strung across the top, one flat-out straight
    // home — the victory lap for conquering The Gauntlet.
    id: "rally",
    unlock: { track: "gauntlet", result: "win" },
    name: "Rally Ridge",
    roadWidth: 60,
    worldWidth: 2400,
    worldHeight: 1300,
    points: [
      { x: 360, y: 320 },
      { x: 620, y: 240 },
      { x: 860, y: 360 },
      { x: 1120, y: 240 },
      { x: 1380, y: 360 },
      { x: 1640, y: 240 },
      { x: 1900, y: 340 },
      { x: 2080, y: 560 },
      { x: 1980, y: 820 },
      { x: 1640, y: 940 },
      { x: 1120, y: 960 },
      { x: 620, y: 940 },
      { x: 320, y: 840 },
      { x: 220, y: 560 },
    ],
  },

  // --- Sprout Cup extras ---
  {
    // Gentle five-petal flower: wide, forgiving, teaches flowing lines.
    id: "daisy",
    name: "Daisy Ring",
    roadWidth: 62,
    worldWidth: 2000,
    worldHeight: 1400,
    points: ring(1000, 700, 660, 470, 15, 5, 0.12),
  },

  // --- Dune Cup ---
  {
    // A big lazy oval that leans through the heat — flat out almost everywhere.
    id: "mirage",
    name: "Mirage Oval",
    roadWidth: 82,
    worldWidth: 2400,
    worldHeight: 1300,
    points: [
      { x: 600, y: 420 },
      { x: 1040, y: 360 },
      { x: 1500, y: 360 },
      { x: 1900, y: 440 },
      { x: 2080, y: 660 },
      { x: 1900, y: 900 },
      { x: 1480, y: 960 },
      { x: 1020, y: 960 },
      { x: 620, y: 880 },
      { x: 400, y: 660 },
      { x: 480, y: 470 },
    ],
  },
  {
    // A long technical circuit — a chain of tight hairpins strung around the
    // dunes like a snake's track in the sand.
    id: "sidewinder",
    name: "Sidewinder",
    roadWidth: 56,
    worldWidth: 2200,
    worldHeight: 1500,
    points: circuit(1100, 760, 940, 560, [
      [0, 0.9],
      [35, 0.5],
      [70, 0.92],
      [105, 0.5],
      [150, 0.9],
      [185, 0.52],
      [220, 0.92],
      [260, 0.5],
      [300, 0.9],
      [335, 0.52],
    ]),
  },
  {
    // Four hard lobes of scorched hardpan — a blunter, faster clover.
    id: "scorch",
    name: "Scorch Flats",
    roadWidth: 58,
    worldWidth: 1900,
    worldHeight: 1900,
    points: gear(950, 950, 720, 480, 4),
  },

  // --- Tide Cup ---
  {
    // Three bays around a headland — a long rhythm track by the sea.
    id: "cove",
    name: "Sandy Cove",
    roadWidth: 68,
    worldWidth: 2000,
    worldHeight: 1500,
    points: circuit(1000, 760, 820, 600, [
      [15, 0.95],
      [55, 0.9],
      [95, 0.55],
      [150, 0.95],
      [200, 0.55],
      [255, 0.95],
      [300, 0.9],
      [335, 0.55],
    ]),
  },
  {
    // Two long plank straights joined by round piers — pure speed.
    id: "boardwalk",
    name: "Boardwalk Sprint",
    roadWidth: 84,
    worldWidth: 2400,
    worldHeight: 1300,
    points: [
      { x: 620, y: 320 },
      { x: 1020, y: 300 },
      { x: 1420, y: 300 },
      { x: 1820, y: 320 },
      { x: 2040, y: 430 },
      { x: 2140, y: 620 },
      { x: 2040, y: 810 },
      { x: 1820, y: 900 },
      { x: 1420, y: 920 },
      { x: 1020, y: 920 },
      { x: 620, y: 900 },
      { x: 380, y: 810 },
      { x: 280, y: 620 },
      { x: 380, y: 430 },
    ],
  },
  {
    // A big looping reef shelf — sweeps into six deep hairpin bays.
    id: "reef",
    name: "Reef Loop",
    roadWidth: 62,
    worldWidth: 2200,
    worldHeight: 1500,
    points: circuit(1100, 760, 940, 560, [
      [15, 0.95],
      [60, 0.55],
      [110, 0.92],
      [160, 0.55],
      [210, 0.95],
      [255, 0.55],
      [300, 0.92],
      [345, 0.6],
    ]),
  },
  {
    // A pinched peanut around the point break — two bowls, one waist.
    id: "breaker",
    name: "Breaker Bay",
    roadWidth: 76,
    worldWidth: 2200,
    worldHeight: 1400,
    points: circuit(1100, 700, 900, 520, [
      [0, 0.97],
      [40, 0.82],
      [90, 0.52],
      [140, 0.82],
      [180, 0.97],
      [220, 0.82],
      [270, 0.52],
      [320, 0.82],
    ]),
  },

  // --- Frost Cup extras ---
  {
    // Four long committed sweepers carved by old ice.
    id: "glacier",
    name: "Glacier Run",
    roadWidth: 74,
    worldWidth: 2200,
    worldHeight: 1600,
    points: circuit(1100, 800, 880, 640, [
      [10, 0.95],
      [60, 0.74],
      [100, 0.95],
      [150, 0.74],
      [200, 0.95],
      [250, 0.72],
      [300, 0.95],
      [345, 0.72],
    ]),
  },
  {
    // A five-point star of frozen spears — the knot's colder cousin.
    id: "icicle",
    name: "Icicle Knot",
    roadWidth: 50,
    worldWidth: 1800,
    worldHeight: 1800,
    points: gear(900, 900, 680, 440, 5),
  },
  {
    // Long drops into heavy hairpins — a technical plunge down the mountain.
    id: "avalanche",
    name: "Avalanche Drop",
    roadWidth: 58,
    worldWidth: 2000,
    worldHeight: 1600,
    points: circuit(1000, 820, 850, 640, [
      [10, 0.9],
      [50, 0.52],
      [95, 0.9],
      [140, 0.5],
      [190, 0.9],
      [235, 0.52],
      [285, 0.9],
      [330, 0.55],
    ]),
  },

  // --- Dusk Cup extras ---
  {
    // Eight quick kinks under the stars — high speed, never straight.
    id: "starlight",
    name: "Starlight Circuit",
    roadWidth: 66,
    worldWidth: 2400,
    worldHeight: 1500,
    points: circuit(1200, 750, 1000, 600, [
      [0, 0.94],
      [45, 0.82],
      [90, 0.94],
      [135, 0.82],
      [180, 0.94],
      [225, 0.82],
      [270, 0.94],
      [315, 0.82],
    ]),
  },
];

export function trackDefById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
