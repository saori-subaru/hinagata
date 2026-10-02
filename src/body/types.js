// Body types: plain option fragments (merge them over your options). They only use body.torso (bust: a girl's chest, separate from chest = the chest board; butt: how far the bottom sticks out; back: back thickness) and body.thickness (thighTop: the thigh at the hip joint) and body.thickness,
// so they don't move any joint; fine-tune from there. Write your own the same way.
export const BODY_TYPES = {
  standard: { body: { torso: { chest: 0.95, belly: 0.75, waist: 0.022, hips: 0.85, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 0.85, forearm: 0.85, thigh: 0.73, thighTop: 0.73, calf: 0.72 } } },   // slim, a little waist: a general-purpose chibi body
  toddler: { body: { torso: { chest: 1, belly: 1, waist: 0, hips: 1, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 1, forearm: 1, thigh: 1, thighTop: 1, calf: 1 } } },   // the reference sheet: round belly, no waist
  kid: { body: { torso: { chest: 1, belly: 0.85, waist: 0.01, hips: 0.95, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 0.92, forearm: 0.92, thigh: 0.9, thighTop: 0.9, calf: 0.9 } } },
  girl: { body: { torso: { chest: 0.92, belly: 0.62, waist: 0.02, hips: 0.92, bust: 0.77, butt: 0.96, back: 0.56 }, thickness: { upperArm: 0.92, forearm: 0.88, thigh: 0.95, thighTop: 0.73, calf: 0.72 } } },
  sturdy: { body: { torso: { chest: 1.3, belly: 0.9, waist: 0, hips: 0.95, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 1.12, forearm: 1.12, thigh: 1.05, thighTop: 1.05, calf: 1.05 } } },   // broad chest (wider shoulders need joint sliders, later)
};
