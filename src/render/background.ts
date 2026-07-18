// Fullscreen-triangle background mesh + shader wrapper. All five looks live in
// one shader (§6.2); we only push uniforms each frame. Colors are linear sRGB.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { BACKGROUND_VERT } from './shaders/background.vert';
import { BACKGROUND_FRAG } from './shaders/background.frag';
import { oklchToLinearSrgb } from '../style/color';
import type { Style } from '../style/blend';

export class Background {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private palette: Color[];

  constructor() {
    // Fullscreen triangle: covers clip space with 3 verts.
    const geo = new BufferGeometry();
    const positions = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));

    this.palette = Array.from({ length: 6 }, () => new Color(0, 0, 0));

    this.material = new ShaderMaterial({
      vertexShader: BACKGROUND_VERT,
      fragmentShader: BACKGROUND_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new Vector2(1, 1) },
        uPalette: { value: this.palette },
        uTerrain: { value: 0 },
        uRidged: { value: 0 },
        uMist: { value: 0 },
        uAurora: { value: 0 },
        uStars: { value: 0 },
        uNebula: { value: 0 },
        uCaustics: { value: 0 },
        uShimmer: { value: 0 },
        uFlow: { value: 0 },
        uVelocity: { value: 0 },
        uPressWave: { value: new Vector3(0, 0, 999) },
      },
    });

    this.mesh = new Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  setStyle(style: Style): void {
    for (let i = 0; i < 6; i++) {
      const { r, g, b } = oklchToLinearSrgb(style.palette[i]!);
      this.palette[i]!.setRGB(r, g, b, 'srgb-linear');
    }
    const u = this.material.uniforms;
    u.uTerrain!.value = style.bgTerrain;
    u.uRidged!.value = style.bgRidged;
    u.uMist!.value = style.bgMist;
    u.uAurora!.value = style.bgAurora;
    u.uStars!.value = style.bgStars;
    u.uNebula!.value = style.bgNebula;
    u.uCaustics!.value = style.bgCaustics;
    u.uShimmer!.value = style.bgShimmer;
    u.uFlow!.value = style.bgFlowSpeed;
  }

  update(time: number, velocity: number, res: Vector2, pressWaveAge: number): void {
    const u = this.material.uniforms;
    u.uTime!.value = time;
    u.uVelocity!.value = velocity;
    (u.uRes!.value as Vector2).copy(res);
    (u.uPressWave!.value as Vector3).z = pressWaveAge;
  }

  setReducedMotion(reduced: boolean): void {
    // handled by flow scaling upstream; kept for parity
    void reduced;
  }
}
