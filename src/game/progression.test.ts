import { describe, expect, it } from "vitest";
import {
  applySpeedClass,
  createProgress,
  isTrackUnlocked,
  parseProgress,
  PODIUM_PLACEMENT,
  recordRaceResult,
  SPEED_CLASSES,
  speedClassById,
} from "./progression";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

const trackIndex = (id: string) => TRACKS.findIndex((t) => t.id === id);

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

  it("a podium unlocks the next main-line track in that class only", () => {
    const p = createProgress();
    const unlocked = recordRaceResult(p, "100", "meadow", PODIUM_PLACEMENT);
    expect(unlocked.map((t) => t.id)).toEqual(["speedway"]);
    expect(isTrackUnlocked(p, "100", trackIndex("speedway"))).toBe(true);
    expect(isTrackUnlocked(p, "100", trackIndex("serpent"))).toBe(false);
    expect(isTrackUnlocked(p, "150", trackIndex("speedway"))).toBe(false); // other class untouched
  });

  it("finishing off the podium unlocks nothing", () => {
    const p = createProgress();
    expect(recordRaceResult(p, "100", "meadow", PODIUM_PLACEMENT + 1)).toEqual([]);
    expect(isTrackUnlocked(p, "100", trackIndex("speedway"))).toBe(false);
  });

  it("a win on speedway opens both the main line and the Lost Lagoon branch", () => {
    const p = createProgress();
    recordRaceResult(p, "100", "meadow", 1);
    const unlocked = recordRaceResult(p, "100", "speedway", 1);
    expect(unlocked.map((t) => t.id).sort()).toEqual(["lagoon", "serpent"]);
  });

  it("a podium on speedway opens serpent but not the win-gated lagoon", () => {
    const p = createProgress();
    recordRaceResult(p, "100", "meadow", 2);
    const unlocked = recordRaceResult(p, "100", "speedway", 3);
    expect(unlocked.map((t) => t.id)).toEqual(["serpent"]);
    expect(isTrackUnlocked(p, "100", trackIndex("lagoon"))).toBe(false);
  });

  it("a better placement later still counts (best placement is kept)", () => {
    const p = createProgress();
    recordRaceResult(p, "100", "speedway", 4);
    recordRaceResult(p, "100", "speedway", 1);
    expect(recordRaceResult(p, "100", "speedway", 3)).toEqual([]); // worse result can't relock
    expect(isTrackUnlocked(p, "100", trackIndex("lagoon"))).toBe(true);
  });

  it("repeating a result unlocks nothing new", () => {
    const p = createProgress();
    recordRaceResult(p, "100", "meadow", 1);
    expect(recordRaceResult(p, "100", "meadow", 1)).toEqual([]);
  });

  it("winning everything unlocks every track", () => {
    const p = createProgress();
    for (const track of TRACKS) recordRaceResult(p, "150", track.id, 1);
    for (let i = 0; i < TRACKS.length; i++) {
      expect(isTrackUnlocked(p, "150", i)).toBe(true);
    }
  });
});

describe("saved progress", () => {
  it("parses the current shape", () => {
    const p = createProgress();
    recordRaceResult(p, "100", "meadow", 2);
    p.lastVehicle = "muscle";
    const parsed = parseProgress(JSON.stringify(p));
    expect(parsed).toEqual(p);
  });

  it("migrates the old finished-track lists as podiums", () => {
    const parsed = parseProgress(
      JSON.stringify({ completed: { "100": ["meadow", "speedway"] }, lastClass: "100" })
    );
    expect(isTrackUnlocked(parsed, "100", trackIndex("serpent"))).toBe(true);
    expect(isTrackUnlocked(parsed, "100", trackIndex("lagoon"))).toBe(false); // podium ≠ win
    expect(parsed.lastClass).toBe("100");
  });
});
