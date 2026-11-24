// A belt (outfit.belt; for アステル's tunic): a flat strap round the waist over what is worn there (clothes/index.js outerSdf: the shirt,
// a skirt or dress under its top, the pants). Made as a ring along the clothes' outside at its height (spec's make), not cut out of a
// distance: its edges stay straight whatever the cells. A buckle is an accessory (kind "buckle") put on it. Base space, as the clothes are.
import { definePart } from "./registry.js";

const L = (ja, en) => ({ ja, en }), SEC = L("ベルト", "Belt");

definePart({ src: import.meta.url,
  name: "belt", path: "outfit.belt", section: SEC, outline: 0.003, soft: false, thin: "keep",
  defaults: { on: false, color: "#7a5a48", y: 0.52, width: 0.04, thick: 0.007, tilt: 0, flare: 0, blouse: 0, blouseUnder: 0 },
  schema: [
    ["on", L("ベルト", "Belt"), { help: L("服の上から腰に巻く帯。着たときだけ作る(バックルはアクセサリーの buckle を上に置く)", "a strap round the waist over the clothes; built only when worn (a buckle: the accessory \"buckle\" put on it)") }],
    ["color", L("ベルトの色", "Belt color"), { when: { ".on": true } }],
    ["y", L("高さ", "Height"), { when: { ".on": true }, min: 0.44, max: 0.66, step: 0.002, help: L("伸ばす前の体で(脚の付け根 0.44、肩 0.73)", "on the body before it is stretched (the hip joints at 0.44, the shoulders at 0.73)") }],
    ["width", L("幅", "Width"), { when: { ".on": true }, min: 0.01, max: 0.09, step: 0.002, help: L("m(できた体で)", "m (on the character)") }],
    ["thick", L("厚み", "Thickness"), { when: { ".on": true }, min: 0.003, max: 0.02, step: 0.001, help: L("m", "m") }],
    ["flare", L("末広", "Flare"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("下の縁が上の縁より外へ出る量(m)。0 = まっすぐな筒", "how much further out its bottom edge is than its top (m); 0 = a straight band") }],
    ["blouse", L("上の服のたるみ", "Blousing over it"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("ベルトのすぐ上で服がふくらんでかぶる量(m)。胴だけ(袖はそのまま)。0 = なし。ワンピースはスカートの始まり(waist)をベルトの下端に置くとスカートがベルトの下から広がる", "how far the clothes puff out right over the belt (m), the torso alone; 0 = none. With a dress, its waist at the belt's bottom edge: the skirt flares out from under it") }],
    ["blouseUnder", L("下の服のたるみ", "Blousing under it"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("ベルトのすぐ下でスカート・ワンピースのすそがふくらむ量(m)。スカートの始まりをベルトの下端に置いたとき用。0 = なし", "how far a skirt or a dress puffs out right under the belt (m), with the skirt's top at the belt's bottom edge; 0 = none") }],
    ["tilt", L("後ろ上がり", "Rise at the back"), { when: { ".on": true }, min: -0.3, max: 0.4, step: 0.01, help: L("後ろへ 1 m 行くごとに上がる量(m)。0 = 水平", "how much it rises per m toward the back; 0 = level") }],
  ],
  build({ O, outerSdf, slope }) {
    const Y = O.y ?? 0.52, TILT = O.tilt ?? 0, TK = O.thick ?? 0.007, ZC = -0.01, FL = O.flare ?? 0;
    const make = () => {
      const N = 96, HW = (O.width ?? 0.04) / 2 / slope(Y), LIFT = 0.002, BV = Math.min(TK * 0.4, 0.003), C = [];   // HW: half its width (base: heights are stretched); BV: the edges' bevel
      // the clothes' outside round the middle at three heights across the strap (the widest of them: it lies flat, not into a dip), going out from the middle
      for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2, d = [Math.sin(th), Math.cos(th)]; let r = 0;
        for (const dy of [-HW, 0, HW]) { let t = 0.02; const y = Y + dy - TILT * (ZC + d[1] * 0.1); while (t < 0.34 && outerSdf(d[0] * t, y, ZC + d[1] * t) < 0) t += 0.002;
          let lo = t - 0.002, hi = t; for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (outerSdf(d[0] * m, y, ZC + d[1] * m) < 0) lo = m; else hi = m; } r = Math.max(r, hi); }
        C.push(r); }
      for (let pass = 0; pass < 2; pass++) { const S = C.slice(); for (let i = 0; i < N; i++) C[i] = (S[(i + N - 1) % N] + 2 * S[i] + S[(i + 1) % N]) / 4; }   // (a fold of the cloth under it doesn't dent the strap)
      // its cross-section: [out from the clothes, up] with beveled outer corners; flat normals per face (each side its own vertices)
      const sec = [[0, -HW], [TK - BV, -HW], [TK, -HW + BV / slope(Y)], [TK, HW - BV / slope(Y)], [TK - BV, HW], [0, HW]], K = sec.length - 1, pos = [], nor = [], idx = [];
      const at = (i, q) => { const th = i / N * Math.PI * 2, s = Math.sin(th), c = Math.cos(th), r = C[i % N] + LIFT + sec[q][0] + FL * (HW - sec[q][1]) / (2 * HW), z = ZC + c * r; return [s * r, Y + sec[q][1] - TILT * z, z]; };
      for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) { const a = at(i, k), b = at(i + 1, k), c = at(i, k + 1), d = at(i + 1, k + 1), v = pos.length / 3;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], (c[1] - a[1]) * slope(Y), c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
        pos.push(...a, ...b, ...c, ...d); for (let q = 0; q < 4; q++) nor.push(n[0] / l, n[1] / l, n[2] / l); idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }; };
    return { make };
  },
  spec: (st, { H }) => ({ make: st.make, sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, only: /^(hips|spine|chest)/ }),
});
