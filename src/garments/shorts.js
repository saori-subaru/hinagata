// Shorts under a skirt or a dress (outfit.shorts; for アステル's tunic over shorts): with a skirt or a dress the outfit's pants are the
// skirt itself, so nothing was worn under it. The pants' own shape (clothes/index.js legsSdf) with its own hem, a little looser toward
// the hem (flare: boxy legs). Base space, as the clothes are.
import { definePart } from "./registry.js";
import { sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("下にはく短パン", "Shorts under a skirt");

definePart({ src: import.meta.url,
  name: "shorts", path: "outfit.shorts", section: SEC, outline: 0.003,
  defaults: { on: false, color: "#5a4f7a", hem: 0.34, flare: 0 },
  schema: [
    ["on", L("下にはく短パン", "Shorts under a skirt"), { help: L("スカートやワンピースの下にはく短パン(チュニックの下、スパッツ)。着たときだけ作る", "shorts worn under a skirt or a dress (a tunic's, spats); built only when worn") }],
    ["color", L("短パンの色", "Shorts color"), { when: { ".on": true } }],
    ["hem", L("すその高さ", "Hem height"), { when: { ".on": true }, min: 0.2, max: 0.42, step: 0.005, help: L("伸ばす前の体で(脚の付け根 0.44、ひざ 0.25)", "on the body before it is stretched (the hip joints at 0.44, the knees at 0.25)") }],
    ["flare", L("すその広がり", "Flare"), { when: { ".on": true }, min: 0, max: 1, step: 0.02, help: L("すそへ向かって脚から離れる(箱形の短パン)", "the legs stand off the thighs toward the hem (boxy shorts)") }],
  ],
  build({ O, legsSdf, bodySdf }) {
    const HEM = O.hem ?? 0.34, FL = (O.flare ?? 0) * 0.03, core = legsSdf(HEM);
    // (not across the middle: the two legs would join)
    return { hem: HEM, sdf: (x, y, z, B = bodySdf) => core(x, y, z, B) - FL * sstep(0.44, HEM, y) * sstep(0.02, 0.07, Math.abs(x)) };
  },
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.3, st.hem - 0.03, -0.22], hi: [0.3, 0.56, 0.24], h: H, only: /^(hips|spine|upperLeg|lowerLeg)/ }),
});
