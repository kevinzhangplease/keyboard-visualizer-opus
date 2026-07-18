// OKLCH ⇄ linear sRGB, hand-written (§4.4) — no dependency.
// Matrices are Björn Ottosson's published OKLab constants
// (https://bottosson.github.io/posts/oklab/). All palette blending happens in
// OKLCH; conversion to linear sRGB is the last step before uniforms/materials.

import { Color } from 'three';
import { clamp, lerp, lerpHue } from '../core/math';

export interface Oklch {
  l: number;
  c: number;
  h: number; // degrees
}

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

const DEG2RAD = Math.PI / 180;

// OKLCH -> OKLab -> LMS' (cubed) -> linear sRGB.
export function oklchToLinearSrgbRaw({ l, c, h }: Oklch): LinearRgb {
  const a = c * Math.cos(h * DEG2RAD);
  const b = c * Math.sin(h * DEG2RAD);

  // OKLab -> LMS' (inverse of the M2 matrix)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ * l_ * l_;
  const mc = m_ * m_ * m_;
  const sc = s_ * s_ * s_;

  // LMS -> linear sRGB (M1 inverse)
  const r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;

  return { r, g, b: bl };
}

function inGamut({ r, g, b }: LinearRgb): boolean {
  const eps = 1e-4;
  return (
    r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps
  );
}

// Clamp out-of-gamut by chroma reduction: keep L & H, binary-search largest c'.
export function oklchToLinearSrgb(color: Oklch): LinearRgb {
  const direct = oklchToLinearSrgbRaw(color);
  if (inGamut(direct)) {
    return {
      r: clamp(direct.r, 0, 1),
      g: clamp(direct.g, 0, 1),
      b: clamp(direct.b, 0, 1),
    };
  }
  let lo = 0;
  let hi = color.c;
  let best = { l: color.l, c: 0, h: color.h };
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const test = { l: color.l, c: mid, h: color.h };
    if (inGamut(oklchToLinearSrgbRaw(test))) {
      best = test;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const rgb = oklchToLinearSrgbRaw(best);
  return {
    r: clamp(rgb.r, 0, 1),
    g: clamp(rgb.g, 0, 1),
    b: clamp(rgb.b, 0, 1),
  };
}

// Perceptual luminance proxy: OKLab L is already a good lightness measure.
export function oklchLuminance(c: Oklch): number {
  return c.l;
}

export function oklchDarken(c: Oklch, toL: number): Oklch {
  return { l: toL, c: Math.min(c.c, 0.08), h: c.h };
}

// Shortest-arc hue interpolation in OKLCH.
export function lerpOklch(a: Oklch, b: Oklch, t: number): Oklch {
  return {
    l: lerp(a.l, b.l, t),
    c: lerp(a.c, b.c, t),
    h: lerpHue(a.h, b.h, t),
  };
}

// THREE.Color set from linear values (renderer output is SRGBColorSpace; materials
// take linear RGB). We build the color in linear space directly.
export function toThreeColor(c: Oklch, target?: Color): Color {
  const { r, g, b } = oklchToLinearSrgb(c);
  const col = target ?? new Color();
  col.setRGB(r, g, b, 'srgb-linear');
  return col;
}

// CSS oklch() string for DOM chrome. L is 0..1, C absolute, H degrees.
export function oklchToCss(c: Oklch, alpha = 1): string {
  const L = clamp(c.l, 0, 1);
  const C = Math.max(0, c.c);
  const H = ((c.h % 360) + 360) % 360;
  if (alpha >= 1) return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;
  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)} / ${alpha})`;
}

export type Palette = [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch];

export function clonePalette(p: Palette): Palette {
  return p.map((s) => ({ ...s })) as Palette;
}
