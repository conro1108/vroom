// Pixel maps and sprite helpers. Car rotation is pre-rendered into N frames
// with per-pixel nearest-neighbor sampling so the art always lands on the
// pixel grid — never rotate sprites with ctx.rotate at draw time.

export type PixelMap = string[];
export type Palette = Record<string, string>;

// Every car is 17x17 with the wheels drawn *outside* the body outline, so the
// silhouette has four dark bumps that read as "car" at any rotation — a smooth
// pill turns into a blob the moment it rotates off-axis. Letter scheme: o
// outline, b body, B body shaded, h highlight, w wheels, g glass, r tail light.
export const CAR_MAP: PixelMap = [
  ".................",
  "......ooooo......",
  ".....ohbbbho.....",
  "...wwobbbbboww...",
  "...wwobgggboww...",
  "...wwobgggboww...",
  ".....obgggbo.....",
  ".....obbbbbo.....",
  ".....obhbbbo.....",
  ".....obhbbbo.....",
  ".....obbbbbo.....",
  "...wwoBBBBBoww...",
  "...wwoBgggBoww...",
  "...wwoBBBBBoww...",
  ".....orBBBro.....",
  "......ooooo......",
  ".................",
];

export const CAR_PALETTE: Palette = {
  o: "#3a2b20",
  b: "#f2a33c",
  B: "#d9862e",
  h: "#ffe0a0",
  w: "#2f2520",
  g: "#cfe6ec",
  r: "#e0432f",
};

export interface VehicleSprite {
  map: PixelMap;
  palette: Palette;
}

// open-wheel single seater: needle nose, wheels standing clear of the body, wing
const SLOTCAR_MAP: PixelMap = [
  ".................",
  "........o........",
  ".......oho.......",
  ".......obo.......",
  "...ww.obbbo.ww...",
  "...ww.obgbo.ww...",
  ".....obbgbbo.....",
  ".....obgggbo.....",
  ".....obbbbbo.....",
  ".....obbbbbo.....",
  ".....obbbbbo.....",
  "...wwoBBBBBoww...",
  "...wwoBBBBBoww...",
  "...wwoBBBBBoww...",
  "....ohhhhhhho....",
  "....ooooooooo....",
  ".................",
];

// wide, low coupe with a big rear wing
const DRIFTKING_MAP: PixelMap = [
  ".................",
  ".................",
  ".....ooooooo.....",
  "....ohbbbbbho....",
  "..wwobbbbbbboww..",
  "..wwobgggggboww..",
  "..wwobgggggboww..",
  "....obbbbbbbo....",
  "....obbhbbbbo....",
  "....obbhbbbbo....",
  "....oBBBBBBBo....",
  "..wwoBBgggBBoww..",
  "..wwoBBBBBBBoww..",
  "..wwoBBBBBBBoww..",
  "...orhhhhhhhro...",
  "...ooooooooooo...",
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

// long hood with a racing stripe, fat rear tires
const MUSCLE_MAP: PixelMap = [
  ".................",
  ".....ooooooo.....",
  "....ohbbbbbho....",
  "..wwobbbhbbboww..",
  "..wwobbbhbbboww..",
  "..wwobbbhbbboww..",
  "....obbbhbbbo....",
  "....obgggggbo....",
  "....obgggggbo....",
  "....obbbbbbbo....",
  "....obbbbbbbo....",
  "..wwoBBBBBBBoww..",
  "..wwoBBBBBBBoww..",
  "..wwoBBBBBBBoww..",
  "....orBBBBBro....",
  ".....ooooooo.....",
  ".................",
];

// boxy wagon: flat front, roof rack, a long rear window
const CRUISER_MAP: PixelMap = [
  ".................",
  "......ooooo......",
  ".....ohbbbho.....",
  "...wwobbbbboww...",
  "...wwobgggboww...",
  "...wwobgggboww...",
  ".....obbbbbo.....",
  ".....obbbbbo.....",
  ".....obhhhbo.....",
  ".....obbbbbo.....",
  ".....obgggbo.....",
  "...wwoBgggBoww...",
  "...wwoBgggBoww...",
  "...wwoBBBBBoww...",
  ".....orBBBro.....",
  "......ooooo......",
  ".................",
];

const W = "#2f2520";
const O = "#3a2b20";
const R = "#e0432f";

export const VEHICLE_SPRITES: Record<string, VehicleSprite> = {
  classic: { map: CAR_MAP, palette: CAR_PALETTE },
  slotcar: {
    map: SLOTCAR_MAP,
    palette: { o: O, b: "#e04a3a", B: "#b23325", h: "#f6efdc", w: W, g: "#cfe6ec", r: R },
  },
  driftking: {
    map: DRIFTKING_MAP,
    palette: { o: O, b: "#9b59d0", B: "#7a3fb0", h: "#ffd166", w: W, g: "#e3d6f7", r: R },
  },
  gokart: {
    map: GOKART_MAP,
    palette: { o: O, b: "#58b558", B: "#3f8f3f", h: "#f2d066", w: W, g: "#cfe6ec", r: R },
  },
  muscle: {
    map: MUSCLE_MAP,
    palette: { o: O, b: "#3d5f8a", B: "#2c486b", h: "#f6efdc", w: W, g: "#cfe6ec", r: R },
  },
  cruiser: {
    map: CRUISER_MAP,
    palette: { o: O, b: "#5bbfa6", B: "#3f9c85", h: "#f2d066", w: W, g: "#d9f2ef", r: R },
  },
  custom: {
    map: CAR_MAP,
    palette: { o: O, b: "#9aa0a6", B: "#6e7378", h: "#ffcc33", w: W, g: "#cfe6ec", r: R },
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

// --- trackside art: trees (c canopy, C canopy light, t trunk) and rocks ---
// Canopies are drawn on an overhead pass so a car that strays under one drives
// beneath it; trunks and shadows are baked into the ground.

export const TREE_MAPS: Record<string, PixelMap> = {
  round: [
    ".....ccccc.....",
    "...cccCCCccc...",
    "..ccccCCCCccc..",
    ".cccCCCCCcccc..",
    ".ccCCCCCcccccc.",
    "cccCCCCcccccccc",
    "ccccCCccccccccc",
    "ccccccccccccccc",
    "ccccccccccccccc",
    ".ccccccccccccc.",
    ".ccccccccccccc.",
    "..ccccccccccc..",
    "....ccccccc....",
    "......ttt......",
    "......ttt......",
    "......ttt......",
    "......ttt......",
  ],
  pine: [
    ".....c.....",
    "....cCc....",
    "....ccc....",
    "...ccCCc...",
    "...ccccc...",
    "..cccCCcc..",
    "..ccccccc..",
    ".ccccCCCcc.",
    ".ccccccccc.",
    "cccccCCcccc",
    "ccccccccccc",
    ".....t.....",
    ".....t.....",
    ".....t.....",
  ],
  palm: [
    "...cc.....cc...",
    "..ccCc...cCcc..",
    ".ccccCc.cCcccc.",
    "ccccCCCcCCCcccc",
    "cCCCCCCCCCCCCCc",
    ".ccccCCCCCcccc.",
    "..ccc.ctc.ccc..",
    ".cc...ttt...cc.",
    "......ttt......",
    "......ttt......",
    ".....ttt.......",
    ".....ttt.......",
  ],
  cactus: [
    "....c....",
    "...cCc...",
    "c..cCc..c",
    "cc.cCc.cc",
    "cc.cCc.cc",
    "ccccCcccc",
    ".cccCccc.",
    "...cCc...",
    "...cCc...",
    "...cCc...",
    "...cCc...",
    "...ccc...",
    "...ttt...",
  ],
};

export const ROCK_MAP: PixelMap = [
  "..kKK..",
  ".kKKKk.",
  "kkKKkkk",
  ".kkkkk.",
];

export const PEBBLE_MAP: PixelMap = [
  ".Kk.",
  "kkkk",
];

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

// The dumb straight rocket: a plain red bolt.
export const ROCKET_MAP: PixelMap = [
  ".ooo.",
  "oRRRo",
  "oRWRo",
  "oRRRo",
  ".ooo.",
];

export const ROCKET_PALETTE: Palette = { o: "#3a2b20", R: "#d94f3d", W: "#f6efdc" };

// The cute homing seeker: a little pink heart, so it reads as the friendly-
// but-relentless one that curves after you.
export const HOMING_MAP: PixelMap = [
  ".p.p.",
  "pPPPp",
  "pPWPp",
  ".pPp.",
  "..p..",
];

export const HOMING_PALETTE: Palette = { p: "#b83a63", P: "#ff6f9c", W: "#ffd9e6" };

// The leader-hunting crown: a little gold crown with a red gem, so the rarest
// shot reads at a glance as "this one's coming for 1st".
export const CROWN_MAP: PixelMap = [
  "y.y.y",
  "yyyyy",
  "yryry",
  "ooooo",
];

export const CROWN_PALETTE: Palette = { y: "#ffd23f", r: "#d94f3d", o: "#5a3a12" };

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
 * a majority vote over 3x3 subsamples of the rotated source, which fills the
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

  const SUB = [-1 / 3, 0, 1 / 3];
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
        // opaque only on a strict majority of the 9 samples, so the outline
        // stays one clean pixel instead of bloating on some angles and
        // shredding on others
        if (bestCh === null || SUB.length * SUB.length - transparent < 5) continue;
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

/**
 * The same frames as flat dark silhouettes — a drop shadow that matches the
 * car's actual outline at every angle, instead of a fixed rectangle that only
 * looks right when the car is pointing up the screen.
 */
export function buildShadowFrames(frames: HTMLCanvasElement[], color: string): HTMLCanvasElement[] {
  return frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(frame, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  });
}

export function carFrameIndex(heading: number): number {
  const angle = heading + Math.PI / 2; // sprite faces up at frame 0
  const n = CAR_FRAME_COUNT;
  return ((Math.round((angle / (Math.PI * 2)) * n) % n) + n) % n;
}
