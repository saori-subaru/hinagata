// Hinagata: code-generated chibi avatars for three.js.
//
//   const avatar = await createAvatar({ hair: { back: "bob" } });
//   scene.add(avatar.object);
//   avatar.play("walk");
//   // every frame: avatar.update(dt)
//
import * as THREE from "three";
import { sstep, dPrim } from "./sdf/prim.js";
import { surfaceNets, gridSampler, smoothNormals } from "./sdf/mesh.js";
import { hashKey, sourceHash, cacheGet, cachePut } from "./cache.js";
import { partSpec, skinOf, hairPartName, CLOTHES, ARMOR, WEAPONS } from "./parts.js";
import { buildPartInWorkers } from "./build.js";
import { shaded, metal, SHADINGS, outlineMat, withShadeN } from "./materials.js";
import { DEFAULTS, resolveOptions, diff, skirtOf } from "./options.js";
import { SCHEMA, checkOptions } from "./schema.js";
import { buildBody, makeStretch } from "./body/index.js";
import { buildClothes, capeTop } from "./clothes/index.js";
import { buildHair } from "./hair/index.js";
import { longLocks, ringLocks, surfaceLocks, bangLocks, bangTipAt, drawnLocks, tailLocks, colliders as lockColliders, createLocks, surfaceAlong } from "./hair/locks.js";
import { makeSkeleton, makeWeights } from "./rig.js";
import { createFace, EXPRESSIONS, PART_LABELS, partIds, expressionId } from "./face/index.js";
import { POSES, createPosePlayer } from "./motion/index.js";
import { createCloth } from "./cloth.js";

export { DEFAULTS, POSES, SHADINGS, resolveOptions, diff, EXPRESSIONS, PART_LABELS, SCHEMA, checkOptions };
export { BODY_TYPES } from "./body/types.js";
export { faceSheet, readFaceSheet, sheetChanges, sheetLayout, sheetTiles } from "./face/sheet.js";   // face templates to draw parts on, and reading them back (face/sheet.js)
export { LIMBS, ik2, aim } from "./motion/ik.js";   // IK: hands / feet onto points after the pose (motion/ik.js)
export { measureBody, measureStride, climbLimbs } from "./motion/climb.js";   // climbing, jump, fall poses + the climbing gait (motion/climb.js)
export { measureGait, RUN_W } from "./motion/run.js";   // the run pose + a stride measure for any gait (motion/run.js)
import "./motion/jump.js";   // jump / land / fall / crouch / banzai poses (motion/jump.js)
export { crawlLimbs, SNEAK_W } from "./motion/crawl.js";   // crouched walk and crawling (motion/crawl.js)
import "./motion/mantle.js";   // pulling up over an edge in steps, and vaulting (motion/mantle.js)
export { holdPole } from "./motion/glide.js";   // gliding under something held overhead; both hands on a pole (motion/glide.js)
export { SWIM_W, swimHead } from "./motion/swim.js";   // swimming, treading water, wading (motion/swim.js)
export { ONE_SHOT } from "./motion/survival.js";   // the body's states and the hands' work for living in the wild: pant, shiver, limp, drink, chop, sleep... (motion/survival.js)

/**
 * Build an avatar.
 * options:  see DEFAULTS (src/options.js); anything left out uses the default.
 * settings: { quality: "game" (default) | "high" | "low" — mesh density (cell size 13.6 / 6.8 / 9.5 mm).
 *               "game" is about 3x faster to build and 4x lighter to draw than "high"; only hair tips and hems get slightly rougher.
 *             cell: a cell size in metres, instead of quality,
 *             simplify: 0..1 — after building, keep this share of the triangles (e.g. 0.1). Needs the "meshoptimizer" package in your import map,
 *             cache: true (default) — remember the built meshes in the browser (IndexedDB); the same options come back instantly next time.
 *                    The key includes the generator's source code, so edits to the sculpt code never return a stale mesh,
 *             cull: true (default) — don't draw the body where clothes cover it (follows each garment's visibility),
 *             workers: true (default) — build the parts in a few Web Workers at once (body and hair together, then the clothes);
 *                      the same mesh as on the main thread. Falls back to the main thread when workers can't start,
 *             debug: { slow, oldSock, faceWrap } — checking aids, normally unused }
 */
// options without the parts that only change colors, the outline, the shading, the blush, the face parts, what is worn or the hair paint (the geometry is the same, so the cache can reuse it)
function shapeOnly(OPT) {
  const strip = (o) => { if (!o || typeof o !== "object") return o; const r = Array.isArray(o) ? [] : {}; for (const [k, v] of Object.entries(o)) if (!/^(color|soleColor|mailColor|visorColor|decoColor|gripColor|shieldColor|on)$/.test(k)) r[k] = strip(v); return r; };
  const { colors, outline, shading, ...rest } = OPT, { blush, parts, ...face } = OPT.face, { paint, ...hair } = OPT.hair; return { ...rest, face, hair, outfit: { ...strip(OPT.outfit), dressOn: !!OPT.outfit.dress?.on, capeOn: !!OPT.outfit.cape?.on } };   // a dress is a shape (its skirt), and a cape is only built when worn
}

export async function createAvatar(options = {}, { quality = "game", cell = 0, simplify = 1, cache = true, cull = true, workers = true, debug = {} } = {}) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint (e.g. a "building…" message) before the heavy work
  const TIMES = {}, T00 = performance.now(); let T0p = T00; const lap = (k) => { const t = performance.now(); TIMES[k] = Math.round((TIMES[k] || 0) + t - T0p); T0p = t; };   // where the time goes (avatar.TIMES, ms)
  { const bad = checkOptions(options); if (bad.length) console.warn("Hinagata: options with problems (see docs/options.schema.json):\n" + bad.map((b) => `  ${b.path}: ${b.problem}`).join("\n")); }   // typos would otherwise be silently ignored
  const OPT = resolveOptions(options);
  const H = cell || { game: 0.0136, high: 0.0068, low: 0.0095 }[quality] || 0.0136;   // mesh cell size
  let MS = null;   // meshoptimizer's simplifier, only when asked for
  if (simplify < 1) {
    try { MS = (await import("meshoptimizer")).MeshoptSimplifier; await MS.ready; }
    catch (e) { throw new Error('settings.simplify needs the "meshoptimizer" package: add "meshoptimizer": "https://cdn.jsdelivr.net/npm/meshoptimizer@1/index.module.js" to your import map (or npm install meshoptimizer). ' + e.message); }
  }
  // meshes remembered from an earlier visit (same options, same generator code)
  const useCache = cache && !debug.slow && !debug.oldSock && typeof indexedDB !== "undefined";
  const cacheKey = useCache ? hashKey(await sourceHash(), shapeOnly(OPT), H, simplify) : null;
  const hit = useCache ? await cacheGet(cacheKey) : null, fresh = {};
  let building = true;

  lap("cache");
  // shapes
  const { J, PARENT, BONES, BI, HANDS, P, CUT, EARS, faceWarp, PLANES, BODY, HEAD, CROTCH, ARMPIT, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT } = buildBody(OPT, { slow: !!debug.slow, oldSock: !!debug.oldSock });
  const { pantsSdf, shirtSdf, shoeSdf, sockSdf, soleSdf, capeSdf, armor, weapons } = buildClothes(OPT, { P, J, HT, CROTCH, bodySdf, ARMPIT });
  const hairKit = buildHair(OPT, { P, CUT, PLANES, faceWarp, bodySdf: bodySdfRaw });   // hair is shaped on the untransformed head, then scaled with it
  const weightsAt = makeWeights({ BODY, BONES, BI, J });
  // proportions (body.proportion, makeStretch in body/index.js): everything above is built at the base proportions; the meshes' points are
  // stretched upward as they are made (mesh), and what moves the character uses the stretched ones: the bones (Jr), the head's transform
  // for things placed in head space (HTr: the hair's locks, the face picture, the ear line) and the body read in place (bodySdfR, for colliders)
  const ST = makeStretch(OPT, J);
  const Jr = ST.identity ? J : Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [v[0], ST.fwd(v[1]), v[2]]]));
  const HTr = ST.identity ? HT : { ...HT, identity: false, toHead: (x, y, z) => HT.toHead(x, ST.inv(y), z), fromHead: (x, y, z) => { const p = HT.fromHead(x, y, z); p[1] = ST.fwd(p[1]); return p; },
    wrap: (f) => { const g = HT.wrap(f); return (x, y, z) => g(x, ST.inv(y), z); } };
  const bodySdfR = ST.identity ? bodySdf : (x, y, z) => bodySdf(x, ST.inv(y), z) * ST.k;
  const { root, bone, skeleton, HIPS0 } = makeSkeleton({ J: Jr, PARENT, BONES });

  lap("shapes");
  // shape → skinned mesh
  const PROF = [];   // per mesh: vertex count and build time (ms)
  let bodyAt = (x, y, z) => bodySdf(x, y, z);   // body distance; after the body is meshed, read back from its grid (clothes don't recompute the body)
  // name: which part (the cache key inside this character) / fast: cheaper sdf for grid sampling / bone1: bind everything to this bone / only: RegExp of bones allowed
  function mesh(name, sdf, lo, hi, h, bone1, only, fast = sdf, soft = null) {
    const T0 = performance.now(), w = building ? pre[name] : null; let rec = w?.rec ?? (building ? hit?.[name] : null), time = w?.time ?? null;   // made by a worker / remembered (the cache only serves the first build; later rebuilds, e.g. setHair after editing tips, are made fresh)
    mesh.last = w?.grid ?? null;
    if (w) fresh[name] = rec;
    if (!rec) {
      const r = surfaceNets(sdf, lo, hi, h, { fast, band: OPT.quality.band, proj: OPT.quality.project }); mesh.last = r.grid; time = r.time;
      let pos = new Float32Array(r.pos), nor = r.nor, idx = new Uint32Array(r.idx);
      if (MS) ({ pos, nor, idx } = simplified(pos, nor, idx));
      const { si, sw } = skinOf(pos, weightsAt, BI, bone1, only, soft);
      rec = fresh[name] = { pos, nor, idx, si, sw };
    }
    const g = new THREE.BufferGeometry();
    let gp = rec.pos, gn = rec.nor;
    if (!ST.identity) { gp = Float32Array.from(gp); gn = Float32Array.from(gn);   // the proportions: points up by fwd, normals by the slope there (the record stays at the base, for the cache)
      for (let i = 0; i < gp.length; i += 3) { const s = ST.slope(gp[i + 1]); gp[i + 1] = ST.fwd(gp[i + 1]); const ny = gn[i + 1] / s, l = Math.hypot(gn[i], ny, gn[i + 2]) || 1; gn[i] /= l; gn[i + 1] = ny / l; gn[i + 2] /= l; } }
    g.setAttribute("position", new THREE.BufferAttribute(gp, 3)); g.setAttribute("normal", new THREE.BufferAttribute(gn, 3)); g.setIndex(new THREE.BufferAttribute(rec.idx, 1));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(rec.si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(rec.sw, 4));
    PROF.push({ part: name, verts: rec.pos.length / 3, ms: w ? w.ms : Math.round(performance.now() - T0), cached: !time, worker: !!w, sample: time ? Math.round(time.sample) : 0, project: time ? Math.round(time.project) : 0 });
    return g;
  }
  // keep `simplify` of the triangles (meshoptimizer), then drop the vertices nothing uses any more
  function simplified(pos, nor, idx) {
    if (idx.length < 3) return { pos, nor, idx };   // nothing to thin (a part not built, e.g. armor not worn): asking meshoptimizer for 3 of 0 failed its assert (2026-10-04, found by the forest)
    const [out] = MS.simplify(idx, pos, 3, Math.min(idx.length, Math.max(3, Math.floor(idx.length * simplify / 3) * 3)), 1, []);   // error 1 = let the triangle count decide
    const map = new Int32Array(pos.length / 3).fill(-1); let n = 0; for (const v of out) if (map[v] < 0) map[v] = n++;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let v = 0; v < map.length; v++) { const m = map[v]; if (m < 0) continue; for (let k = 0; k < 3; k++) { P[m * 3 + k] = pos[v * 3 + k]; N[m * 3 + k] = nor[v * 3 + k]; } }
    for (let i = 0; i < out.length; i++) out[i] = map[out[i]];
    return { pos: P, nor: N, idx: out };
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
    const Pa = geo.attributes.position.array, N = geo.attributes.normal.array, A = new Float32Array(Pa.length).fill(1), jc = new THREE.Color(JS.color), ec = new THREE.Color(ES_.color);
    const put = (v, c, k) => { if (k <= 0) return; for (const [o, ch] of [[0, "r"], [1, "g"], [2, "b"]]) A[v * 3 + o] *= 1 + (c[ch] - 1) * Math.min(1, k); };
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const x = Pa[i], y = ST.inv(Pa[i + 1]), z = Pa[i + 2], ny = N[i + 1];   // (at the base proportions: the shadow's heights are)
      if (JS.on) { const jaw = sstep(JS.jawNy[0], JS.jawNy[1], -ny) * sstep(JS.jawY[0], JS.jawY[1], y) * (1 - sstep(JS.jawY[2], JS.jawY[3], y)) * sstep(JS.backZ - 0.04, JS.backZ, z);
        const neck = sstep(JS.neckY[0], JS.neckY[1], y) * (1 - sstep(JS.neckY[2], JS.neckY[3], y)) * (1 - sstep(JS.neckX[0], JS.neckX[1], Math.abs(x))) * sstep(-0.06, 0.0, z);
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
  const hairPick = { bangs: OPT.hair.bangs, back: OPT.hair.back, ahoge: OPT.hair.ahoge };
  const pre = {};
  const kit = { bodySdf, HT, hairKit, clothes: { pantsSdf, shirtSdf, shoeSdf, sockSdf, soleSdf, capeSdf, armor, weapons } };
  if (workers && !MS) {
    const need = (n) => !hit?.[n], job = { key: hashKey(shapeOnly(OPT), !!debug.slow, !!debug.oldSock), opt: OPT, debug: { slow: !!debug.slow, oldSock: !!debug.oldSock }, H };
    const run = (part, grid = null, split) => buildPartInWorkers(part, job, partSpec(part, { OPT, H, kit }), grid, split).then((r) => { pre[part] = r; }, () => {});
    const hairN = hairPartName(hairPick), jh = need(hairN) ? run(hairN) : null;   // the hair doesn't need the body: start it together with the body
    if (need("body")) await run("body");
    await Promise.all([jh, ...CLOTHES.filter(need).map((n) => run(n, pre.body?.grid ?? null, n === "shirt" ? undefined : 1))]);   // small garments in one piece each
  }
  lap("workers");
  // hair paint (anime style, not lighting): thin darker strands flowing from the crown, and a bright band (angel ring) around the top.
  // Each hair vertex gets its direction from the head's center (head space): around the head (phi) and down from the crown (theta)
  function addHairUV(geo) {
    const Pa = geo.attributes.position.array, U = new Float32Array(Pa.length / 3 * 2), S = OPT.body.sculpt.skull;
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const [x, y, z] = HTr.toHead(Pa[i], Pa[i + 1], Pa[i + 2]), dz = z + 0.005, dy = y - S.y;
      U[v * 2] = Math.atan2(x, dz); U[v * 2 + 1] = Math.atan2(Math.hypot(x, dz), dy); }
    geo.setAttribute("hairUV", new THREE.BufferAttribute(U, 2));
  }
  const glf = (v) => (+v).toFixed(4);
  // the ring's color when none is given: the hair color, lighter and a little warmer (brown hair → orange), so it doesn't stand out as white
  const ringOf = (c) => { const h = {}; new THREE.Color(c).getHSL(h); return new THREE.Color().setHSL(h.h + (0.075 - h.h) * 0.5, Math.min(1, h.s * 1.1 + 0.08), Math.min(0.85, h.l + 0.14)); };
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
    return withShadeN(m); };

  // build every mesh
  const fast = { shirt: (x, y, z) => shirtSdf(x, y, z, bodyAt), pants: (x, y, z) => pantsSdf(x, y, z, bodyAt), sock: (x, y, z) => sockSdf(x, y, z, bodyAt) };
  const parts = {};
  const meshPart = (name, h = H) => { const s = partSpec(name, { OPT, H: h, kit, bodyAt }); return mesh(name, s.sdf, s.lo, s.hi, s.h, s.bone1, s.only, s.fast, s.soft); };   // the part table (parts.js) is shared with the workers
  parts.body = skinned(meshPart("body"), OPT.colors.skin, 0.005, "body"); if (mesh.last) bodyAt = gridSampler(mesh.last, bodySdf);   // (from the cache there is no grid: the clothes then read the body itself)
  lap("meshBody");
  addPaint(parts.body.m.geometry); parts.body.m.material.dispose(); parts.body.m.material = parts.body.toonMat = shadeToon(OPT.colors.skin);
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
    for (let i = 0; i + 1 < shin.length; i++) out.push({ bone: `lowerLeg.${s}`, a: shin[i][0], b: shin[i + 1][0], ra: shin[i][1], rb: shin[i + 1][1], thigh: false });
    return out; };
  const cloth = SKO ? createCloth({ m: parts.pants.m, o: parts.pants.o, skeleton, root, top: ST.fwd(SKO.top), hem: ST.fwd(SKO.hem), colliders: [...legCols("L"), ...legCols("R")], body: parts.body.m }) : null;
  // the cape: cloth too, hanging from the shoulders; it keeps clear of the legs and the arms, and of the body's surface from the hips to the
  // shoulders. It sways: points keep their motion in the world (cape.sway), so it trails behind when the character walks or runs
  const CA = OPT.outfit.cape;
  parts.cape = skinned(meshPart("cape"), CA.color, 0.005, null);
  const armCols = (s) => [["upperArm", "lowerArm", 0.042], ["lowerArm", "hand", 0.036]].map(([a, b, r]) => ({ bone: `${a}.${s}`, a: Jr[`${a}.${s}`], b: Jr[`${b}.${s}`], ra: r + CM + CA.thick, rb: r + CM + CA.thick, thigh: false, outward: true }));   // + the cape's thickness: its inner side rides on the outer one (cloth.js) and went into the arm
  const capeCloth = CA.on ? createCloth({ m: parts.cape.m, o: parts.cape.o, skeleton, root, top: ST.fwd(CA.collar + 0.01), hem: ST.fwd(CA.hem), colliders: [...legCols("L"), ...legCols("R"), ...armCols("L"), ...armCols("R")], body: parts.body.m,
    bodyRegion: { yMax: capeTop(Jr) + 0.04, bones: ["hips", "spine", "chest", "upperChest", "shoulder.L", "shoulder.R", "upperLeg.L", "upperLeg.R", "lowerLeg.L", "lowerLeg.R"] }, sway: CA.sway ?? 1 }) : null;
  parts.shoes = skinned(meshPart("shoes"), OPT.outfit.shoes.color, 0.005, "shoes");
  parts.soles = skinned(meshPart("soles"), OPT.outfit.shoes.soleColor, 0.005, "soles");
  parts.socks = skinned(meshPart("socks"), OPT.outfit.socks.color, 0.003, "socks");
  const AO = OPT.outfit.armor, DECO_COLOR = { plume: "#d6453d", horns: "#eee3c9", wings: "#f6f3ec" }, armorColor = (k) => k === "armorMail" ? AO.mailColor : k === "armorVisor" ? AO.visorColor : k === "armorDeco" ? (AO.decoColor ?? DECO_COLOR[AO.deco] ?? AO.color) : AO.color, isMetal = (k) => (k === "weaponR" || k === "weaponL") || ARMOR.includes(k) && !["armorMail", "armorVisor", "armorDeco"].includes(k);
  for (const k of ARMOR) { parts[k] = skinned(meshPart(k), armorColor(k), k === "armorMail" ? 0.003 : 0.004); if (isMetal(k)) { parts[k].m.material.dispose(); parts[k].m.material = metal(OPT.shading.style, AO.color); } }   // armor: hard pieces (clothes/armor.js, plate.js), shiny; full plate also has mail under it and a dark slab behind the visor
  const WO = OPT.outfit.weapon, weaponColor = (k) => k === "weaponRGrip" || k === "weaponLGrip" ? WO.gripColor : k === "weaponLFace" ? WO.shieldColor : WO.color;
  for (const k of WEAPONS) { parts[k] = skinned(meshPart(k), weaponColor(k), 0.004); if (k === "weaponR" || k === "weaponL") { parts[k].m.material.dispose(); parts[k].m.material = metal(OPT.shading.style, WO.color); } }   // in the hands (clothes/weapons.js)
  lap("shadeAndClothes");
  const makeHair0 = (h) => skinned(meshPart(hairPartName(hairPick), h), OPT.colors.hair, 0.004, "hair");
  const makeHair = (h) => { const x = makeHair0(h); addHairUV(x.m.geometry); x.m.material.dispose(); x.m.material = hairMat(OPT.colors.hair); return x; };
  parts.hair = makeHair(H);
  // hair as locks (hair/locks.js): flat ribbons with sharp tips, each a chain that swings. Long hair: locks hanging from the back of the head
  // over the short hair's block (hair/index.js leaves the long curtain out when hair.sculpt.long.locks is on). The nendo bangs: one lock
  // per tip of hair.sculpt.nendo.tips (with nendo.locks on), lying over the forehead
  const LOCK_PARTS = ["locks", "bangs", "drawn", "tails", "tailTie"];   // tails: pony / twin / side tails (options.hair.tail), tailTie: their hair ties   // drawn: locks drawn by hand (options.hair.drawn, see drawnLocks in hair/locks.js)
  // the surface the bang locks lie on (head space): the hair under them and the forehead
  let bangKitMemo = null;   // the same until the hair under the bangs changes (setHair)
  // the skull's ball is in it too: the head's base is cut off level behind the ears (chin.napeY), and under it there is only the neck, so a
  // side tuft ending low (below the base) lay on the neck as a thin stick behind the ear. The ball keeps the tufts out where the head was round
  const bangKit = () => bangKitMemo ??= (() => { const capRaw = hairKit.hairSdfOf(hairPick), SK = OPT.body.sculpt.skull; return { surf: (x, y, z) => Math.min(capRaw(x, y, z), bodySdfRaw(x, y, z), dPrim(P.skull, x, y, z)), center: [0, SK.y, -0.005], toRoot: (x, y, z) => HTr.fromHead(x, y, z), sx: HT.sx }; })();
  function makeLocks(which = LOCK_PARTS) {   // which: the lock parts to make (e.g. ["bangs"] when only the bangs changed)
    const L = OPT.hair.sculpt.long, SL = OPT.hair.sculpt.shortLocks, out = {}, longOn = which.includes("locks") && hairPick.back === "long" && L.locks, shortOn = which.includes("locks") && (hairPick.back === "short" || hairPick.back === "hang") && SL?.on, bangsOn = which.includes("bangs") && hairKit.bangsAsLocks(hairPick);
    const drawnOn = which.includes("drawn") && (OPT.hair.drawn ?? []).some((d) => d?.pts?.length >= 2);
    const TL = OPT.hair.tail, tailsOn = which.includes("tails") && TL?.kind && TL.kind !== "none";
    if (!longOn && !shortOn && !bangsOn && !drawnOn && !tailsOn) return out;
    const capRaw = hairKit.hairSdfOf(hairPick), cap = HTr.wrap(capRaw), c = HTr.fromHead(0, 1.125, -0.02);
    const outward = (x, y, z, M) => { const e = M.elements, cx = e[0] * c[0] + e[4] * c[1] + e[8] * c[2] + e[12], cy = e[1] * c[0] + e[5] * c[1] + e[9] * c[2] + e[13], cz = e[2] * c[0] + e[6] * c[1] + e[10] * c[2] + e[14];
      return [x - cx, Math.max(0, y - cy), z - cz]; };   // from the head's center, or from the line under it (hair hanging down faces out sideways)
    const part = (specs, opt) => { const sim = createLocks({ specs, head: BI.head, skeleton, root, outward, ...opt }), x = skinned(sim.geometry, OPT.colors.hair, 0.003); x.sim = sim; return x; };
    if (longOn || shortOn) {
      const ell = { c, r: [surfaceAlong(cap, c, [1, 0, 0]), surfaceAlong(cap, c, [0, 1, 0]), surfaceAlong(cap, c, [0, 0, -1])] };   // the hair under the locks, as an ellipsoid (for the locks to slide over)
      const coll = lockColliders(Jr, BI, bodySdfR);
      if (longOn) out.locks = part(longLocks(L, { cap, center: c, coll, ellipsoid: ell, hugY: L.hug ? HTr.fromHead(0, L.yc, 0)[1] : null }), { coll, ell, stiff: L.stiff ?? 1, damping: L.damping ?? 0.9 });
      else { const B = hairKit.BACKS.short, bottom = (th) => HTr.fromHead(0, B.side - (B.side - B.back) * Math.sqrt(Math.max(0, -Math.cos(th))) - (SL.below ?? 0.02), 0)[1];   // short hair: locks over the block down to its hem (lower at the nape: a U across the back, not a V)
        out.locks = hairPick.back === "hang" ? part(ringLocks(SL, { cap, center: c, coll, ellipsoid: ell, bottom, N: 8 }), { coll, ell, stiff: SL.stiff ?? 3, damping: 0.85 })   // hanging: draped from the back of the head, standing off the nape (which shows under them)
          : part(surfaceLocks({ ...SL, ...SL.lie }, { cap, center: c, bottom }), { coll: [], ell: null, stiff: SL.stiff ?? 3, damping: 0.85 }); }   // lying on the hair: no colliders (they would push the locks off the nape's inward curve)
    }
    if (bangsOn) {
      const B = OPT.hair.sculpt.nendo;
      const specs = bangLocks(B, bangKit()), long = specs.some((sp) => sp.stiff < 1);   // a tuft hanging long keeps off the neck, the shoulders and the chest
      out.bangs = part(specs, { coll: long ? lockColliders(Jr, BI, bodySdfR) : [], ell: null, stiff: B.lockStiff ?? 4, damping: long ? 0.88 : 0.8 });
    }
    if (tailsOn) {   // the ties: on the hair at an angle around the head (degrees, 0 = front; twin tails mirrored) and a height (head space)
      const K = bangKit(), D2R = Math.PI / 180, sd = TL.side === "R" ? -1 : 1;
      const def = { pony: [[180, 1.13]], twin: [[105, 1.1], [-105, 1.1]], side: [[sd * 100, 1.07]] }[TL.kind] ?? [];
      const anchors = def.map(([a0, y0]) => { const a = (TL.angle ?? Math.abs(a0)) * (a0 < 0 ? -1 : 1) * (TL.kind === "side" ? sd * Math.sign(a0) : 1), y = TL.y ?? y0;
        const d = [Math.sin(a * D2R), 0, Math.cos(a * D2R)], c0 = [0, y, -0.005], t = surfaceAlong(K.surf, c0, d) + 0.004;
        const up = TL.kind === "pony" ? 0.35 : 0.12, ol = Math.hypot(d[0], up, d[2]);   // outward: away from the head, a little up (a ponytail more)
        return { p: HTr.fromHead(c0[0] + d[0] * t, c0[1], c0[2] + d[2] * t), o: [d[0] / ol, up / ol, d[2] / ol] }; });
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
  Object.assign(parts, makeLocks());
  lap("hair");
  // what is worn (options.outfit.*.on): the meshes are built either way, so putting a garment on later is instant
  const GARMENTS = { shirt: ["shirt"], pants: ["pants"], socks: ["socks"], shoes: ["shoes", "soles"], cape: ["cape"], armor: ARMOR };
  const show = (k, on) => { const x = parts[k]; x.on = x.m.visible = x.o.visible = on; };
  const wear = (g, on) => { OPT.outfit[g].on = on; for (const k of GARMENTS[g]) show(k, on);
    if (AO.style === "full") { const plate = OPT.outfit.armor.on;   // full plate hides the clothes and the hair (they would poke out between the plates); taking it off brings back what is worn
      if (g === "armor") { for (const h of ["shirt", "pants", "socks", "shoes", "cape"]) for (const k of GARMENTS[h]) show(k, !plate && OPT.outfit[h].on !== false); show("hair", !plate); for (const k of LOCK_PARTS) if (parts[k]) show(k, !plate); }
      else if (plate) for (const k of GARMENTS[g]) show(k, false); } };
  for (const g in GARMENTS) if (OPT.outfit[g].on === false) wear(g, false);
  if (AO.on) wear("armor", true);
  // ear line: a thin drawn line inside each ear (anime style), as a small tube lying on the ear's front, attached to the head bone
  const EL = OPT.face.earLine; let earLine = null;
  if (EL.on) { earLine = new THREE.Group(); earLine.name = "earLine"; const mat = new THREE.MeshBasicMaterial({ color: EL.color }), deg = Math.PI / 180;
    root.updateMatrixWorld(true); const inv = bone.head.matrixWorld.clone().invert();
    for (const E of EARS) { const pts = [], N = 24;
      for (let i = 0; i <= N; i++) { const a = (EL.a0 + (EL.a1 - EL.a0) * i / N) * deg, ph = [0, 1, 2].map((k) => E.c[k] + (E.eu[k] * (EL.cu + Math.cos(a) * EL.ru) + E.ev[k] * (EL.cv + Math.sin(a) * EL.rv) + E.ew[k] * 0.05) * E.ES);
        let p = HTr.fromHead(...ph); const d = E.ew;
        for (let t = 0; t < 60; t++) { const f = bodySdfR(...p); if (f < 0.0004) break; p = p.map((v, k) => v - d[k] * Math.min(f, 0.01)); }   // slide back onto the ear's front
        pts.push(new THREE.Vector3(p[0] + d[0] * EL.lift, p[1] + d[1] * EL.lift, p[2] + d[2] * EL.lift)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, EL.width, 6, false); g.applyMatrix4(inv); earLine.add(new THREE.Mesh(g, mat)); }
    bone.head.add(earLine); }

  lap("earLine");
  // face: parts drawn into a texture on a thin copy of the front of the head
  let faceDrawHook = null, faceWrap = debug.faceWrap ?? null, blinking = false, blinkAt = 2.5;
  const face = createFace(OPT, { FACE_DY, onImage: () => avatar.drawFace() });
  const FP = OPT.face.parts, faceSel = { eyes: FP.eyes, brows: FP.brows, mouth: FP.mouth, cheeks: FP.cheeks, nose: FP.nose ?? (OPT.face.noseShadow.on ? "shadow" : "none") };   // nose null: follow noseShadow.on
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
  if (cull) { const Pa = bodyGeo.attributes.position.array, kept = building && hit?.cover;   // remembered with the meshes (same shape, same answer; recomputing reads the whole body ~0.25 s)
    if (kept && kept.length === Pa.length / 3) coverBits = kept;
    else { coverBits = new Uint8Array(Pa.length / 3);
      COVER.forEach(([, f], b) => { for (let v = 0; v < coverBits.length; v++) if (f(Pa[v * 3], ST.inv(Pa[v * 3 + 1]), Pa[v * 3 + 2]) < -COVER_DEPTH) coverBits[v] |= 1 << b; });   // (the garments' shapes are at the base proportions)
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
  const playPose = createPosePlayer({ bone, BONES, HIPS0, HANDS, yK: ST.legK, weapon: OPT.outfit.weapon?.right ?? "none", left: OPT.outfit.weapon?.left ?? "none", shieldMount: OPT.outfit.weapon?.shieldMount ?? "diagonal" });
  let poseName = "aPose", time = 0, lastPose = { b: {} };
  // seat fit (poses with seat: h): the bottom rests on the seat. A few hundred vertices of the bottom and the backs of the thighs (body and pants)
  // are skinned each frame; the lowest of the visible ones sets how much the hips go up or down (seatAdj, added to the pose's own hip height)
  const SEAT_PROBE = ["body", "pants"].map((k) => { const m = parts[k].m, A = m.geometry.attributes.position, idx = [];
    for (let i = 0; i < A.count; i++) { const x = A.getX(i), y = A.getY(i), z = A.getZ(i); if (Math.abs(x) < 0.17 && y > 0.22 && y < 0.5 && z > -0.16 && z < 0.12) idx.push(i); }
    const step = Math.max(1, Math.ceil(idx.length / 500)); return { m, idx: idx.filter((_, j) => j % step === 0) }; });
  const seatV = new THREE.Vector3(); let seatAdj = 0;
  function seatLow(front) { root.updateMatrixWorld(true); let lo = Infinity;   // front: the seat's front edge (z); the thighs beyond it are not on the seat
    for (const { m, idx } of SEAT_PROBE) { if (!m.visible) continue; for (const i of idx) { m.getVertexPosition(i, seatV); seatV.applyMatrix4(m.matrixWorld); root.worldToLocal(seatV); if (seatV.z < front && seatV.y < lo) lo = seatV.y; } }
    return lo; }

  const avatar = {
    object: root, bones: bone, skeleton, options: OPT, parts, PROF, TIMES, earLine, cloth, capeCloth,
    /** internals for tools and checking (shapes, face texture, joints) */
    internals: { J: Jr, BONES, HIPS0, P, CUT, HEAD, EAR, HT: HTr, bodySdf: bodySdfR, bodySdfSlow, bodySdfRaw, ST, Jbase: J, HTbase: HT, face, hairKit, hairPick, get faceLayer() { return faceLayer; } },
    get faceLayer() { return faceLayer; },
    get pose() { return poseName; },
    get lastPose() { return lastPose; },
    get faceSel() { return faceSel; },

    /** Advance motion and blinking. t: absolute time to use instead of advancing (for freezing a frame). instant: jump straight to the pose. */
    update(dt, { t, instant = false, pose } = {}) {
      syncCover();
      time = t ?? time + dt;
      lastPose = playPose(pose ?? poseName, time, dt, instant, seatAdj);
      if (!ST.identity && lastPose.seat != null) lastPose = { ...lastPose, seat: ST.fwd(lastPose.seat) };   // a seat as high as the knees: higher for longer legs
      if (lastPose.seat != null) { const lo = seatLow(lastPose.seatFront ?? Infinity); if (lo < Infinity) {   // aim the hips at where they are now + the gap, and move there smoothly
        const e = lastPose.seat - lo, k = instant ? 1 : 1 - Math.exp(-dt * 9); seatAdj = Math.max(-0.08, Math.min(0.08, bone.hips.position.y - HIPS0.y - (lastPose.y || 0) + e)); bone.hips.position.y += e * k; } }
      else seatAdj *= instant ? 0 : Math.exp(-dt * 9);
      { const seat = lastPose.seat != null ? { y: lastPose.seat, front: lastPose.seatFront ?? Infinity } : null; cloth?.update(dt, instant, seat); capeCloth?.update(dt, instant, null); }   // the cape hangs behind the chair's seat (lifted onto it, it stood out sideways)
      for (const k of LOCK_PARTS) if (parts[k]?.m.visible) parts[k].sim.update(dt, instant);
      if (!faceDrawHook && time > blinkAt && !blinking) { blinking = true; avatar.drawFace(); }
      if (blinking && time > blinkAt + 0.12) { blinking = false; avatar.drawFace(); blinkAt = time + 2.5 + Math.random() * 3; }
    },
    play(name) { if (!POSES[name]) throw new Error(`Unknown motion "${name}". Available: ${Object.keys(POSES).join(", ")}`); poseName = name; },

    /** Face (instant): an expression id ("happy", see EXPRESSIONS; a drawn one "image@<id>", see options.face.drawn), or parts by slot { eyes, brows, mouth, cheeks, nose } (ids in PART_LABELS). Kept in options.face.parts. */
    setFace(sel) {
      if (typeof sel === "string") { const e = face.PRESETS[expressionId(sel)]; if (!e) throw new Error(`Unknown expression "${sel}". Available: ${Object.keys(face.PRESETS).join(", ")}`); sel = e; }   // drawn expressions too ("image@<id>")
      sel = partIds(sel); Object.assign(faceSel, sel); Object.assign(OPT.face.parts, sel); avatar.drawFace();
    },
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
    setColors({ skin, hair, eyes, shirt, pants, shoes, soles, socks, armor, weapon, grip, shield, dress, cape } = {}) {
      if (skin) { parts.body.toonMat.color.set(skin); OPT.colors.skin = skin; }
      if (hair) { OPT.colors.hair = hair; for (const k of LOCK_PARTS) if (k !== "tailTie") parts[k]?.m.material.color.set(hair); const old = parts.hair.m.material; parts.hair.m.material = hairMat(hair); parts.hair.m.material.wireframe = old.wireframe; old.dispose(); }   // a new material: the angel ring's color follows the hair color
      if (eyes) { OPT.colors.eyes = eyes; face.setEyeColor(eyes); avatar.drawFace(); }
      const DR = OPT.outfit.dress?.on;   // a dress: its top (the shirt) and its skirt (the pants) are the dress's color
      for (const [k, c] of Object.entries({ shirt, pants, shoes, socks })) if (c) { OPT.outfit[k].color = c; if (!(DR && (k === "pants" || k === "shirt"))) parts[k].m.material.color.set(c); }
      if (dress !== undefined) OPT.outfit.dress.color = dress;   // null: the shirt's color
      if (DR && (shirt || dress !== undefined)) for (const k of ["shirt", "pants"]) parts[k].m.material.color.set(skirtOf(OPT).color);
      if (cape) { parts.cape.m.material.color.set(cape); OPT.outfit.cape.color = cape; }
      if (soles) { parts.soles.m.material.color.set(soles); OPT.outfit.shoes.soleColor = soles; }
      if (armor) { for (const k of ARMOR) if (isMetal(k)) parts[k].m.material.color.set(armor); OPT.outfit.armor.color = armor; }
      for (const [c, k, key] of [[weapon, ["weaponR", "weaponL"], "color"], [grip, ["weaponRGrip", "weaponLGrip"], "gripColor"], [shield, ["weaponLFace"], "shieldColor"]]) if (c) { for (const q of k) parts[q].m.material.color.set(c); OPT.outfit.weapon[key] = c; }
    },
    /** Put garments on or take them off (instant): { shirt, pants, socks, shoes } as true / false. Kept in options.outfit.*.on. */
    setWorn(worn = {}) { for (const [g, on] of Object.entries(worn)) { if (!GARMENTS[g]) throw new Error(`Unknown garment "${g}". Available: ${Object.keys(GARMENTS).join(", ")}`); wear(g, !!on); } },
    /** Outline (instant, no rebuild): { on, width (1 = default), color }. Some art styles want none: { on: false }. */
    setOutline({ on, width, color } = {}) {
      Object.assign(OPT.outline, Object.fromEntries(Object.entries({ on, width, color }).filter(([, v]) => v !== undefined)));
      root.traverse((x) => { if (!x.userData.outline) return; const m = x.material; m.visible = OPT.outline.on; m.color.set(OPT.outline.color); m.userData.width.value = m.userData.baseWidth * OPT.outline.width; });
    },
    /** Shading (instant, no rebuild): a style "toon" | "smooth" | "flat" (see SHADINGS), or { style, bands, soften }:
     *  bands 2 (light / shadow) or 3 (with a mid tone), soften 0.. how far the shading normals are smoothed (0 = the mesh's own, 1 = default). Keeps the current colors. */
    setShading(s) {
      const { style = OPT.shading.style, bands = OPT.shading.bands, soften = OPT.shading.soften } = typeof s === "string" ? { style: s } : s;
      if (!SHADINGS.includes(style)) throw new Error(`Unknown shading "${style}". Available: ${SHADINGS.join(", ")}`);
      if (bands !== 2 && bands !== 3) throw new Error(`shading.bands is 2 or 3, not ${bands}`);
      const resoften = soften !== OPT.shading.soften; Object.assign(OPT.shading, { style, bands, soften });
      if (resoften) { for (const [k, x] of Object.entries(parts)) if (x.m.geometry.attributes.shadeN && !x.sim) addSoftNormals(k, x.m.geometry); buildFaceLayer(); }   // the face layer copies the head's shading normals
      for (const [k, x] of Object.entries(parts)) {
        if (k === "body") { const old = x.toonMat, nm = shadeToon(old.color.getHex()); if (x.m.material === old) x.m.material = nm; x.toonMat = nm; old.dispose(); continue; }   // the body's normal material (a page may be showing another one, e.g. clay)
        const old = x.m.material; x.m.material = k === "hair" ? hairMat(old.color.getHex()) : isMetal(k) ? metal(style, old.color.getHex()) : shadedFor(x.m.geometry, old.color.getHex(), style); x.m.material.wireframe = old.wireframe; old.dispose();
      }
      { const old = faceLayer.material; faceLayer.material = face.faceMatFor(style, bands); old.dispose(); }   // 顔の絵も同じ陰影に
    },
    /** Soft blush on the cheeks and the nose tip (instant): { cheeks: { on, color, strength, size, x, y }, nose: { on, color, strength, size } }. */
    setBlush({ cheeks, nose } = {}) { if (cheeks) Object.assign(OPT.face.blush.cheeks, cheeks); if (nose) Object.assign(OPT.face.blush.nose, nose); avatar.drawFace(); },
    /** Rebuild the hair: pick = { bangs, back, ahoge } (names in internals.hairKit.BANGS / BACKS). Kept in options.hair. */
    setHair(pick) {
      Object.assign(hairPick, pick); for (const k of ["bangs", "back", "ahoge"]) OPT.hair[k] = hairPick[k]; bangKitMemo = null;
      const on = parts.hair.on; for (const m of [parts.hair.m, parts.hair.o]) { root.remove(m); m.geometry.dispose(); }
      parts.hair = makeHair(H); parts.hair.on = on;
      for (const k of LOCK_PARTS) if (parts[k]) { for (const m of [parts[k].m, parts[k].o]) { root.remove(m); m.geometry.dispose(); } delete parts[k]; }
      for (const [k, x] of Object.entries(makeLocks())) { parts[k] = x; x.on = on; x.m.visible = x.o.visible = parts.hair.m.visible; }
    },

    /** The nendo bangs: values into options.hair.sculpt.nendo ({ tips, overlap, lockThick, … }). Bangs made of locks rebuild only themselves
     *  (fast enough to follow an editor's handles); otherwise, or when the hair under them changes too, the whole hair is rebuilt. */
    /** The back hair's locks (instant-ish, no other part rebuilt): values into options.hair.sculpt[group], group "shortLocks" or "long"
     *  (count, width, thick, flick, stiff, below / bottom …; for shortLocks.lie, pass { lie: { … } }). */
    setLocks(group, values) {
      if (group === "shortLocks.lie") { group = "shortLocks"; values = { lie: values }; }
      const G = OPT.hair.sculpt[group]; for (const [k, v] of Object.entries(structuredClone(values))) { if (v && typeof v === "object" && !Array.isArray(v) && G[k] && typeof G[k] === "object") Object.assign(G[k], v); else G[k] = v; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.locks) { for (const m of [parts.locks.m, parts.locks.o]) { root.remove(m); m.geometry.dispose(); } delete parts.locks; }
      const x = makeLocks(["locks"]).locks; if (x) { parts.locks = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    /** Locks drawn by hand (options.hair.drawn): [{ pts: [[x, y, z], …] (head space, root to tip), width (m), thick (×width), stiff, mirror }].
     *  Rebuilds only them. */
    /** Tails (options.hair.tail: { kind: "none" | "pony" | "twin" | "side", side, angle, y, length, volume, count, width, thick, lift, spread, stiff, tie: { on, color, size } }).
     *  Rebuilds only them and their ties. */
    setTails(values) {
      const TL = OPT.hair.tail; for (const [k, v] of Object.entries(structuredClone(values))) { if (k === "tie" && v && typeof v === "object") Object.assign(TL.tie, v); else TL[k] = v; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      for (const k of ["tails", "tailTie"]) if (parts[k]) { for (const m of [parts[k].m, parts[k].o]) { root.remove(m); m.geometry.dispose(); } delete parts[k]; }
      for (const [k, x] of Object.entries(makeLocks(["tails"]))) { parts[k] = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    setDrawnHair(list) {
      OPT.hair.drawn = structuredClone(list ?? []);
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.drawn) { for (const m of [parts.drawn.m, parts.drawn.o]) { root.remove(m); m.geometry.dispose(); } delete parts.drawn; }
      const x = makeLocks(["drawn"]).drawn; if (x) { parts.drawn = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    setBangs(values) {
      const N = OPT.hair.sculpt.nendo, was = hairKit.bangsAsLocks(hairPick); Object.assign(N, structuredClone(values));
      if (!was || !hairKit.bangsAsLocks(hairPick) || ["locks", "lockTaper"].some((k) => k in values)) { avatar.setHair({}); return; }
      const on = parts.hair.on, vis = parts.hair.m.visible;
      if (parts.bangs) { for (const m of [parts.bangs.m, parts.bangs.o]) { root.remove(m); m.geometry.dispose(); } delete parts.bangs; }
      const x = makeLocks(["bangs"]).bangs; if (x) { parts.bangs = x; x.on = on; x.m.visible = x.o.visible = vis; }
    },
    /** Where a tip of the nendo bangs is (avatar space, rest pose; just outside the hair): angle around the head (degrees, 0 = front), height (head space). */
    /** The back hair's locks as built (avatar space, rest pose): [{ i, tip: [x, y, z], root }] in the order of their edits (hair.sculpt.*.edits),
     *  and which group they belong to: "shortLocks" (hanging), "shortLocks.lie" (lying) or "long". Empty without back locks. */
    backLocks() { const sim = parts.locks?.sim; if (!sim) return { group: null, locks: [] };
      const group = hairPick.back === "long" ? "long" : hairPick.back === "short" ? "shortLocks.lie" : "shortLocks";
      return { group, locks: sim.specs.map((s, i) => ({ i, tip: s.pts.at(-1), root: s.pts[0] })) }; },
    bangTipAt(angle, y) { return bangTipAt(angle, y, { ...bangKit(), hangY: OPT.hair.sculpt.nendo.lockHangY ?? 0.86 }); },

    /** GLB of the avatar in the A-pose (outlines left out). */
    async exportGLB() {
      const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
      const outs = []; root.traverse((o) => { if (o.userData.outline && o.visible) { o.visible = false; outs.push(o); } });
      cloth?.rest(); capeCloth?.rest();   // the skirt and the cape as built (not as the cloth has them now)
      for (const k of LOCK_PARTS) parts[k]?.sim.rest();   // the locks as they hang in the rest pose
      const saved = BONES.map((b) => bone[b].quaternion.clone()), hy = bone.hips.position.y;
      BONES.forEach((b) => bone[b].quaternion.identity()); bone.hips.position.copy(HIPS0);
      const restore = () => { outs.forEach((o) => { o.visible = true; }); BONES.forEach((b, i) => bone[b].quaternion.copy(saved[i])); bone.hips.position.y = hy; };
      return new Promise((ok, ng) => new GLTFExporter().parse(root, (buf) => { restore(); ok(buf); }, (e) => { restore(); ng(e); }, { binary: true }));
    },

    /** Fingerprint of mesh positions and skin weights (for checking refactors). */
    checksum() { return ["body", "shirt", "pants", "socks", "shoes", "soles", "hair"].map((k) => parts[k]).map((x) => { const a = x.m.geometry.attributes; let h = 0; for (const k of ["position", "skinIndex", "skinWeight"]) { const v = a[k].array; for (let i = 0; i < v.length; i++) h = (h * 31 + Math.round(v[i] * 1e5)) % 1000000007; } return h; }); },

    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); } }); face.faceTex.dispose(); root.removeFromParent(); },
  };
  avatar.drawFace(); lap("drawFace");
  syncCover(); lap("syncCover"); TIMES.total = Math.round(performance.now() - T00);
  building = false;
  if (useCache && Object.keys(fresh).length) cachePut(cacheKey, fresh);   // not awaited: storing happens after the avatar is already on screen
  return avatar;
}
