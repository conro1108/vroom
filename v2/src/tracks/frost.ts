// Placeholder cup: one stand-in track until the real layouts are authored.
import { R, S } from "../sim/course";
import type { Cup } from "./index";

export const CUP_FROST: Cup = {
  id: "frost",
  name: "Frost Cup",
  theme: "frost",
  idea: "every lap is a choice",
  scale: 1.18,
  difficulty: 0.96,
  tracks: [
    {
      id: "frost1",
      name: "Frost Cup Stub",
      theme: "frost",
      blurb: "Stand-in.",
      width: 15,
      runoff: 10,
      edge: "wall",
      pieces: [S(240), R(90, 40), S(120), R(90, 40), S(240), R(90, 40), S(120), R(90, 40)],
    },
  ],
};
