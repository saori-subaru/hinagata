// A few build workers, made once per page and reused by every createAvatar.
// If workers can't start (an old browser, a page that forbids them, Node), buildPool() returns null and everything
// stays on the main thread — the result is the same mesh either way, only slower.

let workers = null, broken = false, seq = 0;
const TIMEOUT = 15000;   // ms for one job (a job is a slab or a slice: well under a second normally)
const waiting = new Map();   // job id → { ok, ng, w }

function fail(reason) {   // a worker died or never loaded: stop using workers, and let the waiting jobs fall back to the main thread
  broken = true;
  for (const [, j] of waiting) j.ng(new Error(reason));
  waiting.clear();
  for (const w of workers || []) try { w.terminate(); } catch { /* already gone */ }
  workers = null;
}
// the worker's script. An engine served from another origin than the page's (the editor running someone's own engine from this machine,
// tools/sync.mjs --engine) can't be a worker itself (a worker's script must be the page's origin): a small one of the page's own imports it
let blobURL = null;
function workerURL() {
  const u = new URL("./worker.js", import.meta.url);
  if (typeof location === "undefined" || u.origin === location.origin) return u;
  return blobURL ??= URL.createObjectURL(new Blob([`import ${JSON.stringify(u.href)};`], { type: "text/javascript" }));
}

/** The pool (an array of workers), or null when workers aren't available. */
export function buildPool() {
  if (broken || typeof Worker === "undefined") return null;
  if (workers) return workers;
  try {
    const n = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 2) - 1));
    workers = Array.from({ length: n }, () => {
      const w = new Worker(workerURL(), { type: "module" });
      w.pending = 0;
      w.onmessage = ({ data }) => { const j = waiting.get(data.id); if (!j) return; waiting.delete(data.id); w.pending--; data.error ? j.ng(new Error(data.error)) : j.ok(data); };
      w.onerror = (e) => { e.preventDefault?.(); fail("build worker failed: " + (e.message || "could not load")); };
      return w;
    });
    return workers;
  } catch (e) { broken = true; return null; }
}

/** Send one part to the least busy worker. Resolves { rec, grid, time, ms }; rejects if the worker can't do it. */
export function runPart(job, transfer = []) {
  const ws = buildPool(); if (!ws) return Promise.reject(new Error("no workers"));
  const w = ws.reduce((a, b) => (b.pending < a.pending ? b : a)), id = ++seq;
  w.pending++;
  return new Promise((ok, ng) => {
    const timer = setTimeout(() => fail("build worker timed out"), TIMEOUT);   // a worker that never answers (blocked, crashed silently): give up on workers
    waiting.set(id, { ok: (v) => { clearTimeout(timer); ok(v); }, ng: (e) => { clearTimeout(timer); ng(e); }, w });
    w.postMessage({ ...job, id }, transfer);
  });
}
