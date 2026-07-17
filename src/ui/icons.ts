// Pixel-art UI icons: 12x12 char maps in the same format as render/sprites,
// replacing every emoji in the DOM so the interface shares the game's pixel
// grid. Each icon renders once to a data-URL <img> (cached); CSS classes
// (.picon / .p2 / .p3) pick the display size.
import { drawMap, type Palette, type PixelMap } from "../render/sprites";

export const ICON_SIZE = 12;

export interface Icon {
  map: PixelMap;
  palette: Palette;
}

export type IconName =
  | "gear"
  | "bolt"
  | "flag"
  | "trophy"
  | "medal1"
  | "medal2"
  | "medal3"
  | "rosette"
  | "dust"
  | "lock"
  | "unlock"
  | "ghost"
  | "star"
  | "flask"
  | "trash"
  | "sprout"
  | "cactus"
  | "wave"
  | "snowflake"
  | "moon";

// medals share one shape — ribbon up top, shaded disc below
const MEDAL_MAP: PixelMap = [
  "............",
  "...rr..rr...",
  "...rr..rr...",
  "....rrrr....",
  "....mmmm....",
  "...mmmmmm...",
  "..mmmMMmmm..",
  "..mmmMMmmm..",
  "..mmmmmmmm..",
  "...mmmmmm...",
  "....mmmm....",
  "............",
];

export const ICONS: Record<IconName, Icon> = {
  gear: {
    palette: { s: "#5a4632" },
    map: [
      "............",
      ".....ss.....",
      "..s.ssss.s..",
      "..ssssssss..",
      "...ssssss...",
      ".ssss..ssss.",
      ".ssss..ssss.",
      "...ssssss...",
      "..ssssssss..",
      "..s.ssss.s..",
      ".....ss.....",
      "............",
    ],
  },
  bolt: {
    palette: { y: "#ffd23f", d: "#d9862e" },
    map: [
      "............",
      ".....yyyy...",
      "....yyyy....",
      "...yyyy.....",
      "...yyyyyy...",
      "....yyyyd...",
      "......yyd...",
      ".....yyd....",
      "....yyd.....",
      "....yy......",
      "...yy.......",
      "............",
    ],
  },
  flag: {
    palette: { p: "#5a4632", w: "#f6efdc", k: "#3a2b20" },
    map: [
      "............",
      ".p..........",
      ".pwkwkwkwk..",
      ".pkwkwkwkw..",
      ".pwkwkwkwk..",
      ".pkwkwkwkw..",
      ".pwkwkwkwk..",
      ".p..........",
      ".p..........",
      ".p..........",
      ".p..........",
      "............",
    ],
  },
  trophy: {
    palette: { y: "#ffd23f", d: "#b5821f" },
    map: [
      "............",
      ".dyyyyyyyyd.",
      ".dyyyyyyyyd.",
      ".d.yyyyyy.d.",
      "..d.yyyy.d..",
      "...dyyyyd...",
      "....yyyy....",
      ".....yy.....",
      ".....yy.....",
      "....dddd....",
      "...dddddd...",
      "............",
    ],
  },
  medal1: { palette: { r: "#e0532f", m: "#ffd23f", M: "#fff2b8" }, map: MEDAL_MAP },
  medal2: { palette: { r: "#e0532f", m: "#c9ccd4", M: "#eef0f4" }, map: MEDAL_MAP },
  medal3: { palette: { r: "#e0532f", m: "#d9862e", M: "#f2b273" }, map: MEDAL_MAP },
  rosette: { palette: { r: "#e0532f", m: "#ffd23f", M: "#f6efdc" }, map: MEDAL_MAP },
  dust: {
    palette: { g: "#b8ab93" },
    map: [
      "............",
      "..gggggggg..",
      ".gggggggggg.",
      "..gggggggg..",
      "............",
      "...gggggg...",
      "..gggggg....",
      "............",
      "....gggg....",
      "...gggg.....",
      "............",
      "............",
    ],
  },
  lock: {
    palette: { o: "#3a2b20", y: "#ffd23f" },
    map: [
      "............",
      "....oooo....",
      "...oo..oo...",
      "...oo..oo...",
      "..oooooooo..",
      "..oyyyyyyo..",
      "..oyyooyyo..",
      "..oyyooyyo..",
      "..oyyyyyyo..",
      "..oooooooo..",
      "............",
      "............",
    ],
  },
  unlock: {
    palette: { o: "#3a2b20", y: "#ffd23f" },
    map: [
      "............",
      ".......oooo.",
      "......oo..oo",
      "......oo..oo",
      "..oooooooo..",
      "..oyyyyyyo..",
      "..oyyooyyo..",
      "..oyyooyyo..",
      "..oyyyyyyo..",
      "..oooooooo..",
      "............",
      "............",
    ],
  },
  ghost: {
    palette: { o: "#3a2b20", w: "#f6efdc" },
    map: [
      "............",
      "....oooo....",
      "...owwwwo...",
      "..owwwwwwo..",
      "..owowwowo..",
      "..owwwwwwo..",
      "..owwoowwo..",
      "..owwwwwwo..",
      "..owwwwwwo..",
      "..owowwowo..",
      "...o.oo.o...",
      "............",
    ],
  },
  star: {
    palette: { y: "#ffd23f" },
    map: [
      "............",
      ".....yy.....",
      ".....yy.....",
      "....yyyy....",
      ".yyyyyyyyyy.",
      "..yyyyyyyy..",
      "...yyyyyy...",
      "...yyyyyy...",
      "..yyy..yyy..",
      "..yy....yy..",
      "............",
      "............",
    ],
  },
  flask: {
    palette: { o: "#3a2b20", g: "#58b558" },
    map: [
      "............",
      "....oooo....",
      ".....oo.....",
      ".....oo.....",
      "....o..o....",
      "...o....o...",
      "..o..gg..o..",
      "..o.gggg.o..",
      "..oggggggo..",
      "...oooooo...",
      "............",
      "............",
    ],
  },
  trash: {
    palette: { o: "#7a2418", r: "#c0503f" },
    map: [
      "............",
      ".....oo.....",
      "..oooooooo..",
      "...rrrrrr...",
      "...r.rr.r...",
      "...r.rr.r...",
      "...r.rr.r...",
      "...r.rr.r...",
      "...rrrrrr...",
      "....rrrr....",
      "............",
      "............",
    ],
  },
  sprout: {
    palette: { l: "#8bd48b", g: "#58b558", d: "#8a5a33" },
    map: [
      "............",
      "............",
      "..ll...gg...",
      ".llll.gggg..",
      ".llll.gggg..",
      "..lll.ggg...",
      "....l.gg....",
      ".....gg.....",
      ".....gg.....",
      "....dddd....",
      "...dddddd...",
      "............",
    ],
  },
  cactus: {
    palette: { g: "#58b558", d: "#d9b36c" },
    map: [
      "............",
      ".....gg.....",
      "....gggg....",
      ".g..gggg..g.",
      ".gg.gggg.gg.",
      ".gg.gggg.gg.",
      ".gggggggggg.",
      "..gggggggg..",
      "....gggg....",
      "....gggg....",
      "...dddddd...",
      "............",
    ],
  },
  wave: {
    palette: { b: "#3f9cc9", W: "#e8f4f6" },
    map: [
      "............",
      "............",
      "....WWW.....",
      "..WWbbbW....",
      ".Wbbb.bb....",
      ".Wbb..bb....",
      ".bb...bbb.W.",
      ".bb..bbbbWW.",
      ".bbbbbbbbbb.",
      ".bbbbbbbbbb.",
      "............",
      "............",
    ],
  },
  snowflake: {
    palette: { w: "#7fc4e0" },
    map: [
      ".....ww.....",
      "..w..ww..w..",
      ".ww.wwww.ww.",
      "..wwwwwwww..",
      "...wwwwww...",
      ".wwww..wwww.",
      ".wwww..wwww.",
      "...wwwwww...",
      "..wwwwwwww..",
      ".ww.wwww.ww.",
      "..w..ww..w..",
      ".....ww.....",
    ],
  },
  moon: {
    palette: { y: "#ffd23f" },
    map: [
      "............",
      "......yyy...",
      "....yyyyy...",
      "...yyyy.....",
      "..yyyy......",
      "..yyy.......",
      "..yyy.......",
      "..yyyy......",
      "...yyyy.....",
      "....yyyyy...",
      "......yyy...",
      "............",
    ],
  },
};

// A tiny star for the map-trail canvas, drawn cell-by-cell so the win badge
// stays on the pixel grid (fillText anti-aliases).
export const STAR_5: PixelMap = [
  "..y..",
  ".yyy.",
  "yyyyy",
  ".yyy.",
  ".y.y.",
];

const urlCache = new Map<string, string>();

function mapDataUrl(key: string, map: PixelMap, palette: Palette, scale = 1): string {
  let url = urlCache.get(key);
  if (url) return url;
  const canvas = document.createElement("canvas");
  canvas.width = map[0]!.length * scale;
  canvas.height = map.length * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  drawMap(ctx, map, palette, 0, 0);
  url = canvas.toDataURL();
  urlCache.set(key, url);
  return url;
}

/** An <img> for a named icon. Extra classes size it: p2 = 24px, p3 = 36px. */
export function iconEl(name: IconName, cls = ""): HTMLImageElement {
  const img = document.createElement("img");
  img.className = cls ? `picon ${cls}` : "picon";
  const icon = ICONS[name];
  img.src = mapDataUrl(name, icon.map, icon.palette);
  img.alt = "";
  img.draggable = false;
  return img;
}

/**
 * An <img> of an arbitrary sprite map (e.g. the in-world item art in the HUD
 * bubble), pre-scaled by the largest integer factor that fits `boxPx` so it
 * displays at natural size with whole pixels.
 */
export function mapIconEl(key: string, map: PixelMap, palette: Palette, boxPx: number): HTMLImageElement {
  const scale = Math.max(1, Math.floor(boxPx / Math.max(map[0]!.length, map.length)));
  const img = document.createElement("img");
  img.className = "map-icon";
  img.src = mapDataUrl(`${key}@${scale}`, map, palette, scale);
  img.alt = "";
  img.draggable = false;
  return img;
}
