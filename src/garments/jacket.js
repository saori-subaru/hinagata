// A jacket worn open over the shirt (outfit.jacket; 2026-10-11, for ロゼ, an original character fitted to a reference sheet): the shirt pushed
// out over the torso, cropped at hem, open down the front (a V from the neck to v, then a straight gap of open on each side down to the
// hem: the shirt under it shows), long sleeves of its own round the arms ending cuff before the wrist (the shirt's cuff shows). Piping, a
// painted band, along the front edges, the hem and the cuffs. Base space, as the clothes are; hem and v as heights on the body before it
// is stretched (tools/measure.mjs --to gives them).
import { definePart } from "./registry.js";
import { smin, blend, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("ジャケット", "Jacket"), smax = (a, b, k) => -smin(-a, -b, k);

definePart({ src: import.meta.url,
  name: "jacket", path: "outfit.jacket", section: SEC, outline: 0.004, thin: "cloth",
  defaults: { on: false, color: "#f4f2ee", hem: 0.6, v: 0.64, open: 0.035, neckOpen: 0.06, cuff: 0.05, cuffBand: 0, lapel: 0, piping: null, pipingWidth: 0.006 },
  schema: [
    ["on", L("ジャケット", "Jacket"), { help: L("シャツの上に前を開けて着る。着たときだけ作る", "worn open over the shirt; built only when worn") }],
    ["color", L("ジャケットの色", "Jacket color"), { when: { ".on": true } }],
    ["hem", L("丈", "Hem"), { when: { ".on": true }, min: 0.4, max: 0.7, step: 0.002, help: L("すその高さ(伸ばす前の体で。肩は 0.73、股関節は 0.44)", "the hem's height, on the body before it is stretched (the shoulders at 0.73, the hip joints at 0.44)") }],
    ["v", L("えりのVの深さ", "V's point"), { when: { ".on": true }, min: 0.5, max: 0.74, step: 0.002, help: L("前の開きがV字から縦の合わせになる高さ(伸ばす前の体で)", "where the front's opening turns from a V into a straight gap (on the body before it is stretched)") }],
    ["open", L("前の開き", "Front gap"), { when: { ".on": true }, min: 0, max: 0.1, step: 0.001, help: L("Vより下で、真ん中から合わせ目までの幅(m)", "below the V, from the middle to each front edge (m)") }],
    ["neckOpen", L("首元の開き", "Gap at the neck"), { when: { ".on": true }, min: 0.02, max: 0.12, step: 0.001, help: L("首の付け根で真ん中から前の縁まで(m)", "at the neck's base, from the middle to each front edge (m)") }],
    ["cuff", L("袖口の位置", "Cuff"), { when: { ".on": true }, min: -0.05, max: 0.15, step: 0.002, help: L("手首から袖口までの長さ(m)。マイナスで手首より先", "from the wrist back to the cuff (m); below 0 past the wrist") }],
    ["cuffBand", L("袖口の折り返し", "Turned-back cuff"), { when: { ".on": true }, min: 0, max: 0.08, step: 0.001, help: L("袖口の折り返しの幅(m)。少し外へ出て、上のふちにもパイピング。0 = なし", "the turned-back cuff's width (m): standing out a little, piped along its top edge too; 0 = none") }],
    ["lapel", L("襟(ラペル)の幅", "Lapel width"), { when: { ".on": true }, min: 0, max: 0.08, step: 0.001, help: L("前の縁から折り返した襟の幅(m)。0 = なし。Vの上の部分に、首の横で切れ込みがつく", "how wide the turned-back collar is from the front edge (m); 0 = none. Along the V, with a notch beside the neck") }],
    ["piping", L("パイピングの色", "Piping color"), { when: { ".on": true }, nullable: true, type: "color", help: L("null = なし(前の縁・すそ・袖口の細い線)", "null = none (a thin line along the front edges, the hem and the cuffs)") }],
    ["pipingWidth", L("パイピングの太さ", "Piping width"), { when: { ".on": true }, min: 0.002, max: 0.03, step: 0.001, help: L("m", "m") }],
  ],
  build({ O, P, J, shirtSdf, bodySdf, slope }) {
    const NY = J.neck[1], VY = Math.min(O.v ?? 0.64, NY - 0.02), OW = O.open ?? 0.035, NO = O.neckOpen ?? 0.06, HEM = O.hem ?? 0.6, CUFF = O.cuff ?? 0.05;
    const kH = slope(HEM), kV = slope(VY), NRJ = -bodySdf(0, NY + 0.01, J.neck[2]) + 0.016;   // NRJ: the neckline's radius about the neck
    // the sleeves: the arm's own pieces 2.2 cm out (over the shirt's sleeve, 1.4 cm out), ending CUFF before the wrist
    const arms = ["L", "R"].map((s) => {
      const f = blend(Object.keys(P).filter((k) => k.endsWith(`.${s}`) && /^(upperArm|foreArm|foreBulge|shoulder)\./.test(k)).map((k) => P[k]));
      const E = J[`lowerArm.${s}`], W = J[`hand.${s}`], d0 = W.map((v, i) => v - E[i]), Lf = Math.hypot(...d0), d = d0.map((v) => v / Lf);
      const past = (x, y, z) => (x - E[0]) * d[0] + (y - E[1]) * d[1] + (z - E[2]) * d[2] - (Lf - CUFF);   // > 0 past the cuff
      return { f, past };
    });
    const armOf = (x) => arms[x >= 0 ? 0 : 1];
    // the front's opening: half its width by the height (a V above VY, a straight gap below it), in front of the body's middle plane only
    const openAt = (y) => y >= VY ? OW + (NO - OW) * Math.min(1, (y - VY) / Math.max(0.01, NY - VY)) : OW;
    const gap = (x, y, z) => z > 0.01 ? openAt(y) - Math.abs(x) : -1;   // > 0 in the opening
    const torso = (x, y, z, B) => shirtSdf(x, y, z, B, true, true) - 0.007;
    const CB = O.cuffBand ?? 0;   // a turned-back cuff (2026-10-11, for ロゼ): the sleeve 4 mm further out over its last CB, with a little step at its top
    const sleeve = (x, y, z) => { const A = armOf(x), p = A.past(x, y, z); return Math.max(A.f(x, y, z) - 0.022 - (CB ? 0.004 * sstep(-CB - 0.002, -CB + 0.002, p) : 0), p); };
    // the hem and the neckline cut the torso only (the sleeves hang below the hem: cut with it they ended at the elbow)
    const LW = O.lapel ?? 0, H0 = Math.max(VY - 0.01, NY - 0.6 * (NY - HEM)), H1 = NY + 0.01;   // (the lapels over the upper 60 % of the front, above the V's point)
    const lapW = (y) => { const t = (y - H0) / (H1 - H0); if (t < 0 || t > 1) return 0; const w = LW * (t < 0.72 ? Math.min(1, t / 0.72) ** 0.8 : 1 - 0.45 * (t - 0.72) / 0.28), n = (t - 0.74) / 0.06; return Math.abs(n) < 1 ? w * (0.25 + 0.75 * Math.abs(n)) : w; };   // (a tailored lapel: widest just under the notch, the collar above it narrower; 2026-10-11, ロゼ)
    const lapel = LW > 0 ? (x, y, z, B) => { const u = Math.abs(x), o = openAt(y), w = lapW(y); return Math.max(torso(x, y, z, B) - 0.005, u - (o + w), o - 0.002 - u, H0 - y, y - H1, 0.01 - z); } : null;
    const sdf = (x, y, z, B = bodySdf) => { if (lapel) { const l = lapel(x, y, z, B); if (l < 0.02) return Math.min(l, sdf0(x, y, z, B)); } return sdf0(x, y, z, B); };
    const sdf0 = (x, y, z, B = bodySdf) => { const d = smin(Math.max(smax(torso(x, y, z, B), HEM - y, 0.005), -Math.max((NY + (z < -0.01 ? 0.035 : 0.012)) - y, Math.hypot(x, z - J.neck[2]) - NRJ))   /* (the neckline cut only round the neck: cut by height alone it left the shoulders' tops bare, the shirt showing there as a dark band; higher at the back) */, sleeve(x, y, z), 0.012);   // (the hem as a base-space distance: times the stretch, the meshing overshot it 5 cm down)
      return smax(d, gap(x, y, z) * (y < VY ? 1 : 0.8), 0.003); };
    // the piping: how far in from the nearest edge (the front edge, the hem, a cuff), m as built
    // (a point on a sleeve: from its cuff only; on the torso: from the hem and the front edges)
    const edge = (x, y, z) => { const A = armOf(x); if (A.f(x, y, z) < 0.04 || Math.abs(sleeve(x, y, z)) < Math.abs(Math.max(torso(x, y, z, bodySdf), HEM - y)) - 0.001) return 10 - A.past(x, y, z);   /* (near the arm: the jacket's body is the shirt pushed out, its long sleeves too, and the hem's piping ran round the arm) */   // (on whichever surface is nearer: a sleeve beside the hem took the hem's piping)
      let e = (y - HEM) * kH; if (z > 0.01 && Math.abs(x) < 0.12) { const u = Math.abs(x), o = openAt(y), w = LW > 0 ? lapW(y) : 0; e = Math.min(e, u - o, w > 0.004 ? Math.abs(o + w - u) : 1); } return e; };
    return { sdf, edge, NY, HEM };
  },
  spec: (st, { H, B, ax, ay }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.5 - ax, Math.min(st.HEM - 0.05, 0.22) - ay, -0.22], hi: [0.5 + ax, st.NY + 0.13, 0.24], h: Math.min(H, 0.006), only: /^(hips|spine|chest|upperChest|neck|shoulder|upperArm|lowerArm)/ }),
  bands: { keys: ["piping", "pipingWidth"], value: (st) => (x, y, z) => st.edge(x, y, z), ranges: (O) => { const W = O.pipingWidth ?? 0.006, CB = O.cuffBand ?? 0; return O.piping ? [[-1, W, O.piping], [9, 10 + W, O.piping], ...(CB ? [[10 + CB - W, 10 + CB, O.piping]] : [])] : []; } },   // the body's edges / the cuff's edge (sleeves count from 10) / the turned-back cuff's top
});
