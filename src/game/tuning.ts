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
  boostOffroad: number; // 0..1, how much a live boost negates the grass penalty (1 = grass drives like road)
  opponentCount: number; // AI cars in a group race
  rubberBand: number; // 0..0.4, how hard the field converges on the player
  botSloppiness: number; // 0..1, how human (wobbly, mistake-prone) bots drive
  startBoostWindowMs: number; // committing to throttle within this window before green = rocket start
  boostPower: number; // maxSpeed/accel multiplier while a boost is live
  boostSeconds: number; // how long a rocket start's boost lasts
  draftRangePx: number; // how close behind a car the slipstream reaches
  draftChargeSeconds: number; // continuous drafting needed to earn a boost
  draftBoostSeconds: number; // how long a slipstream boost lasts
  fenceMarginPx: number; // grass runoff between road edge and the fence
  cameraLerp: number; // 1/s camera chase
  lookAhead: number; // seconds of velocity the camera leads by
  steerMode: "joystick" | "dragx"; // joystick: thumb vector = screen direction to drive
  fixedStick: boolean; // joystick anchored bottom-right instead of at touch-down
  joystickDeadzonePx: number; // css px of drag before steering engages
  joystickLockDeg: number; // heading error (degrees) at which steer saturates
  steerRangePx: number; // dragx mode: css px of thumb-drag for full lock
  holdToGo: boolean; // touch: throttle only while a finger is down
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
  boostOffroad: 0.8,
  opponentCount: 3,
  rubberBand: 0.12,
  botSloppiness: 0.6,
  startBoostWindowMs: 350,
  boostPower: 1.35,
  boostSeconds: 1.2,
  draftRangePx: 55,
  draftChargeSeconds: 1.0,
  draftBoostSeconds: 0.8,
  fenceMarginPx: 34,
  cameraLerp: 5,
  lookAhead: 0.35,
  steerMode: "joystick",
  fixedStick: true,
  joystickDeadzonePx: 10,
  joystickLockDeg: 35,
  steerRangePx: 70,
  holdToGo: true,
};

// Bump the suffix when DEFAULT_TUNING changes meaningfully. Rather than discard
// the whole saved object on a bump (which would wipe every value the player
// tuned on-device), we migrate the previous version forward and only reset the
// specific keys whose default actually moved — see MIGRATIONS below.
const STORAGE_KEY = "vroom.tuning.v4";

// Older keys, newest-first, tried in order when the current key is empty. Each
// lists the keys whose default changed in the step up to the *next* version, so
// a migrated save takes the new default there instead of masking it.
const MIGRATIONS: { key: string; resetKeys: (keyof Tuning)[] }[] = [
  { key: "vroom.tuning.v3", resetKeys: ["fenceMarginPx"] },
];

export function loadTuning(): Tuning {
  const tuning = { ...DEFAULT_TUNING };
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let resetKeys: (keyof Tuning)[] = [];
    for (const m of MIGRATIONS) {
      if (raw) break;
      raw = localStorage.getItem(m.key);
      if (raw) resetKeys = m.resetKeys;
    }
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Tuning>;
      for (const key of Object.keys(tuning) as (keyof Tuning)[]) {
        if (resetKeys.includes(key)) continue; // migrated: keep the new default
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

// The tuning a car steps with while a boost is live: faster top speed/accel,
// and — crucially — most of the grass penalty lifted so a boost blows you over
// the grass instead of slamming into it. boostOffroad lerps the offroad levers
// back toward their road values (1 = grass drives exactly like road).
export function boostTuning(t: Tuning): Tuning {
  return {
    ...t,
    maxSpeed: t.maxSpeed * t.boostPower,
    accel: t.accel * t.boostPower,
    offroadMaxSpeed: t.offroadMaxSpeed + (1 - t.offroadMaxSpeed) * t.boostOffroad,
    offroadFriction: t.offroadFriction + (1 - t.offroadFriction) * t.boostOffroad,
  };
}

export function saveTuning(tuning: Tuning): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    // storage unavailable (private mode etc.) — tuning just won't persist
  }
}
