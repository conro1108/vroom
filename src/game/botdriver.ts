// A deterministic pure-pursuit lap driver over the real physics. It stands in
// for a mid-skill player: chase a point ahead on the centerline, lift/brake
// when pointed badly wrong. Balance tests use it to keep every vehicle
// competitive, and live races use it as the opponent AI.
import { createCarState, stepCar, type CarInput, type CarState } from "./physics";
import {
  createLapTracker,
  createTrack,
  createTrackQuery,
  updateLap,
  type Track,
  type TrackDef,
  type TrackQuery,
} from "./track";
import type { Tuning } from "./tuning";

export interface LapResult {
  /** Simulated lap time in ms, or null if the bot never completed the lap. */
  lapMs: number | null;
  /** Fraction of physics steps spent off the road. */
  offroadFrac: number;
}

const DT = 1 / 120; // match the game's fixed step
const MAX_LAP_SECONDS = 120;

/** What separates one bot from another: none of this exists for the clean
 * reference driver that balance tests use — a personality only makes a bot
 * slower and messier, never faster. */
export interface BotPersonality {
  /** Lateral bias off the centerline in world px, so bots take different lines. */
  line: number;
  /** Steering noise amplitude, as a fraction of full lock. */
  wobble: number;
  /** Driving mistakes per minute: a blown braking point that runs the corner wide. */
  mistakeRate: number;
  /** Phase seed so bots don't wobble or err in unison. */
  seed: number;
}

export const CLEAN_DRIVER: BotPersonality = { line: 0, wobble: 0, mistakeRate: 0, seed: 0 };

const MISTAKE_SECONDS = 0.7;

/** Point `aheadPx` of arc length past progress `p`, shifted `lateral` px off the centerline. */
function pointAhead(track: Track, totalLen: number, p: number, aheadPx: number, lateral: number) {
  const f = (p + aheadPx / totalLen) % 1;
  // progress[] is sorted ascending; find the sample at fraction f
  let lo = 0;
  let hi = track.progress.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track.progress[mid]! <= f) lo = mid;
    else hi = mid - 1;
  }
  const a = track.samples[lo]!;
  if (!lateral) return a;
  const b = track.samples[(lo + 1) % track.samples.length]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x - ((b.y - a.y) / len) * lateral, y: a.y + ((b.x - a.x) / len) * lateral };
}

/** Deterministic pseudo-random in [0,1) — keeps bot mistakes replayable in tests. */
function hash01(x: number): number {
  const s = Math.sin(x * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * A steering brain bound to one track + tuning: call it with the current car
 * state each physics step to get that step's inputs.
 */
export function createBot(
  track: Track,
  query: TrackQuery,
  tuning: Tuning,
  personality: BotPersonality = CLEAN_DRIVER
): (car: CarState) => CarInput {
  let totalLen = 0;
  for (let i = 0; i < track.samples.length; i++) {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % track.samples.length]!;
    totalLen += Math.hypot(b.x - a.x, b.y - a.y);
  }

  // Each call is one fixed physics step, so internal time advances by DT.
  let t = 0;
  let lastSec = -1;
  let mistakeUntil = 0;
  let mistakeBias = 0;

  return (car) => {
    t += DT;
    if (personality.mistakeRate > 0) {
      const sec = Math.floor(t);
      if (sec !== lastSec) {
        lastSec = sec;
        if (hash01(personality.seed + sec * 7.13) < personality.mistakeRate / 60) {
          mistakeUntil = t + MISTAKE_SECONDS;
          mistakeBias = (hash01(personality.seed + sec * 3.77) - 0.5) * 1.6;
        }
      }
    }

    const input = botInput(car, track, query, tuning, totalLen, personality.line);
    if (personality.wobble > 0) {
      input.steer +=
        personality.wobble *
        0.6 *
        Math.sin(t * 2.3 + personality.seed) *
        Math.sin(t * 0.91 + personality.seed * 1.7);
    }
    if (t < mistakeUntil) {
      // blew the braking point: foot stays down and the corner runs wide
      input.steer += mistakeBias;
      input.throttle = 1;
      input.brake = 0;
    }
    input.steer = Math.max(-1, Math.min(1, input.steer));
    return input;
  };
}

/**
 * Drive `laps` full laps from a standing start; the first lap is a warmup so
 * the reported time reflects a flying lap (like a player's later laps).
 */
export function simulateLap(def: TrackDef, tuning: Tuning, laps = 2): LapResult {
  const track = createTrack(def);
  const query = createTrackQuery(track);
  const bot = createBot(track, query, tuning);

  let car = createCarState(track.start.x, track.start.y, track.startHeading);
  const lapTracker = createLapTracker(0);
  let t = 0;
  let lapStart = 0;
  let lapsDone = 0;
  let steps = 0;
  let offroadSteps = 0;

  while (t < MAX_LAP_SECONDS * laps) {
    const input = bot(car);
    const surface = query.surfaceAt(car.x, car.y);
    car = stepCar(car, input, tuning, surface, DT);
    t += DT;
    steps++;
    if (surface === "offroad") offroadSteps++;

    const p = query.progressAt(car.x, car.y);
    if (p !== null && updateLap(lapTracker, p).completed) {
      lapsDone++;
      if (lapsDone >= laps) {
        return { lapMs: (t - lapStart) * 1000, offroadFrac: offroadSteps / steps };
      }
      lapStart = t;
    }
  }
  return { lapMs: null, offroadFrac: offroadSteps / steps };
}

function botInput(
  car: CarState,
  track: Track,
  query: TrackQuery,
  tuning: Tuning,
  totalLen: number,
  line = 0
) {
  const p = query.progressAt(car.x, car.y) ?? 0;
  const speed = Math.hypot(car.vx, car.vy);

  // Look further ahead the faster we go, so corners are anticipated.
  const near = pointAhead(track, totalLen, p, Math.max(30, speed * 0.35), line);
  const far = pointAhead(track, totalLen, p, Math.max(70, speed * 0.85), line);

  const aimError = normalizeAngle(Math.atan2(near.y - car.y, near.x - car.x) - car.heading);
  const farError = normalizeAngle(Math.atan2(far.y - car.y, far.x - car.x) - car.heading);

  const steer = Math.max(-1, Math.min(1, aimError / 0.45));
  // A sharp bend ahead (or being pointed badly wrong) means lift or brake.
  const trouble = Math.max(Math.abs(aimError), Math.abs(farError) * 0.8);
  let throttle = 1;
  let brake = 0;
  if (trouble > 1.1 && speed > tuning.maxSpeed * 0.45) {
    throttle = 0;
    brake = 1;
  } else if (trouble > 0.6 && speed > tuning.maxSpeed * 0.7) {
    throttle = 0;
  }
  return { steer, throttle, brake };
}
