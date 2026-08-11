// The menu wordmark, drawn as pixel art instead of set in the system mono
// font — the title is brand art, so it goes through the same pixel-map
// pipeline as the icons and sprites. Letters are chunky 2px-stroke lowercase
// with a darker shade on the bottom rows and an auto-generated outline.
import type { Palette, PixelMap } from "../render/sprites";
import { mapIconEl } from "./icons";

// 7-row x-height letterforms; 'b' = body fill (bottom rows become shade).
const LETTERS: Record<string, string[]> = {
  v: [
    "bb..bb",
    "bb..bb",
    "bb..bb",
    "bb..bb",
    ".bbbb.",
    ".bbbb.",
    "..bb..",
  ],
  r: [
    "bb.bb.",
    "bbbbbb",
    "bbb.bb",
    "bb....",
    "bb....",
    "bb....",
    "bb....",
  ],
  o: [
    ".bbbb.",
    "bbbbbb",
    "bb..bb",
    "bb..bb",
    "bb..bb",
    "bbbbbb",
    ".bbbb.",
  ],
  m: [
    ".bbbbbb.",
    "bbbbbbbb",
    "bb.bb.bb",
    "bb.bb.bb",
    "bb.bb.bb",
    "bb.bb.bb",
    "bb.bb.bb",
  ],
};

const WORDMARK_PALETTE: Palette = {
  b: "#e0532f", // body
  B: "#b8431f", // bottom shade
  o: "#4a3728", // outline
};

/** Rows a letter's fill switches to the shade color (adds depth). */
const SHADE_FROM_ROW = 5;

/**
 * Compose a word from LETTERS with 1px spacing, shade the lower body rows,
 * and wrap everything in a 1px outline (8-way adjacency, like the sprites).
 */
export function buildWordmark(word: string): PixelMap {
  const glyphs = [...word].map((ch) => {
    const g = LETTERS[ch];
    if (!g) throw new Error(`wordmark has no letterform for "${ch}"`);
    return g;
  });
  const height = glyphs[0]!.length;
  const width = glyphs.reduce((w, g) => w + g[0]!.length, 0) + glyphs.length - 1;

  // paint fills into a padded grid (1px margin for the outline)
  const grid: string[][] = Array.from({ length: height + 2 }, () =>
    Array.from({ length: width + 2 }, () => "."),
  );
  let x = 1;
  for (const glyph of glyphs) {
    glyph.forEach((row, y) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] === "b") grid[y + 1]![x + gx] = y >= SHADE_FROM_ROW ? "B" : "b";
      }
    });
    x += glyph[0]!.length + 1;
  }

  // outline: any empty cell touching a fill (including diagonals)
  for (let y = 0; y < grid.length; y++) {
    for (let gx = 0; gx < grid[0]!.length; gx++) {
      if (grid[y]![gx] !== ".") continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const c = grid[y + dy]?.[gx + dx];
          if (c === "b" || c === "B") {
            touches = true;
            break;
          }
        }
      }
      if (touches) grid[y]![gx] = "o";
    }
  }
  return grid.map((row) => row.join(""));
}

/** The rendered "vroom" wordmark at a crisp integer scale. */
export function wordmarkEl(scale = 6): HTMLImageElement {
  const map = buildWordmark("vroom");
  const img = mapIconEl("wordmark", map, WORDMARK_PALETTE, map[0]!.length * scale);
  img.alt = "vroom";
  return img;
}
