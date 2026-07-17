import { describe, expect, it } from "vitest";
import {
  createCupState,
  cupPoints,
  CUPS,
  cupStandings,
  playerCupPlacement,
  RACES_PER_CUP,
  recordCupRace,
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

  it("points fall off by placement and floor at 1", () => {
    expect(cupPoints(1)).toBeGreaterThan(cupPoints(2));
    expect(cupPoints(2)).toBeGreaterThan(cupPoints(3));
    expect(cupPoints(8)).toBe(1);
  });

  it("accumulates race placements into standings", () => {
    const state = createCupState("sprout", roster);
    recordCupRace(state, [2, 1, 3, 4]); // player 2nd
    recordCupRace(state, [1, 2, 3, 4]); // player wins
    // player: 7+10=17, bot0: 10+7=17, bot1: 4+4, bot2: 2+2
    const standings = cupStandings(state);
    expect(standings[0]!.index).toBe(0); // tie breaks toward the player
    expect(standings[0]!.points).toBe(17);
    expect(playerCupPlacement(state)).toBe(1);
  });

  it("a bad series lands the player down the order", () => {
    const state = createCupState("sprout", roster);
    for (let i = 0; i < RACES_PER_CUP; i++) recordCupRace(state, [4, 1, 2, 3]);
    expect(playerCupPlacement(state)).toBe(4);
  });
});
