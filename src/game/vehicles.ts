// Vehicles: each one is a handling personality (the physics levers in Tuning)
// paired with its own sprite in render/sprites.ts. Picking a vehicle writes
// its handling values into the shared Tuning object, so the dev panel's
// advanced sliders still fine-tune on top. Vehicles deliberately leave
// control preferences (steer mode, hold-to-go), camera, and offroad values
// alone.
//
// Balance is enforced by vehicles.test.ts: a bot driver laps every track in
// every vehicle, and they all have to stay competitive.
import type { Tuning } from "./tuning";

export type VehicleKey =
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

export interface Vehicle {
  id: string;
  name: string;
  blurb: string;
  values: Record<VehicleKey, number>;
}

// The field is tuned tight. Slot Car and Go-Kart are the reference points at
// the grippy end and Drift King is the reference at the loose end; everything
// else is placed between them. "Loose" means low grip and an early break-point,
// never vague steering — every car here gets quick steer response and modest
// turn falloff, because a car that doesn't go where you point it isn't a
// personality, it's a bad car.
//
// Low grip is a real choice, not a handicap, because a slide banks a drift
// boost (game/driftboost.ts): an early driftThreshold breaks the tail loose
// often and the corner exits pay it back. The balance sim bears this out — the
// cars that can't slide have to buy their pace with grip, brakes and accel
// instead, and the totals land within a few percent of each other either way.
//
// Watch the middle ground when retuning: a car with too much grip to slide
// usefully but not enough to stay planted is the one place that measures badly
// in imperfect hands. Commit to one end or the other.
export const VEHICLES: Vehicle[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "the house blend — loose enough to slide",
    values: {
      maxSpeed: 142,
      accel: 200,
      brake: 320,
      drag: 52,
      turnRate: 3.7,
      speedTurnFalloff: 0.12,
      steerResponse: 13.5,
      // The starter car has to be able to play the same game the specialists
      // do: it broke loose late enough that a player never banked the drift
      // boosts the field lives on, which read as "I can't win in the base car".
      lateralGrip: 6.2,
      driftGrip: 2.6,
      driftThreshold: 43,
    },
  },
  {
    id: "slotcar",
    name: "Slot Car",
    blurb: "glued to the road, point and shoot",
    values: {
      maxSpeed: 140,
      accel: 225,
      brake: 390,
      drag: 60,
      turnRate: 3.6,
      speedTurnFalloff: 0.12,
      steerResponse: 17,
      lateralGrip: 12,
      driftGrip: 6,
      driftThreshold: 95,
    },
  },
  {
    id: "driftking",
    name: "Drift King",
    blurb: "corners are for going sideways",
    values: {
      maxSpeed: 142,
      accel: 178,
      brake: 285,
      drag: 52,
      turnRate: 3.8,
      speedTurnFalloff: 0.08,
      steerResponse: 12,
      lateralGrip: 5,
      driftGrip: 2.6,
      driftThreshold: 42,
    },
  },
  {
    id: "gokart",
    name: "Go-Kart",
    blurb: "darty and instant, wins the hairpins",
    values: {
      maxSpeed: 140,
      accel: 285,
      brake: 430,
      drag: 58,
      turnRate: 4.2,
      speedTurnFalloff: 0.2,
      steerResponse: 18,
      lateralGrip: 9.5,
      driftGrip: 3.2,
      driftThreshold: 62,
    },
  },
  {
    id: "muscle",
    name: "Muscle",
    blurb: "biggest top end, slowest to wind up",
    values: {
      maxSpeed: 148,
      accel: 175,
      brake: 350,
      drag: 50,
      turnRate: 4,
      speedTurnFalloff: 0.1,
      steerResponse: 12.5,
      lateralGrip: 6.8,
      driftGrip: 2.6,
      driftThreshold: 48,
    },
  },
  {
    id: "cruiser",
    name: "Cruiser",
    blurb: "coasts forever, carries speed everywhere",
    values: {
      maxSpeed: 145,
      accel: 205,
      brake: 350,
      drag: 36,
      turnRate: 3.8,
      speedTurnFalloff: 0.09,
      steerResponse: 12.5,
      lateralGrip: 7,
      driftGrip: 2.8,
      driftThreshold: 48,
    },
  },
];

export function vehicleById(id: string): Vehicle {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]!;
}

// --- the custom car: one persisted, user-respec'd slot, kept apart from the
// balanced base vehicles above. Calibration writes here; the menu offers a
// dedicated tile plus a revert-to-starting-point button. No history — the
// last save is the only save.

export const CUSTOM_VEHICLE_ID = "custom";
const CUSTOM_STORAGE_KEY = "vroom.customVehicle.v1";

/** The starting point for a fresh (or reverted) custom car: the mean of the base vehicles. */
function meanVehicleValues(): Record<VehicleKey, number> {
  const keys = Object.keys(VEHICLES[0]!.values) as VehicleKey[];
  const mean = {} as Record<VehicleKey, number>;
  for (const key of keys) {
    const sum = VEHICLES.reduce((s, v) => s + v.values[key], 0);
    mean[key] = Math.round((sum / VEHICLES.length) * 100) / 100;
  }
  return mean;
}

function loadCustomValues(): Record<VehicleKey, number> {
  const values = meanVehicleValues();
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<VehicleKey, number>>;
      for (const key of Object.keys(values) as VehicleKey[]) {
        if (typeof saved[key] === "number") values[key] = saved[key]!;
      }
    }
  } catch {
    // corrupt or unavailable storage: fall back to the mean
  }
  return values;
}

export function loadCustomVehicle(): Vehicle {
  return {
    id: CUSTOM_VEHICLE_ID,
    name: "Custom",
    blurb: "yours — respec any time",
    values: loadCustomValues(),
  };
}

export function saveCustomVehicle(values: Record<VehicleKey, number>): void {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // storage unavailable (private mode etc.) — it just won't persist
  }
}

/** Revert the custom car to its starting point (the mean of the base vehicles). */
export function resetCustomVehicle(): Vehicle {
  const values = meanVehicleValues();
  saveCustomVehicle(values);
  return { id: CUSTOM_VEHICLE_ID, name: "Custom", blurb: "yours — respec any time", values };
}

export function applyVehicle(tuning: Tuning, vehicle: Vehicle): void {
  Object.assign(tuning, vehicle.values);
}

/** The vehicle whose handling the tuning currently matches exactly, if any. */
export function activeVehicleId(tuning: Tuning): string | null {
  for (const vehicle of VEHICLES) {
    if (
      (Object.keys(vehicle.values) as VehicleKey[]).every((k) => tuning[k] === vehicle.values[k])
    ) {
      return vehicle.id;
    }
  }
  return null;
}
