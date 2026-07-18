// Background composite (§6.2). One shader, all five looks — every component is
// gated by a uniform weight so blending between themes is free. Composite steps
// are numbered to match §6.2. Colors are linear sRGB (uPalette).

import { GLSL_CHUNKS } from './chunks.glsl';

export const BACKGROUND_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uRes;
uniform vec3 uPalette[6];
uniform float uTerrain;
uniform float uRidged;
uniform float uMist;
uniform float uAurora;
uniform float uStars;
uniform float uNebula;
uniform float uCaustics;
uniform float uShimmer;
uniform float uFlow;
uniform float uVelocity;
uniform vec3 uPressWave; // x,z world; z-slot carries the backspace age timer

${GLSL_CHUNKS}

// flow speed maps linearly to 0.02–0.25 u/s (§2 dial 9)
float flowSpeed() {
  return mix(0.02, 0.25, uFlow);
}

// (3) star layer: grid-hash points with twinkle
float starLayer(vec2 auv, float gridN, float thresh) {
  vec2 g = auv * gridN;
  vec2 ip = floor(g);
  vec2 fp = fract(g) - 0.5;
  float h = hash21(ip + 3.1);
  if (h < thresh) return 0.0;
  float star = smoothstep(0.5, 0.0, length(fp) * 2.2);
  float tw = 0.7 + 0.3 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
  return star * tw;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float flow = flowSpeed();
  float aspect = uRes.x / max(uRes.y, 1.0);

  // (1) sky base
  vec3 col = mix(uPalette[0], uPalette[1], pow(clamp(uv.y, 0.0, 1.0), 1.4));

  // (2) shimmer — displace UV before everything below (heat/water)
  if (uShimmer > 0.001) {
    vec2 d = vec2(fbm(uv * 8.0 + t * 0.9 * flow) - 0.5, fbm(uv * 8.0 + 17.0 - t * 0.9 * flow) - 0.5);
    uv += d * 0.012 * uShimmer * smoothstep(0.6, 0.25, uv.y);
  }

  // (3) stars
  if (uStars > 0.001) {
    vec2 auv = vec2(uv.x * aspect, uv.y);
    float s = 0.0;
    s += starLayer(auv, 90.0, 0.94);
    s += starLayer(auv + 11.7, 60.0, 0.90) * 0.7;
    col += uPalette[5] * s * uStars;
  }

  // (4) nebula — domain-warped fbm clouds
  if (uNebula > 0.001) {
    vec2 p = uv * vec2(aspect, 1.0) * 2.2;
    vec2 warp = vec2(fbm(p + t * 0.01), fbm(p + 5.2 - t * 0.008));
    float n = fbm(p + 1.8 * warp);
    vec3 nebCol = mix(uPalette[1], uPalette[3], n);
    float warpMag = length(warp - 0.5) * 2.0;
    nebCol = mix(nebCol, uPalette[4], smoothstep(0.55, 0.9, warpMag));
    col = mix(col, nebCol, uNebula * n * 0.85);
  }

  // (5) aurora — vertical light curtains
  if (uAurora > 0.001) {
    vec3 aur = vec3(0.0);
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float xk = 0.28 + 0.22 * fk;
      xk += fbm(vec2(uv.y * 2.0 + fk * 7.3, t * 0.05)) * 0.35 - 0.175;
      float band = smoothstep(0.10, 0.0, abs(uv.x - xk));
      vec3 c = mix(uPalette[3], uPalette[4], uv.y);
      aur += band * c * (0.6 + 0.4 * uv.y);
    }
    col += aur * uAurora;
  }

  // (6) caustics — sharpened voronoi light webs (clamped so it can't blow out)
  if (uCaustics > 0.001) {
    vec2 p = uv * vec2(aspect, 1.0);
    float f1a = voronoiF1F2(p + vec2(t * flow, -t * flow * 0.6), 4.0).x;
    float f1b = voronoiF1F2(p + vec2(-t * flow * 0.8, t * flow), 6.5).x;
    float caust = pow(1.0 - f1a, 6.0) + pow(1.0 - f1b, 6.0);
    caust = min(caust, 0.35);
    // vertical god-ray tint toward top-center
    float ray = smoothstep(0.0, 1.0, uv.y) * smoothstep(0.5, 0.0, abs(uv.x - 0.5));
    col += uPalette[3] * caust * uCaustics;
    col += uPalette[1] * ray * 0.15 * uCaustics;
  }

  // (7) terrain — layered ridged silhouettes + alpenglow; sun disc for smooth dunes
  if (uTerrain > 0.001) {
    float bases[4];
    float amps[4];
    float scrolls[4];
    bases[0] = 0.62; bases[1] = 0.50; bases[2] = 0.40; bases[3] = 0.32;
    amps[0] = 0.10; amps[1] = 0.14; amps[2] = 0.17; amps[3] = 0.20;
    scrolls[0] = 0.2; scrolls[1] = 0.45; scrolls[2] = 0.7; scrolls[3] = 1.0;

    // sun-glow disc emerges for smooth-dune (low ridged) terrains — Desert
    float sunW = uTerrain * smoothstep(0.5, 0.0, uRidged);
    if (sunW > 0.001) {
      float sd = distance(vec2(uv.x * aspect, uv.y), vec2(0.72 * aspect, 0.68));
      float disc = pow(smoothstep(0.5, 0.0, sd), 3.0);
      col = mix(col, uPalette[4], disc * 0.5 * sunW);
    }

    float horizon0 = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float x = uv.x * (2.5 + fi) + t * flow * scrolls[i];
      float nf = fbm(vec2(x, fi * 3.7));
      float shaped = mix(nf, ridge(nf), uRidged);
      float h = bases[i] + amps[i] * (shaped - 0.5) * 2.0;
      if (i == 0) horizon0 = h;
      float mask = smoothstep(h + 0.004, h - 0.004, uv.y);
      vec3 layerCol = mix(uPalette[1], uPalette[0], fi / 3.0);
      col = mix(col, layerCol, mask * uTerrain);
    }
    // alpenglow band just above the back ridge line, warm accent
    float glowBand = smoothstep(horizon0 + 0.12, horizon0, uv.y) * smoothstep(horizon0 - 0.02, horizon0, uv.y);
    col += uPalette[3] * glowBand * 0.5 * uTerrain;
  }

  // (8) mist — drifting low-frequency fog band
  if (uMist > 0.001) {
    float band = fbm(uv * 1.6 + vec2(t * 0.02, 0.0));
    float mistMask = smoothstep(0.3, 0.55, band) * smoothstep(0.75, 0.35, uv.y);
    vec3 mistCol = uPalette[1] * 1.4;
    col = mix(col, mistCol, mistMask * uMist * 0.5);
  }

  // (9) velocity lift
  col *= 1.0 + uVelocity * 0.15;

  // (10) backspace dip (age-based 250 ms)
  col *= 1.0 - 0.06 * smoothstep(0.25, 0.0, uPressWave.z);

  // (11) vignette
  col *= 1.0 - 0.35 * pow(length(uv - 0.5) * 1.3, 2.5);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
