// Arcade drift model: velocity is a free vector; each step it is decomposed
// onto the car's (freshly rotated) forward/side axes. Rotating the heading
// while velocity persists is what creates sideways velocity, and lateralGrip
// bleeds it back off — low grip = drift, high grip = rails.
import type { Tuning } from "./tuning";

export type Surface = "road" | "offroad";

export interface CarState {
  x: number;
  y: number;
  heading: number; // radians, 0 = +x
  vx: number;
  vy: number;
  steer: number; // smoothed steer actually applied, -1..1
  drifting: boolean;
}

export interface CarInput {
  steer: number; // -1..1
  throttle: number; // 0..1
  brake: number; // 0..1
}

export function createCarState(x = 0, y = 0, heading = -Math.PI / 2): CarState {
  return { x, y, heading, vx: 0, vy: 0, steer: 0, drifting: false };
}

export function stepCar(
  s: CarState,
  input: CarInput,
  t: Tuning,
  surface: Surface,
  dt: number
): CarState {
  const steer = s.steer + (clamp(input.steer, -1, 1) - s.steer) * Math.min(1, t.steerResponse * dt);

  // Turn authority ramps up from standstill, then eases off toward top speed.
  const oldFwd = s.vx * Math.cos(s.heading) + s.vy * Math.sin(s.heading);
  const speedFrac = Math.min(1, Math.abs(oldFwd) / t.maxSpeed);
  const rise = Math.min(1, speedFrac / 0.15);
  const falloff = 1 - t.speedTurnFalloff * speedFrac;
  const reverseSign = oldFwd < 0 ? -1 : 1;
  const heading = normalizeAngle(s.heading + steer * t.turnRate * rise * falloff * reverseSign * dt);

  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  const lx = -fy;
  const ly = fx;
  let fwd = s.vx * fx + s.vy * fy;
  let lat = s.vx * lx + s.vy * ly;

  const offroad = surface === "offroad";
  const maxSpeed = t.maxSpeed * (offroad ? t.offroadMaxSpeed : 1);

  // Accel is capped at maxSpeed so it can't push past it, but existing speed
  // above the cap (e.g. carrying road speed onto grass) bleeds off through
  // drag instead of being truncated instantly — a hard clamp there would
  // read as slamming into a wall the moment you touch the grass.
  fwd += Math.min(t.accel * clamp(input.throttle, 0, 1) * dt, Math.max(0, maxSpeed - fwd));
  fwd -= t.brake * clamp(input.brake, 0, 1) * dt;

  const drag = t.drag * (offroad ? t.offroadFriction : 1);
  fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), drag * dt);
  fwd = Math.max(fwd, -maxSpeed * 0.4);

  const drifting = Math.abs(lat) > t.driftThreshold;
  lat *= Math.exp(-(drifting ? t.driftGrip : t.lateralGrip) * dt);

  const vx = fx * fwd + lx * lat;
  const vy = fy * fwd + ly * lat;
  return { x: s.x + vx * dt, y: s.y + vy * dt, heading, vx, vy, steer, drifting };
}

/**
 * A boost's steering assist: how much extra steer (-1..1) to add so the car
 * eases onto the track's racing line instead of rocketing off at the next
 * corner. Returns a nudge proportional to the heading error between where the
 * car points (`heading`) and the track direction (`tangent`, radians),
 * saturating at `maxDeg` of error and scaled by `strength` (0 = no assist).
 * It's *added* to the driver's own steer, so you can always steer against it.
 */
export function boostGuideSteer(
  heading: number,
  tangent: number,
  maxDeg: number,
  strength: number
): number {
  if (strength <= 0) return 0;
  const diff = normalizeAngle(tangent - heading);
  const maxRad = (maxDeg * Math.PI) / 180 || 1;
  return clamp(diff / maxRad, -1, 1) * strength;
}

export function speedOf(s: CarState): number {
  return Math.hypot(s.vx, s.vy);
}

export function forwardSpeedOf(s: CarState): number {
  return s.vx * Math.cos(s.heading) + s.vy * Math.sin(s.heading);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
