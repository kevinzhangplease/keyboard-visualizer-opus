// Instanced GPU particle pool + emitters (§7.1). One pool of MAX particles; a ring
// cursor overwrites the oldest slot, which naturally caps live particles at the
// pool size (hard guardrail ≤ 6000). Colors are stored per-particle so live
// particles keep their spawn-time colors across a morph (§8.1).

import {
  AdditiveBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { PARTICLES_VERT } from './shaders/particles.vert';
import { PARTICLES_FRAG } from './shaders/particles.frag';
import { rand } from '../core/runtimeRng';
import { oklchToLinearSrgb, type Oklch } from '../style/color';
import { MAX_PARTICLES } from '../style/dials';
import type { Style } from '../style/blend';
import type { ParticleSpawner } from './keyAnim';

const DEG2RAD = Math.PI / 180;

function colFor(style: Style): { a: Oklch; b: Oklch } {
  // §7.1 color rule: S4→S5 for all themes except high-shimmer (Desert): S2→S3.
  if (style.bgShimmer > 0.6) {
    return { a: style.palette[2]!, b: style.palette[3]! };
  }
  return { a: style.palette[4]!, b: style.palette[5]! };
}

export class Particles implements ParticleSpawner {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private cursor = 0;
  private time = 0;

  // per-instance backing arrays
  private aSpawn: Float32Array;
  private aLife: Float32Array;
  private aSeed: Float32Array;
  private aKind: Float32Array;
  private aSize: Float32Array;
  private aPos0: Float32Array;
  private aVel: Float32Array;
  private aTarget: Float32Array;
  private aColA: Float32Array;
  private aColB: Float32Array;
  private attrs: InstancedBufferAttribute[] = [];
  private dirty = false;

  private trailEnabled = true;

  constructor() {
    const N = MAX_PARTICLES;
    this.aSpawn = new Float32Array(N).fill(-1000);
    this.aLife = new Float32Array(N); // 0 => culled
    this.aSeed = new Float32Array(N);
    this.aKind = new Float32Array(N);
    this.aSize = new Float32Array(N);
    this.aPos0 = new Float32Array(N * 3);
    this.aVel = new Float32Array(N * 3);
    this.aTarget = new Float32Array(N * 3);
    this.aColA = new Float32Array(N * 3);
    this.aColB = new Float32Array(N * 3);

    const plane = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute('position', plane.getAttribute('position'));
    geo.setAttribute('uv', plane.getAttribute('uv'));
    geo.instanceCount = N;

    const add = (name: string, arr: Float32Array, size: number): void => {
      const a = new InstancedBufferAttribute(arr, size);
      a.setUsage(35048 /* DynamicDrawUsage */);
      geo.setAttribute(name, a);
      this.attrs.push(a);
    };
    add('aSpawn', this.aSpawn, 1);
    add('aLife', this.aLife, 1);
    add('aSeed', this.aSeed, 1);
    add('aKind', this.aKind, 1);
    add('aSize', this.aSize, 1);
    add('aPos0', this.aPos0, 3);
    add('aVel', this.aVel, 3);
    add('aTarget', this.aTarget, 3);
    add('aColA', this.aColA, 3);
    add('aColB', this.aColB, 3);

    this.material = new ShaderMaterial({
      vertexShader: PARTICLES_VERT,
      fragmentShader: PARTICLES_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGravity: { value: 0 },
        uDrag: { value: 0 },
        uTurbulence: { value: 0 },
        uTrail: { value: 0 },
        uVelocity: { value: 0 },
        uShape: { value: 0 },
        uCamRight: { value: new Vector3(1, 0, 0) },
        uCamUp: { value: new Vector3(0, 1, 0) },
      },
    });

    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  setStyle(style: Style): void {
    const u = this.material.uniforms;
    u.uGravity!.value = style.pGravity;
    u.uDrag!.value = style.pDrag;
    u.uTurbulence!.value = style.pTurbulence;
    u.uTrail!.value = this.trailEnabled ? style.pTrail : 0;
    u.uShape!.value = style.pShape;
  }

  setTrailEnabled(on: boolean): void {
    this.trailEnabled = on;
  }

  update(time: number, velocity: number, camRight: Vector3, camUp: Vector3): void {
    this.time = time;
    const u = this.material.uniforms;
    u.uTime!.value = time;
    u.uVelocity!.value = velocity;
    (u.uCamRight!.value as Vector3).copy(camRight);
    (u.uCamUp!.value as Vector3).copy(camUp);
    if (this.dirty) {
      for (const a of this.attrs) a.needsUpdate = true;
      this.dirty = false;
    }
  }

  private writeParticle(
    i: number,
    pos: Vector3,
    vel: Vector3,
    life: number,
    size: number,
    kind: number,
    target: Vector3 | null,
    colA: Oklch,
    colB: Oklch,
  ): void {
    this.aSpawn[i] = this.time;
    this.aLife[i] = life;
    this.aSeed[i] = rand();
    this.aKind[i] = kind;
    this.aSize[i] = size;
    this.aPos0[i * 3] = pos.x;
    this.aPos0[i * 3 + 1] = pos.y;
    this.aPos0[i * 3 + 2] = pos.z;
    this.aVel[i * 3] = vel.x;
    this.aVel[i * 3 + 1] = vel.y;
    this.aVel[i * 3 + 2] = vel.z;
    const tgt = target ?? pos;
    this.aTarget[i * 3] = tgt.x;
    this.aTarget[i * 3 + 1] = tgt.y;
    this.aTarget[i * 3 + 2] = tgt.z;
    const ca = oklchToLinearSrgb(colA);
    const cb = oklchToLinearSrgb(colB);
    this.aColA[i * 3] = ca.r;
    this.aColA[i * 3 + 1] = ca.g;
    this.aColA[i * 3 + 2] = ca.b;
    this.aColB[i * 3] = cb.r;
    this.aColB[i * 3 + 1] = cb.g;
    this.aColB[i * 3 + 2] = cb.b;
    this.dirty = true;
  }

  private next(): number {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    return i;
  }

  // §6.3 explode: hemisphere burst around +Y from the cap-top center.
  burst(pos: Vector3, count: number, large: boolean, style: Style): void {
    const spawn = Math.min(500, count);
    const { a, b } = colFor(style);
    const coneMax = (20 + 70 * style.pSpread) * DEG2RAD;
    const largeMul = large ? 1.4 : 1;
    const vel = new Vector3();
    for (let n = 0; n < spawn; n++) {
      const cosMax = Math.cos(coneMax);
      const cosT = cosMax + (1 - cosMax) * rand();
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = rand() * Math.PI * 2;
      vel.set(sinT * Math.cos(phi), cosT, sinT * Math.sin(phi));
      const speed = style.pSpeed * (0.6 + 0.8 * rand());
      vel.multiplyScalar(speed);
      const life = style.pLifespan * (0.7 + 0.6 * rand());
      const size = style.pSize * (0.7 + 0.6 * rand()) * largeMul;
      this.writeParticle(this.next(), pos, vel, life, size, 0, null, a, b);
    }
  }

  // §6.4 backspace: ring around the key that converges to center, life 0.42s.
  converge(center: Vector3, count: number, style: Style): void {
    const spawn = Math.min(500, count);
    const { a, b } = colFor(style);
    const vel = new Vector3();
    const pos = new Vector3();
    for (let n = 0; n < spawn; n++) {
      const ang = (n / spawn) * Math.PI * 2 + rand() * 0.2;
      pos.set(center.x + Math.cos(ang) * 1.2, center.y, center.z + Math.sin(ang) * 1.2);
      vel.set(-Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(style.pSpeed * 0.8);
      const size = style.pSize * (0.7 + 0.6 * rand());
      this.writeParticle(this.next(), pos, vel, 0.42, size, 1, center, a, b);
    }
  }

  // §7.1 idle trickle: single soft particle from a key top, slow & long-lived.
  trickle(pos: Vector3, style: Style): void {
    const { a, b } = colFor(style);
    const coneMax = (20 + 70 * style.pSpread) * DEG2RAD;
    const cosMax = Math.cos(coneMax);
    const cosT = cosMax + (1 - cosMax) * rand();
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
    const phi = rand() * Math.PI * 2;
    const vel = new Vector3(sinT * Math.cos(phi), cosT, sinT * Math.sin(phi));
    vel.multiplyScalar(style.pSpeed * 0.4 * (0.6 + 0.8 * rand()));
    const life = style.pLifespan * 1.5 * (0.7 + 0.6 * rand());
    const size = style.pSize * (0.7 + 0.6 * rand());
    this.writeParticle(this.next(), pos, vel, life, size, 0, null, a, b);
  }

  // dev guardrail: count live particles (≤ MAX)
  liveCount(time: number): number {
    let c = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (time - this.aSpawn[i]! <= this.aLife[i]! && this.aLife[i]! > 0) c++;
    }
    return c;
  }
}
