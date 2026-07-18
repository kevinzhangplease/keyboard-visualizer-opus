// Typing-speed tracker (§7.3): keeps the last 24 press timestamps, derives a
// smoothed v ∈ [0,1] (fast attack, slow decay) consumed by particles, flash,
// bloom, background lift, and audio.

export class Velocity {
  private stamps: number[] = [];
  private v = 0;

  press(now: number): void {
    this.stamps.push(now);
    if (this.stamps.length > 24) this.stamps.shift();
  }

  // Call once per frame with time in seconds.
  update(now: number): void {
    const windowStart = now - 1.5;
    let count = 0;
    for (let i = this.stamps.length - 1; i >= 0; i--) {
      if (this.stamps[i]! >= windowStart) count++;
      else break;
    }
    const kps = count / 1.5;
    const vRaw = Math.max(0, Math.min(1, (kps - 1.5) / 6.5));
    const rate = vRaw > this.v ? 0.25 : 0.04;
    this.v += (vRaw - this.v) * rate;
  }

  get value(): number {
    return this.v;
  }
}
