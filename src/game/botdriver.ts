// A deterministic pure-pursuit lap driver over the real physics. It stands in
// for a mid-skill player: chase a point ahead on the centerline, lift/brake
// when pointed badly wrong. Used by balance tests to keep every vehicle
// competitive, and reusable for calibration/tuning experiments.
import { createCarState, stepCar, type CarState } from "./physics";
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

/** Point on the centerline `aheadPx` of arc length past progress fraction `p`. */
function pointAhead(track: Track, totalLen: number, p: number, aheadPx: number) {
  const f = (p + aheadPx / totalLen) % 1;
  // progress[] is sorted ascending; find the sample at fraction f
  let lo = 0;
  let hi = track.progress.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track.progress[mid]! <= f) lo = mid;
    else hi = mid - 1;
  }
  return track.samples[lo]!;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Drive `laps` full laps from a standing start; the first lap is a warmup so
 * the reported time reflects a flying lap (like a player's later laps).
 */
export function simulateLap(def: TrackDef, tuning: Tuning, laps = 2): LapResult {
  const track = createTrack(def);
  const query = createTrackQuery(track);
  let totalLen = 0;
  for (let i = 0; i < track.samples.length; i++) {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % track.samples.length]!;
    totalLen += Math.hypot(b.x - a.x, b.y - a.y);
  }

  let car = createCarState(track.start.x, track.start.y, track.startHeading);
  const lapTracker = createLapTracker(0);
  let t = 0;
  let lapStart = 0;
  let lapsDone = 0;
  let steps = 0;
  let offroadSteps = 0;

  while (t < MAX_LAP_SECONDS * laps) {
    const input = botInput(car, track, query, tuning, totalLen);
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

function botInput(car: CarState, track: Track, query: TrackQuery, tuning: Tuning, totalLen: number) {
  const p = query.progressAt(car.x, car.y) ?? 0;
  const speed = Math.hypot(car.vx, car.vy);

  // Look further ahead the faster we go, so corners are anticipated.
  const near = pointAhead(track, totalLen, p, Math.max(30, speed * 0.35));
  const far = pointAhead(track, totalLen, p, Math.max(70, speed * 0.85));

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
