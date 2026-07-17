// Fit a track's centerline loop into a small box, preserving aspect ratio.
// Shared by the in-race minimap and the solo track-picker thumbnails so both
// draw the same little line-shape of each course.
import type { Track } from "../game/track";

export interface TrackProjection {
  projX: (x: number) => number;
  projY: (y: number) => number;
  /** css-px box the projection fills, including `pad` on every side */
  width: number;
  height: number;
  path: Path2D; // the closed centerline loop, ready to stroke
  start: { x: number; y: number }; // projected start-line point
}

export function projectTrack(track: Track, innerW: number, innerH: number, pad: number): TrackProjection {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of track.samples) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min(innerW / w, innerH / h);
  const projX = (x: number) => pad + (x - minX) * scale;
  const projY = (y: number) => pad + (y - minY) * scale;

  const path = new Path2D();
  const s = track.samples;
  path.moveTo(projX(s[0]!.x), projY(s[0]!.y));
  for (let i = 1; i < s.length; i++) path.lineTo(projX(s[i]!.x), projY(s[i]!.y));
  path.closePath();

  return {
    projX,
    projY,
    width: w * scale + pad * 2,
    height: h * scale + pad * 2,
    path,
    start: { x: projX(track.start.x), y: projY(track.start.y) },
  };
}

/** A tiny stroked outline of a track, sized crisply for the DPR. */
export function trackThumb(track: Track, boxW: number, boxH: number): HTMLCanvasElement {
  const pad = 4;
  const proj = projectTrack(track, boxW - pad * 2, boxH - pad * 2, pad);
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.ceil(proj.width);
  const ch = Math.ceil(proj.height);
  const canvas = document.createElement("canvas");
  canvas.className = "track-thumb";
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#5a4632"; // brown, matches the map ink
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(proj.path);
  ctx.fillStyle = "#e0532f"; // accent dot marks the start line
  ctx.beginPath();
  ctx.arc(proj.start.x, proj.start.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
