// The 49 continuous dials (§2). This table is the single source of truth for
// dial names, hard-clamp ranges, randomizer jitter fractions, and the five
// anchor values (Mountains, Ice, Ocean, Space, Desert — in that column order).
// Order in this array IS part of determinism: jitter is drawn per dial in order.

export type DialName =
  | 'bgTerrain'
  | 'bgRidged'
  | 'bgMist'
  | 'bgAurora'
  | 'bgStars'
  | 'bgNebula'
  | 'bgCaustics'
  | 'bgShimmer'
  | 'bgFlowSpeed'
  | 'pCountBase'
  | 'pSize'
  | 'pSpeed'
  | 'pLifespan'
  | 'pGravity'
  | 'pDrag'
  | 'pTurbulence'
  | 'pTrail'
  | 'pShape'
  | 'pSpread'
  | 'keyDepth'
  | 'keyBevel'
  | 'wireframe'
  | 'roughness'
  | 'metalness'
  | 'transmission'
  | 'emissiveIdle'
  | 'keyChromaMul'
  | 'wFlash'
  | 'wPress'
  | 'wExplode'
  | 'wPulse'
  | 'wDissolve'
  | 'animSpeed'
  | 'camDriftAmp'
  | 'camDriftSpeed'
  | 'bloomStrength'
  | 'bloomThreshold'
  | 'oscShape'
  | 'fmAmount'
  | 'noiseAmount'
  | 'attack'
  | 'release'
  | 'filterCutoff'
  | 'filterQ'
  | 'reverbMix'
  | 'delayMix'
  | 'delayTime'
  | 'pitchRoot'
  | 'detune';

export interface DialSpec {
  name: DialName;
  min: number;
  max: number;
  jitter: number;
  // Anchor values in column order: [Mountains, Ice, Ocean, Space, Desert].
  anchors: [number, number, number, number, number];
  logLerp?: boolean;
  roundInt?: boolean;
}

// prettier-ignore
export const DIALS: DialSpec[] = [
  // Background
  { name: 'bgTerrain',     min: 0,     max: 1,    jitter: 0.15, anchors: [1.00, 0.25, 0.00, 0.00, 0.90] },
  { name: 'bgRidged',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.90, 0.70, 0.50, 0.50, 0.10] },
  { name: 'bgMist',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.80, 0.35, 0.30, 0.10, 0.45] },
  { name: 'bgAurora',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.15, 1.00, 0.10, 0.35, 0.00] },
  { name: 'bgStars',       min: 0,     max: 1,    jitter: 0.15, anchors: [0.35, 0.25, 0.00, 1.00, 0.20] },
  { name: 'bgNebula',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.00, 0.10, 0.15, 1.00, 0.05] },
  { name: 'bgCaustics',    min: 0,     max: 1,    jitter: 0.15, anchors: [0.00, 0.20, 1.00, 0.00, 0.00] },
  { name: 'bgShimmer',     min: 0,     max: 1,    jitter: 0.12, anchors: [0.05, 0.00, 0.25, 0.00, 0.90] },
  { name: 'bgFlowSpeed',   min: 0,     max: 1,    jitter: 0.15, anchors: [0.15, 0.06, 0.35, 0.12, 0.30] },
  // Particles
  { name: 'pCountBase',    min: 40,    max: 220,  jitter: 0.20, anchors: [120, 70, 90, 140, 160] },
  { name: 'pSize',         min: 0.02,  max: 0.14, jitter: 0.15, anchors: [0.050, 0.070, 0.060, 0.045, 0.035] },
  { name: 'pSpeed',        min: 0.5,   max: 6.0,  jitter: 0.15, anchors: [2.2, 1.4, 1.2, 3.5, 2.8] },
  { name: 'pLifespan',     min: 0.6,   max: 3.5,  jitter: 0.15, anchors: [1.8, 2.6, 2.2, 1.6, 1.2] },
  { name: 'pGravity',      min: -2.5,  max: 2.5,  jitter: 0.12, anchors: [1.6, 0.3, -0.6, 0.0, 0.9] },
  { name: 'pDrag',         min: 0,     max: 3,    jitter: 0.15, anchors: [1.2, 2.0, 2.2, 0.4, 0.8] },
  { name: 'pTurbulence',   min: 0,     max: 1,    jitter: 0.15, anchors: [0.35, 0.15, 0.50, 0.25, 0.70] },
  { name: 'pTrail',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.15, 0.05, 0.20, 0.85, 0.30] },
  { name: 'pShape',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.10, 0.90, 0.45, 0.25, 0.15] },
  { name: 'pSpread',       min: 0,     max: 1,    jitter: 0.15, anchors: [0.70, 0.50, 0.85, 0.60, 0.75] },
  // Keyboard
  { name: 'keyDepth',      min: 0.05,  max: 0.45, jitter: 0.12, anchors: [0.30, 0.22, 0.16, 0.26, 0.34] },
  { name: 'keyBevel',      min: 0.005, max: 0.08, jitter: 0.12, anchors: [0.020, 0.050, 0.060, 0.030, 0.015] },
  { name: 'wireframe',     min: 0,     max: 1,    jitter: 0.12, anchors: [0.00, 0.15, 0.00, 0.35, 0.00] },
  { name: 'roughness',     min: 0,     max: 1,    jitter: 0.12, anchors: [0.85, 0.08, 0.15, 0.30, 0.95] },
  { name: 'metalness',     min: 0,     max: 1,    jitter: 0.12, anchors: [0.05, 0.00, 0.10, 0.70, 0.00] },
  { name: 'transmission',  min: 0,     max: 1,    jitter: 0.12, anchors: [0.00, 0.85, 0.35, 0.25, 0.00] },
  { name: 'emissiveIdle',  min: 0,     max: 0.9,  jitter: 0.15, anchors: [0.22, 0.35, 0.40, 0.60, 0.28] },
  { name: 'keyChromaMul',  min: 0.9,   max: 1.9,  jitter: 0.12, anchors: [1.15, 1.25, 1.45, 1.60, 1.30] },
  // Animation weights
  { name: 'wFlash',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.30, 0.90, 0.40, 0.80, 0.50] },
  { name: 'wPress',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.90, 0.30, 0.60, 0.40, 0.80] },
  { name: 'wExplode',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.60, 0.70, 0.30, 0.90, 0.85] },
  { name: 'wPulse',        min: 0,     max: 1,    jitter: 0.15, anchors: [0.40, 0.20, 0.90, 0.50, 0.30] },
  { name: 'wDissolve',     min: 0,     max: 1,    jitter: 0.15, anchors: [0.10, 0.50, 0.20, 0.30, 0.60] },
  { name: 'animSpeed',     min: 0.25,  max: 1.75, jitter: 0.12, anchors: [0.70, 0.50, 0.80, 1.10, 0.90] },
  // Camera
  { name: 'camDriftAmp',   min: 0,     max: 0.5,  jitter: 0.12, anchors: [0.18, 0.05, 0.25, 0.35, 0.15] },
  { name: 'camDriftSpeed', min: 0.02,  max: 0.30, jitter: 0.12, anchors: [0.05, 0.02, 0.12, 0.08, 0.04] },
  // Post
  { name: 'bloomStrength', min: 0.3,   max: 1.4,  jitter: 0.12, anchors: [0.55, 0.90, 0.80, 1.25, 0.60] },
  { name: 'bloomThreshold',min: 0.4,   max: 0.85, jitter: 0.10, anchors: [0.75, 0.60, 0.65, 0.50, 0.70] },
  // Audio
  { name: 'oscShape',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.25, 0.05, 0.35, 0.80, 0.55] },
  { name: 'fmAmount',      min: 0,     max: 1,    jitter: 0.15, anchors: [0.10, 0.80, 0.20, 0.30, 0.15] },
  { name: 'noiseAmount',   min: 0,     max: 1,    jitter: 0.15, anchors: [0.10, 0.05, 0.35, 0.10, 0.20] },
  { name: 'attack',        min: 0.001, max: 0.08, jitter: 0.15, anchors: [0.020, 0.001, 0.012, 0.030, 0.002] },
  { name: 'release',       min: 0.15,  max: 2.5,  jitter: 0.15, anchors: [1.2, 2.2, 1.0, 1.8, 0.5] },
  { name: 'filterCutoff',  min: 300,   max: 6000, jitter: 0.15, anchors: [900, 3800, 1400, 1100, 2200], logLerp: true },
  { name: 'filterQ',       min: 0.5,   max: 8,    jitter: 0.15, anchors: [0.8, 1.2, 2.5, 4.5, 1.5] },
  { name: 'reverbMix',     min: 0,     max: 0.6,  jitter: 0.12, anchors: [0.45, 0.55, 0.35, 0.60, 0.15] },
  { name: 'delayMix',      min: 0,     max: 0.45, jitter: 0.12, anchors: [0.10, 0.30, 0.28, 0.35, 0.18] },
  { name: 'delayTime',     min: 0.12,  max: 0.42, jitter: 0.12, anchors: [0.30, 0.38, 0.28, 0.42, 0.16] },
  { name: 'pitchRoot',     min: 33,    max: 57,   jitter: 0.10, anchors: [45, 57, 50, 41, 48], roundInt: true },
  { name: 'detune',        min: 0,     max: 25,   jitter: 0.15, anchors: [4, 12, 8, 10, 6] },
];

export const DIAL_INDEX: Record<DialName, number> = Object.fromEntries(
  DIALS.map((d, i) => [d.name, i]),
) as Record<DialName, number>;

export type StyleDials = Record<DialName, number>;

// Guardrail constants enforced regardless of dials (§2 footnote).
export const MAX_PARTICLES = 6000;
export const MAX_SPAWN_PER_PRESS = 500;
export const MASTER_GAIN = 0.8;
