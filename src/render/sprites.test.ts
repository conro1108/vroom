import { describe, expect, it } from "vitest";
import { VEHICLES } from "../game/vehicles";
import { CAR_MAP, VEHICLE_SPRITES, vehicleSprite } from "./sprites";

describe("vehicle sprites", () => {
  it("every vehicle has its own sprite", () => {
    for (const v of VEHICLES) {
      expect(VEHICLE_SPRITES[v.id], v.id).toBeDefined();
    }
  });

  it("unknown ids fall back to the classic car", () => {
    expect(vehicleSprite("nope").map).toBe(CAR_MAP);
  });

  it("maps are square 17x17 grids of palette letters", () => {
    for (const [id, sprite] of Object.entries(VEHICLE_SPRITES)) {
      expect(sprite.map, `${id} row count`).toHaveLength(17);
      for (const row of sprite.map) {
        expect(row, `${id} row "${row}"`).toHaveLength(17);
        for (const ch of row) {
          if (ch === ".") continue;
          expect(sprite.palette[ch], `${id} char "${ch}"`).toBeDefined();
        }
      }
    }
  });
});
