// The race HUD. `hud` changes every frame, so nothing continuous goes through
// render: `useFrame` hands each widget the latest values and it writes to its own
// refs. Discrete things (lap, place, count, banner) read small computeds, which
// re-render only that widget and only when the value changes.
import { computed } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { course, hud, phase, type Game, type Hud as HudData } from "../app/game";
import { hintDone, markHintDone } from "../app/career";
import { throwPx } from "../app/input";
import { TUNING } from "../sim/tuning";
import { PauseIcon } from "./art";
import { clock, hex, ordinal } from "./look";
import { shapeOf } from "./shapes";

const place = computed(() => hud.value.place);
const field = computed(() => hud.value.field);
const lap = computed(() => hud.value.lap);
const laps = computed(() => hud.value.laps);
const banner = computed(() => hud.value.banner);
const count = computed(() => hud.value.count);
const going = computed(() => phase.value === "countdown" || hud.value.time < 0.8);

function useFrame(fn: (h: HudData) => void) {
  const f = useRef(fn);
  f.current = fn;
  useEffect(() => hud.subscribe((h) => f.current(h)), []);
}

const setText = (el: HTMLElement | null, s: string) => {
  if (el && el.textContent !== s) el.textContent = s;
};

// ---- position and lap ----

function Place() {
  const p = place.value;
  return (
    <div class={`h-place p${Math.min(p, 4)}`} key={p}>
      <b>{p}</b>
      <span><sup>{ordinal(p)}</sup><small>OF {field.value}</small></span>
    </div>
  );
}

function Lap({ game }: { game: Game }) {
  const time = useRef<HTMLSpanElement>(null);
  const last = useRef<HTMLSpanElement>(null);
  const best = useRef<HTMLSpanElement>(null);
  const seen = useRef<number | null>(null);
  useFrame((h) => {
    setText(time.current, clock(h.time));
    if (h.lastLap !== seen.current) {
      seen.current = h.lastLap;
      setText(last.current, clock(h.lastLap));
      setText(best.current, clock(h.bestLap));
      if (h.lastLap !== null && h.lastLap === h.bestLap && h.lap > 2) {
        best.current?.parentElement?.animate(
          [{ background: "#ffd21f", color: "#0d1320" }, { background: "#ffd21f", color: "#0d1320", offset: 0.7 }, {}],
          { duration: 2200 },
        );
      }
    }
  });
  return (
    <div class="h-right">
      <div class="h-lapline">
        <div class="h-lap"><small>LAP</small><b key={lap.value}>{lap.value}</b><small>/{laps.value}</small></div>
        <button class="h-pause" onClick={() => game.pause()} aria-label="Pause"><PauseIcon /></button>
      </div>
      <div class="h-time"><span ref={time}>0:00.00</span></div>
      <div class="h-splits">
        <div><small>LAST</small><span ref={last}>-:--.--</span></div>
        <div><small>BEST</small><span ref={best}>-:--.--</span></div>
      </div>
    </div>
  );
}

// ---- minimap ----

function Minimap() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const c = course.value;
  const shape = c ? shapeOf(c) : null;
  const road = useRef<Path2D | null>(null);
  const skip = useRef(0);

  useEffect(() => {
    const el = canvas.current!;
    const size = el.clientWidth || 110;
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.width = el.height = size * dpr;
    road.current = shape ? new Path2D(shape.d) : null;
  }, [shape]);

  useFrame((h) => {
    if (skip.current++ % 2) return; // 30Hz is plenty for dots this small
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !shape || !road.current) return;
    const k = el.width / 100;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 100, 100);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(9,18,40,.85)";
    ctx.lineWidth = 7;
    ctx.stroke(road.current);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke(road.current);
    const me = h.cars.find((x) => x.player);
    for (const car of h.cars) {
      if (car.player) continue;
      const [x, y] = shape.fit(car.x, car.z);
      ctx.fillStyle = "#0d1320";
      ctx.fillRect(x - 3.6, y - 3.6, 7.2, 7.2);
      ctx.fillStyle = hex(car.color);
      ctx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2);
    }
    if (me) {
      const [x, y] = shape.fit(me.x, me.z);
      ctx.fillStyle = "#0d1320";
      ctx.beginPath();
      ctx.moveTo(x, y - 7.5); ctx.lineTo(x + 7.5, y); ctx.lineTo(x, y + 7.5); ctx.lineTo(x - 7.5, y);
      ctx.fill();
      ctx.fillStyle = "#ffd21f";
      ctx.beginPath();
      ctx.moveTo(x, y - 5.2); ctx.lineTo(x + 5.2, y); ctx.lineTo(x, y + 5.2); ctx.lineTo(x - 5.2, y);
      ctx.fill();
    }
  });
  return <canvas class="h-map" ref={canvas} aria-hidden="true" />;
}

// ---- speed ----

function Speed() {
  const num = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const last = useRef(-1);
  useFrame((h) => {
    if (h.speed !== last.current) {
      last.current = h.speed;
      setText(num.current, String(h.speed));
    }
    if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, h.speedFrac / 1.33).toFixed(3)})`;
  });
  return (
    <div class="h-speed">
      <div class="h-num"><b ref={num}>0</b><small>KM/H</small></div>
      <div class="h-tach"><i ref={bar} /></div>
    </div>
  );
}

// ---- drift charge ----

const TIER_NAME = ["DRIFT", "MINI", "SUPER", "ULTRA"];
const BOOST_NAME = ["", "MINI BOOST", "SUPER BOOST", "ULTRA BOOST", "BOOST PAD"];

function Drift() {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLElement>(null);
  const label = useRef<HTMLElement>(null);
  const was = useRef({ tier: 0, n: hud.peek().boostN, drifting: false });
  const hold = useRef(0);
  useFrame((h) => {
    const el = root.current;
    if (!el) return;
    const w = was.current;
    if (fill.current) fill.current.style.transform = `scaleX(${h.drift.toFixed(3)})`;
    if (h.tier !== w.tier) {
      el.dataset.tier = String(h.tier);
      if (h.tier > w.tier) {
        setText(label.current, TIER_NAME[h.tier]!);
        el.animate([{ transform: "scale(1.22) skewX(-20deg)" }, { transform: "scale(1) skewX(-10deg)" }], { duration: 170, easing: "cubic-bezier(.2,1.6,.4,1)" });
      }
      w.tier = h.tier;
    }
    if (h.boostN !== w.n) {
      w.n = h.boostN;
      setText(label.current, BOOST_NAME[h.boostTier] ?? "BOOST");
      el.classList.add("fired");
      el.dataset.fire = String(h.boostTier);
      hold.current = performance.now() + 750;
      el.animate([{ filter: "brightness(3)" }, { filter: "brightness(1)" }], { duration: 320 });
    } else if (hold.current && performance.now() > hold.current) {
      hold.current = 0;
      el.classList.remove("fired");
    }
    if (h.drifting !== w.drifting) {
      w.drifting = h.drifting;
      el.classList.toggle("show", h.drifting);
      if (h.drifting) {
        el.classList.remove("fired");
        setText(label.current, TIER_NAME[0]!);
      }
    }
  });
  const t3 = TUNING.tier3 || 1;
  return (
    <div class="h-drift" ref={root} data-tier="0">
      <span class="h-dlabel" ref={label}>DRIFT</span>
      <div class="h-dbar">
        <i class="h-dfill" ref={fill} />
        <u style={`left:${(TUNING.tier1 / t3) * 100}%`} />
        <u style={`left:${(TUNING.tier2 / t3) * 100}%`} />
      </div>
    </div>
  );
}

// ---- edges ----

function Edges() {
  const root = useRef<HTMLDivElement>(null);
  const last = useRef(-1);
  const boost = useRef(false);
  useFrame((h) => {
    const el = root.current;
    if (!el) return;
    const s = Math.round(Math.max(0, Math.min(1, (h.speedFrac - 0.72) / 0.3)) * 20) / 20;
    if (s !== last.current) {
      last.current = s;
      el.style.setProperty("--s", String(s));
    }
    if (h.boost !== boost.current) {
      boost.current = h.boost;
      el.classList.toggle("boost", h.boost);
    }
  });
  return (
    <div class="edges" ref={root} aria-hidden="true">
      <i class="ed ed-l" /><i class="ed ed-r" />
      <i class="ed-b ed-bl" /><i class="ed-b ed-br" />
    </div>
  );
}

// ---- thumb ----

function Thumb() {
  const root = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const shown = useRef(false);
  useFrame((h) => {
    const el = root.current;
    if (!el) return;
    const t = h.thumb;
    if (!!t !== shown.current) {
      shown.current = !!t;
      el.style.opacity = t ? "1" : "0";
    }
    if (t) {
      el.style.transform = `translate3d(${t.x - t.dx}px,${t.y - 76}px,0)`;
      const down = Math.min(t.dy, TUNING.driftPull * 1.4);
      if (knob.current) knob.current.style.transform = `translate3d(${t.dx * (62 / throwPx())}px,${down}px,0) skewX(-12deg)`;
      el.classList.toggle("hard", t.dy >= TUNING.driftPull);
    }
  });
  return (
    <div class="h-thumb" ref={root}>
      <div class="h-rail"><s /><s /></div>
      <i class="h-knob" ref={knob} />
    </div>
  );
}

// ---- countdown and banners ----

function Countdown() {
  if (!going.value) return null;
  const c = count.value;
  return (
    <div class={`h-count c${c}`} key={c}>
      <i class="h-cband" />
      <b>{c > 0 ? c : "GO!"}</b>
    </div>
  );
}

function Banner() {
  const b = banner.value;
  if (!b) return null;
  return (
    <div class={b === "FINAL LAP" ? "h-banner final" : "h-banner"} key={b}>
      <i /><b>{b}</b>
    </div>
  );
}

// ---- first race lesson ----

const coarse = matchMedia("(pointer: coarse)").matches;
const STEPS = coarse
  ? ["HOLD TO GO", "DRAG TO STEER", "PULL DOWN IN A CORNER TO DRIFT", "SLIDE BACK UP TO BOOST"]
  : ["UP ARROW TO GO", "LEFT AND RIGHT TO STEER", "HOLD SPACE IN A CORNER TO DRIFT", "LET GO TO BOOST"];

function Hint() {
  const [step, setStep] = useState(() => (hintDone() || hud.peek().auto ? -1 : 0));
  const live = useRef(step);
  const off = useRef(false);
  useFrame((h) => {
    const s = live.current;
    if (s < 0) return;
    const go = h.speed > 12;
    const steer = (h.thumb && Math.abs(h.thumb.dx) > 22) || (!coarse && h.speed > 40);
    let n = s;
    if (s === 0 && (h.thumb || go)) n = 1;
    if (s === 1 && steer) n = 2;
    if (s === 2 && h.drifting && h.tier > 0) n = 3;
    if (s === 3 && h.boost) n = 4;
    if (n === s) return;
    live.current = n;
    if (n === 4 && !off.current) {
      off.current = true;
      markHintDone();
      setTimeout(() => setStep(-1), 900);
    }
    setStep(n);
  });
  if (step < 0) return null;
  return (
    <div class={step === 4 ? "h-hint done" : "h-hint"}>
      <div class="h-hdots">{STEPS.map((_, i) => <i class={i < step ? "on" : i === step ? "now" : ""} key={i} />)}</div>
      <b key={step}>{STEPS[step] ?? "THAT'S IT. GO!"}</b>
    </div>
  );
}

// ---- layout ----

export function Hud({ game }: { game: Game }) {
  return (
    <div class="hud">
      <Edges />
      <div class="h-left">
        <Place />
        <Minimap />
      </div>
      <Lap game={game} />
      <Hint />
      <Banner />
      <Countdown />
      <Drift />
      <Speed />
      <Thumb />
    </div>
  );
}
