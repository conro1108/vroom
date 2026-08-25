import { describe, expect, it } from "vitest";
import { createCarState, speedOf, stepCar, type CarInput } from "./physics";
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
    expect(speedOf(drive(60, { throttle: 1 }))).toBeGreaterThan(30);
  });

  it("never exceeds maxSpeed", () => {
    const car = drive(2400, { throttle: 1 });
    expect(speedOf(car)).toBeLessThanOrEqual(T.maxSpeed + 1e-6);
    expect(speedOf(car)).toBeGreaterThan(T.maxSpeed * 0.95);
  });

  it("turns when moving", () => {
    const car = drive(240, { throttle: 1, steer: 1 });
    expect(car.heading).not.toBeCloseTo(-Math.PI / 2, 1);
  });

  it("is slower offroad", () => {
    const road = drive(2400, { throttle: 1 }, "road");
    const grass = drive(2400, { throttle: 1 }, "offroad");
    expect(speedOf(grass)).toBeLessThan(speedOf(road) * 0.6);
  });
});
