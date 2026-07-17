import { describe, expect, it } from "vitest";
import { simulateLap, type LapResult } from "./botdriver";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING, type Tuning } from "./tuning";
import { activeVehicleId, applyVehicle, VEHICLES } from "./vehicles";

describe("vehicles", () => {
  it("has uniquely named vehicles", () => {
    expect(new Set(VEHICLES.map((v) => v.id)).size).toBe(VEHICLES.length);
    expect(new Set(VEHICLES.map((v) => v.name)).size).toBe(VEHICLES.length);
  });

  it("Classic matches the shipped defaults, so fresh installs show it active", () => {
    expect(activeVehicleId({ ...DEFAULT_TUNING })).toBe("classic");
  });

  it("applying any vehicle makes it the active one", () => {
    for (const vehicle of VEHICLES) {
      const tuning: Tuning = { ...DEFAULT_TUNING };
      applyVehicle(tuning, vehicle);
      expect(activeVehicleId(tuning)).toBe(vehicle.id);
    }
  });

  it("a manual tweak on top of a vehicle deactivates it", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING };
    applyVehicle(tuning, VEHICLES[1]!);
    tuning.turnRate += 0.1;
    expect(activeVehicleId(tuning)).toBeNull();
  });

  it("vehicles leave control and camera preferences untouched", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, steerMode: "dragx", holdToGo: false, cameraLerp: 9 };
    for (const vehicle of VEHICLES) applyVehicle(tuning, vehicle);
    expect(tuning.steerMode).toBe("dragx");
    expect(tuning.holdToGo).toBe(false);
    expect(tuning.cameraLerp).toBe(9);
  });
});

// Every vehicle must stay raceable and competitive: the bot driver stands in
// for an equally skilled player in each seat. If a rebalance makes one
// vehicle dominant or hopeless, these bounds catch it.
describe("vehicle balance", () => {
  const laps = new Map<string, LapResult[]>(
    VEHICLES.map((v) => [
      v.id,
      TRACKS.map((t) => simulateLap(t, { ...DEFAULT_TUNING, ...v.values })),
    ])
  );

  it("every vehicle finishes every track without living on the grass", () => {
    for (const [id, results] of laps) {
      results.forEach((r, i) => {
        expect(r.lapMs, `${id} on ${TRACKS[i]!.id}`).not.toBeNull();
        expect(r.offroadFrac, `${id} offroad on ${TRACKS[i]!.id}`).toBeLessThan(0.15);
      });
    }
  });

  it("total time across all tracks stays within 8% of the best vehicle", () => {
    const totals = new Map(
      [...laps].map(([id, results]) => [id, results.reduce((s, r) => s + r.lapMs!, 0)])
    );
    const best = Math.min(...totals.values());
    for (const [id, total] of totals) {
      expect(total / best, `${id} total`).toBeLessThan(1.08);
    }
  });

  it("no vehicle is more than 20% behind the winner on any single track", () => {
    TRACKS.forEach((track, i) => {
      const times = [...laps.values()].map((results) => results[i]!.lapMs!);
      const best = Math.min(...times);
      [...laps.keys()].forEach((id, k) => {
        expect(times[k]! / best, `${id} on ${track.id}`).toBeLessThan(1.2);
      });
    });
  });
});
