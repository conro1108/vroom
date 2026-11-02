// Shared display vocabulary: each cup's colours, and how numbers are written.
import { CUPS, type Cup } from "../tracks";

const COLORS: Record<string, { a: string; b: string }> = {
  green: { a: "#12a150", b: "#0a5c33" },
  dune: { a: "#f08a24", b: "#a4420c" },
  tide: { a: "#07a6c4", b: "#045a7c" },
  frost: { a: "#5aa9f0", b: "#2a4fb0" },
  dusk: { a: "#d83a7c", b: "#6d1a66" },
  cosmos: { a: "#7a3cf0", b: "#23106e" },
};

export const cupColor = (c: Cup) => COLORS[c.id] ?? { a: "#0b5fff", b: "#07327f" };
export const cupVars = (c: Cup) => `--cup:${cupColor(c).a};--cup2:${cupColor(c).b}`;

export const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return "TH";
  return ["TH", "ST", "ND", "RD"][n % 10] ?? "TH";
};

export const clock = (s: number | null) => {
  if (s === null) return "-:--.--";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(2)}`;
};

export const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Gold, silver, bronze, then a plain white. */
export const medal = (place: number) => ["#ffd21f", "#dfe6ee", "#f0a35e"][place - 1] ?? "#ffffff";

export const shortCup = (c: Cup) => c.name.replace(/\s*cup$/i, "");
export const nextCup = (i: number): Cup | undefined => CUPS[i + 1];
