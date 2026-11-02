// One car, one fixed physics step. Arcade by design: heading and velocity are
// separate, sideways velocity bleeds off at `grip`, and the slide you see is just
// that gap. A drift locks a direction, drops grip, and lets the thumb choose how
// tight the arc runs; held long enough it charges a mini-turbo in three tiers.
import { lateral, locate, roadY, SURFACE_GRIP, type Course } from "./course";
import type { Tuning } from "./tuning";

export interface Input {
  steer: number; // -1..1, + = right
  throttle: number; // 0..1
  brake: number; // 0..1
  drift: boolean;
}

export type CarEvent =
  | { type: "wall"; hit: number }
  | { type: "land"; drop: number }
  | { type: "tier"; tier: number }
  | { type: "boost"; tier: number }
  | { type: "drift" }
  | { type: "fall" }
  | { type: "respawn" };

export interface Car {
  x: number; y: number; z: number;
  vx: number; vz: number; vy: number;
  h: number; // heading
  steer: number;
  i: number; // ribbon sample
  d: number; // lateral offset
  onRoad: boolean;
  grounded: boolean;
  air: number; // seconds airborne
  driftDir: number; // 0, ±1
  driftT: number;
  tier: number;
  boostT: number;
  fallT: number; // >0 = falling or being recovered
  safeI: number; // last solid sample
  padCooldown: number;
  events: CarEvent[];
}

export function createCar(c: Course, i: number, d: number): Car {
  const car: Car = {
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, h: 0, steer: 0, i, d: 0, onRoad: true, grounded: true, air: 0,
    driftDir: 0, driftT: 0, tier: 0, boostT: 0, fallT: 0, safeI: i, padCooldown: 0, events: [],
  };
  placeCar(car, c, i, d);
  return car;
}

export function placeCar(car: Car, c: Course, i: number, d: number) {
  const h = c.h[i]!;
  car.i = i;
  car.d = d;
  car.h = h;
  car.x = c.x[i]! - Math.sin(h) * d;
  car.z = c.z[i]! + Math.cos(h) * d;
  car.y = roadY(c, i, d);
  car.vx = car.vz = car.vy = 0;
  car.driftDir = 0;
  car.driftT = 0;
  car.tier = 0;
  car.grounded = true;
}

export const speedOf = (car: Car) => Math.hypot(car.vx, car.vz);

export function stepCar(car: Car, inp: Input, c: Course, T: Tuning, scale: number, dt: number) {
  if (car.fallT > 0) return stepRecovery(car, c, T, dt);

  car.boostT = Math.max(0, car.boostT - dt);
  car.padCooldown = Math.max(0, car.padCooldown - dt);
  car.steer += (inp.steer - car.steer) * Math.min(1, T.steerResponse * dt);

  let f = [Math.cos(car.h), Math.sin(car.h)] as const;
  let vf = car.vx * f[0] + car.vz * f[1];
  const speed = speedOf(car);

  // ---- drift ----
  if (car.driftDir === 0) {
    if (inp.drift && car.grounded && Math.abs(car.steer) > 0.15 && speed > T.driftMinSpeed) {
      car.driftDir = Math.sign(car.steer);
      car.driftT = 0;
      car.tier = 0;
      car.vy = T.hop;
      car.grounded = false;
      car.events.push({ type: "drift" });
    }
  } else if (!inp.drift || speed < T.driftMinSpeed * 0.7) {
    if (car.tier > 0 && inp.throttle > 0 && speed >= T.driftMinSpeed * 0.7) {
      car.boostT = Math.max(car.boostT, [0, T.boost1, T.boost2, T.boost3][car.tier]!);
      car.events.push({ type: "boost", tier: car.tier });
    }
    car.driftDir = 0;
    car.driftT = 0;
    car.tier = 0;
  } else {
    if (car.onRoad) car.driftT += dt;
    const tier = car.driftT >= T.tier3 ? 3 : car.driftT >= T.tier2 ? 2 : car.driftT >= T.tier1 ? 1 : 0;
    if (tier > car.tier) {
      car.tier = tier;
      car.events.push({ type: "tier", tier });
    }
  }

  // ---- yaw ----
  const sp = Math.abs(vf);
  const surf = car.onRoad ? SURFACE_GRIP[c.surface[car.i]!] : 1;
  const gripYaw = Math.min(T.maxYaw, (T.gripLat * surf) / Math.max(sp, 1));
  let yaw: number;
  if (car.driftDir !== 0) {
    const into = (car.steer * car.driftDir + 1) / 2;
    yaw = car.driftDir * gripYaw * (T.driftWide + (T.driftTight - T.driftWide) * into);
  } else {
    yaw = car.steer * gripYaw;
  }
  const authority = (car.grounded ? 1 : 0.55) * Math.min(1, sp / 5);
  car.h += yaw * authority * Math.sign(vf || 1) * dt;
  f = [Math.cos(car.h), Math.sin(car.h)];
  const r = [-f[1], f[0]] as const;
  vf = car.vx * f[0] + car.vz * f[1];
  let vl = car.vx * r[0] + car.vz * r[1];

  // ---- along the road ----
  const boosting = car.boostT > 0;
  const off = !car.onRoad && !boosting;
  const top = T.top * scale * (boosting ? T.boostTop : 1) * (off ? T.offTop : 1);
  if (car.grounded) {
    const accel = T.accel * scale * (boosting ? T.boostAccel : 1);
    if (inp.brake > 0) {
      vf -= (vf > 0 ? T.brake * scale * inp.brake : (accel / 2) * inp.brake) * dt;
    } else if (inp.throttle > 0 && vf < top) {
      vf += accel * inp.throttle * (1 - Math.max(0, vf / top) ** 1.7) * dt;
    } else if (inp.throttle === 0) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), T.drag * dt);
    }
    if (vf > top) vf -= Math.min(vf - top, (off ? T.offDrag * 3 : T.offDrag) * dt);
    if (off) vf -= T.offDrag * 0.15 * Math.sign(vf) * dt;
    // hills: climbing costs a little, descending pays
    const j = (car.i + 3) % c.n;
    const grade = (c.y[j]! - c.y[car.i]!) / (3 * c.ds);
    vf -= T.gravity * T.slope * grade * dt;
  }

  // ---- sideways: where the slide lives ----
  if (car.grounded) {
    const before = Math.hypot(vf, vl);
    vl *= Math.exp(-(car.driftDir !== 0 ? T.driftGrip : T.grip) * surf * dt);
    const after = Math.hypot(vf, vl);
    const target = before - (before - after) * (1 - T.driftCarry);
    if (vf > 0 && target > Math.abs(vl)) vf = Math.sqrt(target * target - vl * vl);
  }
  car.vx = f[0] * vf + r[0] * vl;
  car.vz = f[1] * vf + r[1] * vl;

  // ---- move ----
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.i = locate(c, car.x, car.z, car.i);
  car.d = lateral(c, car.x, car.z, car.i);
  walls(car, c, T);

  // ---- height ----
  const ground = c.gap[car.i] ? -Infinity : groundAt(car, c);
  car.vy -= T.gravity * dt;
  car.y += car.vy * dt;
  const clear = car.y - ground;
  if (car.grounded && clear < T.stick * 4 && clear > -2) {
    // hold the road through dips; crests that fall away faster than gravity lift off
    const follow = (ground - car.y) / dt;
    car.vy = Math.max(car.vy, follow);
    car.y = ground;
    car.vy = Math.min(car.vy, 12);
  } else if (clear <= 0 && clear > -3) {
    if (!car.grounded) car.events.push({ type: "land", drop: -car.vy });
    car.y = ground;
    car.vy = Math.max(0, car.vy * 0);
    car.grounded = true;
    car.air = 0;
  } else {
    car.grounded = false;
    car.air += dt;
  }

  car.onRoad = Math.abs(car.d) <= c.half[car.i]! + 0.4 && !c.gap[car.i];
  if (car.grounded && car.onRoad) car.safeI = car.i;

  features(car, c, T);

  const lostIt = ground !== -Infinity ? car.y < ground - 3 : car.y < c.y[car.safeI]! - 5;
  if (lostIt || car.y < c.y[car.i]! - 7) {
    car.fallT = T.fallSeconds + T.respawnSeconds;
    car.events.push({ type: "fall" });
  }
}

/** Road height under the car, blended between the two nearest samples: snapping to
 *  one sample made steep drops a staircase the car fell off. */
function groundAt(car: Car, c: Course): number {
  const i = car.i;
  const along = (car.x - c.x[i]!) * Math.cos(c.h[i]!) + (car.z - c.z[i]!) * Math.sin(c.h[i]!);
  const j = (i + (along >= 0 ? 1 : -1) + c.n) % c.n;
  if (c.gap[j]) return roadY(c, i, car.d);
  const t = Math.min(1, Math.abs(along) / c.ds);
  return roadY(c, i, car.d) * (1 - t) + roadY(c, j, car.d) * t;
}

function walls(car: Car, c: Course, T: Tuning) {
  const i = car.i;
  const side = car.d >= 0 ? 1 : -1;
  const lim = side > 0 ? c.limR[i]! : c.limL[i]!;
  const isVoid = (side > 0 ? c.voidR[i]! : c.voidL[i]!) === 1;
  if (Math.abs(car.d) <= lim) return;
  if (isVoid) {
    if (car.grounded) {
      car.grounded = false;
      car.vy = Math.min(car.vy, 0);
    }
    return;
  }
  const nx = -Math.sin(c.h[i]!) * side;
  const nz = Math.cos(c.h[i]!) * side;
  const over = Math.abs(car.d) - lim;
  car.x -= nx * over;
  car.z -= nz * over;
  car.d = side * lim;
  const out = car.vx * nx + car.vz * nz;
  if (out > 0) {
    const speed = speedOf(car) || 1;
    const hit = out / speed;
    car.vx -= nx * out * (1 + T.wallBounce);
    car.vz -= nz * out * (1 + T.wallBounce);
    const keep = 1 - T.wallScrub * hit;
    car.vx *= keep;
    car.vz *= keep;
    // nose comes round to the wall so a glancing touch slides instead of grinding
    let e = c.h[i]! - car.h;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    car.h += e * 0.12;
    if (hit > 0.12) car.events.push({ type: "wall", hit: Math.min(1, hit * 1.4) });
  }
}

function median(car: Car, c: Course, T: Tuning) {
  const half = c.isleHalf[car.i]!;
  if (half <= 0 || !car.grounded) return;
  const rel = car.d - c.isleD[car.i]!;
  if (Math.abs(rel) >= half + 0.9) return;
  const side = rel >= 0 ? 1 : -1;
  const a = c.h[car.i]!;
  const [nx, nz] = [-Math.sin(a) * side, Math.cos(a) * side];
  const push = half + 0.9 - Math.abs(rel);
  car.x += nx * push;
  car.z += nz * push;
  car.d += side * push;
  const into = -(car.vx * nx + car.vz * nz);
  if (into > 0) {
    car.vx += nx * into * (1 + T.wallBounce);
    car.vz += nz * into * (1 + T.wallBounce);
    const hit = into / (speedOf(car) || 1);
    car.vx *= 1 - T.wallScrub * hit;
    car.vz *= 1 - T.wallScrub * hit;
    if (hit > 0.12) car.events.push({ type: "wall", hit: Math.min(1, hit * 1.4) });
  }
}

function features(car: Car, c: Course, T: Tuning) {
  median(car, c, T);
  const list = c.featureAt.get(car.i);
  if (!list || !car.grounded) return;
  for (const idx of list) {
    const f = c.features[idx]!;
    if (Math.abs(car.d - f.d) > (f.kind === "rock" ? 2 : 2.6)) continue;
    if (car.padCooldown > 0) continue;
    if (f.kind === "rock") {
      // one knock per rock: slowing every step it overlapped pinned cars to it
      car.padCooldown = 0.5;
      car.vx *= 0.6;
      car.vz *= 0.6;
      const side = car.d >= f.d ? 1 : -1;
      const a = c.h[car.i]!;
      car.x -= Math.sin(a) * side * 1.2;
      car.z += Math.cos(a) * side * 1.2;
      car.events.push({ type: "wall", hit: 0.6 });
      continue;
    }
    car.padCooldown = 0.5;
    if (f.kind === "boost") {
      car.boostT = Math.max(car.boostT, T.boostPad);
      car.events.push({ type: "boost", tier: 4 });
    } else {
      car.vy = 11;
      car.grounded = false;
      car.boostT = Math.max(car.boostT, 0.5);
      car.events.push({ type: "boost", tier: 4 });
    }
  }
}

function stepRecovery(car: Car, c: Course, T: Tuning, dt: number) {
  car.fallT -= dt;
  if (car.fallT > T.respawnSeconds) {
    car.vy -= T.gravity * dt;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.z += car.vz * dt;
    return;
  }
  if (car.fallT + dt > T.respawnSeconds) {
    // A missed jump puts you down past the gap: standing before the lip again
    // would just drop you back in, forever. Anything else, a little behind the drop.
    let i = (car.safeI - 6 + c.n) % c.n;
    for (let k = 0; k < 40; k++) {
      const j = (car.safeI + k) % c.n;
      if (!c.gap[j]) continue;
      i = j;
      while (c.gap[i]) i = (i + 1) % c.n;
      i = (i + 4) % c.n;
      break;
    }
    for (let g = 0; g < 80 && c.gap[i]; g++) i = (i - 1 + c.n) % c.n;
    placeCar(car, c, i, 0);
    car.boostT = 0;
    car.events.push({ type: "respawn" });
  }
  if (car.fallT <= 0) car.fallT = 0;
}
