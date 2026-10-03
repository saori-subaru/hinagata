// IK: put the tip of a limb (wrist, ankle) on a point, after the pose is set (2026-10-03, from the forest game's tree climbing).
// Two bones, solved exactly: the elbow / knee lands on the circle where both bone lengths fit, on the side of the pole point.
// Works in world space on the avatar's bones (any scale or turn of avatar.object), so call it after avatar.update(dt) each frame.
// The pose player eases from the bones' current turn: give a pose `sharp: true` if IK runs on it every frame (else last frame's IK leaks in).
import * as THREE from "three";

/** The limbs as bone chains: root (shoulder / hip joint) → mid (elbow / knee) → end (wrist / ankle). */
export const LIMBS = {
  "hand.L": { root: "upperArm.L", mid: "lowerArm.L", end: "hand.L", arm: true, side: 1 },
  "hand.R": { root: "upperArm.R", mid: "lowerArm.R", end: "hand.R", arm: true, side: -1 },
  "foot.L": { root: "upperLeg.L", mid: "lowerLeg.L", end: "foot.L", arm: false, side: 1 },
  "foot.R": { root: "upperLeg.R", mid: "lowerLeg.R", end: "foot.R", arm: false, side: -1 },
};

const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();

/** Turn a bone so that a direction it has now (world, `from`) points along `to` (world). The shortest turn: the twist is kept. */
export function aim(bone, from, to) {
  _q.setFromUnitVectors(_u.copy(from).normalize(), _v.copy(to).normalize());
  bone.getWorldQuaternion(_qw); bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_q).multiply(_qw));
  bone.updateMatrixWorld(true);
}

/** Two-bone IK. bones: avatar.bones, limb: LIMBS[...] (or { root, mid, end }), target / pole: world points.
 *  Out of reach: the limb points straight at the target. Returns how far the tip is from the target (0 when reached). */
export function ik2(bones, limb, target, pole) {
  const r = bones[limb.root], m = bones[limb.mid], e = bones[limb.end];
  r.getWorldPosition(_a); m.getWorldPosition(_b); e.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c), want = _t.copy(target).sub(_a).length();
  const d = Math.min(Math.max(want, Math.abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999); _t.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _d.copy(pole).sub(_a); _d.addScaledVector(_t, -_d.dot(_t)).normalize();   // across the line to the target, toward the pole
  _e.copy(_a).addScaledVector(_t, x).addScaledVector(_d, y);                // where the elbow / knee goes
  aim(r, _b.sub(_a), _e.sub(_a));
  m.getWorldPosition(_b); e.getWorldPosition(_c);
  aim(m, _c.sub(_b), _e.copy(_a).addScaledVector(_t, d).sub(_b));
  return Math.max(0, want - d);
}
