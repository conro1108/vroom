// Placeholder cup: one stand-in track until the real layouts are authored.
import { R, S } from "../sim/course";
import type { Cup } from "./index";

export const CUP_DUNE: Cup = {
  id: "dune",
  name: "Dune Cup",
  theme: "desert",
  idea: "corners have a rhythm",
  scale: 1.06,
  difficulty: 0.92,
  tracks: [
    {
      id: "dune1",
      name: "Dune Cup Stub",
      theme: "desert",
      blurb: "Stand-in.",
      width: 15,
      runoff: 10,
      edge: "wall",
      pieces: [S(240), R(90, 40), S(120), R(90, 40), S(240), R(90, 40), S(120), R(90, 40)],
    },
  ],
};
