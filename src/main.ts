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
import {
  createOpponents,
  playerGridSlot,
  playerPlacement,
  playerPosition,
  separateCars,
  stepOpponents,
  type Opponent,
} from "./game/opponents";
import { createCarState, stepCar } from "./game/physics";
import {
  applySpeedClass,
  isTrackUnlocked,
  loadProgress,
  recordRaceResult,
  RACE_LAPS,
  saveProgress,
  speedClassById,
  type SpeedClass,
} from "./game/progression";
import { bestSplitIndex, completeLap, createRace, raceTotalMs, type RaceState } from "./game/race";
import { applyLap, applyRace, getRecords, loadRecords, recordKey, saveRecords } from "./game/records";
import { createLapTracker, createTrack, createTrackQuery, updateLap, type LapTracker, type Track, type TrackQuery } from "./game/track";
import { TRACKS } from "./game/tracks";
import { loadTuning, saveTuning } from "./game/tuning";
import { CUSTOM_VEHICLE_ID, saveCustomVehicle } from "./game/vehicles";
import { Scene, type RacerPose } from "./render/scene";
import { createCalibrateUi } from "./ui/calibrate";
import { createDevPanel } from "./ui/devpanel";
import { createHud } from "./ui/hud";
import { createInput } from "./ui/input";
import { createMenu } from "./ui/menu";
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
createDevPanel(tuning, () => startCalibration());

type Mode = "menu" | "countdown" | "racing" | "finished" | "calibrating";
let mode: Mode = "menu";
let trackIndex = 0;
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
let opponents: Opponent[] = [];
let countdownEnd = 0;
const ghosts = loadGhosts();
let ghost: GhostLap | null = null; // best lap being replayed
let ghostRec: GhostRecorder = createGhostRecorder();
let cal: Calibration | null = null;
let calVariant: "a" | "b" = "a";

const menu = createMenu(progress, records, tuning, (index, classId) => {
  startRace(index, classId);
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
  trackIndex = 0;
  track = createTrack(def);
  query = createTrackQuery(track);
  scene = new Scene(track, query, canvas, progress.lastVehicle);
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

function startRace(index: number, classId: string): void {
  trackIndex = index;
  cls = speedClassById(classId);
  const def = TRACKS[index]!;
  track = createTrack(def);
  query = createTrackQuery(track);
  scene = new Scene(track, query, canvas, progress.lastVehicle);
  progress.lastClass = classId;
  progress.lastTrack = def.id;
  saveProgress(progress);
  hud.setBest(getRecords(records, def.id, cls.id).bestLapMs);
  menu.hide();
  hideResults();
  restartRace();
}

/** Put the field back on the grid and arm the countdown. */
function restartRace(): void {
  if (!track || !query || !scene) return;
  const slot = playerGridSlot(track);
  car = createCarState(slot.x, slot.y, track.startHeading);
  lapTracker = createLapTracker(query.progressAt(slot.x, slot.y) ?? 0);
  opponents =
    progress.raceMode === "group" ? createOpponents(track, query, progress.lastVehicle, tuning, cls) : [];
  race = createRace(RACE_LAPS);
  raceHadBestLap = false;
  finishPending = false;
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
    ghost = finishGhostLap(ghostRec, lapMs);
    ghosts[recordKey(track.id, cls.id)] = ghost;
    saveGhosts(ghosts);
  }
  saveRecords(records);
  ghostRec = createGhostRecorder();

  if (completeLap(race, lapMs).finished) {
    if (!finishPending) {
      finishPending = true;
      finishAt = now + FINISH_HOLD_MS;
    }
  } else {
    hud.setLap(race.lap, RACE_LAPS);
  }
}

function finishRace(): void {
  if (!track) return;
  mode = "finished";
  const totalMs = raceTotalMs(race);
  const newBestRace = applyRace(records, track.id, cls.id, totalMs);
  saveRecords(records);
  const placement = playerPlacement(opponents);
  // solo races have no field to place in, so they don't feed placement-gated unlocks
  const unlocked =
    progress.raceMode === "group" ? recordRaceResult(progress, cls.id, track.id, placement) : [];
  saveProgress(progress);

  showResults(
    {
      trackName: track.name,
      classLabel: cls.label,
      placement,
      racerCount: opponents.length + 1,
      solo: progress.raceMode === "solo",
      splits: race.splits,
      totalMs,
      bestSplitIndex: bestSplitIndex(race),
      newBestLap: raceHadBestLap,
      newBestRace,
      unlockedNames: unlocked.map((t) => t.name),
      hasNext: trackIndex + 1 < TRACKS.length && isTrackUnlocked(progress, cls.id, trackIndex + 1),
    },
    {
      onAgain: () => restartRace(),
      onNext: () => startRace(trackIndex + 1, cls.id),
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
    input.read(car.heading); // keep the joystick visible/live so you're ready on "go"
    const remaining = countdownEnd - now;
    if (remaining <= 0) {
      mode = "racing";
      lapStart = countdownEnd; // clock starts exactly on green
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
      car = stepCar(car, carInput, raceTuning, query.surfaceAt(car.x, car.y), PHYSICS_DT);
      if (racing) {
        stepOpponents(opponents, query, PHYSICS_DT, true);
        separateCars([car, ...opponents.map((o) => o.car)]);
      }
      applyWalls();
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
  scene.frame(frameDt, car, raceTuning, ghostPose, racerPoses);
  requestAnimationFrame(loop);
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
