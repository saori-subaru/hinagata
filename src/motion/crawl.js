// Crouching low and crawling (2026-10-03, from the forest game: ducking under roots and logs, later hiding).
//   sneak      walking crouched: knees bent, hips low, leaning in, arms a little forward
//   crawl      on hands and knees (the base for crawlLimbs; sharp): the hips turn the body forward until the back is nearly flat, the thighs
//              hang straight down to the knees, the shins lie back along the ground, the head looks ahead
//   crawlLimbs each frame while crawling: the hands and knees… the hands, and the ankles behind the knees, onto the ground, one limb at a time
//              (right hand → left leg → left hand → right leg), each holding still for 3/4 of the cycle while the body moves past it.
//              Drive `phase` by the distance crawled / step, like the climbing gait (climb.js), so they don't slide.
// Heights (default body, 0.86 m standing): crouched about 0.62 m, crawling about 0.4 m. The game decides what fits under what.
import * as THREE from "three";
import { POSES } from "./index.js";
import { LIMBS, ik2 } from "./ik.js";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
const LT = 0.19, LS = 0.165;   // thigh / shin length (default body, avatar units)
export const SNEAK_W = 6.2;    // rad/s at playback speed 1 (as the walk)
const PITCH = 1.25;            // how far the hips turn the body forward when crawling (rad)

Object.assign(POSES, {
  sneak: (t) => {
    const ph = t * SNEAK_W, s = sin(ph), q = 0.55, kL = 0.95 + 0.6 * mx(0, sin(ph + 1.9)), kR = 0.95 + 0.6 * mx(0, sin(ph + 1.9 + Math.PI));
    const tL = -0.6 - 0.4 * s, tR = -0.6 + 0.4 * s;   // thighs: forward of hanging (crouched) and swinging
    const drop = LT * (1 - cos(0.6)) + LS * (1 - cos(0.95 - 0.6));   // the hips come down by the crouch
    return { b: { hips: [0, s * 0.08, 0], spine: [0.4, -s * 0.06, 0], head: [-0.3, 0, 0],
      "upperLeg.L": [tL, 0, 0.06], "upperLeg.R": [tR, 0, -0.06], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0],
      "foot.L": [-(kL + tL) * 0.9, 0, 0], "foot.R": [-(kR + tR) * 0.9, 0, 0],   // soles kept near flat
      "upperArm.L": [-0.5 + 0.3 * s, 0, -0.6], "upperArm.R": [-0.5 - 0.3 * s, 0, 0.6], "lowerArm.L": [-0.6, 0, 0], "lowerArm.R": [-0.6, 0, 0] },
      y: -drop - 0.01 * Math.abs(cos(ph)), sharp: true };
  },
  crawl: () => ({ b: {
    hips: [PITCH, 0, 0], spine: [0.05, 0, 0], head: [-1.0, 0, 0],   // the body tipped forward; the head turned back up to look ahead
    "upperLeg.L": [-PITCH - 0.2, 0, 0.08], "upperLeg.R": [-PITCH - 0.2, 0, -0.08],   // thighs down to the knees (a little forward of straight down)
    "lowerLeg.L": [1.6, 0, 0], "lowerLeg.R": [1.6, 0, 0], "foot.L": [0.5, 0, 0], "foot.R": [0.5, 0, 0],   // shins back along the ground, toes trailing
    "upperArm.L": [-PITCH, 0, -0.7], "upperArm.R": [-PITCH, 0, 0.7], "lowerArm.L": [-0.1, 0, 0], "lowerArm.R": [-0.1, 0, 0],
  }, y: -(0.44 - LT - 0.03), sharp: true }),   // hips down to about a thigh's length over the ground (standing, they are ~0.44 up)
});

const ORDER = [["hand.R", 0], ["foot.L", 0.25], ["hand.L", 0.5], ["foot.R", 0.75]], STANCE = 0.75;
const _p = new THREE.Vector3(), _w = new THREE.Vector3(), _r = new THREE.Vector3();
/** Each frame while crawling, after avatar.update with the "crawl" pose: hands and ankles onto the ground.
 *  body: measureBody(avatar) times the scale (metres). phase: cycles crawled (distance / step). step: metres per cycle.
 *  fwd / right: world unit vectors along the ground (the way the body faces, and its right). ground(x, z): the ground's height there. */
export function crawlLimbs(avatar, { body: D, phase, step, fwd, right, ground }) {
  avatar.object.updateMatrixWorld(true);
  const B = avatar.bones;
  for (const [name, off] of ORDER) {
    const L = LIMBS[name], u = (((phase + off) % 1) + 1) % 1;
    let along, lift;
    if (u < STANCE) { along = step * (0.5 - u / STANCE); lift = 0; }
    else { const k = (u - STANCE) / (1 - STANCE), e = k * k * (3 - 2 * k); along = step * (-0.5 + e); lift = Math.sin(Math.PI * k) * 0.04; }
    // hands: under and a little ahead of the shoulder; ankles: behind the knee (a shin's length behind the hip joint)
    B[L.root].getWorldPosition(_w);
    const lat = -L.side * (L.arm ? D.shX * 0.6 : D.hipX * 0.4), ahead = L.arm ? D.arm * 0.25 : -D.leg * 0.55;
    _p.copy(_w).addScaledVector(fwd, ahead + along).addScaledVector(right, lat);
    _p.y = ground(_p.x, _p.z) + (L.arm ? 0.02 : 0.025) + lift;
    // elbows: back and out; knees: down and forward (they rest on the ground)
    _r.copy(right).multiplyScalar(-L.side * 0.2);
    if (L.arm) _w.add(_r).addScaledVector(fwd, -0.3); else { _w.add(_r).addScaledVector(fwd, 0.3); _w.y -= 0.3; }
    ik2(B, L, _p, _w);
  }
}
