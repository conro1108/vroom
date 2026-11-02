// The card over the flyover: where you are in the cup and what this track is.
import { course, cupIndex, raceIndex, type Game } from "../app/game";
import { CUPS } from "../tracks";
import { cupVars } from "./look";
import { shapeOf } from "./shapes";
import { TrackMap } from "./TrackMap";

export function Intro({ game }: { game: Game }) {
  const c = course.value;
  if (!c) return null;
  const cup = CUPS[cupIndex.value]!;
  return (
    <div class="intro" style={cupVars(cup)} onClick={() => game.skipIntro()}>
      <div class="in-card">
        <div class="in-kick"><b>{cup.name}</b><span>RACE {raceIndex.value + 1} OF {cup.tracks.length}</span></div>
        <div class="in-main">
          <div class="in-text">
            <h1>{c.def.name}</h1>
            <p>{c.def.blurb}</p>
            <div class="in-stats">
              <span><b>{c.def.laps ?? 3}</b> LAPS</span>
              <span><b>{(c.length / 1000).toFixed(1)}</b> KM</span>
            </div>
          </div>
          <div class="in-map"><TrackMap shape={shapeOf(c)} draw /></div>
        </div>
      </div>
      <div class="in-skip">TAP TO SKIP</div>
    </div>
  );
}
