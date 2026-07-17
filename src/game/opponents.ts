// AI opponents for competitive races: each one is a bot driver in a vehicle
// the player didn't pick, with a small skill spread so the field strings out.
// Pure logic — main.ts steps them alongside the player and the scene draws
// them by vehicle id.
import { createBot, type BotPersonality } from "./botdriver";
import { createCarState, stepCar, type CarInput, type CarState } from "./physics";
import { applySpeedClass, RACE_LAPS, type SpeedClass } from "./progression";
import { createLapTracker, updateLap, type LapTracker, type Track, type TrackQuery } from "./track";
import type { Tuning } from "./tuning";
import { VEHICLES } from "./vehicles";

export const OPPONENT_COUNT = 3; // default field; tuning.opponentCount overrides

// Skill multiplies maxSpeed/accel per opponent so finishes spread out: the
// podium (needed for main-line unlocks) means beating the slowest bot, while
// an outright win (bonus branches) means out-driving the fastest one.
const SKILL_MIN = 0.85;
const SKILL_MAX = 1.01;

/** Evenly spread skill factors across the field, one per opponent. */
export function skillSpread(count: number): number[] {
  if (count <= 1) return [(SKILL_MIN + SKILL_MAX) / 2];
  return Array.from(
    { length: count },
    (_, i) => SKILL_MIN + ((SKILL_MAX - SKILL_MIN) * i) / (count - 1)
  );
}

// Grid layout in world px behind the start line: two columns, rows every
// ROW_GAP. The player takes the slot after all opponents — front rows are
// the bots you have to hunt.
const GRID_FIRST_ROW = 16;
const GRID_ROW_GAP = 18;
const GRID_SIDE = 11;

export interface Opponent {
  vehicleId: string;
  car: CarState;
  tracker: LapTracker;
  tuning: Tuning;
  bot: (car: CarState) => CarInput;
  /** 1-based order in which this bot finished the race, or null if racing. */
  finishOrder: number | null;
}

export function gridSlot(track: Track, index: number): { x: number; y: number } {
  const back = GRID_FIRST_ROW + Math.floor(index / 2) * GRID_ROW_GAP;
  const side = (index % 2 === 0 ? -1 : 1) * GRID_SIDE;
  const dir = { x: Math.cos(track.startHeading), y: Math.sin(track.startHeading) };
  return {
    x: track.start.x - dir.x * back - dir.y * side,
    y: track.start.y - dir.y * back + dir.x * side,
  };
}

export function playerGridSlot(track: Track, opponentCount = OPPONENT_COUNT): { x: number; y: number } {
  return gridSlot(track, opponentCount);
}

/**
 * Build the opposing field: distinct vehicles the player isn't driving,
 * shuffled onto the front grid slots with shuffled skill factors.
 */
export function createOpponents(
  track: Track,
  query: TrackQuery,
  playerVehicleId: string,
  baseTuning: Tuning,
  cls: SpeedClass,
  count = OPPONENT_COUNT,
  rng: () => number = Math.random
): Opponent[] {
  const pool = VEHICLES.filter((v) => v.id !== playerVehicleId);
  shuffle(pool, rng);
  const skills = shuffle(skillSpread(count), rng);

  return skills.map((skill, i) => {
    const vehicle = pool[i % pool.length]!;
    const tuning = applySpeedClass({ ...baseTuning, ...vehicle.values }, cls);
    tuning.maxSpeed *= skill;
    tuning.accel *= skill;
    // Slower bots are also sloppier drivers, so the back of the field looks
    // human rather than just detuned.
    const sloppy = baseTuning.botSloppiness;
    const personality: BotPersonality = {
      line: (rng() - 0.5) * track.roadWidth * 0.4,
      wobble: sloppy * (1.25 - skill),
      mistakeRate: sloppy * (1.3 - skill) * 8,
      seed: rng() * 1000,
    };
    const pos = gridSlot(track, i);
    const startProgress = query.progressAt(pos.x, pos.y) ?? 0;
    return {
      vehicleId: vehicle.id,
      car: createCarState(pos.x, pos.y, track.startHeading),
      tracker: createLapTracker(startProgress),
      tuning,
      bot: createBot(track, query, tuning, personality),
      finishOrder: null,
    };
  });
}

// Rubber banding saturates at this many laps of gap to the player.
const RUBBER_WINDOW = 0.3;

/** Speed/accel multiplier for a bot `gapLaps` ahead (+) or behind (−) the player. */
export function rubberMult(gapLaps: number, strength: number): number {
  const catchup = Math.max(-1, Math.min(1, -gapLaps / RUBBER_WINDOW));
  return 1 + catchup * strength;
}

/** One physics step for every bot (throttle only once the race is `live`).
 * With `playerDistance` (laps), the field rubber-bands toward the player. */
export function stepOpponents(
  opponents: Opponent[],
  query: TrackQuery,
  dt: number,
  live: boolean,
  playerDistance: number | null = null
): void {
  let finished = opponents.filter((o) => o.finishOrder !== null).length;
  for (const o of opponents) {
    const input = live ? o.bot(o.car) : { steer: 0, throttle: 0, brake: 0 };
    let tuning = o.tuning;
    if (live && playerDistance !== null && o.tuning.rubberBand > 0 && o.finishOrder === null) {
      const mult = rubberMult(raceDistance(o.tracker) - playerDistance, o.tuning.rubberBand);
      tuning = { ...o.tuning, maxSpeed: o.tuning.maxSpeed * mult, accel: o.tuning.accel * mult };
    }
    o.car = stepCar(o.car, input, tuning, query.surfaceAt(o.car.x, o.car.y), dt);
    const p = query.progressAt(o.car.x, o.car.y);
    if (p !== null && updateLap(o.tracker, p).completed) {
      if (o.tracker.lap > RACE_LAPS && o.finishOrder === null) {
        o.finishOrder = ++finished;
      }
    }
  }
}

/** Net race distance in laps, capped at the finish so placings stay stable. */
export function raceDistance(tracker: LapTracker): number {
  return Math.min(tracker.lap - 1 + tracker.accum, RACE_LAPS);
}

/** Player's live position: 1 + everyone ahead of them right now. */
export function playerPosition(playerTracker: LapTracker, opponents: Opponent[]): number {
  const mine = raceDistance(playerTracker);
  let ahead = 0;
  for (const o of opponents) {
    if (o.finishOrder !== null || raceDistance(o.tracker) > mine) ahead++;
  }
  return 1 + ahead;
}

/** Placement locked in when the player crosses the final line. */
export function playerPlacement(opponents: Opponent[]): number {
  return 1 + opponents.filter((o) => o.finishOrder !== null).length;
}

/**
 * Soft car-vs-car separation: overlapping cars get pushed apart and their
 * closing velocity bounced, gently enough to never launch anyone.
 */
export function separateCars(cars: CarState[], minDist = 12, bounce = 0.4): void {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i]!;
      const b = cars[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= minDist || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (minDist - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      // kill the closing component of relative velocity, plus a soft bounce
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = (-rel * (1 + bounce)) / 2;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
      }
    }
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
