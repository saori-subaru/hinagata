// Turned-back cuffs (outfit.cuffs; for アステル's tunic): a wider band of cloth round the end of each long or bell sleeve, standing out
// of it (shirt.cuffColor only paints a band on the sleeve). A sheet (sdf/sheet.js) over the sleeve's own end (clothes/index.js sleeveEnd):
// open at the hand as the sleeve is, following a bell's slanted opening. It rides on the forearm alone. Base space, as the clothes are.
import { definePart } from "./registry.js";
import { sheetsMesh } from "../sdf/sheet.js";

const L = (ja, en) => ({ ja, en }), SEC = L("折り返しの袖口", "Turned-back cuffs");

definePart({ src: import.meta.url,
  name: "cuffs", path: "outfit.cuffs", group: "shirt", section: SEC, outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#f4f1ea", width: 0.06, out: 0.008, flare: 0.3 },
  schema: [
    ["on", L("折り返しの袖口", "Turned-back cuffs"), { when: { "outfit.shirt.sleeve": ["long", "bell"] }, help: L("長袖・ベル袖の先を包む、袖より太い折り返し。着たときだけ作る", "a band wider than the sleeve round the end of a long or bell sleeve; built only when worn") }],
    ["color", L("袖口の色", "Cuffs color"), { when: { ".on": true } }],
    ["width", L("幅", "Width"), { when: { ".on": true }, min: 0.02, max: 0.14, step: 0.002, help: L("袖の先から上へ(m、伸ばす前の体で)", "up the sleeve from its end (m, on the body before it is stretched)") }],
    ["out", L("袖からの浮き", "Standing out"), { when: { ".on": true }, min: 0.002, max: 0.03, step: 0.001, help: L("袖の外側からどれだけ離すか(m)", "how far out of the sleeve it stands (m)") }],
    ["flare", L("先の広がり", "Flare"), { when: { ".on": true }, min: 0, max: 1, step: 0.02, help: L("手の側ほど太くする", "wider toward the hand") }],
  ],
  // how far it stands out of the forearm's end, a bell sleeve's opening under it too (a cape's cloth keeps off it: index.js)
  wrist: (O, OPT) => (OPT.outfit.shirt.sleeve === "bell" ? 0.006 + 1.3 * (OPT.outfit.shirt.bell ?? 0.06) + Math.max(0, (OPT.outfit.shirt.sleeveWidth ?? 0) - 0.042) : 0) + (O.out ?? 0.008) + 0.012 + (O.flare ?? 0.3) * 0.03,   // (sleeveWidth: past the bell's own 4.2 cm)
  build({ O, sleeveEnd }) {
    const W = O.width ?? 0.06, OUT = O.out ?? 0.008, FL = (O.flare ?? 0.3) * 0.03, TK = 0.012;
    const sheets = ["L", "R"].map((s) => sleeveEnd(s, OUT + FL + 0.02)).filter(Boolean).map((E) => ({ lo: E.lo, hi: E.hi, tk: TK,
      o: (x, y, z) => E.out(x, y, z) - OUT - TK - FL * Math.min(1, Math.max(0, 1 - E.up(x, y, z) / W)),   // its inner side OUT off the sleeve, wider toward the hand
      cut: (x, y, z) => { const u = E.up(x, y, z); return Math.max(u - W, -0.006 - u); } }));   // from W up the sleeve to 6 mm past its end
    if (!sheets.length) return null;
    const lo = [0, 1, 2].map((k) => Math.min(...sheets.map((q) => q.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...sheets.map((q) => q.hi[k])));
    return { sheets, lo, hi };
  },
  spec: (st, { H }) => ({ make: () => sheetsMesh(st.sheets, st.lo, st.hi, Math.min(H * 0.6, 0.008)), sdf: () => 1, lo: st.lo, hi: st.hi, h: H, only: /^lowerArm/ }),
});
