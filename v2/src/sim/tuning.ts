// Every number that shapes how driving feels, in metres and seconds. The ?dev
// panel edits this object live; "copy" there produces JSON to paste back here.

export const TUNING = {
  top: 30, // m/s at speed scale 1
  accel: 16,
  brake: 34,
  drag: 5,
  steerResponse: 11, // 1/s, how fast the wheels chase input
  gripLat: 21, // m/s² of cornering before the fronts give up; radius = v²/this
  maxYaw: 2.5, // rad/s, low-speed yaw ceiling
  grip: 9.5, // 1/s decay of sideways velocity
  driftGrip: 2.9,
  driftWide: 0.72, // yaw multiplier with the thumb backed off during a drift
  driftTight: 1.7, // yaw multiplier with full lock into the drift
  driftCarry: 0.85, // share of scrubbed speed a slide keeps
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
  bumpRadius: 1.25, // car-to-car collision radius
  touchThrow: 0.32, // share of screen width dragged for full lock
  touchCurve: 1.9, // >1 makes small drags gentle and saves full lock for big ones
  driftPull: 36, // css px of downward thumb pull that throws the car into a drift
};

export type Tuning = typeof TUNING;
