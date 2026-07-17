// In-app tuning panel: control preferences plus every raw feel slider in a
// collapsed "advanced" section. Vehicles (coarse handling personalities) are
// picked on the splash menu; the sliders here fine-tune on top of whichever
// vehicle is active. Everything applies live to the shared Tuning object and
// persists. "copy json" exports the current values so a good feel found
// on-device can be pasted back into DEFAULT_TUNING or a vehicle definition.
import { DEFAULT_TUNING, saveTuning, type Tuning } from "../game/tuning";

type NumericTuningKey = {
  [K in keyof Tuning]: Tuning[K] extends number ? K : never;
}[keyof Tuning];

interface SliderSpec {
  key: NumericTuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderSpec[] = [
  { key: "maxSpeed", label: "max speed", min: 60, max: 320, step: 5 },
  { key: "accel", label: "acceleration", min: 60, max: 500, step: 5 },
  { key: "brake", label: "brake", min: 60, max: 600, step: 10 },
  { key: "drag", label: "coast drag", min: 0, max: 200, step: 5 },
  { key: "turnRate", label: "turn rate", min: 1, max: 6, step: 0.1 },
  { key: "speedTurnFalloff", label: "turn falloff @ speed", min: 0, max: 0.9, step: 0.05 },
  { key: "steerResponse", label: "steer response", min: 1, max: 20, step: 0.5 },
  { key: "lateralGrip", label: "grip", min: 0.5, max: 15, step: 0.25 },
  { key: "driftGrip", label: "drift grip", min: 0.2, max: 8, step: 0.1 },
  { key: "driftThreshold", label: "drift threshold", min: 10, max: 120, step: 5 },
  { key: "offroadMaxSpeed", label: "offroad max speed", min: 0.2, max: 1, step: 0.05 },
  { key: "offroadFriction", label: "offroad drag ×", min: 1, max: 8, step: 0.25 },
  { key: "cameraLerp", label: "camera follow", min: 1, max: 15, step: 0.5 },
  { key: "lookAhead", label: "camera look-ahead", min: 0, max: 0.8, step: 0.05 },
  { key: "joystickDeadzonePx", label: "stick deadzone px", min: 0, max: 30, step: 1 },
  { key: "joystickLockDeg", label: "stick full-lock angle", min: 10, max: 90, step: 5 },
  { key: "steerRangePx", label: "drag-x steer range", min: 30, max: 160, step: 5 },
];

export function createDevPanel(tuning: Tuning, onCalibrate?: () => void): void {
  const toggle = document.getElementById("dev-toggle")!;
  const panel = document.getElementById("dev-panel")!;
  let advancedOpen = false;

  const render = () => {
    panel.innerHTML = "";

    const close = document.createElement("button");
    close.className = "panel-close";
    close.textContent = "✕";
    close.addEventListener("click", () => (panel.hidden = true));
    panel.appendChild(close);

    const title = document.createElement("h2");
    title.textContent = "Settings";
    panel.appendChild(title);
    const sub = document.createElement("div");
    sub.className = "panel-sub";
    sub.textContent = "How should it feel?";
    panel.appendChild(sub);

    const addCheck = (id: string, text: string, get: () => boolean, set: (v: boolean) => void) => {
      const checkRow = document.createElement("div");
      checkRow.className = "check-row";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.id = id;
      check.checked = get();
      check.addEventListener("change", () => {
        set(check.checked);
        saveTuning(tuning);
      });
      const checkLabel = document.createElement("label");
      checkLabel.htmlFor = id;
      checkLabel.textContent = text;
      checkRow.append(check, checkLabel);
      panel.appendChild(checkRow);
    };

    addCheck(
      "joystick-steer",
      "joystick steering (thumb points where to go)",
      () => tuning.steerMode === "joystick",
      (v) => (tuning.steerMode = v ? "joystick" : "dragx")
    );
    addCheck(
      "fixed-stick",
      "fixed stick (anchored bottom-right)",
      () => tuning.fixedStick,
      (v) => (tuning.fixedStick = v)
    );
    addCheck(
      "hold-to-go",
      "hold to go (release = coast)",
      () => tuning.holdToGo,
      (v) => (tuning.holdToGo = v)
    );

    if (onCalibrate) {
      const calBtn = document.createElement("button");
      calBtn.className = "calibrate-btn";
      calBtn.textContent = "🧪 calibrate feel (A/B driving test)";
      calBtn.addEventListener("click", () => {
        panel.hidden = true;
        onCalibrate();
      });
      panel.appendChild(calBtn);
    }

    // advanced: the raw physics sliders, collapsed by default
    const advanced = document.createElement("details");
    advanced.className = "advanced";
    advanced.open = advancedOpen;
    advanced.addEventListener("toggle", () => (advancedOpen = advanced.open));
    const summary = document.createElement("summary");
    summary.textContent = "advanced tuning";
    advanced.appendChild(summary);

    for (const spec of SLIDERS) {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      const name = document.createElement("span");
      name.textContent = spec.label;
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = String(tuning[spec.key]);
      label.append(name, val);

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(spec.min);
      slider.max = String(spec.max);
      slider.step = String(spec.step);
      slider.value = String(tuning[spec.key]);
      slider.addEventListener("input", () => {
        tuning[spec.key] = Number(slider.value);
        val.textContent = slider.value;
        saveTuning(tuning);
      });

      row.append(label, slider);
      advanced.appendChild(row);
    }

    const buttons = document.createElement("div");
    buttons.className = "panel-buttons";

    const reset = document.createElement("button");
    reset.textContent = "reset";
    reset.addEventListener("click", () => {
      Object.assign(tuning, DEFAULT_TUNING);
      saveTuning(tuning);
      render();
    });

    const copy = document.createElement("button");
    copy.textContent = "copy json";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(tuning, null, 2));
        copy.textContent = "copied!";
      } catch {
        copy.textContent = "copy failed";
      }
      window.setTimeout(() => (copy.textContent = "copy json"), 1200);
    });

    buttons.append(reset, copy);
    advanced.appendChild(buttons);
    panel.appendChild(advanced);
  };

  render();

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
}
