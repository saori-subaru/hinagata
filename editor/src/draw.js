// Drawing locks of hair on the character (2026-10-05, Saori: "draw the tufts like a picture instead of sliders").
// With the tool on, a stroke on the 3D view from a lock's root to its tip becomes one lock (options.hair.drawn). Where the stroke runs over
// the character it sticks to what it touches (the hair, the face, the clothes), lifted by half the lock's thickness; where it leaves the
// character it stays in the plane facing the camera through the last point it touched, so a lock drawn from the side bends the way it was
// drawn, and one drawn from the front hangs flat to the view. The points are kept in head space (they follow the head's shape and turn with it).
// The camera doesn't turn while drawing; turn it with the tool off (or hold the right button / two fingers, which OrbitControls keeps).
import * as THREE from "three";

/** vp: the viewport / store: the recipe / onChange(): the tool's state changed (the panel redraws) */
export function createDrawTool({ vp, store, onChange = () => {} }) {
  const S = { on: false, width: 0.03, thick: 0.3, stiff: 1, mirror: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem("hinagata.editor.draw")) ?? {}, { on: false }); } catch {}
  const save = () => { try { localStorage.setItem("hinagata.editor.draw", JSON.stringify({ ...S, on: false })); } catch {} };
  let av = null, stroke = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), v = new THREE.Vector3();
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4b4acf, depthTest: false }));
  line.renderOrder = 20; line.frustumCulled = false;
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };
  const targets = () => av ? Object.values(av.parts).filter((x) => x.m.visible).map((x) => x.m) : [];
  // a point on the screen → a world point: on the character (lifted off it) or, off it, on the plane through the last point that touched
  function pick(e) {
    toNdc(e);
    const hit = ray.intersectObjects(targets(), false)[0];
    if (hit) {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : ray.ray.direction.clone().negate();
      const p = hit.point.clone().addScaledVector(n, 0.5 * S.width * S.thick + 0.002);
      plane.setFromNormalAndCoplanarPoint(vp.camera.getWorldDirection(v).negate(), p); return p;
    }
    if (!stroke) return null;   // a stroke starts on the character
    return ray.ray.intersectPlane(plane, new THREE.Vector3());
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

  return {
    get state() { return S; },
    attach(next) { av = next; },
    toggle(on = !S.on) { S.on = on; vp.controls.enableRotate = !on; onChange(); },   // drawing: the left button draws (the right button still pans)
    set(k, val) { S[k] = val; save(); onChange(); },
    /** remove one drawn lock (index), or the last one */
    remove(i = (store.get("hair.drawn") ?? []).length - 1) { const L = [...(store.get("hair.drawn") ?? [])]; if (i < 0 || i >= L.length) return; L.splice(i, 1); store.set({ "hair.drawn": L }, { commit: true }); },
    clear() { store.set({ "hair.drawn": [] }, { commit: true }); },
    /** change a drawn lock's own values (width, thick, stiff, mirror) */
    edit(i, ch) { const L = structuredClone(store.get("hair.drawn") ?? []); if (!L[i]) return; Object.assign(L[i], ch); store.set({ "hair.drawn": L }, { commit: true }); },
  };
}
