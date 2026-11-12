// A suit: the jacket, the shirt's collar points and a tie (for the town's crowd: salarymen, the station staff). Made as the sailor collar is
// (sailor.js): each a shape over the shirt or the body, cut to its region. Base space (before body.proportion stretches the body), heights
// from the joints (J), so they sit the same on the chibi and the adult bodies.
import { definePart } from "./registry.js";
import { smin, sstep, blendFast, dPrim, C, E } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k), SEC = L("スーツ", "Suit");
const TH = 0.004;   // how far the collar points and the tie stand off the shirt

// the shirt's front surface (z) at (x, y), or null where there is no shirt (above its neckline)
const frontOf = (shirtSdf, B) => (x, y) => { if (shirtSdf(x, y, 0.3, B, true) < 0) return 0.3; let lo = 0.29; while (lo > -0.04 && shirtSdf(x, y, lo, B, true) > 0) lo -= 0.01; if (lo <= -0.04) return null; let hi = lo + 0.01;   // (the front half only: the back of the neckline is higher)
  for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (shirtSdf(x, y, m, B, true) < 0) lo = m; else hi = m; } return lo; };
// the front neckline's height at |x| = u: scanned down from above the neck until the shirt is there. (Started 2 cm over the neck joint it
// started inside a dress shirt, whose neckline is 6 cm over it: the knot and the collar's points hung on the chest.)
const necklineAt = (front, u, y0) => { let y = y0 + 0.14; while (y > y0 - 0.1 && front(u, y) == null) y -= 0.002; return y; };

// the opening's V: from the neck (half width `neck` there) to the button (y = VY), |x| below this is open in front
function vShape(O, J, slope) {
  const yS = J["upperArm.L"][1], yH = J["upperLeg.L"][1], VY = yH + (O.v ?? 0.42) * (yS - yH), NY = J.neck[1] - 0.01, NW = O.neck ?? 0.036;
  const a = NW / Math.max(0.03, NY - VY), n = Math.hypot(1, a / slope(VY));
  return { VY, NY, NW, a, open: (u, y) => (a * (y - VY) - u) / n };   // > 0 inside the opening
}

// the jacket's shapes, shared by its parts (the jacket, its trim, its buttons): made once per body (P) and options
const SHAPES = new WeakMap(), ARM_IN = 0.007;
const BOX = [[-0.75, 0.2, -0.3], [0.75, 0.95, 0.45]];
function jacketShape({ O, P, J, slope }) {
  const hit = SHAPES.get(P); if (hit && hit.O === O) return hit.S;
  const pick = (...n) => n.flatMap((k) => [P[k]?.cloth ?? P[k] ?? null, P[`${k}.L`] ?? null, P[`${k}.R`] ?? null]).filter(Boolean);
  const core = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "butt", "neck", "trap", "shoulder", "sleeve", "upperArm", "foreArm", "foreBulge"), ...BOX);
  const ARM = blendFast(pick("sleeve", "upperArm", "foreArm", "foreBulge"), ...BOX), TORSO = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "butt"), [-0.4, 0.2, -0.3], [0.4, 0.95, 0.45]);
  const LEGS = blendFast(pick("thigh", "thighF", "thighB", "thighOut", "thighIn", "leghole"), [-0.4, 0.1, -0.3], [0.4, 0.7, 0.45]);
  const V = vShape(O, J, slope), yH = J["upperLeg.L"][1], HEM = yH - (O.hem ?? 0.075), CW = O.cutaway ?? 0.6, OFF = O.offset ?? 0.024, PAD = O.pad ?? 0.6, FLARE = O.flare ?? 0.08;
  const ZS = J.neck[2] - 0.01, YC = yH + 0.03, YW = yH + 0.45 * (J["upperArm.L"][1] - yH);   // YC: from here down the skirt hangs straight (the hips' section carried down), not in under the pelvis
  // each side: the wrist's plane, a pad that carries the shoulder line out level to the arm (the body's own slopes away from the neck: a
  // sweatshirt's shoulders), and the forearm's sleeve as a tube that hardly narrows to the cuff. The arms are the body's parts (J's are the chibi's)
  const side = (s) => { const m = s === "L" ? 1 : -1, ua = P[`upperArm.${s}`], f = P[`foreArm.${s}`], n = Math.hypot(f.bx, f.by, f.bz), sx = Math.abs(ua.ax), sy = slope(ua.ay);
    const topAt = (u) => { let y = 0.95; while (y > ua.ay && core(m * u, y, ua.az) - OFF > 0) y -= 0.002; return y; }, r = 0.016;
    const y0 = topAt(sx * 0.45), y1 = topAt(sx + 0.012), yE = y1 + (y0 - 0.03 / sy - y1) * PAD;
    const pad = PAD > 0 && yE > y1 ? C([m * sx * 0.45, y0 - r, ua.az], [m * (sx + 0.004), yE - r, ua.az], r, r, null, 0.02) : null;
    const el = [f.ax, f.ay, f.az], wr = [f.ax + f.bx, f.ay + f.by, f.az + f.bz], re = f.ra + OFF - ARM_IN;
    return { h: wr, g: [f.bx / n, f.by / n, f.bz / n], pad, tube: C(el, wr, re, Math.max(f.rb + OFF - ARM_IN + 0.003, re * 0.8), null, 0.02) }; };
  const SL = side("L"), SR = side("R");
  // the jacket whole: before the opening, the cuffs, the hem and the neck are cut
  const solid = (x, y, z) => { const A = x > 0 ? SL : SR; let d = core(x, y, z) - OFF + ARM_IN * sstep(0, 0.03, TORSO(x, y, z) - ARM(x, y, z));   // (the sleeves closer to the arms than the body to the torso: at the same 2.4 cm the arms looked heavy)
    if (A.pad) d = smin(d, dPrim(A.pad, x, y, z), 0.025);
    d = smin(d, dPrim(A.tube, x, y, z), 0.012);
    if (y < YC) d += (Math.min(d, smin(TORSO(x, YC, z) - OFF - FLARE * (YC - y), LEGS(x, y, z) - OFF - 0.004, 0.06)) - d) * sstep(YC, YC - 0.04, y);   // (over the thighs' tops too: wider than the pelvis on a man, they came out through the skirt's sides)
    // a slit between the sleeve and the torso from the waist down: built with the wrists by the hips, the sleeve and the skirt met in one
    // surface and it stretched into a web when the arm rose
    if (y < YW) { const tb = y < YC ? Math.min(TORSO(x, YC, z), LEGS(x, y, z)) : TORSO(x, y, z); d = Math.max(d, 0.008 * sstep(YW, YW - 0.03, y) - Math.abs(tb - ARM(x, y, z)) / 2); }
    return d; };
  const top = (x, z) => { const nz = z - J.neck[2]; return V.NY - 0.018 + 12 * (x * x + nz * nz) - 0.3 * (nz + 0.05) - 0.1 * Math.max(0, z - ZS); };   // a bowl round the neck (a level cut took the shoulders' tops off: the shirt showed there), highest at the back: level, the collar rose in points beside the neck
  const sdf = (x, y, z) => {
    const u = Math.abs(x), A = x > 0 ? SL : SR, cuff = (x - A.h[0]) * A.g[0] + (y - A.h[1]) * A.g[1] + (z - A.h[2]) * A.g[2] + 0.02;
    const op = z > ZS ? (y > V.VY ? V.open(u, y) : (CW ? (CW * (HEM + 0.07 - y) - u) / Math.hypot(1, CW) : -1)) : -1;   // the opening (front only)
    let d = smax(solid(x, y, z), op, 0.004);
    if (Math.hypot(x - A.h[0], y - A.h[1], z - A.h[2]) < 0.1) d = smax(d, cuff, 0.006);   // (only near the wrist: the plane went on through the skirt beside the hand)
    const hem = y < HEM + 0.02 && ARM(x, y, z) < TORSO(x, Math.max(y, YC), z) ? -1 : HEM - y;   // the hem across the torso only: the adult's long arms hang below it
    return Math.max(d, hem, y - top(x, z)); };
  // the skirt follows the hips alone: built with the wrists beside it (the A-pose), its sides took the forearms' weights and rose with the arms as fins
  const bones = (x, y, z) => y < YC && ARM(x, y, z) > Math.min(TORSO(x, YC, z), LEGS(x, y, z)) ? SKIRT_BONES : JBONES;
  // the fronts' overlap: the upper front's edge runs on from its lapel's fold across the middle and down to the hem, 1.8 cm past the
  // buttons. > 0 on the upper front; the line is painted where it is just over 0. Linear in x, so it stays straight on a thinned mesh's big
  // triangles; at the sides and the back it jumps far from 0 in one cell (a line too thin to see).
  const LM = O.overlap === "right" ? -1 : 1, lap = (x, y, z) => z > ZS ? LM * x + Math.min(0.018, 2.5 * V.a * (V.VY - y)) : Math.abs(x) + 0.05;
  // the base height `m` metres (after the stretch) below y: an adult's torso is stretched in a narrow band at the waist (4.7x there, 1x
  // above), so buttons and pockets set by base heights came out far apart and tall
  const down = (y, m) => { for (let left = m; left > 0 && y > 0.2; y -= 0.0005) left -= 0.0005 * slope(y); return y; };
  const S = { sdf, solid, top, bones, lap, down, V, HEM, ZS, yH, yS: J["upperArm.L"][1] };
  SHAPES.set(P, { O, S }); return S;
}
// a polygon's signed distance in (u, y) (inside < 0)
const poly = (pts) => (u, y) => { let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((u - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(u - ax - t * ex, y - ay - t * ey)); if ((ay > y) !== (by > y) && u < ax + (y - ay) / (by - ay) * ex) inside = !inside; }
  return inside ? -d : d; };
const shade = (hex, k) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
const bellyOf = (OPT) => { const W = OPT.body.adult?.on ? OPT.body.adult.waist ?? {} : null; return W ? Math.max(0, (W.z ?? 0.03) + (W.d ?? 0.056) + 0.07 - 0.22) : 0; };
const JBONES = /^(hips|spine|chest|upperChest|shoulder|neck|upperArm|lowerArm)/, SKIRT_BONES = /^(hips|spine)/, TRIM_BONES = /^(hips|spine|chest|upperChest|shoulder|neck)/;

definePart({ src: import.meta.url,
  name: "jacket", path: "outfit.jacket", section: SEC, outline: 0.004,   // (thinned as the body: a solid, not a sheet with an inner side)
  defaults: { on: false, color: "#2f3442", v: 0.42, neck: 0.036, lapel: 0.036, hem: 0.075, cutaway: 0.6, offset: 0.024, pad: 0.6, flare: 0.08, collar: 0.032, overlap: "left", line: true, pockets: true, buttons: 2, buttonColor: "#15171d" },
  schema: [
    ["on", L("上着(スーツ)", "Jacket (suit)"), { help: L("シャツの上に長袖の上着。前はV字に開いて下は閉じる。シャツは長袖・すそ入れが合う。着たときだけ作る", "a long-sleeved jacket over the shirt, open in a V in front and buttoned below. Goes with a long-sleeved, tucked shirt; built only when worn") }],
    ["color", L("上着の色", "Jacket color"), { when: { ".on": true } }],
    ["v", L("前のVの深さ", "V's point"), { when: { ".on": true }, min: 0.2, max: 0.8, step: 0.01, help: L("ボタンの高さ。脚の付け根(0)から肩(1)までの割合", "the button's height, from the hip joint (0) to the shoulder (1)") }],
    ["neck", L("首元のVの幅", "V's width at the neck"), { when: { ".on": true }, min: 0.02, max: 0.1, step: 0.001, help: L("m", "m") }],
    ["lapel", L("襟(ラペル)の幅", "Lapel width"), { when: { ".on": true }, min: 0, max: 0.06, step: 0.001, help: L("Vのふちから折り返した襟のいちばん広い所(m)。0 = 襟なし", "the turned-back collar at its widest, from the V's edge (m); 0 = none") }],
    ["hem", L("すその高さ", "Hem"), { when: { ".on": true }, min: -0.04, max: 0.14, step: 0.002, help: L("脚の付け根からどれだけ下か(伸ばす前の体で m)", "how far below the hip joint (m, on the body before it is stretched)") }],
    ["flare", L("すその広がり", "Skirt flare"), { when: { ".on": true }, min: 0, max: 0.4, step: 0.01, help: L("腰から下がどれだけ外へ広がるか(傾き)", "how far it stands out below the hips (a slope)") }],
    ["cutaway", L("すその前の開き", "Front cutaway"), { when: { ".on": true }, min: 0, max: 1.5, step: 0.05, help: L("ボタンの下で前がすそへ向かって開く傾き。0 = まっすぐ閉じる", "how the fronts part below the button toward the hem; 0 = closed straight down") }],
    ["pad", L("肩パッド", "Shoulder pads"), { when: { ".on": true }, min: 0, max: 1.4, step: 0.05, help: L("肩の線を首から腕まで水平に近づける。0 = 体のなで肩のまま", "carries the shoulder line out level from the neck to the arm; 0 = the body's own slope") }],
    ["offset", L("上着の厚み", "Jacket thickness"), { when: { ".on": true }, min: 0.016, max: 0.04, step: 0.001, help: L("体からの浮き(m)。シャツ(1.4cm)とズボンより外に", "how far it stands off the body (m); outside the shirt (1.4 cm) and the pants") }],
    ["overlap", L("合わせ", "Fronts overlap"), { when: { ".on": true }, options: [{ value: "left", label: L("左前(男)", "Left over right (men's)") }, { value: "right", label: L("右前(女)", "Right over left (women's)") }], help: L("どちらの前身頃が上か(着ている人から見て)", "which front lies on top (the wearer's side)") }],
    ["collar", L("上襟の幅", "Collar width"), { when: { ".on": true }, min: 0.015, max: 0.05, step: 0.001, help: L("首のまわりの襟の幅(m)", "the collar round the neck (m)") }],
    ["line", L("縁の線", "Edge lines"), { when: { ".on": true }, type: "boolean", cost: "instant", apply: "setBands", help: L("襟・ポケット・前の合わせの縁に濃い線", "a darker line along the lapels', collar's and flaps' edges and the fronts' overlap") }],
    ["pockets", L("ポケットのふた", "Pocket flaps"), { when: { ".on": true }, type: "boolean" }],
    ["buttons", L("ボタンの数", "Buttons"), { when: { ".on": true }, min: 0, max: 3, step: 1 }],
    ["buttonColor", L("ボタンの色", "Button color"), { when: { ".on": true }, cost: "instant", apply: "setColors", colorKey: "jacketButtons" }],
  ],
  // the torso and the arms (not the hands or the legs), pushed out by offset, squared at the shoulders, hanging straight from the hips to the
  // hem; the neck cut as a bowl, the sleeves 2 cm short of the wrists (the shirt's cuff shows), the V open in front
  build(ctx) { const S = jacketShape(ctx); return { sdf: S.sdf, HEM: S.HEM, bones: S.bones, lap: S.lap }; },
  bands: { keys: ["line"], value: (st) => st.lap, ranges: (O) => O.line === false ? [] : [[0, 0.004, shade(O.color ?? "#2f3442", 0.5)]] },
  spec: (st, { H, ax, ay, OPT }) => ({ sdf: st.sdf, lo: [-0.42 - ax, Math.min(st.HEM, 0.35 - ay) - 0.02, -0.22], hi: [0.42 + ax, 0.9, 0.3 + bellyOf(OPT)], h: H * (OPT.quality.shirtCell ?? 0.75) * 1.2, only: st.bones }),
});

// the jacket's trim, a mesh of its own 5 mm proud of it (its outline draws the edges: raised on the jacket itself they did not show): the
// lapels along the V with a notch, the collar above them and round the back of the neck
definePart({ src: import.meta.url,
  name: "jacketTrim", path: "outfit.jacket", group: "jacket", colorOf: "jacket", section: SEC, outline: 0.003, thin: "keep",   // (thinned, the lapels' edges came out ragged)
  built: (O) => !!O?.on && (O.lapel ?? 0.036) > 0,
  build(ctx) {
    const { O, slope } = ctx, S = jacketShape(ctx), { V, ZS } = S, LW = O.lapel ?? 0.036, VH = V.NY - V.VY, uV = (y) => V.NW * (y - V.VY) / VH, sy = slope(V.VY);
    const yG = V.VY + 0.66 * VH, g = 0.02 / sy, IN = 0.005;   // the gorge (where the collar meets the lapel); IN: over the opening's edge
    const lapel = LW ? poly([[-IN, V.VY - 0.03 / sy], [uV(yG) + LW, yG - 0.012 / sy], [uV(yG) + LW * 0.45, yG + g], [uV(yG + g) - IN, yG + g]]) : null;
    // the upper collar: a band along the neck's edge (the V above the gorge, then the bowl's rim over the shoulders and round the back), in
    // one piece; `inFrom` is how far in from that edge (m after the stretch). (Standing 12 mm above the rim it rose in points at the shoulders.)
    const CWD = O.collar ?? 0.032, inFrom = (x, y, z) => { const t = (S.top(x, z) - y) * sy; return z > ZS && y > V.VY ? Math.min(-V.open(Math.abs(x), y), t) : t; };
    const collar = LW ? (x, y, z, front) => front && y < yG + g * 0.6 ? 1 : (() => { const e = inFrom(x, y, z); return Math.max(e - CWD, -e - IN); })() : null;
    // the shapes' edge at a point (inside < 0): the mesh is cut by it, and the line along the edges is painted by it
    const edge = (x, y, z) => { const u = Math.abs(x), front = z > ZS + 0.015;
      return Math.min(front && lapel ? lapel(u, y) : 1, collar ? collar(x, y, z, front) : 1); };
    const sdf = (x, y, z) => { const dj = S.solid(x, y, z); if (dj > 0.02) return dj;
      return Math.max(dj - 0.003 - 0.005 * sstep(0, 0.02, inFrom(x, y, z)), -dj - 0.014, edge(x, y, z)); };   // (thinner toward the neck's edge: 8 mm proud there, the collar stood in points beside the neck)   // (buried 14 mm: a plate thinner than two cells came out with its edges worn away; the buried part is not drawn)
    return { sdf, edge, lo: [-0.2, V.VY - 0.06, -0.26], hi: [0.2, V.NY + 0.1, 0.3] };
  },
  // a darker line along the edges: the trim is the jacket's color on the jacket, and the outline draws only the silhouette
  bands: { keys: ["line"], value: (st) => st.edge, ranges: (O) => O.line === false ? [] : [[-0.0035, 0.05, shade(O.color ?? "#2f3442", 0.5)]] },
  spec: (st, { H, OPT }) => ({ sdf: st.sdf, lo: st.lo, hi: [st.hi[0], st.hi[1], st.hi[2] + bellyOf(OPT)], h: 0.0065, only: TRIM_BONES }),
});

// the pockets' flaps (9 by 4.5 cm after the stretch, at the lower button's height): a part of their own with fine cells. They lie in the
// waist's band, stretched 4.7x: at the trim's cells a flap was a cell and a half tall and came out ragged and all line.
definePart({ src: import.meta.url,
  name: "jacketPockets", path: "outfit.jacket", group: "jacket", colorOf: "jacket", section: SEC, outline: 0.003, thin: "keep",
  built: (O) => !!O?.on && O.pockets !== false,
  build(ctx) {
    const { slope } = ctx, S = jacketShape(ctx), yT = S.down(S.V.VY, 0.13), yB = S.down(yT, 0.045), mid = (yT + yB) / 2, half = (yT - yB) / 2;
    const edge = (x, y, z) => z > S.ZS + 0.015 ? Math.max(Math.abs(Math.abs(x) - 0.08) - 0.045, (Math.abs(y - mid) - half) * slope(y)) : 1;   // (m after the stretch)
    // sewn in along the top: there the flap comes out of the jacket with no step, and the line runs along the sides and the bottom only
    const line = (x, y, z) => z > S.ZS + 0.015 ? Math.max(Math.abs(Math.abs(x) - 0.08) - 0.045, (yB - y) * slope(y)) : 1;
    return { edge: line, sdf: (x, y, z) => { const dj = S.solid(x, y, z); return dj > 0.02 ? dj : Math.max(dj - 0.001 - 0.005 * sstep(yT, mid, y), -dj - 0.008, edge(x, y, z)); }, lo: [-0.14, yB - 0.01, -0.05], hi: [0.14, yT + 0.01, 0.3] };
  },
  spec: (st, { OPT }) => ({ sdf: st.sdf, lo: st.lo, hi: [st.hi[0], st.hi[1], st.hi[2] + bellyOf(OPT)], h: 0.0045, only: SKIRT_BONES }),
  bands: { keys: ["line"], value: (st) => st.edge, ranges: (O) => O.line === false ? [] : [[-0.004, 0.05, shade(O.color ?? "#2f3442", 0.5)]] },
});

definePart({ src: import.meta.url,
  name: "jacketButtons", path: "outfit.jacket", group: "jacket", colorIn: "buttonColor", section: SEC, outline: 0.002, thin: "keep",
  built: (O) => !!O?.on && (O.buttons ?? 2) > 0,
  // discs on the jacket's front from just under the V's point down (round after the body's stretch: flattened by the slope here)
  build(ctx) {
    const { O, slope } = ctx, S = jacketShape(ctx), N = O.buttons ?? 2, B = [];
    for (let i = 0; i < N; i++) { const y = S.down(S.V.VY, 0.02 + i * 0.1), sy = slope(y); if (y < S.HEM + 0.075) break; let lo = 0, hi = 0.5; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (S.solid(0, y, m) < 0) lo = m; else hi = m; }
      B.push(E([0, y, lo + 0.002], [0.0085, 0.0085 / sy, 0.0045], null, 0.01)); }
    if (!B.length) return null;
    return { sdf: (x, y, z) => { let d = 1; for (const q of B) d = Math.min(d, dPrim(q, x, y, z)); return d; }, lo: [-0.02, B.at(-1).cy - 0.02, B[0].cz - 0.05], hi: [0.02, B[0].cy + 0.02, Math.max(...B.map((q) => q.cz)) + 0.02] };
  },
  spec: (st) => ({ sdf: st.sdf, lo: st.lo, hi: st.hi, h: 0.002, only: /^(hips|spine|chest)/ }),
});

definePart({ src: import.meta.url,
  name: "shirtCollar", path: "outfit.shirt.shirtCollar", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#ffffff", length: 0.05, spread: 0.05, stand: 0, leaf: 0.03 },
  schema: [
    ["on", L("ワイシャツの襟", "Shirt collar points"), { help: L("首元に左右2枚のとがった襟。上着やネクタイと合わせる。着たときだけ作る", "two pointed collar flaps at the neck; with a jacket or a tie. Built only when worn") }],
    ["color", L("襟の色", "Collar color"), { when: { ".on": true }, help: L("ふつうはシャツと同じ色", "usually the shirt's color") }],
    ["length", L("襟の長さ", "Collar length"), { when: { ".on": true }, min: 0.02, max: 0.07, step: 0.001, help: L("首元から先まで(m)", "from the neck to the point (m)") }],
    ["spread", L("襟の開き", "Collar spread"), { when: { ".on": true }, min: 0.02, max: 0.08, step: 0.001, help: L("先の真ん中からの距離(m)", "the points' distance from the middle (m)") }],
  ],
  // each flap a triangle on the shirt's front (|x|, y): the neck's edge from the middle out, the point below and out; it stands off the
  // shirt and folds round the neck behind (a band up to the neckline all round)
  build(ctx) {
    const { O, P, shirtSdf, bodySdf, J } = ctx, front = frontOf(shirtSdf, bodySdf), yN = necklineAt(front, 0.012, J.neck[1]), LEN = O.length ?? 0.05, SP = O.spread ?? 0.05, ST = O.stand ?? 0, LEAF = O.leaf ?? 0.03;
    const NK = P.neck?.cloth ?? P.neck, neck = (x, y, z) => dPrim(NK, x, y, z);   // the neck alone (the body's distance takes the jaw in: the collar came out as a shelf under the chin)
    const P0 = [0.012, yN + 0.002], P1 = [0.052, yN + 0.008], P2 = [SP, yN - LEN];   // inner top, outer top, point
    const seg = (p, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] ** 2 + d[1] ** 2))); return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]); };
    const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const tri = (u, y) => { const p = [u, y], dd = Math.min(seg(p, P0, P1), seg(p, P1, P2), seg(p, P2, P0)), s = side(p, P0, P1), t = side(p, P1, P2), w = side(p, P2, P0);
      return (s >= 0) === (t >= 0) && (t >= 0) === (w >= 0) ? -dd : dd; };
    const ZS = J.neck[2] - 0.01, edge = (x, y, z) => Math.min(z > ZS + 0.02 ? tri(Math.abs(x), y) : 1, Math.max(neck(x, y, z) - LEAF, yN - 0.01 - y, z > ZS ? 0.013 - Math.abs(x) : -1));   // (the ring no lower than the front neckline: the neck's root is deep in the back, and it hung down it; open in front for the knot)
    // the leaf: folded down and lying on the shirt round the neck's root (within LEAF of the neck), with the two points in front. (An adult's
    // neck shows 2–3 cm: a stand up the neck, as on a real shirt, reached the chin.)
    const flaps = (x, y, z, B) => Math.max(shirtSdf(x, y, z, B, true, true) - TH - 0.002, edge(x, y, z));
    // a low stand closing the gap between the neck and the neckline: a shell 4–10 mm off the neck, ST over the shirt
    const neckBand = (x, y, z, B) => Math.max(Math.abs(neck(x, y, z) - 0.007) - 0.003, -shirtSdf(x, y, z, B, true, true) - 0.006, shirtSdf(x, y, z, B, true, true) - ST - 0.014);
    return { edge, sdf: (x, y, z, B = bodySdf) => ST > 0 ? Math.min(flaps(x, y, z, B), neckBand(x, y, z, B)) : flaps(x, y, z, B), lo: [-0.12, yN - LEN - 0.02, -0.14], hi: [0.12, yN + 0.09, 0.2] };
  },
  spec: (st, { B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: st.lo, hi: st.hi, h: 0.005, only: /^(chest|upperChest|neck)/ }),
  // a grey line along the points' edges: white on the white shirt, they did not show
  bands: { keys: [], value: (st) => st.edge, ranges: (O) => [[-0.003, 0.004, shade(O.color ?? "#ffffff", 0.72)]] },
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
    const { O, shirtSdf, bodySdf, J } = ctx, front = frontOf(shirtSdf, bodySdf), yN = necklineAt(front, 0, J.neck[1]);
    const yS = J["upperArm.L"][1], yH = J["upperLeg.L"][1], KY = yN - 0.012, Y1 = Math.max(yH, yN - (O.length ?? 0.3) * (yS - yH)), W = O.width ?? 0.022;
    const NY = 40, zAt = new Float32Array(NY + 1);
    { let m = -1; for (let i = 0; i <= NY; i++) { const y = KY + (Y1 - KY) * i / NY, f = front(0, y); m = Math.max(m, (f ?? 0.05) + TH + 0.004); zAt[i] = m; } }
    const kz = zAt[0];
    const blade = (x, y, z) => { const t = Math.min(1, Math.max(0, (KY - y) / (KY - Y1))), hw = W * (0.55 + 0.45 * t), i = Math.min(NY - 1, Math.floor(t * NY)), f = t * NY - i, cz = zAt[i] * (1 - f) + zAt[i + 1] * f;
      const tip = (Y1 + 1.0 * Math.abs(x)) - y;   // the end cut to a point
      return smax(Math.max(Math.abs(x) - hw, Math.abs(z - cz) - 0.004), Math.max(y - KY, tip), 0.002); };
    const knot = (x, y, z) => { const q = [x / 0.016, (y - KY) / 0.014, (z - kz - 0.003) / 0.011]; return (Math.hypot(...q) - 1) * 0.01; };
    return { sdf: (x, y, z) => smin(blade(x, y, z), knot(x, y, z), 0.004), lo: [-0.06, Y1 - 0.02, kz - 0.06], hi: [0.06, KY + 0.03, Math.max(...zAt) + 0.03] };
  },
  spec: (st) => ({ sdf: st.sdf, lo: st.lo, hi: st.hi, h: 0.005, only: /^(spine|chest|upperChest|neck)/ }),
});
