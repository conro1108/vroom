// Turns a Course + Theme into a scene: terrain sculpted around the road, the road
// ribbon with kerbs and verge, barriers, bridges, tunnels, pads, sky, scatter.
// Everything here is built once per race and then static, apart from the pad
// scroll; moving things live in carmodel.ts and fx.ts.
import * as THREE from "three";
import type { Course, Surface } from "../sim/course";
import { noise2, rand } from "./geo";
import { prop } from "./props";
import { THEMES, type Theme } from "./themes";
import "./worlds";

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,0.0); gl_Position = (projectionMatrix * vec4(p.xyz,1.0)).xyww; }`;
const SKY_FRAG = `uniform vec3 top,mid,hor,sunCol; uniform vec3 sunDir; uniform float stars; varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){ vec3 d=normalize(vDir); float t=clamp(d.y,0.,1.);
 vec3 c=mix(hor,mid,smoothstep(0.,.22,t)); c=mix(c,top,smoothstep(.15,.75,t));
 float s=max(dot(d,sunDir),0.); c+=sunCol*(pow(s,420.)*2.+pow(s,14.)*.22);
 if(stars>0.){ vec3 g=floor(d*180.); float n=h(g); c+=vec3(step(.992,n))*(.5+.5*h(g+1.))*stars; }
 gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}`;

const SURFACE_BASE: Partial<Record<Surface, [number, number]>> = {
  dirt: [0xa87a4d, 0xbc8e5e],
  ice: [0xbfe4f4, 0xd8f1fb],
  plank: [0x9c6b3f, 0x875a33],
};

function asphalt(theme: Theme, surface: Surface): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  const [base, speck] = SURFACE_BASE[surface] ?? [theme.road.base, theme.road.speck];
  g.fillStyle = css(base);
  g.fillRect(0, 0, 256, 512);
  const r = rand(5);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() > 0.5 ? css(speck) : "rgba(0,0,0,.05)";
    g.fillRect(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  if (surface === "plank") {
    g.fillStyle = "rgba(0,0,0,.35)";
    for (let y = 0; y < 512; y += 42) g.fillRect(0, y, 256, 4);
  }
  // rubber laid into the racing groove
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.15, "rgba(0,0,0,0)");
  grad.addColorStop(0.5, "rgba(0,0,0,.12)");
  grad.addColorStop(0.85, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  if (surface === "asphalt") {
    g.fillStyle = css(theme.road.line);
    g.fillRect(6, 0, 7, 512);
    g.fillRect(243, 0, 7, 512);
    g.fillRect(125, 40, 6, 180); // dashed centre: the strongest speed cue in the game
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function padTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ff7a00";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#ffe14a";
  for (const y of [0, 64]) {
    g.beginPath();
    g.moveTo(0, y + 34);
    g.lineTo(64, y);
    g.lineTo(128, y + 34);
    g.lineTo(128, y + 62);
    g.lineTo(64, y + 28);
    g.lineTo(0, y + 62);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Strip {
  pos: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  private c = new THREE.Color();
  quad(a: number[], b: number[], d: number[], e: number[], color: number, uvs?: number[][]) {
    this.c.set(color);
    const push = (p: number[], i: number) => {
      this.pos.push(p[0]!, p[1]!, p[2]!);
      this.col.push(this.c.r, this.c.g, this.c.b);
      if (uvs) this.uv.push(uvs[i]![0]!, uvs[i]![1]!);
    };
    // a,b leading edge; d,e trailing edge
    push(a, 0), push(d, 2), push(b, 1), push(b, 1), push(d, 2), push(e, 3);
  }
  mesh(mat: THREE.Material): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
}

export class World {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly theme: Theme;
  private pad?: THREE.Texture;
  private sky: THREE.Mesh;
  private c: Course;
  private bounds = { x0: 0, x1: 0, z0: 0, z1: 0 };

  constructor(c: Course, private scene: THREE.Scene) {
    this.c = c;
    const theme = (this.theme = THEMES[c.def.theme] ?? THEMES.meadow!);
    scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    scene.background = new THREE.Color(theme.fog);

    const hemi = new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
    this.group.add(hemi);
    this.sun = new THREE.DirectionalLight(theme.sun.color, theme.sun.intensity);
    const s = this.sun.shadow;
    s.mapSize.set(1536, 1536);
    s.camera.left = s.camera.bottom = -55;
    s.camera.right = s.camera.top = 55;
    s.camera.near = 1;
    s.camera.far = 320;
    s.bias = -0.0006;
    s.normalBias = 0.05;
    this.sun.castShadow = true;
    this.group.add(this.sun, this.sun.target);

    const sunDir = new THREE.Vector3(...theme.sun.dir).normalize();
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(theme.sky[0]) },
          mid: { value: new THREE.Color(theme.sky[1]) },
          hor: { value: new THREE.Color(theme.sky[2]) },
          sunCol: { value: new THREE.Color(theme.sun.color) },
          sunDir: { value: sunDir },
          stars: { value: theme.stars ? 1 : 0 },
        },
      })
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    this.measure();
    if (theme.ground !== "void") this.terrain();
    if (theme.water !== undefined) this.sea();
    this.road();
    this.barriers();
    this.structures();
    this.pads();
    this.startLine();
    this.scatter();
    this.landmarks();
    this.clouds();
    scene.add(this.group);
  }

  private measure() {
    const c = this.c;
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < c.n; i++) {
      x0 = Math.min(x0, c.x[i]!);
      x1 = Math.max(x1, c.x[i]!);
      z0 = Math.min(z0, c.z[i]!);
      z1 = Math.max(z1, c.z[i]!);
    }
    this.bounds = { x0, x1, z0, z1 };
  }

  private distTo(x: number, z: number): { dist: number; y: number } {
    const c = this.c;
    let best = Infinity;
    let y = 0;
    for (let i = 0; i < c.n; i += 3) {
      if (c.bridge[i] || c.gap[i]) continue;
      const d = (c.x[i]! - x) ** 2 + (c.z[i]! - z) ** 2;
      if (d < best) {
        best = d;
        y = c.y[i]!;
      }
    }
    return { dist: Math.sqrt(best), y };
  }

  private heightAt?: (x: number, z: number) => number;

  private terrain() {
    const { theme, c } = this;
    const b = this.bounds;
    const margin = 300;
    const cell = 7;
    const [x0, z0] = [b.x0 - margin, b.z0 - margin];
    const nx = Math.ceil((b.x1 - b.x0 + margin * 2) / cell);
    const nz = Math.ceil((b.z1 - b.z0 + margin * 2) / cell);
    const noise = noise2(theme.hills.seed);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    const col = new Float32Array((nx + 1) * (nz + 1) * 3);
    const [near, field, far] = theme.groundColors.map((v) => new THREE.Color(v)) as [THREE.Color, THREE.Color, THREE.Color];
    const tmp = new THREE.Color();
    const sstep = (a: number, b2: number, v: number) => {
      const t = Math.max(0, Math.min(1, (v - a) / (b2 - a)));
      return t * t * (3 - 2 * t);
    };
    const water = theme.ground === "water";

    // coarse pass: distance field so hills can open up away from the road
    const heights = new Float32Array((nx + 1) * (nz + 1));
    const sample = (x: number, z: number) => {
      const { dist, y } = this.distTo(x, z);
      const flatten = sstep(c.def.width / 2 + c.def.runoff + 4, c.def.width + c.def.runoff + 46, dist);
      const n = noise(x / 120 + 40, z / 120 + 40, 4) - 0.42;
      const rim = theme.hills.rim * sstep(170, 340, dist);
      let hill = n * theme.hills.amp * 2.2 + rim;
      if (water) hill = -9 - dist * 0.06 + n * 10 + rim * 0.2;
      return { h: y - 0.5 + (hill - (y - 0.5) * 0.5) * flatten, dist };
    };
    let v = 0;
    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix <= nx; ix++, v++) {
        const x = x0 + ix * cell + (ix % 2 ? 0 : 0);
        const z = z0 + iz * cell;
        const { h, dist } = sample(x, z);
        heights[v] = h;
        pos[v * 3] = x;
        pos[v * 3 + 1] = h;
        pos[v * 3 + 2] = z;
        const t = noise(x / 30, z / 30, 2);
        tmp.copy(near).lerp(field, sstep(12, 60, dist + (t - 0.5) * 40));
        tmp.lerp(far, sstep(110, 300, dist + (t - 0.5) * 80));
        const shade = 0.93 + t * 0.14;
        col[v * 3] = tmp.r * shade;
        col[v * 3 + 1] = tmp.g * shade;
        col[v * 3 + 2] = tmp.b * shade;
      }
    }
    const idx: number[] = [];
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = iz * (nx + 1) + ix;
        const [b2, d, e] = [a + 1, a + nx + 1, a + nx + 2];
        if ((ix + iz) % 2) idx.push(a, d, b2, b2, d, e);
        else idx.push(a, d, e, a, e, b2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.receiveShadow = true;
    this.group.add(m);
    this.heightAt = (x, z) => {
      const fx = (x - x0) / cell;
      const fz = (z - z0) / cell;
      const [ix, iz] = [Math.floor(fx), Math.floor(fz)];
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return 0;
      const [u, w] = [fx - ix, fz - iz];
      const at2 = (a: number, b2: number) => heights[b2 * (nx + 1) + a]!;
      return (at2(ix, iz) * (1 - u) + at2(ix + 1, iz) * u) * (1 - w) + (at2(ix, iz + 1) * (1 - u) + at2(ix + 1, iz + 1) * u) * w;
    };
  }

  private sea() {
    const g = new THREE.CircleGeometry(1600, 48);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: this.theme.water!, shininess: 80, specular: 0x88ccff }));
    const b = this.bounds;
    m.position.set((b.x0 + b.x1) / 2, -4, (b.z0 + b.z1) / 2);
    this.group.add(m);
  }

  private road() {
    const { c, theme } = this;
    const strips = new Map<Surface, Strip>();
    const verge = new Strip();
    const kerbs = new Strip();
    const under = new Strip();
    const lift = 0.02;
    const floating = theme.ground === "void";
    const point = (i: number, d: number, up = 0) => {
      const h = c.h[i]!;
      const cl = Math.max(-c.half[i]!, Math.min(c.half[i]!, d));
      return [c.x[i]! - Math.sin(h) * d, c.y[i]! - Math.tan(c.bank[i]!) * cl + up, c.z[i]! + Math.cos(h) * d];
    };
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      if (c.gap[i] || c.gap[j]) continue;
      const [v0, v1] = [(i * c.ds) / 18, ((i + 1) * c.ds) / 18];
      let asph = strips.get(c.surface[i]!);
      if (!asph) strips.set(c.surface[i]!, (asph = new Strip()));
      asph.quad(point(i, -c.half[i]!, lift), point(i, c.half[i]!, lift), point(j, -c.half[j]!, lift), point(j, c.half[j]!, lift), 0xffffff, [
        [0, v0], [1, v0], [0, v1], [1, v1],
      ]);
      // verge sits on top of the terrain so it can never poke through the seam
      if (theme.ground !== "void" && !c.bridge[i]) {
        for (const s of [-1, 1]) {
          const lim = (s < 0 ? c.limL : c.limR)[i]!;
          const lim2 = (s < 0 ? c.limL : c.limR)[j]!;
          const v = (i >> 3) % 2 ? theme.verge : new THREE.Color(theme.verge).multiplyScalar(0.96).getHex();
          const out = lim + 5;
          const out2 = lim2 + 5;
          verge.quad(point(i, s * c.half[i]!, -0.03), point(i, s * out, -0.9), point(j, s * c.half[j]!, -0.03), point(j, s * out2, -0.9), v);
        }
      }
      // kerbs on anything that's really a corner
      const k = Math.abs(c.kappa[i]!);
      if (k > 1 / 95) {
        const stripe = (i >> 1) % 2 ? theme.road.kerbA : theme.road.kerbB;
        for (const s of [-1, 1]) {
          const inner = s === Math.sign(c.kappa[i]!);
          const w = inner ? 1.7 : 1.1;
          const [a, b] = [point(i, s * (c.half[i]! - 0.1), 0.06), point(i, s * (c.half[i]! + w), 0.1)];
          const [d, e] = [point(j, s * (c.half[j]! - 0.1), 0.06), point(j, s * (c.half[j]! + w), 0.1)];
          kerbs.quad(a, b, d, e, stripe);
        }
      }
      if (c.isleHalf[i]! > 0.3) {
        const [a, b, w, w2] = [c.isleD[i]!, c.isleD[j]!, c.isleHalf[i]!, c.isleHalf[j]!];
        kerbs.quad(point(i, a - w, 0.32), point(i, a + w, 0.32), point(j, b - w2, 0.32), point(j, b + w2, 0.32), theme.verge);
        kerbs.quad(point(i, a - w, 0.32), point(i, a - w, 0), point(j, b - w2, 0.32), point(j, b - w2, 0), (i >> 1) % 2 ? theme.road.kerbA : theme.road.kerbB);
        kerbs.quad(point(i, a + w, 0), point(i, a + w, 0.32), point(j, b + w2, 0), point(j, b + w2, 0.32), (i >> 1) % 2 ? theme.road.kerbA : theme.road.kerbB);
      }
      // floating roads and bridges show their thickness
      if (floating || c.bridge[i] || c.voidL[i] || c.voidR[i]) {
        const dark = 0x2c3038;
        const w = c.half[i]! + 0.4;
        const w2 = c.half[j]! + 0.4;
        under.quad(point(i, -w, -1.3), point(i, w, -1.3), point(j, -w2, -1.3), point(j, w2, -1.3), dark);
        under.quad(point(i, -w, 0), point(i, -w, -1.3), point(j, -w2, 0), point(j, -w2, -1.3), dark);
        under.quad(point(i, w, -1.3), point(i, w, 0), point(j, w2, -1.3), point(j, w2, 0), dark);
      }
    }
    for (const [surface, strip] of strips) {
      const mesh = strip.mesh(new THREE.MeshLambertMaterial({ map: asphalt(theme, surface), side: THREE.DoubleSide }));
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    const lam = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const vergeMesh = verge.mesh(lam);
    vergeMesh.receiveShadow = true;
    const kerbMesh = kerbs.mesh(lam);
    kerbMesh.receiveShadow = true;
    this.group.add(vergeMesh, kerbMesh, under.mesh(lam));
  }

  private barriers() {
    const { c, theme } = this;
    const strip = new Strip();
    const h = theme.barrier.height;
    const point = (i: number, d: number, y: number) => {
      const a = c.h[i]!;
      return [c.x[i]! - Math.sin(a) * d, c.y[i]! + y, c.z[i]! + Math.cos(a) * d];
    };
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      if (c.gap[i] || c.gap[j]) continue;
      const col = (i >> 1) % 2 ? theme.barrier.a : theme.barrier.b;
      for (const s of [-1, 1]) {
        const isVoid = (s < 0 ? c.voidL : c.voidR)[i]!;
        if (isVoid) continue;
        const lim = (s < 0 ? c.limL : c.limR)[i]! + 0.3;
        const lim2 = (s < 0 ? c.limL : c.limR)[j]! + 0.3;
        const base = -0.8;
        strip.quad(point(i, s * lim, h), point(i, s * lim, base), point(j, s * lim2, h), point(j, s * lim2, base), col);
        strip.quad(point(i, s * (lim + 0.5), h), point(i, s * lim, h), point(j, s * (lim2 + 0.5), h), point(j, s * lim2, h), 0xd8dde4);
      }
    }
    const m = strip.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
  }

  private structures() {
    const { c } = this;
    const lam = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const rib = new Strip();
    const point = (i: number, d: number, y: number) => {
      const a = c.h[i]!;
      return [c.x[i]! - Math.sin(a) * d, c.y[i]! + y, c.z[i]! + Math.cos(a) * d];
    };
    const pillarGeo = new THREE.CylinderGeometry(0.9, 1.3, 1, 8);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xb9bec8 });
    const spots: { x: number; y: number; z: number; h: number }[] = [];
    const lights: number[] = [];
    for (let i = 0; i < c.n; i++) {
      const j = (i + 1) % c.n;
      if (c.bridge[i] && i % 8 === 0) {
        const ground = this.heightAt?.(c.x[i]!, c.z[i]!) ?? c.y[i]! - 40;
        for (const s of [-1, 1]) {
          const d = s * c.half[i]! * 0.7;
          const a = c.h[i]!;
          spots.push({ x: c.x[i]! - Math.sin(a) * d, y: (c.y[i]! + ground) / 2, z: c.z[i]! + Math.cos(a) * d, h: c.y[i]! - ground });
        }
      }
      if (c.tunnel[i]) {
        const [w, w2] = [c.half[i]! + 1.4, c.half[j]! + 1.4];
        const wall = (i >> 2) % 2 ? 0x5a6170 : 0x4d5462;
        const top = 7;
        rib.quad(point(i, -w, top), point(i, -w, -0.5), point(j, -w2, top), point(j, -w2, -0.5), wall);
        rib.quad(point(i, w, top), point(i, w, -0.5), point(j, w2, top), point(j, w2, -0.5), wall);
        rib.quad(point(i, -w, top), point(i, w, top), point(j, -w2, top), point(j, w2, top), 0x383d48);
        if (i % 9 === 0) lights.push(i);
      }
    }
    if (rib.pos.length) this.group.add(rib.mesh(lam));
    if (spots.length) {
      const m = new THREE.InstancedMesh(pillarGeo, pillarMat, spots.length);
      const o = new THREE.Object3D();
      spots.forEach((s, k) => {
        o.position.set(s.x, s.y, s.z);
        o.scale.set(1, s.h, 1);
        o.updateMatrix();
        m.setMatrixAt(k, o.matrix);
      });
      m.castShadow = true;
      this.group.add(m);
    }
    if (lights.length) {
      const g = new THREE.BoxGeometry(6, 0.15, 0.7);
      const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xfff2c4, fog: false }), lights.length);
      const o = new THREE.Object3D();
      lights.forEach((i, k) => {
        o.position.set(c.x[i]!, c.y[i]! + 6.85, c.z[i]!);
        o.rotation.y = -c.h[i]! + Math.PI / 2;
        o.updateMatrix();
        m.setMatrixAt(k, o.matrix);
      });
      this.group.add(m);
    }
  }

  private pads() {
    const { c } = this;
    const tex = (this.pad = padTexture());
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: true });
    const strip = new Strip();
    const point = (i: number, d: number, up: number) => {
      const a = c.h[i]!;
      return [c.x[i]! - Math.sin(a) * d, c.y[i]! - Math.tan(c.bank[i]!) * d + up, c.z[i]! + Math.cos(a) * d];
    };
    for (const f of c.features) {
      if (f.kind === "rock") {
        const m = new THREE.Mesh(prop("rock"), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
        const a = c.h[f.i]!;
        m.position.set(c.x[f.i]! - Math.sin(a) * f.d, c.y[f.i]!, c.z[f.i]! + Math.cos(a) * f.d);
        m.scale.setScalar(1.2);
        m.castShadow = true;
        this.group.add(m);
        continue;
      }
      const w = 2.4;
      for (let k = -2; k < 2; k++) {
        const i = (f.i + k + c.n) % c.n;
        const j = (i + 1) % c.n;
        const rampUp = f.kind === "kicker" ? [(k + 2) * 0.28, (k + 3) * 0.28] : [0.05, 0.05];
        const v = (u: number) => u / 2;
        strip.quad(point(i, f.d - w, rampUp[0]!), point(i, f.d + w, rampUp[0]!), point(j, f.d - w, rampUp[1]!), point(j, f.d + w, rampUp[1]!), 0xffffff, [
          [0, v(k + 3)], [1, v(k + 3)], [0, v(k + 2)], [1, v(k + 2)],
        ]);
      }
    }
    if (strip.pos.length) this.group.add(strip.mesh(mat));
  }

  private startLine() {
    const { c } = this;
    const w = c.half[0]!;
    const a = c.h[0]!;
    const cvs = document.createElement("canvas");
    cvs.width = 128;
    cvs.height = 16;
    const g = cvs.getContext("2d")!;
    for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? "#111" : "#fff";
      g.fillRect(x * 4, y * 4, 4, 4);
    }
    const t = new THREE.CanvasTexture(cvs);
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 2.2), new THREE.MeshLambertMaterial({ map: t }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -a + Math.PI / 2;
    line.position.set(c.x[0]!, c.y[0]! + 0.04, c.z[0]!);
    line.receiveShadow = true;
    this.group.add(line);

    const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
    const gantry = new THREE.Mesh(prop("gantry"), lam);
    gantry.position.set(c.x[0]!, c.y[0]!, c.z[0]!);
    gantry.rotation.y = -a;
    gantry.scale.z = Math.max(1, (w + 2) / 11);
    gantry.castShadow = true;
    this.group.add(gantry);
  }

  private scatter() {
    const { c, theme } = this;
    if (theme.ground === "void") return;
    const b = this.bounds;
    const r = rand(c.def.id.length * 977 + c.n);
    const margin = 180;
    const area = ((b.x1 - b.x0 + margin * 2) * (b.z1 - b.z0 + margin * 2)) / 10000;
    const sparse: number[] = [];
    for (let i = 0; i < c.n; i += 4) sparse.push(i);
    const lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const o = new THREE.Object3D();
    const color = new THREE.Color();
    for (const rule of theme.props) {
      const tries = Math.min(1600, Math.round(area * rule.density));
      const matrices: THREE.Matrix4[] = [];
      for (let k = 0; k < tries; k++) {
        const x = b.x0 - margin + r() * (b.x1 - b.x0 + margin * 2);
        const z = b.z0 - margin + r() * (b.z1 - b.z0 + margin * 2);
        let min = Infinity;
        for (const i of sparse) {
          const reach = Math.max(c.limL[i]!, c.limR[i]!);
          const d = Math.hypot(c.x[i]! - x, c.z[i]! - z) - reach;
          if (d < min) min = d;
          if (min < rule.near) break;
        }
        if (min < rule.near || min > rule.far) continue;
        const y = this.heightAt?.(x, z) ?? 0;
        if (theme.ground === "water" && y < -3) continue;
        const s = rule.scale[0] + r() * (rule.scale[1] - rule.scale[0]);
        o.position.set(x, y, z);
        o.rotation.set(0, r() * Math.PI * 2, 0);
        o.scale.setScalar(s);
        o.updateMatrix();
        matrices.push(o.matrix.clone());
      }
      if (!matrices.length) continue;
      const m = new THREE.InstancedMesh(prop(rule.kind), lam, matrices.length);
      matrices.forEach((mx, k) => {
        m.setMatrixAt(k, mx);
        color.setHSL(0, 0, 0.88 + r() * 0.24);
        m.setColorAt(k, color);
      });
      m.castShadow = rule.far < 140;
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  private landmarks() {
    const { c } = this;
    const lam = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const l of c.def.landmarks ?? []) {
      const i = Math.floor(l.at * c.n) % c.n;
      const a = c.h[i]!;
      const m = new THREE.Mesh(prop(l.kind), lam);
      const [x, z] = [c.x[i]! - Math.sin(a) * l.side, c.z[i]! + Math.cos(a) * l.side];
      m.position.set(x, this.heightAt?.(x, z) ?? c.y[i]!, z);
      m.rotation.y = -a + (l.yaw ?? 0);
      m.scale.setScalar(l.scale ?? 1);
      m.castShadow = true;
      this.group.add(m);
    }
  }

  private clouds() {
    const { theme } = this;
    if (!theme.clouds) return;
    const g = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: theme.clouds.color, emissive: theme.clouds.color, emissiveIntensity: 0.85, flatShading: true, fog: false });
    const b = this.bounds;
    const r = rand(9);
    const puffs = theme.clouds.count * 5;
    const m = new THREE.InstancedMesh(g, mat, puffs);
    const o = new THREE.Object3D();
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    let k = 0;
    for (let n = 0; n < theme.clouds.count; n++) {
      const ang = r() * Math.PI * 2;
      const rad = 450 + r() * 500;
      const [px, py, pz] = [cx + Math.cos(ang) * rad, 130 + r() * 130, cz + Math.sin(ang) * rad];
      for (let p = 0; p < 5; p++, k++) {
        o.position.set(px + (p - 2) * 26 + r() * 10, py + r() * 8, pz + r() * 18);
        o.scale.set(24 + r() * 26, 10 + r() * 12, 20 + r() * 16);
        o.rotation.y = r() * 3;
        o.updateMatrix();
        m.setMatrixAt(k, o.matrix);
      }
    }
    m.frustumCulled = false;
    this.group.add(m);
  }

  /** Per-frame: shadows follow the car; the sky rides with the camera. */
  update(dt: number, focus: THREE.Vector3, camera: THREE.Camera) {
    const d = new THREE.Vector3(...this.theme.sun.dir).normalize();
    this.sun.position.copy(focus).addScaledVector(d, 160);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camera.position);
    if (this.pad) this.pad.offset.y = (this.pad.offset.y + dt * 1.6) % 1;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
  }
}
