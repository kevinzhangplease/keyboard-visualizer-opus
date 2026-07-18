// FPS governor (§7.2) + prefers-reduced-motion flags (§9.6). Frame-time EMA drives
// a tier 0–3; each tier scales spawn counts and (tier ≥ 2) drops bloom resolution
// and disables trail stretch. Reduced-motion is read at boot and on change.

const TIER_MUL = [1.0, 0.75, 0.5, 0.35];

export class Quality {
  private ema = 1 / 60;
  private tier = 0;
  private sinceEval = 0;
  private goodStreak = 0;
  reducedMotion = false;
  onTierChange: ((tier: number) => void) | null = null;

  constructor() {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mq.matches;
    mq.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
    });
  }

  update(dt: number): void {
    // clamp dt to avoid tab-switch spikes poisoning the EMA
    const d = Math.min(dt, 0.1);
    this.ema += (d - this.ema) * 0.05;
    this.sinceEval += dt;

    const fps = 1 / this.ema;
    if (this.sinceEval >= 2) {
      this.sinceEval = 0;
      if (fps < 48 && this.tier < 3) {
        this.setTier(this.tier + 1);
        this.goodStreak = 0;
      } else if (fps > 57) {
        this.goodStreak += 2;
        if (this.goodStreak >= 4 && this.tier > 0) {
          this.setTier(this.tier - 1);
          this.goodStreak = 0;
        }
      } else {
        this.goodStreak = 0;
      }
    }
  }

  private setTier(t: number): void {
    this.tier = t;
    // eslint-disable-next-line no-console
    console.info('[quality] tier', t);
    this.onTierChange?.(t);
  }

  get mul(): number {
    return TIER_MUL[this.tier]!;
  }

  get lowBloom(): boolean {
    return this.tier >= 2;
  }

  get trailEnabled(): boolean {
    return this.tier < 2;
  }

  get currentTier(): number {
    return this.tier;
  }
}
