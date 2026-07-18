// Bootstrap (§1.3): seed from URL → Style → init modules → single rAF loop.
// One clock per frame; every downstream system is a pure function of currentStyle.

import { Vector3 } from 'three';
import { Stage, CAMERA_BASE } from './render/stage';
import { Background } from './render/background';
import { Keyboard } from './render/keyboard';
import { Particles } from './render/particles';
import { KeyAnim } from './render/keyAnim';
import { AudioEngine } from './audio/engine';
import { Velocity } from './input/velocity';
import { KeyInput } from './input/keys';
import { Quality } from './state/quality';
import { Transitions } from './state/transitions';
import { Hud } from './ui/hud';
import { Idle } from './ui/idle';
import { seedFromUrl, encodeSeed, randomSeed } from './core/seed';
import { reseedRuntime } from './core/runtimeRng';
import { styleFromSeed, type Style } from './style/blend';

// ---- boot state ----
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud')!;

let currentSeed = seedFromUrl(location.search);
reseedRuntime(currentSeed);
const bootStyle: Style = styleFromSeed(currentSeed);

// ---- modules ----
const stage = new Stage(canvas);
const background = new Background();
const keyboard = new Keyboard(bootStyle);
const particles = new Particles();
const quality = new Quality();
const velocity = new Velocity();
const audio = new AudioEngine(bootStyle);

stage.scene.add(background.mesh);
stage.scene.add(keyboard.group);
stage.scene.add(particles.mesh);

const keyAnim = new KeyAnim(
  keyboard,
  particles,
  () => transitions.current,
  () => quality.mul,
);
const idle = new Idle(keyboard, particles, keyAnim, hintEl, () => transitions.current);

// Reduced-motion overrides (§9.6): applied to a shallow clone before pushing to GL.
function effective(style: Style): Style {
  if (!quality.reducedMotion) return style;
  return {
    ...style,
    camDriftAmp: 0,
    animSpeed: Math.min(style.animSpeed, 0.8),
    pSpeed: style.pSpeed * 0.5,
    pCountBase: style.pCountBase * 0.5,
    pTrail: 0,
    bgShimmer: 0,
    bgFlowSpeed: style.bgFlowSpeed * 0.5,
  };
}

function applyStyle(style: Style): void {
  const eff = effective(style);
  background.setStyle(eff);
  keyboard.applyStyle(eff);
  stage.setStyle(eff);
  particles.setStyle(eff);
  audio.setStyle(eff);
  idle.setHintColor(eff);
}

const transitions = new Transitions(bootStyle, {
  onStart: (seed, target) => {
    currentSeed = seed;
    reseedRuntime(seed);
    history.replaceState(null, '', '?s=' + encodeSeed(seed));
    hud.update(target, seed);
  },
  onStyle: (style) => applyStyle(style),
  onGeometry: (style) => keyboard.rebuildGeometry(effective(style)),
});

const hud = new Hud(hudEl, {
  onTheme: (i) => transitions.morphTo(i),
  onRandom: () => transitions.morphTo(randomSeed()),
});

// ---- reduced motion ----
idle.setReducedMotion(quality.reducedMotion);
particles.setTrailEnabled(quality.trailEnabled);
quality.onTierChange = () => {
  stage.setLowBloomRes(quality.lowBloom);
  particles.setTrailEnabled(quality.trailEnabled && !quality.reducedMotion);
};

// ---- input wiring ----
const input = new KeyInput(canvas);
let lastBackspaceTime = -1000;

input.onKey((key, isDown) => {
  if (!isDown) return;
  const time = performance.now() / 1000;
  const keyObj = keyboard.byCode.get(key.code);
  if (!keyObj) return;
  velocity.press(time);
  idle.notifyPress(time);
  keyAnim.press(keyObj, velocity.value, time);
  if (key.backspace) {
    lastBackspaceTime = time;
    audio.noteOn(key, velocity.value, true);
  } else {
    audio.noteOn(key, velocity.value, false);
  }
});

input.onShortcut((name) => {
  if (name.startsWith('theme')) {
    transitions.morphTo(parseInt(name.slice(5), 10));
  } else if (name === 'randomize') {
    transitions.morphTo(randomSeed());
  } else if (name === 'copy') {
    void navigator.clipboard?.writeText(location.href);
    hud.flashChip();
  }
});

// ---- initial apply ----
applyStyle(bootStyle);
hud.update(bootStyle, currentSeed);
idle.setHintColor(bootStyle);

// ---- splash fade (§9.4): compile, one frame, then fade on next rAF ----
stage.renderer.compile(stage.scene, stage.camera);
stage.render();
let splashRemoved = false;
requestAnimationFrame(() => {
  if (splashRemoved) return;
  splashRemoved = true;
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 420);
  }
});

// ---- camera drift ----
const camRight = new Vector3();
const camUp = new Vector3();
const lookTarget = new Vector3();

function updateCamera(time: number, driftScale: number): void {
  const style = transitions.current;
  const amp = (quality.reducedMotion ? 0 : style.camDriftAmp) * driftScale;
  const w = time * style.camDriftSpeed * Math.PI * 2;
  stage.camera.position.set(
    CAMERA_BASE.x + amp * Math.sin(w),
    CAMERA_BASE.y + amp * 0.3 * Math.sin(w * 0.7),
    CAMERA_BASE.z + amp * 0.5 * Math.cos(w),
  );
  // Space-like themes (high drift amp) also slowly yaw ±3°
  const yaw = (3 * Math.PI) / 180 * (style.camDriftAmp / 0.35) * driftScale * Math.sin(w * 0.5);
  lookTarget.set(Math.sin(yaw) * 3, 0, 0);
  stage.camera.lookAt(lookTarget);
  stage.camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(stage.camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(stage.camera.matrixWorld, 1);
}

// ---- frame loop ----
let prev = performance.now() / 1000;
let assertCounter = 0;

function frame(): void {
  const time = performance.now() / 1000;
  const dt = Math.max(0, time - prev);
  prev = time;

  // (1) morph → currentStyle
  transitions.update(dt);
  // (2) velocity
  velocity.update(time);
  const v = velocity.value;
  // (3) quality
  quality.update(dt);
  // (4) camera drift
  const driftScale = idle.update(time, dt);
  updateCamera(time, driftScale);
  // (5) key animations
  keyAnim.update(time);
  // (6) particles
  particles.update(time, v, camRight, camUp);
  // (7) background
  const bsAge = time - lastBackspaceTime;
  background.update(time, v, stage.size, bsAge);
  // velocity-driven bloom
  stage.setBloomVelocity(v);
  // HUD chrome refresh
  hud.update(transitions.current, currentSeed);

  // (8) render
  stage.render();

  // dev guardrail: never exceed the pool
  if (import.meta.env.DEV && (assertCounter++ & 63) === 0) {
    console.assert(particles.liveCount(time) <= 6000, 'particle cap exceeded');
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
