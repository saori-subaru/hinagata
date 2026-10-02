// Remember generated meshes in the browser (IndexedDB), so the same character comes back instantly the second time.
//
// The key holds the resolved options AND the source text of every module that shapes the mesh,
// so editing the sculpt code (or any option) makes a new key by itself — old entries are never served by mistake.
// Only the newest KEEP characters are kept. Anything that fails (no IndexedDB, private mode, quota) just means "not cached".

const DB = "hinagata-mesh", MESH = "mesh", META = "meta", KEEP = 12;
// modules whose code changes the generated geometry or its skin weights
const SOURCES = ["index.js", "options.js", "parts.js", "build.js", "worker.js", "weights.js", "sdf/prim.js", "sdf/mesh.js", "body/index.js", "body/types.js", "clothes/index.js", "hair/index.js", "rig.js"];

function fnv(s, h) { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** A short key from any mix of strings and JSON-able values. */
export function hashKey(...parts) {
  const s = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("|");
  return fnv(s, 2166136261).toString(36) + fnv(s, 0x9e3779b9).toString(36) + s.length.toString(36);
}

let srcHash = null;
setTimeout(() => { try { sourceHash(); } catch { /* no fetch: fine */ } }, 0);   // start fetching the sources as soon as the library loads (the first avatar doesn't wait for it)
/** Hash of the generator's source files (fetched once per page; the browser usually has them cached already). */
export function sourceHash() {
  srcHash ??= Promise.all(SOURCES.map((p) => fetch(new URL("./" + p, import.meta.url)).then((r) => (r.ok ? r.text() : "")).catch(() => "")))
    .then((texts) => hashKey(...texts));
  return srcHash;
}

let dbp = null;
function db() {
  dbp ??= new Promise((ok, ng) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(MESH); r.result.createObjectStore(META); };
    r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
  });
  return dbp;
}
const done = (req) => new Promise((ok, ng) => { req.onsuccess = () => ok(req.result); req.onerror = () => ng(req.error); });

/** The meshes stored for one character: { partName: { pos, nor, idx, si, sw } }, or null. */
export async function cacheGet(key) {
  try {
    const d = await db(), rec = await done(d.transaction(MESH).objectStore(MESH).get(key));
    if (rec) d.transaction(META, "readwrite").objectStore(META).put(Date.now(), key);   // touch: recently used
    return rec || null;
  } catch { return null; }
}

/** Store (or add to) one character's meshes, then drop the oldest characters beyond KEEP. Fire and forget. */
export async function cachePut(key, parts) {
  try {
    const d = await db(), old = await done(d.transaction(MESH).objectStore(MESH).get(key));
    const t = d.transaction([MESH, META], "readwrite");
    t.objectStore(MESH).put({ ...(old || {}), ...parts }, key); t.objectStore(META).put(Date.now(), key);
    await new Promise((ok) => { t.oncomplete = ok; t.onerror = ok; t.onabort = ok; });
    const meta = d.transaction(META).objectStore(META), [keys, times] = await Promise.all([done(meta.getAllKeys()), done(meta.getAll())]);
    if (keys.length <= KEEP) return;
    const drop = keys.map((k, i) => [k, times[i]]).sort((a, b) => b[1] - a[1]).slice(KEEP).map((x) => x[0]);
    const t2 = d.transaction([MESH, META], "readwrite"); for (const k of drop) { t2.objectStore(MESH).delete(k); t2.objectStore(META).delete(k); }
  } catch { /* not cached — fine */ }
}
