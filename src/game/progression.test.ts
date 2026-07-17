import { describe, expect, it } from "vitest";
import { CUPS } from "./cups";
import {
  applySpeedClass,
  createProgress,
  isCupUnlocked,
  parseProgress,
  PODIUM_PLACEMENT,
  recordCupResult,
  SPEED_CLASSES,
  speedClassById,
} from "./progression";
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

describe("cup unlocking", () => {
  it("only the Sprout Cup starts unlocked", () => {
    const p = createProgress();
    expect(isCupUnlocked(p, "100", "sprout")).toBe(true);
    for (const cup of CUPS.slice(1)) {
      expect(isCupUnlocked(p, "100", cup.id)).toBe(false);
    }
  });

  it("a Sprout podium opens Dune in that class only, not the win-gated Tide", () => {
    const p = createProgress();
    const unlocked = recordCupResult(p, "100", "sprout", PODIUM_PLACEMENT);
    expect(unlocked.map((c) => c.id)).toEqual(["dune"]);
    expect(isCupUnlocked(p, "100", "tide")).toBe(false);
    expect(isCupUnlocked(p, "150", "dune")).toBe(false); // other class untouched
  });

  it("a Sprout win opens both branches at once", () => {
    const p = createProgress();
    const unlocked = recordCupResult(p, "100", "sprout", 1);
    expect(unlocked.map((c) => c.id).sort()).toEqual(["dune", "tide"]);
  });

  it("finishing off the podium unlocks nothing", () => {
    const p = createProgress();
    expect(recordCupResult(p, "100", "sprout", PODIUM_PLACEMENT + 1)).toEqual([]);
    expect(isCupUnlocked(p, "100", "dune")).toBe(false);
  });

  it("Frost opens from either converging branch", () => {
    const viaDune = createProgress();
    recordCupResult(viaDune, "100", "sprout", 1);
    recordCupResult(viaDune, "100", "dune", 3);
    expect(isCupUnlocked(viaDune, "100", "frost")).toBe(true);

    const viaTide = createProgress();
    recordCupResult(viaTide, "100", "sprout", 1);
    recordCupResult(viaTide, "100", "tide", 2);
    expect(isCupUnlocked(viaTide, "100", "frost")).toBe(true);
  });

  it("a Dune win skips straight to Dusk without Frost", () => {
    const p = createProgress();
    recordCupResult(p, "100", "sprout", 2);
    const unlocked = recordCupResult(p, "100", "dune", 1);
    expect(unlocked.map((c) => c.id).sort()).toEqual(["dusk", "frost"]);
  });

  it("a better placement later still counts (best placement is kept)", () => {
    const p = createProgress();
    recordCupResult(p, "100", "sprout", 4);
    recordCupResult(p, "100", "sprout", 1);
    expect(recordCupResult(p, "100", "sprout", 3)).toEqual([]); // worse result can't relock
    expect(isCupUnlocked(p, "100", "tide")).toBe(true);
  });

  it("winning everything unlocks every cup", () => {
    const p = createProgress();
    for (const cup of CUPS) recordCupResult(p, "150", cup.id, 1);
    for (const cup of CUPS) {
      expect(isCupUnlocked(p, "150", cup.id)).toBe(true);
    }
  });
});

describe("saved progress", () => {
  it("round-trips the current shape", () => {
    const p = createProgress();
    recordCupResult(p, "100", "sprout", 2);
    p.lastVehicle = "muscle";
    const parsed = parseProgress(JSON.stringify(p));
    expect(parsed).toEqual(p);
  });

  it("defaults to group and parses a saved solo mode", () => {
    expect(createProgress().raceMode).toBe("group");
    const parsed = parseProgress(JSON.stringify({ raceMode: "solo" }));
    expect(parsed.raceMode).toBe("solo");
  });

  it("falls back to the default on a garbage raceMode", () => {
    const parsed = parseProgress(JSON.stringify({ raceMode: "chaos" }));
    expect(parsed.raceMode).toBe("group");
  });

  it("migrates old per-track placements onto their cups, keeping the best", () => {
    const parsed = parseProgress(
      JSON.stringify({
        placements: { "100": { meadow: 4, speedway: 1, serpent: 2 } },
        lastClass: "100",
      })
    );
    // meadow/speedway live in Sprout: best of (4, 1) = a win
    expect(isCupUnlocked(parsed, "100", "dune")).toBe(true);
    expect(isCupUnlocked(parsed, "100", "tide")).toBe(true);
    // serpent now lives in Dune: podium there opens Frost
    expect(isCupUnlocked(parsed, "100", "frost")).toBe(true);
    expect(parsed.lastClass).toBe("100");
  });

  it("migrates the oldest finished-track lists as podiums", () => {
    const parsed = parseProgress(JSON.stringify({ completed: { "100": ["meadow"] } }));
    expect(isCupUnlocked(parsed, "100", "dune")).toBe(true);
    expect(isCupUnlocked(parsed, "100", "tide")).toBe(false); // podium ≠ win
  });
});
