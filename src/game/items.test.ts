import { describe, expect, it } from "vitest";
import {
  createItemRacer,
  createItemWorld,
  PICKUP_RADIUS,
  rollItem,
  stepItems,
  useItem,
  type ItemWorld,
} from "./items";
import { createCarState } from "./physics";
import { createTrack, createTrackQuery } from "./track";
import { TRACKS } from "./tracks";

const track = createTrack(TRACKS[0]!);
const query = createTrackQuery(track);

function emptyWorld(): ItemWorld {
  return { boxes: [], oils: [], missiles: [] };
}

describe("item world", () => {
  it("places box rows on the road, none on the start line", () => {
    const world = createItemWorld(track);
    expect(world.boxes.length).toBeGreaterThanOrEqual(6);
    for (const box of world.boxes) {
      expect(query.surfaceAt(box.x, box.y)).toBe("road");
      expect(Math.hypot(box.x - track.start.x, box.y - track.start.y)).toBeGreaterThan(100);
    }
  });

  it("hands a racer an item and respawns the box later", () => {
    const world = createItemWorld(track, 2);
    const box = world.boxes[0]!;
    const racer = createItemRacer(createCarState(box.x, box.y, 0));
    const events = stepItems(world, [racer], 1 / 120, () => 0.5);
    expect(racer.held).not.toBeNull();
    expect(events).toEqual([{ type: "pickup", racer: 0, item: racer.held }]);
    expect(box.respawnIn).toBeGreaterThan(0);

    // a second racer on the same spot gets nothing while the box is down
    const other = createItemRacer(createCarState(box.x, box.y, 0));
    stepItems(world, [racer, other], 1 / 120, () => 0.5);
    expect(other.held).toBeNull();

    for (let i = 0; i < 120 * 5; i++) stepItems(world, [], 1 / 120);
    expect(box.respawnIn).toBe(0);
  });

  it("doesn't hand an item to a racer already holding one", () => {
    const world = createItemWorld(track, 2);
    const box = world.boxes[0]!;
    const racer = createItemRacer(createCarState(box.x + PICKUP_RADIUS - 1, box.y, 0));
    racer.held = "oil";
    stepItems(world, [racer], 1 / 120);
    expect(racer.held).toBe("oil");
  });
});

describe("rollItem", () => {
  const rolls = (position: number, fieldSize: number) => {
    const counts = { turbo: 0, missile: 0, oil: 0 };
    for (let i = 0; i < 200; i++) {
      counts[rollItem(position, fieldSize, () => (i + 0.5) / 200)]++;
    }
    return counts;
  };

  it("leaders mostly defend, backmarkers mostly attack", () => {
    const leader = rolls(1, 4);
    const last = rolls(4, 4);
    expect(leader.oil).toBeGreaterThan(leader.turbo);
    expect(leader.missile).toBe(0); // no one ahead to shoot
    expect(last.turbo + last.missile).toBeGreaterThan(last.oil * 2);
  });
});

describe("items in flight", () => {
  it("oil spins the next racer over it, once", () => {
    const world = emptyWorld();
    world.oils.push({ x: 100, y: 100 });
    const racer = createItemRacer(createCarState(102, 100, 0));
    const events = stepItems(world, [racer], 1 / 120);
    expect(racer.spin).toBeGreaterThan(1);
    expect(world.oils).toHaveLength(0);
    expect(events).toEqual([{ type: "spin", racer: 0, by: "oil" }]);
  });

  it("a missile homes to its target and spins it", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0));
    shooter.position = 2;
    shooter.held = "missile";
    const leader = createItemRacer(createCarState(300, 140, 0));
    leader.position = 1;
    const racers = [shooter, leader];

    expect(useItem(world, racers, 0)).toBe("missile");
    expect(shooter.held).toBeNull();
    expect(world.missiles).toHaveLength(1);

    let spun = false;
    for (let i = 0; i < 120 * 3 && !spun; i++) {
      spun = stepItems(world, racers, 1 / 120).some((e) => e.type === "spin");
    }
    expect(spun).toBe(true);
    expect(leader.spin).toBeGreaterThan(0);
    expect(world.missiles).toHaveLength(0);
  });

  it("the leader's missile is wasted (no target ahead)", () => {
    const world = emptyWorld();
    const leader = createItemRacer(createCarState(100, 100, 0));
    leader.position = 1;
    leader.held = "missile";
    expect(useItem(world, [leader], 0)).toBe("missile");
    expect(world.missiles).toHaveLength(0);
    expect(leader.held).toBeNull();
  });

  it("turbo boosts the user; oil drops behind the car", () => {
    const world = emptyWorld();
    const racer = createItemRacer(createCarState(100, 100, 0)); // heading +x
    racer.held = "turbo";
    useItem(world, [racer], 0);
    expect(racer.boost).toBeGreaterThan(1);

    racer.held = "oil";
    useItem(world, [racer], 0);
    expect(world.oils).toHaveLength(1);
    expect(world.oils[0]!.x).toBeLessThan(100); // behind a +x-facing car
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
