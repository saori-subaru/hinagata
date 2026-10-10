// Hinagata Editor: wires the recipe (store.js), the 3D view (viewport.js) and the inspector (panel.js) to the engine.
// A change the engine can apply at once goes through its method (schema `apply`); anything else rebuilds the avatar
// when the gesture ends (the engine's cache makes a repeat build fast).
import { createAvatar, POSES, SCHEMA, checkOptions, faceSheet, readFaceSheet, sheetChanges, characterFile, CHARACTERS, RECIPE_VERSION, EXPRESSIONS } from "../../src/index.js";
import { createStore, loadLibrary, saveLibrary, addChar, recipeOf, recipeIn, compact } from "./store.js";
import { createViewport, VIEW_NAMES, BACKGROUNDS } from "./viewport.js";
import { createPanel } from "./panel.js";
import { createBangTool } from "./bangs.js";
import { createDrawTool } from "./draw.js";
import { createBackTool } from "./backs.js";
import { createTieTool } from "./ties.js";
import { createPaintTool } from "./paint.js";
import { createAccessoryTool } from "./accessories.js";
import { createFacePainter } from "./facepaint.js";
import { connectSync } from "./sync.js";
import { t, setLang, getLang, translatePage, poseName, groupName } from "./i18n.js";

const VERSION = "0.1";
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); } for (const c of kids.flat()) if (c != null) el.append(c); return el; };
let toastT = 0;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
function download(name, blob) { const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const fileName = (s) => (s || "character").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);

// ── view preferences (per browser) ──
const PREF_KEY = "hinagata.editor.prefs";
// quality: the editor builds "fine" by default (it is the tool you look closely in; games pass their own quality): a quick "game" build is
//   shown first and the fine one swapped in once the edits rest (2026-10-09, Saori: "五秒は結構ながい" — fine takes about 5 s, "high" was the
//   default until then: 2.7 s but 28 万 triangles, an elf ear's edge in steps).
//   A saved quality counts only if it was picked with the buttons (qualityPicked): "game" was the default until
//   2026-10-04 and savePrefs stored it with the other prefs, so a stored "game" alone says nothing about a choice.
const prefs = { bg: "warm", quality: "fine", floor: true };
try { const saved = JSON.parse(localStorage.getItem(PREF_KEY)) || {}; if (!saved.qualityPicked || saved.qualityAt !== 2) delete saved.quality; Object.assign(prefs, saved); } catch {}   // (qualityAt 2: picked since "fine" changed)
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} };

// ── characters ──
const lib = loadLibrary();
const shared = new URLSearchParams(location.search).get("o"), SYNC = (({ sync, key }) => sync && key ? { port: +sync, key } : null)(Object.fromEntries(new URLSearchParams(location.search)));   // SYNC: live sync with a recipe file (sync.js)
// ?o=: a character file ({ hinagata: 3, name, options }: the links made since 2026-10-06, of their version), or a bare recipe (links made before: the chibi defaults)
if (shared) { try { const s = recipeIn(JSON.parse(shared)); addChar(lib, s.name || t("shared"), s.recipe); } catch { /* a broken link opens the last character */ } history.replaceState(null, "", SYNC ? location.pathname + `?sync=${SYNC.port}&key=${SYNC.key}` : location.pathname); }
if (!lib.chars.length) addChar(lib, t("untitled"), recipeOf({}));
let cur = lib.chars.find((c) => c.id === lib.current) ?? lib.chars[0]; lib.current = cur.id;
const store = createStore(recipeOf(cur.recipe));
function persist() {
  cur.recipe = compact(store.recipe); cur.updated = Date.now();
  const ok = saveLibrary(lib); $("saved").textContent = ok ? t("savedHere") : t("notSaved"); $("saved").style.color = ok ? "" : "var(--warn)";
}

// ── 3D view and building ──
const vp = createViewport($("gl"), $("stage"));
let building = false, again = false, ver = 0, refineT = 0, quick = false, refining = false;   // quick: the avatar shown is the quick build   // ver: counts the recipe's changes (a refined build made from an older one is dropped)
let shownFace = null;   // the expression the face tab is editing, shown instead of the character's own face (panel: ctx.showFace)
const faceParts = () => { const p = store.get("face.parts"); return { eyes: p.eyes, brows: p.brows, mouth: p.mouth, cheeks: p.cheeks }; };
const show = (av, ms) => { av.play(POSES[vp.motion.pose] ? vp.motion.pose : "idle"); if (shownFace) av.setFace(shownFace); vp.setAvatar(av); bangs.attach(av); draw.attach(av); backs.attach(av); ties.attach(av); paint.attach(av); acc.attach(av); showStats(av, ms); };
// "fine": a quick "game" build right away, then the fine one 0.8 s after the last change, in the background; it is shown only if nothing
// changed meanwhile (else it waits for the next rest). A recipe built fine before comes from the cache at once
async function rebuild() {
  clearTimeout(refineT);
  if (building) { again = true; return; }
  building = true; if (vp.avatar) $("busy").hidden = false;
  try {
    do {
      again = false;
      const two = prefs.quality === "fine", t0 = performance.now(), av = await createAvatar(structuredClone(store.recipe), { quality: two ? "game" : prefs.quality, spare: true });
      show(av, Math.round(performance.now() - t0)); quick = two; if (two) refineT = setTimeout(refine, 800);
    } while (again);
  } catch (e) { console.error(e); toast(String(e?.message ?? e)); }
  building = false; $("busy").hidden = true; $("cover").hidden = true;
}
async function refine() {
  if (building) { refineT = setTimeout(refine, 800); return; }
  const v = ver, t0 = performance.now(); let av; refining = true;
  try { av = await createAvatar(structuredClone(store.recipe), { quality: "fine", spare: true }); } catch (e) { console.warn(e); refining = false; return; }
  refining = false;
  if (v !== ver || building || prefs.quality !== "fine") { av.dispose?.(); return; }   // edited meanwhile: the quick build stays (the next rest refines again)
  vp.lift(); show(av, Math.round(performance.now() - t0)); quick = false; vp.apply();
}
let lastMs = 0;
function showStats(av, ms = lastMs) {
  lastMs = ms; const verts = Object.values(av.parts).reduce((s, x) => s + x.m.geometry.attributes.position.count, 0);
  $("stats").replaceChildren(...t("stats", verts, av.internals.BONES.length, ms).map((s) => h("span", {}, s)));
}

// instant changes through the engine's own methods (schema `apply`)
const COLOR_KEY = { "colors.skin": "skin", "colors.hair": "hair", "colors.eyes": "eyes", "outfit.shirt.color": "shirt", "outfit.pants.color": "pants", "outfit.dress.color": "dress", "outfit.cape.color": "cape", "outfit.socks.color": "socks", "outfit.shoes.color": "shoes", "outfit.shoes.soleColor": "soles", "outfit.shoes.laceColor": "laces", "outfit.armor.color": "armor", "outfit.weapon.color": "weapon", "outfit.weapon.gripColor": "grip", "outfit.weapon.shieldColor": "shield", "outfit.weapon.sheathColor": "sheath", "outfit.extras.earColor": "ears", "outfit.extras.earInColor": "earsIn", "outfit.extras.tailColor": "tail", "outfit.extras.wingColor": "wings", "outfit.extras.haloColor": "halo", "outfit.suit.color": "suit", "outfit.suit.accent": "suitAccent" };   // (the garment parts' colors: the schema's colorKey)
let locksT = 0;
function applyInstant(av, p, v) {
  const k = p.split("."), last = k.at(-1);
  switch (SCHEMA[p]?.apply) {
    case "setColors": av.setColors({ [SCHEMA[p].colorKey ?? COLOR_KEY[p]]: v }); return true;
    case "setBands": av.setBands({ [p]: v }); return true;   // the collar's line, the gloves' and boots' cuffs, striped socks
    case "setOutline": av.setOutline({ [last]: v }); return true;
    case "setShading": av.setShading({ [last]: v }); return true;
    case "setRim": av.setRim({ [last]: v }); return true;
    case "setSheath": av.setSheath(v); return true;
    case "setWorn": av.setWorn({ [k[1]]: v }); return true;
    case "setFace": av.setFace({ [last]: v ?? (store.get("face.noseShadow.on") ? "shadow" : "none") }); return true;   // nose null = follow the nose shadow
    case "setFaceLayout": av.setFaceLayout({ [last]: v }); return true;
    case "setBlush": av.setBlush({ [k[2]]: { [last]: v } }); return true;
    case "setHair": av.setHair({ [last]: v }); return true;
    case "setBangs": av.setBangs({ [last]: structuredClone(v) }, k[2]); return true;   // hair.sculpt.<nendo | hime | side>.<key>
    case "setPaint": av.setPaint(k[1], v); return true;
    case "setTexture": av.setTexture(k[1], { [last]: v }); return true;
    case "setGradient": av.setGradient(k[0] === "hair" ? "hair" : k[1], { [last]: v }); return true;
    case "setTails": av.setTails(k[2] === "tie" ? { tie: { [last]: v } } : { [last]: v }); vp.apply(); ties.refresh(); return true;
    case "setDrawn": av.setDrawnHair(structuredClone(v)); return true;
    case "setAccessories": av.setAccessories(structuredClone(v)); return true;
    case "setExpressions": av.setExpressions(structuredClone(v)); return true;
    case "setLocks": {   // hair.sculpt.<group>[.lie].<key>. Rebuilding the locks takes up to ~0.7 s (long hair is draped), so while a slider moves they are rebuilt once it rests
      const ch = k.length > 4 ? { [k[3]]: { [last]: v } } : { [last]: v }; clearTimeout(locksT); locksT = setTimeout(() => { try { av.setLocks(k[2], ch); vp.apply(); backs.refresh(); } catch (e) { console.warn(e); } }, 150); return true; }
  }
  return false;
}
const needsBuild = (p) => !SCHEMA[p]?.apply || !!SCHEMA[p]?.alsoShapes;

store.subscribe((paths, why) => {
  const av = vp.avatar; ver++;
  if (why !== "set" && prefs.quality === "fine" && (quick || refining) && !paths.some(needsBuild)) { clearTimeout(refineT); refineT = setTimeout(refine, 800); }   // an instant change while the quick build shows: the fine one is made from the new recipe (a fine one shown already took it)
  if (why === "set" || why === "undo" || why === "redo" || why === "replace") {   // instant values right away (a gesture's commit doesn't repeat them)
    if (av) { vp.lift(); for (const p of paths) if (SCHEMA[p]?.apply) { try { applyInstant(av, p, store.get(p)); } catch (e) { console.warn(e); } } vp.apply(); }
  }
  if (why !== "set" && paths.some(needsBuild)) rebuild();   // shapes rebuild when the gesture ends (slider released)
  if (why !== "set" && paths.some((p) => p.startsWith("hair."))) { bangs.refresh(); draw.refresh(); setTimeout(() => ties.refresh(), 0); if (paths.some((p) => !p.endsWith(".edits"))) setTimeout(() => backs.refresh(), 0); }   // the tufts' dots follow the hair
  if (why === "set") { panel.renderFoot(); return; }
  panel.render(); persist(); syncUndo();
});

// ── inspector ──
const bangs = createBangTool({ vp, store, onSelect: () => panel.render() });   // moving the bangs' tufts on the face (bangs.js)
const draw = createDrawTool({ vp, store, onChange: () => panel.render() });   // drawing locks of hair on the character (draw.js)
const backs = createBackTool({ vp, store, onSelect: () => panel.render() });
const ties = createTieTool({ vp, store, onChange: () => panel.render() });
const paint = createPaintTool({ vp, store, onChange: () => panel.render() });
const acc = createAccessoryTool({ vp, store, onChange: () => panel.render() });   // putting accessories on the character (accessories.js)   // painting on the character (paint.js)   // moving the tails' ties on the head (ties.js)   // moving the back hair's locks one by one (backs.js)
// my parts (2026-10-06, Saori: "画風統一するならみんな同じの使いそう"): drawn eyes, brows and mouths saved in this browser, to use on any
// character (the expression set's eyes / brows / mouth list them; picked, the drawing is copied into that character: panel.js)
const PARTS_KEY = "hinagata.editor.parts";
const myParts = {
  list() { try { const L = JSON.parse(localStorage.getItem(PARTS_KEY)); return Array.isArray(L) ? L : []; } catch { return []; } },
  write(L) { try { localStorage.setItem(PARTS_KEY, JSON.stringify(L)); return true; } catch { toast(t("notSaved")); return false; } },
  save(d) { const L = myParts.list(), name = d.normal ? t("myPartsNormal", cur.name) : d.name || t("myPartsN", L.length + 1);
    L.push({ id: Date.now().toString(36), name, eye: d.eye ?? null, brow: d.brow ?? null, mouth: d.mouth ?? null, cheeks: d.cheeks ?? "none", blink: d.blink !== false });
    if (myParts.write(L)) toast(t("myPartsSaved", name)); panel.render(); },
  remove(id) { const x = myParts.list().find((q) => q.id === id); if (!x || !confirm(t("myPartsDel", x.name))) return; myParts.write(myParts.list().filter((q) => q.id !== id)); panel.render(); },
};
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
  onQuality: (q) => { if (prefs.quality === q) return; prefs.quality = q; prefs.qualityPicked = true; prefs.qualityAt = 2; savePrefs(); panel.render(); rebuild(); },
  onImage: (path) => { imagePath = path; $("fileImg").click(); },
  onTemplate: (kind) => showTemplate(kind),
  onReadTemplate: (into = null, put = true) => { tplInto = into === "new" ? NEW : into; drawPut = put; $("fileTpl").click(); },
  onFacePaint: (into = null, put = true) => { drawPut = put; facePaint.open(into); },   // drawing the face parts in the app (facepaint.js). put: false = only redraw it (描いた絵の「編集」)
  showFace: (p) => { shownFace = p; const av = vp.avatar; if (!av) return; vp.lift(); av.setFace(p ?? faceParts()); vp.apply(); },   // the expression the face tab edits, on the avatar (null: its own face)
  bangs, draw, hairs, myParts, backs, ties, paint, acc,
});
let syncShown = null;   // the sync's state on screen (redrawn in another language)
// live sync with a recipe file (tools/sync.mjs, sync.js): the file is a character of its own in the library (named after it), switched to
// when the editor connects; its changes come in as undo steps, the ones made here go back into it
if (SYNC) connectSync({ ...SYNC, store,
  onStart: (recipe, file) => { let c = lib.chars.find((x) => x.sync === file); if (!c) { c = addChar(lib, file, recipe); c.sync = file; }   // (recipe: resolved, in today's terms: sync.js)
    c.recipe = compact(recipe); if (c.id === cur.id) { store.replace(recipe); syncUndo(); renderLibrary(); } else switchTo(c); },
  onStatus: (state, file) => { syncShown = { state, file }; showSync(); },
  onRequest: async (cmd, a) => {   // the helper's MCP tools (tools/sync.mjs): a picture of the character, in a pose if asked (then back to the one playing)
    if (cmd !== "screenshot") throw new Error(`unknown request ${cmd}`);
    while (building || !vp.avatar) await new Promise((r) => setTimeout(r, 100));   // (a change just made may still be building)
    const av = vp.avatar, was = vp.motion.pose;
    if (a.pose && !POSES[a.pose]) throw new Error(`unknown pose "${a.pose}"; poses: ${Object.keys(POSES).join(", ")}`);
    if (a.pose) { av.play(a.pose); av.update(0, { t: 1.2, instant: true }); }
    try { return { png: vp.capture({ view: a.view, size: a.size, bg: BACKGROUNDS[prefs.bg]?.[0] ?? "#ebe5dc" }) }; }
    finally { if (a.pose) { av.play(POSES[was] ? was : "idle"); av.update(0, { instant: true }); } }
  } });
function showSync() { if (!syncShown) return; const { state, file } = syncShown, el = $("syncState"); el.hidden = false; el.textContent = state === "on" ? t("syncOn", file) : state === "off" ? t("syncOff", file) : t("syncErr"); el.dataset.state = state; }
// the template on screen (as the test page shows it): look at it, save it (a phone saves by a long press), or go straight to loading a drawn one
let tplUrl = null, tplInto = null, drawPut = true;   // drawPut: what is read also goes onto the expression being edited (false: a drawing redrawn from its own button)   // tplInto: the drawn expression a template is read into (null = ふつう, NEW = a new one)
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
// a drawn template (an image, or the in-app drawing's canvas) into ふつう (into null), a drawn expression (its id) or a new one (NEW).
// Returns the expression id it went into (null = ふつう), or undefined when nothing was read
function applyTemplate(im, into0) {
    if (into0 === "closed") {   // the closed eye, its own entry (drawn in the eye's frame: 2026-10-07, Saori)
      let r; try { r = readFaceSheet(vp.avatar, im, { into: "closed" }); } catch (err) { toast(t("tplBad")); return; }
      if (!r.base.eyeClosed) { toast(t("tplRead0")); return; }
      store.set({ "face.images.eyeClosed.src": r.base.eyeClosed }, { commit: true }); toast(t("closedSet")); return "closed"; }
    const list = (store.get("face.drawn") ?? []).filter((d) => d && d.id != null), fresh = into0 === NEW;   // NEW: the drawing becomes a new expression
    let into = into0;
    if (fresh) { const ids = new Set(list.map((d) => String(d.id))); let n = list.length + 1; do into = `e${n++}`; while (ids.has(into)); }
    let r; try { r = readFaceSheet(vp.avatar, im, { into }); } catch (err) { toast(t(err.code === "count" ? "tplCount" : "tplBad")); return; }
    if (!r.read.length) { toast(t("tplRead0")); return; }
    let ch;
    const n = panel.editExpr ?? "normal";   // the expression the set is editing: what was read goes into it (2026-10-06, Saori: drawing a sad face changed the character's own face)
    if (fresh) {   // named after that expression ("悲しみ"; "新しい表情" for ふつう; 2, 3 … if taken); renamed in its row
      const base = n === "normal" ? t("newExprName") : t(`ex_${n}`), names = new Set(list.map((d) => d.name)); let name = base, k = 2; while (names.has(name)) name = `${base}${k++}`;
      ch = { "face.drawn": [...list, { id: into, name, eye: null, brow: null, mouth: null, ...r.drawn[into], cheeks: "none", blink: true }] };
    } else ch = sheetChanges(store.recipe, r);
    const id = into != null ? `image@${into}` : "image", got = { eyes: id, brows: id, mouth: id, ...(into != null ? { cheeks: fresh ? "none" : list.find((d) => String(d.id) === String(into))?.cheeks ?? "none" } : {}) };
    const ES = ch["face.expressions"] ?? store.get("face.expressions") ?? {};
    if (!drawPut && !fresh) { store.set(ch, { commit: true }); toast(t("tplReadN", r.read.length)); return into; }   // redrawn in place: the expressions using it change with it
    if (n === "normal") { for (const [k, v] of Object.entries(got)) ch[`face.parts.${k}`] = v; if (ES.normal) { const o = { ...ES }; delete o.normal; ch["face.expressions"] = o; } }   // the character's own face (an old ふつう of its own gives way)
    else ch["face.expressions"] = { ...ES, [n]: { ...(ES[n] ?? EXPRESSIONS[n]?.parts ?? {}), ...got } };
    store.set(ch, { commit: true }); toast(fresh ? t("tplNewExpr", ch["face.drawn"].at(-1).name) : t("tplReadN", r.read.length));
    return into;
}
const facePaint = createFacePainter({ getAvatar: () => vp.avatar, store, t, h, lang: getLang, apply: Object.assign((c, into) => applyTemplate(c, into), { NEW }) });
$("fileTpl").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f || !vp.avatar) return;
  const im = new Image(); im.onload = () => { try { applyTemplate(im, tplInto); } finally { URL.revokeObjectURL(im.src); } };
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
  caret: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>',
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
    h("div", { class: "quick" }, QUICK.filter((k) => POSES[k]).map((k) => h("button", { type: "button", "aria-pressed": String(k === M.pose), onclick: () => pickMotion(k) }, poseName(k)))),   // (a narrow screen scrolls these; play and "more" stay)
    h("button", { class: "more", type: "button", "aria-haspopup": "true", "aria-expanded": String(motionOpen), "aria-pressed": String(!QUICK.includes(M.pose)), title: t("pickMotion"),
      onclick: () => { motionOpen = !motionOpen; renderViewControls(); } }, QUICK.includes(M.pose) ? t("moreMotions") : poseName(M.pose), h("span", { html: ICON.caret })),
    h("select", { "aria-label": t("speed"), title: t("speed"), onchange: (e) => { M.speed = +e.target.value; } }, [0.25, 0.5, 1, 1.5].map((s) => h("option", { value: s, selected: s === M.speed }, `${s}×`))));
  const L = $("motionList"); L.hidden = !motionOpen;
  fitAboveBar();
  if (motionOpen) L.replaceChildren(...motionGroups().map(([g, ks]) => h("section", {}, h("h3", {}, groupName(g)),
    h("div", { class: "chips" }, ks.map((k) => h("button", { class: "chip", type: "button", "aria-pressed": String(k === M.pose), onclick: () => pickMotion(k) }, poseName(k)))))));
}
// the motions (2026-10-05, Saori: "下に横並びだと動きが全部入らない" / "中央に動きリスト出すとキャラが隠れるから左端" / "下に歩き走りみたいな基本の
// よく使うポーズは並べておきたい、クイックランチャー的な感じで" / "右端にその他を置くなら窓も右端に" / "選択しても出しっぱなしにして、他のところクリック
// で消える"): the bar under the view has the everyday ones (QUICK) and, at its right end, "more", which opens the whole list at the right
// edge (out of the character's way), in groups. It stays open while motions are picked from it; a press anywhere else closes it. First the ones played through with what they need (a ledge, a
// wall: demos.js); a motion not listed here goes under "other". When the motion playing is from the list, "more" shows its name
const QUICK = ["idle", "walk", "run", "wave", "cheer", "guard", "aPose", "tPose", "sitChair", "sitChairGirl", "sitFloor", "hugKnees"];   // the everyday ones and the poses checked most (a wide screen shows them all; "下が余ってるからもっと出して")
const MOTION_GROUPS = [
  ["demo", null],
  ["basic", ["idle", "walk", "run", "sneak", "wave", "cheer", "banzai", "aPose", "tPose"]],
  ["sit", ["sitChair", "sitChairGirl", "sitFloor", "hugKnees", "sleep"]],
  ["jump", ["jumpCrouch", "jumpRise", "jumpLeap", "jumpAir", "jumpLand", "fall", "hardLand", "stumble", "roll", "knockdown"]],
  ["climb", ["climb", "mantleReach", "mantlePull", "mantleKnee", "climbOver", "vault", "hang", "shimmy", "glide", "balance", "balanceWalk", "slide"]],
  ["low", ["crouch", "crawl", "hide"]],
  ["water", ["swim", "breaststroke", "treadWater", "dive", "wade", "drink"]],
  ["hands", ["pickUp", "carry", "carryWalk", "throw", "push", "chop", "eat", "fireDrill"]],
  ["fight", ["guard", "attack", "hit", "stun", "down", "knockdown", "stab", "attack_sword", "attack_dagger", "attack_axe", "attack_spear", "attack_staff", "attack_greatsword", "attack_punch"]],
  ["state", ["pant", "shiver", "limp", "lookAround", "listen"]],
];
function motionGroups() {
  const seen = new Set(), out = [];
  for (const [g, list] of MOTION_GROUPS) { const ks = g === "demo" ? vp.demos.names : list.filter((k) => POSES[k]); ks.forEach((k) => seen.add(k)); if (ks.length) out.push([g, ks]); }
  const rest = Object.keys(POSES).filter((k) => !seen.has(k)); if (rest.length) out.push(["other", rest]);
  return out;
}
let motionOpen = false;
// the list and the numbers at the bottom left sit just above the bar (on a wide screen the bar takes two rows)
function fitAboveBar() { const b = $("poses").offsetHeight + 22; $("motionList").style.bottom = `${b}px`; $("stats").parentElement.style.bottom = `${b + 4}px`; }
addEventListener("resize", fitAboveBar);
function pickMotion(k) {
  const M = vp.motion, wasDemo = vp.demos.has(M.pose); M.pose = k;   // (the list stays open: picking one after another)
  if (vp.demos.has(k)) vp.demo(k); else { vp.demo(null); vp.avatar?.play(k); if (wasDemo) vp.view(curView); }   // back from a demo: the camera too
  renderViewControls();
}
addEventListener("pointerdown", (e) => { if (motionOpen && !e.target.closest("#motionList, #poses")) { motionOpen = false; renderViewControls(); } });
addEventListener("keydown", (e) => { if (e.key === "Escape" && motionOpen) { motionOpen = false; renderViewControls(); } });
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
$("lang").addEventListener("click", (e) => { const l = e.target.closest("button")?.dataset.lang; if (!l || l === getLang()) return; setLang(l); translatePage(); renderLang(); showSync(); renderViewControls(); panel.render(); renderLibrary(); persist(); if (vp.avatar) showStats(vp.avatar); });

function switchTo(c) {
  store.commit(); persist();
  cur = c; lib.current = c.id; $("name").value = c.name;
  store.replace(recipeOf(c.recipe)); syncUndo(); renderLibrary();
}
const ago = (ms) => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t("justNow") : m < 60 ? t("minAgo", m) : m < 60 * 24 ? t("hAgo", Math.round(m / 60)) : new Date(ms).toLocaleDateString(getLang()); };
function renderLibrary() {
  $("lib").replaceChildren(...lib.chars.map((c) => h("button", { class: "lib-item", type: "button", "aria-current": String(c.id === cur.id), onclick: () => { if (c.id !== cur.id) switchTo(c); } },
    h("span", { class: "meta" }, h("b", {}, c.name), h("small", {}, t("edited", ago(c.updated)))))));
  // プリセット（src/presets.js）：押すと、そのキャラの写しが一覧に増える
  const L = (x) => x[getLang()] ?? x.ja;
  $("libPresets").replaceChildren(h("div", { class: "lib-presets-h" }, t("fromPreset")), ...Object.values(CHARACTERS).map((p) => h("button", { class: "chip", type: "button", title: L(p.about),
    onclick: () => { store.commit(); persist(); const s = recipeIn(p.file); switchTo(addChar(lib, L(p.name), s.recipe)); } }, `${L(p.name)}（${L(p.about)}）`)));
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
  // the first line names the character and the recipe's version, so the code pasted back (コードを貼りつけて開く) comes back as it was made
  const code = `// Hinagata character ${JSON.stringify(cur.name)} (recipe version ${RECIPE_VERSION})\nimport { createAvatar } from "./src/index.js";\n\nconst avatar = await createAvatar(${JSON.stringify(compact(store.recipe), null, 2)});\nscene.add(avatar.object);\n`;
  try { await navigator.clipboard.writeText(code); toast(t("copied")); } catch { download(`${fileName(cur.name)}.js`, new Blob([code], { type: "text/javascript" })); }
});
$("exportMenu").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.ex; if (!k) return; menu(false);
  exportAs(k).catch((err) => { console.error(err); toast(String(err?.message ?? err)); });
});
async function exportAs(k) {
  if (k === "json") download(`${fileName(cur.name)}.hinagata.json`, new Blob([JSON.stringify(characterFile(compact(store.recipe), cur.name), null, 2)], { type: "application/json" }));   // { hinagata: <version>, name, options }
  if (k === "import") $("fileJson").click();
  if (k === "paste") { $("pasteText").value = ""; $("pasteModal").hidden = false; $("pasteText").focus(); }
  if (k === "link") {
    const o = compact(store.recipe); let dropped = false;
    for (const im of Object.values(o.face?.images ?? {})) if (im?.src) { delete im.src; dropped = true; }
    for (const d of o.face?.drawn ?? []) for (const k of ["eye", "brow", "mouth"]) if (d?.[k]) { d[k] = null; dropped = true; }   // pictures don't fit in a link
    const url = `${location.origin}${location.pathname}?o=${encodeURIComponent(JSON.stringify(characterFile(o, cur.name)))}`;   // with its version (a bare recipe in a link is read as one made before 2026-10-06)
    try { await navigator.clipboard.writeText(url); toast(dropped ? t("linkNoImages") : t("linkCopied")); } catch { prompt(t("exLink"), url); }
  }
  if (k === "png") download(`${fileName(cur.name)}.png`, await vp.snapshot());
  if (k === "glb" && vp.avatar) download(`${fileName(cur.name)}.glb`, new Blob([await vp.avatar.exportGLB()], { type: "model/gltf-binary" }));
}
$("fileJson").addEventListener("change", (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  f.text().then((txt) => {
    const j = JSON.parse(txt);
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("not an object");
    const s = recipeIn(j);   // a character file has its version; a bare recipe file is from before 2026-10-06 (the chibi defaults)
    const bad = checkOptions(j.options ?? j); if (bad.length) console.warn("Imported recipe has problems:", bad);
    const name = s.name || f.name.replace(/(\.hinagata)?\.json$/i, "");
    store.commit(); persist(); switchTo(addChar(lib, name, s.recipe)); toast(t("imported", name));
  }).catch(() => toast(t("badJson")));
});
// paste back what was copied (2026-10-06, Saori: "コピーしとくだけでバックアップできる"): the code (コードをコピー), a link (?o=…) or a recipe's JSON.
// The code's first line says its version; code without it is today's (bare options in code are, openRecipe); bare JSON is a file's (version 1)
function readPasted(txt) {
  txt = txt.trim();
  const link = txt.match(/[?&]o=([^&#\s]+)/); if (link) return { input: JSON.parse(decodeURIComponent(link[1])), bare: 1 };
  const at = txt.indexOf("createAvatar(");
  if (at >= 0) { const s = txt.indexOf("{", at); if (s < 0) throw new Error("no recipe");
    let depth = 0, str = null, end = -1;   // the object literal, to its closing brace (braces inside strings don't count)
    for (let i = s; i < txt.length && end < 0; i++) { const c = txt[i];
      if (str) { if (c === "\\") i++; else if (c === str) str = null; } else if (c === '"' || c === "'" || c === "`") str = c; else if (c === "{") depth++; else if (c === "}" && !--depth) end = i; }
    if (end < 0) throw new Error("unclosed");
    const v = txt.match(/recipe version (\d+)/), nm = txt.match(/Hinagata character ("(?:[^"\\]|\\.)*")/), options = JSON.parse(txt.slice(s, end + 1));
    return { input: { hinagata: v ? +v[1] : RECIPE_VERSION, ...(nm ? { name: JSON.parse(nm[1]) } : {}), options }, bare: RECIPE_VERSION }; }
  return { input: JSON.parse(txt), bare: 1 };
}
const closePaste = () => { $("pasteModal").hidden = true; };
$("pasteClose").addEventListener("click", closePaste);
$("pasteModal").addEventListener("click", (e) => { if (e.target === $("pasteModal")) closePaste(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("pasteModal").hidden) closePaste(); });
$("pasteLoad").addEventListener("click", () => {
  let got; try { got = readPasted($("pasteText").value); if (!got.input || typeof got.input !== "object" || Array.isArray(got.input)) throw new Error("not an object"); } catch { toast(t("badPaste")); return; }
  const s = recipeIn(got.input, got.bare), bad = checkOptions(got.input.options ?? got.input); if (bad.length) console.warn("Pasted recipe has problems:", bad);
  const name = s.name || t("pastedName");
  closePaste(); store.commit(); persist(); switchTo(addChar(lib, name, s.recipe)); toast(t("imported", name));
});
addEventListener("pagehide", () => { store.commit(); persist(); });

// ── start ──
translatePage(); renderLang(); renderViewControls();
$("name").value = cur.name; syncUndo(); panel.render(); persist();
await rebuild();
globalThis.hinagataEditor = { store, vp, lib };   // for checking from the console
