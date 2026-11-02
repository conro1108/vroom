// Drives every track with the bot and prints what a lap is actually like. Run
// this after authoring a layout: `npm run sim` or `npm run sim -- <trackId>`.
import { speedOf } from "../src/sim/car";
import { DT, Race } from "../src/sim/race";
import { ALL_TRACKS } from "../src/tracks";
import { LAB } from "../src/tracks/lab";

const only = process.argv.slice(2);
const rows = [];
for (const def of [...ALL_TRACKS, ...LAB]) {
  if (only.length && !only.includes(def.id)) continue;
  const race = new Race(def, {
    scale: 1, difficulty: 1, rivals: [], player: { name: "bot", color: 0 }, grid: 0, autopilot: true,
  });
  const c = race.course;
  race.started = true;
  let [walls, falls, airT, offT, t, minV, sumV, steps] = [0, 0, 0, 0, 0, 99, 0, 0];
  let brakeT = 0;
  const r = race.player;
  while (t < 300 && r.lap < 2) {
    race.step();
    t += DT;
    if (r.lap >= 1) {
      const v = speedOf(r.car);
      minV = Math.min(minV, v);
      sumV += v;
      steps++;
      if (!r.car.grounded) airT += DT;
      if (!r.car.onRoad) offT += DT;
      if (race.input.brake) brakeT += DT;
      for (const l of race.log) if ("e" in l && l.e.type === "wall") walls++;
      for (const l of race.log) if ("e" in l && l.e.type === "fall") falls++;
    }
    race.log.length = 0;
  }
  let corners = 0, flat = 0, inC = false;
  for (let i = 0; i < c.n; i++) {
    const lift = c.vmax[i]! < 27;
    if (!lift) flat++;
    if (lift && !inC) corners++;
    inC = lift;
  }
  const minR = 1 / Math.max(...Array.from(c.kappa, Math.abs));
  rows.push({
    id: def.id, m: Math.round(c.length), lap: r.bestLap ? +r.bestLap.toFixed(1) : "DNF", avgV: steps ? Math.round(sumV / steps) : 0,
    minV: Math.round(minV), bites: corners, flatPct: Math.round((100 * flat) / c.n), minR: Math.round(minR),
    climb: +(Math.max(...c.y) - Math.min(...c.y)).toFixed(0), walls, falls, airS: +airT.toFixed(1), offS: +offT.toFixed(1),
  });
}
console.table(rows);
