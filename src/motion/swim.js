// In the water (2026-10-04, from the forest game, Saori: 「今泳げないし、足がつかないところはいけない」).
//   swim        a dog paddle (a big head and short arms: the head stays up, the hands paddle under the chin in turn), the body tipped
//               forward, legs kicking behind. SWIM_W rad/s at playback speed 1; the game plays it faster the faster it swims.
//   treadWater  upright in deep water, not moving: the hands scull out to the sides at the surface, the legs pedal slowly (eggbeater)
//   wade        walking through water up to the thighs: knees lifted high, the body leaning in, arms raised a little out of the water
// The game keeps the body at the surface (it knows the water); swimHead(avatar) says how high the chin is in the swim pose.
import * as THREE from "three";
import { POSES } from "./index.js";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
export const SWIM_W = 5.5;   // one paddle cycle (both hands) in 1.14 s
const PITCH = 0.95;          // how far the body tips forward swimming (rad)

Object.assign(POSES, {
  swim: (t) => {
    const ph = t * SWIM_W, s = sin(ph), c = cos(ph), k = sin(ph * 2);
    // arm turns: z first (from the A-pose's 46° out; negative = down), then x (negative = forward). Each hand reaches forward, then pulls down and back under the chest
    const armL = [-1.25 - 0.55 * s, 0, -0.55], armR = [-1.25 + 0.55 * s, 0, 0.55];
    return { b: { hips: [PITCH, s * 0.06, 0], spine: [0.05, 0, 0], head: [-PITCH - 0.05, 0, 0],   // the head turned back up: eyes ahead, chin at the water
      "upperArm.L": armL, "upperArm.R": armR, "lowerArm.L": [-0.5 - 0.45 * mx(0, c), 0, 0], "lowerArm.R": [-0.5 - 0.45 * mx(0, -c), 0, 0],
      "upperLeg.L": [-PITCH + 0.45 + 0.35 * k, 0, 0.07], "upperLeg.R": [-PITCH + 0.45 - 0.35 * k, 0, -0.07],   // legs trailing behind the tipped body, kicking
      "lowerLeg.L": [0.35 + 0.35 * mx(0, -k), 0, 0], "lowerLeg.R": [0.35 + 0.35 * mx(0, k), 0, 0], "foot.L": [0.7, 0, 0], "foot.R": [0.7, 0, 0] },
      y: 0, grip: { L: 0.2, R: 0.2 } };
  },
  treadWater: (t) => {
    const ph = t * 3.2, s = sin(ph), c = cos(ph);
    return { b: { spine: [0.12, 0, 0], head: [-0.15, 0, 0],
      "upperArm.L": [-0.35, 0.1 * s, 0.05 + 0.2 * s], "upperArm.R": [-0.35, -0.1 * s, -0.05 - 0.2 * s], "lowerArm.L": [-0.7, 0, 0], "lowerArm.R": [-0.7, 0, 0],   // sculling out at the sides
      "upperLeg.L": [-0.75 + 0.3 * s, 0, 0.18], "upperLeg.R": [-0.75 - 0.3 * s, 0, -0.18], "lowerLeg.L": [1.1 + 0.4 * c, 0, 0], "lowerLeg.R": [1.1 - 0.4 * c, 0, 0],
      "foot.L": [0.3, 0, 0], "foot.R": [0.3, 0, 0] }, y: 0, grip: { L: 0.2, R: 0.2 } };
  },
  wade: (t) => {
    const ph = t * 5.2, s = sin(ph), kL = 0.3 + 1.0 * mx(0, sin(ph + 1.6)), kR = 0.3 + 1.0 * mx(0, sin(ph + 1.6 + Math.PI));
    const tL = -0.35 - 0.45 * mx(0, -s) + 0.25 * mx(0, s), tR = -0.35 - 0.45 * mx(0, s) + 0.25 * mx(0, -s);   // the swinging thigh comes up high
    return { b: { hips: [0, s * 0.1, 0], spine: [0.22, -s * 0.06, 0], head: [-0.15, 0, 0],
      "upperLeg.L": [tL, 0, 0.04], "upperLeg.R": [tR, 0, -0.04], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.2 - kL * 0.25, 0, 0], "foot.R": [-0.2 - kR * 0.25, 0, 0],
      "upperArm.L": [-0.35 + 0.2 * s, 0, 0.2], "upperArm.R": [-0.35 - 0.2 * s, 0, -0.2], "lowerArm.L": [-0.7, 0, 0], "lowerArm.R": [-0.7, 0, 0] },   // arms up and out, clear of the water
      y: -0.04 };
  },
});

/** The chin's height above the feet point in the swim pose (avatar units): put the feet point at water level − this × scale, and the head rides the surface. */
export function swimHead(avatar) {
  const root = avatar.object, v = new THREE.Vector3();
  avatar.update(0, { t: 0, pose: "swim", instant: true, detail: "off" }); root.updateMatrixWorld(true);
  const y = root.worldToLocal(avatar.bones.head.getWorldPosition(v)).y;
  avatar.update(0, { t: 0, pose: "idle", instant: true });
  return y;
}
