// Suspenders (outfit.suspenders; for ずんだもん's pumpkin shorts): two flat straps from the waist up over the shoulders and down the back,
// straight or crossed behind. Made as ribbons along a path on the clothes' outside (clothes/index.js outerSdf; spec's make), as the belt is:
// a strap's edges stay straight whatever the cells. Their lower ends go under a belt (the waistband). Base space, as the clothes are.
import { definePart } from "./registry.js";

const L = (ja, en) => ({ ja, en }), SEC = L("サスペンダー", "Suspenders");

definePart({ src: import.meta.url,
  name: "suspenders", path: "outfit.suspenders", section: SEC, outline: 0.003, soft: false, thin: "keep",
  defaults: { on: false, color: "#b9c265", x: 0.07, xTop: 0.06, xBack: 0.06, width: 0.038, thick: 0.004, from: null, back: "cross" },
  schema: [
    ["on", L("サスペンダー", "Suspenders"), { help: L("腰から肩を越えて背中へ下りる2本の帯。着たときだけ作る(下の端はベルト=腰帯の下に入る)", "two straps from the waist over the shoulders and down the back; built only when worn (their lower ends go under a belt, the waistband)") }],
    ["color", L("サスペンダーの色", "Suspenders color"), { when: { ".on": true } }],
    ["x", L("前の間隔", "Spacing in front"), { when: { ".on": true }, min: 0.03, max: 0.11, step: 0.002, help: L("腰の所の、まん中からの距離(m)", "from the middle, at the waist (m)") }],
    ["xTop", L("肩の間隔", "Spacing on the shoulders"), { when: { ".on": true }, min: 0.04, max: 0.11, step: 0.002, help: L("肩の上の、まん中からの距離(m)", "from the middle, on top of the shoulders (m)") }],
    ["xBack", L("後ろの間隔", "Spacing behind"), { when: { ".on": true }, min: 0.02, max: 0.11, step: 0.002, help: L("背中の腰の所の、まん中からの距離(m)", "from the middle, at the back of the waist (m)") }],
    ["width", L("幅", "Width"), { when: { ".on": true }, min: 0.01, max: 0.06, step: 0.002, help: L("m", "m") }],
    ["thick", L("厚み", "Thickness"), { when: { ".on": true }, min: 0.002, max: 0.01, step: 0.001, help: L("m", "m") }],
    ["from", L("下の端の高さ", "Lower ends' height"), { when: { ".on": true }, nullable: true, min: 0.44, max: 0.66, step: 0.002, help: L("伸ばす前の体で。null = ベルト(腰帯)の上端のすぐ下、なければズボンの上端", "on the body before it is stretched; null = just under the belt's top edge, or the pants' top") }],
    ["back", L("後ろ", "Behind"), { when: { ".on": true }, options: [{ value: "cross", label: L("交差(X)", "Crossed") }, { value: "straight", label: L("まっすぐ", "Straight") }] }],
  ],
  build({ O, OPT, J, outerSdf, slope }) {
    const BL = OPT.outfit.belt, PT = OPT.outfit.pants;
    const FROM = O.from ?? (BL?.on ? (BL.y ?? 0.52) + (BL.width ?? 0.04) / 2 / slope(BL.y ?? 0.52) - 0.012 : (PT?.top ?? 0.505) - 0.01);
    const X0 = O.x ?? 0.07, X1 = O.xTop ?? 0.06, XB = O.xBack ?? 0.06, CROSS = (O.back ?? "cross") === "cross", HW = (O.width ?? 0.038) / 2, TK = O.thick ?? 0.004;
    const YC = J["upperArm.L"][1] - 0.07, ZC = 0, LIFT = 0.0015;
    const make = () => {
      const pos = [], nor = [], idx = [];
      const grad = (p) => { const e = 0.003, g = [0, 1, 2].map((i) => { const a = [...p], b = [...p]; a[i] += e; b[i] -= e; return outerSdf(...a) - outerSdf(...b); }), l = Math.hypot(...g) || 1; return g.map((v) => v / l); };
      // the surface going out from the pivot at an angle in the plane across the shoulders (0 forward, 90° up, 180° back), at x
      const hit = (x, a) => { const dy = Math.sin(a), dz = Math.cos(a); let t = 0.01; while (t < 0.4 && outerSdf(x, YC + dy * t, ZC + dz * t) < 0) t += 0.004;
        let lo = Math.max(0, t - 0.004), hi = t; for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (outerSdf(x, YC + dy * m, ZC + dz * m) < 0) lo = m; else hi = m; } return [x, YC + dy * hi, ZC + dz * hi]; };
      const top = hit(X1, Math.PI / 2)[1];   // the shoulder's top under the strap
      for (const m of [1, -1]) {
        // x along the strap: from the waist's spacing to the shoulder's by the height, in front and behind (crossed: to the other side)
        const xAt = (y, front) => front ? m * (X1 + (X0 - X1) * Math.min(1, Math.max(0, (top - y) / (top - FROM)))) : m * (X1 + ((CROSS ? -XB : XB) - X1) * Math.min(1, Math.max(0, (top - y) / (top - FROM))));
        const raw = [];
        for (let i = 0; i <= 240; i++) { const a = (-80 + 340 * i / 240) * Math.PI / 180, front = a < Math.PI / 2; let p = hit(m * X1, a);
          for (let k = 0; k < 3; k++) p = hit(xAt(p[1], front), a);
          if (p[1] >= FROM) raw.push(p); }
        if (raw.length < 4) continue;
        // even steps along it
        const len = [0]; for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], (raw[i][1] - raw[i - 1][1]) * slope(raw[i][1]), raw[i][2] - raw[i - 1][2]));
        const N = Math.max(8, Math.round(len.at(-1) / 0.008)), P = [];
        for (let i = 0, j = 0; i <= N; i++) { const s = len.at(-1) * i / N; while (j < raw.length - 2 && len[j + 1] < s) j++; const f = (s - len[j]) / Math.max(1e-9, len[j + 1] - len[j]); P.push([0, 1, 2].map((q) => raw[j][q] + (raw[j + 1][q] - raw[j][q]) * f)); }
        let Nn = P.map(grad);
        for (let pass = 0; pass < 2; pass++) Nn = Nn.map((n, i) => { const a = Nn[Math.max(0, i - 1)], b = Nn[Math.min(N, i + 1)], v = [0, 1, 2].map((q) => a[q] + 2 * n[q] + b[q]), l = Math.hypot(...v) || 1; return v.map((c) => c / l); });   // (a fold of the cloth under it doesn't twist the strap)
        // its cross-section: [across, out] with beveled outer corners; flat normals per face
        const BV = Math.min(TK * 0.4, 0.0015), sec = [[-HW, 0], [-HW, TK - BV], [-HW + BV, TK], [HW - BV, TK], [HW, TK - BV], [HW, 0]], K = sec.length - 1;
        // crossed behind: the character's left strap lies over the other one where they cross
        const over = (p) => CROSS && m > 0 && p[2] < ZC ? (TK + 0.001) * Math.max(0, 1 - Math.abs(p[0]) / (HW * 2.2)) : 0;
        const ring = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)], t0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], tl = Math.hypot(...t0) || 1, t = t0.map((v) => v / tl), n = Nn[i];
          const w0 = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]], wl = Math.hypot(...w0) || 1, w = w0.map((v) => v / wl), up = LIFT + over(p);
          return sec.map(([s, o]) => [0, 1, 2].map((q) => p[q] + w[q] * s + n[q] * (up + o))); });
        for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = ring[i][k], b = ring[i + 1][k], c = ring[i][k + 1], d = ring[i + 1][k + 1], v = pos.length / 3;
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]], l = Math.hypot(...n) || 1;
          pos.push(...a, ...b, ...c, ...d); for (let q = 0; q < 4; q++) nor.push(n[0] / l, n[1] / l, n[2] / l); idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
      }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }; };
    return { make };
  },
  spec: (st, { H }) => ({ make: st.make, sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, only: /^(spine|chest|upperChest|shoulder|neck|upperArm)/ }),   // (the upper arms too, as the shirt under them: without, the shirt rose over the straps with the arms raised)
});
