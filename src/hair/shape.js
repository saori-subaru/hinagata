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
