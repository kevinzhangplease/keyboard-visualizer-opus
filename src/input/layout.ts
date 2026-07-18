// QWERTY geometry table (§5). 1u = key pitch, gap 0.12, 5 rows, total width 15u.
// Keyboard group centered at world origin; row 0 (numbers) at back (z=-2),
// row 4 (space) at front (z=+2). x is the key center, laid left→right per row.

export interface KeyDef {
  code: string; // KeyboardEvent.code
  label: string;
  x: number;
  z: number;
  width: number;
  large: boolean;
  space: boolean;
  backspace: boolean;
}

type RowSpec = Array<[code: string, label: string, width: number]>;

const ROWS: RowSpec[] = [
  // Row 0 (z=-2)
  [
    ['Backquote', '`', 1],
    ['Digit1', '1', 1],
    ['Digit2', '2', 1],
    ['Digit3', '3', 1],
    ['Digit4', '4', 1],
    ['Digit5', '5', 1],
    ['Digit6', '6', 1],
    ['Digit7', '7', 1],
    ['Digit8', '8', 1],
    ['Digit9', '9', 1],
    ['Digit0', '0', 1],
    ['Minus', '-', 1],
    ['Equal', '=', 1],
    ['Backspace', '⌫', 2],
  ],
  // Row 1 (z=-1)
  [
    ['Tab', 'Tab', 1.5],
    ['KeyQ', 'Q', 1],
    ['KeyW', 'W', 1],
    ['KeyE', 'E', 1],
    ['KeyR', 'R', 1],
    ['KeyT', 'T', 1],
    ['KeyY', 'Y', 1],
    ['KeyU', 'U', 1],
    ['KeyI', 'I', 1],
    ['KeyO', 'O', 1],
    ['KeyP', 'P', 1],
    ['BracketLeft', '[', 1],
    ['BracketRight', ']', 1],
    ['Backslash', '\\', 1.5],
  ],
  // Row 2 (z=0)
  [
    ['CapsLock', 'Caps', 1.75],
    ['KeyA', 'A', 1],
    ['KeyS', 'S', 1],
    ['KeyD', 'D', 1],
    ['KeyF', 'F', 1],
    ['KeyG', 'G', 1],
    ['KeyH', 'H', 1],
    ['KeyJ', 'J', 1],
    ['KeyK', 'K', 1],
    ['KeyL', 'L', 1],
    ['Semicolon', ';', 1],
    ['Quote', "'", 1],
    ['Enter', 'Enter', 2.25],
  ],
  // Row 3 (z=+1)
  [
    ['ShiftLeft', 'Shift', 2.25],
    ['KeyZ', 'Z', 1],
    ['KeyX', 'X', 1],
    ['KeyC', 'C', 1],
    ['KeyV', 'V', 1],
    ['KeyB', 'B', 1],
    ['KeyN', 'N', 1],
    ['KeyM', 'M', 1],
    ['Comma', ',', 1],
    ['Period', '.', 1],
    ['Slash', '/', 1],
    ['ShiftRight', 'Shift', 2.75],
  ],
  // Row 4 (z=+2)
  [
    ['ControlLeft', 'Ctrl', 1.25],
    ['MetaLeft', 'Meta', 1.25],
    ['AltLeft', 'Alt', 1.25],
    ['Space', '', 6.25],
    ['AltRight', 'Alt', 1.25],
    ['MetaRight', 'Meta', 1.25],
    ['ContextMenu', 'Menu', 1.25],
    ['ControlRight', 'Ctrl', 1.25],
  ],
];

export function isLargeKey(width: number): boolean {
  return width >= 1.75;
}

function buildLayout(): KeyDef[] {
  const keys: KeyDef[] = [];
  ROWS.forEach((row, rowIndex) => {
    const z = rowIndex - 2; // row 0 -> -2 ... row 4 -> +2
    let cursor = -7.5; // left edge of the 15u board
    for (const [code, label, width] of row) {
      const x = cursor + width / 2;
      cursor += width;
      keys.push({
        code,
        label,
        x,
        z,
        width,
        large: isLargeKey(width),
        space: code === 'Space',
        backspace: code === 'Backspace',
      });
    }
  });
  return keys;
}

export const LAYOUT: KeyDef[] = buildLayout();

export const KEY_BY_CODE: Map<string, KeyDef> = new Map(LAYOUT.map((k) => [k.code, k]));
