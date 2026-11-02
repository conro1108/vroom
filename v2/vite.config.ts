import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  base: "./",
  build: { chunkSizeWarningLimit: 1200 },
  // .check.ts, not .test.ts: the old app's vitest at the repo root globs every
  // *.test.ts below it and must not pick these up.
  test: { include: ["src/**/*.check.ts"] },
} as never);
