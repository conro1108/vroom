// A tiny line-style overview of the track with a dot per racer, tucked in the
// top-left during a race. Pure display: it projects world coordinates into a
// small box that preserves the track's aspect ratio, draws the centerline loop
// once into a reusable Path2D, and stamps racer dots on top each frame.
import type { Track } from "../game/track";
import { projectTrack } from "./trackshape";

const INNER_W = 78; // px the track drawing may fill, before padding
const INNER_H = 64;
const PAD = 7;

// Theme-independent so the map reads the same on every cup's palette.
const COLORS = {
  bg: "rgba(249, 241, 224, 0.82)", // cream-light, see-through
  edge: "#5a4632", // brown frame + centerline
  start: "#4a3728",
  opponent: "#8a7a63", // muted
  player: "#e0532f", // accent orange
  playerEdge: "#4a3728",
};

export interface MiniMap {
  /** Rebuild the projection for a new track (call when a race loads). */
  setTrack(track: Track): void;
  /** Draw the loop plus one dot per racer (positions in world units). */
  render(player: { x: number; y: number }, opponents: { x: number; y: number }[]): void;
  hide(): void;
}

export function createMinimap(): MiniMap {
  const el = document.getElementById("minimap") as HTMLCanvasElement;
  const ctx = el.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;

  let path: Path2D | null = null;
  let start = { x: 0, y: 0 };
  let cssW = 0;
  let cssH = 0;
  // world -> box projection, set in setTrack
  let projX = (x: number) => x;
  let projY = (y: number) => y;

  function setTrack(track: Track): void {
    const proj = projectTrack(track, INNER_W, INNER_H, PAD);
    projX = proj.projX;
    projY = proj.projY;
    path = proj.path;
    start = proj.start;

    cssW = Math.ceil(proj.width);
    cssH = Math.ceil(proj.height);
    el.style.width = `${cssW}px`;
    el.style.height = `${cssH}px`;
    el.width = Math.round(cssW * dpr);
    el.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function dot(x: number, y: number, r: number, fill: string, edge?: string): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (edge) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = edge;
      ctx.stroke();
    }
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function render(player: { x: number; y: number }, opponents: { x: number; y: number }[]): void {
    if (!path) return;
    el.hidden = false;
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.fillStyle = COLORS.bg;
    roundRect(ctx, 0.75, 0.75, cssW - 1.5, cssH - 1.5, 6);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.edge;
    ctx.stroke();

    // the track loop
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.edge;
    ctx.lineJoin = "round";
    ctx.stroke(path);

    // start/finish tick
    dot(start.x, start.y, 1.6, COLORS.start);

    for (const o of opponents) dot(projX(o.x), projY(o.y), 2, COLORS.opponent);
    dot(projX(player.x), projY(player.y), 2.6, COLORS.player, COLORS.playerEdge);
  }

  function hide(): void {
    el.hidden = true;
  }

  return { setTrack, render, hide };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
