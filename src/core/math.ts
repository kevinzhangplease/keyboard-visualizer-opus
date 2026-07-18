// Small pure math helpers used across style blending, animation, and shaders.
// No side effects; no randomness (that lives in prng.ts).

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeOutBack(t: number, s = 1.7): number {
  const c1 = s;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Exponential decay toward 0 with time constant tau (seconds); value at t.
export function expDecay(t: number, tau: number): number {
  return Math.exp(-t / tau);
}

// Shortest signed angular difference in degrees, result in (-180, 180].
export function shortestHueDelta(a: number, b: number): number {
  let d = ((b - a) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

export function lerpHue(a: number, b: number, t: number): number {
  return a + shortestHueDelta(a, b) * t;
}

export function log2(x: number): number {
  return Math.log(x) / Math.LN2;
}
