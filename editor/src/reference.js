// A reference picture over the 3D view (2026-10-10, after 島風: the proportions were guessed from a picture by eye, and wrong). The picture
// is put over the character, or beside it, at the character's size: two lines on the picture (the top of the hair and the soles) are moved
// onto the character's own (the camera's projection of them, every frame, so it follows the camera; the front view compares best). Height
// guides across the view: the character's head, chin, shoulders, hip joints, knees and ankles, each as a share of its height, and how many
// heads tall it is. The picture is kept per character in this browser (IndexedDB), not in the recipe (it would make the file huge).
import * as THREE from "three";

const DB = "hinagata-editor-ref", STORE = "ref";
let dbp = null;
const db = () => dbp ??= new Promise((ok, ng) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error); });
const tx = async (mode, f) => { try { const d = await db(); return await new Promise((ok, ng) => { const q = f(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => ok(q.result); q.onerror = () => ng(q.error); }); } catch { return null; } };   // (no IndexedDB: kept for this visit only)

// the character's heights (m, in its object, as built): the top of its hair, the skull's top (the body's shape down the middle), the chin,
// the joints. Each line rides on a bone (the head's lines on the head): heels lift the whole body (4 cm on 島風) and a pose moves it
function measure(av) {
  const I = av.internals, f = I.bodySdf, J = I.J;
  let top = 0;
  for (const [k, x] of Object.entries(av.parts)) {
    if (!x.m.visible || x.sim || /^(acc|weapon|extra|headband|armorDeco)/.test(k)) continue;   // (what stands above the hair: a bow's loops, ears, a plume)
    const g = x.m.geometry; if (!g.attributes.position?.count) continue; g.computeBoundingBox(); top = Math.max(top, g.boundingBox.max.y);
  }
  const solid = (y) => { for (let z = -0.25; z < 0.3; z += 0.004) if (f(0, y, z) < 0) return true; return false; };
  let skull = J.head[1]; while (skull < 3 && solid(skull + 0.002)) skull += 0.002;
  // the chin: near the bottom of the jaw in head space (body.sculpt.chin.y, carried onto the head as built), where the body's front at the
  // middle falls back furthest (from the chin into the neck). Over the whole lower face that was the nose's step on a tall face; followed
  // down from the jaw's height, it went on down the neck
  const ch = av.options.body.sculpt.chin, cy = I.HT.fromHead(0, ch.y, 0.15)[1];
  const front = (y) => { for (let z = 0.4; z > -0.2; z -= 0.002) if (f(0, y, z) < 0) return z; return -1; };
  let chin = cy, drop = 0, prev = front(cy + 0.03);
  for (let y = cy + 0.03; y > cy - 0.03; y -= 0.002) { const z = front(y - 0.002); if (prev - z > drop) { drop = prev - z; chin = y; } prev = z; }
  top = Math.max(top, skull);
  const lines = [["rg_top", top, 0, "head"], ["rg_skull", skull, 0, "head"], ["rg_chin", chin, front(chin), "head"], ["rg_shoulder", J["upperArm.L"][1], 0, "upperArm.L"], ["rg_hip", J["upperLeg.L"][1], 0, "upperLeg.L"], ["rg_knee", J["lowerLeg.L"][1], 0, "lowerLeg.L"], ["rg_ankle", J["foot.L"][1], 0, "foot.L"]];
  const M = { lines, heads: top / Math.max(0.01, skull - chin) };
  const now = live(av, M); M.top = now[0]; M.share = now.map((y) => y / now[0]);   // the shares as it stands when measured (in its shoes)
  return M;
}
// each line's height now (m, in the avatar's object): its rest height moved as its bone has moved
const _v = new THREE.Vector3();
function live(av, M) {
  const root = av.object, J = av.internals.J; root.updateMatrixWorld();
  return M.lines.map(([, y, , b]) => y + root.worldToLocal(av.bones[b].getWorldPosition(_v)).y - J[b][1]);
}

export function createReference({ vp, t, h, prefs, savePrefs, onChange = () => {} }) {
  const stage = vp.stage, S = { url: null, nat: null, top: 0.02, bottom: 0.98, ...(prefs.ref ?? {}) };   // top / bottom: the lines on the picture, as shares of its height
  let charId = null, open = false, M = null, measured = null;
  const keep = () => { prefs.ref = { mode: S.mode ?? "over", opacity: S.opacity ?? 0.5, guides: S.guides ?? true }; savePrefs(); };
  S.mode ??= "over"; S.opacity ??= 0.5; S.guides ??= true;

  // ── the layer over the view (under the buttons) ──
  const img = h("img", { class: "ref-img", alt: "", draggable: "false" });
  const guides = h("div", { class: "ref-guides" });
  const handle = (k) => { const el = h("div", { class: "ref-handle", "data-k": k }, h("span")); el.addEventListener("pointerdown", (e) => drag(e, k)); return el; };
  const handles = { top: handle("top"), bottom: handle("bottom") };
  const layer = h("div", { class: "ref-layer", hidden: true }, img, guides, handles.top, handles.bottom);
  stage.querySelector("canvas").after(layer);
  img.addEventListener("load", () => { S.nat = [img.naturalWidth, img.naturalHeight]; });

  // dragging a line onto the picture's hair top or soles: the picture holds still while the line moves over it, and is fitted again (its
  // lines onto the character's) when it is let go
  let box = null, dragging = false;   // box: the picture's place on screen ({ x, y, w, h }, stage pixels)
  function drag(e, k) {
    if (!box) return; e.preventDefault(); e.stopPropagation(); const el = handles[k]; el.setPointerCapture(e.pointerId); dragging = true;
    const top = stage.getBoundingClientRect().top;
    const move = (ev) => { const v = (ev.clientY - top - box.y) / box.h;
      S[k] = Math.min(k === "top" ? S.bottom - 0.05 : 1, Math.max(k === "top" ? 0 : S.top + 0.05, v)); };
    const up = () => { dragging = false; el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); save(); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }

  // ── each frame: the picture and the lines where the character is ──
  const v = new THREE.Vector3();
  const screen = (y, root, r, z = 0) => { v.set(0, y, z).applyMatrix4(root.matrixWorld).project(vp.camera); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; };
  vp.onFrame(() => {
    const av = vp.avatar, show = !!(av && (S.url || (S.on && S.guides)));   // (the guides stay after the panel closes, until unticked)
    layer.hidden = !show; if (!show) return;
    if (measured !== av) { M = measure(av); measured = av; }
    const r = stage.getBoundingClientRect(), root = av.object, [cx, y0] = screen(0, root, r), now = live(av, M), [, yT] = screen(now[0], root, r), span = y0 - yT;
    // the picture: its two lines onto the top of the hair and the floor
    if (S.url && S.nat && span > 4) {
      if (!dragging) { const k = span / ((S.bottom - S.top) * S.nat[1]), w = S.nat[0] * k, hh = S.nat[1] * k;
        box = { x: S.mode === "side" ? cx - w - span * 0.12 : cx - w / 2, y: yT - S.top * hh, w, h: hh }; }
      const { x, y, w, h: hh } = box;
      Object.assign(img.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, opacity: String(S.mode === "side" ? 1 : S.opacity) });
      img.hidden = false;
      const align = open && S.align;
      for (const k of ["top", "bottom"]) { const el = handles[k]; el.hidden = !align; if (!align) continue;
        Object.assign(el.style, { left: `${x}px`, width: `${w}px`, top: `${y + S[k] * hh}px` }); el.firstChild.textContent = t(k === "top" ? "ref_top" : "ref_bottom"); }
    } else { img.hidden = true; handles.top.hidden = handles.bottom.hidden = true; }
    // the guides: the character's heights, each as a share of its height
    if (S.guides) {
      if (guides.childElementCount !== M.lines.length) guides.replaceChildren(...M.lines.map(() => h("div", { class: "ref-line" }, h("span"))));
      const ys = M.lines.map(([, , z], i) => screen(now[i], root, r, z)[1])   // (each at its own depth: the chin in front of the face, seen from near and above)
     , txt = M.lines.map(([key], i) => `${t(key)} ${M.share[i].toFixed(3)}${key === "rg_skull" ? ` · ${t("ref_heads", M.heads.toFixed(2))}` : ""}`);
      for (let i = M.lines.length - 1; i > 0; i--) if (ys[i] - ys[i - 1] < 16) { txt[i - 1] += "  /  " + txt[i]; txt[i] = ""; }   // (lines close together: one label)
      M.lines.forEach((_, i) => { const el = guides.children[i]; el.style.top = `${ys[i]}px`; el.firstChild.textContent = txt[i]; el.firstChild.hidden = !txt[i]; });
      guides.hidden = false;
    } else guides.hidden = true;
  });

  // ── the picture: chosen, dropped or pasted; kept per character ──
  async function setPicture(blob) {
    if (!blob?.type?.startsWith("image/")) return;
    if (S.url) URL.revokeObjectURL(S.url);
    S.url = URL.createObjectURL(blob); S.blob = blob; S.nat = null; S.top = 0.02; S.bottom = 0.98; img.src = S.url;
    if (!open) toggle(true); else render(); save();
  }
  const save = () => charId && tx("readwrite", (s) => S.blob ? s.put({ blob: S.blob, top: S.top, bottom: S.bottom }, charId) : s.delete(charId));
  async function load(id) {
    charId = id; if (S.url) URL.revokeObjectURL(S.url); S.url = null; S.blob = null; S.nat = null; img.removeAttribute("src");
    const rec = await tx("readonly", (s) => s.get(id)); if (charId !== id) return;
    if (rec?.blob) { S.blob = rec.blob; S.top = rec.top; S.bottom = rec.bottom; S.url = URL.createObjectURL(rec.blob); img.src = S.url; }
    render();
  }
  stage.addEventListener("dragover", (e) => { if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) e.preventDefault(); });
  stage.addEventListener("drop", (e) => { const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); setPicture(f); } });
  addEventListener("paste", (e) => { if (e.target.closest?.("input, textarea")) return; const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/")); if (f) setPicture(f); });

  // ── its panel (opened from the display buttons) ──
  const file = h("input", { type: "file", accept: "image/*", hidden: true, onchange: (e) => { setPicture(e.target.files[0]); e.target.value = ""; } });
  const panel = h("div", { class: "refPanel", hidden: true });
  stage.append(panel, file);
  function render() {
    panel.hidden = !open; if (!open) return;
    const seg = (k, opts) => h("div", { class: "seg" }, ...opts.map(([val, label]) => h("button", { type: "button", "aria-pressed": String(S[k] === val), onclick: () => { S[k] = val; keep(); render(); } }, label)));
    const check = (k, label) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: S[k], onchange: (e) => { S[k] = e.target.checked; if (k !== "align") keep(); render(); onChange(); } }), label);
    panel.replaceChildren(...[
      h("h3", {}, t("ref_title")),
      h("button", { class: "btn small", type: "button", onclick: () => file.click() }, t("ref_pick")), h("p", { class: "hint" }, t("ref_drop")),
      ...(S.url ? [
        seg("mode", [["over", t("ref_over")], ["side", t("ref_side")]]),
        S.mode === "over" ? h("label", { class: "rng" }, t("ref_opacity"), h("input", { type: "range", min: 0.1, max: 1, step: 0.05, value: S.opacity, oninput: (e) => { S.opacity = +e.target.value; }, onchange: keep })) : null,
        check("align", t("ref_align")), S.align ? h("p", { class: "hint" }, t("ref_alignHelp")) : null,
      ] : []),
      check("guides", t("ref_guides")),
      h("p", { class: "hint" }, t("ref_front")),
      S.url ? h("button", { class: "btn small ghost", type: "button", onclick: () => { URL.revokeObjectURL(S.url); S.url = null; S.blob = null; img.removeAttribute("src"); save(); render(); } }, t("ref_remove")) : null,
    ].filter(Boolean));
  }
  function toggle(on = !open) { open = on; if (on) S.on = true; else S.align = false; render(); onChange(); }
  addEventListener("pointerdown", (e) => { if (open && !e.target.closest(".refPanel, .ref-handle, #display")) toggle(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && open) toggle(false); });
  return { toggle, load, get open() { return open; }, get shown() { return !!S.url || (!!S.on && S.guides); }, setPicture, remeasure: () => { measured = null; } };
}
