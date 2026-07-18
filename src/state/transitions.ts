// Morph transitions (§8.1). morphTo(seed) lerps the whole Style from the live
// value to the target over 1.4 s (easeInOutCubic). Dials are linear (cutoff in
// log2), palette per-stop OKLCH shortest-arc, scale/pitchRoot switch at m=0.5.
// Retargeting mid-morph is smooth — source is always the current live style.

import { easeInOutCubic, lerp, log2 } from '../core/math';
import { lerpOklch, oklchDarken, oklchLuminance, type Oklch, type Palette } from '../style/color';
import { DIALS, type StyleDials } from '../style/dials';
import { styleFromSeed, type Style } from '../style/blend';

const MORPH_DURATION = 1.4;

export interface MorphHooks {
  onStart: (seed: number, target: Style) => void;
  onStyle: (style: Style) => void; // per-frame while morphing (colors/dials)
  onGeometry: (style: Style) => void; // once at completion (rebuild geometry)
}

function lerpStyle(source: Style, target: Style, m: number): Style {
  const dials = {} as StyleDials;
  for (const d of DIALS) {
    const a = source[d.name];
    const b = target[d.name];
    if (d.name === 'pitchRoot') {
      dials[d.name] = m < 0.5 ? a : b;
    } else if (d.logLerp) {
      dials[d.name] = Math.pow(2, lerp(log2(a), log2(b), m));
    } else {
      dials[d.name] = lerp(a, b, m);
    }
  }

  const palette = source.palette.map((s, k) =>
    lerpOklch(s, target.palette[k]!, m),
  ) as Palette;

  const s2 = palette[2];
  const labelColor: Oklch =
    oklchLuminance(s2) > 0.55 ? oklchDarken(s2, 0.12) : { ...palette[5] };

  return {
    ...dials,
    palette,
    scale: m < 0.5 ? source.scale : target.scale,
    labelColor,
    seed: target.seed,
    primary: target.primary,
    secondary: target.secondary,
    t: target.t,
  };
}

export class Transitions {
  current: Style;
  private source: Style;
  private target: Style;
  private m = 1;
  private active = false;

  constructor(
    initial: Style,
    private hooks: MorphHooks,
  ) {
    this.current = initial;
    this.source = initial;
    this.target = initial;
  }

  get morphing(): boolean {
    return this.active;
  }

  morphTo(seed: number): void {
    this.source = this.current; // retarget from live value
    this.target = styleFromSeed(seed);
    this.m = 0;
    this.active = true;
    this.hooks.onStart(seed, this.target);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.m += dt / MORPH_DURATION;
    if (this.m >= 1) {
      this.m = 1;
      this.current = this.target;
      this.active = false;
      this.hooks.onStyle(this.current);
      this.hooks.onGeometry(this.current);
      return;
    }
    const eased = easeInOutCubic(this.m);
    this.current = lerpStyle(this.source, this.target, eased);
    this.hooks.onStyle(this.current);
  }
}
