import "./style.css";
import {
  createGhostRecorder,
  finishGhostLap,
  ghostAt,
  loadGhosts,
  recordGhostSample,
  saveGhosts,
  type GhostLap,
  type GhostRecorder,
} from "./game/ghost";
import { choose, createCalibration, skipAxis, variantTuning, type Calibration } from "./game/calibrate";
import { createDraft, inSlipstream, stepDraft } from "./game/draft";
import {
  createItemRacer,
  createItemWorld,
  ITEM_GAP_WINDOW,
  SPIN_INPUT,
  spinCar,
  stepItems,
  useItem,
  type ItemRacer,
  type ItemWorld,
} from "./game/items";
import {
  createCupState,
  cupById,
  cupStandings,
  playerCupPlacement,
  RACES_PER_CUP,
  recordCupRace,
  startingGrid,
  type CupDef,
  type CupState,
} from "./game/cups";
import {
  buildRoster,
  createOpponents,
  gridColumns,
  gridSlot,
  playerPosition,
  raceDistance,
  separateCars,
  stepOpponents,
  type Opponent,
} from "./game/opponents";
import { createCarState, stepCar } from "./game/physics";
import {
  applySpeedClass,
  loadProgress,
  recordCupResult,
  RACE_LAPS,
  resetProgress,
  saveProgress,
  speedClassById,
  type SpeedClass,
} from "./game/progression";
import { bestSplitIndex, completeLap, createRace, raceTotalMs, rocketStart, type RaceState } from "./game/race";
import { applyLap, applyRace, getRecords, loadRecords, recordKey, saveRecords } from "./game/records";
import {
  createLapTracker,
  createTrack,
  createTrackQuery,
  fenceCar,
  updateLap,
  type LapTracker,
  type Track,
  type TrackQuery,
} from "./game/track";
import { trackDefById, TRACKS } from "./game/tracks";
import { loadTuning, saveTuning } from "./game/tuning";
import { CUSTOM_VEHICLE_ID, saveCustomVehicle, vehicleById } from "./game/vehicles";
import { Scene, type RacerPose } from "./render/scene";
import { themeById } from "./render/themes";
import { createCalibrateUi } from "./ui/calibrate";
import { createDevPanel } from "./ui/devpanel";
import { createHud } from "./ui/hud";
import { createInput } from "./ui/input";
import { createMenu } from "./ui/menu";
import { createMinimap } from "./ui/minimap";
import { hideResults, showResults } from "./ui/results";

const PHYSICS_DT = 1 / 120; // fixed step so feel doesn't vary with frame rate
const WALL_MARGIN = 14;
const WALL_BOUNCE = -0.3;
const COUNTDOWN_BEAT_MS = 800; // 3 · 2 · 1 · go
const GO_FLASH_MS = 650;
const FINISH_HOLD_MS = 600; // let the car visibly cross the line before results pop

const canvas = document.getElementById("game") as HTMLCanvasElement;
const tuning = loadTuning();
const progress = loadProgress();
const records = loadRecords();
const input = createInput(canvas, tuning);
const hud = createHud();
const minimap = createMinimap();
createDevPanel(
  tuning,
  () => startCalibration(),
  () => {
    resetProgress();
    location.reload(); // simplest clean slate: rebuild menu + state from the wiped save
  }
);

type Mode = "menu" | "countdown" | "racing" | "finished" | "calibrating";
let mode: Mode = "menu";
let cup: CupDef = cupById(progress.lastCup);
let series: CupState | null = null; // the running 4-track cup series
let cls: SpeedClass = speedClassById(progress.lastClass);
let track: Track | null = null;
let query: TrackQuery | null = null;
let scene: Scene | null = null;
let car = createCarState(0, 0, 0);
let lapTracker: LapTracker = createLapTracker(0);
let race: RaceState = createRace(RACE_LAPS);
let raceHadBestLap = false;
let lapStart = performance.now();
let finishPending = false;
let finishAt = 0;
// Player's place locked in the instant they cross the final line, so bots that
// trail across during the finish-hold window can't demote them after the fact.
let playerFinishPlace = 1;
let opponents: Opponent[] = [];
let countdownEnd = 0;
let boostTimer = 0; // seconds of player speed boost remaining (rocket start, slipstream)
let throttleHeldSince: number | null = null; // when the player committed to throttle pre-green
let playerDraft = createDraft();
let playerRacer = createItemRacer(car); // the player's item-system view (spin/boost/held)
let itemWorld: ItemWorld | null = null; // null = items off (solo mode)
let itemRacers: ItemRacer[] = []; // [player, ...opponents]
const ghosts = loadGhosts();
let ghost: GhostLap | null = null; // best lap being replayed
let ghostRec: GhostRecorder = createGhostRecorder();
let cal: Calibration | null = null;
let calVariant: "a" | "b" = "a";

const menu = createMenu(progress, tuning, (cupId, classId, startTrackIndex) => {
  startCup(cupId, classId, startTrackIndex);
});

// --- feel calibration: free-drive A/B taste test on the first track ---

const calUi = createCalibrateUi({
  onVariant(which) {
    calVariant = which;
    if (cal) calUi.update(cal, calVariant);
  },
  onPick() {
    if (!cal) return;
    choose(cal, calVariant);
    afterCalStep();
  },
  onSkip() {
    if (!cal) return;
    skipAxis(cal);
    afterCalStep();
  },
  onQuit() {
    hud.toast("calibration discarded");
    goToMenu();
  },
  onApply() {
    if (!cal) return;
    saveCustomVehicle(cal.values);
    Object.assign(tuning, cal.values);
    saveTuning(tuning);
    progress.lastVehicle = CUSTOM_VEHICLE_ID;
    saveProgress(progress);
    hud.toast("saved to your custom car");
    goToMenu();
  },
  onDiscard() {
    hud.toast("calibration discarded");
    goToMenu();
  },
});

function afterCalStep(): void {
  if (!cal) return;
  if (cal.done) {
    calUi.showConfirm();
    return;
  }
  calVariant = "a";
  calUi.update(cal, calVariant);
}

/** Drive the calibration course (track 1) with the A/B overlay up. */
function startCalibration(): void {
  const def = TRACKS[0]!;
  series = null;
  track = createTrack(def);
  query = createTrackQuery(track);
  scene = new Scene(track, query, canvas, progress.lastVehicle, corridorPx());
  minimap.setTrack(track);
  car = createCarState(track.start.x, track.start.y, track.startHeading);
  opponents = [];
  cal = createCalibration(tuning);
  calVariant = "a";
  scene.centerOn(car);
  scene.clearMarks();
  menu.hide();
  hideResults();
  calUi.show(cal, calVariant);
  mode = "calibrating";
}

/**
 * Begin a cup: fix the bot roster for the whole series, then race a track.
 * Group always starts at track 1; solo may pick any track in the cup to
 * practice, so `startTrackIndex` seeds where the series begins.
 */
function startCup(cupId: string, classId: string, startTrackIndex = 0): void {
  cup = cupById(cupId);
  cls = speedClassById(classId);
  progress.lastClass = classId;
  progress.lastCup = cupId;
  saveProgress(progress);
  const oppCount = progress.raceMode === "group" ? Math.max(1, Math.round(tuning.opponentCount)) : 0;
  series = createCupState(cupId, oppCount > 0 ? buildRoster(progress.lastVehicle, oppCount) : []);
  startSeriesRace(startTrackIndex);
}

/** Load race `raceIndex` of the running series onto the canvas. */
function startSeriesRace(raceIndex: number): void {
  if (!series) return;
  series.raceIndex = raceIndex;
  const def = trackDefById(cup.trackIds[raceIndex]!);
  track = createTrack(def);
  query = createTrackQuery(track);
  scene = new Scene(track, query, canvas, progress.lastVehicle, corridorPx(), themeById(cup.theme));
  minimap.setTrack(track);
  hud.setBest(getRecords(records, def.id, cls.id).bestLapMs);
  menu.hide();
  hideResults();
  restartRace();
}

/** Put the field back on the grid and arm the countdown. */
function restartRace(): void {
  if (!track || !query || !scene) return;
  const roster = series?.roster ?? [];
  const columns = gridColumns(roster.length + 1);
  // grid[i] is racer i's slot (0 = pole): index 0 is the player, i+1 is
  // opponent i. Solo (no roster) just parks the player on pole.
  const grid = series && roster.length > 0 ? startingGrid(series) : [0];
  const slot = gridSlot(track, grid[0]!, columns);
  car = createCarState(slot.x, slot.y, track.startHeading);
  lapTracker = createLapTracker(query.progressAt(slot.x, slot.y) ?? 0);
  opponents =
    roster.length > 0
      ? createOpponents(track, query, roster, tuning, cls, Math.random, grid.slice(1), columns)
      : [];
  race = createRace(RACE_LAPS);
  raceHadBestLap = false;
  finishPending = false;
  playerFinishPlace = 1;
  boostTimer = 0;
  throttleHeldSince = null;
  playerDraft = createDraft();
  playerRacer = createItemRacer(car);
  if (opponents.length > 0) {
    itemWorld = createItemWorld(track, opponents.length + 1);
    itemRacers = [playerRacer, ...opponents];
  } else {
    itemWorld = null; // solo runs stay pure time trials
    itemRacers = [];
  }
  hud.setItem(null);
  countdownEnd = performance.now() + 3 * COUNTDOWN_BEAT_MS;
  lapStart = countdownEnd;
  ghost = ghosts[recordKey(track.id, cls.id)] ?? null;
  ghostRec = createGhostRecorder();
  scene.centerOn(car);
  scene.clearMarks();
  hud.setLap(1, RACE_LAPS);
  hud.setLapTime(0);
  hud.setPosition(opponents.length + 1, opponents.length + 1);
  hideResults();
  mode = "countdown";
}

function goToMenu(): void {
  mode = "menu";
  cal = null;
  calUi.hide();
  hud.countdown(null);
  hud.setItem(null);
  hideResults();
  menu.show();
}

function onLapCompleted(now: number): void {
  if (!track) return;
  const lapMs = now - lapStart;
  lapStart = now;

  if (applyLap(records, track.id, cls.id, lapMs)) {
    raceHadBestLap = true;
    hud.setBest(lapMs);
    hud.toast("new best lap!");
    // this lap is the new ghost, raced from the very next lap on
    ghost = finishGhostLap(ghostRec, lapMs, progress.lastVehicle);
    ghosts[recordKey(track.id, cls.id)] = ghost;
    saveGhosts(ghosts);
  }
  saveRecords(records);
  ghostRec = createGhostRecorder();

  if (completeLap(race, lapMs).finished) {
    if (!finishPending) {
      finishPending = true;
      playerFinishPlace = playerPosition(lapTracker, opponents);
      playerRacer.finished = true; // out of the item game once across the line
      hud.setItem(null);
      finishAt = now + FINISH_HOLD_MS;
    }
  } else {
    hud.setLap(race.lap, RACE_LAPS);
  }
}

/** Full finish order of this race: index 0 = player, i+1 = opponents[i]. */
function racePlacements(): number[] {
  const pp = playerFinishPlace;
  const botOrder = opponents
    .map((o, i) => ({ i, fin: o.finishOrder ?? Infinity, d: raceDistance(o.tracker) }))
    .sort((a, b) => a.fin - b.fin || b.d - a.d);
  const placements = new Array<number>(opponents.length + 1);
  placements[0] = pp;
  botOrder.forEach((b, rank) => {
    placements[b.i + 1] = rank + 1 >= pp ? rank + 2 : rank + 1;
  });
  return placements;
}

/** Series standings rows for the results card, best first. */
function standingsRows() {
  if (!series) return [];
  return cupStandings(series).map(({ index, points }) => ({
    name: index === 0 ? "you" : vehicleById(series!.roster[index - 1]!.vehicleId).name,
    total: points,
    gained: series!.lastRacePoints[index] ?? 0,
    you: index === 0,
  }));
}

function finishRace(): void {
  if (!track || !series) return;
  mode = "finished";
  const totalMs = raceTotalMs(race);
  const newBestRace = applyRace(records, track.id, cls.id, totalMs);
  saveRecords(records);
  const solo = series.roster.length === 0;
  const placement = playerFinishPlace;
  if (!solo) recordCupRace(series, racePlacements());
  const lastRace = series.raceIndex >= RACES_PER_CUP - 1;

  // the cup pays out (and unlocks) only when its final race is done, in group
  let cupPlacement: number | null = null;
  let unlockedNames: string[] = [];
  if (lastRace && !solo) {
    cupPlacement = playerCupPlacement(series);
    unlockedNames = recordCupResult(progress, cls.id, cup.id, cupPlacement).map((c) => c.name);
    saveProgress(progress);
  }

  const raceIndex = series.raceIndex;
  showResults(
    {
      trackName: track.name,
      classLabel: cls.label,
      seriesName: cup.name,
      raceNumber: raceIndex + 1,
      racesTotal: RACES_PER_CUP,
      placement,
      racerCount: opponents.length + 1,
      solo,
      splits: race.splits,
      totalMs,
      bestSplitIndex: bestSplitIndex(race),
      newBestLap: raceHadBestLap,
      newBestRace,
      standings: solo ? [] : standingsRows(),
      cupPlacement,
      unlockedNames,
      hasNext: !lastRace,
    },
    {
      // group's last-race "run it back" replays the whole cup; solo is
      // per-track practice, so it always just re-runs the track you're on.
      onAgain: () => (lastRace && !solo ? startCup(cup.id, cls.id) : restartRace()),
      onNext: () => startSeriesRace(raceIndex + 1),
      onMenu: () => goToMenu(),
    }
  );
}

document.getElementById("reset-btn")!.addEventListener("click", () => {
  if (mode === "calibrating" && track && scene) {
    car = createCarState(track.start.x, track.start.y, track.startHeading);
    scene.centerOn(car);
  } else if (mode !== "menu") {
    restartRace();
  }
});
document.getElementById("home-btn")!.addEventListener("click", () => {
  if (mode !== "menu") goToMenu();
});

// Drive resize off the canvas's actual box so a racy first layout can't leave
// us with a broken (garbled) buffer; also covers rotation and PWA chrome.
new ResizeObserver(() => scene?.resize()).observe(canvas);
window.addEventListener("resize", () => scene?.resize());

let last = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const frameDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  accumulator += frameDt;

  if (!scene || !track || !query) {
    accumulator = 0;
    requestAnimationFrame(loop);
    return;
  }

  // The player's feel values scaled up to the selected speed class — or the
  // active calibration variant — computed per frame so dev-panel edits keep
  // applying live mid-race.
  const raceTuning =
    mode === "calibrating" && cal ? variantTuning(cal, tuning, calVariant) : applySpeedClass(tuning, cls);

  if (mode === "countdown") {
    accumulator = 0;
    // keep the joystick visible/live so you're ready on "go" — and watch the
    // throttle so nailing the beat can be rewarded with a rocket start
    const preInput = input.read(car.heading);
    if (preInput.throttle > 0) throttleHeldSince ??= now;
    else throttleHeldSince = null;
    const remaining = countdownEnd - now;
    if (remaining <= 0) {
      mode = "racing";
      lapStart = countdownEnd; // clock starts exactly on green
      if (rocketStart(throttleHeldSince, countdownEnd, raceTuning.startBoostWindowMs)) {
        boostTimer = raceTuning.boostSeconds;
        hud.toast("rocket start!");
      }
      hud.countdown("go!");
      window.setTimeout(() => mode !== "countdown" && hud.countdown(null), GO_FLASH_MS);
    } else {
      hud.countdown(String(Math.ceil(remaining / COUNTDOWN_BEAT_MS)));
    }
  }

  if (mode === "racing" || mode === "calibrating") {
    const carInput = input.read(car.heading);
    const racing = mode === "racing";
    while (accumulator >= PHYSICS_DT) {
      accumulator -= PHYSICS_DT;
      if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - PHYSICS_DT);
      let stepTuning = raceTuning;
      if (boostTimer > 0 || playerRacer.boost > 0) {
        stepTuning = {
          ...raceTuning,
          maxSpeed: raceTuning.maxSpeed * raceTuning.boostPower,
          accel: raceTuning.accel * raceTuning.boostPower,
        };
      }
      let stepInput = carInput;
      if (playerRacer.spin > 0) {
        stepInput = SPIN_INPUT;
        spinCar(car, PHYSICS_DT);
      }
      car = stepCar(car, stepInput, stepTuning, query.surfaceAt(car.x, car.y), PHYSICS_DT);
      playerRacer.car = car;
      if (racing) {
        stepOpponents(
          opponents,
          query,
          PHYSICS_DT,
          true,
          { distance: raceDistance(lapTracker), car },
          corridorPx()
        );
        separateCars([car, ...opponents.map((o) => o.car)]);
        const drafting = opponents.some((o) =>
          inSlipstream(car, o.car, raceTuning.draftRangePx, raceTuning.maxSpeed * 0.5)
        );
        if (stepDraft(playerDraft, drafting, PHYSICS_DT, raceTuning.draftChargeSeconds)) {
          boostTimer = Math.max(boostTimer, raceTuning.draftBoostSeconds);
          hud.toast("slipstream!");
        }
        stepItemWorld();
      }
      applyWalls();
      fenceCar(car, query, corridorPx());
      if (!racing) continue;
      recordGhostSample(ghostRec, now - lapStart, car);

      const p = query.progressAt(car.x, car.y);
      if (p !== null && !finishPending && updateLap(lapTracker, p).completed) {
        onLapCompleted(now);
      }
    }
    if (racing && !finishPending) {
      hud.setLapTime(now - lapStart);
      hud.setPosition(playerPosition(lapTracker, opponents), opponents.length + 1);
    }
    if (finishPending && now >= finishAt) {
      finishPending = false;
      finishRace();
    }
  } else if (mode !== "countdown") {
    accumulator = 0;
  }

  const ghostPose =
    mode === "racing" && progress.raceMode === "solo" && ghost ? ghostAt(ghost, now - lapStart) : null;
  const racerPoses: RacerPose[] =
    mode === "racing" || mode === "countdown"
      ? opponents.map((o) => ({ x: o.car.x, y: o.car.y, heading: o.car.heading, vehicleId: o.vehicleId }))
      : [];
  scene.frame(
    frameDt,
    car,
    raceTuning,
    ghostPose,
    racerPoses,
    boostTimer > 0 || playerRacer.boost > 0,
    mode === "racing" || mode === "countdown" ? itemWorld : null
  );
  if (mode === "racing" || mode === "countdown" || mode === "calibrating") {
    minimap.render(car, opponents.map((o) => o.car));
  } else {
    minimap.hide();
  }
  requestAnimationFrame(loop);
}

/** Live standings for the item system: rank sets order, and each racer's gap
 * behind the leader (in laps) sets how mean its next pickup rolls. */
function updatePositions(): void {
  const list = [
    { r: playerRacer as ItemRacer, key: raceDistance(lapTracker), laps: raceDistance(lapTracker) },
    ...opponents.map((o) => ({
      r: o as ItemRacer,
      // finished racers rank by finish order, above everyone still driving
      key: o.finishOrder !== null ? 200 - o.finishOrder : raceDistance(o.tracker),
      laps: raceDistance(o.tracker),
    })),
  ];
  list.sort((a, b) => b.key - a.key);
  const leaderLaps = Math.max(...list.map((e) => e.laps));
  list.forEach((e, i) => {
    e.r.position = i + 1;
    e.r.deficit = Math.max(0, Math.min(1, (leaderLaps - e.laps) / ITEM_GAP_WINDOW));
  });
}

/** One physics step of items: pickups, hits, and bots deciding to fire. */
function stepItemWorld(): void {
  if (!itemWorld) return;
  updatePositions();
  for (const ev of stepItems(itemWorld, itemRacers, PHYSICS_DT)) {
    if (ev.type === "pickup") {
      if (ev.racer === 0) hud.setItem(playerRacer.held);
      else opponents[ev.racer - 1]!.itemUseDelay = 0.8 + Math.random() * 2.2;
    } else if (ev.racer === 0) {
      hud.toast(ev.by === "oil" ? "slicked!" : ev.by === "crown" ? "dethroned!" : "rocketed!");
    }
  }
  for (let i = 0; i < opponents.length; i++) {
    const o = opponents[i]!;
    if (o.held === null || o.finished || o.spin > 0) continue;
    o.itemUseDelay -= PHYSICS_DT;
    if (o.itemUseDelay <= 0) useItem(itemWorld, itemRacers, i + 1);
  }
}

/** The player fires whatever the bubble is holding (tap or space/E). */
function useHeldItem(): void {
  if (mode !== "racing" || !itemWorld) return;
  if (useItem(itemWorld, itemRacers, 0)) hud.setItem(null);
}

const itemBubble = document.getElementById("item-bubble")!;
itemBubble.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  useHeldItem();
});
window.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key.toLowerCase() === "e") useHeldItem();
});

/** How far from the centerline the fence sits on the current track. */
function corridorPx(): number {
  return (track ? track.roadWidth / 2 : 0) + tuning.fenceMarginPx;
}

function applyWalls(): void {
  if (!track) return;
  if (car.x < WALL_MARGIN) (car.x = WALL_MARGIN), (car.vx *= WALL_BOUNCE);
  if (car.x > track.worldWidth - WALL_MARGIN)
    (car.x = track.worldWidth - WALL_MARGIN), (car.vx *= WALL_BOUNCE);
  if (car.y < WALL_MARGIN) (car.y = WALL_MARGIN), (car.vy *= WALL_BOUNCE);
  if (car.y > track.worldHeight - WALL_MARGIN)
    (car.y = track.worldHeight - WALL_MARGIN), (car.vy *= WALL_BOUNCE);
}

menu.show();
requestAnimationFrame(loop);

// Dev-only hook: lets headless verification scripts read game state while
// driving through the real input surface (keyboard/touch).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__vroom = {
    get car() {
      return car;
    },
    get track() {
      return track;
    },
    get mode() {
      return mode;
    },
  };
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}
