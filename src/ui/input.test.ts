import { describe, expect, it } from "vitest";
import { joystickSteer } from "./input";

const LOCK = (40 * Math.PI) / 180;
const DEAD = 10;
const UP = -Math.PI / 2; // screen up

describe("joystickSteer", () => {
  it("returns 0 inside the deadzone", () => {
    expect(joystickSteer(4, -4, UP, DEAD, LOCK)).toBe(0);
  });

  it("steers 0 when dragging the way the car already points", () => {
    expect(joystickSteer(0, -50, UP, DEAD, LOCK)).toBeCloseTo(0, 5);
  });

  it("saturates right when dragging 90° clockwise of heading", () => {
    // car points up, drag right => desired heading is +90° => full right lock
    expect(joystickSteer(50, 0, UP, DEAD, LOCK)).toBe(1);
  });

  it("saturates left when dragging 90° counter-clockwise of heading", () => {
    expect(joystickSteer(-50, 0, UP, DEAD, LOCK)).toBe(-1);
  });

  it("is proportional for small heading errors", () => {
    // 20° error with 40° lock => half steer
    const angle = UP + (20 * Math.PI) / 180;
    const steer = joystickSteer(Math.cos(angle) * 50, Math.sin(angle) * 50, UP, DEAD, LOCK);
    expect(steer).toBeCloseTo(0.5, 5);
  });

  it("wraps across the ±PI seam", () => {
    // car points just past -PI, drag points just below +PI: tiny real error
    const steer = joystickSteer(Math.cos(3.1) * 50, Math.sin(3.1) * 50, -3.1, DEAD, LOCK);
    expect(Math.abs(steer)).toBeLessThan(0.3);
  });

  it("steers with consistent screen mapping when the car drives toward the player", () => {
    // car points down-screen; dragging left on screen must turn toward screen-left
    const DOWN = Math.PI / 2;
    const steer = joystickSteer(-50, 20, DOWN, DEAD, LOCK);
    const after = DOWN + steer * 0.1; // any positive step toward the command
    const cos = Math.cos(after);
    expect(steer).toBeGreaterThan(0.5); // vs dragx, which would have steered the "wrong" way
    expect(cos).toBeLessThan(Math.cos(DOWN) + 1e-9);
  });
});
