// Which vertices of the character ever show: drawn from many directions in many poses, each triangle in its own color (an id), and the
// pixels read back. For a baked character (avatar.bake({ hidden: true })): what never shows (a sole's top inside a boot, a sock under it)
// is dropped, and with it the layers that thinned apart came through each other. Browser only (WebGL).
import * as THREE from "three";

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) DIRS.push([x, y, z]);
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; DIRS.push([Math.cos(a), -0.35, Math.sin(a)], [Math.cos(a + 0.4), 0.15, Math.sin(a + 0.4)]); }   // round the waist, a little from below (under a skirt) and level

/** meshes: { key: Mesh } to watch; others: more meshes that only hide things; pose(i) → false when there are no more poses (sets the
 *  character in pose i). → { key: Uint8Array per vertex, 1 where it showed } */
export function seenVertices(meshes, others, pose, { size = 320 } = {}) {
  const R = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); R.setSize(size, size, false); R.setPixelRatio(1);
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: "attribute vec3 idc; varying vec3 c; void main() { c = idc; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec3 c; void main() { gl_FragColor = vec4(c, 1.0); }" });
  mat.toneMapped = false;
  const keys = Object.keys(meshes), seen = {}, base = {}; let next = 2;   // id 0: nothing, 1: a mesh that only hides
  for (const k of keys) { seen[k] = new Uint8Array(meshes[k].geometry.attributes.position.count); base[k] = next; next += meshes[k].geometry.index.count / 3; }
  if (next >= 1 << 24) throw new Error("seenVertices: too many triangles");
  const scene = new THREE.Scene(), v = new THREE.Vector3(), px = new Uint8Array(size * size * 4), cam = new THREE.OrthographicCamera();
  const flatOf = (m, id0) => {   // the mesh as it stands now (skinned on the CPU), one color per triangle
    const g = m.geometry, P = g.attributes.position, I = g.index ? g.index.array : null, n = I ? I.length : P.count, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    m.updateMatrixWorld(true);
    for (let i = 0; i < n; i++) { const vi = I ? I[i] : i; v.fromBufferAttribute(P, vi); if (m.isSkinnedMesh) m.applyBoneTransform(vi, v); v.applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], i * 3);
      const id = id0 < 0 ? 1 : id0 + Math.floor(i / 3); col.set([(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255], i * 3); }
    const f = new THREE.BufferGeometry(); f.setAttribute("position", new THREE.BufferAttribute(pos, 3)); f.setAttribute("idc", new THREE.BufferAttribute(col, 3)); return f; };
  for (let p = 0; pose(p) !== false; p++) {
    scene.clear(); const box = new THREE.Box3();
    for (const k of keys) { const f = flatOf(meshes[k], base[k]); scene.add(new THREE.Mesh(f, mat)); f.computeBoundingBox(); box.union(f.boundingBox); }
    for (const m of others) if (m.visible && m.geometry?.attributes?.position) scene.add(new THREE.Mesh(flatOf(m, -1), mat));
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 0.01;
    for (const d of DIRS) { const n = new THREE.Vector3(...d).normalize();
      cam.left = cam.bottom = -r; cam.right = cam.top = r; cam.near = 0.001; cam.far = 4 * r; cam.position.copy(c).addScaledVector(n, 2 * r); cam.up.set(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0); cam.lookAt(c); cam.updateProjectionMatrix();
      R.setClearColor(0x000000, 1); R.render(scene, cam); const gl = R.getContext(); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let i = 0; i < px.length; i += 4) { const id = px[i] | (px[i + 1] << 8) | (px[i + 2] << 16); if (id < 2) continue;
        for (const k of keys) { const t = id - base[k], I = meshes[k].geometry.index.array; if (t >= 0 && t * 3 < I.length) { seen[k][I[t * 3]] = seen[k][I[t * 3 + 1]] = seen[k][I[t * 3 + 2]] = 1; break; } } } }
    scene.traverse((o) => o.geometry?.dispose());
  }
  mat.dispose(); R.dispose(); R.forceContextLoss?.();
  return seen;
}
