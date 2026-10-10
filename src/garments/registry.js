// Garment parts that describe themselves (2026-10-10, after 島風: "他のユーザーのエージェントが parts を追加しつつキャラを作った場合";
// a part then had to be wired into eight places: the clothes' shapes, the part table, the meshes, their colors, what is worn, the cache's
// key, the defaults, the schema and the editor). A part is now one module that calls definePart; src/garments/index.js imports them all.
// Everything else reads PARTS: options.js (the defaults), schema.js (the options' descriptions, the editor's panels), clothes/index.js
// (the shapes, also in the build workers), parts.js (the part table), index.js (the meshes, colors, bands, setWorn, setColors, the cache).
// No three.js here or in the part modules (the build workers and Node read them).
//
// definePart({
//   src: import.meta.url,           the module (the mesh cache's key holds its text: editing the part never serves a stale mesh)
//   name: "gloves",                the mesh part's name, its setColors key ({ gloves: "#fff" }) and, unless group says otherwise, its setWorn garment
//   path: "outfit.gloves",          where its options live; defaults: { on, color, ... } merged into DEFAULTS there
//   group: "shirt",                 (optional) the garment it goes on and off with (setWorn({ shirt: false }) takes the sailor collar off too)
//   section: { ja, en },            the editor's section; schema: [[key, { ja, en }, extras], ...] for its options (keys under path; extras as
//                                   in src/schema.js MAIN: min, max, step, options, nullable, type, when (paths relative to path start with "."), help)
//   built: (O) => O.on,             (optional) built only when this is true (it goes into the cache's key); default: O.on
//   build(ctx) → state | null       the shapes (a distance function, a band's value...) from ctx: { OPT, O (its options), P, J, bodySdf, shirtSdf,
//                                   slope (y → how many times a base height is stretched there) }
//   spec(state, { OPT, H, B, ax, ay, kit, none }) → { sdf, fast, lo, hi, h, bone1, only, soft, make }   its entry in the part table (parts.js)
//   outline: 0.003, soft: true,     the outline's width (m at outline.width 1); shading by softened normals
//   thin: null | "cloth" | "keep",  how the "fine" and "lite" builds thin it: as the body / as cloth (less) / not at all
//   bands: { value: (state) => (x, y, z) => t, ranges: (O) => [[lo, hi, color], ...] }   (optional) colored bands painted by a value per vertex
//                                   (materials.js withBands; base positions): a collar's line, a cuff. Their options change instantly (setBands)
// })
export const PARTS = [];
export function definePart(d) {
  if (PARTS.some((p) => p.name === d.name)) throw new Error(`definePart: "${d.name}" is defined twice`);
  const p = { group: d.name, outline: 0.003, soft: true, thin: null, built: (O) => !!O?.on, schema: [], ...d };
  PARTS.push(p); return p;
}
export const partNamed = (name) => PARTS.find((p) => p.name === name) ?? null;
export const getPath = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
export const partOptions = (OPT, p) => getPath(OPT, p.path) ?? {};
/** merge every part's defaults into the defaults (options.js, once) */
export function addDefaults(DEFAULTS) {
  for (const p of PARTS) { const keys = p.path.split("."); let o = DEFAULTS; for (const k of keys.slice(0, -1)) o = o[k] ??= {}; o[keys.at(-1)] = { ...(p.defaults ?? {}), ...(o[keys.at(-1)] ?? {}) }; }
}
/** the schema's entries for every part (schema.js MAIN): paths made absolute, the color tied to setColors, `on` rebuilding the clothes */
export function schemaEntries(parts = PARTS) {
  const out = [];
  for (const p of parts) for (const [key, label, ex = {}] of p.schema) {
    const path = `${p.path}.${key}`, when = ex.when ? Object.fromEntries(Object.entries(ex.when).map(([k, v]) => [k.startsWith(".") ? p.path + k : k, v])) : undefined;
    const auto = key === "color" ? { cost: "instant", apply: "setColors", colorKey: p.name } : key === "on" ? { cost: "clothes" } : p.bands?.keys?.includes(key) ? { cost: "instant", apply: "setBands" } : {};
    out.push([path, label, { section: p.section, ...auto, ...ex, ...(when ? { when } : {}) }]); }
  return out;
}
/** each part's shapes (clothes/index.js buildClothes, also in the workers) */
export function buildGarments(OPT, ctx) {
  const out = {};
  for (const p of PARTS) { const O = partOptions(OPT, p); out[p.name] = p.built(O) ? p.build({ ...ctx, OPT, O }) ?? null : null; }
  return out;
}
/** what goes into the cache's key: which parts are built */
export const builtKey = (OPT) => PARTS.map((p) => (p.built(partOptions(OPT, p)) ? 1 : 0)).join("");
