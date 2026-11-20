// A cute dance (Saori: 「可愛く踊る動き」): 16 beats at 120 BPM (8 s), looping. Made of targets (motion/index.js: hx, feet, hands, turn),
// so the feet stay on the floor while the weight moves and any proportions can do it.
//   beats 0–8   step-touch: the hips sway onto one foot each beat, the other on its toes with the knee in; fists under the chin
//   beats 8–10  a clap on each beat, the free heel kicked up behind
//   beats 10–12 pointing up and out, a fist on the other hip, in turn
//   beats 12–16 a spin on the toes with the arms out, then a pose (fists under the chin, a heel up behind, head tilted), back to the start
// Units: chibi metres for the hips and feet (scaled with the legs), arm lengths for the hands (see motion/index.js).
import { POSES } from "./index.js";

const BEAT = 0.5, LOOP = 16, TOE = 0.077, PI = Math.PI, cos = Math.cos, sin = Math.sin, mx = Math.max;   // TOE: the ankle to the toes' tread (rising on the toes lifts the ankle by TOE sin a)
const ss = (a, b, x) => { const u = Math.min(1, mx(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const sway = (b) => { const c = -cos(PI * b); return Math.tanh(2.5 * c) / Math.tanh(2.5); };   // the weight: -1 on the right foot (even beats), +1 on the left
const bounce = (b) => (0.5 + 0.5 * cos(2 * PI * b)) ** 2;   // 1 on the beat (down), 0 between
const both = (fn) => ({ L: fn(1), R: fn(-1) });   // fn(side): side +1 = the character's left (+x)

// the free foot (u: 0 = planted, 1 = free): in toward the other, on its toes, the knee in
const tap = (side, u) => [side * (0.012 - 0.022 * u), TOE * sin(0.6 * u), -0.01 * u, -0.06 * u];
const kick = (side, u) => [side * (0.012 - 0.008 * u), 0.1 * u, -0.075 * u, 0];   // the heel up behind (the knee bends; toes down)

// each section: { hx, y, hips, spine, head, feet, toes (foot.* angles: x = toes down), hands, elbows, grip, sh (shoulder lift), turn }
function stepTouch(b) {
  const w = sway(b), d = bounce(b), fL = mx(0, -w), fR = mx(0, w);
  return { hx: 0.03 * w, y: -0.012 - 0.014 * d, hips: [0, 0.1 * w, 0.06 * w], spine: [0.04, -0.05 * w, -0.1 * w], head: [0.05 + 0.04 * d, 0.08 * w, 0.14 * w],
    feet: { L: tap(1, fL), R: tap(-1, fR) }, toes: { L: [0.6 * fL, 0, 0], R: [0.6 * fR, 0, 0] },
    hands: both((s) => [s * (0.2 + 0.03 * s * w), 0.12 - 0.1 * d, 0.55]), elbows: both((s) => [s, -1, 0.1]), grip: { L: 1, R: 1 }, sh: { L: 0.1, R: 0.1 } };
}
function clapKick(b) {
  const w = sway(b), c = bounce(b) ** 1.5, k = bounce(b - 0.12), fL = mx(0, -w) * k, fR = mx(0, w) * k, open = 1 - c;
  return { hx: 0.035 * w, y: -0.015 - 0.012 * c, hips: [0, -0.15 * w, 0.05 * w], spine: [0.08, 0.1 * w, -0.08 * w], head: [0.08 + 0.05 * c, -0.1 * w, 0.1 * w],
    feet: { L: kick(1, fL), R: kick(-1, fR) }, toes: { L: [1.0 * fL, 0, 0], R: [1.0 * fR, 0, 0] },
    hands: both((s) => [s * (0.09 + 0.45 * open), -0.2 + 0.05 * open, 0.72]), elbows: both((s) => [s, -1, -0.3]), grip: { L: 0, R: 0 }, sh: { L: 0.05, R: 0.05 } };
}
function point(b) {
  const w = sway(b), d = bounce(b), uL = mx(0, w), uR = mx(0, -w);   // the arm on the weight's side points (beat 10: the right)
  const arm = (s, u) => { const up = [s * 0.95, 0.8, 0.25], hip = [s * 0.5, -0.82, -0.05]; return up.map((v, i) => hip[i] + (v - hip[i]) * u); };
  const elbow = (s, u) => [s, -0.2 - 0.6 * u, -1 + 1.2 * u];
  return { hx: 0.035 * w, y: -0.014 - 0.012 * d, hips: [0, 0.12 * w, 0.07 * w], spine: [0.0, -0.12 * w, -0.1 * w], head: [-0.12, -0.25 * w, 0.12 * w],
    feet: { L: tap(1, mx(0, -w)), R: tap(-1, mx(0, w)) }, toes: { L: [0.6 * mx(0, -w), 0, 0], R: [0.6 * mx(0, w), 0, 0] },
    hands: { L: arm(1, uL), R: arm(-1, uR) }, elbows: { L: elbow(1, uL), R: elbow(-1, uR) }, grip: { L: 1 - 0.7 * uL, R: 1 - 0.7 * uR }, sh: { L: 0.25 * uL, R: 0.25 * uR } };
}
function spin(b) {
  const r = ss(12, 13.5, b), up = ss(11.85, 12.15, b) * (1 - ss(13.4, 13.75, b));   // up: on the toes
  return { hx: 0, y: TOE * sin(0.5) * up - 0.004, hips: [0, 0, 0], spine: [-0.04, 0, 0], head: [-0.05, 0, 0],
    feet: both((s) => [s * 0.004, TOE * sin(0.5) * up, 0, 0]), toes: both(() => [0.5 * up, 0, 0]),
    hands: both((s) => [s * 1.15, -0.2, 0.2]), elbows: both((s) => [s * 0.3, -1, -0.5]), grip: { L: 0, R: 0 }, sh: { L: 0.08, R: 0.08 } };
}
function pose(b) {
  const br = sin((b - 13.5) * PI * 0.5) * 0.004, k = ss(13.5, 13.9, b);   // a breath while it holds
  return { hx: 0.03, y: -0.012 + br, hips: [0.05, 0.1, 0.06], spine: [0.12, -0.1, -0.1], head: [0.12, 0.15, 0.24],
    feet: { L: [0.004, 0, 0, 0], R: kick(-1, k * 1.15) }, toes: { L: [0, 0, 0], R: [1.1 * k, 0, 0] },
    hands: both((s) => [s * 0.13, 0.08 + br * 4, 0.6]), elbows: both((s) => [s, -1, 0.15]), grip: { L: 1, R: 1 }, sh: { L: 0.12, R: 0.12 } };
}

// a weighted sum of sections (numbers and arrays of numbers, nested)
function mix(list) {
  const out = (v) => typeof v === "number" ? 0 : Array.isArray(v) ? v.map(() => 0) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, out(x)]));
  const add = (o, v, w) => { if (typeof v === "number") return o + v * w; if (Array.isArray(v)) return o.map((x, i) => x + (v[i] ?? 0) * w); for (const k in v) o[k] = add(o[k], v[k], w); return o; };
  let o = null; for (const [F, w] of list) { if (!w) continue; o ??= out(F); o = add(o, F, w); } return o;
}
function at(t) {
  const b = ((t / BEAT) % LOOP + LOOP) % LOOP;
  const wB = ss(7.6, 7.95, b) - ss(11.6, 12, b), wC = ss(11.6, 12, b) - ss(15.4, 15.95, b), wA = 1 - wB - wC;
  const wP = ss(9.6, 9.95, b), wE = ss(13.3, 13.75, b);
  const F = mix([[stepTouch(b), wA], [clapKick(b), wB * (1 - wP)], [point(b), wB * wP], [spin(b), wC * (1 - wE)], [pose(b), wC * wE]]);
  F.turn = 2 * PI * ss(12, 13.5, b); return F;   // (not mixed: a full turn is the same as none, mixed it turned back)
}

Object.assign(POSES, {
  dance: (t) => { const F = at(t), side = (s) => s === "L" ? 1 : -1;
    const b = { hips: F.hips, spine: F.spine, head: F.head, "foot.L": F.toes.L, "foot.R": F.toes.R };
    for (const s of ["L", "R"]) b[`shoulder.${s}`] = [0, 0, side(s) * F.sh[s]];
    return { b, y: F.y, hx: F.hx, turn: F.turn, feet: F.feet, hands: F.hands, elbows: F.elbows, grip: F.grip, sharp: true }; },
});
