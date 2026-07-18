// Stage (§6.1): renderer, scene, camera, lights, EffectComposer + bloom, resize.
// Everything downstream reads the current Style each frame; this owns the GL surface.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toThreeColor } from '../style/color';
import type { Style } from '../style/blend';

// Camera base position (§5, pulled back so the full 15u board fits with margin).
export const CAMERA_BASE = new Vector3(0, 17.5, 4.3);

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly ambient: AmbientLight;
  readonly directional: DirectionalLight;
  readonly point: PointLight;
  readonly size = new Vector2(1, 1);

  private pmrem: PMREMGenerator;
  private bloomBaseStrength = 0.8;
  private lowBloomRes = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.copy(CAMERA_BASE);
    this.camera.lookAt(0, 0, 0);

    // Lights tuned for the near-overhead angle (§5).
    this.ambient = new AmbientLight(new Color(0x222233), 0.35);
    this.directional = new DirectionalLight(0xffffff, 0.7);
    this.directional.position.set(1.5, 14, 4);
    this.point = new PointLight(new Color(0x445588), 0.5, 18);
    this.point.position.set(0, 3, -6);
    this.scene.add(this.ambient, this.directional, this.point);

    // PMREM RoomEnvironment so metal/glass themes reflect something.
    this.pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    // Post: RenderPass -> UnrealBloom -> OutputPass.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.8, 0.6, 0.75);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setStyle(style: Style): void {
    toThreeColor(style.palette[1]!, this.ambient.color);
    toThreeColor(style.palette[2]!, this.point.color);
    this.bloomBaseStrength = style.bloomStrength;
    this.bloom.strength = style.bloomStrength;
    this.bloom.threshold = style.bloomThreshold;
    this.bloom.radius = 0.6;
  }

  // Velocity modulates bloom strength (§7.3).
  setBloomVelocity(velocity: number): void {
    this.bloom.strength = this.bloomBaseStrength * (1 + 0.25 * velocity);
  }

  setLowBloomRes(low: boolean): void {
    if (low === this.lowBloomRes) return;
    this.lowBloomRes = low;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.size.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const bloomScale = this.lowBloomRes ? 0.25 : 0.5;
    this.bloom.setSize(Math.max(1, w * bloomScale), Math.max(1, h * bloomScale));
  }

  render(): void {
    this.composer.render();
  }
}
