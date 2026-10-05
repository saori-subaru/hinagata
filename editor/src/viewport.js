// The 3D view: camera and view buttons, light and floor, display aids (clay, wireframe, bones), background, motion clock, PNG capture.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clayMat } from "../../src/materials.js";

const VIEWS = {   // [camera position, target]
  free: [[1.15, 0.95, 2.75], [0, 0.62, 0]], front: [[0, 0.72, 3.0], [0, 0.62, 0]], side: [[3.0, 0.72, 0], [0, 0.62, 0]],
  back: [[0, 0.78, -3.0], [0, 0.62, 0]], face: [[0, 1.0, 1.25], [0, 0.96, 0]],
};
export const VIEW_NAMES = Object.keys(VIEWS);
export const BACKGROUNDS = { warm: ["#ebe5dc", "#e2dacd"], white: ["#ffffff", "#f1efeb"], grey: ["#b9bcc2", "#aeb1b7"], dark: ["#26272b", "#2f3034"] };

export function createViewport(canvas, stage) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minDistance = 0.6; controls.maxDistance = 7; controls.maxPolarAngle = Math.PI * 0.56;
  camera.position.set(...VIEWS.free[0]); controls.target.set(...VIEWS.free[1]);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1.5, 3, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.8, bottom: -0.4, near: 0.5, far: 8 }); sun.shadow.bias = -0.0008; scene.add(sun);
  const floorMat = new THREE.MeshToonMaterial({ color: 0xe2dacd });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // chair for the sitting motion (the seat's top is at 0.2)
  const chair = new THREE.Group(); { const wood = new THREE.MeshToonMaterial({ color: 0xc49a6c }), box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; chair.add(m); };
    box(0.4, 0.04, 0.26, 0, 0.18, -0.03); box(0.4, 0.36, 0.035, 0, 0.36, -0.16); for (const [x, z] of [[-0.17, 0.08], [0.17, 0.08], [-0.17, -0.14], [0.17, -0.14]]) box(0.035, 0.18, 0.035, x, 0.09, z); }
  chair.visible = false; scene.add(chair);

  const size = () => { const r = stage.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 42 : 32; camera.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(stage); size();

  // camera moves between views smoothly; dragging takes over
  let tween = null;
  function view(name) {
    const [p, t] = VIEWS[name]; tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t), s: performance.now() };
  }
  controls.addEventListener("start", () => { tween = null; });

  // ── the avatar and display aids ──
  let avatar = null, helper = null;
  const D = { clay: false, wire: false, bones: false, floor: true };
  const meshes = () => avatar ? Object.values(avatar.parts) : [];
  /** put the avatar's own materials back (call before the engine changes materials, then apply()) */
  function lift() { for (const x of meshes()) if (x.m.userData.own) { x.m.material = x.m.userData.own; delete x.m.userData.own; } }
  function apply() {
    if (!avatar) return;
    for (const x of meshes()) {
      if (D.clay) { x.m.userData.own ??= x.m.material; x.m.material = clayMat; }
      x.m.material.wireframe = D.wire; if (x.m.userData.own) x.m.userData.own.wireframe = D.wire;
      x.o.visible = x.m.visible && !D.clay && !D.wire;
    }
    clayMat.wireframe = D.wire;
    if (avatar.faceLayer) avatar.faceLayer.visible = !D.clay;
    if (avatar.earLine) avatar.earLine.visible = !D.clay && !D.wire;
    if (helper) helper.visible = D.bones;
    floor.visible = D.floor;
  }
  function setAvatar(next) {
    const old = avatar; avatar = next; scene.add(next.object);
    if (helper) { scene.remove(helper); helper.dispose?.(); }
    helper = new THREE.SkeletonHelper(next.object); helper.material.depthTest = false; helper.renderOrder = 10; scene.add(helper);
    apply();
    if (old) { scene.remove(old.object); old.dispose(); }
  }
  function display(k, on) { lift(); D[k] = on; apply(); }
  function background(name) { const [bg, fl] = BACKGROUNDS[name] ?? BACKGROUNDS.warm; stage.style.background = bg; floorMat.color.set(fl); }

  // ── motion clock ──
  const M = { pose: "idle", playing: true, speed: 1 };
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) { const k = Math.min(1, (now - tween.s) / 380), e = 1 - (1 - k) ** 3; camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); if (k >= 1) tween = null; }
    if (avatar) { avatar.update(M.playing ? dt * M.speed : 0); chair.visible = !!avatar.lastPose?.chair; }
    controls.update(); renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  /** PNG of the current view, transparent background, at twice the screen size (max 4096 px) */
  function snapshot() {
    const pr = renderer.getPixelRatio(), r = stage.getBoundingClientRect(), k = Math.min(2 * pr, 4096 / Math.max(r.width, r.height));
    const fv = floor.visible, hv = helper?.visible, cv = chair.visible;
    floor.visible = false; if (helper) helper.visible = false;
    renderer.setPixelRatio(k); size(); renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
    return new Promise((ok) => canvas.toBlob((b) => { floor.visible = fv; if (helper) helper.visible = hv; chair.visible = cv; renderer.setPixelRatio(pr); size(); ok(b); }, "image/png"));
  }

  return { view, display, background, setAvatar, lift, apply, snapshot, motion: M, camera, controls, canvas, scene, get avatar() { return avatar; }, get displayState() { return { ...D }; } };
}
