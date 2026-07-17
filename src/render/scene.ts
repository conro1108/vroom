// Draws the world at 1 world unit = 1 buffer pixel into a low-res buffer,
// then blits it to the display canvas at an integer scale. The static world
// (grass, road, decorations, fence) is painted once; skid marks accumulate on
// their own world-sized canvas and slowly fade.
import type { GhostPose } from "../game/ghost";
import type { CarState } from "../game/physics";
import type { Track, TrackQuery } from "../game/track";
import type { Tuning } from "../game/tuning";
import {
  buildCarFrames,
  carFrameIndex,
  drawMap,
  MUSHROOM_MAP,
  MUSHROOM_PALETTE,
  STUMP_MAP,
  STUMP_PALETTE,
  vehicleSprite,
} from "./sprites";

const COLORS = {
  grass: "#7fbf4d",
  grassPatch: "#77b747",
  tuft: "#639e39",
  roadEdge: "#b5975f",
  road: "#d9c08f",
  speckle: "#cbb283",
  checkerDark: "#4a3728",
  checkerLight: "#f6efdc",
  fencePost: "#8a5a33",
  fenceRail: "#7a5233",
  dust: "#e3d3ae",
  boost: "#fff6df",
  skid: "rgba(58, 43, 32, 0.35)",
  shadow: "rgba(42, 32, 20, 0.2)",
};

const FLOWER_COLORS = ["#e88bb8", "#f2d066", "#f6efdc"];
const TARGET_BUFFER_WIDTH = 210;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color?: string; // defaults to dust
}

/** A drawable racer that isn't the player: position + which sprite set. */
export interface RacerPose {
  x: number;
  y: number;
  heading: number;
  vehicleId: string;
}

export class Scene {
  private world: HTMLCanvasElement;
  private skid: HTMLCanvasElement;
  private skidCtx: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  private carFrames: HTMLCanvasElement[];
  private framesByVehicle = new Map<string, HTMLCanvasElement[]>();
  private particles: Particle[] = [];
  private cam: { x: number; y: number };
  private scale = 2;
  private skidFadeTimer = 0;
  private lastCarFrame = -1;
  private ready = false;

  constructor(
    private track: Track,
    query: TrackQuery,
    display: HTMLCanvasElement,
    vehicleId = "classic"
  ) {
    this.display = display;
    this.displayCtx = display.getContext("2d")!;
    this.world = paintWorld(track, query);
    this.skid = document.createElement("canvas");
    this.skid.width = track.worldWidth;
    this.skid.height = track.worldHeight;
    this.skidCtx = this.skid.getContext("2d")!;
    this.buffer = document.createElement("canvas");
    this.bufferCtx = this.buffer.getContext("2d")!;
    this.carFrames = buildCarFrames(vehicleSprite(vehicleId));
    this.cam = { x: track.start.x, y: track.start.y };
    this.resize();
  }

  resize(): void {
    const rect = this.display.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const dispW = Math.round(rect.width * dpr);
    const dispH = Math.round(rect.height * dpr);
    // Layout isn't ready yet (0-size box): skip so we don't lock in a broken
    // buffer. A ResizeObserver re-runs this the moment the canvas gets a box.
    if (dispW === 0 || dispH === 0) return;
    this.scale = Math.max(2, Math.round((rect.width * dpr) / TARGET_BUFFER_WIDTH));
    // +2px margin so the sub-pixel scroll offset always has buffer to reveal.
    this.buffer.width = Math.ceil(dispW / this.scale) + 2;
    this.buffer.height = Math.ceil(dispH / this.scale) + 2;
    this.display.width = dispW;
    this.display.height = dispH;
    this.displayCtx.imageSmoothingEnabled = false;
    this.ready = true;
  }

  frame(
    dt: number,
    car: CarState,
    tuning: Tuning,
    ghost: GhostPose | null = null,
    racers: RacerPose[] = [],
    boosting = false
  ): void {
    if (!this.ready) this.resize();
    if (!this.ready) return; // still no layout — skip this frame
    this.updateCamera(dt, car, tuning);
    this.updateEffects(dt, car, boosting);
    this.draw(car, ghost, racers);
  }

  /** Snap the camera onto the car with no easing (used after a reset). */
  centerOn(car: CarState): void {
    this.cam.x = car.x;
    this.cam.y = car.y;
  }

  clearMarks(): void {
    this.skidCtx.clearRect(0, 0, this.skid.width, this.skid.height);
    this.particles.length = 0;
  }

  private updateCamera(dt: number, car: CarState, tuning: Tuning): void {
    const tx = car.x + car.vx * tuning.lookAhead;
    const ty = car.y + car.vy * tuning.lookAhead;
    const k = Math.min(1, tuning.cameraLerp * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const hw = this.buffer.width / 2;
    const hh = this.buffer.height / 2;
    this.cam.x = clamp(this.cam.x, hw, this.track.worldWidth - hw);
    this.cam.y = clamp(this.cam.y, hh, this.track.worldHeight - hh);
  }

  private updateEffects(dt: number, car: CarState, boosting = false): void {
    if (boosting && this.particles.length < 120) {
      // speed streaks trailing off the tail while a boost is live
      const bfx = Math.cos(car.heading);
      const bfy = Math.sin(car.heading);
      this.particles.push({
        x: car.x - bfx * 8 + (Math.random() - 0.5) * 6,
        y: car.y - bfy * 8 + (Math.random() - 0.5) * 6,
        vx: -bfx * 70 + (Math.random() - 0.5) * 15,
        vy: -bfy * 70 + (Math.random() - 0.5) * 15,
        life: 0.2 + Math.random() * 0.15,
        color: COLORS.boost,
      });
    }
    if (car.drifting) {
      const fx = Math.cos(car.heading);
      const fy = Math.sin(car.heading);
      const lx = -fy;
      const ly = fx;
      for (const side of [-1, 1]) {
        const wx = car.x - fx * 5 + lx * side * 4;
        const wy = car.y - fy * 5 + ly * side * 4;
        this.skidCtx.fillStyle = COLORS.skid;
        this.skidCtx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
      }
      if (this.particles.length < 80) {
        this.particles.push({
          x: car.x - fx * 6 + (Math.random() - 0.5) * 6,
          y: car.y - fy * 6 + (Math.random() - 0.5) * 6,
          vx: -car.vx * 0.1 + (Math.random() - 0.5) * 20,
          vy: -car.vy * 0.1 + (Math.random() - 0.5) * 20,
          life: 0.5 + Math.random() * 0.3,
        });
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.skidFadeTimer += dt;
    if (this.skidFadeTimer >= 0.25) {
      this.skidFadeTimer = 0;
      this.skidCtx.save();
      this.skidCtx.globalCompositeOperation = "destination-out";
      this.skidCtx.globalAlpha = 0.035;
      this.skidCtx.fillStyle = "#000";
      this.skidCtx.fillRect(0, 0, this.skid.width, this.skid.height);
      this.skidCtx.restore();
    }
  }

  private framesFor(vehicleId: string): HTMLCanvasElement[] {
    let frames = this.framesByVehicle.get(vehicleId);
    if (!frames) {
      frames = buildCarFrames(vehicleSprite(vehicleId));
      this.framesByVehicle.set(vehicleId, frames);
    }
    return frames;
  }

  private draw(car: CarState, ghost: GhostPose | null, racers: RacerPose[]): void {
    const ctx = this.bufferCtx;
    const bw = this.buffer.width;
    const bh = this.buffer.height;
    // Floor the camera to a whole world pixel for crisp sampling, then push the
    // leftover fraction into the final blit so scrolling stays smooth instead of
    // snapping the whole scene a buffer-pixel at a time (the source of the jitter).
    const originX = this.cam.x - bw / 2;
    const originY = this.cam.y - bh / 2;
    const sx = Math.floor(originX);
    const sy = Math.floor(originY);
    const fracX = Math.round((originX - sx) * this.scale);
    const fracY = Math.round((originY - sy) * this.scale);

    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, bw, bh);
    ctx.drawImage(this.world, sx, sy, bw, bh, 0, 0, bw, bh);
    ctx.drawImage(this.skid, sx, sy, bw, bh, 0, 0, bw, bh);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color ?? COLORS.dust;
      ctx.fillRect(Math.round(p.x - sx) - 1, Math.round(p.y - sy) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // opponents under the player so the player's car always reads on top
    for (const racer of racers) {
      const frames = this.framesFor(racer.vehicleId);
      const frame = frames[carFrameIndex(racer.heading)]!;
      const rx = Math.round(racer.x - sx);
      const ry = Math.round(racer.y - sy);
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(rx - 6, ry + 5, 12, 3);
      ctx.drawImage(frame, rx - Math.floor(frame.width / 2), ry - Math.floor(frame.height / 2));
    }

    // ghost under the real car: same pre-rendered frames, just translucent
    if (ghost) {
      const gFrame = this.carFrames[carFrameIndex(ghost.heading)]!;
      const gx = Math.round(ghost.x - sx);
      const gy = Math.round(ghost.y - sy);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(gFrame, gx - Math.floor(gFrame.width / 2), gy - Math.floor(gFrame.height / 2));
      ctx.globalAlpha = 1;
    }

    const frame = this.carFrames[this.carFrame(car.heading)]!;
    const cx = Math.round(car.x - sx);
    const cy = Math.round(car.y - sy);
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(cx - 6, cy + 5, 12, 3);
    ctx.drawImage(frame, cx - Math.floor(frame.width / 2), cy - Math.floor(frame.height / 2));

    this.displayCtx.drawImage(this.buffer, -fracX, -fracY, bw * this.scale, bh * this.scale);
  }

  // Hysteresis: hold the current rotation frame until the heading is clearly
  // past a neighbour, so small steering wobble doesn't flicker the sprite.
  private carFrame(heading: number): number {
    const target = carFrameIndex(heading);
    if (this.lastCarFrame < 0) return (this.lastCarFrame = target);
    const n = this.carFrames.length;
    let diff = ((target - this.lastCarFrame + n + n / 2) % n) - n / 2;
    if (Math.abs(diff) >= 2) this.lastCarFrame = target;
    return this.lastCarFrame;
  }
}

function paintWorld(track: Track, query: TrackQuery): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = track.worldWidth;
  canvas.height = track.worldHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // mottled grass patches
  for (let y = 0; y < canvas.height; y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      if (hash(x, y) < 0.22) {
        ctx.fillStyle = COLORS.grassPatch;
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }

  // road: dark edge pass, then fill pass
  const w = track.roadWidth;
  for (const pass of [
    { radius: w / 2 + 3, color: COLORS.roadEdge },
    { radius: w / 2, color: COLORS.road },
  ]) {
    ctx.fillStyle = pass.color;
    for (const p of track.samples) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pass.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // road speckle
  ctx.fillStyle = COLORS.speckle;
  for (let i = 0; i < track.samples.length; i += 2) {
    const p = track.samples[i]!;
    const a = hash(i, 1) * Math.PI * 2;
    const r = hash(i, 2) * (w / 2 - 4);
    ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 2, 1);
  }

  // decorations, kept off the road and its shoulder
  for (let y = 8; y < canvas.height - 8; y += 14) {
    for (let x = 8; x < canvas.width - 8; x += 14) {
      const dist = query.distanceToRoad(x, y);
      if (dist < w / 2 + 8) continue;
      const r = hash(x, y + 3);
      if (r < 0.05) {
        ctx.fillStyle = COLORS.tuft;
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x + 3, y + 2, 2, 1);
      } else if (r < 0.09) {
        const color = FLOWER_COLORS[Math.floor(hash(x, y + 7) * FLOWER_COLORS.length)]!;
        ctx.fillStyle = COLORS.tuft;
        ctx.fillRect(x, y + 1, 1, 2);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 2, 2);
      } else if (r < 0.098 && dist > w) {
        drawMap(ctx, MUSHROOM_MAP, MUSHROOM_PALETTE, x, y);
      } else if (r < 0.103 && dist > w * 1.3) {
        drawMap(ctx, STUMP_MAP, STUMP_PALETTE, x, y);
      }
    }
  }

  // checkered start line, two rows deep across the road
  const start = track.start;
  const dir = { x: Math.cos(track.startHeading), y: Math.sin(track.startHeading) };
  const normal = { x: -dir.y, y: dir.x };
  const cell = 4;
  for (let row = 0; row < 2; row++) {
    for (let k = -Math.floor(w / 2 / cell); k < Math.floor(w / 2 / cell); k++) {
      const cx = start.x + normal.x * (k * cell + cell / 2) + dir.x * (row * cell);
      const cy = start.y + normal.y * (k * cell + cell / 2) + dir.y * (row * cell);
      ctx.fillStyle = (k + row) % 2 === 0 ? COLORS.checkerDark : COLORS.checkerLight;
      ctx.fillRect(Math.round(cx - cell / 2), Math.round(cy - cell / 2), cell, cell);
    }
  }

  // fence around the world edge
  ctx.fillStyle = COLORS.fenceRail;
  ctx.fillRect(4, 6, canvas.width - 8, 2);
  ctx.fillRect(4, canvas.height - 10, canvas.width - 8, 2);
  ctx.fillRect(4, 6, 2, canvas.height - 14);
  ctx.fillRect(canvas.width - 8, 6, 2, canvas.height - 14);
  ctx.fillStyle = COLORS.fencePost;
  for (let x = 4; x < canvas.width - 6; x += 22) {
    ctx.fillRect(x, 3, 3, 9);
    ctx.fillRect(x, canvas.height - 13, 3, 9);
  }
  for (let y = 4; y < canvas.height - 6; y += 22) {
    ctx.fillRect(3, y, 3, 9);
    ctx.fillRect(canvas.width - 9, y, 3, 9);
  }

  return canvas;
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
