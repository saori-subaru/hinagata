// Detached sleeves (outfit.armSleeves; 2026-10-11, for 初音ミク: "足りないパーツがあれば足してください"): sleeves worn on their own over
// bare arms, from the upper arm down past the wrist, close on the upper arm and widening from the elbow into an open bell the hand comes
// out of. The upper part is the arm's own pieces pushed out (as the gloves are); from the elbow down a thin cone round the forearm, open at
// the bottom. A band at the top and one round the bottom edge (painted). Base space, as the clothes are.
import { definePart } from "./registry.js";
import { smin, blend } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("付け袖", "Detached sleeves"), smax = (a, b, k) => -smin(-a, -b, k);
const OFF = 0.004, TH = 0.0032;   // how far the upper part stands off the arm; half the bell's cloth

definePart({ src: import.meta.url,
  name: "armSleeves", path: "outfit.armSleeves", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#25262b", length: 1.4, flare: 0.08, reach: 0.3, slant: 0, bandColor: null, band: 0.012, topColor: null, topBand: 0.008 },
  schema: [
    ["on", L("付け袖", "Detached sleeves"), { help: L("腕だけにはく袖。ひじから下が広がって手首の先まで。着たときだけ作る", "sleeves on their own over bare arms, widening from the elbow past the wrist; built only when worn") }],
    ["color", L("付け袖の色", "Sleeves color"), { when: { ".on": true } }],
    ["length", L("上の端", "Top"), { when: { ".on": true }, min: 1, max: 1.9, step: 0.02, help: L("1 = ひじ / 2 = 肩(手袋の長さと同じ)", "1 = the elbow / 2 = the shoulder (as the gloves' length)") }],
    ["flare", L("袖口の広がり", "Flare"), { when: { ".on": true }, min: 0.04, max: 0.16, step: 0.002, help: L("袖口の半径(腕の芯から m)", "the opening's radius (m from the arm's middle line)") }],
    ["reach", L("手首より先", "Past the wrist"), { when: { ".on": true }, min: 0, max: 0.8, step: 0.02, help: L("手首から袖口まで(前腕の長さに対して)", "from the wrist to the opening (for the forearm's length)") }],
    ["slant", L("袖口の傾き", "Opening's slant"), { when: { ".on": true }, min: -0.1, max: 0.1, step: 0.002, help: L("外側がどれだけ長く垂れるか(m)。マイナスで内側が長い", "how much further the outer side hangs (m); below 0 the inner side") }],
    ["bandColor", L("袖口の帯の色", "Opening band color"), { when: { ".on": true }, nullable: true, help: L("null = 帯なし", "null = none") }],
    ["band", L("袖口の帯の幅", "Opening band width"), { when: { ".on": true }, min: 0.003, max: 0.04, step: 0.001, help: L("m", "m") }],
    ["topColor", L("上の帯の色", "Top band color"), { when: { ".on": true }, nullable: true, help: L("null = 帯なし", "null = none") }],
    ["topBand", L("上の帯の幅", "Top band width"), { when: { ".on": true }, min: 0.003, max: 0.04, step: 0.001, help: L("m", "m") }],
  ],
  build({ O: SL, P, J, bodySdf }) {
    const LEN = SL.length ?? 1.4, R1 = SL.flare ?? 0.08, REACH = SL.reach ?? 0.3, SLANT = SL.slant ?? 0;
    const arms = ["L", "R"].map((s) => {
      const f = blend(Object.keys(P).filter((k) => k.endsWith(`.${s}`) && /^(upperArm|foreArm|foreBulge)\./.test(k)).map((k) => P[k]));
      const A = J[`upperArm.${s}`], E = J[`lowerArm.${s}`], W = J[`hand.${s}`];
      const du0 = E.map((v, i) => v - A[i]), Lu = Math.hypot(...du0), du = du0.map((v) => v / Lu);   // down the upper arm
      const df0 = W.map((v, i) => v - E[i]), Lf = Math.hypot(...df0), df = df0.map((v) => v / Lf);   // down the forearm
      const top = A.map((v, i) => v + du[i] * Lu * (2 - LEN)), Lt = Lu * (LEN - 1);   // the top's middle; Lt: from it to the elbow
      const Tb = Lf * (1 + REACH), R0 = Math.max(0.02, -bodySdf(...E.map((v, i) => v + df[i] * Lf * 0.3))) + OFF;   // the bottom (along the forearm from the elbow); R0: the arm's radius a third down the forearm
      const rAt = (t) => R0 + (R1 - R0) * Math.pow(Math.min(1, Math.max(0, t / Tb)), 1.4);
      // the outer side, across the forearm: away from the body once the arm hangs (in the rest pose the arm is out and down: up and out)
      const ox0 = s === "L" ? [-df[1], df[0], 0] : [df[1], -df[0], 0], ol = Math.hypot(...ox0) || 1, ox = ox0.map((v) => v / ol);
      const side = (x, y, z, t) => { const px = x - E[0] - t * df[0], py = y - E[1] - t * df[1], pz = z - E[2] - t * df[2]; return (px * ox[0] + py * ox[1] + pz * ox[2]) / Math.max(0.01, Math.hypot(px, py, pz)); };   // -1 inner .. 1 outer
      const bottom = (x, y, z, t) => Tb + SLANT * side(x, y, z, t);   // where the opening is, along the forearm
      const tf = (x, y, z) => (x - E[0]) * df[0] + (y - E[1]) * df[1] + (z - E[2]) * df[2];
      // how far along the sleeve from its top (m): down the upper arm, then on down the forearm from the elbow
      const along = (x, y, z) => { const t = tf(x, y, z); return t >= 0 ? Lt + t + (SLANT ? (Tb - bottom(x, y, z, t)) * Math.min(1, t / Tb) : 0) : (x - top[0]) * du[0] + (y - top[1]) * du[1] + (z - top[2]) * du[2]; };
      const cone = (x, y, z) => { const t = tf(x, y, z), px = x - E[0] - t * df[0], py = y - E[1] - t * df[1], pz = z - E[2] - t * df[2], o = (Math.hypot(px, py, pz) - rAt(t)) * 0.92;
        return Math.max(Math.abs(o) - TH, t - bottom(x, y, z, t), -t); };
      const solid = (x, y, z) => Math.max(f(x, y, z) - OFF, -((x - top[0]) * du[0] + (y - top[1]) * du[1] + (z - top[2]) * du[2]), tf(x, y, z) - Lf * 0.3);
      return { sdf: (x, y, z) => smin(solid(x, y, z), cone(x, y, z), 0.006), along, total: Lt + Tb };
    });
    const armOf = (x) => arms[x >= 0 ? 0 : 1];
    return { armOf, total: arms[0].total, sdf: (x, y, z) => armOf(x).sdf(x, y, z) };
  },
  spec: (st, { H, ax, ay }) => ({ sdf: st.sdf, lo: [-0.5 - ax, 0.25 - ay, -0.2], hi: [0.5 + ax, 0.8, 0.2], h: Math.min(H * 0.6, 0.003), only: /^(upperArm|lowerArm)/ }),
  // the bands: by how far along the sleeve from its top; the bottom's band ends at the sleeve's whole length
  bands: { keys: ["bandColor", "band", "topColor", "topBand"], value: (st) => (x, y, z) => st.armOf(x).along(x, y, z),
    ranges: (O, st) => [...(O.topColor ? [[-1, O.topBand ?? 0.008, O.topColor]] : []), ...(O.bandColor && st ? [[st.total - (O.band ?? 0.012), st.total + 1, O.bandColor]] : [])] },
});
