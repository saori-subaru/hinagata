// Putting accessories on the character (options.accessories, src/accessories.js; 2026-10-05, Saori: Nahida's leaf hair ornament and anklets).
// With the tool on, a click on the character puts the chosen kind there: on the bone that moves that bit of the body (or of the hair),
// facing the way the surface faces. While an item is picked, a click moves it instead ("Add another" lets go of it). The picked item has its
// size, turn, color and mirror; each change is one undo step. The camera doesn't turn while the tool is on (the right button still pans).
import * as THREE from "three";
import { ACCESSORY_KINDS } from "../../src/accessories.js";

const SIZE = { leaf: 0.08, gem: 0.03, flower: 0.05, star: 0.05, ball: 0.03, band: 0.012 };

/** vp: the viewport / store: the recipe / onChange(): the tool's state changed (the panel redraws) */
export function createAccessoryTool({ vp, store, onChange = () => {} }) {
  const S = { on: false, kind: "leaf", color: "#e3c25a", mirror: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem("hinagata.editor.acc")) ?? {}, { on: false }); } catch {}
  const save = () => { try { localStorage.setItem("hinagata.editor.acc", JSON.stringify({ ...S, on: false })); } catch {} };
  let av = null, sel = -1;
  const list = () => store.get("accessories") ?? [];
  const write = (L) => store.set({ accessories: L }, { commit: true });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };

  // a click → { bone, at, n } (rest pose): the bone that moves the touched triangle most, the point and the surface's way in its terms
  function place(e) {
    toNdc(e);
    const hit = ray.intersectObjects(Object.values(av.parts).filter((x) => x.m.visible).map((x) => x.m), false)[0]; if (!hit?.face) return null;
    const m = hit.object, SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight, w = {};
    if (SI) for (const v of [hit.face.a, hit.face.b, hit.face.c]) for (let k = 0; k < 4; k++) { const b = SI.getComponent(v, k); w[b] = (w[b] ?? 0) + SW.getComponent(v, k); }
    const bi = +Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0], bone = m.skeleton?.bones[bi]; if (!bone) return null;
    const name = Object.keys(av.bones).find((k) => av.bones[k] === bone); if (!name) return null;
    const J = av.internals.J[name], l = bone.worldToLocal(hit.point.clone()), p = [l.x + J[0], l.y + J[1], l.z + J[2]];   // → the rest pose
    const nw = hit.face.normal.clone().transformDirection(m.matrixWorld), n = nw.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
    const r4 = (x) => +x.toFixed(4);
    const at = name === "head" ? av.internals.HT.toHead(...p) : [p[0] - J[0], p[1] - J[1], p[2] - J[2]];
    return { bone: name, at: at.map(r4), n: [n.x, n.y, n.z].map(r4) };
  }
  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!S.on || !av || e.button !== 0) return;
    const q = place(e); if (!q) return; e.stopPropagation();
    const L = structuredClone(list());
    if (sel >= 0 && L[sel]) Object.assign(L[sel], q);
    else { L.push({ kind: S.kind, ...q, spin: 0, size: SIZE[S.kind] ?? 0.04, color: S.color, mirror: S.mirror }); sel = L.length - 1; }
    write(L); onChange();
  }, { capture: true });

  return {
    get state() { return S; }, get selected() { return sel; }, get items() { return list(); }, kinds: ACCESSORY_KINDS,
    attach(next) { av = next; if (sel >= list().length) sel = -1; },
    toggle(on = !S.on) { S.on = on; vp.controls.enableRotate = !on; onChange(); },
    set(k, v) { S[k] = v; save(); onChange(); },
    /** a kind picked: the next click puts a new one of it (2026-10-07, Saori: picking one showed nothing. The last one put was still
     *  picked, so the click moved it instead, and the tool might not even be on) */
    choose(k) { S.kind = k; sel = -1; save(); this.toggle(true); },
    pick(i) { sel = sel === i ? -1 : i; onChange(); },
    /** the picked item's own value */
    edit(k, v) { const L = structuredClone(list()); if (!L[sel]) return; L[sel][k] = v; write(L); onChange(); },
    remove() { const L = structuredClone(list()); if (!L[sel]) return; L.splice(sel, 1); sel = -1; write(L); onChange(); },
  };
}
