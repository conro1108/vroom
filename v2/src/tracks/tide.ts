// Placeholder cup: one stand-in track until the real layouts are authored.
import { R, S } from "../sim/course";
import type { Cup } from "./index";

export const CUP_TIDE: Cup = {
  id: "tide",
  name: "Tide Cup",
  theme: "tide",
  idea: "the track does things",
  scale: 1.12,
  difficulty: 0.94,
  tracks: [
    {
      id: "tide1",
      name: "Tide Cup Stub",
      theme: "tide",
      blurb: "Stand-in.",
      width: 15,
      runoff: 10,
      edge: "wall",
      pieces: [S(240), R(90, 40), S(120), R(90, 40), S(240), R(90, 40), S(120), R(90, 40)],
    },
  ],
};
