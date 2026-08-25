import { describe, expect, it } from "vitest";
import {
  createLapTracker,
  createTrack,
  createTrackQuery,
  fenceCar,
  outOfBounds,
  rescueCar,
  safeSpotAt,
  updateLap,
} from "./track";
import { TRACKS } from "./tracks";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);
const margin = 26; // past the road edge (uniform width here)
const corridor = track.roadWidth / 2 + margin;

describe("surface queries", () => {
  it("centerline points are on the road, far-away points are offroad", () => {
    for (let i = 0; i < track.samples.length; i += 17) {
      const p = track.samples[i]!;
      expect(query.surfaceAt(p.x, p.y)).toBe("road");
    }
    expect(query.surfaceAt(5, 5)).toBe("offroad");
    expect(query.surfaceAt(track.worldWidth - 5, track.worldHeight - 5)).toBe("offroad");
  });
});

describe("fencing", () => {
  it("pushes an escaped car back to the fence line and bounces outward velocity", () => {
    // stand inside a fenced run, not on its edge: nearestOnRoad can snap onto
    // the neighbouring (unfenced) segment
    const fencedIndex = track.fenced.findIndex(
      (f, i) => f && track.fenced[(i + 1) % track.fenced.length] && track.fenced[i - 1]
    );
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
    expect(car.vx * nx + car.vy * ny).toBeLessThan(0);
  });
});

describe("open runoff and rescue", () => {
  const openIndex = track.fenced.findIndex((f) => !f);

  /** A point `out` px straight off the road from sample `i`. */
  const offRoad = (i: number, out: number) => {
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % track.samples.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: a.x - ((b.y - a.y) / len) * out, y: a.y + ((b.x - a.x) / len) * out };
  };

  it("only calls for a rescue once the car is well past the runoff", () => {
    const near = offRoad(openIndex, corridor + 20);
    const far = offRoad(openIndex, corridor + 400);
    const limit = margin + 150; // outOfBounds measures past the road edge
    expect(outOfBounds(near, query, limit)).toBe(false);
    expect(outOfBounds(far, query, limit)).toBe(true);
  });

  it("puts the car back where it left the road, not where it ended up", () => {
    const left = track.samples[openIndex]!;
    const spot = safeSpotAt(left.x, left.y, query)!;
    const car = { x: 20, y: 20, heading: 0, vx: 300, vy: -120 };
    rescueCar(car, spot);
    expect(query.surfaceAt(car.x, car.y)).toBe("road");
    expect(Math.hypot(car.x - left.x, car.y - left.y)).toBeLessThan(track.roadWidth);
    expect(car.vx).toBe(0);
    expect(car.vy).toBe(0);
    const tan = query.tangentAt(left.x, left.y)!;
    expect(car.heading).toBeCloseTo(Math.atan2(tan.y, tan.x), 5);
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
});
