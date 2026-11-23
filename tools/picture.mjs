#!/usr/bin/env node
// A garment part's drawn picture (tools/picture.html): its template, or a first picture made from its shape. node tools/picture.mjs subaru [--part jacket] [--make template|art] [--paper 1]
// Writes <out>/<name>.png (default out: thin-check-out/; name: <preset>_<part>_<make>). The options are the page's, passed on as they are.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), q = [], rest = [];
const who = args[0] && !args[0].startsWith("--") ? args.shift() : "subaru";
for (let i = 0; i < args.length; i += 2) (["--out", "--chrome", "--npm"].includes(args[i]) ? rest : q).push(args[i], args[i + 1]);
const query = []; for (let i = 0; i < q.length; i += 2) query.push(`${q[i].slice(2)}=${encodeURIComponent(q[i + 1])}`);
const r = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "thin-check.mjs"), "--page", "picture", "--only", who, "--query", query.join("&"), ...rest], { stdio: "inherit" });
process.exit(r.status ?? 2);
