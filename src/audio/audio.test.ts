import { describe, expect, it } from "vitest";
import {
  createAudio,
  driftGain,
  engineCutoff,
  engineFreq,
  engineGain,
  engineTremolo,
  observerPoints,
  panForOffset,
  PASS_RADIUS,
  passStrength,
  type Observer,
} from "./audio";

describe("engineFreq", () => {
  it("idles low and revs up with speed and throttle", () => {
    const idle = engineFreq(0, 140, 0);
    const flooredStill = engineFreq(0, 140, 1); // revving before speed builds
    const fast = engineFreq(140, 140, 1);
    expect(idle).toBeCloseTo(44);
    expect(flooredStill).toBeGreaterThan(idle);
    expect(fast).toBeGreaterThan(flooredStill);
  });

  it("does not divide by zero when maxSpeed is 0", () => {
    expect(Number.isFinite(engineFreq(10, 0, 1))).toBe(true);
  });
});

describe("engineGain", () => {
  it("is a present growl but still below the doppler vrooms", () => {
    // the ongoing engine has body now, yet the vrooms stay the loud peaks
    expect(engineGain(140, 140, 1)).toBeLessThan(0.2);
  });
  it("keeps a faint idle rumble off throttle at a stop", () => {
    expect(engineGain(0, 140, 0)).toBeGreaterThan(0);
  });
  it("is a touch louder under throttle and at speed", () => {
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
  it("stays low and soft, only cracking open a little with revs", () => {
    expect(engineCutoff(0, 140, 0)).toBeLessThan(400);
    expect(engineCutoff(140, 140, 1)).toBeGreaterThan(engineCutoff(0, 140, 0));
  });
});

describe("driftGain", () => {
  it("is silent when the car is tracking straight", () => {
    expect(driftGain(10, 55)).toBe(0);
  });
  it("starts squealing before the drift break-point", () => {
    const belowBreak = driftGain(45, 55); // slip still under the 55 threshold
    expect(belowBreak).toBeGreaterThan(0);
    expect(belowBreak).toBeLessThan(1);
  });
  it("keeps swelling once actually drifting, up to a full screech", () => {
    expect(driftGain(80, 55)).toBeGreaterThan(driftGain(45, 55));
    expect(driftGain(400, 55)).toBe(1);
  });
  it("scales with the tuning's own threshold (grippier car = quieter for the same slip)", () => {
    expect(driftGain(60, 90)).toBeLessThan(driftGain(60, 40));
  });
  it("treats slide direction symmetrically", () => {
    expect(driftGain(-70, 55)).toBeCloseTo(driftGain(70, 55));
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

describe("observerPoints", () => {
  const square: Observer[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("returns the requested number of listeners", () => {
    expect(observerPoints(square, 3, 10)).toHaveLength(3);
  });
  it("degrades to empty on a too-small path or zero count", () => {
    expect(observerPoints([{ x: 0, y: 0 }], 3, 10)).toEqual([]);
    expect(observerPoints(square, 0, 10)).toEqual([]);
  });
  it("sits each listener off to the side, ~offset from the road", () => {
    for (const o of observerPoints(square, 2, 15)) {
      const nearest = Math.min(...square.map((s) => Math.hypot(o.x - s.x, o.y - s.y)));
      expect(nearest).toBeGreaterThan(0); // not on the centerline
      expect(nearest).toBeLessThanOrEqual(15 + 1e-6); // but only just off it
    }
  });

  it("plants a listener at a sharp corner", () => {
    // a smooth circle with one hard notch pulled inward at index 0
    const N = 120;
    const R = 100;
    const loop: Observer[] = Array.from({ length: N }, (_, k) => {
      const a = (k / N) * 2 * Math.PI;
      return { x: Math.cos(a) * R, y: Math.sin(a) * R };
    });
    loop[0] = { x: 40, y: 0 };
    const [o] = observerPoints(loop, 1, 10);
    const dNotch = Math.hypot(o!.x - 40, o!.y);
    const dFar = Math.hypot(o!.x + 100, o!.y); // the smooth far side of the loop
    expect(dNotch).toBeLessThan(dFar); // landed at the notch, not somewhere bland
    expect(dNotch).toBeLessThanOrEqual(10 + 1e-6);
  });

  it("keeps listeners on the tight corners, never mid-straight", () => {
    // a stadium: two long straights (y = ±50) joined by tight semicircle ends
    const loop: Observer[] = [];
    const half = 150;
    const r = 50;
    const step = 3;
    for (let x = -half; x < half; x += step) loop.push({ x, y: -r }); // bottom straight →
    for (let a = -Math.PI / 2; a < Math.PI / 2; a += step / r)
      loop.push({ x: half + Math.cos(a) * r, y: Math.sin(a) * r }); // right end ↑
    for (let x = half; x > -half; x -= step) loop.push({ x, y: r }); // top straight ←
    for (let a = Math.PI / 2; a < (3 * Math.PI) / 2; a += step / r)
      loop.push({ x: -half + Math.cos(a) * r, y: Math.sin(a) * r }); // left end ↓

    const pts = observerPoints(loop, 3, 8);
    const onStraight = pts.some((o) => Math.abs(o.x) < 60); // straights live near x=0
    expect(onStraight).toBe(false); // no vrooms on the flat-out straights
    for (const o of pts) expect(Math.abs(o.x)).toBeGreaterThan(100); // every listener at a tight end
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
        lateralSpeed: 80,
        driftThreshold: 55,
      });
      a.launch(true);
      a.whoosh(0.5, 0.8);
      a.pickup();
      a.item("turbo");
      a.item("rocket");
      a.item("crown");
      a.item("oil");
      a.spun();
      a.vroom(-0.6, 0.9, 1.2);
      a.setVolume(0.3);
      a.resume();
    }).not.toThrow();
  });
});
