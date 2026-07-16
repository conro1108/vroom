// Race HUD: lap timer, lap counter, best-lap display, and toast. Pure
// display — record keeping lives in game/records.

export interface Hud {
  setLapTime(ms: number): void;
  setLap(lap: number, totalLaps: number): void;
  setBest(ms: number | null): void;
  toast(text: string): void;
}

export function createHud(): Hud {
  const lapTimeEl = document.getElementById("lap-time")!;
  const bestEl = document.getElementById("best-time")!;
  const lapCountEl = document.getElementById("lap-count")!;
  const toastEl = document.getElementById("toast")!;

  return {
    setLapTime(ms) {
      lapTimeEl.textContent = formatTime(ms);
    },
    setLap(lap, totalLaps) {
      lapCountEl.textContent = `lap ${lap}/${totalLaps}`;
    },
    setBest(ms) {
      bestEl.textContent = ms === null ? "best —" : `best ${formatTime(ms)}`;
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

export function formatTime(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const s = Math.floor(totalCs / 100) % 60;
  const m = Math.floor(totalCs / 6000);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
