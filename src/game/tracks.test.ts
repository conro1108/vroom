// Geometry safety net for every track in the catalog: layouts are hand-drawn
// control points, and these tests are what catch an out-of-bounds sample or a
// road that folds back onto itself (a "pinch") before anyone drives it.
import { describe, expect, it } from "vitest";
import { createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";

describe.each(TRACKS.map((def) => [def.id, def] as const))("track %s", (_id, def) => {
  const track = createTrack(def);

  it("has a unique id and a name", () => {
    expect(track.name.length).toBeGreaterThan(0);
    expect(TRACKS.filter((t) => t.id === def.id)).toHaveLength(1);
  });

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

  it("never pinches: far-apart arc points keep road-width spatial separation", () => {
    // Points >5% of the lap apart along the arc must be far enough apart in
    // space that the two road ribbons (plus shoulders) don't merge.
    const minGap = track.roadWidth + 14;
    const n = track.samples.length;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 2; j < n; j += 2) {
        const arcDist = Math.min(
          Math.abs(track.progress[j]! - track.progress[i]!),
          1 - Math.abs(track.progress[j]! - track.progress[i]!)
        );
        if (arcDist < 0.05) continue;
        const a = track.samples[i]!;
        const b = track.samples[j]!;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < minGap) {
          throw new Error(
            `pinch on ${def.id}: samples ${i} and ${j} are ${d.toFixed(0)}px apart ` +
              `(need ${minGap}) at (${a.x.toFixed(0)},${a.y.toFixed(0)})`
          );
        }
      }
    }
  });

  it("lap progress works around the whole centerline", () => {
    const query = createTrackQuery(track);
    for (let i = 0; i < track.samples.length; i += 5) {
      const p = track.samples[i]!;
      expect(query.progressAt(p.x, p.y)).not.toBeNull();
      expect(query.surfaceAt(p.x, p.y)).toBe("road");
    }
  });
});
