// Climbing (2026-10-03, from the forest game). No clips: a base pose plus IK (ik.js) that puts the hands and feet
// on the surface being climbed. The game knows the surface (a trunk, a wall); this file knows the body:
//   measureBody(avatar)   the body's sizes (shoulders, hips, arm and leg length) — reach depends on the body type
//   measureStride(avatar) how far a walk cycle carries the feet: play the walk at speed / stride and the planted foot doesn't slide
//   climbLimbs(avatar, …) each frame while climbing: the hands and feet, one at a time (right hand, left foot, left hand, right foot);
//                         each holds still on the surface for 3/4 of the cycle (the body moves past it), then reaches to the next hold.
//                         Drive `phase` by the distance climbed / step (like the walk), so the holds don't slide.
// Poses (added to POSES): climb (the base for climbLimbs; sharp), climbOver (crouched on the edge after pulling up).
// Jumping, landing and falling are in jump.js.
// The arms of a big-headed body are short (the default: 0.18 of 0.86 m): the hands can't reach over the head, so holds are at chin height.
import * as THREE from "three";
import { POSES } from "./index.js";
import { LIMBS, ik2 } from "./ik.js";

// the arms raised (the climbing base; the IK then puts the hands on the surface). The same turns as the top of the cheer jump, own copy
const UP_ARMS = (() => { const m = (v) => [v[0], -v[1], -v[2]], L = { "shoulder.L": [0, 0, 0.28], "upperArm.L": [-0.64, -0.38, 1.35], "lowerArm.L": [0, -0.04, 0.15], "hand.L": [-0.54, 0.54, -0.25] };
  return { ...L, "shoulder.R": m(L["shoulder.L"]), "upperArm.R": m(L["upperArm.L"]), "lowerArm.R": m(L["lowerArm.L"]), "hand.R": m(L["hand.L"]) }; })();

Object.assign(POSES, {
  // climbing (the base): arms up, thighs up and open, knees bent, looking up. climbLimbs puts the hands and feet on the surface
  climb: () => ({ b: { ...UP_ARMS, "upperLeg.L": [-1.1, 0, 0.35], "upperLeg.R": [-1.1, 0, -0.35], "lowerLeg.L": [1.5, 0, 0], "lowerLeg.R": [1.5, 0, 0], "foot.L": [-0.2, 0, 0], "foot.R": [-0.2, 0, 0], head: [-0.25, 0, 0] }, y: 0, sharp: true, grip: { L: 0.8, R: 0.8 } }),
  // over the edge after pulling up: crouched (motion/jump.js), then the game goes to idle or walk
  climbOver: () => POSES.crouch(),
});

/** The body's sizes in the avatar's own units (avatar.object's space: multiply by its scale for metres):
 *  shX / shY: a shoulder joint's distance from the middle and height; arm: shoulder → wrist; hipX / hipY, leg: hip joint → ankle. */
export function measureBody(avatar) {
  const root = avatar.object, B = avatar.bones;
  avatar.update(0, { t: 0, pose: "aPose", instant: true }); root.updateMatrixWorld(true);
  const p = (n) => root.worldToLocal(B[n].getWorldPosition(new THREE.Vector3()));
  const sh = p("upperArm.L"), el = p("lowerArm.L"), wr = p("hand.L"), hp = p("upperLeg.L"), kn = p("lowerLeg.L"), an = p("foot.L");
  avatar.update(0, { t: 0, pose: "idle", instant: true });
  return { shX: Math.abs(sh.x), shY: sh.y, arm: sh.distanceTo(el) + el.distanceTo(wr), hipX: Math.abs(hp.x), hipY: hp.y, leg: hp.distanceTo(kn) + kn.distanceTo(an) };
}

/** How fast a walk-like pose carries the body at playback speed 1 (avatar units / s): trace one cycle (period s) and take the ankle's
 *  front-to-back travel; a planted foot travels that much in half a cycle. Play it at speed / stride and the feet don't slide. */
export function measureStride(avatar, pose = "walk", period = 2 * Math.PI / 6.2) {
  const root = avatar.object, foot = avatar.bones["foot.L"], v = new THREE.Vector3(), N = 32;
  let z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < N; i++) {
    avatar.update(0, { t: (i / N) * period, pose, instant: true }); root.updateMatrixWorld(true);
    root.worldToLocal(foot.getWorldPosition(v)); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  avatar.update(0, { t: 0, pose: "idle", instant: true });
  return (z1 - z0) / (period / 2);
}

const ORDER = [["hand.R", 0], ["foot.L", 0.25], ["hand.L", 0.5], ["foot.R", 0.75]], STANCE = 0.75;
const _p = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
/** Each frame while climbing, after avatar.update with the "climb" pose: the hands and feet onto the surface.
 *  body: measureBody(avatar) times the scale (metres). phase: cycles climbed (distance / step). step: metres per cycle (about 0.7 × arm).
 *  dir: { s, h } the way the body moves on the surface (s: to its right, h: up; unit). right / out: world unit vectors — the body's right
 *  along the surface, and away from the surface (behind the body). place(lateral, up, lift, out): the world point on the surface `lateral`
 *  to the right of the body's feet point and `up` above it, lifted `lift` off the surface (the game's surface: a cylinder, a wall). */
export function climbLimbs(avatar, { body: D, phase, step, dir, right, out, place }) {
  avatar.object.updateMatrixWorld(true);
  const B = avatar.bones;
  for (const [name, off] of ORDER) {
    const L = LIMBS[name], u = (((phase + off) % 1) + 1) % 1;
    let along, lift;
    if (u < STANCE) { along = step * (0.5 - u / STANCE); lift = 0; }   // holding: slides back as the body moves
    else { const k = (u - STANCE) / (1 - STANCE), e = k * k * (3 - 2 * k); along = step * (-0.5 + e); lift = Math.sin(Math.PI * k) * 0.05; }   // reaching to the next hold
    const lat = -L.side * (L.arm ? D.shX * 1.15 : D.hipX * 1.5);       // the body's left (side 1) is to the left of `right`
    const up = L.arm ? D.shY + D.arm * 0.33 : D.hipY - D.leg * 0.55;   // hands at chin height, feet under the hips
    place(lat + dir.s * along, up + dir.h * along, lift, _p);
    // elbows: out, down, back from the surface. knees: out and toward the surface (open like a frog's)
    B[L.root].getWorldPosition(_w); _r.copy(right).multiplyScalar(-L.side * 0.3);
    if (L.arm) _w.add(_r).addScaledVector(out, 0.15).y -= 0.25; else _w.add(_r).addScaledVector(out, -0.3);
    ik2(B, L, _p, _w);
  }
}
