// Trims (2026-10-10, Saori: "hinagataを使って島風を極力完璧に再現して…足りないパーツは作り足して"): small garments over the clothes
// and the body, each its own mesh, as signed distances in base space (before body.proportion stretches the body), as the clothes are:
//   sailor collar (outfit.shirt.sailor): a flat collar lying over the shirt: a square flap down the back, over the shoulders, and two
//     lapels meeting in a V on the chest. Its line along the outer edge is painted (sailorLine: index.js reads it per vertex)
//   scarf (outfit.shirt.scarf): a sailor scarf: along the V's edges under the lapels, a knot at the V's point and two tails hanging from it
//   gloves (outfit.gloves): over the hands and the arms up to gloves.length; a cuff band at the top (gloveBand, painted)
//   hip strings (outfit.strings): thin strings round the hips, rising high at the sides (a high-cut underwear's, showing over a low skirt)
// A trim is the garment under it (or the body) pushed out a few mm and cut to its region, a solid as the socks are: its cut edges are its
// only sides, so it needs no cells finer than its own size (a shell 5 mm thick would need 2 mm cells all over)
import { smin, sstep, blend } from "../sdf/prim.js";
import { makeStretch } from "../body/index.js";

const smax = (a, b, k) => -smin(-a, -b, k);

export function buildTrims(OPT, { P, J, bodySdf, shirtSdf }) {
  const O = OPT.outfit, SA = O.shirt?.sailor ?? {}, SC = O.shirt?.scarf ?? {}, GL = O.gloves ?? {}, HS = O.strings ?? {};
  const ST = makeStretch(OPT, J), sy = (y) => ST.slope(y);   // the torso's stretch there: a height in base space is this many times longer when built
  // ── the sailor collar ──
  // its outline on the body, by u = |x| and the height y (base): the back flap (behind the shoulders' line) is a rectangle to width W and
  // down to back; in front the lapels' outer edges run from the shoulders (W at the shoulder's top, TOPY) to the V's point (0, v), and their
  // inner edges (the V's opening) from the neck to a little above it, so the lapels meet at the point
  const W = SA.width ?? 0.085, BACK = SA.back ?? 0.655, VY = SA.v ?? 0.665, TOPY = J["upperArm.L"][1], NECK = J.neck, ZS = NECK[2] - 0.012;   // ZS: front / back split (the shoulders' line)
  const a = W / Math.max(0.02, TOPY - VY), na = Math.hypot(1, a / sy(VY));   // the outer edge: u = a (y - v); its distance measured in the built (stretched) body
  const VI = VY + 0.012, ai = 0.04 / Math.max(0.02, NECK[1] - VI), ni = Math.hypot(1, ai / sy(VI));   // the inner edge: u = ai (y - VI), 4 cm wide at the neck
  const outerFront = (u, y) => Math.max((u - a * (y - VY)) / na, u - W);
  const innerV = (u, y) => (ai * (y - VI) - u) / ni;   // > 0 in the V's opening
  const sailorEdge = (x, y, z) => { const u = Math.abs(x); return z < ZS ? Math.max(u - W, (BACK - y) * sy(BACK)) : outerFront(u, y); };   // the outer edge (< 0 inside): the line follows it
  const sailorRegion = (x, y, z) => { const u = Math.abs(x), e = sailorEdge(x, y, z); return z < ZS ? e : smax(e, innerV(u, y), 0.004); };
  const TH = 0.005;   // how far it stands off the shirt
  const sailorSdf = SA.on ? (x, y, z, B = bodySdf) => Math.max(shirtSdf(x, y, z, B, true) - TH, sailorRegion(x, y, z)) : null;
  // for the line (painted: index.js cuts a band SA.lineIn from the outer edge, SA.lineWidth wide): how far in from the outer edge (m, as built)
  const sailorIn = (x, y, z) => -sailorEdge(x, y, z);

  // ── the scarf ──
  // the shirt's front surface (z) along the middle, by height: where the knot sits and the tails hang from
  const frontZ = (x, y) => { let lo = -0.05, hi = 0.3; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (shirtSdf(x, y, m, bodySdf, true) < 0) lo = m; else hi = m; } return lo; };
  let scarfSdf = null;
  if (SC.on) {
    const LEN = SC.length ?? 0.1, KY = VY - 0.004, kz = frontZ(0, KY) + TH + 0.006, WS = 0.013;
    // the band along the V's edges, a little under the lapels, standing off the shirt less than the collar does (so the collar lies over it)
    const band = (x, y, z, B) => { const g = innerV(Math.abs(x), y); return Math.max(shirtSdf(x, y, z, B, true) - TH * 0.7, -g - 0.003, g - WS, ZS + 0.02 - z, KY - 0.01 - y); };
    // two tails hanging from under the knot, flat, a little apart and slanting out, widening toward their ends; each hangs straight down
    // from the furthest forward the shirt reaches above it (it doesn't follow the chest's curve in)
    const NY = 40, Y0 = KY - 0.008, Y1 = KY - LEN, zAt = new Float32Array(NY + 1);
    { let m = kz - 0.004; for (let i = 0; i <= NY; i++) { const y = Y0 + (Y1 - Y0) * i / NY; m = Math.max(m, frontZ(0.015 + 0.01 * i / NY, y) + 0.008); zAt[i] = m; } }
    const tail = (x, y, z) => { const t = Math.min(1, Math.max(0, (Y0 - y) / (Y0 - Y1))), cx = 0.006 + 0.014 * t, hw = 0.011 + 0.006 * t, i = Math.min(NY - 1, Math.floor(t * NY)), f = t * NY - i, cz = zAt[i] * (1 - f) + zAt[i + 1] * f;
      const u = Math.abs(x), cut = (Y1 + 0.012 * Math.abs(u - cx) / hw) - y;   // the end cut in a shallow V (its middle longer)
      return smax(Math.max(Math.abs(u - cx) - hw, Math.abs(z - cz) - 0.004), Math.max(y - Y0, cut), 0.002); };
    const knot = (x, y, z) => { const q = [x / 0.019, (y - KY) / 0.016, (z - kz) / 0.012], k = Math.hypot(...q); return (k - 1) * 0.012; };
    scarfSdf = (x, y, z, B = bodySdf) => smin(Math.min(band(x, y, z, B), tail(x, y, z)), knot(x, y, z), 0.006);
    scarfSdf.box = { lo: [-0.11, Y1 - 0.02, ZS], hi: [0.11, NECK[1] + 0.03, kz + 0.06] };
  }

  // ── gloves ──
  // the arm's own parts (not the torso: a hand by the hip would have pulled the glove onto it) pushed out, cut across the arm at the top:
  // length 0 = at the wrist, 1 = at the elbow, 2 = at the shoulder. The band at the top stands out a little more
  let gloveSdf = null, gloveBand = null;
  if (GL.on) {
    const LEN = GL.length ?? 1, BW = GL.bandWidth ?? 0.022, OFF = 0.0025;
    const arms = ["L", "R"].map((s) => {
      const parts = Object.keys(P).filter((k) => k.endsWith(`.${s}`) && /^(upperArm|foreArm|foreBulge|palm|finger\d|fingerTip\d|thumb)\./.test(k)).map((k) => P[k]), f = blend(parts);
      const A = J[`upperArm.${s}`], E = J[`lowerArm.${s}`], Wr = J[`hand.${s}`], seg = LEN <= 1 ? [Wr, E, LEN] : [E, A, LEN - 1];
      const c = seg[0].map((v, i) => v + (seg[1][i] - v) * seg[2]), d0 = seg[0].map((v, i) => v - seg[1][i]), l = Math.hypot(...d0), d = d0.map((v) => v / l);   // the top's middle; d: along the arm toward the hand
      const along = (x, y, z) => (x - c[0]) * d[0] + (y - c[1]) * d[1] + (z - c[2]) * d[2];   // > 0 toward the hand
      return { f, along, side: s === "L" ? 1 : -1 };
    });
    const armOf = (x) => arms[x >= 0 ? 0 : 1];
    gloveBand = (x, y, z) => armOf(x).along(x, y, z);   // how far down from the top (m): the band is painted by it (index.js)
    const raised = BW > 0 && (GL.bandColor || GL.lineColor);
    gloveSdf = (x, y, z) => { const A = armOf(x), t = A.along(x, y, z), band = raised ? 0.0025 * sstep(BW + 0.002, BW - 0.002, t) : 0;
      return Math.max(A.f(x, y, z) - OFF - band, -t); };
  }

  // ── hip strings ──
  // a thin flat strap lying on the body round the hips: low at the front and the back (in the middle, under a skirt), rising to rise above the
  // hip joints at the sides. Made as a ribbon along a path on the body's surface, not cut out of a distance: a band a few mm tall is finer
  // than the cells, and came out in dashes (2026-10-10)
  let stringsMesh = null;
  if (HS.on) {
    const HIP = J["upperLeg.L"][1], LOW = HIP - 0.01, TOP = HIP + (HS.rise ?? 0.05), SPAN = HS.span ?? 1, ZC = -0.01;
    // h(angle): front (0) low, the sides (±90°) at the top, the back low again; span narrows the rise toward the sides (1: a smooth arch)
    const h = (th) => LOW + (TOP - LOW) * Math.sin(Math.abs(th) % Math.PI) ** (2 / SPAN);
    stringsMesh = () => {
      const N = 200, K = 8, RB = (HS.width ?? 0.006) / 2 / sy(TOP), RN = 0.0011, LIFT = 0.0018, P = [], Nn = [];   // RB: half its width (base: heights are stretched); RN: half its thickness
      const grad = (p) => { const e = 0.0007, g = [0, 1, 2].map((i) => { const a = [...p], b = [...p]; a[i] += e; b[i] -= e; return bodySdf(...a) - bodySdf(...b); }), l = Math.hypot(...g) || 1; return g.map((v) => v / l); };
      for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2 - Math.PI, y = h(th), d = [Math.sin(th), 0, Math.cos(th)];
        let lo = 0, hi = 0.3; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (bodySdf(d[0] * m, y, ZC + d[2] * m) < 0) lo = m; else hi = m; }   // the first way out from the middle (not the arm hanging beside)
        const p = [d[0] * lo, y, ZC + d[2] * lo]; P.push(p); Nn.push(grad(p)); }
      const pos = [], nor = [], idx = [];
      for (let i = 0; i < N; i++) { const a = P[(i + N - 1) % N], b = P[(i + 1) % N], t0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = Nn[i];
        const tl = Math.hypot(...t0), t = t0.map((v) => v / tl), w0 = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]], wl = Math.hypot(...w0), w = w0.map((v) => v / wl);   // w: across the strap, on the surface
        for (let k = 0; k < K; k++) { const f = k / K * Math.PI * 2, c = Math.cos(f), s = Math.sin(f);
          for (let q = 0; q < 3; q++) { pos.push(P[i][q] + n[q] * (LIFT + RN + RN * c) + w[q] * RB * s); }
          const nn = [0, 1, 2].map((q) => n[q] * c / RN + w[q] * s / RB), nl = Math.hypot(...nn); nor.push(...nn.map((v) => v / nl)); } }
      for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = ((i + 1) % N) * K + k, d = ((i + 1) % N) * K + (k + 1) % K; idx.push(a, c, b, b, c, d); }
      return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint32Array(idx) }; };
  }
  return { sailorSdf, sailorIn, scarfSdf, gloveSdf, gloveBand, stringsMesh };
}
