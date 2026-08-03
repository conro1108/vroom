// The track catalog. Tracks are grouped into cups by game/cups.ts — the
// catalog itself is pure geometry. Layout safety (in-bounds, no
// self-overlapping road) is enforced by tracks.test.ts, so new layouts can
// be sketched against the tests. `unlock` on a def is legacy (cup unlocking
// replaced it) and intentionally absent from newer tracks.
//
// These are big, long courses on purpose: the fun is in having room to
// actually drive a corner sequence, not thread a wiggly ribbon. The archetypes
// that carry the catalog — deliberately five different *shapes of lap*, since a
// catalog authored in polar form alone comes out as twenty variations on "a
// circle with some bends pinched into it":
//   - dogbone(): two bowls turning opposite ways joined by a two-way neck. The
//     only layout whose lap runs through the middle of its own silhouette.
//   - street(): four straights meeting in square corners, plus a chicane.
//     Braking points instead of a racing line.
//   - serpentine(): the Switchback Pass shape — long straights joined by hard
//     hairpins, then a return leg. The most "driveable" layout we have.
//   - hook(): a fast rounded box with one hairpin spur off a straight. The
//     shape that gives a lap a *slow section* rather than an even rhythm.
//   - circuit(): a road course authored as a ring of corners in polar form.
//     Big angle gaps read as sweeps; low radii bite inward as hairpins.
//   - gear(): a star/clover of sharp lobes. Two tracks only — it was the whole
//     catalog once, and a field of stars all drives the same.
//   - hand-drawn point lists for the speed ovals and the hero courses.
//
// Authoring a corner that's actually a corner is its own trap, and the
// steering-demand test in tracks.test.ts is what holds the line on it. A bend
// shallower than the road is wide disappears into the corridor entirely, and in
// polar form a radius that eases inward over 40° of angle is a spiral you hold
// flat, not a turn — a bite has to drop hard between control points ~30° apart
// to read as one. Same story elsewhere: a fat chamfer rounds a square corner
// into a sweeper, and a hairpin much wider than the car's own turning circle is
// just a straight with a bend in it.
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

/** Points along a circle, from `fromDeg` to `toDeg` (increasing), inclusive. */
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, count: number) {
  const out: TrackPoint[] = [];
  for (let k = 0; k < count; k++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * k) / (count - 1)) * Math.PI) / 180;
    out.push({ x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r) });
  }
  return out;
}

/** Evenly spaced points strictly between two ends (the ends themselves come
 *  from whatever the straight joins), so Catmull-Rom holds the line straight. */
function straight(a: TrackPoint, b: TrackPoint, count: number) {
  return Array.from({ length: count }, (_, k) => ({
    x: Math.round(a.x + ((b.x - a.x) * (k + 1)) / (count + 1)),
    y: Math.round(a.y + ((b.y - a.y) * (k + 1)) / (count + 1)),
  }));
}

/**
 * A dogbone: two bowls turning opposite ways, joined by a neck of two parallel
 * straights. It's the figure-eight you can build without crossing the road, and
 * the only archetype here whose lap runs through the middle of its own
 * silhouette instead of around one big empty infield — the neck is a genuine
 * two-way corridor with racing on both sides of it.
 *
 * `rR` well under `rL` turns the far bowl into a bulb on the end of a long
 * out-and-back tail. `gap` (the distance between the neck's two legs) has to
 * clear the pinch check — roadWidth + 14 — or the two ribbons read as one road,
 * and it can't exceed either bowl's diameter.
 */
const MIN_NECK = 200; // shortest neck that still reads as a straight between the bowls

function dogbone(W: number, H: number, rL: number, rR: number, gap: number, m = 190): TrackPoint[] {
  if (gap > 2 * Math.min(rL, rR)) {
    throw new Error(`dogbone: neck gap ${gap} is wider than the smaller bowl (${2 * Math.min(rL, rR)})`);
  }
  // Bowls that overlap don't make a shorter neck, they make a folded mess the
  // pinch test only catches downstream — so say so here instead.
  const neck = W - 2 * m - 2 * (rL + rR);
  if (neck < MIN_NECK) {
    throw new Error(
      `dogbone: bowls r${rL}/r${rR} leave ${neck.toFixed(0)}px of neck in a ${W}px world ` +
        `(need ${MIN_NECK}) — shrink the bowls or widen the world`
    );
  }
  const cy = H / 2;
  const cxL = m + rL;
  const cxR = W - m - rR;
  const deg = (r: number) => (Math.asin(gap / 2 / r) * 180) / Math.PI;
  const [dL, dR] = [deg(rL), deg(rR)];
  // Left bowl: entered at its lower-right, swept the long way round to its
  // upper-right. Right bowl: the mirror, so the two turn opposite ways.
  const left = arc(cxL, cy, rL, dL, 360 - dL, 9);
  const right = arc(cxR, cy, rR, 180 + dR, 540 - dR, 9);
  const topA = left[left.length - 1]!;
  const topB = right[0]!;
  const botA = right[right.length - 1]!;
  const botB = left[0]!;
  const top = straight(topA, topB, 3);
  // Start the lap mid-neck on the top leg: a start line wants runway either
  // side of it, not the exit of a bowl.
  const half = Math.ceil(top.length / 2);
  return [...top.slice(half), ...right, ...straight(botA, botB, 3), ...left, ...top.slice(0, half)];
}

/**
 * A street box: four long straights meeting in square corners (chamfered so
 * Catmull-Rom rounds them into a real 90° rather than a cusp), with a chicane
 * kinked into the bottom straight. Nothing here is a lobe — the corners are
 * joins between straights, which is what none of the polar layouts can do.
 */
interface StreetOpts {
  m?: number; // world margin
  chamfer?: number; // how far back from each corner the turn-in point sits
  chicane?: number; // how deep the bottom-straight kink bites
  chicaneShift?: number; // slide the chicane along the bottom straight
  taper?: number; // pull the top straight in by this much each side (a trapezoid, not a box)
}

function street(W: number, H: number, opts: StreetOpts = {}): TrackPoint[] {
  // A generous chamfer rounds the "square" corners into sweepers you carry
  // full speed through, which is the opposite of the point — keep it short
  // enough that the corner is a braking zone, and the chicane deep enough to
  // actually be two direction changes.
  const { m = 260, chamfer = 150, chicane = 230, chicaneShift = 0, taper = 0 } = opts;
  const [x0, x1, y0, y1] = [m, W - m, m, H - m];
  const c = chamfer;
  const [tx0, tx1] = [x0 + taper, x1 - taper];
  const bot = (x0 + x1) / 2 + chicaneShift;
  return [
    { x: Math.round((tx0 + tx1) / 2), y: y0 }, // start line, mid main straight
    { x: tx1 - c, y: y0 },
    { x: x1, y: y0 + c + taper },
    { x: x1, y: y1 - c },
    { x: x1 - c, y: y1 },
    // the chicane: two quick kinks inward, the one place the lap isn't flat out
    { x: Math.round(bot + 190), y: y1 },
    { x: Math.round(bot), y: y1 - chicane },
    { x: Math.round(bot - 190), y: y1 },
    { x: x0 + c, y: y1 },
    { x: x0, y: y1 - c },
    { x: x0, y: y0 + c + taper },
    { x: tx0 + c, y: y0 },
  ];
}

interface HookOpts {
  m?: number; // world margin
  chamfer?: number; // corner turn-in distance
  spurAt?: number; // where along the bottom straight the spur turns in (px from the right end)
  gap?: number; // distance between the spur's two legs — the U's diameter
  depth?: number; // how far up into the infield the spur reaches
}

/**
 * A stadium hook: a fast rounded box with one hairpin spur that turns off the
 * bottom straight, runs up into the infield, U-turns and comes back out. Where
 * the dogbone's neck is the whole lap's spine, the hook is one detour off an
 * otherwise flat-out loop — the shape that makes a lap have a *slow section*
 * rather than an even rhythm of corners.
 */
function hook(W: number, H: number, opts: HookOpts = {}): TrackPoint[] {
  // `gap` is the U's diameter, so it's what decides whether the spur is a
  // hairpin or a wide bowl you can hold flat. Keep it near the car's own
  // turning circle — a fat U is just a longer straight with a bend in it.
  const { m = 240, chamfer = 170, spurAt = 420, gap = 180, depth = 460 } = opts;
  const [x0, x1, y0, y1] = [m, W - m, m, H - m];
  const c = chamfer;
  const xs = x1 - spurAt; // the spur's right-hand leg
  const yU = y1 - depth; // the U at the top of the spur
  return [
    { x: Math.round((x0 + x1) / 2), y: y0 }, // start line, mid main straight
    { x: x1 - c, y: y0 },
    { x: x1, y: y0 + c },
    { x: x1, y: y1 - c },
    { x: x1 - c, y: y1 },
    // turn off the straight, up into the infield, round the U and back out
    { x: Math.round(xs + 70), y: y1 },
    { x: Math.round(xs), y: Math.round(y1 - depth * 0.42) },
    ...arc(Math.round(xs - gap / 2), Math.round(yU), gap / 2, 0, -180, 5),
    { x: Math.round(xs - gap), y: Math.round(y1 - depth * 0.42) },
    { x: Math.round(xs - gap - 70), y: y1 },
    { x: x0 + c, y: y1 },
    { x: x0, y: y1 - c },
    { x: x0, y: y0 + c },
    { x: x0 + c, y: y0 },
  ];
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
  const bulge = 0.62 * dy; // how far a hairpin loops past the straight; > dy/2
  // makes the apex a gentle-enough 180° that the car isn't asked to turn
  // sharper than it physically can. Kept only just over that floor: further out
  // and the "hairpin" opens into a bowl you hold flat, which is no hairpin.
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
    roadWidth: 82,
    worldWidth: 2000,
    worldHeight: 1400,
    points: [
      { x: 460, y: 320 },
      // a lazy S across the top: the first thing the game teaches is that the
      // road changes direction on you, so the opening lap can't be one long arc
      { x: 900, y: 190 },
      { x: 1180, y: 430 },
      { x: 1540, y: 300 },
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
    roadWidth: 98,
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
    roadWidth: 75,
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
    roadWidth: 75,
    worldWidth: 1700,
    worldHeight: 1500,
    points: serpentine(1700, 1500, 5),
  },
  {
    // Two tight bowls knotted onto one narrow neck — the tightest dogbone in
    // the game, and the one where the neck traffic matters: you're threading
    // back past the cars still coming the other way.
    id: "knot",
    unlock: { track: "switchback", result: "podium" },
    name: "Clover Knot",
    roadWidth: 66,
    worldWidth: 2000,
    worldHeight: 1300,
    points: dogbone(2100, 1300, 300, 300, 200),
  },
  {
    id: "gauntlet",
    unlock: { track: "knot", result: "podium" },
    name: "The Gauntlet",
    roadWidth: 95,
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
    roadWidth: 88,
    worldWidth: 2000,
    worldHeight: 1500,
    points: circuit(1000, 750, 800, 600, [
      [10, 0.95],
      [45, 0.92],
      [95, 0.45],
      [135, 0.94],
      [180, 0.5],
      [225, 0.9],
      [270, 0.95],
      [315, 0.45],
      [345, 0.92],
    ]),
  },
  {
    // Bonus branch: a chicane strung across the top, one flat-out straight
    // home — the victory lap for conquering The Gauntlet.
    id: "rally",
    unlock: { track: "gauntlet", result: "win" },
    name: "Rally Ridge",
    roadWidth: 75,
    worldWidth: 2400,
    worldHeight: 1300,
    points: [
      { x: 360, y: 320 },
      { x: 620, y: 200 },
      { x: 860, y: 470 },
      { x: 1120, y: 200 },
      { x: 1380, y: 470 },
      { x: 1640, y: 200 },
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
    // Two wide bowls linked by a short two-way neck: the lap turns one way,
    // then the other, with a straight to breathe on between. Forgiving radii —
    // this is where the Sprout Cup teaches direction changes.
    id: "daisy",
    name: "Daisy Chain",
    roadWidth: 78,
    worldWidth: 2400,
    worldHeight: 1500,
    points: dogbone(2400, 1500, 390, 390, 220),
  },

  // --- Dune Cup ---
  {
    // A big lazy oval that leans through the heat — flat out almost everywhere.
    id: "mirage",
    name: "Mirage Oval",
    speedOval: true,
    roadWidth: 102,
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
    // The snake track it's named after: straights across the sand joined by
    // hard hairpins at either end, mirrored so it doesn't read as the Frost
    // Cup's switchback with a repaint.
    id: "sidewinder",
    name: "Sidewinder",
    roadWidth: 80,
    worldWidth: 2100,
    worldHeight: 1500,
    points: hook(2100, 1500, { chamfer: 130, spurAt: 620, gap: 170, depth: 620 }),
  },
  {
    // Four flat-out straights and four square corners scorched into the
    // hardpan, with one chicane to break up the bottom run. Braking points
    // instead of a racing line: nothing here is a curve you can carry.
    id: "scorch",
    name: "Scorch Flats",
    roadWidth: 78,
    worldWidth: 2200,
    worldHeight: 1700,
    points: street(2200, 1700, { chamfer: 120, chicane: 300 }),
  },

  // --- Tide Cup ---
  {
    // Three bays around a headland — a long rhythm track by the sea.
    id: "cove",
    name: "Sandy Cove",
    roadWidth: 85,
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
    speedOval: true,
    roadWidth: 105,
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
    // The shelf and the channel: one big bowl out on the reef, a long two-way
    // run in, and a tight bulb to turn around in at the far end.
    id: "reef",
    name: "Reef Loop",
    roadWidth: 78,
    worldWidth: 2300,
    worldHeight: 1500,
    points: dogbone(2300, 1500, 520, 250, 230),
  },
  {
    // A pinched peanut around the point break — two bowls, one waist. The
    // waists cut deep and the shoulders either side stay wide, so each one is a
    // real turn-in rather than a smooth narrowing you can carry speed through.
    id: "breaker",
    name: "Breaker Bay",
    roadWidth: 95,
    worldWidth: 2200,
    worldHeight: 1400,
    points: circuit(1100, 700, 900, 520, [
      [0, 0.98],
      [58, 0.94],
      [86, 0.4],
      [114, 0.94],
      [180, 0.98],
      [238, 0.94],
      [266, 0.4],
      [294, 0.94],
    ]),
  },

  // --- Frost Cup extras ---
  {
    // Two long committed sweepers carved by old ice, each ending in a gouge
    // that turns hard back on itself. The gouges are the lap: the sweepers are
    // where you build the speed you have to give back to them.
    id: "glacier",
    name: "Glacier Run",
    roadWidth: 92,
    worldWidth: 2200,
    worldHeight: 1600,
    points: circuit(1100, 800, 880, 640, [
      [0, 0.97],
      [42, 0.95],
      [72, 0.44],
      [102, 0.95],
      [150, 0.98],
      [180, 0.97],
      [222, 0.95],
      [252, 0.44],
      [282, 0.95],
      [330, 0.98],
    ]),
  },
  {
    // A five-point star of frozen spears — the knot's colder cousin.
    id: "icicle",
    name: "Icicle Knot",
    roadWidth: 62,
    worldWidth: 1800,
    worldHeight: 1800,
    points: gear(900, 900, 680, 440, 5),
  },
  {
    // Long straights walled in by snowbanks, square corners at the ends, and a
    // chicane where the slide came through — a plunge you brake for, not lean
    // through.
    id: "avalanche",
    name: "Avalanche Drop",
    roadWidth: 74,
    worldWidth: 2000,
    worldHeight: 1800,
    points: street(2000, 1800, { m: 250, chamfer: 150, chicane: 300, chicaneShift: -230, taper: 260 }),
  },

  // --- Dusk Cup extras ---
  {
    // Four points of starlight, each a genuine hook inward off a long sweep.
    // The kinks used to be a 12% radial wobble on a 1000px radius — smaller
    // than the road is wide, so the whole lap was one flat-out circle. They
    // bite to half radius now, at uneven angles so no two feel alike.
    id: "starlight",
    name: "Starlight Circuit",
    roadWidth: 82,
    worldWidth: 2400,
    worldHeight: 1500,
    points: circuit(1200, 750, 1000, 600, [
      [0, 0.97],
      [40, 0.52],
      [78, 0.95],
      [118, 0.55],
      [160, 0.98],
      [200, 0.5],
      [242, 0.94],
      [284, 0.58],
      [322, 0.96],
    ]),
  },

  // --- Rainbow Cup: the endgame. Every layout here is bigger and busier than
  // anything in the earlier cups — longer laps, more direction changes, and
  // they're meant to be a handful at 200cc.
  //
  // Up here the deal is different: the road is *wider* than anywhere else, and
  // there's no grass to catch it (`voidRunoff`). Run off in space and you fall,
  // which costs the same rescue stall a long grass excursion does, only
  // instantly. Wide + no runoff is the whole character of the cup; the radii
  // below shrank to buy the extra road width without pushing a lap into the
  // world edge.
  {
    // The name, finally drawn: a huge head of a bowl and a long tail of a
    // two-way straight out into the dark, with a bulb to whip round at the far
    // end. The longest lap in the game, and the fastest — over the void the
    // tail has nothing either side of it but the neighbouring lane.
    id: "comet",
    name: "Comet Tail",
    roadWidth: 92,
    voidRunoff: true,
    worldWidth: 2800,
    worldHeight: 1700,
    points: dogbone(2800, 1700, 590, 200, 240),
  },
  {
    // Eight spikes off a collapsed star: the Clover Knot with the dial past
    // where the dial goes.
    id: "pulsar",
    name: "Pulsar Spin",
    roadWidth: 84,
    voidRunoff: true,
    worldWidth: 2000,
    worldHeight: 2000,
    points: gear(1000, 1000, 780, 540, 8),
  },
  {
    // Switchbacks strung across the nebula: long drift straights stacked over
    // nothing, joined by 180s you have to actually brake for. Nowhere on it are
    // you pointed the same way twice in a row. Mirrored, and in a much wider
    // world than Switchback Pass, so the straights are long enough to bank a
    // drift down and the two don't drive like the same track repainted.
    id: "nebula",
    name: "Nebula Drift",
    roadWidth: 92,
    voidRunoff: true,
    worldWidth: 2400,
    worldHeight: 1700,
    points: serpentine(2400, 1700, 5, true),
  },
  {
    // The hero course. Deliberately irregular — long flat-out sweeps that dump
    // you straight into a hairpin, so learning it is the whole point.
    id: "rainbow",
    name: "Rainbow Run",
    roadWidth: 88,
    voidRunoff: true,
    worldWidth: 2800,
    worldHeight: 2000,
    points: circuit(1400, 1000, 1230, 850, [
      [0, 0.97],
      [24, 0.94],
      [56, 0.5],
      [86, 0.9],
      [112, 0.56],
      [148, 0.98],
      [186, 0.93],
      [206, 0.47],
      [238, 0.9],
      [268, 0.62],
      [296, 0.97],
      [320, 0.5],
      [344, 0.93],
    ]),
  },
];

export function trackDefById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0]!;
}
