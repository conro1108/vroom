// Draws the world at 1 world unit = 1 buffer pixel into a low-res buffer,
// then blits it to the display canvas at an integer scale. The static world
// (grass, road, decorations, fence) is painted once; skid marks accumulate on
// their own world-sized canvas and slowly fade.
import type { GhostPose } from "../game/ghost";
import type { ItemWorld } from "../game/items";
import type { CarState } from "../game/physics";
import type { Track, TrackQuery } from "../game/track";
import type { Tuning } from "../game/tuning";
import { themeById, type WorldTheme } from "./themes";
import {
  buildCarFrames,
  carFrameIndex,
  CROWN_MAP,
  CROWN_PALETTE,
  drawMap,
  HOMING_MAP,
  HOMING_PALETTE,
  ITEM_BOX_MAP,
  ITEM_BOX_PALETTE,
  ROCKET_MAP,
  ROCKET_PALETTE,
  MUSHROOM_MAP,
  MUSHROOM_PALETTE,
  OIL_MAP,
  OIL_PALETTE,
  STUMP_MAP,
  STUMP_PALETTE,
  vehicleSprite,
} from "./sprites";

// Theme-independent colors; everything the ground is made of lives in the
// WorldTheme (render/themes.ts) so each cup reads as its own place.
const COLORS = {
  checkerDark: "#4a3728",
  checkerLight: "#f6efdc",
  dust: "#e3d3ae",
  boost: "#fff6df",
  skid: "rgba(58, 43, 32, 0.35)",
  shadow: "rgba(42, 32, 20, 0.2)",
  marker: "#ffd23f", // "this one's you" chevron
  markerEdge: "#2a2014",
};

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
  private viewHeight = 190; // world-px kept vertically visible on wide screens; frame() syncs it from Tuning
  private skidFadeTimer = 0;
  private lastCarFrame = -1;
  private clock = 0; // wall time, for the player marker's idle bob
  private ready = false;

  private theme: WorldTheme;

  constructor(
    private track: Track,
    query: TrackQuery,
    display: HTMLCanvasElement,
    vehicleId = "classic",
    corridorPx: number | null = null,
    theme: WorldTheme = themeById("meadow")
  ) {
    this.theme = theme;
    this.display = display;
    this.displayCtx = display.getContext("2d")!;
    display.style.background = theme.grass; // letterbox slack matches the world
    this.world = paintWorld(track, query, corridorPx, theme);
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
    // Zoom to whichever axis is the tighter fit: portrait phones are
    // width-bound (a fixed ~210px-wide field), but a wide desktop window would
    // otherwise show a squat letterbox with no road ahead — there the height
    // target wins, zooming out until viewHeight world-px are visible vertically.
    const scaleW = (rect.width * dpr) / TARGET_BUFFER_WIDTH;
    const scaleH = dispH / this.viewHeight;
    this.scale = Math.max(2, Math.round(Math.min(scaleW, scaleH)));
    // +2px margin so the sub-pixel scroll offset always has buffer to reveal.
    this.buffer.width = Math.ceil(dispW / this.scale) + 2;
    this.buffer.height = Math.ceil(dispH / this.scale) + 2;
    this.display.width = dispW;
    this.display.height = dispH;
    this.displayCtx.imageSmoothingEnabled = false;
    this.ready = true;
  }

  /** Dial the wide-screen vertical field (world-px). Re-zooms if it changed. */
  setViewHeight(h: number): void {
    if (h === this.viewHeight) return;
    this.viewHeight = h;
    this.resize();
  }

  frame(
    dt: number,
    car: CarState,
    tuning: Tuning,
    ghost: GhostPose | null = null,
    racers: RacerPose[] = [],
    boosting = false,
    items: ItemWorld | null = null
  ): void {
    if (!this.ready) this.resize();
    if (!this.ready) return; // still no layout — skip this frame
    this.setViewHeight(tuning.desktopZoomWorldHeight);
    this.clock += dt;
    this.updateCamera(dt, car, tuning);
    this.updateEffects(dt, car, boosting);
    this.draw(car, ghost, racers, items);
  }

  /** One-shot burst for a slipstream payoff: a pair of air streaks that rip
   *  forward past the car, so the boost reads without a line of HUD text. */
  slipstreamBurst(car: CarState): void {
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    const lx = -fy;
    const ly = fx;
    for (let i = 0; i < 34; i++) {
      // A wide fan alongside the car that rips forward *past* it — the air
      // pocket letting go. Velocities are relative to the car so the streaks
      // always overtake it instead of hanging around the tail like boost dust.
      const along = -14 + Math.random() * 22;
      const side = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 12);
      this.particles.push({
        x: car.x + fx * along + lx * side,
        y: car.y + fy * along + ly * side,
        vx: car.vx + fx * 190 - lx * side * 2, // splayed streaks pinch in as they pass
        vy: car.vy + fy * 190 - ly * side * 2,
        life: 0.45 + Math.random() * 0.3,
        color: COLORS.boost,
      });
    }
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

  private draw(
    car: CarState,
    ghost: GhostPose | null,
    racers: RacerPose[],
    items: ItemWorld | null = null
  ): void {
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

    ctx.fillStyle = this.theme.grass;
    ctx.fillRect(0, 0, bw, bh);
    ctx.drawImage(this.world, sx, sy, bw, bh, 0, 0, bw, bh);
    ctx.drawImage(this.skid, sx, sy, bw, bh, 0, 0, bw, bh);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color ?? COLORS.dust;
      ctx.fillRect(Math.round(p.x - sx) - 1, Math.round(p.y - sy) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // item world under the cars: oil first (on the road), then boxes, then shots
    if (items) {
      for (const oil of items.oils) {
        drawMap(ctx, OIL_MAP, OIL_PALETTE, Math.round(oil.x - sx) - 5, Math.round(oil.y - sy) - 2);
      }
      for (const box of items.boxes) {
        if (box.respawnIn > 0) continue;
        drawMap(ctx, ITEM_BOX_MAP, ITEM_BOX_PALETTE, Math.round(box.x - sx) - 4, Math.round(box.y - sy) - 4);
      }
      for (const m of items.missiles) {
        const map = m.chaseLeader ? CROWN_MAP : m.homing ? HOMING_MAP : ROCKET_MAP;
        const palette = m.chaseLeader ? CROWN_PALETTE : m.homing ? HOMING_PALETTE : ROCKET_PALETTE;
        drawMap(ctx, map, palette, Math.round(m.x - sx) - 2, Math.round(m.y - sy) - 2);
      }
    }

    // opponents under the player so the player's car always reads on top
    for (const racer of racers) {
      const frames = this.framesFor(racer.vehicleId);
      const frame = frames[carFrameIndex(racer.heading)]!;
      const rx = Math.round(racer.x - sx);
      const ry = Math.round(racer.y - sy);
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(rx - 7, ry + 6, 14, 3);
      ctx.drawImage(frame, rx - Math.floor(frame.width / 2), ry - Math.floor(frame.height / 2));
    }

    // ghost under the real car: drawn as the vehicle that set the record, translucent
    if (ghost) {
      const gFrame = this.framesFor(ghost.vehicleId)[carFrameIndex(ghost.heading)]!;
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
    ctx.fillRect(cx - 7, cy + 6, 14, 3);
    ctx.drawImage(frame, cx - Math.floor(frame.width / 2), cy - Math.floor(frame.height / 2));
    this.drawPlayerMarker(ctx, cx, cy);

    this.displayCtx.drawImage(this.buffer, -fracX, -fracY, bw * this.scale, bh * this.scale);
  }

  // A little chevron that hovers over the player's car (and gently bobs) so
  // "which one is me" is never a question mid-pack. `cy` is the car's center;
  // the rotated frame's bounding box is bigger than the art, so anchor to the
  // center and sit a fixed nudge above the roof instead of to that box.
  private drawPlayerMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const bob = Math.round(Math.sin(this.clock * 4) * 1.5);
    const my = cy - 12 + bob; // float just above the roof, pointing down
    ctx.fillStyle = COLORS.markerEdge;
    for (let r = 0; r < 4; r++) {
      const hw = 3 - r;
      ctx.fillRect(cx - hw, my + r, hw * 2 + 1, 1);
    }
    ctx.fillStyle = COLORS.marker;
    for (let r = 0; r < 3; r++) {
      const hw = 2 - r;
      ctx.fillRect(cx - hw, my + 1 + r, hw * 2 + 1, 1);
    }
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

/**
 * Fence posts along both corridor edges, so the physical boundary the cars
 * bounce off reads on screen. Posts that fall inside another road section's
 * corridor are skipped, which naturally merges the fencing where two parts
 * of the track run close together.
 */
function paintTrackFence(
  ctx: CanvasRenderingContext2D,
  track: Track,
  query: TrackQuery,
  corridor: number,
  theme: WorldTheme
): void {
  const n = track.samples.length;
  const spacing = 20;
  for (const side of [-1, 1]) {
    let acc = spacing;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < n; i++) {
      const a = track.samples[i]!;
      const b = track.samples[(i + 1) % n]!;
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      acc += segLen;
      if (acc < spacing) continue;
      acc = 0;
      const nx = -(b.y - a.y) / segLen;
      const ny = (b.x - a.x) / segLen;
      const px = a.x + nx * corridor * side;
      const py = a.y + ny * corridor * side;
      const offMap = px < 8 || py < 10 || px > track.worldWidth - 8 || py > track.worldHeight - 8;
      if (offMap || query.distanceToRoad(px, py) < corridor - 2) {
        prev = null;
        continue;
      }
      if (prev && Math.hypot(px - prev.x, py - prev.y) < spacing * 1.9) {
        ctx.strokeStyle = theme.fenceRail;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y - 3);
        ctx.lineTo(px, py - 3);
        ctx.stroke();
      }
      ctx.fillStyle = theme.fencePost;
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 5, 2, 6);
      prev = { x: px, y: py };
    }
  }
}

function paintWorld(
  track: Track,
  query: TrackQuery,
  corridorPx: number | null = null,
  theme: WorldTheme = themeById("meadow")
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = track.worldWidth;
  canvas.height = track.worldHeight;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = theme.grass;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // mottled ground patches
  for (let y = 0; y < canvas.height; y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      if (hash(x, y) < 0.22) {
        ctx.fillStyle = theme.grassPatch;
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }

  // road: dark edge pass, then fill pass
  const w = track.roadWidth;
  for (const pass of [
    { radius: w / 2 + 3, color: theme.roadEdge },
    { radius: w / 2, color: theme.road },
  ]) {
    ctx.fillStyle = pass.color;
    for (const p of track.samples) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pass.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // road speckle
  ctx.fillStyle = theme.speckle;
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
        ctx.fillStyle = theme.tuft;
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x + 3, y + 2, 2, 1);
      } else if (r < 0.09) {
        const color = theme.flowers[Math.floor(hash(x, y + 7) * theme.flowers.length)]!;
        ctx.fillStyle = theme.tuft;
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

  if (corridorPx !== null) paintTrackFence(ctx, track, query, corridorPx, theme);

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
  ctx.fillStyle = theme.fenceRail;
  ctx.fillRect(4, 6, canvas.width - 8, 2);
  ctx.fillRect(4, canvas.height - 10, canvas.width - 8, 2);
  ctx.fillRect(4, 6, 2, canvas.height - 14);
  ctx.fillRect(canvas.width - 8, 6, 2, canvas.height - 14);
  ctx.fillStyle = theme.fencePost;
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
