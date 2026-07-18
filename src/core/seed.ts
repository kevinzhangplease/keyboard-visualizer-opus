// Seed <-> URL encoding and the reserved named seeds (§4.1).
// Seed is a uint32. URL form: ?s=<base36>. Named seeds 1..5 are the anchors.

export const NAMED_SEEDS = {
  Mountains: 1,
  Ice: 2,
  Ocean: 3,
  Space: 4,
  Desert: 5,
} as const;

export const THEME_NAMES = ['Mountains', 'Ice', 'Ocean', 'Space', 'Desert'] as const;

export function encodeSeed(n: number): string {
  return (n >>> 0).toString(36);
}

export function decodeSeed(s: string): number {
  const n = parseInt(s, 36);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 1;
  return n >>> 0;
}

// Read the seed from the current URL (?s=), defaulting to 1 (Mountains) on any failure.
export function seedFromUrl(search: string): number {
  const params = new URLSearchParams(search);
  const raw = params.get('s');
  if (raw === null || raw === '') return 1;
  const n = decodeSeed(raw);
  return n === 0 ? 1 : n;
}

// A fresh random seed for the dice roll; never collides with the reserved anchors.
export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  let n = a[0] ?? 1;
  if (n <= 5) n += 5;
  return n >>> 0;
}
