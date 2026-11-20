// A cute dance (Saori: 「可愛く踊る動き」, then 「キビキビしすぎてロボットダンス」: slower, swaying): 16 beats at 100 BPM (9.6 s), looping.
// Made of targets (motion/index.js: hx, feet, hands, turn), so the feet stay on the floor while the weight moves and any proportions can do it.
//   beats 0–8    a slow sway, two beats on each foot like a pendulum (lowest in the middle); the free foot on its toes, the knee in.
//                Fists under the chin, then the arms out low like wings, tilting with the sway
//   beats 8–10   two soft claps, the free heel up behind
//   beats 10–12  pointing up and out, a fist on the other hip, looking up at it
//   beats 12–16  a slow turn on the toes with the arms out, then a pose (fists under the chin, a heel up behind, head tilted)
// Not robotic: the hips lead and the rest follows late (spine, head, arms each a little later: at()), and every change is a slow curve.
// Units: chibi metres for the hips and feet (scaled with the legs), arm lengths for the hands (see motion/index.js).
import { POSES } from "./index.js";

const BEAT = 0.6, LOOP = 16, TOE = 0.077, PI = Math.PI, cos = Math.cos, sin = Math.sin, mx = Math.max;   // TOE: the ankle to the toes' tread (rising on the toes lifts the ankle by TOE sin a)
const LAG = { spine: 0.12, arms: 0.28, head: 0.32 };   // beats each part follows the hips by
const ss = (a, b, x) => { const u = Math.min(1, mx(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const sway = (b) => -cos(PI * b / 2);   // the weight: -1 on the right foot (beats 0, 4, 8, 12), +1 on the left (2, 6, 10)
const bob = (b) => 0.5 + 0.5 * cos(2 * PI * b);   // 1 on the beat (down)
const both = (fn) => ({ L: fn(1), R: fn(-1) });   // fn(side): side +1 = the character's left (+x)
const free = (w) => ({ L: ss(0.25, 1, -w), R: ss(0.25, 1, w) });   // how free each foot is (the weight on the other)

// the free foot (u: 0 = planted, 1 = free): in toward the other, on its toes, the knee in; a small lift between beats
const tap = (side, u, b) => [side * (0.012 - 0.02 * u), TOE * sin(0.55 * u) + 0.01 * u * (1 - bob(b)), -0.008 * u, -0.06 * u];
const kick = (side, u) => [side * (0.012 - 0.008 * u), 0.09 * u, -0.07 * u, 0];   // the heel up behind (the knee bends; toes down)
// the hips over the standing foot, lowest while the weight crosses (a pendulum), a small dip on each beat
const hipsOf = (w, b, k = 1) => ({ hx: 0.04 * w * k, y: -0.01 - 0.016 * (1 - w * w) * k - 0.005 * bob(b), hips: [0, 0.12 * w * k, 0.07 * w * k] });

// each section: { hx, y, hips, spine, head, feet, toes (foot.* angles: x = toes down), hands, elbows, grip, sh (shoulder lift) }
function sway1(b) {   // beats 0–8
  const w = sway(b), f = free(w), arms = ss(3.4, 4.3, b) * (1 - ss(7.3, 8, b));   // 0 = fists under the chin, 1 = the arms out low
  const paw = (s) => [s * 0.2, 0.1 + 0.03 * bob(b), 0.55], wing = (s) => [s * 0.9, -0.55 - 0.2 * s * w, 0.22];
  return { ...hipsOf(w, b), spine: [0.04, -0.06 * w, -0.1 * w], head: [0.06, 0.06 * w, 0.15 * w],
    feet: { L: tap(1, f.L, b), R: tap(-1, f.R, b) }, toes: { L: [0.55 * f.L, 0, 0], R: [0.55 * f.R, 0, 0] },
    hands: both((s) => paw(s).map((v, i) => v + (wing(s)[i] - v) * arms)), elbows: both((s) => [s, -1 + 0.6 * arms, 0.1 - 1.1 * arms]),
    grip: { L: 1 - arms, R: 1 - arms }, sh: { L: 0.1, R: 0.1 } };
}
function claps(b) {   // beats 8–10
  const w = sway(b), f = free(w), c = bob(b), open = 1 - c;
  return { ...hipsOf(w, b), spine: [0.08, 0.08 * w, -0.08 * w], head: [0.08 + 0.04 * c, -0.08 * w, 0.12 * w],
    feet: { L: kick(1, f.L), R: kick(-1, f.R) }, toes: { L: [0.9 * f.L, 0, 0], R: [0.9 * f.R, 0, 0] },
    hands: both((s) => [s * (0.09 + 0.4 * open), -0.2 + 0.06 * open, 0.72]), elbows: both((s) => [s, -1, -0.3]), grip: { L: 0, R: 0 }, sh: { L: 0.05, R: 0.05 } };
}
function point(b) {   // beats 10–12: the left arm up and out (the weight on the left at 10)
  const w = sway(b), f = free(w), u = 1 - ss(11.2, 12, b);
  return { ...hipsOf(w, b), spine: [0, -0.14, -0.1 * w], head: [-0.18, 0.28, 0.1],
    feet: { L: tap(1, f.L, b), R: tap(-1, f.R, b) }, toes: { L: [0.55 * f.L, 0, 0], R: [0.55 * f.R, 0, 0] },
    hands: { L: [0.95, 0.8, 0.28], R: [-0.5, -0.82, -0.05] }, elbows: { L: [1, -0.8, 0.2], R: [-1, -0.2, -1] }, grip: { L: 0.3, R: 1 }, sh: { L: 0.25 * u, R: 0.05 } };
}
function spin(b) {   // beats 12–14.5
  const up = ss(11.8, 12.4, b) * (1 - ss(14, 14.6, b));   // up: on the toes
  return { hx: 0, y: TOE * sin(0.5) * up - 0.008, hips: [0, 0, 0], spine: [-0.04, 0, 0], head: [-0.05, 0, 0],
    feet: both((s) => [s * 0.004, TOE * sin(0.5) * up, 0, 0]), toes: both(() => [0.5 * up, 0, 0]),
    hands: both((s) => [s * 1.1, -0.25, 0.2]), elbows: both((s) => [s * 0.3, -1, -0.5]), grip: { L: 0, R: 0 }, sh: { L: 0.08, R: 0.08 } };
}
function pose(b) {   // beats 14.5–16: the weight on the right, the left heel up (the start's step goes on from it)
  const k = ss(14.3, 14.9, b), br = sin((b - 14.5) * PI) * 0.004;   // br: a breath while it holds
  return { hx: -0.03, y: -0.014 + br, hips: [0.05, -0.1, -0.06], spine: [0.12, 0.1, 0.1], head: [0.12, -0.15, -0.24],
    feet: { L: kick(1, k * 1.1), R: [-0.004, 0, 0, 0] }, toes: { L: [1.1 * k, 0, 0], R: [0, 0, 0] },
    hands: both((s) => [s * 0.13, 0.08 + br * 4, 0.6]), elbows: both((s) => [s, -1, 0.15]), grip: { L: 1, R: 1 }, sh: { L: 0.12, R: 0.12 } };
}

// a weighted sum of sections (numbers and arrays of numbers, nested)
function mix(list) {
  const zero = (v) => typeof v === "number" ? 0 : Array.isArray(v) ? v.map(() => 0) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, zero(x)]));
  const add = (o, v, w) => { if (typeof v === "number") return o + v * w; if (Array.isArray(v)) return o.map((x, i) => x + (v[i] ?? 0) * w); for (const k in v) o[k] = add(o[k], v[k], w); return o; };
  let o = null; for (const [F, w] of list) { if (!w) continue; o ??= zero(F); o = add(o, F, w); } return o;
}
function at(beats) {
  const b = (beats % LOOP + LOOP) % LOOP;
  const tAB = ss(7.5, 8, b), tBC = ss(9.4, 10, b), tCD = ss(11.4, 12, b), tDE = ss(14.1, 14.7, b), tEA = ss(15.2, 15.95, b);
  const W = [1 - tAB + tEA, tAB - tBC, tBC - tCD, tCD - tDE, tDE - tEA];
  const F = mix([[sway1(b), W[0]], [claps(b), W[1]], [point(b), W[2]], [spin(b), W[3]], [pose(b), W[4]]]);
  const tr = 1 - mx(...W);   // between two moves the hands go round, out and forward, not straight through
  for (const s of ["L", "R"]) { F.hands[s][0] += (s === "L" ? 1 : -1) * 0.35 * tr; F.hands[s][2] += 0.3 * tr; }
  F.turn = 2 * PI * ss(12, 14.5, b); return F;   // (not mixed: a full turn is the same as none, mixed it turned back)
}
const wrap = (a) => Math.atan2(sin(a), cos(a));

Object.assign(POSES, {
  dance: (t) => {
    const bt = t / BEAT, F = at(bt), S = at(bt - LAG.spine), A = at(bt - LAG.arms), H = at(bt - LAG.head), side = (s) => s === "L" ? 1 : -1;
    const lagS = wrap(S.turn - F.turn), lagH = wrap(H.turn - S.turn);   // turning, the body comes round after the hips and the head last
    const b = { hips: F.hips, spine: [S.spine[0] * 0.6, S.spine[1] * 0.6 + lagS * 0.5, S.spine[2] * 0.6], chest: [S.spine[0] * 0.4, S.spine[1] * 0.4 + lagS * 0.5, S.spine[2] * 0.4],
      neck: [H.head[0] * 0.4, H.head[1] * 0.4 + lagH * 0.5, H.head[2] * 0.4], head: [H.head[0] * 0.6, H.head[1] * 0.6 + lagH * 0.5, H.head[2] * 0.6], "foot.L": F.toes.L, "foot.R": F.toes.R };
    for (const s of ["L", "R"]) b[`shoulder.${s}`] = [0, 0, side(s) * A.sh[s]];
    return { b, y: F.y, hx: F.hx, turn: F.turn, feet: F.feet, hands: A.hands, elbows: A.elbows, grip: A.grip, sharp: true }; },
});
