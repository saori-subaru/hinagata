// Painting on the character (2026-10-05, Saori: "VRoid みたくアプリ上でテクスチャを描けるといい"). With the tool on, the left button paints
// on whatever paintable part it touches (the skin or a garment: avatar.paintTargets()). The touched point is turned back into the part's
// own terms (where that bit of surface was when it was made, at the base proportions, and its normal: paintP / paintN, interpolated over the
// triangle), and a soft round dab is drawn into each view of the part's atlas that point could show in (src/paint.js). Between two touches
// dabs fill the gap, so a quick stroke stays unbroken. The canvas shows on the character at once; releasing writes it into the recipe
// (paint.<part>.src, one undo step). The camera doesn't turn while painting (the right button still pans).
import * as THREE from "three";
import { paintPixel, paintViews } from "../../src/paint.js";

/** vp: the viewport / store: the recipe / onChange(): the tool's state changed (the panel redraws) */
export function createPaintTool({ vp, store, onChange = () => {} }) {
  const S = { on: false, color: "#e0505a", size: 0.012, opacity: 1, soft: 0.35, erase: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem("hinagata.editor.paint")) ?? {}, { on: false }); } catch {}
  const save = () => { try { localStorage.setItem("hinagata.editor.paint", JSON.stringify({ ...S, on: false })); } catch {} };
  let av = null, stroke = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const toNdc = (e) => { const r = vp.canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, vp.camera); };

  // the touched point in the part's own terms: { target, p, n }
  function touch(e) {
    toNdc(e); const T = av.paintTargets(), h = ray.intersectObjects(T.map((x) => x.mesh), false)[0]; if (!h?.face) return null;
    const m = h.object, f = h.face, target = T.find((x) => x.mesh === m).target;
    for (const [i, V] of [[f.a, A], [f.b, B], [f.c, C]]) { m.getVertexPosition(i, V); m.localToWorld(V); }   // the triangle as posed (skinned)
    const v0 = B.clone().sub(A), v1 = C.clone().sub(A), v2 = h.point.clone().sub(A), d00 = v0.dot(v0), d01 = v0.dot(v1), d11 = v1.dot(v1), d20 = v2.dot(v0), d21 = v2.dot(v1), den = d00 * d11 - d01 * d01 || 1;
    const wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den, wa = 1 - wb - wc;   // barycentric
    const P = m.geometry.attributes.paintP, N = m.geometry.attributes.paintN, at = (X, k) => wa * X.getComponent(f.a, k) + wb * X.getComponent(f.b, k) + wc * X.getComponent(f.c, k);
    const p = [0, 1, 2].map((k) => at(P, k)), n = [0, 1, 2].map((k) => at(N, k)), l = Math.hypot(...n) || 1;
    return { target, p, n: n.map((x) => x / l) };
  }
  function dab(t, p, n) {
    const Sf = av.paintSurface(t), L = Sf.layout, ctx = Sf.ctx, r = Math.max(0.5, S.size * L.PPM), c = new THREE.Color(S.color);
    const rgba = (a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
    for (const v of paintViews(L, n)) { const [x, y] = paintPixel(L, v, p), g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(S.opacity)); g.addColorStop(Math.max(0.01, 1 - S.soft), rgba(S.opacity)); g.addColorStop(1, rgba(0));
      ctx.save(); ctx.globalCompositeOperation = S.erase ? "destination-out" : "source-over";
      ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();   // inside this view only (no bleeding into the next one)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  // from the last touch to this one: dabs a third of the brush apart. Across two parts (the skin to the shirt, the shirt to the pants) a short
  // gap goes into both, and a touch that missed (the pointer off an edge for a moment) doesn't break the line; a jump further than GAP does,
  // and between two parts one further than a few brushes (off a sleeve's edge onto the arm behind it: that's not across a seam) (2026-10-07, Saori: dotted strokes)
  const GAP = 0.08;
  function paintTo(hit) {
    const last = stroke.last; stroke.last = hit;
    const d = last ? Math.hypot(hit.p[0] - last.p[0], hit.p[1] - last.p[1], hit.p[2] - last.p[2]) : Infinity;
    if (d < (last?.target === hit.target ? GAP : Math.max(0.025, 3 * S.size))) { const k = Math.min(200, Math.floor(d / Math.max(0.001, S.size * 0.35))), into = new Set([last.target, hit.target]);
      for (let i = 1; i <= k; i++) { const s = i / (k + 1), q = last.p.map((x, j) => x + (hit.p[j] - x) * s), m = last.n.map((x, j) => x + (hit.n[j] - x) * s); for (const t of into) dab(t, q, m); }
      for (const t of into) { stroke.touched.add(t); av.paintSurface(t).update(); } }
    dab(hit.target, hit.p, hit.n); stroke.touched.add(hit.target); av.paintSurface(hit.target).update();
  }

  vp.canvas.addEventListener("pointerdown", (e) => {
    if (!S.on || !av || e.button !== 0) return;
    const hit = touch(e); if (!hit) return;
    stroke = { last: null, touched: new Set() }; vp.controls.enabled = false; vp.canvas.setPointerCapture(e.pointerId); paintTo(hit); e.stopPropagation();
  }, { capture: true });
  vp.canvas.addEventListener("pointermove", (e) => { if (!stroke) return; const hit = touch(e); if (hit) paintTo(hit); });
  const up = () => {
    if (!stroke) return; const s = stroke; stroke = null; vp.controls.enabled = true;
    const ch = {}; for (const t of s.touched) { const Sf = av.paintSurface(t), url = Sf.canvas.toDataURL("image/png"); Sf.sync(url); ch[`paint.${t}.src`] = url; }
    if (Object.keys(ch).length) store.set(ch, { commit: true });
  };
  vp.canvas.addEventListener("pointerup", up); vp.canvas.addEventListener("pointercancel", up);

  return {
    get state() { return S; },
    attach(next) { av = next; },
    toggle(on = !S.on) { S.on = on; vp.controls.enableRotate = !on; onChange(); },
    set(k, val) { S[k] = val; save(); onChange(); },
    /** the parts that have paint now */
    painted() { return ["body", "shirt", "pants", "dress", "cape"].filter((t) => store.get(`paint.${t}.src`)); },
    clear(t) { store.set({ [`paint.${t}.src`]: null }, { commit: true }); },
  };
}
