// Moment-to-moment juice: smoke and dust puffs, drift sparks, skid marks, speed
// lines, confetti. All pooled up front; nothing allocates per frame.
import * as THREE from "three";

const TIER_COLOR = [0xffffff, 0x4cc9ff, 0xff9f1c, 0xff4dc4];

interface Bit {
  life: number;
  max: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number;
  grow: number;
  g: number;
}

class Pool {
  readonly mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private next = 0;
  private o = new THREE.Object3D();
  private col = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.col.set(0xffffff));
    for (let i = 0; i < cap; i++) {
      this.bits.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, grow: 0, g: 0 });
      this.o.scale.setScalar(0);
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    }
  }

  spawn(b: Partial<Bit> & { x: number; y: number; z: number }, color: number) {
    const k = this.next;
    this.next = (k + 1) % this.cap;
    const bit = this.bits[k]!;
    Object.assign(bit, { vx: 0, vy: 0, vz: 0, size: 0.4, grow: 1, g: 0, life: 0.5, max: b.life ?? 0.5 }, b);
    this.mesh.setColorAt(k, this.col.set(color));
    this.mesh.instanceColor!.needsUpdate = true;
  }

  step(dt: number) {
    const o = this.o;
    for (let i = 0; i < this.cap; i++) {
      const b = this.bits[i]!;
      if (b.life <= 0) continue;
      b.life -= dt;
      b.vy -= b.g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.size += b.grow * dt;
      const u = Math.max(0, b.life / b.max);
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(b.life * 3, b.life * 2, 0);
      o.scale.setScalar(b.life > 0 ? b.size * Math.min(1, u * 2.2) : 0);
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const MAX_SKID = 700;

class Skids {
  readonly mesh: THREE.Mesh;
  private pos = new Float32Array(MAX_SKID * 6 * 3);
  private k = 0;
  private last = new Map<string, { ax: number; ay: number; az: number; bx: number; by: number; bz: number }>();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: 0x0c0c10, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    this.mesh.frustumCulled = false;
  }

  mark(key: string, x: number, y: number, z: number, h: number) {
    const [nx, nz] = [-Math.sin(h) * 0.17, Math.cos(h) * 0.17];
    const cur = { ax: x - nx, ay: y + 0.05, az: z - nz, bx: x + nx, by: y + 0.05, bz: z + nz };
    const prev = this.last.get(key);
    this.last.set(key, cur);
    if (!prev || Math.hypot(prev.ax - cur.ax, prev.az - cur.az) > 3) return;
    const p = this.pos;
    let i = this.k * 18;
    for (const v of [prev.ax, prev.ay, prev.az, cur.ax, cur.ay, cur.az, prev.bx, prev.by, prev.bz, prev.bx, prev.by, prev.bz, cur.ax, cur.ay, cur.az, cur.bx, cur.by, cur.bz]) {
      p[i++] = v;
    }
    this.k = (this.k + 1) % MAX_SKID;
    (this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  lift(key: string) {
    this.last.delete(key);
  }
}

export class Fx {
  readonly group = new THREE.Group();
  private puffs: Pool;
  private sparks: Pool;
  private skids = new Skids();
  private lines: THREE.InstancedMesh;
  private lineMat: THREE.MeshBasicMaterial;
  private seeds: { a: number; r: number; z: number }[] = [];
  private o = new THREE.Object3D();

  constructor(scene: THREE.Scene, private camera: THREE.Camera) {
    this.puffs = new Pool(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), 220);
    this.sparks = new Pool(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: false }), 180);
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 3.4), this.lineMat, 46);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 10;
    for (let i = 0; i < 46; i++) this.seeds.push({ a: Math.random() * Math.PI * 2, r: 3 + Math.random() * 3, z: -Math.random() * 30 });
    this.group.add(this.puffs.mesh, this.sparks.mesh, this.skids.mesh, this.lines);
    scene.add(this.group);
  }

  dust(x: number, y: number, z: number, color: number, vx = 0, vz = 0, size = 0.32) {
    this.puffs.spawn(
      { x: x + (Math.random() - 0.5) * 0.4, y: y + 0.2, z: z + (Math.random() - 0.5) * 0.4, vx: vx * 0.2 + (Math.random() - 0.5), vy: 0.8 + Math.random(), vz: vz * 0.2 + (Math.random() - 0.5), size, grow: 2.2, life: 0.6 + Math.random() * 0.3 },
      color
    );
  }

  spark(x: number, y: number, z: number, tier: number, vx = 0, vz = 0) {
    this.sparks.spawn(
      { x, y: y + 0.15, z, vx: vx * 0.3 + (Math.random() - 0.5) * 7, vy: 2 + Math.random() * 5, vz: vz * 0.3 + (Math.random() - 0.5) * 7, size: 0.1 + Math.random() * 0.07, grow: -0.1, g: 16, life: 0.3 + Math.random() * 0.25 },
      TIER_COLOR[tier] ?? 0xffffff
    );
  }

  burst(x: number, y: number, z: number, n: number, tier: number) {
    for (let i = 0; i < n; i++) this.spark(x, y + 0.3, z, tier);
  }

  impact(x: number, y: number, z: number, hit: number) {
    for (let i = 0; i < 8 + hit * 16; i++) this.spark(x, y + 0.4, z, 2);
  }

  confetti(x: number, y: number, z: number) {
    const colors = [0xff5a5f, 0xffd166, 0x4cc9f0, 0x7bd389, 0xffffff];
    for (let i = 0; i < 90; i++) {
      this.sparks.spawn(
        { x: x + (Math.random() - 0.5) * 6, y: y + 2 + Math.random() * 3, z: z + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 14, vy: 7 + Math.random() * 9, vz: (Math.random() - 0.5) * 14, size: 0.16, grow: 0, g: 11, life: 1.6 + Math.random() },
        colors[i % 5]!
      );
    }
  }

  skid(key: string, x: number, y: number, z: number, h: number) {
    this.skids.mark(key, x, y, z, h);
  }

  skidEnd(key: string) {
    this.skids.lift(key);
  }

  /** speed 0..1+, boost true = full-strength streaks */
  update(dt: number, speed: number, boost: boolean) {
    this.puffs.step(dt);
    this.sparks.step(dt);
    const target = boost ? 0.4 : Math.max(0, speed - 0.97) * 0.8;
    this.lineMat.opacity += (target - this.lineMat.opacity) * Math.min(1, dt * 8);
    this.lines.visible = this.lineMat.opacity > 0.01;
    if (!this.lines.visible) return;
    const o = this.o;
    this.seeds.forEach((s, i) => {
      s.z += dt * (boost ? 70 : 50);
      if (s.z > 2) s.z = -30;
      o.position.set(Math.cos(s.a) * s.r, Math.sin(s.a) * s.r * 0.75, s.z);
      o.applyQuaternion(new THREE.Quaternion());
      o.position.applyQuaternion(this.camera.quaternion).add(this.camera.position);
      o.quaternion.copy(this.camera.quaternion);
      o.updateMatrix();
      this.lines.setMatrixAt(i, o.matrix);
    });
    this.lines.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
  }
}
