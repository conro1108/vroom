// Post-race results card: this race's placement and splits, the running cup
// standings, record callouts, and — after the last race — the cup verdict
// with any unlock notices. Mid-series there is no retry (points are already
// on the board); solo runs and finished cups can restart freely.
import { formatTime, ordinal } from "./hud";

export interface StandingRow {
  name: string;
  total: number;
  gained: number; // points earned in the race just finished
  you: boolean;
}

export interface ResultsData {
  trackName: string;
  classLabel: string;
  seriesName: string;
  raceNumber: number; // 1-based within the cup
  racesTotal: number;
  placement: number; // 1-based finish position this race
  racerCount: number;
  solo: boolean; // no field to place against — skip placement language
  splits: number[];
  totalMs: number;
  bestSplitIndex: number;
  newBestLap: boolean;
  newBestRace: boolean;
  standings: StandingRow[];
  cupPlacement: number | null; // set only after the final race of a group cup
  unlockedNames: string[];
  hasNext: boolean; // more races left in this cup
}

export interface ResultsHandlers {
  onAgain(): void;
  onNext(): void;
  onMenu(): void;
}

export function showResults(data: ResultsData, handlers: ResultsHandlers): void {
  const root = document.getElementById("results")!;
  root.innerHTML = "";

  const card = document.createElement("div");
  card.className = "results-card";

  const final = data.cupPlacement !== null;
  const flag = document.createElement("div");
  flag.className = "results-flag";
  flag.textContent = data.solo
    ? "🏁"
    : final
      ? data.cupPlacement === 1
        ? "🏆"
        : data.cupPlacement! <= 3
          ? "🎖️"
          : "💨"
      : data.placement === 1
        ? "🥇"
        : data.placement <= 3
          ? "🏁"
          : "💨";
  const title = document.createElement("h2");
  title.textContent = data.solo
    ? final || !data.hasNext
      ? "course complete"
      : "run complete"
    : final
      ? data.cupPlacement === 1
        ? `you win the ${data.seriesName}!`
        : `${ordinal(data.cupPlacement!)} in the ${data.seriesName}`
      : data.placement === 1
        ? "you win the race!"
        : `${ordinal(data.placement)} this race`;
  const sub = document.createElement("div");
  sub.className = "results-sub";
  sub.textContent = `${data.trackName} · race ${data.raceNumber}/${data.racesTotal} · ${data.seriesName} · ${data.classLabel}`;
  card.append(flag, title, sub);

  const table = document.createElement("div");
  table.className = "results-splits";
  data.splits.forEach((ms, i) => {
    const row = document.createElement("div");
    row.className = "split-row" + (i === data.bestSplitIndex ? " best" : "");
    const label = document.createElement("span");
    label.textContent = `lap ${i + 1}`;
    const time = document.createElement("span");
    time.textContent = formatTime(ms) + (i === data.bestSplitIndex ? " ◆" : "");
    row.append(label, time);
    table.appendChild(row);
  });
  const totalRow = document.createElement("div");
  totalRow.className = "split-row total";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = "total";
  const totalTime = document.createElement("span");
  totalTime.textContent = formatTime(data.totalMs);
  totalRow.append(totalLabel, totalTime);
  table.appendChild(totalRow);
  card.appendChild(table);

  if (data.standings.length > 0) {
    const standings = document.createElement("div");
    standings.className = "results-standings";
    const header = document.createElement("div");
    header.className = "standings-title";
    header.textContent = final ? "final standings" : "cup standings";
    standings.appendChild(header);
    data.standings.forEach((row, i) => {
      const el = document.createElement("div");
      el.className = "standings-row" + (row.you ? " you" : "");
      const place = document.createElement("span");
      place.className = "standings-place";
      place.textContent = final && i < 3 ? ["🥇", "🥈", "🥉"][i]! : `${i + 1}.`;
      const name = document.createElement("span");
      name.className = "standings-name";
      name.textContent = row.name;
      const pts = document.createElement("span");
      pts.className = "standings-pts";
      pts.textContent = final ? `${row.total} pts` : `+${row.gained} · ${row.total} pts`;
      el.append(place, name, pts);
      standings.appendChild(el);
    });
    card.appendChild(standings);
  }

  const badges: string[] = [];
  if (data.newBestRace) badges.push("★ new course record");
  if (data.newBestLap) badges.push("★ new best lap");
  for (const name of data.unlockedNames) badges.push(`🔓 ${name} unlocked`);
  for (const text of badges) {
    const badge = document.createElement("div");
    badge.className = "results-badge";
    badge.textContent = text;
    card.appendChild(badge);
  }

  const buttons = document.createElement("div");
  buttons.className = "results-buttons";
  const add = (text: string, cb: () => void, primary = false) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (primary) btn.className = "primary";
    btn.addEventListener("click", cb);
    buttons.appendChild(btn);
  };
  // mid-series group races can't be re-run — their points are already scored
  if (data.solo || !data.hasNext) add(data.hasNext ? "again" : "run it back", handlers.onAgain);
  if (data.hasNext) add("next race", handlers.onNext, true);
  add("menu", handlers.onMenu);
  card.appendChild(buttons);

  root.appendChild(card);
  root.hidden = false;
}

export function hideResults(): void {
  document.getElementById("results")!.hidden = true;
}
