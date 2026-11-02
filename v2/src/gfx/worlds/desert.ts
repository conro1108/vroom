// Dune Cup's world: golden-hour rally country. Long shadows, red mesas, a railway
// nobody came back for. Owns the desert theme and its props: rock at every scale
// (scatter stones up to mesas you can see from anywhere), cacti, timber and rally kit.
import { at, ball, box, cone, cyl, lumpy, merge, rand, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const STRATA = [0xc44a24, 0xd9642c, 0xb23e22, 0xe58a3e, 0xc9542a, 0xf0b060];
const TIMBER = 0x7a5233;
const TIMBER_DARK = 0x5c3d27;
const RUST = 0xa8502a;

/** One rock drum. Lumped at unit scale so the facets stay big whatever the size. */
const drum = (rTop: number, rBase: number, h: number, y: number, color: number, seed: number, x = 0, z = 0) =>
  at(lumpy(cyl(rTop, rBase, 1, 9, color), 0.16, seed), x, y + h / 2, z, 0, seed, 0, [1, h, 1]);

/** A stack of banded drums, narrowing upward: the shape of every big rock here. */
function strata(r: number, h: number, tiers: number, seed: number, taper = 0.74): Geo[] {
  const parts: Geo[] = [];
  const dh = h / tiers;
  for (let k = 0; k < tiers; k++) {
    const u = k / tiers;
    const rb = r * (1 - (1 - taper) * u) + (k === 0 ? r * 0.28 : 0);
    const rt = r * (1 - (1 - taper) * (u + 1 / tiers));
    parts.push(drum(rt, rb, dh + 0.8, k * dh, STRATA[(k + seed) % STRATA.length]!, seed + k));
  }
  return parts;
}

function bent(parts: Geo[], x: number, h: number, w: number) {
  const post = (z: number, lean: number) => at(box(0.7, h + 2, 0.7, TIMBER), x, h / 2, z, lean);
  parts.push(post(-w, -0.1), post(w, 0.1), post(-w * 0.34, -0.03), post(w * 0.34, 0.03));
  for (let k = 0; k < Math.floor(h / 6); k++) {
    const y = 3 + k * 6;
    const reach = w * (1 + 0.2 * (1 - y / h));
    parts.push(at(box(0.45, 0.5, reach * 2 + 2, TIMBER_DARK), x, y, 0));
    parts.push(at(box(0.3, 0.35, reach * 2.2, TIMBER), x, y + 3, 0, k % 2 ? 0.45 : -0.45));
  }
}

registerProps({
  saguaro: () =>
    merge([
      at(cyl(0.62, 0.72, 7.5, 8, 0x3d9a55), 0, 3.75, 0),
      at(ball(0.62, 1, 0x4bb064), 0, 7.5, 0),
      at(cyl(0.38, 0.38, 2.2, 7, 0x3d9a55), 1.5, 3.4, 0, 0, 0, Math.PI / 2),
      at(cyl(0.38, 0.38, 2.6, 7, 0x4bb064), 2.5, 4.6, 0),
      at(ball(0.38, 0, 0x4bb064), 2.5, 5.9, 0),
      at(cyl(0.34, 0.34, 1.8, 7, 0x3d9a55), -1.3, 4.5, 0, 0, 0, Math.PI / 2),
      at(cyl(0.34, 0.34, 2, 7, 0x4bb064), -2.1, 5.4, 0),
      at(ball(0.34, 0, 0xff6b9d), -2.1, 6.5, 0),
    ]),
  barrel: () =>
    merge([
      at(lumpy(ball(0.9, 1, 0x3f9d6a), 0.12, 3), 0, 0.7, 0, 0, 0, 0, [1, 0.9, 1]),
      at(ball(0.2, 0, 0xffd21f), 0, 1.5, 0),
    ]),
  scrub: () =>
    merge([
      at(lumpy(ball(1, 0, 0xb5a24c), 0.25, 4), 0, 0.5, 0, 0, 0, 0, [1.2, 0.7, 1.2]),
      at(lumpy(ball(0.7, 0, 0x93a04a), 0.25, 9), 0.8, 0.4, 0.3),
    ]),
  redrock: () =>
    merge([
      at(lumpy(ball(1.6, 0, 0xc4542a), 0.3, 6), 0, 0.8, 0, 0.4, 0.5, 0, [1.3, 0.8, 1]),
      at(lumpy(ball(0.9, 0, 0xe0793a), 0.3, 2), 1.5, 0.45, 0.6),
    ]),
  slab: () => merge(strata(9, 7, 3, 2, 0.8)),
  butte: () => merge(strata(17, 44, 6, 1, 0.82)),
  mesa: () => {
    const parts = strata(46, 40, 5, 3, 0.86);
    // a second, lower shoulder so it never reads as a cake
    parts.push(...strata(22, 24, 3, 4, 0.8).map((g) => at(g, 44, 0, 18)));
    parts.push(...strata(14, 14, 2, 0, 0.8).map((g) => at(g, -40, 0, -26)));
    return merge(parts);
  },
  // The Sisters: tall, thin, each capped with the hard rock that made it survive.
  spire: () => {
    const parts = strata(7.5, 32, 5, 5, 0.62);
    parts.push(drum(5.6, 4, 3.6, 31.5, 0xf0b060, 8));
    parts.push(drum(3, 5.8, 1.8, 35, 0xc44a24, 2));
    return merge(parts);
  },
  // Long along x; the flat faces look down the slot. Rows of these make a canyon.
  slotwall: () => {
    const r = rand(7);
    const parts: Geo[] = [];
    for (let k = 0; k < 7; k++) {
      const x = -33 + k * 11;
      const h = 22 + r() * 10;
      let y = 0;
      let band = k;
      while (y < h) {
        const dh = 4 + r() * 3;
        const z = 1.5 + (y / h) * 4 + (k % 2) * 1.2;
        parts.push(at(lumpy(cyl(1, 1.08, 1, 7, STRATA[band++ % STRATA.length]!), 0.12, k + band), x, y + dh / 2, z, 0, r() * 3, 0, [8, dh + 0.6, 8]));
        y += dh;
      }
    }
    return merge(parts);
  },
  // Spans a 30m gap: the road runs under it, and from a long way off so does your eye.
  archrock: () => {
    const parts: Geo[] = [...strata(9, 18, 3, 1, 0.8).map((g) => at(g, 0, 0, -23)), ...strata(9, 18, 3, 2, 0.8).map((g) => at(g, 0, 0, 23))];
    for (let k = 0; k < 11; k++) {
      const t = ((k + 0.5) / 11) * Math.PI;
      const [z, y] = [-Math.cos(t) * 23, 16 + Math.sin(t) * 13];
      parts.push(at(lumpy(box(1, 1, 1, STRATA[k % STRATA.length]!), 0.1, k), 0, y, z, Math.PI / 2 - t, 0, 0, [11, 8 - Math.sin(t) * 2.5, 8]));
    }
    return merge(parts);
  },
  // One tower of the fallen railway. Its top is 24m up: scale it to the deck height.
  trestlebent: () => {
    const parts: Geo[] = [];
    bent(parts, 0, 24, 7);
    return merge(parts);
  },
  // What's left past the break: a stub of bent towers with no deck and a dangling rail.
  brokenbent: () => {
    const parts: Geo[] = [];
    bent(parts, 0, 16, 7);
    parts.push(at(box(0.3, 0.3, 15, RUST), -2.4, 14.6, 1.5, 0.32, 0.1));
    return merge(parts);
  },
  windpump: () => {
    const parts: Geo[] = [
      at(box(0.3, 13, 0.3, 0x8c8f96), 1.4, 6.5, 1.4, 0.11, 0, -0.11),
      at(box(0.3, 13, 0.3, 0x8c8f96), -1.4, 6.5, 1.4, 0.11, 0, 0.11),
      at(box(0.3, 13, 0.3, 0x8c8f96), 1.4, 6.5, -1.4, -0.11, 0, -0.11),
      at(box(0.3, 13, 0.3, 0x8c8f96), -1.4, 6.5, -1.4, -0.11, 0, 0.11),
      at(cyl(0.5, 0.5, 2, 7, RUST), 0, 13.2, 0, 0, 0, Math.PI / 2),
      at(box(0.1, 1.6, 3.6, 0xc9cdd4), -2.8, 13.2, 0),
    ];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      parts.push(at(box(0.12, 3.2, 0.8, k % 2 ? 0xffe9b8 : 0xd9642c), 1.2, 13.2 + Math.cos(a) * 2, Math.sin(a) * 2, -a));
    }
    return merge(parts);
  },
  watertower: () =>
    merge([
      at(cyl(5, 5, 6, 10, RUST), 0, 15, 0),
      at(cone(5.6, 2.6, 10, 0x8a3f22), 0, 19.3, 0),
      at(box(0.5, 12, 0.5, TIMBER), 3.4, 6, 3.4),
      at(box(0.5, 12, 0.5, TIMBER), -3.4, 6, 3.4),
      at(box(0.5, 12, 0.5, TIMBER), 3.4, 6, -3.4),
      at(box(0.5, 12, 0.5, TIMBER), -3.4, 6, -3.4),
      at(box(8, 0.3, 0.3, TIMBER_DARK), 0, 6, 3.4, 0, 0, 0.5),
      at(box(8, 0.3, 0.3, TIMBER_DARK), 0, 6, -3.4, 0, 0, -0.5),
    ]),
  shack: () =>
    merge([
      at(box(9, 3.6, 6, 0xd8a56a), 0, 1.8, 0),
      at(box(10, 0.4, 7.2, RUST), 0, 3.9, 0, 0.08),
      at(box(2, 2.6, 0.12, 0x3b2a22), -2, 1.3, 3.02),
      at(box(2.4, 1.2, 0.12, 0x6fd0e8), 2, 2, 3.02),
    ]),
  tyres: () => {
    const parts: Geo[] = [];
    for (let k = 0; k < 5; k++) parts.push(at(cyl(0.7, 0.7, 0.45, 9, k % 2 ? 0xffffff : 0xe8392f), k * 1.45, 0.23, 0));
    for (let k = 0; k < 4; k++) parts.push(at(cyl(0.7, 0.7, 0.45, 9, k % 2 ? 0xe8392f : 0xffffff), 0.7 + k * 1.45, 0.68, 0));
    return merge(parts);
  },
  // Rally stage banner across the road. Pillars sit outside a 34m span.
  stagebanner: () => {
    const parts: Geo[] = [
      at(box(0.8, 9, 0.8, 0x2b2b30), 0, 4.5, -17),
      at(box(0.8, 9, 0.8, 0x2b2b30), 0, 4.5, 17),
      at(box(0.4, 2.6, 34, 0xffd21f), 0, 8.6, 0),
    ];
    for (let k = 0; k < 16; k++) parts.push(at(box(0.44, 1.3, 1, k % 2 ? 0x14161c : 0xffd21f), 0, 9.25, -15 + k * 2));
    for (let k = 0; k < 16; k++) parts.push(at(box(0.44, 1.3, 1, k % 2 ? 0xffd21f : 0x14161c), 0, 7.95, -15 + k * 2));
    return merge(parts);
  },
  // Hazard board on the outside of a corner: rally boards, not the racetrack arrow.
  chevron: () => {
    const parts: Geo[] = [at(box(0.3, 3.2, 0.3, 0x2b2b30), 0, 1.6, -3.4), at(box(0.3, 3.2, 0.3, 0x2b2b30), 0, 1.6, 3.4), at(box(0.3, 2.4, 8.6, 0xffe9b8), 0, 3.6, 0)];
    for (let k = -2; k <= 2; k++) parts.push(at(box(0.34, 2.6, 0.7, 0xe8392f), 0, 3.6, k * 1.65, Math.PI / 5));
    return merge(parts);
  },
  // A frozen twister: stacked rings drifting off-axis, dusty side to the sun.
  dustdevil: () => {
    const parts: Geo[] = [];
    for (let k = 0; k < 13; k++) {
      const u = k / 12;
      const r = 1.6 + u * u * 15;
      parts.push(at(lumpy(cyl(r * 1.08, r * 0.9, 1, 9, k % 2 ? 0xe9ad62 : 0xd98a4a), 0.14, k), Math.sin(k * 0.8) * (2 + k * 0.45), k * 5 + 2.5, Math.cos(k * 0.6) * 2.5, 0, k * 0.7, 0, [1, 5.6, 1]));
    }
    return merge(parts);
  },
  skull: () =>
    merge([
      at(ball(0.8, 1, 0xf4ead4), 0, 0.8, 0),
      at(box(1.2, 0.5, 0.8, 0xf4ead4), 0.5, 0.45, 0),
      at(cone(0.16, 1.5, 5, 0xf4ead4), 0, 1.3, 1.1, Math.PI / 2 - 0.5),
      at(cone(0.16, 1.5, 5, 0xf4ead4), 0, 1.3, -1.1, -Math.PI / 2 + 0.5),
    ]),
});

registerTheme({
  id: "desert",
  sky: [0x3a5fc9, 0xf79b5a, 0xffe0a0],
  fog: 0xf7c58c,
  fogNear: 170,
  fogFar: 820,
  sun: { color: 0xffc98a, intensity: 3.4, dir: [-0.72, 0.36, 0.42] },
  hemi: { sky: 0xffd9b0, ground: 0xc05a2c, intensity: 1.15 },
  ground: "land",
  groundColors: [0xe9ad62, 0xdc8a42, 0xb9502a],
  verge: 0xf0c077,
  road: { base: 0x4c4048, speck: 0x62525a, line: 0xffe9b8, kerbA: 0xe8542a, kerbB: 0xfff2d8 },
  barrier: { a: 0xfff2d8, b: 0xd9502a, height: 0.9 },
  hills: { amp: 30, rim: 95, seed: 3 },
  clouds: { count: 9, color: 0xffc9a8 },
  props: [
    { kind: "butte", density: 0.22, near: 95, far: 280, scale: [0.8, 1.5] },
    { kind: "mesa", density: 0.07, near: 170, far: 330, scale: [0.9, 1.5] },
    { kind: "slab", density: 1.1, near: 22, far: 170, scale: [0.6, 1.5] },
    { kind: "saguaro", density: 9, near: 8, far: 150, scale: [0.8, 1.5] },
    { kind: "barrel", density: 16, near: 4, far: 60, scale: [0.7, 1.4] },
    { kind: "scrub", density: 32, near: 3, far: 110, scale: [0.7, 1.6] },
    { kind: "redrock", density: 12, near: 6, far: 160, scale: [0.6, 2.2] },
    { kind: "skull", density: 0.8, near: 4, far: 40, scale: [0.9, 1.2] },
  ],
});
