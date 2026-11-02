// A race: the field of cars, lap counting, positions, and the bots. Bots follow
// the course's solved racing line with pure pursuit, and each has a pace, a line
// bias and a fuse for mistakes. Rubber-banding is deliberately mild and reads the
// gap to the player, so close racing doesn't need cheating you can feel.
import { buildCourse, type Course, type TrackDef } from "./course";
import { createCar, speedOf, stepCar, type Car, type CarEvent, type Input } from "./car";
import { TUNING } from "./tuning";

export const DT = 1 / 120;

export interface Racer {
  car: Car;
  name: string;
  color: number;
  isPlayer: boolean;
  pace: number; // fraction of the line's speed limit
  bias: number; // metres off the racing line
  lap: number; // laps completed
  progress: number; // total samples travelled, signed
  lastI: number;
  finishT: number | null;
  bestLap: number | null;
  lapStart: number;
  placeAtFinish: number;
}

export interface RaceOptions {
  scale: number; // speed scale for this cup
  difficulty: number; // bot pace, ~0.9 easy .. ~1.0 flat out
  rivals: { name: string; color: number }[];
  player: { name: string; color: number };
  grid: number; // player's grid slot, 0 = pole
  autopilot?: boolean;
}

export type RaceEvent = { racer: Racer; e: CarEvent } | { lap: number; racer: Racer };

export class Race {
  readonly course: Course;
  readonly racers: Racer[] = [];
  readonly player: Racer;
  readonly laps: number;
  t = 0;
  started = false;
  finished = false;
  input: Input = { steer: 0, throttle: 0, brake: 0, drift: false };
  log: RaceEvent[] = [];
  private seed = 7;

  constructor(def: TrackDef, readonly opts: RaceOptions) {
    this.course = buildCourse(def);
    this.laps = def.laps ?? 3;
    const c = this.course;
    const field = opts.rivals.length + 1;
    const slots = Array.from({ length: field }, (_, k) => k);
    let rival = 0;
    for (const slot of slots) {
      const row = Math.floor(slot / 2);
      const back = Math.round((8 + row * 9 + (slot % 2) * 4.5) / c.ds);
      const i = (c.n - back) % c.n;
      const d = (slot % 2 ? 1 : -1) * c.half[i]! * 0.42;
      const isPlayer = slot === opts.grid;
      const who = isPlayer ? opts.player : opts.rivals[rival++]!;
      const racer: Racer = {
        car: createCar(c, i, d), name: who.name, color: who.color, isPlayer,
        pace: isPlayer ? 1 : opts.difficulty * (0.985 - 0.012 * (rival - 1) + this.rand() * 0.006),
        bias: isPlayer ? 0 : (slot % 2 ? 1 : -1) * (0.6 + this.rand() * 2.4),
        lap: 0, progress: -back, lastI: i, finishT: null, bestLap: null, lapStart: 0, placeAtFinish: 0,
      };
      this.racers.push(racer);
    }
    this.player = this.racers.find((r) => r.isPlayer)!;
  }

  private rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  step() {
    const c = this.course;
    if (this.started) this.t += DT;
    for (const r of this.racers) {
      const auto = !r.isPlayer || r.finishT !== null || this.opts.autopilot;
      const inp = !this.started ? { steer: 0, throttle: 0, brake: 0, drift: false } : auto ? this.bot(r) : this.input;
      stepCar(r.car, inp, c, TUNING, this.opts.scale, DT);
      this.track(r);
      for (const e of r.car.events) this.log.push({ racer: r, e });
      r.car.events.length = 0;
    }
    this.bump();
  }

  private track(r: Racer) {
    const c = this.course;
    let d = r.car.i - r.lastI;
    if (d > c.n / 2) d -= c.n;
    if (d < -c.n / 2) d += c.n;
    r.lastI = r.car.i;
    r.progress += d;
    const lap = Math.floor(r.progress / c.n);
    if (lap > r.lap) {
      r.lap = lap;
      const time = this.t - r.lapStart;
      r.lapStart = this.t;
      if (r.bestLap === null || time < r.bestLap) r.bestLap = time;
      this.log.push({ lap, racer: r });
      if (lap >= this.laps && r.finishT === null) {
        r.finishT = this.t;
        r.placeAtFinish = this.racers.filter((o) => o.finishT !== null).length;
        if (r.isPlayer) this.finished = true;
      }
    }
  }

  private bot(r: Racer): Input {
    const c = this.course;
    const car = r.car;
    const speed = speedOf(car);
    const look = Math.round((speed * 0.3 + 5) / c.ds);
    const j = (car.i + look) % c.n;
    const nx = -Math.sin(c.h[j]!);
    const nz = Math.cos(c.h[j]!);
    const off = c.line[j]! + r.bias * (c.half[j]! > 5 ? 1 : 0.4);
    const [tx, tz] = [c.x[j]! + nx * off, c.z[j]! + nz * off];
    let e = Math.atan2(tz - car.z, tx - car.x) - car.h;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    const steer = Math.max(-1, Math.min(1, e / 0.32));

    // leash, not a tow rope
    let band = 1;
    if (!r.isPlayer && r.finishT === null) {
      const gap = (this.player.progress - r.progress) * c.ds;
      band = 1 + Math.max(-0.05, Math.min(0.05, gap / 900));
    }
    const brakeAhead = Math.round((speed * 0.16) / c.ds);
    const limit = c.vmax[(car.i + brakeAhead) % c.n]! * this.opts.scale * r.pace * band;
    const over = speed - limit;
    return {
      steer,
      throttle: over > 0 ? 0 : 1,
      brake: over > 1.5 ? Math.min(1, over / 5) : 0,
      drift: false,
    };
  }

  private bump() {
    const R = TUNING.bumpRadius;
    const cars = this.racers;
    for (let a = 0; a < cars.length; a++) {
      for (let b = a + 1; b < cars.length; b++) {
        const [p, q] = [cars[a]!.car, cars[b]!.car];
        if (p.fallT > 0 || q.fallT > 0 || Math.abs(p.y - q.y) > 2) continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist >= R * 2 || dist === 0) continue;
        const [nx, nz] = [dx / dist, dz / dist];
        const push = (R * 2 - dist) / 2;
        p.x -= nx * push;
        p.z -= nz * push;
        q.x += nx * push;
        q.z += nz * push;
        const rel = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
        if (rel < 0) {
          const imp = -rel * 0.6;
          p.vx -= nx * imp;
          p.vz -= nz * imp;
          q.vx += nx * imp;
          q.vz += nz * imp;
        }
      }
    }
  }

  /** Current order, leader first. Finishers keep their finishing place. */
  order(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finishT !== null && b.finishT !== null) return a.finishT - b.finishT;
      if (a.finishT !== null) return -1;
      if (b.finishT !== null) return 1;
      return b.progress - a.progress;
    });
  }

  place(r: Racer) {
    return this.order().indexOf(r) + 1;
  }
}
