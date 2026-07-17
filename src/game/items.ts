// Items: boxes on the road hand out position-weighted pickups — the further
// back you run, the meaner the roll. One held item per racer, used on tap.
// Pure logic: main.ts owns when to step this, render/ui draw what's here.
//
//   turbo   — short speed burst for yourself
//   rocket  — fired straight out where you're facing; hits whoever's in its path
//   missile — the cute one: locks a nearby racer and curves toward them
//   oil     — dropped behind you; the next car over it spins out
import type { CarInput, CarState } from "./physics";
import type { Track } from "./track";

export type ItemKind = "turbo" | "rocket" | "missile" | "oil";

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
  heading: number; // direction of travel; straight rockets never change it
  homing: boolean; // true = the seeker that curves; false = a dumb straight shot
  target: number | null; // racer index the seeker is locked onto (drops to null if it's gone)
  owner: number; // the shooter — immune to its own shot for the whole flight
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
const ROCKET_SPEED = 360; // dumb straight shot: fast and flat
const MISSILE_SPEED = 300; // seeker: a touch slower so its curve reads
const MISSILE_TURN_RATE = 3.2; // rad/s cap on the seeker's steering — the driving-style curve
const MISSILE_ACQUIRE_RADIUS = 260; // the seeker only locks racers in this vicinity
const MISSILE_HIT_RADIUS = 10;
const ROCKET_TTL_SECONDS = 2.2; // straight shots expire sooner — they don't chase
const MISSILE_TTL_SECONDS = 5;
const SHOT_NOSE_PX = 9; // spawn a shot at the car's nose, not its center
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
 * mostly get turbos and shots to close with. The plain straight rocket is the
 * common attack; the homing missile is the rare treat, weighted hard to the
 * back so it's a comeback tool, not a sniper everyone gets. Not full parity —
 * a nudge toward it.
 */
export function rollItem(
  position: number,
  fieldSize: number,
  rng: () => number = Math.random
): ItemKind {
  const p = fieldSize <= 1 ? 1 : (position - 1) / (fieldSize - 1); // 0 = leader, 1 = last
  const turbo = 0.2 + 0.7 * p;
  const leading = position === 1; // nothing ahead of the leader to shoot at
  const rocket = leading ? 0 : 0.35 + 0.2 * p;
  const missile = leading ? 0 : 0.5 * p * p; // rare, and only really shows up near the back
  const oil = 0.65 - 0.45 * p;
  const roll = rng() * (turbo + rocket + missile + oil);
  if (roll < turbo) return "turbo";
  if (roll < turbo + rocket) return "rocket";
  if (roll < turbo + rocket + missile) return "missile";
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
    m.ttl -= dt;
    if (m.ttl <= 0) {
      world.missiles.splice(mi, 1);
      continue;
    }

    // seekers steer toward their locked target at a capped turn rate — the
    // gentle driving-style arc. A lost target (spun off, finished) drops the
    // lock and the shot flies on straight.
    if (m.homing) {
      const target = m.target !== null ? racers[m.target] : undefined;
      if (!target || target.finished) {
        m.target = null;
      } else {
        const want = Math.atan2(target.car.y - m.y, target.car.x - m.x);
        let diff = want - m.heading;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const turn = MISSILE_TURN_RATE * dt;
        m.heading += Math.max(-turn, Math.min(turn, diff));
      }
    }

    const speed = m.homing ? MISSILE_SPEED : ROCKET_SPEED;
    m.x += Math.cos(m.heading) * speed * dt;
    m.y += Math.sin(m.heading) * speed * dt;

    // a shot spins whoever it touches (except the racer who fired it)
    let hit = -1;
    for (let i = 0; i < racers.length; i++) {
      if (i === m.owner) continue;
      const r = racers[i]!;
      if (r.spin > 0 || r.finished) continue;
      if (Math.hypot(r.car.x - m.x, r.car.y - m.y) <= MISSILE_HIT_RADIUS) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) {
      racers[hit]!.spin = SPIN_SECONDS;
      world.missiles.splice(mi, 1);
      events.push({ type: "spin", racer: hit, by: "missile" });
    }
  }

  for (const r of racers) {
    r.spin = Math.max(0, r.spin - dt);
    r.boost = Math.max(0, r.boost - dt);
  }
  return events;
}

/**
 * The seeker locks onto the nearest racer within its vicinity, preferring one
 * ahead of the shooter so it reads as an attack rather than a random spin.
 * Returns a racer index, or null if the vicinity is empty (then the shot just
 * flies straight).
 */
function acquireTarget(racers: ItemRacer[], index: number): number | null {
  const me = racers[index]!;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < racers.length; i++) {
    if (i === index) continue;
    const t = racers[i]!;
    if (t.finished) continue;
    const dist = Math.hypot(t.car.x - me.car.x, t.car.y - me.car.y);
    if (dist > MISSILE_ACQUIRE_RADIUS) continue;
    // racers behind the shooter are a worse pick: nudge them down the list
    const behindPenalty = t.position > me.position ? MISSILE_ACQUIRE_RADIUS : 0;
    const score = dist + behindPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best >= 0 ? best : null;
}

/**
 * Use racer `index`'s held item. Returns what was used (null if nothing to
 * use). Both shot types fire from the nose in the direction the car faces —
 * the rocket flies straight, the missile curves toward whatever it locked.
 */
export function useItem(world: ItemWorld, racers: ItemRacer[], index: number): ItemKind | null {
  const r = racers[index]!;
  const item = r.held;
  if (!item || r.spin > 0 || r.finished) return null;
  r.held = null;

  if (item === "turbo") {
    r.boost = TURBO_SECONDS;
  } else if (item === "rocket" || item === "missile") {
    const homing = item === "missile";
    world.missiles.push({
      x: r.car.x + Math.cos(r.car.heading) * SHOT_NOSE_PX,
      y: r.car.y + Math.sin(r.car.heading) * SHOT_NOSE_PX,
      heading: r.car.heading,
      homing,
      target: homing ? acquireTarget(racers, index) : null,
      owner: index,
      ttl: homing ? MISSILE_TTL_SECONDS : ROCKET_TTL_SECONDS,
    });
  } else {
    world.oils.push({
      x: r.car.x - Math.cos(r.car.heading) * OIL_DROP_BACK_PX,
      y: r.car.y - Math.sin(r.car.heading) * OIL_DROP_BACK_PX,
    });
  }
  return item;
}
