// Per-key press/release/backspace choreography (§6.3, §6.4). Hand-rolled
// timelines (no tween lib): a list of active press events, each summed into
// per-key transient accumulators every frame. All durations divide by animSpeed.

import { Vector3 } from 'three';
import { easeOutBack, easeOutQuad } from '../core/math';
import { rand } from '../core/runtimeRng';
import type { KeyObject } from './keyboard';
import type { Keyboard } from './keyboard';
import type { Style } from '../style/blend';

export interface ParticleSpawner {
  burst(pos: Vector3, count: number, large: boolean, style: Style): void;
  converge(center: Vector3, count: number, style: Style): void;
}

interface PressAnim {
  key: KeyObject;
  start: number;
  v: number;
  large: number; // 0 | 1
  backspace: boolean;
  strength: number; // 1 = full press; <1 = ghost ripple (pulse+flash only)
}

const TAU_FLASH = 0.18;
const TAU_RING = 0.18;

export class KeyAnim {
  private active: PressAnim[] = [];
  private tmp = new Vector3();

  constructor(
    private keyboard: Keyboard,
    private spawner: ParticleSpawner,
    private getStyle: () => Style,
    private qualityMul: () => number,
  ) {}

  press(key: KeyObject, v: number, time: number): void {
    const style = this.getStyle();
    const large = key.def.large ? 1 : 0;

    if (key.def.backspace) {
      this.active.push({ key, start: time, v, large, backspace: true, strength: 1 });
      // converge ring particles inward (§6.4 step 2)
      const count = Math.min(500, Math.round(0.8 * style.pCountBase * this.qualityMul()));
      this.worldCapTop(key, this.tmp);
      this.spawner.converge(this.tmp.clone(), count, style);
      return;
    }

    this.active.push({ key, start: time, v, large, backspace: false, strength: 1 });

    // Explode: spawn burst particles at cap-top center (§6.3)
    const base = style.pCountBase;
    const count = Math.min(
      500,
      Math.round(base * (0.7 + 0.3 * rand()) * (1 + 1.5 * v) * (1 + 0.8 * large) * this.qualityMul()),
    );
    this.worldCapTop(key, this.tmp);
    this.spawner.burst(this.tmp.clone(), count, key.def.large, style);
  }

  private worldCapTop(key: KeyObject, out: Vector3): void {
    out.set(0, key.capTopY, 0);
    key.group.localToWorld(out);
  }

  // Called every frame: reset accumulators, apply active anims, write to meshes.
  update(time: number): void {
    const style = this.getStyle();
    const animSpeed = style.animSpeed;
    const keys = this.keyboard.keys;

    // reset per-key transient state
    for (const k of keys) {
      k.group.position.y = k.restY;
      k.group.scale.setScalar(1);
      k.focusMaterial.opacity = 0;
      k.dissolveAmount = 0;
    }
    const emissiveExtra = new Float32Array(keys.length);
    const keyIndex = new Map<KeyObject, number>();
    keys.forEach((k, i) => keyIndex.set(k, i));

    const stillActive: PressAnim[] = [];
    for (const a of this.active) {
      const rawElapsed = time - a.start;
      if (a.backspace) {
        if (this.applyBackspace(a, rawElapsed, style)) stillActive.push(a);
        continue;
      }
      const speed = animSpeed;
      const e = rawElapsed * speed; // "scaled" elapsed in base-seconds
      const full = a.strength >= 1;
      let alive = false;

      // Travel / Explode / Dissolve: full presses only (ghosts are pulse+flash)
      if (full) {
        // Travel: down over 45ms, back over 240ms (easeOutBack overshoot)
        const depth = style.keyDepth;
        const travelAmt = depth * 0.55 * style.wPress * (1 + 0.25 * a.large);
        if (e < 0.045) {
          a.key.group.position.y = a.key.restY - travelAmt * easeOutQuad(e / 0.045);
          alive = true;
        } else if (e < 0.285) {
          const u = (e - 0.045) / 0.24;
          a.key.group.position.y = a.key.restY - travelAmt * (1 - easeOutBack(u));
          alive = true;
        }
        // Explode: cap scale pop, spring back over 200ms
        if (e < 0.2) {
          const pop = 0.08 * style.wExplode * (1 - easeOutBack(e / 0.2));
          a.key.group.scale.setScalar(1 + pop);
          alive = true;
        }
        // Dissolve: mask 0 -> 0.35*wDissolve -> 0 over 220ms
        if (e < 0.22) {
          const u = e / 0.22;
          a.key.dissolveAmount = Math.max(
            a.key.dissolveAmount,
            0.35 * style.wDissolve * Math.sin(Math.PI * u),
          );
          alive = true;
        }
      }

      // Flash: emissive spike, exp-decay τ=180ms (real time)
      const flashPeak = 1.6 * style.wFlash * (1 + 0.3 * a.v) * a.strength;
      const flash = flashPeak * Math.exp(-rawElapsed / TAU_FLASH);
      if (flash > 0.002) {
        emissiveExtra[keyIndex.get(a.key)!]! += flash;
        alive = true;
      }

      // Focus ring: 0.95 spike, exp-decay τ=180ms
      const ring = 0.95 * a.strength * Math.exp(-rawElapsed / TAU_RING);
      if (ring > 0.01) {
        a.key.focusMaterial.opacity = Math.max(a.key.focusMaterial.opacity, ring);
        alive = true;
      }

      // Pulse: ripple through neighbors within radius
      const radius = 2.2 + 1.0 * a.large;
      for (const nb of keys) {
        if (nb === a.key) continue;
        const dx = nb.def.x - a.key.def.x;
        const dz = nb.def.z - a.key.def.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > radius) continue;
        const delay = 0.018 * d; // seconds (base)
        const en = e - delay;
        if (en < 0 || en > 0.26) continue;
        const bump = Math.sin(Math.PI * (en / 0.26));
        nb.group.position.y += 0.04 * style.wPulse * a.strength * (1 - d / radius) * bump;
        alive = true;
      }

      if (alive) stillActive.push(a);
    }
    this.active = stillActive;

    // write emissive + dissolve
    keys.forEach((k, i) => {
      k.material.emissiveIntensity = k.emissiveBase + emissiveExtra[i]!;
      this.writeDissolve(k);
    });
  }

  // Backspace timeline (§6.4). Returns true while still animating.
  private applyBackspace(a: PressAnim, rawElapsed: number, style: Style): boolean {
    const speed = Math.max(style.animSpeed, 0.8);
    const e = rawElapsed * speed;
    const k = a.key;
    let alive = false;

    // 0-160ms: scale to 1.06 while dissolve sweeps 0->1
    if (e < 0.16) {
      const u = e / 0.16;
      k.group.scale.setScalar(1 + 0.06 * u);
      k.dissolveAmount = Math.max(k.dissolveAmount, u);
      alive = true;
    }
    // hold dissolved briefly between 160 and 300ms
    if (e >= 0.16 && e < 0.3) {
      k.dissolveAmount = Math.max(k.dissolveAmount, 1);
      k.group.scale.setScalar(1.06);
      alive = true;
    }
    // 300-600ms: dissolve sweeps 1->0 (reassemble)
    if (e >= 0.3 && e < 0.6) {
      const u = (e - 0.3) / 0.3;
      k.dissolveAmount = Math.max(k.dissolveAmount, 1 - u);
      k.group.scale.setScalar(1.06 - 0.06 * u);
      alive = true;
    }
    // focus ring flash for the whole thing
    const ring = 0.95 * Math.exp(-rawElapsed / TAU_RING);
    if (ring > 0.01) {
      k.focusMaterial.opacity = Math.max(k.focusMaterial.opacity, ring);
      alive = true;
    }
    this.writeDissolve(k);
    return alive;
  }

  // Ghost ripple (idle): a soft pulse+flash on one key, no sound/particles (§8.2).
  ghost(key: KeyObject, time: number): void {
    this.active.push({
      key,
      start: time,
      v: 0,
      large: key.def.large ? 1 : 0,
      backspace: false,
      strength: 0.4,
    });
  }

  private writeDissolve(k: KeyObject): void {
    const shader = k.material.userData.shader as { uniforms: { uDissolve: { value: number } } } | undefined;
    if (shader) shader.uniforms.uDissolve.value = k.dissolveAmount;
  }
}
