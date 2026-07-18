// Minimal HUD (§8.3): theme dots, dice, seed chip. DOM overlay (not Three.js),
// bottom-right, auto-hiding after mouse idle so keyboard use stays chrome-free.

import { ANCHORS } from '../style/anchors';
import { oklchToCss } from '../style/color';
import { encodeSeed, THEME_NAMES } from '../core/seed';
import type { Style } from '../style/blend';

export interface HudHooks {
  onTheme: (seedIndex: number) => void; // 1..5
  onRandom: () => void;
}

const DICE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
  <rect x="3" y="3" width="18" height="18" rx="4"/>
  <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/>
  <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/>
  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
  <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/>
  <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/>
</svg>`;

export class Hud {
  private root: HTMLElement;
  private dots: HTMLElement[] = [];
  private dice: HTMLElement;
  private chip: HTMLElement;
  private idleTimer = 0;
  private hidden = false;
  private chipResetTimer: number | null = null;

  constructor(container: HTMLElement, hooks: HudHooks) {
    this.root = container;
    this.root.className = 'visible';

    // theme dots
    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'hud-dots';
    ANCHORS.forEach((anchor, i) => {
      const dot = document.createElement('div');
      dot.className = 'hud-dot';
      dot.style.background = oklchToCss(anchor.palette[3]!);
      dot.title = THEME_NAMES[i]!;
      dot.addEventListener('click', () => hooks.onTheme(i + 1));
      dotsWrap.appendChild(dot);
      this.dots.push(dot);
    });
    this.root.appendChild(dotsWrap);
    this.addSep();

    // dice
    this.dice = document.createElement('div');
    this.dice.className = 'hud-dice';
    this.dice.innerHTML = DICE_SVG;
    this.dice.title = 'randomize';
    this.dice.addEventListener('click', () => {
      this.dice.style.transform = 'rotate(90deg)';
      setTimeout(() => (this.dice.style.transform = 'rotate(0deg)'), 200);
      hooks.onRandom();
    });
    this.root.appendChild(this.dice);
    this.addSep();

    // seed chip
    this.chip = document.createElement('div');
    this.chip.className = 'hud-chip';
    this.chip.title = 'copy link';
    this.chip.addEventListener('click', () => this.copyLink());
    this.root.appendChild(this.chip);

    window.addEventListener('mousemove', () => this.onMouseMove());
    this.resetIdle();
    this.tickIdle();
  }

  private addSep(): void {
    const sep = document.createElement('span');
    sep.className = 'hud-sep';
    sep.textContent = '·';
    this.root.appendChild(sep);
  }

  private copyLink(): void {
    void navigator.clipboard?.writeText(location.href);
    this.flashChip();
  }

  flashChip(): void {
    const original = this.chip.textContent;
    this.chip.textContent = 'copied ✓';
    if (this.chipResetTimer !== null) clearTimeout(this.chipResetTimer);
    // briefly force-visible even if hidden
    this.root.classList.remove('hidden');
    this.chipResetTimer = window.setTimeout(() => {
      this.chip.textContent = original;
      this.resetIdle();
    }, 1200);
  }

  private onMouseMove(): void {
    this.resetIdle();
    if (this.hidden) {
      this.hidden = false;
      this.root.classList.remove('hidden');
      this.root.classList.add('visible');
    }
  }

  private resetIdle(): void {
    this.idleTimer = performance.now() / 1000;
  }

  private tickIdle = (): void => {
    const now = performance.now() / 1000;
    if (!this.hidden && now - this.idleTimer > 4) {
      this.hidden = true;
      this.root.classList.remove('visible');
      this.root.classList.add('hidden');
    }
    requestAnimationFrame(this.tickIdle);
  };

  update(style: Style, seed: number): void {
    const s5 = oklchToCss(style.palette[5]!, 0.7);
    this.dice.style.color = s5;
    this.chip.style.color = oklchToCss(style.palette[5]!, 0.8);
    if (this.chip.textContent !== 'copied ✓') {
      this.chip.textContent = `s=${encodeSeed(seed)}`;
    }
    const ringColor = oklchToCss(style.palette[5]!);
    this.dots.forEach((dot, i) => {
      const active = seed === i + 1;
      dot.classList.toggle('active', active);
      if (active) dot.style.setProperty('--ring-color', ringColor);
    });
  }
}
