import { describe, expect, it } from "vitest";
import { ICON_SIZE, ICONS, STAR_5 } from "./icons";

describe("ui icon pixel maps", () => {
  it(`every icon is a ${ICON_SIZE}x${ICON_SIZE} grid of palette letters`, () => {
    for (const [name, icon] of Object.entries(ICONS)) {
      expect(icon.map, `${name} row count`).toHaveLength(ICON_SIZE);
      for (const row of icon.map) {
        expect(row, `${name} row "${row}"`).toHaveLength(ICON_SIZE);
        for (const ch of row) {
          if (ch === ".") continue;
          expect(icon.palette[ch], `${name} char "${ch}"`).toBeDefined();
        }
      }
    }
  });

  it("the map-trail star is a square 5x5 map", () => {
    expect(STAR_5).toHaveLength(5);
    for (const row of STAR_5) expect(row).toHaveLength(5);
  });
});
