// Motion: poses as functions of time. Each returns { b: { boneName: [x, y, z] Euler angles }, y: hips lift, chair?: true, seat?: height }.
// seat: the top of what the character sits on (seatFront: its front edge, z; what is beyond it hangs off the seat). The avatar then moves the hips so the lowest point of the bottom (body or pants, as worn)
//   rests on it: body types and clothes differ by 1-3 cm there, so a fixed y alone left some floating above the chair.
// Bones not listed rest in the A-pose (the bind pose).
import * as THREE from "three";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
const ARMS_DOWN = { "upperArm.L": [0, 0, -0.45], "upperArm.R": [0, 0, 0.45], "lowerArm.L": [0, 0, -0.08], "lowerArm.R": [0, 0, 0.08] };
// 手をふる腕の向き: 肩から先を、正面から見た角度 phi(真上から外へ)・前へ tilt だけ上げ、手のひらが正面(+z)を向くように腕ごとひねった向き。
// 振るときは、この向きを体の正面の面で(z軸のまわりに)回す → 振っても手のひらは正面のまま、手は左右に動く(肘から先だけを回すと前後に振れて見えた)
const WAVE = (() => {
  const sh = [0, 0, -0.3], chest = [0, -0.08, -0.05], phi = 48 * Math.PI / 180, tilt = 22 * Math.PI / 180, amp = 0.32;
  const rest = new THREE.Vector3(-0.698, -0.716, 0.03).normalize(), palm0 = new THREE.Vector3(0.51, -0.86, 0.08).normalize();   // A-pose: the right arm's direction / its palm (facing the thigh)
  const dir = new THREE.Vector3(-Math.sin(phi) * Math.cos(tilt), Math.cos(phi) * Math.cos(tilt), Math.sin(tilt));
  const qw = new THREE.Quaternion().setFromUnitVectors(rest, dir), qt = new THREE.Quaternion(), n = new THREE.Vector3();
  let best = -2, bq = null; for (let k = 0; k < 360; k++) { qt.setFromAxisAngle(dir, k * Math.PI / 180).multiply(qw); n.copy(palm0).applyQuaternion(qt); if (n.z > best) { best = n.z; bq = qt.clone(); } }   // twist the arm about itself until the palm faces front
  const parent = new THREE.Quaternion().setFromEuler(new THREE.Euler(...chest)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...sh))), pinv = parent.clone().invert();
  const qz = new THREE.Quaternion(), q = new THREE.Quaternion(), e = new THREE.Euler(), Z = new THREE.Vector3(0, 0, 1);
  return { sh, chest, amp, arm: (a) => { qz.setFromAxisAngle(Z, a); q.copy(pinv).multiply(qz).multiply(bq); e.setFromQuaternion(q); return [e.x, e.y, e.z]; } };   // a > 0: toward the outside
})();
export const POSES = {
  "aPose": () => ({ b: {}, y: 0 }),
  "tPose": () => ({ b: { "shoulder.L": [0, 0, 0.15], "shoulder.R": [0, 0, -0.15], "upperArm.L": [0, 0, 0.65], "upperArm.R": [0, 0, -0.65] }, y: 0 }),   // arms straight out to the sides (the A-pose arm is about 46° down). The shoulders take a little of the lift (else the seam by the neck stretches into a step)
  "idle": (t) => ({ b: { ...ARMS_DOWN, chest: [sin(t * 1.6) * 0.02, 0, 0], head: [sin(t * 0.8) * 0.04, sin(t * 0.5) * 0.12, sin(t * 0.7) * 0.05] }, y: 0 }),
  "walk": (t) => { const ph = t * 6.2, s = sin(ph), kL = 0.12 + 0.75 * mx(0, sin(ph + 1.9)), kR = 0.12 + 0.75 * mx(0, sin(ph + 1.9 + Math.PI));
    return { b: { hips: [0, s * 0.12, 0], spine: [0.05, -s * 0.08, 0], head: [0.02, -s * 0.05, 0], "upperLeg.L": [-0.5 * s, 0, 0], "upperLeg.R": [0.5 * s, 0, 0], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.25 * s - kL * 0.3, 0, 0], "foot.R": [0.25 * s - kR * 0.3, 0, 0],
      "upperArm.L": [0.5 * s, 0, -0.36], "upperArm.R": [-0.5 * s, 0, 0.36], "lowerArm.L": [-0.25 + 0.22 * s, 0, -0.05], "lowerArm.R": [-0.25 - 0.22 * s, 0, 0.05] }, y: Math.abs(cos(ph)) * 0.02 }; },   // 腕は体から少し離し、後ろへ振ったときは肘を伸ばす
  // 手をふる: 腕をほぼまっすぐ上げ(肩も持ち上げる)、肩を軸に体の正面の面で左右に大きく振る(WAVE)。手のひらは正面の相手へ向けたまま、手首は少し遅れて追う
  "wave": (t) => { const s = sin(t * 7); return { b: { "upperArm.L": [0, 0, -0.45], "lowerArm.L": [0, 0, -0.1], "shoulder.R": WAVE.sh, "upperArm.R": WAVE.arm(s * WAVE.amp), "lowerArm.R": [0, 0, -0.12], "hand.R": [0, sin(t * 7 - 0.7) * 0.35, 0], head: [0.04, -0.15, -0.14], chest: WAVE.chest }, y: 0 }; },
  "cheer": (t) => { const k = mx(0, sin(t * 5.2)), squat = mx(0, -sin(t * 5.2));
    return { b: { "shoulder.L": [0, 0, 0.22 + k * 0.06], "shoulder.R": [0, 0, -0.22 - k * 0.06],   // 腕を頭上へ上げる時は肩ごと持ち上げる(腕の付け根だけで回すと肩の線が折れる)
      "upperArm.L": [-0.15, 0, 1.28 + k * 0.19], "upperArm.R": [-0.15, 0, -1.28 - k * 0.19], "lowerArm.L": [0, 0, 0.55], "lowerArm.R": [0, 0, -0.55], "upperLeg.L": [-0.5 * squat - 0.1 * k, 0, 0.08], "upperLeg.R": [-0.5 * squat - 0.1 * k, 0, -0.08], "lowerLeg.L": [0.9 * squat + 0.35 * k, 0, 0], "lowerLeg.R": [0.9 * squat + 0.35 * k, 0, 0], "foot.L": [-0.4 * squat + 0.3 * k, 0, 0], "foot.R": [-0.4 * squat + 0.3 * k, 0, 0], head: [-0.15 * k, 0, 0], spine: [0.2 * squat, 0, 0] }, y: k * 0.15 - squat * 0.05 }; },
  "sitChair": (t) => ({ b: { "upperLeg.L": [-1.57, 0, 0.05], "upperLeg.R": [-1.57, 0, -0.05], "lowerLeg.L": [1.5 + sin(t * 2) * 0.15, 0, 0], "lowerLeg.R": [1.5 - sin(t * 2) * 0.15, 0, 0], "foot.L": [0.05, 0, 0], "foot.R": [0.05, 0, 0],
      // 腕は横へ下ろして、手は太ももの外・座面の少し上(腕が短いので座面までは届かない)
      "upperArm.L": [-0.1, 0, -0.36], "upperArm.R": [-0.1, 0, 0.36], "lowerArm.L": [0.1, 0, 0], "lowerArm.R": [0.1, 0, 0], spine: [0.05, 0, 0], head: [0.06, sin(t * 0.6) * 0.2, sin(t * 0.9) * 0.1] }, y: -0.118, chair: true, seat: 0.2, seatFront: 0.1 }),
  // いすに座る(内股): 膝をとじてつま先を内へ、すねは外へ開く。少し前かがみで、手は膝の上
  "sitChairGirl": (t) => ({ b: { "upperLeg.L": [-1.57, 0, -0.17], "upperLeg.R": [-1.57, 0, 0.17], "lowerLeg.L": [1.5, 0, 0.36], "lowerLeg.R": [1.5, 0, -0.36], "foot.L": [0.05 + sin(t * 1.4) * 0.08, -0.28, 0], "foot.R": [0.05 - sin(t * 1.4) * 0.08, 0.28, 0],
      // 肘は胴の外へ張り、手は手のひらを下にして膝に乗せる(指先は膝の前へ沿って下りる)
      spine: [0.15, 0, 0], "shoulder.L": [0, -0.15, -0.05], "shoulder.R": [0, 0.15, 0.05],
      "upperArm.L": [0, -0.55, -0.15], "upperArm.R": [0, 0.55, 0.15], "lowerArm.L": [-1.18, 0, -0.77], "lowerArm.R": [-1.18, 0, 0.77], "hand.L": [0.65, -0.8, 0], "hand.R": [0.65, 0.8, 0],
      head: [-0.065, sin(t * 0.5) * 0.12, 0.08 + sin(t * 0.7) * 0.04] }, y: -0.118, chair: true, seat: 0.2, seatFront: 0.1 }),
  "sitFloor": (t) => ({ b: { "upperLeg.L": [-1.5, 0, 0.14], "upperLeg.R": [-1.5, 0, -0.14], "lowerLeg.L": [0.05, 0, 0], "lowerLeg.R": [0.05, 0, 0], "foot.L": [0.25 + sin(t * 3) * 0.2, 0, 0], "foot.R": [0.25 - sin(t * 3) * 0.2, 0, 0],
      // 手は腰の少しうしろ横で床につく(肩を少し落とし、手首を外へ折って指先を床へ)
      "shoulder.L": [0, 0, -0.31], "shoulder.R": [0, 0, 0.31], "upperArm.L": [0.41, 0, -0.19], "upperArm.R": [0.41, 0, 0.19], "lowerArm.L": [0, 0, 0], "lowerArm.R": [0, 0, 0], "hand.L": [-0.2, 0, 0.7], "hand.R": [-0.2, 0, -0.7],
      spine: [-0.18, 0, 0], chest: [-0.05, 0, 0], head: [0.18, 0, sin(t * 0.8) * 0.12] }, y: -0.355 }),
  "hugKnees": (t) => ({ b: { "upperLeg.L": [-2.35, 0, 0.1], "upperLeg.R": [-2.35, 0, -0.1], "lowerLeg.L": [2.45, 0, 0], "lowerLeg.R": [2.45, 0, 0], "foot.L": [-0.1, 0, 0], "foot.R": [-0.1, 0, 0],
      "upperArm.L": [-1.25, 0, -0.25], "upperArm.R": [-1.25, 0, 0.25], "lowerArm.L": [0, 0, -1.25], "lowerArm.R": [0, 0, 1.25],
      // 丸まった背中: 背中の3か所を少しずつ曲げ、肩を前へ巻く。顔は起こして前を見る
      spine: [0.2, 0, 0], chest: [0.2, 0, 0], upperChest: [0.25, 0, 0], "shoulder.L": [0, -0.3, -0.06], "shoulder.R": [0, 0.3, 0.06], neck: [0.04, 0, 0], head: [-0.22 + sin(t * 1.2) * 0.04, 0, 0.12] }, y: -0.31 }),
};

/** Blend the bones toward a pose each frame (smoothly; instant = jump straight to it). */
export function createPosePlayer({ bone, BONES, HIPS0 }) {
  const qT = new THREE.Quaternion(), eT = new THREE.Euler();
  return function apply(name, t, dt, instant = false, yAdd = 0) {   // yAdd: extra hip height (the seat fit in index.js)
    const P0 = POSES[name](t), k = instant ? 1 : 1 - Math.exp(-dt * 9);
    for (const b of BONES) { const r = P0.b[b] || [0, 0, 0]; eT.set(r[0], r[1], r[2]); qT.setFromEuler(eT); bone[b].quaternion.slerp(qT, k); }
    bone.hips.position.y += (HIPS0.y + (P0.y || 0) + yAdd - bone.hips.position.y) * k;
    for (const s of ["L", "R"]) if (bone[`skirt.${s}`]) bone[`skirt.${s}`].quaternion.copy(bone[`upperLeg.${s}`].quaternion);   // the skirt's front bones turn with the thighs (about a point at the front of the waist)
    return P0;
  };
}
