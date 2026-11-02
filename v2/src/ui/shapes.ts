// Track outlines for maps. buildCourse is slow-ish and the cup screen wants every
// track, so outlines are built one at a time in idle moments and cached; a race's
// own course seeds the cache for free. A Shape is the ribbon decimated and fitted
// into a 100x100 box, and `fit` puts world positions into that same box.
import { signal } from "@preact/signals";
import { buildCourse, type Course, type TrackDef } from "../sim/course";

export interface Shape {
  d: string; // svg path
  pts: number[]; // x,y pairs in the 100 box
  fit: (x: number, z: number) => [number, number];
  start: [number, number, number]; // x, y, heading in the box
  length: number;
}

const POINTS = 150;
const PAD = 6;
const cache = new Map<string, Shape>();
const queue: TrackDef[] = [];
/** Bumped when a queued outline lands, so maps waiting on it re-render. */
const built = signal(0);

export function shapeOf(c: Course): Shape {
  const hit = cache.get(c.def.id);
  if (hit) return hit;
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < c.n; i++) {
    x0 = Math.min(x0, c.x[i]!);
    x1 = Math.max(x1, c.x[i]!);
    z0 = Math.min(z0, c.z[i]!);
    z1 = Math.max(z1, c.z[i]!);
  }
  const k = (100 - PAD * 2) / Math.max(x1 - x0, z1 - z0);
  const [ox, oz] = [50 - ((x0 + x1) / 2) * k, 50 - ((z0 + z1) / 2) * k];
  const fit = (x: number, z: number): [number, number] => [ox + x * k, oz + z * k];
  const step = Math.max(1, Math.floor(c.n / POINTS));
  const pts: number[] = [];
  for (let i = 0; i < c.n; i += step) pts.push(...fit(c.x[i]!, c.z[i]!));
  const round = (v: number) => Math.round(v * 10) / 10;
  const d = `M${pts.map(round).join(" ").replace(/(\S+ \S+) /g, "$1L")}Z`;
  const [sx, sy] = fit(c.x[0]!, c.z[0]!);
  const shape = { d, pts, fit, start: [sx, sy, c.h[0]!] as [number, number, number], length: c.length };
  cache.set(c.def.id, shape);
  return shape;
}

function pump() {
  const def = queue.shift();
  if (!def) return;
  if (!cache.has(def.id)) {
    shapeOf(buildCourse(def));
    built.value++;
  }
  if (queue.length) later(pump);
}

const later = (fn: () => void) => {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 200 });
  else setTimeout(fn, 30);
};

/** The outline if it's ready, and queues it if not. Reading this subscribes. */
export function useShape(def: TrackDef): Shape | null {
  void built.value;
  const hit = cache.get(def.id);
  if (hit) return hit;
  if (!queue.includes(def)) {
    queue.push(def);
    if (queue.length === 1) later(pump);
  }
  return null;
}
