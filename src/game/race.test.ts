import { describe, expect, it } from "vitest";
import { bestSplitIndex, completeLap, createRace, raceTotalMs } from "./race";

describe("race", () => {
  it("finishes after the configured lap count", () => {
    const race = createRace(3);
    expect(completeLap(race, 30000).finished).toBe(false);
    expect(race.lap).toBe(2);
    expect(completeLap(race, 31000).finished).toBe(false);
    expect(race.lap).toBe(3);
    expect(completeLap(race, 29000).finished).toBe(true);
    expect(race.splits).toEqual([30000, 31000, 29000]);
  });

  it("totals the splits and finds the best lap", () => {
    const race = createRace(3);
    completeLap(race, 30000);
    completeLap(race, 31000);
    completeLap(race, 29000);
    expect(raceTotalMs(race)).toBe(90000);
    expect(bestSplitIndex(race)).toBe(2);
  });

  it("ignores extra laps after the finish", () => {
    const race = createRace(3);
    completeLap(race, 1);
    completeLap(race, 2);
    completeLap(race, 3);
    expect(completeLap(race, 4).finished).toBe(true);
    expect(race.splits).toHaveLength(3);
    expect(race.lap).toBe(3);
  });
});
