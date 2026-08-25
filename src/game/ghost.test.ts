import { describe, expect, it } from "vitest";
import { createGhostRecorder, finishGhostLap, GHOST_INTERVAL_MS, ghostAt, recordGhostSample } from "./ghost";

function recordedLap() {
  // straight-line drive: x = t px/ms
  const rec = createGhostRecorder();
  for (let t = 0; t <= 1000; t += 10) {
    recordGhostSample(rec, t, { x: t, y: 50, heading: 0 });
  }
  return finishGhostLap(rec, 1000);
}

describe("ghost replay", () => {
  it("interpolates position between samples", () => {
    const pose = ghostAt(recordedLap(), GHOST_INTERVAL_MS * 1.5)!;
    expect(pose.x).toBeCloseTo(GHOST_INTERVAL_MS * 1.5, 0);
    expect(pose.y).toBe(50);
  });

  it("disappears once its lap time is up, and before the lap starts", () => {
    const ghost = recordedLap();
    expect(ghostAt(ghost, -1)).toBeNull();
    expect(ghostAt(ghost, 999)).not.toBeNull();
    expect(ghostAt(ghost, 1000)).toBeNull();
  });
});
