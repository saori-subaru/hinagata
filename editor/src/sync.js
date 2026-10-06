// Live sync with a recipe file through tools/sync.mjs (2026-10-05, Saori: an agent makes the character in a file, the editor fine-tunes it;
// each sees the other's changes at once). The editor opened with ?sync=<port>&key=<key> connects to the helper on this machine:
// the file's recipe comes in as a character of its own (named after the file) and every change to the file is applied as one undo step;
// what is changed here is written back into the file (a moment after the gesture ends, only what differs from the defaults).
// The file keeps its form and recipe version (2026-10-06): a character file ({ hinagata, name, options }) stays one, of its version; a bare
// recipe file is version 1 (the chibi defaults it was written against) and is written back as one, relative to those defaults. In the
// editor the recipe is in today's terms (openRecipe), like every other character.
import { changedPaths, getPath, compact, recipeOf } from "./store.js";
import { openRecipe, recipeAt } from "../../src/index.js";

/** { port, key }: where the helper is / store: the recipe / onStart(recipe, fileName): the first recipe, resolved (the app switches to it) /
 *  onStatus(state, fileName): "on" | "off" | "error" */
export function connectSync({ port, key, store, onStart, onStatus, onRequest = async () => { throw new Error("not here"); } }) {
  const base = `http://127.0.0.1:${port}`, id = Math.random().toString(36).slice(2, 10), q = `key=${encodeURIComponent(key)}`;
  let started = false, remote = false, file = "", pushT = 0, live = false;
  let form = null;   // the file's form: { version, file: a character file or a bare recipe, keep: its other keys (name …) }
  const readIn = (raw) => { const o = openRecipe(raw, { bare: 1 }), { options: _o, hinagata: _h, ...keep } = o.file ? raw : {}; form = { version: o.version, file: o.file, keep }; return recipeOf(o.options); };
  const writeOut = () => { const r = recipeAt(form.version, compact(store.recipe)); return form.file ? { ...form.keep, hinagata: form.version, options: r } : r; };

  function applyRemote(r) {   // the file's recipe → the store, as one undo step (only the values that changed)
    const full = readIn(r), ch = {};
    for (const p of changedPaths(store.recipe, full)) ch[p] = structuredClone(getPath(full, p));
    if (!Object.keys(ch).length) return;
    remote = true; try { store.set(ch, { commit: true }); } finally { remote = false; }
  }
  const es = new EventSource(`${base}/events?${q}&id=${id}`);
  es.addEventListener("recipe", (e) => {
    const m = JSON.parse(e.data); if (!live) { live = true; onStatus("on", m.file ?? file); }
    file = m.file ?? file;
    if (!started) { started = true; remote = true; try { onStart(readIn(m.recipe), file); } finally { remote = false; } onStatus("on", file); return; }
    if (m.from !== id) applyRemote(m.recipe);
  });
  es.addEventListener("request", async (e) => {   // something the helper's MCP tools ask of the editor (a picture): answered on /response
    const m = JSON.parse(e.data); let reply;
    try { reply = { rid: m.rid, result: await onRequest(m.cmd, m.args ?? {}) }; } catch (err) { reply = { rid: m.rid, error: String(err?.message ?? err) }; }
    fetch(`${base}/response`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hinagata-Key": key }, body: JSON.stringify(reply) }).catch(() => {});
  });
  es.onerror = () => { if (live) { live = false; onStatus("off", file); } else if (!started) onStatus("error", file); };   // (it retries by itself)

  const push = () => fetch(`${base}/recipe`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Hinagata-Key": key }, body: JSON.stringify({ recipe: writeOut(), from: id }) })
    .catch(() => onStatus("off", file));
  store.subscribe((paths, why) => {   // a finished change made here (not one that came from the file) → the file
    if (why === "set" || remote || !started || !paths.length) return;
    clearTimeout(pushT); pushT = setTimeout(push, 250);
  });
  return { close() { es.close(); }, get file() { return file; } };
}
