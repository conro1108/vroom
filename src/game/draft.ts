// Slipstream: sit close behind another car at speed and a charge builds;
// a full charge converts into a short speed boost. Pure logic — the caller
// decides what "boost" means (main.ts and opponents.ts both use it), which
// keeps the catch-up dynamic symmetrical for player and bots.
import type { CarState } from "./physics";

export interface DraftState {
  /** Seconds of slipstream accumulated toward the next boost. */
  charge: number;
}

export function createDraft(): DraftState {
  return { charge: 0 };
}

// Within ~30° of straight ahead counts as "behind" the leader.
const ALIGN_MIN = 0.86;

/** True when `follower` sits in a leader's slipstream: close, roughly behind it, and at speed. */
export function inSlipstream(
  follower: CarState,
  leader: { x: number; y: number },
  rangePx: number,
  minSpeed: number
): boolean {
  const dx = leader.x - follower.x;
  const dy = leader.y - follower.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0 || dist > rangePx) return false;
  if (Math.hypot(follower.vx, follower.vy) < minSpeed) return false;
  const align = (dx / dist) * Math.cos(follower.heading) + (dy / dist) * Math.sin(follower.heading);
  return align > ALIGN_MIN;
}

/**
 * Advance the charge; returns true on the step where a full charge converts
 * to a boost. Charge decays at 2x when out of the stream, so a brief wiggle
 * around the leader doesn't zero your progress but you can't bank it forever.
 */
export function stepDraft(
  state: DraftState,
  drafting: boolean,
  dt: number,
  chargeSeconds: number
): boolean {
  if (!drafting) {
    state.charge = Math.max(0, state.charge - dt * 2);
    return false;
  }
  state.charge += dt;
  if (state.charge >= chargeSeconds) {
    state.charge = 0;
    return true;
  }
  return false;
}
