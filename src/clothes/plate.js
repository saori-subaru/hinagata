// Full plate (outfit.armor.style "full"): a knight in armor head to toe — the character underneath does not show.
// Same idea as the light armor (armor.js): simple hard shapes fitted once around the body, solid, on as few bones as they can.
//   helm: fitted around the head (the hair is not worn) — six shapes told apart by their silhouettes (see "helm" below), and decorations
//   cuirass: the torso from the hips to a collar around the neck, flaring at the bottom into two bands (faulds)
//   arms: big pauldrons (three lames), upper-arm tubes, elbow cops, forearm tubes, gauntlets (the hand puffed up)
//   legs: thigh tubes, knee cops (all round), greaves, sabatons (the foot puffed up)
//   mail: a dark layer just over the body (chain mail) — where the plates leave a gap at a joint, mail shows, not skin
import { blend, smin, sstep } from "../sdf/prim.js";
import { guard, dome, slice, sell, smax, sub, dot, norm } from "./armor.js";

export function buildPlate(OPT, { P, J, bodySdf, HT }) {
  const AR = { gap: 0.022, thick: 0.009, ...(OPT.outfit.armor ?? {}) }, G = AR.gap * 0.7, T = AR.thick;
  const pick = (...names) => names.flatMap((n) => [P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);
  const TH = OPT.body.thickness ?? {};
  const side = (f) => (x, y, z) => f[x > 0 ? 0 : 1](x, y, z);
  const groove = (d, v, at, w = 0.004, depth = 0.0025) => { const b = Math.abs(v - at); return b < w ? d + depth * (1 - b / w) : d; };   // a line pressed into the plate (between lames)

  // ── helm ──
  // fitted to the whole head (ears and cheeks too): the widest it gets across, forward and back, over the head's height
  const top = (() => { const c = HT.fromHead(0, 1.1, 0); let r = 0.05; for (; r < 0.5; r += 0.003) if (bodySdf(c[0], c[1] + r, c[2]) > 0) break; return c[1] + r; })();
  const chin = HT.fromHead(0, OPT.body.sculpt.chin?.y ?? 0.835, 0)[1], eyeY = HT.fromHead(0, OPT.face.layout.eyeY ?? 1.0, 0)[1];
  let sx = 0, sf = -1, sb = 1; const HEAD_PTS = [];
  for (let y = chin + 0.02; y < top - 0.03; y += 0.015) { const c = HT.fromHead(0, HT.toHead(0, y, 0)[1], 0);
    const out = (d) => { let r = 0.02; for (; r < 0.5; r += 0.003) if (bodySdf(c[0] + d[0] * r, y, c[2] + d[2] * r) > 0) break; return r; };
    sx = Math.max(sx, out([1, 0, 0]), out([-1, 0, 0]), out(norm([1, 0, 1])) * 0.9, out(norm([1, 0, -1])) * 0.9); sf = Math.max(sf, c[2] + out([0, 0, 1])); sb = Math.min(sb, c[2] - out([0, 0, -1])); }
  { const pts = [];   // then the smallest oval (by area) that holds every point around the head: the ears stick out to the sides and back,
    // and growing the oval evenly to take them in left a lot of room at the face and the back of the head (the helm looked thick)
    for (let y = chin + 0.02; y < top - 0.005; y += 0.015) { const c = HT.fromHead(0, HT.toHead(0, y, 0)[1], 0);
      for (let i = 0; i < 48; i++) { const th = i / 48 * Math.PI * 2, d = [Math.cos(th), 0, Math.sin(th)]; let r = 0.02; for (; r < 0.5; r += 0.003) if (bodySdf(c[0] + d[0] * r, y, c[2] + d[2] * r) > 0) break;
        pts.push([Math.abs(c[0] + d[0] * r), c[2] + d[2] * r, y]); } }
    const ax = Math.max(...pts.map((q) => q[0])), zf = Math.max(...pts.map((q) => q[1])), zb = Math.min(...pts.map((q) => q[1]));
    let best = null;
    for (let A = ax; A < ax * 1.6; A += 0.002) for (let z0 = (zf + zb) / 2 - 0.03; z0 <= (zf + zb) / 2 + 0.03; z0 += 0.0025) {
      let B = 0; for (const [x, z] of pts) B = Math.max(B, Math.abs(z - z0) / Math.sqrt(Math.max(1e-4, 1 - (x / A) ** 2)));
      if (!best || A * B < best.A * best.B) best = { A, B, z0 }; }
    sx = best.A; sf = best.z0 + best.B; sb = best.z0 - best.B; HEAD_PTS.push(...pts); }
  const hg = 0.01, zc = (sf + sb) / 2, HR = [sx + hg, 0, (sf - sb) / 2 + hg + 0.002], bottom = chin - 0.035, yc = top - (top - bottom) * 0.45;   // the dome's center: the walls run straight below it
  HR[1] = top + hg - yc; const HC = [0, yc, zc];
  // helm (outfit.armor.helm) — told apart by the silhouette:
  //   "great"  = a closed bucket, flat-sided, with an eye slit          "visor" = the same, a wide dark band over the eyes and the mouth open
  //   "open"   = rounder, open around the face, a nose guard            "kettle" = the open one with a wide brim (a kettle hat)
  //   "close"  = a round skull with a visor pointed like a beak, a comb on top, a flared rim at the neck (a close helm)
  //   "sallet" = a round skull sweeping out into a long tail at the back, with an eye slit
  //   The open ones are cut through: the face behind is the character's own.
  const HELM = AR.helm ?? "great";
  const ST = { great: { dome: 2.4, taper: 0.06, slit: [eyeY, 0.011], crest: 0.024 }, visor: { dome: 2.4, taper: 0.06, slit: [eyeY, 0.024], crest: 0.024 },
    open: { dome: 2.05, taper: 0.1, nasal: true }, kettle: { dome: 2.05, taper: 0.1, brim: true },
    close: { dome: 2.05, taper: 0.08, slit: [eyeY + 0.028, 0.006], crest: 0.04, beak: true, flare: true },
    sallet: { dome: 2.1, taper: 0.04, slit: [eyeY, 0.01], crest: 0.016, tail: true } }[HELM] ?? {};
  const yp = eyeY - 0.008, beakAt = (y) => ST.beak ? 0.085 * Math.max(0, 1 - Math.abs(y - yp) / (y > yp ? 0.08 : 0.13)) : 0;   // how far the beak stands out at y (most at the eyes)
  const BA = [Math.cos(0.95), Math.sin(0.95)];   // the beak's sides: planes turned 54° off the front
  const helmOuter = (x, y, z) => { const rho = Math.hypot(x, (z - zc) * HR[0] / HR[2]), u = Math.max(0, (yc - y) / (yc - bottom));   // round from above (an ellipse, scaled to a circle)
    let d = y < yc ? rho - HR[0] * (1 - ST.taper * u * u) : sell(rho, y - yc, HR[0], HR[1], ST.dome);   // walls below the dome's center, a little in toward the bottom
    if (ST.tail) d -= 0.11 * u ** 1.6 * Math.max(0, (zc - z) / HR[2]) ** 1.2;   // the sallet's tail: out at the back, more toward the bottom
    if (ST.flare) d -= 0.028 * sstep(bottom + 0.05, bottom, y);   // a rim flaring out at the neck
    const b = beakAt(y);
    if (b > 0) { const tz = zc + HR[2] + b, w = Math.max(BA[0] * x + BA[1] * (z - tz), -BA[0] * x + BA[1] * (z - tz)); d = smin(d, smax(Math.max(w, zc - z), Math.abs(x) - HR[0] * 0.97, 0.01), 0.012); }   // the beak: a wedge out of the front
    return d; };
  // the oval was fitted to the head's outline from above; a round dome curves in sooner than the head does toward the top of the back, so widen
  // the helm (about its center) until every point of the head is inside it by a few mm (the flat-topped bucket needs no more room)
  for (let i = 0; i < 30; i++) { let worst = -1; for (const [x, z, y] of HEAD_PTS) worst = Math.max(worst, helmOuter(x, y, z) + hg * 0.6); if (worst <= 0) break; HR[0] *= 1.01; HR[2] *= 1.01; }
  const fx = (hx) => HT.fromHead(hx, 1, 0)[0], eyeX = OPT.face.layout.eyeX ?? 0.1;
  const [slitY, slitH] = ST.slit ?? [eyeY, 0];
  const slit = (x, y, z) => Math.max(Math.abs(y - slitY) - slitH, Math.abs(x) - HR[0] * 0.62, zc - z, -helmOuter(x, y, z) - 0.009);   // the slit: 9 mm deep along the front (the face is 1.2 cm in)
  // the opening: an oval through the front of the helm (front half only)
  const OPEN = HELM === "visor" ? { y0: chin - 0.06, y1: eyeY - slitH - 0.022, w: fx(0.1), n: 2.6 } : HELM === "open" || HELM === "kettle" ? { y0: chin - 0.06, y1: eyeY + 0.06, w: fx(eyeX + 0.078), n: 2.3 } : null;
  const opening = OPEN ? (x, y, z) => { const ym = (OPEN.y0 + OPEN.y1) / 2, hy = (OPEN.y1 - OPEN.y0) / 2; return Math.max(sell(x, y - ym, OPEN.w, hy, OPEN.n), zc + 0.02 - z); } : null;
  const nasal = (x, y, z) => Math.max(Math.abs(x) - 0.011, y - (eyeY + 0.07), eyeY - 0.045 - y, helmOuter(x, y, z), -helmOuter(x, y, z) - 0.009, zc - z);   // a strip down the front, over the nose
  const brimY = (OPEN?.y1 ?? eyeY) + 0.022;
  const brim = (x, y, z) => { const r = Math.hypot(x, (z - zc) * HR[0] / HR[2]); return Math.max(Math.abs(y - (brimY - 0.3 * Math.max(0, r - HR[0]))) - 0.006, r - HR[0] - 0.07); };   // a wide brim, drooping a little toward its edge
  const helmSdf = (x, y, z) => {
    let d = helmOuter(x, y, z);
    d = smax(d, bottom - y, 0.006);
    if (HELM === "great" || HELM === "visor" || HELM === "sallet") { d = groove(d, y, eyeY + slitH + 0.023, 0.005, 0.003); if (HELM === "great") d = groove(d, y, eyeY - 0.03, 0.004, 0.002); }   // the visor's edges
    if (HELM === "close") { d = groove(d, y, slitY + slitH + 0.012, 0.005, 0.003); d = groove(d, y, eyeY - 0.085, 0.005, 0.003); }   // the visor's top edge and the bevor below it
    if (slitH) d = smax(d, -slit(x, y, z), 0.003);
    if (OPEN) { d = smax(d, -opening(x, y, z), 0.006); d = groove(d, y, OPEN.y1 + 0.018, 0.005, 0.003); }
    if (HELM === "great" && z > zc) for (const [hx, hy] of [[-0.07, -0.05], [-0.045, -0.05], [-0.07, -0.072], [-0.045, -0.072]]) d = smax(d, 0.0055 - Math.hypot(x - hx, y - eyeY - hy), 0.002);   // breaths on the right cheek (front only)
    if (HELM === "close" && z > zc) for (let i = 0; i < 4; i++) d = smax(d, -Math.max(Math.abs(x + 0.028 + 0.017 * i) - 0.0035, Math.abs(y - eyeY + 0.045) - 0.014, -helmOuter(x, y, z) - 0.008), 0.002);   // breaths: slots down the right side of the beak
    if (ST.nasal) d = Math.min(d, nasal(x, y, z));
    if (ST.brim) d = Math.min(d, brim(x, y, z));
    if (ST.beak) for (const m of [1, -1]) d = Math.min(d, Math.hypot(x - m * HR[0] * 0.99, y - slitY, z - zc - 0.01) - 0.013);   // the visor's pivots
    if (ST.crest && (AR.deco ?? "none") === "none") d = Math.min(d, Math.max(Math.abs(x) - (ST.crest > 0.03 ? 0.011 : 0.009), helmOuter(x, y - ST.crest, z) - 0.002, yc + HR[1] * 0.15 - y));   // a crest (comb) from front to back (unless something sits on top)
    return d; };
  const visorSdf = !slitH ? null : (x, y, z) => Math.max(Math.abs(y - slitY) - slitH - 0.004, Math.abs(x) - HR[0] * 0.65, zc - z, Math.abs(helmOuter(x, y, z) + 0.0105) - 0.0035);   // the dark slab at the slit's floor

  // ── on the helm (outfit.armor.deco, its own color): "plume" = a brush of feathers front to back / "horns" / "wings" ──
  const DECO = AR.deco ?? "none";
  const capsule2 = (p, a, b, ra, rb) => { const ab = sub(b, a), ap = sub(p, a), h = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab))); return Math.hypot(ap[0] - ab[0] * h, ap[1] - ab[1] * h, ap[2] - ab[2] * h) - (ra + (rb - ra) * h); };
  const bez = (p0, p1, p2, t) => p0.map((v, i) => (1 - t) ** 2 * v + 2 * (1 - t) * t * p1[i] + t * t * p2[i]);
  const ellipsoidAlong = (p, c, u, w, r) => { const q = sub(p, c), n = norm([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]); return (Math.hypot(dot(q, u) / r[0], dot(q, w) / r[1], dot(q, n) / r[2]) - 1) * Math.min(...r); };
  let decoSdf = null;
  if (DECO === "plume") decoSdf = (x, y, z) => {   // in the helm's own oval: phi = 0 on top, + toward the front
    const u = (z - zc) / HR[2], v = (y - yc) / HR[1], rho = Math.hypot(u, v), phi = Math.atan2(u, v), P0 = -1.35, P1 = 0.55;
    const t = Math.min(1, Math.max(0, (phi - P0) / (P1 - P0))), h = 0.095 * Math.sin(Math.PI * t) ** 0.45 * (1 - 0.15 * Math.abs(Math.sin(phi * 14)));   // a brush over the top, tallest in the middle, feathery edge
    return Math.max(Math.abs(x) - (0.022 - 0.1 * Math.max(0, (rho - 1) * HR[1])), (rho - 1) * HR[1] - h, (0.94 - rho) * HR[1], (phi - P1) * HR[1], (P0 - phi) * HR[1]); };
  if (DECO === "horns") { const H2 = [1, -1].map((m) => { const p0 = [m * HR[0] * 0.8, yc + 0.03, zc + 0.01], p1 = [m * (HR[0] + 0.1), yc + 0.02, zc + 0.03], p2 = [m * (HR[0] + 0.13), yc + 0.17, zc + 0.05], N = 12;
      const pts = Array.from({ length: N + 1 }, (_, i) => bez(p0, p1, p2, i / N));
      return (x, y, z) => { let d = 1e9; for (let i = 0; i < N; i++) d = Math.min(d, capsule2([x, y, z], pts[i], pts[i + 1], 0.034 * (1 - i / N) ** 0.8 + 0.004, 0.034 * (1 - (i + 1) / N) ** 0.8 + 0.004)); return d; }; });
    decoSdf = (x, y, z) => H2[x > 0 ? 0 : 1](x, y, z); }
  if (DECO === "wings") { const W2 = [1, -1].map((m) => { const base = [m * (HR[0] - 0.005), yc - 0.01, zc - 0.02];
      const lobes = [[0.32, 0.19], [0.75, 0.16], [1.15, 0.12]].map(([a, L]) => { const u = norm([m * 0.35, Math.cos(a), -Math.sin(a)]), w = norm([0, Math.sin(a), Math.cos(a)]); return { c: base.map((v, i) => v + u[i] * L * 0.55), u, w, r: [L * 0.6, 0.032, 0.009] }; });
      return (x, y, z) => { let d = 1e9; for (const o of lobes) d = Math.min(d, ellipsoidAlong([x, y, z], o.c, o.u, o.w, o.r)); return d; }; });
    decoSdf = (x, y, z) => W2[x > 0 ? 0 : 1](x, y, z); }

  // ── cuirass: slices of the torso from the hips to the collar (n 2.3), the faulds flaring out below the waist ──
  const torso = blend(pick("chest", "upperChest", "bust", "belly", "pelvis", "trap", "butt"));
  const Y0 = 0.4, Y1 = 0.78, NS = 30, SL = [];
  for (let i = 0; i <= NS; i++) { const y = Y0 + (Y1 - Y0) * i / NS; SL.push(slice(torso, [0, y, -0.005], [1, 0, 0], [0, 0, 1], 24)); }
  for (let pass = 0; pass < 2; pass++) for (const k of ["a", "b", "cv"]) { const v = SL.map((s) => s[k]); SL.forEach((s, i) => { s[k] = (v[Math.max(0, i - 1)] + 2 * v[i] + v[Math.min(NS, i + 1)]) / 4 + (k === "cv" ? 0 : 0.002); }); }
  const at = (y, k) => { const f = Math.min(NS, Math.max(0, (y - Y0) / (Y1 - Y0) * NS)), i = Math.min(NS - 1, Math.floor(f)), t = f - i; return SL[i][k] * (1 - t) + SL[i + 1][k] * t; };
  const WAIST = 0.475, armC = (s) => ({ a: J[`upperArm.${s}`], b: J[`lowerArm.${s}`], r: 0.047 * (TH.upperArm ?? 1) + 0.03 }), ARMS = [armC("L"), armC("R")];
  const capsule = (x, y, z, c) => { const ab = sub(c.b, c.a), ap = [x - c.a[0], y - c.a[1], z - c.a[2]], h = Math.max(-0.6, Math.min(1, dot(ap, ab) / dot(ab, ab))); return Math.hypot(ap[0] - ab[0] * h, ap[1] - ab[1] * h, ap[2] - ab[2] * h) - c.r; };
  const neckR = 0.062;
  const chestSdf = (x, y, z) => {
    const yc = Math.min(Y1, Math.max(Y0, y)), flare = 0.32 * Math.max(0, WAIST - y);   // the faulds open out like a short skirt of plates
    let d = sell(x, z - at(yc, "cv"), at(yc, "a") + flare, at(yc, "b") + flare * 0.8, 2.3) - G - T - 0.005 * Math.exp(-((x / 0.016) ** 2)) * (z > 0 ? 1 : 0);   // a ridge down the front
    d = groove(groove(d, y, WAIST, 0.005, 0.004), y, WAIST - 0.03, 0.005, 0.004);   // the lames of the faulds
    const collar = Math.max(Math.hypot(x, (z + 0.005) / 0.95) - (neckR + 0.02), y - 0.8);   // a stand-up collar around the neck
    d = Math.min(d, Math.max(collar, 0.7 - y));
    d = smax(d, 0.026 + neckR * 0.55 - Math.hypot(x, (z + 0.005) / 0.95) - 0.012, 0.004);   // the neck hole (the helm hides it)
    d = smax(d, y - 0.8, 0.004);
    d = smax(d, Y0 - 0.01 + 0.02 * sstep(-0.02, 0.08, z) - y, 0.006);   // the bottom: a little higher in front (the thighs come up there when sitting)
    d = smax(d, -Math.min(...ARMS.map((c) => capsule(x, y, z, c))), 0.008);   // armholes (the pauldrons cover them)
    return d; };

  // ── pauldrons: big domes over the shoulders, in three lames down the arm ──
  const pauldron = (s) => { const m = s === "L" ? 1 : -1, a = J[`upperArm.${s}`], u = norm(sub(J[`lowerArm.${s}`], a)), out = norm([m * Math.abs(u[1]), Math.abs(u[0]), 0]);
    const R = 0.047 * (TH.upperArm ?? 1) + G + T + 0.026, c = [a[0] + m * 0.006, a[1] + 0.006, a[2]], D = dome(c, [R * 1.1, R, R * 1.12]);
    return (x, y, z) => { const p = [x - c[0], y - c[1], z - c[2]], v = dot(p, u);
      let d = D(x, y, z) - 0.006 * sstep(0.0, 0.05, v);   // the lower lames stand out a little
      d = smax(d, v - 0.07, 0.01);
      d = smax(d, -dot(p, out) - 0.035, 0.012);
      d = smax(d, 0.045 - m * x, 0.012);   // not into the collar
      d = groove(groove(d, v, 0.02, 0.005, 0.004), v, 0.045, 0.005, 0.004);
      return d; }; };
  const shoulderSdf = side([pauldron("L"), pauldron("R")]);

  // ── arms: upper-arm tube, elbow cop, forearm tube ──
  const upper = blend(pick("upperArm")), fore = blend(pick("foreArm", "foreBulge"));
  const ARM = ["L", "R"].map((s) => { const a = J[`upperArm.${s}`], e = J[`lowerArm.${s}`], h = J[`hand.${s}`];
    const ua = guard(upper, a, e, { t0: 0.35, t1: 0.92, gap: G * 0.8, thick: T, rim: 0.002, n: 2.1 });
    const fa = guard(fore, e, h, { t0: 0.08, t1: 0.92, gap: G * 0.8, thick: T, rim0: 0, flare: 0.012, n: 2.1 });
    const cop = dome(e, [0.06, 0.06, 0.06].map((v) => v * Math.max(1, TH.forearm ?? 1)));
    return (x, y, z) => Math.min(ua(x, y, z), fa(x, y, z), cop(x, y, z)); });
  const armSdf = side(ARM);

  // ── gauntlets: the hand puffed up (fingers and all) ──
  const hand = blend(pick("palm", "finger0", "finger1", "finger2", "finger3", "fingerTip0", "fingerTip1", "fingerTip2", "fingerTip3", "thumb"));
  const handSdf = (x, y, z) => hand(x, y, z) - 0.008;

  // ── legs: thigh tube, knee cop (all round), greave; sabatons ──
  const thigh = blend(pick("thigh", "thighF", "thighB", "thighIn")), shin = blend(pick("calf", "calfO", "calfB"));
  const LEG = ["L", "R"].map((s) => { const hp = J[`upperLeg.${s}`], k = J[`lowerLeg.${s}`], f = J[`foot.${s}`], t1 = (k[1] - 0.075) / (k[1] - f[1]);   // down over the ankle, into the sabaton
   
    const cu = guard(thigh, hp, k, { t0: 0.14, t1: 0.9, gap: G * 0.7, thick: T, rim: 0.002, n: 2.1 });
    const gr = guard(shin, k, f, { t0: 0.1, t1, gap: G * 0.7, thick: T, rim0: 0, flare: 0.01, ridge: 0.008, n: 2.1 });
    const cop = dome([k[0], k[1] + 0.006, k[2] + 0.012], [0.075, 0.066, 0.075].map((v) => v * Math.max(1, TH.calf ?? 1)));
    return (x, y, z) => Math.min(cu(x, y, z), gr(x, y, z), cop(x, y, z)); });
  const legSdf = side(LEG);
  const foot = blend(pick("shoeLast"));
  const footSdf = (x, y, z) => Math.max(foot(x, y, z) - 0.014, y - 0.125, -0.002 - y);

  // ── mail: the body, 3 mm out, below the helm ──
  const mailSdf = (x, y, z, B = bodySdf) => Math.max(B(x, y, z) - 0.003, y - 0.8);

  return { chestSdf, shoulderSdf, armSdf, legSdf, helmSdf, visorSdf, decoSdf, handSdf, footSdf, mailSdf };
}
