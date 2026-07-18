// A single reseedable runtime float stream for non-deterministic-but-reproducible
// effects (particle spawn jitter, ghost-ripple key choice). §7.1: initialized from
// the style seed so spawns are reproducible per seed at t=0; drift over time is fine.
// Never use Math.random() — it is banned project-wide (§4.2).

import { rngFromSeed } from './prng';

let stream = rngFromSeed(1);

export function reseedRuntime(seed: number): void {
  stream = rngFromSeed(seed >>> 0);
}

export function rand(): number {
  return stream();
}

export function randRange(min: number, max: number): number {
  return min + (max - min) * stream();
}
