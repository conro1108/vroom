// Race flow: sit at the line (Start button shown, car frozen) → tap Start →
// a three-light amber-then-green countdown → GO releases the car and starts
// the clock. A reset button re-arms the whole thing at the line.
export type RaceState = "idle" | "countdown" | "racing";

export interface RaceControl {
  /** True while the car should be frozen at the line (idle or counting down). */
  frozen(): boolean;
  state(): RaceState;
  /** Send the car back to the line and show Start again. */
  reset(): void;
}

interface RaceCallbacks {
  onGo(): void; // countdown finished — start the clock
  onReset(): void; // returned to the line — reposition car, clear timer
}

const LIGHT_STEP_MS = 650; // gap between each light coming on

export function createRaceControl(cb: RaceCallbacks): RaceControl {
  let state: RaceState = "idle";
  let timers: number[] = [];

  const overlay = document.createElement("div");
  overlay.id = "race-overlay";

  const lights = document.createElement("div");
  lights.id = "lights";
  const bulbs = [0, 1, 2].map(() => {
    const b = document.createElement("div");
    b.className = "bulb";
    lights.appendChild(b);
    return b;
  });

  const startBtn = document.createElement("button");
  startBtn.id = "start-btn";
  startBtn.textContent = "START";

  const goText = document.createElement("div");
  goText.id = "go-text";

  overlay.append(lights, startBtn, goText);
  document.body.appendChild(overlay);

  const resetBtn = document.getElementById("reset-btn")!;

  const clearTimers = () => {
    for (const t of timers) window.clearTimeout(t);
    timers = [];
  };

  const showIdle = () => {
    clearTimers();
    state = "idle";
    overlay.hidden = false;
    startBtn.hidden = false;
    lights.hidden = true;
    goText.hidden = true;
    for (const b of bulbs) b.className = "bulb";
    cb.onReset();
  };

  const beginCountdown = () => {
    state = "countdown";
    startBtn.hidden = true;
    lights.hidden = false;
    bulbs.forEach((b, i) => {
      timers.push(window.setTimeout(() => (b.className = "bulb on"), LIGHT_STEP_MS * i));
    });
    timers.push(
      window.setTimeout(() => {
        for (const b of bulbs) b.className = "bulb go";
        lights.hidden = true;
        goText.textContent = "GO!";
        goText.hidden = false;
        goText.style.animation = "none";
        void goText.offsetWidth;
        goText.style.animation = "";
        state = "racing";
        cb.onGo();
        timers.push(
          window.setTimeout(() => {
            overlay.hidden = true;
          }, 600)
        );
      }, LIGHT_STEP_MS * 3)
    );
  };

  startBtn.addEventListener("click", beginCountdown);
  resetBtn.addEventListener("click", showIdle);

  showIdle();

  return {
    frozen: () => state !== "racing",
    state: () => state,
    reset: showIdle,
  };
}
