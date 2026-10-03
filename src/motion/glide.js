// Gliding under something held overhead, and holding a pole with both hands (2026-10-03, from the forest game, Saori:
// 「登ったところからパラセールみたいに葉っぱでとべたら楽しそう」 — a big leaf held up by its stalk, like a paraglider).
//   glide     hanging from both hands above the head (the IK puts them on the stalk): the body hangs straight, the legs trail a little
//             behind and swing loosely, toes pointed down, the head looking ahead and down. sharp (IK runs on it every frame).
//   holdPole  each frame after avatar.update: both hands onto a pole (a stalk, a stick, a rope) at a world point, one just above the other,
//             the elbows out to the sides. The game owns what is held (its mesh, where it is); the engine only puts the hands on it.
import * as THREE from "three";
import { POSES } from "./index.js";
import { LIMBS, ik2 } from "./ik.js";

const sin = Math.sin, m = (v) => [v[0], -v[1], -v[2]];   // L → R (mirror)
const ARM = { "shoulder.L": [0, 0, 0.3], "upperArm.L": [-0.5, -0.3, 1.4], "lowerArm.L": [0, -0.04, 0.2] };   // up (the IK finishes them)

Object.assign(POSES, {
  glide: (t) => {
    const a = sin(t * 2.3), b = sin(t * 2.3 + 0.9);   // the legs swing loosely, a little out of step
    return { b: { ...ARM, "shoulder.R": m(ARM["shoulder.L"]), "upperArm.R": m(ARM["upperArm.L"]), "lowerArm.R": m(ARM["lowerArm.L"]),
      spine: [0.12, 0, 0], head: [0.15, 0, 0],
      "upperLeg.L": [0.12 + 0.1 * a, 0, 0.06], "upperLeg.R": [0.12 - 0.1 * b, 0, -0.06],
      "lowerLeg.L": [0.5 + 0.12 * b, 0, 0], "lowerLeg.R": [0.5 + 0.12 * a, 0, 0],
      "foot.L": [0.45, 0, 0], "foot.R": [0.45, 0, 0] }, y: 0, sharp: true, grip: { L: 1, R: 1 } };
  },
});

const _f = new THREE.Vector3(), _p = new THREE.Vector3(), _pole = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
/** Both hands onto a pole. at: the world point between the hands; up: the pole's direction (unit); right: the body's right (unit, across the pole);
 *  gap: how far apart the hands are along the pole (the left one higher); spread: how far each sits to its side of the pole's centre line (the pole's radius).
 *  Returns how far the farther hand is from where it should be (0 = both on it). */
export function holdPole(avatar, { at, up = UP, right, gap = 0.035, spread = 0.015 }) {
  const B = avatar.bones; avatar.object.updateMatrixWorld(true);
  _f.crossVectors(up, right).normalize();   // forward (the side the body faces)
  let miss = 0;
  for (const name of ["hand.L", "hand.R"]) {
    const L = LIMBS[name], s = L.side;   // the left hand is on the left (-right) and higher
    _p.copy(at).addScaledVector(right, -s * spread).addScaledVector(up, s * gap / 2);
    B[L.root].getWorldPosition(_pole); _pole.addScaledVector(right, -s * 0.3).addScaledVector(_f, 0.1).addScaledVector(up, -0.12);   // elbows out and a little forward
    miss = Math.max(miss, ik2(B, L, _p, _pole));
  }
  return miss;
}
