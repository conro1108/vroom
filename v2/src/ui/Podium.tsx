// The end of a cup: the trophy, the top three on their steps, and what it opened.
import { cupIndex, standings, unlocked, type Game } from "../app/game";
import { CUPS } from "../tracks";
import { Chevron, Lock, Trophy } from "./art";
import { cupVars, hex, ordinal } from "./look";
import { wipe } from "./wipe";

export function Podium({ game }: { game: Game }) {
  const cup = CUPS[cupIndex.value]!;
  const table = [...standings.value].sort((a, b) => b.points - a.points);
  const place = table.findIndex((s) => s.player) + 1;
  const made = place <= 3;
  const fresh = unlocked.value;
  const steps = [table[1], table[0], table[2]];
  return (
    <div class="podium" style={cupVars(cup)}>
      <div class="pd-bg" />
      <div class="pd-rays" />
      <div class="pd-top">
        <div class="pd-kick">{cup.name} · FINAL RESULT</div>
        <h1 class="pd-title">{place === 1 ? "CHAMPION" : made ? <>{place}<sup>{ordinal(place)}</sup> PLACE</> : <>{place}<sup>{ordinal(place)}</sup> IN CUP</>}</h1>
      </div>
      {made && <Trophy place={place} />}
      <div class="pd-steps">
        {steps.map((s, i) => s && (
          <div class={`pd-step pd-s${i}${s.player ? " me" : ""}`} style={`--car:${hex(s.color)}`} key={s.name}>
            <b class="pd-name">{s.name}</b>
            <div class="pd-block"><i>{[2, 1, 3][i]}</i><span>{s.points}<small>PTS</small></span></div>
          </div>
        ))}
      </div>
      {fresh ? (
        <div class="pd-unlock" style={cupVars(fresh)}><small>NEW CUP OPEN</small><b>{fresh.name}</b></div>
      ) : !made ? (
        <div class="pd-miss"><Lock /> A TOP 3 FINISH OPENS THE NEXT CUP</div>
      ) : null}
      <footer class="pd-foot">
        {!made && <button class="cta alt" onClick={() => wipe(() => game.startCup(cupIndex.value))}>RETRY CUP</button>}
        <button class="cta" data-primary onClick={() => wipe(() => game.toMenu())}>CUPS <Chevron /></button>
      </footer>
    </div>
  );
}
