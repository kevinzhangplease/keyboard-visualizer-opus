// Bootstrap: seed from URL → Style → init modules → single rAF loop (§1.3).
// (Interim Phase-2 wiring: stage + background. Later phases extend this file.)

import { Stage } from './render/stage';
import { Background } from './render/background';
import { seedFromUrl } from './core/seed';
import { styleFromSeed, type Style } from './style/blend';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const stage = new Stage(canvas);
const background = new Background();
stage.scene.add(background.mesh);

let currentStyle: Style = styleFromSeed(seedFromUrl(location.search));
stage.setStyle(currentStyle);
background.setStyle(currentStyle);

let splashRemoved = false;
function removeSplash(): void {
  if (splashRemoved) return;
  splashRemoved = true;
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 420);
  }
}

// Warm compile + first frame, then fade the splash on the following rAF (§9.4).
stage.renderer.compile(stage.scene, stage.camera);
stage.render();
requestAnimationFrame(() => removeSplash());

function frame(): void {
  const time = performance.now() / 1000;
  background.update(time, 0, stage.size, 999);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
