// Generates public/icons/*.png from the car pixel map. No deps: minimal PNG
// encoder (RGBA, filter 0) using node's zlib. Run: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Keep in sync with CAR_MAP in src/render/sprites.ts
const CAR_MAP = [
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

const PALETTE = {
  o: [58, 43, 32, 255],
  b: [242, 163, 60, 255],
  B: [217, 134, 46, 255],
  h: [255, 194, 102, 255],
  w: [67, 52, 42, 255],
  g: [207, 230, 236, 255],
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
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) CREAM.forEach((v, c) => (rgba[i * 4 + c] = v));

  const mapW = CAR_MAP[0].length;
  const mapH = CAR_MAP.length;
  const scale = Math.max(1, Math.floor((size * 0.82) / mapW));
  const ox = Math.floor((size - mapW * scale) / 2);
  const oy = Math.floor((size - mapH * scale) / 2);
  for (let my = 0; my < mapH; my++) {
    for (let mx = 0; mx < mapW; mx++) {
      const color = PALETTE[CAR_MAP[my][mx]];
      if (!color) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((oy + my * scale + dy) * size + ox + mx * scale + dx) * 4;
          color.forEach((v, c) => (rgba[i + c] = v));
        }
      }
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
