// Jumping and landing, apart from the banzai (2026-10-03, Saori: 「バンザイとジャンプを分離したら？」). The forest had borrowed frames
// of the cheer jump, so every jump threw both arms up and a hard landing crouched with fists at the chin. Here the jump has its own body:
//   jumpCrouch the wind-up: a quick dip, arms pulled back
//   jumpRise   taking off and rising: legs straight, toes pointed down, arms swung forward and up (they carry the jump)
//   jumpLeap   a running jump: legs split front and back, arms opposite
//   jumpAir    the top and a short fall: knees tucked a little, arms out to the sides for balance
//   jumpLand   just landed: the knees take it (soles flat, hips lowered by the legs' geometry), leaning in, arms forward
//   hardLand   landed from high up: deep in the knees, leaning far in, arms reaching down in front
//   fall       a long fall: arms up and out, flapping; legs kicking in turn
//   crouch     squatting on the spot (getting over an edge, ducking)
//   banzai     both arms up and down, standing (the cheer jump's arms without the jump)
// The game's physics makes the height: these poses lift nothing (y only lowers the hips in a crouch so the soles stay on the ground).
import { POSES } from "./index.js";

const cos = Math.cos, sin = Math.sin;
const LT = 0.19, LS = 0.165, TH = 0.75, KN = 1.3;   // thigh / shin length, and thigh / knee angle in a full crouch (as the cheer jump)
// legs bent by q (0 = straight, 1 = a full crouch), soles flat; point: toes down extra (rad)
const legs = (q, point = 0, spread = 0.06) => ({ "upperLeg.L": [-TH * q, 0, spread], "upperLeg.R": [-TH * q, 0, -spread], "lowerLeg.L": [KN * q, 0, 0], "lowerLeg.R": [KN * q, 0, 0],
  "foot.L": [-(KN - TH) * q + point, 0, 0], "foot.R": [-(KN - TH) * q + point, 0, 0] });
const drop = (q) => LT * (1 - cos(TH * q)) + LS * (1 - cos((KN - TH) * q));   // how far the hips come down when the legs bend by q
// both arms: L given, R mirrored (x the same, y and z flipped)
const arms = (ua, la = [0, 0, 0], hand = null) => { const m = (v) => [v[0], -v[1], -v[2]], o = { "upperArm.L": ua, "upperArm.R": m(ua), "lowerArm.L": la, "lowerArm.R": m(la) };
  if (hand) { o["hand.L"] = hand; o["hand.R"] = m(hand); } return o; };
// arm turns: z first (from the A-pose's 46° out: negative brings the arm down to the side), then x (negative swings it forward). So an arm
// forward is [-x, 0, -0.75]: down to the side, then forward
const crouch = (q, extra = {}) => ({ b: { ...legs(q), spine: [0.25 + 0.25 * q, 0, 0], head: [-0.1, 0, 0], ...arms([-0.7 - 0.5 * q, 0, -0.7], [-0.35, 0, 0]), ...extra }, y: -drop(q) });

Object.assign(POSES, {
  jumpRise: () => ({ b: { ...legs(0, 0.45, 0.04), spine: [-0.08, 0, 0], head: [-0.15, 0, 0], ...arms([-2.1, 0, -0.75], [-0.3, 0, 0]) }, y: 0 }),
  jumpAir: () => ({ b: { ...legs(0, 0.2, 0.08), "upperLeg.L": [-0.6, 0, 0.08], "upperLeg.R": [-0.6, 0, -0.08], "lowerLeg.L": [0.9, 0, 0], "lowerLeg.R": [0.9, 0, 0],
    spine: [0.05, 0, 0], head: [-0.05, 0, 0], ...arms([-0.45, 0, 0.6], [-0.35, 0, 0]) }, y: 0 }),
  // the wind-up before taking off: a quick dip, arms pulled back (they swing forward and up into jumpRise)
  jumpCrouch: () => crouch(0.35, { spine: [0.3, 0, 0], ...arms([0.6, 0, -0.75], [-0.2, 0, 0]) }),
  // a running jump (a leap): legs split front and back, the arm opposite the front leg reaching forward, the other back
  jumpLeap: () => ({ b: { "upperLeg.L": [-1.0, 0, 0.05], "lowerLeg.L": [0.5, 0, 0], "foot.L": [0.2, 0, 0], "upperLeg.R": [0.55, 0, -0.05], "lowerLeg.R": [1.0, 0, 0], "foot.R": [0.45, 0, 0],
    "upperArm.R": [-1.7, 0, 0.75], "lowerArm.R": [-0.3, 0, 0], "upperArm.L": [0.7, 0, -0.6], "lowerArm.L": [-0.3, 0, 0], spine: [0.15, 0, 0], head: [-0.15, 0, 0] }, y: 0 }),
  jumpLand: () => crouch(0.45),
  hardLand: () => crouch(0.95, { head: [0.1, 0, 0], ...arms([-1.1, 0, -0.6], [-0.15, 0, 0]) }),
  crouch: () => crouch(0.8),
  fall: (t) => { const w = sin(t * 11);
    return { b: { ...arms([-0.3 + 0.25 * w, 0, 1.1], [-0.5 + 0.3 * w, 0, 0]), "upperArm.R": [-0.3 - 0.25 * w, 0, -1.1], "lowerArm.R": [-0.5 - 0.3 * w, 0, 0],
      "upperLeg.L": [-0.35 - 0.3 * w, 0, 0.06], "upperLeg.R": [-0.35 + 0.3 * w, 0, -0.06], "lowerLeg.L": [0.6 + 0.2 * w, 0, 0], "lowerLeg.R": [0.6 - 0.2 * w, 0, 0], head: [-0.15, 0, 0] }, y: 0 }; },
  // banzai: the cheer jump's arms (raised, palms forward ↔ lowered, fists by the chin), up and down about once a second, standing
  banzai: (t) => {
    const a = 0.5 - 0.5 * cos(t * 6.0), C = POSES.cheer((0.29 + 0.11 * a) * 1.4), out = {};   // cheer's arms rise over u 0.29-0.40
    for (const k of ["shoulder.L", "shoulder.R", "upperArm.L", "upperArm.R", "lowerArm.L", "lowerArm.R", "hand.L", "hand.R"]) if (C.b[k]) out[k] = C.b[k];
    return { b: { ...out, head: [-0.1, 0, 0] }, y: 0, grip: C.grip };
  },
});
