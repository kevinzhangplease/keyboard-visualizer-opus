// Key → pitch mapping (§7.5). Deterministic and spatially musical: left→right
// ascends, rows set octave, large keys drop to a bass note. Stable across themes.

import { clamp } from '../core/math';
import type { KeyDef } from '../input/layout';
import type { Style } from '../style/blend';

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiForKey(key: KeyDef, style: Style): number {
  // Large-key overrides (§7.4): Space = root −12; other large = root −12 +7.
  if (key.space) return style.pitchRoot - 12;
  if (key.large) return style.pitchRoot - 12 + 7;

  const col = clamp(Math.round(key.x + 7.5 - key.width / 2), 0, 13);
  const rowIndex = key.z + 2; // 0 = number row ... 4 = space row
  const octave = rowIndex === 0 ? 2 : rowIndex <= 2 ? 1 : 0;

  const scale = style.scale;
  const degree = ((col + rowIndex * 3) % scale.length + scale.length) % scale.length;
  return style.pitchRoot + octave * 12 + scale[degree]!;
}

export function freqForKey(key: KeyDef, style: Style): number {
  return midiToFreq(midiForKey(key, style));
}
