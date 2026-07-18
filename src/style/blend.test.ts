import { describe, it, expect } from 'vitest';
import { rngFromSeed } from '../core/prng';
import { encodeSeed, decodeSeed } from '../core/seed';
import { DIALS } from './dials';
import { ANCHORS } from './anchors';
import { styleFromSeed, paramsFromSeed } from './blend';

describe('prng determinism', () => {
  it('(a) rngFromSeed(123) yields identical first 5 floats across constructions', () => {
    const r1 = rngFromSeed(123);
    const r2 = rngFromSeed(123);
    for (let i = 0; i < 5; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it('produces floats in [0,1)', () => {
    const r = rngFromSeed(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('anchors as pinned seeds', () => {
  it('(b) styleFromSeed(1..5) reproduces each anchor exactly', () => {
    for (let s = 1; s <= 5; s++) {
      const style = styleFromSeed(s);
      const anchor = ANCHORS[s - 1]!;
      // dials equal the anchor column
      for (const d of DIALS) {
        const expected = d.roundInt ? Math.round(d.anchors[s - 1]!) : d.anchors[s - 1]!;
        expect(style[d.name]).toBeCloseTo(expected, 9);
      }
      // palette equals anchor palette exactly (t=0, no jitter)
      anchor.palette.forEach((stop, k) => {
        expect(style.palette[k]!.l).toBeCloseTo(stop.l, 9);
        expect(style.palette[k]!.c).toBeCloseTo(stop.c, 9);
        expect(style.palette[k]!.h).toBeCloseTo(stop.h, 9);
      });
      expect(style.scale).toEqual(anchor.scale);
    }
  });

  it('paramsFromSeed for anchors has t=0 and zero jitter', () => {
    for (let s = 1; s <= 5; s++) {
      const p = paramsFromSeed(s);
      expect(p.t).toBe(0);
      expect(p.jitter.every((j) => j === 0)).toBe(true);
      expect(p.hueJit).toBe(0);
    }
  });
});

describe('style determinism and guardrails', () => {
  it('(c) styleFromSeed(987654321) is deterministic', () => {
    const a = styleFromSeed(987654321);
    const b = styleFromSeed(987654321);
    expect(a).toEqual(b);
  });

  it('(d) 1000 seeds keep every dial within its clamp range', () => {
    for (let i = 0; i < 1000; i++) {
      const seed = 6 + i * 7919; // deterministic sweep past the reserved anchors
      const style = styleFromSeed(seed);
      for (const d of DIALS) {
        const v = style[d.name];
        expect(v).toBeGreaterThanOrEqual(d.min - 1e-9);
        expect(v).toBeLessThanOrEqual(d.max + 1e-9);
        expect(Number.isNaN(v)).toBe(false);
      }
    }
  });

  it('blended styles pick the primary anchor scale', () => {
    const style = styleFromSeed(123456);
    const p = paramsFromSeed(123456);
    expect(style.scale).toEqual(ANCHORS[p.primary]!.scale);
  });
});

describe('seed url round-trip', () => {
  it('(f) encodeSeed(decodeSeed) round-trips', () => {
    expect(encodeSeed(decodeSeed('zz'))).toBe('zz');
    expect(encodeSeed(decodeSeed('1z8kq3'))).toBe('1z8kq3');
    expect(decodeSeed('!!bad!!')).toBe(1); // parse failure -> 1 (NaN>>>0 is 0? guarded)
  });

  it('decodeSeed handles garbage without NaN', () => {
    expect(Number.isNaN(decodeSeed('////'))).toBe(false);
  });
});
