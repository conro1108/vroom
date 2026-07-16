import "./style.css";
import { createCarState, stepCar } from "./game/physics";
import { createLapTracker, createTrack, createTrackQuery, updateLap } from "./game/track";
import { loadTuning } from "./game/tuning";
import { Scene } from "./render/scene";
import { createDevPanel } from "./ui/devpanel";
import { createHud } from "./ui/hud";
import { createInput } from "./ui/input";

const PHYSICS_DT = 1 / 120; // fixed step so feel doesn't vary with frame rate
const WALL_MARGIN = 14;
const WALL_BOUNCE = -0.3;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const tuning = loadTuning();
const track = createTrack();
const query = createTrackQuery(track);
const scene = new Scene(track, query, canvas);
const input = createInput(canvas, tuning);
const hud = createHud();
createDevPanel(tuning);

let car = createCarState(track.start.x, track.start.y, track.startHeading);
const lapTracker = createLapTracker(0);
let lapStart = performance.now();

window.addEventListener("resize", () => scene.resize());

let last = performance.now();
let accumulator = 0;

function loop(now: number): void {
  const frameDt = Math.min((now - last) / 1000, 0.1);
  last = now;
  accumulator += frameDt;

  const carInput = input.read();
  while (accumulator >= PHYSICS_DT) {
    accumulator -= PHYSICS_DT;
    car = stepCar(car, carInput, tuning, query.surfaceAt(car.x, car.y), PHYSICS_DT);
    applyWalls();

    const progress = query.progressAt(car.x, car.y);
    if (progress !== null && updateLap(lapTracker, progress).completed) {
      hud.lapCompleted(now - lapStart);
      lapStart = now;
      hud.setLap(lapTracker.lap);
    }
  }

  hud.setLapTime(now - lapStart);
  scene.frame(frameDt, car, tuning);
  requestAnimationFrame(loop);
}

function applyWalls(): void {
  if (car.x < WALL_MARGIN) (car.x = WALL_MARGIN), (car.vx *= WALL_BOUNCE);
  if (car.x > track.worldWidth - WALL_MARGIN)
    (car.x = track.worldWidth - WALL_MARGIN), (car.vx *= WALL_BOUNCE);
  if (car.y < WALL_MARGIN) (car.y = WALL_MARGIN), (car.vy *= WALL_BOUNCE);
  if (car.y > track.worldHeight - WALL_MARGIN)
    (car.y = track.worldHeight - WALL_MARGIN), (car.vy *= WALL_BOUNCE);
}

requestAnimationFrame(loop);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}
