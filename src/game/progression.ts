// Speed classes and track unlocking. Each class is its own progression:
// finishing a track's full race in a class unlocks the next track in that
// class. Track order comes from the TRACKS catalog.
import { TRACKS } from "./tracks";
import type { Tuning } from "./tuning";

export const RACE_LAPS = 3;

export interface SpeedClass {
  id: string;
  label: string;
  /** Scales maxSpeed/accel/brake; turn rate scales by sqrt so corners get harder but stay possible. */
  mult: number;
}

export const SPEED_CLASSES: SpeedClass[] = [
  { id: "100", label: "100cc", mult: 1 },
  { id: "150", label: "150cc", mult: 1.22 },
  { id: "200", label: "200cc", mult: 1.45 },
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

export interface Progress {
  /** classId -> trackIds whose full race has been finished in that class */
  completed: Record<string, string[]>;
  lastClass: string;
  lastTrack: string;
}

export function createProgress(): Progress {
  return { completed: {}, lastClass: SPEED_CLASSES[0]!.id, lastTrack: TRACKS[0]!.id };
}

export function isTrackUnlocked(progress: Progress, classId: string, trackIndex: number): boolean {
  if (trackIndex <= 0) return true;
  const prev = TRACKS[trackIndex - 1];
  if (!prev) return false;
  return (progress.completed[classId] ?? []).includes(prev.id);
}

/**
 * Record a finished race. Returns the track def newly unlocked by this
 * completion, or null if it unlocked nothing new.
 */
export function markRaceCompleted(progress: Progress, classId: string, trackId: string) {
  const index = TRACKS.findIndex((t) => t.id === trackId);
  const next = TRACKS[index + 1] ?? null;
  const wasNextUnlocked = next ? isTrackUnlocked(progress, classId, index + 1) : true;
  const list = (progress.completed[classId] ??= []);
  if (!list.includes(trackId)) list.push(trackId);
  return wasNextUnlocked ? null : next;
}

const STORAGE_KEY = "vroom.progress.v1";

export function loadProgress(): Progress {
  const progress = createProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Progress>;
      if (saved.completed && typeof saved.completed === "object") {
        for (const [cls, ids] of Object.entries(saved.completed)) {
          if (Array.isArray(ids)) progress.completed[cls] = ids.filter((v) => typeof v === "string");
        }
      }
      if (typeof saved.lastClass === "string") progress.lastClass = saved.lastClass;
      if (typeof saved.lastTrack === "string") progress.lastTrack = saved.lastTrack;
    }
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return progress;
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable — progress just won't persist
  }
}
