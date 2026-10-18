// Stop フック: 窓の文脈が 30万・60万トークンを超えた時だけ、画面に一言出す(止めない・各1回)。
// 原本は PC の ゲーム制作/断捨離ツール/context_nag.mjs。各リポジトリの .claude/hooks/ へ install_nag.mjs で写す(クラウドでも動くようにリポジトリに置く)。
// systemMessage は画面に出るだけでモデルの文脈には入らない=トークンを使わない。
import fs from 'fs';
import os from 'os';
import path from 'path';
const LEVELS = [
  [300000, 'おい、この窓そろそろ重くなってきたぞ(文脈30万トークン超え)。区切りのいい所で新しいスレッドにしな。「引継ぎ書いて」と言えば、次の窓に貼るメモを書く。'],
  [600000, 'この窓、もう60万トークン超え。1回やり取りするたびに、30万の時の倍の値段で読み直してる。「引継ぎ書いて」→新しいスレッドへ、が一番安い。'],
];
const RESET = 150000; // 要約で文脈が縮んだら、また知らせられるように戻す
try {
  const inp = JSON.parse(fs.readFileSync(0, 'utf8'));
  const tp = inp.transcript_path;
  if (!tp || !fs.existsSync(tp)) process.exit(0);
  // 記録は数百MBになるので末尾だけ読む
  const size = fs.statSync(tp).size, n = Math.min(size, 4 << 20), buf = Buffer.alloc(n);
  const fd = fs.openSync(tp, 'r'); fs.readSync(fd, buf, 0, n, size - n); fs.closeSync(fd);
  let ctx = 0;
  for (const l of buf.toString('utf8').split('\n').reverse()) {
    if (!l.includes('"usage"')) continue;
    try {
      const u = JSON.parse(l).message?.usage;
      if (u) { ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); break; }
    } catch (e) {}
  }
  const sf = path.join(os.tmpdir(), `context_nag_${String(inp.session_id || 'x').replace(/[^\w-]/g, '')}.json`);
  let shown = 0;
  try { shown = JSON.parse(fs.readFileSync(sf, 'utf8')).shown || 0; } catch (e) {}
  if (ctx < RESET) shown = 0;
  let msg = null;
  for (let i = LEVELS.length - 1; i >= 0; i--) if (ctx >= LEVELS[i][0]) { if (shown <= i) { msg = LEVELS[i][1]; shown = i + 1; } break; }
  fs.writeFileSync(sf, JSON.stringify({ shown, ctx }));
  if (msg) console.log(JSON.stringify({ systemMessage: msg }));
} catch (e) {}
process.exit(0);
