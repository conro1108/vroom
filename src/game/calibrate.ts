// Feel calibration: a driving blind-taste-test. One handling axis at a time,
// the player free-drives variant A and variant B (everything else held equal)
// and picks the one they prefer; the interval halves around the pick and the
// next round refines it. Settled axes carry into later rounds, so the search
// converges on a coherent feel whose values can be copied into a vehicle
// definition.
import type { Tuning } from "./tuning";
import type { VehicleKey } from "./vehicles";

export interface CalibrationAxis {
  key: VehicleKey;
  label: string;
  min: number;
  max: number;
}

// Ranges match the dev-panel sliders; order runs from the most feel-defining
// axes to the subtler ones so an early bail-out still calibrated what matters.
export const CALIBRATION_AXES: CalibrationAxis[] = [
  { key: "maxSpeed", label: "top speed", min: 60, max: 320 },
  { key: "turnRate", label: "turn rate", min: 1, max: 6 },
  { key: "lateralGrip", label: "grip", min: 0.5, max: 15 },
  { key: "accel", label: "acceleration", min: 60, max: 500 },
  { key: "steerResponse", label: "steer response", min: 1, max: 20 },
  { key: "driftGrip", label: "drift grip", min: 0.2, max: 8 },
  { key: "driftThreshold", label: "drift threshold", min: 10, max: 120 },
  { key: "speedTurnFalloff", label: "turn falloff @ speed", min: 0, max: 0.9 },
];

export const ROUNDS_PER_AXIS = 2;

export interface Calibration {
  axisIndex: number;
  round: number; // 0-based round within the current axis
  lo: number; // current search interval on the active axis
  hi: number;
  /** Values settled so far, seeded from the starting tuning. */
  values: Record<VehicleKey, number>;
  done: boolean;
}

/** Start the interval at half the axis range, centered on the current value. */
function axisInterval(axis: CalibrationAxis, current: number): { lo: number; hi: number } {
  const half = (axis.max - axis.min) / 4;
  const lo = Math.max(axis.min, current - half);
  const hi = Math.min(axis.max, lo + half * 2);
  return { lo: Math.min(lo, hi - half), hi };
}

export function createCalibration(tuning: Tuning): Calibration {
  const values = {} as Record<VehicleKey, number>;
  for (const axis of CALIBRATION_AXES) values[axis.key] = tuning[axis.key];
  const first = CALIBRATION_AXES[0]!;
  const { lo, hi } = axisInterval(first, values[first.key]);
  return { axisIndex: 0, round: 0, lo, hi, values, done: false };
}

export function currentAxis(cal: Calibration): CalibrationAxis {
  return CALIBRATION_AXES[cal.axisIndex]!;
}

/** The two candidate values for the active axis: quarter points of the interval. */
export function variants(cal: Calibration): { a: number; b: number } {
  const w = cal.hi - cal.lo;
  return { a: round2(cal.lo + w / 4), b: round2(cal.hi - w / 4) };
}

/** Full tuning for driving one variant: base prefs + settled values + the candidate. */
export function variantTuning(cal: Calibration, base: Tuning, which: "a" | "b"): Tuning {
  const t = { ...base, ...cal.values };
  if (!cal.done) t[currentAxis(cal).key] = variants(cal)[which];
  return t;
}

/** Narrow toward the preferred variant; advance rounds and axes as they settle. */
export function choose(cal: Calibration, which: "a" | "b"): void {
  if (cal.done) return;
  const mid = (cal.lo + cal.hi) / 2;
  if (which === "a") cal.hi = mid;
  else cal.lo = mid;
  cal.round += 1;
  if (cal.round >= ROUNDS_PER_AXIS) settleAxis(cal);
}

/** Keep the axis at its settled (pre-calibration) value and move on. */
export function skipAxis(cal: Calibration): void {
  if (cal.done) return;
  advance(cal);
}

function settleAxis(cal: Calibration): void {
  cal.values[currentAxis(cal).key] = round2((cal.lo + cal.hi) / 2);
  advance(cal);
}

function advance(cal: Calibration): void {
  cal.axisIndex += 1;
  cal.round = 0;
  if (cal.axisIndex >= CALIBRATION_AXES.length) {
    cal.done = true;
    return;
  }
  const axis = currentAxis(cal);
  const { lo, hi } = axisInterval(axis, cal.values[axis.key]);
  cal.lo = lo;
  cal.hi = hi;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
