// The five anchor themes (§3): palettes (6 OKLCH stops, roles S0..S5) and scales.
// Dial vectors live in dials.ts; this file carries the color + musical identity.
// Palette roles: S0 bgDeep, S1 bgMid, S2 keyBase, S3 accent, S4 glow, S5 highlight.

import type { Oklch, Palette } from './color';

export interface AnchorTheme {
  name: string;
  palette: Palette;
  scale: number[];
}

function stop(l: number, c: number, h: number): Oklch {
  return { l, c, h };
}

export const ANCHORS: AnchorTheme[] = [
  {
    name: 'Mountains',
    palette: [
      stop(0.17, 0.03, 255),
      stop(0.34, 0.05, 250),
      stop(0.58, 0.14, 250),
      stop(0.72, 0.18, 55),
      stop(0.8, 0.15, 70),
      stop(0.94, 0.015, 250),
    ],
    scale: [0, 2, 4, 7, 9], // major pentatonic
  },
  {
    name: 'Ice',
    palette: [
      stop(0.2, 0.05, 230),
      stop(0.42, 0.07, 220),
      stop(0.85, 0.07, 210),
      stop(0.78, 0.19, 195),
      stop(0.88, 0.16, 185),
      stop(0.98, 0.01, 200),
    ],
    scale: [0, 2, 4, 7, 9], // major pentatonic
  },
  {
    name: 'Ocean',
    palette: [
      stop(0.15, 0.06, 255),
      stop(0.32, 0.09, 235),
      stop(0.52, 0.19, 210),
      stop(0.75, 0.17, 185),
      stop(0.86, 0.19, 165),
      stop(0.93, 0.05, 190),
    ],
    scale: [0, 3, 5, 7, 10], // minor pentatonic
  },
  {
    name: 'Space',
    palette: [
      stop(0.09, 0.03, 290),
      stop(0.22, 0.07, 300),
      stop(0.45, 0.17, 280),
      stop(0.62, 0.22, 340),
      stop(0.72, 0.19, 210),
      stop(0.96, 0.02, 280),
    ],
    scale: [0, 2, 3, 5, 7, 8, 10], // aeolian
  },
  {
    name: 'Desert',
    palette: [
      stop(0.22, 0.05, 50),
      stop(0.42, 0.08, 60),
      stop(0.68, 0.17, 75),
      stop(0.7, 0.19, 60),
      stop(0.84, 0.16, 88),
      stop(0.95, 0.04, 85),
    ],
    scale: [0, 1, 4, 5, 7, 8, 10], // phrygian dominant
  },
];
