import { describe, expect, it } from "vitest";
import { createDriftBoost, driftChargeFrac, stepDriftBoost } from "./driftboost";

const DT = 1 / 120;

/** Slide for `seconds`, then grip for `seconds2`; returns how many kicks fired. */
function driveDrift(seconds: number, seconds2: number, chargeSeconds: number): number {
  const state = createDriftBoost();
  let kicks = 0;
  for (let t = 0; t < seconds; t += DT) {
    if (stepDriftBoost(state, true, DT, chargeSeconds)) kicks++;
  }
  for (let t = 0; t < seconds2; t += DT) {
    if (stepDriftBoost(state, false, DT, chargeSeconds)) kicks++;
  }
  return kicks;
}

describe("stepDriftBoost", () => {
  it("pays out on the exit, not the moment the charge fills", () => {
    const state = createDriftBoost();
    // slide well past the charge time — no kick while still sideways
    for (let t = 0; t < 2; t += DT) {
      expect(stepDriftBoost(state, true, DT, 0.8)).toBe(false);
    }
    expect(state.armed).toBe(true);
    expect(stepDriftBoost(state, false, DT, 0.8)).toBe(true); // hooks up: kick
  });

  it("gives one kick per drift however long the slide runs", () => {
    expect(driveDrift(0.9, 0.5, 0.8)).toBe(1);
    expect(driveDrift(5, 0.5, 0.8)).toBe(1);
  });

  it("pays nothing for a slide shorter than the charge time", () => {
    expect(driveDrift(0.4, 0.5, 0.8)).toBe(0);
  });

  it("lets a brief grip between switchback halves keep most of the charge", () => {
    const state = createDriftBoost();
    stepDriftBoost(state, true, 0.5, 0.8);
    stepDriftBoost(state, false, 0.1, 0.8); // momentary grip between the two turns
    expect(state.charge).toBeCloseTo(0.3);
    expect(stepDriftBoost(state, true, 0.5, 0.8)).toBe(false);
    expect(state.armed).toBe(true); // 0.3 + 0.5 cleared the 0.8 threshold
  });

  it("cannot bank a slide down a long straight", () => {
    const state = createDriftBoost();
    stepDriftBoost(state, true, 0.5, 0.8);
    stepDriftBoost(state, false, 3, 0.8);
    expect(state.charge).toBe(0);
    expect(state.armed).toBe(false);
  });

  it("reports charge progress, pinned at full once armed", () => {
    const state = createDriftBoost();
    expect(driftChargeFrac(state, 0.8)).toBe(0);
    stepDriftBoost(state, true, 0.4, 0.8);
    expect(driftChargeFrac(state, 0.8)).toBeCloseTo(0.5);
    stepDriftBoost(state, true, 2, 0.8);
    expect(driftChargeFrac(state, 0.8)).toBe(1);
  });
});
