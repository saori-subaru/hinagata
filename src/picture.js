// The template of a garment part's drawn picture (materials.js withPicture; a part with `picture`: the jacket): the part alone, from the
// front (upper half) and from the back (lower half), in the frame the picture is read in. Drawn from the base positions (not the pose, not
// the body's stretch), so what is drawn at a pixel lands on the cloth shown at that pixel.
// Draw on a layer over it and save that layer alone (clear where nothing is drawn): the template itself is not part of the picture.
import * as THREE from "three";
import { PARTS, partNamed } from "./garments/index.js";

// the outline, as the avatar's (its back faces pushed out along the normals); the meshes here aren't skinned, so not materials.js outlineMat
const lineMat = (w) => { const m = new THREE.MeshBasicMaterial({ color: 0x30303a, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  transformed += normalize(normal) * ${w.toFixed(4)};`); };
  m.customProgramCacheKey = () => "tplLine" + w; return m; };
export const PICTURE_PX = 1000;   // the template's pixels per metre (a picture may be any size: only its proportions count)

/** The part as the picture sees it: { frame: [X, y0, y1], W, H (one half's pixels), items: [{ own (the part itself, not what goes with it), g
 *  (its geometry at the base positions) }], camera(s) (s 1: from the front, -1: from the back), dispose() }. For the template, and for a tool that reads the shape. */
export function pictureView(avatar, part, { px = PICTURE_PX } = {}) {
  const P = partNamed(part); if (!P?.picture) throw new Error(`"${part}" takes no drawn picture. Available: ${PARTS.filter((p) => p.picture).map((p) => p.name).join(", ")}`);
  const [X, y0, y1] = P.picture.frame, items = [];
  for (const p of PARTS) { const src = avatar.parts[p.name]?.m.geometry; if (p.group !== P.group || !src?.index || !src.attributes.position?.count) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(src.userData.basePos ?? src.attributes.position.array, 3)); g.setAttribute("normal", src.attributes.normal); g.setIndex(src.index);
    items.push({ own: p === P, g }); }
  const camera = (s) => { const cam = new THREE.OrthographicCamera(-X, X, y1, y0, 0.1, 10); cam.position.set(0, 0, 5 * s); cam.rotation.y = s > 0 ? 0 : Math.PI; cam.updateMatrixWorld(); return cam; };
  return { frame: P.picture.frame, W: Math.round(2 * X * px), H: Math.round((y1 - y0) * px), items, camera, dispose: () => items.forEach((q) => q.g.dispose()) };
}
/** → a canvas (clear round the part). part: "jacket"; the parts that go with it (its metal) are drawn too, as guides. */
export function pictureTemplate(avatar, part, { px = PICTURE_PX } = {}) {
  const V = pictureView(avatar, part, { px }), { W, H } = V, scene = new THREE.Scene(), made = [];
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  for (const { own, g } of V.items) { const fill = new THREE.MeshLambertMaterial({ color: own ? 0xe4e4e4 : 0x9a9aa2 }), line = lineMat(own ? 0.003 : 0.0015);
    scene.add(new THREE.Mesh(g, fill), new THREE.Mesh(g, line)); made.push(fill, line); }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setSize(W, H); renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const out = Object.assign(document.createElement("canvas"), { width: W, height: 2 * H }), c = out.getContext("2d");
  [1, -1].forEach((s, i) => { const cam = V.camera(s), sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-0.3 * s, 0.5, s); scene.add(sun);   // (lit from the side it is seen from)
    renderer.render(scene, cam); c.drawImage(renderer.domElement, 0, i * H); scene.remove(sun); });
  for (const o of made) o.dispose(); V.dispose(); renderer.dispose(); renderer.forceContextLoss();
  return out;
}
