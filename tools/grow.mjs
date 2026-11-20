#!/usr/bin/env node
// 成長動画(ちび → 本人)を作る: tools/grow.html を Playwright で開き、コマごとに作り直して撮り、ffmpeg で mp4 に繋ぐ。
//   node tools/grow.mjs [--who sylvie2] [--from girl] [--frames 72] [--fps 24] [--hold 12] [--out grow-out] [--npm node_modules] [--chrome path]
// クラウドでは CDN に出られないので --npm に three@0.160.0 と meshoptimizer@1 を入れた node_modules を渡す。
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), OUT = path.resolve(opt("--out", "grow-out")), NPM = opt("--npm", "") && path.resolve(opt("--npm"));
const N = +opt("--frames", 72), FPS = +opt("--fps", 24), HOLD = +opt("--hold", 12), WHO = opt("--who", "sylvie2"), FROM = opt("--from", "girl");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, "http://x").pathname), own = NPM && u.startsWith("/__npm/"), base = own ? NPM : ROOT, p = path.join(base, own ? u.slice(7) : u);
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  if (NPM && !own && p.endsWith(".html")) res.end(fs.readFileSync(p, "utf8").replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^@\/"]+)@[^\/"]+\//g, "/__npm/$1/")); else fs.createReadStream(p).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const require = createRequire(path.join(process.cwd(), "x.js")); let pw; try { pw = require("playwright"); } catch { pw = createRequire("/usr/lib/node_modules/")("playwright"); }
const browser = await pw.chromium.launch({ ...(opt("--chrome") ? { executablePath: opt("--chrome") } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage(); page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/grow.html?who=${WHO}&from=${FROM}`); await page.waitForFunction("window.READY", null, { timeout: 120e3 });
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
// 1コマ目は終点(背の一番高い形)で撮って枠を決める。なめらかに見えるよう t はイーズイン・アウト
await page.evaluate(() => window.frame(1));
const ease = (x) => x * x * (3 - 2 * x); let k = 0;
const save = (url) => fs.writeFileSync(path.join(OUT, `f${String(k++).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
for (let i = 0; i < N; i++) { const t = ease(i / (N - 1)), url = await page.evaluate((t) => window.frame(t), t);
  for (let h = 0; h < (i === 0 || i === N - 1 ? HOLD : 1); h++) save(url); process.stdout.write(`\r${i + 1}/${N}`); }
await browser.close(); server.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(OUT, "f%04d.png"), "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(OUT, "grow.mp4")]);
console.log(`\n${path.join(OUT, "grow.mp4")}`);
