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
  steerMode: "joystick" | "dragx"; // joystick: thumb vector = screen direction to drive
  fixedStick: boolean; // joystick anchored bottom-right instead of at touch-down
  joystickDeadzonePx: number; // css px of drag before steering engages
  joystickLockDeg: number; // heading error (degrees) at which steer saturates
  steerRangePx: number; // dragx mode: css px of thumb-drag for full lock
  holdToGo: boolean; // touch: throttle only while a finger is down
  showGhost: boolean; // replay your best lap as a translucent car
}

export const DEFAULT_TUNING: Tuning = {
  maxSpeed: 140,
  accel: 180,
  brake: 300,
  drag: 55,
  turnRate: 3.4,
  speedTurnFalloff: 0.15,
  steerResponse: 12,
  lateralGrip: 6,
  driftGrip: 2.4,
  driftThreshold: 55,
  offroadMaxSpeed: 0.55,
  offroadFriction: 1.6,
  cameraLerp: 5,
  lookAhead: 0.35,
  steerMode: "joystick",
  fixedStick: true,
  joystickDeadzonePx: 10,
  joystickLockDeg: 35,
  steerRangePx: 70,
  holdToGo: true,
  showGhost: true,
};

// Bump the suffix when DEFAULT_TUNING changes meaningfully, so stale saved
// tuning doesn't mask the new baseline on devices that played before.
const STORAGE_KEY = "vroom.tuning.v3";

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
