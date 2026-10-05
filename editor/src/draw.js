// Drawing locks of hair on the character (2026-10-05, Saori: "draw the tufts like a picture instead of sliders").
// With the tool on, a stroke on the 3D view from a lock's root to its tip becomes one lock (options.hair.drawn). Where the stroke runs over
// the hair it sticks to it, lifted by half the lock's thickness; elsewhere it stays in the plane facing the camera through the last bit of
// hair it touched, so a lock drawn from the side bends the way it was drawn, and one drawn from the front hangs flat to the view. Over the
// face, the body and the clothes it only comes forward onto them where that plane would put it behind them (a side lock drawn down to the
// shoulders stuck to the face's outline and the neck instead of hanging, 2026-10-05, Saori). A stroke starts on the character.
// The points are kept in head space (they follow the head's shape and turn with it).
// Moving a drawn lock (2026-10-05, Saori: "描いたふさも、つかんでずらしたりできる?"): with "move" on, each lock has three dots. The root moves the
// whole lock as it is (onto the hair where the pointer is over it); the tip turns and stretches it around its root, its shape kept; the
// middle bends it there, root and tip staying. A mirrored lock has dots on both sides (either moves both). Releasing is one undo step.
// The camera doesn't turn while drawing; turn it with the tool off (or hold the right button / two fingers, which OrbitControls keeps).
import * as THREE from "three";

/** vp: the viewport / store: the recipe / onChange(): the tool's state changed (the panel redraws) */
export function createDrawTool({ vp, store, onChange = () => {} }) {
  const S = { on: false, move: false, width: 0.03, thick: 0.3, stiff: 1, mirror: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem("hinagata.editor.draw")) ?? {}, { on: false, move: false }); } catch {}
  const save = () => { try { localStorage.setItem("hinagata.editor.draw", JSON.stringify({ ...S, on: false, move: false })); } catch {} };
  let av = null, stroke = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), v = new THREE.Vector3();
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4b4acf, depthTest: false }));
  line.renderOrder = 20; line.frustumCulled = false;
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  const HAIR = new Set(["hair", "locks", "bangs", "drawn", "tails", "tailTie"]);
  const targets = () => av ? Object.entries(av.parts).filter(([, x]) => x.m.visible).map(([k, x]) => { x.m.userData.drawHair = HAIR.has(k); return x.m; }) : [];
  const lifted = (hit) => { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : ray.ray.direction.clone().negate(); return hit.point.clone().addScaledVector(n, 0.5 * S.width * S.thick + 0.002); };
  // a point on the screen → a world point: on the hair (lifted off it) or, off it, on the plane through the last bit of hair it touched
  // (brought forward onto the face / body / clothes only where they are in front of that plane)
  function pick(e) {
    toNdc(e);
    const hits = ray.intersectObjects(targets(), false), hit = hits[0];
    if (hit && (hit.object.userData.drawHair || !stroke)) { const p = lifted(hit); plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(v).negate(), p); return p; }   // a stroke starts on anything
    if (!stroke) return null;
    const q = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!q) return null;
    if (hit && hit.distance < ray.ray.origin.distanceTo(q)) return lifted(hit);   // the plane is behind the face / body here
    return q;
  }
  // world → head space (as the engine builds the hair: the head bone's rest, then the head's own scaling)
  function toHead(w) {
    const l = av.bones.head.worldToLocal(w.clone()), J = av.internals.J.head;
    return av.internals.HT.toHead(l.x + J[0], l.y + J[1], l.z + J[2]).map((x) => +x.toFixed(4));
  }
  function show() { line.geometry.setFromPoints(stroke ? stroke.world : []); line.visible = !!stroke; }

  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!S.on || !av || e.button !== 0) return;
    const p = pick(e); if (!p) return;
    stroke = { world: [p] }; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId);
    if (!line.parent) vp.scene.add(line); show(); e.stopPropagation();
  }, { capture: true });
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!stroke) return; const p = pick(e); if (!p) return;
    if (p.distanceTo(stroke.world.at(-1)) < 0.006) return;   // a point every 6 mm
    stroke.world.push(p); show();
  });
  const up = () => {
    if (!stroke) return; const s = stroke; stroke = null; vp.controls.enabled = true; show();
    let len = 0; for (let i = 1; i < s.world.length; i++) len += s.world[i].distanceTo(s.world[i - 1]);
    if (s.world.length < 3 || len < 0.02) return;   // a click, not a stroke
    const lock = { pts: s.world.map(toHead), width: S.width, thick: S.thick, stiff: S.stiff, mirror: S.mirror };
    store.set({ "hair.drawn": [...(store.get("hair.drawn") ?? []), lock] }, { commit: true });
  };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  // ── moving the drawn locks: dots on the head bone (they ride with it), at the root, the middle and the tip ──
  const dots = new THREE.Group(); dots.visible = false; dots.renderOrder = 10;
  const dotGeo = new THREE.SphereGeometry(0.0085, 16, 12), DOT = { root: new THREE.MeshBasicMaterial({ color: 0x4b4acf, depthTest: false }), mid: new THREE.MeshBasicMaterial({ color: 0x2aa58a, depthTest: false }), tip: new THREE.MeshBasicMaterial({ color: 0xff5a7a, depthTest: false }) };
  let drag = null;
  const locks = () => store.get("hair.drawn") ?? [];
  const headLocal = (q, m = 1) => { const p = av.internals.HT.fromHead(q[0] * m, q[1], q[2]), J = av.internals.J.head; return new THREE.Vector3(p[0] - J[0], p[1] - J[1], p[2] - J[2]); };   // head space → the head bone's own
  const arc = (P) => { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2])); const L = s.at(-1) || 1; return s.map((x) => x / L); };
  const midOf = (P) => { const s = arc(P); let k = 1, best = 9; s.forEach((x, i) => { if (i && i < P.length - 1 && Math.abs(x - 0.5) < best) { best = Math.abs(x - 0.5); k = i; } }); return k; };
  function placeDots() {
    dots.clear();
    if (!av || !S.move) { dots.visible = false; return; }
    if (dots.parent !== av.bones.head) av.bones.head.add(dots);
    locks().forEach((d, i) => { if (!d?.pts || d.pts.length < 3) return;
      for (const m of d.mirror ? [1, -1] : [1]) for (const [h, k] of [["root", 0], ["mid", midOf(d.pts)], ["tip", d.pts.length - 1]]) {
        const o = new THREE.Mesh(dotGeo, DOT[h]); o.position.copy(headLocal(d.pts[k], m)); o.renderOrder = 10; o.userData = { i, h, m }; dots.add(o); } });
    dots.visible = true;
  }
  // the lock's new points (head space) for the dragged dot at q (head space, on the lock's own side)
  function reshape(P, h, q) {
    const V = (a) => new THREE.Vector3(...a), R = V(P[0]), T = V(P.at(-1)), Q = V(q);
    if (h === "root") { const d = Q.sub(R); return P.map((p) => [p[0] + d.x, p[1] + d.y, p[2] + d.z]); }   // the whole lock
    if (h === "tip") { const a = T.clone().sub(R), b = Q.clone().sub(R), k = b.length() / (a.length() || 1), r = new THREE.Quaternion().setFromUnitVectors(a.normalize(), b.normalize());   // turned and stretched around the root
      return P.map((p) => { const v = V(p).sub(R).applyQuaternion(r).multiplyScalar(k).add(R); return [v.x, v.y, v.z]; }); }
    const s = arc(P), k = midOf(P), d = Q.sub(V(P[k])), w = (x) => Math.sin(Math.PI * x) / (Math.sin(Math.PI * s[k]) || 1);   // the middle: bent there, root and tip staying
    return P.map((p, i) => [p[0] + d.x * w(s[i]), p[1] + d.y * w(s[i]), p[2] + d.z * w(s[i])]);
  }
  const r4 = (P) => P.map((p) => p.map((x) => +x.toFixed(4)));
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!S.move || !av || e.button !== 0 || !dots.visible) return; toNdc(e);
    const h = ray.intersectObjects(dots.children)[0]; if (!h) return;
    const { i, h: which, m } = h.object.userData;
    plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(v).negate(), h.object.getWorldPosition(new THREE.Vector3()));
    drag = { i, which, m, P: structuredClone(locks()[i].pts), out: null }; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId); e.stopPropagation();
  }, { capture: true });
  vp.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return; toNdc(e);
    let w = null;
    if (drag.which === "root") { const hit = ray.intersectObjects(targets(), false).find((x) => x.object.userData.drawHair && x.object !== av.parts.drawn?.m); if (hit) w = lifted(hit); }   // the root goes onto the hair
    w ??= ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!w) return;
    const q = toHead(w); q[0] *= drag.m;   // a dot on the mirrored side: back to the lock's own side
    drag.out = reshape(drag.P, drag.which, q);
    const head = av.bones.head, pts = drag.out.map((p) => head.localToWorld(headLocal(p, drag.m)));   // a preview line on the dragged side (the lock rebuilds on release)
    line.geometry.setFromPoints(pts); line.visible = true; if (!line.parent) vp.scene.add(line);
    for (const o of dots.children) if (o.userData.i === drag.i) { const k = o.userData.h === "root" ? 0 : o.userData.h === "tip" ? drag.out.length - 1 : midOf(drag.out); o.position.copy(headLocal(drag.out[k], o.userData.m)); }
  });
  const drop = () => {
    if (!drag) return; const d = drag; drag = null; vp.controls.enabled = true; line.visible = false;
    if (!d.out) return;
    const L = structuredClone(locks()); if (!L[d.i]) return; L[d.i].pts = r4(d.out); store.set({ "hair.drawn": L }, { commit: true });
  };
  vp.canvas.addEventListener("pointerup", drop); vp.canvas.addEventListener("pointercancel", drop);

  return {
    get state() { return S; },
    attach(next) { av = next; dots.removeFromParent(); placeDots(); },
    refresh() { placeDots(); },
    toggle(on = !S.on) { S.on = on; if (on) S.move = false; vp.controls.enableRotate = !(S.on || S.move); placeDots(); onChange(); },   // drawing: the left button draws (the right button still pans)
    toggleMove(on = !S.move) { S.move = on; if (on) S.on = false; vp.controls.enableRotate = !(S.on || S.move); placeDots(); onChange(); },   // moving: the dots
    set(k, val) { S[k] = val; save(); onChange(); },
    /** remove one drawn lock (index), or the last one */
    remove(i = (store.get("hair.drawn") ?? []).length - 1) { const L = [...(store.get("hair.drawn") ?? [])]; if (i < 0 || i >= L.length) return; L.splice(i, 1); store.set({ "hair.drawn": L }, { commit: true }); },
    clear() { store.set({ "hair.drawn": [] }, { commit: true }); },
    /** change a drawn lock's own values (width, thick, stiff, mirror) */
    edit(i, ch) { const L = structuredClone(store.get("hair.drawn") ?? []); if (!L[i]) return; Object.assign(L[i], ch); store.set({ "hair.drawn": L }, { commit: true }); },
  };
}
