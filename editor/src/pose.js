// Posing by hand on avatar.joints: a dot on each joint. Dragging a hand / foot dot puts it there by IK (ik2 on the joints, the elbow / knee
// kept on the side it bends to), dragging the hips dot moves the body; pressing any dot puts a rotate gizmo on that joint.
// The pose lives in the tool (not the recipe): undo is its own stack (Ctrl+Z while on), and it goes out / comes in as JSON.
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { LIMBS, ik2, POSES } from "../../src/index.js";

const ENDS = new Set(["hand.L", "hand.R", "foot.L", "foot.R"]);
const SKIP = new Set(["spine", "upperChest"]);   // (chest and neck are enough to grab; these two sit too close to them)

/** vp: the viewport / onChange(): the tool's state changed (the bar redraws) */
export function createPoseTool({ vp, onChange = () => {} }) {
  let on = false, av = null, saved = null, drag = null, sel = null, stack = [];
  const group = new THREE.Group(); group.visible = false; vp.scene.add(group); vp.aids.add(group);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe0a020, depthTest: false, transparent: true, opacity: 0.9 });
  const endMat = new THREE.MeshBasicMaterial({ color: 0x2a9d8f, depthTest: false, transparent: true, opacity: 0.9 });
  const selMat = new THREE.MeshBasicMaterial({ color: 0x4b4acf, depthTest: false, transparent: true });
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const tc = new TransformControls(vp.camera, vp.canvas); tc.setMode("rotate"); tc.setSpace("local"); tc.setSize(0.7); vp.scene.add(tc); vp.aids.add(tc);
  tc.addEventListener("dragging-changed", (e) => { vp.controls.enabled = !e.value; if (e.value) push(); else keep(); });

  const J = () => av.joints;
  const names = () => Object.keys(J()).filter((n) => !SKIP.has(n));
  function snap() { const o = {}; for (const [n, g] of Object.entries(J())) o[n] = g.quaternion.toArray().map((v) => +v.toFixed(5)); return { joints: o, hipsY: +J().hips.position.y.toFixed(4), hipsXZ: [+J().hips.position.x.toFixed(4), +J().hips.position.z.toFixed(4)] }; }
  function load(s) { for (const [n, q] of Object.entries(s.joints ?? {})) J()[n]?.quaternion.fromArray(q);
    if (s.hipsY != null) J().hips.position.y = s.hipsY; if (s.hipsXZ) { J().hips.position.x = s.hipsXZ[0]; J().hips.position.z = s.hipsXZ[1]; } }
  const push = () => { stack.push(snap()); if (stack.length > 80) stack.shift(); };
  const keep = () => { saved = snap(); };

  function build() {
    group.clear();
    const s = 0.012 * (av.internals.ST?.identity === false ? av.internals.ST.fwd(1.27) / 1.27 : 1);
    for (const n of names()) { const m = new THREE.Mesh(geo, n === sel ? selMat : ENDS.has(n) || n === "hips" ? endMat : mat); m.scale.setScalar(s); m.renderOrder = 10; m.userData.n = n; group.add(m); }
  }
  const p = new THREE.Vector3();
  function tick() { if (!on) return; requestAnimationFrame(tick);
    if (!av) return; for (const m of group.children) { J()[m.userData.n].getWorldPosition(p); m.position.copy(p); } }

  function start() {
    if (!av) return;
    if (saved) load(saved); else from(vp.motion.pose, false);
    av.play("joints", { blend: 0 }); build(); group.visible = true; tick();
  }
  /** start the joints from a built-in motion at its current time (a picked motion while posing) */
  function from(name, record = true) {
    if (!av || !POSES[name]) return; if (record) push();
    av.copyMotion(name); keep();
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  function select(n) { sel = n; if (n) tc.attach(J()[n]); else tc.detach(); build(); }
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!on || e.button !== 0 || tc.dragging || tc.axis) return;   // (the gizmo's own handles first)
    toNdc(e); const h = ray.intersectObjects(group.children)[0]; if (!h) return;
    const n = h.object.userData.n; select(n);
    vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId); e.stopPropagation();
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(new THREE.Vector3()).negate(), h.object.position);
    drag = { n, moved: false, pole: ENDS.has(n) ? poleOf(LIMBS[n]) : null, from: h.object.position.clone(), hips0: J().hips.position.clone() };
  }, { capture: true });   // before OrbitControls
  // the elbow / knee's side: away from the line shoulder → wrist (or hip → ankle) through where it is now; a straight limb bends the usual way
  function poleOf(L) {
    const a = J()[L.root].getWorldPosition(new THREE.Vector3()), b = J()[L.mid].getWorldPosition(new THREE.Vector3()), c = J()[L.end].getWorldPosition(new THREE.Vector3());
    const out = b.clone().sub(a.clone().add(c).multiplyScalar(0.5));
    if (out.length() < 0.01) { const f = new THREE.Vector3(0, 0, L.arm ? -1 : 1).transformDirection(av.object.matrixWorld); out.copy(f); }
    return b.add(out.normalize().multiplyScalar(0.3));
  }
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag || (drag.n !== "hips" && !drag.pole)) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    if (!drag.moved) { drag.moved = true; push(); }
    if (drag.pole) ik2(J(), LIMBS[drag.n], hit, drag.pole);
    else { const d = J().hips.parent.worldToLocal(hit.clone()).sub(J().hips.parent.worldToLocal(drag.from.clone())); J().hips.position.copy(drag.hips0).add(d); }
  });
  const up = () => { if (!drag) return; const moved = drag.moved; drag = null; vp.controls.enabled = true; if (moved) keep(); };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);
  addEventListener("keydown", (e) => {
    if (!on || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.target.closest?.("input, textarea")) return;
    e.preventDefault(); e.stopImmediatePropagation(); undo();
  }, { capture: true });   // before the recipe's undo (app.js)
  function undo() { const s = stack.pop(); if (s && av) { load(s); keep(); } }

  return {
    get on() { return on; }, get canUndo() { return stack.length > 0; },
    attach(next) { av = next; select(null); if (on) start(); },
    toggle(v = !on) { if (v === on) return; on = v;
      if (on) start(); else { select(null); group.visible = false; av?.play(vp.motion.pose); }
      onChange(); },
    from, undo,
    reset() { from(vp.motion.pose); },
    /** the pose as a JSON file's text: { hinagataPose: 1, joints: { name: [x, y, z, w] (avatar.joints' quaternions) }, hipsY, hipsXZ } */
    exportJSON() { return JSON.stringify({ hinagataPose: 1, ...snap() }); },
    importJSON(text) { const s = JSON.parse(text); if (!s.joints) throw new Error("not a pose file"); push(); load(s); keep(); },
    get groupObject() { return group; }, get gizmo() { return tc; },
  };
}
