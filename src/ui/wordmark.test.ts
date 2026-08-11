import { describe, expect, it } from "vitest";
import { buildWordmark } from "./wordmark";

describe("wordmark", () => {
  it("builds a rectangular map of known palette chars", () => {
    const map = buildWordmark("vroom");
    const width = map[0]!.length;
    for (const row of map) {
      expect(row).toHaveLength(width);
      expect(row).toMatch(/^[.obB]*$/);
    }
  });

  it("outlines every fill: no body pixel touches bare background", () => {
    const map = buildWordmark("vroom");
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y]!.length; x++) {
        if (map[y]![x] !== "b" && map[y]![x] !== "B") continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            expect(map[y + dy]?.[x + dx] ?? ".").not.toBe(".");
          }
        }
      }
    }
  });

  it("rejects letters it has no art for", () => {
    expect(() => buildWordmark("vroomz")).toThrow(/letterform/);
  });
});
