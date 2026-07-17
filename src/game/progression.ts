// Speed classes and cup unlocking. Each class is its own progression: cup
// placements are recorded per cup per class, and each cup's unlock rules (in
// the CUPS catalog) decide what result opens it — any one satisfied rule is
// enough, so the progression is a graph, not a line.
import { CUPS, cupById, type CupDef } from "./cups";
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

// Solo vs group is a binary switch, not two independent toggles: solo runs
// the cup's tracks alone against your ghosts (no AI, no placement), group
// races the full field and is what placement-gated unlocks require.
export type RaceMode = "solo" | "group";

export interface Progress {
  /** classId -> cupId -> best cup placement (1 = win) in that class */
  cups: Record<string, Record<string, number>>;
  lastClass: string;
  lastCup: string;
  lastVehicle: string;
  raceMode: RaceMode;
}

export function createProgress(): Progress {
  return {
    cups: {},
    lastClass: SPEED_CLASSES[0]!.id,
    lastCup: CUPS[0]!.id,
    lastVehicle: VEHICLES[0]!.id,
    raceMode: "group",
  };
}

export function bestCupPlacement(progress: Progress, classId: string, cupId: string): number | null {
  return progress.cups[classId]?.[cupId] ?? null;
}

function ruleSatisfied(progress: Progress, classId: string, rule: { cup: string; result: string }): boolean {
  const best = bestCupPlacement(progress, classId, rule.cup);
  if (best === null) return false;
  return rule.result === "win" ? best === 1 : best <= PODIUM_PLACEMENT;
}

export function isCupUnlocked(progress: Progress, classId: string, cupId: string): boolean {
  const rules = cupById(cupId).unlock;
  if (!rules || rules.length === 0) return true;
  return rules.some((rule) => ruleSatisfied(progress, classId, rule));
}

/**
 * Record a finished cup. Returns the cup defs newly unlocked by this result
 * (a win can satisfy several rules at once).
 */
export function recordCupResult(
  progress: Progress,
  classId: string,
  cupId: string,
  placement: number
): CupDef[] {
  const lockedBefore = CUPS.filter((c) => !isCupUnlocked(progress, classId, c.id));
  const byCup = (progress.cups[classId] ??= {});
  byCup[cupId] = Math.min(byCup[cupId] ?? Infinity, placement);
  return lockedBefore.filter((c) => isCupUnlocked(progress, classId, c.id));
}

const STORAGE_KEY = "vroom.progress.v1";

/**
 * Parse a saved blob. Older shapes stored per-track placements (and before
 * that a finished-track list); both migrate onto the cup containing the
 * track, keeping the best placement earned on any of its tracks.
 */
export function parseProgress(raw: string): Progress {
  const progress = createProgress();
  const saved = JSON.parse(raw) as Partial<Progress> & {
    placements?: Record<string, Record<string, number>>;
    completed?: Record<string, string[]>;
    lastTrack?: string;
  };

  const cupOfTrack = (trackId: string): string | null =>
    CUPS.find((c) => c.trackIds.includes(trackId))?.id ?? null;
  const migrate = (classId: string, trackId: string, placement: number) => {
    const cupId = cupOfTrack(trackId);
    if (!cupId) return;
    const byCup = (progress.cups[classId] ??= {});
    byCup[cupId] = Math.min(byCup[cupId] ?? Infinity, placement);
  };

  if (saved.cups && typeof saved.cups === "object") {
    for (const [cls, byCup] of Object.entries(saved.cups)) {
      if (!byCup || typeof byCup !== "object") continue;
      for (const [cupId, placement] of Object.entries(byCup)) {
        if (typeof placement === "number") (progress.cups[cls] ??= {})[cupId] = placement;
      }
    }
  } else if (saved.placements && typeof saved.placements === "object") {
    for (const [cls, byTrack] of Object.entries(saved.placements)) {
      if (!byTrack || typeof byTrack !== "object") continue;
      for (const [trackId, placement] of Object.entries(byTrack)) {
        if (typeof placement === "number") migrate(cls, trackId, placement);
      }
    }
  } else if (saved.completed && typeof saved.completed === "object") {
    for (const [cls, ids] of Object.entries(saved.completed)) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        if (typeof id === "string") migrate(cls, id, PODIUM_PLACEMENT);
      }
    }
  }

  if (typeof saved.lastClass === "string") progress.lastClass = saved.lastClass;
  if (typeof saved.lastCup === "string") progress.lastCup = saved.lastCup;
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
