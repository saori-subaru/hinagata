// The template of a garment part's drawn picture (materials.js withPicture; a part with `picture`: the jacket): the part alone in the
// frame the picture is read in. Left column: from the front (above) and from the back (below). Right column, when the part has side views:
// what they cover (the jacket's sleeves: each seen square on from outside, the shoulder above, her front to the left for her left sleeve
// and to the right for her right one), her left (above) and her right (below).
// Drawn from the base positions (not the pose, not the body's stretch), so what is drawn at a pixel lands on the cloth shown at that pixel.
// Draw on a layer over it and save that layer alone (clear where nothing is drawn): the template itself is not part of the picture.
import * as THREE from "three";
import { PARTS, partNamed } from "./garments/index.js";

// a side view shows only what the side views cover, on the near side (uSide: 0 = everything, 1 / -1 = the +x / -x side)
const sided = (m, U, more = "") => { m.onBeforeCompile = (sh) => { sh.uniforms.uSide = U;
  sh.vertexShader = "attribute float picS;\nvarying float vPS;\nvarying float vPX;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPS = picS; vPX = position.x;" + more);
  sh.fragmentShader = "uniform float uSide;\nvarying float vPS;\nvarying float vPX;\n" + sh.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (uSide != 0.0 && (vPS < 0.5 || vPX * uSide < 0.0)) discard;"); };
  m.customProgramCacheKey = () => "tpl" + more; return m; };
// the outline, as the avatar's (its back faces pushed out along the normals); the meshes here aren't skinned, so not materials.js outlineMat
const lineMat = (w, U) => sided(new THREE.MeshBasicMaterial({ color: 0x30303a, side: THREE.BackSide }), U, `\n  transformed += normalize(normal) * ${w.toFixed(4)};`);
export const PICTURE_PX = 1000;   // the template's pixels per metre (a picture may be any size: only its proportions count)

/** The part as the picture sees it: { frame: [X, y0, y1, Z], W, H, WS (a front view's, a side view's pixels), items: [{ own (the part itself,
 *  not what goes with it), g (its geometry at the base positions, with picS) }], camera(s) (s 1: from the front, -1: from the back),
 *  sideCamera(s) (1: the +x side's view, her left; -1: the -x side's), dispose() }. For the template, and for a tool that reads the shape. */
export function pictureView(avatar, part, { px = PICTURE_PX } = {}) {
  const P = partNamed(part); if (!P?.picture) throw new Error(`"${part}" takes no drawn picture. Available: ${PARTS.filter((p) => p.picture).map((p) => p.name).join(", ")}`);
  const [X, y0, y1, Z = 0] = P.picture.frame, items = [], side = avatar.internals.picSide(part);
  for (const p of PARTS) { const src = avatar.parts[p.name]?.m.geometry; if (p.group !== P.group || !src?.index || !src.attributes.position?.count) continue;
    const g = new THREE.BufferGeometry(), n = src.attributes.position.count; g.setAttribute("position", new THREE.BufferAttribute(src.userData.basePos ?? src.attributes.position.array, 3)); g.setAttribute("normal", src.attributes.normal); g.setIndex(src.index);
    g.setAttribute("picS", new THREE.BufferAttribute(p === P ? side.weight : new Float32Array(n), 1));
    items.push({ own: p === P, g }); }
  const camera = (s) => { const cam = new THREE.OrthographicCamera(-X, X, y1, y0, 0.1, 10); cam.position.set(0, 0, 5 * s); cam.rotation.y = s > 0 ? 0 : Math.PI; cam.updateMatrixWorld(); return cam; };
  const sideCamera = (s) => { const [ox, oy, dx, dy] = side.axes[s > 0 ? 0 : 1], h = (y1 - y0) / 2, cam = new THREE.OrthographicCamera(-Z, Z, h, -h, 0.1, 10), c = [ox + dx * h, oy + dy * h];   // (from the side its surface faces: across the way down)
    cam.position.set(c[0] - s * dy * 5, c[1] + s * dx * 5, 0); cam.up.set(-dx, -dy, 0); cam.lookAt(c[0], c[1], 0); cam.updateMatrixWorld(); return cam; };
  return { frame: [X, y0, y1, Z], W: Math.round(2 * X * px), H: Math.round((y1 - y0) * px), WS: Math.round(2 * Z * px), items, camera, sideCamera, dispose: () => items.forEach((q) => q.g.dispose()) };
}
/** → a canvas (clear round the part). part: "jacket"; the parts that go with it (its metal) are drawn too, as guides. */
export function pictureTemplate(avatar, part, { px = PICTURE_PX } = {}) {
  const V = pictureView(avatar, part, { px }), { W, H, WS } = V, scene = new THREE.Scene(), made = [], U = { value: 0 };
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  for (const { own, g } of V.items) { const fill = sided(new THREE.MeshLambertMaterial({ color: own ? 0xe4e4e4 : 0x9a9aa2 }), U), line = lineMat(own ? 0.003 : 0.0015, U);
    scene.add(new THREE.Mesh(g, fill), new THREE.Mesh(g, line)); made.push(fill, line); }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const out = Object.assign(document.createElement("canvas"), { width: W + WS, height: 2 * H }), c = out.getContext("2d");
  const shot = (cam, dir, w, x, y, side) => { const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(...dir); scene.add(sun); U.value = side;   // (lit from the side it is seen from)
    renderer.setSize(w, H); renderer.render(scene, cam); c.drawImage(renderer.domElement, x, y); scene.remove(sun); };
  [1, -1].forEach((s, i) => shot(V.camera(s), [-0.3 * s, 0.5, s], W, 0, i * H, 0));
  if (WS) [1, -1].forEach((s, i) => { const cam = V.sideCamera(s); shot(cam, cam.position.toArray(), WS, W, i * H, s); });
  for (const o of made) o.dispose(); V.dispose(); renderer.dispose(); renderer.forceContextLoss();
  return out;
}
