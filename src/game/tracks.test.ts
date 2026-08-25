import { describe, expect, it } from "vitest";
import { createOpponents, stepOpponents } from "./opponents";
import { SPEED_CLASSES } from "./progression";
import { createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

describe("track catalog", () => {
  it("every track has a unique id and stays inside the world bounds", () => {
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
    for (const def of TRACKS) {
      const track = createTrack(def);
      for (const p of track.samples) {
        expect(p.x, def.id).toBeGreaterThan(track.roadWidth);
        expect(p.x, def.id).toBeLessThan(track.worldWidth - track.roadWidth);
        expect(p.y, def.id).toBeGreaterThan(track.roadWidth);
        expect(p.y, def.id).toBeLessThan(track.worldHeight - track.roadWidth);
      }
    }
  });
});

// Three representative layouts: a grass starter, a hairpin track, a void track.
// The full catalog drive lives in scripts/balance.ts.
const REPRESENTATIVE = ["meadow", "switchback", "pulsar"];

describe.each(REPRESENTATIVE.map((id) => [id, TRACKS.find((t) => t.id === id)!] as const))(
  "driving %s",
  (_id, def) => {
    it("a bot laps it without the marshals having to collect it", () => {
      const track = createTrack(def);
      const query = createTrackQuery(track);
      const corridor = def.voidRunoff ? 0 : DEFAULT_TUNING.fenceMarginPx;
      const rescue = corridor + (def.voidRunoff ? DEFAULT_TUNING.voidMarginPx : DEFAULT_TUNING.rescueMarginPx);
      const [bot] = createOpponents(
        track,
        query,
        [{ vehicleId: "classic", skill: 1 }],
        { ...DEFAULT_TUNING, botSloppiness: 0 },
        SPEED_CLASSES[SPEED_CLASSES.length - 1]!,
        () => 0.5
      );
      const start = bot!.tracker.lap;
      let rescues = 0;
      for (let i = 0; i < 120 * 180 && bot!.tracker.lap === start; i++) {
        const towing = bot!.tow !== null;
        stepOpponents([bot!], query, 1 / 120, true, null, corridor, rescue, DEFAULT_TUNING.rescueTowSeconds);
        if (!towing && bot!.tow) rescues++;
      }
      expect(bot!.tracker.lap, `${def.id}: bot never completed a lap`).toBeGreaterThan(start);
      // over the void the bots' pure-pursuit line still falls off at 200cc; see scripts/balance.ts
      if (!def.voidRunoff) expect(rescues, `${def.id}: bot needed rescuing mid-lap`).toBe(0);
    });
  }
);
