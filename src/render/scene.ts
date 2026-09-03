// Draws the world at 1 world unit = 1 buffer pixel into a low-res buffer,
// then blits it to the display canvas at an integer scale. The static world
// (ground, road, kerbs, decorations, fence) is painted once; tree canopies
// are kept as a list and drawn over the cars each frame; skid marks
// accumulate on their own world-sized canvas and slowly fade.
import type { GhostPose } from "../game/ghost";
import type { ItemWorld } from "../game/items";
import type { CarState } from "../game/physics";
import type { Track, TrackQuery } from "../game/track";
import type { Tuning } from "../game/tuning";
import { themeById, type WorldTheme } from "./themes";
import {
  buildCarFrames,
  buildShadowFrames,
  CROWN_MAP,
  CROWN_PALETTE,
  drawMap,
  HOMING_MAP,
  HOMING_PALETTE,
  ITEM_BOX_MAP,
  ITEM_BOX_PALETTE,
  PEBBLE_MAP,
  ROCK_MAP,
  ROCKET_MAP,
  ROCKET_PALETTE,
  MUSHROOM_MAP,
  MUSHROOM_PALETTE,
  OIL_MAP,
  OIL_PALETTE,
  STUMP_MAP,
  STUMP_PALETTE,
  TREE_MAPS,
  vehicleSprite,
  type PixelMap,
} from "./sprites";

// Theme-independent colors; everything the ground is made of lives in the
// WorldTheme (render/themes.ts) so each cup reads as its own place.
const COLORS = {
  checkerDark: "#4a3728",
  checkerLight: "#f6efdc",
  dust: "#e3d3ae",
  boost: "#fff6df",
  driftWarm: "#ff9d3d", // drift smoke catching fire — charge is building
  driftSpark: "#ffe98a", // charge banked, the exit will pay
  skid: "rgba(58, 43, 32, 0.35)",
  grassTrack: "rgba(30, 40, 20, 0.16)", // wheels flattening the grass
  wind: "rgba(255, 255, 255, 0.45)",
  shadow: "rgba(30, 22, 14, 0.28)",
  marker: "#ffd23f", // "this one's you" chevron
  markerEdge: "#2a2014",
};

// Finish-line confetti: the HUD palette, so the celebration looks like it came
// out of the same box of crayons as the rest of the game.
const CONFETTI = ["#e0532f", "#ffd23f", "#58b558", "#f9f1e0", "#5ab6e0"];

// Sparks thrown off a car dropping off the edge of a void track.
const FALL_SPARKS = ["#ffe98a", "#7ff0ff", "#ff8ad4", "#f9f1e0"];

const TARGET_BUFFER_WIDTH = 210;

// Corners tighter than this radius (world px) get rumble strips.
const KERB_RADIUS = 150;
const KERB_BLOCK = 6; // arc-px per colour block

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color?: string; // defaults to dust
  len?: number; // streak particles: drawn as a line this long along (dx, dy)
  dx?: number;
  dy?: number;
}

/** A drawable racer that isn't the player: position + which sprite set. */
export interface RacerPose {
  x: number;
  y: number;
  heading: number;
  vehicleId: string;
}

/** A tree canopy, drawn over the cars. `x`/`y` is its top-left in world px. */
interface Canopy {
  x: number;
  y: number;
  img: HTMLCanvasElement;
}

export class Scene {
  private world: HTMLCanvasElement;
  private canopies: Canopy[];
  private skid: HTMLCanvasElement;
  private skidCtx: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private bufferCtx: CanvasRenderingContext2D;
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  private carFrames: HTMLCanvasElement[];
  private carShadows: HTMLCanvasElement[];
  private framesByVehicle = new Map<string, HTMLCanvasElement[]>();
  private shadowsByVehicle = new Map<string, HTMLCanvasElement[]>();
  private particles: Particle[] = [];
  private cam: { x: number; y: number };
  private scale = 2;
  private viewHeight = 265; // world-px kept vertically visible on wide screens; frame() syncs it from Tuning
  private skidFadeTimer = 0;
  private shakeAmt = 0; // world-px of camera shake left to burn off
  private frameHeld = new Map<string, number>(); // per-car rotation frame, see heldFrame
  private clock = 0; // wall time, for the player marker's idle bob
  private ready = false;

  private theme: WorldTheme;

  constructor(
    private track: Track,
    private query: TrackQuery,
    display: HTMLCanvasElement,
    vehicleId = "classic",
    fenceMarginPx: number | null = null,
    theme: WorldTheme = themeById("meadow")
  ) {
    this.theme = theme;
    this.display = display;
    this.displayCtx = display.getContext("2d")!;
    display.style.background = theme.grass; // letterbox slack matches the world
    const painted = paintWorld(track, query, fenceMarginPx, theme);
    this.world = painted.canvas;
    this.canopies = painted.canopies;
    this.skid = document.createElement("canvas");
    this.skid.width = track.worldWidth;
    this.skid.height = track.worldHeight;
    this.skidCtx = this.skid.getContext("2d")!;
    this.buffer = document.createElement("canvas");
    this.bufferCtx = this.buffer.getContext("2d")!;
    this.carFrames = this.framesFor(vehicleId);
    this.carShadows = this.shadowsFor(vehicleId);
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
    items: ItemWorld | null = null,
    driftCharge = 0
  ): void {
    if (!this.ready) this.resize();
    if (!this.ready) return; // still no layout — skip this frame
    this.setViewHeight(tuning.desktopZoomWorldHeight);
    this.clock += dt;
    this.updateCamera(dt, car, tuning);
    this.updateEffects(dt, car, tuning, boosting, driftCharge);
    this.draw(car, ghost, racers, items);
  }

  /** Kick the camera: a hit or a wall lands harder when the frame flinches. */
  shake(px: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, px);
  }

  /** One-shot burst for a slipstream payoff: a pair of air streaks that whoosh
   *  back past the car, so the boost reads without a line of HUD text. */
  slipstreamBurst(car: CarState): void {
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    const lx = -fy;
    const ly = fx;
    for (let i = 0; i < 34; i++) {
      // A wide fan starting level with the nose that sweeps *backward* past the
      // car — the air pocket letting go. Velocities are relative to the car so
      // the streaks always fall behind it however fast the boost is carrying.
      const along = -4 + Math.random() * 22;
      const side = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 12);
      this.particles.push({
        x: car.x + fx * along + lx * side,
        y: car.y + fy * along + ly * side,
        vx: car.vx - fx * 190 + lx * side * 2, // the wake splays out as it drops back
        vy: car.vy - fy * 190 + ly * side * 2,
        life: 0.45 + Math.random() * 0.3,
        color: COLORS.boost,
      });
    }
  }

  /**
   * Confetti raining over the car — call it every frame through the finish
   * celebration and it tops itself up rather than dumping the lot at once.
   * The bits drift down the screen (+y) so they read as falling, not exploding.
   */
  confetti(car: CarState): void {
    for (let i = 0; i < 3 && this.particles.length < 220; i++) {
      const spread = this.buffer.width * 1.2; // wider than the view, so no bare edges
      this.particles.push({
        x: car.x + (Math.random() - 0.5) * spread,
        y: car.y - this.buffer.height / 2 - Math.random() * 20, // in from above the view
        vx: (Math.random() - 0.5) * 30,
        vy: 55 + Math.random() * 50,
        life: 1.6 + Math.random() * 0.8,
        color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)]!,
      });
    }
  }

  /**
   * Going over the edge of a void track: a scatter of sparks that keeps the
   * car's momentum and spills *downward*, so the moment reads as falling away
   * from the road rather than crashing on it.
   */
  fallBurst(car: CarState): void {
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: car.x + (Math.random() - 0.5) * 10,
        y: car.y + (Math.random() - 0.5) * 10,
        vx: car.vx * 0.35 + (Math.random() - 0.5) * 40,
        vy: car.vy * 0.35 + 40 + Math.random() * 70,
        life: 0.5 + Math.random() * 0.4,
        color: FALL_SPARKS[Math.floor(Math.random() * FALL_SPARKS.length)]!,
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
    this.shakeAmt = 0;
    this.frameHeld.clear(); // cars are being replaced/repositioned: don't ease into the new headings
  }

  private updateCamera(dt: number, car: CarState, tuning: Tuning): void {
    // Lead along where the car is *pointed*, at its forward speed. Leading by
    // the raw velocity vector swung the camera sideways every time the back
    // stepped out, so the whole world lurched through a drift — exactly when
    // you most want a steady frame to read the corner in.
    const fwd = Math.max(0, car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading));
    const lead = fwd * tuning.lookAhead;
    const tx = car.x + Math.cos(car.heading) * lead;
    const ty = car.y + Math.sin(car.heading) * lead;
    const k = Math.min(1, tuning.cameraLerp * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const hw = this.buffer.width / 2;
    const hh = this.buffer.height / 2;
    this.cam.x = clamp(this.cam.x, hw, this.track.worldWidth - hw);
    this.cam.y = clamp(this.cam.y, hh, this.track.worldHeight - hh);
  }

  private updateEffects(
    dt: number,
    car: CarState,
    tuning: Tuning,
    boosting = false,
    driftCharge = 0
  ): void {
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 12);
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
    const fx = Math.cos(car.heading);
    const fy = Math.sin(car.heading);
    const lx = -fy;
    const ly = fx;
    const speed = Math.hypot(car.vx, car.vy);
    // Wind: near top speed, faint streaks whip past either side of the car.
    // They sit still in the world, so it's the camera flying over them that
    // draws the line — the cheapest sense of speed there is.
    if (speed > tuning.maxSpeed * 0.82 && this.particles.length < 140 && Math.random() < 0.5) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const along = 30 + Math.random() * 90;
      const out = 14 + Math.random() * 70;
      this.particles.push({
        x: car.x + fx * along + lx * side * out,
        y: car.y + fy * along + ly * side * out,
        vx: 0,
        vy: 0,
        life: 0.22 + Math.random() * 0.1,
        color: COLORS.wind,
        len: 5 + Math.round(speed / 40),
        dx: fx,
        dy: fy,
      });
    }
    const offroad = this.query.surfaceAt(car.x, car.y) === "offroad";
    if (car.drifting || (offroad && speed > 25)) {
      // rubber on the road, flattened grass off it — both fade on the skid layer
      this.skidCtx.fillStyle = car.drifting && !offroad ? COLORS.skid : COLORS.grassTrack;
      for (const side of [-1, 1]) {
        const wx = car.x - fx * 5 + lx * side * 4;
        const wy = car.y - fy * 5 + ly * side * 4;
        this.skidCtx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
      }
    }
    if (car.drifting) {
      if (this.particles.length < 80) {
        // Tire smoke heats up as the drift banks charge — dust, then embers,
        // then full sparks once the boost is ready to cash. That color ramp is
        // the only tell the player gets that the exit is about to pay.
        const heat =
          driftCharge >= 1
            ? COLORS.driftSpark
            : driftCharge > 0.55
              ? COLORS.driftWarm
              : undefined;
        this.particles.push({
          x: car.x - fx * 6 + (Math.random() - 0.5) * 6,
          y: car.y - fy * 6 + (Math.random() - 0.5) * 6,
          vx: -car.vx * 0.1 + (Math.random() - 0.5) * 20,
          vy: -car.vy * 0.1 + (Math.random() - 0.5) * 20,
          life: 0.5 + Math.random() * 0.3,
          color: heat,
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

  private shadowsFor(vehicleId: string): HTMLCanvasElement[] {
    let shadows = this.shadowsByVehicle.get(vehicleId);
    if (!shadows) {
      shadows = buildShadowFrames(this.framesFor(vehicleId), COLORS.shadow);
      this.shadowsByVehicle.set(vehicleId, shadows);
    }
    return shadows;
  }

  /** A car with its silhouette shadow, offset down-right as if lit from above-left. */
  private drawCar(
    ctx: CanvasRenderingContext2D,
    frames: HTMLCanvasElement[],
    shadows: HTMLCanvasElement[],
    id: string,
    x: number,
    y: number,
    heading: number
  ): void {
    const i = this.heldFrame(id, heading, frames.length);
    const frame = frames[i]!;
    const ox = x - Math.floor(frame.width / 2);
    const oy = y - Math.floor(frame.height / 2);
    ctx.drawImage(shadows[i]!, ox + 1, oy + 2);
    ctx.drawImage(frame, ox, oy);
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
    //
    // Everything drawn on top is therefore rounded in *world* space and only
    // then shifted by sx/sy — never `round(x - sx)`. Rounding after the shift
    // folds the camera's sub-pixel fraction into the rounding, and since that
    // fraction sweeps through a whole pixel every frame or two, it kicked cars
    // and particles a full buffer pixel back and forth at random. Rounding in
    // world space locks them to the same grid as the road they're driving on.
    const shakeX = this.shakeAmt > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeAmt) : 0;
    const shakeY = this.shakeAmt > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shakeAmt) : 0;
    const originX = this.cam.x - bw / 2 + shakeX;
    const originY = this.cam.y - bh / 2 + shakeY;
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
      if (p.len) {
        for (let k = 0; k < p.len; k++) {
          ctx.fillRect(Math.round(p.x - p.dx! * k) - sx, Math.round(p.y - p.dy! * k) - sy, 1, 1);
        }
      } else {
        ctx.fillRect(Math.round(p.x) - sx - 1, Math.round(p.y) - sy - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;

    // item world under the cars: oil first (on the road), then boxes, then shots
    if (items) {
      for (const oil of items.oils) {
        drawMap(ctx, OIL_MAP, OIL_PALETTE, Math.round(oil.x) - sx - 5, Math.round(oil.y) - sy - 2);
      }
      for (const box of items.boxes) {
        if (box.respawnIn > 0) continue;
        const bx = Math.round(box.x) - sx - 4;
        const by = Math.round(box.y) - sy - 4;
        ctx.fillStyle = COLORS.shadow;
        ctx.fillRect(bx + 1, by + 9, 8, 2);
        drawMap(ctx, ITEM_BOX_MAP, ITEM_BOX_PALETTE, bx, by);
      }
      for (const m of items.missiles) {
        const map = m.chaseLeader ? CROWN_MAP : m.homing ? HOMING_MAP : ROCKET_MAP;
        const palette = m.chaseLeader ? CROWN_PALETTE : m.homing ? HOMING_PALETTE : ROCKET_PALETTE;
        drawMap(ctx, map, palette, Math.round(m.x) - sx - 2, Math.round(m.y) - sy - 2);
      }
    }

    // opponents under the player so the player's car always reads on top
    for (let i = 0; i < racers.length; i++) {
      const racer = racers[i]!;
      this.drawCar(
        ctx,
        this.framesFor(racer.vehicleId),
        this.shadowsFor(racer.vehicleId),
        `racer${i}`,
        Math.round(racer.x) - sx,
        Math.round(racer.y) - sy,
        racer.heading
      );
    }

    // ghost under the real car: drawn as the vehicle that set the record, translucent
    if (ghost) {
      const gFrames = this.framesFor(ghost.vehicleId);
      const gFrame = gFrames[this.heldFrame("ghost", ghost.heading, gFrames.length)]!;
      const gx = Math.round(ghost.x) - sx;
      const gy = Math.round(ghost.y) - sy;
      ctx.globalAlpha = 0.45;
      ctx.drawImage(gFrame, gx - Math.floor(gFrame.width / 2), gy - Math.floor(gFrame.height / 2));
      ctx.globalAlpha = 1;
    }

    const cx = Math.round(car.x) - sx;
    const cy = Math.round(car.y) - sy;
    this.drawCar(ctx, this.carFrames, this.carShadows, "player", cx, cy, car.heading);

    // tree canopies over everything on the ground, so a car that strays wide
    // ducks under them
    for (const c of this.canopies) {
      const x = c.x - sx;
      const y = c.y - sy;
      if (x + c.img.width < 0 || y + c.img.height < 0 || x > bw || y > bh) continue;
      ctx.drawImage(c.img, x, y);
    }

    this.drawPlayerMarker(ctx, cx, cy);

    this.displayCtx.drawImage(this.buffer, -fracX, -fracY, bw * this.scale, bh * this.scale);
  }

  // A little chevron that hovers over the player's car (and gently bobs) so
  // "which one is me" is never a question mid-pack. `cy` is the car's center;
  // the rotated frame's bounding box is bigger than the art, so anchor to the
  // center and sit a fixed nudge above the roof instead of to that box.
  private drawPlayerMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const bob = Math.round(Math.sin(this.clock * 4) * 1.5);
    const my = cy - 13 + bob; // float just above the roof, pointing down
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

  /**
   * Which rotation frame a car (keyed by `id`) is showing, with hysteresis.
   *
   * Two things make an unfiltered `carFrameIndex` look bad. A heading sitting
   * right on a frame boundary flickers between two sprites every render, which
   * is what made a wobbling bot shimmer; the widened deadband below holds the
   * current frame until the heading is clearly past its neighbour. And snapping
   * straight to the target skips frames mid-corner, so a turn reads as a
   * stutter rather than a rotation — hence stepping one frame at a time. Only a
   * genuinely large jump (a spin, a rescue setting the car down) snaps.
   */
  private heldFrame(id: string, heading: number, n: number): number {
    const pos = (((heading + Math.PI / 2) / (Math.PI * 2)) * n + n) % n; // continuous frame position
    const held = this.frameHeld.get(id);
    if (held === undefined) {
      const first = Math.round(pos) % n;
      this.frameHeld.set(id, first);
      return first;
    }
    const diff = ((pos - held + n * 1.5) % n) - n / 2; // signed frames to travel
    if (Math.abs(diff) <= 0.7) return held;
    const step = Math.abs(diff) >= 4 ? Math.round(diff) : Math.sign(diff);
    const next = (held + step + n) % n;
    this.frameHeld.set(id, next);
    return next;
  }
}

// ---- world painting ----

/**
 * Fence posts along both corridor edges, so the physical boundary the cars
 * bounce off reads on screen. Only the stretches the track flagged as fenced
 * get posts — the open sections are meant to look open, because running off
 * them is a legal (if slow) excursion rather than a wall. Posts that fall
 * inside another road section's corridor are skipped, which naturally merges
 * the fencing where two parts of the track run close together.
 */
function paintTrackFence(
  ctx: CanvasRenderingContext2D,
  track: Track,
  query: TrackQuery,
  marginPx: number,
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
      if (!track.fenced[i]) {
        prev = null; // open runoff: no fence here, and no rail into the next post
        continue;
      }
      const corridor = track.halfWidths[i]! + marginPx; // fence hugs the local edge
      const nx = -(b.y - a.y) / segLen;
      const ny = (b.x - a.x) / segLen;
      const px = a.x + nx * corridor * side;
      const py = a.y + ny * corridor * side;
      const offMap = px < 8 || py < 10 || px > track.worldWidth - 8 || py > track.worldHeight - 8;
      if (offMap || query.edgeDistance(px, py) < marginPx - 2) {
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

/**
 * The ground: base colour with two tones of organic patches from value noise,
 * on a 3px cell so the edges stay chunky. Written straight into an ImageData —
 * an aligned grid of 8px squares read as compression artefacts, not grass.
 */
function paintGround(ctx: CanvasRenderingContext2D, w: number, h: number, theme: WorldTheme): void {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const base = rgb(theme.grass);
  const dark = rgb(theme.grassPatch);
  const light = rgb(theme.grassLight);
  const CELL = 3;
  for (let cy = 0; cy < h; cy += CELL) {
    for (let cx = 0; cx < w; cx += CELL) {
      const n = valueNoise(cx / 26, cy / 26) * 0.65 + valueNoise(cx / 9 + 71, cy / 9 + 13) * 0.35;
      const c = n > 0.58 ? dark : n < 0.4 ? light : base;
      for (let y = cy; y < Math.min(h, cy + CELL); y++) {
        let i = (y * w + cx) * 4;
        for (let x = cx; x < Math.min(w, cx + CELL); x++) {
          d[i] = c[0];
          d[i + 1] = c[1];
          d[i + 2] = c[2];
          d[i + 3] = 255;
          i += 4;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Smoothed signed curvature (1/px) at every sample; positive = turning one way. */
function trackCurvature(track: Track): Float32Array {
  const n = track.samples.length;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = track.samples[(i - 1 + n) % n]!;
    const b = track.samples[i]!;
    const c = track.samples[(i + 1) % n]!;
    const h1 = Math.atan2(b.y - a.y, b.x - a.x);
    const h2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = h2 - h1;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const len = (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y)) / 2 || 1;
    raw[i] = d / len;
  }
  const out = new Float32Array(n);
  const R = 4;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -R; k <= R; k++) s += raw[(i + k + n) % n]!;
    out[i] = s / (2 * R + 1);
  }
  return out;
}

/**
 * Red-and-white rumble strips along both edges through every real corner.
 * Nothing says "race track" faster, and they mark the braking points a flat
 * ribbon of road hides.
 */
function paintKerbs(ctx: CanvasRenderingContext2D, track: Track, theme: WorldTheme): void {
  const n = track.samples.length;
  const curv = trackCurvature(track);
  const thr = 1 / KERB_RADIUS;
  ctx.lineWidth = 4;
  ctx.lineCap = "butt";
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (Math.abs(curv[i]!) < thr && Math.abs(curv[j]!) < thr) continue;
      const a = track.samples[i]!;
      const b = track.samples[j]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      const ha = track.halfWidths[i]! - 2;
      const hb = track.halfWidths[j]! - 2;
      const arc = track.progress[i]! * track.lapLength;
      ctx.strokeStyle = theme.kerb[Math.floor(arc / KERB_BLOCK) % 2]!;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * ha * side, a.y + ny * ha * side);
      ctx.lineTo(b.x + nx * hb * side, b.y + ny * hb * side);
      ctx.stroke();
    }
  }
}

/** Render a pixel map to its own little canvas, only the listed letters. */
function bakeMap(map: PixelMap, palette: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = map[0]!.length;
  c.height = map.length;
  drawMap(c.getContext("2d")!, map, palette, 0, 0);
  return c;
}

/** A soft dark ellipse on the ground — every object with height gets one. */
function paintShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintWorld(
  track: Track,
  query: TrackQuery,
  fenceMarginPx: number | null = null,
  theme: WorldTheme = themeById("meadow")
): { canvas: HTMLCanvasElement; canopies: Canopy[] } {
  const canvas = document.createElement("canvas");
  canvas.width = track.worldWidth;
  canvas.height = track.worldHeight;
  const ctx = canvas.getContext("2d")!;

  paintGround(ctx, canvas.width, canvas.height, theme);

  // road: dark edge pass, then fill pass. Each segment is stroked with round
  // caps at its local width, so straights come out straight (a circle per
  // sample scalloped them) and authored pinches still ease in and out.
  const w = track.roadWidth;
  const n = track.samples.length;
  ctx.lineCap = "round";
  for (const pass of [
    { pad: 3, color: theme.roadEdge },
    { pad: 0, color: theme.road },
  ]) {
    ctx.strokeStyle = pass.color;
    for (let i = 0; i < n; i++) {
      const a = track.samples[i]!;
      const b = track.samples[(i + 1) % n]!;
      ctx.lineWidth = track.halfWidths[i]! + track.halfWidths[(i + 1) % n]! + pass.pad * 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // road speckle
  ctx.fillStyle = theme.speckle;
  for (let i = 0; i < n; i += 2) {
    const p = track.samples[i]!;
    const a = hash(i, 1) * Math.PI * 2;
    const r = hash(i, 2) * (track.halfWidths[i]! - 6);
    ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r), 2, 1);
  }

  paintKerbs(ctx, track, theme);

  // decorations, kept off the road and its shoulder (distances from the
  // local road edge, so planting follows pinches and fans). Trees stay past
  // the fence line so the racing corridor is never hidden under a canopy.
  const canopies: Canopy[] = [];
  const treePalette = { c: theme.canopy, C: theme.canopyLight };
  const trunkPalette = { t: theme.trunk };
  const rockPalette = { k: theme.rock, K: theme.rockLight };
  const treeMap = theme.tree === "none" || track.voidRunoff ? null : TREE_MAPS[theme.tree]!;
  const canopyImg = treeMap ? bakeMap(treeMap, treePalette) : null;
  const rockImg = bakeMap(ROCK_MAP, rockPalette);
  const pebbleImg = bakeMap(PEBBLE_MAP, rockPalette);
  const treeMin = 26;
  const treeW = treeMap ? treeMap[0]!.length : 0;
  const treeH = treeMap ? treeMap.length : 0;
  for (let gy = 8; gy < canvas.height - 8; gy += 14) {
    for (let gx = 8; gx < canvas.width - 8; gx += 14) {
      // jitter off the lattice so nothing lines up
      const x = gx + Math.floor(hash(gx, gy + 11) * 9) - 4;
      const y = gy + Math.floor(hash(gx + 5, gy) * 9) - 4;
      const edge = query.edgeDistance(x, y);
      if (edge < 8) continue;
      const r = hash(x, y + 3);
      const inWorld = x > 16 && y > 16 && x < canvas.width - 24 && y < canvas.height - 24;
      // trees come in groves: a slow noise field decides where the woods are.
      // They may stand on the runoff past the shoulder — canopies are drawn
      // over the cars, so a car that runs wide ducks under them, but they stay
      // clear of the road surface itself.
      const grove = Math.max(0, valueNoise(x / 120 + 300, y / 120 + 300) - 0.38) * 1.6;
      const treeP = 0.02 + grove * 0.22;
      if (r < treeP && canopyImg && inWorld && edge > treeMin) {
        const tx = x - Math.floor(treeW / 2);
        const ty = y - treeH + 2; // (x, y) is where the trunk meets the ground
        paintShadow(ctx, x + 2, y + 1, treeW * 0.42, 3);
        drawMap(ctx, treeMap!, trunkPalette, tx, ty);
        canopies.push({ x: tx, y: ty, img: canopyImg });
      } else if (r < treeP + 0.012 && inWorld && edge > 14) {
        paintShadow(ctx, x + 4, y + 4, 4, 1.5);
        ctx.drawImage(rockImg, x, y);
      } else if (r < treeP + 0.024 && edge > 10) {
        ctx.drawImage(pebbleImg, x, y);
      } else if (r < 0.1 + treeP) {
        ctx.fillStyle = theme.tuft;
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x + 3, y + 2, 2, 1);
      } else if (r < 0.14 + treeP) {
        const color = theme.flowers[Math.floor(hash(x, y + 7) * theme.flowers.length)]!;
        ctx.fillStyle = theme.tuft;
        ctx.fillRect(x, y + 1, 1, 2);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 2, 2);
      } else if (r < 0.146 + treeP && edge > w * 0.5 && theme.tree === "round") {
        drawMap(ctx, MUSHROOM_MAP, MUSHROOM_PALETTE, x, y);
      } else if (r < 0.15 + treeP && edge > w * 0.8 && theme.tree === "round") {
        drawMap(ctx, STUMP_MAP, STUMP_PALETTE, x, y);
      }
    }
  }
  // canopies drawn in y order so a tree in front overlaps the one behind
  canopies.sort((a, b) => a.y - b.y);

  if (fenceMarginPx !== null) paintTrackFence(ctx, track, query, fenceMarginPx, theme);

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

  return { canvas, canopies };
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 0..1 value noise: hash on an integer lattice, smoothstep between. */
function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
