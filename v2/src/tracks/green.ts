// Green Cup: "I can drive." Wide roads, big readable bends, one proper hairpin at
// the very end of the cup.
import { L, R, S, type TrackDef } from "../sim/course";
import type { Cup } from "./index";

const sunrise: TrackDef = {
  id: "sunrise",
  name: "Sunrise Circuit",
  theme: "meadow",
  blurb: "Your first laps. Long straights, big bends, nothing to fear.",
  width: 15,
  runoff: 12,
  edge: "wall",
  pieces: [
    S(220),
    R(90, 62),
    S(130, { y: 4 }),
    R(60, 48),
    L(60, 58),
    S(110, { y: 9 }),
    R(120, 42, { bank: 6 }),
    S(170, { y: 0 }),
    R(90, 70),
    S(150),
    R(60, 52),
    S(120),
  ],
};

export const CUP_GREEN: Cup = {
  id: "green",
  name: "Green Cup",
  theme: "meadow",
  idea: "I can drive",
  scale: 1,
  difficulty: 0.9,
  tracks: [sunrise],
};
