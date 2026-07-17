// Splash menu: pick a speed class, pick a vehicle, then pick where to race
// on the progression map — a hand-drawn graph of cup nodes joined by dashed
// trails. Paths branch, converge, and skip; a node unlocks when any trail
// into it is earned (podium or win, per the CUPS catalog).
import { CUPS, cupById, type CupDef } from "../game/cups";
import {
  bestCupPlacement,
  isCupUnlocked,
  PODIUM_PLACEMENT,
  saveProgress,
  SPEED_CLASSES,
  type Progress,
} from "../game/progression";
import { trackDefById } from "../game/tracks";
import { saveTuning, type Tuning } from "../game/tuning";
import { applyVehicle, CUSTOM_VEHICLE_ID, loadCustomVehicle, resetCustomVehicle, VEHICLES } from "../game/vehicles";
import { drawMap, vehicleSprite } from "../render/sprites";
import { ordinal } from "./hud";
import { iconEl, STAR_5, type IconName } from "./icons";

const PLACE_MEDALS: IconName[] = ["medal1", "medal2", "medal3"];

// Logical map size; the canvas and % -positioned nodes scale together.
const MAP_W = 440;
const MAP_H = 400;

function ruleSatisfied(progress: Progress, classId: string, rule: { cup: string; result: string }): boolean {
  const best = bestCupPlacement(progress, classId, rule.cup);
  if (best === null) return false;
  return rule.result === "win" ? best === 1 : best <= PODIUM_PLACEMENT;
}

/** Dashed trails between cup nodes; earned trails draw darker. */
function paintTrails(canvas: HTMLCanvasElement, progress: Progress, classId: string): void {
  const dpr = 2;
  canvas.width = MAP_W * dpr;
  canvas.height = MAP_H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // parchment blotches so the map doesn't read as flat fill
  for (let y = 0; y < MAP_H; y += 12) {
    for (let x = 0; x < MAP_W; x += 12) {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = (h ^ (h >>> 13)) | 0;
      h = Math.imul(h, 1274126177);
      if (((h ^ (h >>> 16)) >>> 0) / 4294967296 < 0.16) {
        ctx.fillStyle = "rgba(90, 70, 50, 0.045)";
        ctx.fillRect(x, y, 12, 12);
      }
    }
  }

  CUPS.forEach((cup, ci) => {
    (cup.unlock ?? []).forEach((rule, ri) => {
      const from = cupById(rule.cup).map;
      const to = cup.map;
      const x1 = from.x * MAP_W;
      const y1 = from.y * MAP_H;
      const x2 = to.x * MAP_W;
      const y2 = to.y * MAP_H;
      // bow each trail out perpendicular a little so parallel routes separate
      const bulge = ((ci + ri) % 2 === 0 ? 1 : -1) * 26;
      const nx = -(y2 - y1);
      const ny = x2 - x1;
      const nl = Math.hypot(nx, ny) || 1;
      const mx = (x1 + x2) / 2 + (nx / nl) * bulge;
      const my = (y1 + y2) / 2 + (ny / nl) * bulge;

      const earned = ruleSatisfied(progress, classId, rule);
      const sourceOpen = isCupUnlocked(progress, classId, rule.cup);
      ctx.strokeStyle = earned
        ? "rgba(138, 90, 51, 0.9)"
        : sourceOpen
          ? "rgba(138, 90, 51, 0.38)"
          : "rgba(138, 90, 51, 0.16)";
      ctx.lineWidth = earned ? 3 : 2.5;
      ctx.setLineDash([1, 7]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();

      // a win-gated trail gets a little star at its midpoint — drawn as a
      // pixel map (2px cells), never fillText: glyphs anti-alias off the grid
      if (rule.result === "win") {
        ctx.setLineDash([]);
        ctx.fillStyle = earned ? "#e0532f" : "rgba(138, 90, 51, 0.4)";
        const cell = 2;
        const sx = Math.round((x1 + 2 * mx + x2) / 4 - (STAR_5[0]!.length * cell) / 2);
        const sy = Math.round((y1 + 2 * my + y2) / 4 - (STAR_5.length * cell) / 2);
        for (let py = 0; py < STAR_5.length; py++) {
          for (let px = 0; px < STAR_5[py]!.length; px++) {
            if (STAR_5[py]![px] !== ".") ctx.fillRect(sx + px * cell, sy + py * cell, cell, cell);
          }
        }
      }
    });
  });
}

function unlockHint(cup: CupDef): string {
  const rules = cup.unlock ?? [];
  return rules
    .map((r) => `${r.result === "win" ? "win" : "podium"} ${cupById(r.cup).name.replace(" Cup", "")}`)
    .join(" or ");
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
  tuning: Tuning,
  onStart: (cupId: string, classId: string, startTrackIndex?: number) => void
): Menu {
  const root = document.getElementById("menu")!;

  // Solo is per-track practice, so tapping a cup opens a picker for its four
  // tracks (start wherever you like) rather than committing to the full series.
  const openTrackPicker = (mapWrap: HTMLElement, cup: CupDef, classId: string): void => {
    mapWrap.querySelector(".track-picker")?.remove();
    const picker = document.createElement("div");
    picker.className = "track-picker";

    const heading = document.createElement("div");
    heading.className = "track-picker-title";
    heading.append(iconEl(cup.icon as IconName), ` ${cup.name}`);
    const hint = document.createElement("div");
    hint.className = "track-picker-sub";
    hint.textContent = "pick a track";
    picker.append(heading, hint);

    const list = document.createElement("div");
    list.className = "track-picker-list";
    cup.trackIds.forEach((trackId, i) => {
      const btn = document.createElement("button");
      btn.className = "track-pick-btn";
      btn.textContent = trackDefById(trackId).name;
      btn.addEventListener("click", () => onStart(cup.id, classId, i));
      list.appendChild(btn);
    });
    picker.appendChild(list);

    const back = document.createElement("button");
    back.className = "track-picker-back";
    back.textContent = "← back";
    back.addEventListener("click", () => picker.remove());
    picker.appendChild(back);

    mapWrap.appendChild(picker);
  };

  const render = () => {
    // the vehicle row scrolls sideways; keep its position across re-renders
    const vehicleScroll = root.querySelector(".vehicle-row")?.scrollLeft ?? 0;
    root.innerHTML = "";

    const title = document.createElement("h1");
    title.className = "menu-title";
    title.textContent = "vroom";
    const sub = document.createElement("div");
    sub.className = "menu-sub";
    sub.textContent = "one thumb. four tracks. go.";
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
      const wrap = document.createElement("div");
      wrap.className = "vehicle-tile-wrap";
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
      const revertBtn = document.createElement("button");
      revertBtn.className = "vehicle-revert";
      revertBtn.textContent = "↺";
      revertBtn.setAttribute("aria-label", `reset ${vehicle.name} to its base stats`);
      revertBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // dev-panel sliders fine-tune the shared tuning object live, so a
        // vehicle's stats can drift from its own definition even while it's
        // the active one — this snaps just its fields back, same values a
        // fresh selection would apply.
        applyVehicle(tuning, vehicle);
        saveTuning(tuning);
        render();
      });
      wrap.append(tile, revertBtn);
      vehicleRow.appendChild(wrap);
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
    // independent toggles. Only group cups count toward placement-gated
    // unlocks — solo is practice against your own ghosts.
    const modeRow = document.createElement("div");
    modeRow.className = "mode-row";
    const modes: { id: "group" | "solo"; icon: IconName; label: string }[] = [
      { id: "group", icon: "flag", label: "group" },
      { id: "solo", icon: "ghost", label: "solo" },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.className = "mode-btn" + (progress.raceMode === m.id ? " active" : "");
      btn.append(iconEl(m.icon), ` ${m.label}`);
      btn.addEventListener("click", () => {
        progress.raceMode = m.id;
        saveProgress(progress);
        render();
      });
      modeRow.appendChild(btn);
    }
    root.appendChild(modeRow);

    // the progression map
    const mapWrap = document.createElement("div");
    mapWrap.className = "map-wrap";
    const trails = document.createElement("canvas");
    trails.className = "map-canvas";
    paintTrails(trails, progress, progress.lastClass);
    mapWrap.appendChild(trails);

    for (const cup of CUPS) {
      const unlocked = isCupUnlocked(progress, progress.lastClass, cup.id);
      const node = document.createElement("button");
      node.className = "cup-node" + (unlocked ? "" : " locked");
      node.disabled = !unlocked;
      node.style.left = `${cup.map.x * 100}%`;
      node.style.top = `${cup.map.y * 100}%`;

      const icon = document.createElement("div");
      icon.className = "cup-icon";
      icon.appendChild(iconEl(cup.icon as IconName, "p3"));
      const name = document.createElement("div");
      name.className = "cup-name";
      name.textContent = cup.name;
      const subLine = document.createElement("div");
      subLine.className = "cup-sub";
      if (unlocked) {
        const best = bestCupPlacement(progress, progress.lastClass, cup.id);
        subLine.textContent = best === null ? "4 tracks" : `best · ${ordinal(best)}`;
      } else {
        subLine.textContent = unlockHint(cup);
      }
      node.append(icon, name, subLine);

      if (!unlocked) {
        const lock = document.createElement("div");
        lock.className = "cup-lock";
        lock.appendChild(iconEl("lock"));
        node.appendChild(lock);
      } else {
        const best = bestCupPlacement(progress, progress.lastClass, cup.id);
        if (best !== null && best <= 3) {
          const medal = document.createElement("div");
          medal.className = "cup-medal";
          medal.appendChild(iconEl(PLACE_MEDALS[best - 1]!, "p15"));
          node.appendChild(medal);
        }
      }

      node.addEventListener("click", () => {
        if (!unlocked) return;
        if (progress.raceMode === "solo") openTrackPicker(mapWrap, cup, progress.lastClass);
        else onStart(cup.id, progress.lastClass);
      });
      mapWrap.appendChild(node);
    }
    root.appendChild(mapWrap);
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
