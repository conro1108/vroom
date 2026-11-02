// The diagonal band sweep between scenes. Loading a track blocks the main thread,
// so the bands cover the screen first and the work happens behind them.
import { signal } from "@preact/signals";
import { Wordmark } from "./art";

type State = "idle" | "in" | "hold" | "out";
export const wipeState = signal<State>("idle");

const COVER_MS = 240;
const OUT_MS = 300;

/** Sweep in, run `fn` while covered, sweep out. */
export function wipe(fn: () => void) {
  if (wipeState.value !== "idle") return;
  wipeState.value = "in";
  setTimeout(() => {
    wipeState.value = "hold";
    // two frames so the covered state is actually on screen before the block
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fn();
      setTimeout(() => {
        wipeState.value = "out";
        setTimeout(() => (wipeState.value = "idle"), OUT_MS);
      }, 60);
    }));
  }, COVER_MS);
}

export function Wipe() {
  const s = wipeState.value;
  if (s === "idle") return null;
  return (
    <div class={`wipe wipe-${s}`} aria-hidden="true">
      <i class="wb wb-r" />
      <i class="wb wb-y" />
      <i class="wb wb-b"><Wordmark /></i>
    </div>
  );
}
