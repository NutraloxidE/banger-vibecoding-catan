// Generated audio via the Web Audio API. No external files, no network.
// Everything degrades to silence if AudioContext is unavailable.

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private started = false;
  private musicStep = 0;
  private intensity = 0; // 0..1, drives musical layers

  settings = { master: 0.8, music: 0.5, sfx: 0.9, muted: false };

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyGains();
      return true;
    } catch {
      return false;
    }
  }

  private applyGains() {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    const m = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.value = m;
    this.musicGain.gain.value = this.settings.music * 0.5;
    this.sfxGain.gain.value = this.settings.sfx;
  }

  setSettings(s: Partial<typeof this.settings>) {
    this.settings = { ...this.settings, ...s };
    this.applyGains();
  }

  // Must be called from a user gesture to unlock audio on mobile/Safari.
  unlock() {
    if (!this.ensure()) return;
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    if (!this.started) {
      this.started = true;
      this.startMusic();
    }
  }

  private tone(freq: number, dur: number, type: Wave, gain: number, when = 0, dest?: GainNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain!);
    src.start(t);
  }

  // ---- game sfx ----
  private freqForResource: Record<string, number> = {
    wood: 330,
    brick: 262,
    sheep: 494,
    wheat: 392,
    ore: 220,
  };

  resource(kind: string, when = 0) {
    if (!this.ensure()) return;
    this.tone(this.freqForResource[kind] ?? 400, 0.16, "triangle", 0.18, when);
  }

  chain(count: number) {
    if (!this.ensure()) return;
    const notes = [392, 440, 494, 587, 659, 784];
    for (let i = 0; i < Math.min(count, notes.length); i++) {
      this.tone(notes[i], 0.14, "triangle", 0.16, i * 0.08);
    }
  }

  place(valid: boolean) {
    if (!this.ensure()) return;
    if (valid) this.tone(523, 0.12, "sine", 0.16);
    else {
      this.tone(160, 0.14, "sawtooth", 0.14);
      this.tone(150, 0.14, "square", 0.08, 0.02);
    }
  }

  build() {
    if (!this.ensure()) return;
    this.tone(196, 0.18, "square", 0.14);
    this.tone(294, 0.22, "triangle", 0.14, 0.05);
    this.noise(0.18, 0.12, 0.02);
  }

  upgrade() {
    if (!this.ensure()) return;
    [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.22, "sawtooth", 0.14, i * 0.09));
  }

  dice() {
    if (!this.ensure()) return;
    for (let i = 0; i < 5; i++) this.noise(0.06, 0.1, i * 0.05);
  }

  diceImpact() {
    if (!this.ensure()) return;
    this.tone(90, 0.2, "square", 0.2);
    this.noise(0.2, 0.18);
  }

  robber() {
    if (!this.ensure()) return;
    this.tone(120, 0.3, "sawtooth", 0.16);
    this.tone(90, 0.4, "sine", 0.12, 0.1);
  }

  click() {
    if (!this.ensure()) return;
    this.tone(660, 0.05, "sine", 0.1);
  }

  victory() {
    if (!this.ensure()) return;
    const seq = [392, 523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, 0.4, "triangle", 0.2, i * 0.12, this.sfxGain!));
    seq.forEach((f, i) => this.tone(f / 2, 0.5, "square", 0.1, i * 0.12));
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ---- ambient music: slow arpeggio, extra layer as intensity rises ----
  private startMusic() {
    if (!this.ctx) return;
    const scale = [196, 220, 262, 294, 330, 392];
    const bass = [98, 110, 98, 87];
    const loop = () => {
      if (!this.ctx) return;
      const note = scale[this.musicStep % scale.length];
      this.tone(note, 0.5, "sine", 0.06, 0, this.musicGain!);
      if (this.musicStep % 2 === 0) {
        this.tone(bass[(this.musicStep / 2) % bass.length | 0] || 98, 0.9, "triangle", 0.05, 0, this.musicGain!);
      }
      if (this.intensity > 0.4 && this.musicStep % 2 === 1) {
        this.tone(note * 2, 0.35, "triangle", 0.04 * this.intensity, 0.1, this.musicGain!);
      }
      if (this.intensity > 0.7) {
        this.tone(note * 3, 0.25, "sine", 0.03 * this.intensity, 0.2, this.musicGain!);
      }
      this.musicStep++;
      window.setTimeout(loop, this.intensity > 0.6 ? 360 : 520);
    };
    loop();
  }
}

export const audio = new AudioEngine();
