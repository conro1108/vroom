import { describe, expect, it } from "vitest";
import {
  CALIBRATION_AXES,
  choose,
  createCalibration,
  currentAxis,
  ROUNDS_PER_AXIS,
  skipAxis,
  variants,
  variantTuning,
  type Calibration,
} from "./calibrate";
import { DEFAULT_TUNING } from "./tuning";

function fresh(): Calibration {
  return createCalibration({ ...DEFAULT_TUNING });
}

describe("calibration", () => {
  it("starts on the first axis with an interval around the current value", () => {
    const cal = fresh();
    expect(currentAxis(cal).key).toBe("maxSpeed");
    expect(cal.lo).toBeLessThan(DEFAULT_TUNING.maxSpeed);
    expect(cal.hi).toBeGreaterThan(DEFAULT_TUNING.maxSpeed);
    const { a, b } = variants(cal);
    expect(a).toBeLessThan(b);
  });

  it("interval stays inside the axis range even at the extremes", () => {
    const cal = createCalibration({ ...DEFAULT_TUNING, maxSpeed: 320 });
    const axis = CALIBRATION_AXES[0]!;
    expect(cal.lo).toBeGreaterThanOrEqual(axis.min);
    expect(cal.hi).toBeLessThanOrEqual(axis.max);
    expect(cal.hi - cal.lo).toBeGreaterThan(0);
  });

  it("variant tunings differ only on the active axis", () => {
    const cal = fresh();
    const a = variantTuning(cal, { ...DEFAULT_TUNING }, "a");
    const b = variantTuning(cal, { ...DEFAULT_TUNING }, "b");
    expect(a.maxSpeed).not.toBe(b.maxSpeed);
    const { maxSpeed: _a, ...restA } = a;
    const { maxSpeed: _b, ...restB } = b;
    expect(restA).toEqual(restB);
  });

  it("choosing narrows toward the preferred half", () => {
    const cal = fresh();
    const before = variants(cal);
    const hiBefore = cal.hi;
    choose(cal, "a");
    expect(cal.hi).toBeLessThan(hiBefore);
    expect(cal.hi).toBeLessThanOrEqual((before.a + before.b) / 2 + 0.01);
  });

  it("an axis settles after its rounds and the next axis begins", () => {
    const cal = fresh();
    for (let i = 0; i < ROUNDS_PER_AXIS; i++) choose(cal, "b");
    expect(currentAxis(cal).key).toBe(CALIBRATION_AXES[1]!.key);
    // consistently preferring faster should settle above the default
    expect(cal.values.maxSpeed).toBeGreaterThan(DEFAULT_TUNING.maxSpeed);
  });

  it("skipping keeps the axis at its original value", () => {
    const cal = fresh();
    skipAxis(cal);
    expect(cal.values.maxSpeed).toBe(DEFAULT_TUNING.maxSpeed);
    expect(currentAxis(cal).key).toBe(CALIBRATION_AXES[1]!.key);
  });

  it("completes after every axis and reports a full value set", () => {
    const cal = fresh();
    while (!cal.done) choose(cal, "a");
    expect(cal.axisIndex).toBe(CALIBRATION_AXES.length);
    for (const axis of CALIBRATION_AXES) {
      expect(cal.values[axis.key]).toBeGreaterThanOrEqual(axis.min);
      expect(cal.values[axis.key]).toBeLessThanOrEqual(axis.max);
    }
    // settled values feed the variant tuning untouched once done
    const t = variantTuning(cal, { ...DEFAULT_TUNING }, "a");
    expect(t.maxSpeed).toBe(cal.values.maxSpeed);
  });

  it("settled axes carry into later comparisons", () => {
    const cal = fresh();
    for (let i = 0; i < ROUNDS_PER_AXIS; i++) choose(cal, "b"); // settle maxSpeed high
    const t = variantTuning(cal, { ...DEFAULT_TUNING }, "a");
    expect(t.maxSpeed).toBe(cal.values.maxSpeed);
    expect(t.maxSpeed).toBeGreaterThan(DEFAULT_TUNING.maxSpeed);
  });
});
