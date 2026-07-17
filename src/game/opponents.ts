// AI opponents for competitive races: each one is a bot driver in a vehicle
// the player didn't pick, with a small skill spread so the field strings out.
// Pure logic — main.ts steps them alongside the player and the scene draws
// them by vehicle id.
import { createBot } from "./botdriver";
import { createCarState, stepCar, type CarInput, type CarState } from "./physics";
import { applySpeedClass, RACE_LAPS, type SpeedClass } from "./progression";
import { createLapTracker, updateLap, type LapTracker, type Track, type TrackQuery } from "./track";
import type { Tuning } from "./tuning";
import { VEHICLES } from "./vehicles";

export const RACER_COUNT = 4; // player + OPPONENT_COUNT
export const OPPONENT_COUNT = 3;

// Multiplies maxSpeed/accel per opponent so finishes spread out: the podium
// (needed for main-line unlocks) means beating the slowest bot, while an
// outright win (bonus branches) means out-driving one that never errs.
const SKILLS = [0.85, 0.93, 1.01];

/** Grid slots in world px: (back, side) offsets from the start line. The
 * player takes the last slot — front rows are the bots you have to hunt. */
const GRID = [
  { back: 16, side: -11 },
  { back: 16, side: 11 },
  { back: 34, side: -11 },
  { back: 34, side: 11 }, // player
];

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
  const slot = GRID[index] ?? GRID[GRID.length - 1]!;
  const dir = { x: Math.cos(track.startHeading), y: Math.sin(track.startHeading) };
  return {
    x: track.start.x - dir.x * slot.back - dir.y * slot.side,
    y: track.start.y - dir.y * slot.back + dir.x * slot.side,
  };
}

export function playerGridSlot(track: Track): { x: number; y: number } {
  return gridSlot(track, RACER_COUNT - 1);
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
  rng: () => number = Math.random
): Opponent[] {
  const pool = VEHICLES.filter((v) => v.id !== playerVehicleId);
  shuffle(pool, rng);
  const skills = shuffle([...SKILLS], rng);

  return pool.slice(0, OPPONENT_COUNT).map((vehicle, i) => {
    const skill = skills[i]!;
    const tuning = applySpeedClass({ ...baseTuning, ...vehicle.values }, cls);
    tuning.maxSpeed *= skill;
    tuning.accel *= skill;
    const pos = gridSlot(track, i);
    const startProgress = query.progressAt(pos.x, pos.y) ?? 0;
    return {
      vehicleId: vehicle.id,
      car: createCarState(pos.x, pos.y, track.startHeading),
      tracker: createLapTracker(startProgress),
      tuning,
      bot: createBot(track, query, tuning),
      finishOrder: null,
    };
  });
}

/** One physics step for every bot (throttle only once the race is `live`). */
export function stepOpponents(
  opponents: Opponent[],
  query: TrackQuery,
  dt: number,
  live: boolean
): void {
  let finished = opponents.filter((o) => o.finishOrder !== null).length;
  for (const o of opponents) {
    const input = live ? o.bot(o.car) : { steer: 0, throttle: 0, brake: 0 };
    o.car = stepCar(o.car, input, o.tuning, query.surfaceAt(o.car.x, o.car.y), dt);
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
