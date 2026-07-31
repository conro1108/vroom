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
  driftTurnBonus: number; // extra turn rate (fraction) while sliding — a drift rotates tighter than grip can
  driftChargeSeconds: number; // continuous sliding needed to bank a drift boost
  driftBoostSeconds: number; // how long the kick lasts when a banked drift cashes out
  voidMarginPx: number; // how far past the road edge you can hang over the void before you fall off
  offroadMaxSpeed: number; // fraction of maxSpeed on grass
  offroadFriction: number; // drag multiplier on grass
  boostOffroad: number; // 0..1, how much a live boost negates the grass penalty (1 = grass drives like road)
  opponentCount: number; // AI cars in a group race
  rubberBand: number; // 0..0.4, how hard the field converges on the player
  botSloppiness: number; // 0..1, how human (wobbly, mistake-prone) bots drive
  startBoostWindowMs: number; // committing to throttle within this window before green = rocket start
  boostPower: number; // maxSpeed/accel multiplier while a boost is live
  boostSeconds: number; // how long a rocket start's boost lasts
  boostGuide: number; // 0..1 steering assist a full-guide boost applies — eases you onto the racing line so the boost is easier to keep on-track; each item tier scales this (plain turbo half, mega and hyper full)
  boostGuideMaxDeg: number; // heading error (deg) at which the boost assist saturates
  rocketSpeed: number; // straight shot speed, as a multiple of the class top speed (so a shot always outruns the cars)
  missileSpeed: number; // seeker (missile/crown) speed, same units — a touch slower so its curve reads
  draftRangePx: number; // how close behind a car the slipstream reaches
  draftChargeSeconds: number; // continuous drafting needed to earn a boost
  draftBoostSeconds: number; // how long a slipstream boost lasts
  fenceMarginPx: number; // grass runoff between road edge and the fence (where there is one)
  rescueMarginPx: number; // extra grass past the fence line you may roam on unfenced stretches before a marshal collects you
  rescueTowSeconds: number; // how long the marshals take to drag you back to the road — the price of the excursion
  cameraLerp: number; // 1/s camera chase
  lookAhead: number; // seconds of velocity the camera leads by
  desktopZoomWorldHeight: number; // wide-screen zoom: world-px kept visible vertically so you still see ahead (phones stay width-driven)
  steerMode: "joystick" | "dragx"; // joystick: thumb vector = screen direction to drive
  fixedStick: boolean; // joystick anchored bottom-right instead of at touch-down
  joystickDeadzonePx: number; // css px of drag before steering engages
  joystickLockDeg: number; // heading error (degrees) at which steer saturates
  steerRangePx: number; // dragx mode: css px of thumb-drag for full lock
  holdToGo: boolean; // touch: throttle only while a finger is down
  soundVolume: number; // 0..1 master audio level, 0 = muted
  vroomSeconds: number; // how drawn-out the doppler vroom past a trackside listener is
}

// The handling block below is Classic's, verbatim (vehicles.ts) — a fresh
// install boots into the house car and the menu shows it as active.
export const DEFAULT_TUNING: Tuning = {
  maxSpeed: 142,
  accel: 195,
  brake: 320,
  drag: 55,
  turnRate: 3.7,
  speedTurnFalloff: 0.12,
  steerResponse: 13.5,
  lateralGrip: 6.5,
  driftGrip: 2.6,
  driftThreshold: 46,
  driftTurnBonus: 0.15,
  driftChargeSeconds: 0.8,
  driftBoostSeconds: 0.6,
  voidMarginPx: 18,
  offroadMaxSpeed: 0.55,
  offroadFriction: 1.6,
  boostOffroad: 0.8,
  opponentCount: 3,
  rubberBand: 0.12,
  botSloppiness: 0.6,
  startBoostWindowMs: 350,
  boostPower: 1.35,
  boostSeconds: 1.2,
  boostGuide: 0.5,
  boostGuideMaxDeg: 40,
  rocketSpeed: 2.1,
  missileSpeed: 1.9,
  draftRangePx: 55,
  draftChargeSeconds: 1.0,
  draftBoostSeconds: 0.8,
  fenceMarginPx: 56,
  rescueMarginPx: 150,
  rescueTowSeconds: 1.1,
  cameraLerp: 5,
  lookAhead: 0.35,
  desktopZoomWorldHeight: 190,
  steerMode: "joystick",
  fixedStick: true,
  joystickDeadzonePx: 10,
  joystickLockDeg: 35,
  steerRangePx: 70,
  holdToGo: true,
  soundVolume: 0.7,
  vroomSeconds: 1.1,
};

// Bump the suffix when DEFAULT_TUNING changes meaningfully. Rather than discard
// the whole saved object on a bump (which would wipe every value the player
// tuned on-device), we migrate the previous version forward and only reset the
// specific keys whose default actually moved — see MIGRATIONS below.
const STORAGE_KEY = "vroom.tuning.v6";

// v4 → v5 retuned the whole field tighter, so every handling default moved. A
// v4 save is holding the old loose numbers for a car that no longer exists.
const V5_HANDLING: (keyof Tuning)[] = [
  "maxSpeed",
  "accel",
  "brake",
  "turnRate",
  "speedTurnFalloff",
  "steerResponse",
  "lateralGrip",
  "driftGrip",
  "driftThreshold",
];

// Older keys, newest-first, tried in order when the current key is empty. Each
// entry lists every key whose default has moved between that version and the
// current one — cumulative, not per-step, since only the matched entry's list
// is applied.
const MIGRATIONS: { key: string; resetKeys: (keyof Tuning)[] }[] = [
  // v5 → v6 widened the corridor to go with the wider roads and the new
  // out-of-bounds rescue; an old narrow runoff would fence you in again.
  { key: "vroom.tuning.v5", resetKeys: ["fenceMarginPx"] },
  { key: "vroom.tuning.v4", resetKeys: [...V5_HANDLING, "fenceMarginPx"] },
  { key: "vroom.tuning.v3", resetKeys: [...V5_HANDLING, "fenceMarginPx"] },
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
//
// `tier` scales the boost's *excess* over 1×, so the ordinary kick (a rocket
// start, a drift, a slipstream) is tier 1 and the upper item-boost tiers hit
// proportionally harder without anyone having to restate boostPower.
export function boostTuning(t: Tuning, tier = 1): Tuning {
  const power = 1 + (t.boostPower - 1) * tier;
  return {
    ...t,
    maxSpeed: t.maxSpeed * power,
    accel: t.accel * power,
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
