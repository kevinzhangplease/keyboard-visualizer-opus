// One synth voice (§7.4): oscillator morph (sine/triangle/saw) + detuned osc2 +
// FM bell partial + band-passed noise → lowpass → envelope → voiceBus. Supports a
// reversed envelope for backspace and a saw-emergent downward cutoff sweep.

export interface VoiceParams {
  freq: number;
  v: number; // velocity 0..1
  large: boolean;
  oscShape: number;
  fmAmount: number;
  noiseAmount: number;
  attack: number;
  release: number;
  filterCutoff: number;
  filterQ: number;
  detune: number;
  reverse?: boolean;
}

function morphGains(s: number): [number, number, number] {
  const sine = Math.max(0, 1 - 2 * s);
  const triangle = 1 - Math.abs(2 * s - 1);
  const saw = Math.max(0, 2 * s - 1);
  return [sine, triangle, saw];
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class Voice {
  private nodes: AudioScheduledSourceNode[] = [];
  private endTime = 0;

  constructor(
    private ctx: AudioContext,
    private voiceBus: GainNode,
    private noiseBuffer: AudioBuffer,
  ) {}

  get finishesAt(): number {
    return this.endTime;
  }

  start(p: VoiceParams, t0: number): void {
    const ctx = this.ctx;
    const nyq = ctx.sampleRate * 0.5;

    const sum = ctx.createGain();
    sum.gain.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = p.filterQ;

    const env = ctx.createGain();
    env.gain.value = 0;

    sum.connect(filter);
    filter.connect(env);
    env.connect(this.voiceBus);

    // --- carrier oscillators with morph weights ---
    const [gSine, gTri, gSaw] = morphGains(p.oscShape);
    const carriers: OscillatorNode[] = [];
    const types: OscillatorType[] = ['sine', 'triangle', 'sawtooth'];
    const gains = [gSine, gTri, gSaw];
    for (let i = 0; i < 3; i++) {
      if (gains[i]! <= 0.0001) continue;
      const osc = ctx.createOscillator();
      osc.type = types[i]!;
      osc.frequency.value = p.freq;
      const g = ctx.createGain();
      g.gain.value = gains[i]!;
      osc.connect(g);
      g.connect(sum);
      carriers.push(osc);
      this.nodes.push(osc);
    }
    // osc2: detuned sine at half gain
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = p.freq;
    osc2.detune.value = p.detune;
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    osc2.connect(g2);
    g2.connect(sum);
    carriers.push(osc2);
    this.nodes.push(osc2);

    // velocity octave-up shimmer (§7.3)
    if (p.v > 0.01) {
      const shimmer = ctx.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.value = p.freq * 2;
      const sg = ctx.createGain();
      sg.gain.value = 0.25 * p.v;
      shimmer.connect(sg);
      sg.connect(sum);
      this.nodes.push(shimmer);
    }

    // --- FM bell partial ---
    if (p.fmAmount > 0.001) {
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = p.freq * 2.997;
      const modGain = ctx.createGain();
      modGain.gain.value = p.fmAmount * p.freq * 1.5;
      mod.connect(modGain);
      for (const c of carriers) modGain.connect(c.frequency);
      this.nodes.push(mod);
    }

    // --- noise layer ---
    if (p.noiseAmount > 0.001) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(p.freq * 2, nyq * 0.9);
      bp.Q.value = 1;
      const ng = ctx.createGain();
      ng.gain.value = p.noiseAmount * 0.3;
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(sum);
      this.nodes.push(noise);
    }

    const baseCutoff = Math.min(p.filterCutoff * (1 + 2 * p.v), nyq * 0.95);
    const peak = 0.22 * (p.large ? 1.33 : 1) * Math.pow(10, (3 * p.v) / 20);
    const release = p.release * (p.large ? 1.4 : 1);

    if (p.reverse) {
      // Backspace: swell then hard cut; pitch glides down 5 semitones; filter closes.
      const swell = 0.24;
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + swell);
      env.gain.setValueAtTime(peak, t0 + swell);
      env.gain.linearRampToValueAtTime(0, t0 + swell + 0.03);
      const downFreq = p.freq * Math.pow(2, -5 / 12);
      for (const c of carriers) {
        c.frequency.setValueAtTime(c.frequency.value, t0);
        c.frequency.exponentialRampToValueAtTime(Math.max(20, downFreq * (c === osc2 ? 1 : 1)), t0 + swell);
      }
      filter.frequency.setValueAtTime(Math.min(baseCutoff * 2.0, nyq * 0.95), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, baseCutoff * 0.6), t0 + swell);
      this.endTime = t0 + swell + 0.06;
    } else {
      // Normal: linear attack, exp decay.
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + p.attack);
      env.gain.setTargetAtTime(0, t0 + p.attack, release / 6);

      // saw-emergent downward cutoff sweep (Space etc.)
      const sweepAmount = smoothstep(0.5, 1.0, p.oscShape) * 2.0;
      if (sweepAmount > 0.001) {
        filter.frequency.setValueAtTime(Math.min(baseCutoff * (1 + sweepAmount), nyq * 0.95), t0);
        filter.frequency.setTargetAtTime(baseCutoff, t0, release / 4);
      } else {
        filter.frequency.setValueAtTime(baseCutoff, t0);
      }
      this.endTime = t0 + p.attack + release * 1.5;
    }

    for (const n of this.nodes) {
      n.start(t0);
      n.stop(this.endTime + 0.05);
    }
  }

  stop(): void {
    try {
      for (const n of this.nodes) n.stop();
    } catch {
      // already stopped
    }
  }
}
