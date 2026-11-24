// A blouse's trims (for ずんだもん): puff sleeves with a frill (outfit.shirt.puff) and a flat round collar (outfit.shirt.roundCollar).
// Both are solids over the shirt, as the sailor collar is: their own parts, so a line shows where they lie on it. Base space, as the clothes are.
import { definePart } from "./registry.js";
import { smin, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k);

// ── puff sleeves: a ball of cloth round each upper arm from the armhole to a gather, and a short wavy frill past it. Wear them over a
// sleeveless shirt cut at the shoulder joints (shirt.sleeve "none" with shirt.armhole 0): a short sleeve is wider than the gather and came
// through it, and without armhole the sleeveless cut bares the shoulders' tops (on narrow shoulders up to the neck). A shape of revolution
// round the upper arm's line, its middle raised a little over the shoulder (a puff stands up there); behind the joint a ball over the
// shoulder's cap, up to the shirt's cut
definePart({ src: import.meta.url,
  name: "puff", path: "outfit.shirt.puff", group: "shirt", section: L("パフスリーブ", "Puff sleeves"), outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#f4f1ea", length: 0.09, radius: 0.06, cap: 0.05, gather: 0.038, rise: 0.006, frill: 0.02, frillOut: 0.016, waves: 8, wave: 0.004, line: null, lineWidth: 0.004 },
  schema: [
    ["on", L("パフスリーブ", "Puff sleeves"), { help: L("肩から二の腕の、ふくらんだ短い袖(先を絞ってフリル)。そでなしのシャツ(shirt.sleeve \"none\")の上に着る。着たときだけ作る", "short puffed sleeves from the shoulder, gathered with a frill; over a sleeveless shirt (shirt.sleeve \"none\"); built only when worn") }],
    ["color", L("パフスリーブの色", "Puff sleeves color"), { when: { ".on": true } }],
    ["length", L("長さ", "Length"), { when: { ".on": true }, min: 0.04, max: 0.14, step: 0.002, help: L("肩の関節から絞る所まで(m)", "from the shoulder joint to the gather (m)") }],
    ["radius", L("ふくらみ", "Puff"), { when: { ".on": true }, min: 0.04, max: 0.09, step: 0.001, help: L("いちばん太い所の半径(m)", "its radius where it is fullest (m)") }],
    ["cap", L("肩口の太さ", "At the armhole"), { when: { ".on": true }, min: 0.035, max: 0.08, step: 0.001, help: L("そでぐりの所の半径(m)。肩の丸みが隠れる太さに", "its radius at the armhole (m): enough to cover the shoulder's round") }],
    ["gather", L("絞りの太さ", "Gather"), { when: { ".on": true }, min: 0.025, max: 0.06, step: 0.001, help: L("絞った所の半径(m)", "its radius at the gather (m)") }],
    ["rise", L("肩の上の立ち上がり", "Rise over the shoulder"), { when: { ".on": true }, min: 0, max: 0.03, step: 0.001, help: L("m", "m") }],
    ["frill", L("フリルの長さ", "Frill length"), { when: { ".on": true }, min: 0, max: 0.05, step: 0.001, help: L("絞りから先(m)。0 = なし", "past the gather (m); 0 = none") }],
    ["frillOut", L("フリルの広がり", "Frill flare"), { when: { ".on": true }, min: 0, max: 0.04, step: 0.001, help: L("m", "m") }],
    ["waves", L("フリルの波の数", "Frill waves"), { when: { ".on": true }, min: 0, max: 16, step: 1 }],
    ["wave", L("フリルの波の深さ", "Frill wave depth"), { when: { ".on": true }, min: 0, max: 0.01, step: 0.0005, help: L("m", "m") }],
    ["line", L("線の色", "Line color"), { when: { ".on": true }, type: "color", nullable: true, help: L("null = 線なし。絞った所と、袖が身ごろに付く所に描く線", "null = none. A line at the gather and where the sleeve joins the shirt") }],
    ["lineWidth", L("線の太さ", "Line width"), { when: { ".on": true }, min: 0.001, max: 0.01, step: 0.0005, help: L("m", "m") }],
  ],
  build({ O, J, shirtSdf }) {
    const LEN = O.length ?? 0.09, R = O.radius ?? 0.06, R0 = O.cap ?? 0.05, RG = O.gather ?? 0.038, RISE = O.rise ?? 0.006, FR = O.frill ?? 0.02, FO = O.frillOut ?? 0.016, NW = Math.round(O.waves ?? 8), WV = O.wave ?? 0.004, SP = 0.45;   // SP: fullest that share of the way
    const arms = ["L", "R"].map((s) => { const a = J[`upperArm.${s}`], b = J[`lowerArm.${s}`], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d), u = d.map((v) => v / l);
      const e1 = [0, 0, 1], w0 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]], wl = Math.hypot(...w0), e2 = w0.map((v) => v / wl * (w0[1] < 0 ? -1 : 1));   // e2: across the arm, upward
      return { a, u, e1, e2, side: Math.sign(a[0]) }; });
    const one = (A, x, y, z) => { const q = [x - A.a[0], y - A.a[1], z - A.a[2]], t = q[0] * A.u[0] + q[1] * A.u[1] + q[2] * A.u[2], p1 = q[0] * A.e1[0] + q[1] * A.e1[1] + q[2] * A.e1[2], p2 = q[0] * A.e2[0] + q[1] * A.e2[1] + q[2] * A.e2[2];
      const s = Math.min(1, Math.max(0, t / LEN)), up = RISE * Math.sin(Math.PI * s), r = Math.hypot(p1, p2 - up);
      const rad = s < SP ? R0 + (R - R0) * Math.sin(Math.PI / 2 * s / SP) : RG + (R - RG) * Math.pow(Math.cos(Math.PI / 2 * (s - SP) / (1 - SP)), 0.8);
      let d = t < 0 ? Math.hypot(t, p1, p2) - R0 : Math.max((r - rad) * 0.85, t - LEN);   // the puff: from the armhole's size out to its fullest and in to the gather; behind the joint a ball
      if (FR > 0) { const f = Math.min(1, Math.max(0, (t - (LEN - 0.006)) / (FR + 0.006))), th = Math.atan2(p2, p1), rr = RG - 0.004 + FO * f + WV * f * Math.cos(NW * th);
        d = smin(d, Math.max(Math.hypot(p1, p2) - rr, t - (LEN + FR), LEN - 0.008 - t), 0.004); }   // the frill: a wavy flared ring past the gather
      return d; };
    // the lines: how far (m) a point is from the gather's ring or from where the sleeve goes into the shirt
    const lineAt = (x, y, z) => { const A = arms[x > 0 ? 0 : 1], t = (x - A.a[0]) * A.u[0] + (y - A.a[1]) * A.u[1] + (z - A.a[2]) * A.u[2]; return Math.min(Math.abs(t - LEN), Math.max(0, shirtSdf(x, y, z))); };
    return { arms, lineAt, sdf: (x, y, z) => one(arms[x > 0 ? 0 : 1], x, y, z), reach: Math.max(R + RISE, RG + FO + WV) + 0.02, len: LEN + FR + 0.02 };
  },
  bands: { keys: ["line", "lineWidth"], value: (st) => st.lineAt, ranges: (O) => O.line ? [[-1, (O.lineWidth ?? 0.004) / 2, O.line]] : [] },
  spec: (st, { H }) => { const lo = [9, 9, 9], hi = [-9, -9, -9];
    for (const A of st.arms) for (const t of [-0.06, st.len]) for (let k = 0; k < 3; k++) { const c = A.a[k] + A.u[k] * t; lo[k] = Math.min(lo[k], c - st.reach); hi[k] = Math.max(hi[k], c + st.reach); }
    return { sdf: st.sdf, lo, hi, h: Math.min(H * 0.7, 0.006), only: /^(upperArm|shoulder|upperChest)/ }; },
});

// ── a flat round collar (a Peter Pan collar): a band along the shirt's neckline, wide in front in two round lobes that meet at the
// neckline's middle, narrower over the shoulders and behind. Its outline is measured from the neckline's ring (how far from it, as built),
// not as a shape seen from above (the chest falls away steeply under the neck: an oval from above ended 2 cm under the neckline in front).
// Over the shirt it is the shirt pushed out a little; at the neck it is the neck pushed out less and goes a little over the shirt's
// neckline, so it stands close round the neck (the shirt alone ends 1.4 cm off the neck: a collar on it began outside the neck, a thin ring)
const TH = 0.005, NECK = 0.006, UP = 0.008;   // how far it stands off the shirt and off the neck; how far over the shirt's neckline it goes
definePart({ src: import.meta.url,
  name: "roundCollar", path: "outfit.shirt.roundCollar", group: "shirt", section: L("丸襟", "Round collar"), outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#f4f1ea", front: 0.045, side: 0.024, back: 0.03, lobe: 30, line: null, lineWidth: 0.004 },
  schema: [
    ["on", L("丸襟", "Round collar"), { help: L("シャツのえりぐりに沿った平たい丸い襟(前で左右に分かれる)。着たときだけ作る", "a flat round collar along the shirt's neckline, in two lobes parting in front; built only when worn") }],
    ["color", L("襟の色", "Collar color"), { when: { ".on": true } }],
    ["front", L("前の幅", "Width in front"), { when: { ".on": true }, min: 0.015, max: 0.09, step: 0.001, help: L("えりぐりから前の丸い先まで(m)", "from the neckline down to the lobes' ends (m)") }],
    ["side", L("肩の上の幅", "Width over the shoulders"), { when: { ".on": true }, min: 0.01, max: 0.07, step: 0.001, help: L("m", "m") }],
    ["back", L("後ろの幅", "Width behind"), { when: { ".on": true }, min: 0.01, max: 0.07, step: 0.001, help: L("m", "m") }],
    ["lobe", L("前の丸みの広さ", "Lobes' rounding"), { when: { ".on": true }, min: 10, max: 60, step: 1, help: L("前のまん中から、襟がいちばん広くなる所までの角度(度、首のまわり)", "the angle round the neck from the front's middle to where the collar is widest (degrees)") }],
    ["line", L("ふちの線の色", "Edge line color"), { when: { ".on": true }, type: "color", nullable: true, help: L("null = 線なし。白い服の上の白い襟は、ふちに線を描くと見える", "null = none. A white collar on a white shirt shows by a line along its edge") }],
    ["lineWidth", L("ふちの線の太さ", "Edge line width"), { when: { ".on": true }, min: 0.001, max: 0.01, step: 0.0005, help: L("m", "m") }],
  ],
  build({ O, J, shirtSdf, bodySdf, slope, necklineY }) {
    const WF = O.front ?? 0.045, WS = O.side ?? 0.024, WB = O.back ?? 0.03, T0 = (O.lobe ?? 30) * Math.PI / 180, ZN = J.neck[2] - 0.005, SL = slope(J.neck[1] + 0.06);
    // the neckline's ring: round the neck's line at each angle (0 = front), where the shirt's top edge is: going out from the neck's
    // middle just under the cut, where the shirt's outside is
    const NA = 48, ring = [];
    for (let i = 0; i <= NA; i++) { const a = i / NA * Math.PI, sx = Math.sin(a), cz = Math.cos(a); let r = 0.005, y = 0;
      for (; r < 0.14; r += 0.001) { y = necklineY(sx * r, J.neck[1] + 0.06, ZN + cz * r); if (shirtSdf(sx * r, y - 0.003, ZN + cz * r, bodySdf, true, true) >= 0) break; }
      ring.push([r, y]); }
    for (let pass = 0; pass < 2; pass++) { const R = ring.map((q) => [...q]); for (let i = 1; i < NA; i++) for (let k = 0; k < 2; k++) ring[i][k] = (R[i - 1][k] + 2 * R[i][k] + R[i + 1][k]) / 4; }
    // its width by the angle: nothing at the front's middle, out to the lobe's full width in a quarter round, then narrowing to the shoulders' and the back's
    const width = (a) => a < T0 ? WF * Math.sqrt(Math.max(0, 1 - (1 - a / T0) ** 2)) : a < Math.PI / 2 ? WS + (WF - WS) * (0.5 + 0.5 * Math.cos(Math.PI * (a - T0) / (Math.PI / 2 - T0))) : WB + (WS - WB) * (0.5 + 0.5 * Math.cos(Math.PI * (a - Math.PI / 2) / (Math.PI / 2)));
    const edge = (x, y, z) => { const dz = z - ZN, rho = Math.hypot(x, dz), a = Math.atan2(Math.abs(x), dz), f = a / Math.PI * NA, i = Math.min(NA - 1, Math.floor(f)), t = f - i;
      const rn = ring[i][0] + (ring[i + 1][0] - ring[i][0]) * t, yn = ring[i][1] + (ring[i + 1][1] - ring[i][1]) * t;
      return Math.hypot(rho - rn, (y - yn) * SL) - width(a); };   // < 0 inside its outline (m, as built)
    const top = (x, y, z) => y - (necklineY(x, y, z) + UP);   // > 0 over its top edge
    const solid = (x, y, z, B) => smin(B(x, y, z) - NECK, shirtSdf(x, y, z, B, true, true) - TH, 0.006);
    return { edge, sdf: (x, y, z, B = bodySdf) => Math.max(solid(x, y, z, B), edge(x, y, z), top(x, y, z)) };
  },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.16, 0.62, -0.14], hi: [0.16, 0.9, 0.16], h: Math.min(H * 0.7, 0.006), only: /^(spine|chest|upperChest|neck|shoulder)/ }),
  // the line along its outer edge: how far in from it (m, as built)
  bands: { keys: ["line", "lineWidth"], value: (st) => (x, y, z) => -st.edge(x, y, z), ranges: (O) => O.line ? [[-0.01, O.lineWidth ?? 0.004, O.line]] : [] },
});
