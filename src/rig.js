// Rig: bones from the joints, and skin weights from the body parts.
import * as THREE from "three";

/** Bones at the joints (each bone positioned relative to its parent), under one root group. */
export function makeSkeleton({ J, PARENT, BONES }) {
  const root = new THREE.Group(), bone = {};
  for (const b of BONES) { const o = new THREE.Bone(); o.name = b; const p = J[b], q = PARENT[b] ? J[PARENT[b]] : [0, 0, 0]; o.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]); bone[b] = o; (PARENT[b] ? bone[PARENT[b]] : root).add(o); }
  root.updateMatrixWorld(true);
  return { root, bone, skeleton: new THREE.Skeleton(BONES.map((b) => bone[b])), HIPS0: bone.hips.position.clone() };
}

export { makeWeights } from "./weights.js";   // skin weights live in their own module (no three.js), so the build workers can use them too
