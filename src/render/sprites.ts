// Pixel maps and sprite helpers. Car rotation is pre-rendered into N frames
// with per-pixel nearest-neighbor sampling so the art always lands on the
// pixel grid — never rotate sprites with ctx.rotate at draw time.

export type PixelMap = string[];
export type Palette = Record<string, string>;

// Keep in sync with CAR_MAP in scripts/make-icons.mjs
export const CAR_MAP: PixelMap = [
  ".....ooooo.....",
  "....obbbbbo....",
  ".oooobbbbboooo.",
  ".owwobebebowwo.",
  ".owwobbbbbowwo.",
  ".oooobbmbboooo.",
  "...obbbbbbbo...",
  "...obBgggBbo...",
  "...obbbbbbbo...",
  ".oooobbbbboooo.",
  ".owwobBBBbowwo.",
  ".owwobBBBbowwo.",
  ".oooobbbbboooo.",
  "....obBBBbo....",
  ".....ooooo.....",
];

export const CAR_PALETTE: Palette = {
  o: "#3a2b20",
  b: "#f2a33c",
  B: "#d9862e",
  w: "#634934",
  e: "#201612",
  g: "#f9e9b8",
  m: "#201612",
};

export const MUSHROOM_MAP: PixelMap = [
  ".rrr.",
  "rrWrr",
  "rWrrr",
  ".fff.",
  ".fff.",
];

export const MUSHROOM_PALETTE: Palette = { r: "#d94f3d", W: "#f6efdc", f: "#efe4cd" };

export const STUMP_MAP: PixelMap = [
  ".ttttt.",
  "ttdddtt",
  "ttdddtt",
  "ttttttt",
  ".t...t.",
];

export const STUMP_PALETTE: Palette = { t: "#8a5a33", d: "#a97544" };

export function drawMap(
  ctx: CanvasRenderingContext2D,
  map: PixelMap,
  palette: Palette,
  x: number,
  y: number
): void {
  for (let my = 0; my < map.length; my++) {
    const row = map[my]!;
    for (let mx = 0; mx < row.length; mx++) {
      const color = palette[row[mx]!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + mx, y + my, 1, 1);
    }
  }
}

export const CAR_FRAME_COUNT = 32;

/**
 * Pre-render the car at CAR_FRAME_COUNT rotations. Frame 0 faces up (-y);
 * frame k is rotated k * 2PI/N clockwise.
 */
export function buildCarFrames(): HTMLCanvasElement[] {
  const mapW = CAR_MAP[0]!.length;
  const mapH = CAR_MAP.length;
  const size = Math.ceil(Math.hypot(mapW, mapH)) + 2;
  const rgba = new Map<string, [number, number, number]>();
  for (const [key, hex] of Object.entries(CAR_PALETTE)) {
    rgba.set(key, [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]);
  }

  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < CAR_FRAME_COUNT; f++) {
    const angle = (f / CAR_FRAME_COUNT) * Math.PI * 2;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const u = dx - size / 2 + 0.5;
        const v = dy - size / 2 + 0.5;
        const sx = Math.floor(u * cos - v * sin + mapW / 2);
        const sy = Math.floor(u * sin + v * cos + mapH / 2);
        if (sx < 0 || sy < 0 || sx >= mapW || sy >= mapH) continue;
        const color = rgba.get(CAR_MAP[sy]![sx]!);
        if (!color) continue;
        const i = (dy * size + dx) * 4;
        img.data[i] = color[0];
        img.data[i + 1] = color[1];
        img.data[i + 2] = color[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    frames.push(canvas);
  }
  return frames;
}

export function carFrameIndex(heading: number): number {
  const angle = heading + Math.PI / 2; // sprite faces up at frame 0
  const n = CAR_FRAME_COUNT;
  return ((Math.round((angle / (Math.PI * 2)) * n) % n) + n) % n;
}
