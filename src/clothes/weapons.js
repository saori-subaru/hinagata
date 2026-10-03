// Weapons (outfit.weapon): something in each hand — right: sword / axe / spear / staff, left: shield / round (a buckler).
// Hard shapes made in the hand's own frame (the same D / N / S as the hand in body/index.js), each bound to one bone, so they
// move exactly with the hand (or, for a shield, the forearm). A hand that holds something closes into a fist (body/index.js).
//   Per hand: metal (blade, guard, axe head, spear head, rim, boss), the grip / shaft / the shield's straps (leather or wood), and the shield's face.
import { smin } from "../sdf/prim.js";
import { sub, dot, norm, cross, slice, sell } from "./armor.js";

const add = (a, ...t) => a.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0));
const capsule = (p, a, b, r) => { const ab = sub(b, a), ap = sub(p, a), h = Math.max(0, Math.min(1, dot(ap, ab) / dot(ab, ab))); return Math.hypot(ap[0] - ab[0] * h, ap[1] - ab[1] * h, ap[2] - ab[2] * h) - r; };

/** The hand's frame (A-pose): D = toward the fingers, N = the palm's side, S = the thumb's side (forward); G = where a fist holds a grip. */
export function handFrame(J, s) {
  const m = s === "L" ? 1 : -1, w = J[`hand.${s}`], D = [m * 0.876, -0.483, 0], N = [-0.483 * m, -0.876, 0], S = [0, 0, 1];
  const palm = add(w, [D, 0.03], [N, 0.002]);
  return { m, w, D, N, S, palm, G: add(palm, [N, 0.03], [D, 0.004]) };
}

export function buildWeapons(OPT, { J, bodySdf }) {
  const WO = OPT.outfit.weapon ?? {}, R = WO.right ?? "none", L = WO.left ?? "none";
  const none = null;
  // ── right hand: the item's axis A comes out of the fist forward, tipped up toward straight up by theta (a staff or spear stands nearly upright);
  //    W across it (its blade's width), T its thickness ──
  const H = handFrame(J, "R"), tilt = { sword: 0.6, axe: 0.8, spear: 1.25, staff: 1.35 }[R] ?? 0;
  const A = norm(add([0, 0, 0], [H.S, Math.cos(tilt)], [[0, 1, 0], Math.sin(tilt)])), W = norm(add(H.D, [A, -dot(H.D, A)])), T = cross(A, W);
  const loc = (x, y, z) => { const q = [x - H.G[0], y - H.G[1], z - H.G[2]]; return [dot(q, A), dot(q, W), dot(q, T)]; };   // (along, across, thickness)
  const at = (a, w = 0) => add(H.G, [A, a], [W, w]);
  let rMetal = none, rOther = none;
  // sizes: chibi weapons are big for the body (a spear about as tall as the character), or they read as toys
  if (R === "sword") {
    rOther = (x, y, z) => capsule([x, y, z], at(-0.05), at(0.052), 0.014);   // the grip
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), hw = 0.034 * Math.min(1, Math.max(0, (0.52 - a) / 0.1)) + 0.001;
      const blade = Math.max(Math.abs(w) - hw, Math.abs(t) - 0.0075 * (1 - 0.35 * Math.min(1, Math.abs(w) / hw)), 0.06 - a, a - 0.52);   // flat, thicker along the middle, to a point
      const fuller = Math.abs(w) < 0.006 && a > 0.08 && a < 0.4 ? 0.002 : 0;   // a groove down the blade
      const guard = capsule([x, y, z], at(0.058, -0.078), at(0.058, 0.078), 0.014), pommel = Math.hypot(a + 0.068, w, t) - 0.023;
      return Math.min(blade + fuller, guard, pommel); };
  }
  if (R === "axe") {
    const c = 0.37;   // where the head sits along the haft
    rOther = (x, y, z) => capsule([x, y, z], at(-0.09), at(0.44), 0.014);   // the haft
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), k = Math.min(1, Math.max(0, (w - 0.016) / 0.11));
      const head = Math.max(Math.abs(a - c) - (0.034 + 0.075 * k * k), w - 0.135 + 1.8 * (a - c) ** 2, 0.01 - w, Math.abs(t) - 0.018 * (1 - 0.7 * k));   // a fan out to a curved edge
      const socket = Math.max(Math.abs(a - c) - 0.036, Math.abs(w) - 0.024, Math.abs(t) - 0.02), spike = Math.max(Math.abs(a - c) - 0.016 * (1 + (w + 0.024) / 0.04), -w - 0.07, w + 0.016, Math.abs(t) - 0.011);
      return Math.min(head, socket, spike); };
  }
  if (R === "spear") {
    const top = 0.78;   // the shaft runs from under the hand up to here; the head above it
    rOther = (x, y, z) => capsule([x, y, z], at(-0.42), at(top), 0.013);
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), u = Math.min(1, Math.max(0, (a - top - 0.01) / 0.19)), hw = 0.042 * Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.06)) ** 0.75 + 0.001;
      const head = Math.max(Math.abs(w) - hw, Math.abs(t) - 0.009 * (1 - 0.6 * Math.min(1, Math.abs(w) / hw)), top + 0.01 - a, a - top - 0.2);   // a big leaf-shaped head with a ridge
      return Math.min(head, capsule([x, y, z], at(top - 0.035), at(top + 0.02), 0.018), capsule([x, y, z], at(top - 0.06), at(top - 0.05), 0.016), capsule([x, y, z], at(-0.44), at(-0.41), 0.016)); };   // socket and a collar, and a cap on the butt
  }
  if (R === "staff") {
    const top = 0.6;
    rOther = (x, y, z) => { const p = [x, y, z], [a] = loc(x, y, z); return capsule(p, at(-0.42), at(top), 0.014 + 0.005 * Math.max(0, (a - top + 0.15) / 0.15)); };   // a shaft, thicker toward the top
    rMetal = (x, y, z) => { const [a, w, t] = loc(x, y, z), r = Math.hypot(w, t), orb = Math.hypot(a - top - 0.085, w, t) - 0.046;
      const cup = Math.max(r - (0.02 + 0.45 * Math.max(0, a - top + 0.02)), a - top - 0.07, top - 0.03 - a);   // a flaring cup holding the orb
      return Math.min(orb, smin(cup, capsule([x, y, z], at(top - 0.05), at(top - 0.035), 0.022), 0.008)); };
  }

  // ── left hand: a shield strapped to the outside of the forearm (bound to the forearm) by two leather bands ──
  const HL = handFrame(J, "L"), e = J["lowerArm.L"], h = J["hand.L"], V = norm(sub(e, h)), O0 = norm(add([0, 0, 0], [HL.N, -0.95], [HL.S, 0.3])), O = norm(add(O0, [V, -dot(O0, V)])), Hz = cross(V, O).map((v) => -v);   // V up the arm (the shield's top), O its face: out of the back of the forearm (a little forward). Strapped to the arm, it faces out while the arm hangs and forward only when the arm comes up (guarding)
  const SC = add(e.map((v, i) => (v + h[i]) / 2), [O, 0.07]);   // on the outside of the forearm
  const sl = (x, y, z) => { const q = [x - SC[0], y - SC[1], z - SC[2]]; return [dot(q, Hz), dot(q, V), dot(q, O)]; };   // (across, up, out)
  let lFace = none, lMetal = none, lOther = none;
  if (L === "shield" || L === "round") {
    const outline = L === "shield"
      ? (u, v) => { const hw = v > 0 ? 0.122 : 0.122 * Math.max(0, 1 - (-v / 0.175) ** 1.7) ** 0.55; return Math.max(Math.abs(u) - hw, v - 0.14, -v - 0.175); }   // a heater: square top, pointed bottom
      : (u, v) => Math.hypot(u, v) - 0.135;
    const bow = L === "shield" ? 1.4 : 1.1, surf = (u, v) => -bow * (u * u + (L === "round" ? v * v : 0));   // curved back toward the arm at the edges
    lFace = (x, y, z) => { const [u, v, o] = sl(x, y, z); return Math.max(outline(u, v) + 0.008, Math.abs(o - surf(u, v)) - 0.009); };   // stops under the rim (they don't share an edge)
    lMetal = (x, y, z) => { const [u, v, o] = sl(x, y, z), d2 = outline(u, v), off = o - surf(u, v);
      const rim = Math.max(d2, -d2 - 0.016, Math.abs(off) - 0.013), boss = Math.max(Math.hypot(u, v - (L === "shield" ? 0.012 : 0), off) - 0.04, -off);
      return Math.min(rim, boss); };
    // the bands: two leather loops around the forearm (fitted to it), each joined to the back of the shield by a pad
    const BANDS = [0.3, 0.7].map((t) => { const c = add(e, [sub(h, e), t]), S0 = slice(bodySdf, c, Hz, O, 16); return { c, t, ...S0, v: dot(sub(c, SC), V) }; });
    lOther = (x, y, z) => { let d = 1e9; const p = [x, y, z];
      for (const B of BANDS) { const q = sub(p, B.c), along = dot(q, V), u = dot(q, Hz) - B.cu, o = dot(q, O) - B.cv;
        const ring = Math.max(Math.abs(sell(u, o, B.a + 0.006, B.b + 0.006, 2)) - 0.0045, Math.abs(along) - 0.011);
        const [su, , so] = sl(x, y, z), pad = Math.max(Math.abs(su) - 0.016, Math.abs(dot(sub(p, SC), V) - B.v) - 0.011, so + 0.004, -(so - (B.cv + B.b - dot(sub(SC, B.c), O))) - 0.004);
        d = Math.min(d, ring, pad); }
      return d; };
  }
  // the box around each: the corners of a slab around the item, padded
  const box = (c, axes) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];   // axes: [vector, from, to] ×3
    for (const s0 of [1, 2]) for (const s1 of [1, 2]) for (const s2 of [1, 2]) { const p = add(c, [axes[0][0], axes[0][s0]], [axes[1][0], axes[1][s1]], [axes[2][0], axes[2][s2]]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
    return { lo: lo.map((v) => v - 0.02), hi: hi.map((v) => v + 0.02) }; };
  const reach = { sword: [-0.1, 0.53], axe: [-0.1, 0.46], spear: [-0.45, 1.0], staff: [-0.45, 0.73] }[R] ?? [-0.1, 0.1];
  const boxR = R === "none" ? null : box(H.G, [[A, ...reach], [W, -0.1, 0.16], [T, -0.05, 0.05]]), boxL = L === "none" ? null : box(SC, [[Hz, -0.16, 0.16], [V, -0.2, 0.17], [O, -0.15, 0.05]]);
  return { right: R, left: L, rMetal, rOther, lFace, lMetal, lOther, boxR, boxL };
}
