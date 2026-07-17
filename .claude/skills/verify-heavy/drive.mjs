// End-to-end drive of vroom: menu (vehicles/classes/cup map) → settings →
// calibration overlay → race 1 of a cup vs bots through the countdown
// (keyboard autopilot) → placement results + cup standings → progression
// gating → persistence → every cup's themed world.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:5199/";
const SHOTS = process.env.SHOTS ?? "./shots";
import { mkdirSync } from "node:fs";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("PAGE ERROR:", m.text());
});
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", e.message));

const shot = async (name) => {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  console.log("shot:", name);
};

await page.goto(BASE);
await page.waitForTimeout(600);
await shot("01-menu-fresh");

// class picker
await page.click(".class-btn:has-text('150cc')");
await page.waitForTimeout(200);
await shot("02-menu-150cc");
await page.click(".class-btn:has-text('100cc')");

// vehicle picker on the splash
await page.click(".vehicle-tile:has-text('Slot Car')");
await page.waitForTimeout(200);
const activeVehicle = await page.$eval(".vehicle-tile.active .vehicle-name", (el) => el.textContent);
console.log("active vehicle:", activeVehicle);
await shot("03-menu-vehicle");

// locked cup node is a no-op
const lockedDisabled = await page.$eval(".cup-node.locked", (el) => el.disabled);
console.log("locked cup disabled:", lockedDisabled);

// settings: advanced sliders + calibration overlay round-trip
await page.click("#dev-toggle");
await page.waitForTimeout(200);
await page.click("details.advanced summary");
await page.waitForTimeout(200);
await shot("04-settings-advanced");
await page.click(".calibrate-btn");
await page.waitForTimeout(400);
await shot("05-calibrate");
const calTitle = await page.textContent("#calibrate .cal-title");
console.log("calibrate axis:", calTitle);
await page.click("#calibrate .cal-ab button:nth-child(2)"); // feel variant B
await page.waitForTimeout(300);
await page.click("#calibrate .cal-pick"); // keep it
await page.waitForTimeout(200);
const calTitle2 = await page.textContent("#calibrate .cal-title");
console.log("calibrate after pick:", calTitle2);
await page.click("#calibrate .cal-actions button[aria-label='quit calibration']");
await page.waitForTimeout(300);

// start the open cup: countdown holds the field, then racing begins
await page.click(".cup-node:not(.locked)");
await page.waitForTimeout(300);
await shot("06-race-countdown");
const modeAtStart = await page.evaluate(() => window.__vroom?.mode);
console.log("mode during countdown:", modeAtStart);

// keyboard autopilot: bang-bang steer toward a point ahead on the
// centerline, lookahead scaled with speed, throttle lifted when pointed
// badly wrong (so corrections actually bite instead of pinballing off the
// fence). Sloppy but honest — everything goes through real key events.
await page.keyboard.down("w");
let steering = null; // 'a' | 'd' | null
let throttleOn = true;
const deadline = Date.now() + 300 * 1000;
let lastMode = "countdown";
let shotMidRace = false;
while (Date.now() < deadline) {
  const s = await page.evaluate(() => {
    const v = window.__vroom;
    if (!v || !v.track) return null;
    const { car, track, mode } = v;
    if (mode !== "racing" && mode !== "countdown") return { mode };
    const n = track.samples.length;
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i += 2) {
      const p = track.samples[i];
      const d = (p.x - car.x) ** 2 + (p.y - car.y) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const speed = Math.hypot(car.vx, car.vy);
    const ahead = Math.max(12, Math.min(30, Math.round(10 + speed * 0.09)));
    const t = track.samples[(bi + ahead) % n];
    return { mode, x: car.x, y: car.y, heading: car.heading, speed, tx: t.x, ty: t.y };
  });
  if (!s) break;
  lastMode = s.mode;
  if (s.mode !== "racing" && s.mode !== "countdown") break;
  if (s.mode === "racing" && !shotMidRace) {
    shotMidRace = true;
    await page.waitForTimeout(2500);
    await shot("07-race-vs-bots");
  }
  let diff = Math.atan2(s.ty - s.y, s.tx - s.x) - s.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const want = diff > 0.05 ? "d" : diff < -0.05 ? "a" : null;
  if (want !== steering) {
    if (steering) await page.keyboard.up(steering);
    if (want) await page.keyboard.down(want);
    steering = want;
  }
  const wantThrottle = !(Math.abs(diff) > 1.0 && s.speed > 70);
  if (wantThrottle !== throttleOn) {
    if (wantThrottle) await page.keyboard.down("w");
    else await page.keyboard.up("w");
    throttleOn = wantThrottle;
  }
  await page.waitForTimeout(16);
}
if (!throttleOn) await page.keyboard.down("w"); // leave a clean keyboard state
await page.keyboard.up("w");
if (steering) await page.keyboard.up(steering);
console.log("race ended with mode:", lastMode);

await page.waitForTimeout(400);
await shot("08-results");
const title = await page.textContent(".results-card h2");
console.log("results title:", title);
const badges = await page.$$eval(".results-badge", (els) => els.map((e) => e.textContent));
console.log("result badges:", badges);
const splits = await page.$$eval(".split-row", (els) => els.map((e) => e.textContent));
console.log("splits:", splits);
const standings = await page.$$eval(".standings-row", (els) => els.map((e) => e.textContent));
console.log("cup standings after race 1:", standings);

// next race of the series, then a mid-race reset puts us back on lap 1
await page.click(".results-buttons button:has-text('next race')");
await page.waitForTimeout(3200);
await page.keyboard.down("w");
await page.waitForTimeout(1500);
await page.keyboard.up("w");
await page.click("#reset-btn");
await page.waitForTimeout(2600);
const lapAfterReset = await page.textContent("#lap-count");
console.log("lap after reset:", lapAfterReset);

// home button back to menu; locked cups show the podium/win requirements
await page.click("#home-btn");
await page.waitForTimeout(300);
await shot("09-menu-after-race");
const lockLabels = await page.$$eval(".cup-node.locked .cup-sub", (els) =>
  els.map((e) => e.textContent)
);
console.log("lock labels:", JSON.stringify(lockLabels, null, 1));

// persistence across reload
await page.reload();
await page.waitForTimeout(600);
await shot("10-menu-reloaded");

// grant cup wins everywhere, then screenshot every cup's themed world
await page.evaluate(() => {
  localStorage.setItem(
    "vroom.progress.v1",
    JSON.stringify({
      cups: { 100: { sprout: 1, dune: 1, tide: 1, frost: 1, dusk: 1 } },
      lastClass: "100",
    })
  );
});
await page.reload();
await page.waitForTimeout(600);
await shot("11-menu-all-unlocked");
const nodeCount = (await page.$$(".cup-node:not(.locked)")).length;
console.log("unlocked cups (expect 5):", nodeCount);
for (let i = 0; i < nodeCount; i++) {
  const nodes = await page.$$(".cup-node");
  await nodes[i].click();
  await page.waitForTimeout(500);
  await page.keyboard.down("w");
  await page.waitForTimeout(3600); // countdown + a moment of driving
  await page.keyboard.up("w");
  await shot(`cup-${i + 1}`);
  await page.click("#home-btn");
  await page.waitForTimeout(300);
}

await browser.close();
console.log("done");
