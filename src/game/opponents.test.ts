import { describe, expect, it } from "vitest";
import {
  buildRoster,
  createOpponents,
  gridSlot,
  OPPONENT_COUNT,
  playerGridSlot,
  playerPlacement,
  playerPosition,
  rubberMult,
  separateCars,
  skillSpread,
  stepOpponents,
} from "./opponents";
import { createCarState } from "./physics";
import { RACE_LAPS, SPEED_CLASSES } from "./progression";
import { createLapTracker, createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);
const rng = () => 0.42; // deterministic

function field(count = OPPONENT_COUNT) {
  const roster = buildRoster("classic", count, rng);
  return createOpponents(track, query, roster, { ...DEFAULT_TUNING }, SPEED_CLASSES[0]!, rng);
}

describe("opponent field", () => {
  it("fields three distinct vehicles, never the player's", () => {
    const opponents = field();
    expect(opponents).toHaveLength(OPPONENT_COUNT);
    const ids = opponents.map((o) => o.vehicleId);
    expect(new Set(ids).size).toBe(OPPONENT_COUNT);
    expect(ids).not.toContain("classic");
  });

  it("fields any requested count, reusing vehicles but never the player's", () => {
    const opponents = field(7);
    expect(opponents).toHaveLength(7);
    expect(opponents.map((o) => o.vehicleId)).not.toContain("classic");
  });

  it("the same roster fields the same seats again (a cup series rematch)", () => {
    const roster = buildRoster("classic", 3, rng);
    const a = createOpponents(track, query, roster, { ...DEFAULT_TUNING }, SPEED_CLASSES[0]!, rng);
    const b = createOpponents(track, query, roster, { ...DEFAULT_TUNING }, SPEED_CLASSES[0]!, rng);
    expect(a.map((o) => o.vehicleId)).toEqual(b.map((o) => o.vehicleId));
    expect(a.map((o) => o.tuning.maxSpeed)).toEqual(b.map((o) => o.tuning.maxSpeed));
  });

  it("spreads skill evenly across the field", () => {
    const three = skillSpread(3);
    [0.85, 0.93, 1.01].forEach((v, i) => expect(three[i]).toBeCloseTo(v));
    const seven = skillSpread(7);
    expect(seven).toHaveLength(7);
    expect(Math.min(...seven)).toBeCloseTo(0.85);
    expect(Math.max(...seven)).toBeCloseTo(1.01);
  });

  it("grid slots sit on the road just behind the start line", () => {
    for (let i = 0; i < 4; i++) {
      const pos = gridSlot(track, i);
      expect(query.surfaceAt(pos.x, pos.y)).toBe("road");
      const p = query.progressAt(pos.x, pos.y)!;
      expect(p).toBeGreaterThan(0.9); // just before the line, not past it
    }
    const player = playerGridSlot(track);
    const bot = gridSlot(track, 0);
    expect(Math.hypot(player.x - bot.x, player.y - bot.y)).toBeGreaterThan(10);
  });

  it("bots hold still before the green light and race after it", () => {
    const opponents = field();
    const before = opponents.map((o) => ({ x: o.car.x, y: o.car.y }));
    for (let i = 0; i < 60; i++) stepOpponents(opponents, query, 1 / 120, false);
    opponents.forEach((o, i) => {
      expect(o.car.x).toBeCloseTo(before[i]!.x, 5);
      expect(o.car.y).toBeCloseTo(before[i]!.y, 5);
    });
    for (let i = 0; i < 240; i++) stepOpponents(opponents, query, 1 / 120, true);
    opponents.forEach((o, i) => {
      const moved = Math.hypot(o.car.x - before[i]!.x, o.car.y - before[i]!.y);
      expect(moved).toBeGreaterThan(20);
    });
  });

  it("bots complete the race and take distinct finish orders", () => {
    const opponents = field();
    for (let i = 0; i < 120 * 120 && opponents.some((o) => o.finishOrder === null); i++) {
      stepOpponents(opponents, query, 1 / 120, true);
    }
    const orders = opponents.map((o) => o.finishOrder);
    expect(orders).not.toContain(null);
    expect(new Set(orders).size).toBe(OPPONENT_COUNT);
    expect(playerPlacement(opponents)).toBe(OPPONENT_COUNT + 1); // player last
  });
});

describe("standings", () => {
  it("counts racers ahead by distance and finished racers as ahead", () => {
    const opponents = field();
    const player = createLapTracker(0);
    player.lap = 2;
    player.accum = 0.5; // 1.5 laps in
    opponents[0]!.tracker.lap = 3; // 2.x laps: ahead
    opponents[0]!.tracker.accum = 0.1;
    opponents[1]!.tracker.lap = 2; // 1.2 laps: behind
    opponents[1]!.tracker.accum = 0.2;
    opponents[2]!.finishOrder = 1; // done: ahead
    expect(playerPosition(player, opponents)).toBe(3);
  });

  it("caps distance at the finish so a cruising bot doesn't gain", () => {
    const opponents = field();
    const player = createLapTracker(0);
    player.lap = RACE_LAPS + 1; // player finished too
    opponents[0]!.tracker.lap = RACE_LAPS + 1;
    opponents[0]!.tracker.accum = 0.9; // still driving around
    expect(playerPosition(player, opponents)).toBeLessThanOrEqual(2);
  });
});

describe("rubber banding", () => {
  it("slows bots ahead of the player and hurries bots behind", () => {
    expect(rubberMult(0.2, 0.2)).toBeLessThan(1);
    expect(rubberMult(-0.2, 0.2)).toBeGreaterThan(1);
    expect(rubberMult(0, 0.2)).toBe(1);
  });

  it("saturates instead of growing without bound", () => {
    expect(rubberMult(5, 0.2)).toBeCloseTo(0.8);
    expect(rubberMult(-5, 0.2)).toBeCloseTo(1.2);
  });

  it("a bot far ahead of the player covers less ground than one far behind", () => {
    const ahead = field(1);
    const behind = field(1);
    ahead[0]!.tracker.lap = 3; // ~2 laps covered, a full lap up on the player
    behind[0]!.tracker.lap = 1; // still on the opening lap, a lap down
    // player mid-race, parked far off in a corner so no one drafts off them
    const player = { distance: 1.0, car: createCarState(5, 5, 0) };
    for (let i = 0; i < 600; i++) {
      stepOpponents(ahead, query, 1 / 120, true, player);
      stepOpponents(behind, query, 1 / 120, true, player);
    }
    const speed = (o: { car: { vx: number; vy: number } }) => Math.hypot(o.car.vx, o.car.vy);
    expect(speed(ahead[0]!)).toBeLessThan(speed(behind[0]!));
  });
});

describe("car separation", () => {
  it("pushes overlapping cars apart to the minimum distance", () => {
    const a = createCarState(100, 100, 0);
    const b = createCarState(104, 100, 0);
    separateCars([a, b], 12);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(12, 5);
  });

  it("bounces closing velocity without adding energy", () => {
    const a = createCarState(100, 100, 0);
    const b = createCarState(106, 100, 0);
    a.vx = 100; // driving into b
    separateCars([a, b], 12);
    expect(a.vx).toBeLessThan(100);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx + b.vx).toBeCloseTo(100, 3); // momentum-ish conserved
  });

  it("leaves separated cars alone", () => {
    const a = createCarState(100, 100, 0);
    const b = createCarState(200, 100, 0);
    a.vx = 50;
    separateCars([a, b], 12);
    expect(a.x).toBe(100);
    expect(b.x).toBe(200);
    expect(a.vx).toBe(50);
  });
});
