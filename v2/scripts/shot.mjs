// Headless screenshots at exact moments of a race, independent of frame rate.
//   node scripts/shot.mjs "<query>" 8,20,41 [390x844] [outPrefix]
// e.g. node scripts/shot.mjs "track=sunrise&auto=1&skip=1" 8,20
// Needs the dev server on :5310 (npm run dev -- --port 5310). Writes /tmp/shots/.
import { mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { chromium } from "playwright";

const [query = "", times = "6", size = "390x844", prefix = "shot"] = process.argv.slice(2);
const [width, height] = size.split("x").map(Number);
mkdirSync("/tmp/shots", { recursive: true });
// Reuse whichever Chromium is already cached rather than downloading another.
const cache = `${homedir()}/Library/Caches/ms-playwright`;
const rev = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const app = `${cache}/${rev}/chrome-mac-arm64`;
const bundle = readdirSync(app).find((f) => f.endsWith(".app"));
const executablePath = `${app}/${bundle}/Contents/MacOS/${bundle.replace(".app", "")}`;
const browser = await chromium.launch({ executablePath, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(`http://localhost:5310/?${query}`);
await page.waitForFunction(() => window.__game?.race, null, { timeout: 30000 });
let at = 0;
for (const t of times.split(",").map(Number)) {
  await page.evaluate((s) => window.__game.advance(s), t - at);
  at = t;
  await page.waitForTimeout(150);
  const path = `/tmp/shots/${prefix}-${t}.png`;
  await page.screenshot({ path });
  console.log(path);
}
await browser.close();
