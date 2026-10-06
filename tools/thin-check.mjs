#!/usr/bin/env node
// The thinning check, in one command (2026-10-06): run it after changing the engine (above all the thinning, the cells, the body's shape).
//
//   node tools/thin-check.mjs [--out dir] [--only case] [--runs full,s0.15] [--chrome path] [--keep]
//
// Serves the repository on 127.0.0.1, opens tools/thin-check.html in headless Chrome (or Edge) and waits for it: the bodies built unthinned
// and thinned ("game", "lite", simplify 0.15), cut across to measure their depth front to back. Writes thin-check.png (front and side
// pictures, the numbers under each) and thin-check.json to --out (default: thin-check-out/ in the current directory), prints the table, and
// exits 1 when a thinned body lost too much depth (the page's MIN). No dependencies (Node 22: fetch and WebSocket built in).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; }, flag = (k) => { const i = args.indexOf(k); return i >= 0 ? !!args.splice(i, 1) : false; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), OUT = path.resolve(opt("--out", "thin-check-out")), ONLY = opt("--only", ""), RUNS = opt("--runs", ""), KEEP = flag("--keep");
const CHROMES = [opt("--chrome", ""), process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const CHROME = CHROMES.find((p) => fs.existsSync(p));
if (!CHROME) { console.error("no Chrome found: pass --chrome path"); process.exit(2); }

// the repository, as files (only under ROOT)
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PAGE = `http://127.0.0.1:${server.address().port}/tools/thin-check.html?${ONLY ? `only=${encodeURIComponent(ONLY)}` : ""}${RUNS ? `&runs=${encodeURIComponent(RUNS)}` : ""}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hinagata-thin-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--window-size=1200,900", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const done = (code) => { try { chrome.kill(); } catch {} server.close(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); }, 300); };
const wsUrl = await new Promise((resolve, reject) => { let buf = ""; chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
  chrome.on("exit", (c) => reject(new Error(`Chrome exited (${c})`))); setTimeout(() => reject(new Error("Chrome didn't start")), 20000); });

// the DevTools protocol, by hand: one page target, Runtime.evaluate until the page sets window.RESULT
const ws = new WebSocket(wsUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nid = 0; const waiting = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.j(new Error(m.error.message)) : w.r(m.result); }
  else if (m.method === "Runtime.exceptionThrown") console.error("page:", m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  else if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) console.error(`page ${m.params.type}:`, m.params.args.map((a) => a.value ?? a.description).join(" ")); };
const send = (method, params = {}, sessionId) => new Promise((r, j) => { const id = ++nid; waiting.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Runtime.enable", {}, sessionId);
await send("Page.navigate", { url: PAGE }, sessionId);
console.log(`building (${PAGE}) …`);
const T0 = Date.now(); let R = null, last = "";
while (Date.now() - T0 < 15 * 60e3) {
  await new Promise((r) => setTimeout(r, 1000));
  const v = await send("Runtime.evaluate", { expression: "window.RESULT ? JSON.stringify(window.RESULT) : (document.getElementById('state')?.textContent || '')", returnByValue: true }, sessionId).catch(() => null);
  const s = v?.result?.value ?? ""; if (s.startsWith("{")) { R = JSON.parse(s); break; }
  if (s && s !== last) { console.log("  " + s); last = s; }
}
if (!R) { console.error("timed out"); done(2); }
else if (R.error) { console.error("the page failed: " + R.error); done(2); }
else {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "thin-check.png"), Buffer.from(R.png.split(",")[1], "base64"));
  const { png, ...rest } = R; fs.writeFileSync(path.join(OUT, "thin-check.json"), JSON.stringify(rest, null, 2) + "\n");
  console.log(R.table);
  console.log(`\n${R.ok ? "ok" : "FAILED"}: every thinned cut keeps ${Math.round(R.min * 100)}–${Math.round(R.max * 100)}% of the unthinned depth and width${R.ok ? "" : " — not so above"}.  ${path.join(OUT, "thin-check.png")}`);
  if (KEEP) console.log("(--keep: Chrome left running; Ctrl+C to stop)"); else done(R.ok ? 0 : 1);
}
