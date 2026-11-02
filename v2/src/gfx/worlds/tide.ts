// Tide Cup: turquoise lagoon, white sand, an endless holiday. Prop names are global
// (last registration wins), so generic ones carry a tide prefix. Landmarks stand on the
// seabed, 5-11m below the waterline and not a known depth, so anything meant to
// rise from open water is built tall from y=0 and must look right at either depth.
import { at, ball, box, cone, cyl, lumpy, merge, type Geo } from "../geo";
import { registerProps } from "../props";
import { registerTheme } from "../themes";

const TRUNK = 0x9a6a3c;
const LEAF = [0x2fb24d, 0x45cc5b, 0x1f9a4a];
const WOOD = 0xa9744a;
const DARK_WOOD = 0x7a5233;

/** Trunk leaning out from the base, then a crown of drooping fronds. */
function palmParts(x: number, y: number, z: number, h: number, lean: number): Geo[] {
  const parts: Geo[] = [];
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const u = i / steps;
    parts.push(at(cyl(0.2 - u * 0.06, 0.28 - u * 0.06, (h / steps) * 1.15, 6, TRUNK), x + lean * u * u, y + (h * (i + 0.5)) / steps, z, 0, 0, -lean * 0.09));
  }
  const [tx, ty] = [x + lean, y + h];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const c = LEAF[k % 3]!;
    parts.push(at(box(3.2, 0.09, 0.8, c), tx + Math.cos(a) * 1.5, ty - 0.35, z + Math.sin(a) * 1.5, 0, -a, -0.45));
    parts.push(at(box(1.5, 0.08, 0.5, c), tx + Math.cos(a) * 3, ty - 1.25, z + Math.sin(a) * 3, 0, -a, -0.95));
  }
  parts.push(at(ball(0.3, 0, 0x7a4a24), tx + 0.3, ty - 0.2, z + 0.2));
  return parts;
}

function pilings(w: number, d: number, h: number, nx = 3, nz = 3): Geo[] {
  const parts: Geo[] = [];
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    parts.push(at(cyl(0.22, 0.3, h, 6, DARK_WOOD), ((i / (nx - 1)) - 0.5) * w, h / 2, ((k / (nz - 1)) - 0.5) * d));
  }
  return parts;
}

registerProps({
  tidePalm: () => merge(palmParts(0, 0, 0, 7, 1.3)),
  palmPair: () => merge([...palmParts(-1, 0, 0, 8, -1.5), ...palmParts(1, 0, 0.6, 6, 1.1)]),
  // tall enough to break the surface from any seabed depth
  palmIslet: () =>
    merge([
      at(cone(26, 15, 11, 0xf3dc9a), 0, 7.5, 0),
      at(cyl(10, 15, 1.4, 11, 0xf8e8b4), 0, 12.6, 0),
      at(lumpy(ball(5, 1, 0x3fb757), 0.2, 3), 2, 13.8, -2, 0, 0, 0, [1.4, 0.5, 1.2]),
      ...palmParts(-4, 13, 2, 9, -1.8),
      ...palmParts(1, 13, -3, 11, 1.4),
      ...palmParts(5, 13, 3, 8, 2),
    ]),
  seaStack: () =>
    merge([
      at(lumpy(ball(13, 1, 0x8d7e72), 0.22, 4), 0, 16, 0, 0, 0, 0, [1, 2, 1]),
      at(lumpy(ball(8, 1, 0xa19184), 0.2, 7), 7, 30, 3, 0, 0, 0, [1, 1.3, 1]),
      at(lumpy(ball(9, 1, 0x45b95a), 0.18, 9), 1, 41, 0, 0, 0, 0, [1.1, 0.4, 1.1]),
    ]),
  tideLighthouse: () => {
    const parts: Geo[] = [at(lumpy(ball(7, 1, 0xb3aca2), 0.18, 5), 0, 0.5, 0, 0, 0, 0, [1, 0.4, 1]), at(cyl(5.4, 6, 2, 10, 0xffffff), 0, 3.4, 0)];
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const u = i / bands;
      parts.push(at(cyl(4.6 - (u + 1 / bands) * 1.8, 4.6 - u * 1.8, 5, 10, i % 2 ? 0xffffff : 0xe8392f), 0, 7.5 + i * 5, 0));
    }
    parts.push(
      at(cyl(3.9, 3.2, 0.7, 10, 0x2a3140), 0, 35.3, 0),
      at(cyl(2, 2, 3.2, 10, 0xfff3a8), 0, 37.3, 0),
      at(cone(2.7, 2.6, 10, 0xe8392f), 0, 40.2, 0),
      at(ball(0.5, 0, 0xffd21f), 0, 41.8, 0),
      at(box(4, 3, 3.4, 0xffffff), 3, 6, 3.5),
      at(cone(3.2, 1.8, 4, 0xe8392f), 3, 8.4, 3.5, 0, Math.PI / 4)
    );
    return merge(parts);
  },
  stiltHut: () => {
    const wall = 0xfff0d6;
    return merge([
      ...pilings(7, 6, 15),
      at(box(9, 0.4, 8, WOOD), 0, 15, 0),
      at(box(6.5, 3, 5.5, wall), 0, 16.7, 0),
      at(box(1.3, 2, 0.1, 0x1a9aa8), 0, 16.3, 2.8),
      at(cone(5.6, 3, 4, 0xd9a24a), 0, 19.6, 0, 0, Math.PI / 4),
    ]);
  },
  pavilion: () => {
    const parts = pilings(20, 20, 16, 5, 5);
    parts.push(at(box(25, 0.5, 25, WOOD), 0, 16, 0));
    for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as const) parts.push(at(box(0.7, 7, 0.7, 0xffffff), x, 19.8, z));
    parts.push(
      at(box(19, 0.7, 19, 0xffffff), 0, 23.6, 0),
      at(cone(11, 6, 8, 0xff6b4a), 0, 27, 0),
      at(cyl(0.5, 0.7, 2, 8, 0xffffff), 0, 31, 0),
      at(cone(1.1, 2, 4, 0xffd21f), 0, 33, 0)
    );
    return merge(parts);
  },
  beachHut: () => {
    const c = 0xff6b6b;
    return merge([
      at(box(4, 3, 3.4, 0xffffff), 0, 1.5, 0),
      at(box(1.3, 3, 3.5, c), -1.3, 1.5, 0),
      at(box(1.3, 3, 3.5, c), 1.3, 1.5, 0),
      at(cone(3.4, 1.6, 4, c), 0, 3.8, 0, 0, Math.PI / 4),
    ]);
  },
  umbrella: () =>
    merge([
      at(cyl(0.06, 0.06, 2.6, 5, 0xffffff), 0, 1.3, 0),
      at(cone(1.7, 0.8, 8, 0xff6b4a), 0, 2.8, 0),
      at(box(1.7, 0.1, 0.7, 0xffffff), 1.3, 0.14, 0.6),
    ]),
  ferrisWheel: () => {
    const parts: Geo[] = [];
    const [R0, cy] = [15, 18];
    const colors = [0xff6b6b, 0xffd166, 0x35c4d6, 0x7bd389, 0xff8cc6];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const [cx, sy] = [Math.cos(a), Math.sin(a)];
      parts.push(at(box(0.3, R0, 0.3, 0xffffff), cx * R0 * 0.5, cy + sy * R0 * 0.5, 0, 0, 0, a - Math.PI / 2));
      parts.push(at(box(0.5, R0 * 0.56, 0.5, 0xffffff), cx * R0 * 0.97, cy + sy * R0 * 0.97, 0, 0, 0, a));
      parts.push(at(box(2, 1.7, 1.9, colors[k % 5]!), cx * R0, cy + sy * R0 - 1.3, 0));
    }
    parts.push(
      at(box(1, 21, 1, 0xd8dde4), -4.5, 9.5, 2, 0, 0, -0.23),
      at(box(1, 21, 1, 0xd8dde4), 4.5, 9.5, 2, 0, 0, 0.23),
      at(box(1, 21, 1, 0xd8dde4), -4.5, 9.5, -2, 0, 0, -0.23),
      at(box(1, 21, 1, 0xd8dde4), 4.5, 9.5, -2, 0, 0, 0.23),
      at(box(0.8, 0.8, 5, 0xffd21f), 0, cy, 0)
    );
    return merge(parts);
  },
  bridgeOut: () =>
    merge([
      at(box(0.3, 3.4, 0.3, 0x3a3f4a), 0, 1.7, -2.2),
      at(box(0.3, 3.4, 0.3, 0x3a3f4a), 0, 1.7, 2.2),
      at(box(0.3, 2.6, 6.6, 0xff6b1f), 0, 4.2, 0),
      at(box(0.34, 0.6, 3.4, 0xffffff), 0, 4.2, 0),
      at(box(0.34, 2, 0.6, 0xffffff), 0, 4.2, 1.5),
      at(cone(1, 1, 3, 0xffffff), 0, 5, 1.5),
    ]),
});

registerTheme({
  id: "tide",
  sky: [0x0a62dc, 0x35c0f7, 0xd0f7ff],
  fog: 0xbdf0ff,
  fogNear: 180,
  fogFar: 820,
  sun: { color: 0xfff4d6, intensity: 3.1, dir: [0.4, 0.8, 0.42] },
  hemi: { sky: 0xb4ecff, ground: 0xf0d48a, intensity: 1.5 },
  ground: "water",
  groundColors: [0xfbe9ad, 0xf0d387, 0x2f9c7a],
  verge: 0xfff0bd,
  road: { base: 0x565f70, speck: 0x6a7384, line: 0xffffff, kerbA: 0xff5f45, kerbB: 0xffffff },
  barrier: { a: 0xffffff, b: 0x12a8b8, height: 0.95 },
  hills: { amp: 18, rim: 80, seed: 23 },
  water: 0x12c6d6,
  clouds: { count: 14, color: 0xffffff },
  props: [
    { kind: "tidePalm", density: 30, near: 5, far: 70, scale: [0.9, 1.6] },
    { kind: "palmPair", density: 12, near: 8, far: 80, scale: [1, 1.5] },
    { kind: "umbrella", density: 22, near: 4, far: 30, scale: [0.9, 1.2] },
    { kind: "beachHut", density: 5, near: 7, far: 34, scale: [0.9, 1.2] },
    { kind: "rock", density: 3, near: 8, far: 70, scale: [0.5, 1.3] },
  ],
});
