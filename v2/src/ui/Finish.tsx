// The moment you cross the line: your place, huge, over the confetti.
import { hud, lastRace, type Game } from "../app/game";
import { clock, medal, ordinal } from "./look";

const WORD = ["WINNER", "SO CLOSE", "ON THE PODIUM"];

export function Finish({ game }: { game: Game }) {
  const me = lastRace.value.find((r) => r.player);
  const place = hud.peek().place;
  return (
    <div class="finish" style={`--medal:${medal(place)}`} onClick={() => game.skipFinish()}>
      <div class="fi-check fi-check-t" />
      <div class="fi-main">
        <div class="fi-kick">FINISH</div>
        <div class="fi-place">{place}<sup>{ordinal(place)}</sup></div>
        <div class="fi-word">{WORD[place - 1] ?? "RACE OVER"}</div>
        <div class="fi-time">{clock(me?.time ?? null)}</div>
      </div>
      <div class="fi-check fi-check-b" />
    </div>
  );
}
