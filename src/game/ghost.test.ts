import { describe, expect, it } from "vitest";
import {
  createGhostRecorder,
  finishGhostLap,
  GHOST_INTERVAL_MS,
  ghostAt,
  recordGhostSample,
} from "./ghost";

function recordedLap() {
  // straight-line drive: x = t px/ms, heading wraps near ±π
  const rec = createGhostRecorder();
  for (let t = 0; t <= 1000; t += 10) {
    recordGhostSample(rec, t, { x: t, y: 50, heading: Math.PI - 0.001 });
  }
  return finishGhostLap(rec, 1000);
}

describe("ghost recording", () => {
  it("samples on the fixed interval regardless of step rate", () => {
    const ghost = recordedLap();
    expect(ghost.samples.length).toBe(Math.floor(1000 / GHOST_INTERVAL_MS) + 1);
    expect(ghost.samples[1]![0]).toBeCloseTo(GHOST_INTERVAL_MS, 0);
  });

  it("fills missed slots when steps are sparse", () => {
    const rec = createGhostRecorder();
    recordGhostSample(rec, 0, { x: 0, y: 0, heading: 0 });
    recordGhostSample(rec, GHOST_INTERVAL_MS * 3 + 1, { x: 9, y: 9, heading: 0 });
    expect(rec.samples.length).toBe(4); // no holes for the replay to trip on
  });
});

describe("ghost replay", () => {
  it("interpolates position between samples", () => {
    const ghost = recordedLap();
    const pose = ghostAt(ghost, GHOST_INTERVAL_MS * 1.5)!;
    expect(pose.x).toBeCloseTo(GHOST_INTERVAL_MS * 1.5, 0);
    expect(pose.y).toBe(50);
  });

  it("interpolates heading across the ±π wrap without spinning", () => {
    const rec = createGhostRecorder();
    recordGhostSample(rec, 0, { x: 0, y: 0, heading: Math.PI - 0.05 });
    recordGhostSample(rec, GHOST_INTERVAL_MS, { x: 1, y: 0, heading: -Math.PI + 0.05 });
    const ghost = finishGhostLap(rec, GHOST_INTERVAL_MS * 2);
    const pose = ghostAt(ghost, GHOST_INTERVAL_MS * 0.5)!;
    // halfway between the two, through the wrap — magnitude ~π, not ~0
    expect(Math.abs(pose.heading)).toBeGreaterThan(3);
  });

  it("disappears once its lap time is up, and before the lap starts", () => {
    const ghost = recordedLap();
    expect(ghostAt(ghost, -1)).toBeNull();
    expect(ghostAt(ghost, 999)).not.toBeNull();
    expect(ghostAt(ghost, 1000)).toBeNull();
    expect(ghostAt(ghost, 5000)).toBeNull();
  });

  it("handles an empty recording", () => {
    expect(ghostAt({ lapMs: 1000, vehicleId: "classic", samples: [] }, 100)).toBeNull();
  });
});
