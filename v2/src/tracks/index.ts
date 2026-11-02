// The catalog: every cup, in progression order. Each cup file owns its tracks.
import type { TrackDef } from "../sim/course";
import { CUP_GREEN } from "./green";
import { LAB } from "./lab";
import { CUP_DUNE } from "./dune";
import { CUP_TIDE } from "./tide";
import { CUP_FROST } from "./frost";
import { CUP_DUSK } from "./dusk";
import { CUP_COSMOS } from "./cosmos";

export interface Cup {
  id: string;
  name: string;
  theme: string;
  idea: string; // the one thing this cup teaches
  scale: number; // speed scale
  difficulty: number; // bot pace
  tracks: TrackDef[];
}

export const CUPS: Cup[] = [CUP_GREEN, CUP_DUNE, CUP_TIDE, CUP_FROST, CUP_DUSK, CUP_COSMOS];

export const ALL_TRACKS = CUPS.flatMap((c) => c.tracks);
export const trackById = (id: string) => [...ALL_TRACKS, ...LAB].find((t) => t.id === id) ?? ALL_TRACKS[0]!;
