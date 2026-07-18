// Shared GLSL building blocks (§6.2) as a template string: hash, value noise,
// fbm, ridge, voronoi. Injected into both background and particle shaders.

export const GLSL_CHUNKS = /* glsl */ `
// --- hashing ---
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 a = fract(vec3(p.xyx) * vec3(123.34, 234.34, 345.65));
  a += dot(a, a + 34.45);
  return fract(vec2(a.x * a.y, a.y * a.z));
}

// --- value noise ---
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i + vec2(0.0, 0.0));
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// --- fbm: 4 octaves, lacunarity 2.0, gain 0.5 ---
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

// --- ridge fold ---
float ridge(float x) {
  return 1.0 - abs(2.0 * x - 1.0);
}

// --- voronoi: returns vec2(F1, F2) ---
vec2 voronoiF1F2(vec2 p, float cellScale) {
  vec2 g = p * cellScale;
  vec2 ip = floor(g);
  vec2 fp = fract(g);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 r = hash22(ip + o);
      vec2 diff = o + r - fp;
      float d = dot(diff, diff);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}

// --- cheap curl of value noise via finite differences ---
vec2 curlNoise(vec2 p) {
  float e = 0.1;
  float n1 = valueNoise(p + vec2(0.0, e));
  float n2 = valueNoise(p - vec2(0.0, e));
  float n3 = valueNoise(p + vec2(e, 0.0));
  float n4 = valueNoise(p - vec2(e, 0.0));
  float dx = (n1 - n2) / (2.0 * e);
  float dy = (n3 - n4) / (2.0 * e);
  return vec2(dy, -dx);
}
`;
