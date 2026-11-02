// Green Cup: bright, friendly, English-summer countryside.
import { registerTheme } from "../themes";

registerTheme({
  id: "meadow",
  sky: [0x1a6fe0, 0x58b4f5, 0xcdeefc],
  fog: 0xc4e8f7,
  fogNear: 140,
  fogFar: 620,
  sun: { color: 0xfff1cf, intensity: 2.9, dir: [0.55, 0.75, 0.35] },
  hemi: { sky: 0xbfe6ff, ground: 0x7fae4e, intensity: 1.35 },
  ground: "land",
  groundColors: [0x8ccf4c, 0x6dbb45, 0x4d9a4b],
  verge: 0xa2dc55,
  road: { base: 0x4a4e58, speck: 0x5c606b, line: 0xffffff, kerbA: 0xe8392f, kerbB: 0xffffff },
  barrier: { a: 0xffffff, b: 0xe8392f, height: 0.95 },
  hills: { amp: 26, rim: 70, seed: 11 },
  clouds: { count: 16, color: 0xffffff },
  props: [
    { kind: "tree", density: 16, near: 12, far: 130, scale: [0.9, 1.7] },
    { kind: "pine", density: 8, near: 22, far: 170, scale: [1, 1.9] },
    { kind: "bush", density: 26, near: 7, far: 60, scale: [0.7, 1.3] },
    { kind: "flowers", density: 40, near: 3, far: 40, scale: [0.8, 1.3] },
    { kind: "rock", density: 3, near: 12, far: 120, scale: [0.6, 1.6] },
  ],
});
