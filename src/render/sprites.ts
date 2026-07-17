// Pixel maps and sprite helpers. Car rotation is pre-rendered into N frames
// with per-pixel nearest-neighbor sampling so the art always lands on the
// pixel grid — never rotate sprites with ctx.rotate at draw time.

export type PixelMap = string[];
export type Palette = Record<string, string>;

// A rounded silhouette with 2px features so nearest-neighbor rotation degrades
// gracefully at every angle. Keep in sync with CAR_MAP in scripts/make-icons.mjs.
export const CAR_MAP: PixelMap = [
  ".................",
  ".......ooo.......",
  "......obbbo......",
  ".....obbbbbo.....",
  "....obbgggbbo....",
  "....obgggggbo....",
  "...owbbgggbbwo...",
  "...obbbbbbbbbo...",
  "...obbbbbbbbbo...",
  "...obbbhhhbbbo...",
  "...owBBhhhBBwo...",
  "....oBBBBBBBo....",
  "....oBBBBBBBo....",
  ".....oBBBBBo.....",
  "......oBBBo......",
  ".......ooo.......",
  ".................",
];

export const CAR_PALETTE: Palette = {
  o: "#3a2b20",
  b: "#f2a33c",
  B: "#d9862e",
  h: "#ffc266",
  w: "#43342a",
  g: "#cfe6ec",
};

// Per-vehicle art. All maps are 17x17 and share the palette letter scheme
// (o outline, b body, B body shaded, h highlight, w wheels/dark detail,
// g glass) so buildCarFrames treats them uniformly.
export interface VehicleSprite {
  map: PixelMap;
  palette: Palette;
}

const SLOTCAR_MAP: PixelMap = [
  ".................",
  "........o........",
  ".......obo.......",
  ".......obo.......",
  "......obbbo......",
  "......obgbo......",
  ".....obbgbbo.....",
  "....wobgggbow....",
  "....wobbbbbow....",
  ".....obbbbbo.....",
  ".....obbbbbo.....",
  "....wobBBBbow....",
  "....woBBBBBow....",
  ".....oBBBBBo.....",
  "....ohhhhhhho....",
  ".....ooooooo.....",
  ".................",
];

const DRIFTKING_MAP: PixelMap = [
  ".................",
  ".................",
  ".......ooo.......",
  "......obbbo......",
  ".....obbbbbo.....",
  "....wobgggbow....",
  "....wobgggbow....",
  ".....obbbbbo.....",
  ".....obbbbbo.....",
  "....obbbbbbbo....",
  "...owbbbbbbbwo...",
  "...owBBBBBBBwo...",
  "...oBBBBBBBBBo...",
  "...ohBBBBBBBho...",
  "....ooooooooo....",
  ".................",
  ".................",
];

const GOKART_MAP: PixelMap = [
  ".................",
  ".................",
  ".................",
  "......obbbo......",
  "...ww.obbbo.ww...",
  "...ww.obgbo.ww...",
  "......obbbo......",
  ".....obhhhbo.....",
  ".....obhhhbo.....",
  "......obbbo......",
  "......obbbo......",
  "...ww.obbbo.ww...",
  "...wwoBBBBBoww...",
  "...ww.ooooo.ww...",
  ".................",
  ".................",
  ".................",
];

const MUSCLE_MAP: PixelMap = [
  ".................",
  ".....ooooooo.....",
  "....obbbbbbbo....",
  "...owbbbhbbbwo...",
  "...owbbbhbbbwo...",
  "....obbbhbbbo....",
  "....obgggggbo....",
  "....obgggggbo....",
  "....obbbbbbbo....",
  "....obbbbbbbo....",
  "...owbbbbbbbwo...",
  "...owBBBBBBBwo...",
  "....oBBBBBBBo....",
  "....ohBBBBBho....",
  ".....ooooooo.....",
  ".................",
  ".................",
];

const CRUISER_MAP: PixelMap = [
  ".................",
  "......ooooo......",
  ".....obbbbbo.....",
  "....wobbbbbow....",
  "....wobgggbow....",
  "....obgggggbo....",
  "....obbbbbbbo....",
  "....obbbbbbbo....",
  "....obhbbbhbo....",
  "....obbbbbbbo....",
  "....obbbbbbbo....",
  "...owbbbbbbbwo...",
  "...owBBBBBBBwo...",
  "....oBBBBBBBo....",
  "....oBBBBBBBo....",
  "......ooooo......",
  ".................",
];

export const VEHICLE_SPRITES: Record<string, VehicleSprite> = {
  classic: { map: CAR_MAP, palette: CAR_PALETTE },
  slotcar: {
    map: SLOTCAR_MAP,
    palette: { o: "#3a2b20", b: "#e04a3a", B: "#b23325", h: "#f6efdc", w: "#43342a", g: "#cfe6ec" },
  },
  driftking: {
    map: DRIFTKING_MAP,
    palette: { o: "#3a2b20", b: "#9b59d0", B: "#7a3fb0", h: "#ffd166", w: "#43342a", g: "#e3d6f7" },
  },
  gokart: {
    map: GOKART_MAP,
    palette: { o: "#3a2b20", b: "#58b558", B: "#3f8f3f", h: "#f2d066", w: "#3a3a3a", g: "#cfe6ec" },
  },
  muscle: {
    map: MUSCLE_MAP,
    palette: { o: "#3a2b20", b: "#3d5f8a", B: "#2c486b", h: "#f6efdc", w: "#43342a", g: "#cfe6ec" },
  },
  cruiser: {
    map: CRUISER_MAP,
    palette: { o: "#3a2b20", b: "#5bbfa6", B: "#3f9c85", h: "#f2d066", w: "#43342a", g: "#d9f2ef" },
  },
  custom: {
    map: CAR_MAP,
    palette: { o: "#3a2b20", b: "#9aa0a6", B: "#6e7378", h: "#ffcc33", w: "#43342a", g: "#cfe6ec" },
  },
};

export function vehicleSprite(id: string): VehicleSprite {
  return VEHICLE_SPRITES[id] ?? VEHICLE_SPRITES.classic!;
}

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

// --- item art: pickup box, oil slick, homing missile shell ---

export const ITEM_BOX_MAP: PixelMap = [
  ".ooooooo.",
  "oyyYYYyyo",
  "oyYyyyYyo",
  "oyyyyYYyo",
  "oyyyYyyyo",
  "oyyyYyyyo",
  "oyyyyyyyo",
  "oyyyYyyyo",
  ".ooooooo.",
];

export const ITEM_BOX_PALETTE: Palette = { o: "#3a2b20", y: "#f2c14e", Y: "#8a5a33" };

export const OIL_MAP: PixelMap = [
  "...ddddd...",
  ".ddddddddd.",
  "ddDDdddDddd",
  ".ddddDDddd.",
  "...ddddd...",
];

export const OIL_PALETTE: Palette = { d: "#33302c", D: "#1f1c19" };

export const MISSILE_MAP: PixelMap = [
  ".ooo.",
  "oRRRo",
  "oRWRo",
  "oRRRo",
  ".ooo.",
];

export const MISSILE_PALETTE: Palette = { o: "#3a2b20", R: "#d94f3d", W: "#f6efdc" };

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

export const CAR_FRAME_COUNT = 64;

// Cars render slightly larger than their source maps; combined with the
// majority-vote sampling below this keeps rotated frames chunky and solid
// instead of shedding pixels at diagonal angles.
const CAR_SPRITE_SCALE = 1.25;

/**
 * Pre-render a vehicle sprite at CAR_FRAME_COUNT rotations. Frame 0 faces up
 * (-y); frame k is rotated k * 2PI/N clockwise. Each destination pixel takes
 * a majority vote over 2x2 subsamples of the rotated source, which fills the
 * ragged single-pixel dropouts plain nearest-neighbor leaves on diagonals.
 */
export function buildCarFrames(
  sprite: VehicleSprite = VEHICLE_SPRITES.classic!,
  scale = CAR_SPRITE_SCALE
): HTMLCanvasElement[] {
  const { map, palette } = sprite;
  const mapW = map[0]!.length;
  const mapH = map.length;
  const size = Math.ceil(Math.hypot(mapW, mapH) * scale) + 2;
  const rgba = new Map<string, [number, number, number]>();
  for (const [key, hex] of Object.entries(palette)) {
    rgba.set(key, [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]);
  }

  const SUB = [-0.25, 0.25];
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
    const votes = new Map<string, number>();
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        votes.clear();
        let transparent = 0;
        for (const ou of SUB) {
          for (const ov of SUB) {
            const u = (dx + 0.5 + ou - size / 2) / scale;
            const v = (dy + 0.5 + ov - size / 2) / scale;
            const sx = Math.floor(u * cos - v * sin + mapW / 2);
            const sy = Math.floor(u * sin + v * cos + mapH / 2);
            if (sx < 0 || sy < 0 || sx >= mapW || sy >= mapH) {
              transparent++;
              continue;
            }
            const ch = map[sy]![sx]!;
            if (!rgba.has(ch)) transparent++;
            else votes.set(ch, (votes.get(ch) ?? 0) + 1);
          }
        }
        let bestCh: string | null = null;
        let bestN = 0;
        for (const [ch, n] of votes) {
          if (n > bestN) {
            bestN = n;
            bestCh = ch;
          }
        }
        if (bestCh === null || bestN < transparent) continue;
        const color = rgba.get(bestCh)!;
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
