// Race HUD: lap timer, lap counter, live race position, best-lap display,
// countdown, item bubble, and toast. Pure display — record keeping lives in
// game/records, item logic in game/items.
import type { ItemKind } from "../game/items";
import {
  CROWN_MAP,
  CROWN_PALETTE,
  HOMING_MAP,
  HOMING_PALETTE,
  OIL_MAP,
  OIL_PALETTE,
  ROCKET_MAP,
  ROCKET_PALETTE,
  type Palette,
  type PixelMap,
} from "../render/sprites";
import { ICONS, mapIconEl } from "./icons";

// the bubble shows the same pixel art the item is drawn with in-world
// (turbo has no world sprite, so it borrows the UI bolt icon)
const ITEM_ICONS: Record<ItemKind, { map: PixelMap; palette: Palette }> = {
  turbo: ICONS.bolt,
  megaturbo: ICONS.bolt, // same bolt; the payoff is felt (longer, harder guide), not a distinct sprite
  rocket: { map: ROCKET_MAP, palette: ROCKET_PALETTE },
  missile: { map: HOMING_MAP, palette: HOMING_PALETTE }, // the cute homing seeker
  crown: { map: CROWN_MAP, palette: CROWN_PALETTE }, // the rare one — hunts down 1st place
  oil: { map: OIL_MAP, palette: OIL_PALETTE },
};

const ITEM_ICON_BOX = 40; // px of bubble the art may fill, at integer scale

export interface Hud {
  setLapTime(ms: number): void;
  setLap(lap: number, totalLaps: number): void;
  setPosition(pos: number, racers: number): void;
  setBest(ms: number | null): void;
  /** Show the held item in the bubble (null hides it). */
  setItem(item: ItemKind | null): void;
  /** Big center-screen text for the start countdown; null hides it. */
  countdown(text: string | null): void;
  toast(text: string): void;
}

export function createHud(): Hud {
  const lapTimeEl = document.getElementById("lap-time")!;
  const bestEl = document.getElementById("best-time")!;
  const lapCountEl = document.getElementById("lap-count")!;
  const posEl = document.getElementById("race-pos")!;
  const countdownEl = document.getElementById("countdown")!;
  const toastEl = document.getElementById("toast")!;
  const itemEl = document.getElementById("item-bubble")!;

  return {
    setLapTime(ms) {
      lapTimeEl.textContent = formatTime(ms);
    },
    setLap(lap, totalLaps) {
      lapCountEl.textContent = `lap ${lap}/${totalLaps}`;
    },
    setPosition(pos, racers) {
      posEl.textContent = racers <= 1 ? "solo" : `${ordinal(pos)}/${racers}`;
    },
    setBest(ms) {
      bestEl.textContent = ms === null ? "best —" : `best ${formatTime(ms)}`;
    },
    setItem(item) {
      if (item === null) {
        itemEl.hidden = true;
        return;
      }
      const art = ITEM_ICONS[item];
      itemEl.replaceChildren(mapIconEl(`item-${item}`, art.map, art.palette, ITEM_ICON_BOX));
      itemEl.hidden = false;
      // restart the pop animation on every new pickup
      itemEl.style.animation = "none";
      void itemEl.offsetWidth;
      itemEl.style.animation = "";
    },
    countdown(text) {
      if (text === null) {
        countdownEl.hidden = true;
        return;
      }
      if (countdownEl.textContent !== text || countdownEl.hidden) {
        countdownEl.textContent = text;
        countdownEl.classList.toggle("go", text === "go!");
        countdownEl.hidden = false;
        // restart the beat animation on each new number
        countdownEl.style.animation = "none";
        void countdownEl.offsetWidth;
        countdownEl.style.animation = "";
      }
    },
    toast(text) {
      toastEl.textContent = text;
      toastEl.hidden = false;
      // restart the pop animation
      toastEl.style.animation = "none";
      void toastEl.offsetWidth;
      toastEl.style.animation = "";
      window.setTimeout(() => (toastEl.hidden = true), 1700);
    },
  };
}

export function ordinal(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function formatTime(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const s = Math.floor(totalCs / 100) % 60;
  const m = Math.floor(totalCs / 6000);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
