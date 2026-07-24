// AI opponents for competitive races: each one is a bot driver in a vehicle
// the player didn't pick, with a small skill spread so the field strings out.
// Pure logic — main.ts steps them alongside the player and the scene draws
// them by vehicle id.
import { createBot, type BotPersonality } from "./botdriver";
import type { RosterEntry } from "./cups";
import { createDraft, inSlipstream, stepDraft, type DraftState } from "./draft";
import { SPIN_INPUT, spinCar, type ItemRacer } from "./items";
import { createCarState, stepCar, type CarInput, type CarState } from "./physics";
import { applySpeedClass, RACE_LAPS, type SpeedClass } from "./progression";
import {
  createLapTracker,
  fenceCar,
  updateLap,
  type LapTracker,
  type Track,
  type TrackQuery,
} from "./track";
import { boostTuning, type Tuning } from "./tuning";
import { vehicleById, VEHICLES } from "./vehicles";

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

// Grid layout in world px behind the start line: cars fill a row of `columns`
// slots, then step back a row. A wider squad gets a wider grid so it doesn't
// string out into an absurdly long single-file queue behind the line.
const GRID_FIRST_ROW = 18;
const GRID_ROW_GAP = 22;
const GRID_LANE_FRAC = 0.3; // outermost column sits at this fraction of the road out from center

/** How many columns the grid uses for a field this size: 2 for a small pack,
 * up to 3 once the squad gets big. Never 4 — on the narrower tracks a 4-wide
 * row packs columns closer than the car-separation minDist, so cars spawn
 * overlapping and the separation impulse spits the pack off the road. At 3
 * columns the lateral spacing (GRID_LANE_FRAC * roadWidth) stays clear of it. */
export function gridColumns(fieldSize: number): number {
  return Math.max(2, Math.min(3, Math.ceil(fieldSize / 4)));
}

/** Opponents satisfy ItemRacer, so the item system treats bots and the
 * player uniformly — `position`/`held`/`spin`/`boost`/`finished` are the
 * ItemRacer fields, kept current by main.ts and game/items.ts. */
export interface Opponent extends ItemRacer {
  vehicleId: string;
  car: CarState;
  tracker: LapTracker;
  tuning: Tuning;
  bot: (car: CarState) => CarInput;
  draft: DraftState;
  /** Seconds of speed boost remaining (earned from slipstreaming). */
  boostTimer: number;
  /** Seconds until this bot uses the item it's holding. */
  itemUseDelay: number;
  /** 1-based order in which this bot finished the race, or null if racing. */
  finishOrder: number | null;
}

export function gridSlot(track: Track, index: number, columns = 2): { x: number; y: number } {
  const col = index % columns;
  const back = GRID_FIRST_ROW + Math.floor(index / columns) * GRID_ROW_GAP;
  // spread columns evenly across the road, centered on the line
  const spread = track.roadWidth * GRID_LANE_FRAC;
  const side = columns <= 1 ? 0 : (col / (columns - 1) - 0.5) * 2 * spread;
  const dir = { x: Math.cos(track.startHeading), y: Math.sin(track.startHeading) };
  return {
    x: track.start.x - dir.x * back - dir.y * side,
    y: track.start.y - dir.y * back + dir.x * side,
  };
}

export function playerGridSlot(
  track: Track,
  opponentCount = OPPONENT_COUNT,
  columns = 2
): { x: number; y: number } {
  return gridSlot(track, opponentCount, columns);
}

/**
 * Draw a bot lineup: distinct vehicles the player isn't driving, with
 * shuffled skill factors. A roster persists across a cup series so the same
 * rivals accumulate points race after race.
 */
export function buildRoster(
  playerVehicleId: string,
  count = OPPONENT_COUNT,
  rng: () => number = Math.random
): RosterEntry[] {
  const pool = VEHICLES.filter((v) => v.id !== playerVehicleId);
  shuffle(pool, rng);
  const skills = shuffle(skillSpread(count), rng);
  return skills.map((skill, i) => ({ vehicleId: pool[i % pool.length]!.id, skill }));
}

/** Put a roster on the grid: fresh cars and trackers, same seats. */
export function createOpponents(
  track: Track,
  query: TrackQuery,
  roster: RosterEntry[],
  baseTuning: Tuning,
  cls: SpeedClass,
  rng: () => number = Math.random,
  gridIndices?: number[], // grid slot (0 = pole) per opponent; defaults to roster order
  columns = 2
): Opponent[] {
  return roster.map(({ vehicleId, skill }, i) => {
    const vehicle = vehicleById(vehicleId);
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
    const pos = gridSlot(track, gridIndices?.[i] ?? i, columns);
    const startProgress = query.progressAt(pos.x, pos.y) ?? 0;
    return {
      vehicleId: vehicle.id,
      car: createCarState(pos.x, pos.y, track.startHeading),
      tracker: createLapTracker(startProgress),
      tuning,
      bot: createBot(track, query, tuning, personality),
      draft: createDraft(),
      boostTimer: 0,
      itemUseDelay: 0,
      position: i + 1,
      deficit: 0,
      held: null,
      spin: 0,
      spinFrom: 0,
      boost: 0,
      finished: false,
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

/** What the bots know about the player mid-race, for rubber-banding and drafting. */
export interface PlayerContext {
  distance: number; // laps covered
  car: CarState;
}

/** One physics step for every bot (throttle only once the race is `live`).
 * With `player` context, the field rubber-bands toward the player and bots
 * earn slipstream boosts off every car, the player's included. */
export function stepOpponents(
  opponents: Opponent[],
  query: TrackQuery,
  dt: number,
  live: boolean,
  player: PlayerContext | null = null,
  corridorPx: number | null = null
): void {
  let finished = opponents.filter((o) => o.finishOrder !== null).length;
  for (const o of opponents) {
    const spinning = o.spin > 0;
    const input = !live ? { steer: 0, throttle: 0, brake: 0 } : spinning ? SPIN_INPUT : o.bot(o.car);
    if (spinning) spinCar(o.car, dt);
    let mult = 1;
    let boosting = false;
    if (live && player !== null && o.tuning.rubberBand > 0 && o.finishOrder === null) {
      mult = rubberMult(raceDistance(o.tracker) - player.distance, o.tuning.rubberBand);
    }
    if (live) {
      const minSpeed = o.tuning.maxSpeed * 0.5;
      const drafting =
        (player !== null && inSlipstream(o.car, player.car, o.tuning.draftRangePx, minSpeed)) ||
        opponents.some(
          (other) => other !== o && inSlipstream(o.car, other.car, o.tuning.draftRangePx, minSpeed)
        );
      if (stepDraft(o.draft, drafting, dt, o.tuning.draftChargeSeconds)) {
        o.boostTimer = o.tuning.draftBoostSeconds;
      }
      if (o.boostTimer > 0) o.boostTimer = Math.max(0, o.boostTimer - dt);
      // o.boost is the item turbo, ticked down by the item system
      if (o.boostTimer > 0 || o.boost > 0) boosting = true;
    }
    let tuning =
      mult === 1
        ? o.tuning
        : { ...o.tuning, maxSpeed: o.tuning.maxSpeed * mult, accel: o.tuning.accel * mult };
    if (boosting) tuning = boostTuning(tuning);
    o.car = stepCar(o.car, input, tuning, query.surfaceAt(o.car.x, o.car.y), dt);
    if (corridorPx !== null) fenceCar(o.car, query, corridorPx);
    const p = query.progressAt(o.car.x, o.car.y);
    if (p !== null && updateLap(o.tracker, p).completed) {
      if (o.tracker.lap > RACE_LAPS && o.finishOrder === null) {
        o.finishOrder = ++finished;
        o.finished = true;
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
