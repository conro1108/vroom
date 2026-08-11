// Geometry safety net for every track in the catalog: layouts are hand-drawn
// control points, and these tests are what catch an out-of-bounds sample or a
// road that folds back onto itself (a "pinch") before anyone drives it.
import { describe, expect, it } from "vitest";
import { createBot } from "./botdriver";
import { createOpponents, stepOpponents } from "./opponents";
import { createCarState, stepCar } from "./physics";
import { SPEED_CLASSES } from "./progression";
import { arcBetween, createLapTracker, createTrack, createTrackQuery, updateLap } from "./track";
import { TRACKS } from "./tracks";
import { DEFAULT_TUNING } from "./tuning";

describe.each(TRACKS.map((def) => [def.id, def] as const))("track %s", (_id, def) => {
  const track = createTrack(def);

  it("has a unique id and a name", () => {
    expect(track.name.length).toBeGreaterThan(0);
    expect(TRACKS.filter((t) => t.id === def.id)).toHaveLength(1);
  });

  it("stays inside the world bounds with room for the road", () => {
    for (const p of track.samples) {
      expect(p.x).toBeGreaterThan(track.roadWidth);
      expect(p.x).toBeLessThan(track.worldWidth - track.roadWidth);
      expect(p.y).toBeGreaterThan(track.roadWidth);
      expect(p.y).toBeLessThan(track.worldHeight - track.roadWidth);
    }
  });

  it("progress is monotonic from 0 toward 1", () => {
    expect(track.progress[0]).toBe(0);
    for (let i = 1; i < track.progress.length; i++) {
      expect(track.progress[i]!).toBeGreaterThan(track.progress[i - 1]!);
      expect(track.progress[i]!).toBeLessThan(1);
    }
  });

  it("never pinches: far-apart arc points keep road-width spatial separation", () => {
    // Points >5% of the lap apart along the arc must be far enough apart in
    // space that the two road ribbons (plus shoulders) don't merge. The gap is
    // measured against the *local* widths, so a deliberately narrowed neck may
    // legally run closer than two boulevards could.
    const n = track.samples.length;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 2; j < n; j += 2) {
        const arcDist = Math.min(
          Math.abs(track.progress[j]! - track.progress[i]!),
          1 - Math.abs(track.progress[j]! - track.progress[i]!)
        );
        if (arcDist < 0.05) continue;
        const a = track.samples[i]!;
        const b = track.samples[j]!;
        const minGap = track.halfWidths[i]! + track.halfWidths[j]! + 14;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < minGap) {
          throw new Error(
            `pinch on ${def.id}: samples ${i} and ${j} are ${d.toFixed(0)}px apart ` +
              `(need ${minGap.toFixed(0)}) at (${a.x.toFixed(0)},${a.y.toFixed(0)})`
          );
        }
      }
    }
  });

  it("per-point widths only narrow the nominal road, and never below a car's needs", () => {
    // Nominal roadWidth is still what grid spacing, item lanes, and observer
    // offsets are sized from, so authored widths must stay at or under it —
    // and a pinch tighter than ~56px stops being a road the field fits down.
    for (const p of def.points) {
      if (p.w === undefined) continue;
      expect(p.w, `${def.id}: point width ${p.w} above nominal ${def.roadWidth}`).toBeLessThanOrEqual(
        def.roadWidth
      );
      expect(p.w, `${def.id}: point width ${p.w} too narrow to race`).toBeGreaterThanOrEqual(56);
    }
  });

  it("lap progress works around the whole centerline", () => {
    const query = createTrackQuery(track);
    for (let i = 0; i < track.samples.length; i += 5) {
      const p = track.samples[i]!;
      expect(query.progressAt(p.x, p.y)).not.toBeNull();
      expect(query.surfaceAt(p.x, p.y)).toBe("road");
    }
  });
});

// Geometry that passes the checks above can still be undriveable — a corner
// tighter than the car can turn, or a hairpin that spits the field off. So put
// a bot on every layout and make it get round: this is the check that a new
// archetype is a track and not just a closed curve.
//
// The clean-lap half of it only applies where there's grass. Over the void
// (Rainbow Cup) the road edge is a cliff with 18px of overhang past it, and at
// 200cc the bots' pure-pursuit line runs wider than that through the quick
// corners — they fall off and get towed several times a lap. That predates
// these layouts (it reproduces on the untouched pulsar and rainbow) and wants a
// bot that brakes for corner *radius* rather than for heading error, which is
// its own piece of work.
describe.each(TRACKS.map((def) => [def.id, def] as const))("driving %s", (_id, def) => {
  it("a bot laps it without the marshals having to collect it", () => {
    const track = createTrack(def);
    const query = createTrackQuery(track);
    // margins past the local road edge, same terms main.ts runs them
    const corridor = def.voidRunoff ? 0 : DEFAULT_TUNING.fenceMarginPx;
    const rescue = corridor + (def.voidRunoff ? DEFAULT_TUNING.voidMarginPx : DEFAULT_TUNING.rescueMarginPx);
    const [bot] = createOpponents(
      track,
      query,
      [{ vehicleId: "classic", skill: 1 }],
      { ...DEFAULT_TUNING, botSloppiness: 0 }, // a clean driver: this is about the road, not mistakes
      SPEED_CLASSES[SPEED_CLASSES.length - 1]!, // and at the fastest class, where a tight corner bites
      () => 0.5
    );
    const start = bot!.tracker.lap;
    let rescues = 0;
    for (let i = 0; i < 120 * 180 && bot!.tracker.lap === start; i++) {
      const towing = bot!.tow !== null;
      stepOpponents([bot!], query, 1 / 120, true, null, corridor, rescue, DEFAULT_TUNING.rescueTowSeconds);
      if (!towing && bot!.tow) rescues++;
    }
    expect(bot!.tracker.lap, `${def.id}: bot never completed a lap`).toBeGreaterThan(start);
    if (!def.voidRunoff) expect(rescues, `${def.id}: bot needed rescuing mid-lap`).toBe(0);
  });
});

// A layout can clear every check above and still be dull. The failure mode is
// specific and it's easy to author by accident: bends shallower than the road
// is wide vanish into the corridor, so the whole lap is one flat-out arc you
// hold with a constant nudge of lock — a "wiggly circle". Polar layouts are
// especially prone to it, since a radius that eases inward over 40° of angle is
// a spiral, not a corner.
//
// So drive a clean lap and measure what the road asks of the hands: how much
// lock it needs on average, and how often it makes you change direction. These
// floors are set just under where the catalog sits, so they catch a new layout
// (or a retune) sliding back toward a circle rather than grading the tracks.
const MIN_AVG_LOCK = 0.11; // mean |steer| over a flying lap
const MIN_REVERSALS = 3; // times the lap swaps which way you're turning

describe.each(TRACKS.filter((d) => !d.speedOval).map((def) => [def.id, def] as const))(
  "shape of %s",
  (_id, def) => {
    it("asks for real steering, not one flat-out arc", () => {
      const track = createTrack(def);
      const query = createTrackQuery(track);
      const dt = 1 / 120;
      const bot = createBot(track, query, DEFAULT_TUNING);
      let car = createCarState(track.start.x, track.start.y, track.startHeading);
      const tracker = createLapTracker(0);
      let laps = 0;
      let steps = 0;
      let lockSum = 0;
      let reversals = 0;
      let turning = 0; // which way we're currently committed, 0 = straight-ish
      for (let i = 0; i < 120 * 200 && laps < 2; i++) {
        car = stepCar(car, bot(car), DEFAULT_TUNING, query.surfaceAt(car.x, car.y), dt);
        if (laps >= 1) {
          // measure the flying lap only — the standing start is all throttle
          steps++;
          lockSum += Math.abs(car.steer);
          const way = Math.abs(car.steer) < 0.2 ? turning : Math.sign(car.steer);
          if (way !== 0 && turning !== 0 && way !== turning) reversals++;
          if (way !== 0) turning = way;
        }
        const p = query.progressAt(car.x, car.y);
        if (p !== null && updateLap(tracker, p).completed) laps++;
      }
      expect(steps, `${def.id}: bot never got round for a measured lap`).toBeGreaterThan(0);
      expect(lockSum / steps, `${def.id}: lap needs almost no steering lock`).toBeGreaterThanOrEqual(
        MIN_AVG_LOCK
      );
      expect(reversals, `${def.id}: lap never changes direction — it's a circle`).toBeGreaterThanOrEqual(
        MIN_REVERSALS
      );
    });
  }
);

// The referee check. With most of the fencing gone, what stops "skip half the
// lap across the grass" is the rescue system: the distance rescue on wide-open
// gaps, and the course-cut rescue on gaps too narrow for it to ever fire. So
// walk straight chords between far-apart-in-arc points on every track,
// applying the same rules main.ts runs (lastSafe follows the shoulder, rescue
// past the distance margin, cut called when the nearest road strays more than
// cutRescuePx of lap-arc from the anchor), and assert every crossing that
// would land a real feature-skip is denied before it arrives.
//
// Deliberately tolerated: single-corner cuts. A chord hugging a curving
// corner's inside shoulder re-anchors legitimately as it grazes, so it can
// land a bit past the cut window — but geometry bounds those at roughly
// arc-vs-chord of one corner, which grass speed prices at break-even (and a
// boost item legitimately unlocks: that's the shortcut economy). What must
// never survive is a landing past MAX_CUT_LANDING_PX — that's skipping a
// feature, not shaving a corner, and means a margin or layout regression.
// Crossings that step on another road mid-gap are excluded too: driving over
// a road re-anchors you legitimately, and each hop is still bounded.
// Absolute, not derived from cutRescuePx: if the window were cranked open in
// tuning, this floor is what fails — the catalog's bowl-hops and spur-skips
// all landed 1900–3200px before the cut rescue existed.
const MAX_CUT_LANDING_PX = 900;

describe.each(TRACKS.map((def) => [def.id, def] as const))("cutting %s", (_id, def) => {
  it("no straight grass crossing reaches a distant ribbon without a rescue", () => {
    const track = createTrack(def);
    const query = createTrackQuery(track);
    const L = track.lapLength;
    const fenceMargin = def.voidRunoff ? 0 : DEFAULT_TUNING.fenceMarginPx;
    const rescueMargin =
      fenceMargin + (def.voidRunoff ? DEFAULT_TUNING.voidMarginPx : DEFAULT_TUNING.rescueMarginPx);
    const n = track.samples.length;
    for (let i = 0; i < n; i += 4) {
      for (let j = i + 4; j < n; j += 4) {
        const pi = track.progress[i]!;
        const pj = track.progress[j]!;
        if (arcBetween(pi, pj, L) <= MAX_CUT_LANDING_PX) continue;
        const A = track.samples[i]!;
        const B = track.samples[j]!;
        const d = Math.hypot(B.x - A.x, B.y - A.y);
        // a gap this wide can't be crossed without the distance rescue firing
        if (d - track.halfWidths[i]! - track.halfWidths[j]! > 2 * rescueMargin + 8) continue;

        let anchor = pi;
        let denied = false;
        let touchedRoad = false; // stepped on a road mid-gap: not a grass-only cut
        let leftHome = false;
        const steps = Math.ceil(d / 6);
        for (let s = 1; s < steps && !denied; s++) {
          const x = A.x + ((B.x - A.x) * s) / steps;
          const y = A.y + ((B.y - A.y) * s) / steps;
          const hit = query.nearestOnRoad(x, y);
          const p = query.progressAt(x, y);
          if (!hit || p === null) {
            denied = true; // lost to the query grid entirely = rescue
            break;
          }
          const edge = hit.dist - hit.halfWidth;
          if (edge > rescueMargin) {
            denied = true; // distance rescue
          } else if (edge > 0 && arcBetween(p, anchor, L) > DEFAULT_TUNING.cutRescuePx) {
            denied = true; // course-cut rescue
          } else {
            if (edge <= 0 && leftHome && arcBetween(p, pj, L) > MAX_CUT_LANDING_PX / 2) {
              touchedRoad = true;
            }
            if (edge > 0) leftHome = true;
            if (edge <= fenceMargin) anchor = p; // lastSafe follows the shoulder
          }
        }
        if (!denied && !touchedRoad) {
          throw new Error(
            `free cut on ${def.id}: (${A.x.toFixed(0)},${A.y.toFixed(0)}) → ` +
              `(${B.x.toFixed(0)},${B.y.toFixed(0)}) crosses ${d.toFixed(0)}px of grass and lands ` +
              `${arcBetween(pi, pj, L).toFixed(0)}px along the lap with no rescue on the way`
          );
        }
      }
    }
  });
});
