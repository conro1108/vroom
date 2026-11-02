import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/700.css";
import { render } from "preact";
import { Game, phase } from "./app/game";
import { TUNING } from "./sim/tuning";
import { App } from "./ui/App";
import "./ui/style.css";

// iOS ignores user-scalable=no; these are what actually stop pinch and double-tap zoom.
for (const type of ["gesturestart", "gesturechange", "dblclick"]) {
  addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

const game = new Game(document.getElementById("world") as HTMLCanvasElement);
Object.assign(window, { __game: game, __tuning: TUNING, __phase: phase });
render(<App game={game} />, document.getElementById("ui")!);

// ?track=id jumps straight into a race; &auto=1 lets the bot drive it. Screenshots
// and on-device checks go through these rather than through the menus.
const q = new URLSearchParams(location.search);
const track = q.get("track");
if (track) {
  game.startRace(track, q.has("auto"));
  if (q.has("skip")) game.skipIntro();
} else {
  game.showcase();
}
