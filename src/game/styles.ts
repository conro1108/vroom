// Driving styles: named bundles of the handling levers in Tuning. A style is
// a coarse personality; the advanced sliders still fine-tune on top of it.
// Styles deliberately leave control preferences (steer mode, hold-to-go),
// camera, and offroad values alone.
import type { Tuning } from "./tuning";

export type StyleKey =
  | "maxSpeed"
  | "accel"
  | "brake"
  | "drag"
  | "turnRate"
  | "speedTurnFalloff"
  | "steerResponse"
  | "lateralGrip"
  | "driftGrip"
  | "driftThreshold";

export interface DrivingStyle {
  id: string;
  name: string;
  blurb: string;
  values: Record<StyleKey, number>;
}

export const DRIVING_STYLES: DrivingStyle[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "the house blend — loose but friendly",
    values: {
      maxSpeed: 140,
      accel: 180,
      brake: 300,
      drag: 55,
      turnRate: 3.4,
      speedTurnFalloff: 0.15,
      steerResponse: 12,
      lateralGrip: 6,
      driftGrip: 2.4,
      driftThreshold: 55,
    },
  },
  {
    id: "slotcar",
    name: "Slot Car",
    blurb: "glued to the road, point and shoot",
    values: {
      maxSpeed: 150,
      accel: 205,
      brake: 360,
      drag: 60,
      turnRate: 3.2,
      speedTurnFalloff: 0.25,
      steerResponse: 16,
      lateralGrip: 11,
      driftGrip: 6,
      driftThreshold: 90,
    },
  },
  {
    id: "driftking",
    name: "Drift King",
    blurb: "corners are for going sideways",
    values: {
      maxSpeed: 145,
      accel: 190,
      brake: 280,
      drag: 50,
      turnRate: 3.8,
      speedTurnFalloff: 0.1,
      steerResponse: 10,
      lateralGrip: 3.5,
      driftGrip: 1.6,
      driftThreshold: 35,
    },
  },
  {
    id: "gokart",
    name: "Go-Kart",
    blurb: "darty and instant, low top end",
    values: {
      maxSpeed: 120,
      accel: 260,
      brake: 420,
      drag: 70,
      turnRate: 4.6,
      speedTurnFalloff: 0.05,
      steerResponse: 18,
      lateralGrip: 8,
      driftGrip: 3,
      driftThreshold: 60,
    },
  },
  {
    id: "muscle",
    name: "Muscle",
    blurb: "big top speed, heavy tail, long slides",
    values: {
      maxSpeed: 185,
      accel: 150,
      brake: 260,
      drag: 40,
      turnRate: 2.8,
      speedTurnFalloff: 0.3,
      steerResponse: 8,
      lateralGrip: 4.5,
      driftGrip: 1.8,
      driftThreshold: 50,
    },
  },
  {
    id: "cruiser",
    name: "Cruiser",
    blurb: "smooth, floaty, unhurried",
    values: {
      maxSpeed: 115,
      accel: 140,
      brake: 240,
      drag: 35,
      turnRate: 3.0,
      speedTurnFalloff: 0.2,
      steerResponse: 6,
      lateralGrip: 7,
      driftGrip: 3,
      driftThreshold: 70,
    },
  },
];

export function applyStyle(tuning: Tuning, style: DrivingStyle): void {
  Object.assign(tuning, style.values);
}

/** The style whose values the tuning currently matches exactly, if any. */
export function activeStyleId(tuning: Tuning): string | null {
  for (const style of DRIVING_STYLES) {
    if (
      (Object.keys(style.values) as StyleKey[]).every((k) => tuning[k] === style.values[k])
    ) {
      return style.id;
    }
  }
  return null;
}
