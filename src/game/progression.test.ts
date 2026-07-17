import { describe, expect, it } from "vitest";
import {
  applySpeedClass,
  createProgress,
  isTrackUnlocked,
  markRaceCompleted,
  SPEED_CLASSES,
  speedClassById,
} from "./progression";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

describe("speed classes", () => {
  it("baseline class leaves tuning untouched", () => {
    const t = applySpeedClass({ ...DEFAULT_TUNING }, SPEED_CLASSES[0]!);
    expect(t).toEqual(DEFAULT_TUNING);
  });

  it("higher classes scale speed but not control preferences", () => {
    const cls = speedClassById("150");
    const t = applySpeedClass({ ...DEFAULT_TUNING }, cls);
    expect(t.maxSpeed).toBeCloseTo(DEFAULT_TUNING.maxSpeed * cls.mult);
    expect(t.accel).toBeCloseTo(DEFAULT_TUNING.accel * cls.mult);
    expect(t.turnRate).toBeGreaterThan(DEFAULT_TUNING.turnRate);
    expect(t.turnRate).toBeLessThan(DEFAULT_TUNING.turnRate * cls.mult);
    expect(t.steerMode).toBe(DEFAULT_TUNING.steerMode);
    expect(t.lateralGrip).toBe(DEFAULT_TUNING.lateralGrip);
  });

  it("unknown class id falls back to the first class", () => {
    expect(speedClassById("nope")).toBe(SPEED_CLASSES[0]);
  });
});

describe("track unlocking", () => {
  it("only the first track starts unlocked", () => {
    const p = createProgress();
    expect(isTrackUnlocked(p, "100", 0)).toBe(true);
    for (let i = 1; i < TRACKS.length; i++) {
      expect(isTrackUnlocked(p, "100", i)).toBe(false);
    }
  });

  it("finishing a race unlocks the next track in that class only", () => {
    const p = createProgress();
    const unlocked = markRaceCompleted(p, "100", TRACKS[0]!.id);
    expect(unlocked?.id).toBe(TRACKS[1]!.id);
    expect(isTrackUnlocked(p, "100", 1)).toBe(true);
    expect(isTrackUnlocked(p, "100", 2)).toBe(false);
    expect(isTrackUnlocked(p, "150", 1)).toBe(false); // other class untouched
  });

  it("re-finishing a track unlocks nothing new", () => {
    const p = createProgress();
    markRaceCompleted(p, "100", TRACKS[0]!.id);
    expect(markRaceCompleted(p, "100", TRACKS[0]!.id)).toBeNull();
  });

  it("finishing the final track unlocks nothing and does not throw", () => {
    const p = createProgress();
    expect(markRaceCompleted(p, "100", TRACKS[TRACKS.length - 1]!.id)).toBeNull();
  });

  it("full chain unlocks every track", () => {
    const p = createProgress();
    for (const track of TRACKS) markRaceCompleted(p, "150", track.id);
    for (let i = 0; i < TRACKS.length; i++) {
      expect(isTrackUnlocked(p, "150", i)).toBe(true);
    }
  });
});
