// The track is a closed Catmull-Rom loop sampled into segments. A coarse
// spatial grid answers "how far is (x,y) from the road centerline" quickly,
// which drives surface lookup, lap progress, and world painting.

export interface TrackPoint {
  x: number;
  y: number;
}

/** How a track opens up: place top-3 (podium) or take 1st (win) somewhere. */
export interface UnlockRule {
  track: string; // trackId the result must come from
  result: "podium" | "win";
}

export interface TrackDef {
  id: string;
  name: string;
  points: TrackPoint[]; // Catmull-Rom control points, closed loop
  roadWidth: number;
  worldWidth: number;
  worldHeight: number;
  unlock?: UnlockRule; // absent = open from the start
}

export interface Track {
  id: string;
  name: string;
  samples: TrackPoint[]; // dense polyline around the loop
  progress: number[]; // arc-length fraction 0..1 at each sample
  roadWidth: number;
  worldWidth: number;
  worldHeight: number;
  start: TrackPoint;
  startHeading: number;
}

const SAMPLES_PER_SEGMENT = 24;
const GRID_CELL = 64;

export function createTrack(def: TrackDef): Track {
  const pts = def.points;
  const samples: TrackPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % pts.length]!;
    const p3 = pts[(i + 2) % pts.length]!;
    for (let j = 0; j < SAMPLES_PER_SEGMENT; j++) {
      const u = j / SAMPLES_PER_SEGMENT;
      samples.push(catmullRom(p0, p1, p2, p3, u));
    }
  }

  const progress: number[] = new Array(samples.length);
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    progress[i] = total;
    const a = samples[i]!;
    const b = samples[(i + 1) % samples.length]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  for (let i = 0; i < progress.length; i++) progress[i]! /= total;

  const start = samples[0]!;
  const next = samples[1]!;
  return {
    id: def.id,
    name: def.name,
    samples,
    progress,
    roadWidth: def.roadWidth,
    worldWidth: def.worldWidth,
    worldHeight: def.worldHeight,
    start,
    startHeading: Math.atan2(next.y - start.y, next.x - start.x),
  };
}

function catmullRom(p0: TrackPoint, p1: TrackPoint, p2: TrackPoint, p3: TrackPoint, t: number): TrackPoint {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * (b - c) + d - a) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

export interface TrackQuery {
  distanceToRoad(x: number, y: number): number;
  surfaceAt(x: number, y: number): "road" | "offroad";
  /** Arc-length fraction 0..1 of the nearest centerline point, or null when far off track. */
  progressAt(x: number, y: number): number | null;
  /** Closest centerline point and its distance, or null when far off track. */
  nearestOnRoad(x: number, y: number): { x: number; y: number; dist: number } | null;
}

export function createTrackQuery(track: Track): TrackQuery {
  const grid = new Map<string, number[]>();
  const n = track.samples.length;
  const reach = track.roadWidth * 3;
  for (let i = 0; i < n; i++) {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % n]!;
    const minX = Math.min(a.x, b.x) - reach;
    const maxX = Math.max(a.x, b.x) + reach;
    const minY = Math.min(a.y, b.y) - reach;
    const maxY = Math.max(a.y, b.y) + reach;
    for (let cx = Math.floor(minX / GRID_CELL); cx <= Math.floor(maxX / GRID_CELL); cx++) {
      for (let cy = Math.floor(minY / GRID_CELL); cy <= Math.floor(maxY / GRID_CELL); cy++) {
        const key = `${cx},${cy}`;
        let list = grid.get(key);
        if (!list) grid.set(key, (list = []));
        list.push(i);
      }
    }
  }

  function nearest(x: number, y: number): { dist: number; index: number; t: number } | null {
    const segs = grid.get(`${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`);
    if (!segs) return null;
    let best: { dist: number; index: number; t: number } | null = null;
    for (const i of segs) {
      const a = track.samples[i]!;
      const b = track.samples[(i + 1) % n]!;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2));
      const dist = Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t));
      if (!best || dist < best.dist) best = { dist, index: i, t };
    }
    return best;
  }

  return {
    distanceToRoad(x, y) {
      const hit = nearest(x, y);
      return hit ? hit.dist : Infinity;
    },
    surfaceAt(x, y) {
      const hit = nearest(x, y);
      return hit && hit.dist <= track.roadWidth / 2 ? "road" : "offroad";
    },
    progressAt(x, y) {
      const hit = nearest(x, y);
      if (!hit || hit.dist > reach) return null;
      const p0 = track.progress[hit.index]!;
      const p1 = hit.index + 1 < n ? track.progress[hit.index + 1]! : 1;
      return (p0 + (p1 - p0) * hit.t) % 1;
    },
    nearestOnRoad(x, y) {
      const hit = nearest(x, y);
      if (!hit) return null;
      const a = track.samples[hit.index]!;
      const b = track.samples[(hit.index + 1) % n]!;
      return {
        x: a.x + (b.x - a.x) * hit.t,
        y: a.y + (b.y - a.y) * hit.t,
        dist: hit.dist,
      };
    },
  };
}

/**
 * Keep a car inside the fenced corridor around the road: past `corridor` px
 * from the centerline it's placed back on the fence line and the outward
 * velocity component is bounced. This is what makes lap boundaries physical —
 * you can run wide onto the grass, but not cut across the middle of the map.
 */
// Minimum inward exit speed off the fence. Turn authority scales with speed,
// so a car nosing into the fence at a crawl could otherwise pin itself there,
// unable to build speed or rotate away — the springy kick self-rescues it.
// Tuned up from 40: a head-on nose-in was still burying itself and grinding in
// place, so give it a firmer shove back onto the grass with room to rotate out.
const FENCE_KICK = 65;

export function fenceCar(
  car: { x: number; y: number; vx: number; vy: number },
  query: TrackQuery,
  corridor: number,
  restitution = 0.3
): void {
  const hit = query.nearestOnRoad(car.x, car.y);
  if (!hit || hit.dist <= corridor) return;
  const nx = (car.x - hit.x) / hit.dist;
  const ny = (car.y - hit.y) / hit.dist;
  car.x = hit.x + nx * corridor;
  car.y = hit.y + ny * corridor;
  const outward = car.vx * nx + car.vy * ny;
  if (outward > 0) {
    car.vx -= outward * (1 + restitution) * nx;
    car.vy -= outward * (1 + restitution) * ny;
  }
  const inward = -(car.vx * nx + car.vy * ny);
  if (inward < FENCE_KICK) {
    car.vx -= (FENCE_KICK - inward) * nx;
    car.vy -= (FENCE_KICK - inward) * ny;
  }
}

// Lap detection: accumulate signed progress deltas; a full +1.0 of net travel
// is a lap. Driving backwards digs a hole you must climb back out of, so
// wiggling across the start line can't farm laps.
export interface LapTracker {
  lap: number;
  accum: number;
  lastProgress: number;
}

export function createLapTracker(startProgress: number): LapTracker {
  return { lap: 1, accum: 0, lastProgress: startProgress };
}

export function updateLap(state: LapTracker, progress: number): { completed: boolean } {
  let delta = progress - state.lastProgress;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  state.lastProgress = progress;
  state.accum += delta;
  if (state.accum >= 1) {
    state.accum -= 1;
    state.lap += 1;
    return { completed: true };
  }
  return { completed: false };
}
