// Sounds made with Web Audio (no files): the racket, bounces, the net, the crowd, the umpire's beeps.
let ctx = null, master = null, noise = null, muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.7; return muted; }

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noiseHit(t, { type = "bandpass", f = 1500, q = 1, a = 0.002, d = 0.08, peak = 0.5, pan = 0 }) {
  const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 1;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, peak, d);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = pan;
  s.connect(fl); fl.connect(g); (p ? (g.connect(p), p) : g).connect(master); s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  return { fl, g };
}
function tone(t, { f = 440, f2 = f, type = "sine", a = 0.005, d = 0.15, peak = 0.3 }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + a + d);
  const g = ctx.createGain(); env(g, t, a, peak, d); o.connect(g); g.connect(master); o.start(t); o.stop(t + a + d + 0.05);
}

export function sfx(name, { vol = 1, pan = 0 } = {}) {
  if (!ctx || muted) return; const t = ctx.currentTime;
  switch (name) {
    case "hit": noiseHit(t, { f: 2200, q: 1.4, d: 0.07, peak: 0.6 * vol, pan }); tone(t, { f: 520, f2: 260, type: "triangle", d: 0.06, peak: 0.35 * vol }); break;
    case "smash": noiseHit(t, { f: 1600, q: 0.9, d: 0.12, peak: 0.9 * vol, pan }); tone(t, { f: 380, f2: 140, type: "triangle", d: 0.1, peak: 0.5 * vol }); break;
    case "bounce": tone(t, { f: 190, f2: 80, d: 0.08, peak: 0.35 * vol }); noiseHit(t, { type: "lowpass", f: 900, d: 0.05, peak: 0.2 * vol, pan }); break;
    case "net": noiseHit(t, { type: "lowpass", f: 420, q: 0.7, d: 0.22, peak: 0.5 * vol, pan }); break;
    case "whiff": { const n = noiseHit(t, { type: "highpass", f: 1800, a: 0.04, d: 0.12, peak: 0.12 * vol, pan }); n.fl.frequency.exponentialRampToValueAtTime(5000, t + 0.15); break; }
    case "cheer": { const n = noiseHit(t, { f: 1100, q: 0.4, a: 0.25, d: 1.6 * vol, peak: 0.35 * vol }); n.fl.frequency.linearRampToValueAtTime(1500, t + 1.2); noiseHit(t + 0.1, { f: 2600, q: 0.6, a: 0.2, d: 1.2, peak: 0.12 * vol }); break; }
    case "groan": { const n = noiseHit(t, { f: 500, q: 0.6, a: 0.15, d: 0.9, peak: 0.22 * vol }); n.fl.frequency.linearRampToValueAtTime(300, t + 0.9); break; }
    case "fault": tone(t, { f: 660, f2: 640, type: "square", d: 0.12, peak: 0.12 }); tone(t + 0.16, { f: 440, f2: 430, type: "square", d: 0.2, peak: 0.12 }); break;
    case "beep": tone(t, { f: 880, type: "square", d: 0.07, peak: 0.08 }); break;
    case "select": tone(t, { f: 660, f2: 990, type: "triangle", d: 0.1, peak: 0.15 }); break;
    case "toss": noiseHit(t, { type: "highpass", f: 3000, d: 0.05, peak: 0.06 }); break;
    case "win": [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, { f, type: "triangle", d: 0.25, peak: 0.18 })); break;
    case "lose": [392, 349, 311].forEach((f, i) => tone(t + i * 0.18, { f, type: "triangle", d: 0.3, peak: 0.15 })); break;
  }
}
