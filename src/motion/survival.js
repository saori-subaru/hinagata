// Living in the wild (2026-10-04, from the forest game, Saori: 「システムは後回しで、リアルな環境やモーションを先に全部作っておきたい」).
// The body's states and the hands' work for a survival game. Poses only: the game decides when (tired, cold, hurt, a branch underfoot...).
//   body:   pant (hands on the knees, heaving) / shiver (hugging itself, trembling) / limp (one leg stiff) / lookAround / listen / hide
//   ground: balance, balanceWalk (arms out on something narrow) / slide (down a steep slope on the feet) / stumble (one trip, caught) /
//           roll (a forward roll, also to take a fall) / hang, shimmy (hanging from an edge by the hands, moving sideways)
//   water:  drink (kneeling, scooping water to the mouth) / dive (swimming under water, a frog kick)
//   hands:  pickUp / carry, carryWalk (a log in both arms) / throw / push / chop (an axe, two hands) / eat / fireDrill (a hand drill) /
//           sleep (on the side, curled) / stab (a spear, two hands, thrust forward and down) / knockdown (knocked onto the back by a charge, then up again)
// One-shot moves (stumble, roll, throw, pickUp) loop over their length (*.T s here as ONE_SHOT): the game plays from t = 0 and stops after one.
import { POSES } from "./index.js";

const sin = Math.sin, cos = Math.cos, mx = Math.max, PI = Math.PI;
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const m = (v) => [v[0], -v[1], -v[2]];   // L → R (mirror)
const both = (o) => { const r = { ...o }; for (const [k, v] of Object.entries(o)) if (k.endsWith(".L")) r[k.slice(0, -2) + ".R"] = m(v); return r; };
const LT = 0.19, LS = 0.165, TH = 0.75, KN = 1.3;   // thigh / shin length, a full crouch's thigh / knee angles (as motion/jump.js)
const legs = (q, spread = 0.06) => ({ "upperLeg.L": [-TH * q, 0, spread], "upperLeg.R": [-TH * q, 0, -spread], "lowerLeg.L": [KN * q, 0, 0], "lowerLeg.R": [KN * q, 0, 0],
  "foot.L": [-(KN - TH) * q, 0, 0], "foot.R": [-(KN - TH) * q, 0, 0] });
const drop = (q) => LT * (1 - cos(TH * q)) + LS * (1 - cos((KN - TH) * q));
// kneeling on both knees, upright from the knees (shins flat on the ground behind): the hips come down by the shin
const KNEEL = { "upperLeg.L": [0, 0, 0.08], "upperLeg.R": [0, 0, -0.08], "lowerLeg.L": [1.57, 0, 0], "lowerLeg.R": [1.57, 0, 0], "foot.L": [0.6, 0, 0], "foot.R": [0.6, 0, 0] };
const KNEEL_Y = -LS - 0.03;
// the hand at the chin (the cheer jump's low arm: a short arm reaches no higher in front)
const CHIN = { sh: [0, 0, 0.04], ua: [-0.65, -1.18, -0.2], la: [-1.84, -0.55, -0.05], hand: [-0.22, 0.17, -0.28] };
const DOWN = { sh: [0, 0, 0], ua: [0, 0, -0.45], la: [0, 0, -0.08], hand: [0, 0, 0] };
const armL = (A) => ({ "shoulder.L": A.sh, "upperArm.L": A.ua, "lowerArm.L": A.la, "hand.L": A.hand });
const armR = (A) => ({ "shoulder.R": m(A.sh), "upperArm.R": m(A.ua), "lowerArm.R": m(A.la), "hand.R": m(A.hand) });
const lerpArm = (a, b, k) => ({ sh: mix(a.sh, b.sh, k), ua: mix(a.ua, b.ua, k), la: mix(a.la, b.la, k), hand: mix(a.hand, b.hand, k) });

// the roll turns the body about the hips, so the hips go up and down to keep the lowest point (the back, the head) on the ground: measured, per a quarter turn
const ROLL_YS = [0.01, 0.138, 0.449, 0.402, 0.086, -0.202, -0.217, -0.084, 0.009];
const ROLL_Y = (a) => { const x = ((a / (2 * PI)) % 1) * 8, i = Math.floor(x), f = x - i; return ROLL_YS[i] + (ROLL_YS[Math.min(8, i + 1)] - ROLL_YS[i]) * f; };
export const ONE_SHOT = { stumble: 0.9, roll: 1.0, throw: 1.1, pickUp: 1.6, stab: 0.9, knockdown: 2.4 };
const once = (name, t) => Math.min(1, Math.max(0, (t % ONE_SHOT[name]) / ONE_SHOT[name]));

Object.assign(POSES, {
  // ── the body's states ──
  // out of breath: bent over, hands on the knees, the back heaving fast
  pant: (t) => { const b = sin(t * 7.5);
    return { b: { ...legs(0.32, 0.12), spine: [0.55 + 0.04 * b, 0, 0], chest: [0.12 + 0.05 * b, 0, 0], head: [-0.55 - 0.04 * b, 0, 0],
      ...both({ "shoulder.L": [0, 0, 0.05 + 0.04 * b], "upperArm.L": [-0.75, 0, -0.62], "lowerArm.L": [-0.15, 0, 0], "hand.L": [0.3, 0, 0] }) }, y: -drop(0.32) }; },
  // cold: arms wrapped around the chest, shoulders up, knees together, trembling
  shiver: (t) => { const n = sin(t * 47) * 0.6 + sin(t * 31 + 1) * 0.4, k = 0.025;
    return { b: { "upperLeg.L": [-0.12, 0, -0.04], "upperLeg.R": [-0.12, 0, 0.04], "lowerLeg.L": [0.22, 0, 0], "lowerLeg.R": [0.22, 0, 0], "foot.L": [-0.1, 0, 0], "foot.R": [-0.1, 0, 0],
      spine: [0.18 + n * k, n * k, 0], chest: [0.08, 0, 0], head: [0.2 + n * k, 0, n * k * 0.6],
      ...both({ "shoulder.L": [0, 0.1, 0.2 + n * k], "upperArm.L": [-0.75, 0, -0.62 + n * k], "lowerArm.L": [0, -0.2, -1.9], "hand.L": [0, 0, 0] }) }, y: -0.012, grip: { L: 0.5, R: 0.5 } }; },
  // limping: the right leg kept stiff (barely bending), a short quick step on it, the body dropping and leaning over it, the arms out a little
  limp: (t) => { const ph = t * 5.2, s = sin(ph), kL = 0.15 + 0.85 * mx(0, sin(ph + 1.9)), kR = 0.06 + 0.12 * mx(0, sin(ph + 1.9 + PI));
    const onBad = mx(0, -s);   // the hurt (right) leg carries the body
    return { b: { hips: [0, s * 0.1, -0.1 * onBad], spine: [0.12, -s * 0.06, 0.16 * onBad], head: [-0.05, 0, -0.12 * onBad],
      "upperLeg.L": [-0.55 * s, 0, 0.03], "upperLeg.R": [0.3 * s, 0, -0.06], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.25 * s - kL * 0.3, 0, 0], "foot.R": [0.1 * s, 0, 0],
      "upperArm.L": [0.3 * s, 0, -0.2], "upperArm.R": [-0.2 * s, 0, 0.15 + 0.25 * onBad], "lowerArm.L": [-0.3, 0, -0.05], "lowerArm.R": [-0.3, 0, 0.05] }, y: -0.03 * onBad + 0.012 * Math.abs(cos(ph)) }; },
  // looking around: the head and chest sweep slowly side to side, now and then looking up
  lookAround: (t) => { const a = sin(t * 0.55) * 0.75 + sin(t * 1.3) * 0.15, up = mx(0, sin(t * 0.37 + 2)) ** 2;
    return { b: { "upperArm.L": [0, 0, -0.45], "upperArm.R": [0, 0, 0.45], "lowerArm.L": [0, 0, -0.08], "lowerArm.R": [0, 0, 0.08],
      chest: [0, a * 0.35, 0], neck: [0, a * 0.25, 0], head: [-0.35 * up, a * 0.5, 0] }, y: 0 }; },
  // listening: still, the head turned and tilted toward a sound, crouched a little, one hand raised by the face
  listen: (t) => ({ b: { ...legs(0.12, 0.09), spine: [0.1, 0.2, 0], head: [0.05, 0.55 + sin(t * 0.4) * 0.05, -0.3],
      ...armL(DOWN), ...armR(lerpArm(DOWN, CHIN, 0.75)) }, y: -drop(0.12) }),
  // hiding: squatting low, the head pulled down, arms around the knees, very still (slow breath)
  hide: (t) => { const b = sin(t * 2.2) * 0.015;
    return { b: { ...legs(1.0, 0.1), spine: [0.75 + b, 0, 0], chest: [0.15, 0, 0], head: [-0.75, sin(t * 0.3) * 0.15, 0],
      ...both({ "shoulder.L": [0, -0.2, 0], "upperArm.L": [-1.15, 0, -0.45], "lowerArm.L": [0, 0, -1.1] }) }, y: -drop(1.0) - 0.01 }; },

  // ── on difficult ground ──
  // balancing on something narrow: arms out to the sides, the body correcting a slow wobble with the arms and hips
  balance: (t) => { const w = sin(t * 1.7) * 0.6 + sin(t * 2.9 + 1) * 0.4;
    return { b: { ...legs(0.15, 0.03), hips: [0, 0, 0.05 * w], spine: [0.08, 0, -0.08 * w], head: [0.25, 0, 0.03 * w],   // eyes on the feet
      "shoulder.L": [0, 0, 0.1], "shoulder.R": [0, 0, -0.1], "upperArm.L": [0, 0, 0.55 + 0.3 * w], "upperArm.R": [0, 0, -0.55 + 0.3 * w], "lowerArm.L": [0, 0, 0.1], "lowerArm.R": [0, 0, -0.1] }, y: -drop(0.15) }; },
  // walking along it: one foot right in front of the other, small careful steps, arms out
  balanceWalk: (t) => { const ph = t * 4.2, s = sin(ph), w = sin(t * 1.9), kL = 0.15 + 0.5 * mx(0, sin(ph + 1.9)), kR = 0.15 + 0.5 * mx(0, sin(ph + 1.9 + PI));
    return { b: { hips: [0, s * 0.08, 0.04 * w], spine: [0.1, 0, -0.07 * w], head: [0.25, 0, 0],
      "upperLeg.L": [-0.32 * s - 0.1, 0, -0.06], "upperLeg.R": [0.32 * s - 0.1, 0, 0.06], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.15 * s - kL * 0.3, 0, 0], "foot.R": [0.15 * s - kR * 0.3, 0, 0],
      "shoulder.L": [0, 0, 0.1], "shoulder.R": [0, 0, -0.1], "upperArm.L": [0, 0, 0.5 + 0.2 * w], "upperArm.R": [0, 0, -0.5 + 0.2 * w], "lowerArm.L": [0, 0, 0.1], "lowerArm.R": [0, 0, -0.1] }, y: -0.015 }; },
  // sliding down a steep slope on the feet: side-on, knees bent, the front arm out ahead, the back hand trailing near the ground
  slide: (t) => { const w = sin(t * 3.1) * 0.08;
    return { b: { hips: [0, 0.9, 0], spine: [0.1, -0.5, -0.2 + w], head: [-0.1, -0.5, 0.15],
      "upperLeg.L": [-0.75, 0, 0.25], "lowerLeg.L": [0.9, 0, 0], "foot.L": [-0.15, 0, 0], "upperLeg.R": [-0.35, 0, -0.25], "lowerLeg.R": [1.1, 0, 0], "foot.R": [-0.3, 0, 0],
      "upperArm.L": [-0.5, 0, 0.4 + w], "lowerArm.L": [-0.2, 0, 0], "upperArm.R": [0.3, 0, 0.25], "lowerArm.R": [-0.1, 0, 0] }, y: -0.07 }; },
  // a stumble: the foot catches, the body pitches forward, arms flung out ahead, a big catching step, then upright again
  stumble: (t) => { const u = once("stumble", t), f = ss(0, 0.3, u) * (1 - ss(0.55, 1, u)), st = ss(0.15, 0.45, u) * (1 - ss(0.65, 1, u));
    return { b: { spine: [0.15 + 0.55 * f, 0, 0], head: [-0.1 - 0.45 * f, 0, 0],
      "upperLeg.L": [-1.0 * st, 0, 0.05], "lowerLeg.L": [0.5 * st + 0.3 * f, 0, 0], "foot.L": [0.1 * st, 0, 0],
      "upperLeg.R": [0.45 * f, 0, -0.05], "lowerLeg.R": [0.6 * f, 0, 0], "foot.R": [0.35 * f, 0, 0],
      ...both({ "upperArm.L": [-1.4 * f, 0, -0.45 + 0.1 * f], "lowerArm.L": [-0.25 * f, 0, -0.08] }) }, y: -0.06 * st, grip: { L: 0, R: 0 }, sharp: true }; },
  // a forward roll (over the shoulder), from a crouch back to a crouch: the hips turn a full circle about the body's middle
  roll: (t) => { const u = once("roll", t), r = ss(0.08, 0.9, u), q = 1 - ss(0.85, 1, u) * 0.6;
    const a = 2 * PI * r;   // the whole body turns forward about x
    return { b: { ...legs(q, 0.08), hips: [a, 0, 0], spine: [0.75, 0, 0], chest: [0.3, 0, 0], neck: [0.2, 0, 0], head: [0.6, 0, 0],
      ...both({ "upperArm.L": [-1.2, 0, -0.6], "lowerArm.L": [-0.6, 0, 0] }) }, y: -drop(q) + ROLL_Y(a), sharp: true }; },
  // hanging from an edge by the hands (the game puts the hands on it with IK): the body straight below, legs loose
  hang: (t) => { const a = sin(t * 1.6) * 0.06;
    return { b: { ...both({ "shoulder.L": [0, 0, 0.3], "upperArm.L": [-0.5, -0.3, 1.4], "lowerArm.L": [0, -0.04, 0.2] }), spine: [0.05, 0, 0], head: [-0.3, 0, 0],
      "upperLeg.L": [-0.1 + a, 0, 0.05], "upperLeg.R": [-0.05 - a, 0, -0.05], "lowerLeg.L": [0.3, 0, 0], "lowerLeg.R": [0.2, 0, 0], "foot.L": [0.5, 0, 0], "foot.R": [0.5, 0, 0] }, y: 0, grip: { L: 1, R: 1 }, sharp: true }; },
  // moving sideways while hanging: the hands take turns, the hips swing toward the leading hand, the legs follow
  shimmy: (t) => { const ph = t * 4, s = sin(ph);
    return { b: { "shoulder.L": [0, 0, 0.3 + 0.08 * s], "upperArm.L": [-0.5, -0.3, 1.4 + 0.15 * s], "lowerArm.L": [0, -0.04, 0.2 + 0.15 * mx(0, -s)],
      "shoulder.R": [0, 0, -0.3 + 0.08 * s], "upperArm.R": [-0.5, 0.3, -1.4 + 0.15 * s], "lowerArm.R": [0, 0.04, -0.2 - 0.15 * mx(0, s)],
      hips: [0, 0, 0.1 * s], spine: [0.05, 0, -0.06 * s], head: [-0.3, 0, 0],
      "upperLeg.L": [-0.1, 0, 0.05 + 0.15 * mx(0, s)], "upperLeg.R": [-0.1, 0, -0.05 - 0.15 * mx(0, -s)], "lowerLeg.L": [0.35, 0, 0], "lowerLeg.R": [0.35, 0, 0], "foot.L": [0.5, 0, 0], "foot.R": [0.5, 0, 0] }, y: 0, grip: { L: 1, R: 1 }, sharp: true }; },

  // ── water ──
  // drinking at the water: kneeling, bend down and scoop with both hands, bring them up to the mouth, drink with the head back, again
  drink: (t) => { const u = (t / 3.2) % 1, dn = ss(0.0, 0.25, u) * (1 - ss(0.38, 0.58, u)), up = ss(0.42, 0.6, u) * (1 - ss(0.85, 1, u)), sip = ss(0.6, 0.68, u) * (1 - ss(0.8, 0.88, u));
    const cup = lerpArm(DOWN, CHIN, up), scoop = { "upperArm.L": [-1.1, 0.2, -0.55], "lowerArm.L": [-0.2, 0, -0.5], "hand.L": [0.3, 0, 0] };
    const arms = {}; for (const [k, v] of Object.entries(armL(cup))) arms[k] = mix(v, scoop[k] ?? v, dn);
    return { b: { ...KNEEL, spine: [0.15 + 0.85 * dn + 0.1 * up, 0, 0], chest: [0.15 * dn, 0, 0], head: [-0.2 - 0.35 * dn + 0.1 * up - 0.3 * sip, 0, 0], ...both(arms) }, y: KNEEL_Y - 0.02 * dn, grip: { L: 0.35, R: 0.35 } }; },
  // swimming under water: the body level, the head up to see ahead, a breaststroke with the arms and a frog kick with the legs
  dive: (t) => { const ph = (t * 0.9) % 1;
    // the arms (body frame: up = ahead, as the body lies level): reaching ahead → sweep out to the sides → elbows in, hands together under the chin → reach ahead again
    const K = [[0, [0, 0, 2.05], [0, 0, 0.1]], [0.3, [0, 0, 2.05], [0, 0, 0.1]], [0.5, [0.1, 0, 0.75], [0, 0, 0.2]], [0.68, [-1.1, 0.3, -0.1], [-1.6, 0, -0.3]], [0.82, [-0.6, 0, 1.2], [-0.8, 0, 0]], [1, [0, 0, 2.05], [0, 0, 0.1]]];
    let k = 0; while (k < K.length - 2 && ph > K[k + 1][0]) k++;
    const f = ss(K[k][0], K[k + 1][0], ph), ua = mix(K[k][1], K[k + 1][1], f), la = mix(K[k][2], K[k + 1][2], f);
    const kick = ss(0.6, 0.75, ph) * (1 - ss(0.82, 1, ph)), glide = ph < 0.3 || ph > 0.9 ? 1 : 0;
    return { b: { hips: [1.45, 0, 0], head: [-1.2, 0, 0], ...both({ "shoulder.L": [0, 0, 0.25 * glide], "upperArm.L": ua, "lowerArm.L": la }),
      "upperLeg.L": [-0.5 * kick, 0.3 * kick, 0.06 + 0.45 * kick], "upperLeg.R": [-0.5 * kick, -0.3 * kick, -0.06 - 0.45 * kick],   // frog kick: knees out and bent, then the legs snap together
      "lowerLeg.L": [0.15 + 1.6 * kick, 0, 0], "lowerLeg.R": [0.15 + 1.6 * kick, 0, 0], "foot.L": [0.9 - 1.2 * kick, 0, 0], "foot.R": [0.9 - 1.2 * kick, 0, 0] }, y: 0 }; },

  // ── the hands' work ──
  // picking something up: squat down (back fairly straight), both hands to the ground in front, close them, stand up holding it at the belly
  pickUp: (t) => { const u = once("pickUp", t), q = ss(0, 0.35, u) * (1 - ss(0.55, 0.9, u)), g = ss(0.35, 0.45, u), hold = ss(0.6, 0.9, u);
    const reach = { "upperArm.L": [-0.9, 0, -0.6], "lowerArm.L": [-0.1, 0, 0], "hand.L": [0.2, 0, 0] }, belly = { "upperArm.L": [-0.35, 0.1, -0.45], "lowerArm.L": [-1.1, 0, -0.4], "hand.L": [0, 0, 0] };
    const arms = {}; for (const k of Object.keys(reach)) arms[k] = mix(mix([0, 0, k === "upperArm.L" ? -0.45 : 0], reach[k], q), belly[k], hold);
    return { b: { ...legs(0.95 * q, 0.12), spine: [0.25 + 0.4 * q, 0, 0], head: [-0.1 - 0.25 * q + 0.2 * (1 - q) * g, 0, 0], ...both(arms) }, y: -drop(0.95 * q), grip: { L: g, R: g }, sharp: true }; },
  // carrying a log in both arms, against the chest, leaning back a little against the weight
  carry: (t) => ({ b: { spine: [-0.08 + sin(t * 1.6) * 0.01, 0, 0], head: [0.05, 0, 0], ...both({ "shoulder.L": [0, -0.15, 0.05], "upperArm.L": [-0.6, 0.15, -0.5], "lowerArm.L": [-0.2, 0, -1.55], "hand.L": [0, 0, 0.2] }),
      "upperLeg.L": [-0.08, 0, 0.08], "upperLeg.R": [-0.08, 0, -0.08], "lowerLeg.L": [0.12, 0, 0], "lowerLeg.R": [0.12, 0, 0] }, y: -0.005, grip: { L: 0.7, R: 0.7 } }),
  carryWalk: (t) => { const W = POSES.walk(t * 0.8), C = POSES.carry(t), b = { ...W.b };
    for (const k of ["shoulder.L", "shoulder.R", "upperArm.L", "upperArm.R", "lowerArm.L", "lowerArm.R", "hand.L", "hand.R"]) if (C.b[k]) b[k] = C.b[k];
    b.spine = [-0.06, b.spine[1] * 0.5, 0]; return { b, y: W.y, grip: C.grip }; },
  // throwing with the right hand: wind up (arm back and up, body turned, left foot forward), throw (arm whips over, body turns, steps in), follow through
  throw: (t) => { const u = once("throw", t), w = ss(0, 0.4, u) * (1 - ss(0.45, 0.6, u)), r = ss(0.45, 0.6, u) * (1 - ss(0.8, 1, u)), back = 1 - ss(0.8, 1, u);
    return { b: { spine: [0.05 - 0.1 * w + 0.4 * r, 0.55 * w - 0.45 * r, 0], head: [-0.05, -0.5 * w + 0.4 * r, 0],
      "upperLeg.L": [-0.45 * back * (w + r > 0 ? 1 : 0) * mx(w, r), 0, 0.08], "lowerLeg.L": [0.25 * mx(w, r), 0, 0], "upperLeg.R": [0.25 * mx(w, r), 0, -0.08], "lowerLeg.R": [0.35 * mx(w, r), 0, 0], "foot.R": [0.3 * mx(w, r), 0, 0],
      "upperArm.R": mix(mix([0, 0, 0.45], [0.45, -0.3, -1.45], w), [-1.5, 0, 0.55], r), "lowerArm.R": mix(mix([0, 0, 0.08], [-1.7, 0, 0], w), [-0.2, 0, 0], r),   // cocked: the elbow up at the side, the hand back by the head
      "upperArm.L": mix(mix([0, 0, -0.45], [-1.3, 0, -0.5], w), [0.2, 0, -0.5], r), "lowerArm.L": [-0.3 * mx(w, r), 0, 0] }, y: -0.03 * mx(w, r), grip: { L: 0, R: w > 0.1 ? 1 : 1 - r }, sharp: true }; },
  // pushing something heavy: leaning into it from the ankles, both hands forward at chest height, short driving steps
  push: (t) => { const ph = t * 3.0, s = sin(ph), kL = 0.25 + 0.5 * mx(0, sin(ph + 1.9)), kR = 0.25 + 0.5 * mx(0, sin(ph + 1.9 + PI));
    return { b: { hips: [0.35, s * 0.06, 0], spine: [0.15, 0, 0], head: [-0.45, 0, 0],
      "upperLeg.L": [-0.35 * s - 0.2, 0, 0.05], "upperLeg.R": [0.35 * s - 0.2, 0, -0.05], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [0.3 - kL * 0.3, 0, 0], "foot.R": [0.3 - kR * 0.3, 0, 0],
      ...both({ "shoulder.L": [0, -0.25, 0], "upperArm.L": [-1.45, 0, -0.55], "lowerArm.L": [-0.45, 0, 0], "hand.L": [-0.9, 0, 0] }) }, y: -0.04, grip: { L: 0, R: 0 } }; },
  // chopping with an axe held in both hands: raise it over the right shoulder, swing it down hard in front, knees giving on the strike
  chop: (t) => { const u = (t / 1.3) % 1, up = ss(0, 0.45, u) * (1 - ss(0.55, 0.68, u)), hit = ss(0.55, 0.68, u) * (1 - ss(0.8, 1, u));
    const hi = { "upperArm.L": [-2.3, 0.3, -0.5], "lowerArm.L": [-0.6, 0, -0.5] }, lo = { "upperArm.L": [-1.0, 0.2, -0.55], "lowerArm.L": [-0.1, 0, -0.45] }, rest = { "upperArm.L": [-0.7, 0.2, -0.55], "lowerArm.L": [-0.4, 0, -0.45] };
    const arm = (k) => mix(mix(rest[k], hi[k], up), lo[k], hit);
    return { b: { ...legs(0.15 + 0.25 * hit, 0.14), spine: [0.1 - 0.15 * up + 0.5 * hit, -0.25 * up, 0], head: [-0.1 + 0.15 * up - 0.25 * hit, 0.2 * up, 0],
      ...both({ "upperArm.L": arm("upperArm.L"), "lowerArm.L": arm("lowerArm.L") }) }, y: -drop(0.15 + 0.25 * hit), grip: { L: 1, R: 1 }, sharp: true }; },
  // eating: holding food in the left hand by the chest, the right hand bringing bites up to the mouth, chewing (small nods)
  eat: (t) => { const u = (t / 2.4) % 1, bite = ss(0, 0.2, u) * (1 - ss(0.4, 0.6, u)), chew = sin(t * 9) * 0.03 * (1 - bite);
    return { b: { ...armL(lerpArm(DOWN, CHIN, 0.55)), ...armR(lerpArm(lerpArm(DOWN, CHIN, 0.5), CHIN, bite)), head: [0.08 - 0.08 * bite + chew, 0, 0], spine: [0.05, 0, 0] }, y: 0, grip: { L: 0.7, R: 0.7 } }; },
  // making fire with a hand drill: kneeling, leaning over the board, the stick upright between the palms, rubbed fast back and forth
  fireDrill: (t) => { const s = sin(t * 14), dn = (t * 0.6) % 1;   // the hands work down the stick, then start again at the top
    return { b: { ...KNEEL, spine: [0.55, 0, 0], chest: [0.15, 0, 0], head: [-0.2, 0, 0],
      "upperArm.L": [-0.9 + 0.2 * s, 0.2, -0.55 + 0.1 * dn], "lowerArm.L": [-0.35, 0, -0.75], "hand.L": [0, 0.3, 0],
      "upperArm.R": [-0.9 - 0.2 * s, -0.2, 0.55 - 0.1 * dn], "lowerArm.R": [-0.35, 0, 0.75], "hand.R": [0, -0.3, 0] }, y: KNEEL_Y, grip: { L: 0.1, R: 0.1 } }; },
  // a spear thrust (two hands, the spear low at the right side): draw it back (elbows back, body turned right), drive it forward and down (into the water, at an animal), the knees giving, back
  stab: (t) => { const u = once("stab", t), back = ss(0, 0.35, u) * (1 - ss(0.4, 0.5, u)), hit = ss(0.4, 0.52, u) * (1 - ss(0.7, 1, u));
    const rest = { "upperArm.L": [-0.55, 0.25, -0.5], "lowerArm.L": [-1.0, 0, -0.4] }, pull = { "upperArm.L": [0.25, 0.3, -0.5], "lowerArm.L": [-1.6, 0, -0.35] }, out = { "upperArm.L": [-1.3, 0.1, -0.3], "lowerArm.L": [-0.15, 0, -0.15] };
    const arm = (k) => mix(mix(rest[k], pull[k], back), out[k], hit);
    return { b: { ...legs(0.2 + 0.3 * hit, 0.14), spine: [0.12 - 0.08 * back + 0.5 * hit, 0.35 * back - 0.15 * hit, 0], head: [-0.05 + 0.25 * hit, -0.25 * back, 0],
      ...both({ "upperArm.L": arm("upperArm.L"), "lowerArm.L": arm("lowerArm.L") }) }, y: -drop(0.2 + 0.3 * hit), grip: { L: 1, R: 1 }, sharp: true }; },
  // knocked down (a boar's charge, a bear's swipe): thrown onto the back, the arms flung up, lying a moment, then sitting up through a crouch and standing
  knockdown: (t) => { const u = once("knockdown", t), fall = ss(0, 0.16, u), up = ss(0.55, 0.92, u), lie = fall * (1 - up), sit = ss(0.5, 0.7, u) * (1 - ss(0.8, 0.97, u));
    return { b: { ...legs(0.25 * lie + 0.9 * sit, 0.12), hips: [-1.45 * lie, 0, 0], spine: [0.3 * lie + 0.35 * sit, 0, 0], head: [0.45 * lie - 0.2 * sit, 0, 0.12 * lie],
      ...both({ "upperArm.L": [-1.3 * lie, 0, -0.45 - 0.5 * lie], "lowerArm.L": [-0.5 * lie - 0.3 * sit, 0, 0] }) }, y: -0.33 * lie - drop(0.9 * sit) * (1 - lie), grip: { L: 0, R: 0 }, sharp: true }; },
  // asleep: lying on the right side, curled, the head on the arm, breathing slowly
  sleep: (t) => { const b = sin(t * 1.3) * 0.02;
    return { b: { hips: [0, 0, PI / 2], spine: [0.3, 0, 0], chest: [0.15 + b, 0, 0], head: [0.15, 0, 0.25],
      "upperLeg.L": [-1.15, 0, 0.05], "upperLeg.R": [-0.95, 0, -0.05], "lowerLeg.L": [1.4, 0, 0], "lowerLeg.R": [1.2, 0, 0], "foot.L": [0.3, 0, 0], "foot.R": [0.3, 0, 0],
      "upperArm.R": [-1.4, 0, 0.3], "lowerArm.R": [-1.2, 0, 0], "upperArm.L": [-0.9, 0, -0.5], "lowerArm.L": [-0.6, 0, 0] }, y: -0.08 }; },
});
