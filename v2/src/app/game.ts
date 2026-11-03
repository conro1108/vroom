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
import { addResult, cupOpen, freshStandings, RIVALS, PLAYER_COLOR, POINTS, type Standing } from "./career";

export type Phase = "title" | "cups" | "intro" | "countdown" | "racing" | "finish" | "results" | "podium";

export interface Hud {
  place: number;
  field: number;
  lap: number;
  laps: number;
  time: number;
  lastLap: number | null;
  bestLap: number | null;
  speed: number; // km/h for display
  speedFrac: number;
  tier: number;
  drift: number; // 0..1 charge through the current tier ladder
  drifting: boolean;
  boost: boolean;
  boostN: number; // counts boosts fired, so the UI can flash on each one
  boostTier: number; // 1..3 drift tiers, 4 = pad
  count: number; // countdown number, 0 = GO
  banner: string;
  auto: boolean; // a bot is driving
  cars: { x: number; z: number; player: boolean; color: number }[];
  thumb: { x: number; y: number; dx: number; dy: number; f: number } | null;
}

export interface RaceRow {
  name: string;
  time: number; // cars still running get a projected time
  points: number;
  player: boolean;
  color: number;
}

export const phase = signal<Phase>("title");
export const cupIndex = signal(0);
export const raceIndex = signal(0);
export const standings = signal<Standing[]>([]);
export const lastRace = signal<RaceRow[]>([]);
export const paused = signal(false);
export const muted = signal(false); // mirrors sound.muted, which Sound persists itself
/** What the cup just finished opened, for the podium to announce. */
export const unlocked = signal<Cup | null>(null);
export const course = signal<Race["course"] | null>(null);
export const hud = signal<Hud>({
  place: 1, field: 1, lap: 1, laps: 3, time: 0, lastLap: null, bestLap: null, speed: 0, speedFrac: 0, tier: 0, drift: 0, drifting: false, boost: false, boostN: 0, boostTier: 0, count: 3, banner: "", auto: false, cars: [], thumb: null,
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
  private lapMark = 0;
  private lastLap: number | null = null;
  private lastCount = -1;
  private boostN = 0;
  private boostTier = 0;
  private preRace: Standing[] | null = null; // the table before this race's points landed
  /** ?auto: a bot drives every race, so the whole loop can run unattended. */
  private autoAll = new URLSearchParams(location.search).has("auto");
  /** advance() took over the clock; only the caller moves time now. */
  frozen = false;

  constructor(canvas: HTMLCanvasElement) {
    this.view = new View(canvas);
    muted.value = this.sound.muted;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  get cup(): Cup {
    return CUPS[cupIndex.value]!;
  }

  // ---- verbs the UI calls ----

  /** A race on the menu's backdrop, so the title screen is the real game running. */
  showcase(to: "title" | "cups" = "title") {
    const cup = this.cup;
    this.load(cup.tracks[0]!.id, { auto: true, showcase: true });
    this.view.mode = "orbit";
    this.race!.started = true;
    phase.value = to;
  }

  /** Title tap: the first gesture, and the only chance iOS gives to start audio. */
  toCups() {
    this.sound.unlock();
    phase.value = "cups";
  }

  startCup(index: number) {
    cupIndex.value = index;
    raceIndex.value = 0;
    standings.value = freshStandings();
    this.startRace();
  }

  startRace(trackId = this.cup.tracks[raceIndex.value]!.id, autopilot = this.autoAll) {
    this.sound.unlock();
    // ?track= arrives here without going through startCup
    const at = CUPS.findIndex((c) => c.tracks.some((t) => t.id === trackId));
    if (at >= 0) {
      cupIndex.value = at;
      raceIndex.value = CUPS[at]!.tracks.findIndex((t) => t.id === trackId);
    }
    if (!standings.value.length) standings.value = freshStandings();
    this.preRace = null;
    paused.value = false;
    this.syncPause();
    this.lastCount = -1;
    this.load(trackId, { auto: autopilot });
    this.view.mode = "flyover";
    this.view.flyover = 0;
    this.phaseT = 0;
    phase.value = "intro";
  }

  skipIntro() {
    if (phase.value === "intro") this.phaseT = 3.6;
  }

  skipFinish() {
    if (phase.value === "finish" && this.phaseT > 0.9) this.phaseT = 99;
  }

  pause() {
    if (paused.value || (phase.value !== "racing" && phase.value !== "countdown")) return;
    paused.value = true;
    this.controls.setActive(false);
    this.syncPause();
  }

  resume() {
    paused.value = false;
    this.syncPause();
  }

  setMuted(v: boolean) {
    muted.value = v;
    this.sound.setMuted(v);
  }

  /** Pause is its own channel in Sound, so it never gets saved as the player's mute. */
  private syncPause() {
    this.sound.setPaused(paused.value);
  }

  nextRace() {
    if (raceIndex.value + 1 < this.cup.tracks.length) {
      raceIndex.value++;
      this.startRace();
    } else {
      const after = CUPS[cupIndex.value + 1];
      const wasOpen = !after || cupOpen(cupIndex.value + 1);
      addResult(this.cup.id, this.placeInCup());
      unlocked.value = !wasOpen && cupOpen(cupIndex.value + 1) ? after! : null;
      phase.value = "podium";
      this.view.mode = "orbit";
      this.view.celebrate();
    }
  }

  retry() {
    if (this.preRace) standings.value = this.preRace; // a retried race scores once
    this.startRace();
  }

  toMenu() {
    paused.value = false;
    this.syncPause();
    this.showcase("cups");
  }

  placeInCup() {
    return [...standings.value].sort((a, b) => b.points - a.points).findIndex((s) => s.player) + 1;
  }

  // ---- internals ----

  /** Race one: the player starts last. After that, reverse standings: the series
   *  leader starts furthest back, whoever that is. */
  private gridOrder(showcase = false) {
    const table = [...standings.value].sort((a, b) => b.points - a.points);
    if (showcase || raceIndex.value === 0 || !table.length) return { rivals: RIVALS, slot: RIVALS.length };
    const front = table.reverse();
    return { rivals: front.filter((s) => !s.player), slot: front.findIndex((s) => s.player) };
  }

  private load(trackId: string, o: { auto: boolean; showcase?: boolean }) {
    const cup = CUPS.find((c) => c.tracks.some((t) => t.id === trackId)) ?? this.cup;
    this.autopilot = o.auto;
    const { rivals, slot } = this.gridOrder(o.showcase);
    this.race = new Race(trackById(trackId), {
      scale: cup.scale,
      difficulty: cup.difficulty,
      rivals,
      player: { name: "You", color: PLAYER_COLOR },
      grid: slot,
      autopilot: o.auto,
    });
    this.view.load(this.race);
    this.sound.startRace(cup.theme);
    course.value = this.race.course;
    this.acc = 0;
    this.lapMark = 0;
    this.lastLap = null;
    this.banner = "";
    this.bannerT = 0;
    this.boostTier = 0;
  }

  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!paused.value && !this.frozen) this.tick(dt, true);
  }

  /** Dev: jump the game forward deterministically, for screenshots and checks. */
  advance(seconds: number) {
    this.frozen = true;
    const steps = Math.round(seconds * 60);
    for (let k = 0; k < steps; k++) this.tick(1 / 60, k >= steps - 30);
  }

  private tick(dt: number, draw: boolean) {
    const race = this.race;
    if (!race) return;

    this.phaseT += dt;
    const p = phase.value;
    this.controls.setActive(p === "intro" || p === "countdown" || p === "racing");
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
      if (c !== this.lastCount) this.sound.beep(c > 0 ? 0 : 1);
      this.lastCount = c;
      if (this.phaseT >= 3) {
        race.started = true;
        phase.value = "racing";
      }
    }

    this.acc += dt;
    while (this.acc >= DT) {
      this.view.capture();
      race.input = this.controls.poll(DT, race.player.car.driftDir !== 0);
      race.step();
      this.acc -= DT;
    }
    this.log.push(...race.log);
    race.log.length = 0;

    for (const ev of this.log) this.handle(ev);
    if (draw) this.view.render(dt, this.acc / DT, this.log);
    this.log.length = 0;

    this.sound.engine(speedOf(race.player.car) / (TUNING.top * race.opts.scale), race.player.car);
    this.publish(dt);

    if (p === "racing" && race.finished) {
      this.phaseT = 0;
      this.view.celebrate();
      this.view.mode = "orbit";
      phase.value = "finish";
      this.sound.finish?.();
      this.award();
    }
    if (p === "finish" && this.phaseT > 3.2) phase.value = "results";
  }

  private handle(ev: RaceEvent) {
    if ("lap" in ev) {
      if (ev.racer.isPlayer) {
        this.lastLap = ev.racer.lapStart - this.lapMark;
        this.lapMark = ev.racer.lapStart;
      }
      if (ev.racer.isPlayer && ev.lap < this.race!.laps) {
        this.say(ev.lap === this.race!.laps - 1 ? "FINAL LAP" : `LAP ${ev.lap + 1}`);
        this.sound.lap(ev.lap === this.race!.laps - 1);
      }
      return;
    }
    if (!ev.racer.isPlayer) return;
    this.sound.event(ev.e);
    if (ev.e.type === "boost") {
      this.boostN++;
      this.boostTier = ev.e.tier;
    }
  }

  private say(text: string) {
    this.banner = text;
    this.bannerT = 2;
  }

  private award() {
    const race = this.race!;
    const order = race.order();
    const add = (r: Racer) => POINTS[order.indexOf(r)] ?? 0;
    // Bots still running get a time from their pace so far, kept in finishing order.
    const total = race.course.n * race.laps;
    let floor = 0;
    lastRace.value = order.map((r) => {
      const pace = Math.max(1, r.progress) / race.t;
      floor = Math.max(floor + 0.04, r.finishT ?? race.t + (total - r.progress) / pace);
      return { name: r.name, time: r.finishT ?? floor, points: add(r), player: r.isPlayer, color: r.color };
    });
    this.preRace = standings.value;
    standings.value = standings.value.map((s) => {
      const r = race.racers.find((x) => x.name === s.name)!;
      return { ...s, points: s.points + add(r) };
    });
  }

  private placeSeen = 0;
  private placeHeld = 0;
  private placeShown = 0;

  private publish(dt: number) {
    const race = this.race!;
    const r = race.player;
    const car = r.car;
    const sp = speedOf(car);
    const t = TUNING;
    this.bannerT -= dt;
    if (this.bannerT <= 0) this.banner = "";
    // In a pack the true order flips every few frames; show a place only once it
    // has held for a moment, so the HUD reports overtakes rather than noise.
    const now = race.place(r);
    if (now !== this.placeSeen) {
      this.placeSeen = now;
      this.placeHeld = 0;
    } else this.placeHeld += dt;
    if (this.placeShown === 0 || this.placeHeld > 0.45 || r.finishT !== null || !race.started) this.placeShown = now;
    hud.value = {
      place: this.placeShown,
      field: race.racers.length,
      lap: Math.min(race.laps, r.lap + 1),
      laps: race.laps,
      time: race.t,
      lastLap: this.lastLap,
      bestLap: r.bestLap,
      speed: Math.round(sp * 3.6),
      speedFrac: Math.min(1.2, sp / (t.top * race.opts.scale)),
      tier: car.tier,
      drift: car.driftDir ? Math.min(1, car.driftT / t.tier3) : 0,
      drifting: car.driftDir !== 0,
      boost: car.boostT > 0,
      boostN: this.boostN,
      boostTier: this.boostTier,
      count: phase.value === "countdown" ? Math.max(0, 3 - Math.floor(this.phaseT)) : 0,
      banner: this.banner,
      auto: this.autopilot,
      cars: race.racers.map((x) => ({ x: x.car.x, z: x.car.z, player: x.isPlayer, color: x.color })),
      thumb: this.controls.thumb,
    };
  }
}
