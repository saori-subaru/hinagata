#!/usr/bin/env node
// Where an accessory goes (options.accessories: at, n): the clothes' outside at a point, as the offset from a bone's joint as built.
// Accessories sit at their offsets, not on the surface (but on the adult body), so measure before placing one.
//
//   node tools/surface.mjs <preset | character.json> <bone> <x> <height> [front | back | left | right]
//     x: m from the middle (for left / right: m forward of it); height: base space (0.56), or a share of the character's height (0.69h,
//     as measured on a design sheet); the way out from the middle: front (default), back, left (+x) or right
//   → at: [x, y, z] and n: [x, y, z] to paste into the item. The surface is the body, the shirt, the pants, the socks and the shoes: for a
//     part lying on them (a belt, a collar) add its thickness as the item's lift.
import fs from "node:fs";
import { CHARACTERS } from "../src/presets.js";
import { openRecipe, resolveOptions } from "../src/options.js";
import { buildBody, makeStretch } from "../src/body/index.js";
import { buildClothes } from "../src/clothes/index.js";
import { measureCharacter } from "../src/measure.js";

const [who, bone, xs, ys, dir = "front"] = process.argv.slice(2);
if (!who || !bone || xs == null || ys == null) { console.error("usage: node tools/surface.mjs <preset | character.json> <bone> <x> <height | 0.69h> [front | back | left | right]"); process.exit(1); }
const file = CHARACTERS[who] ? structuredClone(CHARACTERS[who].file) : JSON.parse(fs.readFileSync(who, "utf8"));
const m = measureCharacter(file), OPT = resolveOptions(openRecipe(file).options), B = buildBody(OPT), C = buildClothes(OPT, B), ST = makeStretch(OPT, B.J);
if (!B.J[bone]) { console.error(`no bone "${bone}": ${Object.keys(B.J).join(", ")}`); process.exit(1); }
const O = OPT.outfit, y = ys.endsWith("h") ? m.base(parseFloat(ys) * m.height) : +ys, x = +xs;
const outer = (px, py, pz) => Math.min(B.bodySdf(px, py, pz), O.shirt.on !== false || O.dress?.on ? C.shirtSdf(px, py, pz) : 1, O.pants.on !== false || O.dress?.on ? C.pantsSdf(px, py, pz) : 1,
  O.socks.on !== false ? C.sockSdf(px, py, pz) : 1, O.shoes.on !== false ? C.shoeSdf(px, py, pz) : 1);
const d = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] }[dir], o = d[0] ? [0, y, x] : [x, y, 0];
let t = 0; while (t < 0.6 && outer(o[0] + d[0] * t, o[1], o[2] + d[2] * t) < 0) t += 0.002;
let lo = Math.max(0, t - 0.002), hi = t; for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (outer(o[0] + d[0] * mid, o[1], o[2] + d[2] * mid) < 0) lo = mid; else hi = mid; }
const p = [o[0] + d[0] * hi, o[1], o[2] + d[2] * hi], e = 0.003, g = [0, 1, 2].map((i) => { const a = [...p], b = [...p]; a[i] += e; b[i] -= e; return outer(...a) - outer(...b); });
g[1] /= ST.slope(y);   // (as built: heights are stretched)
const gl = Math.hypot(...g) || 1, n = g.map((v) => v / gl), arm = /^(upperArm|lowerArm|hand)/.test(bone), built = [p[0], arm ? p[1] + ST.armDy : ST.fwd(p[1]), p[2] + ST.shz(p[1])], j = B.J[bone], jb = [j[0], ST.bone(bone, j[1]), j[2] + ST.shz(j[1])];
console.log(`at: [${built.map((v, i) => +(v - jb[i]).toFixed(4)).join(", ")}], n: [${n.map((v) => +v.toFixed(2)).join(", ")}]   (bone ${bone}; the surface at ${built.map((v) => v.toFixed(3)).join(", ")} m as built, base height ${y.toFixed(4)})`);
