// Particle vertex shader (§7.1). ALL motion happens here — the CPU only writes
// spawn state once. Analytic drag + gravity + curl turbulence; billboarded quad
// with velocity-aligned trail stretch. Dead/unborn instances are culled offscreen.

import { GLSL_CHUNKS } from './chunks.glsl';

export const PARTICLES_VERT = /* glsl */ `
precision highp float;

attribute float aSpawn;
attribute float aLife;
attribute float aSeed;
attribute float aKind;
attribute float aSize;
attribute vec3 aPos0;
attribute vec3 aVel;
attribute vec3 aTarget;
attribute vec3 aColA;
attribute vec3 aColB;

uniform float uTime;
uniform float uGravity;
uniform float uDrag;
uniform float uTurbulence;
uniform float uTrail;
uniform float uVelocity;
uniform vec3 uCamRight;
uniform vec3 uCamUp;

varying float vLifeFrac;
varying vec3 vColA;
varying vec3 vColB;
varying vec2 vUv;
varying float vSeed;

${GLSL_CHUNKS}

void main() {
  float tau = uTime - aSpawn;
  float lifeFrac = tau / aLife;
  vLifeFrac = lifeFrac;
  vColA = aColA;
  vColB = aColB;
  vSeed = aSeed;
  vUv = uv;

  if (tau < 0.0 || lifeFrac > 1.0 || aLife <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // cull
    return;
  }

  vec3 p;
  if (aKind > 0.5) {
    // backspace converge: ease from spawn ring toward the target center
    p = mix(aPos0, aTarget, smoothstep(0.0, 1.0, lifeFrac));
  } else {
    float drag = uDrag;
    float dragFactor = drag > 0.001 ? (1.0 - exp(-drag * tau)) / (drag * tau) : 1.0;
    vec3 g = vec3(0.0, -uGravity, 0.0); // positive gravity = downward
    vec2 c = curlNoise(aPos0.xz * 1.5 + tau * 0.6);
    vec3 turb = vec3(c.x, 0.0, c.y) * uTurbulence * 0.8 * tau;
    p = aPos0 + aVel * tau * dragFactor + 0.5 * g * tau * tau + turb;
  }

  // billboard corner (position.xy in [-0.5,0.5])
  vec2 corner = position.xy;

  // trail stretch along screen-projected velocity
  float speed = length(aVel);
  vec2 velScreen = vec2(dot(aVel, uCamRight), dot(aVel, uCamUp));
  if (aKind < 0.5 && uTrail > 0.001 && speed > 0.0001 && length(velScreen) > 0.0001) {
    vec2 dir = normalize(velScreen);
    float stretch = 1.0 + uTrail * (3.0 + 6.0 * uVelocity) * min(speed, 1.0);
    float along = dot(corner, dir);
    vec2 perp = corner - along * dir;
    corner = perp + along * dir * stretch;
  }

  vec3 offset = (uCamRight * corner.x + uCamUp * corner.y) * aSize;
  vec3 world = p + offset;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;
