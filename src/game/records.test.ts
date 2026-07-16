import { describe, expect, it } from "vitest";
import { applyLap, applyRace, getRecords, type Records } from "./records";

describe("records", () => {
  it("first lap and race always set records", () => {
    const r: Records = {};
    expect(applyLap(r, "meadow", "100", 32000)).toBe(true);
    expect(applyRace(r, "meadow", "100", 99000)).toBe(true);
    expect(getRecords(r, "meadow", "100")).toEqual({ bestLapMs: 32000, bestRaceMs: 99000 });
  });

  it("only faster times replace records", () => {
    const r: Records = {};
    applyLap(r, "meadow", "100", 32000);
    expect(applyLap(r, "meadow", "100", 33000)).toBe(false);
    expect(applyLap(r, "meadow", "100", 32000)).toBe(false); // tie is not a new record
    expect(applyLap(r, "meadow", "100", 31000)).toBe(true);
    expect(getRecords(r, "meadow", "100").bestLapMs).toBe(31000);
  });

  it("records are independent per track and speed class", () => {
    const r: Records = {};
    applyLap(r, "meadow", "100", 32000);
    applyLap(r, "meadow", "150", 28000);
    applyLap(r, "speedway", "100", 40000);
    expect(getRecords(r, "meadow", "100").bestLapMs).toBe(32000);
    expect(getRecords(r, "meadow", "150").bestLapMs).toBe(28000);
    expect(getRecords(r, "speedway", "100").bestLapMs).toBe(40000);
    expect(getRecords(r, "speedway", "150").bestLapMs).toBeNull();
  });

  it("lap and race records do not clobber each other", () => {
    const r: Records = {};
    applyRace(r, "meadow", "100", 99000);
    applyLap(r, "meadow", "100", 32000);
    expect(getRecords(r, "meadow", "100")).toEqual({ bestLapMs: 32000, bestRaceMs: 99000 });
  });
});
