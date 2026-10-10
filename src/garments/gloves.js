// Gloves (outfit.gloves; 2026-10-10, for 島風): over the hands and the arms up to length, a cuff band at the top (painted, and standing out a
// little when it has a color). The arm's own parts (not the torso: a hand by the hip would have pulled the glove onto it) pushed out, cut
// across the arm at the top. Base space, as the clothes are.
import { definePart } from "./registry.js";
import { sstep, blend } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("手袋", "Gloves");

definePart({ src: import.meta.url,
  name: "gloves", path: "outfit.gloves", section: SEC, outline: 0.003,
  defaults: { on: false, color: "#ffffff", length: 1, bandColor: null, lineColor: null, bandWidth: 0.022 },
  schema: [
    ["on", L("手袋", "Gloves"), { help: L("着たときだけ作る", "built only when worn") }],
    ["color", L("手袋の色", "Gloves color"), { when: { ".on": true } }],
    ["length", L("手袋の長さ", "Gloves length"), { when: { ".on": true }, min: 0, max: 1.9, step: 0.02, help: L("0 = 手首まで / 1 = ひじまで / 2 = 肩まで", "0 = to the wrist / 1 = to the elbow / 2 = to the shoulder") }],
    ["bandColor", L("口の帯の色", "Cuff band color"), { when: { ".on": true }, nullable: true, help: L("null = 帯なし(はき口の帯の色)", "null = none (a band round the top)") }],
    ["lineColor", L("帯の線の色", "Cuff line color"), { when: { ".on": true }, nullable: true, help: L("null = 線なし(帯のまん中の線の色)", "null = none (a line along the band's middle)") }],
    ["bandWidth", L("帯の幅", "Cuff band width"), { when: { ".on": true }, min: 0.005, max: 0.06, step: 0.001, help: L("m", "m") }],
  ],
  // length 0 = at the wrist, 1 = at the elbow, 2 = at the shoulder
  build({ O: GL, P, J }) {
    const LEN = GL.length ?? 1, BW = GL.bandWidth ?? 0.022, OFF = 0.0025;
    const arms = ["L", "R"].map((s) => {
      const parts = Object.keys(P).filter((k) => k.endsWith(`.${s}`) && /^(upperArm|foreArm|foreBulge|palm|finger\d|fingerTip\d|thumb)\./.test(k)).map((k) => P[k]), f = blend(parts);
      const A = J[`upperArm.${s}`], E = J[`lowerArm.${s}`], Wr = J[`hand.${s}`], seg = LEN <= 1 ? [Wr, E, LEN] : [E, A, LEN - 1];
      const c = seg[0].map((v, i) => v + (seg[1][i] - v) * seg[2]), d0 = seg[0].map((v, i) => v - seg[1][i]), l = Math.hypot(...d0), d = d0.map((v) => v / l);   // the top's middle; d: along the arm toward the hand
      const along = (x, y, z) => (x - c[0]) * d[0] + (y - c[1]) * d[1] + (z - c[2]) * d[2];   // > 0 toward the hand
      return { f, along };
    });
    const armOf = (x) => arms[x >= 0 ? 0 : 1];
    const raised = BW > 0 && (GL.bandColor || GL.lineColor);   // the band stands out a little more
    return { armOf, sdf: (x, y, z) => { const A = armOf(x), t = A.along(x, y, z), band = raised ? 0.0025 * sstep(BW + 0.002, BW - 0.002, t) : 0;
      return Math.max(A.f(x, y, z) - OFF - band, -t); } };
  },
  spec: (st, { H, ax, ay }) => ({ sdf: st.sdf, lo: [-0.47 - ax, 0.3 - ay, -0.16], hi: [0.47 + ax, 0.8, 0.16], h: H * 0.7, only: /^(upperArm|lowerArm|hand|fingers|fingerTips|thumb)/ }),
  // the cuff band and the line along its middle, by how far down from the top (m)
  bands: { keys: ["bandColor", "lineColor"], value: (st) => (x, y, z) => st.armOf(x).along(x, y, z),
    ranges: (O) => { const BW = O.bandWidth ?? 0.022; return [...(O.bandColor ? [[-1, BW, O.bandColor]] : []), ...(O.lineColor ? [[BW * 0.4, BW * 0.6, O.lineColor]] : [])]; } },
});
