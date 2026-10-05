// Hinagata Editor: wires the recipe (store.js), the 3D view (viewport.js) and the inspector (panel.js) to the engine.
// A change the engine can apply at once goes through its method (schema `apply`); anything else rebuilds the avatar
// when the gesture ends (the engine's cache makes a repeat build fast).
import { createAvatar, POSES, SCHEMA, checkOptions, faceSheet, readFaceSheet, sheetChanges } from "../../src/index.js";
import { createStore, loadLibrary, saveLibrary, addChar, recipeOf, compact } from "./store.js";
import { createViewport, VIEW_NAMES, BACKGROUNDS } from "./viewport.js";
import { createPanel } from "./panel.js";
import { createBangTool } from "./bangs.js";
import { createDrawTool } from "./draw.js";
import { createBackTool } from "./backs.js";
import { t, setLang, getLang, translatePage, poseName } from "./i18n.js";

const VERSION = "0.1";
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); } for (const c of kids.flat()) if (c != null) el.append(c); return el; };
let toastT = 0;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
function download(name, blob) { const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const fileName = (s) => (s || "character").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);

// ── view preferences (per browser) ──
const PREF_KEY = "hinagata.editor.prefs";
// quality: the editor builds "high" by default (it is the tool you look closely in; games pass their own quality).
//   A saved quality counts only if it was picked with the buttons (qualityPicked): "game" was the default until
//   2026-10-04 and savePrefs stored it with the other prefs, so a stored "game" alone says nothing about a choice.
const prefs = { bg: "warm", quality: "high", floor: true };
try { const saved = JSON.parse(localStorage.getItem(PREF_KEY)) || {}; if (!saved.qualityPicked) delete saved.quality; Object.assign(prefs, saved); } catch {}
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} };

// ── characters ──
const lib = loadLibrary();
const shared = new URLSearchParams(location.search).get("o");
if (shared) { try { addChar(lib, t("shared"), recipeOf(JSON.parse(shared))); } catch { /* a broken link opens the last character */ } history.replaceState(null, "", location.pathname); }
if (!lib.chars.length) addChar(lib, t("untitled"), recipeOf({}));
let cur = lib.chars.find((c) => c.id === lib.current) ?? lib.chars[0]; lib.current = cur.id;
const store = createStore(recipeOf(cur.recipe));
function persist() {
  cur.recipe = compact(store.recipe); cur.updated = Date.now();
  const ok = saveLibrary(lib); $("saved").textContent = ok ? t("savedHere") : t("notSaved"); $("saved").style.color = ok ? "" : "var(--warn)";
}

// ── 3D view and building ──
const vp = createViewport($("gl"), $("stage"));
let building = false, again = false;
async function rebuild() {
  if (building) { again = true; return; }
  building = true; if (vp.avatar) $("busy").hidden = false;
  try {
    do {
      again = false;
      const t0 = performance.now(), av = await createAvatar(structuredClone(store.recipe), { quality: prefs.quality });
      av.play(vp.motion.pose); vp.setAvatar(av); bangs.attach(av); draw.attach(av); backs.attach(av); showStats(av, Math.round(performance.now() - t0));
    } while (again);
  } catch (e) { console.error(e); toast(String(e?.message ?? e)); }
  building = false; $("busy").hidden = true; $("cover").hidden = true;
}
let lastMs = 0;
function showStats(av, ms = lastMs) {
  lastMs = ms; const verts = Object.values(av.parts).reduce((s, x) => s + x.m.geometry.attributes.position.count, 0);
  $("stats").replaceChildren(...t("stats", verts, av.internals.BONES.length, ms).map((s) => h("span", {}, s)));
}

// instant changes through the engine's own methods (schema `apply`)
const COLOR_KEY = { "colors.skin": "skin", "colors.hair": "hair", "colors.eyes": "eyes", "outfit.shirt.color": "shirt", "outfit.pants.color": "pants", "outfit.dress.color": "dress", "outfit.cape.color": "cape", "outfit.socks.color": "socks", "outfit.shoes.color": "shoes", "outfit.shoes.soleColor": "soles", "outfit.armor.color": "armor", "outfit.weapon.color": "weapon", "outfit.weapon.gripColor": "grip", "outfit.weapon.shieldColor": "shield" };
let locksT = 0;
function applyInstant(av, p, v) {
  const k = p.split("."), last = k.at(-1);
  switch (SCHEMA[p]?.apply) {
    case "setColors": av.setColors({ [COLOR_KEY[p]]: v }); return true;
    case "setOutline": av.setOutline({ [last]: v }); return true;
    case "setShading": av.setShading({ [last]: v }); return true;
    case "setWorn": av.setWorn({ [k[1]]: v }); return true;
    case "setFace": av.setFace({ [last]: v ?? (store.get("face.noseShadow.on") ? "shadow" : "none") }); return true;   // nose null = follow the nose shadow
    case "setFaceLayout": av.setFaceLayout({ [last]: v }); return true;
    case "setBlush": av.setBlush({ [k[2]]: { [last]: v } }); return true;
    case "setHair": av.setHair({ [last]: v }); return true;
    case "setBangs": av.setBangs({ [last]: structuredClone(v) }); return true;
    case "setTails": av.setTails(k[2] === "tie" ? { tie: { [last]: v } } : { [last]: v }); return true;
    case "setDrawn": av.setDrawnHair(structuredClone(v)); return true;
    case "setLocks": {   // hair.sculpt.<group>[.lie].<key>. Rebuilding the locks takes up to ~0.7 s (long hair is draped), so while a slider moves they are rebuilt once it rests
      const ch = k.length > 4 ? { [k[3]]: { [last]: v } } : { [last]: v }; clearTimeout(locksT); locksT = setTimeout(() => { try { av.setLocks(k[2], ch); vp.apply(); backs.refresh(); } catch (e) { console.warn(e); } }, 150); return true; }
  }
  return false;
}
const needsBuild = (p) => !SCHEMA[p]?.apply || !!SCHEMA[p]?.alsoShapes;

store.subscribe((paths, why) => {
  const av = vp.avatar;
  if (why === "set" || why === "undo" || why === "redo" || why === "replace") {   // instant values right away (a gesture's commit doesn't repeat them)
    if (av) { vp.lift(); for (const p of paths) if (SCHEMA[p]?.apply) { try { applyInstant(av, p, store.get(p)); } catch (e) { console.warn(e); } } vp.apply(); }
  }
  if (why !== "set" && paths.some(needsBuild)) rebuild();   // shapes rebuild when the gesture ends (slider released)
  if (why !== "set" && paths.some((p) => p.startsWith("hair."))) { bangs.refresh(); if (paths.some((p) => !p.endsWith(".edits"))) setTimeout(() => backs.refresh(), 0); }   // the tufts' dots follow the hair
  if (why === "set") { panel.renderFoot(); return; }
  panel.render(); persist(); syncUndo();
});

// ── inspector ──
const bangs = createBangTool({ vp, store, onSelect: () => panel.render() });   // moving the bangs' tufts on the face (bangs.js)
const draw = createDrawTool({ vp, store, onChange: () => panel.render() });   // drawing locks of hair on the character (draw.js)
const backs = createBackTool({ vp, store, onSelect: () => panel.render() });   // moving the back hair's locks one by one (backs.js)
// my hairstyles: the whole hair (style, shapes, tufts, drawn locks; not its color) saved by name in this browser, to put on any character
const HAIRS_KEY = "hinagata.editor.hairs";
const hairs = {
  list() { try { const L = JSON.parse(localStorage.getItem(HAIRS_KEY)); return Array.isArray(L) ? L : []; } catch { return []; } },
  write(L) { try { localStorage.setItem(HAIRS_KEY, JSON.stringify(L)); return true; } catch { toast(t("notSaved")); return false; } },
  save(name) { const L = hairs.list(); L.push({ id: Date.now().toString(36), name: name || t("myHairN", L.length + 1), hair: structuredClone(store.recipe.hair) }); if (hairs.write(L)) toast(t("myHairSaved", L.at(-1).name)); panel.render(); },
  apply(id) { const h = hairs.list().find((x) => x.id === id); if (!h) return; const ch = {};
    for (const p of Object.keys(SCHEMA)) if (p.startsWith("hair.")) { const v = p.split(".").slice(1).reduce((o, k) => o?.[k], h.hair); if (v !== undefined) ch[p] = structuredClone(v); }
    store.set(ch, { commit: true }); },
  remove(id) { const h = hairs.list().find((x) => x.id === id); if (!h || !confirm(t("myHairDel", h.name))) return; hairs.write(hairs.list().filter((x) => x.id !== id)); panel.render(); },
};
let imagePath = null;
const panel = createPanel({ tabsEl: $("tabs"), panelEl: $("panel"), footEl: $("diffCount"), resetEl: $("resetTab") }, {
  store, quality: () => prefs.quality,
  onQuality: (q) => { if (prefs.quality === q) return; prefs.quality = q; prefs.qualityPicked = true; savePrefs(); panel.render(); rebuild(); },
  onImage: (path) => { imagePath = path; $("fileImg").click(); },
  onTemplate: (kind) => showTemplate(kind),
  onReadTemplate: (into = null) => { tplInto = into === "new" ? NEW : into; $("fileTpl").click(); },
  bangs, draw, hairs, backs,
});
// the template on screen (as the test page shows it): look at it, save it (a phone saves by a long press), or go straight to loading a drawn one
let tplUrl = null, tplInto = null;   // tplInto: the drawn expression a template is read into (null = ふつう, NEW = a new one)
const NEW = Symbol("new");
function showTemplate(kind) {
  if (!vp.avatar) return;
  faceSheet(vp.avatar, { kind, lang: getLang() }).toBlob((b) => {
    if (tplUrl) URL.revokeObjectURL(tplUrl); tplUrl = URL.createObjectURL(b);
    $("tplTitle").textContent = t(kind === "sheet" ? "tplSheet" : "tplMake"); $("tplText").textContent = t(kind === "sheet" ? "tplSheetText" : "tplPartsText");
    $("tplImg").src = tplUrl; $("tplSave").href = tplUrl; $("tplSave").download = kind === "sheet" ? "hinagata-face-sheet.png" : "hinagata-face-template.png";
    $("tplModal").hidden = false; $("tplClose").focus();
  }, "image/png");
}
const closeTpl = () => { $("tplModal").hidden = true; };
$("tplClose").addEventListener("click", closeTpl);
$("tplModal").addEventListener("click", (e) => { if (e.target === $("tplModal")) closeTpl(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("tplModal").hidden) closeTpl(); });
// a drawn template: only the frames with something in them are read; the face then shows the drawn parts (unless it already does)
$("fileTpl").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !vp.avatar) return;
  const im = new Image(); im.onload = () => {
    const list = (store.get("face.drawn") ?? []).filter((d) => d && d.id != null), fresh = tplInto === NEW;   // NEW: the drawing becomes a new expression
    let into = tplInto;
    if (fresh) { const ids = new Set(list.map((d) => String(d.id))); let n = list.length + 1; do into = `e${n++}`; while (ids.has(into)); }
    let r; try { r = readFaceSheet(vp.avatar, im, { into }); } catch (err) { toast(t(err.code === "count" ? "tplCount" : "tplBad")); return; } finally { URL.revokeObjectURL(im.src); }
    if (!r.read.length) { toast(t("tplRead0")); return; }
    let ch;
    if (fresh) {   // named "新しい表情" (2, 3 … if taken); renamed in its row
      const names = new Set(list.map((d) => d.name)); let name = t("newExprName"), k = 2; while (names.has(name)) name = `${t("newExprName")}${k++}`;
      ch = { "face.drawn": [...list, { id: into, name, eye: null, brow: null, mouth: null, ...r.drawn[into], cheeks: "none", blink: true }] };
    } else ch = sheetChanges(store.recipe, r);
    const id = into != null ? `image@${into}` : "image";   // show what was just read
    Object.assign(ch, { "face.parts.eyes": id, "face.parts.brows": id, "face.parts.mouth": id });
    if (into != null) ch["face.parts.cheeks"] = fresh ? "none" : list.find((d) => String(d.id) === String(into))?.cheeks ?? "none";
    store.set(ch, { commit: true }); toast(fresh ? t("tplNewExpr", ch["face.drawn"].at(-1).name) : t("tplReadN", r.read.length));
  };
  im.onerror = () => toast(t("tplBad")); im.src = URL.createObjectURL(f);
});
const IMAGE_SLOT = { eye: "eyes", brow: "brows", mouth: "mouth", nose: "nose" };
$("fileImg").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !imagePath) return;
  const r = new FileReader(); r.onload = () => { const slot = IMAGE_SLOT[imagePath.split(".")[2]]; store.set({ [imagePath]: r.result, ...(slot ? { [`face.parts.${slot}`]: "image" } : {}) }, { commit: true }); };   // a loaded picture is also put on the face
  r.readAsDataURL(f);
});

// ── viewport controls ──
const ICON = {
  clay: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle></svg>',
  wire: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M4 12h16M12 4v16M4 4l16 16"></path></svg>',
  bones: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="7" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle><path d="M12 7v6l-5 6M12 13l5 6"></path></svg>',
  floor: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="16" rx="9" ry="3.5"></ellipse></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"></path></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"></path></svg>',
};
let curView = "free";
function renderViewControls() {
  $("views").replaceChildren(...VIEW_NAMES.map((v) => h("button", { type: "button", "aria-pressed": String(v === curView), onclick: () => { curView = v; vp.view(v); renderViewControls(); } }, t(`v_${v}`))));
  const D = vp.displayState;
  $("display").replaceChildren(...["clay", "wire", "bones", "floor"].map((k) => h("button", { class: "ico", type: "button", "aria-pressed": String(D[k]), "aria-label": t(`d_${k}`), title: t(`d_${k}`), html: ICON[k],
    onclick: () => { vp.display(k, !D[k]); if (k === "floor") { prefs.floor = !D[k]; savePrefs(); } renderViewControls(); } })));
  $("bg").replaceChildren(...Object.keys(BACKGROUNDS).map((k) => h("option", { value: k, selected: k === prefs.bg }, t(`bg_${k}`))));
  const M = vp.motion;
  $("poses").replaceChildren(
    h("button", { class: "play", type: "button", "aria-label": M.playing ? t("pause") : t("play"), title: M.playing ? t("pause") : t("play"), html: M.playing ? ICON.pause : ICON.play, onclick: () => { M.playing = !M.playing; renderViewControls(); } }),
    ...Object.keys(POSES).map((k) => h("button", { type: "button", "aria-pressed": String(k === M.pose), onclick: () => { M.pose = k; vp.avatar?.play(k); renderViewControls(); } }, poseName(k))),
    h("select", { "aria-label": t("speed"), title: t("speed"), onchange: (e) => { M.speed = +e.target.value; } }, [0.25, 0.5, 1, 1.5].map((s) => h("option", { value: s, selected: s === M.speed }, `${s}×`))));
}
$("bg").addEventListener("change", (e) => { prefs.bg = e.target.value; savePrefs(); vp.background(prefs.bg); });
vp.background(prefs.bg); if (!prefs.floor) vp.display("floor", false);

// ── header: name, undo, language, library ──
$("ver").textContent = `v${VERSION}`;
$("name").addEventListener("change", () => { cur.name = $("name").value.trim() || t("untitled"); $("name").value = cur.name; persist(); renderLibrary(); });
function syncUndo() { $("undo").disabled = !store.canUndo; $("redo").disabled = !store.canRedo; }
$("undo").addEventListener("click", () => store.undo());
$("redo").addEventListener("click", () => store.redo());
addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.target.closest?.("input:not([type=range]), textarea, select")) return;   // text fields keep their own undo
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); store.undo(); }
  else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); store.redo(); }
});
function renderLang() { for (const b of $("lang").children) b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())); }
$("lang").addEventListener("click", (e) => { const l = e.target.closest("button")?.dataset.lang; if (!l || l === getLang()) return; setLang(l); translatePage(); renderLang(); renderViewControls(); panel.render(); renderLibrary(); persist(); if (vp.avatar) showStats(vp.avatar); });

function switchTo(c) {
  store.commit(); persist();
  cur = c; lib.current = c.id; $("name").value = c.name;
  store.replace(recipeOf(c.recipe)); syncUndo(); renderLibrary();
}
const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t("justNow") : m < 60 ? t("minAgo", m) : m < 60 * 24 ? t("hAgo", Math.round(m / 60)) : new Date(ms).toLocaleDateString(getLang()); };
function renderLibrary() {
  $("lib").replaceChildren(...lib.chars.map((c) => h("button", { class: "lib-item", type: "button", "aria-current": String(c.id === cur.id), onclick: () => { if (c.id !== cur.id) switchTo(c); } },
    h("span", { class: "meta" }, h("b", {}, c.name), h("small", {}, t("edited", ago(c.updated)))))));
}
const drawer = (on) => { $("drawer").hidden = $("scrim").hidden = !on; if (on) { renderLibrary(); $("libClose").focus(); } else $("libBtn").focus(); };
$("libBtn").addEventListener("click", () => drawer(true));
$("libClose").addEventListener("click", () => drawer(false));
$("scrim").addEventListener("click", () => drawer(false));
addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("drawer").hidden) drawer(false); menu(false); } });
$("libNew").addEventListener("click", () => { store.commit(); persist(); switchTo(addChar(lib, t("untitled"), recipeOf({}))); });
$("libDup").addEventListener("click", () => { store.commit(); persist(); switchTo(addChar(lib, t("copyOf", cur.name), store.recipe)); });
$("libDel").addEventListener("click", () => {
  if (!confirm(t("confirmDelete", cur.name))) return;
  lib.chars = lib.chars.filter((c) => c.id !== cur.id);
  if (!lib.chars.length) addChar(lib, t("untitled"), recipeOf({}));
  cur = lib.chars[0]; lib.current = cur.id; $("name").value = cur.name; store.replace(recipeOf(cur.recipe)); syncUndo(); renderLibrary();
});

// ── export ──
function menu(on) { $("exportMenu").hidden = !on; $("exportBtn").setAttribute("aria-expanded", String(on)); if (on) $("exportMenu").querySelector("button").focus(); }
$("exportBtn").addEventListener("click", (e) => { e.stopPropagation(); menu($("exportMenu").hidden); });
addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) menu(false); });
$("copyCode").addEventListener("click", async () => {
  const code = `import { createAvatar } from "./src/index.js";\n\nconst avatar = await createAvatar(${JSON.stringify(compact(store.recipe), null, 2)});\nscene.add(avatar.object);\n`;
  try { await navigator.clipboard.writeText(code); toast(t("copied")); } catch { download(`${fileName(cur.name)}.js`, new Blob([code], { type: "text/javascript" })); }
});
$("exportMenu").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.ex; if (!k) return; menu(false);
  exportAs(k).catch((err) => { console.error(err); toast(String(err?.message ?? err)); });
});
async function exportAs(k) {
  if (k === "json") download(`${fileName(cur.name)}.hinagata.json`, new Blob([JSON.stringify({ hinagata: 1, name: cur.name, options: compact(store.recipe) }, null, 2)], { type: "application/json" }));
  if (k === "import") $("fileJson").click();
  if (k === "link") {
    const o = compact(store.recipe); let dropped = false;
    for (const im of Object.values(o.face?.images ?? {})) if (im?.src) { delete im.src; dropped = true; }
    for (const d of o.face?.drawn ?? []) for (const k of ["eye", "brow", "mouth"]) if (d?.[k]) { d[k] = null; dropped = true; }   // pictures don't fit in a link
    const url = `${location.origin}${location.pathname}?o=${encodeURIComponent(JSON.stringify(o))}`;
    try { await navigator.clipboard.writeText(url); toast(dropped ? t("linkNoImages") : t("linkCopied")); } catch { prompt(t("exLink"), url); }
  }
  if (k === "png") download(`${fileName(cur.name)}.png`, await vp.snapshot());
  if (k === "glb" && vp.avatar) download(`${fileName(cur.name)}.glb`, new Blob([await vp.avatar.exportGLB()], { type: "model/gltf-binary" }));
}
$("fileJson").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  f.text().then((txt) => {
    const j = JSON.parse(txt), o = j && typeof j === "object" ? (j.options ?? j) : null;
    if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("not an object");
    const bad = checkOptions(o); if (bad.length) console.warn("Imported recipe has problems:", bad);
    const name = (typeof j.name === "string" && j.name) || f.name.replace(/(\.hinagata)?\.json$/i, "");
    store.commit(); persist(); switchTo(addChar(lib, name, recipeOf(o))); toast(t("imported", name));
  }).catch(() => toast(t("badJson")));
});
addEventListener("pagehide", () => { store.commit(); persist(); });

// ── start ──
translatePage(); renderLang(); renderViewControls();
$("name").value = cur.name; syncUndo(); panel.render(); persist();
await rebuild();
globalThis.hinagataEditor = { store, vp, lib };   // for checking from the console
