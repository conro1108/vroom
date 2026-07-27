import { describe, expect, it } from "vitest";
import { boostTuning, DEFAULT_TUNING } from "./tuning";

describe("boostTuning", () => {
  it("scales top speed and accel by boostPower", () => {
    const b = boostTuning(DEFAULT_TUNING);
    expect(b.maxSpeed).toBeCloseTo(DEFAULT_TUNING.maxSpeed * DEFAULT_TUNING.boostPower);
    expect(b.accel).toBeCloseTo(DEFAULT_TUNING.accel * DEFAULT_TUNING.boostPower);
  });

  it("lifts the grass penalty toward road values while boosting", () => {
    const b = boostTuning(DEFAULT_TUNING);
    // both levers move toward their road value (1.0)
    expect(b.offroadMaxSpeed).toBeGreaterThan(DEFAULT_TUNING.offroadMaxSpeed);
    expect(b.offroadMaxSpeed).toBeLessThanOrEqual(1);
    expect(b.offroadFriction).toBeLessThan(DEFAULT_TUNING.offroadFriction);
    expect(b.offroadFriction).toBeGreaterThanOrEqual(1);
  });

  it("boostOffroad=1 makes grass drive exactly like road", () => {
    const b = boostTuning({ ...DEFAULT_TUNING, boostOffroad: 1 });
    expect(b.offroadMaxSpeed).toBeCloseTo(1);
    expect(b.offroadFriction).toBeCloseTo(1);
  });

  it("boostOffroad=0 leaves the grass penalty untouched", () => {
    const b = boostTuning({ ...DEFAULT_TUNING, boostOffroad: 0 });
    expect(b.offroadMaxSpeed).toBeCloseTo(DEFAULT_TUNING.offroadMaxSpeed);
    expect(b.offroadFriction).toBeCloseTo(DEFAULT_TUNING.offroadFriction);
  });
});
