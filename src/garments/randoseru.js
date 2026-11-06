// A randoseru (a Japanese school satchel): a hard box on the back and two shoulder straps (for the town's children). Made as the plate
// armor is (clothes/plate.js): solid shapes fitted once to the body, not cloth following it. Base space; heights from the joints (J).
import { definePart } from "./registry.js";
import { smin, sstep } from "../sdf/prim.js";

const darker = (c) => { const h = c.length === 4 ? c.slice(1).split("").map((d) => d + d).join("") : c.slice(1, 7);   // ("#222" too)
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.78).toString(16).padStart(2, "0")).join(""); };
const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k), SEC = L("ランドセル", "Randoseru");
// a box with rounded edges: c center, h half sizes, r the rounding
const rbox = (x, y, z, c, h, r) => { const q = [Math.abs(x - c[0]) - h[0] + r, Math.abs(y - c[1]) - h[1] + r, Math.abs(z - c[2]) - h[2] + r];
  return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r; };
const seg = (p, a, b, r) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1], p[2] - a[2] - t * d[2]) - r; };

definePart({ src: import.meta.url,
  name: "randoseru", path: "outfit.randoseru", section: SEC, outline: 0.004, thin: "keep",
  defaults: { on: false, color: "#b3262c", lid: null, clasp: "#d8c27a", width: 0.125, height: 0.75, depth: 0.09, strap: 0.017 },
  schema: [
    ["on", L("ランドセル", "Randoseru"), { help: L("背中に固い箱と2本の肩ベルト。着たときだけ作る", "a hard box on the back with two shoulder straps; built only when worn") }],
    ["color", L("ランドセルの色", "Color"), { when: { ".on": true } }],
    ["lid", L("ふたの色", "Lid color"), { when: { ".on": true }, nullable: true, help: L("箱の上と背中側をおおうふた。null = 本体の色を少し暗く", "the flap over the top and the outer face; null = the body's color, a little darker") }],
    ["clasp", L("留め金の色", "Clasp color"), { when: { ".on": true }, nullable: true, help: L("null = なし", "null = none") }],
    ["width", L("箱の幅", "Box width"), { when: { ".on": true }, min: 0.06, max: 0.18, step: 0.001, help: L("真ん中から横まで(m)", "half its width (m)") }],
    ["height", L("箱の高さ", "Box height"), { when: { ".on": true }, min: 0.3, max: 1, step: 0.01, help: L("肩から脚の付け根までを1とした割合", "as a share of the shoulder to the hip joint") }],
    ["depth", L("箱の厚み", "Box depth"), { when: { ".on": true }, min: 0.04, max: 0.14, step: 0.001, help: L("m", "m") }],
    ["strap", L("ベルトの幅", "Strap width"), { when: { ".on": true }, min: 0.008, max: 0.03, step: 0.001, help: L("半分の幅(m)", "half its width (m)") }],
  ],
  build({ O, J, bodySdf }) {
    const yS = J["upperArm.L"][1], yH = J["upperLeg.L"][1], top = yS + 0.01, bot = top - (O.height ?? 0.6) * (yS - yH), W = O.width ?? 0.105, D = O.depth ?? 0.08;
    // the back's surface (z) at x, y: from behind until the body
    const backAt = (x, y) => { let z = -0.4; while (z < 0.2 && bodySdf(x, y, z) > 0) z += 0.002; return z; };
    const zB = Math.min(...[top - 0.02, (top + bot) / 2, bot + 0.02].map((y) => backAt(0, y))) - 0.012, C = [0, (top + bot) / 2, zB - D / 2], HB = [W, (top - bot) / 2, D / 2];
    const box = (x, y, z) => rbox(x, y, z, C, HB, 0.022);
    // the lid: over the top and down the outer face to 70 % of the way; a thin slab standing 3 mm off the box, its lower edge rounded
    const lidY = top - 0.7 * (top - bot);
    const lid = (x, y, z) => Math.max(rbox(x, y, z, C, [HB[0] + 0.003, HB[1] + 0.003, HB[2] + 0.003], 0.024), Math.max(lidY - y, z - (C[2] + 0.01)));
    // the straps: from the box's top over each shoulder, down the chest to under the arm, and back round the side to the box's lower corner.
    // Points on the body's surface pushed out 1.6 cm (over a shirt), a flat band (strap half wide) between them
    const out = (x, y, z, n) => { const p = [x, y, z]; let r = 0; while (r < 0.3 && bodySdf(p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r) < 0.016) r += 0.002; return [p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r]; };
    const SW = O.strap ?? 0.017, ST = 0.004, straps = [1, -1].map((m) => { const xs = m * 0.075, yA = J["upperArm.L"][1] - 0.075;
      const pts = [[xs, top - 0.02, C[2] + HB[2] - 0.01], out(xs, yS + 0.04, -0.02, [0, 1, 0]), out(xs, yS - 0.01, 0.0, [0, 0.4, 0.9]), out(xs, yA, 0, [0, 0, 1]),
        out(m * 0.13, yA - 0.03, -0.02, [m, 0, 0]), [m * (W - 0.02), bot + 0.04, C[2] + HB[2] - 0.01]];
      return pts; });
    // flat: SW wide along the path, ST thick off the body's surface (the body's distance tells which way is off)
    const strap = (x, y, z) => { let m = 1; for (const pts of straps) for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, seg([x, y, z], pts[i], pts[i + 1], 0));
      if (m > SW + 0.02) return m - SW; return Math.max(m - SW, Math.abs(bodySdf(x, y, z) - 0.016 + ST) - ST); };
    const clasp = (x, y, z) => { const q = [x / 0.018, (y - lidY - 0.004) / 0.012, (z - (C[2] - HB[2] - 0.004)) / 0.008]; return (Math.hypot(...q) - 1) * 0.008; };
    const sdf = (x, y, z) => Math.min(smin(box(x, y, z), lid(x, y, z), 0.002), strap(x, y, z), clasp(x, y, z));
    // the colors: the lid (by where it is: above lidY on the outer face or the top), the clasp
    const tone = (x, y, z) => clasp(x, y, z) < 0.002 ? 2 : lid(x, y, z) < 0.0015 && (y > lidY + 0.002) ? 1 : 0;
    return { sdf, tone, lo: [-0.2, bot - 0.03, C[2] - HB[2] - 0.03], hi: [0.2, yS + 0.08, 0.16] };
  },
  spec: (st, { H }) => ({ sdf: st.sdf, lo: st.lo, hi: st.hi, h: Math.min(H * 0.7, 0.006), only: /^(chest|upperChest)/ }),
  bands: { keys: ["lid", "clasp"], value: (st) => st.tone, ranges: (O) => [[0.5, 1.5, O.lid ?? darker(O.color ?? "#b3262c")], ...(O.clasp ? [[1.5, 2.5, O.clasp]] : [])] },
});
