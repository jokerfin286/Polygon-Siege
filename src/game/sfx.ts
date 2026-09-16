/* Tiny WebAudio synth — no assets, all procedural. */

class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  private noise: AudioBuffer | null = null;
  private last: Record<string, number> = {};

  init() {
    if (this.ctx) return;
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch { /* no audio */ }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if (this.last[key] && now - this.last[key] < ms) return false;
    this.last[key] = now;
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, q = 1, delay = 0) {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  shoot(kind: string) {
    if (!this.throttle('s' + kind, 45)) return;
    switch (kind) {
      case 'bullet': this.tone(760, 0.05, 'square', 0.035, 0.5); break;
      case 'disc':   this.tone(520, 0.08, 'triangle', 0.05, 1.6); break;
      case 'beam':   this.tone(1200, 0.14, 'sawtooth', 0.04, 0.35); break;
      case 'orb':    this.tone(300, 0.16, 'sine', 0.06, 2.0); break;
      case 'shell':  this.tone(150, 0.22, 'square', 0.07, 0.4); this.hiss(0.18, 0.05, 500); break;
      case 'missile':this.tone(420, 0.12, 'sawtooth', 0.04, 2.2); break;
      case 'ring':   this.tone(600, 0.10, 'triangle', 0.04, 1.3); break;
      case 'nova':   this.tone(90, 0.35, 'sine', 0.10, 3.0); this.hiss(0.3, 0.05, 260); break;
      case 'arc':    this.hiss(0.14, 0.06, 2400, 3); this.tone(900, 0.1, 'sawtooth', 0.03, 0.4); break;
      default:       this.tone(600, 0.06, 'square', 0.03, 0.6);
    }
  }

  hit() {
    if (!this.throttle('hit', 28)) return;
    this.hiss(0.05, 0.035, 1800, 1.5);
  }

  kill() {
    if (!this.throttle('kill', 30)) return;
    this.tone(220, 0.12, 'square', 0.05, 0.4);
    this.hiss(0.12, 0.05, 700, 0.8);
  }

  explode() {
    if (!this.throttle('ex', 60)) return;
    this.tone(90, 0.32, 'square', 0.09, 0.35);
    this.hiss(0.3, 0.08, 320, 0.7);
  }

  hurt() {
    this.tone(180, 0.22, 'sawtooth', 0.10, 0.35);
    this.hiss(0.16, 0.06, 400, 0.6);
  }

  pickup() {
    if (!this.throttle('pk', 40)) return;
    this.tone(880, 0.06, 'sine', 0.035, 1.5);
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.07, 1, i * 0.07));
  }

  select() { this.tone(660, 0.08, 'square', 0.05, 1.4); }
  buy() { [440, 660, 880].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, 1, i * 0.05)); }
  dash() { this.hiss(0.16, 0.06, 1200, 0.9); this.tone(300, 0.14, 'sine', 0.04, 3); }
  dead() {
    [440, 330, 262, 175].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.09, 0.6, i * 0.13));
    this.hiss(0.7, 0.09, 200, 0.5);
  }
  boss() {
    [110, 82, 110, 147].forEach((f, i) => this.tone(f, 0.5, 'square', 0.09, 1, i * 0.16));
  }
}

export const sfx = new Sfx();
