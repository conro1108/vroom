// Title: the showcase race orbits behind the wordmark; anywhere starts.
import type { Game } from "../app/game";
import { Chevron, Wordmark } from "./art";

export function Title({ game }: { game: Game }) {
  return (
    <button class="title" data-primary onClick={() => game.toCups()} aria-label="Tap to start">
      <span class="t-rays" />
      <span class="t-head">
        <span class="t-band t-band-r" />
        <span class="t-band t-band-b" />
        <Wordmark class="t-mark" />
        <span class="t-tag">ONE THUMB. <b>FLAT OUT.</b></span>
      </span>
      <span class="t-start">
        <span class="t-start-in">
          <Chevron /><Chevron /><Chevron />
          <b>TAP TO START</b>
          <Chevron /><Chevron /><Chevron />
        </span>
      </span>
    </button>
  );
}
