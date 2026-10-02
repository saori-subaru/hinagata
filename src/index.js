// Hinagata: code-generated chibi avatars for three.js.
//
//   const avatar = await createAvatar({ hair: { back: "bob" } });
//   scene.add(avatar.object);
//   avatar.play("walk");
//   // every frame: avatar.update(dt)
//
import * as THREE from "three";
import { sstep } from "./sdf/prim.js";
import { surfaceNets, gridSampler } from "./sdf/mesh.js";
import { hashKey, sourceHash, cacheGet, cachePut } from "./cache.js";
import { shaded, SHADINGS, outlineMat } from "./materials.js";
import { DEFAULTS, resolveOptions } from "./options.js";
import { buildBody } from "./body/index.js";
import { buildClothes } from "./clothes/index.js";
import { buildHair } from "./hair/index.js";
import { makeSkeleton, makeWeights } from "./rig.js";
import { createFace } from "./face/index.js";
import { POSES, createPosePlayer } from "./motion/index.js";

export { DEFAULTS, POSES, SHADINGS, resolveOptions };
export { BODY_TYPES } from "./body/types.js";

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
 *             debug: { slow, oldSock, faceWrap } — checking aids, normally unused }
 */
// options without the parts that only change colors, the outline, the shading or the blush (the geometry is the same, so the cache can reuse it)
function shapeOnly(OPT) {
  const strip = (o) => { if (!o || typeof o !== "object") return o; const r = Array.isArray(o) ? [] : {}; for (const [k, v] of Object.entries(o)) if (!/^(color|soleColor)$/.test(k)) r[k] = strip(v); return r; };
  const { colors, outline, shading, ...rest } = OPT, { blush, ...face } = OPT.face; return { ...rest, face, outfit: strip(OPT.outfit) };
}

export async function createAvatar(options = {}, { quality = "game", cell = 0, simplify = 1, cache = true, cull = true, debug = {} } = {}) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint (e.g. a "building…" message) before the heavy work
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

  // shapes
  const { J, PARENT, BONES, BI, P, CUT, EARS, faceWarp, PLANES, BODY, HEAD, CROTCH, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT } = buildBody(OPT, { slow: !!debug.slow, oldSock: !!debug.oldSock });
  const { pantsSdf, shirtSdf, shoeSdf, sockSdf, soleSdf } = buildClothes(OPT, { P, CROTCH, bodySdf });
  const hairKit = buildHair(OPT, { P, CUT, PLANES, faceWarp, bodySdf: bodySdfRaw });   // hair is shaped on the untransformed head, then scaled with it
  const weightsAt = makeWeights({ BODY, BONES, BI });
  const { root, bone, skeleton, HIPS0 } = makeSkeleton({ J, PARENT, BONES });

  // shape → skinned mesh
  const PROF = [];   // per mesh: vertex count and build time (ms)
  let bodyAt = (x, y, z) => bodySdf(x, y, z);   // body distance; after the body is meshed, read back from its grid (clothes don't recompute the body)
  // name: which part (the cache key inside this character) / fast: cheaper sdf for grid sampling / bone1: bind everything to this bone / only: RegExp of bones allowed
  function mesh(name, sdf, lo, hi, h, bone1, only, fast = sdf) {
    const T0 = performance.now(); let rec = hit?.[name], time = null;
    mesh.last = null;
    if (!rec) {
      const r = surfaceNets(sdf, lo, hi, h, { fast, band: OPT.quality.band, proj: OPT.quality.project }); mesh.last = r.grid; time = r.time;
      let pos = new Float32Array(r.pos), nor = r.nor, idx = new Uint32Array(r.idx);
      if (MS) ({ pos, nor, idx } = simplified(pos, nor, idx));
      const nv = pos.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), tmp = { idx: [0, 0, 0, 0], w: [0, 0, 0, 0] };
      for (let v = 0; v < nv; v++) { tmp.idx.fill(0); tmp.w.fill(0); if (bone1) { tmp.idx[0] = BI[bone1]; tmp.w[0] = 1; } else weightsAt(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], tmp, only);
        for (let q = 0; q < 4; q++) { si[v * 4 + q] = tmp.idx[q]; sw[v * 4 + q] = tmp.w[q] || 0; } }
      rec = fresh[name] = { pos, nor, idx, si, sw };
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(rec.pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(rec.nor, 3)); g.setIndex(new THREE.BufferAttribute(rec.idx, 1));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(rec.si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(rec.sw, 4));
    PROF.push({ part: name, verts: rec.pos.length / 3, ms: Math.round(performance.now() - T0), cached: !time, sample: time ? Math.round(time.sample) : 0, project: time ? Math.round(time.project) : 0 });
    return g;
  }
  // keep `simplify` of the triangles (meshoptimizer), then drop the vertices nothing uses any more
  function simplified(pos, nor, idx) {
    const [out] = MS.simplify(idx, pos, 3, Math.max(3, Math.floor(idx.length * simplify / 3) * 3), 1, []);   // error 1 = let the triangle count decide
    const map = new Int32Array(pos.length / 3).fill(-1); let n = 0; for (const v of out) if (map[v] < 0) map[v] = n++;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let v = 0; v < map.length; v++) { const m = map[v]; if (m < 0) continue; for (let k = 0; k < 3; k++) { P[m * 3 + k] = pos[v * 3 + k]; N[m * 3 + k] = nor[v * 3 + k]; } }
    for (let i = 0; i < out.length; i++) out[i] = map[out[i]];
    return { pos: P, nor: N, idx: out };
  }
  function skinned(geo, color, ow = 0.005) {   // toon mesh + outline mesh, bound to the skeleton (ow: this part's outline width at outline.width 1)
    const m = new THREE.SkinnedMesh(geo, shaded(OPT.shading.style, color)); m.castShadow = true; m.frustumCulled = false; root.add(m); m.bind(skeleton);
    const om = outlineMat(ow * OPT.outline.width, OPT.outline.color); om.userData.baseWidth = ow; om.visible = OPT.outline.on;   // material.visible: the outline's on/off, apart from the mesh's own visibility (which pages use for "show this garment")
    const o = new THREE.SkinnedMesh(geo, om); o.frustumCulled = false; o.userData.outline = true; root.add(o); o.bind(skeleton);
    return { m, o, on: true };
  }

  // face shading: shade the head with normals borrowed from a smooth ellipsoid, so toon bands don't follow small bumps (clay view keeps the real normals)
  const FACE_SHADE = { w: OPT.face.shading.weight, c: [0, OPT.face.shading.y, OPT.face.shading.z], r: [0.25 * OPT.body.sculpt.skull.width / 0.249, OPT.face.shading.radiusY, OPT.face.shading.radiusZ] };
  function addShadeNormals(geo) {
    const Pa = geo.attributes.position.array, N = geo.attributes.normal.array, S = new Float32Array(N.length), F = FACE_SHADE, ears = [1, -1].map((m) => [m * EAR.x, EAR.y, -0.022]);
    for (let i = 0; i < Pa.length; i += 3) { const [x, y, z] = HT.toHead(Pa[i], Pa[i + 1], Pa[i + 2]);   // in head space
      let w = F.w * sstep(0.86, 0.93, y); for (const e of ears) w *= sstep(0.05, 0.1, Math.hypot(x - e[0], y - e[1], z - e[2]));   // head only; ears keep their own shading
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
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const x = Pa[i], y = Pa[i + 1], z = Pa[i + 2], ny = N[i + 1];
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
  const shadeToon = (c) => { const m = shaded(OPT.shading.style, c); m.onBeforeCompile = (sh) => {
    sh.vertexShader = "attribute vec3 shadeN;\nattribute vec3 paint;\nvarying vec3 vPaint;\n" + sh.vertexShader.replace("#include <beginnormal_vertex>", "vec3 objectNormal = shadeN;").replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPaint = paint;");
    sh.fragmentShader = "varying vec3 vPaint;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= vPaint;"); }; return m; };

  // hair paint (anime style, not lighting): thin darker strands flowing from the crown, and a bright band (angel ring) around the top.
  // Each hair vertex gets its direction from the head's center (head space): around the head (phi) and down from the crown (theta)
  function addHairUV(geo) {
    const Pa = geo.attributes.position.array, U = new Float32Array(Pa.length / 3 * 2), S = OPT.body.sculpt.skull;
    for (let i = 0, v = 0; i < Pa.length; i += 3, v++) { const [x, y, z] = HT.toHead(Pa[i], Pa[i + 1], Pa[i + 2]), dz = z + 0.005, dy = y - S.y;
      U[v * 2] = Math.atan2(x, dz); U[v * 2 + 1] = Math.atan2(Math.hypot(x, dz), dy); }
    geo.setAttribute("hairUV", new THREE.BufferAttribute(U, 2));
  }
  const glf = (v) => (+v).toFixed(4);
  const hairMat = (c) => { const m = shaded(OPT.shading.style, c), HP = OPT.hair.paint, St = HP.strands, R = HP.ring, rc = new THREE.Color(R.color);
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = "attribute vec2 hairUV;\nvarying vec2 vHair;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHair = hairUV;");
      sh.fragmentShader = "varying vec2 vHair;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
  { float ph = vHair.x, th = vHair.y, N = ${glf(St.count)};
    float s = ph * N / 6.2832 + ${glf(St.wobble)} * sin(th * 9.0 + ph * 2.0) + 0.25 * sin(ph * N * 0.37 + 1.3);   // strand lines: around the head, wavering a little
    float id = floor(s), f = fract(s), k = fract(sin(id * 12.9898) * 43758.5453);                                   // k: a random value per strand (strength / length)
    float line = (1.0 - smoothstep(0.0, ${glf(St.width)}, min(f, 1.0 - f))) * smoothstep(${glf(St.start)}, ${glf(St.start)} + 0.35, th) * step(0.25, k);
    float ring = 0.0;
    if (${R.on ? "true" : "false"}) { float z = abs(fract(ph * ${glf(R.teeth)} / 6.2832) - 0.5) * 2.0;                 // the ring's lower edge zigzags
      float lo = ${glf(R.center)} - ${glf(R.width)}, hi = ${glf(R.center)} + ${glf(R.width)} + ${glf(R.zig)} * z;
      ring = smoothstep(lo - 0.02, lo + 0.02, th) * (1.0 - smoothstep(hi - 0.02, hi + 0.02, th)) * smoothstep(-0.3, 0.3, cos(ph) + 0.4); }
    if (${St.on ? "true" : "false"}) diffuseColor.rgb *= 1.0 - ${glf(St.strength)} * line * (0.6 + 0.4 * k);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${glf(rc.r)}, ${glf(rc.g)}, ${glf(rc.b)}), ${glf(R.strength)} * ring * (1.0 - line)); }`); };
    return m; };

  // build every mesh
  const fast = { shirt: (x, y, z) => shirtSdf(x, y, z, bodyAt), pants: (x, y, z) => pantsSdf(x, y, z, bodyAt), sock: (x, y, z) => sockSdf(x, y, z, bodyAt) };
  const parts = {};
  parts.body = skinned(mesh("body", bodySdf, [-0.47, -0.02, -0.3], [0.47, 1.43, 0.34], H), OPT.colors.skin); if (mesh.last) bodyAt = gridSampler(mesh.last, bodySdf);   // (from the cache there is no grid: the clothes then read the body itself)
  addShadeNormals(parts.body.m.geometry); addPaint(parts.body.m.geometry); parts.body.m.material.dispose(); parts.body.m.material = parts.body.toonMat = shadeToon(OPT.colors.skin);
  parts.shirt = skinned(mesh("shirt", shirtSdf, [-0.3, 0.33, -0.2], [0.3, 0.86, 0.22], H * OPT.quality.shirtCell, null, /^(hips|spine|chest|upperChest|neck|upperArm)/, fast.shirt), OPT.outfit.shirt.color);
  parts.pants = skinned(mesh("pants", pantsSdf, [-0.28, 0.2, -0.2], [0.28, 0.55, 0.22], H * 1.2, null, /^(hips|spine|upperLeg|lowerLeg)/, fast.pants), OPT.outfit.pants.color);
  parts.shoes = skinned(mesh("shoes", shoeSdf, [-0.22, -0.01, -0.12], [0.22, 0.13, 0.14], H * 0.7, null, /^(foot|lowerLeg)/), OPT.outfit.shoes.color);
  parts.soles = skinned(mesh("soles", soleSdf, [-0.22, -0.01, -0.12], [0.22, 0.03, 0.14], H * 0.6, null, /^foot/), OPT.outfit.shoes.soleColor);
  parts.socks = skinned(mesh("socks", sockSdf, [-0.22, -0.01, -0.12], [0.22, 0.17, 0.14], H * 0.7, null, /^(foot|lowerLeg)/, fast.sock), OPT.outfit.socks.color, 0.003);
  const hairPick = { bangs: OPT.hair.bangs, back: OPT.hair.back, ahoge: OPT.hair.ahoge };
  const makeHair0 = (h) => skinned(mesh("hair:" + JSON.stringify(hairPick), HT.wrap(hairKit.hairSdfOf(hairPick)), [-0.4, hairPick.back === "long" ? 0.4 : 0.8, -0.42], [0.4, 1.5, 0.38], h * OPT.quality.hairCell, "head"), OPT.colors.hair, 0.004);   // long hair reaches down the back
  const makeHair = (h) => { const x = makeHair0(h); addHairUV(x.m.geometry); x.m.material.dispose(); x.m.material = hairMat(OPT.colors.hair); return x; };
  parts.hair = makeHair(H);
  // ear line: a thin drawn line inside each ear (anime style), as a small tube lying on the ear's front, attached to the head bone
  const EL = OPT.face.earLine; let earLine = null;
  if (EL.on) { earLine = new THREE.Group(); earLine.name = "earLine"; const mat = new THREE.MeshBasicMaterial({ color: EL.color }), deg = Math.PI / 180;
    root.updateMatrixWorld(true); const inv = bone.head.matrixWorld.clone().invert();
    for (const E of EARS) { const pts = [], N = 24;
      for (let i = 0; i <= N; i++) { const a = (EL.a0 + (EL.a1 - EL.a0) * i / N) * deg, ph = [0, 1, 2].map((k) => E.c[k] + (E.eu[k] * (EL.cu + Math.cos(a) * EL.ru) + E.ev[k] * (EL.cv + Math.sin(a) * EL.rv) + E.ew[k] * 0.05) * E.ES);
        let p = HT.fromHead(...ph); const d = E.ew;
        for (let t = 0; t < 60; t++) { const f = bodySdf(...p); if (f < 0.0004) break; p = p.map((v, k) => v - d[k] * Math.min(f, 0.01)); }   // slide back onto the ear's front
        pts.push(new THREE.Vector3(p[0] + d[0] * EL.lift, p[1] + d[1] * EL.lift, p[2] + d[2] * EL.lift)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, EL.width, 6, false); g.applyMatrix4(inv); earLine.add(new THREE.Mesh(g, mat)); }
    bone.head.add(earLine); }

  // face: parts drawn into a texture on a thin copy of the front of the head
  let faceDrawHook = null, faceWrap = debug.faceWrap ?? null, blinking = false, blinkAt = 2.5;
  const face = createFace(OPT, { FACE_DY, onImage: () => avatar.drawFace() });
  const faceSel = { eyes: "まる目", brows: "ふつう", mouth: "にこ", cheeks: "なし", nose: OPT.face.noseShadow.on ? "影" : "なし" };   // default: code-drawn face (no image files needed)
  let faceLayer = null;
  function buildFaceLayer() {
    const g = face.faceLayerGeometry(parts.body.m.geometry, faceWrap, HT.identity ? null : HT.toHead);
    if (faceLayer) { root.remove(faceLayer); faceLayer.geometry.dispose(); }
    faceLayer = new THREE.SkinnedMesh(g, face.faceMat); faceLayer.name = "face"; faceLayer.frustumCulled = false; faceLayer.renderOrder = 1; root.add(faceLayer); faceLayer.bind(skeleton);
  }
  buildFaceLayer();

  // body under the clothes: triangles whose three corners all sit deep inside a garment that is showing are left out of the body's index
  // (the outline shares the geometry). They never show, and skipping them makes drawing lighter. Follows each garment's .m.visible,
  // so taking a garment off (or a clay view) brings the body back. Socks are left alone: the leg sits only ~2 mm inside them.
  const COVER = [["shirt", fast.shirt], ["pants", fast.pants], ["shoes", shoeSdf]], COVER_DEPTH = 0.006;   // m inside the garment
  const bodyGeo = parts.body.m.geometry, fullIdx = bodyGeo.index, coverIdx = new Map();
  let coverBits = null, coverSig = -1;
  if (cull) { const Pa = bodyGeo.attributes.position.array; coverBits = new Uint8Array(Pa.length / 3);
    COVER.forEach(([, f], b) => { for (let v = 0; v < coverBits.length; v++) if (f(Pa[v * 3], Pa[v * 3 + 1], Pa[v * 3 + 2]) < -COVER_DEPTH) coverBits[v] |= 1 << b; }); }
  function syncCover() {
    if (!coverBits) return;
    let sig = 0; COVER.forEach(([k], b) => { if (parts[k].m.visible) sig |= 1 << b; });
    if (sig === coverSig) return; coverSig = sig;
    if (!coverIdx.has(sig)) { const I = fullIdx.array, out = [];
      for (let i = 0; i < I.length; i += 3) if (!((coverBits[I[i]] & sig) && (coverBits[I[i + 1]] & sig) && (coverBits[I[i + 2]] & sig))) out.push(I[i], I[i + 1], I[i + 2]);
      coverIdx.set(sig, new THREE.BufferAttribute(new Uint32Array(out), 1)); }
    bodyGeo.setIndex(sig ? coverIdx.get(sig) : fullIdx);
  }

  // motion
  const playPose = createPosePlayer({ bone, BONES, HIPS0 });
  let poseName = "aPose", time = 0, lastPose = { b: {} };

  const avatar = {
    object: root, bones: bone, skeleton, options: OPT, parts, PROF, earLine,
    /** internals for tools and checking (shapes, face texture, joints) */
    internals: { J, BONES, HIPS0, P, CUT, HEAD, EAR, HT, bodySdf, bodySdfSlow, bodySdfRaw, face, hairKit, hairPick, get faceLayer() { return faceLayer; } },
    get faceLayer() { return faceLayer; },
    get pose() { return poseName; },
    get lastPose() { return lastPose; },
    get faceSel() { return faceSel; },

    /** Advance motion and blinking. t: absolute time to use instead of advancing (for freezing a frame). instant: jump straight to the pose. */
    update(dt, { t, instant = false, pose } = {}) {
      syncCover();
      time = t ?? time + dt;
      lastPose = playPose(pose ?? poseName, time, dt, instant);
      if (!faceDrawHook && time > blinkAt && !blinking) { blinking = true; avatar.drawFace(); }
      if (blinking && time > blinkAt + 0.12) { blinking = false; avatar.drawFace(); blinkAt = time + 2.5 + Math.random() * 3; }
    },
    play(name) { if (!POSES[name]) throw new Error(`Unknown motion "${name}". Available: ${Object.keys(POSES).join(", ")}`); poseName = name; },

    /** Face: sel = { eyes, brows, mouth, cheeks } part names (see face.PARTS / face.PRESETS). */
    setFace(sel) { Object.assign(faceSel, sel); avatar.drawFace(); },
    /** Move the face parts on the face picture (instant): { eyeX, eyeY, eyeSize, browX, browY, mouthY }. */
    setFaceLayout(l) { face.setLayout(l); avatar.drawFace(); },
    drawFace() { if (faceDrawHook && faceDrawHook(face)) return; face.drawParts(faceSel, blinking); },
    /** Replace face drawing (return true when drawn), e.g. to show a whole-face picture. null restores the parts. */
    setFaceDrawHook(fn) { faceDrawHook = fn; avatar.drawFace(); },
    setFaceWrap(wrap) { faceWrap = wrap; buildFaceLayer(); },

    setColors({ skin, hair, shirt, pants, shoes, soles, socks } = {}) {
      if (skin) parts.body.toonMat.color.set(skin);
      for (const [k, c] of Object.entries({ hair, shirt, pants, shoes, soles, socks })) if (c) parts[k].m.material.color.set(c);
    },
    /** Outline (instant, no rebuild): { on, width (1 = default), color }. Some art styles want none: { on: false }. */
    setOutline({ on, width, color } = {}) {
      Object.assign(OPT.outline, Object.fromEntries(Object.entries({ on, width, color }).filter(([, v]) => v !== undefined)));
      root.traverse((x) => { if (!x.userData.outline) return; const m = x.material; m.visible = OPT.outline.on; m.color.set(OPT.outline.color); m.userData.width.value = m.userData.baseWidth * OPT.outline.width; });
    },
    /** Shading style (instant, no rebuild): "toon" | "smooth" | "flat" (see SHADINGS). Keeps the current colors. */
    setShading(style) {
      if (!SHADINGS.includes(style)) throw new Error(`Unknown shading "${style}". Available: ${SHADINGS.join(", ")}`);
      OPT.shading.style = style;
      for (const [k, x] of Object.entries(parts)) {
        if (k === "body") { const old = x.toonMat, nm = shadeToon(old.color.getHex()); if (x.m.material === old) x.m.material = nm; x.toonMat = nm; old.dispose(); continue; }   // the body's normal material (a page may be showing another one, e.g. clay)
        const old = x.m.material; x.m.material = (k === "hair" ? hairMat : (c) => shaded(style, c))(old.color.getHex()); x.m.material.wireframe = old.wireframe; old.dispose();
      }
    },
    /** Soft blush on the cheeks and the nose tip (instant): { cheeks: { on, color, strength, size, x, y }, nose: { on, color, strength, size } }. */
    setBlush({ cheeks, nose } = {}) { if (cheeks) Object.assign(OPT.face.blush.cheeks, cheeks); if (nose) Object.assign(OPT.face.blush.nose, nose); avatar.drawFace(); },
    /** Rebuild the hair: pick = { bangs, back, ahoge } (names in internals.hairKit.BANGS / BACKS). */
    setHair(pick) {
      Object.assign(hairPick, pick);
      const on = parts.hair.on; for (const m of [parts.hair.m, parts.hair.o]) { root.remove(m); m.geometry.dispose(); }
      parts.hair = makeHair(H); parts.hair.on = on;
    },

    /** GLB of the avatar in the A-pose (outlines left out). */
    async exportGLB() {
      const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
      const outs = []; root.traverse((o) => { if (o.userData.outline && o.visible) { o.visible = false; outs.push(o); } });
      const saved = BONES.map((b) => bone[b].quaternion.clone()), hy = bone.hips.position.y;
      BONES.forEach((b) => bone[b].quaternion.identity()); bone.hips.position.copy(HIPS0);
      const restore = () => { outs.forEach((o) => { o.visible = true; }); BONES.forEach((b, i) => bone[b].quaternion.copy(saved[i])); bone.hips.position.y = hy; };
      return new Promise((ok, ng) => new GLTFExporter().parse(root, (buf) => { restore(); ok(buf); }, (e) => { restore(); ng(e); }, { binary: true }));
    },

    /** Fingerprint of mesh positions and skin weights (for checking refactors). */
    checksum() { return ["body", "shirt", "pants", "socks", "shoes", "soles", "hair"].map((k) => parts[k]).map((x) => { const a = x.m.geometry.attributes; let h = 0; for (const k of ["position", "skinIndex", "skinWeight"]) { const v = a[k].array; for (let i = 0; i < v.length; i++) h = (h * 31 + Math.round(v[i] * 1e5)) % 1000000007; } return h; }); },

    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); } }); face.faceTex.dispose(); root.removeFromParent(); },
  };
  avatar.drawFace();
  syncCover();
  if (useCache && Object.keys(fresh).length) cachePut(cacheKey, fresh);   // not awaited: storing happens after the avatar is already on screen
  return avatar;
}
