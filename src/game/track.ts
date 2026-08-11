// The track is a closed Catmull-Rom loop sampled into segments. A coarse
// spatial grid answers "how far is (x,y) from the road centerline" quickly,
// which drives surface lookup, lap progress, and world painting.

export interface TrackPoint {
  x: number;
  y: number;
  /** Road width (px) at this control point; absent = the track's roadWidth.
   *  Interpolated smoothly between points, so a narrow point is a pinch the
   *  road funnels into and back out of — bridges, canyon squeezes, fans. */
  w?: number;
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
  /** There is no grass — the road is a ribbon over nothing. Nothing is fenced,
   *  and leaving the road at all drops you off the edge into a rescue. */
  voidRunoff?: boolean;
  /** A deliberate speed oval: the lap is *meant* to be one flat-out arc, so it
   *  is exempt from the steering-demand floor in tracks.test.ts. Two tracks in
   *  the catalog get this; on anything else a flat lap is a layout bug. */
  speedOval?: boolean;
}

export interface Track {
  id: string;
  name: string;
  samples: TrackPoint[]; // dense polyline around the loop
  progress: number[]; // arc-length fraction 0..1 at each sample
  fenced: boolean[]; // per sample: is this stretch physically walled in?
  halfWidths: number[]; // per sample: half the local road width
  roadWidth: number; // nominal width (grid spacing, minimap stroke, bot lanes)
  worldWidth: number;
  worldHeight: number;
  start: TrackPoint;
  startHeading: number;
  voidRunoff: boolean;
}

const SAMPLES_PER_SEGMENT = 24;
const GRID_CELL = 64;

export function createTrack(def: TrackDef): Track {
  const pts = def.points;
  const samples: TrackPoint[] = [];
  const halfWidths: number[] = [];
  const w = (p: TrackPoint) => p.w ?? def.roadWidth;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % pts.length]!;
    const p3 = pts[(i + 2) % pts.length]!;
    for (let j = 0; j < SAMPLES_PER_SEGMENT; j++) {
      const u = j / SAMPLES_PER_SEGMENT;
      samples.push(catmullRom(p0, p1, p2, p3, u));
      // width rides the same spline as position, so pinches ease in and out
      halfWidths.push(Math.max(24, catmullRom1(w(p0), w(p1), w(p2), w(p3), u) / 2));
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
    halfWidths,
    // A void track has nothing to fence *against* — you're either on the road
    // or falling — so its runoff is entirely the rescue's job.
    fenced: def.voidRunoff ? samples.map(() => false) : fencedSamples(samples, progress, total, def),
    roadWidth: def.roadWidth,
    worldWidth: def.worldWidth,
    worldHeight: def.worldHeight,
    start,
    startHeading: Math.atan2(next.y - start.y, next.x - start.x),
    voidRunoff: def.voidRunoff ?? false,
  };
}

/**
 * Which stretches of the loop actually need a fence.
 *
 * Fencing the whole lap is what made running wide feel like hitting a wall, so
 * a fence now only goes up where the runoff itself is the problem: where
 * another part of the loop is close enough that sliding off lands you on the
 * wrong road (head-on, or a chunk of lap further along), and where the world
 * edge is near enough that there's nowhere to run out to. Everywhere else the
 * grass is open — you can run way off, and the rescue in main.ts picks you up
 * and puts you back where you left, which costs time without trapping you.
 */
function fencedSamples(
  samples: TrackPoint[],
  progress: number[],
  lapLength: number,
  def: TrackDef
): boolean[] {
  const n = samples.length;
  const keepout = def.roadWidth * 3.2; // ribbons closer than this share their runoff
  const edge = def.roadWidth * 3; // no room to run off against the world wall
  // Two spots only count as separate ribbons once they're this far apart along
  // the road — otherwise every corner (where the road curves back near itself
  // within a few car lengths) would read as a pinch and fence the whole lap.
  const minArc = keepout * 3;
  const fenced = samples.map(
    (p) =>
      p.x < edge || p.y < edge || p.x > def.worldWidth - edge || p.y > def.worldHeight - edge
  );
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (fenced[i] && fenced[j]) continue;
      const arc = Math.abs(progress[j]! - progress[i]!);
      if (Math.min(arc, 1 - arc) * lapLength < minArc) continue; // same stretch of road
      const a = samples[i]!;
      const b = samples[j]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < keepout) {
        fenced[i] = true;
        fenced[j] = true;
      }
    }
  }
  return spread(fenced, Math.ceil(n / 60)); // pad each run so fences end past the pinch
}

/** Widen every true run in a cyclic boolean array by `w` samples each way. */
function spread(flags: boolean[], w: number): boolean[] {
  const n = flags.length;
  const out = flags.slice();
  for (let i = 0; i < n; i++) {
    if (!flags[i]) continue;
    for (let k = -w; k <= w; k++) out[(i + k + n) % n] = true;
  }
  return out;
}

function catmullRom(p0: TrackPoint, p1: TrackPoint, p2: TrackPoint, p3: TrackPoint, t: number): TrackPoint {
  return {
    x: catmullRom1(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom1(p0.y, p1.y, p2.y, p3.y, t),
  };
}

function catmullRom1(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * (b - c) + d - a) * t3);
}

export interface TrackQuery {
  distanceToRoad(x: number, y: number): number;
  /** How far past the local road edge (x,y) sits: <= 0 on the road, positive
   *  on the runoff, Infinity when nothing is anywhere near. The number every
   *  fence/rescue margin is measured against, since road width varies. */
  edgeDistance(x: number, y: number): number;
  surfaceAt(x: number, y: number): "road" | "offroad";
  /** Arc-length fraction 0..1 of the nearest centerline point, or null when far off track. */
  progressAt(x: number, y: number): number | null;
  /** Closest centerline point, its distance, the local half-width, and whether
   *  that stretch is fenced. Null only when nothing is anywhere near. */
  nearestOnRoad(
    x: number,
    y: number
  ): { x: number; y: number; dist: number; halfWidth: number; fenced: boolean } | null;
  /** Unit vector of the racing direction at the nearest centerline point
   *  (points the way progress increases), or null when far off track. */
  tangentAt(x: number, y: number): { x: number; y: number } | null;
}

export function createTrackQuery(track: Track): TrackQuery {
  const grid = new Map<string, number[]>();
  const n = track.samples.length;
  // How far off the road the grid still answers questions. Generous, because
  // an unfenced runoff has to stay measurable all the way out to the rescue
  // distance — past `reach` the car is simply "gone", which triggers a rescue
  // too, just without a distance to report.
  const reach = Math.max(...track.halfWidths) * 4 + 240;
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

  // local half-width at a nearest() hit, lerped along its segment
  function halfAt(hit: { index: number; t: number }): number {
    const h0 = track.halfWidths[hit.index]!;
    const h1 = track.halfWidths[(hit.index + 1) % n]!;
    return h0 + (h1 - h0) * hit.t;
  }

  return {
    distanceToRoad(x, y) {
      const hit = nearest(x, y);
      return hit ? hit.dist : Infinity;
    },
    edgeDistance(x, y) {
      const hit = nearest(x, y);
      return hit ? hit.dist - halfAt(hit) : Infinity;
    },
    surfaceAt(x, y) {
      const hit = nearest(x, y);
      return hit && hit.dist <= halfAt(hit) ? "road" : "offroad";
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
        halfWidth: halfAt(hit),
        fenced: track.fenced[hit.index]!,
      };
    },
    tangentAt(x, y) {
      const hit = nearest(x, y);
      if (!hit || hit.dist > reach) return null;
      const a = track.samples[hit.index]!;
      const b = track.samples[(hit.index + 1) % n]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    },
  };
}

/**
 * Keep a car inside the fenced corridor around the road: past `marginPx` from
 * the *local road edge* it's placed back on the fence line and the outward
 * velocity component is bounced. Margin-based because road width varies — the
 * fence hugs a pinch as tightly as a boulevard.
 *
 * Only the stretches flagged `fenced` (see fencedSamples) actually have a
 * fence — off an open stretch the car sails on into the grass and `rescueCar`
 * eventually collects it.
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
  marginPx: number,
  restitution = 0.3
): void {
  const hit = query.nearestOnRoad(car.x, car.y);
  if (!hit) return;
  const corridor = hit.halfWidth + marginPx;
  if (hit.dist <= corridor || !hit.fenced) return;
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

// --- out-of-bounds rescue ---
//
// The counterpart to dropping most of the fencing: run far enough off an open
// stretch and a marshal picks the car up and puts it back on the road. The
// anchor is where you *left* the road, not where you ended up, so a long
// excursion across the infield can never gain ground — it only costs the time
// spent out there plus the tow back.
//
// The tow is the penalty, not a pause on top of it: the car is dragged from
// where it went out to the anchor over rescueTowSeconds, engine off, and it's
// driveable again the instant it lands.

export interface SafeSpot {
  x: number;
  y: number;
  heading: number;
}

/** Positioned things a rescue can move (the player's car, or a bot's). */
type Placeable = { x: number; y: number; heading: number; vx: number; vy: number };

/** True once a car has strayed further than `marginPx` past the local road
 *  edge — including "off the map entirely", where edgeDistance is Infinity. */
export function outOfBounds(car: { x: number; y: number }, query: TrackQuery, marginPx: number): boolean {
  return query.edgeDistance(car.x, car.y) > marginPx;
}

/** Where a car at (x,y) would be put back down: its own spot snapped to the
 *  centerline, pointing down the road. Null when it's nowhere near the track. */
export function safeSpotAt(x: number, y: number, query: TrackQuery): SafeSpot | null {
  const hit = query.nearestOnRoad(x, y);
  const tan = query.tangentAt(x, y);
  if (!hit || !tan) return null;
  return { x: hit.x, y: hit.y, heading: Math.atan2(tan.y, tan.x) };
}

/** Plop a car down at `spot`, stopped and facing the right way. */
export function rescueCar(car: Placeable, spot: SafeSpot): void {
  car.x = spot.x;
  car.y = spot.y;
  car.heading = spot.heading;
  car.vx = 0;
  car.vy = 0;
}

/** A car under tow: where the cable picked it up, where it's being put down,
 *  and how far through the drag it is. */
export interface RescueTow {
  from: SafeSpot;
  to: SafeSpot;
  elapsed: number;
  duration: number;
}

/** Hook a stranded car up: it stops dead and the drag home begins. */
export function createTow(car: Placeable, spot: SafeSpot, seconds: number): RescueTow {
  car.vx = 0;
  car.vy = 0;
  return {
    from: { x: car.x, y: car.y, heading: car.heading },
    to: spot,
    elapsed: 0,
    duration: Math.max(0.001, seconds),
  };
}

/**
 * Advance the drag by `dt` and write the car's new pose. Returns true on the
 * step the tow finishes, with the car set down exactly on the anchor.
 *
 * Eased at both ends so the cable reads as taking up slack and then setting the
 * car down, rather than sliding it at a constant machine speed. The car stays
 * stopped throughout — the tow *is* the time penalty, so there's nothing to
 * gain by being dragged and nothing to steer while it happens.
 */
export function stepTow(tow: RescueTow, car: Placeable, dt: number): boolean {
  tow.elapsed += dt;
  const u = Math.min(1, tow.elapsed / tow.duration);
  const e = u * u * (3 - 2 * u); // smoothstep
  car.x = tow.from.x + (tow.to.x - tow.from.x) * e;
  car.y = tow.from.y + (tow.to.y - tow.from.y) * e;
  // Shortest way round, so a car that spun backwards doesn't unwind the long way.
  car.heading = normalizeAngle(tow.from.heading + normalizeAngle(tow.to.heading - tow.from.heading) * e);
  car.vx = 0;
  car.vy = 0;
  return u >= 1;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
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
