// Cosmos Cup: nothing but road, stars and things too big to be real. `void` ground
// gets no scatter, so every object here is a landmark placed by a track, and each
// stands at road height: geometry is built around y=0 and hangs above and below.
import { at, ball, box, cone, cyl, lumpy, merge, rand, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const PINK = 0xff3fd0;
const CYAN = 0x3ff0ff;
const GOLD = 0xffd84f;
const VIOLET = 0x7a4cff;

/** Hoop of boxes in the plane facing along x. */
function hoop(r: number, n: number, thick: number, colors: number[]): Geo[] {
  const parts: Geo[] = [];
  const len = ((Math.PI * 2 * r) / n) * 1.06;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    parts.push(at(box(thick, thick, len, colors[k % colors.length]!), 0, Math.sin(a) * r, Math.cos(a) * r, Math.PI / 2 - a));
  }
  return parts;
}

/** A sphere of stacked drums, so a planet gets stripes without a texture. */
function planet(r: number, stripes: number[]): Geo[] {
  const n = stripes.length;
  const parts: Geo[] = [];
  for (let k = 0; k < n; k++) {
    const [y0, y1] = [-r + (k * 2 * r) / n, -r + ((k + 1) * 2 * r) / n];
    const rad = (y: number) => Math.sqrt(Math.max(0.0001, r * r - y * y));
    parts.push(at(cyl(rad(y1), rad(y0), y1 - y0, 20, stripes[k]!), 0, (y0 + y1) / 2, 0));
  }
  return parts;
}

/** Flat ring of thin tiles round the y axis. */
function disc(r0: number, r1: number, n: number, colors: number[], y = 0): Geo[] {
  const parts: Geo[] = [];
  const mid = (r0 + r1) / 2;
  const len = ((Math.PI * 2 * mid) / n) * 1.08;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    parts.push(at(box(len, 1.2, r1 - r0, colors[k % colors.length]!), Math.cos(a) * mid, y, Math.sin(a) * mid, 0, -a + Math.PI / 2));
  }
  return parts;
}

const crystal = (h: number, r: number, color: number) => at(cone(r, h, 4, color), 0, h / 2, 0);

registerProps({
  ringplanet: () => {
    const body = planet(100, [0xffb24f, 0xff8a4f, 0xffd98a, 0xe0603f, 0xffb24f, 0xffe6b0, 0xff8a4f, 0xc94f4f]);
    const ring = [...disc(135, 165, 56, [0xffe6b0, 0xc9a0ff]), ...disc(172, 190, 60, [0x9fe0ff, 0xffffff])];
    return merge([...body, ...ring].map((g) => at(g, 0, 0, 0, 0.3, 0, 0.2)));
  },
  gasgiant: () =>
    merge(planet(120, [0x3f5cff, 0x4fa0ff, 0x7ad8ff, 0xd8f4ff, 0x4fa0ff, 0x7a5cff, 0x3f5cff, 0x2a2aa0]).map((g) => at(g, 0, 0, 0, 0.4, 0, 0.24))),
  lavaworld: () =>
    merge([
      at(lumpy(ball(80, 3, 0xff4f2a), 0.04, 3), 0, 0, 0),
      ...[0, 1, 2, 3, 4, 5, 6].map((k) => at(ball(16 + k * 2, 1, 0xffd84f), Math.sin(k * 2.2) * 62, Math.cos(k * 1.3) * 50, Math.cos(k * 2.2) * 62)),
    ]),
  moon: () => {
    const parts: Geo[] = [at(lumpy(ball(30, 2, 0xd0d4e8), 0.05, 8), 0, 0, 0)];
    for (let k = 0; k < 7; k++) parts.push(at(ball(5 + (k % 3) * 2, 1, 0x9aa0c0), Math.sin(k * 2.4) * 26, Math.cos(k * 1.7) * 26, Math.cos(k * 2.4) * 15));
    return merge(parts);
  },
  asteroid: () => merge([at(lumpy(ball(12, 1, 0x8a7ab0), 0.3, 6), 0, 0, 0, 0.3, 0.5, 0, [1.3, 0.8, 1])]),
  /** Rock with a crown of crystals, the unit of an asteroid field. */
  crystalroid: () => {
    const parts: Geo[] = [at(lumpy(ball(14, 1, 0x4a3a78), 0.28, 4), 0, 0, 0, 0, 0, 0, [1.3, 0.75, 1])];
    const tints = [CYAN, PINK, 0x9affd8, VIOLET];
    for (let k = 0; k < 8; k++) {
      const a = k * 2.4;
      parts.push(at(crystal(14 + (k % 3) * 7, 3 + (k % 2) * 1.5, tints[k % 4]!), Math.cos(a) * (2 + k * 1.4), 6, Math.sin(a) * (2 + k * 1.4), Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5));
    }
    return merge(parts);
  },
  /** A belt in one mesh, ~900m long: rocks and crystals strung along x. */
  asteroidbelt: () => {
    const r = rand(31);
    const parts: Geo[] = [];
    for (let k = 0; k < 46; k++) {
      const c = [0x8a7ab0, 0x5a4a88, CYAN, 0x6a5aa0][k % 4]!;
      const s = 6 + r() * 20;
      parts.push(at(k % 4 === 2 ? cone(s * 0.5, s * 1.8, 4, c) : lumpy(ball(s, 1, c), 0.3, k), -450 + k * 20 + r() * 12, (r() - 0.5) * 90, (r() - 0.5) * 120, r() * 3, r() * 3, 0));
    }
    return merge(parts);
  },
  /** Spans the road: local z is across it, centred at side 0. */
  stargate: () => {
    const parts = [...hoop(34, 16, 3.4, [VIOLET, 0x2a1f6e]), ...hoop(30, 32, 1, [CYAN, CYAN, PINK, PINK])];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      parts.push(at(cone(3, 12, 4, GOLD), 0, Math.sin(a) * 42, Math.cos(a) * 42, -a + Math.PI / 2));
    }
    return merge(parts.map((g) => at(g, 0, 8, 0)));
  },
  ringgate: () => merge(hoop(15, 18, 1.2, [PINK, CYAN]).map((g) => at(g, 0, 5, 0))),
  /** Sits a long way under its anchor, so roads can circle above the disc. */
  blackhole: () => {
    const parts: Geo[] = [
      at(ball(30, 3, 0x050208), 0, 0, 0),
      ...disc(36, 58, 44, [0xffffff, 0xffd84f]),
      ...disc(58, 92, 52, [0xffd84f, 0xff8a2a]),
      ...disc(92, 134, 60, [0xff5a2a, 0xff3fa0]),
      ...disc(134, 180, 68, [0xa02fd0, 0x5a1fa0]),
    ];
    return merge(parts.map((g) => at(g, 0, -52, 0, 0.06, 0, 0.04)));
  },
  /** Home, a long way away: a scrap of Green Cup meadow adrift in space. */
  floatisle: () => {
    const parts: Geo[] = [
      at(lumpy(cone(40, 60, 8, 0x8a6a4a), 0.1, 3), 0, -30, 0, Math.PI),
      at(cyl(41, 40, 3, 10, 0x6dcb4c), 0, 1.5, 0),
    ];
    for (let k = 0; k < 9; k++) {
      const [x, z] = [Math.cos(k * 2.3) * (7 + k * 3), Math.sin(k * 2.3) * (7 + k * 3)];
      parts.push(at(cyl(0.7, 1, 6, 5, 0x7a5233), x, 6, z), at(lumpy(ball(5, 1, 0x4fae3f), 0.14, k), x, 12, z));
    }
    return merge(parts);
  },
  /** One side of the canyon slot: jagged crystal cliff along x, ~180m long, its road
   *  face about 8m out on +z. Yaw it by pi for the other side. */
  canyonwall: () => {
    const r = rand(12);
    const parts: Geo[] = [];
    for (let k = 0; k < 16; k++) {
      const h = 40 + r() * 70;
      const c = [0x3a2f78, 0x5a3fa8, 0x2a2466, CYAN][k % 7 === 3 ? 3 : k % 3]!;
      parts.push(at(cone(13 + r() * 6, h, 4, c), -84 + k * 11, h / 2 - 24, 8 + r() * 8, 0, r() * 2, (r() - 0.5) * 0.15));
      parts.push(at(cone(7 + r() * 4, h * 0.9, 4, c), -84 + k * 11 + 4, -h * 0.45 - 16, 12 + r() * 6, Math.PI, r() * 2, 0));
    }
    return merge(parts);
  },
  spacestation: () => {
    const parts = [...hoop(46, 28, 5, [0xe8ecff, 0xb8c0e0]), at(cyl(9, 9, 34, 10, 0xe8ecff), 0, 0, 0, Math.PI / 2)];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      parts.push(at(box(2, 2, 46, CYAN), 0, Math.sin(a) * 23, Math.cos(a) * 23, -a));
      parts.push(at(box(0.5, 14, 30, 0x2f5cff), 30 + k * 6, 0, 0));
    }
    return merge(parts);
  },
});

registerTheme({
  id: "cosmos",
  sky: [0x06031e, 0x1f0f5c, 0x6a22a8],
  fog: 0x4a1a86,
  fogNear: 320,
  fogFar: 2200,
  sun: { color: 0xfff0dc, intensity: 3.1, dir: [0.5, 0.62, -0.42] },
  hemi: { sky: 0xa8c0ff, ground: 0xff66cc, intensity: 1.7 },
  ground: "void",
  groundColors: [0x7a5cff, 0x4a3ab0, 0x2a2070],
  verge: 0x7a5cff,
  road: { base: 0x3a3470, speck: 0x4a4488, line: 0xfff27a, kerbA: PINK, kerbB: CYAN },
  barrier: { a: CYAN, b: PINK, height: 1.1 },
  hills: { amp: 0, rim: 0, seed: 1 },
  stars: true,
  props: [],
});
