// Moving the back hair's locks one by one (2026-10-05, Saori), like the bangs' tufts (bangs.js): a dot on each lock's tip; dragging it
// up or down makes that lock shorter or longer (down to the waist), left or right turns it around the head. Releasing it writes the lock's
// own changes into the recipe (hair.sculpt.<group>.edits: [{ i, dy, da, w, th, fl }], one undo step) and the engine rebuilds the back locks.
// The picked lock also gets sliders: width, thickness, flick out / curl in. The edits go by the lock's number: changing the lock count
// moves them to other locks.
import * as THREE from "three";

const D2R = Math.PI / 180;
const PATH = { shortLocks: "hair.sculpt.shortLocks.edits", "shortLocks.lie": "hair.sculpt.shortLocks.lie.edits", long: "hair.sculpt.long.edits", bobLocks: "hair.sculpt.bobLocks.edits", flipLocks: "hair.sculpt.flipLocks.edits" };

/** vp: the viewport / store: the recipe / onSelect(): the selection changed (the panel shows its sliders) */
export function createBackTool({ vp, store, onSelect = () => {} }) {
  const group = new THREE.Group(); group.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0x2fa58a, depthTest: false, transparent: true, opacity: 0.9 }), selMat = new THREE.MeshBasicMaterial({ color: 0x4b4acf, depthTest: false, transparent: true });
  const geo = new THREE.SphereGeometry(0.0085, 16, 12);
  let on = false, sel = -1, drag = null, av = null, info = { group: null, locks: [] };
  const path = () => PATH[info.group];
  const edits = () => structuredClone(store.get(path()) ?? []);
  const editOf = (L, i) => { let e = L.find((x) => x?.i === i); if (!e) { e = { i }; L.push(e); } return e; };
  const headLocal = (p) => { const J = av.internals.J.head; return new THREE.Vector3(p[0] - J[0], p[1] - J[1], p[2] - J[2]); };
  const angle = (x, z) => Math.atan2(x, z + 0.02) / D2R;   // around the head (degrees, 0 = front)
  function place() {
    group.clear(); info = av ? av.backLocks() : { group: null, locks: [] };
    if (!av || !on || !info.group) { group.visible = false; return; }
    if (group.parent !== av.bones.head) av.bones.head.add(group);
    info.locks.forEach((L, i) => { const m = new THREE.Mesh(geo, i === sel ? selMat : mat); m.position.copy(headLocal(L.tip)); m.renderOrder = 10; m.userData.i = i; group.add(m); });
    group.visible = true;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!group.visible) return; toNdc(e);
    const h = ray.intersectObjects(group.children)[0]; if (!h) return;
    sel = h.object.userData.i; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId);
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(new THREE.Vector3()).negate(), h.object.getWorldPosition(new THREE.Vector3()));
    drag = { moved: false, to: null }; place(); onSelect(); e.stopPropagation();
  }, { capture: true });
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    const l = av.bones.head.worldToLocal(hit.clone()), J = av.internals.J.head, p = [l.x + J[0], Math.max(av.internals.J.spine[1], l.y + J[1]), l.z + J[2]];   // avatar space (rest); not below the waist
    drag.to = p; drag.moved = true; group.children[sel]?.position.copy(headLocal(p));
  });
  const up = () => {
    if (!drag) return; const d = drag; drag = null; vp.controls.enabled = true; if (!d.moved || !d.to) return;
    const L = edits(), E = editOf(L, sel), tip = info.locks[sel].tip;
    E.dy = +((E.dy ?? 0) + d.to[1] - tip[1]).toFixed(4);
    const turn = ((angle(d.to[0], d.to[2]) - angle(tip[0], tip[2]) + 540) % 360) - 180;   // the short way round (the back of the head is at ±180°)
    E.da = +((E.da ?? 0) + turn).toFixed(2);   // the whole lock turns around the head with its tip
    store.set({ [path()]: L }, { commit: true });
  };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  return {
    get on() { return on; }, get selected() { return sel; }, get usable() { return !!(av && av.backLocks().group); },
    attach(next) { av = next; group.removeFromParent(); place(); },
    refresh() { place(); if (sel >= info.locks.length) sel = -1; },
    toggle(v = !on) { on = v; if (!on) sel = -1; place(); if (on) vp.view("back"); onSelect(); },
    /** the picked lock's value: w, th (×, default 1), fl (m, default 0) */
    value(k) { const e = (store.get(path()) ?? []).find((x) => x?.i === sel); return e?.[k] ?? (k === "fl" ? 0 : 1); },
    setValue(k, v) { if (sel < 0) return; const L = edits(); editOf(L, sel)[k] = v; store.set({ [path()]: L }, { commit: true }); },
    resetOne() { if (sel < 0) return; store.set({ [path()]: edits().filter((x) => x?.i !== sel) }, { commit: true }); },
    resetAll() { store.set({ [path()]: [] }, { commit: true }); },
  };
}
