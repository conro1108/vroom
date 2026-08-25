// Hand-run balance sims (not part of `npm test`; they take ~1-2 minutes).
//   npm run balance            # everything
//   npm run balance -- laps    # vehicle lap tables only
//   npm run balance -- race    # group race sims only
//   npm run balance -- laps meadow classic   # narrow to a track / vehicle
//
// Prints tables; the thresholds the old tests enforced are noted inline as
// "watch" numbers, so you can eyeball what used to fail a build.
import { CLEAN_DRIVER, createBot, DRIVER_SPREAD, simulateLap, type BotPersonality } from "../src/game/botdriver";
import {
  buildRoster,
  createOpponents,
  gridColumns,
  raceDistance,
  separateCars,
  stepOpponents,
  type Opponent,
} from "../src/game/opponents";
import { RACE_LAPS, SPEED_CLASSES } from "../src/game/progression";
import { createTrack, createTrackQuery, type TrackDef } from "../src/game/track";
import { TRACKS } from "../src/game/tracks";
import { DEFAULT_TUNING } from "../src/game/tuning";
import { VEHICLES } from "../src/game/vehicles";

const [mode = "all", ...filters] = process.argv.slice(2);
const only = (id: string) => filters.length === 0 || filters.includes(id);
const tracks = TRACKS.filter((t) => only(t.id) || filters.every((f) => !TRACKS.some((x) => x.id === f)));
const vehicles = VEHICLES.filter((v) => only(v.id) || filters.every((f) => !VEHICLES.some((x) => x.id === f)));

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;
const s = (ms: number) => (ms / 1000).toFixed(2);

// --- vehicle lap times: every car, every track, clean + imperfect drivers ---
function lapTables() {
  const DRIVERS = [CLEAN_DRIVER, ...DRIVER_SPREAD];
  console.log(`\n== lap times (s), ${DRIVERS.length} drivers per cell: clean / mean of sloppy ==`);
  console.log(["vehicle".padEnd(10), ...tracks.map((t) => t.id.padStart(13))].join(""));
  const totals: [string, number][] = [];
  const penalties: [string, number][] = [];
  const boosts: [string, number][] = [];
  for (const v of vehicles) {
    const tuning = { ...DEFAULT_TUNING, ...v.values };
    const cells: string[] = [];
    let noisyTotal = 0;
    let cleanTotal = 0;
    let earned = 0;
    for (const t of tracks) {
      const runs = DRIVERS.map((d) => simulateLap(t, tuning, 2, d));
      const clean = runs[0]!;
      const noisy = runs.slice(1);
      const dnf = runs.some((r) => r.lapMs === null);
      const grass = runs.some((r) => r.offroadFrac >= 0.2);
      earned += sum(noisy.map((r) => r.driftBoosts));
      if (dnf) {
        cells.push("DNF".padStart(13));
        continue;
      }
      const noisyMean = mean(noisy.map((r) => r.lapMs!));
      noisyTotal += sum(noisy.map((r) => r.lapMs!));
      cleanTotal += clean.lapMs!;
      cells.push(`${s(clean.lapMs!)}/${s(noisyMean)}${grass ? "*" : " "}`.padStart(13));
    }
    console.log(v.id.padEnd(10) + cells.join(""));
    totals.push([v.id, noisyTotal]);
    penalties.push([v.id, noisyTotal / (DRIVERS.length - 1) / cleanTotal]);
    boosts.push([v.id, earned]);
  }
  console.log("(* = a driver spent >20% of the lap on the grass)");

  const best = Math.min(...totals.map(([, t]) => t));
  console.log("\n-- total sloppy time vs best vehicle (watch: > 1.08) --");
  for (const [id, t] of totals) console.log(`${id.padEnd(10)} ${(t / best).toFixed(3)}`);
  const gentlest = Math.min(...penalties.map(([, p]) => p));
  console.log("\n-- sloppiness penalty vs most forgiving car (watch: > 1.15) --");
  for (const [id, p] of penalties) console.log(`${id.padEnd(10)} ${(p / gentlest).toFixed(3)}`);
  console.log("\n-- drift boosts earned across all sloppy runs (watch: driftking <= slotcar) --");
  for (const [id, n] of boosts) console.log(`${id.padEnd(10)} ${n}`);
}

// --- whole-race balance: a stand-in player in the starter car vs the field ---
const DT = 1 / 120;
const MAX_RACE_SECONDS = 400;
const CORRIDOR_PX = 150;
const RESCUE_PX = 220;

function runRace(def: TrackDef, vehicleId: string, driver: BotPersonality, seed: number) {
  const track = createTrack(def);
  const query = createTrackQuery(track);
  let st = seed;
  const rng = () => {
    st = (st * 1664525 + 1013904223) % 4294967296;
    return st / 4294967296;
  };
  const cls = SPEED_CLASSES[1]!; // 150cc
  const columns = gridColumns(4);
  const base = { ...DEFAULT_TUNING };
  const bots = createOpponents(track, query, buildRoster(vehicleId, 3, rng), base, cls, rng, [0, 1, 2], columns);
  const playerField = createOpponents(track, query, [{ vehicleId, skill: 1 }], base, cls, rng, [3], columns);
  const player = playerField[0]!;
  player.bot = createBot(track, query, player.tuning, driver);

  const everyone = [player, ...bots];
  const finishedAt = new Map<Opponent, number>();
  let worstBreakaway = 0;
  let t = 0;
  while (t < MAX_RACE_SECONDS && finishedAt.size < everyone.length) {
    const context = { distance: raceDistance(player.tracker), car: player.car };
    stepOpponents(bots, query, DT, true, context, CORRIDOR_PX, RESCUE_PX, base.rescueTowSeconds);
    stepOpponents(playerField, query, DT, true, null, CORRIDOR_PX, RESCUE_PX, base.rescueTowSeconds);
    separateCars(everyone.map((r) => r.car));
    t += DT;
    for (const r of everyone) if (r.finishOrder !== null && !finishedAt.has(r)) finishedAt.set(r, t);
    const order = everyone.map((r) => raceDistance(r.tracker)).sort((a, b) => b - a);
    if (order[0]! < RACE_LAPS) worstBreakaway = Math.max(worstBreakaway, order[0]! - order[1]!);
  }
  const time = (r: Opponent) => finishedAt.get(r) ?? Infinity;
  return { placement: 1 + bots.filter((b) => time(b) < time(player)).length, worstBreakaway };
}

function raceTables() {
  const courses = tracks.filter((t) => filters.length > 0 || ["meadow", "switchback", "reef"].includes(t.id));
  const hands: [string, BotPersonality][] = [
    ["tidy", DRIVER_SPREAD[1]!],
    ["sloppy", DRIVER_SPREAD[3]!],
  ];
  console.log("\n== group races, starter car at 150cc: placement / worst breakaway (laps) ==");
  console.log(["hands".padEnd(8), ...courses.map((c) => c.id.padStart(12))].join(""));
  for (const [label, driver] of hands) {
    const results = courses.map((c) => [7, 99].map((seed) => runRace(c, "classic", driver, seed)));
    const cells = results.map((rs) => rs.map((r) => `P${r.placement}/${r.worstBreakaway.toFixed(2)}`).join(" ").padStart(12));
    const wins = results.flat().filter((r) => r.placement === 1).length;
    console.log(label.padEnd(8) + cells.join("") + `   wins ${wins}/${results.flat().length}`);
  }
  console.log("(watch: wins < 2 or wins == all; breakaway > 0.35)");
}

const t0 = Date.now();
if (mode === "all" || mode === "laps") lapTables();
if (mode === "all" || mode === "race") raceTables();
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
