// The sailor collar and its scarf (2026-10-10, for 島風). A trim is the garment under it pushed out a few mm and cut to its region, a
// solid as the socks are: its cut edges are its only sides, so it needs no cells finer than its own size (a 5 mm shell would need 2 mm
// cells all over). Base space (before body.proportion stretches the body), as the clothes are.
import { definePart } from "./registry.js";
import { smin, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k), SEC = L("セーラー襟", "Sailor collar");
const TH = 0.005;   // how far the collar stands off the shirt

// the collar's outline on the body, by u = |x| and the height y (base): the back flap (behind the shoulders' line) is a rectangle to width W
// and down to back; in front the lapels' outer edges run from the shoulders (W at the shoulder's top) to the V's point (0, v), and their
// inner edges (the V's opening) from the neck (neck wide there) to a little above it, so the lapels meet at the point. Distances are
// measured as built (heights times the stretch there). The scarf follows the same V.
function shape({ OPT, J, slope }) {
  const SA = OPT.outfit.shirt.sailor ?? {}, W = SA.width ?? 0.085, BACK = SA.back ?? 0.655, VY = SA.v ?? 0.665, TOPY = J["upperArm.L"][1], NECK = J.neck, ZS = NECK[2] - 0.012;   // ZS: front / back split (the shoulders' line)
  const a = W / Math.max(0.02, TOPY - VY), na = Math.hypot(1, a / slope(VY));
  const VI = VY + 0.012, ai = (SA.neck ?? 0.04) / Math.max(0.02, NECK[1] - VI), ni = Math.hypot(1, ai / slope(VI));
  const outerFront = (u, y) => Math.max((u - a * (y - VY)) / na, u - W);
  const innerV = (u, y) => (ai * (y - VI) - u) / ni;   // > 0 in the V's opening
  const edge = (x, y, z) => { const u = Math.abs(x); return z < ZS ? Math.max(u - W, (BACK - y) * slope(BACK)) : outerFront(u, y); };   // the outer edge (< 0 inside)
  const region = (x, y, z) => { const e = edge(x, y, z); return z < ZS ? e : smax(e, innerV(Math.abs(x), y), 0.004); };
  return { W, VY, NECK, ZS, edge, region, innerV };
}

definePart({ src: import.meta.url,
  name: "sailor", path: "outfit.shirt.sailor", group: "shirt", section: SEC, outline: 0.004, thin: "cloth",
  defaults: { on: false, color: "#26325f", line: "#ffffff", lineIn: 0.008, lineWidth: 0.006, width: 0.085, back: 0.655, v: 0.665, neck: 0.04 },
  schema: [
    ["on", L("セーラー襟", "Sailor collar"), { help: L("シャツの上に平たい襟(後ろは四角、前はV字)。着たときだけ作る", "a flat collar over the shirt (square at the back, a V in front); built only when worn") }],
    ["color", L("襟の色", "Collar color"), { when: { ".on": true } }],
    ["line", L("襟の線の色", "Collar line color"), { when: { ".on": true }, nullable: true, help: L("null = 線なし(ふちに沿った線の色)", "null = none (a line along the edge)") }],
    ["lineIn", L("線のふちからの距離", "Line's distance from the edge"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("m", "m") }],
    ["lineWidth", L("線の太さ", "Line width"), { when: { ".on": true }, min: 0.002, max: 0.02, step: 0.001, help: L("m", "m") }],
    ["width", L("襟の幅", "Collar width"), { when: { ".on": true }, min: 0.05, max: 0.13, step: 0.001, help: L("後ろと肩の上の幅(真ん中から m)", "its half width at the back and over the shoulders (m from the middle)") }],
    ["back", L("後ろの下端", "Back flap's bottom"), { when: { ".on": true }, min: 0.58, max: 0.72, step: 0.002, help: L("背中の四角の下の高さ(伸ばす前の体で。肩は 0.73)", "the back flap's bottom height, on the body before it is stretched (the shoulders at 0.73)") }],
    ["v", L("前のVの深さ", "V's point"), { when: { ".on": true }, min: 0.58, max: 0.72, step: 0.002, help: L("前でV字の先が来る高さ(伸ばす前の体で)", "the height of the V's point in front, on the body before it is stretched") }],
    ["neck", L("首元のVの幅", "V's width at the neck"), { when: { ".on": true }, min: 0, max: 0.08, step: 0.001, help: L("首のところでVがどれだけ開くか(m)。小さいほど襟が首を囲む", "how wide the V opens at the neck (m); less wraps the collar round the neck") }],
  ],
  // over the shirt without its armhole (it lies on over a bare shoulder), standing off further toward the shoulders' ends (a raised arm's
  // shoulder rose through it)
  build(ctx) { const S = shape(ctx), { shirtSdf, bodySdf } = ctx;
    return { S, sdf: (x, y, z, B = bodySdf) => Math.max(shirtSdf(x, y, z, B, true, true) - TH - 0.006 * sstep(S.W - 0.035, S.W, Math.abs(x)), S.region(x, y, z)) }; },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.24, 0.6, -0.16], hi: [0.24, 0.84, 0.2], h: Math.min(H, 0.008), only: /^(spine|chest|upperChest|neck|shoulder)/ }),
  // the line along the outer edge: how far in from it (m, as built), cut into a band lineIn from the edge, lineWidth wide
  bands: { keys: ["line", "lineIn", "lineWidth"], value: (st) => (x, y, z) => -st.S.edge(x, y, z), ranges: (O) => O.line ? [[O.lineIn ?? 0.008, (O.lineIn ?? 0.008) + (O.lineWidth ?? 0.006), O.line]] : [] },
});

definePart({ src: import.meta.url,
  name: "scarf", path: "outfit.shirt.scarf", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#1d1d26", length: 0.1, spread: 0.014, band: 0.013, width: 0.017 },
  schema: [
    ["on", L("スカーフ", "Scarf"), { help: L("襟のVに沿って、先で結んで垂らす。着たときだけ作る", "along the collar's V, knotted at its point, two tails hanging; built only when worn") }],
    ["color", L("スカーフの色", "Scarf color"), { when: { ".on": true } }],
    ["length", L("スカーフの長さ", "Scarf length"), { when: { ".on": true }, min: 0.03, max: 0.2, step: 0.005, help: L("結び目から垂れる長さ(伸ばす前の体で m)", "how far the tails hang below the knot (m, on the body before it is stretched)") }],
    ["spread", L("スカーフの先の開き", "Tails' spread"), { when: { ".on": true }, min: 0, max: 0.06, step: 0.001, help: L("2本の先が下でどれだけ離れるか(m)", "how far apart the two tails' ends are (m)") }],
    ["band", L("Vに見える幅", "Band showing in the V"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("襟のVのふちに見えるスカーフの幅(m)。0 = 襟の下に隠れる", "how much of the scarf shows along the V's edges (m); 0 = hidden under the collar") }],
    ["width", L("スカーフの先の太さ", "Tails' width"), { when: { ".on": true }, min: 0.008, max: 0.04, step: 0.001, help: L("先の半分の幅(m)。結び目も一緒に大きくなる", "half a tail's width at its end (m); the knot grows with it") }],
  ],
  build(ctx) {
    const { O: SC, shirtSdf, bodySdf } = ctx, S = shape(ctx), { innerV, VY, NECK, ZS } = S;
    // the shirt's front surface (z) by height: where the knot sits and the tails hang from
    const frontZ = (x, y) => { let lo = -0.05, hi = 0.3; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (shirtSdf(x, y, m, bodySdf, true) < 0) lo = m; else hi = m; } return lo; };
    const LEN = SC.length ?? 0.1, KY = VY - 0.004, kz = frontZ(0, KY) + TH + 0.006, WS = SC.band ?? 0.013, TW = (SC.width ?? 0.017) / 0.017;   // WS: how much of the band shows in the V; TW: the tails' and the knot's size
    // the band along the V's edges, a little under the lapels, standing off the shirt less than the collar does (so the collar lies over it)
    const band = (x, y, z, B) => { const g = innerV(Math.abs(x), y); return Math.max(shirtSdf(x, y, z, B, true) - TH * 0.7, -g - 0.003, g - WS, ZS + 0.02 - z, KY - 0.01 - y); };
    // two tails hanging from under the knot, flat, a little apart and slanting out, widening toward their ends; each hangs straight down
    // from the furthest forward the shirt reaches above it (it doesn't follow the chest's curve in)
    const NY = 40, Y0 = KY - 0.008, Y1 = KY - LEN, zAt = new Float32Array(NY + 1);
    { let m = kz - 0.004; for (let i = 0; i <= NY; i++) { const y = Y0 + (Y1 - Y0) * i / NY; m = Math.max(m, frontZ(0.015 + 0.01 * i / NY, y) + 0.008); zAt[i] = m; } }
    const SPR = SC.spread ?? 0.014, tail = (x, y, z) => { const t = Math.min(1, Math.max(0, (Y0 - y) / (Y0 - Y1))), cx = 0.006 * TW + SPR * t, hw = (0.011 + 0.006 * t) * TW, i = Math.min(NY - 1, Math.floor(t * NY)), f = t * NY - i, cz = zAt[i] * (1 - f) + zAt[i + 1] * f;
      const u = Math.abs(x), cut = (Y1 + 0.012 * Math.abs(u - cx) / hw) - y;   // the end cut in a shallow V (its middle longer)
      return smax(Math.max(Math.abs(u - cx) - hw, Math.abs(z - cz) - 0.004), Math.max(y - Y0, cut), 0.002); };
    const knot = (x, y, z) => { const q = [x / (0.019 * TW), (y - KY) / (0.016 * TW), (z - kz) / 0.012], k = Math.hypot(...q); return (k - 1) * 0.012; };
    return { sdf: (x, y, z, B = bodySdf) => smin(Math.min(band(x, y, z, B), tail(x, y, z)), knot(x, y, z), 0.006), lo: [-0.11, Y1 - 0.02, ZS], hi: [0.11, NECK[1] + 0.03, kz + 0.06] }; },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: st.lo, hi: st.hi, h: Math.min(H * 0.6, 0.0035), only: /^(chest|upperChest|neck)/ }),
});
