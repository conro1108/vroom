// Calibration overlay: floats over the game while free-driving so A/B can be
// toggled mid-corner. The state machine lives in game/calibrate; this is
// just its cockpit.
import { currentAxis, ROUNDS_PER_AXIS, variants, type Calibration } from "../game/calibrate";

export interface CalibrateUi {
  show(cal: Calibration, active: "a" | "b"): void;
  update(cal: Calibration, active: "a" | "b"): void;
  hide(): void;
}

export interface CalibrateHandlers {
  onVariant(which: "a" | "b"): void;
  onPick(): void;
  onSkip(): void;
  onQuit(): void;
}

export function createCalibrateUi(handlers: CalibrateHandlers): CalibrateUi {
  const root = document.getElementById("calibrate")!;

  const title = document.createElement("div");
  title.className = "cal-title";

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

  root.append(title, abRow, actions);

  const update = (cal: Calibration, active: "a" | "b") => {
    const axis = currentAxis(cal);
    title.textContent = `${axis.label} · round ${cal.round + 1}/${ROUNDS_PER_AXIS}`;
    const { a, b } = variants(cal);
    btnA.textContent = `A ${a}`;
    btnB.textContent = `B ${b}`;
    btnA.classList.toggle("active", active === "a");
    btnB.classList.toggle("active", active === "b");
  };

  return {
    show(cal, active) {
      update(cal, active);
      root.hidden = false;
    },
    update,
    hide() {
      root.hidden = true;
    },
  };
}
