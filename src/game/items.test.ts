import { describe, expect, it } from "vitest";
import { createItemRacer, createItemWorld, shotSpeeds, stepItems, useItem, type ItemWorld } from "./items";
import { createCarState } from "./physics";
import { applySpeedClass, SPEED_CLASSES } from "./progression";
import { createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);
const raceTuning = applySpeedClass(DEFAULT_TUNING, SPEED_CLASSES[0]!);

function emptyWorld(): ItemWorld {
  return { boxes: [], oils: [], missiles: [], shot: shotSpeeds(raceTuning) };
}

describe("item world", () => {
  it("places box rows on the road, none on the start line", () => {
    const world = createItemWorld(track, raceTuning);
    expect(world.boxes.length).toBeGreaterThanOrEqual(6);
    for (const box of world.boxes) {
      expect(query.surfaceAt(box.x, box.y)).toBe("road");
      expect(Math.hypot(box.x - track.start.x, box.y - track.start.y)).toBeGreaterThan(100);
    }
  });

  it("hands a racer an item and respawns the box later", () => {
    const world = createItemWorld(track, raceTuning, 4, 2);
    const box = world.boxes[0]!;
    const racer = createItemRacer(createCarState(box.x, box.y, 0));
    const events = stepItems(world, [racer], 1 / 120, () => 0.5);
    expect(racer.held).not.toBeNull();
    expect(events).toEqual([{ type: "pickup", racer: 0, item: racer.held }]);
    expect(box.respawnIn).toBeGreaterThan(0);

    for (let i = 0; i < 120 * 5; i++) stepItems(world, [], 1 / 120);
    expect(box.respawnIn).toBe(0);
  });
});

describe("items in flight", () => {
  it("oil spins the next racer over it, once", () => {
    const world = emptyWorld();
    world.oils.push({ x: 100, y: 100 });
    const racer = createItemRacer(createCarState(102, 100, 0));
    const events = stepItems(world, [racer], 1 / 120);
    expect(racer.spin).toBeGreaterThan(0.5);
    expect(world.oils).toHaveLength(0);
    expect(events).toEqual([{ type: "spin", racer: 0, by: "oil" }]);
  });

  it("a homing missile curves onto a nearby racer and spins it", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0)); // faces +x
    shooter.position = 2;
    shooter.held = "missile";
    // target is off to the side, so only a *curving* shot connects
    const leader = createItemRacer(createCarState(280, 190, 0));
    leader.position = 1;
    const racers = [shooter, leader];

    expect(useItem(world, racers, 0)).toBe("missile");
    expect(world.missiles[0]!.homing).toBe(true);

    let spun = false;
    for (let i = 0; i < 120 * 4 && !spun; i++) {
      spun = stepItems(world, racers, 1 / 120).some((e) => e.type === "spin");
    }
    expect(spun).toBe(true);
    expect(leader.spin).toBeGreaterThan(0);
    expect(world.missiles).toHaveLength(0);
  });

  it("a shot never spins the racer who fired it", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0));
    shooter.position = 1;
    shooter.held = "rocket";
    expect(useItem(world, [shooter], 0)).toBe("rocket");
    for (let i = 0; i < 120 * 3; i++) stepItems(world, [shooter], 1 / 120);
    expect(shooter.spin).toBe(0);
  });

  it("spun racers can't use items", () => {
    const world = emptyWorld();
    const racer = createItemRacer(createCarState(100, 100, 0));
    racer.held = "turbo";
    racer.spin = 1;
    expect(useItem(world, [racer], 0)).toBeNull();
    expect(racer.held).toBe("turbo");
  });
});
