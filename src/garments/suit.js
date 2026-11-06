// A suit: the jacket, the shirt's collar points and a tie (for the town's crowd: salarymen, the station staff). Made as the sailor collar is
// (sailor.js): each a shape over the shirt or the body, cut to its region. Base space (before body.proportion stretches the body), heights
// from the joints (J), so they sit the same on the chibi and the adult bodies.
import { definePart } from "./registry.js";
import { smin, sstep, blendFast } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k), SEC = L("スーツ", "Suit");
const TH = 0.004;   // how far the collar points and the tie stand off the shirt

// the shirt's front surface (z) at (x, y), or null where there is no shirt (above its neckline)
const frontOf = (shirtSdf, B) => (x, y) => { if (shirtSdf(x, y, 0.3, B, true) < 0) return 0.3; let lo = -0.05, hi = 0.3; if (shirtSdf(x, y, lo, B, true) > 0) return null;
  for (let k = 0; k < 26; k++) { const m = (lo + hi) / 2; if (shirtSdf(x, y, m, B, true) < 0) lo = m; else hi = m; } return lo; };
// the front neckline's height at |x| = u: scanned down from the neck until the shirt is there
const necklineAt = (front, u, y0) => { let y = y0; while (y > y0 - 0.15 && front(u, y) == null) y -= 0.002; return y; };

// the opening's V: from the neck (half width `neck` there) to the button (y = VY), |x| below this is open in front
function vShape(O, J, slope) {
  const yS = J["upperArm.L"][1], yH = J["upperLeg.L"][1], VY = yH + (O.v ?? 0.42) * (yS - yH), NY = J.neck[1] - 0.01, NW = O.neck ?? 0.05;
  const a = NW / Math.max(0.03, NY - VY), n = Math.hypot(1, a / slope(VY));
  return { VY, NY, NW, open: (u, y) => (a * (y - VY) - u) / n };   // > 0 inside the opening
}

definePart({ src: import.meta.url,
  name: "jacket", path: "outfit.jacket", section: SEC, outline: 0.004, thin: "cloth",
  defaults: { on: false, color: "#2f3442", v: 0.42, neck: 0.05, lapel: 0.028, hem: 0.05, cutaway: 0.6, offset: 0.024 },
  schema: [
    ["on", L("上着(スーツ)", "Jacket (suit)"), { help: L("シャツの上に長袖の上着。前はV字に開いて下は閉じる。シャツは長袖・すそ入れが合う。着たときだけ作る", "a long-sleeved jacket over the shirt, open in a V in front and buttoned below. Goes with a long-sleeved, tucked shirt; built only when worn") }],
    ["color", L("上着の色", "Jacket color"), { when: { ".on": true } }],
    ["v", L("前のVの深さ", "V's point"), { when: { ".on": true }, min: 0.2, max: 0.8, step: 0.01, help: L("ボタンの高さ。脚の付け根(0)から肩(1)までの割合", "the button's height, from the hip joint (0) to the shoulder (1)") }],
    ["neck", L("首元のVの幅", "V's width at the neck"), { when: { ".on": true }, min: 0.02, max: 0.1, step: 0.001, help: L("m", "m") }],
    ["lapel", L("襟(ラペル)の幅", "Lapel width"), { when: { ".on": true }, min: 0, max: 0.06, step: 0.001, help: L("Vのふちに沿って折り返した襟の幅(m)。0 = なし", "the turned-back collar along the V's edges (m); 0 = none") }],
    ["hem", L("すその高さ", "Hem"), { when: { ".on": true }, min: -0.04, max: 0.12, step: 0.002, help: L("脚の付け根からどれだけ下か(伸ばす前の体で m)", "how far below the hip joint (m, on the body before it is stretched)") }],
    ["cutaway", L("すその前の開き", "Front cutaway"), { when: { ".on": true }, min: 0, max: 1.5, step: 0.05, help: L("ボタンの下で前がすそへ向かって開く傾き。0 = まっすぐ閉じる", "how the fronts part below the button toward the hem; 0 = closed straight down") }],
    ["offset", L("上着の厚み", "Jacket thickness"), { when: { ".on": true }, min: 0.016, max: 0.04, step: 0.001, help: L("体からの浮き(m)。シャツ(1.4cm)とズボンより外に", "how far it stands off the body (m); outside the shirt (1.4 cm) and the pants") }],
  ],
  // the torso and the arms (not the hands or the legs: the hem bridges the bottom), pushed out by offset; the neck cut a little above the
  // shirt's at the back, the sleeves cut 2 cm before the wrists (the shirt's cuff shows), the V open in front with the lapels raised along it
  build(ctx) {
    const { O, P, J, slope } = ctx, pick = (...n) => n.flatMap((k) => [P[k]?.cloth ?? P[k] ?? null, P[`${k}.L`] ?? null, P[`${k}.R`] ?? null]).filter(Boolean);
    const core = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "butt", "neck", "trap", "shoulder", "sleeve", "upperArm", "foreArm", "foreBulge"), [-0.75, 0.2, -0.3], [0.75, 0.95, 0.45]);
    const ARM = blendFast(pick("sleeve", "upperArm", "foreArm", "foreBulge"), [-0.75, 0.2, -0.3], [0.75, 0.95, 0.45]), TORSO = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "butt"), [-0.4, 0.2, -0.3], [0.4, 0.95, 0.45]);
    const V = vShape(O, J, slope), HEM = J["upperLeg.L"][1] - (O.hem ?? 0.05), LW = O.lapel ?? 0.028, CW = O.cutaway ?? 0.6, OFF = O.offset ?? 0.024;
    const arm = (s) => { const f = P[`foreArm.${s}`], n = Math.hypot(f.bx, f.by, f.bz); return { h: [f.ax + f.bx, f.ay + f.by, f.az + f.bz], g: [f.bx / n, f.by / n, f.bz / n] }; }, AL = arm("L"), AR = arm("R");   // the forearm as the body made it (the arms' own length: J is the chibi's)
    const ZS = J.neck[2] - 0.01;
    const sdf = (x, y, z) => {
      const u = Math.abs(x), A = x > 0 ? AL : AR, cuff = (x - A.h[0]) * A.g[0] + (y - A.h[1]) * A.g[1] + (z - A.h[2]) * A.g[2] + 0.02;
      const op = z > ZS ? (y > V.VY ? V.open(u, y) : (CW ? (CW * (HEM + 0.07 - y) - u) / Math.hypot(1, CW) : -1)) : -1;   // the opening (front only)
      const lap = LW && z > ZS && y > V.VY - 0.01 ? sstep(LW, LW * 0.6, -V.open(u, y)) * sstep(V.VY - 0.01, V.VY + 0.02, y) * 0.004 : 0;   // the lapels stand 4 mm proud
      let d = core(x, y, z) - OFF - lap;
      d = smax(d, op, 0.004);
      d = smax(d, cuff, 0.006);
      const hem = y < HEM + 0.02 && ARM(x, y, z) < TORSO(x, y, z) ? -1 : HEM - y;   // the hem across the torso only: the adult's long arms hang below it
      return Math.max(d, hem, y - (V.NY + 0.03 - 0.25 * Math.max(0, z - ZS))); };   // the collar round the back of the neck, lower toward the front
    return { sdf, HEM };
  },
  spec: (st, { H, ax, ay, OPT }) => ({ sdf: st.sdf, lo: [-0.42 - ax, Math.min(st.HEM, 0.35 - ay) - 0.02, -0.22], hi: [0.42 + ax, 0.86, 0.3 + bellyOf(OPT)], h: H * (OPT.quality.shirtCell ?? 0.75), only: /^(hips|spine|chest|upperChest|shoulder|neck|upperArm|lowerArm)/ }),
});
const bellyOf = (OPT) => { const W = OPT.body.adult?.on ? OPT.body.adult.waist ?? {} : null; return W ? Math.max(0, (W.z ?? 0.03) + (W.d ?? 0.056) + 0.07 - 0.22) : 0; };

definePart({ src: import.meta.url,
  name: "shirtCollar", path: "outfit.shirt.shirtCollar", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#ffffff", length: 0.04, spread: 0.05 },
  schema: [
    ["on", L("ワイシャツの襟", "Shirt collar points"), { help: L("首元に左右2枚のとがった襟。上着やネクタイと合わせる。着たときだけ作る", "two pointed collar flaps at the neck; with a jacket or a tie. Built only when worn") }],
    ["color", L("襟の色", "Collar color"), { when: { ".on": true }, help: L("ふつうはシャツと同じ色", "usually the shirt's color") }],
    ["length", L("襟の長さ", "Collar length"), { when: { ".on": true }, min: 0.02, max: 0.07, step: 0.001, help: L("首元から先まで(m)", "from the neck to the point (m)") }],
    ["spread", L("襟の開き", "Collar spread"), { when: { ".on": true }, min: 0.02, max: 0.08, step: 0.001, help: L("先の真ん中からの距離(m)", "the points' distance from the middle (m)") }],
  ],
  // each flap a triangle on the shirt's front (|x|, y): the neck's edge from the middle out, the point below and out; it stands off the
  // shirt and folds round the neck behind (a band up to the neckline all round)
  build(ctx) {
    const { O, shirtSdf, bodySdf, J } = ctx, front = frontOf(shirtSdf, bodySdf), yN = necklineAt(front, 0.012, J.neck[1] + 0.02), LEN = O.length ?? 0.04, SP = O.spread ?? 0.05;
    const P0 = [0.008, yN + 0.004], P1 = [0.05, yN + 0.012], P2 = [SP, yN - LEN];   // inner top, outer top, point
    const seg = (p, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2))); return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]); };
    const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const tri = (u, y) => { const p = [u, y], dd = Math.min(seg(p, P0, P1), seg(p, P1, P2), seg(p, P2, P0)), s = side(p, P0, P1), t = side(p, P1, P2), w = side(p, P2, P0);
      return (s >= 0) === (t >= 0) && (t >= 0) === (w >= 0) ? -dd : dd; };
    const ZS = J.neck[2] - 0.01, flaps = (x, y, z, B) => Math.max(shirtSdf(x, y, z, B, true, true) - TH - 0.002, z > ZS + 0.02 ? tri(Math.abs(x), y) : 1);
    // the band round the neck: a shell 6–10 mm off the neck, from the shirt's neckline up in front, from the neck's root behind (lower, it lay over the shoulders)
    const neckBand = (x, y, z, B) => Math.max(Math.abs(B(x, y, z) - 0.008) - 0.003, (z > ZS ? yN - 0.006 : J.neck[1] - 0.01) - y, y - (J.neck[1] + 0.025 - 0.25 * Math.max(0, z - J.neck[2])), Math.abs(x) - 0.085);
    return { sdf: (x, y, z, B = bodySdf) => Math.min(flaps(x, y, z, B), neckBand(x, y, z, B)), lo: [-0.11, yN - LEN - 0.02, -0.12], hi: [0.11, J.neck[1] + 0.06, 0.2] };
  },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: st.lo, hi: st.hi, h: Math.min(H * 0.6, 0.004), only: /^(chest|upperChest|neck)/ }),
});

definePart({ src: import.meta.url,
  name: "tie", path: "outfit.shirt.tie", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#7a2a36", width: 0.022, length: 0.75 },
  schema: [
    ["on", L("ネクタイ", "Tie"), { help: L("首元の結び目から下へ垂れるネクタイ。着たときだけ作る", "a tie hanging from a knot at the neck; built only when worn") }],
    ["color", L("ネクタイの色", "Tie color"), { when: { ".on": true } }],
    ["width", L("ネクタイの幅", "Tie width"), { when: { ".on": true }, min: 0.01, max: 0.04, step: 0.001, help: L("先の半分の幅(m)", "half its width at the end (m)") }],
    ["length", L("ネクタイの長さ", "Tie length"), { when: { ".on": true }, min: 0.1, max: 0.6, step: 0.005, help: L("首元からの長さ。脚の付け根から肩までを1とした割合", "its length from the neck, as a share of the hip joint to the shoulder") }],
  ],
  // the knot under the collar's points, the blade hanging straight down from the furthest forward the shirt reaches above (it doesn't follow
  // the chest's curve in), widening to a pointed end
  build(ctx) {
    const { O, shirtSdf, bodySdf, J } = ctx, front = frontOf(shirtSdf, bodySdf), yN = necklineAt(front, 0, J.neck[1] + 0.02);
    const yS = J["upperArm.L"][1], yH = J["upperLeg.L"][1], KY = yN - 0.012, Y1 = Math.max(yH, yN - (O.length ?? 0.3) * (yS - yH)), W = O.width ?? 0.022;
    const NY = 40, zAt = new Float32Array(NY + 1);
    { let m = -1; for (let i = 0; i <= NY; i++) { const y = KY + (Y1 - KY) * i / NY, f = front(0, y); m = Math.max(m, (f ?? 0.05) + TH + 0.004); zAt[i] = m; } }
    const kz = zAt[0];
    const blade = (x, y, z) => { const t = Math.min(1, Math.max(0, (KY - y) / (KY - Y1))), hw = W * (0.55 + 0.45 * t), i = Math.min(NY - 1, Math.floor(t * NY)), f = t * NY - i, cz = zAt[i] * (1 - f) + zAt[i + 1] * f;
      const tip = (Y1 + 1.0 * Math.abs(x)) - y;   // the end cut to a point
      return smax(Math.max(Math.abs(x) - hw, Math.abs(z - cz) - 0.003), Math.max(y - KY, tip), 0.002); };
    const knot = (x, y, z) => { const q = [x / 0.016, (y - KY) / 0.014, (z - kz) / 0.01]; return (Math.hypot(...q) - 1) * 0.01; };
    return { sdf: (x, y, z) => smin(blade(x, y, z), knot(x, y, z), 0.004), lo: [-0.06, Y1 - 0.02, kz - 0.06], hi: [0.06, KY + 0.03, Math.max(...zAt) + 0.03] };
  },
  spec: (st, { H }) => ({ sdf: st.sdf, lo: st.lo, hi: st.hi, h: Math.min(H * 0.6, 0.0035), only: /^(spine|chest|upperChest|neck)/ }),
});
