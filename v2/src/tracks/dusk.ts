// Placeholder cup: one stand-in track until the real layouts are authored.
import { R, S } from "../sim/course";
import type { Cup } from "./index";

export const CUP_DUSK: Cup = {
  id: "dusk",
  name: "Dusk Cup",
  theme: "dusk",
  idea: "precision",
  scale: 1.25,
  difficulty: 0.98,
  tracks: [
    {
      id: "dusk1",
      name: "Dusk Cup Stub",
      theme: "dusk",
      blurb: "Stand-in.",
      width: 15,
      runoff: 10,
      edge: "wall",
      pieces: [S(240), R(90, 40), S(120), R(90, 40), S(240), R(90, 40), S(120), R(90, 40)],
    },
  ],
};
