// How tight can the car turn? Holds a full-lock grip turn, then drifts steering fully
// in, neutral and fully out, from top speed for each speed scale and prints the arc radius (whole 180° and its second
// half, where a hairpin apex is) and the speed coming out.
// Compare against `minV`/`minR` in `npm run sim`: a racing-line hairpin is ~19m.
//   npm run turn   (SET=driftTightR=20,driftCarry=0.6 npm run turn to try values)
import { createCar, speedOf, stepCar } from "../src/sim/car";
import { buildCourse } from "../src/sim/course";
import { DT } from "../src/sim/race";
import { TUNING } from "../src/sim/tuning";
import { LAB } from "../src/tracks/lab";

const c = buildCourse(LAB[0]!);
// an endless flat lot: the car never meets a wall, a hill, or the grass
c.half.fill(1e4); c.limL.fill(1e4); c.limR.fill(1e4); c.y.fill(0);
for (const kv of (process.env.SET ?? "").split(",").filter(Boolean)) {
  const [k, v] = kv.split("=");
  (TUNING as Record<string, number>)[k!] = +v!;
}
const rows = [];
for (const scale of [1, 1.1, 1.25]) {
  for (const [mode, steer, drift] of [["grip", 1, false], ["drift in", 1, true], ["drift neutral", 0, true], ["drift out", -1, true]] as const) {
    const car = createCar(c, 0, 0);
    const top = TUNING.top * scale;
    car.vx = Math.cos(car.h) * top; car.vz = Math.sin(car.h) * top;
    const inp = { steer: 1, throttle: 1, brake: 0, drift };
    const lock = steer;
    let turned = 0, t = 0, h0 = car.h, path = 0, lastR = 0, p2 = 0, t2 = 0;
    while (turned < Math.PI && t < 10) {
      const [x, z] = [car.x, car.z];
      stepCar(car, inp, c, TUNING, scale, DT);
      if (car.driftDir) inp.steer = lock; // into the drift, then hold the thumb where asked
      if (lastR === 0 && turned > Math.PI / 2) lastR = 1;
      car.events.length = 0;
      t += DT; path += Math.hypot(car.x - x, car.z - z);
      const dh = Math.atan2(Math.sin(car.h - h0), Math.cos(car.h - h0));
      turned += dh; h0 = car.h;
      if (lastR) { p2 += Math.hypot(car.x - x, car.z - z); t2 += dh; }
    }
    rows.push({ scale, mode, radius: +(path / turned).toFixed(1), apexR: +(p2 / t2).toFixed(1), seconds: +t.toFixed(2), exitV: +speedOf(car).toFixed(1), topV: top });
  }
}
console.table(rows);
