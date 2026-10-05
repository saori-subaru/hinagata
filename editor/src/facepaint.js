// Drawing the face parts in the app (2026-10-05, Saori: "テンプレをダウンロードできるけど、アプリ上でも描けたら便利"). The same template
// as the download ("parts": the head from the front with a red frame per part) lies under a clear drawing layer; the layer starts with what
// the parts are now (each picture in its frame), so drawing adds to them or redraws them. "Apply" hands the drawing layer alone (clear
// background) to the same reading as a loaded template (applyTemplate in app.js): every frame with something in it becomes that part.
// The part buttons zoom onto their frame (a phone draws an eye at a usable size).
import { faceSheet, sheetLayout } from "../../src/index.js";

const PARTS = ["eye", "eyeClosed", "brow", "mouth", "nose"];

/** getAvatar(): the shown avatar / store: the recipe / apply(canvas, into) → the expression id it went into / t: the strings / h: the DOM helper */
export function createFacePainter({ getAvatar, store, apply, t, h, lang = () => "ja" }) {
  let into = null, W = 1024, H = 768, zoom = null, undo = [], drawing = null;
  const S = { color: "#2b2230", size: 6, erase: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem("hinagata.editor.facepaint")) ?? {}); } catch {}
  const save = () => { try { localStorage.setItem("hinagata.editor.facepaint", JSON.stringify(S)); } catch {} };

  const bg = h("canvas", { class: "fp-bg" }), ink = h("canvas", { class: "fp-ink" }), inner = h("div", { class: "fp-inner" }, bg, ink), stage = h("div", { class: "fp-stage" }, inner);
  const title = h("b", {}), bar = h("div", { class: "chips fp-bar" }), zooms = h("div", { class: "chips fp-zoom" }), help = h("p", {}), shut = h("button", { class: "btn small ghost", type: "button", onclick: () => close() });
  const modal = h("div", { class: "tpl fp", hidden: true, role: "dialog", "aria-modal": "true" }, h("div", { class: "tpl-in" }, h("div", { class: "tpl-h" }, title, shut), help, zooms, stage, bar));
  document.body.append(modal);
  const g = ink.getContext("2d", { willReadFrequently: true });   // (undo reads it back)

  function layout() { return sheetLayout(getAvatar(), { kind: "parts" }); }
  function setZoom(k) {   // CSS zoom onto a frame (the canvas keeps its pixels; pointer positions are read through the transform)
    zoom = k; const r = k && layout().find((f) => f.frame === k);
    if (!r) inner.style.transform = "";
    else { const pad = 1.25, s = Math.min(W / (r.w * pad), H / (r.h * pad)), cx = (r.x + r.w / 2) / W, cy = (r.y + r.h / 2) / H;
      inner.style.transformOrigin = "0 0"; inner.style.transform = `scale(${s}) translate(${(0.5 / s - cx) * 100}%, ${(0.5 / s - cy) * 100}%)`; }
    renderBars();
  }
  function renderBars() {
    zooms.replaceChildren(...[null, ...PARTS].map((k) => h("button", { class: "chip", type: "button", "aria-pressed": String(zoom === k), onclick: () => setZoom(k) }, k ? t(`f_${k}`) : t("fpAll"))));
    const color = h("input", { type: "color", value: S.color, "aria-label": t("paintColor") }); color.addEventListener("change", () => { S.color = color.value; S.erase = false; save(); renderBars(); });
    const size = h("input", { class: "rng", type: "range", min: 1, max: 40, step: 1, value: S.size, "aria-label": t("fpSize") }); size.addEventListener("change", () => { S.size = +size.value; save(); });
    bar.replaceChildren(color, h("span", { class: "cost" }, t("fpSize")), size,
      h("button", { class: "chip", type: "button", "aria-pressed": String(S.erase), onclick: () => { S.erase = !S.erase; save(); renderBars(); } }, t("paintErase")),
      h("button", { class: "btn small ghost", type: "button", disabled: !undo.length, onclick: () => { const d = undo.pop(); if (d) g.putImageData(d, 0, 0); renderBars(); } }, t("fpUndo")),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { push(); g.clearRect(0, 0, W, H); renderBars(); } }, t("fpClear")),
      h("button", { class: "btn small", type: "button", onclick: () => { const r = apply(ink, into); if (r !== undefined) into = r; } }, t("fpApply")));
  }
  const push = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 30) undo.shift(); };

  // the parts as they are now, each in its frame (the closed eye is drawn on the other eye: mirrored back)
  function prefill(av) {
    const O = av.options.face, d = into != null ? (O.drawn ?? []).find((q) => String(q?.id) === String(into)) : null;
    const src = (k) => d ? (["eye", "brow", "mouth"].includes(k) ? d[k] : null) : O.images[k]?.src;
    return Promise.all(layout().map((f) => new Promise((ok) => { const s = src(f.frame); if (!s) return ok(); const im = new Image();
      im.onload = () => { g.save(); if (f.frame === "eyeClosed") { g.translate(f.x + f.w, f.y); g.scale(-1, 1); g.drawImage(im, 0, 0, f.w, f.h); } else g.drawImage(im, f.x, f.y, f.w, f.h); g.restore(); ok(); };
      im.onerror = () => ok(); im.src = s; })));
  }

  // pen: smooth round strokes (a pen's pressure widens them); the eraser clears
  const at = (e) => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const width = (e) => S.size * (e.pointerType === "pen" && e.pressure > 0 ? 0.4 + e.pressure * 1.2 : 1);
  ink.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; ink.setPointerCapture(e.pointerId); push(); const p = at(e); drawing = { last: p, mid: p };
    g.save(); g.globalCompositeOperation = S.erase ? "destination-out" : "source-over"; g.fillStyle = S.color; g.beginPath(); g.arc(p[0], p[1], width(e) / 2, 0, Math.PI * 2); g.fill(); g.restore(); e.preventDefault(); });
  ink.addEventListener("pointermove", (e) => { if (!drawing) return; const p = at(e), m = [(drawing.last[0] + p[0]) / 2, (drawing.last[1] + p[1]) / 2];
    g.save(); g.globalCompositeOperation = S.erase ? "destination-out" : "source-over"; g.strokeStyle = S.color; g.lineCap = g.lineJoin = "round"; g.lineWidth = width(e);
    g.beginPath(); g.moveTo(...drawing.mid); g.quadraticCurveTo(...drawing.last, ...m); g.stroke(); g.restore(); drawing.last = p; drawing.mid = m; });
  const end = () => { if (!drawing) return; drawing = null; renderBars(); };
  ink.addEventListener("pointerup", end); ink.addEventListener("pointercancel", end);

  function close() { modal.hidden = true; }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

  return {
    /** open on ふつう (null), a drawn expression (its id) or a new expression ("new") */
    async open(target = null) {
      const av = getAvatar(); if (!av) return;
      into = target === "new" ? apply.NEW : target; undo = []; zoom = null; inner.style.transform = "";
      const tpl = faceSheet(av, { kind: "parts", lang: lang() }); W = tpl.width; H = tpl.height;
      for (const c of [bg, ink]) { c.width = W; c.height = H; }
      bg.getContext("2d").drawImage(tpl, 0, 0); g.clearRect(0, 0, W, H);
      const d = into != null && into !== apply.NEW ? (av.options.face.drawn ?? []).find((q) => String(q?.id) === String(into)) : null;
      title.textContent = target === "new" ? t("fpTitleNew") : into == null ? t("fpTitle", t("normalPic")) : t("fpTitle", d?.name ?? String(into));
      if (target !== "new") await prefill(av);
      help.textContent = t("fpHelp"); shut.textContent = t("close");   // (in the language chosen now)
      renderBars(); modal.hidden = false;
    },
  };
}
