// Cup select: a swipeable run of cups with a road underneath that shows how far
// you've come. Scroll position is the selection; the marker on the road follows it.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { cupIndex, phase, type Game } from "../app/game";
import { bestPlace, cupOpen } from "../app/career";
import { CUPS, type Cup } from "../tracks";
import { Back, Chevron, Lock } from "./art";
import { cupVars, medal, ordinal, shortCup } from "./look";
import { DefMap } from "./TrackMap";
import { wipe } from "./wipe";

// ---- the road ----

const W = 340;
const H = 56;
const nodeX = (i: number) => 26 + (i * (W - 52)) / (CUPS.length - 1);
const nodeY = (i: number) => (i % 2 ? 16 : 40);

function roadPath(to = CUPS.length - 1) {
  let d = `M${nodeX(0)} ${nodeY(0)}`;
  for (let i = 1; i <= to; i++) {
    const [x0, x1] = [nodeX(i - 1), nodeX(i)];
    const m = (x0 + x1) / 2;
    d += `C${m} ${nodeY(i - 1)} ${m} ${nodeY(i)} ${x1} ${nodeY(i)}`;
  }
  return d;
}

function Road({ sel, open, marker, onPick }: { sel: number; open: number; marker: { current: SVGGElement | null }; onPick: (i: number) => void }) {
  return (
    <div class="road">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path class="rd-base" d={roadPath()} />
        <path class="rd-dash" d={roadPath()} />
        {open > 0 && <path class="rd-done" d={roadPath(open)} />}
        {CUPS.map((c, i) => (
          <g transform={`translate(${nodeX(i)} ${nodeY(i)})`} key={c.id}>
            <polygon class={`rd-node${i <= open ? " on" : ""}${i === sel ? " sel" : ""}`} style={cupVars(c)} points="-7,-9 11,-9 7,9 -11,9" />
          </g>
        ))}
        <g ref={marker} class="rd-marker"><polygon points="-9,-22 7,-22 12,-30 -4,-30" /><polygon points="-9,-22 7,-22 0,-13" /></g>
      </svg>
      <div class="rd-hits">
        {CUPS.map((c, i) => <button key={c.id} aria-label={c.name} onClick={() => onPick(i)} />)}
      </div>
    </div>
  );
}

// ---- one cup ----

function Card({ cup, index, active, onTap }: { cup: Cup; index: number; active: boolean; onTap: () => void }) {
  const open = cupOpen(index);
  const best = bestPlace(cup.id);
  const prev = CUPS[index - 1];
  return (
    <button class={`card${open ? "" : " locked"}${active ? " active" : ""}`} style={cupVars(cup)} onClick={onTap} aria-label={open ? cup.name : `${cup.name}, locked`}>
      <span class="card-num">{index + 1}</span>
      <span class="card-head">
        <span class="card-kick">CUP {index + 1} OF {CUPS.length}</span>
        <span class="card-name">{shortCup(cup)}<small>CUP</small></span>
        <span class="card-idea">{cup.idea}</span>
      </span>
      <span class="card-map"><DefMap def={cup.tracks[0]!} draw={active} /></span>
      <span class="card-tracks">
        {cup.tracks.map((t, i) => (
          <span class="card-track" key={t.id}>
            <i>{i + 1}</i>
            <span class="card-mini"><DefMap def={t} /></span>
            <b>{open ? t.name : "? ? ?"}</b>
          </span>
        ))}
      </span>
      <span class="card-foot">
        {open ? (
          best ? (
            <span class="card-best" style={`--medal:${medal(best)}`}>BEST <b>{best}<sup>{ordinal(best)}</sup></b></span>
          ) : (
            <span class="card-best none">NOT YET RACED</span>
          )
        ) : (
          <span class="card-lockline"><Lock /> PODIUM {prev ? shortCup(prev).toUpperCase() : ""} TO OPEN</span>
        )}
        <span class="card-speed" aria-label={`Speed ${index + 1} of ${CUPS.length}`}>
          SPEED
          {CUPS.map((_, i) => <i class={i <= index ? "on" : ""} key={i} />)}
        </span>
      </span>
      {!open && <span class="card-bigl"><Lock /></span>}
    </button>
  );
}

// ---- the screen ----

export function Cups({ game }: { game: Game }) {
  const rail = useRef<HTMLDivElement>(null);
  const marker = useRef<SVGGElement>(null);
  const furthest = useMemo(() => CUPS.reduce((m, _, i) => (cupOpen(i) ? i : m), 0), []);
  const [sel, setSel] = useState(() => (cupOpen(cupIndex.value) && bestPlace(CUPS[cupIndex.value]!.id) === null ? cupIndex.value : furthest));
  const selRef = useRef(sel);

  const moveMarker = (u: number) => {
    const a = Math.max(0, Math.min(CUPS.length - 1, u));
    const i = Math.min(CUPS.length - 2, Math.floor(a));
    const t = a - i;
    const e = t * t * (3 - 2 * t);
    marker.current?.setAttribute("transform", `translate(${nodeX(i) + (nodeX(i + 1) - nodeX(i)) * t} ${nodeY(i) + (nodeY(i + 1) - nodeY(i)) * e})`);
  };

  const centerOf = (i: number) => {
    const r = rail.current!;
    const c = r.children[i] as HTMLElement;
    return c.offsetLeft - (r.clientWidth - c.offsetWidth) / 2;
  };

  useLayoutEffect(() => {
    rail.current!.scrollLeft = centerOf(sel);
    moveMarker(sel);
  }, []);

  const onScroll = () => {
    const r = rail.current!;
    const step = centerOf(1) - centerOf(0);
    const u = (r.scrollLeft - centerOf(0)) / step;
    moveMarker(u);
    const near = Math.max(0, Math.min(CUPS.length - 1, Math.round(u)));
    if (near !== selRef.current) {
      selRef.current = near;
      setSel(near);
    }
  };

  const pick = (i: number) => rail.current?.scrollTo({ left: centerOf(i), behavior: "smooth" });
  const open = cupOpen(sel);
  const go = () => open && wipe(() => game.startCup(sel));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") pick(Math.max(0, selRef.current - 1));
      if (e.key === "ArrowRight") pick(Math.min(CUPS.length - 1, selRef.current + 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const cup = CUPS[sel]!;
  return (
    <div class="cups" style={cupVars(cup)}>
      <div class="cups-bg" />
      <header class="cups-top">
        <button class="ghost" onClick={() => (phase.value = "title")} aria-label="Back to title"><Back /></button>
        <h1>SELECT <b>CUP</b></h1>
      </header>
      <div class="rail" ref={rail} onScroll={onScroll}>
        {CUPS.map((c, i) => <Card key={c.id} cup={c} index={i} active={i === sel} onTap={() => (i === sel ? go() : pick(i))} />)}
      </div>
      <footer class="cups-foot">
        <Road sel={sel} open={furthest} marker={marker} onPick={pick} />
        <button class={`cta${open ? "" : " off"}`} data-primary onClick={go} disabled={!open}>
          {open ? <>RACE <Chevron /></> : <><Lock /> LOCKED</>}
        </button>
      </footer>
    </div>
  );
}
