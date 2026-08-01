import { describe, expect, it } from "vitest";
import { CLEAN_DRIVER, DRIVER_SPREAD, simulateLap, type LapResult } from "./botdriver";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING, type Tuning } from "./tuning";
import {
  activeVehicleId,
  applyVehicle,
  CUSTOM_VEHICLE_ID,
  loadCustomVehicle,
  resetCustomVehicle,
  VEHICLES,
  type VehicleKey,
} from "./vehicles";

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

describe("custom vehicle", () => {
  it("has an id distinct from every base vehicle", () => {
    expect(VEHICLES.some((v) => v.id === CUSTOM_VEHICLE_ID)).toBe(false);
  });

  it("starts at the mean of the base vehicles", () => {
    const custom = resetCustomVehicle();
    const keys = Object.keys(VEHICLES[0]!.values) as VehicleKey[];
    for (const key of keys) {
      const mean = VEHICLES.reduce((s, v) => s + v.values[key], 0) / VEHICLES.length;
      expect(custom.values[key]).toBeCloseTo(mean, 1);
    }
  });

  it("applying it behaves like any other vehicle", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING };
    applyVehicle(tuning, loadCustomVehicle());
    expect(tuning.maxSpeed).toBe(loadCustomVehicle().values.maxSpeed);
  });
});

// Every vehicle must stay raceable and competitive — and stay that way in
// imperfect hands. Each car laps every track once per driver in DRIVER_SPREAD
// (sloppy lines, wobbly steering, blown braking points, laggy reactions), so a
// vehicle can't pass balance by being fast down one razor-thin robot line.
describe("vehicle balance", () => {
  const DRIVERS = [CLEAN_DRIVER, ...DRIVER_SPREAD];

  // One sim pass covers everything below: per vehicle, per track, the clean
  // reference lap plus one lap for each imperfect driver.
  const laps = new Map<string, LapResult[][]>(
    VEHICLES.map((v) => {
      const tuning = { ...DEFAULT_TUNING, ...v.values };
      return [v.id, TRACKS.map((t) => DRIVERS.map((d) => simulateLap(t, tuning, 2, d)))];
    })
  );

  /** Runs by the imperfect drivers (index 0 is the clean reference). */
  const noisy = (byDriver: LapResult[]) => byDriver.slice(1);
  /** Every noisy (track, driver) run for one vehicle, flattened. */
  const runs = (id: string) => laps.get(id)!.flatMap(noisy);

  it("every vehicle finishes every track, in every driver's hands, without living on the grass", () => {
    for (const [id, byTrack] of laps) {
      byTrack.forEach((byDriver, i) => {
        byDriver.forEach((r, d) => {
          expect(r.lapMs, `${id} on ${TRACKS[i]!.id}, driver ${d}`).not.toBeNull();
          expect(r.offroadFrac, `${id} offroad on ${TRACKS[i]!.id}, driver ${d}`).toBeLessThan(0.2);
        });
      });
    }
  });

  it("total time across every track and driver stays within 8% of the best vehicle", () => {
    const totals = new Map(
      [...laps.keys()].map((id) => [id, runs(id).reduce((s, r) => s + r.lapMs!, 0)])
    );
    const best = Math.min(...totals.values());
    for (const [id, total] of totals) {
      expect(total / best, `${id} total`).toBeLessThan(1.08);
    }
  });

  // Per-track spread is deliberately looser than the overall bound: a car
  // having a circuit that doesn't suit it is the point of picking a car, and
  // noisy drivers widen single-track variance more than a clean lap does. The
  // 8% total above is what actually guarantees nobody's stuck with a dud.
  //
  // Measured against the *typical* car on the track, not the quickest one. The
  // tight-hairpin tracks (switchback especially) punish a laggy driver hard, and
  // there the fastest car is whichever one happens to survive the hairpins —
  // comparing to it made this assertion track one outlier's luck rather than
  // whether any car is actually a dud.
  it("no vehicle is hopeless on any single track", () => {
    TRACKS.forEach((track, i) => {
      // average across drivers, so one unlucky sloppy run doesn't decide it
      const means = [...laps.values()].map((byTrack) => mean(noisy(byTrack[i]!).map((r) => r.lapMs!)));
      const typical = median(means);
      [...laps.keys()].forEach((id, k) => {
        expect(means[k]! / typical, `${id} on ${track.id}`).toBeLessThan(1.3);
      });
    });
  });

  // The point of the noisy spread: a car that only works when driven perfectly
  // is a car with one narrow path through it, and that isn't fun. Measure how
  // much each vehicle degrades from clean hands to the sloppiest driver — no
  // car should be dramatically more punishing about it than the rest.
  it("no vehicle punishes sloppy driving far harder than the others do", () => {
    const penalties = VEHICLES.map((v) => {
      const byTrack = laps.get(v.id)!;
      const clean = byTrack.map((byDriver) => byDriver[0]!.lapMs!);
      const messy = byTrack.map((byDriver) => mean(noisy(byDriver).map((r) => r.lapMs!)));
      return { id: v.id, ratio: sum(messy) / sum(clean) };
    });
    const gentlest = Math.min(...penalties.map((p) => p.ratio));
    for (const p of penalties) {
      // every car loses time in bad hands; none may lose 15% more of it than
      // the most forgiving car does
      expect(p.ratio / gentlest, `${p.id} sloppiness penalty`).toBeLessThan(1.15);
    }
  });

  it("the drift car actually lives off its drift boosts", () => {
    const earned = (id: string) => sum(runs(id).map((r) => r.driftBoosts));
    // Drift King breaks loose early and often; the rails car barely slides at
    // all. If this inverts, the drift upside has stopped being an upside.
    expect(earned("driftking")).toBeGreaterThan(earned("slotcar"));
    expect(earned("driftking")).toBeGreaterThan(0);
  });
});

function sum(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}
function mean(xs: number[]): number {
  return sum(xs) / xs.length;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
