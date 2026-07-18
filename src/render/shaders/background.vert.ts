// Fullscreen-triangle vertex shader. Ignores camera entirely: raw clip-space
// positions are passed through so the mesh always fills the frame, drawn first
// and behind everything (depthTest/Write off, renderOrder -1).

export const BACKGROUND_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;
