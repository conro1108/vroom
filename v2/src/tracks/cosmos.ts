// Placeholder cup: one stand-in track until the real layouts are authored.
import { R, S } from "../sim/course";
import type { Cup } from "./index";

export const CUP_COSMOS: Cup = {
  id: "cosmos",
  name: "Cosmos Cup",
  theme: "cosmos",
  idea: "everything at once",
  scale: 1.32,
  difficulty: 1.0,
  tracks: [
    {
      id: "cosmos1",
      name: "Cosmos Cup Stub",
      theme: "cosmos",
      blurb: "Stand-in.",
      width: 15,
      runoff: 10,
      edge: "wall",
      pieces: [S(240), R(90, 40), S(120), R(90, 40), S(240), R(90, 40), S(120), R(90, 40)],
    },
  ],
};
