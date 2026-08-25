import { describe, expect, it } from "vitest";
import { inSlipstream } from "./draft";
import { createCarState } from "./physics";

describe("inSlipstream", () => {
  it("detects a fast follower tucked in behind a leader, not one alongside", () => {
    const follower = createCarState(100, 100, 0); // heading +x
    follower.vx = 120;
    expect(inSlipstream(follower, { x: 140, y: 102 }, 55, 70)).toBe(true);
    expect(inSlipstream(follower, { x: 105, y: 140 }, 55, 70)).toBe(false);
  });
});
