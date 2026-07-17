// World palettes, one per cup: the same painter draws every world, a theme
// swaps what the ground, road, and trimmings are made of. Tracks within a
// cup share its theme, so each series reads as one place.

export interface WorldTheme {
  id: string;
  grass: string; // base ground
  grassPatch: string; // mottling
  tuft: string; // small flora / texture accent
  roadEdge: string;
  road: string;
  speckle: string;
  flowers: string[];
  fencePost: string;
  fenceRail: string;
}

export const THEMES: Record<string, WorldTheme> = {
  meadow: {
    id: "meadow",
    grass: "#7fbf4d",
    grassPatch: "#77b747",
    tuft: "#639e39",
    roadEdge: "#b5975f",
    road: "#d9c08f",
    speckle: "#cbb283",
    flowers: ["#e88bb8", "#f2d066", "#f6efdc"],
    fencePost: "#8a5a33",
    fenceRail: "#7a5233",
  },
  desert: {
    id: "desert",
    grass: "#e2c477",
    grassPatch: "#dbbb6a",
    tuft: "#b3924e",
    roadEdge: "#8f6537",
    road: "#bc8d58",
    speckle: "#a97f4e",
    flowers: ["#d94f3d", "#7fbf4d", "#f2d066"],
    fencePost: "#7a4f28",
    fenceRail: "#6b451f",
  },
  tide: {
    id: "tide",
    grass: "#8fd4c1",
    grassPatch: "#86ccb8",
    tuft: "#5aa893",
    roadEdge: "#b09a6b",
    road: "#e8d5a8",
    speckle: "#d9c493",
    flowers: ["#f2d066", "#e88bb8", "#f6efdc"],
    fencePost: "#8a5a33",
    fenceRail: "#7a5233",
  },
  frost: {
    id: "frost",
    grass: "#e3ecef",
    grassPatch: "#d8e4e8",
    tuft: "#4a7d5c",
    roadEdge: "#5d7078",
    road: "#93a7b1",
    speckle: "#7d929c",
    flowers: ["#d94f3d", "#4a7d5c", "#9db9c4"],
    fencePost: "#6b4f33",
    fenceRail: "#5d4429",
  },
  dusk: {
    id: "dusk",
    grass: "#3b4468",
    grassPatch: "#363e5f",
    tuft: "#2c3350",
    roadEdge: "#4a4668",
    road: "#6f6a8e",
    speckle: "#5f5a80",
    flowers: ["#f2d066", "#e88bb8", "#9bd4e4"],
    fencePost: "#241f33",
    fenceRail: "#2e2745",
  },
};

export function themeById(id: string): WorldTheme {
  return THEMES[id] ?? THEMES.meadow!;
}
