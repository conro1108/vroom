import { describe, expect, it } from "vitest";
import {
  createCupState,
  cupPoints,
  CUPS,
  cupStandings,
  playerCupPlacement,
  RACES_PER_CUP,
  recordCupRace,
  startingGrid,
  type RosterEntry,
} from "./cups";
import { TRACKS } from "./tracks";
import { THEMES } from "../render/themes";

describe("cup catalog", () => {
  it("every cup has four real, unshared tracks and a real theme", () => {
    const seen = new Set<string>();
    for (const cup of CUPS) {
      expect(cup.trackIds).toHaveLength(RACES_PER_CUP);
      expect(THEMES[cup.theme], `${cup.id} theme`).toBeDefined();
      for (const id of cup.trackIds) {
        expect(TRACKS.some((t) => t.id === id), `${cup.id} track ${id}`).toBe(true);
        expect(seen.has(id), `${id} appears in two cups`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("every track in the catalog belongs to a cup", () => {
    const inCups = new Set(CUPS.flatMap((c) => c.trackIds));
    for (const t of TRACKS) {
      expect(inCups.has(t.id), `${t.id} is orphaned`).toBe(true);
    }
  });

  it("unlock rules reference real cups and the graph has a reachable root", () => {
    const ids = new Set(CUPS.map((c) => c.id));
    expect(CUPS.some((c) => !c.unlock)).toBe(true); // at least one open cup
    for (const cup of CUPS) {
      for (const rule of cup.unlock ?? []) {
        expect(ids.has(rule.cup), `${cup.id} unlock via ${rule.cup}`).toBe(true);
        expect(rule.cup).not.toBe(cup.id);
      }
    }
  });
});

describe("cup series scoring", () => {
  const roster: RosterEntry[] = [
    { vehicleId: "slotcar", skill: 0.85 },
    { vehicleId: "muscle", skill: 0.93 },
    { vehicleId: "gokart", skill: 1.01 },
  ];

  it("points fall off linearly and floor at 1", () => {
    expect(cupPoints(1, 4)).toBeGreaterThan(cupPoints(2, 4));
    expect(cupPoints(2, 4)).toBeGreaterThan(cupPoints(3, 4));
    expect(cupPoints(4, 4)).toBe(1); // last still scores
    expect(cupPoints(8, 4)).toBe(1); // beyond the field floors, never zero
  });

  it("scales the point spread with the pool, not top-heavy", () => {
    // first place is worth the field size; the gap to second is always 1
    expect(cupPoints(1, 12)).toBe(12);
    expect(cupPoints(1, 12) - cupPoints(2, 12)).toBe(1);
    expect(cupPoints(1, 4) - cupPoints(2, 4)).toBe(1);
  });

  it("accumulates race placements into standings", () => {
    const state = createCupState("sprout", roster); // field of 4
    recordCupRace(state, [2, 1, 3, 4]); // player 2nd
    recordCupRace(state, [1, 2, 3, 4]); // player wins
    // player: 3+4=7, bot0: 4+3=7, bot1: 2+2=4, bot2: 1+1=2
    const standings = cupStandings(state);
    expect(standings[0]!.index).toBe(0); // tie breaks toward the player
    expect(standings[0]!.points).toBe(7);
    expect(playerCupPlacement(state)).toBe(1);
  });

  it("a bad series lands the player down the order", () => {
    const state = createCupState("sprout", roster);
    for (let i = 0; i < RACES_PER_CUP; i++) recordCupRace(state, [4, 1, 2, 3]);
    expect(playerCupPlacement(state)).toBe(4);
  });
});

describe("starting grid", () => {
  const roster: RosterEntry[] = [
    { vehicleId: "slotcar", skill: 0.85 },
    { vehicleId: "muscle", skill: 0.93 },
    { vehicleId: "gokart", skill: 1.01 },
  ];

  it("opens with the player at the back, bots in the front rows", () => {
    const state = createCupState("sprout", roster); // raceIndex 0
    // player (index 0) is last; opponents fill the front
    expect(startingGrid(state)).toEqual([3, 0, 1, 2]);
  });

  it("grids later races by reverse standings — the series leader starts last", () => {
    const state = createCupState("sprout", roster);
    recordCupRace(state, [1, 2, 3, 4]); // player leads the cup, bot2 dead last
    state.raceIndex = 1;
    const grid = startingGrid(state);
    // grid[racer] = slot; 0 is pole. Player leads, so player gets the last slot.
    expect(grid[0]).toBe(3); // player: cup leader, starts furthest back
    expect(grid[3]).toBe(0); // bot2: cup backmarker, starts on pole
    expect([...grid].sort()).toEqual([0, 1, 2, 3]); // every slot used once
  });
});
