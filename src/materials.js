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
