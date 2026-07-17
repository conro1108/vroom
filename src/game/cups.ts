// Cups: the progression nodes. Each cup is a series of four themed tracks,
// three laps each; per-race placements convert to points against a bot
// roster that stays fixed for the whole series, and total points decide the
// cup placement that unlocks the next nodes. The unlock relation is a graph
// (any satisfied rule opens a cup), so paths can branch, converge, and skip.
import { VEHICLES } from "./vehicles";

export interface CupUnlock {
  cup: string; // cup id the result must come from
  result: "podium" | "win";
}

export interface CupDef {
  id: string;
  name: string;
  icon: string; // map badge
  theme: string; // WorldTheme id in render/themes.ts
  trackIds: string[];
  /** Absent = open from the start; otherwise ANY satisfied rule opens it. */
  unlock?: CupUnlock[];
  /** Node position on the progression map, 0..1 of the map box. */
  map: { x: number; y: number };
}

export const CUPS: CupDef[] = [
  {
    id: "sprout",
    name: "Sprout Cup",
    icon: "🌱",
    theme: "meadow",
    trackIds: ["meadow", "speedway", "daisy", "lagoon"],
    map: { x: 0.18, y: 0.82 },
  },
  {
    id: "dune",
    name: "Dune Cup",
    icon: "🌵",
    theme: "desert",
    trackIds: ["mirage", "serpent", "sidewinder", "scorch"],
    unlock: [{ cup: "sprout", result: "podium" }],
    map: { x: 0.62, y: 0.72 },
  },
  {
    id: "tide",
    name: "Tide Cup",
    icon: "🌊",
    theme: "tide",
    trackIds: ["cove", "boardwalk", "reef", "breaker"],
    unlock: [{ cup: "sprout", result: "win" }],
    map: { x: 0.16, y: 0.42 },
  },
  {
    id: "frost",
    name: "Frost Cup",
    icon: "❄️",
    theme: "frost",
    trackIds: ["switchback", "glacier", "icicle", "avalanche"],
    // converging paths: either branch gets you into the mountains
    unlock: [
      { cup: "dune", result: "podium" },
      { cup: "tide", result: "podium" },
    ],
    map: { x: 0.52, y: 0.32 },
  },
  {
    id: "dusk",
    name: "Dusk Cup",
    icon: "🌙",
    theme: "dusk",
    trackIds: ["knot", "gauntlet", "rally", "starlight"],
    // the long road in — or the shortcut for dominating the dunes
    unlock: [
      { cup: "frost", result: "podium" },
      { cup: "dune", result: "win" },
    ],
    map: { x: 0.84, y: 0.14 },
  },
];

export function cupById(id: string): CupDef {
  return CUPS.find((c) => c.id === id) ?? CUPS[0]!;
}

export const RACES_PER_CUP = 4;

// Points per race placement (1st, 2nd, ...); everyone past the table gets 1.
const PLACEMENT_POINTS = [10, 7, 4, 2];

export function cupPoints(placement: number): number {
  return PLACEMENT_POINTS[placement - 1] ?? 1;
}

/** A bot seat that persists across the whole series. */
export interface RosterEntry {
  vehicleId: string;
  skill: number;
}

/** Live state of one cup series: index 0 in `points` is always the player. */
export interface CupState {
  cupId: string;
  raceIndex: number; // 0-based race currently being run
  roster: RosterEntry[];
  points: number[]; // [player, ...roster] running totals
  lastRacePoints: number[]; // points earned in the most recent race
}

export function createCupState(cupId: string, roster: RosterEntry[]): CupState {
  return {
    cupId,
    raceIndex: 0,
    roster,
    points: new Array(roster.length + 1).fill(0),
    lastRacePoints: new Array(roster.length + 1).fill(0),
  };
}

/** Fold one race's placements (index 0 = player) into the series totals. */
export function recordCupRace(state: CupState, placements: number[]): void {
  state.lastRacePoints = placements.map(cupPoints);
  state.lastRacePoints.forEach((p, i) => (state.points[i]! += p));
}

/** Series standings, best first. Ties break toward the player (index 0),
 * then by roster order, so standings are stable and never coin-flip. */
export function cupStandings(state: CupState): { index: number; points: number }[] {
  return state.points
    .map((points, index) => ({ index, points }))
    .sort((a, b) => b.points - a.points || a.index - b.index);
}

/** The player's current (or final) placement in the series. */
export function playerCupPlacement(state: CupState): number {
  return cupStandings(state).findIndex((s) => s.index === 0) + 1;
}
