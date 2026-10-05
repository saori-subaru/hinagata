// Running (2026-10-03, from the forest game): the "run" pose and a stride measure that works for any gait.
// The run: a forward lean, thighs swinging wide, the knee folding hard while the leg swings forward (the heel comes up under the
// bottom) and nearly straight at the strike, elbows bent about 90° and pumping against the legs, fists loose, hips and shoulders
// counter-turning. The body is lowest in the middle of each stance and rises between them.
// measureGait(avatar, pose, period): how fast the body must move at playback speed 1 so the planted foot doesn't slide — measured on
// whichever foot is on the ground (within 1.2 cm of the lowest a foot gets); in flight, neither counts. Works for a run, whose stance
// is short, where measureStride's half-cycle rule doesn't.
import * as THREE from "three";
import { POSES } from "./index.js";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
export const RUN_W = 9;   // rad/s at playback speed 1: one cycle (two steps) in 0.70 s

Object.assign(POSES, {
  run: (t) => {
    const ph = t * RUN_W, s = sin(ph), c = cos(ph);
    const kL = 0.35 + 1.25 * mx(0, c), kR = 0.35 + 1.25 * mx(0, -c);   // the knee folds while its thigh swings forward
    return { b: {
      hips: [0, s * 0.15, 0], spine: [0.3, -s * 0.12, 0], head: [-0.25, -s * 0.05, 0],   // lean in, shoulders against the hips, eyes ahead
      "upperLeg.L": [-0.8 * s - 0.1, 0, 0.03], "upperLeg.R": [0.8 * s - 0.1, 0, -0.03],
      "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0],
      "foot.L": [0.15 - 0.2 * s - kL * 0.35, 0, 0], "foot.R": [0.15 + 0.2 * s - kR * 0.35, 0, 0],
      "upperArm.L": [0.75 * s, 0, -0.3], "upperArm.R": [-0.75 * s, 0, 0.3],   // arms against the legs
      "lowerArm.L": [-1.3 + 0.25 * s, 0, -0.05], "lowerArm.R": [-1.3 - 0.25 * s, 0, 0.05],   // elbows bent ~90°, opening a little on the back swing
    }, y: 0.01 - 0.02 * Math.abs(c), grip: { L: 0.6, R: 0.6 }, sharp: true, air: 2.6 };   // air: the wind it runs into (m/s; the hair streams back, see index.js)   // sharp: once blended in, followed exactly (eased, the fast swing came out smaller and the feet slid)
  },
});

/** The body speed (avatar units / s) at playback speed 1 that keeps the planted foot still: over one cycle (period s), the foot that is
 *  on the ground (near the lowest a foot gets), its front-to-back speed, averaged. Play the pose at speed / this and the feet don't slide. */
export function measureGait(avatar, pose = "run", period = 2 * Math.PI / RUN_W) {
  const root = avatar.object, F = [avatar.bones["foot.L"], avatar.bones["foot.R"]], N = 96, dt = period / N, v = new THREE.Vector3();
  const at = (i) => { avatar.update(0, { t: i * dt, pose, instant: true }); root.updateMatrixWorld(true); return F.map((f) => root.worldToLocal(f.getWorldPosition(v)).clone()); };
  const P = []; for (let i = 0; i <= N; i++) P.push(at(i));
  const floor = Math.min(...P.map((f) => Math.min(f[0].y, f[1].y))), tol = 0.012;   // a foot counts as planted within 1.2 cm of the lowest it gets (in flight, both are up)
  let sum = 0, n = 0;
  for (let i = 1; i <= N; i++) for (let k = 0; k < 2; k++) {
    if (P[i - 1][k].y > floor + tol || P[i][k].y > floor + tol) continue;
    sum += (P[i - 1][k].z - P[i][k].z) / dt; n++;   // backward is -z (the body faces +z)
  }
  avatar.update(0, { t: 0, pose: "idle", instant: true });
  return n ? sum / n : 0;
}
