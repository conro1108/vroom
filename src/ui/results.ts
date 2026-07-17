// Post-race results card: placement, lap splits, race total, record
// callouts, and unlock notices, with the "what next" buttons.
import { formatTime, ordinal } from "./hud";

export interface ResultsData {
  trackName: string;
  classLabel: string;
  placement: number; // 1-based finish position
  racerCount: number;
  solo: boolean; // no field to place against — skip placement language
  splits: number[];
  totalMs: number;
  bestSplitIndex: number;
  newBestLap: boolean;
  newBestRace: boolean;
  unlockedNames: string[];
  hasNext: boolean; // a next track exists and is unlocked
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

  const flag = document.createElement("div");
  flag.className = "results-flag";
  flag.textContent = data.solo ? "🏁" : data.placement === 1 ? "🏆" : data.placement <= 3 ? "🏁" : "💨";
  const title = document.createElement("h2");
  title.textContent = data.solo
    ? "lap complete"
    : data.placement === 1
      ? "you win!"
      : `${ordinal(data.placement)} of ${data.racerCount}`;
  const sub = document.createElement("div");
  sub.className = "results-sub";
  sub.textContent = `${data.trackName} · ${data.classLabel}`;
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
  add("again", handlers.onAgain);
  if (data.hasNext) add("next track", handlers.onNext, true);
  add("menu", handlers.onMenu);
  card.appendChild(buttons);

  root.appendChild(card);
  root.hidden = false;
}

export function hideResults(): void {
  document.getElementById("results")!.hidden = true;
}
