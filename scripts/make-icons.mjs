// Generates public/icons/*.png. No deps: minimal PNG encoder (RGBA, filter 0)
// using node's zlib. Run: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Dedicated icon art (not the in-game 17px sprite, which reads as a blob when
// blown up to icon size): side-view car on the game's road, meadow palette.
const ICON_MAP = [
  "........................",
  "...yy...................",
  "..yyyy..................",
  "..yyyy..................",
  "...yy...................",
  "........................",
  "........oooooo..........",
  ".......obbbbbbo.........",
  ".......obggggbo.........",
  "..ooo.obbggggbbo........",
  "....oobbbbbbbbbbbboooo..",
  "BB.obbbbbbbbbbbbbbbbbbo.",
  "...obbbbbbbbbbbbbbbbhho.",
  "BB.obBBBBBBBBBBBBBBBBBo.",
  "...oBooooooBBBooooooBBo.",
  ".....owwwwo...owwwwo....",
  ".....owhhwo...owhhwo....",
  "......oooo.....oooo.....",
  "EEEEEEEEEEEEEEEEEEEEEEEE",
  "RRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRSRRRRRRRSRRRRRRRSRRR",
  "EEEEEEEEEEEEEEEEEEEEEEEE",
  "GGGGGGGGGGGGGGGGGGGGGGGG",
  "GGyGGGGGfGGGGPGGGGGGfGGG",
];

const PALETTE = {
  o: [58, 43, 32, 255], // outline
  b: [242, 163, 60, 255], // body
  B: [217, 134, 46, 255], // body shade / speed lines
  h: [255, 194, 102, 255], // highlight / headlight / hubs
  w: [67, 52, 42, 255], // wheels
  g: [207, 230, 236, 255], // glass
  y: [242, 208, 102, 255], // sun / flowers
  f: [232, 139, 184, 255], // flowers
  G: [127, 191, 77, 255], // grass
  P: [119, 183, 71, 255], // grass patch
  R: [217, 192, 143, 255], // road
  S: [203, 178, 131, 255], // road speckle
  E: [181, 151, 95, 255], // road edge
};
const CREAM = [242, 231, 210, 255];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  // Full-bleed scene: uniform pixel grid, edge rows/cols extended to cover the
  // remainder when size isn't a multiple of the map (keeps icons maskable).
  const rgba = Buffer.alloc(size * size * 4);
  const mapW = ICON_MAP[0].length;
  const mapH = ICON_MAP.length;
  const scale = Math.max(1, Math.floor(size / mapW));
  const ox = Math.floor((size - mapW * scale) / 2);
  const oy = Math.floor((size - mapH * scale) / 2);
  const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
  for (let y = 0; y < size; y++) {
    const my = clamp(Math.floor((y - oy) / scale), mapH - 1);
    for (let x = 0; x < size; x++) {
      const mx = clamp(Math.floor((x - ox) / scale), mapW - 1);
      const color = PALETTE[ICON_MAP[my][mx]] ?? CREAM;
      const i = (y * size + x) * 4;
      color.forEach((v, c) => (rgba[i + c] = v));
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makeIcon(size));
  console.log(`icon-${size}.png`);
}
