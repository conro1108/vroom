import { describe, expect, it } from "vitest";
import { DEFAULT_TUNING, type Tuning } from "./tuning";
import { activeVehicleId, applyVehicle, VEHICLES } from "./vehicles";

describe("vehicles", () => {
  it("has uniquely named vehicles", () => {
    expect(new Set(VEHICLES.map((v) => v.id)).size).toBe(VEHICLES.length);
    expect(new Set(VEHICLES.map((v) => v.name)).size).toBe(VEHICLES.length);
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
});
