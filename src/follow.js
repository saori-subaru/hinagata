// Dressing another rig in a Hinagata character (2026-10-05, Saori: a tennis game made with plain three.js, its mannequins swapped for
// Hinagata characters, its own animation code left as it was). The other rig keeps moving as its game moves it; each update its joints'
// turns are copied onto the avatar's bones, and the avatar takes the rig's place.
//
// Both rigs are compared from their rest poses (the other rig's when follow is called, the avatar's built one). A joint's turn is how far
// it has turned from its rest, and that turn is given to the bone in the same frame (world axes at rest, the avatar's convention).
// Where the two rest poses differ (a mannequin's arms hang straight down, the avatar's are in an A-pose 44° down; a T-pose's are level),
// a limb bone is first turned from its own rest direction onto the other rig's (off) and its children see the rest of the turn through that.
// The shoulders (the collarbones), if the other rig has none, rise by themselves as the arm goes up (as the avatar's own poses do: level
// 0.15, straight up 0.28): without them a raised arm sank into the shoulder.
import * as THREE from "three";

const CHILD = { "upperArm.L": "lowerArm.L", "lowerArm.L": "hand.L", "upperArm.R": "lowerArm.R", "lowerArm.R": "hand.R",
  "upperLeg.L": "lowerLeg.L", "lowerLeg.L": "foot.L", "upperLeg.R": "lowerLeg.R", "lowerLeg.R": "foot.R" };
const TORSO = [["spine", 0.4], ["chest", 0.3], ["upperChest", 0.3]];   // a rig with one spine joint: its turn shared out over the three
const DOWN = new THREE.Vector3(0, -1, 0), I = new THREE.Quaternion();

/**
 * joints: { hips, spine, head, "upperArm.L", "lowerArm.L", "hand.L", "upperLeg.L", "lowerLeg.L", "foot.L", … and .R } → the other rig's
 *   Object3Ds (chest, upperChest, neck, shoulder.L/R, fingers… may be given too; what isn't given stays at rest or is shared, see above).
 * root: the other rig's root (feet at y = 0, facing +z). fit: the avatar's size: true / "legs" (default): its legs as long as the rig's;
 *   { height }: that tall in the rig's units (a chibi at the legs of a tall rig was a giant: 2026-10-05); false: as built.
 * Returns the follower: { sync() (copy the joints now; the avatar's update does it), attach(object, bone), scale, stop() }.
 */
export function createFollower({ avatar, POSES, J, PARENT, BONES, legK = 1, joints, root, fit = true, hide = true, grip = null, place = true }) {   // place: false — the avatar's object isn't moved onto the root (the rig is inside it: avatar.joints)
  root.updateMatrixWorld(true);
  const rootQ = new THREE.Quaternion(), rootP = new THREE.Vector3(), rootS = new THREE.Vector3(), tq = new THREE.Quaternion(), tp = new THREE.Vector3();
  root.matrixWorld.decompose(rootP, rootQ, rootS); const rootQi = rootQ.clone().invert(), rootInv = root.matrixWorld.clone().invert();
  const rel = (o) => o.getWorldQuaternion(tq).premultiply(rootQi);   // a joint's turn in the rig's root space (rootQi · world)
  const posIn = (o, out = new THREE.Vector3()) => o.getWorldPosition(out).applyMatrix4(rootInv);
  const src = {}, restQ = {}, restP = {};
  for (const [b, o] of Object.entries(joints)) { if (!o || !BONES.includes(b)) continue; src[b] = o; restQ[b] = rel(o).clone(); restP[b] = posIn(o); }
  if (!src.hips) throw new Error("follow: joints.hips is needed (the rig's pelvis)");

  // size: the hip joints at the rig's height, or the whole avatar as tall as asked (its meshes' top, as built)
  const tall = () => { let top = 0; for (const x of Object.values(avatar.parts)) { if (!x?.m?.visible) continue; const g = x.m.geometry; g.computeBoundingBox(); top = Math.max(top, g.boundingBox.max.y); } return top || 1; };
  const scale = fit?.height ? fit.height / tall() : fit && src["upperLeg.L"] ? restP["upperLeg.L"].y / J["upperLeg.L"][1] : 1;
  // limb bones turned from the avatar's rest direction onto the rig's; hands and feet go with their forearm / shin
  const off = {};
  for (const [b, c] of Object.entries(CHILD)) if (src[b] && src[c]) {
    const dh = new THREE.Vector3(J[c][0] - J[b][0], J[c][1] - J[b][1], J[c][2] - J[b][2]).normalize(), ds = restP[c].clone().sub(restP[b]).normalize();
    off[b] = new THREE.Quaternion().setFromUnitVectors(dh, ds);
  }
  for (const s of ["L", "R"]) { if (off[`lowerArm.${s}`]) off[`hand.${s}`] = off[`lowerArm.${s}`]; if (off[`lowerLeg.${s}`]) off[`foot.${s}`] = off[`lowerLeg.${s}`]; }
  const offOf = (b) => off[b] ?? I;
  const share = src.spine && !src.chest && !src.upperChest;
  // the nearest bone up the avatar's tree that follows a joint (its rig turn is the parent's frame)
  const up = (b) => { for (let p = PARENT[b]; p; p = PARENT[p]) if (src[p] || (share && (p === "chest" || p === "upperChest"))) return share && (p === "chest" || p === "upperChest") ? "spine" : p; return null; };

  if (hide) root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) o.visible = false; });

  const name = `__follow${createFollower.n = (createFollower.n ?? 0) + 1}`;
  const pose = { b: {}, y: 0, sharp: true, grip };
  POSES[name] = () => pose;
  const W = {}, q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), d = new THREE.Vector3(), Q = {};
  const put = (b, quat) => { e.setFromQuaternion(quat, "XYZ"); pose.b[b] = [e.x, e.y, e.z]; Q[b] = quat.clone(); };
  const restDir = {}; for (const s of ["L", "R"]) { const a = J[`upperArm.${s}`], b = J[`lowerArm.${s}`]; restDir[s] = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); }

  const follower = {
    pose: name, scale,
    /** copy the rig's joints and place now (the avatar's update calls it first) */
    sync() {
      root.updateMatrixWorld(true); root.matrixWorld.decompose(rootP, rootQ, rootS); rootQi.copy(rootQ).invert(); rootInv.copy(root.matrixWorld).invert();   // (the rig moves: its root space now)
      for (const b in src) W[b] = rel(src[b]).multiply(q.copy(restQ[b]).invert()).clone();   // each joint's turn from its rest (root space)
      for (const b of BONES) {
        if (!src[b]) continue;
        const p = up(b), turn = p ? q.copy(W[p]).invert().multiply(W[b]) : q.copy(W[b]);
        if (share && b === "spine") { for (const [t, k] of TORSO) put(t, q2.copy(I).slerp(turn, k)); continue; }
        put(b, q2.copy(offOf(p)).invert().multiply(turn).multiply(offOf(b)));
      }
      for (const s of ["L", "R"]) {   // the collarbone rises with the arm (if the rig has none of its own)
        const ua = `upperArm.${s}`; if (src[`shoulder.${s}`] || !Q[ua]) continue;
        const a = Math.acos(Math.max(-1, Math.min(1, -d.copy(restDir[s]).applyQuaternion(Q[ua]).y)));   // the arm's angle from straight down
        const lift = 0.3 * Math.min(1, Math.max(0, (a - 0.7) / 2.2)), sh = q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s === "L" ? lift : -lift);
        put(`shoulder.${s}`, sh.clone()); put(ua, sh.invert().multiply(Q[ua]));
      }
      pose.y = (posIn(src.hips, tp).y - restP.hips.y) / (scale * legK);   // the hips up and down (the rig's units → the avatar's)
      if (place) { avatar.object.position.copy(rootP); avatar.object.quaternion.copy(rootQ); avatar.object.scale.copy(rootS).multiplyScalar(scale); }
    },
    /** move something the rig held (a racket on its hand) onto the avatar's bone, placed on it as it was on the joint */
    attach(object, bone) {
      const b = bone ?? Object.keys(src).find((k) => src[k] === object.parent);
      if (!b || !avatar.bones[b]) throw new Error(`follow.attach: which bone? (got "${bone}")`);
      const wrap = new THREE.Group(); wrap.name = `held:${object.name || "item"}`;
      wrap.quaternion.copy(offOf(b)).invert().multiply(restQ[b] ?? I); wrap.scale.setScalar(1 / scale);
      wrap.add(object); object.traverse((o) => { if (o.isMesh) o.visible = true; });
      avatar.bones[b].add(wrap); return wrap;
    },
    /** how far each hand closes into a fist (0–1) while the rig is followed */
    setGrip(g) { pose.grip = g; },
    stop() { delete POSES[name]; },
    offOf, up,   // (for avatar.joints: a pose's bone turns written back onto the rig, copyMotion)
  };
  follower.sync();
  return follower;
}
