// Live sync with a recipe file through tools/sync.mjs (2026-10-05, Saori: an agent makes the character in a file, the editor fine-tunes it;
// each sees the other's changes at once). The editor opened with ?sync=<port>&key=<key> connects to the helper on this machine:
// the file's recipe comes in as a character of its own (named after the file) and every change to the file is applied as one undo step;
// what is changed here is written back into the file (a moment after the gesture ends, only what differs from the defaults).
import { changedPaths, getPath, compact, recipeOf } from "./store.js";

/** { port, key }: where the helper is / store: the recipe / onStart(recipe, fileName): the first recipe (the app switches to it) /
 *  onStatus(state, fileName): "on" | "off" | "error" */
export function connectSync({ port, key, store, onStart, onStatus }) {
  const base = `http://127.0.0.1:${port}`, id = Math.random().toString(36).slice(2, 10), q = `key=${encodeURIComponent(key)}`;
  let started = false, remote = false, file = "", pushT = 0, live = false;

  function applyRemote(r) {   // the file's recipe → the store, as one undo step (only the values that changed)
    const full = recipeOf(r), ch = {};
    for (const p of changedPaths(store.recipe, full)) ch[p] = structuredClone(getPath(full, p));
    if (!Object.keys(ch).length) return;
    remote = true; try { store.set(ch, { commit: true }); } finally { remote = false; }
  }
  const es = new EventSource(`${base}/events?${q}&id=${id}`);
  es.addEventListener("recipe", (e) => {
    const m = JSON.parse(e.data); if (!live) { live = true; onStatus("on", m.file ?? file); }
    file = m.file ?? file;
    if (!started) { started = true; remote = true; try { onStart(m.recipe, file); } finally { remote = false; } onStatus("on", file); return; }
    if (m.from !== id) applyRemote(m.recipe);
  });
  es.onerror = () => { if (live) { live = false; onStatus("off", file); } else if (!started) onStatus("error", file); };   // (it retries by itself)

  const push = () => fetch(`${base}/recipe`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Hinagata-Key": key }, body: JSON.stringify({ recipe: compact(store.recipe), from: id }) })
    .catch(() => onStatus("off", file));
  store.subscribe((paths, why) => {   // a finished change made here (not one that came from the file) → the file
    if (why === "set" || remote || !started || !paths.length) return;
    clearTimeout(pushT); pushT = setTimeout(push, 250);
  });
  return { close() { es.close(); }, get file() { return file; } };
}
