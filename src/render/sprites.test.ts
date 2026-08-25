import { describe, expect, it } from "vitest";
import { VEHICLES } from "../game/vehicles";
import { VEHICLE_SPRITES } from "./sprites";

describe("vehicle sprites", () => {
  it("every vehicle has its own sprite", () => {
    for (const v of VEHICLES) {
      expect(VEHICLE_SPRITES[v.id], v.id).toBeDefined();
    }
  });
});
