#!/usr/bin/env node
// Shots of a preset (tools/shot.html), run as the thinning check is: node tools/shot.mjs subaru --views 0,90,180 --y 0,0.5 --name boots
// Writes <out>/<name>.png (default out: thin-check-out/). The options are shot.html's, passed on as they are.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), q = [], rest = [];
const who = args[0] && !args[0].startsWith("--") ? args.shift() : "subaru";
for (let i = 0; i < args.length; i += 2) (["--out", "--chrome", "--npm"].includes(args[i]) ? rest : q).push(args[i], args[i + 1]);
const query = []; for (let i = 0; i < q.length; i += 2) query.push(`${q[i].slice(2)}=${encodeURIComponent(q[i + 1])}`);
const r = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "thin-check.mjs"), "--page", "shot", "--only", who, "--query", query.join("&"), ...rest], { stdio: "inherit" });
process.exit(r.status ?? 2);
