// Items: boxes on the road hand out position-weighted pickups — the further
// back you run, the meaner the roll. One held item per racer, used on tap.
// Pure logic: main.ts owns when to step this, render/ui draw what's here.
//
//   turbo   — short speed burst for yourself
//   rocket  — fired straight out where you're facing; hits whoever's in its path
//   missile — the cute one: locks a nearby racer and curves toward them
//   crown   — the rare one: relentlessly chases down whoever's in first place
//   oil     — dropped behind you; the next car over it spins out
import type { CarInput, CarState } from "./physics";
import type { Track } from "./track";

export type ItemKind = "turbo" | "rocket" | "missile" | "crown" | "oil";

/** The item-relevant view of one racer. Opponents satisfy this directly;
 * main.ts keeps one for the player. `car` must be re-pointed whenever the
 * owner replaces its CarState (stepCar returns a fresh object). */
export interface ItemRacer {
  car: CarState;
  position: number; // live 1-based standing, updated by the caller
  deficit: number; // 0 = on the leader, 1 = a full ITEM_GAP_WINDOW back; updated by the caller
  held: ItemKind | null;
  spin: number; // seconds of spin-out remaining
  boost: number; // seconds of item speed-boost remaining
  finished: boolean;
}

export function createItemRacer(car: CarState): ItemRacer {
  return { car, position: 1, deficit: 0, held: null, spin: 0, boost: 0, finished: false };
}

/** Being this many laps behind the leader maxes out the comeback-item roll. */
export const ITEM_GAP_WINDOW = 0.5;

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
  chaseLeader: boolean; // true = re-locks the current 1st-place racer every step
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
  | { type: "spin"; racer: number; by: "missile" | "crown" | "oil" };

export const PICKUP_RADIUS = 11;
const OIL_RADIUS = 9;
const ROCKET_SPEED = 360; // dumb straight shot: fast and flat
const MISSILE_SPEED = 300; // seeker: a touch slower so its curve reads
const MISSILE_TURN_RATE = 3.2; // rad/s cap on the seeker's steering — the driving-style curve
const MISSILE_ACQUIRE_RADIUS = 260; // the seeker only locks racers in this vicinity
const MISSILE_HIT_RADIUS = 10;
const ROCKET_TTL_SECONDS = 2.2; // straight shots expire sooner — they don't chase
const MISSILE_TTL_SECONDS = 5;
const CROWN_TURN_RATE = 4.2; // the leader-hunter corners harder — it will not be shaken
const CROWN_TTL_SECONDS = 9; // and it stays airborne long enough to run the leader down
const SHOT_NOSE_PX = 9; // spawn a shot at the car's nose, not its center
const BOX_RESPAWN_SECONDS = 4;
// How long a hit spins you out — the item's whole bite. Slicks sting a little
// less than they used to; rockets/missiles/crowns sting less still, so a shot
// is a nudge off your line rather than a race-ender.
const OIL_SPIN_SECONDS = 0.85;
const SHOT_SPIN_SECONDS = 0.6;
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
 * Rows of three boxes across the road at even progress fractions, offset so no
 * row sits on the start line. Row count scales with the size of the field so a
 * bigger pack has enough pickups to go around — from 4 rows up to 12. Pass
 * `rowsOverride` to pin an exact count (tests).
 */
export function createItemWorld(track: Track, fieldSize = 4, rowsOverride?: number): ItemWorld {
  const n = track.samples.length;
  const rows = rowsOverride ?? Math.max(4, Math.min(12, fieldSize));

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
 * Gap-weighted roll: how mean the roll is scales with how far behind the
 * leader you actually are (`deficit`, 0 = on the leader's tail, 1 = a full
 * gap window back), not your discrete rank — so a tight pack of chasers all
 * roll gently and only a car that's truly dropped off gets the big comeback
 * tools. Leaders mostly get oil to defend with; the plain straight rocket is
 * the common attack, the homing missile a rarer treat, the leader-chasing
 * crown rarer still. Not full parity — a nudge toward it.
 */
export function rollItem(
  deficit: number,
  leading: boolean, // true = running 1st, nothing ahead to shoot at
  rng: () => number = Math.random
): ItemKind {
  const p = Math.max(0, Math.min(1, deficit));
  const turbo = 0.2 + 0.7 * p;
  const rocket = leading ? 0 : 0.4 + 0.2 * p;
  const missile = leading ? 0 : 0.85 * p * p; // the better shot — now a real slice of the roll
  const crown = leading ? 0 : 0.32 * p * p * p; // rarest, but a fatter near-last comeback treat
  const oil = 0.35 - 0.3 * p; // slicks pulled well back — fewer of them across the board
  const roll = rng() * (turbo + rocket + missile + crown + oil);
  if (roll < turbo) return "turbo";
  if (roll < turbo + rocket) return "rocket";
  if (roll < turbo + rocket + missile) return "missile";
  if (roll < turbo + rocket + missile + crown) return "crown";
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
      r.held = rollItem(r.deficit, r.position === 1, rng);
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
      r.spin = OIL_SPIN_SECONDS;
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
    // gentle driving-style arc. The crown re-locks the current leader every
    // step (so it hunts the position, not a fixed car); a plain missile that
    // loses its target (spun off, finished) drops the lock and flies straight.
    if (m.homing) {
      if (m.chaseLeader) m.target = leaderIndex(racers);
      const target = m.target !== null ? racers[m.target] : undefined;
      if (!target || target.finished) {
        m.target = null;
      } else {
        const want = Math.atan2(target.car.y - m.y, target.car.x - m.x);
        let diff = want - m.heading;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const turn = (m.chaseLeader ? CROWN_TURN_RATE : MISSILE_TURN_RATE) * dt;
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
      racers[hit]!.spin = SHOT_SPIN_SECONDS;
      world.missiles.splice(mi, 1);
      events.push({ type: "spin", racer: hit, by: m.chaseLeader ? "crown" : "missile" });
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

/** The racer currently running 1st (position 1), or null if none is left in. */
function leaderIndex(racers: ItemRacer[]): number | null {
  const i = racers.findIndex((r) => !r.finished && r.position === 1);
  return i >= 0 ? i : null;
}

/**
 * Use racer `index`'s held item. Returns what was used (null if nothing to
 * use). All three shot types fire from the nose in the direction the car
 * faces — the rocket flies straight, the missile curves toward whatever it
 * locked, and the crown curves after whoever leads the race.
 */
export function useItem(world: ItemWorld, racers: ItemRacer[], index: number): ItemKind | null {
  const r = racers[index]!;
  const item = r.held;
  if (!item || r.spin > 0 || r.finished) return null;
  r.held = null;

  if (item === "turbo") {
    r.boost = TURBO_SECONDS;
  } else if (item === "rocket" || item === "missile" || item === "crown") {
    const homing = item !== "rocket";
    const chaseLeader = item === "crown";
    world.missiles.push({
      x: r.car.x + Math.cos(r.car.heading) * SHOT_NOSE_PX,
      y: r.car.y + Math.sin(r.car.heading) * SHOT_NOSE_PX,
      heading: r.car.heading,
      homing,
      chaseLeader,
      target: chaseLeader ? leaderIndex(racers) : homing ? acquireTarget(racers, index) : null,
      owner: index,
      ttl: chaseLeader ? CROWN_TTL_SECONDS : homing ? MISSILE_TTL_SECONDS : ROCKET_TTL_SECONDS,
    });
  } else {
    world.oils.push({
      x: r.car.x - Math.cos(r.car.heading) * OIL_DROP_BACK_PX,
      y: r.car.y - Math.sin(r.car.heading) * OIL_DROP_BACK_PX,
    });
  }
  return item;
}
