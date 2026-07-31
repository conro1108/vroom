// Items: boxes on the road hand out position-weighted pickups — the further
// back you run, the meaner the roll. One held item per racer, used on tap.
// Pure logic: main.ts owns when to step this, render/ui draw what's here.
//
// The speed-boost ladder is the staple of the box — three tiers of the same
// idea, each one longer, harder and more forgiving than the last:
//
//   turbo     — the common one: a short kick, lightly guided
//   megaturbo — mid-tier: longer, harder, and fully guided onto the racing
//               line (see boostGuide) so it's spendable through corners
//   hyperturbo — the prize at the bottom of a way-back roll: the longest and
//               hardest of the three, a lap-changing shove
//
// and the attacks:
//
//   rocket  — fired straight out where you're facing; hits whoever's in its path
//   missile — the cute one: locks a nearby racer and curves toward them
//   crown   — the rare one: relentlessly chases down whoever's in first place
//   oil     — dropped behind you; the next car over it spins out
import type { CarInput, CarState } from "./physics";
import type { Track } from "./track";
import type { Tuning } from "./tuning";

export type ItemKind = "turbo" | "megaturbo" | "hyperturbo" | "rocket" | "missile" | "crown" | "oil";

/** The three speed-boost tiers, in ascending order. */
export type BoostKind = "turbo" | "megaturbo" | "hyperturbo";

export function isBoost(item: ItemKind): item is BoostKind {
  return item === "turbo" || item === "megaturbo" || item === "hyperturbo";
}

/** The item-relevant view of one racer. Opponents satisfy this directly;
 * main.ts keeps one for the player. `car` must be re-pointed whenever the
 * owner replaces its CarState (stepCar returns a fresh object). */
export interface ItemRacer {
  car: CarState;
  position: number; // live 1-based standing, updated by the caller
  deficit: number; // 0 = on the leader, 1 = a full ITEM_GAP_WINDOW back; updated by the caller
  held: ItemKind | null;
  spin: number; // seconds of spin-out remaining
  spinFrom: number; // heading captured when the spin began, restored on exit
  boost: number; // seconds of item speed-boost remaining
  boostPower: number; // tier punch of the live item boost (1 = the plain turbo)
  boostGuide: number; // 0..1 of the tuning steering assist the live item boost applies
  finished: boolean;
}

export function createItemRacer(car: CarState): ItemRacer {
  return {
    car,
    position: 1,
    deficit: 0,
    held: null,
    spin: 0,
    spinFrom: 0,
    boost: 0,
    boostPower: 1,
    boostGuide: 0,
    finished: false,
  };
}

/** Being this many laps behind the leader maxes out the comeback-item roll.
 *  Deliberately short: a leader who has pulled a third of a lap has already
 *  escaped, and the field needs its comeback tools while the gap is still
 *  closeable, not once it's hopeless. */
export const ITEM_GAP_WINDOW = 0.35;

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
  speed: number; // px/s, fixed at launch from the race's shot speeds
  ttl: number;
}

/** Shot speeds for one race, in world px/s. */
export interface ShotSpeeds {
  rocket: number;
  missile: number; // the seekers: plain missile and crown
}

/**
 * Shots are quoted as multiples of the *class* top speed, not in absolute px/s:
 * at 200cc a car tops out around 300 px/s and a boosting one past 400, so the
 * old flat 360/300 px/s shots were slower than the cars they were fired at —
 * you could outrun a rocket. Scaling with the class keeps a shot the same
 * threat at every speed.
 */
export function shotSpeeds(raceTuning: Tuning): ShotSpeeds {
  return {
    rocket: raceTuning.maxSpeed * raceTuning.rocketSpeed,
    missile: raceTuning.maxSpeed * raceTuning.missileSpeed,
  };
}

export interface ItemWorld {
  boxes: ItemBox[];
  oils: OilSlick[];
  missiles: Missile[];
  shot: ShotSpeeds;
}

export type ItemEvent =
  | { type: "pickup"; racer: number; item: ItemKind }
  | { type: "spin"; racer: number; by: "missile" | "crown" | "oil" };

export const PICKUP_RADIUS = 11;
const OIL_RADIUS = 9;
const MISSILE_TURN_RATE = 3.2; // rad/s cap on the seeker's steering — the driving-style curve
const MISSILE_ACQUIRE_RADIUS = 260; // the seeker only locks racers in this vicinity
const MISSILE_HIT_RADIUS = 10;
const ROCKET_TTL_SECONDS = 2.2; // straight shots expire sooner — they don't chase
const MISSILE_TTL_SECONDS = 5;
const CROWN_TURN_RATE = 4.2; // the leader-hunter corners harder — it will not be shaken
const CROWN_TTL_SECONDS = 9; // and it stays airborne long enough to run the leader down
const SHOT_NOSE_PX = 9; // spawn a shot at the car's nose, not its center
const BOX_RESPAWN_SECONDS = 4;
// How long a hit spins you out — the item's whole bite. Kept deliberately
// short: a slick is a shove off your line, a shot barely a nudge, not a
// race-ender. Durations are whole turns at SPIN_RATE (oil = 2, shot = 1) so a
// spin unwinds back to where it started rather than leaving you facing away.
const OIL_SPIN_SECONDS = 0.8;
const SHOT_SPIN_SECONDS = 0.4;
const SPIN_RATE = 2.5 * 2 * Math.PI; // 2.5 rotations per second of spin
const OIL_DROP_BACK_PX = 16;

/**
 * The speed-boost ladder. A tier is longer (`seconds`), harder (`power`, a
 * multiplier on the tuning boost's *excess* over 1× — so 1 is the ordinary
 * rocket-start kick) and more forgiving (`guide`, the fraction of the tuning
 * steering assist it applies, easing you onto the racing line so the boost is
 * spendable through corners instead of into a fence).
 *
 * The owners (main.ts / opponents.ts) read `power` and `guide` off the racer
 * when they step a boosted car — that's where the track tangent lives; here we
 * only own the tier shape.
 */
export const BOOST_TIERS: Record<BoostKind, { seconds: number; guide: number; power: number }> = {
  turbo: { seconds: 1.6, guide: 0.5, power: 1 },
  megaturbo: { seconds: 2.6, guide: 1, power: 1.3 },
  hyperturbo: { seconds: 3.4, guide: 1, power: 1.7 },
};

/** The forced input while spun out: off throttle, only a light brake so you
 *  keep some momentum through the spin instead of dead-stopping. */
export const SPIN_INPUT: CarInput = { steer: 0, throttle: 0, brake: 0.45 };

/** Rotate a spinning car's heading; the owner applies this before stepping
 *  physics. The final heading is snapped back to `spinFrom` when the spin ends
 *  (see stepItems), so the car always comes out facing the way it went in. */
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
 *
 * `raceTuning` is the class-scaled tuning the race is being run at; the world
 * keeps the shot speeds it implies, so every shot fired is quick relative to
 * the cars in *this* race.
 */
export function createItemWorld(
  track: Track,
  raceTuning: Tuning,
  fieldSize = 4,
  rowsOverride?: number
): ItemWorld {
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
  return { boxes, oils: [], missiles: [], shot: shotSpeeds(raceTuning) };
}

/**
 * Gap-weighted roll, driven by two gaps rather than your discrete rank.
 * `deficit` is your own gap to the leader (0 = on their tail, 1 = a full
 * ITEM_GAP_WINDOW back); `leaderGap` is the gap the leader has pulled on the
 * whole field — 2nd place's deficit. The mean stuff keys off whichever is
 * bigger, so a runaway leader arms the entire pack behind them, not just the
 * one car that happened to drop off the back. Without that, a leader who
 * escapes a tight peloton is gone: everyone still bunched rolls a 0-deficit
 * (i.e. gentle) roll forever and nothing in the box can reach them.
 *
 * The leader themselves gets no shots (nothing ahead to aim at) and, all but
 * never, a speed boost — a boost is exactly what a car already clear of the
 * field doesn't need. They defend with oil instead. The plain straight rocket
 * is the common attack, the homing missile the better one, the leader-chasing
 * crown the prize at the bottom of the roll.
 *
 * What the box is *for* is the boost ladder: driving the thing is the point, so
 * the common roll anywhere in the field is a turbo, and running further back
 * upgrades the tier (mega, then hyper) rather than handing out more ordnance.
 * The attacks are the garnish — the rocket used to be the single likeliest
 * item in the game, which made a mid-pack box feel like a weapons crate.
 */
export function rollItem(
  deficit: number,
  leading: boolean, // true = running 1st, nothing ahead to shoot at
  leaderGap = 0, // how far 1st has escaped 2nd, same 0..1 scale as deficit
  rng: () => number = Math.random
): ItemKind {
  const p = Math.max(0, Math.min(1, deficit));
  const g = Math.max(0, Math.min(1, leaderGap));
  const chase = Math.max(p, g); // how stretched the race is, from here
  // "basically never": ~5% of a leader's boxes, just enough that the leader's
  // pickup isn't a guaranteed oil can
  const turbo = leading ? 0.01 : 0.5 - 0.2 * p; // the staple, everywhere in the field
  const megaturbo = leading ? 0 : 0.15 + 0.35 * chase; // the tier a dropped-back car steps up to
  const hyperturbo = leading ? 0 : 0.5 * chase * chase * chase; // the deep-comeback prize
  const rocket = leading ? 0 : 0.16 + 0.1 * p;
  const missile = leading ? 0 : 0.1 * chase + 0.5 * chase * chase;
  const crown = leading ? 0 : 0.4 * chase * chase * chase + 0.1 * g; // the runaway-leader answer
  const oil = 0.2 - 0.15 * p; // slicks pulled well back — a defensive item, not a pack item
  const weights: [ItemKind, number][] = [
    ["turbo", turbo],
    ["megaturbo", megaturbo],
    ["hyperturbo", hyperturbo],
    ["rocket", rocket],
    ["missile", missile],
    ["crown", crown],
    ["oil", oil],
  ];
  let roll = rng() * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll < 0) return kind;
  }
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
  // The runner-up's gap to the leader *is* the leader's gap over the field,
  // already in the caller's 0..1 window units — so the roll can read it
  // without anyone having to pass it in.
  const leaderGap = racers.find((r) => !r.finished && r.position === 2)?.deficit ?? 0;

  for (const box of world.boxes) {
    if (box.respawnIn > 0) {
      box.respawnIn = Math.max(0, box.respawnIn - dt);
      continue;
    }
    for (let i = 0; i < racers.length; i++) {
      const r = racers[i]!;
      if (r.held !== null || r.finished) continue;
      if (Math.hypot(r.car.x - box.x, r.car.y - box.y) > PICKUP_RADIUS) continue;
      r.held = rollItem(r.deficit, r.position === 1, leaderGap, rng);
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
      r.spinFrom = r.car.heading;
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

    m.x += Math.cos(m.heading) * m.speed * dt;
    m.y += Math.sin(m.heading) * m.speed * dt;

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
      racers[hit]!.spinFrom = racers[hit]!.car.heading;
      world.missiles.splice(mi, 1);
      events.push({ type: "spin", racer: hit, by: m.chaseLeader ? "crown" : "missile" });
    }
  }

  for (const r of racers) {
    const wasSpinning = r.spin > 0;
    r.spin = Math.max(0, r.spin - dt);
    // the instant the spin runs out, land back on the entry heading so the car
    // never comes to rest facing backward
    if (wasSpinning && r.spin === 0) r.car.heading = r.spinFrom;
    r.boost = Math.max(0, r.boost - dt);
    if (r.boost === 0) {
      r.boostPower = 1;
      r.boostGuide = 0;
    }
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

  if (isBoost(item)) {
    const tier = BOOST_TIERS[item];
    r.boost = tier.seconds;
    r.boostPower = tier.power;
    r.boostGuide = tier.guide;
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
      speed: homing ? world.shot.missile : world.shot.rocket,
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
