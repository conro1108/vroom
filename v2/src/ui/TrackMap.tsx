// A track's real outline, drawn on as it appears. Takes a shape or a def to look up.
import type { TrackDef } from "../sim/course";
import { useShape, type Shape } from "./shapes";

function Outline({ s, draw }: { s: Shape; draw?: boolean }) {
  const [x, y, h] = s.start;
  const [nx, ny] = [-Math.sin(h) * 5, Math.cos(h) * 5];
  return (
    <>
      <path class="tm-under" d={s.d} />
      <path class={draw ? "tm-line tm-draw" : "tm-line"} d={s.d} pathLength={1} />
      <line class="tm-start" x1={x - nx} y1={y - ny} x2={x + nx} y2={y + ny} />
    </>
  );
}

export function TrackMap({ shape, draw }: { shape: Shape; draw?: boolean }) {
  return (
    <svg class="trackmap" viewBox="0 0 100 100" aria-hidden="true">
      <Outline s={shape} draw={draw} />
    </svg>
  );
}

export function DefMap({ def, draw }: { def: TrackDef; draw?: boolean }) {
  const s = useShape(def);
  return (
    <svg class="trackmap" viewBox="0 0 100 100" aria-hidden="true">
      {s && <Outline s={s} draw={draw} />}
    </svg>
  );
}
