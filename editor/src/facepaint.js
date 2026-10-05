// Drawing the face parts in the app (2026-10-05, Saori: "テンプレをダウンロードできるけど、アプリ上でも描けたら便利"). The same template
// as the download ("parts": the head from the front with a red frame per part) lies under a clear drawing layer; the layer starts with what
// the parts are now (each picture in its frame), so drawing adds to them or redraws them. "Apply" hands the drawing layer alone (clear
// background) to the same reading as a loaded template (applyTemplate in app.js): every frame with something in it becomes that part.
// The part buttons zoom onto their frame (a phone draws an eye at a usable size).
// Tools (2026-10-05, Saori: "下のサンプル絵があると描きづらいから表示非表示、バケツツールとかパスみたいな最低限のお絵描きツール"):
//   pen, eraser, bucket (fills the touched area of the drawing layer, inside the frame it is in), path (click points: a smooth line through
//   them; clicking the first point closes it, filled if "fill" is on; double-click / Enter ends it, Backspace takes the last point back,
//   Esc drops it) and eyedropper. "下絵" shows or hides the template under the drawing (the frames stay, drawn on top).
import { faceSheet, sheetLayout } from "../../src/index.js";

const PARTS = ["eye", "eyeClosed", "brow", "mouth", "nose"];
const TOOLS = ["pen", "eraser", "fill", "path", "pick"];

/** getAvatar(): the shown avatar / store: the recipe / apply(canvas, into) → the expression id it went into / t: the strings / h: the DOM helper */
export function createFacePainter({ getAvatar, store, apply, t, h, lang = () => "ja" }) {
  let into = null, W = 1024, H = 768, zoom = null, undo = [], drawing = null, path = null, frames = [];
  const S = { color: "#2b2230", size: 6, tool: "pen", guide: true, pathFill: false };
  try { const saved = JSON.parse(localStorage.getItem("hinagata.editor.facepaint")) ?? {}; if (saved.erase) saved.tool = "eraser"; delete saved.erase; Object.assign(S, saved); } catch {}
  if (!TOOLS.includes(S.tool)) S.tool = "pen";
  const save = () => { try { localStorage.setItem("hinagata.editor.facepaint", JSON.stringify(S)); } catch {} };

  const bg = h("canvas", { class: "fp-bg" }), ink = h("canvas", { class: "fp-ink" }), ui = h("canvas", { class: "fp-ui" }), inner = h("div", { class: "fp-inner" }, bg, ink, ui), stage = h("div", { class: "fp-stage" }, inner);
  const title = h("b", {}), bar = h("div", { class: "chips fp-bar" }), tools = h("div", { class: "chips fp-tools" }), zooms = h("div", { class: "chips fp-zoom" }), help = h("p", {}), shut = h("button", { class: "btn small ghost", type: "button", onclick: () => close() });
  const modal = h("div", { class: "tpl fp", hidden: true, role: "dialog", "aria-modal": "true" }, h("div", { class: "tpl-in" }, h("div", { class: "tpl-h" }, title, shut), help, zooms, tools, stage, bar));
  document.body.append(modal);
  const g = ink.getContext("2d", { willReadFrequently: true }), gu = ui.getContext("2d");   // (undo and the bucket read the drawing back)

  function layout() { return sheetLayout(getAvatar(), { kind: "parts" }); }
  function setZoom(k) {   // CSS zoom onto a frame (the canvas keeps its pixels; pointer positions are read through the transform)
    zoom = k; const r = k && frames.find((f) => f.frame === k);
    if (!r) inner.style.transform = "";
    else { const pad = 1.25, s = Math.min(W / (r.w * pad), H / (r.h * pad)), cx = (r.x + r.w / 2) / W, cy = (r.y + r.h / 2) / H;
      inner.style.transformOrigin = "0 0"; inner.style.transform = `scale(${s}) translate(${(0.5 / s - cx) * 100}%, ${(0.5 / s - cy) * 100}%)`; }
    renderBars();
  }
  const chip = (label, on, onclick, title) => h("button", { class: "chip", type: "button", "aria-pressed": String(!!on), title, onclick }, label);
  function renderBars() {
    zooms.replaceChildren(...[null, ...PARTS].map((k) => chip(k ? t(`f_${k}`) : t("fpAll"), zoom === k, () => setZoom(k))));
    tools.replaceChildren(...[...TOOLS.map((k) => chip(t(`fpTool_${k}`), S.tool === k, () => { endPath(false); S.tool = k; save(); renderBars(); drawUI(); })),
      chip(t("fpGuide"), S.guide, () => { S.guide = !S.guide; save(); bg.hidden = !S.guide; renderBars(); drawUI(); }, t("fpGuideTitle")),
      S.tool === "path" ? chip(t("fpPathFill"), S.pathFill, () => { S.pathFill = !S.pathFill; save(); renderBars(); drawUI(); }) : null,
      S.tool === "path" && path?.pts.length ? h("button", { class: "btn small", type: "button", onclick: () => endPath(true) }, t("fpPathDone")) : null,
      S.tool === "path" && path?.pts.length ? h("button", { class: "btn small ghost", type: "button", onclick: () => endPath(false) }, t("fpPathCancel")) : null].filter(Boolean));   // (replaceChildren would write "null")
    const color = h("input", { type: "color", value: S.color, "aria-label": t("paintColor") }); color.addEventListener("change", () => { S.color = color.value; if (S.tool === "eraser" || S.tool === "pick") S.tool = "pen"; save(); renderBars(); drawUI(); });
    const size = h("input", { class: "rng", type: "range", min: 1, max: 40, step: 1, value: S.size, "aria-label": t("fpSize") }); size.addEventListener("change", () => { S.size = +size.value; save(); drawUI(); });
    bar.replaceChildren(color, h("span", { class: "cost" }, t("fpSize")), size,
      h("button", { class: "btn small ghost", type: "button", disabled: !undo.length, onclick: () => { const d = undo.pop(); if (d) g.putImageData(d, 0, 0); renderBars(); } }, t("fpUndo")),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { push(); g.clearRect(0, 0, W, H); renderBars(); } }, t("fpClear")),
      h("button", { class: "btn small", type: "button", onclick: () => { endPath(true); const r = apply(ink, into); if (r !== undefined) into = r; } }, t("fpApply")));
    help.textContent = S.tool === "path" ? t("fpPathHelp") : S.tool === "fill" ? t("fpFillHelp") : t("fpHelp");
  }
  const push = () => { undo.push(g.getImageData(0, 0, W, H)); if (undo.length > 30) undo.shift(); };

  // the parts as they are now, each in its frame (the closed eye is drawn on the other eye: mirrored back)
  function prefill(av) {
    const O = av.options.face, d = into != null ? (O.drawn ?? []).find((q) => String(q?.id) === String(into)) : null;
    const src = (k) => d ? (["eye", "brow", "mouth"].includes(k) ? d[k] : null) : O.images[k]?.src;
    return Promise.all(frames.map((f) => new Promise((ok) => { const s = src(f.frame); if (!s) return ok(); const im = new Image();
      im.onload = () => { g.save(); if (f.frame === "eyeClosed") { g.translate(f.x + f.w, f.y); g.scale(-1, 1); g.drawImage(im, 0, 0, f.w, f.h); } else g.drawImage(im, f.x, f.y, f.w, f.h); g.restore(); ok(); };
      im.onerror = () => ok(); im.src = s; })));
  }

  // the layer over the drawing: the frames when the template is hidden, and the path being drawn
  function drawUI(hover = null) {
    gu.clearRect(0, 0, W, H);
    if (!S.guide) { gu.save(); gu.strokeStyle = "rgba(220, 40, 40, .8)"; gu.lineWidth = 2; gu.setLineDash([8, 6]); for (const f of frames) gu.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1); gu.restore(); }
    if (path?.pts.length) {
      const P = hover && !path.closed ? [...path.pts, hover] : path.pts;
      gu.save(); curve(gu, P, path.closed); gu.lineCap = gu.lineJoin = "round";
      if (path.closed && S.pathFill) { gu.fillStyle = S.color; gu.globalAlpha = 0.5; gu.fill(); gu.globalAlpha = 1; }
      gu.strokeStyle = S.color; gu.lineWidth = S.size; gu.stroke();
      for (const [i, p] of path.pts.entries()) { gu.beginPath(); gu.arc(p[0], p[1], i === 0 ? 7 : 5, 0, Math.PI * 2); gu.fillStyle = i === 0 ? "#4b4acf" : "#fff"; gu.fill(); gu.strokeStyle = "#4b4acf"; gu.lineWidth = 2; gu.stroke(); }
      gu.restore(); }
  }
  // a smooth line through the points (Catmull-Rom as Béziers); closed: round the end back to the start
  function curve(c, P, closed) {
    c.beginPath(); c.moveTo(...P[0]); const n = P.length; if (n < 2) return;
    const at = (i) => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
    if (closed) c.closePath();
  }
  function endPath(keep) {   // keep: draw it into the drawing (one undo step)
    if (path && keep && path.pts.length >= 2) { push(); g.save(); g.lineCap = g.lineJoin = "round"; curve(g, path.pts, path.closed);
      if (path.closed && S.pathFill) { g.fillStyle = S.color; g.fill(); }
      g.strokeStyle = S.color; g.lineWidth = S.size; g.stroke(); g.restore(); }
    path = null; drawUI(); renderBars();
  }

  // the bucket: the touched pixel's area of the drawing layer (pixels close to it in colour and opacity, touching), kept inside the frame it
  // is in, grown by a pixel so the line's soft edge doesn't show a pale seam
  function fill(x0, y0) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const f = frames.find((r) => x0 >= r.x && x0 < r.x + r.w && y0 >= r.y && y0 < r.y + r.h), bx = f ? Math.max(0, Math.floor(f.x)) : 0, by = f ? Math.max(0, Math.floor(f.y)) : 0, bw = f ? Math.min(W, Math.ceil(f.x + f.w)) - bx : W, bh = f ? Math.min(H, Math.ceil(f.y + f.h)) - by : H;
    const img = g.getImageData(bx, by, bw, bh), D = img.data, sx = x0 - bx, sy = y0 - by, s0 = (sy * bw + sx) * 4, seed = [D[s0], D[s0 + 1], D[s0 + 2], D[s0 + 3]];
    const near = (i) => { const a = D[i + 3], sa = seed[3]; if (sa < 24) return a < 64; return Math.abs(a - sa) < 64 && Math.abs(D[i] - seed[0]) + Math.abs(D[i + 1] - seed[1]) + Math.abs(D[i + 2] - seed[2]) < 96; };   // (a clear seed takes the clear and the nearly clear)
    const M = new Uint8Array(bw * bh), st = [sy * bw + sx]; M[sy * bw + sx] = 1;
    while (st.length) { const p = st.pop(), x = p % bw, y = (p - x) / bw;
      for (const q of [x > 0 ? p - 1 : -1, x < bw - 1 ? p + 1 : -1, y > 0 ? p - bw : -1, y < bh - 1 ? p + bw : -1]) if (q >= 0 && !M[q] && near(q * 4)) { M[q] = 1; st.push(q); } }
    const G = M.slice(); for (let p = 0; p < M.length; p++) if (M[p]) { const x = p % bw; if (x > 0) G[p - 1] = 1; if (x < bw - 1) G[p + 1] = 1; if (p >= bw) G[p - bw] = 1; if (p + bw < M.length) G[p + bw] = 1; }
    const c = parseInt(S.color.slice(1), 16), r = c >> 16, gg = (c >> 8) & 255, b = c & 255;
    push(); for (let p = 0; p < G.length; p++) if (G[p]) { const i = p * 4; D[i] = r; D[i + 1] = gg; D[i + 2] = b; D[i + 3] = 255; }
    g.putImageData(img, bx, by); renderBars();
  }
  function pick(x, y) {   // the drawing's colour there, else the template's
    const px = (c) => c.getContext("2d", { willReadFrequently: true }).getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    let d = px(ink); if (d[3] < 24 && S.guide) d = px(bg); if (d[3] < 24) return;
    S.color = "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""); S.tool = "pen"; save(); renderBars();
  }

  // pen: smooth round strokes (a pen's pressure widens them); the eraser clears
  const at = (e) => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const width = (e) => S.size * (e.pointerType === "pen" && e.pressure > 0 ? 0.4 + e.pressure * 1.2 : 1);
  const scale = () => ink.getBoundingClientRect().width / W;   // screen px per canvas px (a click near the first point closes the path)
  ink.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; const p = at(e); e.preventDefault();
    if (S.tool === "fill") return fill(...p);
    if (S.tool === "pick") return pick(...p);
    if (S.tool === "path") {
      if (!path) path = { pts: [], closed: false };
      const first = path.pts[0];
      if (first && path.pts.length >= 3 && Math.hypot(p[0] - first[0], p[1] - first[1]) * scale() < 12) { path.closed = true; endPath(true); return; }
      path.pts.push(p); drawUI(); renderBars(); return; }
    ink.setPointerCapture(e.pointerId); push(); drawing = { last: p, mid: p };
    g.save(); g.globalCompositeOperation = S.tool === "eraser" ? "destination-out" : "source-over"; g.fillStyle = S.color; g.beginPath(); g.arc(p[0], p[1], width(e) / 2, 0, Math.PI * 2); g.fill(); g.restore(); });
  ink.addEventListener("dblclick", (e) => { if (S.tool === "path" && path) { path.pts.pop(); endPath(true); e.preventDefault(); } });   // (the double click's second click added a point: not part of it)
  ink.addEventListener("pointermove", (e) => {
    if (S.tool === "path" && path) return drawUI(at(e));
    if (!drawing) return; const p = at(e), m = [(drawing.last[0] + p[0]) / 2, (drawing.last[1] + p[1]) / 2];
    g.save(); g.globalCompositeOperation = S.tool === "eraser" ? "destination-out" : "source-over"; g.strokeStyle = S.color; g.lineCap = g.lineJoin = "round"; g.lineWidth = width(e);
    g.beginPath(); g.moveTo(...drawing.mid); g.quadraticCurveTo(...drawing.last, ...m); g.stroke(); g.restore(); drawing.last = p; drawing.mid = m; });
  const end = () => { if (!drawing) return; drawing = null; renderBars(); };
  ink.addEventListener("pointerup", end); ink.addEventListener("pointercancel", end);

  function close() { endPath(false); modal.hidden = true; }
  addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") { if (path) endPath(false); else close(); }
    else if (path && e.key === "Enter") { e.preventDefault(); endPath(true); }
    else if (path && e.key === "Backspace") { e.preventDefault(); path.pts.pop(); if (!path.pts.length) path = null; drawUI(); renderBars(); }
  });

  return {
    /** open on ふつう (null), a drawn expression (its id) or a new expression ("new") */
    async open(target = null) {
      const av = getAvatar(); if (!av) return;
      into = target === "new" ? apply.NEW : target; undo = []; zoom = null; path = null; inner.style.transform = "";
      const tpl = faceSheet(av, { kind: "parts", lang: lang() }); W = tpl.width; H = tpl.height; frames = layout();
      for (const c of [bg, ink, ui]) { c.width = W; c.height = H; }
      bg.getContext("2d").drawImage(tpl, 0, 0); g.clearRect(0, 0, W, H); bg.hidden = !S.guide;
      const d = into != null && into !== apply.NEW ? (av.options.face.drawn ?? []).find((q) => String(q?.id) === String(into)) : null;
      title.textContent = target === "new" ? t("fpTitleNew") : into == null ? t("fpTitle", t("normalPic")) : t("fpTitle", d?.name ?? String(into));
      if (target !== "new") await prefill(av);
      shut.textContent = t("close");   // (in the language chosen now)
      renderBars(); drawUI(); modal.hidden = false;
    },
  };
}
