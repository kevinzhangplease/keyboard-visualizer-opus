// seed → StyleParams → composeStyle (§4.3). composeStyle is the ONLY constructor
// of a Style. Named themes and the randomizer share this path: anchors are just
// StyleParams with t=0 and zero jitter (§1.1).

import { rngFromSeed } from '../core/prng';
import { clamp, lerp, log2 } from '../core/math';
import { ANCHORS } from './anchors';
import { DIALS, type DialName, type StyleDials } from './dials';
import {
  lerpOklch,
  oklchDarken,
  oklchLuminance,
  type Oklch,
  type Palette,
} from './color';

export type AnchorIndex = 0 | 1 | 2 | 3 | 4;

export interface StyleParams {
  primary: AnchorIndex;
  secondary: AnchorIndex;
  t: number;
  jitter: number[]; // signed fraction per dial, in DIALS order
  hueJit: number; // degrees
  chromaJit: number;
  lightJit: number;
}

export interface Style extends StyleDials {
  palette: Palette;
  scale: number[];
  labelColor: Oklch;
  seed: number;
  primary: AnchorIndex;
  secondary: AnchorIndex;
  t: number;
}

export function paramsFromSeed(seed: number): StyleParams {
  const s = seed >>> 0;
  if (s >= 1 && s <= 5) {
    const idx = (s - 1) as AnchorIndex;
    return {
      primary: idx,
      secondary: idx,
      t: 0,
      jitter: DIALS.map(() => 0),
      hueJit: 0,
      chromaJit: 0,
      lightJit: 0,
    };
  }
  // Order of r() draws is part of determinism — do not reorder.
  const r = rngFromSeed(s);
  const primary = Math.floor(r() * 5) as AnchorIndex;
  const secondary = ((primary + 1 + Math.floor(r() * 4)) % 5) as AnchorIndex;
  const t = r() * 0.65; // bias toward the primary anchor
  const jitter = DIALS.map((d) => (r() * 2 - 1) * d.jitter);
  const hueJit = (r() * 2 - 1) * 16;
  const chromaJit = (r() * 2 - 1) * 0.02;
  const lightJit = (r() * 2 - 1) * 0.03;
  return { primary, secondary, t, jitter, hueJit, chromaJit, lightJit };
}

export function composeStyle(p: StyleParams, seed = 0): Style {
  const A = ANCHORS[p.primary]!;
  const B = ANCHORS[p.secondary]!;

  const dials = {} as StyleDials;
  DIALS.forEach((d, i) => {
    const a = d.anchors[p.primary];
    const b = d.anchors[p.secondary];
    let v: number;
    if (d.logLerp) {
      v = Math.pow(2, lerp(log2(a), log2(b), p.t));
    } else {
      v = lerp(a, b, p.t);
    }
    v += (p.jitter[i] ?? 0) * (d.max - d.min);
    v = clamp(v, d.min, d.max);
    if (d.roundInt) v = Math.round(v);
    dials[d.name as DialName] = v;
  });

  // Palette: per-stop OKLCH shortest-arc lerp, then uniform global jitter.
  const palette = A.palette.map((stopA, k) => {
    const blended = lerpOklch(stopA, B.palette[k]!, p.t);
    return {
      l: clamp(blended.l + p.lightJit, 0.05, 0.98),
      c: Math.max(0, blended.c + p.chromaJit),
      h: blended.h + p.hueJit,
    };
  }) as Palette;

  const s2 = palette[2];
  const labelColor: Oklch =
    oklchLuminance(s2) > 0.55 ? oklchDarken(s2, 0.12) : { ...palette[5] };

  return {
    ...dials,
    palette,
    scale: A.scale.slice(),
    labelColor,
    seed: seed >>> 0,
    primary: p.primary,
    secondary: p.secondary,
    t: p.t,
  };
}

export function styleFromSeed(seed: number): Style {
  return composeStyle(paramsFromSeed(seed), seed);
}
