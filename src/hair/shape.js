// Hair as one set shape (options.hair.shapes; 2026-10-17, Saori, fitting an anime twin tail: "ふさを集めるのだと無理だと思います　こういうの一つの
//形を作らないと"): a tail, a burst of spikes, a whole clump drawn as one outline seen from the front, given its depth from the side, and made a
// solid with rounded edges, the way an anime figure's hair is one sculpted piece. It doesn't swing (it is set, carried by the head).
//   { tie: [x, y, z] head space (where it leaves the head), outline: [[x, y], …] m from the tie (x out to her side, y up), the front view's
//     outline, any number of points, spikes and all; depth: [[y, z, half], …] m from the tie, by height (sorted any way): its middle (z, back
//     < 0) and half thickness there, between them straight; round (m, default 0.025): how wide its edges round off; mirror: also on the other
//     side; turn (degrees, default 0): the shape's plane turned about the upright line through the tie, toward the back (90: its outline
//     is what shows from the side) }
import * as THREE from "three";

// longest-edge bisection until no edge is longer than maxL (conforming: an edge is split in both triangles that share it)
function refine(P, T, maxL) {
  const key = (a, b) => a < b ? a + "_" + b : b + "_" + a, E = new Map(), len = (a, b) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]);
  const add = (t) => { const [a, b, c] = T[t]; for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = key(u, v); if (!E.has(k)) E.set(k, new Set()); E.get(k).add(t); } };
  const del = (t) => { const [a, b, c] = T[t]; for (const [u, v] of [[a, b], [b, c], [c, a]]) E.get(key(u, v))?.delete(t); };
  T.forEach((_, t) => add(t));
  for (let guard = 0; guard < 200000; guard++) {
    let best = -1, bl = maxL;
    for (let t = 0; t < T.length && best < 0; t++) { const [a, b, c] = T[t]; for (const [u, v] of [[a, b], [b, c], [c, a]]) { const l = len(u, v); if (l > bl) { best = t; break; } } }
    if (best < 0) break;
    const [a, b, c] = T[best]; let eu = a, ev = b, L = len(a, b); if (len(b, c) > L) { eu = b; ev = c; L = len(b, c); } if (len(c, a) > L) { eu = c; ev = a; }
    const m = P.length; P.push([(P[eu][0] + P[ev][0]) / 2, (P[eu][1] + P[ev][1]) / 2]);
    for (const t of [...(E.get(key(eu, ev)) ?? [])]) { del(t); let [p, q, r] = T[t]; while (!((p === eu && q === ev) || (p === ev && q === eu))) [p, q, r] = [q, r, p];
      T[t] = [p, m, r]; T.push([m, q, r]); add(t); add(T.length - 1); }
  }
  return T;
}
const lerpBy = (list, y) => { const L = [...list].sort((a, b) => a[0] - b[0]); if (y <= L[0][0]) return L[0]; if (y >= L.at(-1)[0]) return L.at(-1);
  for (let i = 1; i < L.length; i++) if (y <= L[i][0]) { const u = (y - L[i - 1][0]) / (L[i][0] - L[i - 1][0]); return L[i].map((v, k) => L[i - 1][k] + (v - L[i - 1][k]) * u); } return L.at(-1); };

/** One shape's geometry, positions in root space (toRoot: head space → root space for the tie); side: 1 or -1 (mirrored) */
export function shapeGeometry(S, { toRoot, side = 1, maxL = 0.014 }) {
  const O = S.outline ?? []; if (O.length < 3) return null;
  const P = O.map(([x, y]) => [x, y]), contour = P.map(([x, y]) => new THREE.Vector2(x, y));
  if (THREE.ShapeUtils.isClockWise(contour)) { P.reverse(); contour.reverse(); }
  const T = refine(P, THREE.ShapeUtils.triangulateShape(contour, []).map((t) => [...t]), maxL), n = O.length, R = S.round ?? 0.025;
  const D = S.depth?.length ? S.depth : [[0, 0, 0.03]], tie = toRoot(side * (S.tie?.[0] ?? 0), S.tie?.[1] ?? 1.2, S.tie?.[2] ?? 0);
  const edgeD = (x, y) => { let d = Infinity; for (let i = 0; i < n; i++) { const [ax, ay] = P[i], [bx, by] = P[(i + 1) % n], ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(x - ax - ex * t, y - ay - ey * t)); } return d; };
  const pos = [], idx = [], NV = P.length, tu = (S.turn ?? 0) * Math.PI / 180, ct = Math.cos(tu), st = Math.sin(tu);
  for (const face of [1, -1]) for (let i = 0; i < NV; i++) { const [x, y] = P[i], [, zc, h] = lerpBy(D, y), s = i < n ? 0 : Math.min(1, edgeD(x, y) / R), f = Math.sqrt(1 - (1 - s) ** 2);
    const lz = zc + face * h * f; pos.push(tie[0] + side * (x * ct + lz * st), tie[1] + y, tie[2] - x * st + lz * ct); }
  for (const [a, b, c] of T) { const fr = side > 0 ? [a, b, c] : [a, c, b]; idx.push(...fr, ...[fr[0], fr[2], fr[1]].map((v) => v + NV)); }   // front face toward +z, back face away
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// a Catmull-Rom curve through points (uniform), t 0..1 over all of them
const curveAt = (Q, t) => { const n = Q.length - 1, f = Math.min(1, Math.max(0, t)) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, g = (k) => Q[Math.min(n, Math.max(0, k))], a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2), u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map((k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * u3)); };
const listAt = (L, t) => { if (!Array.isArray(L)) return L; if (L.length === 1) return L[0]; const f = Math.min(1, Math.max(0, t)) * (L.length - 1), i = Math.min(L.length - 2, Math.floor(f)), u = f - i; return L[i] * (1 - u) + L[i + 1] * u; };
/**
 * A tube (a shape with pts; 2026-10-17, Saori, on a twin tail: "後ろから見た時のような綺麗なひとまとまり感"): a solid swept along a smooth middle
 * line (pts, head space, root to tip), its cross-section an ellipse: w its half width across (out to her side), d its half depth (front to
 * back), each a number or a list along its length (ending small: the tip comes to a soft round point). A tail is a trunk and a few tubes
 * starting inside it, each its own clump curving away to its own tip. face ([x, y, z] head space, default the front): which way its depth runs
 */
export function tubeGeometry(S, { toRoot, side = 1, rings = 48, around = 16 }) {
  const Q = (S.pts ?? []).map(([x, y, z]) => toRoot(side * x, y, z)); if (Q.length < 2) return null;
  const F0 = S.face ? (() => { const a = toRoot(0, 1.2, 0), b = toRoot(side * S.face[0], 1.2 + S.face[1], S.face[2]); return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; })() : [0, 0, 1];
  const pos = [], idx = [], C = [], nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (let r = 0; r <= rings; r++) { const t = r / rings, c = curveAt(Q, t), c2 = curveAt(Q, Math.min(1, t + 0.01)), c1 = curveAt(Q, Math.max(0, t - 0.01)), T = nrm([c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]]);
    const dot = F0[0] * T[0] + F0[1] * T[1] + F0[2] * T[2], D = nrm([F0[0] - T[0] * dot, F0[1] - T[1] * dot, F0[2] - T[2] * dot]), W = nrm(cross(T, D)), w = listAt(S.w ?? 0.03, t), d = listAt(S.d ?? 0.02, t);
    C.push(c); for (let k = 0; k < around; k++) { const a = 2 * Math.PI * k / around, cw = Math.cos(a) * w, sd = Math.sin(a) * d; pos.push(c[0] + W[0] * cw * side + D[0] * sd, c[1] + W[1] * cw * side + D[1] * sd, c[2] + W[2] * cw * side + D[2] * sd); } }
  const flip = side < 0, tri = (a, b, c) => flip ? idx.push(a, c, b) : idx.push(a, b, c);
  for (let r = 0; r < rings; r++) for (let k = 0; k < around; k++) { const a = r * around + k, b = r * around + (k + 1) % around, c = a + around, e = b + around; tri(a, c, b); tri(b, c, e); }
  const s0 = pos.length / 3; pos.push(...C[0]); const s1 = pos.length / 3; pos.push(...C[rings]);   // caps: the root (inside the trunk) and the tip
  for (let k = 0; k < around; k++) { tri(s0, k, (k + 1) % around); tri(s1, rings * around + (k + 1) % around, rings * around + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/**
 * Tubes melted into one surface (shapes with pts and blend, m; 2026-10-17, Saori, on clumps laid side by side: "くっつけかたが荒い"): each
 * tube a distance field (its middle line sampled, the nearest point's frame, the offset measured in the ellipse's half widths), joined by a
 * smooth minimum over blend, then meshed (surface nets) on h cells, so the clumps grow out of the trunk and each other with no seams.
 */
import { surfaceNets } from "../sdf/mesh.js";
import { smin } from "../sdf/prim.js";
export function blendedTubes(list, { toRoot, side = 1, h = 0.007 }) {
  const K = Math.max(...list.map((S) => S.blend ?? 0.02)), tubes = [], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  for (const S of list) { const Q = S.pts.map(([x, y, z]) => toRoot(side * x, y, z)), M = 40, F0 = [0, 0, 1], seg = [];
    for (let i = 0; i <= M; i++) { const t = i / M, c = curveAt(Q, t), c2 = curveAt(Q, Math.min(1, t + 0.01)), c1 = curveAt(Q, Math.max(0, t - 0.01)), T = nrm([c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]]);
      const dt = F0[0] * T[0] + F0[1] * T[1] + F0[2] * T[2], D = nrm([F0[0] - T[0] * dt, F0[1] - T[1] * dt, F0[2] - T[2] * dt]), W = nrm(cross(T, D)), w = Math.max(0.002, listAt(S.w ?? 0.03, t)), d = Math.max(0.002, listAt(S.d ?? 0.02, t));
      seg.push({ c, T, W, D, w, d }); const r = Math.max(w, d) + K; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k] - r); hi[k] = Math.max(hi[k], c[k] + r); } }
    const b0 = [0, 1, 2].map((k) => Math.min(...seg.map((s) => s.c[k] - Math.max(s.w, s.d))) - K), b1 = [0, 1, 2].map((k) => Math.max(...seg.map((s) => s.c[k] + Math.max(s.w, s.d))) + K);
    tubes.push({ seg, b0, b1 }); }
  const one = (tb, x, y, z) => { let best = Infinity, bs = 0.01; const S = tb.seg;
    for (let i = 0; i < S.length - 1; i++) { const A = S[i], B = S[i + 1], ex = B.c[0] - A.c[0], ey = B.c[1] - A.c[1], ez = B.c[2] - A.c[2], L2 = ex * ex + ey * ey + ez * ez || 1;
      const u = Math.max(0, Math.min(1, ((x - A.c[0]) * ex + (y - A.c[1]) * ey + (z - A.c[2]) * ez) / L2)), cx = A.c[0] + ex * u, cy = A.c[1] + ey * u, cz = A.c[2] + ez * u, rx = x - cx, ry = y - cy, rz = z - cz;
      const W = u < 0.5 ? A.W : B.W, D = u < 0.5 ? A.D : B.D, w = A.w + (B.w - A.w) * u, d = A.d + (B.d - A.d) * u, s = Math.min(w, d);
      const L = Math.sqrt(L2), q = Math.hypot((rx * ex + ry * ey + rz * ez) / L / s, (rx * W[0] + ry * W[1] + rz * W[2]) / w, (rx * D[0] + ry * D[1] + rz * D[2]) / d);   // (along the line too: past the ends, round caps)
      const dist = (q - 1) * s; if (dist < best) { best = dist; bs = s; } }
    ONE_S = bs; return best; };
  let ONE_S = 0.01;
  // the blend no wider than about twice the thinner of the two there: thin tips stay thin (a fixed blend swelled them into blunt ends)
  const sdf = (x, y, z) => { let v = 0.1, vs = 1; for (const tb of tubes) { if (x < tb.b0[0] - K || x > tb.b1[0] + K || y < tb.b0[1] - K || y > tb.b1[1] + K || z < tb.b0[2] - K || z > tb.b1[2] + K) { v = Math.min(v, 0.05); continue; } const d = one(tb, x, y, z), k = Math.max(0.002, Math.min(K, 2.2 * Math.min(vs, ONE_S))); v = smin(v, d, k); if (d < v + k) vs = Math.min(vs, ONE_S); } return v; };
  const res = surfaceNets(sdf, lo.map((v) => v - h * 2), hi.map((v) => v + h * 2), h);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(res.pos, 3)); g.setIndex(res.idx); g.computeVertexNormals();
  innerT(g, list[0], toRoot, side); return g;
}
// inner (2026-10-17, Saori: "ふさの内側（おもて面）だけ色を変える"): gradT 1 on the faces turned toward innerDir (head space; default toward the
// middle and the front), 0 elsewhere, for the shapes' own gradient colour (hair.shapeInner)
export function innerT(g, S, toRoot, side) { const n = g.attributes.normal, T = new Float32Array(n.count), D0 = S.innerDir ?? [-1, 0, 0.6], a = toRoot(0, 1.2, 0), b = toRoot(side * D0[0], 1.2 + D0[1], D0[2]), dl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1, D = [(b[0] - a[0]) / dl, (b[1] - a[1]) / dl, (b[2] - a[2]) / dl];
  for (let i = 0; i < n.count; i++) T[i] = n.getX(i) * D[0] + n.getY(i) * D[1] + n.getZ(i) * D[2]; g.setAttribute("gradT", new THREE.BufferAttribute(T, 1)); }
