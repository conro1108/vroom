// A course is authored like a real circuit map: a list of straights and
// constant-radius corners (see S/L/R), not points on a spline. That's what makes
// corners read as corners. Eased spiral entries stop the curvature stepping, and
// closure is solved rather than hand-fiddled: corners must add up to exactly one
// full turn, then every straight's length is nudged (least-squares, weighted by
// length) so the loop lands on its own start.
//
// The result is a dense ribbon of samples. Everything downstream (physics, bots,
// rendering, minimap) reads the ribbon, and cars locate themselves by walking
// along it from their last position, so over/under crossings just work.

export type EdgeKind = "wall" | "void";
export type FeatureKind = "boost" | "kicker" | "rock";
export type Surface = "asphalt" | "dirt" | "ice" | "plank";

/** How much cornering grip each surface gives. */
export const SURFACE_GRIP: Record<Surface, number> = { asphalt: 1, plank: 1, dirt: 0.82, ice: 0.55 };

export interface Feature {
  kind: FeatureKind;
  at: number; // 0..1 along its piece
  d: number; // lateral, -1..1 of the local half-width (+ = right of travel)
}

export interface PieceOpts {
  y?: number; // height (m) at the end of this piece
  bank?: number; // degrees, leans into the corner
  w?: number; // road width (m) by the end of this piece
  runoff?: number; // room (m) between road edge and the boundary
  edge?: EdgeKind; // what the boundary is
  bridge?: boolean; // deck on pillars: terrain ignores it, road passes under
  tunnel?: boolean; // roofed section
  gap?: boolean; // no road here: clear it in the air or fall
  surface?: Surface;
  /** A planted median down this piece: the road forks around it. Widen the road
   *  first. Bots take the side `isle.bot` (default: the side the median isn't). */
  isle?: { d: number; half: number; bot?: -1 | 1 }; // d/half in metres
  items?: Feature[];
}

export type Piece = ({ k: "s"; len: number } | { k: "t"; deg: number; r: number }) & PieceOpts;

/** Straight. */
export const S = (len: number, o: PieceOpts = {}): Piece => ({ k: "s", len, ...o });
/** Right corner of `deg` degrees at centerline radius `r`. */
export const R = (deg: number, r: number, o: PieceOpts = {}): Piece => ({ k: "t", deg, r, ...o });
/** Left corner. */
export const L = (deg: number, r: number, o: PieceOpts = {}): Piece => ({ k: "t", deg: -deg, r, ...o });

export interface Landmark {
  kind: string; // gfx/props name
  at: number; // 0..1 of the lap
  side: number; // lateral metres from centerline (+ = right)
  scale?: number;
  yaw?: number; // radians, 0 = parallel to the road
}

export interface TrackDef {
  id: string;
  name: string;
  theme: string;
  blurb: string; // the track's one-line hook, shown on the intro card
  width: number;
  runoff: number;
  edge: EdgeKind;
  pieces: Piece[];
  landmarks?: Landmark[];
  laps?: number;
}

export interface Course {
  def: TrackDef;
  n: number;
  ds: number; // metres between samples
  length: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  h: Float32Array; // heading
  kappa: Float32Array; // signed curvature (+ = right)
  bank: Float32Array; // radians, + = right side lower
  half: Float32Array; // road half-width
  limL: Float32Array; // distance centerline -> left boundary
  limR: Float32Array;
  voidL: Uint8Array; // 1 = left boundary is a drop
  voidR: Uint8Array;
  gap: Uint8Array;
  bridge: Uint8Array;
  tunnel: Uint8Array;
  surface: Surface[];
  isleD: Float32Array; // median centre, lateral metres
  isleHalf: Float32Array; // median half-width, 0 = no median here
  features: { kind: FeatureKind; i: number; d: number }[];
  featureAt: Map<number, number[]>;
  line: Float32Array; // racing line, lateral offset
  vmax: Float32Array; // racing-line speed limit at scale 1
}

const FINE = 0.5; // integration step
const SPACING = 2; // target sample spacing

function turnLength(p: Extract<Piece, { k: "t" }>) {
  const arc = (Math.abs(p.deg) * Math.PI * p.r) / 180;
  return { arc, ease: Math.min(arc * 0.7, 8 + p.r * 0.3) };
}

interface Trace {
  xs: number[];
  zs: number[];
  hs: number[];
  ks: number[];
  piece: number[];
  u: number[];
  end: { x: number; z: number };
  heads: number[]; // heading through each straight
}

function trace(pieces: Piece[], lens: number[]): Trace {
  const t: Trace = { xs: [], zs: [], hs: [], ks: [], piece: [], u: [], end: { x: 0, z: 0 }, heads: [] };
  let x = 0;
  let z = 0;
  let h = 0;
  pieces.forEach((p, pi) => {
    if (p.k === "s") {
      const steps = Math.max(1, Math.round(lens[pi]! / FINE));
      const ds = lens[pi]! / steps;
      t.heads[pi] = h;
      for (let i = 0; i < steps; i++) {
        t.xs.push(x), t.zs.push(z), t.hs.push(h), t.ks.push(0), t.piece.push(pi), t.u.push(i / steps);
        x += Math.cos(h) * ds;
        z += Math.sin(h) * ds;
      }
    } else {
      const { arc, ease } = turnLength(p);
      const len = arc + ease;
      const steps = Math.max(2, Math.round(len / FINE));
      const ds = len / steps;
      const kmax = Math.sign(p.deg) / p.r;
      for (let i = 0; i < steps; i++) {
        const s = (i + 0.5) * ds;
        // trapezoid curvature: spiral in, hold, spiral out; area is exactly `arc/r`
        const ramp = Math.min(1, s / ease, (len - s) / ease);
        const k = kmax * ramp * ramp * (3 - 2 * ramp);
        t.xs.push(x), t.zs.push(z), t.hs.push(h), t.ks.push(k), t.piece.push(pi), t.u.push(i / steps);
        h += k * ds;
        x += Math.cos(h) * ds;
        z += Math.sin(h) * ds;
      }
    }
  });
  t.end = { x, z };
  return t;
}

function closeLoop(def: TrackDef): number[] {
  const pieces = def.pieces;
  const total = pieces.reduce((s, p) => s + (p.k === "t" ? p.deg : 0), 0);
  if (Math.abs(total) % 360 > 1e-6) {
    throw new Error(`${def.id}: corners total ${total}°, must be a whole number of turns (±360°, or 0° for a figure-eight)`);
  }
  const lens = pieces.map((p) => (p.k === "s" ? p.len : 0));
  for (let pass = 0; pass < 4; pass++) {
    const t = trace(pieces, lens);
    let [a, b, c] = [0, 0, 0];
    pieces.forEach((p, i) => {
      if (p.k !== "s") return;
      const [dx, dz, w] = [Math.cos(t.heads[i]!), Math.sin(t.heads[i]!), lens[i]!];
      a += w * dx * dx;
      b += w * dx * dz;
      c += w * dz * dz;
    });
    const det = a * c - b * b;
    const [gx, gz] = [t.end.x, t.end.z];
    const parallel = Math.abs(det) < 1e-3 * (a + c) ** 2;
    if (parallel && (a > c ? Math.abs(gz) : Math.abs(gx)) > 0.5) {
      throw new Error(`${def.id}: straights are all parallel and can't close a ${Math.hypot(gx, gz).toFixed(0)}m gap across them`);
    }
    const lx = parallel ? (a > c ? -gx / a : 0) : (-c * gx + b * gz) / det;
    const lz = parallel ? (a > c ? 0 : -gz / c) : (b * gx - a * gz) / det;
    pieces.forEach((p, i) => {
      if (p.k !== "s") return;
      lens[i]! += lens[i]! * (Math.cos(t.heads[i]!) * lx + Math.sin(t.heads[i]!) * lz);
    });
  }
  pieces.forEach((p, i) => {
    if (p.k === "s" && lens[i]! < 6) {
      throw new Error(`${def.id}: closing the loop squeezes piece ${i} to ${lens[i]!.toFixed(1)}m; rebalance the layout`);
    }
  });
  return lens;
}

const smooth = (u: number) => u * u * u * (u * (6 * u - 15) + 10);

function blur(a: Float32Array, radius: number, passes = 2) {
  const n = a.length;
  let src = a;
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(n);
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[(k + n) % n]!;
    for (let i = 0; i < n; i++) {
      dst[i] = sum / (2 * radius + 1);
      sum += src[(i + radius + 1) % n]! - src[(i - radius + n) % n]!;
    }
    src = dst;
  }
  a.set(src);
}

export function buildCourse(def: TrackDef, aLat = 19): Course {
  const lens = closeLoop(def);
  const t = trace(def.pieces, lens);
  const fineN = t.xs.length;
  const n = Math.round((fineN * FINE) / SPACING);
  const stride = fineN / n;
  const length = fineN * FINE;
  const ds = length / n;

  const arr = () => new Float32Array(n);
  const [x, y, z, h, kappa, bank, half, limL, limR] = [arr(), arr(), arr(), arr(), arr(), arr(), arr(), arr(), arr()];
  const voidL = new Uint8Array(n);
  const voidR = new Uint8Array(n);
  const gap = new Uint8Array(n);
  const bridge = new Uint8Array(n);
  const tunnel = new Uint8Array(n);
  const surface: Surface[] = new Array(n);
  const isleD = arr();
  const isleHalf = arr();
  const isleBot = new Int8Array(n);

  // keyed values held between pieces: height and width glide to each piece's target
  const yStart: number[] = [];
  const wStart: number[] = [];
  let [cy, cw] = [0, def.width];
  def.pieces.forEach((p, i) => {
    yStart[i] = cy;
    wStart[i] = cw;
    cy = p.y ?? cy;
    cw = p.w ?? cw;
  });
  if (Math.abs(cy) > 1e-6) throw new Error(`${def.id}: last piece must end at y=0, got ${cy}`);
  if (Math.abs(cw - def.width) > 1e-6) throw new Error(`${def.id}: last piece must end at the nominal width`);

  const firstOf: number[] = [];
  const lastOf: number[] = [];
  for (let i = 0; i < n; i++) {
    const f = Math.floor(i * stride);
    x[i] = t.xs[f]!;
    z[i] = t.zs[f]!;
    h[i] = t.hs[f]!;
    kappa[i] = t.ks[f]!;
    const pi = t.piece[f]!;
    const p = def.pieces[pi]!;
    firstOf[pi] ??= i;
    lastOf[pi] = i;
    const u = smooth(t.u[f]!);
    y[i] = yStart[pi]! + ((p.y ?? yStart[pi]!) - yStart[pi]!) * u;
    half[i] = (wStart[pi]! + ((p.w ?? wStart[pi]!) - wStart[pi]!) * u) / 2;
    const dir = p.k === "t" ? Math.sign(p.deg) : 0;
    bank[i] = dir * ((p.bank ?? 0) * Math.PI) / 180;
    const run = p.runoff ?? def.runoff;
    limL[i] = limR[i] = run;
    const edge = p.edge ?? def.edge;
    voidL[i] = voidR[i] = edge === "void" || p.gap || p.bridge ? 1 : 0;
    if (p.bridge && edge !== "void") {
      voidL[i] = voidR[i] = 0; // land bridges carry parapets
      limL[i] = limR[i] = Math.min(run, 1.2);
    }
    gap[i] = p.gap ? 1 : 0;
    bridge[i] = p.bridge ? 1 : 0;
    tunnel[i] = p.tunnel ? 1 : 0;
    surface[i] = p.surface ?? "asphalt";
    if (p.isle) {
      // taper the ends so the nose of the median is a point, not a wall
      const taper = Math.min(1, Math.min(t.u[f]!, 1 - t.u[f]!) * 6);
      isleD[i] = p.isle.d;
      isleHalf[i] = p.isle.half * taper;
      isleBot[i] = p.isle.bot ?? (p.isle.d > 0 ? -1 : 1);
    }
    if (p.tunnel) limL[i] = limR[i] = Math.min(run, 1);
  }

  blur(y, 5);
  blur(half, 8);
  blur(bank, 8);

  for (let i = 0; i < n; i++) {
    limL[i]! += half[i]!;
    limR[i]! += half[i]!;
    // inside of a corner: the ribbon's lateral axes converge at the centre of
    // curvature, so the boundary has to stay clear of it
    const k = kappa[i]!;
    if (k > 1e-4) limR[i] = Math.min(limR[i]!, Math.max(half[i]! + 0.6, 0.88 / k));
    if (k < -1e-4) limL[i] = Math.min(limL[i]!, Math.max(half[i]! + 0.6, 0.88 / -k));
  }

  clampNeighbours({ def, n, ds, x, y, z, h, half, limL, limR, voidL, voidR });

  const features: Course["features"] = [];
  const featureAt = new Map<number, number[]>();
  def.pieces.forEach((p, pi) => {
    for (const f of p.items ?? []) {
      const a = firstOf[pi]!;
      const b = lastOf[pi]!;
      const i = Math.round(a + (b - a) * f.at);
      features.push({ kind: f.kind, i, d: f.d * half[i]! });
      for (let k = -2; k <= 2; k++) {
        const j = (i + k + n) % n;
        const list = featureAt.get(j) ?? [];
        list.push(features.length - 1);
        featureAt.set(j, list);
      }
    }
  });

  const c: Course = {
    def, n, ds, length, x, y, z, h, kappa, bank, half, limL, limR, voidL, voidR, gap, bridge, tunnel,
    surface, isleD, isleHalf, features, featureAt, line: arr(), vmax: arr(),
  };
  solveLine(c, aLat, isleBot);
  return c;
}

/** Parallel strands share the space between them; a barrier goes down the middle. */
function clampNeighbours(c: {
  def: TrackDef; n: number; ds: number; x: Float32Array; y: Float32Array; z: Float32Array; h: Float32Array;
  half: Float32Array; limL: Float32Array; limR: Float32Array; voidL: Uint8Array; voidR: Uint8Array;
}) {
  const CELL = 40;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < c.n; i++) {
    const key = `${Math.floor(c.x[i]! / CELL)},${Math.floor(c.z[i]! / CELL)}`;
    const list = grid.get(key) ?? [];
    list.push(i);
    grid.set(key, list);
  }
  const minArc = 70;
  for (let i = 0; i < c.n; i++) {
    const [xi, zi] = [c.x[i]!, c.z[i]!];
    const [cx, cz] = [Math.floor(xi / CELL), Math.floor(zi / CELL)];
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const j of grid.get(`${gx},${gz}`) ?? []) {
          const arc = Math.abs(i - j) * c.ds;
          if (Math.min(arc, c.n * c.ds - arc) < minArc) continue;
          if (Math.abs(c.y[i]! - c.y[j]!) > 5.5) continue; // one passes over the other
          const [dx, dz] = [c.x[j]! - xi, c.z[j]! - zi];
          const dist = Math.hypot(dx, dz);
          if (dist < c.half[i]! + c.half[j]! + 1) {
            throw new Error(`${c.def.id}: road meets itself near (${xi.toFixed(0)}, ${zi.toFixed(0)}) with ${Math.abs(c.y[i]! - c.y[j]!).toFixed(1)}m of height between; need >5.5m or more separation`);
          }
          const side = -Math.sin(c.h[i]!) * dx + Math.cos(c.h[i]!) * dz; // + = neighbour on the right
          if (Math.abs(side) < dist * 0.5) continue; // ahead/behind, not alongside
          if (side > 0 && dist / 2 < c.limR[i]!) {
            c.limR[i] = Math.max(c.half[i]! + 0.5, dist / 2);
            c.voidR[i] = 0;
          }
          if (side < 0 && dist / 2 < c.limL[i]!) {
            c.limL[i] = Math.max(c.half[i]! + 0.5, dist / 2);
            c.voidL[i] = 0;
          }
        }
      }
    }
  }
}

/**
 * Elastic-band racing line: pull each point toward the midpoint of its
 * neighbours, kept inside the road. Then a speed profile: the corner limit from
 * the line's own curvature, with a backward pass for braking and a forward pass
 * for acceleration. Bots drive this, and it doubles as a designer's readout of
 * where a track actually makes you slow down.
 */
function solveLine(c: Course, aLat: number, isleBot: Int8Array, brake = 34, accel = 13, top = 30) {
  const { n, x, z, h, half, line, vmax, gap, isleD, isleHalf } = c;
  const nx = (i: number) => -Math.sin(h[i]!);
  const nz = (i: number) => Math.cos(h[i]!);
  for (const [k, iters] of [[14, 160], [6, 120], [3, 60]] as const) {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const a = (i - k + n) % n;
        const b = (i + k) % n;
        const mx = (x[a]! + nx(a) * line[a]! + x[b]! + nx(b) * line[b]!) / 2;
        const mz = (z[a]! + nz(a) * line[a]! + z[b]! + nz(b) * line[b]!) / 2;
        const off = (mx - x[i]!) * nx(i) + (mz - z[i]!) * nz(i);
        const lim = Math.max(0, half[i]! - 2.2);
        let v = gap[i] ? 0 : Math.max(-lim, Math.min(lim, off));
        if (isleHalf[i]! > 0) {
          const edge = isleD[i]! + isleBot[i]! * (isleHalf[i]! + 2.4);
          v = isleBot[i]! > 0 ? Math.max(v, edge) : Math.min(v, edge);
        }
        line[i] = v;
      }
    }
  }
  const lx = new Float32Array(n);
  const lz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lx[i] = x[i]! + nx(i) * line[i]!;
    lz[i] = z[i]! + nz(i) * line[i]!;
  }
  const seg = c.ds;
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n;
    const b = (i + 3) % n;
    const [ax, az, bx, bz] = [lx[i]! - lx[a]!, lz[i]! - lz[a]!, lx[b]! - lx[i]!, lz[b]! - lz[i]!];
    let d = Math.atan2(bz, bx) - Math.atan2(az, ax);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = Math.abs(d) / (3 * seg);
    vmax[i] = Math.min(top * 1.4, Math.sqrt(aLat / Math.max(k, 1e-4)));
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n;
      vmax[i] = Math.min(vmax[i]!, Math.sqrt(vmax[j]! ** 2 + 2 * brake * seg));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      vmax[j] = Math.min(vmax[j]!, Math.sqrt(vmax[i]! ** 2 + 2 * accel * seg));
    }
  }
}

/** Walk the ribbon from `hint` to the nearest sample. Local on purpose: this is
 *  what keeps a car on its own strand at an over/under crossing. */
export function locate(c: Course, px: number, pz: number, hint: number, reach = 8): number {
  let best = hint;
  let bestD = Infinity;
  for (let k = -reach; k <= reach; k++) {
    const i = (hint + k + c.n) % c.n;
    const d = (c.x[i]! - px) ** 2 + (c.z[i]! - pz) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Signed lateral offset of a point from sample i (+ = right of travel). */
export function lateral(c: Course, px: number, pz: number, i: number): number {
  return -(px - c.x[i]!) * Math.sin(c.h[i]!) + (pz - c.z[i]!) * Math.cos(c.h[i]!);
}

/** Road surface height at lateral offset d from sample i, banking included. */
export function roadY(c: Course, i: number, d: number): number {
  const clamped = Math.max(-c.half[i]!, Math.min(c.half[i]!, d));
  return c.y[i]! - Math.tan(c.bank[i]!) * clamped;
}
