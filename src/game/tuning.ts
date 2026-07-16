// Every lever that shapes how the game feels lives here. The dev panel edits
// this object live and persists it; nothing else should hardcode a feel value.

export interface Tuning {
  maxSpeed: number; // world px/s
  accel: number; // px/s^2
  brake: number; // px/s^2
  drag: number; // coast deceleration, px/s^2
  turnRate: number; // rad/s at speed
  speedTurnFalloff: number; // 0..1, how much turning loosens at top speed
  steerResponse: number; // 1/s, how fast actual steer chases input
  lateralGrip: number; // 1/s exponential decay of sideways velocity
  driftGrip: number; // grip once sliding past driftThreshold
  driftThreshold: number; // px/s of sideways velocity where drift begins
  offroadMaxSpeed: number; // fraction of maxSpeed on grass
  offroadFriction: number; // drag multiplier on grass
  cameraLerp: number; // 1/s camera chase
  lookAhead: number; // seconds of velocity the camera leads by
  steerRangePx: number; // css px of thumb-drag for full lock
  holdToGo: boolean; // touch: throttle only while a finger is down
}

export const DEFAULT_TUNING: Tuning = {
  maxSpeed: 150,
  accel: 180,
  brake: 300,
  drag: 55,
  turnRate: 2.9,
  speedTurnFalloff: 0.25,
  steerResponse: 9,
  lateralGrip: 6,
  driftGrip: 2.4,
  driftThreshold: 45,
  offroadMaxSpeed: 0.45,
  offroadFriction: 3,
  cameraLerp: 5,
  lookAhead: 0.35,
  steerRangePx: 70,
  holdToGo: true,
};

const STORAGE_KEY = "vroom.tuning";

export function loadTuning(): Tuning {
  const tuning = { ...DEFAULT_TUNING };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Tuning>;
      for (const key of Object.keys(tuning) as (keyof Tuning)[]) {
        if (typeof saved[key] === typeof tuning[key]) {
          (tuning as Record<string, unknown>)[key] = saved[key];
        }
      }
    }
  } catch {
    // corrupt or unavailable storage: fall back to defaults
  }
  return tuning;
}

export function saveTuning(tuning: Tuning): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    // storage unavailable (private mode etc.) — tuning just won't persist
  }
}
