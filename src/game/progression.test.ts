import { describe, expect, it } from "vitest";
import { CUPS } from "./cups";
import { createProgress, isCupUnlocked, parseProgress, recordCupResult } from "./progression";

describe("cup unlocking", () => {
  it("only the Sprout Cup starts unlocked", () => {
    const p = createProgress();
    expect(isCupUnlocked(p, "100", "sprout")).toBe(true);
    for (const cup of CUPS.slice(1)) {
      expect(isCupUnlocked(p, "100", cup.id)).toBe(false);
    }
  });

  it("a Sprout win opens both branches at once", () => {
    const p = createProgress();
    const unlocked = recordCupResult(p, "100", "sprout", 1);
    expect(unlocked.map((c) => c.id).sort()).toEqual(["dune", "tide"]);
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
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
  });

  it("falls back to the default on a garbage raceMode", () => {
    const parsed = parseProgress(JSON.stringify({ raceMode: "chaos" }));
    expect(parsed.raceMode).toBe("group");
  });
});
