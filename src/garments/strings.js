// Hip strings (outfit.strings; 2026-10-10, for 島風): thin strings round the hips, rising high at the sides (a high-cut underwear's, showing
// over a low skirt). A thin flat strap lying on the body: low at the front and the back (in the middle, under a skirt), rising above the hip
// joints at the sides. Made as a ribbon along a path on the body's surface (spec's make), not cut out of a distance: a band a few mm tall is
// finer than the cells, and came out in dashes. Base space, as the clothes are.
import { definePart } from "./registry.js";

const L = (ja, en) => ({ ja, en }), SEC = L("腰の紐", "Hip strings");

definePart({ src: import.meta.url,
  name: "strings", path: "outfit.strings", section: SEC, outline: 0.0015, soft: false, thin: "keep",
  defaults: { on: false, color: "#1c1c22", rise: 0.05, width: 0.006, span: 1 },
  schema: [
    ["on", L("腰の紐", "Hip strings"), { help: L("腰にかかる細い紐(ハイレグの下着の、ローライズのスカートから見える紐)。着たときだけ作る", "thin strings round the hips (a high-cut underwear's, showing over a low skirt); built only when worn") }],
    ["color", L("紐の色", "Strings color"), { when: { ".on": true } }],
    ["rise", L("横の高さ", "Rise at the sides"), { when: { ".on": true }, min: 0, max: 0.12, step: 0.002, help: L("脚の付け根から、横でどこまで上がるか(伸ばす前の体で m)", "how far above the hip joints it rises at the sides (m, on the body before it is stretched)") }],
    ["width", L("紐の太さ", "Strings width"), { when: { ".on": true }, min: 0.003, max: 0.02, step: 0.001, help: L("m", "m") }],
    ["span", L("上がり方", "How it rises"), { when: { ".on": true }, min: 0.3, max: 3, step: 0.05, help: L("1 = なだらかな弧 / 大きいほど前から急に上がる", "1 = a gentle arch; more rises steeply from the front") }],
  ],
  build({ O: HS, J, bodySdf, slope }) {
    const HIP = J["upperLeg.L"][1], LOW = HIP - 0.01, TOP = HIP + (HS.rise ?? 0.05), SPAN = HS.span ?? 1, ZC = -0.01;
    // h(angle): front (0) low, the sides (±90°) at the top, the back low again; span narrows the rise toward the sides (1: a smooth arch)
    const h = (th) => LOW + (TOP - LOW) * Math.sin(Math.abs(th) % Math.PI) ** (2 / SPAN);
    const make = () => {
      const N = 200, K = 8, RB = (HS.width ?? 0.006) / 2 / slope(TOP), RN = 0.0011, LIFT = 0.0018, P = [], Nn = [];   // RB: half its width (base: heights are stretched); RN: half its thickness
      const grad = (p) => { const e = 0.0007, g = [0, 1, 2].map((i) => { const a = [...p], b = [...p]; a[i] += e; b[i] -= e; return bodySdf(...a) - bodySdf(...b); }), l = Math.hypot(...g) || 1; return g.map((v) => v / l); };
      for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2 - Math.PI, y = h(th), d = [Math.sin(th), 0, Math.cos(th)];
        let lo = 0, hi = 0.3; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (bodySdf(d[0] * m, y, ZC + d[2] * m) < 0) lo = m; else hi = m; }   // the first way out from the middle (not the arm hanging beside)
        const p = [d[0] * lo, y, ZC + d[2] * lo]; P.push(p); Nn.push(grad(p)); }
      const pos = [], nor = [], idx = [];
      for (let i = 0; i < N; i++) { const a = P[(i + N - 1) % N], b = P[(i + 1) % N], t0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = Nn[i];
        const tl = Math.hypot(...t0), t = t0.map((v) => v / tl), w0 = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]], wl = Math.hypot(...w0), w = w0.map((v) => v / wl);   // w: across the strap, on the surface
        for (let k = 0; k < K; k++) { const f = k / K * Math.PI * 2, c = Math.cos(f), s = Math.sin(f);
          for (let q = 0; q < 3; q++) { pos.push(P[i][q] + n[q] * (LIFT + RN + RN * c) + w[q] * RB * s); }
          const nn = [0, 1, 2].map((q) => n[q] * c / RN + w[q] * s / RB), nl = Math.hypot(...nn); nor.push(...nn.map((v) => v / nl)); } }
      for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = ((i + 1) % N) * K + k, d = ((i + 1) % N) * K + (k + 1) % K; idx.push(a, c, b, b, c, d); }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }; };
    return { make };
  },
  spec: (st, { H }) => ({ make: st.make, sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, only: /^(hips|spine|upperLeg)/ }),
});
