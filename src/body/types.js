// Body types: plain option fragments (merge them over your options). Each type comes as a chibi (the base proportions, about 3 heads tall)
// and a tall one (2026-10-05, Saori: "今のやつを(ちび)にして、高い頭身のもそれぞれ作るといい"): the same type with longer legs and torso
// (body.proportion), a smaller head and slimmer limbs and belly (a chibi's thickness on a tall body looked chunky). They set body.torso
// (bust: a girl's chest, separate from chest = the chest board; butt: how far the bottom sticks out; back: back thickness), body.thickness
// (thighTop: the thigh at the hip joint), body.proportion and body.head.scale; no joint moves. Fine-tune from there; write your own the same way.
// ("kid" is gone: it looked like the toddler.)
// The default body (DEFAULTS) is standardTall's since 2026-10-06 (before, it was the chibi with the toddler's values). Every fragment sets all
// of torso, thickness, proportion and head.scale, so merging one gives the same body whatever the defaults are: BODY_TYPES.standard is the
// chibi standard on the tall default too. Keep it so when adding a type or a value.
const CHIBI = { torso: {}, thickness: {}, proportion: { legs: 1, torso: 1 }, head: { scale: 0.9 } };
const base = {
  standard: { torso: { chest: 0.95, belly: 0.75, waist: 0.022, hips: 0.85, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 0.85, forearm: 0.85, thigh: 0.73, thighTop: 0.73, calf: 0.72 } },   // slim, a little waist: a general-purpose body
  toddler: { torso: { chest: 1, belly: 1, waist: 0, hips: 1, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 1, forearm: 1, thigh: 1, thighTop: 0.9, calf: 1 } },   // the reference sheet: round belly, no waist
  girl: { torso: { chest: 0.92, belly: 0.62, waist: 0.02, hips: 0.92, bust: 0.77, butt: 0.96, back: 0.56 }, thickness: { upperArm: 0.92, forearm: 0.88, thigh: 0.95, thighTop: 0.73, calf: 0.72 } },
  sturdy: { torso: { chest: 1.3, belly: 0.9, waist: 0, hips: 0.95, bust: 0, butt: 1, back: 1 }, thickness: { upperArm: 1.12, forearm: 1.12, thigh: 1.05, thighTop: 1.05, calf: 1.05 } },   // broad chest (wider shoulders need joint sliders, later)
};
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
// tall: about 4.5 heads (legs 1.65, torso 1.3, head 0.82); limbs 0.84×, belly 0.82× (not under 0.6, its slider's least), a little more waist
const tall = (b) => ({ torso: { ...b.torso, belly: r2(Math.max(0.6, b.torso.belly * 0.82)), waist: r3(b.torso.waist + 0.006) }, thickness: Object.fromEntries(Object.entries(b.thickness).map(([k, v]) => [k, r2(v * 0.84)])),
  proportion: { legs: 1.65, torso: 1.3 }, head: { scale: 0.82 } });
const NO_TALL = new Set(["toddler"]);   // a tall toddler is a contradiction (2026-10-05, Saori)
export const BODY_TYPES = Object.fromEntries(Object.entries(base).flatMap(([k, b]) => [[k, { body: { ...CHIBI, ...b } }], ...(NO_TALL.has(k) ? [] : [[`${k}Tall`, { body: tall(b) }]])]));
