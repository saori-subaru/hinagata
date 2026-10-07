// Moving the tails' ties on the head (2026-10-05, Saori: "ドラッグで動かせるのもつけて"), like the bangs' tufts (bangs.js): a dot on each tie;
// dragging it moves the tie around the head (left / right, front / back) and up or down. Releasing it writes hair.tail.angle (degrees around
// the head: 90 = the side, 180 = the back) and hair.tail.y (head space) as one undo step; the engine rebuilds only the tails (avatar.setTails).
// Twin tails move together, mirrored. A side tail dragged over to the other side changes sides.
import * as THREE from "three";

const D2R = Math.PI / 180;

/** vp: the viewport / store: the recipe / onChange(): the tool's state changed (the panel redraws) */
export function createTieTool({ vp, store, onChange = () => {} }) {
  const group = new THREE.Group(); group.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0xe0a020, depthTest: false, transparent: true, opacity: 0.9 }), selMat = new THREE.MeshBasicMaterial({ color: 0x4b4acf, depthTest: false, transparent: true });
  const geo = new THREE.SphereGeometry(0.0105, 16, 12);
  let on = false, drag = null, av = null;
  const usable = () => (store.get("hair.tail.kind") ?? "none") !== "none";
  const headLocal = (p) => { const J = av.internals.J.head; return new THREE.Vector3(p[0] - J[0], p[1] - J[1], p[2] - J[2]); };
  function place() {
    group.clear();
    if (!av || !on || !usable()) { group.visible = false; return; }
    if (group.parent !== av.bones.head) av.bones.head.add(group);
    av.tailTies().forEach((t, i) => { const m = new THREE.Mesh(geo, drag?.i === i ? selMat : mat); m.position.copy(headLocal(t.p)); m.renderOrder = 10; m.userData.i = i; group.add(m); });
    group.visible = true;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!group.visible) return; toNdc(e);
    const h = ray.intersectObjects(group.children)[0]; if (!h) return;
    vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId);
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(new THREE.Vector3()).negate(), h.object.getWorldPosition(new THREE.Vector3()));
    drag = { i: h.object.userData.i, to: null }; place(); e.stopPropagation();
  }, { capture: true });   // before OrbitControls
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    const l = av.bones.head.worldToLocal(hit.clone()), J = av.internals.J.head, [x, y, z] = av.internals.HT.toHead(l.x + J[0], l.y + J[1], l.z + J[2]);   // → the rest pose → head space
    drag.to = { a: Math.atan2(x, z + 0.005) / D2R, y: Math.max(0.95, Math.min(1.24, y)) };
    group.children[drag.i]?.position.copy(l);
  });
  const up = () => {
    if (!drag) return; const d = drag; drag = null; vp.controls.enabled = true;
    if (!d.to) { place(); return; }
    const kind = store.get("hair.tail.kind"), ch = { "hair.tail.y": +d.to.y.toFixed(3) };
    ch["hair.tail.angle"] = +Math.max(60, Math.min(180, Math.abs(d.to.a))).toFixed(1);   // twin tails: both sides mirrored (the angle on one side); a ponytail stays in the middle
    if (kind === "side") ch["hair.tail.side"] = d.to.a >= 0 ? "L" : "R";   // (+x is the character's left)
    store.set(ch, { commit: true });
  };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  return {
    get on() { return on; }, get usable() { return usable(); },
    attach(next) { av = next; group.removeFromParent(); place(); },
    refresh() { place(); },
    toggle(v = !on) { on = v; place(); if (on) vp.view(store.get("hair.tail.kind") === "pony" ? "back" : "face"); onChange(); },
  };
}
