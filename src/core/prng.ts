// Seeded PRNG (§4.2). splitmix32 expands one uint32 seed into the four words that
// seed sfc32, which produces the float [0,1) stream. Public-domain algorithms.
// Math.random() is banned project-wide — everything derives from a seed.

// splitmix32: returns a uint32 stream from a single seed.
export function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

// sfc32: fast small-state generator; returns floats in [0,1).
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return function () {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = (s0 + s1) >>> 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) >>> 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) >>> 0;
    t = (t + s3) >>> 0;
    s2 = (s2 + t) >>> 0;
    return (t >>> 0) / 4294967296;
  };
}

// The canonical seed → float-stream constructor used everywhere.
export function rngFromSeed(seed: number): () => number {
  const sm = splitmix32(seed >>> 0);
  return sfc32(sm(), sm(), sm(), sm());
}
