// Audio placeholder surface; the real synth implements the same methods.
import type { Car, CarEvent } from "../sim/car";

export class Sound {
  unlock() {}
  startRace(_theme: string) {}
  beep(_kind: 0 | 1) {}
  lap(_final: boolean) {}
  event(_e: CarEvent) {}
  engine(_speed: number, _car: Car) {}
}
