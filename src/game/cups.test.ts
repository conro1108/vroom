import { describe, expect, it } from "vitest";
import { CUPS, RACES_PER_CUP } from "./cups";
import { TRACKS } from "./tracks";

describe("cup catalog", () => {
  it("every cup has four real, unshared tracks", () => {
    const seen = new Set<string>();
    for (const cup of CUPS) {
      expect(cup.trackIds).toHaveLength(RACES_PER_CUP);
      for (const id of cup.trackIds) {
        expect(TRACKS.some((t) => t.id === id), `${cup.id} track ${id}`).toBe(true);
        expect(seen.has(id), `${id} appears in two cups`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("unlock rules reference real cups and the graph has a reachable root", () => {
    const ids = new Set(CUPS.map((c) => c.id));
    expect(CUPS.some((c) => !c.unlock)).toBe(true); // at least one open cup
    for (const cup of CUPS) {
      for (const rule of cup.unlock ?? []) {
        expect(ids.has(rule.cup), `${cup.id} unlock via ${rule.cup}`).toBe(true);
        expect(rule.cup).not.toBe(cup.id);
      }
    }
  });
});
