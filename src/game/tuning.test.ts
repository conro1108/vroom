import { describe, expect, it } from "vitest";
import { boostTuning, DEFAULT_TUNING } from "./tuning";

describe("boostTuning", () => {
  it("scales top speed and accel by boostPower", () => {
    const b = boostTuning(DEFAULT_TUNING);
    expect(b.maxSpeed).toBeCloseTo(DEFAULT_TUNING.maxSpeed * DEFAULT_TUNING.boostPower);
    expect(b.accel).toBeCloseTo(DEFAULT_TUNING.accel * DEFAULT_TUNING.boostPower);
  });
});
