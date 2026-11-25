/**
 * Pure Web Audio API ambient generator (Hans Zimmer-inspired slow meditative pad & sparse piano harmonics)
 * + subtle mechanical/cosmos UI click sound when switching scenes. Zero external audio files required.
 */
export class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padOscillators: OscillatorNode[] = [];
  private noteTimer: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public playSwitchSound() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Crisp high-tech UI tick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public setAmbientEnabled(enable: boolean) {
    if (enable === this.isPlaying) return;
    this.isPlaying = enable;

    if (!enable) {
      this.stopAmbientNodes();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(0.18, now + 2.5);

    // Warm low organ/pad drone (D2 + A2 + F3)
    const freqs = [73.42, 110.0, 174.61];
    this.padOscillators = freqs.map((f, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.detune.value = idx === 1 ? 4 : -3;
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      g.gain.value = idx === 0 ? 0.35 : 0.22;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain!);
      osc.start();
      return osc;
    });

    // Meditative Interstellar-style repeating soft piano motif (A4 - E5 - D5)
    const motif = [440.0, 659.25, 440.0, 587.33, 523.25];
    let step = 0;
    this.noteTimer = setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const noteOsc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      noteOsc.type = 'sine';
      noteOsc.frequency.value = motif[step % motif.length];
      step++;
      noteGain.gain.setValueAtTime(0.001, t);
      noteGain.gain.linearRampToValueAtTime(0.14, t + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
      noteOsc.connect(noteGain);
      noteGain.connect(this.masterGain);
      noteOsc.start(t);
      noteOsc.stop(t + 3.3);
    }, 2400);
  }

  private stopAmbientNodes() {
    if (this.noteTimer) {
      clearInterval(this.noteTimer);
      this.noteTimer = null;
    }
    for (const osc of this.padOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    }
    this.padOscillators = [];
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(0.0, now, 0.25);
    }
  }

  public dispose() {
    this.isPlaying = false;
    this.stopAmbientNodes();
    if (this.ctx) {
      this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }
}
