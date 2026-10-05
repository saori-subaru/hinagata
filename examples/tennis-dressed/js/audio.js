// WebAudio で合成する効果音（音声ファイル不要）
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  _noise(t, dur, freq, q, gain, type = 'bandpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  _tone(t, freq, dur, gain, type = 'sine', slideTo) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hit(power = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.05, 2600, 1.4, 0.5 + 0.4 * power);
    this._tone(t, 560 + 240 * power, 0.07, 0.35, 'triangle', 280);
  }

  bounce(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = Math.min(1, v / 10) * 0.45;
    if (g < 0.02) return;
    this._tone(t, 160, 0.08, g, 'sine', 80);
    this._noise(t, 0.04, 1100, 1, g * 0.5);
  }

  net(k = 1) {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.2, 380, 0.6, 0.45 * k, 'lowpass');
  }

  applause(intensity = 1) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const n = Math.round(160 * intensity);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const t = t0 + 0.05 + u * u * 2.2;
      this._noise(t, 0.03, 1400 + Math.random() * 2400, 1.5, 0.05 + Math.random() * 0.1 * (1 - u * 0.6));
    }
  }

  click() {
    if (!this.ctx) return;
    this._tone(this.ctx.currentTime, 880, 0.05, 0.15, 'square');
  }
}
