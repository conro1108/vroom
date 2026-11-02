// ?dev: a slider for every number in TUNING, edited live and kept across reloads on
// this device, because a phone is where feel gets judged and refreshing shouldn't
// lose the session. "copy" produces JSON to paste back into src/sim/tuning.ts.
import { useState } from "preact/hooks";
import { TUNING } from "../sim/tuning";

const KEY = "vroom2.tuning";
const DEFAULTS = { ...TUNING };
type K = keyof typeof TUNING;
const KEYS = Object.keys(TUNING) as K[];
const on = new URLSearchParams(location.search).has("dev");

if (on) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<typeof TUNING>;
    for (const k of KEYS) if (typeof saved[k] === "number") TUNING[k] = saved[k]!;
  } catch {
    localStorage.removeItem(KEY);
  }
}

const stepFor = (v: number) => {
  const m = Math.abs(v) || 1;
  return m >= 10 ? 0.5 : m >= 1 ? 0.05 : 0.01;
};

function Row({ k, rev }: { k: K; rev: number }) {
  const [v, setV] = useState(TUNING[k]);
  const d = DEFAULTS[k];
  const step = stepFor(d);
  const max = Math.max(d * 2.5, step * 10);
  const changed = Math.abs(TUNING[k] - d) > 1e-6;
  void rev;
  return (
    <label class={changed ? "dv-row changed" : "dv-row"}>
      <span class="dv-name">{k}</span>
      <output>{+TUNING[k].toFixed(3)}</output>
      <input
        type="range" min={0} max={max} step={step} value={v}
        onInput={(e) => {
          const n = Number((e.target as HTMLInputElement).value);
          TUNING[k] = n;
          setV(n);
          localStorage.setItem(KEY, JSON.stringify(TUNING));
        }}
      />
    </label>
  );
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [rev, setRev] = useState(0);
  const [note, setNote] = useState("");
  const [json, setJson] = useState("");
  if (!on) return null;

  const copy = async () => {
    const text = JSON.stringify(TUNING, null, 2);
    try {
      await navigator.clipboard.writeText(text); // absent on plain http over LAN
      setNote("copied");
      setTimeout(() => setNote(""), 1200);
    } catch {
      setJson(text);
    }
  };
  const reset = () => {
    Object.assign(TUNING, DEFAULTS);
    localStorage.removeItem(KEY);
    setRev(rev + 1);
  };

  return (
    <div class={open ? "dev open" : "dev"} data-noinput>
      <button class="dv-tab" onClick={() => setOpen(!open)}>{open ? "CLOSE" : "DEV"}</button>
      {open && (
        <div class="dv-sheet">
          <div class="dv-bar">
            <button onClick={copy}>{note || "COPY JSON"}</button>
            <button onClick={reset}>RESET</button>
          </div>
          {json && <textarea class="dv-json" readOnly value={json} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} onBlur={() => setJson("")} />}
          <div class="dv-list">
            {KEYS.map((k) => <Row k={k} rev={rev} key={`${k}${rev}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}
