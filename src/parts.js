// Which mesh is built from which shape: its box, cell size and bones. One table for the main thread (index.js) and the
// build workers (worker.js) — both read it, so a part built in a worker is exactly the part the main thread would build.
//   name: "body" | "shirt" | "pants" | "shoes" | "soles" | "socks" | "hair:<pick as JSON>"
//   kit:  { bodySdf, HT, hairKit, clothes } (from buildBody / buildHair / buildClothes)
//   bodyAt: a fast lookup of the body (read back from the body's grid), or null to read the body itself

export const CLOTHES = ["shirt", "pants", "shoes", "soles", "socks"];
export const hairPartName = (pick) => "hair:" + JSON.stringify(pick);

export function partSpec(name, { OPT, H, kit, bodyAt = null }) {
  const { bodySdf, HT, hairKit, clothes: C } = kit, B = bodyAt || bodySdf, foot0 = [-0.22, -0.01, -0.12];
  switch (name) {
    case "body": return { sdf: bodySdf, lo: [-0.47, -0.02, -0.3], hi: [0.47, 1.43, 0.34], h: H };
    case "shirt": { const long = OPT.outfit.shirt.sleeve === "long", w = long ? 0.37 : 0.3;   // long sleeves reach the wrists (and follow the forearms)
      return { sdf: C.shirtSdf, fast: (x, y, z) => C.shirtSdf(x, y, z, B), lo: [-w, 0.33, -0.2], hi: [w, 0.86, 0.22], h: H * OPT.quality.shirtCell, only: long ? /^(hips|spine|chest|upperChest|neck|upperArm|lowerArm)/ : /^(hips|spine|chest|upperChest|neck|upperArm)/ }; }
    case "pants": { const y0 = { knee: 0.17, long: 0.07 }[OPT.outfit.pants.length] ?? 0.2;   // long pants reach the ankles
      return { sdf: C.pantsSdf, fast: (x, y, z) => C.pantsSdf(x, y, z, B), lo: [-0.28, y0, -0.2], hi: [0.28, 0.55, 0.22], h: H * 1.2, only: /^(hips|spine|upperLeg|lowerLeg)/ }; }
    case "shoes": return { sdf: C.shoeSdf, lo: foot0, hi: [0.22, 0.13, 0.14], h: H * 0.7, only: /^(foot|lowerLeg)/ };
    case "soles": return { sdf: C.soleSdf, lo: foot0, hi: [0.22, 0.03, 0.14], h: H * 0.6, only: /^foot/ };
    case "socks": return { sdf: C.sockSdf, fast: (x, y, z) => C.sockSdf(x, y, z, B), lo: foot0, hi: [0.22, 0.17, 0.14], h: H * 0.7, only: /^(foot|lowerLeg)/ };
  }
  if (name.startsWith("hair:")) {   // long hair reaches down the back
    const pick = JSON.parse(name.slice(5));
    return { sdf: HT.wrap(hairKit.hairSdfOf(pick)), lo: [-0.4, pick.back === "long" ? 0.4 : 0.8, -0.42], hi: [0.4, 1.5, 0.38], h: H * OPT.quality.hairCell, bone1: "head" };
  }
  throw new Error(`Unknown part "${name}"`);
}

/** Skin weights for each vertex: bone1 binds everything to one bone, otherwise the nearest body parts (only: a RegExp of bones allowed). */
export function skinOf(pos, weightsAt, BI, bone1, only) {
  const nv = pos.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), tmp = { idx: [0, 0, 0, 0], w: [0, 0, 0, 0] };
  for (let v = 0; v < nv; v++) { tmp.idx.fill(0); tmp.w.fill(0); if (bone1) { tmp.idx[0] = BI[bone1]; tmp.w[0] = 1; } else weightsAt(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], tmp, only);
    for (let q = 0; q < 4; q++) { si[v * 4 + q] = tmp.idx[q]; sw[v * 4 + q] = tmp.w[q] || 0; } }
  return { si, sw };
}
