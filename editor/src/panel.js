// The inspector: tabs, and controls generated from the schema (src/schema.js).
// Main values are shown in schema order under their sections; every other value of the tab sits in the folded "Advanced" part.
import { SCHEMA, DEFAULTS, BODY_TYPES, EXPRESSIONS, EXPRESSION_SET, PART_LABELS } from "../../src/index.js";
import { getPath, isDefault, diffCount } from "./store.js";
import { t, L, bodyTypeName } from "./i18n.js";

const svg = (d) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const TABS = [
  { id: "body", groups: ["body"], icon: svg('<circle cx="12" cy="5" r="3"></circle><path d="M6 21v-7a6 6 0 0 1 12 0v7"></path>') },
  { id: "face", groups: ["face"], icon: svg('<circle cx="12" cy="12" r="9"></circle><path d="M9 10h.01M15 10h.01M9 15c1.7 1.3 4.3 1.3 6 0"></path>') },
  { id: "hair", groups: ["hair"], icon: svg('<path d="M4 14c0-6 3.6-10 8-10s8 4 8 10"></path><path d="M4 14c2-1 3-3 3.5-5M20 14c-2-1-3-3-3.5-5M12 4c-.5 3-2 5-4.5 5"></path>') },
  { id: "outfit", groups: ["outfit"], icon: svg('<path d="M8 3 3 7l3 3 2-1.5V21h8V8.5l2 1.5 3-3-5-4c-.8 1.4-2.3 2-4 2s-3.2-.6-4-2z"></path>') },
  { id: "look", groups: ["look", "quality"], icon: svg('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.7-.9 1.4-1.9-.3-1 .3-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"></path><circle cx="7.5" cy="11" r="1"></circle><circle cx="10.5" cy="7" r="1"></circle><circle cx="15" cy="7.5" r="1"></circle>') },
];
const ALL = Object.values(SCHEMA);
const tabOf = (e) => TABS.find((T) => T.groups.includes(e.group))?.id ?? "look";
export const tabPaths = (id) => ALL.filter((e) => tabOf(e) === id).map((e) => e.path);
const COST_RANK = { instant: 0, paint: 1, hair: 2, clothes: 3, body: 4 };

const h = (tag, attrs = {}, ...kids) => {   // tiny element builder
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
  return el;
};
const fmt = (v, step) => { const d = Math.max(0, Math.min(5, -Math.floor(Math.log10(step || 1) + 1e-9))); return (+v).toFixed(d); };
let uid = 0;

/**
 * ctx: { store, quality, onQuality(q), onImage(path), onTemplate(kind), onReadTemplate(), bangs (editor/src/bangs.js), draw (draw.js), hairs (my hairstyles, app.js) }
 */
export function createPanel({ tabsEl, panelEl, footEl, resetEl }, ctx) {
  const { store } = ctx;
  let tab = "body", filter = "", editExpr = "normal", faceShown = false;   // editExpr: the expression the face tab edits (shown on the avatar while there)
  const SLOTS = ["eyes", "brows", "mouth", "cheeks"], EXPR_PARTS = new Set([...SLOTS.map((k) => `face.parts.${k}`), "face.expressions"]);   // they are edited with the expression (its block), not in Parts / as JSON
  const open = new Set();   // tabs whose Advanced part is open
  const set = (changes, commit = true) => store.set(changes, { commit });

  // ── controls ──
  function resetDot(e) {
    if (isDefault(store.recipe, e.path)) return null;
    return h("button", { class: "dot", type: "button", title: t("resetValue"), "aria-label": `${t("resetValue")}: ${L(e.label)}`, onclick: () => set({ [e.path]: structuredClone(getPath(DEFAULTS, e.path)) }) });
  }
  const labelOf = (e, id) => h("label", { class: "lab", for: id }, h("span", { title: e.path }, L(e.label)), resetDot(e));
  const helpOf = (e) => e.help ? h("div", { class: "help" }, L(e.help).replace(/^null\b/, t("auto"))) : null;   // "null = …" reads as "Auto = …"
  const shown = (e) => !e.when || Object.entries(e.when).every(([p, v]) => v === "*set" ? store.get(p) != null : store.get(p) === v);   // only when the values it depends on are set so ("*set": anything but null)

  function numberField(e, v) {
    const id = `f${uid++}`;
    if (v === null) {   // nullable number left on auto
      return h("div", { class: "field" }, labelOf(e, id), h("button", { id, class: "chip", type: "button", "aria-pressed": "true", onclick: () => set({ [e.path]: e.min != null ? +(((e.min + e.max) / 2).toFixed(4)) : 0 }) }, t("auto")), helpOf(e));
    }
    const lo = Math.min(e.min, v), hi = Math.max(e.max, v), pct = (x) => `${((e.reverse ? hi - x : x - lo) / (hi - lo || 1)) * 100}%`;   // reverse: right is the smaller value (a height where lower is longer)
    const num = h("input", { id, class: "num", type: "number", step: e.step, value: fmt(v, e.step), "aria-label": L(e.label) });
    const rng = h("input", { class: `rng full${e.soft ? " soft" : ""}`, type: "range", min: lo, max: hi, step: e.step, value: v, "aria-label": L(e.label), title: e.soft ? t("softRange") : null });
    rng.style.setProperty("--p", pct(v)); if (e.reverse) rng.dir = "rtl";
    rng.addEventListener("input", () => { const x = +rng.value; num.value = fmt(x, e.step); rng.style.setProperty("--p", pct(x)); set({ [e.path]: x }, false); });
    rng.addEventListener("change", () => store.commit());
    num.addEventListener("change", () => { const x = +num.value; if (!isFinite(x)) { num.value = fmt(store.get(e.path), e.step); return; } set({ [e.path]: x }); });
    const autoBtn = e.nullable ? h("button", { class: "btn small ghost", type: "button", onclick: () => set({ [e.path]: null }) }, t("auto")) : null;
    return h("div", { class: "field" }, labelOf(e, id), h("div", { class: "row" }, autoBtn, num), rng, helpOf(e));
  }
  function boolField(e, v) {
    const id = `f${uid++}`;
    return h("div", { class: "field" }, labelOf(e, id), h("button", { id, class: "switch", type: "button", role: "switch", "aria-checked": String(!!v), onclick: () => set({ [e.path]: !v }) }), helpOf(e));
  }
  function colorField(e, v) {
    const id = `f${uid++}`;
    if (v === null) return h("div", { class: "field" }, labelOf(e, id), h("button", { id, class: "chip", type: "button", "aria-pressed": "true", onclick: () => set({ [e.path]: store.get("colors.hair") ?? "#ffffff" }) }, t("auto")), helpOf(e));
    const alpha = v.length === 9 ? v.slice(7) : "";
    const pick = h("input", { id, type: "color", value: v.slice(0, 7), "aria-label": L(e.label) });
    const hex = h("input", { class: "num", value: v, spellcheck: "false", "aria-label": `${L(e.label)} (hex)` });
    pick.addEventListener("input", () => { hex.value = pick.value + alpha; set({ [e.path]: pick.value + alpha }, false); });
    pick.addEventListener("change", () => store.commit());
    hex.addEventListener("change", () => { const x = hex.value.trim(); if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(x)) set({ [e.path]: x.toLowerCase() }); else hex.value = store.get(e.path); });
    const autoBtn = e.nullable ? h("button", { class: "btn small ghost", type: "button", onclick: () => set({ [e.path]: null }) }, t("auto")) : null;
    return h("div", { class: "field" }, labelOf(e, id), h("div", { class: "color" }, autoBtn, pick, hex), helpOf(e));
  }
  function enumField(e, v) {
    const id = `f${uid++}`, opts = [...(e.nullable ? [{ value: null, label: { en: t("auto"), ja: t("auto") } }] : []), ...e.options];
    const short = opts.length <= 4 && opts.every((o) => L(o.label).length <= 12);
    const ctl = short
      ? h("div", { id, class: "seg full", role: "group", "aria-label": L(e.label) }, opts.map((o) => h("button", { type: "button", "aria-pressed": String(o.value === v), onclick: () => set({ [e.path]: o.value }) }, L(o.label))))
      : h("select", { id, class: "sel", onchange: (ev) => set({ [e.path]: opts[+ev.target.value].value }) }, opts.map((o, i) => h("option", { value: i, selected: o.value === v }, L(o.label))));
    return h("div", { class: "field" }, labelOf(e, id), short ? null : ctl, short ? h("div", { class: "full" }, ctl) : null, helpOf(e));
  }
  function imageField(e, v) {
    const id = `f${uid++}`;
    return h("div", { class: "field" }, labelOf(e, id),
      h("div", { class: "img" }, v ? h("img", { class: "thumb", src: v, alt: "" }) : h("span", { class: "cost" }, t("none")),
        h("button", { id, class: "btn small", type: "button", onclick: () => ctx.onImage(e.path) }, t("load")),
        v ? h("button", { class: "btn small ghost", type: "button", onclick: () => set({ [e.path]: null }) }, t("clear")) : null), helpOf(e));
  }
  function jsonField(e, v) {
    const id = `f${uid++}`, ta = h("textarea", { id, class: "json full", spellcheck: "false", rows: Math.min(8, 1 + Math.ceil(JSON.stringify(v).length / 46)) });
    ta.value = JSON.stringify(v);
    ta.addEventListener("change", () => { try { const x = JSON.parse(ta.value); ta.classList.remove("bad"); set({ [e.path]: x }); } catch { ta.classList.add("bad"); } });
    return h("div", { class: "field" }, labelOf(e, id), ta, helpOf(e));
  }
  const DRAWN_SLOTS = new Set(["face.parts.eyes", "face.parts.brows", "face.parts.mouth"]);   // the drawn expressions' parts can be picked one slot at a time too
  const fieldOf = (e0) => { const e = DRAWN_SLOTS.has(e0.path) ? { ...e0, options: [...e0.options, ...drawnList().map((d) => ({ value: `image@${d.id}`, label: { ja: drawnName(d), en: drawnName(d) } }))] } : e0, v = store.get(e.path); return ({ number: numberField, boolean: boolField, color: colorField, enum: enumField, image: imageField })[e.type]?.(e, v) ?? jsonField(e, v); };

  // ── sections ──
  function costNote(entries) {
    const c = entries.reduce((m, e) => COST_RANK[e.cost] > COST_RANK[m] ? e.cost : m, "instant");
    return c === "instant" ? null : h("span", { class: "cost" }, t(`cost_${c}`));
  }
  function sections(entries) {   // group by section (in order of first appearance)
    const out = new Map(); for (const e of entries) { const k = L(e.section) || "—"; if (!out.has(k)) out.set(k, []); out.get(k).push(e); } return out;
  }
  function presetBlock() {
    const r = store.recipe;
    if (tab === "body") {
      // every value a type sets (torso, limbs, proportions, head size), as paths
      const leaves = (o, pre, out = {}) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === "object") leaves(v, `${pre}.${k}`, out); else out[`${pre}.${k}`] = v; } return out; };
      const on = (b) => Object.entries(leaves(b.body, "body")).every(([p, v]) => store.get(p) === v);
      const row = (tall) => h("div", { class: "chips" }, h("span", { class: "cost" }, t(tall ? "bodyTall" : "bodyChibi")), Object.entries(BODY_TYPES).filter(([k]) => k.endsWith("Tall") === tall).map(([k, b]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(on(b)), onclick: () => set(leaves(b.body, "body")) }, bodyTypeName(k.replace(/Tall$/, "")))));
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("bodyType")), h("span", { class: "cost" }, t("cost_body"))), row(false), row(true));
    }
    if (tab === "face") {
      // the expressions, edited one at a time (2026-10-06, Saori: picking a face, then registering it on a row, then building the next one was
      // too roundabout): pick the expression (ふつう 喜び 悲しみ 怒り 驚き), it shows on the character, and its eyes, brows, mouth and cheeks are
      // edited right here. ふつう is the character's own face (face.parts); the others are this character's versions (face.expressions), the
      // stock face of their name until one is changed. A drawn template goes into the one picked (app.js applyTemplate); a drawn face is used
      // elsewhere by picking its eyes, brows and mouth ("絵: …" in each)
      if (!EXPRESSION_SET.includes(editExpr)) editExpr = "normal";
      const n = editExpr, ES = r.face.expressions ?? {}, P0 = r.face.parts, base = { eyes: P0.eyes, brows: P0.brows, mouth: P0.mouth, cheeks: P0.cheeks };
      const cur = n === "normal" ? { ...base, ...(ES.normal ?? {}) } : { ...base, ...(ES[n] ?? EXPRESSIONS[n]?.parts ?? {}) };
      const noNormal = () => { if (!ES.normal) return {}; const o = { ...ES }; delete o.normal; return { "face.expressions": o }; };   // an old ふつう of its own gives way to the parts
      const write = (p, extra = {}) => { if (n === "normal") { const ch = { ...noNormal(), ...extra }; for (const k of SLOTS) ch[`face.parts.${k}`] = p[k]; set(ch); } else set({ ...extra, "face.expressions": { ...ES, [n]: { ...p } } }); };
      // my parts (ctx.myParts: drawn eyes, brows and mouths kept in this browser, for every character): picked here, the drawing is copied into
      // this character's drawn faces (face.drawn, lib: where it came from) and used; one already copied shows as its own "絵: …"
      const MY = ctx.myParts?.list() ?? [], PIC = { eyes: "eye", brows: "brow", mouth: "mouth" }, here = new Set(drawnList().map((d) => d.lib).filter(Boolean));
      const adopt = (x) => { const list = drawnList(), ids = new Set(list.map((d) => String(d.id))); let i = 1, id; do id = `m${i++}`; while (ids.has(id));
        return { id, ch: { "face.drawn": [...list, { id, name: x.name, eye: x.eye ?? null, brow: x.brow ?? null, mouth: x.mouth ?? null, cheeks: x.cheeks ?? "none", blink: x.blink !== false, lib: x.id }] } }; };
      const reset = () => { const o = { ...ES }; delete o[n]; set({ "face.expressions": o }); };
      ctx.showFace?.(cur); faceShown = true;
      const pickN = h("div", { class: "seg full", role: "group", "aria-label": t("exprSet") }, EXPRESSION_SET.map((k) =>   // five, fixed: all in view (2026-10-06, Saori: not a drop-down)
        h("button", { type: "button", "aria-pressed": String(k === n), onclick: () => { editExpr = k; render(); } }, t(`ex_${k}`))));
      const slotField = (k) => { const e = ALL.find((q) => q.path === `face.parts.${k}`), drawn = k === "cheeks" ? [] : drawnList().map((d) => ({ value: `image@${d.id}`, label: { ja: drawnName(d), en: drawnName(d) } })), my = PIC[k] ? MY.filter((x) => x[PIC[k]] && !here.has(x.id)).map((x) => ({ value: null, my: x, label: { ja: `${t("myPartsTag")}${x.name}`, en: `${t("myPartsTag")}${x.name}` } })) : [], opts = [...(e?.options ?? []), ...drawn, ...my];
        const pickSlot = (o) => { if (!o.my) return write({ ...cur, [k]: o.value }); const a = adopt(o.my); write({ ...cur, [k]: `image@${a.id}` }, a.ch); };
        return h("div", { class: "field" }, h("label", {}, L(e?.label) || k), h("select", { class: "sel", "aria-label": L(e?.label) || k, onchange: (ev) => pickSlot(opts[+ev.target.value]) },
          opts.map((o, i) => h("option", { value: i, selected: o.value === cur[k] }, L(o.label))))); };
      const own = n !== "normal" && ES[n];
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("exprSet"))), pickN, h("div", { class: "help" }, t("exEditHelp", t(`ex_${n}`))),
        SLOTS.map(slotField),
        own ? h("div", { class: "chips" }, h("button", { class: "chip", type: "button", onclick: reset }, t("exResetTo", L(EXPRESSIONS[n])))) : null);
    }
    if (tab === "outfit") {   // the whole garment at once: a robe is a dress down to the ankles with bell sleeves
      const G = { plain: { "outfit.dress.on": false, "outfit.shirt.sleeve": "short" }, dress: { "outfit.dress.on": true, "outfit.dress.hem": 0.28, "outfit.dress.flare": 0.45, "outfit.shirt.sleeve": "short" },
        robe: { "outfit.dress.on": true, "outfit.dress.hem": 0.04, "outfit.dress.flare": 0.3, "outfit.shirt.sleeve": "bell" } };
      const on = (g) => Object.entries(g).every(([p, v]) => store.get(p) === v);
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("garment")), h("span", { class: "cost" }, t("cost_clothes"))),
        h("div", { class: "chips" }, Object.entries(G).map(([k, g]) => h("button", { class: "chip", type: "button", "aria-pressed": String(on(g)), onclick: () => set({ ...g }) }, t(`g_${k}`)))));
    }
    if (tab === "look") {
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("quality")), h("span", { class: "cost" }, t("cost_body"))),
        h("div", { class: "seg full", role: "group", "aria-label": t("quality") }, ["lite", "game", "fine", "high"].map((q) => h("button", { type: "button", "aria-pressed": String(ctx.quality() === q), onclick: () => ctx.onQuality(q) }, t(`q_${q}`)))));
    }
    return null;
  }
  // drawn face parts: one template for all of them (write it out, draw, read it back), the character's own drawn expressions, and what each has
  const isDrawn = (e) => e.group === "face" && (e.type === "image" || e.path === "face.drawn");
  const drawnList = () => (store.get("face.drawn") ?? []).filter((d) => d && d.id != null);
  const drawnName = (d) => `${t("pic")}: ${d.name || d.id}`;
  const setDrawn = (list, extra = {}) => set({ "face.drawn": list, ...extra });
  function drawnBlock() {
    const list = drawnList(), base = (k) => store.get(`face.images.${k}.src`);
    const pic = (k, v) => h("div", { class: "pic" }, v ? h("img", { class: "thumb", src: v, alt: "" }) : h("span", { class: "thumb empty" }, "–"), h("span", {}, t(`f_${k}`)));
    const anyPic = ["eye", "eyeClosed", "brow", "mouth", "nose"].some(base) || list.some((d) => d.eye || d.brow || d.mouth);
    const edit = (d, ch) => setDrawn(list.map((q) => q === d ? { ...q, ...ch } : q));
    const remove = (d) => { if (!confirm(t("confirmDelExpr", d.name || d.id))) return; const id = `image@${d.id}`, extra = {};
      for (const k of ["eyes", "brows", "mouth"]) if (store.get(`face.parts.${k}`) === id) extra[`face.parts.${k}`] = "image";   // the face was showing it: back to the drawn ふつう
      setDrawn(list.filter((q) => q !== d), extra); };
    const readBtn = (into) => [h("button", { class: "chip read", type: "button", title: t("fpOpenTitle"), onclick: () => ctx.onFacePaint(into) }, t("fpOpenShort")),   // draw it in the app (facepaint.js)
      h("button", { class: "chip read", type: "button", title: t("tplReadInto"), onclick: () => ctx.onReadTemplate(into) }, t("tplReadShort"))];   // the template drawn for this expression
    const keep = (x) => ctx.myParts ? h("button", { class: "chip", type: "button", title: t("myPartsSaveTitle"), onclick: () => ctx.myParts.save(x) }, t("myPartsSave")) : null;   // into my parts (every character)
    const cards = [h("div", { class: "drow" }, h("div", { class: "head" }, h("b", {}, t("normalPic")), readBtn(null), base("eye") || base("brow") || base("mouth") ? keep({ eye: base("eye"), brow: base("brow"), mouth: base("mouth"), normal: true }) : null), h("div", { class: "pics" }, ["eye", "eyeClosed", "brow", "mouth", "nose"].map((k) => pic(k, base(k)))))];
    for (const d of list) {
      const nm = h("input", { class: "num name", value: d.name ?? "", "aria-label": t("exprName") }); nm.addEventListener("change", () => edit(d, { name: nm.value.trim() || d.id }));
      cards.push(h("div", { class: "drow" }, h("div", { class: "head" }, nm, readBtn(d.id),
          h("button", { class: "chip", type: "button", "aria-pressed": String((d.cheeks ?? "none") === "flush"), onclick: () => edit(d, { cheeks: (d.cheeks ?? "none") === "flush" ? "none" : "flush" }) }, t("flush")),
          h("button", { class: "chip", type: "button", "aria-pressed": String(d.blink !== false), onclick: () => edit(d, { blink: d.blink === false }) }, t("blink")),
          keep(d), h("button", { class: "chip", type: "button", onclick: () => remove(d) }, t("delExpr"))),
        h("div", { class: "pics" }, ["eye", "brow", "mouth"].map((k) => pic(k, d[k])))));
    }
    return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("drawn"))),
      h("div", { class: "chips" }, h("button", { class: "btn small", type: "button", onclick: () => ctx.onFacePaint(null) }, t("fpOpen")),
        h("button", { class: "btn small", type: "button", onclick: () => ctx.onFacePaint("new") }, t("fpNew")),
        h("button", { class: "btn small", type: "button", onclick: () => ctx.onTemplate("parts") }, t("tplMake")),
        h("button", { class: "btn small", type: "button", title: t("tplNewTitle"), onclick: () => ctx.onReadTemplate("new") }, t("tplNew")),
        anyPic ? h("button", { class: "btn small ghost", type: "button", onclick: () => { if (!confirm(t("confirmClearDrawn"))) return; const ch = {}; for (const k of ["eye", "eyeClosed", "brow", "mouth", "nose"]) ch[`face.images.${k}.src`] = null; ch["face.drawn"] = list.map((d) => ({ ...d, eye: null, brow: null, mouth: null })); set(ch); } }, t("tplClear")) : null),
      h("div", { class: "drawn" }, cards),
      h("div", { class: "help" }, t("tplHelp")));
  }
  // moving the nendo bangs' tufts on the face (editor/src/bangs.js): the switch, adding / removing, and the picked tuft's own values
  function bangsBlock() {
    const B = ctx.bangs; if (!B) return null;
    const head = h("div", { class: "sec-h" }, h("h2", {}, t("bangTufts")), h("span", { class: "cost" }, t("bangN", (store.get("hair.sculpt.nendo.tips") ?? []).length)));
    if (!B.usable) return h("div", { class: "sec" }, head, h("div", { class: "note" }, t("bangNeedNendo")));
    const kids = [head, h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(B.on), onclick: () => B.toggle() }, t("bangMove")))];
    if (B.on) {
      kids.push(h("div", { class: "help" }, t("bangHelp")),
        h("div", { class: "chips" }, h("button", { class: "btn small", type: "button", onclick: () => B.add() }, t("bangAdd")), h("button", { class: "btn small ghost", type: "button", disabled: B.selected < 0, onclick: () => B.remove() }, t("bangDel"))));
      if (B.selected < 0) kids.push(h("div", { class: "note" }, t("bangPick")));
      else for (const [k, key, min, max, step] of [[8, "bangWidth", 0.2, 2, 0.05], [5, "bangSweep", -25, 25, 0.5], [7, "bangFlick", -0.04, 0.04, 0.001], [9, "bangWave", 0, 0.05, 0.002], [6, "bangThick", -0.02, 0.03, 0.001]]) {   // the row's width, sweep, flick / curl, wave (hanging tufts) and extra thickness
        const id = `f${uid++}`, v = B.value(k), num = h("input", { id, class: "num", type: "number", step, value: fmt(v, step) }), rng = h("input", { class: "rng full", type: "range", min, max, step, value: v });
        const pct = (x) => `${((x - min) / (max - min)) * 100}%`; rng.style.setProperty("--p", pct(v));
        rng.addEventListener("input", () => { num.value = fmt(+rng.value, step); rng.style.setProperty("--p", pct(+rng.value)); });
        rng.addEventListener("change", () => B.setValue(k, +rng.value)); num.addEventListener("change", () => { if (isFinite(+num.value)) B.setValue(k, +num.value); });
        kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t(key))), h("div", { class: "row" }, num), rng)); }
    }
    return h("div", { class: "sec" }, kids);
  }
  // painting on the character (editor/src/paint.js)
  function paintBlock() {
    const P = ctx.paint; if (!P) return null; const S = P.state, painted = P.painted();
    const kids = [h("div", { class: "sec-h" }, h("h2", {}, t("paintTitle"))),
      h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(S.on), onclick: () => P.toggle() }, t("paintOn")),
        h("button", { class: "chip", type: "button", "aria-pressed": String(S.erase), onclick: () => P.set("erase", !S.erase) }, t("paintErase")))];
    if (S.on) kids.push(h("div", { class: "help" }, t("paintHelp")));
    { const id = `f${uid++}`, inp = h("input", { id, type: "color", value: S.color }); inp.addEventListener("change", () => P.set("color", inp.value));
      kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t("paintColor"))), h("div", { class: "row" }, inp))); }
    for (const [k, key, min, max, step] of [["size", "paintSize", 0.002, 0.06, 0.001], ["opacity", "paintOpacity", 0.05, 1, 0.01], ["soft", "paintSoft", 0, 1, 0.01]]) {
      const id = `f${uid++}`, val = S[k], num = h("input", { id, class: "num", type: "number", step, value: fmt(val, step) }), rng = h("input", { class: "rng full", type: "range", min, max, step, value: val });
      const pct = (x) => `${((x - min) / (max - min)) * 100}%`; rng.style.setProperty("--p", pct(val));
      rng.addEventListener("input", () => { num.value = fmt(+rng.value, step); rng.style.setProperty("--p", pct(+rng.value)); });
      rng.addEventListener("change", () => P.set(k, +rng.value)); num.addEventListener("change", () => { if (isFinite(+num.value)) P.set(k, +num.value); });
      kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t(key))), h("div", { class: "row" }, num), rng)); }
    if (painted.length) kids.push(h("div", { class: "chips" }, painted.map((k) => h("button", { class: "chip", type: "button", title: t("paintClear"), onclick: () => { if (confirm(t("paintClearQ", t(`paint_${k}`)))) P.clear(k); } }, `${t(`paint_${k}`)} ×`))));
    return h("div", { class: "sec" }, kids);
  }
  // accessories (editor/src/accessories.js): the kind and color for the next one, the tool's switch, and the picked item's own values
  function accBlock() {
    const A = ctx.acc; if (!A) return null; const S = A.state, items = A.items, sel = A.selected, it = items[sel];
    const colorField = (val, on) => { const id = `f${uid++}`, inp = h("input", { id, type: "color", value: val }); inp.addEventListener("change", () => on(inp.value));
      return h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t("accColor"))), h("div", { class: "row" }, inp)); };
    const kids = [h("div", { class: "sec-h" }, h("h2", {}, t("accTitle")), h("span", { class: "cost" }, t("accN", items.length))),
      h("div", { class: "chips" }, A.kinds.map((k) => h("button", { class: "chip", type: "button", "aria-pressed": String(S.kind === k), onclick: () => A.set("kind", k) }, t(`acc_${k}`)))),
      colorField(S.color, (v) => A.set("color", v)),
      h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(S.on), onclick: () => A.toggle() }, t("accOn")),
        h("button", { class: "chip", type: "button", "aria-pressed": String(S.mirror), onclick: () => A.set("mirror", !S.mirror) }, t("accMirror")))];
    if (S.on) kids.push(h("div", { class: "help" }, t(sel >= 0 ? "accHelpMove" : "accHelp")));
    if (items.length) kids.push(h("div", { class: "chips" }, items.map((x, i) => h("button", { class: "chip", type: "button", "aria-pressed": String(sel === i), onclick: () => A.pick(i) }, `${t(`acc_${x.kind}`)} ${i + 1}`))));
    if (it) {
      for (const [k, key, min, max, step] of [["size", "accSize", 0.005, 0.2, 0.001], ["spin", "accSpin", -180, 180, 1]]) {
        const id = `f${uid++}`, val = it[k] ?? 0, num = h("input", { id, class: "num", type: "number", step, value: fmt(val, step) }), rng = h("input", { class: "rng full", type: "range", min, max, step, value: val });
        const pct = (x) => `${((x - min) / (max - min)) * 100}%`; rng.style.setProperty("--p", pct(val));
        rng.addEventListener("input", () => { num.value = fmt(+rng.value, step); rng.style.setProperty("--p", pct(+rng.value)); });
        rng.addEventListener("change", () => A.edit(k, +rng.value)); num.addEventListener("change", () => { if (isFinite(+num.value)) A.edit(k, +num.value); });
        kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t(key))), h("div", { class: "row" }, num), rng)); }
      kids.push(colorField(it.color ?? "#e3c25a", (v) => A.edit("color", v)),
        h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(!!it.mirror), onclick: () => A.edit("mirror", !it.mirror) }, t("accMirror")),
          h("button", { class: "btn small ghost", type: "button", onclick: () => A.pick(sel) }, t("accNew")), h("button", { class: "btn small ghost", type: "button", onclick: () => A.remove() }, t("accDel"))));
    }
    return h("div", { class: "sec" }, kids);
  }
  // the tails' ties by hand (editor/src/ties.js): only with tails
  function tiesBlock() {
    const T = ctx.ties; if (!T || !T.usable) return null;
    const kids = [h("div", { class: "sec-h" }, h("h2", {}, t("tieTitle"))), h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(T.on), onclick: () => T.toggle() }, t("tieMove")))];
    if (T.on) kids.push(h("div", { class: "help" }, t("tieHelp")));
    return h("div", { class: "sec" }, kids);
  }
  // the back hair's locks one by one (editor/src/backs.js)
  function backsBlock() {
    const B = ctx.backs; if (!B) return null;
    const p = { hang: "hair.sculpt.shortLocks.edits", short: "hair.sculpt.shortLocks.lie.edits", long: "hair.sculpt.long.edits" }[store.get("hair.back")], n = p ? (store.get(p) ?? []).length : 0;
    const head = h("div", { class: "sec-h" }, h("h2", {}, t("backTitle")), n ? h("span", { class: "cost" }, t("backN", n)) : null);
    if (!B.usable) return h("div", { class: "sec" }, head, h("div", { class: "note" }, t("backNone")));
    const kids = [head, h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(B.on), onclick: () => B.toggle() }, t("backMove")),
      n ? h("button", { class: "btn small ghost", type: "button", onclick: () => B.resetAll() }, t("backResetAll")) : null)];
    if (B.on) {
      kids.push(h("div", { class: "help" }, t("backHelp")));
      if (B.selected < 0) kids.push(h("div", { class: "note" }, t("backPick")));
      else { for (const [k, key, min, max, step] of [["w", "backW", 0.2, 2.5, 0.05], ["th", "backTh", 0.2, 2.5, 0.05], ["fl", "backFl", -0.06, 0.08, 0.002]]) {
          const id = `f${uid++}`, v = B.value(k), num = h("input", { id, class: "num", type: "number", step, value: fmt(v, step) }), rng = h("input", { class: "rng full", type: "range", min, max, step, value: v });
          const pct = (x) => `${((x - min) / (max - min)) * 100}%`; rng.style.setProperty("--p", pct(v));
          rng.addEventListener("input", () => { num.value = fmt(+rng.value, step); rng.style.setProperty("--p", pct(+rng.value)); });
          rng.addEventListener("change", () => B.setValue(k, +rng.value)); num.addEventListener("change", () => { if (isFinite(+num.value)) B.setValue(k, +num.value); });
          kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t(key))), h("div", { class: "row" }, num), rng)); }
        kids.push(h("div", { class: "chips" }, h("button", { class: "btn small ghost", type: "button", onclick: () => B.resetOne() }, t("backReset")))); }
    }
    return h("div", { class: "sec" }, kids);
  }
  // my hairstyles (saved in this browser) and drawn locks (editor/src/draw.js)
  function myPartsBlock() {   // my parts: the list, and removing one (they are used from the eyes / brows / mouth of the expression set)
    const M = ctx.myParts; if (!M) return null; const L = M.list();
    return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("myParts"))),
      h("div", { class: "chips" }, L.length ? L.map((x) => h("span", { class: "chip-pair" }, h("span", { class: "chip" }, x.name),
        h("button", { class: "chip", type: "button", title: t("drawDel"), "aria-label": `${t("drawDel")}: ${x.name}`, onclick: () => M.remove(x.id) }, "×"))) : h("span", { class: "cost" }, t("myHairNone"))),
      h("div", { class: "help" }, t("myPartsHelp")));
  }
  function hairsBlock() {
    const H = ctx.hairs; if (!H) return null; const L = H.list();
    const name = h("input", { class: "num grow", placeholder: t("myHairName"), "aria-label": t("myHairName") });
    const save = () => H.save(name.value.trim()); name.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("myHair"))),
      h("div", { class: "chips" }, L.length ? L.map((x) => h("span", { class: "chip-pair" }, h("button", { class: "chip", type: "button", onclick: () => H.apply(x.id) }, x.name),
        h("button", { class: "chip", type: "button", title: t("drawDel"), "aria-label": `${t("drawDel")}: ${x.name}`, onclick: () => H.remove(x.id) }, "×"))) : h("span", { class: "cost" }, t("myHairNone"))),
      h("div", { class: "row add" }, name, h("button", { class: "btn small", type: "button", onclick: save }, t("myHairSave"))),
      h("div", { class: "help" }, t("myHairHelp")));
  }
  function drawBlock() {
    const D = ctx.draw; if (!D) return null; const S = D.state, list = store.get("hair.drawn") ?? [];
    const kids = [h("div", { class: "sec-h" }, h("h2", {}, t("drawTitle")), h("span", { class: "cost" }, t("drawN", list.length))),
      h("div", { class: "chips" }, h("button", { class: "chip", type: "button", "aria-pressed": String(S.on), onclick: () => D.toggle() }, t("drawOn")),
        list.length ? h("button", { class: "chip", type: "button", "aria-pressed": String(S.move), onclick: () => D.toggleMove() }, t("drawMove")) : null,
        h("button", { class: "chip", type: "button", "aria-pressed": String(S.mirror), onclick: () => D.set("mirror", !S.mirror) }, t("drawMirror")))];
    if (S.on) kids.push(h("div", { class: "help" }, t("drawHelp")));
    if (S.move) kids.push(h("div", { class: "help" }, t("drawMoveHelp")));
    for (const [k, key, min, max, step] of [["width", "drawWidth", 0.005, 0.1, 0.001], ["thick", "drawThick", 0.1, 1, 0.01], ["stiff", "drawStiff", 0.3, 4, 0.1]]) {   // the brush for the next lock
      const id = `f${uid++}`, val = S[k], num = h("input", { id, class: "num", type: "number", step, value: fmt(val, step) }), rng = h("input", { class: "rng full", type: "range", min, max, step, value: val });
      const pct = (x) => `${((x - min) / (max - min)) * 100}%`; rng.style.setProperty("--p", pct(val));
      rng.addEventListener("input", () => { num.value = fmt(+rng.value, step); rng.style.setProperty("--p", pct(+rng.value)); });
      rng.addEventListener("change", () => D.set(k, +rng.value)); num.addEventListener("change", () => { if (isFinite(+num.value)) D.set(k, +num.value); });
      kids.push(h("div", { class: "field" }, h("label", { class: "lab", for: id }, h("span", {}, t(key))), h("div", { class: "row" }, num), rng)); }
    if (list.length) kids.push(h("div", { class: "chips" }, list.map((_, i) => h("button", { class: "chip", type: "button", title: t("drawDel"), onclick: () => D.remove(i) }, `${t("drawLock", i + 1)} ×`)),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { if (confirm(t("drawClear") + "?")) D.clear(); } }, t("drawClear"))));
    return h("div", { class: "sec" }, kids);
  }
  function advanced(entries) {
    if (!entries.length) return null;
    const box = h("div", { class: "fold-in" });
    const fill = () => {
      box.replaceChildren();
      const q = filter.trim().toLowerCase(), shown = entries.filter((e) => !q || e.path.toLowerCase().includes(q) || L(e.label).toLowerCase().includes(q));
      const search = h("input", { class: "search", type: "search", placeholder: t("filter"), value: filter, "aria-label": t("filter") });
      search.addEventListener("input", () => { filter = search.value; const pos = search.selectionStart; fill(); const s = box.querySelector(".search"); s.focus(); s.setSelectionRange(pos, pos); });
      box.append(search);
      if (!shown.length) box.append(h("div", { class: "note" }, t("noMatch")));
      for (const [name, es] of sections(shown)) box.append(h("div", { class: "sub" }, h("h3", {}, name), es.map(fieldOf)));
    };
    const d = h("details", { class: "fold" }, h("summary", {}, h("span", {}, t("advanced")), h("span", { class: "cost" }, t("advancedSub")), h("span", { class: "n" }, String(entries.length))), box);
    if (open.has(tab)) { d.open = true; fill(); }
    d.addEventListener("toggle", () => { if (d.open) { open.add(tab); fill(); } else { open.delete(tab); box.replaceChildren(); } });
    return d;
  }

  function render() {
    const scroll = panelEl.scrollTop, focusPath = document.activeElement?.closest?.(".field")?.querySelector("label span")?.title;
    tabsEl.replaceChildren(...TABS.map((T) => h("button", { type: "button", role: "tab", "aria-selected": String(T.id === tab), onclick: () => { tab = T.id; filter = ""; render(); panelEl.scrollTop = 0; }, html: `${T.icon}<span>${t(`tab_${T.id}`)}</span>` })));
    const mine = ALL.filter((e) => tabOf(e) === tab), main = mine.filter((e) => e.tier === "main").sort((a, b) => a.order - b.order);
    panelEl.replaceChildren();
    const pre = presetBlock(); if (pre) panelEl.append(pre);
    if (tab !== "face" && faceShown) { ctx.showFace?.(null); faceShown = false; }   // left the face tab: the character's own face again
    for (const [name, es] of sections(main.filter((e) => shown(e) && !isDrawn(e) && e.path !== "accessories" && !EXPR_PARTS.has(e.path)))) panelEl.append(h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, name), costNote(es)), es.map(fieldOf)));
    if (tab === "face") { panelEl.append(drawnBlock()); const m = myPartsBlock(); if (m) panelEl.append(m); panelEl.append(h("div", { class: "note" }, t("imageNote"))); }
    if (tab === "outfit") { for (const b of [accBlock(), paintBlock()]) if (b) panelEl.append(b); }
    if (tab === "hair") { for (const b of [bangsBlock(), backsBlock(), tiesBlock(), drawBlock(), hairsBlock()]) if (b) panelEl.append(b); }
    const adv = advanced([...main.filter(isDrawn), ...mine.filter((e) => e.tier === "advanced" && e.path !== "hair.drawn" && !e.path.endsWith(".edits"))]); if (adv) panelEl.append(adv);   // one picture at a time: in Advanced; drawn locks and the back locks' edits: their own blocks
    panelEl.scrollTop = scroll;
    if (focusPath) panelEl.querySelector(`label span[title="${CSS.escape(focusPath)}"]`)?.closest(".field")?.querySelector("input, button, select, textarea")?.focus({ preventScroll: true });
    renderFoot();
  }
  function renderFoot() {
    const paths = new Set(tabPaths(tab)), n = diffCount(store.recipe, (p) => paths.has(p)), all = diffCount(store.recipe);
    const txt = all ? t("diffN", all) : t("diff0"), i = all ? txt.indexOf(String(all)) : -1;   // the number in bold
    footEl.replaceChildren(...(i >= 0 ? [txt.slice(0, i), h("b", {}, String(all)), txt.slice(i + String(all).length)] : [txt]));
    resetEl.disabled = !n;
  }
  resetEl.addEventListener("click", () => { const ch = {}; for (const p of tabPaths(tab)) if (!isDefault(store.recipe, p)) ch[p] = structuredClone(getPath(DEFAULTS, p)); set(ch); });

  return { render, renderFoot, get tab() { return tab; }, get editExpr() { return editExpr; } };   // editExpr: where a drawn template goes (app.js applyTemplate)
}
