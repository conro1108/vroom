// The renderer's front door: owns the WebGL context, the camera rigs (chase,
// flyover, orbit), and per-frame posing of cars and effects. It reads a Race and
// never writes to it. Adapts resolution to hold frame rate on phones.
import * as THREE from "three";
import { speedOf } from "../sim/car";
import type { Course } from "../sim/course";
import type { Race, RaceEvent } from "../sim/race";
import { TUNING } from "../sim/tuning";
import { CarModel } from "./carmodel";
import { Fx } from "./fx";
import { World } from "./world";

export type CamMode = "chase" | "flyover" | "orbit";

const lerpAngle = (a: number, b: number, t: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
};

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.3, 2600);
  mode: CamMode = "chase";
  flyover = 0; // 0..1 through the intro sweep
  private world: World | null = null;
  private fx: Fx | null = null;
  private race: Race | null = null;
  private models: CarModel[] = [];
  private prev: { x: number; y: number; z: number; h: number }[] = [];
  private camH = 0;
  private camY = 0;
  private shake = 0;
  private fovKick = 0;
  private orbit = 0;
  private aspect = 1;
  private frameAvg = 16;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private settle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(this.dpr);
    const fit = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = this.aspect;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", fit);
    fit();
  }

  load(race: Race) {
    this.unload();
    this.race = race;
    this.world = new World(race.course, this.scene);
    this.fx = new Fx(this.scene, this.camera);
    for (const r of race.racers) {
      const m = new CarModel(r.color, r.isPlayer || race.racers.length < 5);
      this.scene.add(m.root);
      this.models.push(m);
      this.prev.push({ x: r.car.x, y: r.car.y, z: r.car.z, h: r.car.h });
    }
    const p = race.player.car;
    this.camH = p.h;
    this.camY = p.y;
  }

  unload() {
    this.world?.dispose();
    this.fx?.dispose();
    this.models.forEach((m) => m.dispose());
    this.models = [];
    this.prev = [];
    this.world = null;
    this.fx = null;
    this.race = null;
  }

  /** Call right before stepping the sim so render can interpolate between steps. */
  capture() {
    this.race?.racers.forEach((r, i) => {
      const p = this.prev[i]!;
      p.x = r.car.x;
      p.y = r.car.y;
      p.z = r.car.z;
      p.h = r.car.h;
    });
  }

  private events(log: RaceEvent[]) {
    const fx = this.fx!;
    for (const ev of log) {
      if (!("e" in ev)) continue;
      const i = this.race!.racers.indexOf(ev.racer);
      const car = ev.racer.car;
      const near = ev.racer.isPlayer;
      switch (ev.e.type) {
        case "wall":
          fx.impact(car.x, car.y, car.z, ev.e.hit);
          if (near) this.shake = Math.max(this.shake, ev.e.hit * 0.5);
          break;
        case "land":
          this.models[i]!.bounce(Math.min(2.4, ev.e.drop * 0.16));
          if (near) this.shake = Math.max(this.shake, Math.min(0.45, ev.e.drop * 0.03));
          if (this.world!.theme.ground !== "void") {
            const puffs = Math.min(5, Math.round(ev.e.drop * 0.35));
            for (let k = 0; k < puffs; k++) fx.dust(car.x, car.y, car.z, this.world!.theme.verge, car.vx, car.vz, 0.25);
          }
          break;
        case "drift":
          this.models[i]!.bounce(0.7);
          break;
        case "boost":
          if (near) this.fovKick = Math.max(this.fovKick, 1);
          fx.burst(car.x, car.y, car.z, 18, Math.min(3, ev.e.tier));
          break;
        case "tier":
          fx.burst(car.x, car.y, car.z, 14, ev.e.tier);
          break;
      }
    }
  }

  celebrate() {
    const p = this.race?.player.car;
    if (p) this.fx?.confetti(p.x, p.y, p.z);
  }

  render(dt: number, alpha: number, log: RaceEvent[]) {
    const race = this.race;
    const fx = this.fx;
    const world = this.world;
    if (!race || !fx || !world) return;
    this.events(log);
    const top = TUNING.top * race.opts.scale;
    const road = world.theme.verge;
    race.racers.forEach((r, i) => {
      const c = r.car;
      const p = this.prev[i]!;
      const [x, y, z] = [p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha];
      const h = lerpAngle(p.h, c.h, alpha);
      const m = this.models[i]!;
      m.pose(c, x, y, z, h, dt, top);
      m.root.visible = !(c.fallT > 0 && c.fallT < TUNING.respawnSeconds * 0.5 && Math.floor(c.fallT * 16) % 2 === 0);

      const speed = speedOf(c);
      const [fx0, fz0] = [Math.cos(h), Math.sin(h)];
      const [rx, rz] = [-fz0, fx0];
      const sliding = c.driftDir !== 0 && c.grounded;
      for (const s of [-1, 1]) {
        const key = `${i}${s}`;
        const [wx, wz] = [x - fx0 * 1.05 + rx * s * 0.86, z - fz0 * 1.05 + rz * s * 0.86];
        if (sliding) {
          fx.skid(key, wx, y, wz, h);
          if (Math.random() < dt * 34) fx.dust(wx, y, wz, c.onRoad || world.theme.ground === "void" ? 0xe9edf2 : road, c.vx, c.vz);
          if (c.tier > 0 && Math.random() < dt * 90) fx.spark(wx, y, wz, c.tier, c.vx, c.vz);
        } else {
          fx.skidEnd(key);
          if (!c.onRoad && c.grounded && speed > 6 && world.theme.ground !== "void" && Math.random() < dt * 24) fx.dust(wx, y, wz, road, c.vx, c.vz);
        }
      }
    });

    this.cameraFor(dt, alpha);
    const p = race.player.car;
    world.update(dt, new THREE.Vector3(p.x, p.y, p.z), this.camera);
    fx.update(dt, speedOf(p) / top, p.boostT > 0);
    this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  private cameraFor(dt: number, alpha: number) {
    const race = this.race!;
    const cam = this.camera;
    const c = race.course;
    const car = race.player.car;
    const prev = this.prev[race.racers.indexOf(race.player)]!;
    const [x, y, z] = [prev.x + (car.x - prev.x) * alpha, prev.y + (car.y - prev.y) * alpha, prev.z + (car.z - prev.z) * alpha];
    const portrait = this.aspect < 1;

    if (this.mode === "flyover") {
      // sweep the first stretch of the lap toward the grid, low and fast
      const u = this.flyover;
      const e = u * u * (3 - 2 * u);
      const i = Math.floor(c.n * (0.12 * (1 - e))) % c.n;
      const j = (i + 24) % c.n;
      const side = 16 * (1 - e) + 3;
      const a = c.h[i]!;
      cam.position.set(c.x[i]! - Math.sin(a) * side - Math.cos(a) * 14 * e, c.y[i]! + 4 + 16 * (1 - e), c.z[i]! + Math.cos(a) * side - Math.sin(a) * 14 * e);
      cam.lookAt(e > 0.6 ? x : c.x[j]!, (e > 0.6 ? y : c.y[j]!) + 1, e > 0.6 ? z : c.z[j]!);
      cam.fov = portrait ? 80 : 60;
      cam.updateProjectionMatrix();
      this.camH = car.h;
      this.camY = car.y;
      return;
    }
    if (this.mode === "orbit") {
      this.orbit += dt * 0.35;
      const dist = portrait ? 11 : 8;
      cam.position.set(x + Math.cos(this.orbit) * dist, y + 2.2, z + Math.sin(this.orbit) * dist);
      cam.lookAt(x, y + 0.9, z);
      cam.fov = 45;
      cam.updateProjectionMatrix();
      return;
    }

    const speed = speedOf(car);
    const sf = Math.min(1.35, speed / (TUNING.top * race.opts.scale));
    const velH = speed > 3 ? Math.atan2(car.vz, car.vx) : car.h;
    // Lag behind the slide so you see the car's flank in a drift, without the
    // horizon swinging as hard as the car does.
    const aim = lerpAngle(velH, car.h, 0.55);
    this.camH = lerpAngle(this.camH, aim, Math.min(1, dt * (car.driftDir ? 3.6 : 5.5)));
    this.camY += (y - this.camY) * Math.min(1, dt * (car.grounded ? 9 : 4));

    const back = (portrait ? 8.6 : 6.4) + sf * 1.6;
    const up = (portrait ? 5 : 2.7) + sf * 0.35;
    const [fx, fz] = [Math.cos(this.camH), Math.sin(this.camH)];
    this.shake *= Math.exp(-dt * 8);
    const sh = this.shake;
    cam.position.set(
      x - fx * back + (Math.random() - 0.5) * sh,
      this.camY + up + (Math.random() - 0.5) * sh,
      z - fz * back + (Math.random() - 0.5) * sh
    );
    const ahead = (portrait ? 6 : 9) + sf * 5;
    const ly = c.y[(car.i + Math.round(ahead / c.ds)) % c.n]!;
    cam.lookAt(x + fx * ahead, Math.max(ly, this.camY - 3) + 0.9, z + fz * ahead);
    cam.rotateZ(-car.steer * 0.022 * sf);

    this.fovKick *= Math.exp(-dt * 2.4);
    const base = portrait ? 74 : 60;
    const fov = base + sf * sf * 9 + this.fovKick * 7 + (car.boostT > 0 ? 3 : 0);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 7);
    cam.updateProjectionMatrix();
  }

  private adapt(dt: number) {
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.04;
    this.settle -= dt;
    if (this.settle > 0) return;
    if (this.frameAvg > 24 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.renderer.setPixelRatio(this.dpr);
      this.settle = 2;
    } else if (this.frameAvg > 30 && this.renderer.shadowMap.enabled && this.dpr <= 1) {
      this.world!.sun.castShadow = false;
      this.settle = 2;
    }
  }
}
