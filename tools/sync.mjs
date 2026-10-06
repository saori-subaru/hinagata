#!/usr/bin/env node
// Live sync between a recipe file and the Hinagata editor (2026-10-05, Saori: an agent makes the character, the editor fine-tunes it,
// both see each other's changes at once), and an MCP server for the agent on top of it (--mcp).
//
//   node sync.mjs character.json [--port 8790] [--editor https://…/editor/]          a helper you run yourself
//   node sync.mjs character.json --mcp [--port 8790]                                  the same, as an agent's MCP server (stdio)
//   (get it with: curl -O https://hinagata.pages.dev/sync.mjs — or tools/sync.mjs in the repository)
//
// The file is the character: a character file as the editor exports it, { "hinagata": 2, "name": …, "options": { the recipe: only what
// differs from the defaults } }. Whoever writes it (an agent, you in a text editor, git) is shown in the editor within a moment; what you
// change in the editor is written back into it (pretty-printed, keys in a steady order), so the agent sees your tweaks as a diff. A file
// that doesn't exist yet is made ({ "hinagata": 2, "options": {} }). "hinagata" is the recipe version: the defaults the recipe is written
// against. Version 1, and a bare recipe file (the options alone, as files were before 2026-10-06), mean the old chibi defaults; version 2
// the tall standard body. A file keeps its form and version: the editor writes a bare file back bare, relative to the old defaults.
//
// It prints a link: the editor opened with ?sync=<port>&key=<key> connects here. The key (random, per run) keeps other web pages from
// reading or overwriting the file: every request must carry it. Only this one file is ever read or written. No dependencies.
//
// HTTP (all with ?key= or the X-Hinagata-Key header; "recipe" is the file's whole content):  GET /recipe → { recipe, rev }  ·  PUT /recipe { recipe, from } → { rev }
//   GET /events → Server-Sent Events: "recipe" { recipe, rev, from, file } first, then each time it changes (from: "file" | an editor's id);
//                 "request" { rid, cmd, args }: something only the editor can do (a picture of the character), answered with
//   POST /response { rid, result | error }
//
// MCP (--mcp; JSON-RPC over stdin / stdout, logs on stderr): tools for the agent: editor_link, get_recipe, update_recipe, check_recipe,
// find_options (the options' schema: docs/options.schema.json next to this file in the repository, else the site's copy) and screenshot
// (rendered by the connected editor). Claude Code: claude mcp add hinagata -- node /path/to/sync.mjs /path/to/character.json --mcp
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; }, flag = (k) => { const i = args.indexOf(k); return i >= 0 ? !!args.splice(i, 1) : false; };
const PORT = +opt("--port", 8790), EDITOR = opt("--editor", "https://hinagata.pages.dev/editor/"), MCP = flag("--mcp"), FILE = args[0];
const say = (...m) => (MCP ? console.error : console.log)(...m);   // MCP: stdout is the protocol's
if (!FILE) { console.error("usage: node sync.mjs character.json [--mcp] [--port 8790] [--editor URL]"); process.exit(1); }
const file = path.resolve(FILE), KEY = crypto.randomBytes(9).toString("base64url"), LINK = `${EDITOR}?sync=${PORT}&key=${KEY}`;

// RECIPE_VERSION in src/options.js (this file has no dependencies): the version of a file made here
const VERSION = 2;
// the file's content (a character file, or a bare recipe), parsed; rev counts changes from either side
let recipe = {}, rev = 0, written = null;
const isFile = (d) => !!d && typeof d === "object" && "hinagata" in d && !!d.options && typeof d.options === "object" && !Array.isArray(d.options);
const optsOf = (d) => isFile(d) ? d.options : d;   // the recipe itself
const withOpts = (d, o) => isFile(d) ? { ...d, options: o } : o;
const versionOf = (d) => isFile(d) ? (Number.isInteger(d.hinagata) && d.hinagata >= 1 ? d.hinagata : 1) : 1;   // written: the text this program last wrote (its own write coming back from the watcher is not a change)
const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v;
const text = (r) => JSON.stringify(sorted(r), null, 2) + "\n";
function read() {
  let t; try { t = fs.readFileSync(file, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; const r = { hinagata: VERSION, options: {} }; t = text(r); fs.writeFileSync(file, t); written = t; recipe = r; rev++; return true; }
  if (t === written) return false;
  let r; try { r = JSON.parse(t || "{}"); } catch (e) { say(`  ${path.basename(file)}: not JSON yet (${e.message}); waiting for the next save`); return false; }
  if (!r || typeof r !== "object" || Array.isArray(r) || ("hinagata" in r && !isFile(r))) { say(`  ${path.basename(file)}: a character file is an object ({ "hinagata": ${VERSION}, "options": { … } })`); return false; }
  recipe = r; rev++; written = null; return true;
}
function write(r, from) { recipe = r; rev++; written = text(recipe); fs.writeFileSync(file, written); broadcast(from); }
read();

const clients = new Set();
const send = (res, ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
const NAME = path.basename(file), broadcast = (from) => { for (const c of clients) if (c.id !== from) send(c.res, "recipe", { recipe, rev, from, file: NAME }); };

// asking the editor (the newest one connected) for something; answered on POST /response
const pending = new Map();
function ask(cmd, a = {}, ms = 30000) {
  const c = [...clients].at(-1); if (!c) return Promise.reject(new Error(`no editor is connected: open ${LINK}`));
  const rid = crypto.randomBytes(6).toString("hex");
  return new Promise((ok, no) => { const t = setTimeout(() => { pending.delete(rid); no(new Error("the editor didn't answer in time")); }, ms); pending.set(rid, { ok, no, t }); send(c.res, "request", { rid, cmd, args: a }); });
}

let watchT = 0;
fs.watch(path.dirname(file), (_, name) => { if (name && name !== path.basename(file)) return; clearTimeout(watchT); watchT = setTimeout(() => { try { if (read()) { say(`  file changed → editor (rev ${rev})`); broadcast("file"); } } catch (e) { say(e.message); } }, 80); });   // (the directory: editors that save by replacing the file stay watched)

const cors = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Hinagata-Key");
  res.setHeader("Access-Control-Allow-Private-Network", "true");   // a page on the web reaching a local server (Chrome asks first)
};
const body = (req, then) => { let b = ""; req.on("data", (d) => { b += d; if (b.length > 48 << 20) req.destroy(); }); req.on("end", () => { let m; try { m = JSON.parse(b); } catch { m = null; } then(m); }); };
http.createServer((req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://x"), key = url.searchParams.get("key") ?? req.headers["x-hinagata-key"];
  if (key !== KEY) { res.writeHead(403, { "Content-Type": "text/plain" }); return res.end("wrong key"); }
  if (url.pathname === "/recipe" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ recipe, rev, file: NAME })); }
  if (url.pathname === "/recipe" && req.method === "PUT") return body(req, (m) => {
    if (!m?.recipe || typeof m.recipe !== "object" || Array.isArray(m.recipe)) { res.writeHead(400); return res.end("no recipe"); }
    write(m.recipe, m.from ?? null); say(`  editor → file (rev ${rev})`);
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ rev }));
  });
  if (url.pathname === "/response" && req.method === "POST") return body(req, (m) => {
    const p = m && pending.get(m.rid); if (p) { pending.delete(m.rid); clearTimeout(p.t); if (m.error) p.no(new Error(m.error)); else p.ok(m.result); }
    res.writeHead(204); res.end();
  });
  if (url.pathname === "/events" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const c = { res, id: url.searchParams.get("id") }; clients.add(c); send(res, "recipe", { recipe, rev, from: "start", file: NAME });
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => { clearInterval(ping); clients.delete(c); });
    return;
  }
  res.writeHead(404); res.end();
}).on("error", (e) => { say(`Hinagata sync: ${e.code === "EADDRINUSE" ? `port ${PORT} is taken (another sync running? --port another)` : e.message}`); if (!MCP) process.exit(1); })
  .listen(PORT, "127.0.0.1", () => say(`Hinagata sync: ${file}\n  open the editor with:\n  ${LINK}\n  ${MCP ? "(MCP server on stdio)" : "(Ctrl+C to stop)"}`));

if (MCP) mcp();

// ── the options' schema (for checking and finding options): next to this file in the repository, else the site's copy ──
let SCHEMA = null;
async function schema() {
  if (SCHEMA) return SCHEMA;
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const f of [path.join(here, "../docs/options.schema.json"), path.join(here, "options.schema.json")]) try { return SCHEMA = JSON.parse(fs.readFileSync(f, "utf8")).options; } catch {}
  const r = await fetch(new URL("../options.schema.json", EDITOR)); if (!r.ok) throw new Error(`couldn't get the options' schema (${r.status})`);
  return SCHEMA = (await r.json()).options;
}
// a recipe against the schema (the engine's checkOptions, here without the engine): unknown paths, wrong types, values not offered, out of range
function check(r, S) {
  const out = [], keys = Object.keys(S);
  const walk = (o, pre) => { for (const [k, v] of Object.entries(o ?? {})) { const p = pre ? `${pre}.${k}` : k, e = S[p];
    if (!e) { if (v && typeof v === "object" && !Array.isArray(v) && keys.some((x) => x.startsWith(p + "."))) walk(v, p); else out.push(`${p}: unknown option`); continue; }
    if (v === null) { if (!e.nullable) out.push(`${p}: null is not allowed`); continue; }
    if (e.type === "json") continue;
    if (e.type === "number") { if (typeof v !== "number" || !isFinite(v)) out.push(`${p}: not a number`); else if (!e.soft && (v < e.min || v > e.max)) out.push(`${p}: outside ${e.min}..${e.max}`); }
    else if (e.type === "boolean") { if (typeof v !== "boolean") out.push(`${p}: not true / false`); }
    else if (e.type === "color") { if (typeof v !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) out.push(`${p}: not a #rrggbb color`); }
    else if (e.type === "enum") { if (!(e.options ?? []).some((o) => o.value === v) && !(p.startsWith("face.parts.") && String(v).startsWith("image@")) && !(p === "hair.bangs" && v === "parted")) out.push(`${p}: not one of ${(e.options ?? []).map((o) => o.value).join(", ")}`); }
    else if (e.type === "image") { if (typeof v !== "string") out.push(`${p}: not an image path or data URL`); } } };
  walk(r, ""); return out;
}
const setPath = (o, p, v) => { const ks = p.split("."); let x = o; for (const k of ks.slice(0, -1)) { if (!x[k] || typeof x[k] !== "object" || Array.isArray(x[k])) x[k] = {}; x = x[k]; } x[ks.at(-1)] = v; };
const delPath = (o, p) => { const ks = p.split("."), stack = [o]; for (const k of ks.slice(0, -1)) { const n = stack.at(-1)?.[k]; if (!n || typeof n !== "object") return; stack.push(n); }
  delete stack.at(-1)[ks.at(-1)]; for (let i = stack.length - 1; i > 0; i--) if (!Object.keys(stack[i]).length) delete stack[i - 1][ks[i - 1]]; };   // (and the objects it leaves empty)
const L = (x) => typeof x === "string" ? x : x ? [x.ja, x.en].filter(Boolean).join(" / ") : "";

// ── MCP over stdio ──
function mcp() {
  const TOOLS = [
    { name: "editor_link", description: "The link that opens the Hinagata editor on this character (give it to the user), and whether an editor is connected now.", inputSchema: { type: "object", properties: {} } },
    { name: "get_recipe", description: `The character as it is in ${NAME} now: the file ({ hinagata: version, name, options }; options = what differs from the defaults of that version), the editor's changes included.`, inputSchema: { type: "object", properties: {} } },
    { name: "update_recipe", description: "Change the character: set options by their dotted paths (as in find_options; paths inside the file's options), e.g. { \"colors.hair\": \"#f3f1ee\", \"hair.tail.kind\": \"side\" }, and/or put options back to their defaults (reset; the defaults of the file's version). Written to the file and shown in the editor at once. Returns the problems the schema finds, if any.",
      inputSchema: { type: "object", properties: { set: { type: "object", description: "{ \"dotted.path\": value }" }, reset: { type: "array", items: { type: "string" }, description: "dotted paths to put back to their defaults" } } } },
    { name: "check_recipe", description: "Check the recipe (the file's, or one given) against the options' schema: unknown options, wrong types, values not offered, numbers out of range.", inputSchema: { type: "object", properties: { recipe: { type: "object" } } } },
    { name: "find_options", description: "Find options by words (Japanese or English, in their names, paths or help), e.g. \"ponytail\", \"スカート\", \"hair.tail\". Each: its path, type, range or choices, default and what it does.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", description: "default 30" } }, required: ["query"] } },
    { name: "screenshot", description: "A picture of the character as it is now, rendered by the connected editor (it must be open: editor_link). view: free | front | side | back | face; pose: idle (default), walk, run, sitChair, sitFloor, wave, …",
      inputSchema: { type: "object", properties: { view: { type: "string" }, pose: { type: "string" }, size: { type: "number", description: "pixels, default 640" } } } },
  ];
  const text = (t) => ({ content: [{ type: "text", text: t }] });
  async function call(name, a = {}) {
    if (name === "editor_link") return text(`${LINK}\n${clients.size ? `${clients.size} editor(s) connected` : "no editor connected yet"}`);
    if (name === "get_recipe") return text(JSON.stringify(recipe, null, 2) + (versionOf(recipe) < VERSION ? `\n(version ${versionOf(recipe)}${isFile(recipe) ? "" : ", a bare recipe"}: made against the old defaults, the chibi body (about 3 heads): what isn't set is the chibi's. Today's default is the tall standard body.)` : ""));
    if (name === "update_recipe") {
      const r = structuredClone(optsOf(recipe)); for (const p of a.reset ?? []) delPath(r, p); for (const [p, v] of Object.entries(a.set ?? {})) setPath(r, p, v);
      write(withOpts(recipe, r), "agent"); say(`  agent → file (rev ${rev})`);
      let probs = []; try { probs = check(r, await schema()); } catch (e) { probs = [`(not checked: ${e.message})`]; }
      return text(`written (rev ${rev})${probs.length ? `\nproblems:\n- ${probs.join("\n- ")}` : "\nno problems"}`);
    }
    if (name === "check_recipe") { const probs = check(optsOf(a.recipe ?? recipe), await schema()); return text(probs.length ? `- ${probs.join("\n- ")}` : "no problems"); }
    if (name === "find_options") {
      const S = await schema(), q = String(a.query ?? "").toLowerCase().split(/\s+/).filter(Boolean), hits = [];
      for (const e of Object.values(S)) { const hay = `${e.path} ${L(e.label)} ${L(e.help)} ${L(e.section)} ${(e.options ?? []).map((o) => `${o.value} ${L(o.label)}`).join(" ")}`.toLowerCase(); if (q.every((w) => hay.includes(w))) hits.push(e); }
      hits.sort((x, y) => (x.tier === "main" ? 0 : 1) - (y.tier === "main" ? 0 : 1) || (x.order ?? 1e9) - (y.order ?? 1e9));
      const line = (e) => `${e.path} (${e.type}${e.type === "number" ? ` ${e.min}..${e.max}` : ""}${e.options ? `: ${e.options.map((o) => o.value).join(" | ")}` : ""}${e.nullable ? ", null = auto" : ""}) default ${JSON.stringify(e.default)} — ${L(e.label)}${e.help ? `: ${L(e.help)}` : ""}${e.when ? ` [only when ${JSON.stringify(e.when)}]` : ""}`;
      return text(hits.length ? hits.slice(0, a.limit ?? 30).map(line).join("\n") + (hits.length > (a.limit ?? 30) ? `\n… ${hits.length - (a.limit ?? 30)} more` : "") : "nothing found");
    }
    if (name === "screenshot") { const r = await ask("screenshot", { view: a.view ?? "free", pose: a.pose ?? null, size: a.size ?? 640 }); return { content: [{ type: "image", data: r.png, mimeType: "image/png" }] }; }
    throw new Error(`unknown tool ${name}`);
  }
  const out = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(line); } });
  process.stdin.on("end", () => process.exit(0));
  async function handle(line) {
    let m; try { m = JSON.parse(line); } catch { return out({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); }
    const reply = (result) => m.id !== undefined && out({ jsonrpc: "2.0", id: m.id, result }), fail = (code, message) => m.id !== undefined && out({ jsonrpc: "2.0", id: m.id, error: { code, message } });
    if (m.method === "initialize") return reply({ protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "hinagata", version: "0.1" },
      instructions: `Hinagata: a 3D character (tall by default, or chibi) made from a recipe (options as JSON) in ${NAME}. Change it with update_recipe (find_options to learn the options), look at it with screenshot once the user has the editor open (editor_link). The user fine-tunes it in the editor; get_recipe shows their changes.` });
    if (m.method === "ping") return reply({});
    if (m.method === "tools/list") return reply({ tools: TOOLS });
    if (m.method === "tools/call") { try { return reply(await call(m.params?.name, m.params?.arguments ?? {})); } catch (e) { return reply({ content: [{ type: "text", text: String(e.message ?? e) }], isError: true }); } }
    if (m.method?.startsWith("notifications/")) return;
    fail(-32601, `no method ${m.method}`);
  }
}
