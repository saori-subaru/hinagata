// Extras (outfit.extras; 2026-10-07, Saori: "追加したい汎用性の高そうなアイテム: 獣耳、獣尻尾、天使の輪、天使の羽、悪魔の羽、悪魔尻尾"):
//   ears ("cat" | "fox" | "bunny" | "bear"): on top of the head, coming out of the hair, a lighter inner side (its own mesh). Head space,
//     so they follow the head's size and shape (as the hair).
//   wings ("angel" | "devil"): on the upper back, flat. Angel: a row of feathers hanging from the wing's arm, longer toward the tip.
//     Devil: a bat's wing, the membrane between finger bones, scalloped between their tips.
//   The tails (cat, fox, devil) swing: they are locks (hair/locks.js, made in index.js: tailSpecs); the halo is a ring over the head (index.js).
import { smin, sstep } from "../sdf/prim.js";

const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smax = (a, b, k) => -smin(-a, -b, k);

// the ears' kinds: length, base half-width (across), flat (front-back / across), angle from the top (degrees), lean back (degrees), prof (radius along the ear, 0 base → 1 tip)
const EARS = {
  cat: { L: 0.15, R: 0.072, flat: 0.34, angle: 40, back: 6, prof: (t) => 1 - t },
  fox: { L: 0.2, R: 0.075, flat: 0.32, angle: 36, back: 8, prof: (t) => Math.pow(1 - t, 0.9) },
  bunny: { L: 0.32, R: 0.046, flat: 0.32, angle: 16, back: 12, prof: (t) => Math.sqrt(Math.max(0, 1 - Math.pow(t, 3))) * (0.75 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.4))) },
  bear: { L: 0.095, R: 0.062, flat: 0.45, angle: 48, back: 4, prof: (t) => Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * 1.1 + (t < 0.5 ? 0.1 : 0) },
};

export function buildExtras(OPT) {
  const X = OPT.outfit.extras ?? {}, SK = OPT.body.sculpt.skull, C0 = [0, SK.y, -0.005], RS = [SK.width, SK.height, SK.depth];
  // ── ears: a flat cone (an ear's own profile) from inside the hair out, its face to the front; inner: the same smaller, a little forward ──
  let earSdf = null, earInSdf = null;
  const EK = EARS[X.ears];
  if (EK) {
    const ears = [1, -1].map((m) => {
      const a = EK.angle * Math.PI / 180, bk = EK.back * Math.PI / 180, d = nrm([m * Math.sin(a), Math.cos(a), 0]);   // out from the skull's middle
      const r = 1 / Math.hypot(d[0] / RS[0], d[1] / RS[1], d[2] / RS[2]), base = C0.map((c, i) => c + d[i] * (r - 0.004));   // on the skull (inside the hair)
      const u = nrm([d[0] * 0.85, d[1], -Math.sin(bk)]), f0 = [0, 0, 1], s = nrm(crs(u, f0)), f = crs(s, u);   // u: along the ear; s: across; f: its face (front)
      const L = EK.L + 0.03, shape = (k, off) => (x, y, z) => {   // k: size, off: forward
        const q = [x - base[0] - f[0] * off, y - base[1] - f[1] * off, z - base[2] - f[2] * off], h = dt(q, u), t = Math.min(1, Math.max(0, h / (L * k)));
        const R = Math.max(0.002, EK.R * k * EK.prof(t)), qs = dt(q, s), qf = dt(q, f);
        return smax((Math.hypot(qs / R, qf / (R * EK.flat)) - 1) * R * EK.flat, h - L * k, 0.006); };
      const outer = shape(1, 0), inner = shape(0.66, EK.R * EK.flat * 0.55);
      return { outer, inner: (x, y, z) => smax(inner(x, y, z), -(dt([x - base[0], y - base[1], z - base[2]], u) - 0.03), 0.004) };   // the inner side from above the hair
    });
    earSdf = (x, y, z) => ears[x > 0 ? 0 : 1].outer(x, y, z);
    earInSdf = (x, y, z) => ears[x > 0 ? 0 : 1].inner(x, y, z);
  }
  // ── wings: a 2D shape in a plane out from the upper back (out, a little up and back), with thickness ──
  let wingSdf = null;
  if (X.wings === "angel" || X.wings === "devil") {
    const angel = X.wings === "angel", S = X.wingSize ?? 1;
    const W = [1, -1].map((m) => {
      const root = [m * 0.045, 0.7, -0.075], U = nrm([m, 0.12, -0.55]), V0 = [0, 1, 0], V = nrm(V0.map((c, i) => c - dt(V0, U) * U[i])), N = crs(U, V).map((c) => c * m);   // (N mirrored with the side, so both bend back)   // U: out along the wing, V: up in its plane, N: through it
      const seg = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, h = Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - vx * h, py - ay - vy * h); };
      const sc = (p) => p.map((c) => c * S);
      let shape2;
      if (angel) {   // the arm (the top edge) arcs out and up; feathers hang from it, the outer ones longer and further out
        const arm = (t) => sc([0.36 * t, 0.12 * Math.sin(Math.PI * 0.8 * t) + 0.06 * t]), F = [];
        for (let i = 0; i < 9; i++) { const t = 0.12 + 0.88 * i / 8, a = arm(t), len = (0.1 + 0.2 * t) * S, ang = -Math.PI / 2 + 0.95 * t;   // pointing down, turning outward toward the tip
          F.push({ a, b: [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len], w: (0.032 + 0.01 * t) * S }); }
        shape2 = (u, v) => { let d = 1e9; for (let i = 0; i < 24; i++) { const p = arm(i / 23), q = arm((i + 1) / 23); d = Math.min(d, seg(u, v, p[0], p[1], q[0], q[1]) - 0.032 * S); }
          for (const f of F) { const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), tx = (f.b[0] - f.a[0]) / L, ty = (f.b[1] - f.a[1]) / L, pu = (u - f.a[0]) * tx + (v - f.a[1]) * ty, pv = -(u - f.a[0]) * ty + (v - f.a[1]) * tx;
            const tt = Math.min(1, Math.max(0, pu / L)), r = f.w * Math.sqrt(Math.max(0, 1 - Math.pow(2 * tt - 1, 2))) + 0.004;   // a long oval, pointed at both ends
            d = smin(d, Math.hypot(pu - tt * L, pv) - r, 0.008); }
          return d; };
      } else {   // bat: the arm to the wrist, four fingers from it; the membrane between them, cut in arcs between the tips
        const Wr = sc([0.15, 0.13]), T = [sc([0.4, 0.27]), sc([0.43, 0.06]), sc([0.33, -0.11]), sc([0.14, -0.17])], O = [0, -0.04 * S];
        const poly = [O, [0, 0.03 * S], Wr, ...T];   // the membrane's outline (convex enough), then scallops off the edges between tips
        const inPoly = (u, v) => { let d = 1e9, sgn = 1; for (let i = 0; i < poly.length; i++) { const A = poly[i], B = poly[(i + 1) % poly.length];
          d = Math.min(d, seg(u, v, A[0], A[1], B[0], B[1])); if ((A[1] > v) !== (B[1] > v) && u < A[0] + (v - A[1]) * (B[0] - A[0]) / (B[1] - A[1])) sgn = -sgn; } return sgn * d; };   // < 0 inside (an odd number of crossings)
        shape2 = (u, v) => { let d = inPoly(u, v);
          for (let i = 0; i + 1 < T.length; i++) { const A = T[i], B = T[i + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, L = Math.hypot(B[0] - A[0], B[1] - A[1]), nx = -(B[1] - A[1]) / L, ny = (B[0] - A[0]) / L;   // out of the membrane
            const c = [mx + nx * L * 0.42, my + ny * L * 0.42]; d = Math.max(d, -(Math.hypot(u - c[0], v - c[1]) - L * 0.62)); }   // a bite out between two tips
          { const A = T.at(-1), c = [(A[0] + O[0]) / 2 - 0.02 * S, (A[1] + O[1]) / 2 - 0.08 * S]; d = Math.max(d, -(Math.hypot(u - c[0], v - c[1]) - 0.1 * S)); }   // and between the last and the body
          let b = seg(u, v, O[0], O[1] + 0.03 * S, Wr[0], Wr[1]) - 0.016 * S; for (const t of T) b = Math.min(b, seg(u, v, Wr[0], Wr[1], t[0], t[1]) - 0.008 * S);   // the bones
          return Math.min(d, b); };
      }
      const TH = angel ? 0.012 : 0.008;   // half thickness
      return (x, y, z) => { const q = [x - root[0], y - root[1], z - root[2]], u = dt(q, U), v = dt(q, V), w = dt(q, N), bend = (angel ? 0.04 : 0.03) * u * u / 0.1;   // curved back a little toward the tip
        const d2 = shape2(u, v), dw = Math.abs(w + bend) - TH * (1 - 0.4 * sstep(0.1 * S, 0.4 * S, u)); return d2 > 0 ? Math.hypot(d2, Math.max(0, dw)) : Math.max(d2, dw); };
    });
    wingSdf = (x, y, z) => W[x > 0 ? 0 : 1](x, y, z);
  }
  return { earSdf, earInSdf, wingSdf };
}

/** The tail as one lock (hair/locks.js createLocks), root space (rest): from the back of the hips. kind "cat" (up, curling) / "fox" (full,
 *  hanging out behind) / "devil" (a thin whip ending in a pointed spade). hips: the hips joint, back: how far back the bottom is there (m). */
export function tailSpec(kind, { hips, back, size = 1 }) {
  const root = [hips[0], hips[1] - 0.02, hips[2] - back + 0.012], N = 14, S = size;
  const B = { cat: [[0, -0.04, -0.1], [0, 0.12, -0.26], [0, 0.32, -0.2]], fox: [[0, -0.08, -0.14], [0, -0.18, -0.3], [0, -0.22, -0.42]], devil: [[0, -0.12, -0.1], [0, -0.26, -0.3], [0, -0.12, -0.42]] }[kind];
  if (!B) return null;
  const P = [root, ...B.map((o) => root.map((c, i) => c + o[i] * S))], pts = [];
  for (let q = 0; q < N; q++) { const t = q / (N - 1), m = 1 - t; pts.push([0, 1, 2].map((k) => m * m * m * P[0][k] + 3 * m * m * t * P[1][k] + 3 * m * t * t * P[2][k] + t * t * t * P[3][k])); }
  let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(...[0, 1, 2].map((k) => pts[q][k] - pts[q - 1][k]));
  // prof: its width along it (0 root → 1 tip, × w); the devil's: thin, then a spade (an arrowhead: wide at its base, pointed)
  const prof = { cat: (t) => 0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (t < 0.6 ? 1 : 1) - (t > 0.88 ? (t - 0.88) / 0.12 * 0.7 : 0),
    fox: (t) => (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85))) * (t > 0.8 ? 1 - Math.pow((t - 0.8) / 0.2, 2) * 0.95 : 1),
    devil: (t) => t < 0.8 ? 0.28 - 0.08 * t : t < 0.87 ? 0.22 + (t - 0.8) / 0.07 * 1.0 : Math.max(0.02, 1.22 * (1 - (t - 0.87) / 0.13)) }[kind];
  const w = { cat: 0.05, fox: 0.13, devil: 0.06 }[kind] * S, thick = { cat: 0.95, fox: 0.85, devil: 0.45 }[kind];
  return { root, pts, len, w, thick, layer: 0, curl: 0, rise: false, stiff: kind === "cat" ? 1.6 : 1, prof };
}
