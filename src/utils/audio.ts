// Web Audio API emergency siren generator
class EmergencyAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private sirenInterval: any = null;
  private isPlaying = false;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  public playSiren(): boolean {
    try {
      this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.stopSiren();

      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc.type = 'sawtooth';
      this.gain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.osc.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      let high = false;
      this.osc.frequency.setValueAtTime(700, this.ctx.currentTime);
      this.osc.start();
      this.isPlaying = true;

      this.sirenInterval = setInterval(() => {
        if (!this.osc || !this.ctx) return;
        high = !high;
        const targetFreq = high ? 1100 : 700;
        this.osc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.35);
      }, 400);

      return true;
    } catch (e) {
      console.error('Audio siren error:', e);
      return false;
    }
  }

  public stopSiren() {
    if (this.sirenInterval) {
      clearInterval(this.sirenInterval);
      this.sirenInterval = null;
    }
    if (this.osc) {
      try {
        this.osc.stop();
        this.osc.disconnect();
      } catch (e) {
        // ignore
      }
      this.osc = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch (e) {
        // ignore
      }
      this.gain = null;
    }
    this.isPlaying = false;
  }

  public playCountdownBeep(freq = 880, duration = 0.15) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Countdown beep error:', e);
    }
  }

  public getStatus() {
    return this.isPlaying;
  }
}

export const audioEngine = new EmergencyAudioEngine();
