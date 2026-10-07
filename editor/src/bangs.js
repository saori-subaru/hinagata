// Moving the bangs' tufts on the character (the test page's "前髪のふさ", brought into the editor, 2026-10-04, Saori).
// Each tip gets a dot on the face; dragging it moves the tip around the head (left / right) and up or down. A dot rides on the head bone,
// so it stays on its tip while the character moves. Releasing it writes the tips into the recipe (one undo step); the engine then rebuilds
// only the bangs (avatar.setBangs).
// The bangs it works on (2026-10-07, Saori: "なんで姫カットとかって前髪動かせないんですかね" → the hime cut and the side-swept too, as locks or a block):
//   ふさ (nendo):  hair.sculpt.nendo.tips, rows [angle (degrees around the head, 0 = front), tip height (head space), slope?, skew?, group?,
//                  sweep (degrees)?, extra thickness?, flick (m)?, width (×)?, wave?]. A tip can go down to the waist (the tuft hangs).
//   姫カット:      hair.sculpt.hime.tips, the same rows (its tips are cut straight across).
//   横流し:        hair.sculpt.side.strands, rows [from angle, to angle, to height angle (up from the head's middle), radius, bend] (degrees, m):
//                  the dot is a strand's tip.
import * as THREE from "three";

const D2R = Math.PI / 180;
const tipAngle = (t) => t[0] - (t[5] ?? 0);   // where the tip really is: a swept tuft ends that far to the side
// the kinds: where their rows are, how wide they may go, the sliders of a picked one ([row index, label, min, max, step, default])
const TUFTS = [[8, "bangWidth", 0.2, 2, 0.05, 1], [5, "bangSweep", -25, 25, 0.5, 0], [7, "bangFlick", -0.04, 0.04, 0.001, 0], [9, "bangWave", 0, 0.05, 0.002, 0], [6, "bangThick", -0.02, 0.03, 0.001, 0]];
const KINDS = {
  nendo: { path: "hair.sculpt.nendo.tips", span: "hair.sculpt.nendo.span", sliders: TUFTS },
  hime: { path: "hair.sculpt.hime.tips", span: "hair.sculpt.hime.span", sliders: TUFTS.filter(([k]) => k === 8 || k === 6) },   // (no sweep, flick or wave: a straight cut)
  side: { path: "hair.sculpt.side.strands", sliders: [[3, "sideWidth", 0.02, 0.12, 0.002, 0.06], [4, "sideBend", -30, 30, 0.5, 0], [0, "sideRoot", -80, 80, 0.5, 0]] },
};

/** vp: the viewport (createViewport) / store: the recipe / onSelect(): the selection changed (the panel shows its sliders) */
export function createBangTool({ vp, store, onSelect = () => {} }) {
  const group = new THREE.Group(); group.visible = false; group.renderOrder = 10;
  const mat = new THREE.MeshBasicMaterial({ color: 0xff5a7a, depthTest: false, transparent: true, opacity: 0.9 }), selMat = new THREE.MeshBasicMaterial({ color: 0x4b4acf, depthTest: false, transparent: true });
  const geo = new THREE.SphereGeometry(0.0085, 16, 12);
  let on = false, sel = -1, drag = null, av = null;
  const kindId = () => KINDS[store.get("hair.bangs")] ? store.get("hair.bangs") : null, kind = () => KINDS[kindId()];
  const tips = () => (kind() && store.get(kind().path)) ?? [];
  const waist = () => av.internals.HT.toHead(0, av.internals.J.spine[1], 0)[1];   // the lowest a tip goes (head space): the waist
  const usable = () => !!kind();
  const tipPos = (t) => kindId() === "side" ? av.sideTipAt(t[1], t[2]) : av.bangTipAt(tipAngle(t), t[1]);

  // a tip's point (avatar space, rest) → the head bone's own space (the dots are children of the head bone)
  const headLocal = (p) => { const J = av.internals.J.head; return new THREE.Vector3(p[0] - J[0], p[1] - J[1], p[2] - J[2]); };
  function place() {
    group.clear();
    if (!av || !on || !usable()) { group.visible = false; return; }
    if (group.parent !== av.bones.head) av.bones.head.add(group);
    tips().forEach((t, i) => { const m = new THREE.Mesh(geo, i === sel ? selMat : mat); m.position.copy(headLocal(tipPos(t))); m.renderOrder = 10; m.userData.i = i; group.add(m); });
    group.visible = true;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!group.visible) return; toNdc(e);
    const h = ray.intersectObjects(group.children)[0]; if (!h) return;
    sel = h.object.userData.i; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId);   // on a dot the camera doesn't turn
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(new THREE.Vector3()).negate(), h.object.getWorldPosition(new THREE.Vector3()));
    drag = { tips: structuredClone(tips()), moved: false }; place(); onSelect();
  }, { capture: true });   // before OrbitControls
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    const l = av.bones.head.worldToLocal(hit.clone()), J = av.internals.J.head, [x, y, z] = av.internals.HT.toHead(l.x + J[0], l.y + J[1], l.z + J[2]);   // → the rest pose → head space
    const t = drag.tips[sel];
    if (kindId() === "side") {   // the strand's tip: its angle around the head and up from the head's middle (as sideTipAt reads them)
      const c = av.options.body.sculpt.skull.y, th = Math.max(-90, Math.min(90, Math.atan2(x, Math.max(z + 0.005, 0.02)) / D2R)), ph = Math.max(-60, Math.min(50, Math.atan2(y - c, Math.hypot(x, z + 0.005)) / D2R));
      t[1] = +th.toFixed(2); t[2] = +ph.toFixed(2); }
    else { const span = store.get(kind().span) ?? 92, a = Math.max(-span, Math.min(span, Math.atan2(x, Math.max(z, 0.02)) / D2R));
      t[0] = +(a + (t[5] ?? 0)).toFixed(3); t[1] = +Math.max(waist(), Math.min(1.16, y - 0.006)).toFixed(3); }   // the table keeps the angle before the sweep
    group.children[sel]?.position.copy(headLocal(tipPos(t))); drag.moved = true;
  });
  const up = () => { if (!drag) return; const d = drag; drag = null; vp.controls.enabled = true; if (d.moved) store.set({ [kind().path]: d.tips }, { commit: true }); };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  const write = (fn) => { const T = structuredClone(tips()); fn(T); store.set({ [kind().path]: T }, { commit: true }); };
  return {
    get on() { return on; }, get selected() { return sel; }, get usable() { return usable(); },
    /** how many tufts (strands) there are, and the sliders of a picked one: [[row index, label key, min, max, step]] */
    get count() { return tips().length; }, get sliders() { return kind()?.sliders ?? []; }, get kind() { return kindId(); },
    /** the avatar the dots belong to (a new build makes a new one) */
    attach(next) { av = next; group.removeFromParent(); place(); },
    /** the tips changed (undo, a slider…): put the dots back on them */
    refresh() { if (sel >= tips().length) sel = -1; place(); },
    toggle(v = !on) { on = v; if (!on) sel = -1; place(); if (on) vp.view("face"); onSelect(); },
    select(i) { sel = i; place(); onSelect(); },
    /** one more tuft next to the selected one (or the middle one); a side-swept strand: a copy of it a little further along */
    add() { write((T) => { const i = sel >= 0 ? sel : Math.floor(T.length / 2);
      if (kindId() === "side") { const s = T[i] ?? [0, 30, -15, 0.06, 0]; T.splice(i + 1, 0, [s[0] + 12, s[1] + 12, s[2], s[3], s[4]].map((v) => +(+v).toFixed(3))); sel = i + 1; return; }
      const j = Math.min(i + 1, T.length - 1), a = i === j ? T[i][0] + 8 : (T[i][0] + T[j][0]) / 2;
      T.splice(i + 1, 0, [+a.toFixed(3), +((T[i][1] + T[j][1]) / 2).toFixed(3)]); sel = i + 1; }); },
    remove() { if (sel < 0 || tips().length <= (kindId() === "side" ? 1 : 2)) return; write((T) => { T.splice(sel, 1); sel = -1; }); },
    /** a value of the selected row (see KINDS) */
    value(k) { const d = (kind()?.sliders.find((s) => s[0] === k) ?? [])[5] ?? 0; return sel >= 0 ? (tips()[sel]?.[k] ?? d) : d; },
    setValue(k, v) { if (sel < 0) return; write((T) => { const t = T[sel]; while (t.length <= k) t.push(t.length === 4 ? null : t.length === 2 ? store.get("hair.sculpt.nendo.slope") : t.length === 8 ? 1 : 0); t[k] = v; }); },
  };
}
