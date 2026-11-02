// The only stateful module: runs the frame loop, steps the Race at a fixed rate,
// and moves between phases. UI reads the signals here and calls the verbs; nothing
// else touches the race. A session is one cup: four races, points carried over.
import { signal } from "@preact/signals";
import { Sound } from "../audio/sound";
import { speedOf } from "../sim/car";
import { DT, Race, type RaceEvent, type Racer } from "../sim/race";
import { TUNING } from "../sim/tuning";
import { CUPS, trackById, type Cup } from "../tracks";
import { View } from "../gfx/view";
import { Controls } from "./input";
import { addResult, RIVALS, PLAYER_COLOR, POINTS, type Standing } from "./career";

export type Phase = "title" | "cups" | "intro" | "countdown" | "racing" | "finish" | "results" | "podium";

export interface Hud {
  place: number;
  field: number;
  lap: number;
  laps: number;
  time: number;
  lastLap: number | null;
  speed: number; // km/h for display
  speedFrac: number;
  tier: number;
  drift: number; // 0..1 charge through the current tier ladder
  boost: boolean;
  count: number; // countdown number, 0 = GO
  banner: string;
  cars: { i: number; player: boolean; color: number }[];
  thumb: { x: number; y: number; dx: number } | null;
}

export const phase = signal<Phase>("title");
export const cupIndex = signal(0);
export const raceIndex = signal(0);
export const standings = signal<Standing[]>([]);
export const lastRace = signal<{ name: string; time: number | null; points: number; player: boolean; color: number }[]>([]);
export const course = signal<Race["course"] | null>(null);
export const hud = signal<Hud>({
  place: 1, field: 1, lap: 1, laps: 3, time: 0, lastLap: null, speed: 0, speedFrac: 0, tier: 0, drift: 0, boost: false, count: 3, banner: "", cars: [], thumb: null,
});

export class Game {
  readonly view: View;
  readonly controls = new Controls();
  readonly sound = new Sound();
  race: Race | null = null;
  private last = performance.now();
  private acc = 0;
  private phaseT = 0;
  private log: RaceEvent[] = [];
  private bannerT = 0;
  private banner = "";
  private autopilot = false;
  private paused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.view = new View(canvas);
    requestAnimationFrame((t) => this.frame(t));
  }

  get cup(): Cup {
    return CUPS[cupIndex.value]!;
  }

  // ---- verbs the UI calls ----

  /** A race on the menu's backdrop, so the title screen is the real game running. */
  showcase() {
    const cup = this.cup;
    this.load(cup.tracks[0]!.id, { auto: true });
    this.view.mode = "orbit";
    this.race!.started = true;
    phase.value = "title";
  }

  startCup(index: number) {
    cupIndex.value = index;
    raceIndex.value = 0;
    standings.value = [
      { name: "You", color: PLAYER_COLOR, points: 0, player: true },
      ...RIVALS.map((r) => ({ name: r.name, color: r.color, points: 0, player: false })),
    ];
    this.startRace();
  }

  startRace(trackId = this.cup.tracks[raceIndex.value]!.id, autopilot = false) {
    this.sound.unlock();
    this.load(trackId, { auto: autopilot });
    this.view.mode = "flyover";
    this.view.flyover = 0;
    this.phaseT = 0;
    phase.value = "intro";
  }

  skipIntro() {
    if (phase.value === "intro") this.phaseT = 3.6;
  }

  nextRace() {
    if (raceIndex.value + 1 < this.cup.tracks.length) {
      raceIndex.value++;
      this.startRace();
    } else {
      addResult(this.cup.id, this.placeInCup());
      phase.value = "podium";
      this.view.mode = "orbit";
      this.view.celebrate();
    }
  }

  retry() {
    this.startRace();
  }

  toMenu() {
    this.showcase();
    phase.value = "cups";
  }

  placeInCup() {
    return [...standings.value].sort((a, b) => b.points - a.points).findIndex((s) => s.player) + 1;
  }

  // ---- internals ----

  private load(trackId: string, o: { auto: boolean }) {
    const cup = CUPS.find((c) => c.tracks.some((t) => t.id === trackId)) ?? this.cup;
    this.autopilot = o.auto;
    const prior = [...standings.value].sort((a, b) => b.points - a.points);
    const youIn = prior.findIndex((s) => s.player);
    // the series leader starts at the back, the player from the back of race one
    const grid = raceIndex.value === 0 || youIn < 0 ? RIVALS.length : Math.max(0, RIVALS.length - Math.floor((RIVALS.length - youIn) / 1) + 0);
    this.race = new Race(trackById(trackId), {
      scale: cup.scale,
      difficulty: cup.difficulty,
      rivals: RIVALS,
      player: { name: "You", color: PLAYER_COLOR },
      grid: Math.min(RIVALS.length, grid),
      autopilot: o.auto,
    });
    this.view.load(this.race);
    this.sound.startRace(cup.theme);
    course.value = this.race.course;
    this.acc = 0;
  }

  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.tick(dt, true);
  }

  /** Dev: jump the game forward deterministically, for screenshots and checks. */
  advance(seconds: number) {
    this.paused = true;
    const steps = Math.round(seconds * 60);
    for (let k = 0; k < steps; k++) this.tick(1 / 60, k >= steps - 30);
  }

  private tick(dt: number, draw: boolean) {
    const race = this.race;
    if (!race) return;

    this.phaseT += dt;
    const p = phase.value;
    if (p === "intro") {
      this.view.flyover = Math.min(1, this.phaseT / 3.4);
      if (this.phaseT > 3.6) {
        this.phaseT = 0;
        this.view.mode = "chase";
        phase.value = "countdown";
      }
    }
    if (p === "countdown") {
      const c = 3 - Math.floor(this.phaseT);
      if (c !== hud.value.count) this.sound.beep(c > 0 ? 0 : 1);
      if (this.phaseT >= 3) {
        race.started = true;
        phase.value = "racing";
      }
    }

    this.acc += dt;
    while (this.acc >= DT) {
      this.view.capture();
      race.input = this.controls.poll(DT);
      race.step();
      this.acc -= DT;
    }
    this.log.push(...race.log);
    race.log.length = 0;

    for (const ev of this.log) this.handle(ev);
    if (draw) this.view.render(dt, this.acc / DT, this.log);
    this.log.length = 0;

    this.sound.engine(speedOf(race.player.car) / (TUNING.top * race.opts.scale), race.player.car);
    if (this.phaseT >= 0) this.publish();

    if (p === "racing" && race.finished) {
      this.phaseT = 0;
      this.view.celebrate();
      this.view.mode = "orbit";
      phase.value = "finish";
      this.award();
    }
    if (p === "finish" && this.phaseT > 3.2) phase.value = "results";
  }

  private handle(ev: RaceEvent) {
    if ("lap" in ev) {
      if (ev.racer.isPlayer && ev.lap < this.race!.laps) {
        this.say(ev.lap === this.race!.laps - 1 ? "FINAL LAP" : `LAP ${ev.lap + 1}`);
        this.sound.lap(ev.lap === this.race!.laps - 1);
      }
      return;
    }
    if (ev.racer.isPlayer) this.sound.event(ev.e);
  }

  private say(text: string) {
    this.banner = text;
    this.bannerT = 2;
  }

  private award() {
    const race = this.race!;
    const order = race.order();
    const add = (r: Racer) => POINTS[order.indexOf(r)] ?? 0;
    lastRace.value = order.map((r) => ({ name: r.name, time: r.finishT, points: add(r), player: r.isPlayer, color: r.color }));
    standings.value = standings.value.map((s) => {
      const r = race.racers.find((x) => x.name === s.name)!;
      return { ...s, points: s.points + add(r) };
    });
  }

  private publish() {
    const race = this.race!;
    const r = race.player;
    const car = r.car;
    const sp = speedOf(car);
    const t = TUNING;
    this.bannerT -= 1 / 60;
    if (this.bannerT <= 0) this.banner = "";
    hud.value = {
      place: race.place(r),
      field: race.racers.length,
      lap: Math.min(race.laps, r.lap + 1),
      laps: race.laps,
      time: race.t,
      lastLap: r.bestLap,
      speed: Math.round(sp * 3.6),
      speedFrac: Math.min(1.2, sp / (t.top * race.opts.scale)),
      tier: car.tier,
      drift: car.driftDir ? Math.min(1, car.driftT / t.tier3) : 0,
      boost: car.boostT > 0,
      count: phase.value === "countdown" ? Math.max(0, 3 - Math.floor(this.phaseT)) : 0,
      banner: this.banner,
      cars: race.racers.map((x) => ({ i: x.car.i, player: x.isPlayer, color: x.color })),
      thumb: this.controls.thumb,
    };
  }
}
