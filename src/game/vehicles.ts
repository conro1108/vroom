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

export const VEHICLES: Vehicle[] = [
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
      maxSpeed: 138,
      accel: 215,
      brake: 380,
      drag: 60,
      turnRate: 3.3,
      speedTurnFalloff: 0.18,
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
      maxSpeed: 147,
      accel: 185,
      brake: 280,
      drag: 50,
      turnRate: 3.9,
      speedTurnFalloff: 0.08,
      steerResponse: 11,
      lateralGrip: 4.5,
      driftGrip: 2.5,
      driftThreshold: 40,
    },
  },
  {
    id: "gokart",
    name: "Go-Kart",
    blurb: "darty and instant, wins the hairpins",
    values: {
      maxSpeed: 136,
      accel: 280,
      brake: 430,
      drag: 70,
      turnRate: 4.6,
      speedTurnFalloff: 0.03,
      steerResponse: 18,
      lateralGrip: 8.5,
      driftGrip: 3,
      driftThreshold: 60,
    },
  },
  {
    id: "muscle",
    name: "Muscle",
    blurb: "huge top end, a handful at speed",
    values: {
      maxSpeed: 151,
      accel: 135,
      brake: 270,
      drag: 40,
      turnRate: 2.9,
      speedTurnFalloff: 0.32,
      steerResponse: 7.5,
      lateralGrip: 5.5,
      driftGrip: 2.2,
      driftThreshold: 55,
    },
  },
  {
    id: "cruiser",
    name: "Cruiser",
    blurb: "smooth and floaty, carries speed",
    values: {
      maxSpeed: 144,
      accel: 160,
      brake: 260,
      drag: 30,
      turnRate: 3.0,
      speedTurnFalloff: 0.18,
      steerResponse: 6.5,
      lateralGrip: 7,
      driftGrip: 3,
      driftThreshold: 70,
    },
  },
];

export function vehicleById(id: string): Vehicle {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]!;
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
