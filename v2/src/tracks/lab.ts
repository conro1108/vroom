// Not in any cup: exercises every course feature. ?track=lab8 or ?track=labjump.
import { L, R, S, type TrackDef } from "../sim/course";

const base = { theme: "meadow", blurb: "Test track.", width: 15, runoff: 10, edge: "wall" as const };

export const LAB: TrackDef[] = [
  {
    ...base,
    id: "lab8",
    name: "Lab: figure eight",
    pieces: [
      S(110, { items: [{ kind: "boost", at: 0.4, d: 0 }] }),
      R(270, 80, { y: 9 }),
      S(170, { y: 9, bridge: true }),
      L(270, 80, { y: 0, surface: "dirt" }),
      S(50),
    ],
  },
  {
    ...base,
    id: "labjump",
    name: "Lab: jump, tunnel, fork, ice",
    pieces: [
      S(240, { w: 26 }),
      S(120, { isle: { d: 0, half: 3 } }),
      S(60, { w: 15 }),
      R(180, 60, { surface: "ice", bank: 8 }),
      S(170, { y: 6, items: [{ kind: "boost", at: 0.85, d: 0 }, { kind: "kicker", at: 0.97, d: 0 }] }),
      S(16, { gap: true, y: 6 }),
      S(140, { y: 0, tunnel: true }),
      S(140),
      R(180, 60),
      S(120),
    ],
  },
];
