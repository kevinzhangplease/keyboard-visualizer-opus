// Builds key meshes from the layout and applies the current Style to materials
// (§5). One MeshPhysicalMaterial per key (per-key emissive animation), plus a
// flat cap-top accent face, an alpha-mapped label, a wireframe overlay, and an
// additive focus ring — the top-down "which key is active" read.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LAYOUT, type KeyDef } from '../input/layout';
import { lerpOklch, oklchToLinearSrgb, oklchToCss, type Oklch } from '../style/color';
import type { Style } from '../style/blend';

const GAP = 0.12;
// Near-top-down "interface" framing (§5): the board lies flat in XZ and is tilted
// only ~18° off dead-flat so labels read straight-on with just enough residual
// perspective for bevels and particle arcs to have depth.
const TILT_X = 18 * (Math.PI / 180);

export interface KeyObject {
  def: KeyDef;
  col: number; // integer column for pitch/breathe wave
  group: Group;
  body: Mesh;
  material: MeshPhysicalMaterial;
  capTop: Mesh;
  capMaterial: MeshBasicMaterial;
  label: Mesh | null;
  labelMaterial: MeshBasicMaterial | null;
  wire: LineSegments;
  wireMaterial: LineBasicMaterial;
  focusRing: LineLoop;
  focusMaterial: LineBasicMaterial;
  // animation state (mutated by keyAnim)
  restY: number;
  capTopY: number;
  emissiveBase: number;
  dissolveAmount: number;
}

function withChroma(c: Oklch, mul: number): Oklch {
  return { l: c.l, c: c.c * mul, h: c.h };
}

function setLinear(target: Color, c: Oklch): void {
  const { r, g, b } = oklchToLinearSrgb(c);
  target.setRGB(r, g, b, 'srgb-linear');
}

// --- label atlas: one canvas, per-key cell, bold system-ui, baked drop shadow ---
const ATLAS_SIZE = 2048;
const CELL_W = 256;
const CELL_H = 160;
const COLS = Math.floor(ATLAS_SIZE / CELL_W); // 8

function buildLabelAtlas(): { texture: CanvasTexture; cellOf: Map<string, number> } {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cellOf = new Map<string, number>();
  LAYOUT.forEach((key, i) => {
    cellOf.set(key.code, i);
    if (key.label === '') return;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = col * CELL_W + CELL_W / 2;
    const cy = row * CELL_H + CELL_H / 2;

    // pick a font size that fits the cell width
    let fontPx = 78;
    ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    while (ctx.measureText(key.label).width > CELL_W * 0.82 && fontPx > 20) {
      fontPx -= 4;
      ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    }
    // baked 1px soft drop shadow (scaled to atlas), then white glyph
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(key.label, cx + 3, cy + 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(key.label, cx, cy);
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, cellOf };
}

function labelPlaneForCell(index: number): PlaneGeometry {
  const geo = new PlaneGeometry(0.82, 0.51);
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const u0 = (col * CELL_W) / ATLAS_SIZE;
  const v1 = 1 - (row * CELL_H) / ATLAS_SIZE;
  const du = CELL_W / ATLAS_SIZE;
  const dv = CELL_H / ATLAS_SIZE;
  const uv = geo.getAttribute('uv') as BufferAttribute;
  // plane uv corners: (0,1)(1,1)(0,0)(1,0)
  uv.setXY(0, u0, v1);
  uv.setXY(1, u0 + du, v1);
  uv.setXY(2, u0, v1 - dv);
  uv.setXY(3, u0 + du, v1 - dv);
  uv.needsUpdate = true;
  return geo;
}

function rectLoop(w: number, h: number, y: number): BufferGeometry {
  const g = new BufferGeometry();
  const hw = w / 2;
  const hh = h / 2;
  const pts = new Float32Array([
    -hw, y, -hh, hw, y, -hh, hw, y, hh, -hw, y, hh,
  ]);
  g.setAttribute('position', new BufferAttribute(pts, 3));
  return g;
}

export class Keyboard {
  readonly group: Group;
  readonly keys: KeyObject[] = [];
  readonly byCode: Map<string, KeyObject> = new Map();
  private atlas: CanvasTexture;
  private cellOf: Map<string, number>;
  private currentStyle: Style;

  constructor(style: Style) {
    this.currentStyle = style;
    this.group = new Group();
    this.group.rotation.x = TILT_X;
    this.group.position.y = 0;

    const built = buildLabelAtlas();
    this.atlas = built.texture;
    this.cellOf = built.cellOf;

    for (const def of LAYOUT) {
      this.keys.push(this.buildKey(def, style));
    }
    for (const k of this.keys) this.byCode.set(k.def.code, k);
    this.applyStyle(style);
  }

  private buildKey(def: KeyDef, style: Style): KeyObject {
    const capW = def.width - GAP;
    const capD = 1 - GAP;
    const depth = style.keyDepth;

    const group = new Group();
    group.position.set(def.x, 0, def.z);

    const geo = new RoundedBoxGeometry(capW, depth, capD, 3, style.keyBevel);
    const material = new MeshPhysicalMaterial({
      color: new Color(0xffffff),
      emissive: new Color(0x000000),
      roughness: 0.5,
      metalness: 0.0,
    });
    // Dissolve mask (§6.3/§6.4): screen-space hash discard driven by uDissolve.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDissolve = { value: 0 };
      shader.fragmentShader =
        'uniform float uDissolve;\n' +
        shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           if (uDissolve > 0.001) {
             float dn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
             if (dn < uDissolve) discard;
           }`,
        );
      material.userData.shader = shader;
    };
    const body = new Mesh(geo, material);
    group.add(body);

    // cap-top accent face (flat interface glow, independent of PBR light)
    const capGeo = new PlaneGeometry(capW * 0.98, capD * 0.98);
    capGeo.rotateX(-Math.PI / 2);
    const capMaterial = new MeshBasicMaterial({
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.3,
      toneMapped: false,
      depthWrite: false,
      side: DoubleSide,
    });
    const capTopY = depth / 2 + 0.01;
    const capTop = new Mesh(capGeo, capMaterial);
    capTop.position.y = capTopY;
    group.add(capTop);

    // label
    let label: Mesh | null = null;
    let labelMaterial: MeshBasicMaterial | null = null;
    if (def.label !== '') {
      const cell = this.cellOf.get(def.code) ?? 0;
      const lgeo = labelPlaneForCell(cell);
      lgeo.rotateX(-Math.PI / 2);
      labelMaterial = new MeshBasicMaterial({
        map: this.atlas,
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
        depthWrite: false,
        color: new Color(0xffffff),
      });
      label = new Mesh(lgeo, labelMaterial);
      label.position.y = capTopY + 0.03;
      // slightly scale label for large keys
      if (def.large) label.scale.setScalar(1.1);
      group.add(label);
    }

    // wireframe overlay (additive edges)
    const wireMaterial = new LineBasicMaterial({
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const wire = new LineSegments(new EdgesGeometry(geo), wireMaterial);
    group.add(wire);

    // focus ring (top-down active indicator)
    const focusMaterial = new LineBasicMaterial({
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const focusRing = new LineLoop(
      rectLoop(capW * 1.1, capD * 1.1, capTopY + 0.005),
      focusMaterial,
    );
    group.add(focusRing);

    this.group.add(group);

    const colIndex = Math.round(def.x + 7.5 - def.width / 2);

    return {
      def,
      col: Math.max(0, Math.min(13, colIndex)),
      group,
      body,
      material,
      capTop,
      capMaterial,
      label,
      labelMaterial,
      wire,
      wireMaterial,
      focusRing,
      focusMaterial,
      restY: 0,
      capTopY,
      emissiveBase: style.emissiveIdle,
      dissolveAmount: 0,
    };
  }

  // Apply colors/dials that don't require geometry rebuild (called each morph frame).
  applyStyle(style: Style): void {
    this.currentStyle = style;
    const keyColor = withChroma(style.palette[2]!, style.keyChromaMul);
    // Emissive reinforces the KEY's own hue so resting keys always read vivid in
    // their identity color (§3 taste rule), with a touch of the glow stop for
    // warmth/character. A complementary emissive would gray the key out.
    const glow = lerpOklch(withChroma(style.palette[2]!, style.keyChromaMul), style.palette[4]!, 0.2);
    const accent = withChroma(style.palette[3]!, style.keyChromaMul * 1.1);
    const highlight = style.palette[5]!;
    const capOpacity = 0.22 + 0.1 * style.emissiveIdle;

    for (const k of this.keys) {
      setLinear(k.material.color, keyColor);
      setLinear(k.material.emissive, glow);
      k.material.emissiveIntensity = style.emissiveIdle;
      k.material.roughness = style.roughness;
      k.material.metalness = style.metalness;
      k.material.transmission = style.transmission;
      if (style.transmission > 0.01) {
        k.material.thickness = style.keyDepth;
        k.material.ior = 1.45;
      } else {
        k.material.thickness = 0;
      }
      k.material.needsUpdate = true;
      k.emissiveBase = style.emissiveIdle;

      setLinear(k.capMaterial.color, accent);
      k.capMaterial.opacity = capOpacity;

      setLinear(k.wireMaterial.color, glow);
      k.wireMaterial.opacity = style.wireframe;

      setLinear(k.focusMaterial.color, highlight);

      if (k.labelMaterial) {
        setLinear(k.labelMaterial.color, style.labelColor);
      }
    }
  }

  // Rebuild geometry when the morph target changes (t=1) — keyDepth/keyBevel change.
  rebuildGeometry(style: Style): void {
    for (const k of this.keys) {
      const capW = k.def.width - GAP;
      const capD = 1 - GAP;
      const newGeo = new RoundedBoxGeometry(capW, style.keyDepth, capD, 3, style.keyBevel);
      k.body.geometry.dispose();
      k.body.geometry = newGeo;
      (k.wire.geometry as BufferGeometry).dispose();
      k.wire.geometry = new EdgesGeometry(newGeo);
      const capTopY = style.keyDepth / 2 + 0.01;
      k.capTopY = capTopY;
      k.capTop.position.y = capTopY;
      if (k.label) k.label.position.y = capTopY + 0.03;
      (k.focusRing.geometry as BufferGeometry).dispose();
      k.focusRing.geometry = rectLoop(capW * 1.1, capD * 1.1, capTopY + 0.005);
      k.body.scale.y = 1;
    }
  }

  // Return the CSS color for a palette stop (for HUD, hint).
  cssStop(index: number, alpha = 1): string {
    return oklchToCss(this.currentStyle.palette[index]!, alpha);
  }
}
