// Hinagata: code-generated avatars for three.js, tall (the default) or chibi.
//
//   const avatar = await createAvatar({ hair: { back: "bob" } });
//   scene.add(avatar.object);
//   avatar.play("walk");
//   // every frame: avatar.update(dt)
//
import * as THREE from "three";
import { sstep, dPrim, blend } from "./sdf/prim.js";
import { surfaceNets, gridSampler, smoothNormals } from "./sdf/mesh.js";
import { hashKey, sourceHash, cacheGet, cachePut } from "./cache.js";
import { partSpec, partClothCell, skinOf, hairPartName, CLOTHES, ARMOR, WEAPONS } from "./parts.js";
import { buildPartInWorkers } from "./build.js";
import { shaded, metal, SHADINGS, outlineMat, withShadeN, withGrad, withTex, withPaint } from "./materials.js";
import { PAINT_TARGETS, paintLayout, paintGLSL } from "./paint.js";
import { DEFAULTS, resolveOptions, diff, skirtOf, bangsId, openRecipe, hairForms } from "./options.js";
import { SCHEMA, checkOptions } from "./schema.js";
import { buildBody, makeStretch, isArmBone } from "./body/index.js";
import { buildClothes, capeTop, heelPose } from "./clothes/index.js";
import { buildHair } from "./hair/index.js";
import { longLocks, ringLocks, surfaceLocks, bangLocks, sideLocks, bangTipAt, drawnLocks, tailLocks, colliders as lockColliders, createLocks, surfaceAlong } from "./hair/locks.js";
import { tailSpec } from "./clothes/extras.js";
import { makeSkeleton, makeWeights } from "./rig.js";
import { createFace, EXPRESSIONS, PART_LABELS, partIds, expressionId } from "./face/index.js";
import { POSES, createPosePlayer } from "./motion/index.js";
import { createCloth } from "./cloth.js";
import { accessoryGeometries } from "./accessories.js";
import { createFollower } from "./follow.js";

export { DEFAULTS, POSES, SHADINGS, resolveOptions, diff, EXPRESSIONS, PART_LABELS, SCHEMA, checkOptions };
export { RECIPE_VERSION, OLD_DEFAULTS, defaultsAt, openRecipe, recipeAt, characterFile, isCharacterFile } from "./options.js";   // recipe versions (options.js)
export { EXPRESSION_SET } from "./face/names.js";
export { BODY_TYPES } from "./body/types.js";
export { CHARACTERS } from "./presets.js";   // ready-made characters (presets.js): createAvatar(CHARACTERS.sylvie.file)
export { faceSheet, faceSheetLayers, readFaceSheet, sheetChanges, sheetLayout, sheetTiles } from "./face/sheet.js";   // face templates to draw parts on, and reading them back (face/sheet.js)
export { LIMBS, ik2, aim } from "./motion/ik.js";   // IK: hands / feet onto points after the pose (motion/ik.js)
export { measureBody, measureStride, climbLimbs } from "./motion/climb.js";   // climbing, jump, fall poses + the climbing gait (motion/climb.js)
export { measureGait, RUN_W } from "./motion/run.js";   // the run pose + a stride measure for any gait (motion/run.js)
import "./motion/jump.js";   // jump / land / fall / crouch / banzai poses (motion/jump.js)
export { crawlLimbs, SNEAK_W } from "./motion/crawl.js";   // crouched walk and crawling (motion/crawl.js)
import "./motion/mantle.js";   // pulling up over an edge in steps, and vaulting (motion/mantle.js)
export { holdPole } from "./motion/glide.js";   // gliding under something held overhead; both hands on a pole (motion/glide.js)
export { SWIM_W, swimHead } from "./motion/swim.js";   // swimming, treading water, wading (motion/swim.js)
export { ONE_SHOT } from "./motion/survival.js";
import "./motion/combat.js";   // fighting: two-handed guards, an attack per weapon, hit / stun / down (motion/combat.js)   // the body's states and the hands' work for living in the wild: pant, shiver, limp, drink, chop, sleep... (motion/survival.js)

/**
 * Build an avatar.
 * options:  see DEFAULTS (src/options.js); anything left out uses the default (since 2026-10-06 the tall standard body, BODY_TYPES.standardTall;
 *           merge a chibi BODY_TYPES entry for a chibi). Also a URL of a character file ("player.json"), and a character file as it is
 *           ({ hinagata: 3, name, options }: the editor's 書き出し → JSON). Files carry their version (2: the first tall body): a file of version 1, and a bare recipe
 *           file fetched from a URL (no "hinagata": as files were written before 2026-10-06), is read with the old chibi defaults
 *           (openRecipe in options.js). A bare options object passed in code is today's: the current defaults.
 * settings: { quality: "game" (default) | "fine" | "lite" | "high" | "low" — mesh density. "game": 13.6 mm cells, fast to build.
 *              "high": 6.8 mm cells, "low": 9.5 mm. "fine": built as "high", then thinned to about a fifth (meshoptimizer; the face kept as
 *              built, skirts and capes built at 10.5 mm and not thinned): the vertices of "game", close to "high" in looks, but about 3x as
 *              long to build as "game" (cached after). "lite": 13.6 mm cells thinned to 15% and lighter hair locks, about a third to a
 *              fifth of the game's vertices. Without meshoptimizer (offline), "fine" and "lite" build unthinned at 13.6 mm.
 *             cell: a cell size in metres, instead of quality,
 *             simplify: 0..1 — after building, keep this share of the triangles (e.g. 0.1). Uses the "meshoptimizer" package (from the import map, else jsDelivr).
 *                       The face is kept as built on top of the share, cloth is thinned less, and thinning stops before the shape would change by
 *                       more than 1% of the part's size, so a part may keep more than asked (2026-10-06: a share alone thinned a chibi paper-thin),
 *             spare: false (default) — armor that isn't worn is built only when it is put on (setWorn); true builds it now (an editor),
 *             cache: true (default) — remember the built meshes in the browser (IndexedDB); the same options come back instantly next time.
 *                    The key includes the generator's source code, so edits to the sculpt code never return a stale mesh,
 *             cull: true (default) — don't draw the body where clothes cover it (follows each garment's visibility),
 *             workers: true (default) — build the parts in a few Web Workers at once (body and hair together, then the clothes);
 *                      the same mesh as on the main thread. Falls back to the main thread when workers can't start,
 *             debug: { slow, oldSock, faceWrap } — checking aids, normally unused }
 */
// options without the parts that only change colors, the outline, the shading, the blush, the face parts, what is worn or the hair paint (the geometry is the same, so the cache can reuse it)
function shapeOnly(OPT) {
  const strip = (o) => { if (!o || typeof o !== "object") return o; const r = Array.isArray(o) ? [] : {}; for (const [k, v] of Object.entries(o)) if (!/^(color|soleColor|laceColor|mailColor|visorColor|decoColor|gripColor|shieldColor|on|gradient|texture)$/.test(k)) r[k] = strip(v); return r; };
  const { colors, outline, shading, paint: _paint, ...rest } = OPT, { blush, parts, ...face } = OPT.face, { paint, gradient, tail, ...hair } = OPT.hair;   // (the gradient and the tails: no mesh of the cache)
  return { ...rest, face, hair, outfit: { ...strip(OPT.outfit), dressOn: !!OPT.outfit.dress?.on, capeOn: !!OPT.outfit.cape?.on } };   // a dress is a shape (its skirt), and a cape is only built when worn
}

export async function createAvatar(options = {}, { quality = "game", cell = 0, simplify: simplifyAsked, spare = false, cache = true, cull = true, workers = true, debug = {} } = {}) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint (e.g. a "building…" message) before the heavy work
  const TIMES = {}, T00 = performance.now(); let T0p = T00; const lap = (k) => { const t = performance.now(); TIMES[k] = Math.round((TIMES[k] || 0) + t - T0p); T0p = t; };   // where the time goes (avatar.TIMES, ms)
  // the character as the editor saves it, as it is (2026-10-05, Saori: a developer makes a character in the editor and puts it in the game):
  // a file's URL ("player.json") is fetched, and a character file ({ hinagata, name, options }) is opened to its options, in today's terms
  // (a file without a version is from before 2026-10-06: its recipe was made against the chibi defaults; a bare object in code is today's)
  let bare = undefined;
  if (typeof options === "string") { const r = await fetch(options); if (!r.ok) throw new Error(`createAvatar("${options}"): ${r.status}`); options = await r.json(); bare = 1; }
  options = openRecipe(options, { bare }).options;
  { const bad = checkOptions(options); if (bad.length) console.warn("Hinagata: options with problems (see docs/options.schema.json):\n" + bad.map((b) => `  ${b.path}: ${b.problem}`).join("\n")); }   // typos would otherwise be silently ignored
  const OPT = resolveOptions(options);
  // "fine" (2026-10-05, Saori: "ゲーム用でもまだ六万頂点", "スカートやマントがジャギジャギ"): built at the high quality's cells, then thinned to
  // about a fifth (meshoptimizer): the vertices "game" has, the look of "high" (the thinning keeps the triangles where the surface turns
  // and spends few on flat parts, which a coarser grid can't). It was "game" for an hour: building took 3x as long (two players for the
  // tennis: 3.5 s → 9.9 s), and a game's players wait for that; so "game" stays the fast one.
  // "lite": the game's cells thinned to 15% and lighter hair locks, about a fifth of those vertices; the same look at a game's distance
  const LITE = quality === "lite", FINE = quality === "fine" && !cell;
  let H = cell || { game: 0.0136, fine: 0.0068, lite: 0.0136, high: 0.0068, low: 0.0095 }[quality] || 0.0136;   // mesh cell size
  let simplify = simplifyAsked ?? (LITE ? 0.15 : FINE ? 0.22 : 1);
  let MS = null;   // meshoptimizer's simplifier, only when thinning
  if (simplify < 1) {
    const MO = "https://cdn.jsdelivr.net/npm/meshoptimizer@1/index.js";   // (the import map's "meshoptimizer" if there is one, else this)
    try { MS = (await import("meshoptimizer").catch(() => import(MO))).MeshoptSimplifier; await MS.ready; }
    catch (e) {
      const why = `the "meshoptimizer" package couldn't be loaded from your import map or ${MO}`;
      if (simplifyAsked != null) throw new Error(`settings.simplify needs it: ${why}. ` + e.message);
      console.warn(`Hinagata: ${why}; building "${quality}" unthinned at the coarser cells.`, e);   // offline: still an avatar
      simplify = 1; if (FINE) H = 0.0136;
    }
  }
  // the fine quality's skirt and cape: built at the cells the coarser grid gives cloth and not thinned (thinned, the cloth's uneven triangles drew
  // broken lines over a seated lap; 2026-10-05). The same cost to simulate as before.
  const clothH = FINE && simplify < 1 && simplifyAsked == null ? partClothCell(0.0136) : 0;
  // meshes remembered from an earlier visit (same options, same generator code)
  const useCache = cache && !debug.slow && !debug.oldSock && typeof indexedDB !== "undefined";
  const cacheKey = useCache ? hashKey(await sourceHash(), shapeOnly(OPT), H, simplify) : null;
  const hit = useCache ? await cacheGet(cacheKey) : null, fresh = {};
  // armor that isn't worn is not built now (2026-10-05: the tennis game waited for a suit of armor nobody wore, as long as for the clothes):
  // it is built when it is put on (setWorn), here on the main thread. settings.spare builds it anyway (the editor: everything ready to put
  // on at once). What the cache has comes anyway (it costs nothing)
  const LATER = new Set(!spare && !OPT.outfit.armor.on ? ARMOR.filter((k) => !hit?.[k]) : []);
  let building = true;

  lap("cache");
  // shapes
  const { J, PARENT, BONES, BI, HANDS, P, CUT, EARS, faceWarp, PLANES, BODY, HEAD, CROTCH, ARMPIT, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT } = buildBody(OPT, { slow: !!debug.slow, oldSock: !!debug.oldSock });
  const { pantsSdf, shirtSdf, bellOf, shoeSdf, sockSdf, soleSdf, lacesSdf, capeSdf, suitSdf, WRISTS, armor, weapons, extras } = buildClothes(OPT, { P, J, HT, CROTCH, bodySdf, ARMPIT });
  const hairKit = buildHair(OPT, { P, CUT, PLANES, faceWarp, bodySdf: bodySdfRaw });   // hair is shaped on the untransformed head, then scaled with it
  const weightsAt = makeWeights({ BODY, BONES, BI, J });
  // proportions (body.proportion, makeStretch in body/index.js): everything above is built at the base proportions; the meshes' points are
  // stretched upward as they are made (mesh), and what moves the character uses the stretched ones: the bones (Jr), the head's transform
  // for things placed in head space (HTr: the hair's locks, the face picture, the ear line) and the body read in place (bodySdfR, for colliders)
  const ST = makeStretch(OPT, J);
  const Jr = ST.identity ? J : Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [v[0], ST.bone(k, v[1]), v[2]]]));   // (rigid arms: the arm's joints ride on the shoulder)
  const HTr = ST.identity ? HT : { ...HT, identity: false, toHead: (x, y, z) => HT.toHead(x, ST.inv(y), z), fromHead: (x, y, z) => { const p = HT.fromHead(x, y, z); p[1] = ST.fwd(p[1]); return p; },
    wrap: (f) => { const g = HT.wrap(f); return (x, y, z) => g(x, ST.inv(y), z); } };
  // (rigid arms, body.proportion.arms: a point that lands on an arm where the arm moved to is read there)
  const armAt = (x, y, z) => { const t = { idx: [0, 0, 0, 0], w: [0, 0, 0, 0] }; weightsAt(x, y, z, t); let a = 0; for (let q = 0; q < 4; q++) if (t.w[q] && isArmBone(BONES[t.idx[q]])) a += t.w[q]; return a; };
  const bodySdfR = ST.identity ? bodySdf : !ST.rigid ? (x, y, z) => bodySdf(x, ST.inv(y), z) * ST.k
    : (x, y, z) => { const ya = y - ST.armDy; return armAt(x, ya, z) > 0.5 ? bodySdf(x, ya, z) : bodySdf(x, ST.inv(y), z) * ST.k; };
  const ARM_BI = new Set(BONES.filter(isArmBone).map((b) => BI[b]));
  /** a vertex's share on the arm bones (rigid arms ride on the shoulder: makeStretch) */
  const armShare = (si, sw, v) => { if (!ST.rigid || !si) return 0; let a = 0; for (let q = 0; q < 4; q++) if (ARM_BI.has(si[v * 4 + q])) a += sw[v * 4 + q]; return a; };
  /** a mesh's points where they were made, at the base proportions (the paint, the culling under the clothes and the jaw shadow read them) */
  const basePos = (g) => g.userData.basePos ?? g.attributes.position.array;
  const { root, bone, skeleton, HIPS0 } = makeSkeleton({ J: Jr, PARENT, BONES });

  lap("shapes");
  // shape → skinned mesh
  const PROF = [];   // per mesh: vertex count and build time (ms)
  let bodyAt = (x, y, z) => bodySdf(x, y, z);   // body distance; after the body is meshed, read back from its grid (clothes don't recompute the body)
  // name: which part (the cache key inside this character) / fast: cheaper sdf for grid sampling / bone1: bind everything to this bone / only: RegExp of bones allowed
  function mesh(name, sdf, lo, hi, h, bone1, only, fast = sdf, soft = null) {
    const T0 = performance.now(), w = building ? pre[name] : null; let rec = w?.rec ?? (building ? hit?.[name] : null), time = w?.time ?? null;   // made by a worker / remembered (the cache only serves the first build; later rebuilds, e.g. setHair after editing tips, are made fresh)
    mesh.last = w?.grid ?? null;
    if (w && MS) { rec = simplified(rec, name); }   // a worker builds full meshes; they are thinned here (with their skin weights)
    if (w) fresh[name] = rec;
    if (!rec) {
      const r = surfaceNets(sdf, lo, hi, h, { fast, band: OPT.quality.band, proj: OPT.quality.project }); mesh.last = r.grid; time = r.time;
      let pos = new Float32Array(r.pos), nor = r.nor, idx = new Uint32Array(r.idx);
      if (MS) ({ pos, nor, idx } = simplified({ pos, nor, idx }, name));
      const { si, sw } = skinOf(pos, weightsAt, BI, bone1, only, soft);
      rec = fresh[name] = { pos, nor, idx, si, sw };
    }
    const g = new THREE.BufferGeometry();
    let gp = rec.pos, gn = rec.nor;
    if (!ST.identity) { gp = Float32Array.from(gp); gn = Float32Array.from(gn);   // the proportions: points up by fwd, normals by the slope there (the record stays at the base, for the cache)
      for (let i = 0, v = 0; i < gp.length; i += 3, v++) { const a = armShare(rec.si, rec.sw, v), s = ST.upSlope(gp[i + 1], a); gp[i + 1] = ST.up(gp[i + 1], a); const ny = gn[i + 1] / s, l = Math.hypot(gn[i], ny, gn[i + 2]) || 1; gn[i] /= l; gn[i + 1] = ny / l; gn[i + 2] /= l; } }
    g.setAttribute("position", new THREE.BufferAttribute(gp, 3)); g.setAttribute("normal", new THREE.BufferAttribute(gn, 3)); g.setIndex(new THREE.BufferAttribute(rec.idx, 1));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(rec.si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(rec.sw, 4));
    if (!ST.identity) g.userData.basePos = rec.pos;
    PROF.push({ part: name, verts: rec.pos.length / 3, ms: w ? w.ms : Math.round(performance.now() - T0), cached: !time, worker: !!w, sample: time ? Math.round(time.sample) : 0, project: time ? Math.round(time.project) : 0 });
    return g;
  }
  // keep `simplify` of the triangles (meshoptimizer), then drop the vertices nothing uses any more (the skin weights, if there are any,
  // follow their vertices: meshoptimizer keeps a subset of the vertices). Cloth (a skirt, a cape) is thinned less: its inner side rides on
  // the outer side's nearest points, and from big triangles the inside showed through in holes (2026-10-05, the lite quality)
  const THIN_ERROR = 0.01;   // 1% of the mesh's size (meshoptimizer's target_error)
  function simplified(rec, name) {
    const { pos, nor, idx, si, sw } = rec;
    if (idx.length < 3) return rec;   // nothing to thin (a part not built, e.g. armor not worn): asking meshoptimizer for 3 of 0 failed its assert (2026-10-04, found by the forest)
    const cloth = name === "cape" || (name === "pants" && skirtOf(OPT));
    const share = !cloth ? simplify : clothH ? 1 : Math.max(simplify, Math.min(1, simplify * 4));
    // the face is left as built (thinned, the outline came through on the cheeks in lines: 2026-10-05, Saori), and the normals count as well
    // as the positions, so the toon bands and the outline keep their shape where the surface turns
    let lock = null;
    if (name === "body") { lock = new Uint8Array(pos.length / 3); const hy = J.head[1] - 0.06;
      for (let v = 0; v < lock.length; v++) if (pos[v * 3 + 1] > hy && pos[v * 3 + 2] > 0.02 && Math.abs(pos[v * 3]) < 0.22) lock[v] = 1; }
    // the share is of what may be thinned: the face's triangles come on top of it. Counted over the whole mesh (until 2026-10-06), the face
    // kept as built took the share away from the rest: a chibi's face is a fifth of its body, and at 0.15 the rest went to nearly nothing
    // (the forest's chibi paper-thin from the side, spikes from the shoulders to the thighs, shins gone; tools/thin-check.mjs).
    // And a brake: stop where the shape would change by more than THIN_ERROR (of the mesh's size, the normals counted too) even short of
    // the count. At 0.15 a body's thinning changes it by 0.3-0.4%, so the brake holds only when a share asks for too much.
    let kept = 0; if (lock) for (let i = 0; i < idx.length; i += 3) if (lock[idx[i]] && lock[idx[i + 1]] && lock[idx[i + 2]]) kept += 3;
    const target = Math.min(idx.length, Math.max(3, kept + Math.floor((idx.length - kept) * share / 3) * 3));
    const [out] = MS.simplifyWithAttributes(idx, pos, 3, nor instanceof Float32Array ? nor : Float32Array.from(nor), 3, [0.4, 0.4, 0.4], lock, target, THIN_ERROR, []);
    const map = new Int32Array(pos.length / 3).fill(-1); let n = 0; for (const v of out) if (map[v] < 0) map[v] = n++;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), SI = si ? new si.constructor(n * 4) : null, SW = sw ? new Float32Array(n * 4) : null;
    for (let v = 0; v < map.length; v++) { const m = map[v]; if (m < 0) continue; for (let k = 0; k < 3; k++) { P[m * 3 + k] = pos[v * 3 + k]; N[m * 3 + k] = nor[v * 3 + k]; }
      if (SI) for (let k = 0; k < 4; k++) { SI[m * 4 + k] = si[v * 4 + k]; SW[m * 4 + k] = sw[v * 4 + k]; } }
    for (let i = 0; i < out.length; i++) out[i] = map[out[i]];
    return SI ? { pos: P, nor: N, idx: out, si: SI, sw: SW } : { pos: P, nor: N, idx: out };
  }
  function skinned(geo, color, ow = 0.005, soft = null) {   // toon mesh + outline mesh, bound to the skeleton (ow: this part's outline width at outline.width 1; soft: the part's name to shade it by softened normals, see addSoftNormals)
    if (soft) addSoftNormals(soft, geo);
    const m = new THREE.SkinnedMesh(geo, shadedFor(geo, color)); m.castShadow = true; m.frustumCulled = false; root.add(m); m.bind(skeleton);
    const om = outlineMat(ow * OPT.outline.width, OPT.outline.color); om.userData.baseWidth = ow; om.visible = OPT.outline.on;   // material.visible: the outline's on/off, apart from the mesh's own visibility (which pages use for "show this garment")
    const o = new THREE.SkinnedMesh(geo, om); o.frustumCulled = false; o.userData.outline = true; root.add(o); o.bind(skeleton);
    return { m, o, on: true };
  }

  // shading normals ("shadeN"): the mesh's normals smoothed over about SOFT_R (times shading.soften), so the toon bands follow the big
  // shapes instead of staining every bump where the blended shapes meet (the clay view and the outline keep the real normals).
  // On top of that the head borrows an ellipsoid's normals (addShadeNormals) and the hair shades as one round volume (HAIR_ROUND)
  const SOFT_R = 0.022, HAIR_ROUND = 0.6;
  function addSoftNormals(name, geo) {
    const idx = (geo.userData.idx0 ??= geo.index.array), n0 = geo.attributes.normal.array, it = Math.round((SOFT_R * OPT.shading.soften / H) ** 2);
    geo.setAttribute("shadeN", new THREE.BufferAttribute(it > 0 ? smoothNormals(n0, idx, it) : Float32Array.from(n0), 3));
    if (name === "body") addShadeNormals(geo);
    if (name === "hair") hairRound(geo);
  }
  // the hair as one volume, the way anime games shade it: normals from the head's center (above it) or from the vertical line under it
  // (long hair hanging down), mixed into the smoothed ones. Its light and shadow then split the hair cleanly instead of strand by strand
  function hairRound(geo) {
    const Pa = geo.attributes.position.array, S = geo.attributes.shadeN.array, SK = OPT.body.sculpt.skull, c = HTr.fromHead(0, SK.y, -0.005), w = HAIR_ROUND * Math.min(1, OPT.shading.soften);
    for (let i = 0; i < Pa.length; i += 3) { const dx = Pa[i] - c[0], dy = Math.max(0, Pa[i + 1] - c[1]), dz = Pa[i + 2] - c[2], dl = Math.hypot(dx, dy, dz) || 1;
      const sx = S[i] + (dx / dl - S[i]) * w, sy = S[i + 1] + (dy / dl - S[i + 1]) * w, sz = S[i + 2] + (dz / dl - S[i + 2]) * w, sl = Math.hypot(sx, sy, sz) || 1;
      S[i] = sx / sl; S[i + 1] = sy / sl; S[i + 2] = sz / sl; }
  }
  const shadedFor = (geo, c, style = OPT.shading.style) => { const m = shaded(style, c, OPT.shading.bands); return geo.attributes.shadeN ? withShadeN(m) : m; };   // a part's material: by its softened normals when it has them

  // face shading: shade the head with normals borrowed from a smooth ellipsoid, so toon bands don't follow small bumps (clay view keeps the real normals)
  const FACE_SHADE = { w: OPT.face.shading.weight, c: [0, OPT.face.shading.y, OPT.face.shading.z], r: [0.25 * OPT.body.sculpt.skull.width / 0.249, OPT.face.shading.radiusY, OPT.face.shading.radiusZ] };
  function addShadeNormals(geo) {
    const Pa = geo.attributes.position.array, N = geo.attributes.shadeN.array, S = new Float32Array(N.length), F = FACE_SHADE, ears = [1, -1].map((m) => [m * EAR.x, EAR.y, -0.022]);
    for (let i = 0; i < Pa.length; i += 3) { const [x, y, z] = HTr.toHead(Pa[i], Pa[i + 1], Pa[i + 2]);   // in head space
      let w = F.w * sstep(0.8, 0.86, y);
      for (const e of ears) w *= sstep(0.05, 0.1, Math.hypot(x - e[0], y - e[1], z - e[2]));   // head only; ears keep their own shading
      const ex = (x - F.c[0]) / F.r[0] ** 2 / HT.sx, ey = (y - F.c[1]) / F.r[1] ** 2 / HT.sy, ez = (z - F.c[2]) / F.r[2] ** 2 / HT.sz, el = Math.hypot(ex, ey, ez) || 1;   // normal back to world space
      const sx = N[i] + (ex / el - N[i]) * w, sy = N[i + 1] + (ey / el - N[i + 1]) * w, sz = N[i + 2] + (ez / el - N[i + 2]) * w, sl = Math.hypot(sx, sy, sz) || 1;
      S[i] = sx / sl; S[i + 1] = sy / sl; S[i + 2] = sz / sl; }
    geo.setAttribute("shadeN", new THREE.BufferAttribute(S, 3));
  }
  // painted jaw shadow (anime style, not from lighting): under the jaw toward the ears, and the top of the neck. Stored per vertex as "paint" (0..1)
  const JS = OPT.face.jawShadow;
  // painted color per vertex (multiplied into the skin): the jaw shadow, and a soft crescent of shade inside each ear (reads as the ear's hollow)
  const ES_ = OPT.face.earShade;
  function addPaint(geo) {
    const Pa = basePos(geo), N = geo.attributes.normal.array, A = new Float32Array(Pa.length).fill(1), jc = new THREE.Color(JS.color), ec = new THREE.Color(ES_.color);
    const put = (v, c, k) => { if (k <= 0) return; for (const [o, ch] of [[0, "r"], [1, "g"], [2, "b"]]) A[v * 3 + o] *= 1 + (c[ch] - 1) * Math.min(1, k); };
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const x = Pa[i], y = Pa[i + 1], z = Pa[i + 2], ny = N[i + 1];   // (at the base proportions: the shadow's heights are)
      if (JS.on) { const jaw = sstep(JS.jawNy[0], JS.jawNy[1], -ny) * sstep(JS.jawY[0], JS.jawY[1], y) * (1 - sstep(JS.jawY[2], JS.jawY[3], y)) * sstep(JS.backZ - 0.04, JS.backZ, z);
        // the neck's top all the way round to behind the ears (only its front middle before: the sides under the ears were left bare; 2026-10-07,
        // Saori: "耳下の首などが抜けてる"), fading out at the back (backZ)
        const neck = sstep(JS.neckY[0], JS.neckY[1], y) * (1 - sstep(JS.neckY[2], JS.neckY[3], y)) * (1 - sstep(JS.neckX[0], JS.neckX[1], Math.abs(x))) * sstep(JS.backZ - 0.04, JS.backZ, z);
        put(v, jc, Math.max(jaw, neck)); }
      if (ES_.on) { const h = HT.toHead(x, y, z);
        for (const E of EARS) { const d = [0, 1, 2].map((k) => h[k] - E.c[k]), u = (d[0] * E.eu[0] + d[1] * E.eu[1] + d[2] * E.eu[2]) / E.ES, vv = (d[0] * E.ev[0] + d[1] * E.ev[1] + d[2] * E.ev[2]) / E.ES, w = (d[0] * E.ew[0] + d[1] * E.ew[1] + d[2] * E.ew[2]) / E.ES;
          if (w < -0.012 || w > 0.04 || Math.abs(u) > 0.09 || Math.abs(vv) > 0.09) continue;   // the ear's front only
          const r1 = Math.hypot((u - ES_.cu) / ES_.ru, (vv - ES_.cv) / ES_.rv), r2 = Math.hypot((u - ES_.cu + ES_.shift) / ES_.ru, (vv - ES_.cv) / (ES_.rv * 0.92));
          put(v, ec, ES_.strength * sstep(1 + ES_.soft, 1 - ES_.soft, r1) * sstep(1 - ES_.soft, 1 + ES_.soft, r2)); } } }   // a crescent: inside the outer oval, outside the same oval moved toward the face
    geo.setAttribute("paint", new THREE.BufferAttribute(A, 3));
  }
  const shadeToon = (c) => { const m = shaded(OPT.shading.style, c, OPT.shading.bands), prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    sh.vertexShader = "attribute vec3 paint;\nvarying vec3 vPaint;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPaint = paint;");
    sh.fragmentShader = "varying vec3 vPaint;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= vPaint;"); }; return withShadeN(m); };

  lap("setup");
  // build in workers: the body and the hair at once, then the clothes (they read the body's grid, so the result is the same as here).
  // Whatever a worker can't do (no workers, an error) is simply built here below.
  const hairPick = hairForms(OPT.hair);   // the style built: { bangs, back ("hang": short hair hanging in locks), ahoge } (options.js)
  const pre = {};
  const kit = { bodySdf, HT, hairKit, clothes: { pantsSdf, shirtSdf, bellOf, shoeSdf, sockSdf, soleSdf, lacesSdf, capeSdf, suitSdf, armor, weapons, extras } };
  if (workers) {
    const need = (n) => !hit?.[n], job = { key: hashKey(shapeOnly(OPT), !!debug.slow, !!debug.oldSock), opt: OPT, debug: { slow: !!debug.slow, oldSock: !!debug.oldSock }, H, clothH };
    const run = (part, grid = null, split) => buildPartInWorkers(part, job, partSpec(part, { OPT, H, clothH, kit }), grid, split).then((r) => { pre[part] = r; }, () => {});
    const hairN = hairPartName(hairPick), jh = need(hairN) ? run(hairN) : null;   // the hair doesn't need the body: start it together with the body
    if (need("body")) await run("body");
    await Promise.all([jh, ...CLOTHES.filter((n) => need(n) && !LATER.has(n)).map((n) => run(n, pre.body?.grid ?? null, n === "shirt" ? undefined : 1))]);   // small garments in one piece each
  }
  lap("workers");
  // hair paint (anime style, not lighting): thin darker strands flowing from the crown, and a bright band (angel ring) around the top.
  // Each hair vertex gets its direction from the head's center (head space): around the head (phi) and down from the crown (theta)
  function addHairUV(geo) {
    const Pa = geo.attributes.position.array, U = new Float32Array(Pa.length / 3 * 2), S = OPT.body.sculpt.skull;
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const [x, y, z] = HTr.toHead(Pa[i], Pa[i + 1], Pa[i + 2]), dz = z + 0.005, dy = y - S.y;
      U[v * 2] = Math.atan2(x, dz); U[v * 2 + 1] = Math.atan2(Math.hypot(x, dz), dy); }
    geo.setAttribute("hairUV", new THREE.BufferAttribute(U, 2));
    geo.setAttribute("gradT", new THREE.BufferAttribute(new Float32Array(Pa.length / 3), 1));   // filled by hairGrad (once the locks are made)
  }
  // the hair's own gradient (withGrad), by height in head space: 0 at the crown, 1 at the lowest tip (as a lock's root to tip). The lowest
  // tip is the back locks' when they hang below the block: the block's lowest point was then a lock of the bangs at the temple, which turned
  // green as if it were the tip (2026-10-05, Saori's Nahida). Bangs that are part of the block (block, hime, side) stay out of it with
  // gradient.bangs off, as bangs made of locks do: a vertex is the bangs' where the bangs' own shape is on the surface
  function hairGrad() {
    const geo = parts.hair.m.geometry, ud = geo.userData, Pa = geo.attributes.position.array, n = Pa.length / 3, G = geo.attributes.gradT.array;
    if (!ud.headY) { ud.headY = new Float32Array(n); for (let v = 0; v < n; v++) ud.headY[v] = HTr.toHead(Pa[v * 3], Pa[v * 3 + 1], Pa[v * 3 + 2])[1]; }
    const Y = ud.headY; let lo = Infinity, hi = -Infinity; for (let v = 0; v < n; v++) { lo = Math.min(lo, Y[v]); hi = Math.max(hi, Y[v]); }
    for (const s of parts.locks?.sim?.specs ?? []) { const t = s.pts.at(-1); lo = Math.min(lo, HTr.toHead(t[0], t[1], t[2])[1]); }
    const GO = OPT.hair.gradient, inBlock = hairPick.bangs !== "none" && !hairKit.bangsAsLocks(hairPick), off = GO?.on && GO.bangs === false && inBlock;
    if (GO?.on && inBlock && ud.bangsOf !== hairPick.bangs) { const f = blend(hairKit.BANGS[hairPick.bangs](hairPick)); ud.bangW = new Float32Array(n); ud.bangsOf = hairPick.bangs;
      for (let v = 0; v < n; v++) { const h = HTr.toHead(Pa[v * 3], Pa[v * 3 + 1], Pa[v * 3 + 2]); ud.bangW[v] = 1 - sstep(0.01, 0.045, f(h[0], h[1], h[2])); } }   // 1 on the bangs, fading over a few cm into the rest (hime locks over a bob: the bob's lumps poking through them stayed green streaks)
    // bangs in the block, with the gradient on them: measured over the bangs alone, top 0 to their tips 1, as bangs made of locks are (by the
    // head's height their tips were about halfway: the gradient, starting further down, never reached them. 2026-10-07, Saori: only the back hair took it)
    let bl = Infinity, bh = -Infinity; if (GO?.on && inBlock && !off) for (let v = 0; v < n; v++) if (ud.bangW[v] > 0.5) { bl = Math.min(bl, Y[v]); bh = Math.max(bh, Y[v]); }
    const own = bh > bl;
    for (let v = 0; v < n; v++) { const g = (hi - Y[v]) / ((hi - lo) || 1);
      G[v] = off ? g * (1 - ud.bangW[v]) : own ? g + (Math.min(1, Math.max(0, (bh - Y[v]) / (bh - bl))) - g) * ud.bangW[v] : g; }
    geo.attributes.gradT.needsUpdate = true;
  }
  const glf = (v) => (+v).toFixed(4);
  // the ring's color when none is given: the hair color, lighter and a little warmer (brown hair → orange), so it doesn't stand out as white
  const ringOf = (c) => { const h = {}; new THREE.Color(c).getHSL(h); return new THREE.Color().setHSL(h.h + (0.075 - h.h) * 0.5, Math.min(1, h.s * 1.1 + 0.08), Math.min(0.85, h.l + 0.14)); };
  // gradients (materials.js withGrad): one set of uniforms per hair / garment, shared by all its materials (avatar.setGradient changes them at once)
  const gradU = (G) => ({ on: { value: G?.on ? 1 : 0 }, color: { value: new THREE.Color(G?.color ?? "#ffffff") }, start: { value: G?.start ?? 0.6 }, soft: { value: G?.soft ?? 0.3 } });
  const GRAD = { hair: gradU(OPT.hair.gradient), bangs: null, shirt: gradU(OPT.outfit.shirt.gradient), pants: gradU(OPT.outfit.pants.gradient), dress: gradU(OPT.outfit.dress.gradient), cape: gradU(OPT.outfit.cape.gradient) };
  // pictures on the garments (materials.js withTex): one set of uniforms per garment; the picture loads in the background (avatar.setTexture)
  const TEX_MODE = { tile: 0, wrap: 1, front: 2 }, TEX_BLEND = { over: 0, multiply: 1 }, texOf = (k) => OPT.outfit[k]?.texture;
  // each garment keeps one texture object and only its image changes (swapping in a new texture object after the first frames left most of
  // the garment sampling a stale, blank one: only a patch showed the picture)
  const texObj = () => { const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.image = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }); t.needsUpdate = true; return t; };
  const texU = (T) => ({ on: { value: 0 }, map: { value: texObj() }, mode: { value: TEX_MODE[T?.mode] ?? 0 }, scale: { value: T?.scale ?? 0.08 }, rot: { value: (T?.rotate ?? 0) * Math.PI / 180 },
    off: { value: new THREE.Vector2(T?.x ?? 0, T?.y ?? 0) }, opacity: { value: T?.opacity ?? 1 }, blend: { value: TEX_BLEND[T?.blend] ?? 0 }, src: null, load: Promise.resolve() });
  const TEX = Object.fromEntries(["shirt", "pants", "dress", "cape"].map((k) => [k, texU(texOf(k))]));
  function loadTex(k) {   // (re)load a garment's picture when its src changed; resolves when it shows (or failed: then the garment shows plain)
    const U = TEX[k], src = texOf(k)?.src ?? null; if (src === U.src) return U.load; U.src = src;
    if (!src) { U.on.value = 0; return (U.load = Promise.resolve()); }
    return (U.load = new Promise((ok) => { const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => { if (U.src === src) { const t = U.map.value; t.dispose(); t.image = im; t.needsUpdate = true; U.on.value = 1; } ok(); };   // (dispose: the GPU keeps a texture's size, a new size needs new storage)
      im.onerror = () => { console.warn(`Hinagata: couldn't load the picture for ${k} (outfit.${k}.texture.src)`); if (U.src === src) U.on.value = 0; ok(); };
      im.src = src; }));
  }
  // paint (src/paint.js): one atlas per paintable part, shown through uniforms; the editor's brush draws into a canvas behind it (paintSurface)
  const PAINT = Object.fromEntries(PAINT_TARGETS.map((k) => { const L = paintLayout(k); return [k, { on: { value: 0 }, map: { value: texObj() }, L, glsl: paintGLSL(L), src: null, surface: null, load: Promise.resolve() }]; }));
  const paintSrc = (k) => OPT.paint?.[k]?.src ?? null;
  function loadPaint(k) {   // the paint's picture into the part's atlas (or its canvas, when the brush has one)
    const U = PAINT[k], src = paintSrc(k); if (src === U.src) return U.load; U.src = src;
    const S = U.surface;
    if (!src) { if (S) { S.ctx.clearRect(0, 0, S.canvas.width, S.canvas.height); S.update(); } else U.on.value = 0; return (U.load = Promise.resolve()); }
    return (U.load = new Promise((ok) => { const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => { if (U.src === src) { if (U.surface) { const C = U.surface; C.ctx.clearRect(0, 0, C.canvas.width, C.canvas.height); C.ctx.drawImage(im, 0, 0, C.canvas.width, C.canvas.height); C.update(); }
        else { const t = U.map.value; t.dispose(); t.image = im; t.needsUpdate = true; U.on.value = 1; } } ok(); };
      im.onerror = () => { console.warn(`Hinagata: couldn't load the paint for ${k} (paint.${k}.src)`); ok(); };
      im.src = src; }));
  }
  // a part's points for the paint: where each was when made, at the base proportions, and its normal
  const paintable = (x, k) => { const g = x.m.geometry, Q = Float32Array.from(basePos(g));
    g.setAttribute("paintP", new THREE.BufferAttribute(Q, 3)); g.setAttribute("paintN", new THREE.BufferAttribute(Float32Array.from(g.attributes.normal.array), 3));
    const w = x.wrap; x.wrap = (m) => withPaint(w ? w(m) : m, PAINT[k], PAINT[k].glsl); x.m.material = withPaint(x.m.material, PAINT[k], PAINT[k].glsl); x.paint = k; };
  // x.wrap(m): what a part's material is dressed in on top of its shading (its gradient, picture, paint), so setShading puts them back on the
  // new material (2026-10-07, Saori: the bangs lost their gradient. Switching the shading left only the hair's block with it)
  const bangsGrad = (G) => G?.on && (G.bangs !== false || G.hanging !== false) ? 1 : 0;   // the bangs: the hair's, unless gradient.bangs is off (then only the tufts hanging long with gradient.hanging: their locks' grad, makeLocks)
  GRAD.bangs = { ...GRAD.hair, on: { value: bangsGrad(OPT.hair.gradient) } };
  const hairMat = (c) => { const m = shaded(OPT.shading.style, c, OPT.shading.bands), prev = m.onBeforeCompile, HP = OPT.hair.paint, St = HP.strands, R = HP.ring, LU = OPT.hair.sculpt.lumps, rc = R.color ? new THREE.Color(R.color) : ringOf(c);
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
      sh.vertexShader = "attribute vec2 hairUV;\nvarying vec2 vHair;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHair = hairUV;");
      sh.fragmentShader = "varying vec2 vHair;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  { float ph = vHair.x, th = vHair.y, N = ${glf(St.count)};
    float s = ph * N / 6.2832 + ${glf(LU?.amp ? LU.twist * St.count / LU.count : 0)} * th * sin(ph) + ${glf(St.wobble)} * sin(th * 9.0 + ph * 2.0) + 0.25 * sin(ph * N * 0.37 + 1.3);   // strand lines: around the head, wavering a little, sweeping back with the hair's bundles (lumps)
    float id = floor(s), f = fract(s), k = fract(sin(id * 12.9898) * 43758.5453);                                   // k: a random value per strand (strength / length)
    float line = (1.0 - smoothstep(0.0, ${glf(St.width)}, min(f, 1.0 - f))) * smoothstep(${glf(St.start)}, ${glf(St.start)} + 0.35, th) * step(0.25, k);
    float ring = 0.0;
    if (${R.on ? "true" : "false"}) { float z = abs(fract(ph * ${glf(R.teeth)} / 6.2832) - 0.5) * 2.0;                 // the ring's lower edge zigzags
      float lo = ${glf(R.center)} - ${glf(R.width)}, hi = ${glf(R.center)} + ${glf(R.width)} + ${glf(R.zig)} * z;
      ring = smoothstep(lo - 0.02, lo + 0.02, th) * (1.0 - smoothstep(hi - 0.02, hi + 0.02, th)) * smoothstep(-0.3, 0.3, cos(ph) + 0.4); }
    if (${St.on ? "true" : "false"}) diffuseColor.rgb *= 1.0 - ${glf(St.strength)} * line * (0.6 + 0.4 * k);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${glf(rc.r)}, ${glf(rc.g)}, ${glf(rc.b)}), ${glf(R.strength)} * ring * (1.0 - line)); }`); };
    return withGrad(withShadeN(m), GRAD.hair); };
  // the angel ring on hair made of locks (2026-10-07, Saori: "ふさタイプの髪だと天使の輪がほぼみえない"): it was painted on the block only, which
  // lies thin under the locks. The locks carry it too, by where each of their points was when they were made (hairUV, as the block's)
  const RING = { color: { value: new THREE.Color() } }, ringColor = (c) => RING.color.value.copy(OPT.hair.paint.ring.color ? new THREE.Color(OPT.hair.paint.ring.color) : ringOf(c));
  ringColor(OPT.colors.hair);
  const withRing = (m) => { const R = OPT.hair.paint.ring; if (!R.on) return m; const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.uniforms.ringColor = RING.color;
      sh.vertexShader = "attribute vec2 hairUV;\nvarying vec2 vHair;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHair = hairUV;");
      sh.fragmentShader = "uniform vec3 ringColor;\nvarying vec2 vHair;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  { float ph = vHair.x, th = vHair.y, z = abs(fract(ph * ${glf(R.teeth)} / 6.2832) - 0.5) * 2.0, lo = ${glf(R.center)} - ${glf(R.width)}, hi = ${glf(R.center)} + ${glf(R.width)} + ${glf(R.zig)} * z;
    float ring = smoothstep(lo - 0.02, lo + 0.02, th) * (1.0 - smoothstep(hi - 0.02, hi + 0.02, th)) * smoothstep(-0.3, 0.3, cos(ph) + 0.4);
    diffuseColor.rgb = mix(diffuseColor.rgb, ringColor, ${glf(R.strength)} * ring); }`); };
    m.customProgramCacheKey = () => "ring|" + key; return m; };
  const ringUV = (px, py, pz) => { const [x, y, z] = HTr.toHead(px, py, pz), dz = z + 0.005; return [Math.atan2(x, dz), Math.atan2(Math.hypot(x, dz), y - OPT.body.sculpt.skull.y)]; };   // as addHairUV, for createLocks (uvAt)

  // build every mesh
  const fast = { shirt: (x, y, z) => shirtSdf(x, y, z, bodyAt), pants: (x, y, z) => pantsSdf(x, y, z, bodyAt), sock: (x, y, z) => sockSdf(x, y, z, bodyAt) };
  const parts = {};
  const NONE = { sdf: () => 1, lo: [0, 0, 0], hi: [0.01, 0.01, 0.01], bone1: "hips" };   // an empty part (a piece built later): nothing in its tiny box
  const meshPart = (name, h = H) => { const later = LATER.has(name), s = later ? { ...NONE, h } : partSpec(name, { OPT, H: h, clothH, kit, bodyAt }), g = mesh(name, s.sdf, s.lo, s.hi, s.h, s.bone1, s.only, s.fast, s.soft);
    if (later) delete fresh[name]; return g; };   // (an empty stand-in never goes to the cache)   // the part table (parts.js) is shared with the workers
  parts.body = skinned(meshPart("body"), OPT.colors.skin, 0.005, "body"); if (mesh.last) bodyAt = gridSampler(mesh.last, bodySdf);   // (from the cache there is no grid: the clothes then read the body itself)
  lap("meshBody");
  addPaint(parts.body.m.geometry); parts.body.m.material.dispose(); parts.body.m.material = parts.body.toonMat = shadeToon(OPT.colors.skin); paintable(parts.body, "body");
  const SKO = skirtOf(OPT);   // a skirt or a dress's skirt (options.js), or null
  parts.shirt = skinned(meshPart("shirt"), SKO?.dress ? SKO.color : OPT.outfit.shirt.color, 0.005, "shirt");   // a dress: the top is the dress's color too
  parts.pants = skinned(meshPart("pants"), SKO?.color ?? OPT.outfit.pants.color, 0.005, SKO ? null : "pants");   // a skirt moves as cloth (its normals too): it keeps the mesh's own
  // a skirt drapes as cloth (cloth.js): it stays over the thighs when they turn up (sitting) instead of tearing open or letting them poke through
  // The legs it keeps clear of: capsules measured off this body (rest pose), so every body type fits (a single thigh capsule from the root to the knee
  // missed the girl's full mid-thigh). Along each thigh, at a few points from just below the hip joint to the knee: how far the body reaches
  // forward, outward and forward-out from the bone's line (the inner side and the back run into the other leg and the bottom), and the shin likewise
  const PT = OPT.outfit.pants, CM = 0.006;   // CM: the cloth's margin off the leg
  const legReach = (c) => { let rm = 0; for (const d of [[1, 0, 0], [0, 0, 1], [0.7071, 0, 0.7071], [0.7071, 0, -0.7071]]) { const dx = d[0] * Math.sign(c[0] || 1), dz = d[2]; let r = 0.02;
      for (; r < 0.16; r += 0.002) if (bodySdfR(c[0] + dx * r, c[1], c[2] + dz * r) > 0) break; rm = Math.max(rm, r); } return rm; };
  const legCols = (s) => { const h = Jr[`upperLeg.${s}`], k = Jr[`lowerLeg.${s}`], f = Jr[`foot.${s}`], at = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), out = [];
    const thigh = [0.12, 0.35, 0.6, 0.85, 1].map((t) => { const c = at(h, k, t); return [c, legReach(c) + CM]; }), shin = [0, 0.5, 0.9].map((t) => { const c = at(k, f, t); return [c, legReach(c) + CM]; });
    for (let i = 0; i + 1 < thigh.length; i++) out.push({ bone: `upperLeg.${s}`, a: thigh[i][0], b: thigh[i + 1][0], ra: thigh[i][1], rb: thigh[i + 1][1], thigh: true });
    // the shins and the feet keep the back of the cloth on their outside (away from the body's middle): a leg kicked back fast went through a long
    // skirt or robe in one step, and pushed the nearest way the cloth then lay in front of it (2026-10-05, Saori: "走ると後ろ足がローブを貫通")
    for (let i = 0; i + 1 < shin.length; i++) out.push({ bone: `lowerLeg.${s}`, a: shin[i][0], b: shin[i + 1][0], ra: shin[i][1], rb: shin[i + 1][1], thigh: false, outward: "back" });
    { const FK = OPT.body.proportion?.feet ?? 1, heel = [f[0], f[1] - 0.02, f[2] - 0.035 * FK], toe = [f[0], Math.max(0.03, f[1] - 0.04), f[2] + 0.1 * FK], ra = legReach(f) + 0.03 + CM;   // the foot with the shoe (and the cloth's own thickness: its inner side rides on the outer), heel to toe
      out.push({ bone: `foot.${s}`, a: heel, b: toe, ra, rb: ra * 0.8, thigh: false, outward: "back" }); }
    return out; };
  // between the thighs: a bridge from one to the other at a few points along them, as thick as they are there, so the skirt's front spans the
  // lap instead of sinking between the legs and showing each thigh's shape (2026-10-05, Saori: "足の形がくっきり浮き出る")
  const lapCols = () => { const at = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), out = [];
    for (const t of [0.45, 0.7, 0.9]) { const a = at(Jr["upperLeg.L"], Jr["lowerLeg.L"], t), b = at(Jr["upperLeg.R"], Jr["lowerLeg.R"], t), r = Math.min(legReach(a), legReach(b)) * 0.9 + CM;
      out.push({ bone: "upperLeg.L", boneB: "upperLeg.R", a, b, ra: r, rb: r, thigh: true }); }
    return out; };
  const cloth = SKO ? createCloth({ m: parts.pants.m, o: parts.pants.o, skeleton, root, top: ST.fwd(SKO.top), hem: ST.fwd(SKO.hem), colliders: [...legCols("L"), ...legCols("R"), ...lapCols()], body: parts.body.m, bodyRegion: { yMax: ST.fwd(0.58) } }) : null;   // (the mesh is stretched: so is the height the hips reach)
  // the cape: cloth too, hanging from the shoulders; it keeps clear of the legs and the arms, and of the body's surface from the hips to the
  // shoulders. It sways: points keep their motion in the world (cape.sway), so it trails behind when the character walks or runs
  const CA = OPT.outfit.cape;
  parts.cape = skinned(meshPart("cape"), CA.color, 0.005, null);
  const armCols = (s) => [["upperArm", "lowerArm", 0.042], ["lowerArm", "hand", 0.036]].map(([a, b, r]) => ({ bone: `${a}.${s}`, a: Jr[`${a}.${s}`], b: Jr[`${b}.${s}`], ra: r + CM + CA.thick, rb: r + CM + CA.thick, thigh: false, outward: true }));   // + the cape's thickness: its inner side rides on the outer one (cloth.js) and went into the arm
  const capeCloth = CA.on ? createCloth({ m: parts.cape.m, o: parts.cape.o, skeleton, root, top: ST.fwd(CA.collar + 0.01), hem: ST.fwd(CA.hem), colliders: [...legCols("L"), ...legCols("R"), ...armCols("L"), ...armCols("R")], body: parts.body.m,
    bodyRegion: { yMax: capeTop(Jr) + 0.04, bones: ["hips", "spine", "chest", "upperChest", "shoulder.L", "shoulder.R", "upperLeg.L", "upperLeg.R", "lowerLeg.L", "lowerLeg.R"] }, sway: CA.sway ?? 1, air: CA.air ?? 0 }) : null;
  // a garment's gradient runs from its top (0) to its hem (1); a dress's from the collar down to the skirt's hem, over both parts
  { const gradT = (list, key) => { const U = GRAD[key]; let lo = Infinity, hi = -Infinity; for (const x of list) { const P = x.m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } }
      for (const x of list) { const P = x.m.geometry.attributes.position.array, G = new Float32Array(P.length / 3); for (let v = 0; v < G.length; v++) G[v] = (hi - P[v * 3 + 1]) / ((hi - lo) || 1);
        x.m.geometry.setAttribute("gradT", new THREE.BufferAttribute(G, 1));
        x.m.geometry.setAttribute("texP", new THREE.BufferAttribute(Float32Array.from(P), 3)); x.m.geometry.setAttribute("texN", new THREE.BufferAttribute(Float32Array.from(x.m.geometry.attributes.normal.array), 3));   // where each point was when made (the picture stays on the cloth when it moves)
        x.wrap = (m) => withTex(withGrad(m, U), TEX[key]); x.m.material = x.wrap(x.m.material); paintable(x, key); } };
    if (SKO?.dress) gradT([parts.shirt, parts.pants], "dress"); else { gradT([parts.shirt], "shirt"); gradT([parts.pants], "pants"); }
    if (CA.on) gradT([parts.cape], "cape"); }
  await Promise.all([...Object.keys(TEX).map(loadTex), ...PAINT_TARGETS.map(loadPaint)]);   // the pictures given in the options show from the first frame
  parts.shoes = skinned(meshPart("shoes"), OPT.outfit.shoes.color, 0.005, "shoes");
  parts.soles = skinned(meshPart("soles"), OPT.outfit.shoes.soleColor, 0.005, "soles");
  parts.laces = skinned(meshPart("laces"), OPT.outfit.shoes.laceColor, 0.002);   // laced sneakers' laces (empty otherwise)
  parts.socks = skinned(meshPart("socks"), OPT.outfit.socks.color, 0.003, "socks");
  // the full-body suit (outfit.suit): its second color (accent) on the collar, the cuffs at the wrists, the boots (the feet and ankles) and
  // panels down the sides, painted by where each point is (base proportions) and which way it faces, as a gradient of two steps (withGrad)
  const SUIT = { on: { value: 1 }, color: { value: new THREE.Color(OPT.outfit.suit?.accent ?? "#d8433f") }, start: { value: 0.5 }, soft: { value: 0.04 } };
  parts.suit = skinned(meshPart("suit"), OPT.outfit.suit?.color ?? "#f1f1f4", 0.003, "suit");
  { const g = parts.suit.m.geometry, Pa = basePos(g), N = g.attributes.normal.array, T = new Float32Array(Pa.length / 3);
    for (let v = 0; v < T.length; v++) { const x = Pa[v * 3], y = Pa[v * 3 + 1], z = Pa[v * 3 + 2], nx = Math.abs(N[v * 3]);
      let a = Math.max(sstep(0.772, 0.782, y), 1 - sstep(0.115, 0.125, y));   // the collar, the boots
      for (const W of WRISTS) { const q = [x - W.h[0], y - W.h[1], z - W.h[2]], t = q[0] * W.d[0] + q[1] * W.d[1] + q[2] * W.d[2]; if (Math.hypot(...q) < 0.12 && t > -0.045) a = 1; }   // the cuffs
      if ((y > 0.2 && y < 0.6) || (Math.abs(x) > 0.19 && y < 0.74)) a = Math.max(a, sstep(0.84, 0.9, N[v * 3] * Math.sign(x)));   // down the outer sides (of the body under the chest, the legs, the arms)
      T[v] = a; }
    g.setAttribute("gradT", new THREE.BufferAttribute(T, 1)); parts.suit.wrap = (m) => withGrad(m, SUIT); parts.suit.m.material = parts.suit.wrap(parts.suit.m.material); }
  const AO = OPT.outfit.armor, DECO_COLOR = { plume: "#d6453d", horns: "#eee3c9", wings: "#f6f3ec" }, armorColor = (k) => k === "armorMail" ? AO.mailColor : k === "armorVisor" ? AO.visorColor : k === "armorDeco" ? (AO.decoColor ?? DECO_COLOR[AO.deco] ?? AO.color) : AO.color, isMetal = (k) => (k === "weaponR" || k === "weaponL") || ARMOR.includes(k) && !["armorMail", "armorVisor", "armorDeco"].includes(k);
  const armorPart = (k) => { const x = skinned(meshPart(k), armorColor(k), k === "armorMail" ? 0.003 : 0.004); if (isMetal(k)) { x.m.material.dispose(); x.m.material = metal(OPT.shading.style, AO.color); } return x; };
  for (const k of ARMOR) parts[k] = armorPart(k);   // armor: hard pieces (clothes/armor.js, plate.js), shiny; full plate also has mail under it and a dark slab behind the visor
  const WO = OPT.outfit.weapon, weaponColor = (k) => k === "weaponRGrip" || k === "weaponLGrip" || k === "weaponBelt" ? WO.gripColor : k === "weaponLFace" ? WO.shieldColor : k === "weaponSheath" ? WO.sheathColor ?? "#4a3326" : WO.color;   // (the belt in the grip's leather, the scabbard its own)
  for (const k of WEAPONS) { parts[k] = skinned(meshPart(k), weaponColor(k), 0.004); if (k === "weaponR" || k === "weaponL") { parts[k].m.material.dispose(); parts[k].m.material = metal(OPT.shading.style, WO.color); } }   // in the hands (clothes/weapons.js)
  const showSheath = (on) => { for (const k of ["weaponSheath", "weaponBelt"]) parts[k].m.visible = parts[k].o.visible = on; };   // the belt and the scabbard (weapon.sheath): shown or hidden, no rebuild
  showSheath(WO.sheath !== false);
  lap("shadeAndClothes");
  const makeHair0 = (h) => skinned(meshPart(hairPartName(hairPick), h), OPT.colors.hair, 0.004, "hair");
  const makeHair = (h) => { const x = makeHair0(h); addHairUV(x.m.geometry); x.m.material.dispose(); x.m.material = hairMat(OPT.colors.hair); return x; };
  parts.hair = makeHair(H);
  // hair as locks (hair/locks.js): flat ribbons with sharp tips, each a chain that swings. Long hair: locks hanging from the back of the head
  // over the short hair's block (hair/index.js leaves the long curtain out when hair.sculpt.long.locks is on). The nendo bangs: one lock
  // per tip of hair.sculpt.nendo.tips (with nendo.locks on), lying over the forehead
  // the hair's outline off the hair only (outline.hairInner false; 2026-10-05, Saori: "髪の部分にやたら線がおおい、内側の房には輪郭線出さない"):
  // every lock has its own outline shell, and where a lock lies over another lock (or over the hair's block) its shell drew a line across
  // the hair. The hair's surfaces mark the pixels they draw (stencil 1); the hair's outlines are drawn after them, only where no hair was
  // drawn: its outer edge and where it lies over the face, the body or the clothes keep their line. (The ties keep theirs everywhere.)
  // Checked each update: the hair's materials are replaced by rebuilds (locks, tails, bangs) and by setShading
  // "front" (default; Saori: "後ろ髪のことだった。前はあっさりしちゃうから"): the bangs and drawn locks keep their lines everywhere, the back
  // hair's block, its locks and the tails draw theirs only off the hair. "none": no hair outline over the hair. "all": the lines as before
  // rim light (shading.rim; 2026-10-07, Saori: "リムライトいれてみたい"): a bright edge where the surface turns away from the view, on every lit
  // material of the character (not the outlines). Shared uniforms (avatar.setRim changes them at once); materials made later (rebuilt locks,
  // setShading) get it on the next update (rims)
  const RO = OPT.shading.rim ?? {}, RIM = { rimOn: { value: RO.on ? 1 : 0 }, rimColor: { value: new THREE.Color(RO.color ?? "#fff4e0") }, rimWidth: { value: RO.width ?? 0.35 }, rimStrength: { value: RO.strength ?? 0.5 } };
  let rimUsed = !!RO.on;
  function withRim(m) {
    if (!m || m.userData.rim || !(m.isMeshToonMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
    const prev = m.onBeforeCompile, key = m.customProgramCacheKey(); m.userData.rim = true;
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, RIM);
      sh.fragmentShader = "uniform float rimOn, rimWidth, rimStrength;\nuniform vec3 rimColor;\n" + sh.fragmentShader.replace("#include <opaque_fragment>",
        "{ float rf = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0); outgoingLight += rimColor * rimOn * rimStrength * smoothstep(1.0 - rimWidth, 1.0, rf); }\n#include <opaque_fragment>"); };
    m.customProgramCacheKey = () => "rim|" + key; m.needsUpdate = true;
  }
  function rims() { if (!rimUsed) return; for (const x of Object.values(parts)) withRim(x.m.material); if (faceLayer) withRim(faceLayer.material); }
  const HAIR_FILL = ["hair", "locks", "bangs", "drawn", "tails"], HAIR_BACK = ["hair", "locks", "tails"];
  function hairLines() {
    const v = OPT.outline.hairInner, mode = v === true ? "all" : v === false ? "none" : v ?? "front";
    for (const k of HAIR_FILL) { const x = parts[k]; if (!x) continue; const f = x.m.material, o = x.o.material;
      const write = mode !== "all", test = mode === "none" || (mode === "front" && HAIR_BACK.includes(k));
      if (f.userData.hairStencil !== write) { Object.assign(f, { stencilWrite: write, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }); f.userData.hairStencil = write; }
      if (o.userData.hairStencil !== test) { Object.assign(o, { stencilWrite: test, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp }); o.userData.hairStencil = test; }
      x.o.renderOrder = test ? 1 : 0; }
  }
  // a lock cut straight across (the hime cut's): as wide to its end (spec.blunt thins it there into a straight edge: the mesh has no cap)
  const HIME_END = (t) => 1 + 0.06 * Math.sin(Math.PI * Math.min(1, t * 1.4));
  const LOCK_PARTS = ["locks", "bangs", "drawn", "tails", "tailTie"];   // tails: pony / twin / side tails (options.hair.tail), tailTie: their hair ties   // drawn: locks drawn by hand (options.hair.drawn, see drawnLocks in hair/locks.js)
  // the surface the bang locks lie on (head space): the hair under them and the forehead
  let bangKitMemo = null, tailAnchors = [];   // tailAnchors: where the tails are tied now (avatar.tailTies)   // the same until the hair under the bangs changes (setHair)
  // the skull's ball is in it too: the head's base is cut off level behind the ears (chin.napeY), and under it there is only the neck, so a
  // side tuft ending low (below the base) lay on the neck as a thin stick behind the ear. The ball keeps the tufts out where the head was round
  const bangKit = () => bangKitMemo ??= (() => { const capRaw = hairKit.hairSdfOf(hairPick), SK = OPT.body.sculpt.skull; return { surf: (x, y, z) => Math.min(capRaw(x, y, z), bodySdfRaw(x, y, z), dPrim(P.skull, x, y, z)), center: [0, SK.y, -0.005], toRoot: (x, y, z) => HTr.fromHead(x, y, z), sx: HT.sx }; })();
  function makeLocks(which = LOCK_PARTS) {   // which: the lock parts to make (e.g. ["bangs"] when only the bangs changed)
    const L = OPT.hair.sculpt.long, SL = OPT.hair.sculpt.shortLocks, out = {}, longOn = which.includes("locks") && hairPick.back === "long" && L.locks, shortOn = which.includes("locks") && ["short", "hang", "bob", "flip"].includes(hairPick.back) && SL?.on, bangsOn = which.includes("bangs") && hairKit.bangsAsLocks(hairPick);
    const drawnOn = which.includes("drawn") && (OPT.hair.drawn ?? []).some((d) => d?.pts?.length >= 2);
    const TL = OPT.hair.tail, tailsOn = which.includes("tails") && TL?.kind && TL.kind !== "none";
    if (which.includes("tails") && !tailsOn) tailAnchors = [];
    if (!longOn && !shortOn && !bangsOn && !drawnOn && !tailsOn) return out;
    const capRaw = hairKit.hairSdfOf(hairPick), cap = HTr.wrap(capRaw), c = HTr.fromHead(0, 1.125, -0.02);
    const outward = (x, y, z, M) => { const e = M.elements, cx = e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12], cy = e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13], cz = e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14];
      return [x - cx, Math.max(0, y - cy), z - cz]; };   // from the head's center, or from the line under it (hair hanging down faces out sideways)
    const part = (specs, opt, U = GRAD.hair) => { const sim = createLocks({ specs, head: BI.head, skeleton, root, outward, lite: LITE, uvAt: ringUV, ...opt }), x = skinned(sim.geometry, OPT.colors.hair, 0.003); x.wrap = (m) => withGrad(withRing(m), U); x.m.material = x.wrap(x.m.material); x.sim = sim; return x; };
    if (longOn || shortOn) {
      const ell = { c, r: [surfaceAlong(cap, c, [1, 0, 0]), surfaceAlong(cap, c, [0, 1, 0]), surfaceAlong(cap, c, [0, 0, -1])] };   // the hair under the locks, as an ellipsoid (for the locks to slide over)
      const coll = lockColliders(Jr, BI, bodySdfR);
      if (longOn) out.locks = part(longLocks(L, { cap, center: c, coll, ellipsoid: ell, hugY: L.hug ? HTr.fromHead(0, L.yc, 0)[1] : null }), { coll, ell, stiff: L.stiff ?? 1, damping: L.damping ?? 0.9 });
      else if (hairPick.back === "bob" || hairPick.back === "flip") {   // a bob or a flip in locks: hanging from the back of the head as the short hair's do, further round to the front, down to that style's hem; the bob's tips curl in a little, the flip's out and up
        const BL = { ...SL, ...OPT.hair.sculpt[hairPick.back + "Locks"] }, B = hairKit.BACKS[hairPick.back], bottom = (th) => HTr.fromHead(0, B.side - (B.side - B.back) * Math.sqrt(Math.max(0, -Math.cos(th))) - (BL.below ?? 0), 0)[1];
        out.locks = part(ringLocks(BL, { cap, center: c, coll, ellipsoid: ell, bottom, N: 10 }), { coll, ell, stiff: BL.stiff ?? 3, damping: 0.85 }); }
      else { const B = hairKit.BACKS.short, bottom = (th) => HTr.fromHead(0, B.side - (B.side - B.back) * Math.sqrt(Math.max(0, -Math.cos(th))) - (SL.below ?? 0.02), 0)[1];   // short hair: locks over the block down to its hem (lower at the nape: a U across the back, not a V)
        out.locks = hairPick.back === "hang" ? part(ringLocks(SL, { cap, center: c, coll, ellipsoid: ell, bottom, N: 8 }), { coll, ell, stiff: SL.stiff ?? 3, damping: 0.85 })   // hanging: draped from the back of the head, standing off the nape (which shows under them)
          : part(surfaceLocks({ ...SL, ...SL.lie }, { cap, center: c, bottom }), { coll: [], ell: null, stiff: SL.stiff ?? 3, damping: 0.85 }); }   // lying on the hair: no colliders (they would push the locks off the nape's inward curve)
    }
    if (bangsOn) {
      // the hime cut in locks (2026-10-07, Saori: "姫カットの毛束タイプ"): the same locks from its own tips (a straight fringe, side locks to the
      // cheeks), each ending square instead of in a point (HIME_END)
      const HIME = hairPick.bangs === "hime", B = HIME ? { ...OPT.hair.sculpt.nendo, lockHangY: 0.97, lockRise: 0, lockTipSpread: 1, ...OPT.hair.sculpt.hime } : OPT.hair.sculpt.nendo;   // (its side locks hang from the side of the head: their tips are by the chin, where no hair lies)
      const specs = hairPick.bangs === "side" ? sideLocks(hairKit.SIDE, bangKit()) : bangLocks(B, bangKit()), long = specs.some((sp) => sp.stiff < 1);   // a tuft hanging long keeps off the neck, the shoulders and the chest
      if (HIME) for (const sp of specs) { sp.prof = HIME_END; sp.blunt = 0.06; }
      const GO = OPT.hair.gradient; if (GO?.bangs === false && GO.hanging !== false) for (const sp of specs) sp.grad = sp.hang ? 1 : 0;   // gradient.hanging: with the bangs left out, the tufts hanging long still take it (Nahida's side locks)
      out.bangs = part(specs, { coll: long ? lockColliders(Jr, BI, bodySdfR) : [], ell: null, floor: true, stiff: B.lockStiff ?? 4, damping: long ? 0.88 : 0.8 }, GRAD.bangs);   // floor: not into the forehead (createLocks)
    }
    if (tailsOn) {   // the ties: on the hair at an angle around the head (degrees, 0 = front; twin tails mirrored) and a height (head space)
      const K = bangKit(), D2R = Math.PI / 180, sd = TL.side === "R" ? -1 : 1;
      const def = { pony: [[180, 1.13]], twin: [[105, 1.1], [-105, 1.1]], side: [[sd * 100, 1.07]] }[TL.kind] ?? [];
      const anchors = def.map(([a0, y0]) => { const a = (TL.angle ?? Math.abs(a0)) * (a0 < 0 ? -1 : 1) * (TL.kind === "side" ? sd * Math.sign(a0) : 1), y = TL.y ?? y0;
        const d = [Math.sin(a * D2R), 0, Math.cos(a * D2R)], c0 = [0, y, -0.005], t = surfaceAlong(K.surf, c0, d) + 0.004;
        const up = TL.kind === "pony" ? 0.35 : 0.12, ol = Math.hypot(d[0], up, d[2]);   // outward: away from the head, a little up (a ponytail more)
        return { p: HTr.fromHead(c0[0] + d[0] * t, c0[1], c0[2] + d[2] * t), o: [d[0] / ol, up / ol, d[2] / ol] }; });
      tailAnchors = anchors;
      const ell = { c, r: [surfaceAlong(cap, c, [1, 0, 0]), surfaceAlong(cap, c, [0, 1, 0]), surfaceAlong(cap, c, [0, 0, -1])] }, coll = lockColliders(Jr, BI, bodySdfR);
      out.tails = part(tailLocks(TL, { anchors, coll, ell }), { coll, ell, stiff: TL.stiff ?? 1, damping: 0.9 });
      if (TL.tie?.on) {   // a hair tie: a ring around each bundle at its tie, on the head bone
        const geos = anchors.map(({ p, o }) => { const ts = TL.tie.size ?? 1, g = new THREE.TorusGeometry(TL.volume * (TL.size ?? 1) * 0.5 + 0.008, 0.01 * ts, 8, 24);   // around the bundle where it has left the head
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...o))); g.translate(p[0] + o[0] * 0.026, p[1] + o[1] * 0.026, p[2] + o[2] * 0.026); return g; });
        const g = new THREE.BufferGeometry(), Pm = [], Nm = [], Im = []; for (const q of geos) { const o0 = Pm.length / 3; Pm.push(...q.attributes.position.array); Nm.push(...q.attributes.normal.array); for (const i of q.index.array) Im.push(i + o0); }
        g.setAttribute("position", new THREE.Float32BufferAttribute(Pm, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(Nm, 3)); g.setIndex(Im);
        const nv = g.attributes.position.count, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4); for (let v = 0; v < nv; v++) { si[v * 4] = BI.head; sw[v * 4] = 1; }
        g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
        out.tailTie = skinned(g, TL.tie.color, 0.003); out.tailTie.sim = { update() {}, rest() {} }; }
    }
    if (drawnOn) out.drawn = part(drawnLocks(OPT.hair.drawn, { toRoot: (x, y, z) => HTr.fromHead(x, y, z) }), { coll: lockColliders(Jr, BI, bodySdfR), ell: null, stiff: 1, damping: 0.86 });
    return out;
  }
  Object.assign(parts, makeLocks()); hairGrad();
  // extras (outfit.extras, clothes/extras.js): animal ears and their inner side (on the head), wings (the upper back), a tail (one lock from
  // the hips: it swings), a halo (a ring over the head, made with the ear line below). Their colors: null = the hair's (a devil's: dark; an angel's wings: white)
  const XO = OPT.outfit.extras ?? {}, XC = { ears: () => XO.earColor ?? OPT.colors.hair, earsIn: () => XO.earInColor ?? "#f2b9c2", tail: () => XO.tailColor ?? (XO.tail === "devil" ? "#2b2030" : OPT.colors.hair), wings: () => XO.wingColor ?? (XO.wings === "devil" ? "#2b2030" : "#f7f4ee") };
  parts.extraEars = skinned(meshPart("extraEars"), XC.ears(), 0.004);
  parts.extraEarsIn = skinned(meshPart("extraEarsIn"), XC.earsIn(), 0.0015);
  parts.extraWings = skinned(meshPart("extraWings"), XC.wings(), 0.004);
  { const spec = tailSpec(XO.tail, { hips: Jr.hips, back: surfaceAlong(bodySdfR, Jr.hips, [0, 0, -1]), size: XO.tailSize ?? 1 }), c = Jr.hips;
    if (spec) { const outward = (x, y, z, M) => { const e = M.elements; return [x - (e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12]), y - (e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13]), z - (e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14])]; };
      const sim = createLocks({ specs: [spec], head: BI.hips, skeleton, root, outward, lite: LITE, coll: lockColliders(Jr, BI, bodySdfR), ell: null, stiff: 1, damping: 0.88 });
      parts.extraTail = skinned(sim.geometry, XC.tail(), 0.003); parts.extraTail.sim = sim; } }
  lap("hair");
  // what is worn (options.outfit.*.on): the meshes are built either way, so putting a garment on later is instant
  const GARMENTS = { shirt: ["shirt"], pants: ["pants"], socks: ["socks"], suit: ["suit"], shoes: ["shoes", "soles", "laces"], cape: ["cape"], armor: ARMOR };
  const show = (k, on) => { const x = parts[k]; x.on = x.m.visible = x.o.visible = on; };
  // a dress is the shirt and the pants made one garment: while it is on, their own on / off doesn't take it off (taking off the pants
  // under a dress took its skirt away, 2026-10-05; dress.on puts the dress on and off)
  const isDress = (g) => !!OPT.outfit.dress?.on && (g === "shirt" || g === "pants"), worn = (g) => OPT.outfit[g].on !== false || isDress(g);
  const wear = (g, on) => { OPT.outfit[g].on = on;
    if (g === "armor" && on && LATER.size) for (const k of ARMOR) { const x = parts[k]; for (const m of [x.m, x.o]) { root.remove(m); m.geometry.dispose(); } x.m.material.dispose(); x.o.material.dispose(); LATER.delete(k); parts[k] = armorPart(k); }   // built now (see LATER)
    for (const k of GARMENTS[g]) show(k, on || isDress(g));
    if (AO.style === "full") { const plate = OPT.outfit.armor.on;   // full plate hides the clothes and the hair (they would poke out between the plates); taking it off brings back what is worn
      if (g === "armor") { for (const h of ["shirt", "pants", "socks", "shoes", "cape"]) for (const k of GARMENTS[h]) show(k, !plate && worn(h)); show("hair", !plate); for (const k of LOCK_PARTS) if (parts[k]) show(k, !plate); }
      else if (plate) for (const k of GARMENTS[g]) show(k, false); } };
  for (const g in GARMENTS) if (OPT.outfit[g].on === false) wear(g, false);
  if (AO.on) wear("armor", true);
  // accessories (options.accessories, src/accessories.js): small meshes, each on one bone; parts "acc<i>" (a mirrored item: "acc<i>.<k>")
  let accKeys = [];
  function makeAccessories() {
    for (const k of accKeys) { const x = parts[k]; for (const m of [x.m, x.o]) { root.remove(m); m.geometry.dispose(); } delete parts[k]; } accKeys = [];
    (OPT.accessories ?? []).forEach((it, i) => { if (!it?.kind || !it.bone) return;
      accessoryGeometries(it, { J: Jr, PARENT, fromHead: (x, y, z) => HTr.fromHead(x, y, z) }).forEach(({ geo, bone }, k) => {
        const nv = geo.attributes.position.count, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4); for (let v = 0; v < nv; v++) { si[v * 4] = BI[bone]; sw[v * 4] = 1; }
        geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
        const key = k ? `acc${i}.${k}` : `acc${i}`; parts[key] = skinned(geo, it.color ?? "#e8c25a", 0.0025); accKeys.push(key); }); });
  }
  makeAccessories();
  // ear line: a thin drawn line inside each ear (anime style), as a small tube lying on the ear's front, attached to the head bone
  const EL = OPT.face.earLine; let earLine = null;
  if (EL.on) { earLine = new THREE.Group(); earLine.name = "earLine"; const mat = new THREE.MeshBasicMaterial({ color: EL.color }), deg = Math.PI / 180;
    root.updateMatrixWorld(true); const inv = bone.head.matrixWorld.clone().invert();
    for (const E of EARS) { const pts = [], N = 24;
      for (let i = 0; i <= N; i++) { const a = (EL.a0 + (EL.a1 - EL.a0) * i / N) * deg, ph = [0, 1, 2].map((k) => E.c[k] + (E.eu[k] * (EL.cu + Math.cos(a) * EL.ru) + E.ev[k] * (EL.cv + Math.sin(a) * EL.rv) + E.ew[k] * 0.05) * E.ES);
        // slide back onto the ear's front in head space (against the head as it is made, bodySdfRaw), then into the root: sliding in the root
        // along the head's direction landed off the ear (the head's transform isn't a plain scale: it shifts with depth), and the line sat beside it (2026-10-07)
        let p = ph; const d = E.ew;
        for (let t = 0; t < 60; t++) { const f = bodySdfRaw(...p); if (f < 0.0004) break; p = p.map((v, k) => v - d[k] * Math.min(f, 0.01)); }
        pts.push(new THREE.Vector3(...HTr.fromHead(p[0] + d[0] * EL.lift, p[1] + d[1] * EL.lift, p[2] + d[2] * EL.lift))); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, EL.width, 6, false); g.applyMatrix4(inv); earLine.add(new THREE.Mesh(g, mat)); }
    bone.head.add(earLine); }
  // stars circling over the head while a pose asks for them (`stars`: stun, motion/combat.js; 2026-10-07, Saori: "気絶ピヨピヨ"): five small
  // unlit stars on a tilted ring, carried by the head, made at rest now and shown in update
  const stars = (() => { root.updateMatrixWorld(true); const SK = OPT.body.sculpt.skull, c = HTr.fromHead(0, SK.y + SK.height + 0.05, -0.01), r = Math.hypot(...[0, 1, 2].map((i) => HTr.fromHead(0.16, SK.y, 0)[i] - HTr.fromHead(0, SK.y, 0)[i]));
    const s = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, q = (i % 2 ? 0.42 : 1) * r * 0.22; s[i ? "lineTo" : "moveTo"](Math.cos(a) * q, Math.sin(a) * q); }
    const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.04, bevelEnabled: false }), mat = new THREE.MeshBasicMaterial({ color: "#ffd84a" });
    const grp = new THREE.Group(); grp.name = "stars"; grp.visible = false; grp.userData.r = r;
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(g, mat); grp.add(m); }
    const local = bone.head.worldToLocal(new THREE.Vector3(...c)); grp.position.copy(local); bone.head.add(grp); return grp; })();
  // the halo (outfit.extras.halo): a flat ring floating over the head, tilted back a little, unlit (it glows), carried by the head
  let halo = null;
  if (XO.halo) { root.updateMatrixWorld(true); const SK = OPT.body.sculpt.skull, top = HTr.fromHead(0, SK.y + SK.height + 0.1, -0.03), r = Math.hypot(...[0, 1, 2].map((i) => HTr.fromHead(0.12, SK.y, 0)[i] - HTr.fromHead(0, SK.y, 0)[i]));
    const g = new THREE.TorusGeometry(r, r * 0.085, 10, 56); g.rotateX(Math.PI / 2 - 0.22); g.translate(...top); g.applyMatrix4(bone.head.matrixWorld.clone().invert());
    halo = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: XO.haloColor ?? "#ffe27a" })); halo.name = "halo"; bone.head.add(halo); }

  lap("earLine");
  // face: parts drawn into a texture on a thin copy of the front of the head
  let faceDrawHook = null, faceWrap = debug.faceWrap ?? null, blinking = false, blinkAt = 2.5;
  const face = createFace(OPT, { FACE_DY, onImage: () => avatar.drawFace() });
  const FP = OPT.face.parts, faceSel = { eyes: FP.eyes, brows: FP.brows, mouth: FP.mouth, cheeks: FP.cheeks, nose: FP.nose ?? (OPT.face.noseShadow.on ? "shadow" : "none") };   // nose null: follow noseShadow.on
  const FACE0 = { eyes: FP.eyes, brows: FP.brows, mouth: FP.mouth, cheeks: FP.cheeks };   // the face it was built with: setFace("normal") comes back to it unless face.expressions.normal says otherwise
  let faceLayer = null;
  function buildFaceLayer() {
    const g = face.faceLayerGeometry(parts.body.m.geometry, faceWrap, HTr.identity ? null : HTr.toHead);
    const mat = faceLayer ? faceLayer.material : face.faceMat;   // setShading で替えた材質を引きつぐ
    if (faceLayer) { root.remove(faceLayer); faceLayer.geometry.dispose(); }
    faceLayer = new THREE.SkinnedMesh(g, mat); faceLayer.name = "face"; faceLayer.frustumCulled = false; faceLayer.renderOrder = 1; root.add(faceLayer); faceLayer.bind(skeleton);
  }
  buildFaceLayer();

  lap("faceLayer");
  // body under the clothes: triangles whose three corners all sit deep inside a garment that is showing are left out of the body's index
  // (the outline shares the geometry). They never show, and skipping them makes drawing lighter. Follows each garment's .m.visible,
  // so taking a garment off (or a clay view) brings the body back. Socks are left alone: the leg sits only ~2 mm inside them.
  const COVER = [["shirt", fast.shirt], ["pants", fast.pants], ["shoes", shoeSdf]], COVER_DEPTH = 0.006;   // m inside the garment
  const bodyGeo = parts.body.m.geometry, fullIdx = bodyGeo.index, coverIdx = new Map();
  let coverBits = null, coverSig = -1;
  if (cull) { const Pa = basePos(bodyGeo), kept = building && hit?.cover;   // remembered with the meshes (same shape, same answer; recomputing reads the whole body ~0.25 s)
    if (kept && kept.length === Pa.length / 3) coverBits = kept;
    else { coverBits = new Uint8Array(Pa.length / 3);
      COVER.forEach(([, f], b) => { for (let v = 0; v < coverBits.length; v++) if (f(Pa[v * 3], Pa[v * 3 + 1], Pa[v * 3 + 2]) < -COVER_DEPTH) coverBits[v] |= 1 << b; });   // (the garments' shapes are at the base proportions)
      fresh.cover = coverBits; } }
  function syncCover() {
    if (!coverBits) return;
    let sig = 0; COVER.forEach(([k], b) => { if (parts[k].m.visible) sig |= 1 << b; });
    if (sig === coverSig) return; coverSig = sig;
    if (!coverIdx.has(sig)) { const I = fullIdx.array, out = [];
      for (let i = 0; i < I.length; i += 3) if (!((coverBits[I[i]] & sig) && (coverBits[I[i + 1]] & sig) && (coverBits[I[i + 2]] & sig))) out.push(I[i], I[i + 1], I[i + 2]);
      coverIdx.set(sig, new THREE.BufferAttribute(new Uint32Array(out), 1)); }
    bodyGeo.setIndex(sig ? coverIdx.get(sig) : fullIdx);
  }

  lap("cover");
  // motion
  const HEEL = OPT.outfit.shoes.kind === "heels" ? heelPose(OPT, Jr) : null, heelOn = () => HEEL && OPT.outfit.shoes.on !== false && !(AO.on && AO.style === "full");   // high heels tilt the feet while worn
  const playPose = createPosePlayer({ bone, BONES, HIPS0, HANDS, yK: ST.legK, skirtFlare: (SKO?.flare ?? 0) * 0.8, footTilt: () => heelOn() ? HEEL.theta : 0, lift: () => heelOn() ? HEEL.lift : 0, weapon: OPT.outfit.weapon?.right ?? "none", left: OPT.outfit.weapon?.left ?? "none", shieldMount: OPT.outfit.weapon?.shieldMount ?? "diagonal", held: () => heldGrip });
  let poseName = "aPose", time = 0, lastPose = { b: {} }, follower = null, blendT = null;   // follower: the rig this avatar dresses (follow); blendT: play's blend
  // The joints to pose by hand (avatar.joints, 2026-10-06, Saori: Hinagata is there to save a game's makers time, and an agent writing a
  // tennis swing straight onto the bones lost ~20 min to the A-pose rest (arms 44° down: "forward" with x swung them out sideways), the
  // twist and the racket's angle). The bind pose stays as it is (it is the one the body is built and skinned in); the joints are a plain
  // tree of Groups inside the avatar's object, rotations zero at rest, axes the world's, the arms hanging at the sides (as in idle: straight
  // down they'd be in the hips), and the avatar follows them (follow.js, its own rig). A game poses them as it would its own mannequin.
  const RIG = ["hips", "spine", "chest", "upperChest", "neck", "head", ...["L", "R"].flatMap((s) => ["upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"].map((b) => `${b}.${s}`))];
  let rig = null, heldGrip = null; const held = {};   // held: what avatar.hold put in each hand ({ wrap, object })
  function makeRig() {
    const V = (a) => new THREE.Vector3(...a), Qe = (a) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(a ?? [0, 0, 0]))), idle = POSES.idle(0).b, at = {};
    for (const b of RIG) at[b] = V(Jr[b]);
    for (const s of ["L", "R"]) { const ua = `upperArm.${s}`, la = `lowerArm.${s}`, h = `hand.${s}`, qU = Qe(idle[ua]), qL = qU.clone().multiply(Qe(idle[la]));
      at[la] = at[ua].clone().add(V(Jr[la]).sub(V(Jr[ua])).applyQuaternion(qU)); at[h] = at[la].clone().add(V(Jr[h]).sub(V(Jr[la])).applyQuaternion(qL)); }
    const g = {}, up = (b) => { for (let p = PARENT[b]; p; p = PARENT[p]) if (g[p]) return p; return null; };
    for (const b of RIG) { const o = g[b] = new THREE.Group(); o.name = `joint:${b}`; const p = up(b); o.position.copy(at[b]).sub(p ? at[p] : new THREE.Vector3()); (p ? g[p] : root).add(o); }
    const f = createFollower({ avatar, POSES, J: Jr, PARENT, BONES, legK: ST.legK ?? 1, joints: g, root, fit: false, hide: false, place: false });
    return { f, joints: g, hipsY: g.hips.position.y };
  }
  const rigOf = () => rig ??= makeRig();
  // seat fit (poses with seat: h): the bottom rests on the seat. A few hundred vertices of the bottom and the backs of the thighs (body and pants)
  // are skinned each frame; the lowest of the visible ones sets how much the hips go up or down (seatAdj, added to the pose's own hip height)
  const SEAT_PROBE = ["body", "pants"].map((k) => { const m = parts[k].m, A = m.geometry.attributes.position, idx = [];
    for (let i = 0; i < A.count; i++) { const x = A.getX(i), y = A.getY(i), z = A.getZ(i); if (Math.abs(x) < 0.17 && y > 0.22 && y < 0.5 && z > -0.16 && z < 0.12) idx.push(i); }
    const step = Math.max(1, Math.ceil(idx.length / 500)); return { m, idx: idx.filter((_, j) => j % step === 0) }; });
  const seatV = new THREE.Vector3(); let seatAdj = 0, lastRoot = null; const wind = [0, 0, 0], rootV = [0, 0];
  // the simulation's level of detail (update's camera): the character's height on the screen, as a share of the view's height
  let simDt = 0, simN = Math.floor(Math.random() * 4), detailNow = "full";   // (simN starts anywhere: several characters at "half" or "low" take their frames in turns)
  const dC = new THREE.Vector3(), dE = new THREE.Vector3(), dS = new THREE.Sphere(), dF = new THREE.Frustum(), dM = new THREE.Matrix4();
  function detailFor(cam) {
    root.updateMatrixWorld(); cam.updateMatrixWorld();
    const h = 1.4 * root.matrixWorld.getMaxScaleOnAxis(); dC.setFromMatrixPosition(root.matrixWorld); dC.y += h * 0.5;
    dF.setFromProjectionMatrix(dM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    if (!dF.intersectsSphere(dS.set(dC, h * 0.7))) return "off";
    const f = cam.isOrthographicCamera ? h * cam.zoom / (cam.top - cam.bottom) : h * (cam.zoom ?? 1) / (2 * Math.max(1e-3, dC.distanceTo(dE.setFromMatrixPosition(cam.matrixWorld))) * Math.tan(cam.fov * Math.PI / 360));
    return f >= 0.25 ? "full" : f >= 0.1 ? "half" : "low";
  }
  function seatLow(front) { root.updateMatrixWorld(true); let lo = Infinity;   // front: the seat's front edge (z); the thighs beyond it are not on the seat
    for (const { m, idx } of SEAT_PROBE) { if (!m.visible) continue; for (const i of idx) { m.getVertexPosition(i, seatV); seatV.applyMatrix4(m.matrixWorld); root.worldToLocal(seatV); if (seatV.z < front && seatV.y < lo) lo = seatV.y; } }
    return lo; }

  const avatar = {
    object: root, bones: bone, skeleton, options: OPT, parts, PROF, TIMES, earLine, get halo() { return halo; }, cloth, capeCloth,
    /** internals for tools and checking (shapes, face texture, joints) */
    internals: { TEX, GRAD, J: Jr, BONES, HIPS0, P, CUT, HEAD, EAR, HT: HTr, bodySdf: bodySdfR, bodySdfSlow, bodySdfRaw, ST, Jbase: J, HTbase: HT, face, hairKit, hairPick, get faceLayer() { return faceLayer; } },
    get faceLayer() { return faceLayer; },
    get pose() { return poseName; },
    get lastPose() { return lastPose; },
    get faceSel() { return faceSel; },
    /** how much of the hair and cloth the last update simulated: "full" | "half" | "low" | "off" (see update's camera) */
    get detail() { return detailNow; },

    /** Advance motion and blinking. t: absolute time to use instead of advancing (for freezing a frame). instant: jump straight to the pose.
     *  camera: the camera the scene is drawn with: the hair and cloth are simulated less when the character is small on the screen
     *  ("half": every 2nd frame, "low": every 4th) and not at all off the screen. detail: "full" | "half" | "low" | "off" to set it yourself. */
    update(dt, { t, instant = false, pose, camera, detail } = {}) {
      follower?.sync();   // dressing another rig (follow): its joints now
      if (rig && (pose ?? poseName) === rig.f.pose) rig.f.sync();   // posed by hand (avatar.joints)
      syncCover(); hairLines(); rims();
      time = t ?? time + dt;
      lastPose = playPose(pose ?? poseName, time, dt, instant, seatAdj, blendT);
      if (lastPose.stars) { stars.visible = true; const R = stars.userData.r; stars.children.forEach((m, i) => { const a = time * 3.2 + i * 2 * Math.PI / 5; m.position.set(Math.cos(a) * R, 0.12 * R * Math.sin(a * 2), Math.sin(a) * R * 0.55); m.rotation.set(0, -a, 0.3 * Math.sin(a * 3)); }); } else if (stars.visible) stars.visible = false;   // (stun: the stars circle the head)
      if (heldGrip) { root.updateMatrixWorld(); const k = 1 / (root.matrixWorld.getMaxScaleOnAxis() || 1); for (const h of Object.values(held)) h.wrap.scale.setScalar(k * h.scale); }   // held things keep their size in the world
      if (!ST.identity && lastPose.seat != null) lastPose = { ...lastPose, seat: ST.fwd(lastPose.seat) };   // a seat as high as the knees: higher for longer legs
      if (lastPose.seat != null) { const lo = seatLow(lastPose.seatFront ?? Infinity); if (lo < Infinity) {   // aim the hips at where they are now + the gap, and move there smoothly
        const e = lastPose.seat - lo, k = instant ? 1 : 1 - Math.exp(-dt * 9); seatAdj = Math.max(-0.08, Math.min(0.08, bone.hips.position.y - HIPS0.y - (lastPose.y || 0) + e)); bone.hips.position.y += e * k; } }
      else seatAdj *= instant ? 0 : Math.exp(-dt * 9);
      // how much of the hair and cloth to simulate this frame (2026-10-05, Saori: a game's players spent more time on swaying hair and skirts
      // than the whole game: a dress, a cape and long hair took 25 ms a frame). Small on the screen, the sway isn't seen at a lower rate
      detailNow = detail ?? (camera ? detailFor(camera) : "full"); const every = { full: 1, half: 2, low: 4, off: 0 }[detailNow] ?? 1;
      simDt += dt; simN++; const sim = every > 0 && (instant || simN >= every), sdt = instant ? dt : simDt; if (sim || !every) { simDt = 0; simN = 0; }
      if (sim) { const seat = lastPose.seat != null ? { y: lastPose.seat, front: lastPose.seatFront ?? Infinity } : null; cloth?.update(sdt, instant, seat); capeCloth?.update(sdt, instant, null); }   // the cape hangs behind the chair's seat (lifted onto it, it stood out sideways)
      // the wind the hair meets: the avatar's own motion through the air (its locks swing against the head, so the stream comes from here),
      // and a pose that goes somewhere (run, walk: lastPose.air, units / s) played in place streams it too. Softly capped at about a run's
      // (in the avatar's own size): a tennis player's 7 m/s laid the hair out in a straight line (2026-10-05, Saori)
      { root.updateMatrixWorld(true); const e = root.matrixWorld.elements, fl = Math.hypot(e[8], e[10]) || 1, fx = e[8] / fl, fz = e[10] / fl, pos = [e[12], e[13], e[14]], sc = Math.hypot(e[0], e[1], e[2]) || 1;
        const ok = !instant && lastRoot && dt > 0 && Math.hypot(pos[0] - lastRoot[0], pos[2] - lastRoot[2]) < 0.5 * sc, k = ok ? 1 - Math.exp(-dt * 8) : 1;
        const vx = ok ? (pos[0] - lastRoot[0]) / dt : 0, vz = ok ? (pos[2] - lastRoot[2]) / dt : 0; lastRoot = pos;
        rootV[0] += (vx - rootV[0]) * k; rootV[1] += (vz - rootV[1]) * k;   // (smoothed: frame times vary)
        const fwd = rootV[0] * fx + rootV[1] * fz, extra = Math.max(0, (lastPose.air ?? 0) * sc - Math.max(0, fwd));
        let wx = -rootV[0] - fx * extra, wz = -rootV[1] - fz * extra; const w = Math.hypot(wx, wz), CAP = 3 * sc, s = w > 1e-6 ? CAP * Math.tanh(w / CAP) / w : 0;
        wind[0] = wx * s; wind[1] = 0; wind[2] = wz * s; }
      if (sim) for (const k of [...LOCK_PARTS, "extraTail"]) if (parts[k]?.m.visible) parts[k].sim.update(sdt, instant, wind, every > 1);   // (extraTail: outfit.extras.tail)
      if (!faceDrawHook && time > blinkAt && !blinking) { blinking = true; avatar.drawFace(); }
      if (blinking && time > blinkAt + 0.12) { blinking = false; avatar.drawFace(); blinkAt = time + 2.5 + Math.random() * 3; }
    },
    /** Play a pose (a motion): a name in POSES, or "joints" (the avatar follows avatar.joints). blend: seconds to ease into it (default ~0.35,
     *  0 = at once: a fast move switched to mid-game). */
    play(name, { blend = null } = {}) {
      if (name === "joints") name = rigOf().f.pose;
      if (!POSES[name]) throw new Error(`Unknown motion "${name}". Available: ${Object.keys(POSES).join(", ")}, joints`); poseName = name; blendT = blend;
    },
    /** The joints to pose by hand, then play("joints"): { hips, spine, chest, upperChest, neck, head, upperArm / lowerArm / hand / upperLeg /
     *  lowerLeg / foot .L / .R } → THREE.Group. At rest every rotation is zero and the axes are the world's (the character faces +z, its
     *  left is +x): the arms hang at the sides, the legs straight down. A limb's −x swings it forward (arms and thighs); +x on a shin or
     *  forearm... see llms.txt. joints.hips.position.y moves the body up and down (crouching). */
    get joints() { return rigOf().joints; },
    /** Set the joints to a built-in pose at time t (the avatar's clock if left out): a start to change a few joints on (run, then a swing on the arm). */
    copyMotion(name, t = time) {
      const P = POSES[name]; if (!P) throw new Error(`Unknown motion "${name}"`);
      const R = rigOf(), p0 = P(t), Qb = (b) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p0.b[b] ?? [0, 0, 0])));
      for (const b of RIG) { const u = R.f.up(b), chain = new THREE.Quaternion();
        for (let c = b; c && c !== u; c = PARENT[c]) chain.premultiply(Qb(c));   // the bone turns between the joint above and this one (the collarbone)
        R.joints[b].quaternion.copy(R.f.offOf(u)).multiply(chain).multiply(R.f.offOf(b).clone().invert()); }
      R.joints.hips.position.y = R.hipsY + (p0.y ?? 0) * (ST.legK ?? 1);
    },
    /** Put something in a hand ("hand.R" / "hand.L"); null takes it out. The thing's origin is where the hand holds it (the middle of its
     *  grip), sized in the world's units. along: its axis that runs through the fist and out past the thumb (forward, with the arm hanging);
     *  face: its axis that faces the way the palm does (a racket's strings, a blade's flat). The hand closes on it. Returns the wrapper group. */
    hold(object, hand = "hand.R", { along = "+y", face = "+z" } = {}) {
      const s = hand.endsWith("L") ? "L" : "R";
      if (held[s]) { held[s].wrap.removeFromParent(); delete held[s]; }
      if (object) {
        const ax = (a) => { const v = new THREE.Vector3(); v[a.slice(-1)] = a.startsWith("-") ? -1 : 1; return v; };
        const H = HANDS[s], A = new THREE.Vector3(...H.S).normalize(), N = new THREE.Vector3(...H.N), F = N.addScaledVector(A, -N.dot(A)).normalize();
        const a = ax(along), f = ax(face); if (Math.abs(a.dot(f)) > 1e-6) throw new Error("hold: along and face must be different axes");
        const mo = new THREE.Matrix4().makeBasis(a, f, a.clone().cross(f)), mt = new THREE.Matrix4().makeBasis(A, F, A.clone().cross(F));
        const G = [H.G[0], ST.bone(`hand.${s}`, H.G[1]), H.G[2]], wrap = new THREE.Group(); wrap.name = `held:${object.name || "item"}`;
        wrap.position.set(G[0] - Jr[`hand.${s}`][0], G[1] - Jr[`hand.${s}`][1], G[2] - Jr[`hand.${s}`][2]);
        wrap.quaternion.setFromRotationMatrix(mt.multiply(mo.transpose())); wrap.add(object); bone[`hand.${s}`].add(wrap);
        held[s] = { wrap, object, scale: 1 };
      }
      heldGrip = held.L || held.R ? { L: held.L ? 1 : 0, R: held.R ? 1 : 0 } : null;
      return held[s]?.wrap ?? null;
    },
    /** Dress another rig in this character (src/follow.js): joints { hips, spine, head, "upperArm.L", "lowerArm.L", "hand.L", "upperLeg.L",
     *  "lowerLeg.L", "foot.L", … .R } → that rig's Object3Ds, in their rest pose now; { root, fit = true, hide = true, grip }. From then on every
     *  update copies the rig's joints and place (its own code keeps animating it). Returns { attach(object, bone), scale, … }; follow(null) stops. */
    follow(joints, opts = {}) {
      const topOf = (o) => { while (o?.parent && !o.parent.isScene) o = o.parent; return o; };   // (the rig's root: the top of the hips' tree under the scene)
      follower?.stop(); follower = null; if (!joints) { poseName = "idle"; return null; }
      follower = createFollower({ avatar, POSES, J: Jr, PARENT, BONES, legK: ST.legK ?? 1, joints, ...opts, root: opts.root ?? topOf(joints.hips) });
      poseName = follower.pose; return follower;
    },

    /** Face (instant): an expression id ("happy", see EXPRESSIONS; the character's own version first, options.face.expressions; a drawn one "image@<id>", see options.face.drawn), or parts by slot { eyes, brows, mouth, cheeks, nose } (ids in PART_LABELS). Kept in options.face.parts. */
    setFace(sel) {
      if (typeof sel === "string") { const id = expressionId(sel), e = OPT.face.expressions?.[id] ?? (id === "normal" ? FACE0 : null) ?? face.PRESETS[id]; if (!e) throw new Error(`Unknown expression "${sel}". Available: ${Object.keys(face.PRESETS).join(", ")}`); sel = e; }   // drawn expressions too ("image@<id>")
      sel = partIds(sel); Object.assign(faceSel, sel); Object.assign(OPT.face.parts, sel); avatar.drawFace();
    },
    /** This character's own expressions (instant): { happy: { eyes, brows, mouth, cheeks }, … } (options.face.expressions), what setFace(name) shows */
    setExpressions(map = {}) { OPT.face.expressions = structuredClone(map ?? {}); },
    /** Move the face parts on the face picture (instant): { eyeX, eyeY, eyeSize, browX, browY, mouthY }. Kept in options.face.
     *  eyeX / eyeY also place the eye sockets in the head's shape, which follows on the next build. */
    setFaceLayout(l) {
      face.setLayout(l);
      for (const k of ["eyeX", "eyeY", "browX", "browY", "mouthY"]) if (l[k] != null) OPT.face.layout[k] = l[k];
      if (l.eyeSize != null) OPT.face.eyeSize = l.eyeSize;
      avatar.drawFace();
    },
    drawFace() { if (faceDrawHook && faceDrawHook(face)) return; face.drawParts(faceSel, blinking); },
    /** Replace face drawing (return true when drawn), e.g. to show a whole-face picture. null restores the parts. */
    setFaceDrawHook(fn) { faceDrawHook = fn; avatar.drawFace(); },
    setFaceWrap(wrap) { faceWrap = wrap; buildFaceLayer(); },

    /** Colors (instant): { skin, hair, eyes, shirt, pants, socks, shoes, soles, armor }. Kept in options (colors.*, outfit.*.color, outfit.shoes.soleColor). */
    setColors({ skin, hair, eyes, shirt, pants, shoes, soles, socks, armor, weapon, grip, shield, sheath, dress, cape, laces, ears, earsIn, tail, wings, halo: haloC, suit, suitAccent } = {}) {
      if (suit) { OPT.outfit.suit.color = suit; parts.suit.m.material.color.set(suit); }
      if (suitAccent) { OPT.outfit.suit.accent = suitAccent; SUIT.color.value.set(suitAccent); }
      if (skin) { parts.body.toonMat.color.set(skin); OPT.colors.skin = skin; }
      // extras (outfit.extras): null = back to the default (the hair's, a devil's dark, an angel's white). The hair's color changes the ones following it
      if (hair) OPT.colors.hair = hair;
      for (const [k, v, key] of [["extraEars", ears, "earColor"], ["extraEarsIn", earsIn, "earInColor"], ["extraTail", tail, "tailColor"], ["extraWings", wings, "wingColor"]]) {
        if (v !== undefined) XO[key] = v; if (v !== undefined || hair) parts[k]?.m.material.color.set(XC[{ extraEars: "ears", extraEarsIn: "earsIn", extraTail: "tail", extraWings: "wings" }[k]]()); }
      if (haloC) { XO.haloColor = haloC; halo?.material.color.set(haloC); }
      if (hair) { OPT.colors.hair = hair; ringColor(hair); for (const k of LOCK_PARTS) if (k !== "tailTie") parts[k]?.m.material.color.set(hair); const old = parts.hair.m.material; parts.hair.m.material = hairMat(hair); parts.hair.m.material.wireframe = old.wireframe; old.dispose(); }   // a new material: the angel ring's color follows the hair color
      if (eyes) { OPT.colors.eyes = eyes; face.setEyeColor(eyes); avatar.drawFace(); }
      const DR = OPT.outfit.dress?.on;   // a dress: its top (the shirt) and its skirt (the pants) are the dress's color
      for (const [k, c] of Object.entries({ shirt, pants, shoes, socks })) if (c) { OPT.outfit[k].color = c; if (!(DR && (k === "pants" || k === "shirt"))) parts[k].m.material.color.set(c); }
      if (dress !== undefined) OPT.outfit.dress.color = dress;   // null: the shirt's color
      if (DR && (shirt || dress !== undefined)) for (const k of ["shirt", "pants"]) parts[k].m.material.color.set(skirtOf(OPT).color);
      if (cape) { parts.cape.m.material.color.set(cape); OPT.outfit.cape.color = cape; }
      if (soles) { parts.soles.m.material.color.set(soles); OPT.outfit.shoes.soleColor = soles; }
      if (laces) { parts.laces.m.material.color.set(laces); OPT.outfit.shoes.laceColor = laces; }
      if (armor) { for (const k of ARMOR) if (isMetal(k)) parts[k].m.material.color.set(armor); OPT.outfit.armor.color = armor; }
      for (const [c, k, key] of [[weapon, ["weaponR", "weaponL"], "color"], [grip, ["weaponRGrip", "weaponLGrip", "weaponBelt"], "gripColor"], [sheath, ["weaponSheath"], "sheathColor"], [shield, ["weaponLFace"], "shieldColor"]]) if (c) { for (const q of k) parts[q].m.material.color.set(c); OPT.outfit.weapon[key] = c; }
    },
    /** Put garments on or take them off (instant): { shirt, pants, socks, shoes } as true / false. Kept in options.outfit.*.on. */
    setWorn(worn = {}) { for (const [g, on] of Object.entries(worn)) { if (!GARMENTS[g]) throw new Error(`Unknown garment "${g}". Available: ${Object.keys(GARMENTS).join(", ")}`); wear(g, !!on); } },
    /** Outline (instant, no rebuild): { on, width (1 = default), color }. Some art styles want none: { on: false }. */
    setOutline({ on, width, color, hairInner } = {}) {
      Object.assign(OPT.outline, Object.fromEntries(Object.entries({ on, width, color, hairInner }).filter(([, v]) => v !== undefined))); hairLines();
      root.traverse((x) => { if (!x.userData.outline) return; const m = x.material; m.visible = OPT.outline.on; m.color.set(OPT.outline.color); m.userData.width.value = m.userData.baseWidth * OPT.outline.width; });
    },
    /** Shading (instant, no rebuild): a style "toon" | "smooth" | "flat" (see SHADINGS), or { style, bands, soften }:
     *  bands 2 (light / shadow) or 3 (with a mid tone), soften 0.. how far the shading normals are smoothed (0 = the mesh's own, 1 = default). Keeps the current colors. */
    /** The belt and the scabbard of a sword or a greatsword (instant): on / off. Kept in options.outfit.weapon.sheath. */
    setSheath(on) { OPT.outfit.weapon.sheath = !!on; showSheath(!!on); },
    /** Rim light (instant): { on, color, width (0..1: how far in from the edge), strength }. Kept in options.shading.rim. */
    setRim({ on, color, width, strength } = {}) {
      const R = OPT.shading.rim ??= {}; Object.assign(R, Object.fromEntries(Object.entries({ on, color, width, strength }).filter(([, v]) => v !== undefined)));
      RIM.rimOn.value = R.on ? 1 : 0; if (R.color) RIM.rimColor.value.set(R.color); if (R.width != null) RIM.rimWidth.value = R.width; if (R.strength != null) RIM.rimStrength.value = R.strength;
      if (R.on) { rimUsed = true; rims(); }
    },
    setShading(s) {
      const { style = OPT.shading.style, bands = OPT.shading.bands, soften = OPT.shading.soften } = typeof s === "string" ? { style: s } : s;
      if (!SHADINGS.includes(style)) throw new Error(`Unknown shading "${style}". Available: ${SHADINGS.join(", ")}`);
      if (bands !== 2 && bands !== 3) throw new Error(`shading.bands is 2 or 3, not ${bands}`);
      const resoften = soften !== OPT.shading.soften; Object.assign(OPT.shading, { style, bands, soften });
      if (resoften) { for (const [k, x] of Object.entries(parts)) if (x.m.geometry.attributes.shadeN && !x.sim) addSoftNormals(k, x.m.geometry); buildFaceLayer(); }   // the face layer copies the head's shading normals
      for (const [k, x] of Object.entries(parts)) {
        if (k === "body") { const old = x.toonMat, nm = x.wrap(shadeToon(old.color.getHex())); if (x.m.material === old) x.m.material = nm; x.toonMat = nm; old.dispose(); continue; }   // the body's normal material (a page may be showing another one, e.g. clay)
        const old = x.m.material; x.m.material = k === "hair" ? hairMat(old.color.getHex()) : isMetal(k) ? metal(style, old.color.getHex()) : (x.wrap ?? ((m) => m))(shadedFor(x.m.geometry, old.color.getHex(), style)); x.m.material.wireframe = old.wireframe; old.dispose();
      }
      { const old = faceLayer.material; faceLayer.material = face.faceMatFor(style, bands); old.dispose(); }   // 顔の絵も同じ陰影に
    },
    /** Soft blush on the cheeks and the nose tip (instant): { cheeks: { on, color, strength, size, x, y }, nose: { on, color, strength, size } }. */
    setBlush({ cheeks, nose } = {}) { if (cheeks) Object.assign(OPT.face.blush.cheeks, cheeks); if (nose) Object.assign(OPT.face.blush.nose, nose); avatar.drawFace(); },
    /** Rebuild the hair: pick = { bangs, back, ahoge, bangsForm, backForm, nape } (as options.hair; any of them). Kept in options.hair. */
    setHair(pick) {
      const HR = OPT.hair; for (const k of ["bangs", "back", "ahoge", "bangsForm", "backForm", "nape"]) if (k in pick) HR[k] = k === "bangs" ? bangsId(pick[k]) : pick[k];
      if (HR.bangs === "block") { HR.bangs = "nendo"; HR.bangsForm = "block"; } if (HR.back === "hang") { HR.back = "short"; HR.nape = "hang"; HR.backForm = "locks"; }   // the old names (options.js readHair)
      Object.assign(hairPick, hairForms(HR)); bangKitMemo = null;
      const on = parts.hair.on; for (const m of [parts.hair.m, parts.hair.o]) { root.remove(m); m.geometry.dispose(); }
      parts.hair = makeHair(H); parts.hair.on = on;
      for (const k of LOCK_PARTS) if (parts[k]) { for (const m of [parts[k].m, parts[k].o]) { root.remove(m); m.geometry.dispose(); } delete parts[k]; }
      for (const [k, x] of Object.entries(makeLocks())) { parts[k] = x; x.on = on; x.m.visible = x.o.visible = parts.hair.m.visible; }
      hairGrad();
    },

    /** The nendo bangs: values into options.hair.sculpt.nendo ({ tips, overlap, lockThick, … }). Bangs made of locks rebuild only themselves
     *  (fast enough to follow an editor's handles); otherwise, or when the hair under them changes too, the whole hair is rebuilt. */
    /** The back hair's locks (instant-ish, no other part rebuilt): values into options.hair.sculpt[group], group "shortLocks" or "long"
     *  (count, width, thick, flick, stiff, below / bottom …; for shortLocks.lie, pass { lie: { … } }). */
    setLocks(group, values) {
      if (group === "shortLocks.lie") { group = "shortLocks"; values = { lie: values }; }
      if ((group === "shortLocks" && "on" in values) || (group === "long" && "locks" in values)) { OPT.hair.sculpt[group][group === "long" ? "locks" : "on"] = !!(values.on ?? values.locks); avatar.setHair({ backForm: (values.on ?? values.locks) ? "locks" : "block" }); return; }   // locks or a block: the form now (options.js hairForms)
      const G = OPT.hair.sculpt[group]; for (const [k, v] of Object.entries(structuredClone(values))) { if (v && typeof v === "object" && !Array.isArray(v) && G[k] && typeof G[k] === "object") Object.assign(G[k], v); else G[k] = v; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.locks) { for (const m of [parts.locks.m, parts.locks.o]) { root.remove(m); m.geometry.dispose(); } delete parts.locks; }
      const x = makeLocks(["locks"]).locks; if (x) { parts.locks = x; x.on = on; x.m.visible = x.o.visible = vis; }
      hairGrad();   // the lowest tip may have moved
    },
    /** Locks drawn by hand (options.hair.drawn): [{ pts: [[x, y, z], …] (head space, root to tip), width (m), thick (×width), stiff, mirror }].
     *  Rebuilds only them. */
    /** A gradient (instant): target "hair" | "shirt" | "pants" | "dress" | "cape", values { on, color, start (0..1: root / top → tip / hem), soft }.
     *  Kept in options (hair.gradient, outfit.<target>.gradient). A dress's covers its top and skirt (the shirt's and the pants' are then unused). */
    setGradient(target, values = {}) {
      const G = target === "hair" ? OPT.hair.gradient : OPT.outfit[target]?.gradient, U = GRAD[target]; if (!G || !U) throw new Error(`Unknown gradient "${target}". Available: ${Object.keys(GRAD).join(", ")}`);
      Object.assign(G, values); U.on.value = G.on ? 1 : 0; U.color.value.set(G.color); U.start.value = G.start; U.soft.value = G.soft;
      if (target === "hair") { GRAD.bangs.on.value = bangsGrad(G); hairGrad();
        if (("bangs" in values || "hanging" in values) && parts.bangs) { const on = parts.bangs.on, vis = parts.bangs.m.visible; for (const m of [parts.bangs.m, parts.bangs.o]) { root.remove(m); m.geometry.dispose(); } delete parts.bangs;   // which tufts take it: their locks again
          const x = makeLocks(["bangs"]).bangs; if (x) { parts.bangs = x; x.on = on; x.m.visible = x.o.visible = vis; } } }
    },
    /** A picture on a garment (instant; a new src loads in the background, the returned promise resolves when it shows): target "shirt" | "pants" |
     *  "dress" | "cape", values { src (path or data URL, null = none), mode: "tile" | "wrap" | "front", scale (m), rotate (degrees), x, y (m), opacity, blend: "over" | "multiply" }.
     *  Kept in options (outfit.<target>.texture). A dress's covers its top and skirt. */
    setTexture(target, values = {}) {
      const T = texOf(target), U = TEX[target]; if (!T || !U) throw new Error(`Unknown garment "${target}" for a picture. Available: ${Object.keys(TEX).join(", ")}`);
      Object.assign(T, values); U.mode.value = TEX_MODE[T.mode] ?? 0; U.scale.value = T.scale; U.rot.value = (T.rotate ?? 0) * Math.PI / 180; U.off.value.set(T.x ?? 0, T.y ?? 0); U.opacity.value = T.opacity ?? 1; U.blend.value = TEX_BLEND[T.blend] ?? 0;
      return loadTex(target);
    },
    /** Paint (instant): the picture of a part's atlas (src/paint.js), as a path or data URL, null = none. target: "body" | "shirt" | "pants" | "dress" | "cape".
     *  Kept in options (paint.<target>.src). Resolves when it shows. */
    setPaint(target, src) {
      if (!PAINT[target]) throw new Error(`Unknown paint target "${target}". Available: ${PAINT_TARGETS.join(", ")}`);
      (OPT.paint ??= {})[target] = { src: src ?? null }; return loadPaint(target);
    },
    /** For a brush: the part's atlas as a canvas that shows on the character (drawn at once; call update() after drawing).
     *  { canvas, ctx, layout, update(), sync(src) } — sync: the canvas now shows this src (so setting it in the options doesn't reload it). */
    paintSurface(target) {
      const U = PAINT[target]; if (!U) throw new Error(`Unknown paint target "${target}"`);
      if (!U.surface) { const canvas = Object.assign(document.createElement("canvas"), { width: U.L.W, height: U.L.H }), ctx = canvas.getContext("2d"), old = U.map.value;
        if (U.on.value && old.image) ctx.drawImage(old.image, 0, 0, canvas.width, canvas.height);
        const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 4; old.dispose(); U.map.value = tex; U.on.value = 1;
        U.surface = { canvas, ctx, layout: U.L, update() { tex.needsUpdate = true; }, sync(src) { U.src = src; U.load = Promise.resolve(); } }; }
      return U.surface;
    },
    /** The meshes a brush can paint, each with its paint target (a dress's top and skirt both paint "dress"). */
    paintTargets() { return Object.values(parts).filter((x) => x.paint && x.m.visible).map((x) => ({ target: x.paint, mesh: x.m })); },
    /** Tails (options.hair.tail: { kind: "none" | "pony" | "twin" | "side", side, angle, y, length, volume, count, width, thick, lift, spread, stiff, tie: { on, color, size } }).
     *  Rebuilds only them and their ties. */
    setTails(values) {
      const TL = OPT.hair.tail; for (const [k, v] of Object.entries(structuredClone(values))) { if (k === "tie" && v && typeof v === "object") Object.assign(TL.tie, v); else TL[k] = v; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      for (const k of ["tails", "tailTie"]) if (parts[k]) { for (const m of [parts[k].m, parts[k].o]) { root.remove(m); m.geometry.dispose(); } delete parts[k]; }
      for (const [k, x] of Object.entries(makeLocks(["tails"]))) { parts[k] = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    /** Where the tails are tied (avatar space, rest pose): [{ p, o }] (o: the way the bundle leaves the head), [] without tails. For an editor's handles. */
    tailTies() { return tailAnchors.map((a) => ({ p: [...a.p], o: [...a.o] })); },
    /** Accessories (instant): the whole list, as options.accessories ([{ kind, bone, at, n, spin, size, color, mirror }], src/accessories.js). */
    setAccessories(list) { OPT.accessories = structuredClone(list ?? []); makeAccessories(); },
    setDrawnHair(list) {
      OPT.hair.drawn = structuredClone(list ?? []);
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.drawn) { for (const m of [parts.drawn.m, parts.drawn.o]) { root.remove(m); m.geometry.dispose(); } delete parts.drawn; }
      const x = makeLocks(["drawn"]).drawn; if (x) { parts.drawn = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    setBangs(values) {
      const N = OPT.hair.sculpt.nendo, was = hairKit.bangsAsLocks(hairPick); Object.assign(N, structuredClone(values));
      if ("locks" in values) OPT.hair.bangsForm = values.locks ? "locks" : "block";   // (the form decides it now: options.js hairForms)
      if (!was || !hairKit.bangsAsLocks(hairPick) || ["locks", "lockTaper"].some((k) => k in values)) { avatar.setHair({}); return; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.bangs) { for (const m of [parts.bangs.m, parts.bangs.o]) { root.remove(m); m.geometry.dispose(); } delete parts.bangs; }
      const x = makeLocks(["bangs"]).bangs; if (x) { parts.bangs = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    /** Where a tip of the nendo bangs is (avatar space, rest pose; just outside the hair): angle around the head (degrees, 0 = front), height (head space). */
    /** The back hair's locks as built (avatar space, rest pose): [{ i, tip: [x, y, z], root }] in the order of their edits (hair.sculpt.*.edits),
     *  and which group they belong to: "shortLocks" (hanging), "shortLocks.lie" (lying) or "long". Empty without back locks. */
    backLocks() { const sim = parts.locks?.sim; if (!sim) return { group: null, locks: [] };
      const group = hairPick.back === "long" ? "long" : hairPick.back === "short" ? "shortLocks.lie" : hairPick.back === "bob" || hairPick.back === "flip" ? hairPick.back + "Locks" : "shortLocks";
      return { group, locks: sim.specs.map((s, i) => ({ i, tip: s.pts.at(-1), root: s.pts[0] })) }; },
    bangTipAt(angle, y) { return bangTipAt(angle, y, { ...bangKit(), hangY: OPT.hair.sculpt.nendo.lockHangY ?? 0.86 }); },

    /** GLB of the avatar in the A-pose (outlines left out). */
    async exportGLB() {
      const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
      const outs = []; root.traverse((o) => { if (o.userData.outline && o.visible) { o.visible = false; outs.push(o); } });
      cloth?.rest(); capeCloth?.rest();   // the skirt and the cape as built (not as the cloth has them now)
      for (const k of [...LOCK_PARTS, "extraTail"]) parts[k]?.sim.rest();   // the locks (and a tail) as they hang in the rest pose
      const saved = BONES.map((b) => bone[b].quaternion.clone()), hy = bone.hips.position.y;
      BONES.forEach((b) => bone[b].quaternion.identity()); bone.hips.position.copy(HIPS0);
      const restore = () => { outs.forEach((o) => { o.visible = true; }); BONES.forEach((b, i) => bone[b].quaternion.copy(saved[i])); bone.hips.position.y = hy; };
      return new Promise((ok, ng) => new GLTFExporter().parse(root, (buf) => { restore(); ok(buf); }, (e) => { restore(); ng(e); }, { binary: true }));
    },

    /** Fingerprint of mesh positions and skin weights (for checking refactors). */
    checksum() { return ["body", "shirt", "pants", "socks", "shoes", "soles", "hair"].map((k) => parts[k]).map((x) => { const a = x.m.geometry.attributes; let h = 0; for (const k of ["position", "skinIndex", "skinWeight"]) { const v = a[k].array; for (let i = 0; i < v.length; i++) h = (h * 31 + Math.round(v[i] * 1e5)) % 1000000007; } return h; }); },

    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); } }); face.faceTex.dispose(); for (const U of [...Object.values(TEX), ...Object.values(PAINT)]) U.map.value.dispose(); root.removeFromParent(); },
  };
  avatar.drawFace(); lap("drawFace");
  syncCover(); lap("syncCover"); TIMES.total = Math.round(performance.now() - T00);
  building = false;
  if (useCache && Object.keys(fresh).length) cachePut(cacheKey, fresh);   // not awaited: storing happens after the avatar is already on screen
  return avatar;
}
