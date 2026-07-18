// Particle fragment shader (§7.1). pShape morphs between three SDFs — soft disc,
// ring/bubble, angular shard — and color lerps A→B over life. Additive blend.

export const PARTICLES_FRAG = /* glsl */ `
precision highp float;

uniform float uShape;
uniform float uTime;

varying float vLifeFrac;
varying vec3 vColA;
varying vec3 vColB;
varying vec2 vUv;
varying float vSeed;

void main() {
  vec2 pc = vUv - 0.5;
  float r = length(pc);

  float disc = smoothstep(0.5, 0.0, r);
  float ring = smoothstep(0.08, 0.0, abs(r - 0.34));

  float ang = vSeed * 6.2831853 + uTime * (0.5 + vSeed * 1.5);
  float cs = cos(ang);
  float sn = sin(ang);
  vec2 rp = vec2(pc.x * cs - pc.y * sn, pc.x * sn + pc.y * cs);
  float shard = 1.0 - smoothstep(0.05, 0.42, abs(rp.x) + abs(rp.y));

  float wDisc = 1.0 - smoothstep(0.0, 0.5, uShape);
  float wRing = clamp(1.0 - abs(uShape - 0.5) * 2.0, 0.0, 1.0);
  float wShard = smoothstep(0.5, 1.0, uShape);
  float shape = disc * wDisc + ring * wRing + shard * wShard;

  vec3 col = mix(vColA, vColB, clamp(vLifeFrac, 0.0, 1.0));
  float fade = 1.0 - clamp(vLifeFrac, 0.0, 1.0);
  float alpha = fade * fade * 0.9 * shape;

  if (alpha < 0.002) discard;
  gl_FragColor = vec4(col * shape, alpha);
}
`;
