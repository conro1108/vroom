// After a race: first the classification, then the cup table, where the points
// land and the rows physically reorder. Tap-through, two stages, one panel.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { course, cupIndex, lastRace, raceIndex, standings, type Game } from "../app/game";
import { CUPS } from "../tracks";
import { Chevron } from "./art";
import { clock, cupVars, hex, ordinal } from "./look";
import { wipe } from "./wipe";

function RaceTable() {
  const rows = lastRace.value;
  const lead = rows[0]?.time ?? 0;
  return (
    <ol class="tbl">
      {rows.map((r, i) => (
        <li class={r.player ? "row me" : "row"} style={`--i:${i};--car:${hex(r.color)}`} key={r.name}>
          <span class="r-pos">{i + 1}</span>
          <i class="r-car" />
          <span class="r-name">{r.name}</span>
          <span class="r-time">{i === 0 ? clock(r.time) : `+${(r.time - lead).toFixed(2)}`}</span>
          <span class="r-pts">+{r.points}</span>
        </li>
      ))}
    </ol>
  );
}

function CupTable() {
  const earned = new Map(lastRace.value.map((r) => [r.name, r.points]));
  const after = [...standings.value].sort((a, b) => b.points - a.points);
  const before = [...standings.value]
    .map((s) => ({ ...s, points: s.points - (earned.get(s.name) ?? 0) }))
    .sort((a, b) => b.points - a.points);
  const rankBefore = new Map(before.map((s, i) => [s.name, i]));
  const list = useRef<HTMLOListElement>(null);
  const [landed, setLanded] = useState(false);

  // Rows start at their old rank and old score, then slide to the new order.
  useLayoutEffect(() => {
    const rows = Array.from(list.current!.children) as HTMLElement[];
    const h = rows[0]!.offsetHeight + 4;
    rows.forEach((el, i) => {
      el.style.setProperty("--from", `${((rankBefore.get(el.dataset.name!) ?? i) - i) * h}px`);
    });
    const t = setTimeout(() => setLanded(true), 620);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!landed) return;
    const rows = Array.from(list.current!.querySelectorAll<HTMLElement>("[data-to]"));
    const start = performance.now();
    let raf = 0;
    const run = (now: number) => {
      const u = Math.min(1, (now - start) / 520);
      for (const el of rows) {
        const [a, b] = [Number(el.dataset.from), Number(el.dataset.to)];
        el.textContent = String(Math.round(a + (b - a) * u));
      }
      if (u < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [landed]);

  return (
    <ol class={landed ? "tbl cup landed" : "tbl cup"} ref={list}>
      {after.map((s, i) => {
        const gain = earned.get(s.name) ?? 0;
        return (
          <li class={s.player ? "row me" : "row"} style={`--i:${i};--car:${hex(s.color)}`} data-name={s.name} key={s.name}>
            <span class="r-pos">{i + 1}</span>
            <i class="r-car" />
            <span class="r-name">{s.name}</span>
            <span class="r-pts r-gain">{gain ? `+${gain}` : ""}</span>
            <span class="r-total" data-from={s.points - gain} data-to={s.points}>{s.points - gain}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Results({ game }: { game: Game }) {
  const [stage, setStage] = useState(0);
  const cup = CUPS[cupIndex.value]!;
  const me = lastRace.value.findIndex((r) => r.player) + 1;
  const last = raceIndex.value + 1 >= cup.tracks.length;
  return (
    <div class="results" style={cupVars(cup)}>
      <div class="rs-bg" />
      <div class="rs-panel" key={stage}>
        <header class="rs-head">
          <div class="rs-kick">{stage === 0 ? `${cup.name} · RACE ${raceIndex.value + 1} OF ${cup.tracks.length}` : `${cup.name} · AFTER RACE ${raceIndex.value + 1}`}</div>
          <h1>{stage === 0 ? course.value?.def.name : "CUP STANDINGS"}</h1>
          {stage === 0 && <div class="rs-you">{me}<sup>{ordinal(me)}</sup></div>}
        </header>
        {stage === 0 ? <RaceTable /> : <CupTable />}
      </div>
      <footer class="rs-foot" key={`f${stage}`}>
        {stage === 0 ? (
          <button class="cta" data-primary onClick={() => setStage(1)}>STANDINGS <Chevron /></button>
        ) : (
          <>
            <button class="cta alt" onClick={() => wipe(() => game.retry())}>RETRY</button>
            <button class="cta" data-primary onClick={() => wipe(() => game.nextRace())}>{last ? "CUP FINISH" : "NEXT RACE"} <Chevron /></button>
          </>
        )}
      </footer>
    </div>
  );
}
