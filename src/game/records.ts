// Persistent course records: best single lap and best full-race total, kept
// per (track, speed class) so each combination has its own leaderboard slot.

export interface TrackRecords {
  bestLapMs: number | null;
  bestRaceMs: number | null;
}

export type Records = Record<string, TrackRecords>;

export function recordKey(trackId: string, classId: string): string {
  return `${trackId}:${classId}`;
}

export function getRecords(records: Records, trackId: string, classId: string): TrackRecords {
  return records[recordKey(trackId, classId)] ?? { bestLapMs: null, bestRaceMs: null };
}

/** Returns true when this lap beats the stored best (and stores it). */
export function applyLap(records: Records, trackId: string, classId: string, lapMs: number): boolean {
  const key = recordKey(trackId, classId);
  const entry = (records[key] ??= { bestLapMs: null, bestRaceMs: null });
  if (entry.bestLapMs !== null && lapMs >= entry.bestLapMs) return false;
  entry.bestLapMs = lapMs;
  return true;
}

/** Returns true when this race total beats the stored best (and stores it). */
export function applyRace(records: Records, trackId: string, classId: string, totalMs: number): boolean {
  const key = recordKey(trackId, classId);
  const entry = (records[key] ??= { bestLapMs: null, bestRaceMs: null });
  if (entry.bestRaceMs !== null && totalMs >= entry.bestRaceMs) return false;
  entry.bestRaceMs = totalMs;
  return true;
}

const STORAGE_KEY = "vroom.records.v1";

export function loadRecords(): Records {
  const records: Records = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Records;
      for (const [key, entry] of Object.entries(saved)) {
        const lap = entry?.bestLapMs;
        const race = entry?.bestRaceMs;
        records[key] = {
          bestLapMs: typeof lap === "number" && lap > 0 ? lap : null,
          bestRaceMs: typeof race === "number" && race > 0 ? race : null,
        };
      }
    }
  } catch {
    // corrupt or unavailable storage: start fresh
  }
  return records;
}

export function saveRecords(records: Records): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // storage unavailable — records just won't persist
  }
}
