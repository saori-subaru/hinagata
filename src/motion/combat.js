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
  spearGuard: { y: -0.03, grip: GRIP2, b: { ...LEGS, spine: [0.08, -0.35, 0], head: [-0.04, 0.3, 0], "upperArm.L": [-0.991, -0.316, -0.87], "lowerArm.L": [-0.058, -0.05, -0.035], "hand.L": [-0.299, 1.033, 0.156], "upperArm.R": [-0.152, 0.093, 0.389], "lowerArm.R": [-0.415, 0.226, 0.471], "hand.R": [0.435, 0.023, 0.011] } },
  spearBack: { y: -0.04, grip: GRIP2, b: { ...LEGS, spine: [0.04, -0.45, 0], head: [-0.04, 0.4, 0], "upperArm.L": [-0.69, -0.197, -1.058], "lowerArm.L": [-0.153, -0.123, -0.108], "hand.L": [-0.581, 0.732, 0.218], "upperArm.R": [0.231, -0.195, -0.004], "lowerArm.R": [-0.572, 0.162, 0.849], "hand.R": [0.448, 0.388, -0.05] } },
  spearThrust: { y: -0.09, grip: GRIP2, b: { ...LUNGE, spine: [0.25, -0.15, 0], head: [-0.2, 0.15, 0], "upperArm.L": [-1.518, -0.556, -0.817], "lowerArm.L": [-0.062, -0.053, -0.007], "hand.L": [1.247, 1.161, -0.912], "upperArm.R": [-1.213, 0.372, 0.87], "lowerArm.R": [-0.054, 0.047, 0.044], "hand.R": [0.674, -0.727, 0.29] } },
  swordUp: { y: -0.03, b: { ...LEGS, spine: [0, -0.35, 0], head: [-0.04, 0.3, 0], "upperArm.R": [-0.079, 0.174, -0.827], "lowerArm.R": [0.047, 0.301, -1.974], "hand.R": [2.658, 0.106, -1.057] } },
  swordDown: { y: -0.08, b: { ...LUNGE, spine: [0.25, 0.4, 0], head: [-0.15, -0.3, 0], "upperArm.R": [-0.872, 0.248, 0.869], "lowerArm.R": [-0.007, 0.009, 0.09], "hand.R": [1.134, -0.743, 0.537] } },
  axeUp: { y: -0.02, b: { ...LEGS, spine: [-0.12, -0.1, 0], head: [0.05, 0.1, 0], "upperArm.R": [-0.028, 0.388, -1.971], "lowerArm.R": [-0.06, 0.469, -1.729], "hand.R": [3.026, -0.074, 2.122] } },
  axeDown: { y: -0.08, b: { ...LUNGE, spine: [0.45, 0.05, 0], head: [-0.3, 0, 0], "upperArm.R": [-1.223, 0.445, 0.769], "lowerArm.R": [-0.032, 0.029, 0.076], "hand.R": [1.653, -0.891, 1.013] } },
  staffUp: { y: -0.03, b: { ...LEGS, spine: [-0.05, -0.2, 0], head: [0, 0.15, 0], "upperArm.R": [-1.01, 0.756, 0.067], "lowerArm.R": [-1.821, 0.865, 0.71], "hand.R": [2.488, -1.072, 2.153] } },
  staffThrust: { y: -0.08, b: { ...LUNGE, spine: [0.15, 0.1, 0], head: [-0.1, -0.1, 0], "upperArm.R": [-1.62, 0.787, 0.645], "lowerArm.R": [-0.062, 0.053, 0.008], "hand.R": [1.266, -1.008, 0.784] } },
  greatGuard: { y: -0.04, grip: GRIP2, b: { ...LEGS, spine: [0.06, -0.15, 0], head: [0, 0.12, 0], "upperArm.L": [-0.496, -0.188, -0.905], "lowerArm.L": [-0.035, -0.031, -0.073], "hand.L": [-0.501, -0.178, -0.044], "upperArm.R": [-0.814, 0.239, 0.944], "lowerArm.R": [-0.034, 0.031, 0.074], "hand.R": [-0.132, 0.044, -0.001] } },
  greatUp: { y: -0.03, grip: GRIP2, b: { ...LEGS, spine: [-0.12, -0.1, 0], head: [0.05, 0.1, 0], "upperArm.L": [-2.355, 0.184, -1.137], "lowerArm.L": [0.299, 0.079, -0.773], "hand.L": [0.011, -0.587, 0.003], "upperArm.R": [-0.131, 0.275, -1.328], "lowerArm.R": [0.055, 0.668, -2.072], "hand.R": [3.073, -0.47, 3.137] } },
  greatDown: { y: -0.08, grip: GRIP2, b: { ...LUNGE, spine: [0.45, 0, 0], head: [-0.3, 0, 0], "upperArm.L": [-0.784, -0.323, -0.583], "lowerArm.L": [-0.714, -0.169, -1.092], "hand.L": [-1.445, 1.4, 1.15], "upperArm.R": [-1.293, 0.42, 0.84], "lowerArm.R": [-0.046, 0.04, 0.06], "hand.R": [1.36, -0.968, 0.856] } },
  punch: { y: -0.04, b: { ...LEGS, spine: [0.1, 0.35, 0], head: [-0.05, -0.3, 0], "upperArm.R": [-1.267, 0.77, 0.41], "lowerArm.R": [-0.06, 0.052, -0.017], "hand.R": [0, 0, 0] }, grip: { L: 1, R: 1 } },
};
/** The greatsword carried on the right shoulder (standing, walking: motion/index.js ARMED_R) */
export const GREAT_REST = { "upperArm.R": [0.288, -0.226, 0.013], "lowerArm.R": [-1.417, 0.962, 0.682], "hand.R": [-1.763, 0.352, -0.086] };

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
const ATTACK_T = { attack: 0.75, attack_sword: 0.75, attack_axe: 0.85, attack_spear: 0.7, attack_staff: 0.9, attack_greatsword: 1.0, attack_punch: 0.45, hit: 0.5, down: 2.4 };
Object.assign(ONE_SHOT, ATTACK_T);

Object.assign(POSES, {
  guard_spear: (t) => { const p = keyed(1, [[0, K.spearGuard], [1, K.spearGuard]])(0), br = sin(t * 2.2) * 0.02; return { ...p, y: p.y + br * 0.3, sharp: false }; },
  guard_greatsword: (t) => { const p = keyed(1, [[0, K.greatGuard], [1, K.greatGuard]])(0), br = sin(t * 2.2) * 0.02; return { ...p, y: p.y + br * 0.3, sharp: false }; },
  attack_sword: keyed(ATTACK_T.attack_sword, [[0, K.guardSword], [0.35, K.swordUp], [0.55, K.swordDown], [0.72, K.swordDown], [1, K.guardSword]]),
  attack_axe: keyed(ATTACK_T.attack_axe, [[0, K.guardSword], [0.4, K.axeUp], [0.58, K.axeDown], [0.75, K.axeDown], [1, K.guardSword]]),
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
