// Moving the tufts from the whorl (hair.tufts, src/hair/locks.js tuftLocks) on the character, like the bangs' tufts (bangs.js).
// A dot on each tuft's tip: dragging it moves the tip round the head (left / right) and up or down. A smaller dot on each spike's point:
// dragging it up or down moves the spike along its tuft. Releasing writes hair.tufts (one undo step); the engine rebuilds only the tufts
// (avatar.setTufts). The tufts go all round the head and the dots are drawn over everything, so those on the far side are hidden.
// A mirrored tuft (mirror: true) has its dots on the side it is written for.
import * as THREE from "three";

const D2R = Math.PI / 180, CZ = -0.005;   // CZ: the line the tufts' angles go round (head space z; src/index.js bangKit's center)
// the sliders of a picked tuft / spike: [key, label, min, max, step, default]. points, from, to are not keys of the recipe (see value)
const TUFT = [["width", "tuftWidth", 0.04, 0.4, 0.005, 0.1], ["thick", "tuftThick", 0.005, 0.1, 0.001, 0.014], ["out", "tuftOut", 0, 0.12, 0.002, 0], ["bow", "tuftBow", -40, 40, 1, 0],
  ["points", "tuftPoints", 1, 4, 1, 1], ["notch", "tuftNotch", 0.02, 0.3, 0.01, 0.14], ["hug", "tuftHug", 0, 1, 0.05, 0], ["shade", "tuftShade", 0, 1, 0.05, 0]];
const SPIKE = [["length", "spikeLength", 0.05, 0.3, 0.005, 0.16], ["out", "spikeOut", 0, 0.15, 0.002, 0.07], ["up", "spikeUp", -60, 60, 1, 12], ["width", "spikeWidth", 0.04, 0.2, 0.002, 0.1],
  ["from", "spikeFrom", -1, 1, 0.05, 0], ["to", "spikeTo", -1, 1, 0.05, 0]];
const POINTS = { 2: [1, 0.85], 3: [0.9, 1, 0.82], 4: [0.86, 1, 0.8, 0.93] };   // an end cut into this many points (tips)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** vp: the viewport (createViewport) / store: the recipe / onSelect(): the selection changed (the panel shows its sliders) */
export function createTuftTool({ vp, store, onSelect = () => {} }) {
  const group = new THREE.Group(); group.visible = false; group.renderOrder = 10;
  const mk = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity });
  const mat = mk(0xff5a7a), matS = mk(0xe0a020), selMat = mk(0x4b4acf, 1), geo = new THREE.SphereGeometry(0.0085, 16, 12), geoS = new THREE.SphereGeometry(0.0062, 16, 12);
  let on = false, sel = null, drag = null, av = null;   // sel: { i, k } (k -1: the tuft itself)
  const list = () => store.get("hair.tufts") ?? [], isSel = (u) => !!sel && sel.i === u.i && sel.k === u.k;
  const headLocal = (p) => { const J = av.internals.J.head; return new THREE.Vector3(p[0] - J[0], p[1] - J[1], p[2] - J[2]); };   // avatar space (rest) → the head bone's own
  function place() {
    group.clear();
    if (!av || !on) { group.visible = false; return; }
    if (group.parent !== av.bones.head) av.bones.head.add(group);
    for (const s of av.tuftSpots()) { if (s.m < 0) continue; const m = new THREE.Mesh(s.k < 0 ? geo : geoS, isSel(s) ? selMat : s.k < 0 ? mat : matS); m.position.copy(headLocal(s.p)); m.renderOrder = 10; m.userData = { i: s.i, k: s.k }; group.add(m); }
    group.visible = true; facing();
  }
  // only the dots on the camera's side of the head (and the picked one)
  const mid = new THREE.Vector3(), eye = new THREE.Vector3(), at = new THREE.Vector3();
  function facing() {
    if (!av || !group.visible) return;
    mid.copy(headLocal(av.internals.HT.fromHead(0, av.options.body.sculpt.skull.y, CZ))); group.localToWorld(mid); eye.copy(vp.camera.position).sub(mid).normalize();
    for (const m of group.children) m.visible = isSel(m.userData) || m.getWorldPosition(at).sub(mid).normalize().dot(eye) > (m.userData.shown ? -0.3 : -0.2), m.userData.shown = m.visible;   // (one at the edge stays as it is: the head sways, and it flickered)
  }
  vp.onFrame(facing);

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!group.visible) return; toNdc(e);
    const h = ray.intersectObjects(group.children.filter((m) => m.visible))[0]; if (!h) return;
    sel = { i: h.object.userData.i, k: h.object.userData.k }; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId);   // on a dot the camera doesn't turn
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(new THREE.Vector3()).negate(), h.object.getWorldPosition(new THREE.Vector3()));
    drag = { list: structuredClone(list()), moved: false }; place(); onSelect();
  }, { capture: true });   // before OrbitControls
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    const l = av.bones.head.worldToLocal(hit.clone()), J = av.internals.J.head, [x, y, z] = av.internals.HT.toHead(l.x + J[0], l.y + J[1], l.z + J[2]);   // → the rest pose → head space
    const d = drag.list[sel.i], dot = group.children.find((m) => isSel(m.userData)); if (!d) return;
    if (sel.k < 0) { d.to = [+(Math.atan2(x, z - CZ) / D2R).toFixed(1), +clamp(y, 0.8, 1.28).toFixed(3)]; dot?.position.copy(headLocal(av.tuftTipAt(d.to[0], d.to[1]))); }
    else { const sp = d.spikes?.[sel.k]; if (!sp) return; sp.y = +clamp(y, (d.to?.[1] ?? 0.9) + 0.02, 1.3).toFixed(3); delete sp.at; if (dot) dot.position.y = l.y; }   // (a spike placed by its share of the tuft, at: by its height from here on)
    drag.moved = true;
  });
  const up = () => { if (!drag) return; const d = drag; drag = null; vp.controls.enabled = true; if (d.moved) store.set({ "hair.tufts": d.list }, { commit: true }); };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  const write = (fn) => { const L = structuredClone(list()); fn(L); store.set({ "hair.tufts": L }, { commit: true }); };
  const picked = (L = list()) => { const d = sel ? L[sel.i] : null; return !d ? null : sel.k < 0 ? d : d.spikes?.[sel.k] ?? null; };
  const side = (sp) => Array.isArray(sp.side) ? [sp.side[0] ?? 0, sp.side[1] ?? 0] : [sp.side ?? 0, sp.side ?? 0];
  return {
    get on() { return on; }, get selected() { return picked() ? sel : null; }, get usable() { return true; },
    /** how many tufts and spikes there are, and the sliders of the picked one: [[key, label key, min, max, step, default]] */
    get count() { return list().filter((d) => Array.isArray(d?.to)).length; }, get spikes() { return list().reduce((n, d) => n + (d?.spikes?.length ?? 0), 0); },
    get sliders() { return !picked() ? [] : sel.k < 0 ? TUFT : SPIKE; },
    /** the avatar the dots belong to (a new build makes a new one) */
    attach(next) { av = next; group.removeFromParent(); place(); },
    /** the tufts changed (undo, a slider…): put the dots back on them */
    refresh() { if (sel && !picked()) sel = null; place(); },
    toggle(v = !on) { on = v; if (!on) sel = null; place(); if (on) vp.view("face"); onSelect(); },
    /** one more tuft: beside the picked one and as wide and thick, or the first, in front */
    addTuft() { write((L) => { const d = sel ? L[sel.i] : null, a = d?.to ? ((d.to[0] + 25 + 180) % 360 + 360) % 360 - 180 : 0;
      L.push(d?.to ? { to: [+a.toFixed(1), d.to[1]], width: d.width ?? 0.1, thick: d.thick ?? 0.014 } : { to: [0, 1], width: 0.18, thick: 0.04 }); sel = { i: L.length - 1, k: -1 }; }); },
    /** one more spike on the picked tuft (or the picked spike's), a little over its tip */
    addSpike() { if (!picked()) return; write((L) => { const d = L[sel.i]; (d.spikes ??= []).push({ y: +clamp((d.to?.[1] ?? 1) + 0.15, 0.9, 1.25).toFixed(3) }); sel = { i: sel.i, k: d.spikes.length - 1 }; }); },
    remove() { if (!picked()) return; write((L) => { if (sel.k < 0) L.splice(sel.i, 1); else { const d = L[sel.i]; d.spikes.splice(sel.k, 1); if (!d.spikes.length) delete d.spikes; } sel = null; }); },
    /** a value of the picked tuft or spike. points: how many points its end is cut into (tips); from / to: where across the tuft a spike runs (side) */
    value(k) { const o = picked(), S = this.sliders.find((s) => s[0] === k); if (!o || !S) return 0;
      if (k === "points") return o.tips?.length || 1; if (k === "from" || k === "to") return side(o)[k === "from" ? 0 : 1];
      if (k === "width" && sel.k >= 0) return o.width ?? clamp(0.45 * (list()[sel.i].width ?? 0.1), 0.08, 0.12);   // (a spike without a width: by its tuft's, as tuftLocks)
      return o[k] ?? S[5]; },
    setValue(k, v) { if (!picked()) return; write((L) => { const o = picked(L);
      if (k === "points") { const n = Math.round(v); if (n <= 1) delete o.tips; else if (o.tips?.length !== n) o.tips = [...POINTS[n]]; }
      else if (k === "from" || k === "to") { const s = side(o); s[k === "from" ? 0 : 1] = v; o.side = s[0] === s[1] ? s[0] : s; }
      else o[k] = v; }); },
  };
}
