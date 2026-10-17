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
  defaults: { on: false, color: "#e9e9ee", waist: 0.53, crotch: 0.05, w: [0.09, 0.095, 0.1, 0.095, 0.075, 0.05], d: [0.08, 0.085, 0.09, 0.085, 0.075, 0.05], splay: 0.03, hem: 0.02, folds: 7, fold: 0.008, stack: 0.008, pocket: true, pocketAt: 0.45, pocketSize: [0.045, 0.035], pocketTurn: 20 },
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
    ["stack", L("すその布だまり", "Stacked hem"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("しぼったすその上に重なる横向きのたるみの深さ(m)", "how deep the rolls of cloth bunched over the gathered hem are (m)") }],
    ["pocket", L("カーゴポケット", "Cargo pockets"), { when: { ".on": true } }],
    ["pocketAt", L("ポケットの高さ", "Pocket height"), { when: { ".on": true, ".pocket": true }, min: 0.15, max: 0.8, step: 0.01, help: L("股関節(0)から足首(1)までのどこか", "where between the hip joint (0) and the ankle (1)") }],
    ["pocketSize", L("ポケットの大きさ", "Pocket size"), { when: { ".on": true, ".pocket": true }, type: "list", help: L("[幅, 高さ] の半分(m)", "[width, height], halves (m)") }],
    ["pocketTurn", L("ポケットの向き", "Pocket turn"), { when: { ".on": true, ".pocket": true }, min: -60, max: 60, step: 1, help: L("真横から前へ回す角度(度)", "turned from straight out toward the front (degrees)") }],
  ],
  build({ O, J, bodySdf }) {
    const ST = O.stack ?? 0.008, PK = O.pocket ? { t: O.pocketAt ?? 0.45, s: O.pocketSize ?? [0.05, 0.06], a: (O.pocketTurn ?? 20) * Math.PI / 180 } : null, W = O.w ?? 0.09, D = O.d ?? 0.08, CR = O.crotch ?? 0.05, SP = O.splay ?? 0.03, HEM = O.hem ?? 0.02, NF = O.folds ?? 7, FA = O.fold ?? 0.008, WY = O.waist ?? 0.53;
    const legs = ["L", "R"].map((s) => { const H = J[`upperLeg.${s}`], A = J[`foot.${s}`], m = Math.sign(H[0]) || (s === "L" ? 1 : -1), L0 = H[1] - A[1];
      // t: 0 at the hip joint, 1 at the ankle (by height); the middle line from the hip joint to over the ankle, moved out by splay toward the hem
      const at = (y) => (H[1] - y) / L0, mid = (t) => [H[0] + (A[0] - H[0]) * Math.max(0, t) + m * SP * Math.max(0, t) ** 2, H[2] + (A[2] - H[2]) * Math.max(0, t) + 0.01];
      const hemT = 1 - HEM / L0;
      const sdf = (x, y, z) => { const t = at(y), [cx, cz] = mid(t), w = listAt(W, t), d = listAt(D, t), px = x - cx, pz = z - cz, th = Math.atan2(pz, px);
        const cr = (NF ? FA * Math.cos(NF * th) * sstep(hemT - 0.35, hemT, t) : 0) + (ST ? ST * Math.sin(2 * Math.PI * (hemT - t) / 0.06) * sstep(hemT - 0.22, hemT - 0.12, t) * (1 - sstep(hemT - 0.02, hemT, t)) : 0), q = Math.hypot(px / w, pz / d), s = Math.min(w, d);   // cr: creases running up from the gathered hem
        let r = smax(Math.max((q - 1) * s - cr, t - hemT), y - H[1] - 0.02, 0.04);
        // a cargo pocket on the outer side of the thigh: a flat rounded box on the leg's surface, its flap a thicker strip over its top
        if (PK) { const tp = PK.t, [pcx, pcz] = mid(tp), pw = listAt(W, tp), pd = listAt(D, tp), ox = m * Math.cos(PK.a), oz = Math.sin(PK.a), rr = Math.hypot(ox * pw, oz * pd) / Math.hypot(ox, oz), Y0 = H[1] - tp * L0;
          const ux = x - (pcx + ox * rr), uy = y - Y0, uz = z - (pcz + oz * rr), n = ux * ox + uz * oz, a2 = -ux * oz + uz * ox, box = (h, hw, hh) => Math.hypot(Math.max(0, Math.abs(n) - h), Math.max(0, Math.abs(a2) - hw), Math.max(0, Math.abs(uy) - hh)) - 0.006;
          const flap = Math.hypot(Math.max(0, Math.abs(n - 0.004) - 0.012), Math.max(0, Math.abs(a2) - PK.s[0] - 0.003), Math.max(0, Math.abs(uy - PK.s[1] * 0.75) - 0.009)) - 0.004;
          r = Math.min(r, smin(box(0.008, PK.s[0], PK.s[1]), flap, 0.004)); }
        return r; };   // (above the hip joint the hips take over: the legs' tubes went on up as square shoulders at the waist)
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
