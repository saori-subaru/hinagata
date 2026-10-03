// Armor: hard pieces over the clothes — breastplate, pauldrons, bracers (forearms) and greaves (shins, with knee cops).
// Hard, not cloth: each piece is a simple shape (a tube of ellipses, a dome) fitted around the body once, not the body puffed up,
// so its surface stays smooth and its edges crisp whatever the body underneath does. Solid (filled to the bone), not a thin shell:
// a shell's inner face sat 1 cm under the outer one and speckled it with shadow; the cut edges then read as the plate's thickness.
//   Fitting: rays from the bone's axis find where the body's parts end (ellipse per slice); along a limb the ellipses change
//   linearly (a straight cone, like a metal plate), around the torso they follow the slices (smoothed).
import { smin, blend, sstep } from "../sdf/prim.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const smax = (a, b, k) => -smin(-a, -b, k);
// superellipse "distance" (n = 2: an ellipse; larger: squarer). Good near the curve, which is all a thin shell needs
const sell = (u, v, a, b, n) => (Math.pow(Math.abs(u / a) ** n + Math.abs(v / b) ** n, 1 / n) - 1) * Math.min(a, b);

// where a ray from o (inside f) first leaves f: march, then bisect
function exitAt(f, o, d, rmax = 0.3) {
  let r0 = 0, r1 = 0;
  for (r1 = 0.008; r1 < rmax; r1 += 0.008) if (f(o[0] + d[0] * r1, o[1] + d[1] * r1, o[2] + d[2] * r1) > 0) break; else r0 = r1;
  for (let i = 0; i < 8; i++) { const m = (r0 + r1) / 2; if (f(o[0] + d[0] * m, o[1] + d[1] * m, o[2] + d[2] * m) > 0) r1 = m; else r0 = m; }
  return (r0 + r1) / 2;
}
// one slice: the body's extent around o in the plane (e1, e2) → center offset (cu, cv) and half widths (a, b)
function slice(f, o, e1, e2, N = 20) {
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), d = [0, 1, 2].map((k) => e1[k] * c + e2[k] * s), r = exitAt(f, o, d);
    u0 = Math.min(u0, r * c); u1 = Math.max(u1, r * c); v0 = Math.min(v0, r * s); v1 = Math.max(v1, r * s); }
  return { cu: (u0 + u1) / 2, cv: (v0 + v1) / 2, a: (u1 - u0) / 2, b: (v1 - v0) / 2 };
}
// a frame around the axis a→b: e2 = toward the front (+z), as near as it can be
function frame(a, b) { const L = Math.hypot(...sub(b, a)), u = norm(sub(b, a)), z = [0, 0, 1], e2 = norm(sub(z, u.map((v) => v * dot(z, u)))), e1 = cross(e2, u); return { L, u, e1, e2 }; }

/** A limb guard: a cone of ellipses around a→b from t0 to t1 (fractions of the bone), fitted to f, at gap, thick; rim: raised bands at the ends. */
function guard(f, a, b, { t0, t1, gap, thick, rim = 0.003, rim0 = rim, flare = 0, ridge = 0, n = 2 }) {
  const F = frame(a, b), ts = [], S = [];
  for (let i = 0; i <= 10; i++) { const t = t0 + (t1 - t0) * i / 10, o = [0, 1, 2].map((k) => a[k] + F.u[k] * F.L * t); if (f(...o) >= 0) continue; ts.push(t); S.push(slice(f, o, F.e1, F.e2)); }
  const lin = (key) => { const n_ = ts.length, mt = ts.reduce((s, t) => s + t, 0) / n_, mv = S.reduce((s, q) => s + q[key], 0) / n_;   // least squares line, then lifted to enclose every slice
    let num = 0, den = 0; ts.forEach((t, i) => { num += (t - mt) * (S[i][key] - mv); den += (t - mt) ** 2; }); const k = den ? num / den : 0;
    const up = key === "a" || key === "b" ? Math.max(0, ...ts.map((t, i) => S[i][key] - (mv + k * (t - mt)))) : 0;
    return (t) => mv + k * (t - mt) + up; };
  const cu = lin("cu"), cv = lin("cv"), A = lin("a"), B = lin("b"), e = 0.04 / F.L;   // e: the rim bands' width (as a fraction of the bone)
  return (x, y, z) => { const w = [x - a[0], y - a[1], z - a[2]], t = dot(w, F.u) / F.L, tc = Math.min(t1, Math.max(t0, t));
    const r = [w[0] - F.u[0] * t * F.L, w[1] - F.u[1] * t * F.L, w[2] - F.u[2] * t * F.L], d = sell(dot(r, F.e1) - cu(tc), dot(r, F.e2) - cv(tc), A(tc), B(tc), n);
    const lift = rim0 * sstep(t0 + e, t0 + e * 0.4, t) + rim * sstep(t1 - e, t1 - e * 0.4, t) + flare * sstep(t1 - 0.3, t1, t) ** 2   // raised bands at the ends; flare: the far end opens out
      + ridge * Math.max(0, dot(r, F.e2) - cv(tc)) / B(tc) * Math.exp(-(((dot(r, F.e1) - cu(tc)) / 0.012) ** 2));   // ridge: a low keel down the front
    return smax(smax(d - gap - thick - lift, (t0 - t) * F.L, 0.003), (t - t1) * F.L, 0.003); };
}
/** A solid ellipsoid around c (radii r). */
const dome = (c, r) => (x, y, z) => (Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]) - 1) * Math.min(...r);

export function buildArmor(OPT, { P, J }) {
  const AR = { gap: 0.022, thick: 0.009, ...(OPT.outfit.armor ?? {}) };
  const pick = (...names) => names.flatMap((n) => [P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);
  const TH = OPT.body.thickness ?? {};

  // ── breastplate: slices of the torso (no arms) from the waist up to the chest; squarish ellipses (n 2.6), smoothed between slices ──
  const torso = blend(pick("chest", "bust", "belly", "pelvis", "trap"));
  const Y0 = 0.49, Y1 = 0.75, NS = 26, SL = [];
  for (let i = 0; i <= NS; i++) { const y = Y0 + (Y1 - Y0) * i / NS; SL.push(slice(torso, [0, y, 0.0], [1, 0, 0], [0, 0, 1], 24)); }
  for (const k of ["a", "b", "cv"]) { const v = SL.map((s) => s[k]); SL.forEach((s, i) => { s[k] = (v[Math.max(0, i - 1)] + 2 * v[i] + v[Math.min(NS, i + 1)]) / 4 + (k === "cv" ? 0 : 0.003); }); }   // smoothed (and a little out, to stay outside the bumps the smoothing shaved)
  const at = (y, k) => { const f = Math.min(NS, Math.max(0, (y - Y0) / (Y1 - Y0) * NS)), i = Math.min(NS - 1, Math.floor(f)), t = f - i; return SL[i][k] * (1 - t) + SL[i + 1][k] * t; };
  const arm = (s) => ({ a: J[`upperArm.${s}`], b: J[`lowerArm.${s}`], r: 0.047 * (TH.upperArm ?? 1) + 0.035 });
  const ARMS = [arm("L"), arm("R")];
  const capsule = (x, y, z, c) => { const ab = sub(c.b, c.a), ap = [x - c.a[0], y - c.a[1], z - c.a[2]], h = Math.max(-0.6, Math.min(1, dot(ap, ab) / dot(ab, ab))); return Math.hypot(ap[0] - ab[0] * h, ap[1] - ab[1] * h, ap[2] - ab[2] * h) - c.r; };
  const chestSdf = (x, y, z) => {
    const yc = Math.min(Y1, Math.max(Y0, y)), d = sell(x, z - at(yc, "cv"), at(yc, "a"), at(yc, "b"), 2.2) - 0.004 * Math.exp(-((x / 0.014) ** 2)) * (z > 0 ? 1 : 0);   // a low ridge down the middle of the front
    let s = d - AR.gap - AR.thick;
    s = smax(s, Y0 + 0.012 * (1 - (x / 0.2) ** 2) - y, 0.004);   // bottom edge: a little lower in the middle
    const w = sstep(-0.03, 0.03, z), u = Math.min(1, (x / 0.105) ** 2);   // the top edge: a U-neck, low in front and higher at the back, rising to the shoulders
    s = smax(s, y - ((0.682 + 0.075 * u) * w + (0.722 + 0.035 * u) * (1 - w)), 0.006);
    s = smax(s, y - (Y1 - 0.004), 0.004);
    s = smax(s, -Math.min(...ARMS.map((c) => capsule(x, y, z, c))), 0.008);   // armholes
    return s; };

  // ── pauldrons: a dome over each shoulder, the top-outer half (cut along the arm and toward the neck) ──
  const pauldron = (s) => { const m = s === "L" ? 1 : -1, a = J[`upperArm.${s}`], u = norm(sub(J[`lowerArm.${s}`], a));
    const out = norm([m * Math.abs(u[1]), Math.abs(u[0]), 0]);   // perpendicular to the arm, up and out
    const R = 0.047 * (TH.upperArm ?? 1) + AR.gap + AR.thick + 0.012, c = [a[0] + m * 0.008, a[1] + 0.004, a[2]], D = dome(c, [R * 1.08, R * 0.95, R * 1.1]);
    return (x, y, z) => { const p = [x - c[0], y - c[1], z - c[2]];
      let d = D(x, y, z);
      d = smax(d, dot(p, u) - 0.05, 0.012);   // down the arm: to 5 cm below the joint
      d = smax(d, -dot(p, out) - 0.02, 0.012);   // only the upper-outer side (not under the arm)
      d = smax(d, 0.06 - m * x, 0.012);   // not toward the neck
      const band = Math.abs(dot(p, u) - 0.012); if (band < 0.004) d += 0.0025 * (1 - band / 0.004);   // a groove: two plates (lames)
      return d; }; };
  const PA = [pauldron("L"), pauldron("R")], shoulderSdf = (x, y, z) => PA[x > 0 ? 0 : 1](x, y, z);

  // ── bracers: the forearm from just below the elbow to above the wrist ──
  const fore = blend(pick("foreArm", "foreBulge"));
  const BR = ["L", "R"].map((s) => guard(fore, J[`lowerArm.${s}`], J[`hand.${s}`], { t0: 0.1, t1: 0.86, gap: AR.gap * 0.55, thick: AR.thick * 0.8, flare: 0.006, n: 2.1 }));
  const armSdf = (x, y, z) => BR[x > 0 ? 0 : 1](x, y, z);

  // ── greaves: the shin from below the knee to above the shoe, and a knee cop over the front of the knee ──
  const shin = blend(pick("calf", "calfO", "calfB"));
  const GR = ["L", "R"].map((s) => { const k = J[`lowerLeg.${s}`], f = J[`foot.${s}`], t1 = (k[1] - (OPT.outfit.shoes.top + 0.022)) / (k[1] - f[1]);
    const g = guard(shin, k, f, { t0: 0.12, t1, gap: AR.gap * 0.5, thick: AR.thick * 0.9, rim0: 0, flare: 0.012, ridge: 0.008, n: 2.1 });
    const c = [k[0], k[1] + 0.008, k[2] + 0.04], D = dome(c, [0.068, 0.058, 0.066].map((v) => v * Math.max(1, TH.calf ?? 1)));
    const cop = (x, y, z) => smax(D(x, y, z), c[2] - 0.004 - z, 0.008);   // a cap on the front of the knee
    return (x, y, z) => Math.min(g(x, y, z), cop(x, y, z)); });
  const legSdf = (x, y, z) => GR[x > 0 ? 0 : 1](x, y, z);

  return { chestSdf, shoulderSdf, armSdf, legSdf };
}
