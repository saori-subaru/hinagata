// A shirt's collar and a necktie (2026-10-11, for 初音ミク: "足りないパーツがあれば足してください"). The collar: a band standing round the
// neck and two flaps folded down over the shirt in front, coming to points; a trim, the shirt pushed out a few mm and cut to its outline,
// as the sailor collar is. The tie: a knot at the throat between the collar's flaps and a blade hanging down the front, widening to a
// pointed end, with a painted chevron. Heights given in m are as on the character (the stretch there is taken out). Base space.
import { definePart } from "./registry.js";
import { smin } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k), SEC = L("シャツの襟・ネクタイ", "Shirt collar and tie");
const TH = 0.005;   // how far the flaps stand off the shirt

// the shirt's front surface (z) at x, y: where the knot sits and the blade hangs from
const frontOf = (shirtSdf, bodySdf) => (x, y) => { let lo = -0.05, hi = 0.3; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (Math.min(shirtSdf(x, y, m, bodySdf, true, true), bodySdf(x, y, m) - 0.021) < 0) lo = m; else hi = m; } return lo; };   // (over the collar on the neck too)

definePart({ src: import.meta.url,
  name: "shirtCollar", path: "outfit.shirt.shirtCollar", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#ffffff", top: 0.07, depth: 0.05, spread: 0.05, width: 0.055, back: 0.03 },
  schema: [
    ["on", L("シャツの襟", "Shirt collar"), { help: L("首を囲む立ち襟と、前に折り返してとがる襟先。着たときだけ作る", "a band standing round the neck and two flaps folded down in front, coming to points; built only when worn") }],
    ["color", L("襟の色", "Collar color"), { when: { ".on": true } }],
    ["top", L("襟の高さ", "Collar height"), { when: { ".on": true }, min: 0.02, max: 0.12, step: 0.001, help: L("首の付け根(肩の高さ)から立ち襟の上まで(体の上で m)", "from the neck's base (at the shoulders' height) up to the stand's top (m, on the character)") }],
    ["depth", L("襟先の下がり", "Points' depth"), { when: { ".on": true }, min: 0.02, max: 0.15, step: 0.001, help: L("襟の合わせ目から襟先まで(体の上で m)", "from where the flaps meet down to the points (m, on the character)") }],
    ["spread", L("襟先の開き", "Points' spread"), { when: { ".on": true }, min: 0.01, max: 0.1, step: 0.001, help: L("真ん中から襟先まで(m)", "from the middle out to each point (m)") }],
    ["width", L("襟の横幅", "Collar width"), { when: { ".on": true }, min: 0.04, max: 0.1, step: 0.001, help: L("首の横で襟が肩にかかる幅(真ん中から m)", "how far out over the shoulders it reaches beside the neck (m from the middle)") }],
    ["back", L("後ろの深さ", "Back depth"), { when: { ".on": true }, min: 0.01, max: 0.06, step: 0.001, help: L("後ろで首から下へ(体の上で m)", "down from the neck at the back (m, on the character)") }],
  ],
  build({ O: SC, J, shirtSdf, bodySdf, slope }) {
    // heights from the neck's joint (its base, at the shoulders' height), as built: the stand's top in front; where the flaps meet a little
    // under it (the tie's knot sits there); the points depth under that
    const NY = J.neck[1], NZ = J.neck[2], k = slope(NY), YT = NY + (SC.top ?? 0.07) / k, DEP = (SC.depth ?? 0.05) / k, BK = (SC.back ?? 0.03) / k;
    const PX = SC.spread ?? 0.05, W = SC.width ?? 0.055, YC = YT - 0.025 / k, PY = YC - DEP, YW = YT - 0.006 / k, ZS = NZ - 0.012;   // the points; YC: where the flaps meet in the middle; YW: their outer top beside the neck
    const l1 = (u) => YC + (PY - YC) * u / PX, l2 = (u) => PY + (YW - PY) * (u - PX) / Math.max(0.005, W - PX);   // the flaps' lower edges: in from the point, out from it
    const n1 = Math.hypot(1, (YC - PY) / PX * k), n2 = Math.hypot(1, (YW - PY) / Math.max(0.005, W - PX) * k);
    const region = (x, y, z) => { const u = Math.abs(x), r = Math.hypot(x, z - NZ); if (z < ZS) return Math.max(r - W, (NY - BK - y) * k);   // (round the neck only: cut by height alone it lay over the shoulders' tops)
      return smax(Math.max((l1(u) - y) * k / n1, (l2(u) - y) * k / n2), u - W, 0.003); };   // < 0 on the collar
    // the flaps lie on the shirt 5 mm out, and above the shirt's neckline on the neck 2.1 cm out (over the stand)
    const NR = -bodySdf(0, NY + 0.01, NZ) + 0.025;   // round the neck only (the neck's radius there, and room): not under the chin
    const flaps = (x, y, z, B) => Math.max(Math.min(shirtSdf(x, y, z, B, true, true) - TH, Math.max(B(x, y, z) - 0.021, Math.hypot(x, z - NZ) - NR)), region(x, y, z), y - YT - 0.004);
    // the stand: round the neck, from inside the shirt up to YT (higher at the back), 1.6 cm off the body below (over the shirt, which stands
    // 1.4 cm off it) and closer up the neck
    const stand = (x, y, z, B) => Math.max(B(x, y, z) - 0.016 + 0.008 * Math.min(1, Math.max(0, (y - NY) / Math.max(0.01, YT - NY))), (y - (YT + 0.012 / k * (1 - Math.max(0, Math.min(1, (z - NZ + 0.02) / 0.05))))) * k, NY - 0.05 - y, Math.hypot(x, z - NZ) - NR);
    return { sdf: (x, y, z, B = bodySdf) => smin(flaps(x, y, z, B), stand(x, y, z, B), 0.003), lo: [-W - 0.05, PY - 0.03, -0.16], hi: [W + 0.05, YT + 0.04, 0.2] };
  },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: st.lo, hi: st.hi, h: Math.min(H, 0.004), only: /^(chest|upperChest|neck)/ }),
});

definePart({ src: import.meta.url,
  name: "necktie", path: "outfit.shirt.tie", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#2fc4c4", y: 0.045, length: 0.3, width: 0.06, knot: 0.026, mark: null, markAt: 0.05, markWidth: 0.008 },
  schema: [
    ["on", L("ネクタイ", "Necktie"), { help: L("のどもとの結び目から前に垂らす。着たときだけ作る", "knotted at the throat, hanging down the front; built only when worn") }],
    ["color", L("ネクタイの色", "Tie color"), { when: { ".on": true } }],
    ["y", L("結び目の高さ", "Knot height"), { when: { ".on": true }, min: -0.05, max: 0.12, step: 0.001, help: L("首の付け根(肩の高さ)から上へ(体の上で m)。シャツの襟の合わせ目は「襟の高さ」の 2.5 cm 下", "up from the neck's base (at the shoulders' height; m, on the character); the shirt collar's flaps meet 2.5 cm under its height") }],
    ["length", L("ネクタイの長さ", "Tie length"), { when: { ".on": true }, min: 0.1, max: 0.5, step: 0.005, help: L("結び目から先まで(体の上で m)", "from the knot to the tip (m, on the character)") }],
    ["width", L("ネクタイの幅", "Tie width"), { when: { ".on": true }, min: 0.02, max: 0.1, step: 0.001, help: L("先の幅(m)", "its width at the end (m)") }],
    ["knot", L("結び目の大きさ", "Knot size"), { when: { ".on": true }, min: 0.012, max: 0.05, step: 0.001, help: L("m", "m") }],
    ["mark", L("山形の線の色", "Chevron color"), { when: { ".on": true }, nullable: true, type: "color", help: L("null = なし(先の近くの山形の線)", "null = none (a chevron near the tip)") }],
    ["markAt", L("山形の位置", "Chevron's height"), { when: { ".on": true }, min: 0.01, max: 0.2, step: 0.001, help: L("先から上へ(m)", "up from the tip (m)") }],
    ["markWidth", L("山形の太さ", "Chevron width"), { when: { ".on": true }, min: 0.002, max: 0.03, step: 0.001, help: L("m", "m") }],
  ],
  build({ O: TI, J, shirtSdf, bodySdf, slope }) {
    const front = frontOf(shirtSdf, bodySdf), NY = J.neck[1], k = slope(NY), KN = TI.knot ?? 0.026, KY = NY + (TI.y ?? 0.045) / k, kz = front(0, KY) + 0.006;
    const W1 = (TI.width ?? 0.06) / 2, W0 = KN * 0.35, Y0 = KY - 0.6 * KN / k, LEN = TI.length ?? 0.3;
    // the blade's length down the body, as built: the base heights it covers, step by step (the stretch changes down the torso)
    const NS = 60; let Y1 = Y0; { let acc = 0; while (acc < LEN - 0.6 * KN && Y1 > 0.2) { acc += 0.002 * slope(Y1); Y1 -= 0.002; } }
    const zAt = new Float32Array(NS + 1); { let m = kz - 0.004; for (let i = 0; i <= NS; i++) { const y = Y0 + (Y1 - Y0) * i / NS; m = Math.max(m, front(W1 * 0.6, y) + 0.006, front(0, y) + 0.006); zAt[i] = m; } }
    const tipK = 0.9 / slope(Y1);   // the tip's point: how much higher its sides are than its middle (base heights per m across)
    const blade = (x, y, z) => { const t = Math.min(1, Math.max(0, (Y0 - y) / (Y0 - Y1))), hw = W0 + (W1 - W0) * Math.min(1, t * 1.6), i = Math.min(NS - 1, Math.floor(t * NS)), f = t * NS - i, cz = zAt[i] * (1 - f) + zAt[i + 1] * f;
      const cut = (Y1 + tipK * Math.abs(x)) - y;
      return smax(Math.max(Math.abs(x) - hw, Math.abs(z - cz) - 0.003), Math.max(y - Y0 - 0.01, cut * slope(Y1) / Math.hypot(1, tipK * slope(Y1))), 0.0015); };
    const knot = (x, y, z) => { const q = [x / (KN * 0.55), (y - KY) * k / (KN * 0.6), (z - kz) / 0.011]; return (Math.hypot(...q) - 1) * Math.min(KN * 0.55, 0.011); };
    return { Y1, tipK, slopeTip: slope(Y1), sdf: (x, y, z) => smin(blade(x, y, z), knot(x, y, z), 0.004), lo: [-W1 - 0.03, Y1 - 0.02, -0.05], hi: [W1 + 0.03, NY + 0.04, Math.max(...zAt) + 0.04] };
  },
  spec: (st, { H }) => ({ sdf: st.sdf, lo: st.lo, hi: st.hi, h: Math.min(H * 0.6, 0.003), only: /^(chest|upperChest|neck)/ }),
  // the chevron: how far above the tip's V (m, as built), the same V shape
  bands: { keys: ["mark", "markAt", "markWidth"], value: (st) => (x, y) => (y - (st.Y1 + st.tipK * Math.abs(x))) * st.slopeTip,
    ranges: (O) => O.mark ? [[O.markAt ?? 0.05, (O.markAt ?? 0.05) + (O.markWidth ?? 0.008), O.mark]] : [] },
});
