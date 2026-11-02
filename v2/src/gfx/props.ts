// The prop library: name -> merged low-poly geometry, y=0 at the ground, built
// lazily. Scatter rules (themes.ts) and landmarks (track defs) refer to these by
// name. Add a prop by adding a key.
import { at, ball, box, cone, cyl, lumpy, merge, type Geo } from "./geo";

const BUILDERS: Record<string, () => Geo> = {
  tree: () =>
    merge([
      at(cyl(0.28, 0.4, 2.4, 6, 0x7a5233), 0, 1.2, 0),
      at(lumpy(ball(2.1, 1, 0x4fae3f), 0.14, 2), 0, 3.9, 0),
      at(lumpy(ball(1.5, 1, 0x63c44c), 0.14, 5), 0.8, 5, 0.4),
      at(lumpy(ball(1.3, 1, 0x3f9a3a), 0.14, 9), -0.9, 4.7, -0.6),
    ]),
  pine: () =>
    merge([
      at(cyl(0.22, 0.32, 1.6, 6, 0x6a4a30), 0, 0.8, 0),
      at(cone(2.3, 3.2, 7, 0x2f8a54), 0, 2.9, 0),
      at(cone(1.8, 2.8, 7, 0x35995c), 0, 4.6, 0),
      at(cone(1.2, 2.4, 7, 0x3fa968), 0, 6.2, 0),
    ]),
  bush: () =>
    merge([
      at(lumpy(ball(1, 1, 0x57b544), 0.2, 3), 0, 0.7, 0),
      at(lumpy(ball(0.7, 0, 0x6ac751), 0.2, 4), 0.8, 0.5, 0.3),
    ]),
  flowers: () => {
    const parts: Geo[] = [];
    const colors = [0xffd23f, 0xff6b9d, 0xffffff, 0xff8c42];
    for (let i = 0; i < 7; i++) {
      const [x, z] = [Math.sin(i * 2.4) * (0.4 + i * 0.22), Math.cos(i * 2.4) * (0.4 + i * 0.22)];
      parts.push(at(box(0.06, 0.4, 0.06, 0x4c9a3a), x, 0.2, z));
      parts.push(at(ball(0.16, 0, colors[i % 4]!), x, 0.45, z));
    }
    return merge(parts);
  },
  rock: () => merge([at(lumpy(ball(1.5, 1, 0x9c9a94), 0.3, 6), 0, 0.7, 0, 0.3, 0.5, 0, [1.2, 0.8, 1])]),
  gantry: () => {
    const red = 0xe8392f;
    const white = 0xffffff;
    const parts: Geo[] = [
      at(box(0.9, 8.5, 0.9, white), 0, 4.25, -11),
      at(box(0.9, 8.5, 0.9, white), 0, 4.25, 11),
      at(box(1.4, 2.2, 23, red), 0, 8.1, 0),
      at(box(1.5, 0.45, 23.1, white), 0, 7.3, 0),
    ];
    for (let k = -3; k <= 3; k++) parts.push(at(box(0.2, 0.7, 1.8, 0x14161c), -0.72, 8.3, k * 3));
    return merge(parts);
  },
  grandstand: () => {
    const parts: Geo[] = [];
    const rows = 6;
    const crowd = [0xff5a5f, 0xffd166, 0x4cc9f0, 0xffffff, 0x7bd389];
    for (let r = 0; r < rows; r++) {
      parts.push(at(box(40, 0.9, 2, 0xd9dde5), 0, 0.45 + r * 0.9, r * 2));
      for (let k = 0; k < 26; k++) {
        parts.push(at(box(0.8, 0.9, 0.7, crowd[(k * 7 + r * 3) % 5]!), -18.5 + k * 1.48 + (r % 2) * 0.5, 1.3 + r * 0.9, r * 2));
      }
    }
    parts.push(at(box(42, 0.4, 14, 0x1f6fe0), 0, 8.6, 6, 0.09));
    parts.push(at(box(0.5, 8.5, 0.5, 0xffffff), -20, 4.2, 12));
    parts.push(at(box(0.5, 8.5, 0.5, 0xffffff), 20, 4.2, 12));
    return merge(parts);
  },
  arrow: () =>
    merge([
      at(box(0.3, 3, 0.3, 0x3a3f4a), 0, 1.5, -1.6),
      at(box(0.3, 3, 0.3, 0x3a3f4a), 0, 1.5, 1.6),
      at(box(0.3, 2, 5, 0xffd21f), 0, 3.6, 0),
      at(box(0.32, 0.5, 2.2, 0x14161c), 0, 3.6, 0.7, Math.PI / 4),
      at(box(0.32, 0.5, 2.2, 0x14161c), 0, 3.6, -0.7, -Math.PI / 4),
    ]),
};

const cache = new Map<string, Geo>();

export function prop(kind: string): Geo {
  let g = cache.get(kind);
  if (!g) {
    const b = BUILDERS[kind];
    if (!b) throw new Error(`no prop named ${kind}`);
    g = b();
    cache.set(kind, g);
  }
  return g;
}

export function registerProps(more: Record<string, () => Geo>) {
  Object.assign(BUILDERS, more);
}
