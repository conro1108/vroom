import { describe, expect, it } from "vitest";
import { ALL_TRACKS } from "../tracks";
import { buildCourse } from "./course";
import { DT, Race } from "./race";

describe("catalog", () => {
  it("every layout builds", () => {
    for (const def of ALL_TRACKS) expect(buildCourse(def).length, def.id).toBeGreaterThan(300);
  });
  it("a bot finishes a lap of the first track", () => {
    const race = new Race(ALL_TRACKS[0]!, { scale: 1, difficulty: 1, rivals: [], player: { name: "x", color: 0 }, grid: 0, autopilot: true });
    race.started = true;
    for (let t = 0; t < 90 && race.player.lap < 1; t += DT) race.step();
    expect(race.player.lap).toBe(1);
  });
});
