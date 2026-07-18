import { describe, it, expect } from 'vitest';
import { oklchToLinearSrgb, lerpOklch, type Oklch } from './color';

function noNaN(rgb: { r: number; g: number; b: number }): boolean {
  return (
    !Number.isNaN(rgb.r) &&
    !Number.isNaN(rgb.g) &&
    !Number.isNaN(rgb.b) &&
    rgb.r >= 0 &&
    rgb.r <= 1 &&
    rgb.g >= 0 &&
    rgb.g <= 1 &&
    rgb.b >= 0 &&
    rgb.b <= 1
  );
}

describe('oklch → linear srgb', () => {
  it('(e) white / black / mid-grey are achromatic and ordered', () => {
    const white = oklchToLinearSrgb({ l: 1, c: 0, h: 0 });
    const black = oklchToLinearSrgb({ l: 0, c: 0, h: 0 });
    const grey = oklchToLinearSrgb({ l: 0.5, c: 0, h: 0 });

    expect(white.r).toBeCloseTo(1, 3);
    expect(white.g).toBeCloseTo(1, 3);
    expect(white.b).toBeCloseTo(1, 3);
    expect(black.r).toBeCloseTo(0, 3);
    // achromatic: channels equal
    expect(grey.r).toBeCloseTo(grey.g, 6);
    expect(grey.g).toBeCloseTo(grey.b, 6);
    // ordering
    expect(grey.r).toBeGreaterThan(black.r);
    expect(white.r).toBeGreaterThan(grey.r);
  });

  it('gamut clamp never returns NaN or out-of-range for extreme chroma', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const rgb = oklchToLinearSrgb({ l, c: 0.5, h }); // absurd chroma
        expect(noNaN(rgb)).toBe(true);
      }
    }
  });

  it('in-gamut colors are preserved (not over-clamped)', () => {
    const rgb = oklchToLinearSrgb({ l: 0.6, c: 0.1, h: 250 });
    expect(noNaN(rgb)).toBe(true);
    // some channel should carry real color
    expect(Math.max(rgb.r, rgb.g, rgb.b)).toBeGreaterThan(0.05);
  });
});

describe('lerpOklch shortest hue arc', () => {
  it('350° → 10° passes through 0°, not 180°', () => {
    const a: Oklch = { l: 0.6, c: 0.1, h: 350 };
    const b: Oklch = { l: 0.6, c: 0.1, h: 10 };
    const mid = lerpOklch(a, b, 0.5);
    // wrapped hue: normalize to [0,360)
    const norm = ((mid.h % 360) + 360) % 360;
    // should be near 0/360, definitely not near 180
    const distTo0 = Math.min(norm, 360 - norm);
    expect(distTo0).toBeLessThan(5);
  });

  it('interpolates lightness and chroma linearly', () => {
    const a: Oklch = { l: 0.2, c: 0.05, h: 100 };
    const b: Oklch = { l: 0.8, c: 0.15, h: 100 };
    const mid = lerpOklch(a, b, 0.5);
    expect(mid.l).toBeCloseTo(0.5, 6);
    expect(mid.c).toBeCloseTo(0.1, 6);
  });
});
