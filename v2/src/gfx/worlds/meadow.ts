// Green Cup's world: sunny English-summer countryside, a patchwork of farms under
// balloons. Owns the meadow theme and its props: farm buildings, the windmill, the
// castle, the stone viaduct and the small stuff that makes a field a field.
import { at, ball, box, cone, cyl, lumpy, merge, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const STONE = 0xd9cdb4;
const STONE_DARK = 0xb7a98f;
const BARN = 0xd2382c;
const TRIM = 0xfff6e6;
const SLATE = 0x3f6fb8;

/** Triangular prism along x with its ridge up: every pitched roof in this world. */
const roof = (r: number, len: number, color: number) => at(cyl(r, r, len, 3, color), 0, 0, 0, -Math.PI / 2, 0, Math.PI / 2);

/** A battlemented run of wall along x. */
function rampart(len: number, h: number, parts: Geo[], x: number, z: number, ry: number) {
  parts.push(at(box(len, h, 3, STONE), x, h / 2, z, 0, ry, 0));
  const n = Math.floor(len / 3);
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) * (len / n) - len / 2;
    parts.push(at(box(1.5, 1.3, 3.4, STONE_DARK), x + Math.cos(ry) * u, h + 0.6, z - Math.sin(ry) * u, 0, ry, 0));
  }
}

function turret(r: number, h: number, parts: Geo[], x: number, z: number, top = SLATE) {
  parts.push(at(cyl(r, r * 1.08, h, 10, STONE), x, h / 2, z));
  parts.push(at(cyl(r * 1.2, r, 1.4, 10, STONE_DARK), x, h + 0.6, z));
  parts.push(at(cone(r * 1.35, r * 2.6, 10, top), x, h + 1.3 + r * 1.3, z));
  parts.push(at(box(0.15, 2.4, 0.15, 0x6a4a30), x, h + r * 2.6 + 2.4, z));
  parts.push(at(box(1.8, 1, 0.1, 0xffd21f), x + 0.95, h + r * 2.6 + 3, z));
}

registerProps({
  oak: () =>
    merge([
      at(cyl(0.7, 1, 4, 7, 0x74502f), 0, 2, 0),
      at(lumpy(ball(1, 1, 0x47a63c), 0.16, 3), 0, 7, 0, 0, 0, 0, [5.2, 3.8, 5.2]),
      at(lumpy(ball(1, 1, 0x5fc14a), 0.16, 7), 2.2, 8.4, 1, 0, 0, 0, [3.2, 2.5, 3.2]),
      at(lumpy(ball(1, 1, 0x3a9338), 0.16, 11), -2.5, 7, -1.2, 0, 0, 0, [3, 2.4, 3]),
    ]),
  hedge: () =>
    merge([
      at(lumpy(box(1, 1, 1, 0x3f9a3a), 0.1, 4), 0, 0.8, 0, 0, 0, 0, [14, 1.8, 1.8]),
      at(lumpy(box(1, 1, 1, 0x57b544), 0.1, 8), 2, 1.4, 0, 0, 0, 0, [8, 1.3, 1.5]),
    ]),
  crop: () => {
    // sunk deep, because it's flat and the hills aren't
    const parts: Geo[] = [at(box(26, 3, 20, 0x9c7a3e), 0, -1.2, 0)];
    for (let k = 0; k < 6; k++) parts.push(at(box(25, 3.4, 1.9, k % 2 ? 0xf2cf4a : 0xe8b93a), 0, -1.1, -8 + k * 3.2));
    return merge(parts);
  },
  haybale: () =>
    merge([
      at(cyl(1, 1, 1.5, 9, 0xe9c35a), 0, 1, 0, Math.PI / 2),
      at(cyl(0.72, 0.72, 1.54, 9, 0xd7a93f), 0, 1, 0, Math.PI / 2),
    ]),
  sheep: () =>
    merge([
      at(lumpy(ball(0.62, 1, 0xfbf7ec), 0.2, 5), 0, 0.72, 0, 0, 0, 0, [1.35, 1, 1]),
      at(ball(0.27, 0, 0x2b2b30), 0.85, 0.9, 0),
      at(box(0.12, 0.42, 0.12, 0x2b2b30), 0.4, 0.2, 0.26),
      at(box(0.12, 0.42, 0.12, 0x2b2b30), 0.4, 0.2, -0.26),
      at(box(0.12, 0.42, 0.12, 0x2b2b30), -0.4, 0.2, 0.26),
      at(box(0.12, 0.42, 0.12, 0x2b2b30), -0.4, 0.2, -0.26),
    ]),
  fence: () => {
    const parts: Geo[] = [at(box(16, 0.2, 0.12, TRIM), 0, 1, 0), at(box(16, 0.2, 0.12, TRIM), 0, 0.55, 0)];
    for (let k = -2; k <= 2; k++) parts.push(at(box(0.25, 1.4, 0.25, TRIM), k * 3.9, 0.7, 0));
    return merge(parts);
  },
  cottage: () =>
    merge([
      at(box(9, 4, 6, 0xfff4dc), 0, 2, 0),
      at(roof(4.1, 9.8, 0xc25a33), 0, 5.8, 0, 0, 0, 0, [1, 1, 1]),
      at(box(1.4, 3, 1.4, 0x9c5a3c), 2.4, 7, 1),
      at(box(1.3, 2.4, 0.1, 0x3f6fb8), 0, 1.2, 3.02),
      at(box(1.2, 1.2, 0.1, 0x7fd0ee), -2.8, 2.4, 3.02),
      at(box(1.2, 1.2, 0.1, 0x7fd0ee), 2.8, 2.4, 3.02),
    ]),
  barn: () => {
    const parts: Geo[] = [
      at(box(24, 11, 14, BARN), 0, 5.5, 0),
      at(at(roof(8.6, 24, 0x8a8f9c), 0, 0, 0, 0, 0, 0, [1, 0.55, 1]), 0, 13.4, 0),
      at(at(roof(8, 24.3, BARN), 0, 0, 0, 0, 0, 0, [1, 0.55, 1]), 0, 13.1, 0),
      // gable: the barn's face to the road, door, cross-brace, hayloft
      at(box(0.2, 7, 7, TRIM), 12.05, 3.5, 0),
      at(box(0.3, 6.4, 6.4, 0xa82a22), 12.08, 3.5, 0),
      at(box(0.4, 0.5, 9, TRIM), 12.12, 3.5, 0, Math.PI / 4),
      at(box(0.4, 0.5, 9, TRIM), 12.12, 3.5, 0, -Math.PI / 4),
      at(box(0.3, 2.4, 2.8, 0x2b2b30), 12.1, 9.2, 0),
      // silo
      at(cyl(3.4, 3.4, 18, 12, 0xe7e2d6), -3, 9, 11),
      at(cyl(3.5, 3.5, 1, 12, BARN), -3, 12, 11),
      at(cyl(3.5, 3.5, 1, 12, BARN), -3, 6, 11),
      at(ball(3.5, 1, SLATE), -3, 18, 11),
    ];
    return merge(parts);
  },
  windmill: () => {
    const parts: Geo[] = [
      at(cyl(5.6, 7, 3, 10, STONE_DARK), 0, 1.5, 0),
      at(cyl(3.2, 5.2, 16, 10, TRIM), 0, 11, 0),
      at(cyl(5.8, 5.8, 0.5, 10, 0x7a5233), 0, 6.5, 0),
      at(ball(3.7, 1, BARN), 0, 20, 0, 0, 0, 0, [1.1, 0.85, 1]),
      at(cyl(0.45, 0.45, 3, 7, 0x4a3a2c), 4, 20, 0, 0, 0, Math.PI / 2),
      at(box(0.12, 2.6, 1.6, 0x3f6fb8), 4.65, 3.4, 0),
    ];
    for (let k = 0; k < 4; k++) {
      const a = 0.55 + (k * Math.PI) / 2;
      const blade = [
        at(box(0.3, 14, 0.3, 0x7a5233), 0, 7, 0),
        at(box(0.14, 12.4, 2.7, TRIM), 0, 8, 1.3),
        ...[0, 1, 2].map((b) => at(box(0.2, 0.25, 2.9, BARN), 0, 4.2 + b * 4, 1.3)),
      ];
      parts.push(...blade.map((g) => at(g, 5.4, 20, 0, a)));
    }
    return merge(parts);
  },
  // Stands on the inside of the Castle Hill hairpin, so it has to fit a 15m circle.
  keep: () => {
    const parts: Geo[] = [
      at(cyl(9, 11, 2, 12, STONE_DARK), 0, 1, 0),
      at(cyl(6.4, 7.2, 22, 12, STONE), 0, 12, 0),
      at(cyl(7.6, 6.4, 2, 12, STONE_DARK), 0, 23.6, 0),
    ];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      parts.push(at(box(1.5, 1.6, 1, STONE), Math.cos(a) * 7.2, 25.2, Math.sin(a) * 7.2, 0, -a + Math.PI / 2));
    }
    parts.push(at(cyl(2.8, 3, 6, 8, STONE), 2, 27, 0));
    parts.push(at(cone(3.8, 6, 8, SLATE), 2, 33, 0));
    parts.push(at(box(0.25, 8, 0.25, 0x5a5f6b), -3, 29.5, 0));
    parts.push(at(box(5, 3, 0.12, BARN), -0.4, 31.8, 0));
    for (let k = 0; k < 4; k++) parts.push(at(box(1, 2, 0.3, 0x2b3350), Math.cos(k * 1.57 + 0.8) * 6.7, 12 + k * 3, Math.sin(k * 1.57 + 0.8) * 6.7, 0, -(k * 1.57 + 0.8)));
    return merge(parts);
  },
  // Curtain wall with a gatehouse facing -x: seen head-on the whole climb up the hill.
  castle: () => {
    const parts: Geo[] = [
      // it needs its own hill: terrain falls away this far from the road
      at(lumpy(cyl(1, 1.28, 1, 12, 0x6dbb45), 0.07, 5), 0, 7, 0, 0, 0.4, 0, [52, 14, 52]),
    ];
    rampart(62, 11, parts, 0, -34, 0);
    rampart(62, 11, parts, 0, 34, 0);
    rampart(68, 11, parts, 31, 0, Math.PI / 2);
    rampart(26, 11, parts, -31, -21, Math.PI / 2);
    rampart(26, 11, parts, -31, 21, Math.PI / 2);
    for (const [x, z] of [[-31, -34], [-31, 34], [31, -34], [31, 34]] as const) turret(6, 17, parts, x, z);
    turret(4.5, 15, parts, -31, -9, BARN);
    turret(4.5, 15, parts, -31, 9, BARN);
    parts.push(at(box(3, 11, 15, STONE_DARK), -31, 11, 0));
    parts.push(at(box(1, 7, 7, 0x2b3350), -32.6, 3.5, 0));
    parts.push(at(box(0.6, 12, 4, BARN), -32.8, 11, -6.2));
    parts.push(at(box(0.6, 12, 4, BARN), -32.8, 11, 6.2));
    parts.push(at(box(26, 20, 26, STONE), 8, 10, 0));
    turret(5, 24, parts, 8, 0, BARN);
    return merge(parts.map((g, k) => (k ? at(g, 0, 12, 0) : g)));
  },
  // One bay faces the road's side; repeat along the bridge to dress the deck.
  viaduct: () => {
    const parts: Geo[] = [];
    const [h, bay] = [10.4, 18];
    parts.push(at(box(bay * 3 + 3, 2.2, 1.6, STONE), 0, h - 1.1, 0));
    parts.push(at(box(bay * 3 + 3.6, 0.5, 2, STONE_DARK), 0, h - 2.2, 0));
    for (let k = 0; k < 4; k++) parts.push(at(box(3, h - 2, 1.8, k % 2 ? STONE : STONE_DARK), (k - 1.5) * bay, (h - 2) / 2, 0));
    for (let k = 0; k < 3; k++) {
      // an arch is just stepped voussoirs in this kit; at this speed it reads as round
      for (let a = 0; a < 7; a++) {
        const t = ((a + 0.5) / 7) * Math.PI;
        parts.push(at(box(2.2, 2.2, 1.7, a % 2 ? STONE : STONE_DARK), (k - 1) * bay + Math.cos(t) * 7.6, h - 3.7 - (1 - Math.sin(t)) * 1.9 - 0.8, 0, 0, 0, Math.PI / 2 - t));
      }
    }
    return merge(parts);
  },
  // Geometry sits high off its origin, so scatter and landmarks float it for free.
  balloon: () => {
    const y = 46;
    const bands = [0xff5a5f, 0xffd166, 0x4cc9f0, 0xffffff, 0xff5a5f, 0xffd166];
    const radii = [3, 6.5, 8.6, 9.2, 8, 4.8];
    const parts: Geo[] = [];
    radii.forEach((r, k) => {
      const rb = k === 0 ? 1.6 : radii[k - 1]!;
      parts.push(at(cyl(r, rb, 3.2, 12, bands[k]!), 0, y + k * 3.2, 0));
    });
    parts.push(at(cyl(1, 4.8, 2, 12, bands[0]!), 0, y + 18.2, 0));
    parts.push(at(box(2, 1.5, 2, 0x8a5a33), 0, y - 5.5, 0));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) parts.push(at(box(0.08, 4.2, 0.08, 0x4a3a2c), x, y - 3, z));
    return merge(parts);
  },
  sunbanner: () =>
    merge([
      at(box(0.6, 7, 0.6, TRIM), 0, 3.5, -14),
      at(box(0.6, 7, 0.6, TRIM), 0, 3.5, 14),
      at(box(0.3, 2.2, 28, 0xffd21f), 0, 7.2, 0),
      at(box(0.34, 0.5, 28, BARN), 0, 6.3, 0),
      at(box(0.34, 0.5, 28, BARN), 0, 8.1, 0),
    ]),
});

registerTheme({
  id: "meadow",
  sky: [0x1668e6, 0x4fb2f7, 0xd2f1fc],
  fog: 0xc8ecf9,
  fogNear: 170,
  fogFar: 720,
  sun: { color: 0xfff0c8, intensity: 3, dir: [0.55, 0.72, 0.38] },
  hemi: { sky: 0xc4e9ff, ground: 0x84b84e, intensity: 1.35 },
  ground: "land",
  groundColors: [0x98da4e, 0x71c447, 0x4aa24e],
  verge: 0xaee35a,
  road: { base: 0x4a4e58, speck: 0x5c606b, line: 0xffffff, kerbA: 0xe8392f, kerbB: 0xffffff },
  barrier: { a: 0xffffff, b: 0xe8392f, height: 0.95 },
  hills: { amp: 24, rim: 62, seed: 11 },
  clouds: { count: 18, color: 0xffffff },
  props: [
    { kind: "crop", density: 2.2, near: 22, far: 170, scale: [0.8, 1.3] },
    { kind: "hedge", density: 4, near: 8, far: 120, scale: [0.9, 1.5] },
    { kind: "oak", density: 3.5, near: 14, far: 160, scale: [0.9, 1.5] },
    { kind: "tree", density: 13, near: 12, far: 130, scale: [0.9, 1.7] },
    { kind: "pine", density: 7, near: 26, far: 190, scale: [1, 1.9] },
    { kind: "bush", density: 24, near: 7, far: 60, scale: [0.7, 1.3] },
    { kind: "flowers", density: 44, near: 3, far: 42, scale: [0.8, 1.4] },
    { kind: "haybale", density: 5, near: 6, far: 80, scale: [0.9, 1.3] },
    { kind: "sheep", density: 9, near: 6, far: 70, scale: [1, 1.3] },
    { kind: "fence", density: 3, near: 5, far: 50, scale: [1, 1] },
    { kind: "cottage", density: 0.9, near: 24, far: 150, scale: [0.9, 1.3] },
    { kind: "balloon", density: 0.35, near: 40, far: 180, scale: [0.9, 1.5] },
  ],
});
