// Calibration overlay: floats over the game while free-driving so A/B can be
// toggled mid-corner. Variants also swap on their own every AUTO_SWITCH_SECONDS
// so you can just keep driving through a corner and feel the difference,
// rather than having to stop and tap; tapping A/B manually still works and
// resets the clock. The state machine lives in game/calibrate; this is just
// its cockpit.
import { currentAxis, ROUNDS_PER_AXIS, variants, type Calibration } from "../game/calibrate";

const AUTO_SWITCH_SECONDS = 10;

export interface CalibrateUi {
  show(cal: Calibration, active: "a" | "b"): void;
  update(cal: Calibration, active: "a" | "b"): void;
  showConfirm(): void;
  hide(): void;
}

export interface CalibrateHandlers {
  onVariant(which: "a" | "b"): void;
  onPick(): void;
  onSkip(): void;
  onQuit(): void;
  onApply(): void;
  onDiscard(): void;
}

export function createCalibrateUi(handlers: CalibrateHandlers): CalibrateUi {
  const root = document.getElementById("calibrate")!;

  const title = document.createElement("div");
  title.className = "cal-title";

  const countdown = document.createElement("div");
  countdown.className = "cal-countdown";

  const abRow = document.createElement("div");
  abRow.className = "cal-ab";
  const btnA = document.createElement("button");
  const btnB = document.createElement("button");
  btnA.addEventListener("click", () => handlers.onVariant("a"));
  btnB.addEventListener("click", () => handlers.onVariant("b"));
  abRow.append(btnA, btnB);

  const actions = document.createElement("div");
  actions.className = "cal-actions";
  const pick = document.createElement("button");
  pick.className = "cal-pick";
  pick.textContent = "✓ keep this one";
  pick.addEventListener("click", () => handlers.onPick());
  const skip = document.createElement("button");
  skip.textContent = "skip";
  skip.addEventListener("click", () => handlers.onSkip());
  const quit = document.createElement("button");
  quit.textContent = "✕";
  quit.setAttribute("aria-label", "quit calibration");
  quit.addEventListener("click", () => handlers.onQuit());
  actions.append(pick, skip, quit);

  const confirmRow = document.createElement("div");
  confirmRow.className = "cal-actions";
  confirmRow.hidden = true;
  const apply = document.createElement("button");
  apply.className = "cal-pick";
  apply.textContent = "✓ apply to my settings";
  apply.addEventListener("click", () => handlers.onApply());
  const discard = document.createElement("button");
  discard.textContent = "discard";
  discard.addEventListener("click", () => handlers.onDiscard());
  confirmRow.append(apply, discard);

  root.append(title, countdown, abRow, actions, confirmRow);

  // auto-switch: flips the active variant on its own so you can keep driving
  // through the same stretch of track instead of stopping to tap. Any manual
  // tap or round change restarts the clock.
  let autoTimer: number | null = null;
  let secondsLeft = AUTO_SWITCH_SECONDS;
  let activeVariant: "a" | "b" = "a";

  const stopAutoSwitch = () => {
    if (autoTimer !== null) {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }
  };

  const startAutoSwitch = () => {
    stopAutoSwitch();
    secondsLeft = AUTO_SWITCH_SECONDS;
    countdown.textContent = `switches in ${secondsLeft}s — or tap to switch now`;
    autoTimer = window.setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        handlers.onVariant(activeVariant === "a" ? "b" : "a");
      } else {
        countdown.textContent = `switches in ${secondsLeft}s — or tap to switch now`;
      }
    }, 1000);
  };

  const update = (cal: Calibration, active: "a" | "b") => {
    activeVariant = active;
    const axis = currentAxis(cal);
    title.textContent = `${axis.label} · round ${cal.round + 1}/${ROUNDS_PER_AXIS}`;
    const { a, b } = variants(cal);
    btnA.textContent = `A ${a}`;
    btnB.textContent = `B ${b}`;
    btnA.classList.toggle("active", active === "a");
    btnB.classList.toggle("active", active === "b");
    startAutoSwitch();
  };

  return {
    show(cal, active) {
      update(cal, active);
      countdown.hidden = false;
      abRow.hidden = false;
      actions.hidden = false;
      confirmRow.hidden = true;
      root.hidden = false;
    },
    update,
    showConfirm() {
      stopAutoSwitch();
      title.textContent = "calibration complete — keep it?";
      countdown.hidden = true;
      abRow.hidden = true;
      actions.hidden = true;
      confirmRow.hidden = false;
    },
    hide() {
      stopAutoSwitch();
      root.hidden = true;
    },
  };
}
