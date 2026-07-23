import { describe, expect, it } from "vitest";
import {
  boostGuideSteer,
  createCarState,
  forwardSpeedOf,
  speedOf,
  stepCar,
  type CarInput,
} from "./physics";
import { DEFAULT_TUNING } from "./tuning";

const T = DEFAULT_TUNING;
const DT = 1 / 120;

function drive(steps: number, input: Partial<CarInput>, surface: "road" | "offroad" = "road") {
  let car = createCarState();
  const full: CarInput = { steer: 0, throttle: 0, brake: 0, ...input };
  for (let i = 0; i < steps; i++) car = stepCar(car, full, T, surface, DT);
  return car;
}

describe("stepCar", () => {
  it("accelerates from rest under throttle", () => {
    const car = drive(60, { throttle: 1 });
    expect(speedOf(car)).toBeGreaterThan(30);
  });

  it("never exceeds maxSpeed", () => {
    const car = drive(2400, { throttle: 1 });
    expect(speedOf(car)).toBeLessThanOrEqual(T.maxSpeed + 1e-6);
    expect(speedOf(car)).toBeGreaterThan(T.maxSpeed * 0.95);
  });

  it("coasts down under drag with no throttle", () => {
    let car = drive(600, { throttle: 1 });
    const fast = speedOf(car);
    for (let i = 0; i < 240; i++) car = stepCar(car, { steer: 0, throttle: 0, brake: 0 }, T, "road", DT);
    expect(speedOf(car)).toBeLessThan(fast);
  });

  it("brakes harder than it coasts", () => {
    const start = drive(600, { throttle: 1 });
    let coasted = start;
    let braked = start;
    for (let i = 0; i < 120; i++) {
      coasted = stepCar(coasted, { steer: 0, throttle: 0, brake: 0 }, T, "road", DT);
      braked = stepCar(braked, { steer: 0, throttle: 0, brake: 1 }, T, "road", DT);
    }
    expect(speedOf(braked)).toBeLessThan(speedOf(coasted));
  });

  it("does not turn at a standstill", () => {
    const car = drive(120, { steer: 1 });
    expect(car.heading).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("turns when moving", () => {
    const car = drive(240, { throttle: 1, steer: 1 });
    expect(car.heading).not.toBeCloseTo(-Math.PI / 2, 1);
  });

  it("bleeds off sideways velocity (grip)", () => {
    let car = createCarState(0, 0, 0); // heading +x
    car = { ...car, vx: 0, vy: 80 }; // pure sideways slide
    for (let i = 0; i < 240; i++) car = stepCar(car, { steer: 0, throttle: 0, brake: 0 }, T, "road", DT);
    expect(Math.abs(car.vy)).toBeLessThan(5);
  });

  it("flags drifting when sideways velocity passes the threshold", () => {
    let car = createCarState(0, 0, 0);
    car = { ...car, vy: T.driftThreshold * 2 };
    car = stepCar(car, { steer: 0, throttle: 0, brake: 0 }, T, "road", DT);
    expect(car.drifting).toBe(true);
  });

  it("is slower offroad", () => {
    const road = drive(2400, { throttle: 1 }, "road");
    const grass = drive(2400, { throttle: 1 }, "offroad");
    expect(speedOf(grass)).toBeLessThan(speedOf(road) * 0.6);
  });

  it("smooths steering input over time", () => {
    let car = createCarState();
    car = stepCar(car, { steer: 1, throttle: 0, brake: 0 }, T, "road", DT);
    expect(car.steer).toBeGreaterThan(0);
    expect(car.steer).toBeLessThan(0.5);
  });

  it("moves in the heading direction when gripping", () => {
    const car = drive(600, { throttle: 1 });
    expect(forwardSpeedOf(car)).toBeCloseTo(speedOf(car), 3);
    expect(car.y).toBeLessThan(0); // heading starts -PI/2 = up
  });
});

describe("boostGuideSteer", () => {
  const MAX = 40;
  const S = 0.5;

  it("is zero when already aligned with the track", () => {
    expect(boostGuideSteer(1.2, 1.2, MAX, S)).toBe(0);
  });

  it("steers toward the track direction (sign follows the shorter turn)", () => {
    // heading points +x (0), track wants +y (PI/2): a left/positive nudge.
    expect(boostGuideSteer(0, Math.PI / 2, MAX, S)).toBeGreaterThan(0);
    expect(boostGuideSteer(0, -Math.PI / 2, MAX, S)).toBeLessThan(0);
  });

  it("takes the short way around the wrap and saturates at strength", () => {
    // a small error just across the ±PI seam is a tiny nudge, not a full swing
    const nudge = boostGuideSteer(3.1, -3.1, MAX, S);
    expect(Math.abs(nudge)).toBeLessThan(S);
    // error past the max-degree window clamps to the full strength
    expect(boostGuideSteer(0, Math.PI / 2, MAX, S)).toBeCloseTo(S, 5);
  });

  it("does nothing with no strength", () => {
    expect(boostGuideSteer(0, Math.PI, MAX, 0)).toBe(0);
  });
});
