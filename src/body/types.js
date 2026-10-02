// Body types: plain option fragments (merge them over your options). They only use body.torso and body.thickness,
// so they don't move any joint; fine-tune from there. Write your own the same way.
export const BODY_TYPES = {
  standard: { body: { torso: { chest: 0.95, belly: 0.75, waist: 0.022, hips: 0.85 }, thickness: { upperArm: 0.85, forearm: 0.85, thigh: 0.73, calf: 0.72 } } },   // slim, a little waist: a general-purpose chibi body
  toddler: { body: { torso: { chest: 1, belly: 1, waist: 0, hips: 1 }, thickness: { upperArm: 1, forearm: 1, thigh: 1, calf: 1 } } },   // the reference sheet: round belly, no waist
  kid: { body: { torso: { chest: 1, belly: 0.85, waist: 0.01, hips: 0.95 }, thickness: { upperArm: 0.92, forearm: 0.92, thigh: 0.9, calf: 0.9 } } },
  girl: { body: { torso: { chest: 0.92, belly: 0.75, waist: 0.025, hips: 1.03 }, thickness: { upperArm: 0.85, forearm: 0.85, thigh: 0.88, calf: 0.85 } } },
  sturdy: { body: { torso: { chest: 1.3, belly: 0.9, waist: 0, hips: 0.95 }, thickness: { upperArm: 1.12, forearm: 1.12, thigh: 1.05, calf: 1.05 } } },   // broad chest (wider shoulders need joint sliders, later)
};
