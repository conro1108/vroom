// Pause: resume, restart, quit, and the sound switch.
import { muted, type Game } from "../app/game";
import { Chevron } from "./art";
import { wipe } from "./wipe";

export function Pause({ game }: { game: Game }) {
  return (
    <div class="pause" data-noinput>
      <div class="pa-bg" />
      <div class="pa-main">
        <h1>PAUSED</h1>
        <button class="pa-btn pa-go" style="--i:0" data-primary onClick={() => game.resume()}>RESUME <Chevron /></button>
        <button class="pa-btn" style="--i:1" onClick={() => wipe(() => game.retry())}>RESTART RACE</button>
        <button class="pa-btn" style="--i:2" onClick={() => wipe(() => game.toMenu())}>QUIT TO CUPS</button>
        <button class="pa-btn pa-snd" style="--i:3" onClick={() => game.setMuted(!muted.value)} aria-pressed={!muted.value}>
          SOUND <b class={muted.value ? "off" : "on"}>{muted.value ? "OFF" : "ON"}</b>
        </button>
      </div>
    </div>
  );
}
