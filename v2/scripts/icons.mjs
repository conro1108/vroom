// Renders the app icons into public/icons with headless Chromium:
//   node scripts/icons.mjs
// The art is the wordmark's V on the blue tile, with the red and yellow stripes.
// The V path is copied from src/ui/art.tsx; change both together.
import { readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { chromium } from "playwright";

const V = "M0 0H27L46 60 65 0H92L59 100H33Z";
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a7bff"/><stop offset="1" stop-color="#0646c9"/></linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".52" stop-color="#fff"/><stop offset=".53" stop-color="#ffd21f"/><stop offset="1" stop-color="#ff9a1f"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <polygon points="300,512 512,300 512,372 372,512" fill="#e8392f"/>
  <polygon points="396,512 512,396 512,436 436,512" fill="#ffd21f"/>
  <polygon points="0,150 150,0 196,0 0,196" fill="#fff" opacity=".1"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <g transform="translate(80 102) scale(2.9) matrix(1 0 -.28 1 28 0)">
      ${[9, 8, 7, 6, 5, 4, 3, 2, 1].map((k) => `<path d="${V}" transform="translate(${k * 1.1} ${k * 1.5})" fill="${k > 7 ? "#061a4a" : "#0b3cc4"}"/>`).join("")}
      <path d="${V}" fill="url(#face)" stroke="#0b1b3f" stroke-width="2.5"/>
    </g>
  </g>
</svg>`;

writeFileSync("public/icons/icon.svg", svg(0));
const cache = `${homedir()}/Library/Caches/ms-playwright`;
const rev = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
const app = `${cache}/${rev}/chrome-mac-arm64`;
const bundle = readdirSync(app).find((f) => f.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${app}/${bundle}/Contents/MacOS/${bundle.replace(".app", "")}` });
const page = await browser.newPage();
for (const [name, size, pad] of [["icon-192", 192, 0], ["icon-512", 512, 0], ["maskable-512", 512, 0.2], ["apple-touch-icon", 180, 0.04], ["favicon-32", 32, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(pad)}`);
  await page.screenshot({ path: `public/icons/${name}.png` });
}
await browser.close();
