import { describe, expect, it } from "vitest";
import {
  buildRoster,
  createOpponents,
  gridSlot,
  OPPONENT_COUNT,
  playerPlacement,
  rubberMult,
  stepOpponents,
} from "./opponents";
import { SPEED_CLASSES } from "./progression";
import { createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);
const rng = () => 0.42; // deterministic

function field() {
  const roster = buildRoster("classic", OPPONENT_COUNT, rng);
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

  it("keeps every grid slot on the road, on every track", () => {
    for (const def of TRACKS) {
      const t = createTrack(def);
      const q = createTrackQuery(t);
      for (const columns of [2, 3]) {
        for (let i = 0; i < 12; i++) {
          const pos = gridSlot(t, i, columns);
          expect(q.surfaceAt(pos.x, pos.y), `${def.id} slot ${i} of ${columns} wide`).toBe("road");
        }
      }
    }
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
      expect(Math.hypot(o.car.x - before[i]!.x, o.car.y - before[i]!.y)).toBeGreaterThan(20);
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

  it("rubber banding slows bots ahead of the player and hurries bots behind", () => {
    expect(rubberMult(0.2, 0.2)).toBeLessThan(1);
    expect(rubberMult(-0.2, 0.2)).toBeGreaterThan(1);
    expect(rubberMult(0, 0.2)).toBe(1);
  });
});
