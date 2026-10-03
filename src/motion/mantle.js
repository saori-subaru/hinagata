// Getting over things with weight (2026-10-03, Saori: 「もう少し重力を感じる動きがいいな！よっこいしょとよじ登るみたいな。記号的な動きだと没入できない」).
// The forest's first pull-up slid the body up and over in one smooth move. Now it goes in steps, each its own pose (the game times them
// and puts the hands on the edge with IK, motion/ik.js):
//   mantleReach  hands up to the edge, knees giving a little (about to pull)
//   mantlePull   hanging off the hands and hauling: leaning in, one knee driven up high, the other leg hanging
//   mantleKnee   one knee up on the edge, chest over it, the other leg still pushing from below
//   (then the crouch, motion/jump.js, and standing up)
//   vault        over something low: weight on the hands, both legs tucked and swung to one side, hips turned
import { POSES } from "./index.js";

const m = (v) => [v[0], -v[1], -v[2]];   // L → R (mirror)
const ARMS_UP = { "shoulder.L": [0, 0, 0.28], "upperArm.L": [-0.64, -0.38, 1.35], "lowerArm.L": [0, -0.04, 0.15] };   // (the IK sets the arms; this is where they start)
const both = (o) => { const r = { ...o }; for (const [k, v] of Object.entries(o)) if (k.endsWith(".L")) r[k.slice(0, -2) + ".R"] = m(v); return r; };

Object.assign(POSES, {
  mantleReach: () => ({ b: { ...both(ARMS_UP), "upperLeg.L": [-0.25, 0, 0.05], "upperLeg.R": [-0.25, 0, -0.05], "lowerLeg.L": [0.45, 0, 0], "lowerLeg.R": [0.45, 0, 0],
    "foot.L": [-0.2, 0, 0], "foot.R": [-0.2, 0, 0], spine: [0.1, 0, 0], head: [-0.35, 0, 0] }, y: -0.02, grip: { L: 0.8, R: 0.8 } }),
  mantlePull: () => ({ b: { ...both(ARMS_UP), spine: [0.5, 0, 0], head: [-0.3, 0, 0],
    "upperLeg.R": [-1.6, 0, -0.1], "lowerLeg.R": [1.9, 0, 0], "foot.R": [-0.3, 0, 0],   // the right knee driven up toward the edge
    "upperLeg.L": [0.15, 0, 0.05], "lowerLeg.L": [0.5, 0, 0], "foot.L": [0.3, 0, 0] }, y: 0, grip: { L: 1, R: 1 } }),   // the left leg hanging, toes down
  mantleKnee: () => ({ b: { ...both(ARMS_UP), spine: [0.8, 0, 0], head: [-0.45, 0, 0],
    "upperLeg.R": [-1.3, 0, -0.1], "lowerLeg.R": [2.1, 0, 0], "foot.R": [0.4, 0, 0],    // kneeling on the edge
    "upperLeg.L": [-0.4, 0, 0.08], "lowerLeg.L": [1.0, 0, 0], "foot.L": [0.1, 0, 0] }, y: -0.1, grip: { L: 1, R: 1 } }),   // the left leg pushing up from below
  vault: () => ({ b: { hips: [0, 0.7, 0], spine: [0.45, -0.3, 0], head: [-0.2, -0.4, 0],
    "upperLeg.L": [-1.4, 0, 0.35], "upperLeg.R": [-1.4, 0, -0.1], "lowerLeg.L": [1.9, 0, 0], "lowerLeg.R": [1.9, 0, 0], "foot.L": [0.2, 0, 0], "foot.R": [0.2, 0, 0],
    "upperArm.L": [-1.0, 0, -0.6], "upperArm.R": [-1.0, 0, 0.6], "lowerArm.L": [-0.1, 0, 0], "lowerArm.R": [-0.1, 0, 0] }, y: 0, grip: { L: 0.7, R: 0.7 } }),
});
