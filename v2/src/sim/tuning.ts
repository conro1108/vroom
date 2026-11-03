// Every number that shapes how driving feels, in metres and seconds. The ?dev
// panel edits this object live; "copy" there produces JSON to paste back here.

export const TUNING = {
  top: 30, // m/s at speed scale 1
  accel: 16,
  brake: 34,
  drag: 5,
  steerResponse: 11, // 1/s, how fast the wheels chase input
  gripLat: 24, // m/s² of cornering before the fronts give up; radius = v²/this
  maxYaw: 2.5, // rad/s, low-speed yaw ceiling
  grip: 9.5, // 1/s decay of sideways velocity
  driftGrip: 4.2, // low enough to slide, high enough that a drift never swaps ends
  driftWideR: 60, // m, drift arc at base top speed steering fully away from the turn
  driftTightR: 17, // m, drift arc at base top speed steering fully into it: a hairpin
  driftCarry: 0.6, // share of scrubbed speed a slide keeps; a hard drift sheds speed, which is the touch brake
  driftMinSpeed: 11,
  hop: 3.4, // m/s, the little jump that starts a drift
  tier1: 0.55, // seconds of drift for each mini-turbo tier
  tier2: 1.25,
  tier3: 2.2,
  boost1: 0.55, // seconds of boost each tier pays out
  boost2: 0.95,
  boost3: 1.5,
  boostPad: 1.3,
  boostTop: 1.33, // top-speed multiple while boosting
  boostAccel: 2.4,
  offTop: 0.72, // top-speed multiple on the grass
  offDrag: 7, // m/s² shed on the grass while above its top speed
  overTopDrag: 16, // m/s² shed on the road when a boost ends above top speed
  gravity: 30,
  stick: 0.06, // metres of air below which the car counts as on the road
  wallBounce: 0.25,
  wallScrub: 0.35, // share of speed lost in a square-on hit
  fallSeconds: 0.9,
  respawnSeconds: 0.7,
  slope: 0.5, // how much of gravity's along-road pull is felt on hills
  bumpRadius: 0.95, // car-to-car: radius of the nose and tail circles (half the car's width)
  bumpReach: 0.9, // how far ahead and behind centre those circles sit
  touchThrow: 0.26, // share of screen width dragged for full lock
  touchCurve: 1.35, // >1 makes small drags gentle and saves full lock for big ones
  driftPull: 60, // css px the thumb must flick down, quickly, to throw the car into a drift
  driftFlick: 0.28, // seconds that flick has to happen within; a slow sag never drifts
  driftRelease: 20, // css px back up from the deepest point of the pull that ends a drift
  liftCoast: 0.45, // seconds of throttle kept after the thumb lifts, so a regrip or a drift release costs nothing
  driftSteer: 0.35, // steer needed before a flick counts, so the drift has a clear direction
};

export type Tuning = typeof TUNING;
