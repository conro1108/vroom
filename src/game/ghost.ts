// Ghost laps: the car's best lap recorded as fixed-interval pose samples and
// replayed, synced to each new lap's start. Persisted per (track, class)
// alongside the lap record it corresponds to.

export const GHOST_INTERVAL_MS = 80;

export type GhostSample = [x: number, y: number, heading: number];

export interface GhostLap {
  lapMs: number;
  samples: GhostSample[];
}

export interface GhostRecorder {
  samples: GhostSample[];
}

export function createGhostRecorder(): GhostRecorder {
  return { samples: [] };
}

/** Call every physics step; stores a pose whenever the next slot comes due. */
export function recordGhostSample(
  rec: GhostRecorder,
  lapTMs: number,
  pose: { x: number; y: number; heading: number }
): void {
  while (rec.samples.length * GHOST_INTERVAL_MS <= lapTMs) {
    rec.samples.push([
      Math.round(pose.x * 10) / 10,
      Math.round(pose.y * 10) / 10,
      Math.round(pose.heading * 1000) / 1000,
    ]);
  }
}

export function finishGhostLap(rec: GhostRecorder, lapMs: number): GhostLap {
  return { lapMs, samples: rec.samples };
}

export interface GhostPose {
  x: number;
  y: number;
  heading: number;
}

/** Interpolated ghost pose at lap time t, or null once the ghost has finished. */
export function ghostAt(ghost: GhostLap, tMs: number): GhostPose | null {
  const n = ghost.samples.length;
  if (n === 0 || tMs < 0 || tMs >= ghost.lapMs) return null;
  const ft = tMs / GHOST_INTERVAL_MS;
  const i0 = Math.min(Math.floor(ft), n - 1);
  const i1 = Math.min(i0 + 1, n - 1);
  const k = Math.min(1, Math.max(0, ft - i0));
  const a = ghost.samples[i0]!;
  const b = ghost.samples[i1]!;
  return {
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    heading: lerpAngle(a[2], b[2], k),
  };
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * k;
}

// --- persistence ---

export type Ghosts = Record<string, GhostLap>; // key: `${trackId}:${classId}`

const STORAGE_KEY = "vroom.ghosts.v1";

export function loadGhosts(): Ghosts {
  const ghosts: Ghosts = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Ghosts;
      for (const [key, ghost] of Object.entries(saved)) {
        if (
          ghost &&
          typeof ghost.lapMs === "number" &&
          ghost.lapMs > 0 &&
          Array.isArray(ghost.samples) &&
          ghost.samples.every((s) => Array.isArray(s) && s.length === 3)
        ) {
          ghosts[key] = ghost;
        }
      }
    }
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return ghosts;
}

export function saveGhosts(ghosts: Ghosts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ghosts));
  } catch {
    // storage unavailable or full — ghosts just won't persist
  }
}
