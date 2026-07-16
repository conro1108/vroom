import { createCarState, stepCar } from "./physics.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
}
resize();
window.addEventListener("resize", resize);

let car = createCarState();
car.x = 0;
car.y = 0;

const input = { throttle: 0, steer: 0 };

function bindTouchZones() {
  const setFromTouches = (touches) => {
    let throttle = 0;
    let steer = 0;
    for (const t of touches) {
      const leftHalf = t.clientX < window.innerWidth / 2;
      const topHalf = t.clientY < window.innerHeight / 2;
      if (leftHalf) {
        steer += t.clientX < window.innerWidth / 4 ? -1 : 0;
      } else {
        throttle += topHalf ? 1 : -1;
      }
    }
    input.throttle = Math.max(-1, Math.min(1, throttle));
    input.steer = Math.max(-1, Math.min(1, steer));
  };

  window.addEventListener("touchstart", (e) => setFromTouches(e.touches), { passive: true });
  window.addEventListener("touchmove", (e) => setFromTouches(e.touches), { passive: true });
  window.addEventListener("touchend", (e) => setFromTouches(e.touches), { passive: true });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") input.throttle = 1;
    if (e.key === "ArrowDown") input.throttle = -1;
    if (e.key === "ArrowLeft") input.steer = -1;
    if (e.key === "ArrowRight") input.steer = 1;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") input.throttle = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") input.steer = 0;
  });
}
bindTouchZones();

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  car = stepCar(car, input, dt);
  render();

  requestAnimationFrame(loop);
}

function render() {
  ctx.fillStyle = "#0d0d12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.translate(-car.x * devicePixelRatio, -car.y * devicePixelRatio);

  const carSize = 12 * devicePixelRatio;
  ctx.translate(car.x * devicePixelRatio, car.y * devicePixelRatio);
  ctx.rotate(car.heading + Math.PI / 2);
  ctx.fillStyle = "#ff3860";
  ctx.fillRect(-carSize / 2, -carSize / 2, carSize, carSize);
  ctx.restore();
}

requestAnimationFrame(loop);
