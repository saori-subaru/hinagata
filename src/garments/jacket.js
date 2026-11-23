// An open jacket (outfit.jacket; for スバル's rider's jacket): worn over the shirt, its front open, a notched collar and lapels folded back,
// long sleeves with cuffs, a band along its hem, and it can have slipped off one shoulder (slip). Sheets (sdf/sheet.js): its edges are cut
// exactly along the pattern's lines, hollow at the cuffs and the hem. The metal on it (zips, snaps) is the part "jacketMetal": ribbons and
// discs made directly on its surface (a zip a few mm wide is finer than the cells).
// Base space, as the clothes are; built in the body's A-pose (the arms 49° down): the pattern is drawn on the body seen from the front.
import { definePart } from "./registry.js";
import { sheetsMesh } from "../sdf/sheet.js";
import { blendFast, smin, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("ジャケット", "Jacket");
const TK = 0.008, SHIRT = 0.014;   // the cloth's thickness; how far the shirt stands off the body (clothes/index.js)
const L1 = 0.006, L2 = 0.011;      // how far the lapels and the collar stand off the jacket's outer side (the collar lies over the lapels)
const OV = 0.003;                  // the folded parts reach this far past the jacket's own edge (their rim hides its rim)
const clamp01 = (t) => Math.min(1, Math.max(0, t));
// the distance to a polygon's edge in the plane (< 0 inside)
function polygon(V) { const n = V.length;
  return (x, y) => { let d = 1e9, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) { const [ax, ay] = V[j], [bx, by] = V[i], ex = bx - ax, ey = by - ay, t = clamp01(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey));
      d = Math.min(d, Math.hypot(x - ax - ex * t, y - ay - ey * t)); if ((ay > y) !== (by > y) && x < ax + (y - ay) / (by - ay) * ex) inside = !inside; }
    return inside ? -d : d; }; }

/** The jacket's shapes: its outer side, where it is cut, and its pattern (the collar, the lapels, the metal) by side. */
function shape({ O, P, J }) {
  const pick = (...names) => names.flatMap((n) => [P[n]?.cloth ?? P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);
  const LO = [-0.6, 0.3, -0.3], HI = [0.6, 1.0, 0.3];
  const all = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "neck", "trap", "shoulder"), LO, HI);   // (the arms: the sleeves' tubes)
  const torso = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist"), LO, HI);
  const D = SHIRT + (O.out ?? 0.004) + TK;   // its outer side off the body: over the shirt
  const HEM = O.hem ?? 0.505, YB = J.chest[1] + 0.02, FLARE = O.flare ?? 0.014, RS = O.sleeve ?? 0.05;
  const arms = ["L", "R"].map((s) => { const a = P[`upperArm.${s}`], f = P[`foreArm.${s}`], La = Math.hypot(a.bx, a.by, a.bz), Lf = Math.hypot(f.bx, f.by, f.bz);
    return { s, side: Math.sign(a.ax), A: [a.ax, a.ay, a.az], u: [a.bx / La, a.by / La, a.bz / La], La, F: [f.ax, f.ay, f.az], g: [f.bx / Lf, f.by / Lf, f.bz / Lf], Lf }; });
  const armOf = (x) => arms[x > 0 === arms[0].side > 0 ? 0 : 1];
  const HEM_X = 0.2;   // the hem cuts the torso alone, not a sleeve hanging beside it
  const END = 0.006;   // the sleeve's end past the forearm's (over the wrist)
  // a sleeve: a tube as wide all the way from the shoulder to the wrist (the arm's own taper under it)
  const seg = (p, a, d, t0, t1) => { const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2], t = Math.min(t1, Math.max(t0, px * d[0] + py * d[1] + pz * d[2])); return Math.hypot(px - d[0] * t, py - d[1] * t, pz - d[2] * t); };
  const tube = (x, y, z, A) => { const p = [x, y, z]; return smin(seg(p, A.A, A.u, 0.01, A.La), seg(p, A.F, A.g, 0, A.Lf + END + 0.03), 0.02) - RS; };
  const along = (x, y, z, A) => (x - A.F[0]) * A.g[0] + (y - A.F[1]) * A.g[1] + (z - A.F[2]) * A.g[2];   // how far down the forearm
  // its outer side: the body pushed out, hanging straight from the chest down and wider toward the hem (over a belt), and the sleeves' tubes
  const outer = (x, y, z) => { const fl = FLARE * sstep(YB, HEM, y);
    return smin(smin(all(x, y, z) - D - fl, torso(x, Math.max(y, YB), z) - D - fl, 0.02), tube(x, y, z, armOf(x)), 0.014); };

  // ── the pattern, by side (u = |x|) ──
  const SLIP = O.slip === "L" ? 1 : O.slip === "R" ? -1 : 0, DROP = SLIP ? O.slipDrop ?? 0.065 : 0, DX = SLIP ? O.slipOpen ?? 0.04 : 0;
  const slipped = (x) => SLIP !== 0 && x * SLIP > 0;
  const NY = O.neck ?? 0.768, NB = 4, ZC = J.neck[2] - 0.005, U0 = 0.035, UJ = Math.abs(arms[0].A[0]);
  // the neckline: the jacket is cut above this height. A bowl round the neck; on the slipped side it falls to DROP under it at the
  // shoulder joint and rises again along the arm (across the arm: the collar lies round the upper arm, the shoulder bare)
  const top = (x, z) => { const u = Math.abs(x), zz = z - ZC;
    if (!slipped(x)) return NY + NB * (u * u + zz * zz);
    const uu = Math.min(u, U0); return NY + NB * (uu * uu + 0.5 * zz * zz) - DROP * sstep(U0, UJ, u) + 0.3 * Math.max(0, u - UJ); };
  // the front edge: the opening's half width, from the neck down to the hem (the slipped side hangs open wider)
  const YT = 0.765, E_T = O.openTop ?? 0.05, E_H = O.open ?? 0.07;
  const E = (v) => E_T + (E_H - E_T) * clamp01((YT - v) / (YT - HEM));
  // where the cloth is (< 0): above the hem, short of the wrists, under the neckline, outside the opening in front.
  // dHem, dEdge, dTop: the same cut reaching that much further (a band's rim over the jacket's own edge)
  const cutOf = (dHem = 0, dEdge = 0, dTop = 0) => (x, y, z) => { const u = Math.abs(x);
    return Math.max(HEM - dHem - y - 3 * Math.max(0, u - HEM_X), along(x, y, z, armOf(x)) - (arms[0].Lf + END), y - top(x, z) - dTop, Math.min(E(y) + (slipped(x) ? DX : 0) - dEdge - u, z)); };
  // the pattern's own coordinates (u, v): the body's |x| and height on the side that sits right; on the slipped side the collar and the
  // lapel's top are DROP lower and DX further out (the lapel's lower end and the hem only further out)
  const YG0 = 0.58, YG1 = 0.68, drop = (y) => DROP * sstep(YG0, YG1, y);
  const toUV = (x, y) => slipped(x) ? [Math.abs(x) - DX, y + drop(y)] : [Math.abs(x), y];
  const fromUV = (u, v, sgn) => { if (!(SLIP && sgn === SLIP)) return [sgn * u, v]; let lo = v - DROP, hi = v; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (m + drop(m) < v) lo = m; else hi = m; } return [sgn * (u + DX), (lo + hi) / 2]; };
  const LW = O.lapel ?? 0.06, YL = O.lapelEnd ?? 0.61, CW = O.collar ?? 0.062, FW = 0.014, ZS = -0.02, BACK = 0.034;
  const BK = [E(YL) + FW, YL], HK = [E(HEM) + FW, HEM - 0.004], NT = [0.088, 0.728], WT = [0.086 + CW, 0.742];
  // the lapel: from the roll line (the front edge) out to its point, narrowing to a facing strip down to the hem. The slipped side's is
  // narrower: it lies over the crease between the arm and the chest, and as wide as the other it folded there in a dark wedge
  const tipOf = (sgn) => [E(0.7) + LW * (SLIP && sgn === SLIP ? 0.72 : 1), 0.7];
  const lapelOf = (sgn) => polygon([[E(0.757) - OV, 0.757], NT, tipOf(sgn), BK, HK, [E(HEM) - OV, HEM - 0.004]]), lapelN = lapelOf(-SLIP || 1), lapelS = SLIP ? lapelOf(SLIP) : lapelN;
  // the collar's wing in front: its lower edge from the notch out to its point on the shoulder, its upper edge back from the point to the
  // neckline (cut square at the point's end, it stood off a slipped arm as a tab)
  const wingP = polygon([[E(0.745) - OV, 0.745], [0.086, 0.722], WT, [0.1, 0.8], [0.1, 0.83], [E_T - OV, 0.83]]);
  const lapel = LW > 0 ? (x, y, z) => { const [u, v] = toUV(x, y); return Math.max((slipped(x) ? lapelS : lapelN)(u, v), -z); } : null;
  // the collar: the wing in front and, behind the shoulders' line, a band under the neckline. On the slipped side the band narrows to
  // nothing toward the wing's point (as wide all the way, its end stood off the back of the arm as a square tab)
  // The slipped side's collar is folded along the whole fallen neckline, round the arm too (bandS: as wide as CS from the shoulder joint on),
  // with a longer wing (WTS), and stands off the sleeve toward its free edge (liftS: a wedge, its inner side where it was). A wing alone,
  // flat on the sleeve, read as a short collar of the sleeve's own
  const CS = CW * (O.slipCollar ?? 0.75), LIFT = O.slipLift ?? 0.01, WTS = [0.086 + CW * 1.3, 0.732];
  const wingS = polygon([[E(0.745) - OV, 0.745], [0.086, 0.722], WTS, [0.1, 0.8], [0.1, 0.83], [E_T - OV, 0.83]]);
  const bandS = (x) => BACK + (CS - BACK) * sstep(U0, UJ, Math.abs(x));
  const liftS = (x, y, z) => slipped(x) ? LIFT * sstep(U0, UJ, Math.abs(x)) * sstep(0.005, 0.05, top(x, z) - y) : 0;
  const collar = CW > 0 ? (x, y, z) => { const [u, v] = toUV(x, y), t = top(x, z);
    if (slipped(x)) return Math.max(Math.min(Math.max(wingS(u, v), ZS - z), Math.max(t - y - bandS(x), Math.min(E(y) + DX - OV - Math.abs(x), z))), y - t - OV);   // (the band on the cloth only: not across the opening)
    return Math.max(Math.min(Math.max(wingP(u, v), ZS - z), Math.max(t - y - BACK, z - ZS)), y - t - OV); } : null;
  // a point of the pattern on the jacket's front, `lift` off its outer side: [x, y, z, nx, ny, nz] or null (no cloth in front there)
  // (body: u, v are the body's own |x| and height, not moved with a slipped side)
  const onFront = (u, v, sgn, lift, body = false) => { const [x, y] = body ? [sgn * u, v] : fromUV(u, v, sgn), f = (z) => outer(x, y, z) - lift; let z = 0.3; while (z > -0.05 && f(z) > 0) z -= 0.004; if (z <= -0.05) return null;
    let a = z, b = z + 0.004; for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (f(m) > 0) b = m; else a = m; } z = (a + b) / 2;
    const e = 0.0015, gx = outer(x + e, y, z) - outer(x - e, y, z), gy = outer(x, y + e, z) - outer(x, y - e, z), gz = outer(x, y, z + e) - outer(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
    return [x, y, z, gx / l, gy / l, gz / l]; };
  return { O, outer, tube, along, cutOf, arms, armOf, HEM, RS, END, top, E, slipped, SLIP, lapel, collar, liftS, onFront, tipOf, BK, HK, wingTip: (sgn) => SLIP && sgn === SLIP ? [WTS, LIFT] : [WT, 0], edgeAt: (sgn, y) => E(y) + (SLIP && sgn === SLIP ? DX : 0), lo: [-0.46, Math.min(HEM, 0.44) - 0.03, -0.22], hi: [0.46, 0.86, 0.22] };
}

definePart({ src: import.meta.url,
  name: "jacket", path: "outfit.jacket", section: SEC, outline: 0.003, thin: "keep",
  defaults: { on: false, color: "#3a3a40", hem: 0.505, hemBand: 0.022, out: 0.004, flare: 0.014, sleeve: 0.05, cuff: 0.04, open: 0.07, openTop: 0.05, lapel: 0.06, lapelEnd: 0.61, collar: 0.062, neck: 0.768, slip: "none", slipDrop: 0.065, slipOpen: 0.04, slipCollar: 0.75, slipLift: 0.01 },
  schema: [
    ["on", L("ジャケット", "Jacket"), { help: L("シャツの上に着る前開きの上着(襟とラペル、長袖)。着たときだけ作る", "an open jacket over the shirt (a collar and lapels, long sleeves); built only when worn") }],
    ["color", L("ジャケットの色", "Jacket color"), { when: { ".on": true } }],
    ["hem", L("すその高さ", "Hem height"), { when: { ".on": true }, min: 0.44, max: 0.62, step: 0.005, help: L("伸ばす前の体で(脚の付け根 0.44、肩 0.73)", "on the body before it is stretched (the hip joints at 0.44, the shoulders at 0.73)") }],
    ["hemBand", L("すその帯の幅", "Hem band"), { when: { ".on": true }, min: 0, max: 0.05, step: 0.002, help: L("すそに沿った帯(m、伸ばす前の体で)。0 = なし", "a band along the hem (m, on the body before it is stretched); 0 = none") }],
    ["out", L("シャツからの浮き", "Standing off the shirt"), { when: { ".on": true }, min: 0.002, max: 0.02, step: 0.001, help: L("m", "m") }],
    ["flare", L("すその広がり", "Hem flare"), { when: { ".on": true }, min: 0, max: 0.04, step: 0.001, help: L("胸からすそへまっすぐ下ろし、すそでこれだけ外へ(m)。ベルトの上にかぶる", "it hangs straight from the chest, this much further out at the hem (m): over a belt") }],
    ["sleeve", L("袖の太さ", "Sleeve width"), { when: { ".on": true }, min: 0.04, max: 0.075, step: 0.001, help: L("袖の半径(m)。肩から手首まで同じ太さ", "the sleeves' radius (m), as wide from the shoulder to the wrist") }],
    ["cuff", L("袖口の帯の幅", "Cuffs"), { when: { ".on": true }, min: 0, max: 0.08, step: 0.002, help: L("袖の先の帯(m)。0 = なし", "a band round each sleeve's end (m); 0 = none") }],
    ["open", L("前の開き(すそ)", "Front opening (hem)"), { when: { ".on": true }, min: 0, max: 0.12, step: 0.002, help: L("すそで、まん中から前のふちまで(m)", "from the middle to the front edge at the hem (m)") }],
    ["openTop", L("前の開き(首元)", "Front opening (neck)"), { when: { ".on": true }, min: 0, max: 0.1, step: 0.002, help: L("首元で、まん中から前のふちまで(m)", "from the middle to the front edge at the neck (m)") }],
    ["lapel", L("ラペルの幅", "Lapel width"), { when: { ".on": true }, min: 0, max: 0.09, step: 0.002, help: L("折り返した前身ごろの先までの幅(m)。0 = なし", "the folded-back front's width at its point (m); 0 = none") }],
    ["lapelEnd", L("ラペルの下端", "Lapel's lower end"), { when: { ".on": true }, min: 0.52, max: 0.68, step: 0.005, help: L("ラペルが前のふちに戻る高さ(伸ばす前の体で)。その下はふちの細い帯", "the height where the lapel meets the front edge again (on the body before it is stretched); a narrow strip along the edge below it") }],
    ["collar", L("襟の長さ", "Collar's wing"), { when: { ".on": true }, min: 0, max: 0.09, step: 0.002, help: L("襟の先が肩へ伸びる長さ(m)。0 = 襟なし", "how far the collar's point reaches out over the shoulder (m); 0 = no collar") }],
    ["neck", L("襟ぐりの高さ", "Neckline height"), { when: { ".on": true }, min: 0.74, max: 0.8, step: 0.002, tier: "advanced" }],
    ["slip", L("肩を落とす", "Slipped off a shoulder"), { when: { ".on": true }, options: [{ value: "none", label: L("落とさない", "No") }, { value: "L", label: L("左肩", "The left shoulder") }, { value: "R", label: L("右肩", "The right shoulder") }], help: L("片方の肩から滑り落ちて、襟が二の腕にかかる", "slipped off one shoulder: its collar lies round the upper arm, the shoulder bare") }],
    ["slipDrop", L("落ちる深さ", "How far it slipped"), { when: { ".on": true, ".slip": ["L", "R"] }, min: 0.02, max: 0.1, step: 0.002, help: L("肩の関節の所で襟ぐりが下がる量(m、伸ばす前の体で)", "how far the neckline is lowered at the shoulder joint (m, on the body before it is stretched)") }],
    ["slipCollar", L("落ちた側の襟の幅", "Slipped side's collar"), { when: { ".on": true, ".slip": ["L", "R"] }, min: 0.4, max: 1.2, step: 0.05, help: L("落ちた襟ぐりに沿って二の腕を回る襟の幅(襟の長さの何倍か)", "the collar folded along the fallen neckline, round the upper arm: its width (× the collar's wing)") }],
    ["slipLift", L("落ちた側の襟の浮き", "Slipped side's collar lift"), { when: { ".on": true, ".slip": ["L", "R"] }, min: 0, max: 0.02, step: 0.001, help: L("襟の先が袖から浮く量(m)。0 だと袖に貼りついて見える", "how far the collar's free edge stands off the sleeve (m); at 0 it reads as part of the sleeve") }],
    ["slipOpen", L("落ちた側の前の開き", "Slipped side's opening"), { when: { ".on": true, ".slip": ["L", "R"] }, min: 0, max: 0.07, step: 0.002, help: L("落ちた側の前のふちがさらに外へ寄る量(m)", "how much further out the slipped side's front edge hangs (m)") }],
  ],
  build(ctx) { const S = shape(ctx), { O } = ctx, sheets = [{ o: S.outer, tk: TK, cut: S.cutOf() }];
    const HB = O.hemBand ?? 0.022, CF = O.cuff ?? 0.04, body = S.cutOf(0.003, 0.002);
    if (HB > 0) sheets.push({ lying: true, o: (x, y, z) => S.outer(x, y, z) - 0.004, tk: 0.007, cut: (x, y, z) => Math.max(body(x, y, z), y - (S.HEM + HB) + 3 * Math.max(0, Math.abs(x) - 0.2)), lo: [-0.24, S.HEM - 0.01, -0.22], hi: [0.24, S.HEM + HB + 0.01, 0.22] });
    if (CF > 0) for (const A of S.arms) { const e = A.Lf + S.END, R = S.RS + 0.03, a = [0, 1, 2].map((k) => A.F[k] + A.g[k] * (e - CF)), b = [0, 1, 2].map((k) => A.F[k] + A.g[k] * (e + 0.004));
      sheets.push({ lying: true, o: (x, y, z) => S.tube(x, y, z, A) - 0.005, tk: 0.008, cut: (x, y, z) => { const t = S.along(x, y, z, A); return Math.max(t - (e + 0.004), e - CF - t, -x * A.side); },
        lo: [0, 1, 2].map((k) => Math.min(a[k], b[k]) - R), hi: [0, 1, 2].map((k) => Math.max(a[k], b[k]) + R) }); }
    const flaps = { lo: [-0.26, S.HEM - 0.02, -0.2], hi: [0.26, 0.86, 0.2], fine: true, lying: true };   // (lying on the jacket: no inner side)
    if (S.lapel) sheets.push({ o: (x, y, z) => S.outer(x, y, z) - L1, tk: L1 + 0.003, cut: S.lapel, ...flaps });
    if (S.collar) sheets.push({ o: (x, y, z) => S.outer(x, y, z) - L2 - S.liftS(x, y, z), tk: (x, y, z) => L2 - L1 + 0.003 + S.liftS(x, y, z), cut: S.collar, ...flaps });
    return { S, sheets }; },
  // at the cloth sheets' cells (a skirt's, a cape's), its folded parts at half of them; the edges are cut along the pattern's lines whatever the cells
  spec: (st, { H, sheetH, one }) => ({ make: () => sheetsMesh(st.sheets.map((q) => q.fine ? { ...q, h: sheetH * 0.6 } : q), st.S.lo, st.S.hi, sheetH, one), sdf: () => 1, lo: st.S.lo, hi: st.S.hi, h: H, only: /^(hips|spine|chest|upperChest|shoulder|neck|upperArm|lowerArm)/ }),
});

// The metal on the jacket: a zip along each lapel's edge and down the front edge, a snap on each lapel's and collar's point, a pocket's zip on each front panel
definePart({ src: import.meta.url,
  name: "jacketMetal", path: "outfit.jacket.metal", group: "jacket", section: SEC, outline: 0.0015, soft: false, thin: "keep",
  defaults: { on: true, color: "#a4a4ab", zip: 0.006, snap: 0.007, pocket: 0.05 },
  schema: [
    ["on", L("ジャケットの金具", "Jacket's metal"), { when: { "outfit.jacket.on": true }, help: L("ラペルと前のふちのジッパー、ラペルと襟の先のスナップ", "a zip along the lapels and the front edges, snaps on the lapels' and the collar's points") }],
    ["color", L("金具の色", "Metal color"), { when: { "outfit.jacket.on": true, ".on": true } }],
    ["zip", L("ジッパーの太さ", "Zip width"), { when: { "outfit.jacket.on": true, ".on": true }, min: 0, max: 0.012, step: 0.001, help: L("m。0 = なし", "m; 0 = none") }],
    ["snap", L("スナップの大きさ", "Snap size"), { when: { "outfit.jacket.on": true, ".on": true }, min: 0, max: 0.014, step: 0.001, help: L("半径(m)。0 = なし", "radius (m); 0 = none") }],
    ["pocket", L("ポケットのジッパー", "Pocket zips"), { when: { "outfit.jacket.on": true, ".on": true }, min: 0, max: 0.09, step: 0.002, help: L("前身ごろの斜めのジッパーの長さ(m、伸ばす前の体で)。0 = なし", "the slanted zip on each front panel: its length (m, on the body before it is stretched); 0 = none") }],
  ],
  build(ctx) { const JO = ctx.OPT.outfit.jacket; if (!JO?.on) return null;
    const S = shape({ ...ctx, O: JO }), { O } = ctx, ZW = O.zip ?? 0.006, SN = O.snap ?? 0.007, PK = O.pocket ?? 0.05, TH = 0.003;
    const make = () => { const pos = [], nor = [], idx = [];
      const quad = (a, b, c, d, n) => { const v = pos.length / 3; pos.push(...a, ...b, ...c, ...d); for (let q = 0; q < 4; q++) nor.push(...n); idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); };
      const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
      // a ribbon along a line of the pattern: its top and two sides, standing TH off the cloth under it
      const ribbon = (line, sgn, lift, w, body = false) => { const pts = [];
        for (let i = 1; i < line.length; i++) { const [a, b] = [line[i - 1], line[i]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.006));
          for (let k = i === 1 ? 0 : 1; k <= n; k++) { const p = S.onFront(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, sgn, lift, body); if (p) pts.push(p); } }
        const rim = pts.map((p, i) => { const q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i + 1)], n = p.slice(3), s = unit(cross([q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]], n));
          const c = p.slice(0, 3), l = add(c, s, -w / 2), r = add(c, s, w / 2); return { n, s, l, r, lt: add(l, n, TH), rt: add(r, n, TH) }; });
        for (let i = 1; i < rim.length; i++) { const a = rim[i - 1], b = rim[i];
          if (Math.hypot(a.l[0] - b.l[0], a.l[1] - b.l[1], a.l[2] - b.l[2]) > 0.03) continue;   // (a gap: the line left the cloth)
          quad(a.lt, a.rt, b.lt, b.rt, a.n); quad(a.l, a.lt, b.l, b.lt, a.s.map((v) => -v)); quad(a.rt, a.r, b.rt, b.r, a.s); } };
      // a snap: a low disc
      const disc = (u, v, sgn, lift, r) => { const p = S.onFront(u, v, sgn, lift); if (!p) return; const n = p.slice(3), c = p.slice(0, 3), s = unit(cross(n, [0, 1, 0])), t = cross(n, s), N = 12, top = add(c, n, TH), v0 = pos.length / 3;
        const at = (i, h) => { const a = i / N * Math.PI * 2; return add(add(add(c, s, Math.cos(a) * r), t, Math.sin(a) * r), n, h); };
        pos.push(...top); nor.push(...n); for (let i = 0; i < N; i++) { pos.push(...at(i, TH)); nor.push(...n); }
        for (let i = 0; i < N; i++) idx.push(v0, v0 + 1 + i, v0 + 1 + (i + 1) % N);
        for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2, o = [0, 1, 2].map((k) => s[k] * Math.cos(a) + t[k] * Math.sin(a)); quad(at(i, TH), at(i, 0), at(i + 1, TH), at(i + 1, 0), o); } };
      for (const sgn of [1, -1]) {
        const T = S.tipOf(sgn);
        if (ZW > 0 && S.lapel) ribbon([[T[0] - 0.012, T[1] - 0.001], [S.BK[0] - 0.006, S.BK[1]], [S.HK[0] - 0.006, S.HK[1] + 0.006]], sgn, L1, ZW);
        if (SN > 0 && S.lapel) disc(T[0] - 0.02, T[1] + 0.007, sgn, L1, SN);
        if (SN > 0 && S.collar) { const [W, up] = S.wingTip(sgn); disc(W[0] - 0.016, W[1] + 0.011, sgn, L2 + up, SN); }
        // a pocket's zip on each front panel, slanting out toward the hem (on the body's own place: beside the front edge on a slipped side)
        if (PK > 0) { const x0 = Math.max(0.104, S.edgeAt(sgn, 0.58) + 0.024), y0 = Math.min(0.585, S.HEM + 0.11); ribbon([[x0, y0], [x0 + 0.012, y0 - PK]], sgn, 0, ZW || 0.006, true); } }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }; };
    return { make }; },
  spec: (st, { H }) => ({ make: st.make, sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, only: /^(hips|spine|chest|upperChest|shoulder|neck|upperArm|lowerArm)/ }),
});
