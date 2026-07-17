// Splash menu: pick a speed class, pick a vehicle, pick a track. Each track
// tile shows a minimap, its course records for the selected class, and a lock
// when the previous track's race hasn't been finished in that class.
import { isTrackUnlocked, saveProgress, SPEED_CLASSES, type Progress } from "../game/progression";
import { getRecords, type Records } from "../game/records";
import { createTrack, type TrackDef } from "../game/track";
import { TRACKS } from "../game/tracks";
import { saveTuning, type Tuning } from "../game/tuning";
import { applyVehicle, VEHICLES } from "../game/vehicles";
import { drawMap, vehicleSprite } from "../render/sprites";
import { formatTime } from "./hud";

const MINIMAP_W = 132;
const MINIMAP_H = 84;

/** Tiny centerline drawing of a track, letterboxed into a fixed-size canvas. */
function minimap(def: TrackDef): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "track-map";
  const dpr = 2;
  canvas.width = MINIMAP_W * dpr;
  canvas.height = MINIMAP_H * dpr;
  const ctx = canvas.getContext("2d")!;

  const samples = createTrack(def).samples;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of samples) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 10 * dpr;
  const scale = Math.min(
    (canvas.width - pad * 2) / (maxX - minX),
    (canvas.height - pad * 2) / (maxY - minY)
  );
  const ox = (canvas.width - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (canvas.height - (maxY - minY) * scale) / 2 - minY * scale;

  ctx.lineJoin = ctx.lineCap = "round";
  for (const pass of [
    { width: 9 * dpr, color: "#b5975f" },
    { width: 6 * dpr, color: "#d9c08f" },
  ]) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.width;
    ctx.beginPath();
    samples.forEach((p, i) => {
      const x = p.x * scale + ox;
      const y = p.y * scale + oy;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  // start marker
  const s = samples[0]!;
  ctx.fillStyle = "#4a3728";
  ctx.beginPath();
  ctx.arc(s.x * scale + ox, s.y * scale + oy, 3 * dpr, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

/** Pixel-art portrait of a vehicle, drawn 1:1 and scaled up crisply by CSS. */
function vehiclePortrait(id: string): HTMLCanvasElement {
  const sprite = vehicleSprite(id);
  const canvas = document.createElement("canvas");
  canvas.className = "vehicle-sprite";
  canvas.width = sprite.map[0]!.length;
  canvas.height = sprite.map.length;
  drawMap(canvas.getContext("2d")!, sprite.map, sprite.palette, 0, 0);
  return canvas;
}

export interface Menu {
  show(): void;
  hide(): void;
}

export function createMenu(
  progress: Progress,
  records: Records,
  tuning: Tuning,
  onStart: (trackIndex: number, classId: string) => void
): Menu {
  const root = document.getElementById("menu")!;

  const render = () => {
    // the vehicle row scrolls sideways; keep its position across re-renders
    const vehicleScroll = root.querySelector(".vehicle-row")?.scrollLeft ?? 0;
    root.innerHTML = "";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "vroom";
    const sub = document.createElement("div");
    sub.className = "menu-sub";
    sub.textContent = "one thumb. three laps. go.";
    root.append(title, sub);

    // speed class picker
    const classRow = document.createElement("div");
    classRow.className = "class-row";
    for (const cls of SPEED_CLASSES) {
      const btn = document.createElement("button");
      btn.className = "class-btn" + (cls.id === progress.lastClass ? " active" : "");
      btn.textContent = cls.label;
      btn.addEventListener("click", () => {
        progress.lastClass = cls.id;
        saveProgress(progress);
        render();
      });
      classRow.appendChild(btn);
    }
    root.appendChild(classRow);

    // vehicle picker: selecting one writes its handling into the live tuning
    const vehicleRow = document.createElement("div");
    vehicleRow.className = "vehicle-row";
    for (const vehicle of VEHICLES) {
      const tile = document.createElement("button");
      tile.className = "vehicle-tile" + (vehicle.id === progress.lastVehicle ? " active" : "");
      tile.appendChild(vehiclePortrait(vehicle.id));
      const name = document.createElement("div");
      name.className = "vehicle-name";
      name.textContent = vehicle.name;
      const blurb = document.createElement("div");
      blurb.className = "vehicle-blurb";
      blurb.textContent = vehicle.blurb;
      tile.append(name, blurb);
      tile.addEventListener("click", () => {
        progress.lastVehicle = vehicle.id;
        saveProgress(progress);
        applyVehicle(tuning, vehicle);
        saveTuning(tuning);
        render();
      });
      vehicleRow.appendChild(tile);
    }
    root.appendChild(vehicleRow);
    vehicleRow.scrollLeft = vehicleScroll;

    // ghost toggle
    const ghostBtn = document.createElement("button");
    ghostBtn.className = "ghost-toggle" + (tuning.showGhost ? " on" : "");
    ghostBtn.textContent = tuning.showGhost ? "👻 ghost on" : "👻 ghost off";
    ghostBtn.addEventListener("click", () => {
      tuning.showGhost = !tuning.showGhost;
      saveTuning(tuning);
      render();
    });
    root.appendChild(ghostBtn);

    // track grid
    const grid = document.createElement("div");
    grid.className = "track-grid";
    TRACKS.forEach((def, index) => {
      const unlocked = isTrackUnlocked(progress, progress.lastClass, index);
      const tile = document.createElement("button");
      tile.className = "track-tile" + (unlocked ? "" : " locked");
      tile.disabled = !unlocked;

      tile.appendChild(minimap(def));

      const name = document.createElement("div");
      name.className = "track-name";
      name.textContent = `${index + 1}. ${def.name}`;
      tile.appendChild(name);

      const recs = document.createElement("div");
      recs.className = "track-records";
      if (unlocked) {
        const r = getRecords(records, def.id, progress.lastClass);
        recs.textContent =
          r.bestRaceMs === null && r.bestLapMs === null
            ? "no records yet"
            : `race ${r.bestRaceMs === null ? "—" : formatTime(r.bestRaceMs)} · lap ${
                r.bestLapMs === null ? "—" : formatTime(r.bestLapMs)
              }`;
      } else {
        recs.textContent = `finish ${TRACKS[index - 1]!.name} to unlock`;
      }
      tile.appendChild(recs);

      if (!unlocked) {
        const lock = document.createElement("div");
        lock.className = "track-lock";
        lock.textContent = "🔒";
        tile.appendChild(lock);
      }

      tile.addEventListener("click", () => {
        if (unlocked) onStart(index, progress.lastClass);
      });
      grid.appendChild(tile);
    });
    root.appendChild(grid);
  };

  return {
    show() {
      render();
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
  };
}
