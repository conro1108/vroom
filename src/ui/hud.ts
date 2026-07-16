// Lap timer HUD + persisted best lap.
const BEST_KEY = "vroom.bestLap";

export interface Hud {
  setLapTime(ms: number): void;
  setLap(lap: number): void;
  /** Returns true when this lap is a new best. */
  lapCompleted(ms: number): boolean;
}

export function createHud(): Hud {
  const lapTimeEl = document.getElementById("lap-time")!;
  const bestEl = document.getElementById("best-time")!;
  const lapCountEl = document.getElementById("lap-count")!;
  const toastEl = document.getElementById("toast")!;

  let best = loadBest();
  bestEl.textContent = best === null ? "best —" : `best ${formatTime(best)}`;

  return {
    setLapTime(ms) {
      lapTimeEl.textContent = formatTime(ms);
    },
    setLap(lap) {
      lapCountEl.textContent = `lap ${lap}`;
    },
    lapCompleted(ms) {
      if (best !== null && ms >= best) return false;
      best = ms;
      try {
        localStorage.setItem(BEST_KEY, String(ms));
      } catch {
        // storage unavailable — best lap just won't survive reloads
      }
      bestEl.textContent = `best ${formatTime(ms)}`;
      toastEl.hidden = false;
      // restart the pop animation
      toastEl.style.animation = "none";
      void toastEl.offsetWidth;
      toastEl.style.animation = "";
      window.setTimeout(() => (toastEl.hidden = true), 1700);
      return true;
    },
  };
}

function loadBest(): number | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function formatTime(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const s = Math.floor(totalCs / 100) % 60;
  const m = Math.floor(totalCs / 6000);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
