// Splash menu: pick a speed class, pick a vehicle, pick a track. Each track
// tile shows a minimap, its course records for the selected class, and a lock
// when the previous track's race hasn't been finished in that class.
import { isTrackUnlocked, saveProgress, SPEED_CLASSES, type Progress } from "../game/progression";
import { getRecords, type Records } from "../game/records";
import { createTrack, type TrackDef } from "../game/track";
import { trackDefById, TRACKS } from "../game/tracks";
import { saveTuning, type Tuning } from "../game/tuning";
import { applyVehicle, CUSTOM_VEHICLE_ID, loadCustomVehicle, resetCustomVehicle, VEHICLES } from "../game/vehicles";
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

    // custom car: one persisted, user-respec'd slot kept apart from the base
    // vehicles above. Calibration (in the dev panel) writes into it.
    const customWrap = document.createElement("div");
    customWrap.className = "vehicle-tile-wrap";
    const customVehicle = loadCustomVehicle();
    const customTile = document.createElement("button");
    customTile.className =
      "vehicle-tile custom-vehicle-tile" +
      (progress.lastVehicle === CUSTOM_VEHICLE_ID ? " active" : "");
    customTile.appendChild(vehiclePortrait(customVehicle.id));
    const customName = document.createElement("div");
    customName.className = "vehicle-name";
    customName.textContent = customVehicle.name;
    const customBlurb = document.createElement("div");
    customBlurb.className = "vehicle-blurb";
    customBlurb.textContent = customVehicle.blurb;
    customTile.append(customName, customBlurb);
    customTile.addEventListener("click", () => {
      progress.lastVehicle = CUSTOM_VEHICLE_ID;
      saveProgress(progress);
      applyVehicle(tuning, customVehicle);
      saveTuning(tuning);
      render();
    });
    const revertBtn = document.createElement("button");
    revertBtn.className = "vehicle-revert";
    revertBtn.textContent = "↺";
    revertBtn.setAttribute("aria-label", "revert custom car to starting point");
    revertBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const reset = resetCustomVehicle();
      if (progress.lastVehicle === CUSTOM_VEHICLE_ID) {
        applyVehicle(tuning, reset);
        saveTuning(tuning);
      }
      render();
    });
    customWrap.append(customTile, revertBtn);
    vehicleRow.appendChild(customWrap);

    root.appendChild(vehicleRow);
    vehicleRow.scrollLeft = vehicleScroll;

    // solo (ghost) vs group (AI opponents): a binary switch, not two
    // independent toggles. Only group races count toward placement-gated
    // track unlocks — solo is practice against your own ghost.
    const modeRow = document.createElement("div");
    modeRow.className = "mode-row";
    const modes: { id: "group" | "solo"; label: string }[] = [
      { id: "group", label: "🏁 group" },
      { id: "solo", label: "👻 solo" },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.className = "mode-btn" + (progress.raceMode === m.id ? " active" : "");
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        progress.raceMode = m.id;
        saveProgress(progress);
        render();
      });
      modeRow.appendChild(btn);
    }
    root.appendChild(modeRow);

    // track grid
    const grid = document.createElement("div");
    grid.className = "track-grid";
    TRACKS.forEach((def, index) => {
      const unlocked = isTrackUnlocked(progress, progress.lastClass, index);
      const tile = document.createElement("button");
      tile.className = "track-tile" + (unlocked ? "" : " locked");
      tile.disabled = !unlocked;

      tile.appendChild(minimap(def));

      const bonus = def.unlock?.result === "win";
      const name = document.createElement("div");
      name.className = "track-name";
      name.textContent = bonus ? `★ ${def.name}` : `${index + 1}. ${def.name}`;
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
        const rule = def.unlock!;
        const verb = rule.result === "win" ? "win" : "podium at";
        recs.textContent = `${verb} ${trackDefById(rule.track).name} to unlock`;
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
