// keydown/keyup handling, preventDefault policy (§9.2), repeat filter (§9.3).
// Emits typed events: layout keypresses to the visualizer, F-keys as chrome
// shortcuts (which never trigger key visuals/sound).

import { KEY_BY_CODE, type KeyDef } from './layout';

export type KeyListener = (key: KeyDef, isDown: boolean, event: KeyboardEvent) => void;
export type ShortcutListener = (name: string) => void;

const SHORTCUTS: Record<string, string> = {
  F1: 'theme1',
  F2: 'theme2',
  F3: 'theme3',
  F4: 'theme4',
  F5: 'theme5',
  F6: 'randomize',
  F7: 'copy',
};

const FKEYS = new Set([
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

export class KeyInput {
  private keyListeners: KeyListener[] = [];
  private shortcutListeners: ShortcutListener[] = [];

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKey(fn: KeyListener): void {
    this.keyListeners.push(fn);
  }

  onShortcut(fn: ShortcutListener): void {
    this.shortcutListeners.push(fn);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Never fight Ctrl/Cmd combos (OS-reserved, unblockable).
    if (e.ctrlKey || e.metaKey) return;

    // F-key chrome shortcuts: prevent default browser action, no visuals.
    if (FKEYS.has(e.code) || FKEYS.has(e.key)) {
      e.preventDefault();
      if (e.repeat) return;
      const name = SHORTCUTS[e.code] ?? SHORTCUTS[e.key];
      if (name) this.shortcutListeners.forEach((fn) => fn(name));
      return;
    }

    const key = KEY_BY_CODE.get(e.code);
    if (key) {
      e.preventDefault(); // stops Space scroll, Tab focus loss, /' quick-find, etc.
    } else if (e.altKey && (e.code === 'AltLeft' || e.code === 'AltRight')) {
      e.preventDefault(); // kill Firefox menu focus
    }

    if (e.repeat) return; // held keys fire once (§9.3)
    if (key) this.keyListeners.forEach((fn) => fn(key, true, e));
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = KEY_BY_CODE.get(e.code);
    if (key) this.keyListeners.forEach((fn) => fn(key, false, e));
  };
}
