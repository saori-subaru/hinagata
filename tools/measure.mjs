#!/usr/bin/env node
// A character's proportions, and its body from proportions (2026-10-10; src/measure.js). For agents and people working on a character file.
//
//   node tools/measure.mjs character.json                          how tall, how many heads, where the chin, shoulders, hips, knees are
//   node tools/measure.mjs character.json --fit heads=6.5,hip=0.5  the body options that come nearest (heads; hip, knee, shoulder, chin as
//                                                                  shares of the height; height in m), and what it measures then
//        … --write                                                 and put them into the file
//   node tools/measure.mjs character.json --to 0.38                a height on the character (a share of its height, or "0.62m") as the
//                                                                  options take heights (base space: the body before body.proportion
//                                                                  stretches it), e.g. for outfit.pants.skirt.hem
//   node tools/measure.mjs character.json --at 0.3                 the other way: an option's height (base space) on the character
// The height is to the top of the head (the skull; the hair adds a little), standing in its shoes. Widths and depths are not stretched.
import fs from "node:fs";
import { measureCharacter, fitProportions } from "../src/measure.js";
import { setPath } from "../src/options.js";

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; }, flag = (k) => { const i = args.indexOf(k); return i >= 0 ? !!args.splice(i, 1) : false; };
const FIT = opt("--fit"), TO = opt("--to"), AT = opt("--at"), WRITE = flag("--write"), FILE = args[0];
if (!FILE) { console.error("usage: node tools/measure.mjs character.json [--fit heads=6.5,hip=0.5 [--write]] [--to 0.38 | --to 0.6m] [--at 0.3]"); process.exit(1); }
const doc = JSON.parse(fs.readFileSync(FILE, "utf8"));
const f3 = (v) => v.toFixed(3);
const show = (m) => { console.log(`height ${f3(m.height)} m, ${m.heads.toFixed(2)} heads${m.lift ? ` (heels lift it ${f3(m.lift)} m)` : ""}`);
  for (const k of ["chin", "shoulder", "hip", "knee", "ankle"]) console.log(`  ${k.padEnd(9)}${f3(m.at[k])} m  ${f3(m.share[k])} of the height`); };

if (FIT) {
  const targets = Object.fromEntries(FIT.split(",").map((s) => s.split("=")).map(([k, v]) => [k.trim(), +v]));
  const bad = Object.keys(targets).filter((k) => !["heads", "hip", "knee", "shoulder", "chin", "height"].includes(k) || !isFinite(targets[k]));
  if (bad.length) { console.error(`--fit: ${bad.join(", ")}? (heads, hip, knee, shoulder, chin, height)`); process.exit(1); }
  const r = fitProportions(doc, targets);
  console.log("now:"); show(r.before);
  console.log(Object.keys(r.set).length ? `set: ${JSON.stringify(r.set)}` : "nothing to change"); console.log("then:"); show(r.after);
  if (WRITE && Object.keys(r.set).length) { const o = "hinagata" in doc ? (doc.options ??= {}) : doc; for (const [p, v] of Object.entries(r.set)) setPath(o, p, v);
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n"); console.log(`written into ${FILE}`); }
} else {
  const m = measureCharacter(doc);
  if (TO) { const v = TO.endsWith("m") ? parseFloat(TO) : parseFloat(TO) * m.height; console.log(`${TO} → ${f3(m.base(v))} (base space: as the options take heights; on the character ${f3(v)} m)`); }
  else if (AT) { const v = m.built(parseFloat(AT)); console.log(`${AT} (base space) → ${f3(v)} m on the character, ${f3(v / m.height)} of its height`); }
  else show(m);
}
