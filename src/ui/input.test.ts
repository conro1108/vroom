import { describe, expect, it } from "vitest";
import { joystickSteer } from "./input";

describe("joystickSteer", () => {
  it("saturates right when dragging 90° clockwise of heading", () => {
    // car points up, drag right => desired heading is +90° => full right lock
    expect(joystickSteer(50, 0, -Math.PI / 2, 10, (40 * Math.PI) / 180)).toBe(1);
  });
});
