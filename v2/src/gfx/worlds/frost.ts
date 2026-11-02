// Frost Cup: blue hour in the Alps. The sun has just gone behind the ridge, the snow
// is lilac, and every window in the ski village is lit. Windows are saturated yellow
// rather than emissive: props share one Lambert material.
import { at, ball, box, cone, cyl, lumpy, merge, rand, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const SNOW = 0xf4f8ff;
const TIMBER = 0x6e4630;
const LIT = 0xffd84a;
const STEEL = 0x56607a;

function pineParts(x: number, z: number, s: number): Geo[] {
  return [
    at(cyl(0.22 * s, 0.32 * s, 1.5 * s, 6, 0x5a4034), x, 0.75 * s, z),
    at(cone(2.4 * s, 3.2 * s, 7, 0x1f5f5c), x, 2.8 * s, z),
    at(cone(1.5 * s, 1.5 * s, 7, SNOW), x, 3.72 * s, z),
    at(cone(1.85 * s, 2.8 * s, 7, 0x256b66), x, 4.4 * s, z),
    at(cone(1.1 * s, 1.3 * s, 7, SNOW), x, 5.2 * s, z),
    at(cone(1.25 * s, 2.5 * s, 7, 0x2c7870), x, 6.1 * s, z),
    at(cone(0.75 * s, 1.5 * s, 7, SNOW), x, 6.75 * s, z),
  ];
}

function windows(w: number, y: number, z: number, n: number): Geo[] {
  const parts: Geo[] = [];
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * w;
    parts.push(at(box(1, 1.1, 0.1, LIT), x, y, z), at(box(1, 1.1, 0.1, LIT), x, y, -z));
  }
  return parts;
}

/** A pitched roof along x: two slabs, snow on top. */
function roof(w: number, d: number, y: number, rise: number, snow = SNOW): Geo[] {
  const tilt = Math.atan2(rise, d / 2);
  const slope = Math.hypot(rise, d / 2) + 0.5;
  return [
    at(box(w + 0.8, 0.45, slope, snow), 0, y + rise / 2, d / 4, tilt),
    at(box(w + 0.8, 0.45, slope, snow), 0, y + rise / 2, -d / 4, -tilt),
  ];
}

registerProps({
  snowPine: () => merge(pineParts(0, 0, 1)),
  snowClump: () => merge([...pineParts(-2.2, 0.8, 1.2), ...pineParts(2, -1, 0.95), ...pineParts(0.4, 2.6, 0.75)]),
  snowRock: () =>
    merge([
      at(lumpy(ball(1.6, 1, 0x7d84a0), 0.28, 6), 0, 0.7, 0, 0, 0.5, 0, [1.2, 0.8, 1]),
      at(lumpy(ball(1.3, 1, SNOW), 0.15, 2), 0.1, 1.5, 0, 0, 0, 0, [1.05, 0.35, 0.9]),
    ]),
  snowman: () =>
    merge([
      at(ball(1.1, 1, SNOW), 0, 0.9, 0),
      at(ball(0.8, 1, SNOW), 0, 2.2, 0),
      at(ball(0.55, 1, SNOW), 0, 3.2, 0),
      at(cone(0.13, 0.7, 5, 0xff7a1f), 0.72, 3.2, 0, 0, 0, -Math.PI / 2),
      at(cyl(0.42, 0.42, 0.6, 7, 0x20243a), 0, 3.9, 0),
      at(cyl(0.65, 0.65, 0.08, 7, 0x20243a), 0, 3.62, 0),
      at(box(0.26, 0.2, 1.3, 0xe8392f), 0, 2.72, 0),
    ]),
  chalet: () => {
    const wall = 0x9a6442;
    return merge([
      at(box(11, 2.6, 8, 0xc9cfe0), 0, 1.3, 0),
      at(box(11, 3, 8, wall), 0, 4.1, 0),
      ...windows(9, 4.2, 4.05, 3),
      ...windows(9, 1.5, 4.05, 2),
      ...roof(11, 8, 5.6, 3.6),
      at(box(1.2, 3.4, 1.2, 0x6c7286), 3, 8, 1.6),
    ]);
  },
  skiLodge: () => {
    const parts: Geo[] = [
      at(box(34, 3.4, 15, 0xb7bed2), 0, 1.7, 0),
      at(box(34, 7, 15, 0x8a5636), 0, 6.8, 0),
      ...windows(30, 2.2, 7.55, 9),
      ...windows(30, 5, 7.55, 9),
      ...windows(30, 8, 7.55, 7),
      ...roof(34, 15, 10.3, 6.5),
      at(box(2.4, 8, 2.4, 0x6c7286), -9, 14, 3),
      at(box(2.4, 8, 2.4, 0x6c7286), 11, 14, -2.5),
      at(box(16, 2.2, 0.3, 0xe8392f), 0, 9.3, 7.7),
      at(box(14, 1, 0.34, 0xffffff), 0, 9.3, 7.7),
    ];
    for (let i = 0; i < 5; i++) parts.push(at(box(4, 0.3, 11, TIMBER), -14 + i * 7, 3.7, 12));
    return merge(parts);
  },
  church: () =>
    merge([
      at(box(16, 7, 9, 0xe9ecf6), 0, 3.5, 0),
      ...windows(13, 3.8, 4.55, 4),
      ...roof(16, 9, 7, 4.5, 0xdfe8fb),
      at(box(5, 18, 5, 0xe9ecf6), -9, 9, 0),
      at(box(1.4, 2, 0.1, LIT), -9, 14, 2.55),
      at(cone(4, 11, 4, 0x3f5fae), -9, 23.5, 0, 0, Math.PI / 4),
      at(ball(0.5, 0, 0xffd21f), -9, 29.3, 0),
    ]),
  // the cable runs along z, so towers 90m apart read as one lift
  liftTower: () => {
    const parts: Geo[] = [
      at(box(1.3, 15, 1.3, STEEL), 0, 7.5, 0),
      at(box(8, 0.6, 1, 0xffb300), 0, 15, 0),
      at(box(0.14, 0.14, 90, 0x20243a), -3.4, 14.6, 0),
      at(box(0.14, 0.14, 90, 0x20243a), 3.4, 14.6, 0),
    ];
    for (const [x, z] of [[-3.4, -24], [3.4, -9], [-3.4, 16], [3.4, 31]] as const) {
      parts.push(
        at(box(0.1, 3.2, 0.1, 0x20243a), x, 13, z),
        at(box(1.8, 0.2, 0.7, 0xe8392f), x, 11.4, z),
        at(box(1.8, 0.9, 0.16, 0xe8392f), x, 11.9, z + 0.34)
      );
    }
    return merge(parts);
  },
  // inrun falling toward -x, tower at the +x end; yaw it to line up with the road
  skiRamp: () => {
    const parts: Geo[] = [];
    const curve = (u: number): [number, number] => [40 - u * 80, 6 + 48 * (1 - u) ** 1.7];
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = curve(i / steps);
      const [x1, y1] = curve((i + 1) / steps);
      const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.5;
      parts.push(at(box(len, 0.9, 11, i % 2 ? 0xffffff : 0xdce8ff), mx, my, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0) - Math.PI));
      if (i % 2 === 0) parts.push(at(box(1, my, 1, STEEL), mx, my / 2, -4.6), at(box(1, my, 1, STEEL), mx, my / 2, 4.6));
    }
    parts.push(
      at(box(10, 9, 13, 0x3f5fae), 45, 56, 0),
      at(box(10.6, 1.4, 13.6, LIT), 45, 57, 0),
      at(box(11.5, 1.2, 14.5, SNOW), 45, 61, 0),
      at(box(1.4, 52, 1.4, STEEL), 44, 26, -5),
      at(box(1.4, 52, 1.4, STEEL), 44, 26, 5)
    );
    return merge(parts);
  },
  peak: () =>
    merge([
      at(cone(170, 210, 7, 0x6f7cae), 0, 105, 0),
      at(cone(70, 88, 7, SNOW), 0, 166, 0, 0, 0.45),
      at(cone(120, 140, 6, 0x7f8cbc), 110, 70, 50),
      at(cone(48, 58, 6, SNOW), 110, 112, 50, 0, 0.3),
      at(cone(105, 110, 6, 0x6775a8), -120, 55, -30),
      at(cone(42, 44, 6, SNOW), -120, 88, -30, 0, 0.8),
    ]),
  shoulder: () =>
    merge([
      at(lumpy(ball(30, 1, 0x7a86b2), 0.14, 8), 0, 14, 0, 0, 0, 0, [1.3, 1, 1.6]),
      at(lumpy(ball(21, 1, SNOW), 0.1, 3), 2, 32, 0, 0, 0, 0, [1.3, 0.5, 1.5]),
    ]),
  iceSheet: () => merge([at(cyl(60, 60, 0.4, 28, 0x7cc4ee), 0, 0.2, 0)]),
  iceHut: () =>
    merge([
      at(box(3.2, 2.4, 3.2, 0xe8392f), 0, 1.2, 0),
      at(box(1, 1, 0.1, LIT), 0, 1.4, 1.65),
      ...roof(3.2, 3.2, 2.4, 1.1),
    ]),
  slalom: () => {
    const r = rand(4);
    const parts: Geo[] = [];
    for (let i = 0; i < 5; i++) {
      const c = i % 2 ? 0xe8392f : 0x2f6be0;
      const z = i * 5 - 10;
      const x = (r() - 0.5) * 2;
      parts.push(at(cyl(0.06, 0.06, 2.4, 5, 0xffffff), x, 1.2, z), at(box(0.06, 0.8, 1, c), x, 2, z + 0.5));
    }
    return merge(parts);
  },
  lamp: () =>
    merge([
      at(cyl(0.1, 0.14, 4.6, 6, 0x20243a), 0, 2.3, 0),
      at(box(0.75, 0.75, 0.75, LIT), 0, 4.8, 0),
      at(cone(0.65, 0.5, 4, 0x20243a), 0, 5.4, 0, 0, Math.PI / 4),
    ]),
});

registerTheme({
  id: "frost",
  sky: [0x1a2276, 0x5a5cd2, 0xffb7a6],
  fog: 0xb3aee8,
  fogNear: 130,
  fogFar: 640,
  sun: { color: 0xffc4a0, intensity: 1.9, dir: [0.62, 0.34, 0.5] },
  hemi: { sky: 0xb6c6ff, ground: 0xe6ecff, intensity: 2.2 },
  ground: "land",
  groundColors: [0xf0f4ff, 0xdde5fb, 0xb4bcea],
  verge: 0xfbfcff,
  road: { base: 0x4a5476, speck: 0x5c668c, line: 0xfff0c0, kerbA: 0x2f6be0, kerbB: 0xffffff },
  barrier: { a: 0xffffff, b: 0x2f6be0, height: 0.95 },
  hills: { amp: 34, rim: 150, seed: 41 },
  stars: true,
  clouds: { count: 7, color: 0xe7d8ff },
  props: [
    { kind: "snowPine", density: 44, near: 7, far: 170, scale: [0.9, 2] },
    { kind: "snowClump", density: 16, near: 12, far: 150, scale: [0.9, 1.5] },
    { kind: "snowRock", density: 8, near: 6, far: 110, scale: [0.6, 1.6] },
    { kind: "lamp", density: 5, near: 2.5, far: 6, scale: [1, 1] },
    { kind: "snowman", density: 1.2, near: 6, far: 26, scale: [0.9, 1.3] },
  ],
});
