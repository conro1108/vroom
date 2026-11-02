// Long-lived player state: who you race, what you've won, what's open. A cup opens
// when the one before it finishes on the podium.
import { CUPS } from "../tracks";

export const PLAYER_COLOR = 0x0b5fff;
export const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
export const RIVALS = [
  { name: "Vex", color: 0xe8392f },
  { name: "Juno", color: 0xffb400 },
  { name: "Kit", color: 0x12b76a },
  { name: "Mako", color: 0x8a3ffc },
  { name: "Rue", color: 0xff5fa2 },
  { name: "Ozzy", color: 0x13c2d6 },
  { name: "Bram", color: 0xf4f6fa },
];

export interface Standing {
  name: string;
  color: number;
  points: number;
  player: boolean;
}

const KEY = "vroom2.save";
type Save = Record<string, number>; // cup id -> best place

const read = (): Save => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Save;
  } catch {
    return {};
  }
};

export const freshStandings = (): Standing[] => [
  { name: "You", color: PLAYER_COLOR, points: 0, player: true },
  ...RIVALS.map((r) => ({ name: r.name, color: r.color, points: 0, player: false })),
];

export function addResult(cupId: string, place: number) {
  const s = read();
  s[cupId] = Math.min(place, s[cupId] ?? 99);
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const bestPlace = (cupId: string): number | null => read()[cupId] ?? null;

export function cupOpen(index: number) {
  if (index === 0 || new URLSearchParams(location.search).has("all")) return true;
  const prev = bestPlace(CUPS[index - 1]!.id);
  return prev !== null && prev <= 3;
}

// ---- small preferences ----

const HINT = "vroom2.hinted.pull";
const pref = (k: string) => {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};
const setPref = (k: string, v: boolean) => {
  try {
    localStorage.setItem(k, v ? "1" : "0");
  } catch {
    // private mode: the preference just lasts this session
  }
};

export const hintDone = () => pref(HINT);
export const markHintDone = () => setPref(HINT, true);
