import { describe, expect, it } from "vitest";
import { CALIBRATION_AXES, choose, createCalibration, variantTuning } from "./calibrate";
import { DEFAULT_TUNING } from "./tuning";

describe("calibration", () => {
  it("completes after every axis and reports a full value set", () => {
    const cal = createCalibration({ ...DEFAULT_TUNING });
    while (!cal.done) choose(cal, "a");
    expect(cal.axisIndex).toBe(CALIBRATION_AXES.length);
    for (const axis of CALIBRATION_AXES) {
      expect(cal.values[axis.key]).toBeGreaterThanOrEqual(axis.min);
      expect(cal.values[axis.key]).toBeLessThanOrEqual(axis.max);
    }
    // settled values feed the variant tuning untouched once done
    const key = CALIBRATION_AXES[0]!.key;
    expect(variantTuning(cal, { ...DEFAULT_TUNING }, "a")[key]).toBe(cal.values[key]);
  });
});
