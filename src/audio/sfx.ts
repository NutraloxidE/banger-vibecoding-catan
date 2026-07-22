// Procedural Web Audio sound engine. No assets, no network.
// Everything is synthesized: clicks, dice, resource pickups, fanfares, ambient music.

type ResourceKey = 'wood' | 'brick' | 'wheat' | 'sheep' | 'ore';

const RESOURCE_FREQ: Record<ResourceKey, number> = {
  wood: 330, brick: 262, wheat: 392, sheep: 494, ore: 220,
};

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private tensionLevel = 0;

  volumes = { master: 0.8, music: 0.5, fx: 0.8, voice: 0.7 };
  enabled = true;

  private ensure(): boolean {
    if (typeof window === 'undefined' || !this.enabled) return false;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.fxGain = this.ctx.createGain();
        this.voiceGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.fxGain.connect(this.master);
        this.voiceGain.connect(this.master);
        this.applyVolumes();
      } catch {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master!.gain.value = this.volumes.master;
    this.musicGain!.gain.value = this.volumes.music * 0.5;
    this.fxGain!.gain.value = this.volumes.fx;
    this.voiceGain!.gain.value = this.volumes.voice;
  }

  setVolume(kind: keyof Sfx['volumes'], v: number) {
    this.volumes[kind] = v;
    this.applyVolumes();
  }

  private tone(opts: {
    freq: number; dur?: number; type?: OscillatorType; gain?: number;
    attack?: number; slideTo?: number; delay?: number; bus?: GainNode | null;
  }) {
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    const { freq, dur = 0.15, type = 'sine', gain = 0.25, attack = 0.005, slideTo, delay = 0 } = opts;
    const bus = opts.bus ?? this.fxGain!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur = 0.2, gain = 0.2, delay = 0, filterFreq = 1200) {
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.fxGain!);
    src.start(t0);
  }

  // --- public one-shots ---------------------------------------------------

  click() { this.tone({ freq: 660, dur: 0.06, type: 'triangle', gain: 0.12 }); }
  hover() { this.tone({ freq: 880, dur: 0.03, type: 'sine', gain: 0.05 }); }

  invalid() {
    this.tone({ freq: 160, dur: 0.18, type: 'sawtooth', gain: 0.15, slideTo: 90 });
  }

  place() {
    this.noise(0.12, 0.25, 0, 800);
    this.tone({ freq: 220, dur: 0.2, type: 'triangle', gain: 0.3, slideTo: 110 });
  }

  buildBig() {
    this.noise(0.3, 0.35, 0, 500);
    this.tone({ freq: 110, dur: 0.4, type: 'sawtooth', gain: 0.25, slideTo: 55 });
    this.tone({ freq: 440, dur: 0.3, type: 'triangle', gain: 0.15, delay: 0.15 });
    this.tone({ freq: 660, dur: 0.35, type: 'triangle', gain: 0.15, delay: 0.28 });
  }

  mega() {
    this.noise(0.5, 0.4, 0, 400);
    const notes = [131, 165, 196, 262, 330, 392, 523];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.2, delay: i * 0.09 }));
  }

  diceThrow() {
    this.noise(0.15, 0.2, 0, 2000);
    this.tone({ freq: 500, dur: 0.2, type: 'triangle', gain: 0.1, slideTo: 900 });
  }

  diceLand(total: number) {
    this.noise(0.15, 0.35, 0, 700);
    this.tone({ freq: 90, dur: 0.25, type: 'sine', gain: 0.4, slideTo: 50 });
    if (total === 7) this.tone({ freq: 130, dur: 0.6, type: 'sawtooth', gain: 0.18, slideTo: 65, delay: 0.15 });
  }

  pickup(res: ResourceKey, index = 0) {
    const base = RESOURCE_FREQ[res];
    this.tone({ freq: base * Math.pow(1.06, index), dur: 0.12, type: 'triangle', gain: 0.16, delay: index * 0.07 });
  }

  combo() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: 'square', gain: 0.08, delay: i * 0.07 }));
  }

  robber() {
    this.tone({ freq: 200, dur: 0.5, type: 'sawtooth', gain: 0.15, slideTo: 80 });
    this.tone({ freq: 100, dur: 0.5, type: 'sine', gain: 0.25, slideTo: 60, delay: 0.1 });
  }

  npcBlip(pid: number) {
    const freqs = [520, 420, 620, 360];
    const f = freqs[pid % freqs.length];
    this.tone({ freq: f, dur: 0.07, type: 'square', gain: 0.06, bus: this.voiceGain });
    this.tone({ freq: f * 1.3, dur: 0.07, type: 'square', gain: 0.06, delay: 0.08, bus: this.voiceGain });
  }

  tradeDone() {
    this.tone({ freq: 494, dur: 0.1, type: 'triangle', gain: 0.15 });
    this.tone({ freq: 740, dur: 0.15, type: 'triangle', gain: 0.15, delay: 0.1 });
  }

  fanfare() {
    const seq = [262, 330, 392, 523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'triangle', gain: 0.2, delay: i * 0.12 }));
    seq.forEach((f, i) => this.tone({ freq: f / 2, dur: 0.5, type: 'sine', gain: 0.15, delay: i * 0.12 }));
    this.noise(0.8, 0.2, 1.0, 3000);
  }

  matchPoint() {
    this.tone({ freq: 220, dur: 0.7, type: 'sawtooth', gain: 0.12, slideTo: 233 });
    this.tone({ freq: 330, dur: 0.7, type: 'sawtooth', gain: 0.1, delay: 0.2 });
  }

  // --- ambient music --------------------------------------------------------
  // A slow generative pad loop; tension adds an extra pulsing layer.

  startMusic() {
    if (!this.ensure() || this.musicTimer !== null) return;
    const step = () => {
      this.musicStep++;
      const scale = [131, 147, 165, 196, 220, 262, 294, 330];
      const root = scale[this.musicStep % 4 === 0 ? 0 : Math.floor(Math.random() * scale.length)];
      this.tone({ freq: root, dur: 2.6, type: 'sine', gain: 0.10, attack: 0.8, bus: this.musicGain });
      if (Math.random() < 0.5) {
        this.tone({ freq: root * 1.5, dur: 2.2, type: 'sine', gain: 0.06, attack: 0.9, delay: 0.4, bus: this.musicGain });
      }
      if (this.tensionLevel > 0) {
        this.tone({ freq: root * 2, dur: 0.12, type: 'square', gain: 0.03 * this.tensionLevel, bus: this.musicGain });
        this.tone({ freq: root * 2, dur: 0.12, type: 'square', gain: 0.03 * this.tensionLevel, delay: 0.7, bus: this.musicGain });
      }
    };
    step();
    this.musicTimer = window.setInterval(step, 1400);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setTension(level: number) {
    this.tensionLevel = Math.max(0, Math.min(2, level));
  }
}

export const sfx = new Sfx();
