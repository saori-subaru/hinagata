// A character's proportions in real terms, and options found from proportions (2026-10-10, after 島風: the agent making her had to work
// out the body from a picture and could only guess which of head size, leg length and torso length to turn; the clothes' heights are in
// base space, the body before body.proportion stretches it, and on a tall body a centimetre there is several on the character).
// No three.js, no meshes: only the body's joints and shape (a few ms), so Node tools and the sync helper's MCP tools use it too.
//
//   measureCharacter(options) → { height, heads, at: { skull, chin, shoulder, hip, knee, ankle } (m), share: { … } (of the height),
//                             built(y): a base-space height (as the options and the clothes take them) → on the character,
//                             base(y): the other way, lift (m: what heels lift it by) }
//   fitProportions(options, { heads, hip, knee, shoulder, chin, height }) → { set: { "body.head.scale": …, … }, before, after }
// The height is to the top of the head (the skull: the hair adds a little), standing in its shoes (heels lift it), as the editor's height
// guides measure it. hip: the hip joints' height; knee, ankle, shoulder: the joints'; chin: the bottom of the chin.
import { resolveOptions, setPath, openRecipe } from "./options.js";
import { buildBody, makeStretch } from "./body/index.js";
import { heelPose } from "./clothes/index.js";

const PATHS = { headScale: "body.head.scale", legs: "body.proportion.legs", torso: "body.proportion.torso", knee: "body.adult.knee" };

/** How tall the character is and where its parts are (options: a recipe or resolved options). */
export function measureCharacter(options) {
  const OPT = resolveOptions(openRecipe(options ?? {}).options);   // (a recipe, a character file, or resolved options: resolving them again changes nothing)
  const { J, HT, bodySdf } = buildBody(OPT), ST = makeStretch(OPT, J);
  const Jr = ST.identity ? J : Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [v[0], ST.bone(k, v[1]), v[2] + ST.shz(v[1])]]));
  const f = ST.identity ? bodySdf : (x, y, z) => { const yb = ST.inv(y); return bodySdf(x, yb, z - ST.shz(yb)); };   // the body as built (its sign is enough here)
  const fromHead = (x, y, z) => { const p = HT.fromHead(x, y, z); p[1] = ST.fwd(p[1]); return p; };
  const heels = ["heels", "heelBoots"].includes(OPT.outfit.shoes.kind) && OPT.outfit.shoes.on !== false, lift = heels ? heelPose(OPT, Jr).lift : 0;
  // the skull's top down the middle; the chin where the face's front falls back furthest near the jaw's bottom (as the editor's guides find it)
  const solid = (y) => { for (let z = -0.25; z < 0.3; z += 0.004) if (f(0, y, z) < 0) return true; return false; };
  let skull = Jr.head[1]; while (skull < 4 && solid(skull + 0.002)) skull += 0.002;
  { let lo = skull, hi = skull + 0.002; for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (solid(m)) lo = m; else hi = m; } skull = lo; }   // (to well under a mm: fitProportions follows small changes)
  const front = (y) => { let z = 0.4; while (z > -0.2 && f(0, y, z) >= 0) z -= 0.004; let lo = z, hi = z + 0.004; for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (f(0, y, m) < 0) lo = m; else hi = m; } return lo; };
  const cy = fromHead(0, OPT.body.sculpt.chin.y, 0.15)[1];
  let chin = cy, drop = 0, prev = front(cy + 0.03);
  for (let y = cy + 0.03; y > cy - 0.03; y -= 0.002) { const z = front(y - 0.002); if (prev - z > drop) { drop = prev - z; chin = y; } prev = z; }
  { const c0 = chin; drop = 0; prev = front(c0 + 0.002); for (let y = c0 + 0.002; y > c0 - 0.004; y -= 0.0004) { const z = front(y - 0.0004); if (prev - z > drop) { drop = prev - z; chin = y; } prev = z; } }   // (finer, near it)
  const at = { skull, chin, shoulder: Jr["upperArm.L"][1], hip: Jr["upperLeg.L"][1], knee: Jr["lowerLeg.L"][1], ankle: Jr["foot.L"][1] };
  for (const k in at) at[k] += lift;
  const height = at.skull, share = Object.fromEntries(Object.entries(at).map(([k, v]) => [k, v / height]));
  return { height, heads: height / (skull - chin), at, share, lift, built: (y) => ST.fwd(y) + lift, base: (y) => ST.inv(y - lift) };
}

/** Options for the body that come nearest the proportions asked: heads (how many heads tall), hip / knee / shoulder / chin (heights as
 *  shares of the height), height (m). Turns body.head.scale, body.proportion.legs and torso (and body.adult.knee on the adult body),
 *  each within its range, and as little as it can for what isn't asked. Returns { set: { path: value }, before, after } (measureCharacter's). */
export function fitProportions(options, targets = {}) {
  const base = openRecipe(options ?? {}).options, OPT0 = resolveOptions(base);   // (a recipe or a character file; the set is in the recipe's terms)
  const knobs = ["headScale", "legs", "torso", ...(OPT0.body.adult?.on && targets.knee != null ? ["knee"] : [])];
  const RANGE = { headScale: [0.4, 1.05], legs: [0.8, 3], torso: [0.8, 2.6], knee: [0.38, 0.62] };
  const get = (o, p) => p.split(".").reduce((a, k) => a?.[k], o);
  const x0 = knobs.map((k) => get(OPT0, PATHS[k]));
  const optsAt = (x) => { const o = structuredClone(base); knobs.forEach((k, i) => setPath(o, PATHS[k], x[i])); return o; };
  // what is asked, each scaled to about one unit per noticeable miss
  const terms = [["heads", (m) => m.heads, 0.1], ["hip", (m) => m.share.hip, 0.01], ["knee", (m) => m.share.knee, 0.01], ["shoulder", (m) => m.share.shoulder, 0.01],
    ["chin", (m) => m.share.chin, 0.01], ["height", (m) => m.height, 0.01]].filter(([k]) => targets[k] != null);
  const before = measureCharacter(OPT0);
  if (!terms.length) return { set: {}, before, after: before };
  // the legs' share kept (loosely) when it isn't asked: a head count alone moved the legs and the torso any way that met it
  if (targets.hip == null) terms.push(["hip", (m) => m.share.hip, 0.03, before.share.hip]);
  const cost = (x) => { const m = measureCharacter(optsAt(x)); let c = 0; for (const [k, g, s, keep] of terms) c += ((g(m) - (keep ?? targets[k])) / s) ** 2;
    x.forEach((v, i) => { c += 1e-3 * ((v - x0[i]) / (RANGE[knobs[i]][1] - RANGE[knobs[i]][0])) ** 2; }); return c; };   // (a little pull toward where it was: the knobs nothing asks about stay)
  const clamp = (v, i) => Math.min(RANGE[knobs[i]][1], Math.max(RANGE[knobs[i]][0], v));
  // coordinate search with shrinking steps (the measure isn't smooth enough for derivatives: the chin and the skull move in 2 mm steps)
  let x = [...x0], c = cost(x), step = knobs.map((k) => (RANGE[k][1] - RANGE[k][0]) * 0.1);
  for (let it = 0; it < 60 && step.some((s, i) => s > (RANGE[knobs[i]][1] - RANGE[knobs[i]][0]) * 0.002); it++) {
    let moved = false;
    for (let i = 0; i < knobs.length; i++) for (const d of [1, -1]) { const y = [...x]; y[i] = clamp(x[i] + d * step[i], i); if (y[i] === x[i]) continue; const cy = cost(y); if (cy < c) { x = y; c = cy; moved = true; break; } }
    if (!moved) step = step.map((s) => s / 2);
  }
  const round = (v, k) => +v.toFixed(k === "knee" ? 3 : 2);
  const set = Object.fromEntries(knobs.map((k, i) => [PATHS[k], round(x[i], k)]).filter(([, v], i) => v !== round(x0[i], knobs[i])));
  return { set, before, after: measureCharacter(optsAt(knobs.map((k, i) => set[PATHS[k]] ?? x0[i]))) };
}
