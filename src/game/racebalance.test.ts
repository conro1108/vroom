// Whole-race balance: the vehicle tests measure lap times in isolation, which
// says nothing about whether a race against the field is *winnable*. This runs
// real group races — the actual opponent field, rubber banding, drafting,
// drift boosts, marshals — with a stand-in player driving one of the imperfect
// personalities from DRIVER_SPREAD, and checks the two things that make a race
// feel worth entering:
//
//   1. a decent human in the starter car wins a real share of them, and
//   2. nobody in the field ever escapes into a race of their own.
//
// Both are here because the game failed them: every bot could out-machine the
// player (skill ran to 1.01) while driving a near-flawless line, so the quick
// one gapped the field off any small mistake and never came back.
import { describe, expect, it } from "vitest";
import { createBot, DRIVER_SPREAD, type BotPersonality } from "./botdriver";
import {
  buildRoster,
  createOpponents,
  gridColumns,
  raceDistance,
  separateCars,
  stepOpponents,
  type Opponent,
} from "./opponents";
import { RACE_LAPS, SPEED_CLASSES } from "./progression";
import { createTrack, createTrackQuery, type TrackDef } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

const DT = 1 / 120;
const MAX_RACE_SECONDS = 400;
const CORRIDOR_PX = 150;
const RESCUE_PX = 220;

interface RaceResult {
  /** Where the stand-in player finished, 1 = won. */
  placement: number;
  /** Biggest lead, in laps, any racer ever held over the next one. */
  worstBreakaway: number;
}

/** One full group race: three bots plus a stand-in player in `vehicleId`,
 *  driving `driver`'s imperfect hands rather than the machine's line. */
function runRace(def: TrackDef, vehicleId: string, driver: BotPersonality, seed: number): RaceResult {
  const track = createTrack(def);
  const query = createTrackQuery(track);
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const cls = SPEED_CLASSES[1]!; // 150cc, the middle of the ladder
  const columns = gridColumns(4);
  const base = { ...DEFAULT_TUNING };
  const roster = buildRoster(vehicleId, 3, rng);
  const bots = createOpponents(track, query, roster, base, cls, rng, [0, 1, 2], columns);
  // The player is modelled as a fourth racer on full skill (their car is never
  // detuned) starting from the back of the grid, driving one of the imperfect
  // personalities — the closest a headless sim gets to a thumb on a phone.
  const playerField = createOpponents(
    track,
    query,
    [{ vehicleId, skill: 1 }],
    base,
    cls,
    rng,
    [3],
    columns
  );
  const player = playerField[0]!;
  player.bot = createBot(track, query, player.tuning, driver);

  const everyone = [player, ...bots];
  const finishedAt = new Map<Opponent, number>();
  let worstBreakaway = 0;
  let t = 0;

  while (t < MAX_RACE_SECONDS && finishedAt.size < everyone.length) {
    const context = { distance: raceDistance(player.tracker), car: player.car };
    stepOpponents(bots, query, DT, true, context, CORRIDOR_PX, RESCUE_PX, base.rescueTowSeconds);
    // the player gets no rubber band of their own — they're the reference
    stepOpponents(playerField, query, DT, true, null, CORRIDOR_PX, RESCUE_PX, base.rescueTowSeconds);
    separateCars(everyone.map((r) => r.car));
    t += DT;

    for (const r of everyone) {
      if (r.finishOrder !== null && !finishedAt.has(r)) finishedAt.set(r, t);
    }
    const order = everyone.map((r) => raceDistance(r.tracker)).sort((a, b) => b - a);
    if (order[0]! < RACE_LAPS) worstBreakaway = Math.max(worstBreakaway, order[0]! - order[1]!);
  }

  const time = (r: Opponent) => finishedAt.get(r) ?? Infinity;
  return {
    placement: 1 + bots.filter((b) => time(b) < time(player)).length,
    worstBreakaway,
  };
}

describe("race balance", () => {
  // A handful of races is enough to catch a field that's flatly unbeatable or
  // flatly a walkover; keep it small, each race is a few seconds of physics.
  const COURSES = ["meadow", "switchback", "reef"].map((id) => TRACKS.find((t) => t.id === id)!);
  const HANDS: [string, BotPersonality][] = [
    ["tidy", DRIVER_SPREAD[1]!],
    ["sloppy", DRIVER_SPREAD[3]!],
  ];

  const results = HANDS.map(([label, driver]) => ({
    label,
    races: COURSES.flatMap((course) => [7, 99].map((seed) => runRace(course, "classic", driver, seed))),
  }));

  it("the starter car can win races in imperfect hands, on every kind of track", () => {
    for (const { label, races } of results) {
      const wins = races.filter((r) => r.placement === 1).length;
      // A walkover in either direction is a broken race. The floor is the half
      // that matters: on the field this replaced, sloppy hands took 1 of these
      // 6 — the stand-in driver here is a machine holding a perfect line, so if
      // *it* can barely win, a thumb on a phone never does.
      expect(wins, `${label} hands, wins`).toBeGreaterThanOrEqual(2);
      expect(wins, `${label} hands, wins`).toBeLessThan(races.length);
    }
  });

  it("nobody escapes into a race of their own", () => {
    for (const { label, races } of results) {
      const worst = Math.max(...races.map((r) => r.worstBreakaway));
      // a third of a lap is the item system's comeback window (ITEM_GAP_WINDOW):
      // past that the leader is gone and nothing in the box can reach them
      expect(worst, `${label} hands, biggest breakaway`).toBeLessThan(0.35);
    }
  });
});
