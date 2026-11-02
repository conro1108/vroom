// The car. A chunky rally hatch, lofted rather than boxed, modelled facing +x with
// y=0 at the ground. Each racer gets a body in their colour; everything that moves
// (wheels, body roll, squash, flames) is posed from the sim state in `pose`.
import * as THREE from "three";
import type { Car } from "../sim/car";
import { at, box, cone, cyl, loft, merge, type Geo } from "./geo";

const WHEEL_R = 0.42;
const AXLE_F = 1.12;
const AXLE_R = -1.05;
const TRACK = 0.86;

function bodyGeo(color: number): Geo {
  const hull = loft(
    [
      { x: 1.85, halfW: 0.62, bottom: 0.32, top: 0.55, round: 0.7 },
      { x: 1.7, halfW: 0.82, bottom: 0.26, top: 0.72, round: 0.45 },
      { x: 1.1, halfW: 0.93, bottom: 0.24, top: 0.86, round: 0.35 },
      { x: 0.2, halfW: 0.95, bottom: 0.24, top: 0.92, round: 0.3 },
      { x: -0.9, halfW: 0.96, bottom: 0.24, top: 0.95, round: 0.3 },
      { x: -1.6, halfW: 0.9, bottom: 0.3, top: 0.93, round: 0.4 },
      { x: -1.82, halfW: 0.74, bottom: 0.38, top: 0.82, round: 0.65 },
    ],
    color
  );
  const dark = 0x12151c;
  const glass = 0x1b2b3d;
  const cabin = loft(
    [
      { x: 0.68, halfW: 0.74, bottom: 0.84, top: 0.9, round: 0.4 },
      { x: 0.2, halfW: 0.72, bottom: 0.84, top: 1.42, round: 0.35 },
      { x: -0.7, halfW: 0.71, bottom: 0.84, top: 1.5, round: 0.35 },
      { x: -1.3, halfW: 0.68, bottom: 0.84, top: 1.34, round: 0.4 },
      { x: -1.55, halfW: 0.6, bottom: 0.84, top: 0.98, round: 0.5 },
    ],
    glass
  );
  const roof = loft(
    [
      { x: 0.14, halfW: 0.7, bottom: 1.36, top: 1.46, round: 0.5 },
      { x: -0.72, halfW: 0.7, bottom: 1.44, top: 1.56, round: 0.5 },
      { x: -1.28, halfW: 0.66, bottom: 1.3, top: 1.42, round: 0.5 },
    ],
    color
  );
  return merge([
    hull,
    cabin,
    roof,
    at(box(3.2, 0.2, 1.78, dark), 0, 0.26, 0),
    // bonnet stripes and spoiler: the livery
    at(box(1.3, 0.03, 0.26, 0xffffff), 1.15, 0.87, 0.18, 0, 0, -0.1),
    at(box(1.3, 0.03, 0.26, 0xffffff), 1.15, 0.87, -0.18, 0, 0, -0.1),
    at(box(0.34, 0.06, 1.7, color), -1.72, 1.32, 0),
    at(box(0.3, 0.3, 0.07, dark), -1.68, 1.15, 0.62),
    at(box(0.3, 0.3, 0.07, dark), -1.68, 1.15, -0.62),
    // lamps
    at(box(0.1, 0.16, 0.34, 0xfff6cf), 1.82, 0.56, 0.42),
    at(box(0.1, 0.16, 0.34, 0xfff6cf), 1.82, 0.56, -0.42),
    at(box(0.08, 0.14, 0.42, 0xff2d2d), -1.84, 0.72, 0.44),
    at(box(0.08, 0.14, 0.42, 0xff2d2d), -1.84, 0.72, -0.44),
    // arches
    at(cyl(0.54, 0.54, 0.14, 12, dark), AXLE_F, 0.42, TRACK + 0.04, Math.PI / 2),
    at(cyl(0.54, 0.54, 0.14, 12, dark), AXLE_F, 0.42, -TRACK - 0.04, Math.PI / 2),
    at(cyl(0.54, 0.54, 0.14, 12, dark), AXLE_R, 0.42, TRACK + 0.04, Math.PI / 2),
    at(cyl(0.54, 0.54, 0.14, 12, dark), AXLE_R, 0.42, -TRACK - 0.04, Math.PI / 2),
  ]);
}

function wheelGeo(): Geo {
  return merge([
    at(cyl(WHEEL_R, WHEEL_R, 0.36, 14, 0x1a1c22), 0, 0, 0, Math.PI / 2),
    at(cyl(0.24, 0.24, 0.38, 6, 0xf2f4f7), 0, 0, 0, Math.PI / 2),
    at(box(0.5, 0.09, 0.39, 0x8a8f99), 0, 0, 0),
  ]);
}

const wheelShared = () => (shared ??= wheelGeo());
let shared: Geo | null = null;
const paint = new Map<number, THREE.Material>();

const flameGeo = merge([at(cone(0.17, 1, 7, 0xffffff), 0, 0.5, 0)]);

export class CarModel {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private flameMat = new THREE.MeshBasicMaterial({ color: 0xffa21f, vertexColors: true, fog: false });
  private spin = 0;
  private roll = 0;
  private pitch = 0;
  private squash = 0;
  private squashV = 0;
  private lastSpeed = 0;
  private yawLook = 0;

  constructor(color: number, shadow = true) {
    let mat = paint.get(color);
    if (!mat) {
      mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x667788 });
      paint.set(color, mat);
    }
    const body = new THREE.Mesh(bodyGeo(color), mat);
    body.castShadow = shadow;
    this.body.add(body);
    const wm = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const [x, z] of [[AXLE_F, TRACK], [AXLE_F, -TRACK], [AXLE_R, TRACK], [AXLE_R, -TRACK]] as const) {
      const w = new THREE.Mesh(wheelShared(), wm);
      w.position.set(x, WHEEL_R, z);
      w.rotation.order = "YXZ";
      w.castShadow = shadow;
      this.wheels.push(w);
      this.root.add(w);
    }
    for (const z of [0.35, -0.35]) {
      const f = new THREE.Mesh(flameGeo, this.flameMat);
      f.position.set(-1.86, 0.42, z);
      f.rotation.z = Math.PI / 2;
      f.visible = false;
      this.flames.push(f);
      this.root.add(f);
    }
    this.root.add(this.body);
  }

  bounce(amount: number) {
    this.squashV -= amount;
  }

  /** alpha-blended pose for this frame, from the sim. `x,y,z,h` are interpolated. */
  pose(car: Car, x: number, y: number, z: number, h: number, dt: number, top: number) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = -h;
    const speed = Math.hypot(car.vx, car.vz);
    const fwd = car.vx * Math.cos(h) + car.vz * Math.sin(h);
    this.spin += (fwd / WHEEL_R) * dt;
    const accel = (speed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = speed;

    const sf = Math.min(1, speed / top);
    const lean = car.driftDir !== 0 ? car.driftDir * 0.13 : car.steer * 0.075 * sf;
    this.roll += (lean - this.roll) * Math.min(1, dt * 9);
    const dive = Math.max(-0.07, Math.min(0.05, accel * 0.0018));
    this.pitch += (dive - this.pitch) * Math.min(1, dt * 8);
    this.squashV += (-this.squash * 90 - this.squashV * 11) * dt;
    this.squash += this.squashV * dt;
    this.body.rotation.x = this.roll;
    this.body.rotation.z = this.pitch + (car.grounded ? 0 : Math.max(-0.2, Math.min(0.2, car.vy * 0.02)));
    this.body.scale.set(1 - this.squash * 0.35, 1 + this.squash, 1 - this.squash * 0.35);
    this.body.position.y = this.squash * 0.4;

    const steerVis = car.steer * 0.42;
    this.yawLook += (steerVis - this.yawLook) * Math.min(1, dt * 16);
    this.wheels.forEach((w, k) => {
      w.rotation.y = k < 2 ? -this.yawLook : 0;
      w.rotation.z = -this.spin;
    });

    const lit = car.boostT > 0;
    for (const f of this.flames) {
      f.visible = lit;
      if (lit) f.scale.set(1, 0.9 + Math.random() * 1.4, 1);
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== shared && m.geometry !== flameGeo) m.geometry.dispose();
    });
  }
}
