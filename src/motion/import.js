// Motions from files: VRM animations (.vrma) and Mixamo clips (.fbx, or .glb / .gltf with Mixamo's bone names), played on an avatar.
// The file's skeleton is loaded on its own (not drawn) and played with three's AnimationMixer; the avatar follows it through follow.js,
// which turns each limb from the avatar's A-pose rest onto the file's rest (a T-pose) and copies each joint's turn from there.
// The avatar keeps its own size: the hips' moves are scaled by its leg length over the file's (else a short-legged body's feet slide and float).
// The steady travel of a walk is taken out of the hips and given as `velocity` (the game moves the avatar by it; move: true does it).
// Mixamo's files may be used in a game but not redistributed: the engine ships none, a game loads the ones its makers downloaded.
import * as THREE from "three";

const SIDES = [["left", "L"], ["right", "R"]];
const VRM = { hips: "hips", spine: "spine", chest: "chest", upperChest: "upperChest", neck: "neck", head: "head" };
for (const [w, s] of SIDES) for (const [v, b] of [["Shoulder", "shoulder"], ["UpperArm", "upperArm"], ["LowerArm", "lowerArm"], ["Hand", "hand"], ["UpperLeg", "upperLeg"], ["LowerLeg", "lowerLeg"], ["Foot", "foot"]]) VRM[w + v] = `${b}.${s}`;
// Mixamo's names, lower case without "mixamorig:" (Spine / Spine1 / Spine2 → the three torso bones)
const MIXAMO = { hips: "hips", spine: "spine", spine1: "chest", spine2: "upperChest", neck: "neck", head: "head" };
for (const [w, s] of SIDES) for (const [m, b] of [["shoulder", "shoulder"], ["arm", "upperArm"], ["forearm", "lowerArm"], ["hand", "hand"], ["upleg", "upperLeg"], ["leg", "lowerLeg"], ["foot", "foot"]]) MIXAMO[w + m] = `${b}.${s}`;
export const BONE_NAMES = { vrm: VRM, mixamo: MIXAMO };
const mixamoKey = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^mixamorig\d*/, "");

async function read(src, kind) {
  if (kind === "fbx") { const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js"); const L = new FBXLoader();
    if (typeof src === "string") { const g = await L.loadAsync(src); return { root: g, clips: g.animations }; }
    const g = L.parse(src, ""); return { root: g, clips: g.animations }; }
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"); const L = new GLTFLoader();
  const g = typeof src === "string" ? await L.loadAsync(src) : await L.parseAsync(src, "");
  return { root: g.scene, clips: g.animations, parser: g.parser };
}

/**
 * Load a motion. src: a URL, or an ArrayBuffer with { kind: "vrma" | "fbx" | "glb" }. clip: which animation in the file (index or name).
 * Returns { joints, root, clip, duration, travel: [x, z] (the file's units / s), attach(avatar, opts) }.
 */
export async function loadMotion(src, { kind, clip = 0 } = {}) {
  kind ??= typeof src === "string" ? (src.split(/[?#]/)[0].match(/\.(\w+)$/)?.[1] ?? "glb").toLowerCase() : "glb";
  const { root, clips, parser } = await read(src, kind === "fbx" ? "fbx" : "gltf");
  const joints = {}, ext = parser?.json.extensions?.VRMC_vrm_animation;
  if (ext) { for (const [k, v] of Object.entries(ext.humanoid?.humanBones ?? {})) if (VRM[k]) joints[VRM[k]] = await parser.getDependency("node", v.node); }
  else root.traverse((o) => { const b = MIXAMO[mixamoKey(o.name)]; if (b && !joints[b]) joints[b] = o; });
  if (!joints.hips) throw new Error("loadMotion: no hips in the file (VRM humanoid or Mixamo names expected)");
  const C = typeof clip === "number" ? clips[clip] : clips.find((c) => c.name === clip);
  if (!C) throw new Error(`loadMotion: no animation "${clip}" (the file has ${clips.length})`);
  // the steady travel: the hips' track straightened between its first and last key (what is left is the sway). For a loop, a jump at the wrap is avoided.
  const H = joints.hips, tr = C.tracks.find((t) => t.name === `${H.name}.position` || t.name === `${H.uuid}.position`);
  const travel = [0, 0];
  if (tr && tr.times.length > 1) { const v = tr.values, n = tr.times.length, T = tr.times[n - 1] - tr.times[0], dx = v[3 * n - 3] - v[0], dz = v[3 * n - 1] - v[2];
    for (let i = 0; i < n; i++) { const u = (tr.times[i] - tr.times[0]) / T; v[3 * i] -= dx * u; v[3 * i + 2] -= dz * u; }
    root.updateMatrixWorld(true); const d = new THREE.Vector3(dx, 0, dz).applyMatrix3(new THREE.Matrix3().setFromMatrix4(H.parent.matrixWorld)).applyMatrix3(new THREE.Matrix3().setFromMatrix4(root.matrixWorld).invert());
    travel[0] = d.x / T; travel[1] = d.z / T; }   // (the hips' parent's turn and scale: Mixamo's are in cm under a 0.01 node)
  // Mixamo's FBX: the nodes as stored are not its T-pose (the hips by the floor); a skinned mesh's bind pose is (downloads "without skin" have none: 🚧 untried)
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  // some bind poses have the hips at the origin and the feet under the floor: lift them so the ankles stand off it (Mixamo's run: 0.09 of the leg)
  { root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert(), y = (k) => joints[k].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).y;
    const foot = Math.min(y("foot.L"), y("foot.R")), leg = y("hips") - foot;
    if (foot < 0) { const up = new THREE.Vector3(0, -foot + 0.09 * leg, 0).applyMatrix4(root.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(root.matrixWorld));
      H.parent.worldToLocal(up.add(H.parent.getWorldPosition(new THREE.Vector3()))); H.position.add(up); } }
  // the rest pose as loaded (the file's T-pose): the avatar is matched to it again whenever one is attached, after the clip has moved the bones
  const rest = []; root.traverse((o) => rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const toRest = () => { for (const [o, p, q, s] of rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); } root.updateMatrixWorld(true); };
  const legOf = () => { toRest(); const y = (k) => joints[k].getWorldPosition(new THREE.Vector3()).y; return (y("upperLeg.L") + y("upperLeg.R") - y("foot.L") - y("foot.R")) / 2; };

  return {
    joints, root, clip: C, duration: C.duration, travel,
    /** Play it on an avatar: { loop = true, speed = 1, move = false (move avatar.object by velocity), grip, clear = true (arms turned out of the body) }. Each frame call update(dt) before
     *  avatar.update(dt). Returns { update(dt), velocity: [x, z] (the avatar's units / s, its own axes), time, stop() }. */
    attach(avatar, { loop = true, speed = 1, move = false, grip = null, clear = true } = {}) {
      const J = avatar.internals.J, legA = (J["upperLeg.L"][1] - J["foot.L"][1] + J["upperLeg.R"][1] - J["foot.R"][1]) / 2, k = legA / legOf();
      avatar.follow(joints, { root, fit: false, hide: true, place: false, motionScale: k, grip, clear: clear && { bodySdf: avatar.internals.bodySdf } });   // (the file at rest now: follow reads its rest)
      const mixer = new THREE.AnimationMixer(root), action = mixer.clipAction(C);
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); action.clampWhenFinished = true; action.play(); mixer.update(0);
      const velocity = [travel[0] * k, travel[1] * k], q = new THREE.Quaternion(), d = new THREE.Vector3();
      return {
        velocity, mixer, action, get time() { return action.time; },
        update(dt) { mixer.update(dt * speed);
          if (move && !(action.paused || (!loop && action.time >= C.duration))) { const o = avatar.object; d.set(velocity[0], 0, velocity[1]).multiplyScalar(dt * speed).multiply(o.scale).applyQuaternion(o.getWorldQuaternion(q)); o.position.add(d); } },
        stop() { mixer.stopAllAction(); toRest(); avatar.follow(null); },
      };
    },
  };
}
