import { describe, expect, it } from "vitest";
import { createLapTracker, createTrack, createTrackQuery, updateLap } from "./track";

const track = createTrack();
const query = createTrackQuery(track);

describe("track geometry", () => {
  it("stays inside the world bounds with room for the road", () => {
    for (const p of track.samples) {
      expect(p.x).toBeGreaterThan(track.roadWidth);
      expect(p.x).toBeLessThan(track.worldWidth - track.roadWidth);
      expect(p.y).toBeGreaterThan(track.roadWidth);
      expect(p.y).toBeLessThan(track.worldHeight - track.roadWidth);
    }
  });

  it("progress is monotonic from 0 toward 1", () => {
    expect(track.progress[0]).toBe(0);
    for (let i = 1; i < track.progress.length; i++) {
      expect(track.progress[i]!).toBeGreaterThan(track.progress[i - 1]!);
      expect(track.progress[i]!).toBeLessThan(1);
    }
  });
});

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
