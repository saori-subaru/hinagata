// The inspector: tabs, and controls generated from the schema (src/schema.js).
// Main values are shown in schema order under their sections; every other value of the tab sits in the folded "Advanced" part.
import { SCHEMA, DEFAULTS, BODY_TYPES, EXPRESSIONS } from "../../src/index.js";
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
 * ctx: { store, quality, onQuality(q), onImage(path), onTemplate(kind), onReadTemplate() }
 */
export function createPanel({ tabsEl, panelEl, footEl, resetEl }, ctx) {
  const { store } = ctx;
  let tab = "body", filter = "";
  const open = new Set();   // tabs whose Advanced part is open
  const set = (changes, commit = true) => store.set(changes, { commit });

  // ── controls ──
  function resetDot(e) {
    if (isDefault(store.recipe, e.path)) return null;
    return h("button", { class: "dot", type: "button", title: t("resetValue"), "aria-label": `${t("resetValue")}: ${L(e.label)}`, onclick: () => set({ [e.path]: structuredClone(getPath(DEFAULTS, e.path)) }) });
  }
  const labelOf = (e, id) => h("label", { class: "lab", for: id }, h("span", { title: e.path }, L(e.label)), resetDot(e));
  const helpOf = (e) => e.help ? h("div", { class: "help" }, L(e.help).replace(/^null\b/, t("auto"))) : null;   // "null = …" reads as "Auto = …"
  const shown = (e) => !e.when || Object.entries(e.when).every(([p, v]) => store.get(p) === v);   // only when the values it depends on are set so

  function numberField(e, v) {
    const id = `f${uid++}`;
    if (v === null) {   // nullable number left on auto
      return h("div", { class: "field" }, labelOf(e, id), h("button", { id, class: "chip", type: "button", "aria-pressed": "true", onclick: () => set({ [e.path]: e.min != null ? +(((e.min + e.max) / 2).toFixed(4)) : 0 }) }, t("auto")), helpOf(e));
    }
    const lo = Math.min(e.min, v), hi = Math.max(e.max, v), pct = (x) => `${((x - lo) / (hi - lo || 1)) * 100}%`;
    const num = h("input", { id, class: "num", type: "number", step: e.step, value: fmt(v, e.step), "aria-label": L(e.label) });
    const rng = h("input", { class: `rng full${e.soft ? " soft" : ""}`, type: "range", min: lo, max: hi, step: e.step, value: v, "aria-label": L(e.label), title: e.soft ? t("softRange") : null });
    rng.style.setProperty("--p", pct(v));
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
      const on = (b) => ["torso", "thickness"].every((g) => Object.entries(b.body[g]).every(([k, v]) => r.body[g][k] === v));
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("bodyType")), h("span", { class: "cost" }, t("cost_body"))),
        h("div", { class: "chips" }, Object.entries(BODY_TYPES).map(([k, b]) => h("button", { class: "chip", type: "button", "aria-pressed": String(on(b)), onclick: () => {
          const ch = {}; for (const g of ["torso", "thickness"]) for (const [kk, v] of Object.entries(b.body[g])) ch[`body.${g}.${kk}`] = v; set(ch); } }, bodyTypeName(k)))));
    }
    if (tab === "face") {
      const on = (x) => Object.entries(x.parts).every(([k, v]) => r.face.parts[k] === v);
      const drawnX = drawnList().map((d) => { const id = `image@${d.id}`; return { ja: drawnName(d), en: drawnName(d), parts: { eyes: id, brows: id, mouth: id, cheeks: d.cheeks ?? "none" } }; });   // the character's drawn expressions
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("expression"))),
        h("div", { class: "chips" }, [...Object.values(EXPRESSIONS), ...drawnX].map((x) => h("button", { class: "chip", type: "button", "aria-pressed": String(on(x)), onclick: () => {
          const ch = {}; for (const [kk, v] of Object.entries(x.parts)) ch[`face.parts.${kk}`] = v; set(ch); } }, L(x)))));
    }
    if (tab === "look") {
      return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("quality")), h("span", { class: "cost" }, t("cost_body"))),
        h("div", { class: "seg full", role: "group", "aria-label": t("quality") }, ["game", "high"].map((q) => h("button", { type: "button", "aria-pressed": String(ctx.quality() === q), onclick: () => ctx.onQuality(q) }, t(`q_${q}`)))));
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
    const nameIn = h("input", { class: "num grow", placeholder: t("exprName"), "aria-label": t("exprName") });
    const add = () => { let n = list.length + 1; const ids = new Set(list.map((d) => String(d.id))); let id; do id = `e${n++}`; while (ids.has(id));
      setDrawn([...list, { id, name: nameIn.value.trim() || t("newExpr", list.length + 1), eye: null, brow: null, mouth: null, cheeks: "none", blink: true }]); };
    nameIn.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    const cards = [h("div", { class: "drow" }, h("div", { class: "head" }, h("b", {}, t("normalPic"))), h("div", { class: "pics" }, ["eye", "eyeClosed", "brow", "mouth", "nose"].map((k) => pic(k, base(k)))))];
    for (const d of list) {
      const nm = h("input", { class: "num name", value: d.name ?? "", "aria-label": t("exprName") }); nm.addEventListener("change", () => edit(d, { name: nm.value.trim() || d.id }));
      cards.push(h("div", { class: "drow" }, h("div", { class: "head" }, nm,
          h("button", { class: "chip", type: "button", "aria-pressed": String((d.cheeks ?? "none") === "flush"), onclick: () => edit(d, { cheeks: (d.cheeks ?? "none") === "flush" ? "none" : "flush" }) }, t("flush")),
          h("button", { class: "chip", type: "button", "aria-pressed": String(d.blink !== false), onclick: () => edit(d, { blink: d.blink === false }) }, t("blink")),
          h("button", { class: "chip", type: "button", onclick: () => remove(d) }, t("delExpr"))),
        h("div", { class: "pics" }, ["eye", "brow", "mouth"].map((k) => pic(k, d[k])))));
    }
    return h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, t("drawn"))),
      h("div", { class: "chips" }, h("button", { class: "btn small", type: "button", onclick: () => ctx.onTemplate("sheet") }, t("tplSheet")), h("button", { class: "btn small ghost", type: "button", onclick: () => ctx.onTemplate("parts") }, t("tplParts")),
        h("button", { class: "btn small", type: "button", onclick: () => ctx.onReadTemplate() }, t("tplRead")),
        anyPic ? h("button", { class: "btn small ghost", type: "button", onclick: () => { if (!confirm(t("confirmClearDrawn"))) return; const ch = {}; for (const k of ["eye", "eyeClosed", "brow", "mouth", "nose"]) ch[`face.images.${k}.src`] = null; ch["face.drawn"] = list.map((d) => ({ ...d, eye: null, brow: null, mouth: null })); set(ch); } }, t("tplClear")) : null),
      h("div", { class: "drawn" }, cards),
      h("div", { class: "row add" }, nameIn, h("button", { class: "btn small", type: "button", onclick: add }, t("addExpr"))),
      h("div", { class: "help" }, t("tplHelp")));
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
    for (const [name, es] of sections(main.filter((e) => shown(e) && !isDrawn(e)))) panelEl.append(h("div", { class: "sec" }, h("div", { class: "sec-h" }, h("h2", {}, name), costNote(es)), es.map(fieldOf)));
    if (tab === "face") { panelEl.append(drawnBlock()); panelEl.append(h("div", { class: "note" }, t("imageNote"))); }
    const adv = advanced([...main.filter(isDrawn), ...mine.filter((e) => e.tier === "advanced")]); if (adv) panelEl.append(adv);   // one picture at a time: in Advanced
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

  return { render, renderFoot, get tab() { return tab; } };
}
