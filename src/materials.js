// Materials: toon shading (3 flat bands), back-face outline, and smooth clay for checking shapes.
import * as THREE from "three";

export const ramp = (() => { const d = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
export function outlineMat(w) { const m = new THREE.MeshBasicMaterial({ color: 0x3a2a3a, side: THREE.BackSide }); m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", `#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ${w.toFixed(4)};`); }; return m; }
export const CLAY = "#d6d6d4";
export const clayMat = new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.62, metalness: 0 });
