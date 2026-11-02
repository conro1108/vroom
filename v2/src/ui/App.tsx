// The front end's root: picks the layer for the current phase and lets the old one
// slam out before the new one slams in. Screens are separate files; the HUD renders
// through refs, so nothing here re-renders while racing.
import { useEffect, useState } from "preact/hooks";
import { paused, phase, type Game, type Phase } from "../app/game";
import { Cups } from "./Cups";
import { DevPanel } from "./DevPanel";
import { Finish } from "./Finish";
import { Hud } from "./Hud";
import { Intro } from "./Intro";
import { Pause } from "./Pause";
import { Podium } from "./Podium";
import { Results } from "./Results";
import { Title } from "./Title";
import { Wipe, wipeState } from "./wipe";

const OUT_MS = 170;
const layerOf = (p: Phase) => (p === "countdown" || p === "racing" ? "race" : p);
type Layer = ReturnType<typeof layerOf>;

function useLayer(): [Layer, boolean] {
  const want = layerOf(phase.value);
  const [shown, setShown] = useState<Layer>(want);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (want === shown) return;
    // under a wipe nobody can see the exit, so don't spend time on one
    if (wipeState.value !== "idle") {
      setShown(want);
      return;
    }
    setLeaving(true);
    const t = setTimeout(() => {
      setShown(want);
      setLeaving(false);
    }, OUT_MS);
    return () => clearTimeout(t);
  }, [want, shown]);
  return [shown, leaving];
}

export function App({ game }: { game: Game }) {
  const [layer, leaving] = useLayer();

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p") {
        if (paused.value) game.resume();
        else game.pause();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        document.querySelector<HTMLElement>("[data-primary]")?.click();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [game]);

  return (
    <>
      <div class={leaving ? "layer leaving" : "layer"} key={layer}>
        {layer === "title" && <Title game={game} />}
        {layer === "cups" && <Cups game={game} />}
        {layer === "intro" && <Intro game={game} />}
        {layer === "race" && <Hud game={game} />}
        {layer === "finish" && <Finish game={game} />}
        {layer === "results" && <Results game={game} />}
        {layer === "podium" && <Podium game={game} />}
      </div>
      {paused.value && <Pause game={game} />}
      <Wipe />
      <DevPanel />
    </>
  );
}
