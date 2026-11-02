// Low-poly modelling kit: colored primitives that merge into one vertex-colored
// geometry, so a whole prop is one draw call with no textures. All art in the
// game is built from these.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Geo = THREE.BufferGeometry;

export function tint(g: Geo, color: number): Geo {
  const out = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color);
  const count = out.getAttribute("position").count;
  const a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  out.setAttribute("color", new THREE.BufferAttribute(a, 3));
  out.deleteAttribute("uv");
  out.deleteAttribute("normal"); // merge() recomputes: facets, not smooth shading
  return out;
}

export const at = (g: Geo, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s)
  );
  return g.applyMatrix4(m);
};

export const box = (w: number, h: number, d: number, color: number) => tint(new THREE.BoxGeometry(w, h, d), color);
export const cyl = (rt: number, rb: number, h: number, seg: number, color: number) =>
  tint(new THREE.CylinderGeometry(rt, rb, h, seg), color);
export const cone = (r: number, h: number, seg: number, color: number) => tint(new THREE.ConeGeometry(r, h, seg), color);
export const ball = (r: number, detail: number, color: number) => tint(new THREE.IcosahedronGeometry(r, detail), color);

export const merge = (parts: Geo[]): Geo => {
  const g = mergeGeometries(parts, false)!;
  g.computeVertexNormals();
  return g;
};

/** Knock an icosphere out of round so foliage and rocks aren't perfect spheres. */
export function lumpy(g: Geo, amount: number, seed: number): Geo {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const n = 1 + amount * Math.sin(x * 7.3 + seed) * Math.cos(y * 5.1 + seed * 2) * Math.sin(z * 6.7 + seed * 3);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  return g;
}

/**
 * Loft rings along +x: each station gives a rounded cross-section. The car hulls
 * are built this way, because boxes never look like bodywork.
 */
export interface Station {
  x: number;
  halfW: number;
  bottom: number;
  top: number;
  round?: number; // 0 = boxy, 1 = fully tapered shoulders
}

export function loft(stations: Station[], color: number): Geo {
  const ring = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const point = (s: Station, k: number): [number, number, number] => {
    const round = s.round ?? 0.45;
    const a = (k / ring) * Math.PI * 2;
    const [cx, cy] = [Math.cos(a), Math.sin(a)];
    const e = 2 / (1 + round * 2.2); // superellipse: low round = boxier
    const px = Math.sign(cx) * Math.abs(cx) ** e;
    const py = Math.sign(cy) * Math.abs(cy) ** e;
    const mid = (s.top + s.bottom) / 2;
    return [s.x, mid + (py * (s.top - s.bottom)) / 2, px * s.halfW];
  };
  stations.forEach((s, si) => {
    for (let k = 0; k < ring; k++) pos.push(...point(s, k));
    if (si === stations.length - 1) return;
    for (let k = 0; k < ring; k++) {
      const a = si * ring + k;
      const b = si * ring + ((k + 1) % ring);
      const c = a + ring;
      const d = b + ring;
      idx.push(a, b, c, b, d, c);
    }
  });
  // end caps
  const last = (stations.length - 1) * ring;
  for (let k = 1; k < ring - 1; k++) {
    idx.push(0, k + 1, k);
    idx.push(last, last + k, last + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return tint(g, color);
}

export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Value-noise fbm, for terrain. Deterministic per seed. */
export function noise2(seed: number) {
  const perm = new Float32Array(1024);
  const r = rand(seed);
  for (let i = 0; i < 1024; i++) perm[i] = r();
  const lat = (x: number, y: number) => perm[((x * 57 + y * 131) & 1023 + 1024) & 1023]!;
  const n = (x: number, y: number) => {
    const [xi, yi] = [Math.floor(x), Math.floor(y)];
    const [u, v] = [x - xi, y - yi];
    const [su, sv] = [u * u * (3 - 2 * u), v * v * (3 - 2 * v)];
    const a = lat(xi, yi) + (lat(xi + 1, yi) - lat(xi, yi)) * su;
    const b = lat(xi, yi + 1) + (lat(xi + 1, yi + 1) - lat(xi, yi + 1)) * su;
    return a + (b - a) * sv;
  };
  return (x: number, y: number, oct = 3) => {
    let [sum, amp, f, tot] = [0, 1, 1, 0];
    for (let o = 0; o < oct; o++) {
      sum += n(x * f, y * f) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / tot;
  };
}
