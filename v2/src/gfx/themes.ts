// A theme is a whole place: sky, light, ground and what grows on it. Tracks pick
// one by id. Each world lives in gfx/worlds/<id>.ts and registers itself.

export interface PropRule {
  kind: string; // gfx/props name
  density: number; // instances per hectare of eligible ground
  near: number; // metres from the road edge
  far: number;
  scale: [number, number];
}

export interface Theme {
  id: string;
  sky: [number, number, number]; // zenith, mid, horizon
  fog: number;
  fogNear: number;
  fogFar: number;
  sun: { color: number; intensity: number; dir: [number, number, number] };
  hemi: { sky: number; ground: number; intensity: number };
  ground: "land" | "water" | "void";
  groundColors: [number, number, number]; // verge, field, far hills
  verge: number; // the runoff right beside the road
  road: { base: number; speck: number; line: number; kerbA: number; kerbB: number };
  barrier: { a: number; b: number; height: number };
  hills: { amp: number; rim: number; seed: number };
  water?: number; // sea colour, for "water" themes
  stars?: boolean;
  clouds?: { count: number; color: number };
  props: PropRule[];
}

export const THEMES: Record<string, Theme> = {};

export function registerTheme(t: Theme) {
  THEMES[t.id] = t;
}
