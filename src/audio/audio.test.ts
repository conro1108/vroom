import { describe, expect, it } from "vitest";
import {
  createAudio,
  driftGain,
  engineCutoff,
  engineFreq,
  engineGain,
  engineTremolo,
  panForOffset,
  PASS_RADIUS,
  passStrength,
} from "./audio";

describe("engineFreq", () => {
  it("idles low and revs up with speed and throttle", () => {
    const idle = engineFreq(0, 140, 0);
    const flooredStill = engineFreq(0, 140, 1); // revving before speed builds
    const fast = engineFreq(140, 140, 1);
    expect(idle).toBeCloseTo(60);
    expect(flooredStill).toBeGreaterThan(idle);
    expect(fast).toBeGreaterThan(flooredStill);
  });

  it("does not divide by zero when maxSpeed is 0", () => {
    expect(Number.isFinite(engineFreq(10, 0, 1))).toBe(true);
  });
});

describe("engineGain", () => {
  it("keeps an idle rumble even off throttle at a stop", () => {
    expect(engineGain(0, 140, 0)).toBeGreaterThan(0);
  });
  it("is louder under throttle and at speed", () => {
    expect(engineGain(140, 140, 1)).toBeGreaterThan(engineGain(0, 140, 0));
  });
});

describe("engineTremolo", () => {
  it("lopes slowly and deep at idle, fast and shallow at speed", () => {
    const idle = engineTremolo(0, 140);
    const fast = engineTremolo(140, 140);
    expect(fast.rate).toBeGreaterThan(idle.rate);
    expect(idle.depth).toBeGreaterThan(fast.depth);
  });
});

describe("engineCutoff", () => {
  it("opens the filter up as revs climb", () => {
    expect(engineCutoff(140, 140, 1)).toBeGreaterThan(engineCutoff(0, 140, 0));
  });
});

describe("driftGain", () => {
  it("is silent when not drifting, whatever the slide", () => {
    expect(driftGain(500, false)).toBe(0);
  });
  it("swells from zero to full as sideways slide grows", () => {
    expect(driftGain(45, true)).toBe(0); // at the floor
    expect(driftGain(120, true)).toBeGreaterThan(0);
    expect(driftGain(120, true)).toBeLessThan(1);
    expect(driftGain(400, true)).toBe(1); // clamped
  });
  it("treats slide direction symmetrically", () => {
    expect(driftGain(-120, true)).toBeCloseTo(driftGain(120, true));
  });
});

describe("panForOffset", () => {
  it("pans right for a car on the driver's right and left for the left", () => {
    // heading east (+x): screen-right is +y in world space
    expect(panForOffset(0, 50, 0)).toBeGreaterThan(0);
    expect(panForOffset(0, -50, 0)).toBeLessThan(0);
  });
  it("centers a car dead ahead or on top of you", () => {
    expect(panForOffset(50, 0, 0)).toBeCloseTo(0);
    expect(panForOffset(0, 0, 0)).toBe(0);
  });
});

describe("passStrength", () => {
  it("is zero past the radius or below the speed threshold", () => {
    expect(passStrength(PASS_RADIUS + 1, 300)).toBe(0);
    expect(passStrength(10, 10)).toBe(0);
  });
  it("grows as a car passes nearer and faster", () => {
    const nearFast = passStrength(10, 300);
    const farSlow = passStrength(60, 70);
    expect(nearFast).toBeGreaterThan(farSlow);
    expect(nearFast).toBeLessThanOrEqual(1);
  });
  it("counts a pass whether they overtake you or you them", () => {
    expect(passStrength(20, 150)).toBeCloseTo(passStrength(20, -150));
  });
});

describe("createAudio", () => {
  it("returns a working no-op when WebAudio is unavailable (node/jsdom)", () => {
    const a = createAudio(0.7);
    expect(() => {
      a.update({
        active: true,
        forwardSpeed: 100,
        maxSpeed: 140,
        throttle: 1,
        drifting: true,
        lateralSpeed: 80,
      });
      a.launch(true);
      a.whoosh(0.5, 0.8);
      a.setVolume(0.3);
      a.resume();
    }).not.toThrow();
  });
});
