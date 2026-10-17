// Baggy trousers (outfit.baggy; 2026-10-17, Saori, after a three-view sheet's cargo pants: "ダボっとしたズボンを作りたい"): each leg a wide
// tube down the leg (its half width across and front to back given along it, from the hip joint to the ankle), the two melted together above
// the crotch and into the hips (the body pushed out a little up to the waist), gathered into a cuff at the hem with creases running up from
// it. It doesn't swing (the legs carry it). Base space, as the clothes are: heights before the body is stretched.
import { definePart } from "./registry.js";
import { smin, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("ダボっとしたズボン", "Baggy trousers"), smax = (a, b, k) => -smin(-a, -b, k);
const listAt = (A, t) => { if (!Array.isArray(A)) return A; const f = Math.min(1, Math.max(0, t)) * (A.length - 1), i = Math.min(A.length - 2, Math.floor(f)), u = f - i, s = u * u * (3 - 2 * u); return A[i] * (1 - s) + A[i + 1] * s; };

definePart({ src: import.meta.url,
  name: "baggy", path: "outfit.baggy", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#e9e9ee", waist: 0.53, crotch: 0.05, w: [0.09, 0.095, 0.1, 0.095, 0.075, 0.05], d: [0.08, 0.085, 0.09, 0.085, 0.075, 0.05], splay: 0.03, hem: 0.02, folds: 7, fold: 0.008 },
  schema: [
    ["on", L("ダボっとしたズボン", "Baggy trousers"), { help: L("太くてゆったりしたズボン。すそでしぼる。着たときだけ作る", "wide, loose trousers gathered at the hem; built only when worn") }],
    ["color", L("ズボンの色", "Trousers color"), { when: { ".on": true } }],
    ["waist", L("ウエストの高さ", "Waist"), { when: { ".on": true }, min: 0.44, max: 0.65, step: 0.002, help: L("伸ばす前の体で(股関節は 0.44)", "on the body before it is stretched (the hip joints at 0.44)") }],
    ["crotch", L("股下の下がり", "Crotch drop"), { when: { ".on": true }, min: 0, max: 0.2, step: 0.002, help: L("左右の脚が分かれる所を股関節からどれだけ下げるか(m)。大きいとサルエル", "how far below the hip joints the legs part (m); large, harem pants") }],
    ["w", L("横の太さ", "Width"), { when: { ".on": true }, type: "list", help: L("脚1本の横の半分の太さ(m)、股関節から足首まで等間隔に", "each leg's half width across (m), evenly from the hip joint to the ankle") }],
    ["d", L("前後の太さ", "Depth"), { when: { ".on": true }, type: "list", help: L("前後の半分の太さ(m)、同じく", "its half depth front to back (m), the same way") }],
    ["splay", L("すその開き", "Splay"), { when: { ".on": true }, min: 0, max: 0.1, step: 0.002, help: L("すそで脚の中心が外へずれる量(m)", "how far out the legs' middles move by the hem (m)") }],
    ["hem", L("すその高さ", "Hem"), { when: { ".on": true }, min: -0.05, max: 0.2, step: 0.002, help: L("足首からすそまで(m)。マイナスで足首より下", "from the ankle up to the hem (m); below 0 under the ankle") }],
    ["folds", L("すそのしわの数", "Hem creases"), { when: { ".on": true }, min: 0, max: 14, step: 1 }],
    ["fold", L("しわの深さ", "Crease depth"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("m。すそに近いほど深い", "m; deeper toward the hem") }],
  ],
  build({ O, J, bodySdf }) {
    const W = O.w ?? 0.09, D = O.d ?? 0.08, CR = O.crotch ?? 0.05, SP = O.splay ?? 0.03, HEM = O.hem ?? 0.02, NF = O.folds ?? 7, FA = O.fold ?? 0.008, WY = O.waist ?? 0.53;
    const legs = ["L", "R"].map((s) => { const H = J[`upperLeg.${s}`], A = J[`foot.${s}`], m = Math.sign(H[0]) || (s === "L" ? 1 : -1), L0 = H[1] - A[1];
      // t: 0 at the hip joint, 1 at the ankle (by height); the middle line from the hip joint to over the ankle, moved out by splay toward the hem
      const at = (y) => (H[1] - y) / L0, mid = (t) => [H[0] + (A[0] - H[0]) * Math.max(0, t) + m * SP * Math.max(0, t) ** 2, H[2] + (A[2] - H[2]) * Math.max(0, t) + 0.01];
      const hemT = 1 - HEM / L0;
      const sdf = (x, y, z) => { const t = at(y), [cx, cz] = mid(t), w = listAt(W, t), d = listAt(D, t), px = x - cx, pz = z - cz, th = Math.atan2(pz, px);
        const cr = NF ? FA * Math.cos(NF * th) * sstep(hemT - 0.35, hemT, t) : 0, q = Math.hypot(px / w, pz / d), s = Math.min(w, d);   // cr: creases running up from the gathered hem
        return smax(Math.max((q - 1) * s - cr, t - hemT), y - H[1] - 0.02, 0.04); };   // (above the hip joint the hips take over: the legs' tubes went on up as square shoulders at the waist)
      return { sdf, m };
    });
    const crotchY = J["upperLeg.L"][1] - CR, HW = Math.abs(J["upperLeg.L"][0]) + 0.07;
    // the two legs: melted wide above the crotch, apart below it; the hips: the body pushed out 1.2 cm up to the waist
    const sdf = (x, y, z) => { const a = legs[0].sdf(x, y, z), b = legs[1].sdf(x, y, z), k = 0.004 + 0.08 * sstep(crotchY - 0.03, crotchY + 0.04, y);
      const hips = Math.max(bodySdf(x, y, z) - 0.018, crotchY - 0.02 - y, Math.abs(x) - HW);   // (only between the hips: the arms hang beside them)
      return smax(smin(smin(a, b, k), hips, 0.05), y - WY, 0.006); };
    return { sdf, WY };
  },
  spec: (st, { H, ax, ay }) => ({ sdf: st.sdf, lo: [-0.4 - ax, -0.05 - ay, -0.3], hi: [0.4 + ax, st.WY + 0.05, 0.3], h: Math.min(H, 0.0068), only: /^(hips|spine|upperLeg|lowerLeg|foot)/ }),
});
