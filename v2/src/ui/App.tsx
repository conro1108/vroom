// Temporary shell: enough UI to drive a race. Replaced by the real front end.
import { hud, phase, type Game } from "../app/game";

export function App({ game }: { game: Game }) {
  const p = phase.value;
  const h = hud.value;
  if (p === "title" || p === "cups") {
    return <div class="center"><button class="big-btn" onClick={() => game.startCup(0)}>RACE</button></div>;
  }
  if (p === "results" || p === "podium") {
    return <div class="center"><button class="big-btn" onClick={() => game.nextRace()}>NEXT</button></div>;
  }
  return (
    <>
      <div class="hud-place">{h.place}<small>/{h.field}</small></div>
      <div class="hud-lap">LAP {h.lap}/{h.laps}<br />{h.time.toFixed(2)}</div>
      <div class="hud-speed">{h.speed}</div>
      {p === "countdown" && <div class="hud-count">{h.count}</div>}
      {p === "intro" && <div class="center" onClick={() => game.skipIntro()} />}
    </>
  );
}
