// Materials: toon shading (3 flat bands), back-face outline, and smooth clay for checking shapes.
import * as THREE from "three";

export const ramp = (() => { const d = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
// shading styles (options.shading.style): "toon" = 3 flat bands (anime) / "smooth" = soft light falloff / "flat" = no lighting at all, plain colors
export const SHADINGS = ["toon", "smooth", "flat"];
export function shaded(style, c) {
  if (style === "smooth") return new THREE.MeshLambertMaterial({ color: c });
  if (style === "flat") return new THREE.MeshBasicMaterial({ color: c });
  return toon(c);
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
