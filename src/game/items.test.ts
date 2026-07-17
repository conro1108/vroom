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
    const counts = { turbo: 0, rocket: 0, missile: 0, crown: 0, oil: 0 };
    for (let i = 0; i < 400; i++) {
      counts[rollItem(position, fieldSize, () => (i + 0.5) / 400)]++;
    }
    return counts;
  };

  it("leaders mostly defend, backmarkers mostly attack", () => {
    const leader = rolls(1, 4);
    const last = rolls(4, 4);
    expect(leader.oil).toBeGreaterThan(leader.turbo);
    expect(leader.rocket).toBe(0); // no one ahead to shoot
    expect(leader.missile).toBe(0);
    expect(leader.crown).toBe(0);
    expect(last.turbo + last.rocket + last.missile).toBeGreaterThan(last.oil * 2);
  });

  it("the homing missile is the rare treat, and only near the back", () => {
    const midfield = rolls(2, 4);
    const last = rolls(4, 4);
    // straight rockets are the common attack; homing missiles stay scarce
    expect(midfield.rocket).toBeGreaterThan(midfield.missile);
    // and they cluster at the back of the field
    expect(last.missile).toBeGreaterThan(midfield.missile);
  });

  it("the crown is the rarest shot, scarcer than the missile and pinned to the back", () => {
    const last = rolls(4, 4);
    expect(last.crown).toBeGreaterThan(0); // it does show up at the back
    expect(last.crown).toBeLessThan(last.missile); // but rarer than the homing missile
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
    expect(shooter.held).toBeNull();
    expect(world.missiles).toHaveLength(1);
    expect(world.missiles[0]!.homing).toBe(true);
    expect(world.missiles[0]!.target).toBe(1);

    let spun = false;
    for (let i = 0; i < 120 * 4 && !spun; i++) {
      spun = stepItems(world, racers, 1 / 120).some((e) => e.type === "spin");
    }
    expect(spun).toBe(true);
    expect(leader.spin).toBeGreaterThan(0);
    expect(world.missiles).toHaveLength(0);
  });

  it("a straight rocket flies where you face and never turns", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0)); // faces +x
    shooter.position = 2;
    shooter.held = "rocket";
    // a car directly ahead gets hit; one off to the side is missed
    const ahead = createItemRacer(createCarState(260, 100, 0));
    ahead.position = 1;
    const aside = createItemRacer(createCarState(180, 220, 0));
    aside.position = 3;
    const racers = [shooter, ahead, aside];

    expect(useItem(world, racers, 0)).toBe("rocket");
    expect(world.missiles[0]!.homing).toBe(false);
    expect(world.missiles[0]!.target).toBeNull();

    const spun: number[] = [];
    for (let i = 0; i < 120 * 3; i++) {
      for (const e of stepItems(world, racers, 1 / 120)) {
        if (e.type === "spin") spun.push(e.racer);
      }
    }
    expect(spun).toEqual([1]); // only the car in its path
    expect(aside.spin).toBe(0);
  });

  it("a crown ignores nearer cars and runs down whoever is in 1st", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0)); // faces +x
    shooter.position = 3;
    shooter.held = "crown";
    // a nearer car (2nd) sits off the flight path; the leader is farther away
    const decoy = createItemRacer(createCarState(140, 40, 0));
    decoy.position = 2;
    const leader = createItemRacer(createCarState(300, 260, 0));
    leader.position = 1;
    const racers = [shooter, decoy, leader];

    expect(useItem(world, racers, 0)).toBe("crown");
    expect(world.missiles[0]!.chaseLeader).toBe(true);
    expect(world.missiles[0]!.target).toBe(2); // locked the leader, not the closer decoy

    let spunRacer = -1;
    for (let i = 0; i < 120 * 6 && spunRacer < 0; i++) {
      for (const e of stepItems(world, racers, 1 / 120)) {
        if (e.type === "spin") spunRacer = e.racer;
      }
    }
    expect(spunRacer).toBe(2); // the leader went down
    expect(decoy.spin).toBe(0); // the decoy was never touched
  });

  it("a crown keeps hunting the position when the lead changes hands", () => {
    const world = emptyWorld();
    const shooter = createItemRacer(createCarState(100, 100, 0));
    shooter.position = 3;
    shooter.held = "crown";
    const a = createItemRacer(createCarState(260, 100, 0));
    a.position = 1; // leads at fire time
    const b = createItemRacer(createCarState(260, 260, 0));
    b.position = 2;
    const racers = [shooter, a, b];

    useItem(world, racers, 0);
    expect(world.missiles[0]!.target).toBe(1);

    // b takes the lead a moment later — the crown should re-lock onto b
    a.position = 2;
    b.position = 1;
    stepItems(world, racers, 1 / 120);
    expect(world.missiles[0]!.target).toBe(2);
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
