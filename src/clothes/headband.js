// A headband (outfit.headband; 2026-10-10, for 島風): a band over the hair from ear to ear, and on it a bow: "bunny" (two long loops
// standing up like a rabbit's ears, 島風's black ribbon) or none. Head space, as the hair and the animal ears are (it follows the head's
// size and shape); one mesh, one color.
// The band is the hair pushed out a little (a solid, as the socks are: only its outside shows, its cut sides go into the hair) and cut to a
// slab across the head; the hair's own shape is read only near the slab (it is the expensive part).
import { smin } from "../sdf/prim.js";

const smax = (a, b, k) => -smin(-a, -b, k);
const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The headband's distance (head space), or null. cap: the hair's own distance (head space, hair/index.js hairSdfOf) */
export function headbandSdf(OPT, cap) {
  const HB = OPT.outfit.headband; if (!HB?.on) return null;
  const SK = OPT.body.sculpt.skull, C0 = [0, SK.y, -0.005], D2R = Math.PI / 180;
  const th = (HB.tilt ?? 8) * D2R, n = [0, -Math.sin(th), Math.cos(th)], up = [0, Math.cos(th), Math.sin(th)];   // the band's plane: upright through the skull's middle, its top leaning forward by tilt
  const Z0 = HB.at ?? 0, W = HB.width ?? 0.026, T = HB.lift ?? 0.02, LOW = SK.y - (HB.down ?? 0.13);   // its place (forward of the middle), width, how far over the hair, how far down the sides
  const slab = (p) => Math.abs(dt([p[0] - C0[0], p[1] - C0[1], p[2] - C0[2]], n) - Z0) - W / 2;
  const capT = (x, y, z) => cap(x, y, z) - T;
  // where a direction in the band's plane meets the band's outside (from the skull's middle)
  const onBand = (d) => { const c = C0.map((v, i) => v + n[i] * Z0); let lo = 0, hi = 0.6; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (capT(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m) < 0) lo = m; else hi = m; } return c.map((v, i) => v + d[i] * lo); };
  const band = (x, y, z) => { const s = slab([x, y, z]); if (s > 0.02) return s; return smax(Math.max(s, LOW - y), capT(x, y, z), 0.004); };
  if ((HB.bow ?? "bunny") !== "bunny") return band;
  // the bunny bow: a knot on the band (bowAt: degrees from the top, + toward the character's left) and two loops standing up from it, each a
  // flat leaf (pointed toward its tip, its face a little turned, leaning back), one more upright than the other as 島風's are
  const S = HB.bowSize ?? 1, b = (HB.bowAt ?? -14) * D2R, kd = nrm(up.map((v, i) => v * Math.cos(b) + [1, 0, 0][i] * Math.sin(b))), K = onBand(kd).map((v, i) => v + kd[i] * 0.012 * S);
  const knot = (x, y, z) => { const q = [(x - K[0]) / 0.034, (y - K[1]) / 0.03, (z - K[2]) / 0.028], k = Math.hypot(...q); return (k - 1) * 0.028 * S; };
  const SP = HB.bowSpread ?? 14, TL = HB.bowTilt ?? 4;   // the loops at tilt ∓ spread from the knot's upright (島風's: one nearly flat out to her right, the other upright)
  const loops = [[TL - SP, 34], [TL + SP, -26]].map(([beta, twist]) => {
    const bb = beta * D2R + b, e = nrm([Math.sin(bb), Math.cos(bb), -0.18]), f0 = nrm([-e[0] * e[2], -e[1] * e[2], 1 - e[2] * e[2]]), tw = twist * D2R;   // e: along the loop; f0: its face, toward the front
    const sd = nrm(crs(e, f0)), f = nrm(f0.map((v, i) => v * Math.cos(tw) + sd[i] * Math.sin(tw))), s = nrm(crs(e, f));   // turned about e by twist
    const L = 0.34 * S * (HB.bowLength ?? 1), R = 0.07 * S, TH = 0.011 * S;
    return (x, y, z) => { const q = [x - K[0], y - K[1], z - K[2]], h = dt(q, e), t = Math.min(1, Math.max(0, h / L));
      const w = R * Math.max(0.1, (0.35 + 0.65 * Math.min(1, t / 0.2) ** 0.7) * (1 - 0.25 * t) * Math.sqrt(Math.max(0, 1 - t ** 8))), bend = 0.07 * L * t * t;   // narrow at the knot, wide most of the way, rounding off to its tip
      const qs = dt(q, s), qf = dt(q, f) + bend;
      return smax(smax((Math.hypot(qs / w, qf / TH) - 1) * Math.min(w, TH), h - L, 0.01), -h - 0.02 * S, 0.01); };   // (not past the knot behind: a loop leaning far out showed through on the other side)
  });
  const bow = (x, y, z) => { if (Math.hypot(x - K[0], y - K[1], z - K[2]) > 0.45 * S * (HB.bowLength ?? 1)) return 0.1; return smin(knot(x, y, z), Math.min(loops[0](x, y, z), loops[1](x, y, z)), 0.02 * S); };
  return (x, y, z) => smin(band(x, y, z), bow(x, y, z), 0.012);
}
