// Motion: poses as functions of time. Each returns { b: { boneName: [x, y, z] Euler angles }, y: hips lift, chair?: true }.
// Bones not listed rest in the A-pose (the bind pose).
import * as THREE from "three";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
const ARMS_DOWN = { "upperArm.L": [0, 0, -0.45], "upperArm.R": [0, 0, 0.45], "lowerArm.L": [0, 0, -0.08], "lowerArm.R": [0, 0, 0.08] };
export const POSES = {
  "aPose": () => ({ b: {}, y: 0 }),
  "idle": (t) => ({ b: { ...ARMS_DOWN, chest: [sin(t * 1.6) * 0.02, 0, 0], head: [sin(t * 0.8) * 0.04, sin(t * 0.5) * 0.12, sin(t * 0.7) * 0.05] }, y: 0 }),
  "walk": (t) => { const ph = t * 6.2, s = sin(ph), kL = 0.12 + 0.75 * mx(0, sin(ph + 1.9)), kR = 0.12 + 0.75 * mx(0, sin(ph + 1.9 + Math.PI));
    return { b: { hips: [0, s * 0.12, 0], spine: [0.05, -s * 0.08, 0], head: [0.02, -s * 0.05, 0], "upperLeg.L": [-0.5 * s, 0, 0], "upperLeg.R": [0.5 * s, 0, 0], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.25 * s - kL * 0.3, 0, 0], "foot.R": [0.25 * s - kR * 0.3, 0, 0],
      "upperArm.L": [0.5 * s, 0, -0.36], "upperArm.R": [-0.5 * s, 0, 0.36], "lowerArm.L": [-0.25 + 0.22 * s, 0, -0.05], "lowerArm.R": [-0.25 - 0.22 * s, 0, 0.05] }, y: Math.abs(cos(ph)) * 0.02 }; },   // 腕は体から少し離し、後ろへ振ったときは肘を伸ばす
  "wave": (t) => ({ b: { "upperArm.L": [0, 0, -0.45], "lowerArm.L": [0, 0, -0.1], "upperArm.R": [-0.2, 0, -1.5], "lowerArm.R": [0, 0, -0.95 + sin(t * 9) * 0.45], "hand.R": [0, 0, sin(t * 9 - 0.6) * 0.3], head: [0.04, -0.15, -0.14], chest: [0, -0.08, -0.05] }, y: 0 }),
  "cheer": (t) => { const k = mx(0, sin(t * 5.2)), squat = mx(0, -sin(t * 5.2));
    return { b: { "upperArm.L": [-0.15, 0, 1.5 + k * 0.25], "upperArm.R": [-0.15, 0, -1.5 - k * 0.25], "lowerArm.L": [0, 0, 0.55], "lowerArm.R": [0, 0, -0.55], "upperLeg.L": [-0.5 * squat - 0.1 * k, 0, 0.08], "upperLeg.R": [-0.5 * squat - 0.1 * k, 0, -0.08], "lowerLeg.L": [0.9 * squat + 0.35 * k, 0, 0], "lowerLeg.R": [0.9 * squat + 0.35 * k, 0, 0], "foot.L": [-0.4 * squat + 0.3 * k, 0, 0], "foot.R": [-0.4 * squat + 0.3 * k, 0, 0], head: [-0.15 * k, 0, 0], spine: [0.2 * squat, 0, 0] }, y: k * 0.15 - squat * 0.05 }; },
  "sitChair": (t) => ({ b: { "upperLeg.L": [-1.57, 0, 0.05], "upperLeg.R": [-1.57, 0, -0.05], "lowerLeg.L": [1.5 + sin(t * 2) * 0.15, 0, 0], "lowerLeg.R": [1.5 - sin(t * 2) * 0.15, 0, 0], "foot.L": [0.05, 0, 0], "foot.R": [0.05, 0, 0],
      "upperArm.L": [-0.45, 0, -0.35], "upperArm.R": [-0.45, 0, 0.35], "lowerArm.L": [-0.75, 0, 0], "lowerArm.R": [-0.75, 0, 0], spine: [0.05, 0, 0], head: [0.06, sin(t * 0.6) * 0.2, sin(t * 0.9) * 0.1] }, y: -0.118, chair: true }),
  "sitFloor": (t) => ({ b: { "upperLeg.L": [-1.5, 0, 0.14], "upperLeg.R": [-1.5, 0, -0.14], "lowerLeg.L": [0.05, 0, 0], "lowerLeg.R": [0.05, 0, 0], "foot.L": [0.25 + sin(t * 3) * 0.2, 0, 0], "foot.R": [0.25 - sin(t * 3) * 0.2, 0, 0],
      "upperArm.L": [0.65, 0, -0.25], "upperArm.R": [0.65, 0, 0.25], "lowerArm.L": [0.1, 0, 0], "lowerArm.R": [0.1, 0, 0], spine: [-0.18, 0, 0], chest: [-0.05, 0, 0], head: [0.18, 0, sin(t * 0.8) * 0.12] }, y: -0.315 }),
  "hugKnees": (t) => ({ b: { "upperLeg.L": [-2.35, 0, 0.1], "upperLeg.R": [-2.35, 0, -0.1], "lowerLeg.L": [2.45, 0, 0], "lowerLeg.R": [2.45, 0, 0], "foot.L": [-0.1, 0, 0], "foot.R": [-0.1, 0, 0],
      "upperArm.L": [-1.1, 0, -0.25], "upperArm.R": [-1.1, 0, 0.25], "lowerArm.L": [0, 0, -1.25], "lowerArm.R": [0, 0, 1.25], spine: [0.25, 0, 0], chest: [0.15, 0, 0], head: [0.1 + sin(t * 1.2) * 0.04, 0, 0.12] }, y: -0.31 }),
};

/** Blend the bones toward a pose each frame (smoothly; instant = jump straight to it). */
export function createPosePlayer({ bone, BONES, HIPS0 }) {
  const qT = new THREE.Quaternion(), eT = new THREE.Euler();
  return function apply(name, t, dt, instant = false) {
    const P0 = POSES[name](t), k = instant ? 1 : 1 - Math.exp(-dt * 9);
    for (const b of BONES) { const r = P0.b[b] || [0, 0, 0]; eT.set(r[0], r[1], r[2]); qT.setFromEuler(eT); bone[b].quaternion.slerp(qT, k); }
    bone.hips.position.y += (HIPS0.y + (P0.y || 0) - bone.hips.position.y) * k;
    return P0;
  };
}
