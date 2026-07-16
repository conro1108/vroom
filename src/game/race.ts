// A race is a fixed number of laps with a split recorded per lap.

export interface RaceState {
  totalLaps: number;
  lap: number; // 1-based lap currently being driven
  splits: number[]; // completed lap times, ms
  finished: boolean;
}

export function createRace(totalLaps: number): RaceState {
  return { totalLaps, lap: 1, splits: [], finished: false };
}

export function completeLap(race: RaceState, lapMs: number): { finished: boolean } {
  if (race.finished) return { finished: true };
  race.splits.push(lapMs);
  if (race.splits.length >= race.totalLaps) {
    race.finished = true;
  } else {
    race.lap += 1;
  }
  return { finished: race.finished };
}

export function raceTotalMs(race: RaceState): number {
  return race.splits.reduce((a, b) => a + b, 0);
}

export function bestSplitIndex(race: RaceState): number {
  let best = 0;
  for (let i = 1; i < race.splits.length; i++) {
    if (race.splits[i]! < race.splits[best]!) best = i;
  }
  return best;
}
