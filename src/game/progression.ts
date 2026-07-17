// Speed classes and track unlocking. Each class is its own progression:
// race placements are recorded per track per class, and each track's
// UnlockRule (in the TRACKS catalog) decides what result opens it — a podium
// on the previous main-line track, or an outright win for bonus branches.
import { TRACKS } from "./tracks";
import type { Tuning } from "./tuning";
import { VEHICLES } from "./vehicles";

export const RACE_LAPS = 3;

export interface SpeedClass {
  id: string;
  label: string;
  /** Scales maxSpeed/accel/brake; turn rate scales by sqrt so corners get harder but stay possible. */
  mult: number;
}

export const SPEED_CLASSES: SpeedClass[] = [
  { id: "50", label: "50cc", mult: 1 },
  { id: "100", label: "100cc", mult: 1.4 },
  { id: "150", label: "150cc", mult: 1.75 },
];

export function speedClassById(id: string): SpeedClass {
  return SPEED_CLASSES.find((c) => c.id === id) ?? SPEED_CLASSES[0]!;
}

/** Race-time tuning: the player's feel values scaled up to the class. */
export function applySpeedClass(tuning: Tuning, cls: SpeedClass): Tuning {
  return {
    ...tuning,
    maxSpeed: tuning.maxSpeed * cls.mult,
    accel: tuning.accel * cls.mult,
    brake: tuning.brake * cls.mult,
    turnRate: tuning.turnRate * Math.sqrt(cls.mult),
  };
}

/** Placing this or better counts as a podium. */
export const PODIUM_PLACEMENT = 3;

// Solo vs group is a binary switch, not two independent toggles: solo races
// alone against your ghost (no AI opponents, no placement), group races the
// full field and is what placement-gated unlocks require.
export type RaceMode = "solo" | "group";

export interface Progress {
  /** classId -> trackId -> best race placement (1 = win) in that class */
  placements: Record<string, Record<string, number>>;
  lastClass: string;
  lastTrack: string;
  lastVehicle: string;
  raceMode: RaceMode;
}

export function createProgress(): Progress {
  return {
    placements: {},
    lastClass: SPEED_CLASSES[0]!.id,
    lastTrack: TRACKS[0]!.id,
    lastVehicle: VEHICLES[0]!.id,
    raceMode: "group",
  };
}

export function bestPlacement(progress: Progress, classId: string, trackId: string): number | null {
  return progress.placements[classId]?.[trackId] ?? null;
}

export function isTrackUnlocked(progress: Progress, classId: string, trackIndex: number): boolean {
  const rule = TRACKS[trackIndex]?.unlock;
  if (!rule) return true;
  const best = bestPlacement(progress, classId, rule.track);
  if (best === null) return false;
  return rule.result === "win" ? best === 1 : best <= PODIUM_PLACEMENT;
}

/**
 * Record a race placement. Returns the track defs newly unlocked by this
 * result (a win can open a main-line track and a bonus branch at once).
 */
export function recordRaceResult(
  progress: Progress,
  classId: string,
  trackId: string,
  placement: number
) {
  const lockedBefore = TRACKS.filter((_, i) => !isTrackUnlocked(progress, classId, i));
  const byTrack = (progress.placements[classId] ??= {});
  byTrack[trackId] = Math.min(byTrack[trackId] ?? Infinity, placement);
  return lockedBefore.filter((def) =>
    isTrackUnlocked(
      progress,
      classId,
      TRACKS.findIndex((t) => t.id === def.id)
    )
  );
}

const STORAGE_KEY = "vroom.progress.v1";

/** Parse a saved blob, migrating the old finished-track-list shape (every
 * finish back then counted, so it maps to a podium under the new rules). */
export function parseProgress(raw: string): Progress {
  const progress = createProgress();
  const saved = JSON.parse(raw) as Partial<Progress> & {
    completed?: Record<string, string[]>;
  };
  if (saved.placements && typeof saved.placements === "object") {
    for (const [cls, byTrack] of Object.entries(saved.placements)) {
      if (!byTrack || typeof byTrack !== "object") continue;
      for (const [trackId, placement] of Object.entries(byTrack)) {
        if (typeof placement === "number") (progress.placements[cls] ??= {})[trackId] = placement;
      }
    }
  } else if (saved.completed && typeof saved.completed === "object") {
    for (const [cls, ids] of Object.entries(saved.completed)) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        if (typeof id === "string") (progress.placements[cls] ??= {})[id] = PODIUM_PLACEMENT;
      }
    }
  }
  if (typeof saved.lastClass === "string") progress.lastClass = saved.lastClass;
  if (typeof saved.lastTrack === "string") progress.lastTrack = saved.lastTrack;
  if (typeof saved.lastVehicle === "string") progress.lastVehicle = saved.lastVehicle;
  if (saved.raceMode === "solo" || saved.raceMode === "group") progress.raceMode = saved.raceMode;
  return progress;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseProgress(raw);
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return createProgress();
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable — progress just won't persist
  }
}
