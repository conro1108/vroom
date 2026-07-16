// End-to-end drive of vroom: menu → settings → race 3 laps (keyboard
// autopilot) → results → next track → persistence checks → all-track worlds.
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

// locked tile is a no-op
const lockedDisabled = await page.$eval(".track-tile.locked", (el) => el.disabled);
console.log("locked tile disabled:", lockedDisabled);

// settings from splash: styles + advanced
await page.click("#dev-toggle");
await page.waitForTimeout(200);
await shot("03-settings-styles");
await page.click(".style-btn:has-text('Slot Car')");
await page.waitForTimeout(200);
const activeStyle = await page.$eval(".style-btn.active .style-name", (el) => el.textContent);
console.log("active style:", activeStyle);
await page.click("details.advanced summary");
await page.waitForTimeout(200);
await shot("04-settings-advanced");
// slider tweak deactivates the style
await page.$eval("details.advanced input[type=range]", (el) => {
  el.value = String(Number(el.value) + Number(el.step));
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const stillActive = await page.$(".style-btn.active");
console.log("style active after manual tweak (expect null):", stillActive && "yes");
await page.click(".style-btn:has-text('Slot Car')"); // reselect for the drive
await page.click("#dev-panel .panel-close");

// start race on track 1
await page.click(".track-tile:not(.locked)");
await page.waitForTimeout(400);
await shot("05-race-start");

// keyboard autopilot: hold W, bang-bang steer toward a point ahead on the
// centerline. Sloppy but honest — everything goes through real key events.
await page.keyboard.down("w");
let steering = null; // 'a' | 'd' | null
const deadline = Date.now() + 300 * 1000;
let lastMode = "racing";
while (Date.now() < deadline) {
  const s = await page.evaluate(() => {
    const v = window.__vroom;
    if (!v || !v.track) return null;
    const { car, track, mode } = v;
    if (mode !== "racing") return { mode };
    const n = track.samples.length;
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i += 3) {
      const p = track.samples[i];
      const d = (p.x - car.x) ** 2 + (p.y - car.y) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const t = track.samples[(bi + 14) % n];
    return { mode, x: car.x, y: car.y, heading: car.heading, tx: t.x, ty: t.y };
  });
  if (!s) break;
  lastMode = s.mode;
  if (s.mode !== "racing") break;
  let diff = Math.atan2(s.ty - s.y, s.tx - s.x) - s.heading;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const want = diff > 0.06 ? "d" : diff < -0.06 ? "a" : null;
  if (want !== steering) {
    if (steering) await page.keyboard.up(steering);
    if (want) await page.keyboard.down(want);
    steering = want;
  }
  await page.waitForTimeout(40);
}
await page.keyboard.up("w");
if (steering) await page.keyboard.up(steering);
console.log("race ended with mode:", lastMode);

await page.waitForTimeout(400);
await shot("06-results");
const badges = await page.$$eval(".results-badge", (els) => els.map((e) => e.textContent));
console.log("result badges:", badges);
const splits = await page.$$eval(".split-row", (els) => els.map((e) => e.textContent));
console.log("splits:", splits);

// next track button starts speedway
await page.click(".results-buttons button.primary");
await page.waitForTimeout(500);
await shot("07-next-track-speedway");

// mid-race reset puts us back on lap 1
await page.keyboard.down("w");
await page.waitForTimeout(1500);
await page.keyboard.up("w");
await page.click("#reset-btn");
const lapAfterReset = await page.textContent("#lap-count");
console.log("lap after reset:", lapAfterReset);

// home button back to menu; records + unlock visible
await page.click("#home-btn");
await page.waitForTimeout(300);
await shot("08-menu-after-race");

// persistence across reload
await page.reload();
await page.waitForTimeout(600);
await shot("09-menu-reloaded");
const tiles = await page.$$eval(".track-tile", (els) =>
  els.map((e) => ({ locked: e.classList.contains("locked"), text: e.textContent }))
);
console.log("tiles after reload:", JSON.stringify(tiles, null, 1));

// unlock everything (as if all races finished) and screenshot each track world
await page.evaluate(() => {
  const ids = ["meadow", "speedway", "serpent", "switchback", "knot", "gauntlet"];
  localStorage.setItem(
    "vroom.progress.v1",
    JSON.stringify({ completed: { 100: ids }, lastClass: "100", lastTrack: "meadow" })
  );
});
await page.reload();
await page.waitForTimeout(600);
await shot("10-menu-all-unlocked");
for (let i = 0; i < 6; i++) {
  const tiles2 = await page.$$(".track-tile");
  await tiles2[i].click();
  await page.waitForTimeout(500);
  await page.keyboard.down("w");
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  await shot(`track-${i + 1}`);
  await page.click("#home-btn");
  await page.waitForTimeout(300);
}

await browser.close();
console.log("done");
