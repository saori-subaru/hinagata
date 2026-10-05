// Tennis poses for Hinagata avatars (the engine has no racket swing: written here as poses).
// Angles: Euler XYZ (radians) per bone, in the avatar's rest axes (it faces +z, its left is +x, so its right hand is on -x).
// For the right arm: +y on upperArm.R swings it forward, -z raises it toward the side, -x swings it forward/up in front.
import * as THREE from "three";

const PI = Math.PI;
export const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

// the elbow bends about its own hinge (the arms rest in an A-pose 44° down: see the engine's run.js). side: 1 = L, -1 = R
const ARM_DOWN = 44.3 * PI / 180, _q = new THREE.Quaternion(), _e = new THREE.Euler(), _h = new THREE.Vector3();
export const elbow = (side, a) => { _h.set(Math.cos(ARM_DOWN), side * Math.sin(ARM_DOWN), 0); _e.setFromQuaternion(_q.setFromAxisAngle(_h, -a)); return [_e.x, _e.y, _e.z]; };

// an upper arm turned to point along dir (in its parent's frame), then twisted about that line by twist (turns the racket face)
const D0 = { R: new THREE.Vector3(-Math.cos(ARM_DOWN), -Math.sin(ARM_DOWN), 0), L: new THREE.Vector3(Math.cos(ARM_DOWN), -Math.sin(ARM_DOWN), 0) };
const _a = new THREE.Vector3(), _t = new THREE.Quaternion();
export function aimArm(side, dir, twist = 0) { _a.set(dir[0], dir[1], dir[2]).normalize(); _q.setFromUnitVectors(D0[side], _a); _q.premultiply(_t.setFromAxisAngle(_a, twist));
  _e.setFromQuaternion(_q, "XYZ"); return [_e.x, _e.y, _e.z]; }

// pose = { b: {bone: [x,y,z]}, y }
export function mixPose(A, B, k) {
  if (k <= 0) return A; if (k >= 1) return B;
  const b = {}, keys = new Set([...Object.keys(A.b), ...Object.keys(B.b)]), Z = [0, 0, 0];
  for (const n of keys) b[n] = mix(A.b[n] || Z, B.b[n] || Z, k);
  return { b, y: (A.y || 0) + ((B.y || 0) - (A.y || 0)) * k };
}
const LT = 0.19, LS = 0.165;
const legs = (th, kn, spread = 0.1, ft = 0) => ({ "upperLeg.L": [-th, 0, spread], "upperLeg.R": [-th, 0, -spread], "lowerLeg.L": [kn, 0, 0], "lowerLeg.R": [kn, 0, 0],
  "foot.L": [-(kn - th) + ft, 0, -spread], "foot.R": [-(kn - th) + ft, 0, spread] });
const drop = (th, kn) => LT * (1 - Math.cos(th)) + LS * (1 - Math.cos(kn - th));

// ready stance: knees bent, weight forward, racket held in front with the left hand on its throat, a little bounce on the toes
export function stance(t, bounce = 1) {
  const s = (Math.sin(t * 8) * 0.5 + 0.5) * bounce, th = 0.42 + 0.08 * s, kn = 0.8 + 0.16 * s;
  return { b: { ...legs(th, kn, 0.13), spine: [0.24, 0, 0], chest: [0.04, 0, 0], head: [-0.22, 0, 0],
    "upperArm.R": aimArm("R", [-0.35, -0.9, 0.3], TW.stance), "lowerArm.R": elbow(-1, 1.35), "hand.R": [0, 0, 0.2],
    "upperArm.L": [-0.5, -0.45, -0.25], "lowerArm.L": elbow(1, 1.25), "hand.L": [0, 0, 0] }, y: -drop(th, kn) };
}

// key frames of a swing, mixed by u (0 = wound up, CONTACT = hitting, 1 = follow-through). h: contact height 0 (low) .. 1 (high)
export const CONTACT = 0.42;
export const TW = { stance: 0, fhBack: 0, fhHit: 0.1, bhBack: -2.1, bhHit: -2.1, svBack: -1.9 };
function keyed(K, u, h) {
  const seg = u < CONTACT ? [K.back, K.hit, u / CONTACT] : [K.hit, K.follow, (u - CONTACT) / (1 - CONTACT)];
  const A = seg[0](h), B = seg[1](h), k = ss(0, 1, seg[2]);
  return mixPose(A, B, k);
}
const FH = {
  back: (h) => ({ b: { ...legs(0.45, 0.75, 0.16), hips: [0, -0.35, 0], spine: [0.15, -0.55, 0], chest: [0, -0.2, 0], head: [-0.15, 0.75, 0],
    "upperArm.R": aimArm("R", [-0.55, -0.05 + 0.3 * h, -0.85], TW.fhBack), "lowerArm.R": elbow(-1, 0.5), "hand.R": [0, 0, 0.2],
    "upperArm.L": [-1.15, 0.3, -0.2], "lowerArm.L": elbow(1, 0.3) }, y: -drop(0.45, 0.75) }),
  hit: (h) => ({ b: { ...legs(0.4 - 0.15 * h, 0.75 - 0.3 * h, 0.16), hips: [0, 0.05, 0], spine: [0.15 - 0.1 * h, 0.05, 0], chest: [0, 0.05, 0], head: [-0.1, 0.1, 0],
    "upperArm.R": aimArm("R", [-0.95, -0.5 + 0.75 * h, 0.12], TW.fhHit), "lowerArm.R": elbow(-1, 0.15), "hand.R": [0, 0, 0],
    "upperArm.L": [-0.4, -0.2, -0.45], "lowerArm.L": elbow(1, 0.6) }, y: -drop(0.4 - 0.15 * h, 0.75 - 0.3 * h) }),
  follow: (h) => ({ b: { ...legs(0.3, 0.45, 0.16), hips: [0, 0.4, 0], spine: [0.05, 0.55, 0], chest: [0, 0.2, 0], head: [-0.05, -0.6, 0],
    "upperArm.R": [-1.2, 1.3, -0.3], "lowerArm.R": elbow(-1, 1.6), "hand.R": [0, 0.2, 0],
    "upperArm.L": [0.1, -0.3, -0.5], "lowerArm.L": elbow(1, 0.9) }, y: -drop(0.3, 0.45) }),
};
const BH = {
  back: (h) => ({ b: { ...legs(0.45, 0.75, 0.16), hips: [0, 0.35, 0], spine: [0.15, 0.6, 0], chest: [0, 0.25, 0], head: [-0.15, -0.8, 0],
    "upperArm.R": aimArm("R", [0.75, -0.45, -0.3], TW.bhBack), "lowerArm.R": elbow(-1, 0.6), "hand.R": [0, 0, 0],
    "upperArm.L": [-0.5, -0.55, -0.1], "lowerArm.L": elbow(1, 1.3) }, y: -drop(0.45, 0.75) }),
  hit: (h) => ({ b: { ...legs(0.4 - 0.15 * h, 0.75 - 0.3 * h, 0.16), hips: [0, 0.0, 0], spine: [0.15 - 0.1 * h, -0.05, 0], chest: [0, -0.05, 0], head: [-0.1, 0, 0],
    "upperArm.R": aimArm("R", [0.85, -0.55 + 0.75 * h, 0.5], TW.bhHit), "lowerArm.R": elbow(-1, 0.1), "hand.R": [0, 0, 0],
    "upperArm.L": [0.2, 0.2, -0.6], "lowerArm.L": elbow(1, 0.3) }, y: -drop(0.4 - 0.15 * h, 0.75 - 0.3 * h) }),
  follow: (h) => ({ b: { ...legs(0.3, 0.45, 0.16), hips: [0, -0.3, 0], spine: [0.05, -0.45, 0], chest: [0, -0.15, 0], head: [-0.05, 0.5, 0],
    "upperArm.R": [-0.3, 0.9, -1.5], "lowerArm.R": elbow(-1, 0.3), "hand.R": [0, 0, -0.2],
    "upperArm.L": [0.4, 0.3, -0.5], "lowerArm.L": elbow(1, 0.3) }, y: -drop(0.3, 0.45) }),
};
// the serve and the smash: trophy position (racket behind the head, left arm up), reach up and hit, finish down across the body
const SV = {
  back: () => ({ b: { ...legs(0.35, 0.7, 0.14), hips: [0, -0.3, 0], spine: [-0.1, -0.4, 0], chest: [-0.05, -0.1, 0], head: [-0.35, 0.4, 0],
    "upperArm.R": aimArm("R", [-0.85, 0.3, -0.3], TW.svBack), "lowerArm.R": elbow(-1, 1.9), "hand.R": [0.3, 0, 0],
    "upperArm.L": aimArm("L", [0.12, 1, 0.25]), "lowerArm.L": elbow(1, 0.05) }, y: -drop(0.35, 0.7) }),
  hit: () => ({ b: { ...legs(0.05, 0.1, 0.12, 0.25), hips: [0, 0.05, 0], spine: [0.0, 0.05, 0], chest: [0, 0, 0], head: [-0.4, 0, 0],
    "upperArm.R": [-0.35, 0.2, -2.55], "lowerArm.R": elbow(-1, 0.15), "hand.R": [-0.3, 0, 0],
    "upperArm.L": [0.2, 0, -0.6], "lowerArm.L": elbow(1, 0.9) }, y: 0.03 }),
  follow: () => ({ b: { ...legs(0.3, 0.5, 0.14), hips: [0, 0.35, 0], spine: [0.35, 0.45, 0], chest: [0.1, 0.1, 0], head: [-0.2, -0.3, 0],
    "upperArm.R": [-0.6, 1.3, -0.1], "lowerArm.R": elbow(-1, 0.5), "hand.R": [0, 0, 0],
    "upperArm.L": [-0.2, 0.2, -0.3], "lowerArm.L": elbow(1, 1.2) }, y: -drop(0.3, 0.5) }),
};
export const SWINGS = { fh: FH, bh: BH, serve: SV, smash: SV };
export const swingPose = (kind, u, h = 0.4) => keyed(SWINGS[kind], u, h);

// winning a point: the racket held up high, a fist pump with the left hand, little hops
export function victory(t) {
  const hop = Math.max(0, Math.sin(t * 9)), pump = Math.sin(t * 9 + 1);
  return { b: { ...legs(0.15 * (1 - hop), 0.3 * (1 - hop), 0.12, 0.2 * hop), spine: [-0.08, 0, 0], head: [-0.12, 0, 0.08],
    "upperArm.R": aimArm("R", [-0.75, 1, 0.1], 1.0), "lowerArm.R": elbow(-1, 0.25), "hand.R": [0, 0, 0],
    "upperArm.L": aimArm("L", [0.55, -0.45 + 0.15 * pump, 0.55]), "lowerArm.L": elbow(1, 1.9 + 0.35 * pump), "hand.L": [0, 0, 0] }, y: 0.05 * hop - drop(0.15 * (1 - hop), 0.3 * (1 - hop)) };
}
