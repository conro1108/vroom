// Race HUD: lap timer, lap counter, live race position, best-lap display,
// countdown, and toast. Pure display — record keeping lives in game/records.

export interface Hud {
  setLapTime(ms: number): void;
  setLap(lap: number, totalLaps: number): void;
  setPosition(pos: number, racers: number): void;
  setBest(ms: number | null): void;
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

  return {
    setLapTime(ms) {
      lapTimeEl.textContent = formatTime(ms);
    },
    setLap(lap, totalLaps) {
      lapCountEl.textContent = `lap ${lap}/${totalLaps}`;
    },
    setPosition(pos, racers) {
      posEl.textContent = `${ordinal(pos)}/${racers}`;
    },
    setBest(ms) {
      bestEl.textContent = ms === null ? "best —" : `best ${formatTime(ms)}`;
    },
    countdown(text) {
      if (text === null) {
        countdownEl.hidden = true;
        return;
      }
      if (countdownEl.textContent !== text || countdownEl.hidden) {
        countdownEl.textContent = text;
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
