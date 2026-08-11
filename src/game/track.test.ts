import { describe, expect, it } from "vitest";
import {
  arcBetween,
  createLapTracker,
  createTrack,
  createTrackQuery,
  createTow,
  cutsCourse,
  fenceCar,
  outOfBounds,
  rescueCar,
  safeSpotAt,
  stepTow,
  updateLap,
} from "./track";
import { cupById } from "./cups";
import { trackDefById, TRACKS } from "./tracks";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);

describe("surface queries", () => {
  it("centerline points are on the road", () => {
    for (let i = 0; i < track.samples.length; i += 17) {
      const p = track.samples[i]!;
      expect(query.surfaceAt(p.x, p.y)).toBe("road");
    }
  });

  it("far-away points are offroad", () => {
    expect(query.surfaceAt(5, 5)).toBe("offroad");
    expect(query.surfaceAt(track.worldWidth - 5, track.worldHeight - 5)).toBe("offroad");
  });

  it("progressAt increases along the loop", () => {
    const a = query.progressAt(track.samples[10]!.x, track.samples[10]!.y)!;
    const b = query.progressAt(track.samples[60]!.x, track.samples[60]!.y)!;
    expect(b).toBeGreaterThan(a);
  });
});

describe("fencing", () => {
  // fenceCar takes a margin past the local road edge; this test track is
  // uniform width, so positions are still computed from the centerline
  const margin = 26;
  const corridor = track.roadWidth / 2 + margin;
  // Only some stretches are fenced now, so the fence tests have to stand on one
  // that is — the open stretches are covered by the rescue tests below. Stand
  // *inside* a fenced run, not on its first sample: nearestOnRoad can snap a
  // point beside sample i onto segment i-1, and on the edge of a run that
  // neighbour is the unfenced one, so the fence quietly isn't there.
  const fencedIndex = track.fenced.findIndex(
    (f, i) => f && track.fenced[(i + 1) % track.fenced.length] && track.fenced[i - 1]
  );

  it("leaves a car inside the corridor alone", () => {
    const p = track.samples[fencedIndex]!;
    const car = { x: p.x, y: p.y, vx: 50, vy: 0 };
    fenceCar(car, query, margin);
    expect(car).toEqual({ x: p.x, y: p.y, vx: 50, vy: 0 });
  });

  it("pushes an escaped car back to the fence line and bounces outward velocity", () => {
    // walk outward from a centerline point until past the fence
    const p = track.samples[fencedIndex]!;
    const hit = query.nearestOnRoad(p.x + 1, p.y + 1)!;
    const nx = (p.x + 1 - hit.x) / hit.dist;
    const ny = (p.y + 1 - hit.y) / hit.dist;
    const car = {
      x: hit.x + nx * (corridor + 15),
      y: hit.y + ny * (corridor + 15),
      vx: nx * 100,
      vy: ny * 100,
    };
    fenceCar(car, query, margin);
    const after = query.nearestOnRoad(car.x, car.y)!;
    expect(after.dist).toBeLessThanOrEqual(corridor + 0.01);
    // outward velocity component is now inward (bounced)
    const outward = car.vx * nx + car.vy * ny;
    expect(outward).toBeLessThan(0);
  });

  it("kicks a crawling head-on car back inward so it can't pin itself", () => {
    const p = track.samples[fencedIndex]!;
    const hit = query.nearestOnRoad(p.x + 1, p.y + 1)!;
    const nx = (p.x + 1 - hit.x) / hit.dist;
    const ny = (p.y + 1 - hit.y) / hit.dist;
    // barely moving into the fence — the trap case for speed-scaled turning
    const car = {
      x: hit.x + nx * (corridor + 0.5),
      y: hit.y + ny * (corridor + 0.5),
      vx: nx * 2,
      vy: ny * 2,
    };
    fenceCar(car, query, margin);
    const inward = -(car.vx * nx + car.vy * ny);
    expect(inward).toBeGreaterThanOrEqual(35);
  });

  it("nearestOnRoad reports a point at the reported distance", () => {
    const p = track.samples[10]!;
    const hit = query.nearestOnRoad(p.x + 30, p.y)!;
    expect(Math.hypot(p.x + 30 - hit.x, p.y - hit.y)).toBeCloseTo(hit.dist, 5);
  });
});

describe("open runoff and rescue", () => {
  const margin = 26; // past the road edge (uniform width here)
  const corridor = track.roadWidth / 2 + margin;
  const openIndex = track.fenced.findIndex((f) => !f);

  /** A point `out` px straight off the road from sample `i`. */
  const offRoad = (i: number, out: number) => {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % track.samples.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: a.x - ((b.y - a.y) / len) * out, y: a.y + ((b.x - a.x) / len) * out };
  };

  it("every track has both fenced and open stretches to drive", () => {
    // A lap fenced end to end is the old behaviour; a lap with no fence at all
    // means the pinch/edge detection has gone blind. Both are regressions.
    expect(track.fenced.some(Boolean)).toBe(true);
    expect(track.fenced.some((f) => !f)).toBe(true);
  });

  it("lets a car sail off an unfenced stretch", () => {
    const p = offRoad(openIndex, corridor + 40);
    const car = { x: p.x, y: p.y, vx: 60, vy: 60 };
    fenceCar(car, query, margin);
    expect(car).toEqual({ x: p.x, y: p.y, vx: 60, vy: 60 });
  });

  it("only calls for a rescue once the car is well past the runoff", () => {
    const near = offRoad(openIndex, corridor + 20);
    const far = offRoad(openIndex, corridor + 400);
    const limit = margin + 150; // outOfBounds measures past the road edge
    expect(outOfBounds(near, query, limit)).toBe(false);
    expect(outOfBounds(far, query, limit)).toBe(true);
  });

  it("drags the car home over the tow, instead of teleporting and pausing", () => {
    const left = track.samples[openIndex]!;
    const spot = safeSpotAt(left.x, left.y, query)!;
    const out = offRoad(openIndex, corridor + 300);
    const car = { x: out.x, y: out.y, heading: spot.heading + 1, vx: 300, vy: -120 };
    const tow = createTow(car, spot, 1);
    expect(car).toMatchObject({ x: out.x, y: out.y, vx: 0, vy: 0 }); // hooked up, not moved

    // halfway through, it's somewhere between the two — under way, not arrived
    expect(stepTow(tow, car, 0.5)).toBe(false);
    const toStart = Math.hypot(car.x - out.x, car.y - out.y);
    const toEnd = Math.hypot(car.x - spot.x, car.y - spot.y);
    expect(toStart).toBeGreaterThan(1);
    expect(toEnd).toBeGreaterThan(1);
    expect(car.vx).toBe(0);
    expect(car.vy).toBe(0);

    expect(stepTow(tow, car, 0.5)).toBe(true);
    expect(car.x).toBeCloseTo(spot.x, 5);
    expect(car.y).toBeCloseTo(spot.y, 5);
    expect(car.heading).toBeCloseTo(spot.heading, 5);
  });

  it("tows the short way round when the car ended up facing backwards", () => {
    const spot = { x: 0, y: 0, heading: -3 };
    const car = { x: 0, y: 0, heading: 3, vx: 0, vy: 0 };
    const tow = createTow(car, spot, 1);
    stepTow(tow, car, 0.5);
    // 3 → -3 the short way passes through ±π, never through 0
    expect(Math.abs(car.heading)).toBeGreaterThan(3);
  });

  it("puts the car back where it left the road, not where it ended up", () => {
    const left = track.samples[openIndex]!;
    const spot = safeSpotAt(left.x, left.y, query)!;
    const car = { x: 20, y: 20, heading: 0, vx: 300, vy: -120 };
    rescueCar(car, spot);
    expect(query.surfaceAt(car.x, car.y)).toBe("road");
    // dropped at the exit point, stopped, pointing down the road
    expect(Math.hypot(car.x - left.x, car.y - left.y)).toBeLessThan(track.roadWidth);
    expect(car.vx).toBe(0);
    expect(car.vy).toBe(0);
    const tan = query.tangentAt(left.x, left.y)!;
    expect(car.heading).toBeCloseTo(Math.atan2(tan.y, tan.x), 5);
  });
});

describe("void tracks", () => {
  const cosmos = cupById("rainbow").trackIds.map((id) => trackDefById(id));

  it("the whole cosmos cup has nothing to run off onto", () => {
    for (const def of cosmos) {
      expect(def.voidRunoff, def.id).toBe(true);
    }
  });

  it("has no fence anywhere — leaving the road means falling", () => {
    for (const def of cosmos) {
      const t = createTrack(def);
      expect(t.fenced.some(Boolean), def.id).toBe(false);
      // and a car well off the road is never bounced back
      const a = t.samples[0]!;
      const b = t.samples[1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const out = t.roadWidth;
      const car = {
        x: a.x - ((b.y - a.y) / len) * out,
        y: a.y + ((b.x - a.x) / len) * out,
        vx: 60,
        vy: 60,
      };
      const before = { ...car };
      fenceCar(car, createTrackQuery(t), t.roadWidth / 2);
      expect(car, def.id).toEqual(before);
    }
  });

  it("gets wide roads — falling off is the hazard, not a narrow ribbon", () => {
    const widths = TRACKS.map((t) => t.roadWidth).sort((a, b) => a - b);
    const median = widths[Math.floor(widths.length / 2)]!;
    for (const def of cosmos) expect(def.roadWidth, def.id).toBeGreaterThanOrEqual(median);
  });
});

describe("course cuts", () => {
  it("arcBetween measures the short way round", () => {
    expect(arcBetween(0.1, 0.9, 1000)).toBeCloseTo(200);
    expect(arcBetween(0.4, 0.6, 1000)).toBeCloseTo(200);
    expect(arcBetween(0.5, 0.5, 1000)).toBe(0);
  });

  it("calls a cut when the nearest road is far along the lap from the anchor", () => {
    const n = track.samples.length;
    const anchor = safeSpotAt(track.samples[0]!.x, track.samples[0]!.y, query)!;
    const far = track.samples[Math.floor(n / 2)]!; // half a lap away
    const near = track.samples[4]!; // a few car lengths on
    expect(cutsCourse(far, anchor, query, 450)).toBe(true);
    expect(cutsCourse(near, anchor, query, 450)).toBe(false);
  });

  it("rescue anchors carry the progress they were taken at", () => {
    const i = Math.floor(track.samples.length / 3);
    const spot = safeSpotAt(track.samples[i]!.x, track.samples[i]!.y, query)!;
    expect(spot.progress).toBeCloseTo(track.progress[i]!, 3);
  });
});

describe("lap tracking", () => {
  it("counts a lap after a full forward loop", () => {
    const lap = createLapTracker(0);
    let completed = false;
    for (let i = 1; i <= 100; i++) {
      completed = updateLap(lap, (i / 100) % 1).completed || completed;
    }
    expect(completed).toBe(true);
    expect(lap.lap).toBe(2);
  });

  it("does not count wiggling back and forth across the line", () => {
    const lap = createLapTracker(0.99);
    for (let i = 0; i < 50; i++) {
      expect(updateLap(lap, 0.01).completed).toBe(false);
      expect(updateLap(lap, 0.99).completed).toBe(false);
    }
    expect(lap.lap).toBe(1);
  });

  it("requires re-covering ground after driving backwards", () => {
    const lap = createLapTracker(0);
    for (let i = 1; i <= 30; i++) updateLap(lap, 1 - i / 100); // reverse 30%
    let completed = false;
    for (let i = 1; i <= 100; i++) {
      const p = (1 - 30 / 100 + i / 100 + 1) % 1;
      completed = updateLap(lap, p).completed || completed;
    }
    expect(completed).toBe(false); // only recovered the deficit, not a full extra lap
    expect(lap.lap).toBe(1);
  });
});
