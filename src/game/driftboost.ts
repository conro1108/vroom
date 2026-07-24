// Drift boost: hold a slide long enough and it banks a kick that fires the
// moment you hook back up and straighten out. This is the drift car's reason to
// exist — sliding costs you grip in the corner and pays you back on the exit.
//
// Nothing here reads input: the drift comes out of the physics (lateral speed
// past driftThreshold), so on a one-thumb phone you earn boosts just by leaning
// on a corner. Same shape as draft.ts, and the caller decides what "boost"
// means, so player and bots stay symmetrical.

export interface DriftBoostState {
  /** Seconds of continuous slide banked toward the next kick. */
  charge: number;
  /** Charge hit the threshold — the kick is now waiting on the drift ending. */
  armed: boolean;
}

export function createDriftBoost(): DriftBoostState {
  return { charge: 0, armed: false };
}

/**
 * Advance the charge; returns true on the step where a banked drift converts to
 * a boost — which is the step the slide *ends*, not the step it fills up. That
 * delay is the whole feel: the payoff lands as you straighten out onto the
 * exit, so it shoves you down the next straight instead of mid-corner.
 *
 * Uncashed charge decays at 2x out of a slide (as slipstream charge does), so
 * the brief grip between two halves of a switchback doesn't wipe your progress,
 * but you can't bank a slide down a long straight either.
 */
export function stepDriftBoost(
  state: DriftBoostState,
  drifting: boolean,
  dt: number,
  chargeSeconds: number
): boolean {
  if (drifting) {
    state.charge += dt;
    if (state.charge >= chargeSeconds) state.armed = true;
    return false;
  }
  if (state.armed) {
    state.charge = 0;
    state.armed = false;
    return true;
  }
  state.charge = Math.max(0, state.charge - dt * 2);
  return false;
}

/** How full the current drift charge is, 0..1 — for the tire-squeal swell and
 *  any future HUD tell. Reads 1 once armed, however long the slide runs on. */
export function driftChargeFrac(state: DriftBoostState, chargeSeconds: number): number {
  if (state.armed) return 1;
  return Math.max(0, Math.min(1, state.charge / Math.max(0.01, chargeSeconds)));
}
