import { describe, expect, it } from "vitest";
import { createLapTracker, createTrack, createTrackQuery, fenceCar, updateLap } from "./track";
import { TRACKS } from "./tracks";

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
  const corridor = track.roadWidth / 2 + 26;

  it("leaves a car inside the corridor alone", () => {
    const p = track.samples[40]!;
    const car = { x: p.x, y: p.y, vx: 50, vy: 0 };
    fenceCar(car, query, corridor);
    expect(car).toEqual({ x: p.x, y: p.y, vx: 50, vy: 0 });
  });

  it("pushes an escaped car back to the fence line and bounces outward velocity", () => {
    // walk outward from a centerline point until past the fence
    const p = track.samples[40]!;
    const hit = query.nearestOnRoad(p.x + 1, p.y + 1)!;
    const nx = (p.x + 1 - hit.x) / hit.dist;
    const ny = (p.y + 1 - hit.y) / hit.dist;
    const car = {
      x: hit.x + nx * (corridor + 15),
      y: hit.y + ny * (corridor + 15),
      vx: nx * 100,
      vy: ny * 100,
    };
    fenceCar(car, query, corridor);
    const after = query.nearestOnRoad(car.x, car.y)!;
    expect(after.dist).toBeLessThanOrEqual(corridor + 0.01);
    // outward velocity component is now inward (bounced)
    const outward = car.vx * nx + car.vy * ny;
    expect(outward).toBeLessThan(0);
  });

  it("nearestOnRoad reports a point at the reported distance", () => {
    const p = track.samples[10]!;
    const hit = query.nearestOnRoad(p.x + 30, p.y)!;
    expect(Math.hypot(p.x + 30 - hit.x, p.y - hit.y)).toBeCloseTo(hit.dist, 5);
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
