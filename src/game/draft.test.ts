import { describe, expect, it } from "vitest";
import { createDraft, inSlipstream, stepDraft } from "./draft";
import { createCarState } from "./physics";

function movingCar(x: number, y: number, heading: number, speed: number) {
  const car = createCarState(x, y, heading);
  car.vx = Math.cos(heading) * speed;
  car.vy = Math.sin(heading) * speed;
  return car;
}

describe("inSlipstream", () => {
  const range = 55;
  const minSpeed = 70;

  it("detects a fast follower tucked in behind a leader", () => {
    const follower = movingCar(100, 100, 0, 120); // heading +x
    expect(inSlipstream(follower, { x: 140, y: 102 }, range, minSpeed)).toBe(true);
  });

  it("rejects cars alongside, too far, or too slow", () => {
    const follower = movingCar(100, 100, 0, 120);
    expect(inSlipstream(follower, { x: 105, y: 140 }, range, minSpeed)).toBe(false); // beside
    expect(inSlipstream(follower, { x: 200, y: 100 }, range, minSpeed)).toBe(false); // far
    const crawling = movingCar(100, 100, 0, 30);
    expect(inSlipstream(crawling, { x: 140, y: 100 }, range, minSpeed)).toBe(false);
  });

  it("rejects a leader behind the follower's nose", () => {
    const follower = movingCar(100, 100, 0, 120);
    expect(inSlipstream(follower, { x: 60, y: 100 }, range, minSpeed)).toBe(false);
  });
});

describe("stepDraft", () => {
  it("triggers once a full charge accumulates, then resets", () => {
    const state = createDraft();
    let triggers = 0;
    for (let i = 0; i < 300; i++) {
      if (stepDraft(state, true, 1 / 120, 1.0)) triggers++;
    }
    expect(triggers).toBe(2); // 2.5s in the stream at a 1s charge
    expect(state.charge).toBeLessThan(1);
  });

  it("decays charge out of the stream instead of zeroing it", () => {
    const state = createDraft();
    stepDraft(state, true, 0.5, 1.0);
    stepDraft(state, false, 0.1, 1.0);
    expect(state.charge).toBeCloseTo(0.3);
    stepDraft(state, false, 10, 1.0);
    expect(state.charge).toBe(0);
  });
});
