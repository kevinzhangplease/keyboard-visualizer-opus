// AudioContext lifecycle + master chain (§7.4). The context is created lazily on
// the first user gesture; the first keypress both resumes and plays. Master chain:
// voiceBus → dry/reverb/delay sends → compressor → masterGain(0.8) → destination.

import { rand } from '../core/runtimeRng';
import { MASTER_GAIN } from '../style/dials';
import { freqForKey } from './music';
import { Voice } from './voice';
import type { KeyDef } from '../input/layout';
import type { Style } from '../style/blend';

const MAX_VOICES = 24;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private voiceBus!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private masterGain!: GainNode;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private delay!: DelayNode;
  private feedback!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private voices: Voice[] = [];
  private style: Style;
  private resumeBound: () => void;
  private booted = false;

  constructor(style: Style) {
    this.style = style;
    this.resumeBound = () => this.resume();
    window.addEventListener('keydown', this.resumeBound);
    window.addEventListener('pointerdown', this.resumeBound);
  }

  setStyle(style: Style): void {
    this.style = style;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.reverbSend.gain.setTargetAtTime(style.reverbMix, now, 0.2);
    this.delaySend.gain.setTargetAtTime(style.delayMix, now, 0.2);
    this.delay.delayTime.setTargetAtTime(style.delayTime, now, 0.2);
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = MASTER_GAIN;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1;
    this.voiceBus.connect(this.compressor); // dry

    // reverb send
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = this.style.reverbMix;
    const convolver = ctx.createConvolver();
    convolver.buffer = this.buildReverb(ctx);
    this.voiceBus.connect(this.reverbSend);
    this.reverbSend.connect(convolver);
    convolver.connect(this.compressor);

    // delay send with feedback + lowpass in the loop
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = this.style.delayMix;
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = this.style.delayTime;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.35;
    const loopLp = ctx.createBiquadFilter();
    loopLp.type = 'lowpass';
    loopLp.frequency.value = 2400;
    this.voiceBus.connect(this.delaySend);
    this.delaySend.connect(this.delay);
    this.delay.connect(loopLp);
    loopLp.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.compressor);

    this.noiseBuffer = this.buildNoise(ctx);
    this.booted = true;
  }

  private buildReverb(ctx: AudioContext): AudioBuffer {
    const dur = 2.5;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (rand() * 2 - 1) * Math.pow(1 - t / dur, 2.8);
      }
    }
    return buf;
  }

  private buildNoise(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = rand() * 2 - 1;
    return buf;
  }

  private resume(): void {
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      void ctx.resume().then(() => {
        if (ctx.state === 'running') this.detachResume();
      });
    } else {
      this.detachResume();
    }
  }

  private detachResume(): void {
    window.removeEventListener('keydown', this.resumeBound);
    window.removeEventListener('pointerdown', this.resumeBound);
  }

  private playNow(freq: number, large: boolean, v: number, reverse: boolean): void {
    const ctx = this.ctx!;
    // steal oldest if pool full
    if (this.voices.length >= MAX_VOICES) {
      const old = this.voices.shift();
      old?.stop();
    }
    const s = this.style;
    const voice = new Voice(ctx, this.voiceBus, this.noiseBuffer);
    voice.start(
      {
        freq,
        v,
        large,
        oscShape: s.oscShape,
        fmAmount: s.fmAmount,
        noiseAmount: s.noiseAmount,
        attack: s.attack,
        release: s.release,
        filterCutoff: s.filterCutoff,
        filterQ: s.filterQ,
        detune: s.detune,
        reverse,
      },
      ctx.currentTime,
    );
    this.voices.push(voice);
    // prune finished voices
    const now = ctx.currentTime;
    this.voices = this.voices.filter((vo) => vo.finishesAt > now - 0.1);
  }

  noteOn(key: KeyDef, v: number, reverse = false): void {
    this.ensureContext();
    const ctx = this.ctx!;
    const freq = freqForKey(key, this.style);
    if (ctx.state !== 'running') {
      void ctx.resume().then(() => this.playNow(freq, key.large, v, reverse));
      return;
    }
    this.playNow(freq, key.large, v, reverse);
  }

  get ready(): boolean {
    return this.booted;
  }
}
