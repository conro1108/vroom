// Dusk Cup: a neon coastal city with the sun going down behind it. The ground is a
// thin strip of town either side of the road with the bay beyond, so the far skyline
// is a landmark (`skyring`) standing in the water rather than scatter.
import { at, ball, box, cone, cyl, merge, rand, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const NIGHT = 0x2a2150;
const VIOLET = 0x3d2c78;
const PINK = 0xff3fa8;
const CYAN = 0x3af0ff;
const GOLD = 0xffd24f;
const NEONS = [PINK, CYAN, GOLD, 0xff7a3c, 0xb46bff];

/** A block with floors of lit windows: each band is one box, so a whole street is cheap. */
function building(w: number, h: number, d: number, body: number, lit: number, x = 0, z = 0, base = 0): Geo[] {
  const parts = [at(box(w, h, d, body), x, base + h / 2, z)];
  const floors = Math.min(9, Math.floor(h / 6));
  for (let k = 1; k <= floors; k++) {
    parts.push(at(box(w + 0.12, 1.2, d + 0.12, k % 3 === 0 ? 0xfff0c8 : lit), x, base + (k * h) / (floors + 1), z));
  }
  return parts;
}

/** Hoop of boxes in the plane facing along x, centre at the origin. */
function hoop(r: number, n: number, thick: number, colors: number[]): Geo[] {
  const parts: Geo[] = [];
  const len = ((Math.PI * 2 * r) / n) * 1.06;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    parts.push(at(box(thick, thick, len, colors[k % colors.length]!), 0, Math.sin(a) * r, Math.cos(a) * r, Math.PI / 2 - a));
  }
  return parts;
}

registerProps({
  dusktower: () => {
    const parts = [...building(12, 34, 12, NIGHT, CYAN), ...building(8, 14, 8, VIOLET, PINK, 0, 0, 34)];
    parts.push(at(cyl(0.2, 0.4, 9, 5, 0xffffff), 0, 52, 0), at(ball(0.8, 0, 0xff3030), 0, 56.8, 0));
    return merge(parts);
  },
  duskslab: () =>
    merge([
      ...building(18, 24, 9, VIOLET, GOLD),
      at(box(1, 12, 9.4, PINK), 9.2, 16, 0),
      at(box(16, 1, 1, CYAN), 0, 25, 4.2),
    ]),
  duskshop: () =>
    merge([
      ...building(13, 8, 9, 0x4a3a8a, GOLD),
      at(box(13.4, 1.6, 0.5, PINK), 0, 3.4, 4.8),
      at(box(6, 2.4, 0.4, CYAN), -2, 9.4, 3),
      at(box(3, 3, 3, 0x2a2150), 3.5, 9.5, -1),
    ]),
  streetlamp: () =>
    merge([
      at(cyl(0.1, 0.16, 8, 5, 0x24204a), 0, 4, 0),
      at(box(2.6, 0.14, 0.14, 0x24204a), 1.2, 8, 0),
      at(box(1.3, 0.22, 0.5, 0xfff4b0), 2.1, 7.86, 0),
      at(box(0.4, 1.8, 0.1, PINK), 0, 5.2, 0.14),
    ]),
  palm: () => {
    const parts: Geo[] = [];
    for (let k = 0; k < 5; k++) parts.push(at(cyl(0.2, 0.28, 1.5, 5, 0x5b2a5e), k * k * 0.05, 0.75 + k * 1.45, 0, 0, 0, -k * 0.06));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      parts.push(at(box(4, 0.1, 0.9, k % 2 ? 0x1fae7e : 0x18c79a), 0.8 + Math.cos(a) * 1.8, 7.6, Math.sin(a) * 1.8, 0, -a, -0.45));
    }
    return merge(parts);
  },
  billboard: () => {
    const parts = [at(box(0.8, 12, 0.8, NIGHT), 0, 6, -9), at(box(0.8, 12, 0.8, NIGHT), 0, 6, 9), at(box(0.7, 10, 26, 0x1a1040), 0, 14, 0)];
    const bars = [PINK, 0xff7a3c, GOLD, CYAN];
    bars.forEach((c, k) => parts.push(at(box(0.9, 1.5, 21 - k * 3.5, c), -0.1, 10.8 + k * 2.1, -k * 1.2)));
    parts.push(at(box(1, 0.5, 27, CYAN), -0.1, 19.2, 0), at(box(1, 0.5, 27, PINK), -0.1, 8.8, 0));
    return merge(parts);
  },
  /** Spans the road: local z is across it, so tracks place it at side 0. */
  neonarch: () => {
    const parts = [...hoop(11, 20, 0.8, [PINK, PINK, CYAN, CYAN]).map((g) => at(g, 0, 1.5, 0))];
    parts.push(at(box(0.9, 3, 0.9, NIGHT), 0, 1.5, -11), at(box(0.9, 3, 0.9, NIGHT), 0, 1.5, 11));
    return merge(parts);
  },
  metrosign: () =>
    merge([
      at(box(1.2, 11, 1.2, NIGHT), 0, 5.5, -9.5),
      at(box(1.2, 11, 1.2, NIGHT), 0, 5.5, 9.5),
      at(box(2, 3.4, 21, 0x1a1040), 0, 11.2, 0),
      at(box(2.2, 0.5, 21.4, GOLD), 0, 12.9, 0),
      at(box(2.2, 2.2, 1, CYAN), 0, 11.2, -3),
      at(box(2.2, 2.2, 1, CYAN), 0, 11.2, 3),
      at(box(2.2, 0.7, 3.4, CYAN), 0, 11.6, -1.5, 0.7),
      at(box(2.2, 0.7, 3.4, CYAN), 0, 11.6, 1.5, -0.7),
    ]),
  lighthouse: () => {
    const parts: Geo[] = [at(cyl(12, 15, 4, 10, 0x4a3a8a), 0, 2, 0)];
    for (let k = 0; k < 6; k++) parts.push(at(cyl(5.4 - k * 0.45, 5.8 - k * 0.45, 8, 10, k % 2 ? 0xfff4ea : 0xff3f58), 0, 8 + k * 8, 0));
    parts.push(
      at(cyl(3.6, 3.6, 5, 10, 0xfff4b0), 0, 54, 0),
      at(cone(4.6, 4, 10, 0xff3f58), 0, 58.5, 0),
      at(box(40, 0.8, 1.6, 0xfff4b0), 20, 54, 0)
    );
    return merge(parts);
  },
  ferris: () => {
    const parts: Geo[] = [...hoop(34, 28, 1, [PINK, CYAN]), ...hoop(26, 22, 0.5, [GOLD])];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      parts.push(at(box(0.5, 0.5, 34, 0xfff0e0), 0, Math.sin(a) * 17, Math.cos(a) * 17, -a));
      parts.push(at(box(3.4, 3, 3, NEONS[k % NEONS.length]!), 0, Math.sin(a) * 34 - 2, Math.cos(a) * 34));
    }
    const lifted = parts.map((g) => at(g, 0, 40, 0));
    lifted.push(at(box(1.4, 44, 1.4, NIGHT), 0, 19, -14, 0.34), at(box(1.4, 44, 1.4, NIGHT), 0, 19, 14, -0.34));
    return merge(lifted);
  },
  harbourcrane: () => {
    const c = 0xff7a3c;
    return merge([
      at(box(1.6, 34, 1.6, c), -9, 17, -7),
      at(box(1.6, 34, 1.6, c), 9, 17, -7),
      at(box(1.6, 34, 1.6, c), -9, 17, 7),
      at(box(1.6, 34, 1.6, c), 9, 17, 7),
      at(box(22, 2, 16, NIGHT), 0, 28, 0),
      at(box(2.4, 2.4, 66, c), 0, 36, 8),
      at(box(5, 5, 7, 0xfff0c8), 0, 32, 26),
      at(box(1, 13, 1, GOLD), 0, 43, -7),
    ]);
  },
  /** The far shore of the bay: a city wrapped round the whole lap, open towards the
   *  sunset. One mesh, placed once per track near the middle of the layout, where the
   *  road heads +x so that the opening stays facing the sun. */
  skyring: () => {
    const r = rand(77);
    const parts: Geo[] = [];
    const count = 84;
    for (let k = 0; k < count; k++) {
      const a = 3.1 + (k / count) * 5.2;
      const rad = 640 + r() * 70;
      const swell = Math.sin(k * 0.37) * Math.sin(k * 0.11);
      const h = 60 + r() * 60 + Math.max(0, swell) * 190;
      const [x, z] = [Math.cos(a) * rad, Math.sin(a) * rad];
      parts.push(...building(16 + r() * 16, h, 20, k % 2 ? NIGHT : VIOLET, NEONS[k % NEONS.length]!, x, z, -30));
      if (h > 190) parts.push(at(cyl(0.4, 2, 50, 5, CYAN), x, h - 6, z));
    }
    return merge(parts);
  },
});

registerTheme({
  id: "dusk",
  sky: [0x1b1058, 0xc0307e, 0xffa24a],
  fog: 0xe0607a,
  fogNear: 180,
  fogFar: 1150,
  sun: { color: 0xffb46e, intensity: 2.5, dir: [-0.72, 0.3, 0.46] },
  hemi: { sky: 0xffa0d8, ground: 0x4a30a0, intensity: 2.1 },
  ground: "water",
  water: 0x8a2f9a,
  groundColors: [0x4c4378, 0x3a3268, 0x2c2654],
  verge: 0x665a9a,
  road: { base: 0x423c70, speck: 0x524a84, line: CYAN, kerbA: PINK, kerbB: 0xfff0f8 },
  barrier: { a: 0xfff0f8, b: PINK, height: 1.3 },
  hills: { amp: 8, rim: 40, seed: 23 },
  clouds: { count: 10, color: 0xffa890 },
  props: [
    { kind: "dusktower", density: 16, near: 13, far: 42, scale: [0.8, 1.5] },
    { kind: "duskslab", density: 16, near: 10, far: 34, scale: [0.8, 1.3] },
    { kind: "duskshop", density: 20, near: 6, far: 22, scale: [0.9, 1.3] },
    { kind: "palm", density: 16, near: 3, far: 14, scale: [0.9, 1.4] },
    { kind: "streetlamp", density: 20, near: 1.2, far: 5, scale: [1, 1.2] },
  ],
});
