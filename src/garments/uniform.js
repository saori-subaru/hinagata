// Uniform pieces for the town's crowd: a peaked cap (police, postmen, station staff, a schoolboy) and a kesa (the monk's sash across the robe).
import { definePart } from "./registry.js";
import { smin, sstep } from "../sdf/prim.js";

const L = (ja, en) => ({ ja, en }), smax = (a, b, k) => -smin(-a, -b, k);

// The cap: head space over the hair, as the headband is (headband.js): the hair pushed out by lift and cut to a crown between a band line round
// the forehead (lower in front by tilt) and a flat top; the crown flares out toward its top (flare: a police cap's; 0 = a schoolboy's), a
// visor (brim) in front at the band line, sloping down
function capSdf(OPT, O, cap) {
  const SK = OPT.body.sculpt.skull, T = O.lift ?? 0.012, capT = (x, y, z) => cap(x, y, z) - T;
  const yb0 = SK.y + (O.band ?? 0.03), tilt = O.tilt ?? 0.25, yb = (z) => yb0 - tilt * z;
  const along = (c, d) => { let lo = 0, hi = 0.6; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (capT(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m) < 0) lo = m; else hi = m; } return lo; };
  const top = SK.y + along([0, SK.y, -0.01], [0, 1, 0]) - (O.flat ?? 0.02), H = top - yb0, FL = O.flare ?? 0.02;
  // the crown's front just over the band: from ahead of the face inward until the cap (inside out, a bisection stopped in the head where no
  // bangs cover the forehead, and the visor was buried there)
  let zf = 0; for (let k = 0; k < 5; k++) { const y = yb(0.2) + 0.015 * k; for (let z = 0.45; z > 0; z -= 0.003) if (capT(0, y, z) < 0) { zf = Math.max(zf, z); break; } }
  const VW = O.visor ?? 0.07;   // the visor's reach
  const crown = (x, y, z) => { const b = yb(z); if (y < b - 0.03) return b - y; return Math.max(capT(x, y, z) - FL * sstep(b + 0.2 * H, top, y), b - y, y - top); };
  // the visor: half an ellipse ahead of the band's front, sloping down by droop per m out; 16 mm thick in head space (5 mm on an adult's
  // small head: thinner, it fell between the cells and was lost)
  const visor = (x, y, z) => { if (z < zf - 0.06) return 1; const dz = z - (zf - 0.04), e = Math.hypot(x / (0.13 + FL), Math.max(0, dz) / (VW + 0.04)) - 1, yv = yb(zf) - 0.008 - (O.droop ?? 0.35) * Math.max(0, z - zf);
    return Math.max(e * 0.06, Math.abs(y - yv) - 0.008, zf - 0.04 - z); };
  return (x, y, z) => smin(crown(x, y, z), visor(x, y, z), 0.004);
}

definePart({ src: import.meta.url,
  name: "cap", path: "outfit.cap", section: L("帽子", "Cap"), outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#1f2840", lift: 0.02, band: 0.045, tilt: 0.1, flat: 0.03, flare: 0.03, visor: 0.1, droop: 0.3 },
  schema: [
    ["on", L("帽子(制帽)", "Peaked cap"), { help: L("髪の上にかぶるつば付きの帽子。警官・郵便局員・駅員・学生帽。着たときだけ作る", "a cap with a visor over the hair: police, postmen, station staff, a schoolboy's. Built only when worn") }],
    ["color", L("帽子の色", "Cap color"), { when: { ".on": true } }],
    ["lift", L("髪からの浮き", "Off the hair"), { when: { ".on": true }, min: 0, max: 0.04, step: 0.001 }],
    ["band", L("かぶる深さ", "Band height"), { when: { ".on": true }, min: -0.05, max: 0.1, step: 0.002, help: L("額のまわりの縁の高さ(頭の真ん中から m)。小さいほど深い", "the rim round the forehead (m from the skull's middle); less sits deeper") }],
    ["tilt", L("前下がり", "Tilt forward"), { when: { ".on": true }, min: -0.3, max: 0.8, step: 0.01, help: L("縁が前で下がる傾き", "how much lower the rim is in front") }],
    ["flat", L("てっぺんの平ら", "Flat top"), { when: { ".on": true }, min: 0, max: 0.08, step: 0.001, help: L("髪のてっぺんからどれだけ下で平らに切るか(m)", "how far under the hair's top it is cut flat (m)") }],
    ["flare", L("上の広がり", "Crown flare"), { when: { ".on": true }, min: 0, max: 0.05, step: 0.001, help: L("上へ向かって広がる量(m)。警官の帽子は大きく、学生帽は0", "how far the crown widens toward its top (m): a police cap's more, a schoolboy's 0") }],
    ["visor", L("つばの長さ", "Visor"), { when: { ".on": true }, min: 0, max: 0.2, step: 0.001, help: L("m。0 = なし", "m; 0 = none") }],
    ["droop", L("つばの下がり", "Visor droop"), { when: { ".on": true }, min: 0, max: 1, step: 0.01 }],
  ],
  build: ({ OPT, O }) => ({ OPT, O }),
  spec: (st, { H, kit, hairCap }) => ({ sdf: kit.HT.wrap(capSdf(st.OPT, st.O, hairCap())), lo: [-0.4, 0.95, -0.34], hi: [0.4, 1.8, 0.4], h: Math.min(H * 0.6, 0.004), bone1: "head" }),
});

// The kesa: a band over the robe (the shirt, or a dress's top) from the left shoulder across the chest and the back down to the right hip,
// standing off it a few mm (a trim, as the sailor collar is)
definePart({ src: import.meta.url,
  name: "kesa", path: "outfit.shirt.kesa", group: "shirt", section: L("袈裟", "Kesa"), outline: 0.003, thin: "cloth",
  defaults: { on: false, color: "#8a6a2c", width: 0.06 },
  schema: [
    ["on", L("袈裟", "Kesa"), { help: L("左肩から右の腰へ斜めにかける帯(お坊さんの法衣)。着たときだけ作る", "a band from the left shoulder across to the right hip (a monk's robe); built only when worn") }],
    ["color", L("袈裟の色", "Kesa color"), { when: { ".on": true } }],
    ["width", L("袈裟の幅", "Kesa width"), { when: { ".on": true }, min: 0.02, max: 0.12, step: 0.001, help: L("半分の幅(m)", "half its width (m)") }],
  ],
  build({ O, J, shirtSdf, bodySdf }) {
    const a = [J["upperArm.L"][0] - 0.04, J["upperArm.L"][1] + 0.03], b = [-0.12, J["upperLeg.L"][1] + 0.02], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy), W = O.width ?? 0.06;
    const strip = (x, y) => Math.abs((x - a[0]) * dy - (y - a[1]) * dx) / n - W;   // the distance from the line (front and back alike)
    return { sdf: (x, y, z, B = bodySdf) => Math.max(shirtSdf(x, y, z, B, true, true) - 0.006, strip(x, y), b[1] - 0.03 - y, Math.abs(x) - 0.2) };   // (not out along a sleeve)
  },
  spec: (st, { H, B, ax }) => ({ sdf: st.sdf, fast: (x, y, z) => st.sdf(x, y, z, B), lo: [-0.3 - ax, 0.38, -0.25], hi: [0.3 + ax, 0.86, 0.3], h: Math.min(H, 0.008), only: /^(hips|spine|chest|upperChest|shoulder)/ }),
});
