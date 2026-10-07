// Fighting (2026-10-07, Saori: "両手剣 / 槍の構えモーションが体を突き抜けてるのをなおし、両手持ちに / 各武器ごとの攻撃モーション / ダメージくらい、
// 気絶ピヨピヨ、倒れなど戦闘系モーション").
//   guard_spear, guard_greatsword: two-handed guards (the right hand on the shaft at the hip / both on the grip in front), played by "guard"
//     when the right hand holds a spear or a greatsword (motion/index.js). The spear's guard went through the body: held in one hand low at
//     the side, its shaft ran back through the leg.
//   attack_sword / _axe / _spear / _staff / _greatsword / _punch: one swing each (one-shot, ONE_SHOT): from the guard, wind up, strike,
//     back to the guard. "attack" plays the one for what the right hand holds (motion/index.js); a shield or a bare left hand keeps its guard.
//   hit (a blow taken: flinching back), stun (dizzy, swaying, with stars over the head: `stars`), down (knocked down and staying down).
// The arms were solved, not guessed: in the editor, the hands put where they should be (IK, motion/ik.js) on the tall standard body, the
// weapon turned to point where it should, the left hand on the shaft for two hands; the angles read back are kept here. Keyframes are
// blended as turns (quaternions), eased.
import * as THREE from "three";
import { POSES } from "./index.js";
import { ONE_SHOT } from "./survival.js";

const sin = Math.sin, cos = Math.cos;
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const LEGS = { "upperLeg.L": [-0.35, 0, 0.1], "lowerLeg.L": [0.4, 0, 0], "foot.L": [-0.05, 0, 0], "upperLeg.R": [0.22, 0, -0.1], "lowerLeg.R": [0.32, 0, 0], "foot.R": [-0.5, 0, 0] };   // the guard's stance
const LUNGE = { "upperLeg.L": [-0.75, 0, 0.1], "lowerLeg.L": [0.75, 0, 0], "foot.L": [0, 0, 0], "upperLeg.R": [0.4, 0, -0.1], "lowerLeg.R": [0.15, 0, 0], "foot.R": [-0.35, 0, 0] };   // a step in, the weight forward
const ARMS_DOWN = { "upperArm.L": [0, 0, -0.45], "upperArm.R": [0, 0, 0.45], "lowerArm.L": [0, 0, -0.08], "lowerArm.R": [0, 0, 0.08] };
const GUARD_BODY = { ...LEGS, spine: [0.06, 0, 0], chest: [0.02, 0, 0], head: [-0.04, 0, 0] };
const GRIP2 = { L: 1, R: 0 };   // two hands: the left closes on the shaft (the right is a fist in its shape)

// the key poses: body (by hand) and arms (solved)
const K = {
  guardSword: { y: -0.03, b: { ...GUARD_BODY, "upperArm.R": [-0.955, 0.123, -0.03], "lowerArm.R": [-0.633, -0.005, 1.029] } },   // the guard's own (motion/index.js)
  guardStaff: { y: -0.03, b: { ...GUARD_BODY, "upperArm.R": [-0.972, 0.27, 0.444], "lowerArm.R": [-0.279, -0.316, 0.878] } },
  guardBare: { y: -0.03, b: { ...GUARD_BODY, spine: [0.06, -0.3, 0], head: [-0.04, 0.3, 0], "upperArm.R": [-0.896, 0.131, 0.461], "lowerArm.R": [-1.508, 0.312, 0.927] }, grip: { L: 1, R: 1 } },
  // the spear (2026-10-07, Saori: "左手が持ててないので、もう少し槍の位置を上げて、体の中央に寄せれば両手で持てる"): higher and nearer the middle; the
  // left hand closes on the shaft in every frame (measured: 0 cm off it), the thrust's the reach of both arms (its point through the enemy at the belly)
  spearGuard: { y: -0.03, grip: GRIP2, b: { ...LEGS, spine: [0.08, -0.3, 0], head: [-0.04, 0.26, 0], "upperArm.L": [-0.87, -0.391, -0.653], "lowerArm.L": [-0.482, -0.335, -0.231], "hand.L": [0.211, 1.379, -0.217], "upperArm.R": [-0.128, 0.081, 0.311], "lowerArm.R": [-1.015, 0.038, 1.265], "hand.R": [0.795, -0.698, 0.417] } },
  spearBack: { y: -0.04, grip: GRIP2, b: { ...LEGS, spine: [0.04, -0.42, 0], head: [-0.04, 0.38, 0], "upperArm.L": [-0.263, -0.182, -0.586], "lowerArm.L": [-1.13, -0.281, -0.985], "hand.L": [-0.582, 1.006, 0.275], "upperArm.R": [0.207, -0.171, -0.069], "lowerArm.R": [-0.666, -0.246, 1.673], "hand.R": [0.889, -0.183, 0.219] } },
  spearThrust: { y: -0.09, grip: GRIP2, b: { ...LUNGE, spine: [0.4, -0.35, 0], head: [-0.2, 0.28, 0], "upperArm.L": [-1.274, -0.67, -0.446], "lowerArm.L": [-0.478, -0.352, -0.171], "hand.L": [2.217, 1.244, -1.934], "upperArm.R": [-0.927, 0.358, 0.613], "lowerArm.R": [-1.005, 0.194, 1.096], "hand.R": [0.96, -1.299, 0.845] } },
  // the sword and the axe (2026-10-07, Saori: "剣も斧も正面にいる相手を斬りつける動きになっていない … 同じくらいの大きさの敵キャラが目の前にいると想定"; "振り上げた時の肘の曲がり方がおかしい"):
  // solved against a same-size character standing 0.8 in front (its chest at chest height): the raise lifts the arm up and out (the elbow
  // high, not folded behind the head), the hit meets the enemy at the chest with the blade (the axe's edge down) and its edge leading, the
  // follow-through goes on down past its legs. Before, the blade went straight down at its own feet, like a dagger held the other way
  swordUp: { y: -0.03, b: { ...LEGS, spine: [-0.05, -0.4, 0], head: [-0.04, 0.35, 0], "upperArm.R": [0.458, 0.96, -1.955], "lowerArm.R": [0.271, -0.542, -0.693], "hand.R": [2.596, -0.646, -1.588] } },
  swordHit: { y: -0.08, b: { ...LUNGE, spine: [0.22, 0.32, 0], chest: [0.05, 0.1, 0], head: [-0.15, -0.35, 0], "upperArm.R": [-1.087, 1.067, -0.244], "lowerArm.R": [-0.061, 0.053, 0.015], "hand.R": [1.483, -0.279, 2.439] } },
  swordFollow: { y: -0.08, b: { ...LUNGE, spine: [0.28, 0.45, 0], chest: [0.05, 0.12, 0], head: [-0.15, -0.4, 0], "upperArm.R": [-1.189, 0.531, 0.6], "lowerArm.R": [-0.059, 0.051, 0.029], "hand.R": [1.405, -0.553, 1.727] } },
  axeUp: { y: -0.02, b: { ...LEGS, spine: [-0.15, -0.12, 0], head: [0.05, 0.1, 0], "upperArm.R": [0.184, 0.902, -1.909], "lowerArm.R": [0.114, -0.205, -0.527], "hand.R": [-2.924, -0.997, -1.244] } },
  axeHit: { y: -0.08, b: { ...LUNGE, spine: [0.3, 0.12, 0], head: [-0.2, -0.1, 0], "upperArm.R": [-1.72, 0.864, 0.585], "lowerArm.R": [-0.057, 0.05, 0.035], "hand.R": [1.315, -0.94, 1.691] } },
  axeFollow: { y: -0.09, b: { ...LUNGE, spine: [0.45, 0.08, 0], head: [-0.3, 0, 0], "upperArm.R": [-1.238, 0.493, 0.686], "lowerArm.R": [-0.044, 0.039, 0.063], "hand.R": [1.593, -0.825, 1.597] } },
  // the dagger: held forward low, pulled back, a stab (it reaches 6 cm short of the enemy at 0.8: a dagger closes in)
  daggerGuard: { y: -0.04, b: { ...LEGS, spine: [0.08, -0.25, 0], chest: [0.02, 0, 0], head: [-0.04, 0.22, 0], "upperArm.R": [-0.73, 0.342, 0.508], "lowerArm.R": [-0.76, 0.309, 0.667], "hand.R": [1.036, -0.903, 0.79] } },
  daggerBack: { y: -0.05, b: { ...LEGS, spine: [0.05, -0.4, 0], head: [-0.04, 0.35, 0], "upperArm.R": [0.021, -0.04, -0.198], "lowerArm.R": [-0.985, -0.182, 1.585], "hand.R": [0.772, -0.602, 0.151] } },
  daggerStab: { y: -0.09, b: { ...LUNGE, spine: [0.3, 0.22, 0], head: [-0.15, -0.2, 0], "upperArm.R": [-1.581, 0.944, 0.417], "lowerArm.R": [-0.062, 0.053, -0.003], "hand.R": [1.614, -0.759, 2.002] } },
  staffUp: { y: -0.03, b: { ...LEGS, spine: [-0.05, -0.2, 0], head: [0, 0.15, 0], "upperArm.R": [-1.01, 0.756, 0.067], "lowerArm.R": [-1.821, 0.865, 0.71], "hand.R": [2.488, -1.072, 2.153] } },
  staffThrust: { y: -0.08, b: { ...LUNGE, spine: [0.15, 0.1, 0], head: [-0.1, -0.1, 0], "upperArm.R": [-1.62, 0.787, 0.645], "lowerArm.R": [-0.062, 0.053, 0.008], "hand.R": [1.266, -1.008, 0.784] } },
  greatGuard: { y: -0.04, grip: GRIP2, b: { ...LEGS, spine: [0.06, -0.15, 0], head: [0, 0.12, 0], "upperArm.L": [-0.496, -0.188, -0.905], "lowerArm.L": [-0.035, -0.031, -0.073], "hand.L": [-0.501, -0.178, -0.044], "upperArm.R": [-0.814, 0.239, 0.944], "lowerArm.R": [-0.034, 0.031, 0.074], "hand.R": [-0.132, 0.044, -0.001] } },
  greatUp: { y: -0.03, grip: GRIP2, b: { ...LEGS, spine: [-0.12, -0.1, 0], head: [0.05, 0.1, 0], "upperArm.L": [-2.355, 0.184, -1.137], "lowerArm.L": [0.299, 0.079, -0.773], "hand.L": [0.011, -0.587, 0.003], "upperArm.R": [-0.131, 0.275, -1.328], "lowerArm.R": [0.055, 0.668, -2.072], "hand.R": [3.073, -0.47, 3.137] } },
  greatDown: { y: -0.08, grip: GRIP2, b: { ...LUNGE, spine: [0.45, 0, 0], head: [-0.3, 0, 0], "upperArm.L": [-0.784, -0.323, -0.583], "lowerArm.L": [-0.714, -0.169, -1.092], "hand.L": [-1.445, 1.4, 1.15], "upperArm.R": [-1.293, 0.42, 0.84], "lowerArm.R": [-0.046, 0.04, 0.06], "hand.R": [1.36, -0.968, 0.856] } },
  punch: { y: -0.04, b: { ...LEGS, spine: [0.1, 0.35, 0], head: [-0.05, -0.3, 0], "upperArm.R": [-1.267, 0.77, 0.41], "lowerArm.R": [-0.06, 0.052, -0.017], "hand.R": [0, 0, 0] }, grip: { L: 1, R: 1 } },
};

// keyframes [u (0..1 of T), pose] → a pose of t (one-shot: loops over T, the game plays it once). Each bone eased between frames as a turn
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), eu = new THREE.Euler();
function keyed(T, frames) {
  return (t) => {
    const u = ((t % T) + T) % T / T; let i = 0; while (i < frames.length - 2 && u > frames[i + 1][0]) i++;
    const [u0, A] = frames[i], [u1, B] = frames[i + 1], k = ss(0, 1, (u - u0) / ((u1 - u0) || 1)), b = {};
    for (const n of new Set([...Object.keys(A.b), ...Object.keys(B.b)])) {
      qa.setFromEuler(eu.set(...(A.b[n] ?? [0, 0, 0]))); qb.setFromEuler(eu.set(...(B.b[n] ?? [0, 0, 0]))); qa.slerp(qb, k); eu.setFromQuaternion(qa); b[n] = [eu.x, eu.y, eu.z]; }
    const g = (s) => (A.grip?.[s] ?? 0) + ((B.grip?.[s] ?? 0) - (A.grip?.[s] ?? 0)) * k;
    return { b, y: (A.y ?? 0) + ((B.y ?? 0) - (A.y ?? 0)) * k, grip: { L: g("L"), R: g("R") }, sharp: true };
  };
}
const ATTACK_T = { attack: 0.75, attack_sword: 0.75, attack_dagger: 0.5, attack_axe: 0.85, attack_spear: 0.7, attack_staff: 0.9, attack_greatsword: 1.0, attack_punch: 0.45, hit: 0.5, down: 2.4 };
Object.assign(ONE_SHOT, ATTACK_T);

Object.assign(POSES, {
  guard_spear: (t) => { const p = keyed(1, [[0, K.spearGuard], [1, K.spearGuard]])(0), br = sin(t * 2.2) * 0.02; return { ...p, y: p.y + br * 0.3, sharp: false }; },
  guard_greatsword: (t) => { const p = keyed(1, [[0, K.greatGuard], [1, K.greatGuard]])(0), br = sin(t * 2.2) * 0.02; return { ...p, y: p.y + br * 0.3, sharp: false }; },
  attack_sword: keyed(ATTACK_T.attack_sword, [[0, K.guardSword], [0.35, K.swordUp], [0.5, K.swordHit], [0.62, K.swordFollow], [0.75, K.swordFollow], [1, K.guardSword]]),
  attack_dagger: keyed(ATTACK_T.attack_dagger, [[0, K.daggerGuard], [0.3, K.daggerBack], [0.48, K.daggerStab], [0.65, K.daggerStab], [1, K.daggerGuard]]),
  attack_axe: keyed(ATTACK_T.attack_axe, [[0, K.guardSword], [0.4, K.axeUp], [0.55, K.axeHit], [0.66, K.axeFollow], [0.78, K.axeFollow], [1, K.guardSword]]),
  attack_spear: keyed(ATTACK_T.attack_spear, [[0, K.spearGuard], [0.35, K.spearBack], [0.52, K.spearThrust], [0.7, K.spearThrust], [1, K.spearGuard]]),
  attack_staff: keyed(ATTACK_T.attack_staff, [[0, K.guardStaff], [0.4, K.staffUp], [0.62, K.staffThrust], [0.78, K.staffThrust], [1, K.guardStaff]]),
  attack_greatsword: keyed(ATTACK_T.attack_greatsword, [[0, K.greatGuard], [0.42, K.greatUp], [0.6, K.greatDown], [0.78, K.greatDown], [1, K.greatGuard]]),
  attack_punch: keyed(ATTACK_T.attack_punch, [[0, K.guardBare], [0.3, K.punch], [0.5, K.punch], [1, K.guardBare]]),
  // a blow taken: thrown back from the chest, the head snapping back and to the side, the arms flung out, the knees giving a little; then back
  hit: keyed(ATTACK_T.hit, [[0, { y: 0, b: { ...ARMS_DOWN } }],
    [0.18, { y: -0.03, b: { spine: [-0.3, 0.15, 0], chest: [-0.12, 0, 0], head: [-0.35, -0.2, 0.12], "upperArm.L": [0.3, 0, -0.15], "upperArm.R": [0.3, 0, 0.15], "lowerArm.L": [-0.6, 0, 0], "lowerArm.R": [-0.6, 0, 0],
      "upperLeg.L": [-0.18, 0, 0.05], "upperLeg.R": [-0.18, 0, -0.05], "lowerLeg.L": [0.36, 0, 0], "lowerLeg.R": [0.36, 0, 0], "foot.L": [-0.18, 0, 0], "foot.R": [-0.18, 0, 0] } }],
    [0.45, { y: -0.02, b: { spine: [0.1, 0.05, 0], head: [0.1, -0.1, 0.05], ...ARMS_DOWN, "upperLeg.L": [-0.12, 0, 0.05], "upperLeg.R": [-0.12, 0, -0.05], "lowerLeg.L": [0.24, 0, 0], "lowerLeg.R": [0.24, 0, 0], "foot.L": [-0.12, 0, 0], "foot.R": [-0.12, 0, 0] } }],
    [1, { y: 0, b: { ...ARMS_DOWN } }]]),
  // dizzy: the body sways round in slow circles over wobbly knees, the head lolling the other way, the arms hanging loose; stars circle over the head
  stun: (t) => { const w = t * 2.6, s = sin(w), c = cos(w), k = 0.22 + 0.06 * sin(t * 1.3);
    return { b: { spine: [0.12 + 0.07 * s, 0.1 * c, 0.1 * s], chest: [0.04, 0.05 * c, 0.05 * s], head: [0.2 + 0.12 * sin(w + 1.2), 0.25 * c, -0.22 * sin(w + 0.6)],
      "upperArm.L": [0.1 * c, 0, -0.38 + 0.08 * s], "upperArm.R": [-0.1 * c, 0, 0.38 + 0.08 * s], "lowerArm.L": [-0.25, 0, 0], "lowerArm.R": [-0.25, 0, 0],
      "upperLeg.L": [-k, 0, 0.05 + 0.04 * c], "upperLeg.R": [-k, 0, -0.05 + 0.04 * c], "lowerLeg.L": [k * 2, 0, 0], "lowerLeg.R": [k * 2, 0, 0], "foot.L": [-k, 0, 0], "foot.R": [-k, 0, 0] },
      y: -0.035, stars: true }; },
  // knocked down, staying down (the knockdown's fall: motion/survival.js, held lying)
  down: (t) => POSES.knockdown(Math.min(t, 1.15)),
  attack: (t) => POSES.attack_punch(t),   // (the player plays the one for what the right hand holds: attack_<weapon>)
});
