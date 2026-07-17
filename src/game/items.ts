// Items: boxes on the road hand out position-weighted pickups — the further
// back you run, the meaner the roll. One held item per racer, used on tap.
// Pure logic: main.ts owns when to step this, render/ui draw what's here.
//
//   turbo   — short speed burst for yourself
//   missile — homes in on the car one place ahead and spins it out
//   oil     — dropped behind you; the next car over it spins out
import type { CarInput, CarState } from "./physics";
import type { Track } from "./track";

export type ItemKind = "turbo" | "missile" | "oil";

/** The item-relevant view of one racer. Opponents satisfy this directly;
 * main.ts keeps one for the player. `car` must be re-pointed whenever the
 * owner replaces its CarState (stepCar returns a fresh object). */
export interface ItemRacer {
  car: CarState;
  position: number; // live 1-based standing, updated by the caller
  held: ItemKind | null;
  spin: number; // seconds of spin-out remaining
  boost: number; // seconds of item speed-boost remaining
  finished: boolean;
}

export function createItemRacer(car: CarState): ItemRacer {
  return { car, position: 1, held: null, spin: 0, boost: 0, finished: false };
}

export interface ItemBox {
  x: number;
  y: number;
  respawnIn: number; // 0 = active and grabbable
}

export interface OilSlick {
  x: number;
  y: number;
}

export interface Missile {
  x: number;
  y: number;
  target: number; // racer index it homes in on
  ttl: number;
}

export interface ItemWorld {
  boxes: ItemBox[];
  oils: OilSlick[];
  missiles: Missile[];
}

export type ItemEvent =
  | { type: "pickup"; racer: number; item: ItemKind }
  | { type: "spin"; racer: number; by: "missile" | "oil" };

export const PICKUP_RADIUS = 11;
const OIL_RADIUS = 9;
const MISSILE_SPEED = 330;
const MISSILE_HIT_RADIUS = 10;
const MISSILE_TTL_SECONDS = 5;
const BOX_RESPAWN_SECONDS = 4;
const SPIN_SECONDS = 1.1;
const SPIN_RATE = 3 * 2 * Math.PI; // three full rotations per second of spin
const TURBO_SECONDS = 1.6;
const OIL_DROP_BACK_PX = 16;

/** The forced input while spun out: off throttle, hard on the brakes. */
export const SPIN_INPUT: CarInput = { steer: 0, throttle: 0, brake: 1 };

/** Rotate a spinning car's heading; the owner applies this before stepping physics. */
export function spinCar(car: CarState, dt: number): void {
  let h = car.heading + SPIN_RATE * dt;
  while (h > Math.PI) h -= 2 * Math.PI;
  car.heading = h;
}

/**
 * Rows of three boxes across the road at even progress fractions, offset so
 * no row sits on the start line. Row count scales with lap length unless given.
 */
export function createItemWorld(track: Track, rowsPerLap?: number): ItemWorld {
  const n = track.samples.length;
  let totalLen = 0;
  for (let i = 0; i < n; i++) {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % n]!;
    totalLen += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const rows = rowsPerLap ?? Math.max(2, Math.min(4, Math.round(totalLen / 1000)));

  const boxes: ItemBox[] = [];
  for (let r = 0; r < rows; r++) {
    const f = (r + 0.6) / rows;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (track.progress[mid]! <= f) lo = mid;
      else hi = mid - 1;
    }
    const a = track.samples[lo]!;
    const b = track.samples[(lo + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    for (const lane of [-1, 0, 1]) {
      const off = lane * track.roadWidth * 0.28;
      boxes.push({ x: a.x + nx * off, y: a.y + ny * off, respawnIn: 0 });
    }
  }
  return { boxes, oils: [], missiles: [] };
}

/**
 * Position-weighted roll: leaders mostly get oil to defend with, backmarkers
 * mostly get turbos and missiles to close with. Not full parity — a nudge
 * toward it.
 */
export function rollItem(
  position: number,
  fieldSize: number,
  rng: () => number = Math.random
): ItemKind {
  const p = fieldSize <= 1 ? 1 : (position - 1) / (fieldSize - 1); // 0 = leader, 1 = last
  const turbo = 0.2 + 0.8 * p;
  const missile = position === 1 ? 0 : 0.25 + 0.45 * p; // nothing ahead of the leader to shoot
  const oil = 0.65 - 0.45 * p;
  const roll = rng() * (turbo + missile + oil);
  if (roll < turbo) return "turbo";
  if (roll < turbo + missile) return "missile";
  return "oil";
}

/** One step of the item world: pickups, oil hits, missile flight, timers. */
export function stepItems(
  world: ItemWorld,
  racers: ItemRacer[],
  dt: number,
  rng: () => number = Math.random
): ItemEvent[] {
  const events: ItemEvent[] = [];

  for (const box of world.boxes) {
    if (box.respawnIn > 0) {
      box.respawnIn = Math.max(0, box.respawnIn - dt);
      continue;
    }
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i]!;
      if (r.held !== null || r.finished) continue;
      if (Math.hypot(r.car.x - box.x, r.car.y - box.y) > PICKUP_RADIUS) continue;
      r.held = rollItem(r.position, racers.length, rng);
      box.respawnIn = BOX_RESPAWN_SECONDS;
      events.push({ type: "pickup", racer: i, item: r.held });
      break;
    }
  }

  for (let oi = world.oils.length - 1; oi >= 0; oi--) {
    const oil = world.oils[oi]!;
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i]!;
      if (r.spin > 0 || r.finished) continue;
      if (Math.hypot(r.car.x - oil.x, r.car.y - oil.y) > OIL_RADIUS) continue;
      r.spin = SPIN_SECONDS;
      world.oils.splice(oi, 1);
      events.push({ type: "spin", racer: i, by: "oil" });
      break;
    }
  }

  for (let mi = world.missiles.length - 1; mi >= 0; mi--) {
    const m = world.missiles[mi]!;
    const target = racers[m.target];
    m.ttl -= dt;
    if (!target || target.finished || m.ttl <= 0) {
      world.missiles.splice(mi, 1);
      continue;
    }
    const dx = target.car.x - m.x;
    const dy = target.car.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist < MISSILE_HIT_RADIUS) {
      target.spin = SPIN_SECONDS;
      world.missiles.splice(mi, 1);
      events.push({ type: "spin", racer: m.target, by: "missile" });
      continue;
    }
    m.x += (dx / dist) * MISSILE_SPEED * dt;
    m.y += (dy / dist) * MISSILE_SPEED * dt;
  }

  for (const r of racers) {
    r.spin = Math.max(0, r.spin - dt);
    r.boost = Math.max(0, r.boost - dt);
  }
  return events;
}

/**
 * Use racer `index`'s held item. Returns what was used (null if nothing to
 * use). A missile with no one ahead of the shooter is fired into thin air —
 * consumed for nothing, so leading with a missile in hand is a real mistake.
 */
export function useItem(world: ItemWorld, racers: ItemRacer[], index: number): ItemKind | null {
  const r = racers[index]!;
  const item = r.held;
  if (!item || r.spin > 0 || r.finished) return null;
  r.held = null;

  if (item === "turbo") {
    r.boost = TURBO_SECONDS;
  } else if (item === "missile") {
    const target = racers.findIndex(
      (t, ti) => ti !== index && !t.finished && t.position === r.position - 1
    );
    if (target >= 0) {
      world.missiles.push({ x: r.car.x, y: r.car.y, target, ttl: MISSILE_TTL_SECONDS });
    }
  } else {
    world.oils.push({
      x: r.car.x - Math.cos(r.car.heading) * OIL_DROP_BACK_PX,
      y: r.car.y - Math.sin(r.car.heading) * OIL_DROP_BACK_PX,
    });
  }
  return item;
}
