// Materials: toon shading (2 or 3 flat bands), back-face outline, and smooth clay for checking shapes.
import * as THREE from "three";

// toon ramps: how much of the sun a surface gets, by how it faces the light (left: turned away, right: facing it).
// 2 bands (light / shadow, the default: chibi characters read cleaner with one shadow) or 3 (with a mid tone, the older look).
// The shadow is a little cool and violet rather than grey (anime style). 64 texels, filtered: the band's edge is crisp but not jagged
function makeRamp(stops) {
  const N = 64, d = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) { const x = (i + 0.5) / N, c = stops.find(([upTo]) => x <= upTo)[1]; d.set([...c, 255], i * 4); }
  const t = new THREE.DataTexture(d, N, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
export const RAMPS = { 2: makeRamp([[0.6, [138, 128, 158]], [1, [255, 255, 255]]]), 3: makeRamp([[1 / 3, [150, 150, 150]], [2 / 3, [215, 215, 215]], [1, [255, 255, 255]]]) };
export const ramp = RAMPS[2];
// three's toon shader reads only the ramp's red channel; this one reads its color (the shadow's tint)
const RGB_RAMP = "uniform sampler2D gradientMap;\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) { return texture2D( gradientMap, vec2( dot( normal, lightDirection ) * 0.5 + 0.5, 0.0 ) ).rgb; }";
export const toon = (c, bands = 2) => { const m = new THREE.MeshToonMaterial({ color: c, gradientMap: RAMPS[bands] ?? RAMPS[2] });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <gradientmap_pars_fragment>", RGB_RAMP); }; return m; };
// shading styles (options.shading.style): "toon" = flat bands (anime) / "smooth" = soft light falloff / "flat" = no lighting at all, plain colors
export const SHADINGS = ["toon", "smooth", "flat"];
export function shaded(style, c, bands = 2) {
  if (style === "smooth") return new THREE.MeshLambertMaterial({ color: c });
  if (style === "flat") return new THREE.MeshBasicMaterial({ color: c });
  return toon(c, bands);
}
// light the mesh by its "shadeN" attribute (normals softened for shading, see smoothNormals in sdf/mesh.js) instead of its own normals.
// Only for meshes that have it. Keeps the material's own shader changes, and gives it its own program (three caches programs by this key)
export function withShadeN(m) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); if (!sh.vertexShader.includes("<beginnormal_vertex>")) return; sh.vertexShader = "attribute vec3 shadeN;\n" + sh.vertexShader.replace("#include <beginnormal_vertex>", "vec3 objectNormal = shadeN;"); };
  m.customProgramCacheKey = () => "shadeN|" + key;
  return m;
}
/** A gradient (2026-10-05, Saori: hair tips in another color, a hem in another color): from the material's color to U.color along a value
 *  per vertex, gradT (0 → 1: a lock's root → tip, a garment's top → hem), starting at U.start and blending over U.soft.
 *  U: { on, color, start, soft } as uniforms ({ value }), shared by every material of that hair or garment, so a change shows on all at once. */
export function withGrad(m, U) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
    Object.assign(sh.uniforms, { gOn: U.on, gColor: U.color, gStart: U.start, gSoft: U.soft });
    sh.vertexShader = "attribute float gradT;\nvarying float vGradT;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGradT = gradT;");
    sh.fragmentShader = "uniform float gOn, gStart, gSoft;\nuniform vec3 gColor;\nvarying float vGradT;\n" + sh.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, gColor, gOn * smoothstep(gStart, gStart + max(gSoft, 0.001), vGradT));"); };
  m.customProgramCacheKey = () => "grad|" + key;
  return m;
}
// metal (the armor): toon bands with more contrast, a darker rim where the surface turns away, and a hard white glint (anime-style shine)
const metalRamp = (() => { const d = new Uint8Array([120, 120, 120, 255, 205, 205, 205, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export function metal(style, c) {
  if (style === "flat") return new THREE.MeshBasicMaterial({ color: c });
  const m = style === "smooth" ? new THREE.MeshPhongMaterial({ color: c, shininess: 60, specular: 0x666666 }) : new THREE.MeshToonMaterial({ color: c, gradientMap: metalRamp });
  if (style !== "smooth") m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `{ vec3 n = normalize(normal); float f = n.z, g = dot(n, normalize(vec3(-0.35, 0.55, 0.76)));
      outgoingLight *= mix(0.72, 1.0, smoothstep(0.18, 0.32, f));   // darker rim where the plate turns away
      outgoingLight = mix(outgoingLight, vec3(1.0), 0.85 * smoothstep(0.955, 0.965, g)); }   // the glint
    #include <opaque_fragment>`); };
  return m;
}
// back-face outline: the mesh pushed out along its normals by w (m). Width and color are uniforms (change them without rebuilding):
// m.userData.width.value / m.color
export function outlineMat(w, color = 0x3a2a3a) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }), width = { value: w };
  m.userData.width = width;
  m.onBeforeCompile = (sh) => { sh.uniforms.outlineW = width; sh.vertexShader = "uniform float outlineW;\n" + sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n  transformed += normalize(objectNormal) * outlineW;"); };
  return m;
}
export const CLAY = "#d6d6d4";
export const clayMat = new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.62, metalness: 0 });
