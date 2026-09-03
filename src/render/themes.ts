// World palettes, one per cup: the same painter draws every world, a theme
// swaps what the ground, road, and trimmings are made of. Tracks within a
// cup share its theme, so each series reads as one place.

export type TreeKind = "round" | "pine" | "palm" | "cactus" | "none";

export interface WorldTheme {
  id: string;
  grass: string; // base ground
  grassPatch: string; // darker mottling
  grassLight: string; // lighter mottling
  tuft: string; // small flora / texture accent
  roadEdge: string;
  road: string;
  speckle: string;
  kerb: [string, string]; // alternating rumble-strip colours through corners
  flowers: string[];
  tree: TreeKind;
  canopy: string;
  canopyLight: string;
  trunk: string;
  rock: string;
  rockLight: string;
  fencePost: string;
  fenceRail: string;
}

export const THEMES: Record<string, WorldTheme> = {
  meadow: {
    id: "meadow",
    grass: "#7fbf4d",
    grassPatch: "#72b043",
    grassLight: "#8ccb5a",
    tuft: "#639e39",
    roadEdge: "#b5975f",
    road: "#d9c08f",
    speckle: "#cbb283",
    kerb: ["#e0532f", "#f6efdc"],
    flowers: ["#e88bb8", "#f2d066", "#f6efdc"],
    tree: "round",
    canopy: "#3f8f3f",
    canopyLight: "#5cb85c",
    trunk: "#6b4423",
    rock: "#8a8f87",
    rockLight: "#b3b8ae",
    fencePost: "#8a5a33",
    fenceRail: "#7a5233",
  },
  desert: {
    id: "desert",
    grass: "#e2c477",
    grassPatch: "#d6b566",
    grassLight: "#ebd08a",
    tuft: "#b3924e",
    roadEdge: "#8f6537",
    road: "#bc8d58",
    speckle: "#a97f4e",
    kerb: ["#c8452f", "#f6efdc"],
    flowers: ["#d94f3d", "#7fbf4d", "#f2d066"],
    tree: "cactus",
    canopy: "#4f9a4a",
    canopyLight: "#6fbf62",
    trunk: "#3f7a3a",
    rock: "#b0865a",
    rockLight: "#d2ab7c",
    fencePost: "#7a4f28",
    fenceRail: "#6b451f",
  },
  tide: {
    id: "tide",
    grass: "#8fd4c1",
    grassPatch: "#85ccb8",
    grassLight: "#99dcc9",
    tuft: "#5aa893",
    roadEdge: "#b09a6b",
    road: "#e8d5a8",
    speckle: "#d9c493",
    kerb: ["#e0532f", "#f6efdc"],
    flowers: ["#f2d066", "#e88bb8", "#f6efdc"],
    tree: "palm",
    canopy: "#3f9c5a",
    canopyLight: "#6cc47a",
    trunk: "#8a5a33",
    rock: "#9aa39c",
    rockLight: "#c3ccc4",
    fencePost: "#8a5a33",
    fenceRail: "#7a5233",
  },
  frost: {
    id: "frost",
    grass: "#e3ecef",
    grassPatch: "#d9e4e8",
    grassLight: "#eef4f6",
    tuft: "#4a7d5c",
    roadEdge: "#5d7078",
    road: "#93a7b1",
    speckle: "#7d929c",
    kerb: ["#d94f3d", "#f6efdc"],
    flowers: ["#d94f3d", "#4a7d5c", "#9db9c4"],
    tree: "pine",
    canopy: "#2f6b47",
    canopyLight: "#eaf3f6",
    trunk: "#5a3f2a",
    rock: "#7d929c",
    rockLight: "#a9bcc4",
    fencePost: "#6b4f33",
    fenceRail: "#5d4429",
  },
  // The one place that isn't a landscape: the ground is empty space, so it goes
  // near-black and the road is the brightest thing on screen. The "flowers"
  // scattered on the void read as stars, the rocks as drifting asteroids, and
  // the fence rails and kerbs glow.
  cosmos: {
    id: "cosmos",
    grass: "#1b1330",
    grassPatch: "#171029",
    grassLight: "#241a3e",
    tuft: "#3a2a63",
    roadEdge: "#d472ec",
    road: "#7159cf",
    speckle: "#8f74e8",
    kerb: ["#ff8ad4", "#7ff0ff"],
    flowers: ["#ffe98a", "#7ff0ff", "#ff8ad4"],
    tree: "none",
    canopy: "#3a2a63",
    canopyLight: "#4a3a7a",
    trunk: "#2a1f4a",
    rock: "#4a3d72",
    rockLight: "#6b5c9a",
    fencePost: "#3f2f6b",
    fenceRail: "#b57ce8",
  },
  dusk: {
    id: "dusk",
    grass: "#3b4468",
    grassPatch: "#343c5e",
    grassLight: "#444e75",
    tuft: "#2c3350",
    roadEdge: "#4a4668",
    road: "#6f6a8e",
    speckle: "#5f5a80",
    kerb: ["#c8452f", "#e8dcc0"],
    flowers: ["#f2d066", "#e88bb8", "#9bd4e4"],
    tree: "round",
    canopy: "#243a4a",
    canopyLight: "#2f5060",
    trunk: "#1e1a2c",
    rock: "#4a4f6e",
    rockLight: "#5f6688",
    fencePost: "#241f33",
    fenceRail: "#2e2745",
  },
};

export function themeById(id: string): WorldTheme {
  return THEMES[id] ?? THEMES.meadow!;
}
