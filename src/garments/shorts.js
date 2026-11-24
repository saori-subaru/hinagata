// Shorts under a skirt or a dress (outfit.shorts; for アステル's tunic over shorts): with a skirt or a dress the outfit's pants are the
// skirt itself, so nothing was worn under it. The pants' own shape (clothes/index.js legsSdf) with its own hem, a little looser toward
// the hem (flare: boxy legs). Base space, as the clothes are.
import { definePart } from "./registry.js";
import { sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), SEC = L("下にはく短パン", "Shorts under a skirt");

definePart({ src: import.meta.url,
  name: "shorts", path: "outfit.shorts", section: SEC, outline: 0.003,
  defaults: { on: false, color: "#5a4f7a", hem: 0.34, flare: 0, top: null, shade: null, shadeFrom: 0.44, notch: null, notchWidth: 0.025 },
  schema: [
    ["on", L("下にはく短パン", "Shorts under a skirt"), { help: L("スカートやワンピースの下にはく短パン(チュニックの下、スパッツ)。着たときだけ作る", "shorts worn under a skirt or a dress (a tunic's, spats); built only when worn") }],
    ["color", L("短パンの色", "Shorts color"), { when: { ".on": true } }],
    ["hem", L("すその高さ", "Hem height"), { when: { ".on": true }, min: 0.2, max: 0.42, step: 0.005, help: L("伸ばす前の体で(脚の付け根 0.44、ひざ 0.25)", "on the body before it is stretched (the hip joints at 0.44, the knees at 0.25)") }],
    ["top", L("上端の高さ", "Top"), { when: { ".on": true }, nullable: true, min: 0.44, max: 0.6, step: 0.002, help: L("伸ばす前の体で(後ろ上がりはズボンと同じ)。null = ズボンの上端。ワンピースの切れ目より上に置くと、切れ目の奥は短パンだけが見える", "on the body before it is stretched (rising at the back as the pants do); null = the pants' top. Over a dress's slits only the shorts show through them") }],
    ["shade", L("服の中の影の色", "Shade under the skirt"), { type: "color", when: { ".on": true }, nullable: true, help: L("上の服の中に入っている所の色(影)。スカートの切れ目からのぞく所が暗く見える。null = なし", "the color of the part inside the skirt (its shade): seen through a skirt's slits it reads dark; null = none") }],
    ["shadeFrom", L("影の始まり", "Shade from"), { when: { ".on": true, ".shade": "*set" }, min: 0.3, max: 0.6, step: 0.002, help: L("ここより上が影の色(伸ばす前の体で)。上の服のすそに合わせる", "over this height the shade's color (on the body before it is stretched); at the skirt's hem") }],
    ["flare", L("すその広がり", "Flare"), { when: { ".on": true }, min: 0, max: 1, step: 0.02, help: L("すそへ向かって脚から離れる(箱形の短パン)", "the legs stand off the thighs toward the hem (boxy shorts)") }],
    ["notch", L("股の切れ込み", "Crotch notch"), { when: { ".on": true }, nullable: true, min: 0, max: 0.1, step: 0.002, help: L("前のまん中を、すそからこの高さまで切り上げる(m、伸ばす前の体で)。後ろは体の股まで。体の股より上は下に着た物(タイツ: socks.top を上げる)が見える。null = 広げた短パンは 1.8 cm、広げないものはなし", "how far up the middle the hem is cut at the front (m, on the body before it is stretched); at the back up to the body's crotch. Over the body's crotch what is worn under shows (tights: socks.top up). null = 1.8 cm on flared shorts, none on others") }],
    ["notchWidth", L("切れ込みの幅", "Notch width"), { when: { ".on": true }, min: 0.01, max: 0.05, step: 0.001, help: L("すそでの片側の幅(m)。上へ向かって細くなる", "its half-width at the hem (m), narrowing upward") }],
  ],
  build({ O, legsSdf, bodySdf }) {
    const HEM = O.hem ?? 0.34, FL = (O.flare ?? 0) * 0.03, UP = O.top ?? undefined, core = legsSdf(-1, undefined, UP);
    // the notch: the hem raised up the middle, NF at the front and NB behind, up to the body's crotch (higher, a slit up the back read as the
    // bottom split; lower, the back showed through the front's cut as a ledge across it). Its sides a smoothstep NW across, narrowing to a
    // rounded top; normalized by its slope (as steep as 4: the mesh's cells read the value as a distance)
    const CR = (() => { let y = HEM; while (y < HEM + 0.12 && bodySdf(0, y, -0.01) > 0) y += 0.001; return y; })();   // the body's crotch in the middle
    const NB = O.notch == null ? (FL ? 0.018 : 0) : Math.min(O.notch, Math.max(0.018, CR - HEM - 0.003)), NF = O.notch ?? NB, NW = O.notchWidth ?? 0.025;
    const notch = !NF ? () => -1 : (x, y, z) => { const ax = Math.abs(x), h = NB + (NF - NB) * sstep(-0.03, 0.03, z), t = Math.min(1, ax / NW), sl = h * 6 * t * (1 - t) / NW;
      return (HEM + h * (1 - sstep(0, NW, ax)) - y) / Math.hypot(1, sl); };
    if (!FL) return { hem: HEM, top: UP, sdf: NF ? (x, y, z, B = bodySdf) => Math.max(legsSdf(HEM, undefined, UP)(x, y, z, B), notch(x, y, z)) : legsSdf(HEM, undefined, UP) };
    // flared, the legs pushed out all round meet between the thighs: there a groove down the middle and the hem notched up, so they read
    // as two legs pressed together (cut apart, the slit showed the background; flared only outward, the middle hung as one curtain)
    const TOP = 0.41;
    return { hem: HEM, top: UP, sdf: (x, y, z, B = bodySdf) => { const ax = Math.abs(x), m = 1 - sstep(0, 0.012, ax);
      return Math.max(core(x, y, z, B) - FL * sstep(0.44, HEM, y) + 0.006 * m * sstep(TOP, TOP - 0.03, y), HEM - y, notch(x, y, z)); } };
  },
  bands: { keys: ["shade", "shadeFrom"], value: () => (x, y) => y, ranges: (O) => O.shade ? [[O.shadeFrom ?? 0.44, 9, O.shade]] : [] },   // (base heights)
  spec: (st, { H, B }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.3, st.hem - 0.03, -0.22], hi: [0.3, Math.max(0.56, (st.top ?? 0) + 0.04), 0.24], h: H, only: /^(hips|spine|upperLeg|lowerLeg)/ }),
});
