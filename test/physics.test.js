import { test } from "node:test";
import assert from "node:assert/strict";
import { createCarState, stepCar } from "../src/physics.js";

test("car accelerates forward under positive throttle", () => {
  const car = createCarState();
  const next = stepCar(car, { throttle: 1, steer: 0 }, 0.1);
  assert.ok(next.speed > 0);
});

test("car decelerates to a stop from drag with no input", () => {
  let car = { ...createCarState(), speed: 50 };
  for (let i = 0; i < 100; i++) {
    car = stepCar(car, { throttle: 0, steer: 0 }, 0.1);
  }
  assert.equal(car.speed, 0);
});

test("speed is clamped to max forward speed", () => {
  let car = createCarState();
  for (let i = 0; i < 500; i++) {
    car = stepCar(car, { throttle: 1, steer: 0 }, 0.1);
  }
  assert.ok(car.speed <= 220);
});

test("steering only turns the car while moving", () => {
  const stationary = createCarState();
  const afterSteerStill = stepCar(stationary, { throttle: 0, steer: 1 }, 0.5);
  assert.equal(afterSteerStill.heading, stationary.heading);

  const moving = { ...createCarState(), speed: 100 };
  const afterSteerMoving = stepCar(moving, { throttle: 0, steer: 1 }, 0.5);
  assert.notEqual(afterSteerMoving.heading, moving.heading);
});
