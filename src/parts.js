// Which mesh is built from which shape: its box, cell size and bones. One table for the main thread (index.js) and the
// build workers (worker.js) — both read it, so a part built in a worker is exactly the part the main thread would build.
//   name: "body" | "shirt" | "pants" | "shoes" | "soles" | "socks" | "hair:<pick as JSON>"
//   kit:  { bodySdf, HT, hairKit, clothes } (from buildBody / buildHair / buildClothes)
//   bodyAt: a fast lookup of the body (read back from the body's grid), or null to read the body itself

import { skirtOf } from "./options.js";
import { armReach } from "./body/index.js";
export const ARMOR = ["armorChest", "armorShoulders", "armorArms", "armorLegs", "armorHelm", "armorVisor", "armorDeco", "armorHands", "armorFeet", "armorMail", "armorWaist"];   // the armor's pieces (one mesh each; helm to mail only in full plate, the waist's plates only in light armor with armor.tassets)
export const WEAPONS = ["weaponR", "weaponRGrip", "weaponL", "weaponLFace", "weaponLGrip"];   // in the hands: metal, grip / straps, the shield's face
export const CLOTHES = ["shirt", "pants", "shoes", "soles", "laces", "socks", "cape", ...ARMOR, ...WEAPONS];
export const hairPartName = (pick) => "hair:" + JSON.stringify(pick);
// a skirt or a cape is a shell under 2 cm thick: meshed with cells about as big (the game quality's), it came out ragged, holed, with its
// inside's outline showing through in specks (2026-10-05, Saori: "ゲーム用の表示にするとスカートとかマントがジャギジャギ"). Their cells stop here
const THIN = 0.0105;
export const partClothCell = (H) => Math.min(H * 1.2, THIN);   // a skirt's or a cape's cell at the mesh cell H

export function partSpec(name, { OPT, H, clothH = 0, kit, bodyAt = null }) {   // clothH: the skirt's and the cape's cell, if set (the game quality: see index.js)
  const { bodySdf, HT, hairKit, clothes: C } = kit, B = bodyAt || bodySdf, foot0 = [-0.22, -0.01, -0.12];
  const { x: ax, y: ay } = armReach(OPT);   // longer arms, wider shoulders, bigger hands (body.proportion) reach further: the boxes around the arms grow by it
  switch (name) {
    case "body": return { sdf: bodySdf, lo: [-0.47 - ax, -0.02, -0.3], hi: [0.47 + ax, 1.43, 0.34], h: H };
    case "shirt": { const SL = OPT.outfit.shirt.sleeve, long = SL === "long" || SL === "bell", w = (SL === "bell" ? 0.42 + (OPT.outfit.shirt.bell ?? 0.06) : long ? 0.37 : 0.3) + ax;   // long sleeves reach the wrists (and follow the forearms)
      const soft = C.bellOf ? { bone: (x) => x > 0 ? "lowerArm.L" : "lowerArm.R", k: (x, y, z) => C.bellOf(x, y, z, B) ? 0 : 1 } : null;   // bell sleeves: all on the forearm
      return { sdf: C.shirtSdf, fast: (x, y, z) => C.shirtSdf(x, y, z, B), soft, lo: [-w, 0.33 - (long ? ay : 0), -0.2], hi: [w, 0.86, 0.22], h: H * OPT.quality.shirtCell, only: long ? /^(hips|spine|chest|upperChest|shoulder|neck|upperArm|lowerArm)/ : /^(hips|spine|chest|upperChest|shoulder|neck|upperArm)/ }; }
    case "pants": { const PT = OPT.outfit.pants;
      const SKO = skirtOf(OPT);
      if (SKO) { const SK = SKO, hem = SK.hem ?? 0.3, top = SK.top ?? PT.top, w = 0.17 + (SK.flare ?? 0.4) * (top - hem) + 0.04;
        // longer legs (body.proportion.legs) stretch the skirt below the hips too: what stays on the hips then hung that much deeper, under the
        // thighs when they turned up, and the cloth crumpled pulling it over them (2026-10-05, Saori: a dress sitting, tall body). The share
        // left on the hips shrinks as the legs grow
        const FOL = 1 - (1 - (SK.follow ?? 0.55)) / Math.max(1, OPT.body.proportion?.legs ?? 1);   // the skirt follows the hips, and the thighs only partly toward the hem (soft), so it swings with the legs without being torn apart between them
        return { sdf: C.pantsSdf, fast: (x, y, z) => C.pantsSdf(x, y, z, B), lo: [-w, hem - 0.02, -w], hi: [w, top + 0.05, w], h: clothH || partClothCell(H), only: /^(hips|upperLeg)/, soft: { bone: "hips", front: (z) => Math.min(1, Math.max(0, (z + 0.02) / 0.1)), k: (x, y) => FOL * Math.min(1, Math.max(0, (top - 0.04 - y) / (top - 0.04 - hem))) } }; }
      const y0 = { knee: 0.17, long: 0.07 }[PT.length] ?? 0.2;   // long pants reach the ankles
      return { sdf: C.pantsSdf, fast: (x, y, z) => C.pantsSdf(x, y, z, B), lo: [-0.28, y0, -0.2], hi: [0.28, 0.55, 0.22], h: H * 1.2, only: /^(hips|spine|upperLeg|lowerLeg)/ }; }
    case "cape": { const CA = OPT.outfit.cape;   // only built when worn (outfit.cape.on rebuilds the clothes)
      if (!C.capeSdf) return { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, bone1: "hips" };
      const w = 0.3 + CA.flare * 0.6, d = 0.2 + CA.flare * 0.7;
      return { sdf: C.capeSdf, fast: (x, y, z) => C.capeSdf(x, y, z, B), lo: [-w, CA.hem - 0.02, -d], hi: [w, CA.collar + 0.05, CA.wrap + 0.1], h: clothH || partClothCell(H), only: /^(hips|spine|chest|upperChest|neck|shoulder)/ }; }
    case "shoes": { const k = OPT.outfit.shoes.kind; return { sdf: C.shoeSdf, lo: k === "heels" ? [foot0[0], -0.06, foot0[2]] : foot0, hi: [0.22, k === "boots" ? OPT.outfit.shoes.bootHeight + 0.04 : 0.13, 0.14], h: H * 0.7, only: /^(foot|lowerLeg)/ }; }   // heels: the heel reaches below the floor in the rest pose (the foot tilts it up)
    case "laces": return C.lacesSdf ? { sdf: C.lacesSdf, lo: [-0.2, 0.0, -0.03], hi: [0.2, 0.11, 0.1], h: Math.min(H * 0.4, 0.0024), bone1: null, only: /^foot/ }   // thin: their own fine grid
      : { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, bone1: "hips" };
    case "soles": return { sdf: C.soleSdf, lo: foot0, hi: [0.22, 0.03, 0.14], h: H * 0.6, only: /^foot/ };
    // armor: hard pieces (clothes/armor.js). Each moves with as few bones as it can (the bracers and greaves are rigid on one bone)
    case "armorChest": return C.armor.helmSdf ? { sdf: C.armor.chestSdf, lo: [-0.3, 0.38, -0.26], hi: [0.3, 0.82, 0.28], h: H * 0.8, only: /^(hips|spine|chest|upperChest)/ }
      : { sdf: C.armor.chestSdf, lo: [-0.26, 0.47, -0.22], hi: [0.26, 0.76, 0.26], h: H * 0.8, only: /^(spine|chest|upperChest)/ };
    case "armorShoulders": return { sdf: C.armor.shoulderSdf, lo: [-0.3 - ax, 0.6, -0.16], hi: [0.3 + ax, 0.88, 0.16], h: H * 0.8, only: /^(shoulder|upperArm)/ };
    case "armorArms": return C.armor.helmSdf ? { sdf: C.armor.armSdf, lo: [-0.4 - ax, 0.42 - ay, -0.12], hi: [0.4 + ax, 0.74, 0.14], h: H * 0.8, only: /^(upperArm|lowerArm)/ }
      : { sdf: C.armor.armSdf, lo: [-0.38 - ax, 0.42 - ay, -0.11], hi: [0.38 + ax, 0.68, 0.13], h: H * 0.8, only: /^lowerArm/ };
    case "armorLegs": return C.armor.helmSdf ? { sdf: C.armor.legSdf, lo: [-0.26, 0.08, -0.15], hi: [0.26, 0.44, 0.17], h: H * 0.8, only: /^(upperLeg|lowerLeg)/ }
      : { sdf: C.armor.legSdf, lo: [-0.24, 0.08, -0.13], hi: [0.24, 0.34, 0.15], h: H * 0.8, only: /^lowerLeg/ };
    case "armorWaist": return C.armor.waistSdf ? { sdf: C.armor.waistSdf, lo: [-0.32, 0.3, -0.26], hi: [0.32, 0.5, 0.26], h: H * 0.8, only: /^(hips|upperLeg)/ } : { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, bone1: "hips" };   // light armor's tassets: on the hips, following the thighs
    case "armorHelm": case "armorVisor": case "armorDeco": case "armorHands": case "armorFeet": case "armorMail": { const A = C.armor, none = { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, bone1: "hips" };   // light armor: nothing
      if (!A.helmSdf) return none;
      if (name === "armorHelm") return { sdf: A.helmSdf, lo: [-0.4, 0.7, -0.4], hi: [0.4, 1.52, 0.42], h: H * 0.85, bone1: "head" };
      if (name === "armorVisor") return !A.visorSdf ? none : { sdf: A.visorSdf, lo: [-0.3, 0.85, -0.1], hi: [0.3, 1.2, 0.42], h: H * 0.6, bone1: "head" };
      if (name === "armorDeco") return !A.decoSdf ? none : { sdf: A.decoSdf, lo: [-0.6, 0.9, -0.5], hi: [0.6, 1.85, 0.45], h: H * 0.8, bone1: "head" };
      if (name === "armorHands") return { sdf: A.handSdf, lo: [-0.42 - ax, 0.36 - ay, -0.1], hi: [0.42 + ax, 0.6, 0.12], h: H * 0.7, only: /^(hand|fingers|fingerTips|thumb|lowerArm)/ };
      if (name === "armorFeet") return { sdf: A.footSdf, lo: [-0.24, -0.01, -0.14], hi: [0.24, 0.14, 0.16], h: H * 0.8, only: /^(foot|lowerLeg)/ };
      return { sdf: A.mailSdf, fast: (x, y, z) => A.mailSdf(x, y, z, B), lo: [-0.47 - ax, -0.02, -0.3], hi: [0.47 + ax, 0.82, 0.34], h: H * 1.2 }; }
    // weapons (clothes/weapons.js): each bound to one bone (the right hand; the shield to the left forearm)
    case "weaponR": case "weaponRGrip": case "weaponL": case "weaponLFace": case "weaponLGrip": { const Wp = C.weapons, r = name.startsWith("weaponR"), f = { weaponR: Wp.rMetal, weaponRGrip: Wp.rOther, weaponL: Wp.lMetal, weaponLFace: Wp.lFace, weaponLGrip: Wp.lOther }[name], b = r ? Wp.boxR : Wp.boxL;
      if (!f || !b) return { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], h: H, bone1: "hips" };
      return { sdf: f, lo: b.lo, hi: b.hi, h: H * 0.5, bone1: r ? "hand.R" : "lowerArm.L" }; }
    case "socks": return { sdf: C.sockSdf, fast: (x, y, z) => C.sockSdf(x, y, z, B), lo: foot0, hi: [0.22, 0.17, 0.14], h: H * 0.7, only: /^(foot|lowerLeg)/ };
  }
  if (name.startsWith("hair:")) {   // long hair reaches down the back
    const pick = JSON.parse(name.slice(5));
    return { sdf: HT.wrap(hairKit.hairSdfOf(pick)), lo: [-0.4, pick.back === "long" && !OPT.hair.sculpt.long.locks ? 0.4 : 0.8, -0.42], hi: [0.4, 1.5, 0.38], h: H * OPT.quality.hairCell, bone1: "head" };
  }
  throw new Error(`Unknown part "${name}"`);
}

/** Skin weights for each vertex: bone1 binds everything to one bone, otherwise the nearest body parts (only: a RegExp of bones allowed).
 *  soft: { bone, k(x, y, z) } — only the fraction k of the weight on other bones is kept, the rest goes to that bone (a skirt: mostly the hips) */
export function skinOf(pos, weightsAt, BI, bone1, only, soft = null) {
  const nv = pos.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), tmp = { idx: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  for (let v = 0; v < nv; v++) { tmp.idx.fill(0); tmp.w.fill(0); if (bone1) { tmp.idx[0] = BI[bone1]; tmp.w[0] = 1; } else weightsAt(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], tmp, only);
    if (soft?.front && !bone1) { const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], k = soft.k(x, y, z), f = soft.front(z), sL = Math.min(1, Math.max(0, 0.5 + x / 0.16));   // the skirt: the hips, and toward the hem the front on the skirt bones / the rest on the thighs, by side (the middle half and half)
      const W = [[soft.bone, 1 - k], ["skirt.L", k * f * sL], ["skirt.R", k * f * (1 - sL)], ["upperLeg.L", k * (1 - f) * sL], ["upperLeg.R", k * (1 - f) * (1 - sL)]].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = W.reduce((a, w) => a + w[1], 0);
      W.forEach(([b, w], q) => { tmp.idx[q] = BI[b]; tmp.w[q] = w / sum; }); }
    else if (soft && !bone1) { const k = soft.k(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]), b = BI[typeof soft.bone === "function" ? soft.bone(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) : soft.bone]; let moved = 0, at = -1;   // (bone: a name, or by the point)
      if (k >= 1) { for (let q = 0; q < 4; q++) { si[v * 4 + q] = tmp.idx[q]; sw[v * 4 + q] = tmp.w[q] || 0; } continue; }   // untouched
      for (let q = 0; q < 4; q++) { if (tmp.idx[q] === b) { at = q; continue; } moved += tmp.w[q] * (1 - k); tmp.w[q] *= k; }
      if (at < 0) { at = tmp.w.indexOf(Math.min(...tmp.w)); moved += tmp.w[at]; tmp.w[at] = 0; tmp.idx[at] = b; }   // no room: the weakest bone gives way
      tmp.w[at] += moved; }
    for (let q = 0; q < 4; q++) { si[v * 4 + q] = tmp.idx[q]; sw[v * 4 + q] = tmp.w[q] || 0; } }
  return { si, sw };
}
