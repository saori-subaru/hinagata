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
import { toon, outlineMat } from "./materials.js";
import { DEFAULTS, resolveOptions } from "./options.js";
import { buildBody } from "./body/index.js";
import { buildClothes } from "./clothes/index.js";
import { buildHair } from "./hair/index.js";
import { makeSkeleton, makeWeights } from "./rig.js";
import { createFace } from "./face/index.js";
import { POSES, createPosePlayer } from "./motion/index.js";

export { DEFAULTS, POSES, resolveOptions };

/**
 * Build an avatar.
 * options:  see DEFAULTS (src/options.js); anything left out uses the default.
 * settings: { quality: "high" | "low" — mesh density,
 *             debug: { slow, oldSock, faceWrap } — checking aids, normally unused }
 */
export async function createAvatar(options = {}, { quality = "high", debug = {} } = {}) {
  await new Promise((r) => setTimeout(r, 0));   // let the page paint (e.g. a "building…" message) before the heavy work
  const OPT = resolveOptions(options);
  const H = quality === "low" ? 0.0095 : 0.0068;   // mesh cell size

  // shapes
  const { J, PARENT, BONES, BI, P, CUT, BODY, HEAD, CROTCH, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT } = buildBody(OPT, { slow: !!debug.slow, oldSock: !!debug.oldSock });
  const { pantsSdf, shirtSdf, shoeSdf, sockSdf, soleSdf } = buildClothes(OPT, { P, CROTCH, bodySdf });
  const hairKit = buildHair(OPT, { P, bodySdf: bodySdfRaw });   // hair is shaped on the untransformed head, then scaled with it
  const weightsAt = makeWeights({ BODY, BONES, BI });
  const { root, bone, skeleton, HIPS0 } = makeSkeleton({ J, PARENT, BONES });

  // shape → skinned mesh
  const PROF = [];   // per mesh: vertex count and build time (ms)
  let bodyAt = (x, y, z) => bodySdf(x, y, z);   // body distance; after the body is meshed, read back from its grid (clothes don't recompute the body)
  function mesh(sdf, lo, hi, h, bone1, only, fast = sdf) {   // fast: cheaper sdf for grid sampling / bone1: bind everything to this bone / only: RegExp of bones allowed
    const T0 = performance.now(), { pos, nor, idx, grid, time } = surfaceNets(sdf, lo, hi, h, { fast, band: OPT.quality.band, proj: OPT.quality.project });
    mesh.last = grid;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
    const w0 = performance.now();
    const nv = pos.length / 3, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), tmp = { idx: [0, 0, 0, 0], w: [0, 0, 0, 0] };
    for (let v = 0; v < nv; v++) { tmp.idx.fill(0); tmp.w.fill(0); if (bone1) { tmp.idx[0] = BI[bone1]; tmp.w[0] = 1; } else weightsAt(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], tmp, only);
      for (let q = 0; q < 4; q++) { si[v * 4 + q] = tmp.idx[q]; sw[v * 4 + q] = tmp.w[q] || 0; } }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    PROF.push({ verts: nv, ms: Math.round(performance.now() - T0), sample: Math.round(time.sample), project: Math.round(time.project), weights: Math.round(performance.now() - w0) });
    return g;
  }
  function skinned(geo, color, ow = 0.005) {   // toon mesh + outline mesh, bound to the skeleton
    const m = new THREE.SkinnedMesh(geo, toon(color)); m.castShadow = true; m.frustumCulled = false; root.add(m); m.bind(skeleton);
    const o = new THREE.SkinnedMesh(geo, outlineMat(ow)); o.frustumCulled = false; o.userData.outline = true; root.add(o); o.bind(skeleton);
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
  const shadeToon = (c) => { const m = toon(c); m.onBeforeCompile = (sh) => { sh.vertexShader = "attribute vec3 shadeN;\n" + sh.vertexShader.replace("#include <beginnormal_vertex>", "vec3 objectNormal = shadeN;"); }; return m; };

  // build every mesh
  const fast = { shirt: (x, y, z) => shirtSdf(x, y, z, bodyAt), pants: (x, y, z) => pantsSdf(x, y, z, bodyAt), sock: (x, y, z) => sockSdf(x, y, z, bodyAt) };
  const parts = {};
  parts.body = skinned(mesh(bodySdf, [-0.47, -0.02, -0.3], [0.47, 1.43, 0.34], H), OPT.colors.skin); bodyAt = gridSampler(mesh.last, bodySdf);
  addShadeNormals(parts.body.m.geometry); parts.body.m.material.dispose(); parts.body.m.material = parts.body.toonMat = shadeToon(OPT.colors.skin);
  parts.shirt = skinned(mesh(shirtSdf, [-0.3, 0.33, -0.2], [0.3, 0.86, 0.22], H * OPT.quality.shirtCell, null, /^(hips|spine|chest|upperChest|neck|upperArm)/, fast.shirt), OPT.outfit.shirt.color);
  parts.pants = skinned(mesh(pantsSdf, [-0.28, 0.2, -0.2], [0.28, 0.55, 0.22], H * 1.2, null, /^(hips|spine|upperLeg|lowerLeg)/, fast.pants), OPT.outfit.pants.color);
  parts.shoes = skinned(mesh(shoeSdf, [-0.22, -0.01, -0.12], [0.22, 0.13, 0.14], H * 0.7, null, /^(foot|lowerLeg)/), OPT.outfit.shoes.color);
  parts.soles = skinned(mesh(soleSdf, [-0.22, -0.01, -0.12], [0.22, 0.03, 0.14], H * 0.6, null, /^foot/), OPT.outfit.shoes.soleColor);
  parts.socks = skinned(mesh(sockSdf, [-0.22, -0.01, -0.12], [0.22, 0.17, 0.14], H * 0.7, null, /^(foot|lowerLeg)/, fast.sock), OPT.outfit.socks.color, 0.003);
  const hairPick = { bangs: OPT.hair.bangs, back: OPT.hair.back, ahoge: OPT.hair.ahoge };
  const makeHair = (h) => skinned(mesh(HT.wrap(hairKit.hairSdfOf(hairPick)), [-0.34, 0.8, -0.36], [0.34, 1.48, 0.38], h * OPT.quality.hairCell, "head"), OPT.colors.hair, 0.004);
  parts.hair = makeHair(H);

  // face: parts drawn into a texture on a thin copy of the front of the head
  let faceDrawHook = null, faceWrap = debug.faceWrap ?? null, blinking = false, blinkAt = 2.5;
  const face = createFace(OPT, { FACE_DY, onImage: () => avatar.drawFace() });
  const faceSel = { eyes: "まる目", brows: "ふつう", mouth: "にこ", cheeks: "なし" };   // default: code-drawn face (no image files needed)
  let faceLayer = null;
  function buildFaceLayer() {
    const g = face.faceLayerGeometry(parts.body.m.geometry, faceWrap, HT.identity ? null : HT.toHead);
    if (faceLayer) { root.remove(faceLayer); faceLayer.geometry.dispose(); }
    faceLayer = new THREE.SkinnedMesh(g, face.faceMat); faceLayer.name = "face"; faceLayer.frustumCulled = false; faceLayer.renderOrder = 1; root.add(faceLayer); faceLayer.bind(skeleton);
  }
  buildFaceLayer();

  // motion
  const playPose = createPosePlayer({ bone, BONES, HIPS0 });
  let poseName = "aPose", time = 0, lastPose = { b: {} };

  const avatar = {
    object: root, bones: bone, skeleton, options: OPT, parts, PROF,
    /** internals for tools and checking (shapes, face texture, joints) */
    internals: { J, BONES, HIPS0, P, CUT, HEAD, EAR, HT, bodySdf, bodySdfSlow, bodySdfRaw, face, hairKit, hairPick, get faceLayer() { return faceLayer; } },
    get faceLayer() { return faceLayer; },
    get pose() { return poseName; },
    get lastPose() { return lastPose; },
    get faceSel() { return faceSel; },

    /** Advance motion and blinking. t: absolute time to use instead of advancing (for freezing a frame). instant: jump straight to the pose. */
    update(dt, { t, instant = false, pose } = {}) {
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
  return avatar;
}
