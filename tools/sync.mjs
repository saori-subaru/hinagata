#!/usr/bin/env node
// Live sync between a recipe file and the Hinagata editor (2026-10-05, Saori: an agent makes the character, the editor fine-tunes it,
// both see each other's changes at once).
//
//   node sync.mjs character.json [--port 8790] [--editor https://…/editor/]
//   (get it with: curl -O https://hinagata.pages.dev/sync.mjs — or tools/sync.mjs in the repository)
//
// The file is the character: the recipe as JSON (only what differs from the defaults, as the editor's "copy code" gives it). Whoever writes
// it (an agent, you in a text editor, git) is shown in the editor within a moment; what you change in the editor is written back into it
// (pretty-printed, keys in a steady order), so the agent sees your tweaks as a diff. A file that doesn't exist yet is made ({}).
//
// It prints a link: the editor opened with ?sync=<port>&key=<key> connects here. The key (random, per run) keeps other web pages from
// reading or overwriting the file: every request must carry it. Only this one file is ever read or written. No dependencies.
//
// HTTP (all with ?key= or the X-Hinagata-Key header):  GET /recipe → { recipe, rev }  ·  PUT /recipe { recipe, rev } → { rev }
//   GET /events → Server-Sent Events: "recipe" { recipe, rev, from, file } first, then each time it changes (from: "file" | an editor's id)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const PORT = +opt("--port", 8790), EDITOR = opt("--editor", "https://hinagata.pages.dev/editor/"), FILE = args[0];
if (!FILE) { console.error("usage: node sync.mjs character.json [--port 8790] [--editor URL]"); process.exit(1); }
const file = path.resolve(FILE), KEY = crypto.randomBytes(9).toString("base64url");

// the recipe: parsed from the file; rev counts changes from either side
let recipe = {}, rev = 0, written = null;   // written: the text this program last wrote (its own write coming back from the watcher is not a change)
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
const text = (r) => JSON.stringify(sorted(r), null, 2) + "\n";
function read() {
  let t; try { t = fs.readFileSync(file, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; t = "{}\n"; fs.writeFileSync(file, t); written = t; }
  if (t === written) return false;
  let r; try { r = JSON.parse(t || "{}"); } catch (e) { console.warn(`  ${path.basename(file)}: not JSON yet (${e.message}); waiting for the next save`); return false; }
  if (!r || typeof r !== "object" || Array.isArray(r)) { console.warn(`  ${path.basename(file)}: a recipe is an object ({ … })`); return false; }
  recipe = r; rev++; written = null; return true;
}
read();

const clients = new Set();
const send = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
const NAME = path.basename(file), broadcast = (from) => { for (const c of clients) if (c.id !== from) send(c.res, "recipe", { recipe, rev, from, file: NAME }); };

let watchT = 0;
fs.watch(path.dirname(file), (_, name) => { if (name && name !== path.basename(file)) return; clearTimeout(watchT); watchT = setTimeout(() => { try { if (read()) { console.log(`  file changed → editor (rev ${rev})`); broadcast("file"); } } catch (e) { console.warn(e.message); } }, 80); });   // (the directory: editors that save by replacing the file stay watched)

const cors = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Hinagata-Key");
  res.setHeader("Access-Control-Allow-Private-Network", "true");   // a page on the web reaching a local server (Chrome asks first)
};
http.createServer((req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://x"), key = url.searchParams.get("key") ?? req.headers["x-hinagata-key"];
  if (key !== KEY) { res.writeHead(403, { "Content-Type": "text/plain" }); return res.end("wrong key"); }
  if (url.pathname === "/recipe" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ recipe, rev, file: path.basename(file) })); }
  if (url.pathname === "/recipe" && req.method === "PUT") {
    let body = ""; req.on("data", (d) => { body += d; if (body.length > 32 << 20) req.destroy(); });
    req.on("end", () => {
      let m; try { m = JSON.parse(body); } catch { res.writeHead(400); return res.end("not JSON"); }
      if (!m?.recipe || typeof m.recipe !== "object" || Array.isArray(m.recipe)) { res.writeHead(400); return res.end("no recipe"); }
      recipe = m.recipe; rev++; written = text(recipe); fs.writeFileSync(file, written);
      console.log(`  editor → file (rev ${rev})`); broadcast(m.from ?? null);
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rev }));
    });
    return;
  }
  if (url.pathname === "/events" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const c = { res, id: url.searchParams.get("id") }; clients.add(c); send(res, "recipe", { recipe, rev, from: "start", file: NAME });
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => { clearInterval(ping); clients.delete(c); });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, "127.0.0.1", () => {
  const link = `${EDITOR}?sync=${PORT}&key=${KEY}`;
  console.log(`Hinagata sync: ${file}\n  open the editor with:\n  ${link}\n  (Ctrl+C to stop)`);
});
