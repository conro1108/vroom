const MAX_SPEED = 220; // px/sec
const ACCEL = 260; // px/sec^2
const DRAG = 140; // px/sec^2, always-on friction
const BRAKE = 320; // px/sec^2
const TURN_RATE = 3.2; // rad/sec at full speed fraction

export function createCarState() {
  return { x: 0, y: 0, heading: -Math.PI / 2, speed: 0 };
}

// input: { throttle: -1..1, steer: -1..1 }
export function stepCar(state, input, dt) {
  const throttle = clamp(input.throttle, -1, 1);
  const steer = clamp(input.steer, -1, 1);

  let speed = state.speed;
  if (throttle > 0) {
    speed += ACCEL * throttle * dt;
  } else if (throttle < 0) {
    speed += BRAKE * throttle * dt;
  }

  const dragMagnitude = Math.min(Math.abs(speed), DRAG * dt);
  speed -= Math.sign(speed) * dragMagnitude;

  speed = clamp(speed, -MAX_SPEED / 2, MAX_SPEED);

  const speedFraction = speed / MAX_SPEED;
  const heading = state.heading + steer * TURN_RATE * speedFraction * dt;

  const x = state.x + Math.cos(heading) * speed * dt;
  const y = state.y + Math.sin(heading) * speed * dt;

  return { x, y, heading, speed };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
