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
import { createCarState, stepCar } from "./game/physics";
import {
  applySpeedClass,
  isTrackUnlocked,
  loadProgress,
  markRaceCompleted,
  RACE_LAPS,
  saveProgress,
  speedClassById,
  type SpeedClass,
} from "./game/progression";
import { bestSplitIndex, completeLap, createRace, raceTotalMs, type RaceState } from "./game/race";
import { applyLap, applyRace, getRecords, loadRecords, recordKey, saveRecords } from "./game/records";
import { createLapTracker, createTrack, createTrackQuery, updateLap, type LapTracker, type Track, type TrackQuery } from "./game/track";
import { TRACKS } from "./game/tracks";
import { loadTuning } from "./game/tuning";
import { Scene } from "./render/scene";
import { createDevPanel } from "./ui/devpanel";
import { createHud } from "./ui/hud";
import { createInput } from "./ui/input";
import { createMenu } from "./ui/menu";
import { hideResults, showResults } from "./ui/results";

const PHYSICS_DT = 1 / 120; // fixed step so feel doesn't vary with frame rate
const WALL_MARGIN = 14;
const WALL_BOUNCE = -0.3;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const tuning = loadTuning();
const progress = loadProgress();
const records = loadRecords();
const input = createInput(canvas, tuning);
const hud = createHud();
createDevPanel(tuning);

type Mode = "menu" | "racing" | "finished";
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
const ghosts = loadGhosts();
let ghost: GhostLap | null = null; // best lap being replayed
let ghostRec: GhostRecorder = createGhostRecorder();

const menu = createMenu(progress, records, tuning, (index, classId) => {
  startRace(index, classId);
});

function startRace(index: number, classId: string): void {
  trackIndex = index;
  cls = speedClassById(classId);
  const def = TRACKS[index]!;
  track = createTrack(def);
  query = createTrackQuery(track);
  scene = new Scene(track, query, canvas);
  progress.lastClass = classId;
  progress.lastTrack = def.id;
  saveProgress(progress);
  hud.setBest(getRecords(records, def.id, cls.id).bestLapMs);
  menu.hide();
  hideResults();
  restartRace();
}

/** Put the car back on the line and start the race clock fresh. */
function restartRace(): void {
  if (!track || !scene) return;
  car = createCarState(track.start.x, track.start.y, track.startHeading);
  lapTracker = createLapTracker(0);
  race = createRace(RACE_LAPS);
  raceHadBestLap = false;
  lapStart = performance.now();
  ghost = ghosts[recordKey(track.id, cls.id)] ?? null;
  ghostRec = createGhostRecorder();
  scene.centerOn(car);
  scene.clearMarks();
  hud.setLap(1, RACE_LAPS);
  hud.setLapTime(0);
  hideResults();
  mode = "racing";
}

function goToMenu(): void {
  mode = "menu";
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
    finishRace();
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
  const unlocked = markRaceCompleted(progress, cls.id, track.id);
  saveProgress(progress);

  showResults(
    {
      trackName: track.name,
      classLabel: cls.label,
      splits: race.splits,
      totalMs,
      bestSplitIndex: bestSplitIndex(race),
      newBestLap: raceHadBestLap,
      newBestRace,
      unlockedName: unlocked?.name ?? null,
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
  if (mode !== "menu") restartRace();
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

  // The player's feel values scaled up to the selected speed class, computed
  // per frame so dev-panel edits keep applying live mid-race.
  const raceTuning = applySpeedClass(tuning, cls);

  if (mode === "racing") {
    const carInput = input.read(car.heading);
    while (accumulator >= PHYSICS_DT) {
      accumulator -= PHYSICS_DT;
      car = stepCar(car, carInput, raceTuning, query.surfaceAt(car.x, car.y), PHYSICS_DT);
      applyWalls();
      recordGhostSample(ghostRec, now - lapStart, car);

      const p = query.progressAt(car.x, car.y);
      if (p !== null && updateLap(lapTracker, p).completed) {
        onLapCompleted(now);
        if (mode !== "racing") break; // race just finished
      }
    }
    hud.setLapTime(now - lapStart);
  } else {
    accumulator = 0;
  }

  const ghostPose =
    mode === "racing" && tuning.showGhost && ghost ? ghostAt(ghost, now - lapStart) : null;
  scene.frame(frameDt, car, raceTuning, ghostPose);
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
