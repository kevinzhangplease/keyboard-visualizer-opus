// Idle / hero behaviors (§8.2): breathing keys, drift scale, particle trickle,
// ghost ripples, and the once-per-session "press any key" invitation lifecycle.

import { Vector3 } from 'three';
import { rand, randRange } from '../core/runtimeRng';
import type { Keyboard } from '../render/keyboard';
import type { KeyAnim } from '../render/keyAnim';
import type { Particles } from '../render/particles';
import type { Style } from '../style/blend';
import { oklchToCss } from '../style/color';

const IDLE_AFTER = 12; // seconds

export class Idle {
  private lastPress = -1000;
  private firstPressDone = false;
  private idleAmount = 1; // 1 = fully idle
  private trickleAccum = 0;
  private nextGhostAt = 8;
  private wasIdle = false;
  private tmp = new Vector3();
  reducedMotion = false;

  constructor(
    private keyboard: Keyboard,
    private particles: Particles,
    private keyAnim: KeyAnim,
    private hintEl: HTMLElement | null,
    private getStyle: () => Style,
  ) {}

  notifyPress(time: number): void {
    this.lastPress = time;
    if (!this.firstPressDone) {
      this.firstPressDone = true;
      if (this.hintEl) {
        this.hintEl.classList.add('gone');
        setTimeout(() => this.hintEl?.remove(), 650);
      }
    }
  }

  setHintColor(style: Style): void {
    if (this.hintEl) this.hintEl.style.color = oklchToCss(style.palette[5]!, 0.45);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced && this.hintEl && !this.firstPressDone) {
      this.hintEl.classList.add('static');
    }
  }

  // Returns the camera drift scale (0.4 typing → 1.0 idle).
  update(time: number, dt: number): number {
    const isIdle = time - this.lastPress > IDLE_AFTER;
    const target = isIdle ? 1 : 0;
    const rate = target > this.idleAmount ? 0.25 : 0.04;
    this.idleAmount += (target - this.idleAmount) * rate;

    const style = this.getStyle();

    // breathing keys: slow emissive wave sweeping left→right
    for (const k of this.keyboard.keys) {
      const wave = 0.35 * Math.sin(time * 1.1 + k.col * 0.45);
      k.emissiveBase = style.emissiveIdle * (1 + this.idleAmount * wave);
    }

    if (isIdle && !this.reducedMotion) {
      if (!this.wasIdle) {
        this.wasIdle = true;
        this.nextGhostAt = time + randRange(7, 11);
      }
      // particle trickle: 3/s from random key tops
      this.trickleAccum += dt * 3;
      while (this.trickleAccum >= 1) {
        this.trickleAccum -= 1;
        const keys = this.keyboard.keys;
        const k = keys[Math.floor(rand() * keys.length)]!;
        this.tmp.set(0, k.capTopY, 0);
        k.group.localToWorld(this.tmp);
        this.particles.trickle(this.tmp.clone(), style);
      }
      // ghost ripple every 7–11 s
      if (time >= this.nextGhostAt) {
        const keys = this.keyboard.keys;
        const k = keys[Math.floor(rand() * keys.length)]!;
        this.keyAnim.ghost(k, time);
        this.nextGhostAt = time + randRange(7, 11);
      }
    } else {
      this.wasIdle = false;
      this.trickleAccum = 0;
    }

    return 0.4 + 0.6 * this.idleAmount;
  }
}
