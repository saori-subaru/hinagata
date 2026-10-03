// Weapons (outfit.weapon): something in each hand — right: sword / axe / spear / staff, left: shield / round (a buckler).
// Hard shapes made in the hand's own frame (the same D / N / S as the hand in body/index.js), each bound to one bone, so they
// move exactly with the hand (or, for a shield, the forearm). A hand that holds something closes into a fist (body/index.js).
//   Two meshes per hand: metal (blade, guard, axe head, spear head, rim, boss) and the rest (grip, shaft, the shield's face) in its own color.
import { smin } from "../sdf/prim.js";
import { sub, dot, norm, cross, smax } from "./armor.js";

const add = (a, ...t) => a.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0));
const capsule = (p, a, b, r) => { const ab = sub(b, a), ap = sub(p, a), h = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab))); return Math.hypot(ap[0] - ab[0] * h, ap[1] - ab[1] * h, ap[2] - ab[2] * h) - r; };

/** The hand's frame (A-pose): D = toward the fingers, N = the palm's side, S = the thumb's side (forward); G = where a fist holds a grip. */
export function handFrame(J, s) {
  const m = s === "L" ? 1 : -1, w = J[`hand.${s}`], D = [m * 0.876, -0.483, 0], N = [-0.483 * m, -0.876, 0], S = [0, 0, 1];
  const palm = add(w, [D, 0.03], [N, 0.002]);
  return { m, w, D, N, S, palm, G: add(palm, [N, 0.03], [D, 0.004]) };
}

export function buildWeapons(OPT, { J }) {
  const WO = OPT.outfit.weapon ?? {}, R = WO.right ?? "none", L = WO.left ?? "none";
  const none = null;
  // ── right hand: the item's axis A comes out of the fist forward, tipped up toward straight up by theta (a staff or spear stands nearly upright);
  //    W across it (its blade's width), T its thickness ──
  const H = handFrame(J, "R"), tilt = { sword: 0.6, axe: 0.8, spear: 1.25, staff: 1.35 }[R] ?? 0;
  const A = norm(add([0, 0, 0], [H.S, Math.cos(tilt)], [[0, 1, 0], Math.sin(tilt)])), W = norm(add(H.D, [A, -dot(H.D, A)])), T = cross(A, W);
  const loc = (x, y, z) => { const q = [x - H.G[0], y - H.G[1], z - H.G[2]]; return [dot(q, A), dot(q, W), dot(q, T)]; };   // (along, across, thickness)
  const at = (a, w = 0) => add(H.G, [A, a], [W, w]);
  let rMetal = none, rOther = none;
  if (R === "sword") {
    rOther = (x, y, z) => capsule([x, y, z], at(-0.038), at(0.042), 0.0125);   // the grip
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), hw = 0.025 * Math.min(1, Math.max(0, (0.4 - a) / 0.075)) + 0.0008;
      const blade = Math.max(Math.abs(w) - hw, Math.abs(t) - 0.0062 * (1 - 0.35 * Math.min(1, Math.abs(w) / hw)), 0.05 - a, a - 0.4);   // flat, thicker along the middle, to a point
      const guard = capsule([x, y, z], at(0.047, -0.058), at(0.047, 0.058), 0.012), pommel = Math.hypot(a + 0.052, w, t) - 0.018;
      return Math.min(blade, guard, pommel); };
  }
  if (R === "axe") {
    rOther = (x, y, z) => capsule([x, y, z], at(-0.07), at(0.27), 0.011);   // the haft
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), k = Math.min(1, Math.max(0, (w - 0.012) / 0.08));
      const head = Math.max(Math.abs(a - 0.215) - (0.026 + 0.055 * k * k), w - 0.095 + 2.6 * (a - 0.215) ** 2, 0.008 - w, Math.abs(t) - 0.014 * (1 - 0.7 * k));   // a fan out to a curved edge
      const socket = Math.max(Math.abs(a - 0.215) - 0.026, Math.abs(w) - 0.018, Math.abs(t) - 0.015), spike = Math.max(Math.abs(a - 0.215) - 0.012 * (1 + (w + 0.018) / 0.03), -w - 0.05, w + 0.012, Math.abs(t) - 0.008);
      return Math.min(head, socket, spike); };
  }
  if (R === "spear") {
    rOther = (x, y, z) => capsule([x, y, z], at(-0.3), at(0.33), 0.009);
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), u = Math.min(1, Math.max(0, (a - 0.335) / 0.11)), hw = 0.019 * Math.sin(Math.PI * Math.min(1, u * 1.25 + 0.05)) ** 0.7 + 0.0005;
      const head = Math.max(Math.abs(w) - hw, Math.abs(t) - 0.0045 * (1 - 0.5 * Math.min(1, Math.abs(w) / hw)), 0.335 - a, a - 0.445);   // a leaf-shaped head
      return Math.min(head, capsule([x, y, z], at(0.31), at(0.345), 0.012), capsule([x, y, z], at(-0.31), at(-0.29), 0.011)); };   // its socket, and a cap on the butt
  }
  if (R === "staff") {
    rOther = (x, y, z) => { const p = [x, y, z], [a] = loc(x, y, z); return capsule(p, at(-0.3), at(0.3), 0.011 + 0.003 * Math.max(0, (a - 0.2) / 0.1)); };   // a shaft, thicker toward the top
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), orb = Math.hypot(a - 0.355, w, t) - 0.032, ring = Math.max(Math.abs(Math.hypot(w, t) - 0.03) - 0.006, Math.abs(a - 0.33) - 0.012);
      return Math.min(orb, smin(ring, capsule([x, y, z], at(0.29), at(0.31), 0.016), 0.01)); };   // an orb in a ring of metal
  }

  // ── left hand: a shield on the outside of the forearm (bound to the forearm), its face toward the back of the hand ──
  const HL = handFrame(J, "L"), e = J["lowerArm.L"], h = J["hand.L"], V = norm(sub(e, h)), O0 = norm(add([0, 0, 0], [HL.N, -0.5], [HL.S, 0.87])), O = norm(add(O0, [V, -dot(O0, V)])), Hz = cross(V, O).map((v) => -v);   // V up the arm (the shield's top), O its face: turned mostly forward (and a little out), Hz across it
  const SC = add(e.map((v, i) => (v + h[i]) / 2), [HL.N, -0.035], [HL.S, 0.055]);   // in front of the forearm, a little to the outside
  const sl = (x, y, z) => { const q = [x - SC[0], y - SC[1], z - SC[2]]; return [dot(q, Hz), dot(q, V), dot(q, O)]; };   // (across, up, out)
  let lFace = none, lMetal = none;
  if (L === "shield" || L === "round") {
    const outline = L === "shield"
      ? (u, v) => { const hw = v > 0 ? 0.105 : 0.105 * Math.max(0, 1 - (-v / 0.15) ** 1.7) ** 0.55; return Math.max(Math.abs(u) - hw, v - 0.12, -v - 0.15); }   // a heater: square top, pointed bottom
      : (u, v) => Math.hypot(u, v) - 0.115;
    const bow = L === "shield" ? 1.6 : 1.2, surf = (u, v) => -bow * (u * u + (L === "round" ? v * v : 0));   // curved back toward the arm at the edges
    lFace = (x, y, z) => { const [u, v, o] = sl(x, y, z); return Math.max(outline(u, v), Math.abs(o - surf(u, v)) - 0.008); };
    lMetal = (x, y, z) => { const [u, v, o] = sl(x, y, z), d2 = outline(u, v), off = o - surf(u, v);
      const rim = Math.max(d2, -d2 - 0.013, Math.abs(off) - 0.011), boss = Math.max(Math.hypot(u, v - (L === "shield" ? 0.01 : 0), off) - 0.034, -off);
      return Math.min(rim, boss); };
  }
  // the box around each: the corners of a slab around the item, padded
  const box = (c, axes) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const s0 of [-1, 1]) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) { const p = add(c, [axes[0][0], s0 > 0 ? axes[0][2] : axes[0][1]], [axes[1][0], s1 * axes[1][1]], [axes[2][0], s2 * axes[2][1]]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
    return { lo: lo.map((v) => v - 0.02), hi: hi.map((v) => v + 0.02) }; };
  const boxR = R === "none" ? null : box(H.G, [[A, -0.33, 0.46], [W, 0.09], [T, 0.035]]), boxL = L === "none" ? null : box(SC, [[Hz, -0.13, 0.13], [V, 0.17], [O, 0.07]]);
  return { right: R, left: L, rMetal, rOther, lFace, lMetal, boxR, boxL };
}
