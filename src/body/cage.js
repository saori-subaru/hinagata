// The body as a cage (settings.topology "cage"): a box-modelled figure laid out from the joints and the body's parts, its points cast onto
// the body's distance (the torso and the head rings of 16, the arms, legs and neck rings of 8 pushed out of the torso's faces, a hand with
// five fingers), smoothed once by Catmull-Clark and pulled onto the distance again. Its quads run along the limbs and round them, where the
// grid (surface nets) runs along the axes: fewer triangles for the same outline. Base proportions (index.js mesh() stretches it like any part).
// Returns { pos, nor, idx }.
import { grad4, projectVerts } from "../sdf/mesh.js";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => add(a, mul(sub(b, a), t)), mean = (ps) => mul(ps.reduce(add), 1 / ps.length);
const perp = (d, t) => unit(sub(d, mul(t, dot(d, t))));   // d with its part along t taken out
const capA = (p) => [p.ax, p.ay, p.az], capB = (p) => [p.ax + p.bx, p.ay + p.by, p.az + p.bz];   // a capsule part's ends (sdf/prim.js C)

export function buildCage({ J, HANDS, P: PARTS, sdf, ears = [], level = 1, relax = 4 }) {
  // the surface along a ray from inside: the first point where the distance turns positive, no further than max
  const hit = (o, d, max = 0.4) => {
    let t = 0, prev = 0;
    for (let i = 0; i < 400 && t < max; i++) { const p = add(o, mul(d, t)), v = sdf(p[0], p[1], p[2]); if (v > 0) break; prev = t; t += Math.max(0.001, -v * 0.8); }
    t = Math.min(t, max); let a = prev, b = t;
    for (let i = 0; i < 22; i++) { const m = (a + b) / 2, p = add(o, mul(d, m)); if (sdf(p[0], p[1], p[2]) > 0) b = m; else a = m; }
    return add(o, mul(d, (a + b) / 2));
  };
  const V = [], F = [], vtx = (p) => V.push(p) - 1, face = (...f) => F.push(f);
  const cast = (o, dirs, max) => dirs.map((d, k) => vtx(hit(o, d, typeof max === "function" ? max(k) : max)));
  const bridge = (A, B, skip = []) => { for (let k = 0; k < A.length; k++) if (!skip.includes(k)) face(A[k], A[(k + 1) % A.length], B[(k + 1) % A.length], B[k]); };
  // two rings of as many points whose orders came apart (a tube's last ring, a ring laid out on its own): bridged at the turn and
  // direction that put each point nearest its partner
  const bridgeNear = (A, B) => { let best = null;
    for (const Bo of [B, [...B].reverse()]) for (let s = 0; s < B.length; s++) { let d = 0; for (let k = 0; k < A.length; k++) d += len(sub(V[A[k]], V[Bo[(k + s) % B.length]])); if (!best || d < best.d) best = { d, R: A.map((_, k) => Bo[(k + s) % B.length]) }; }
    bridge(A, best.R); };
  // a ring of 4 m closed by an m × m grid, its inside cast from o through a Coons patch of the ring (m = 1: the ring itself)
  const capGrid = (ring, o, max = 0.3) => {
    const m = ring.length / 4; if (m === 1) return face(...ring);
    const G = [...Array(m + 1)].map(() => Array(m + 1)); let k = 0;
    for (let i = 0; i < m; i++) G[i][0] = ring[k++]; for (let j = 0; j < m; j++) G[m][j] = ring[k++]; for (let i = m; i > 0; i--) G[i][m] = ring[k++]; for (let j = m; j > 0; j--) G[0][j] = ring[k++];
    const at = (i, j) => V[G[i][j]];
    for (let i = 1; i < m; i++) for (let j = 1; j < m; j++) { const u = i / m, v = j / m;
      const p = sub(add(add(mul(at(i, 0), 1 - v), mul(at(i, m), v)), add(mul(at(0, j), 1 - u), mul(at(m, j), u))),
        add(add(mul(at(0, 0), (1 - u) * (1 - v)), mul(at(m, 0), u * (1 - v))), add(mul(at(0, m), (1 - u) * v), mul(at(m, m), u * v))));
      G[i][j] = vtx(hit(o, unit(sub(p, o)), max)); }
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) face(G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]);
  };
  // a tube out of a ring through stations { c, t } (centre, axis): each point cast the way the last ring's was from its centre (no twist)
  const tube = (first, stations, max) => { let ring = first, pc = mean(first.map((i) => V[i]));
    for (const { c, t } of stations) { const nr = ring.map((i) => vtx(hit(c, perp(sub(V[i], pc), t), max))); bridge(ring, nr); ring = nr; pc = c; }
    return ring; };

  // torso: rings of 16 round the y axis at 11.25° + 22.5° k (no point on the middle line: each half of the bottom is a leg's ring of 8),
  // k = 0 front-left … 15 front-right (from +z towards +x, the character's left)
  const ANG = [...Array(16)].map((_, k) => (11.25 + 22.5 * k) * Math.PI / 180), DH = ANG.map((a) => [Math.sin(a), 0, Math.cos(a)]);
  const down = hit([0, Math.max(J.hips[1], J["upperLeg.L"][1]) + 0.06, J.hips[2]], [0, -1, 0]);   // the crotch (from over the hip joints: the adult body's hips bone is under its crotch)
  const S0 = J["upperArm.L"], yS = S0[1], SX = Math.abs(S0[0]);
  const zAt = (y) => { const k = Math.min(1, Math.max(0, (y - J.hips[1]) / (J.neck[1] - J.hips[1]))); return J.hips[2] + (J.neck[2] - J.hips[2]) * k; };
  // the arms come out of a column (k 3-4 on the left, 11-12 on the right) three bands tall: its points stop at the shoulder joint's width
  // (the rings below the chest share the way from the crotch evenly: set at the joints, the adult body's hips came level with the spine)
  const yC = Math.min(J.chest[1], yS - 0.1), y0 = down[1] + 0.015, ARM_K = [3, 4, 11, 12];
  const TY = [y0, y0 + (yC - y0) * 0.22, y0 + (yC - y0) * 0.5, y0 + (yC - y0) * 0.76, yC, yS - 0.075, yS - 0.035, yS + 0.012];
  const R = TY.map((y, i) => cast([0, y, zAt(y)], DH, (k) => i >= 4 && ARM_K.includes(k) ? SX : 0.4));
  for (let i = 0; i + 1 < R.length; i++) bridge(R[i], R[i + 1], i >= 4 ? [3, 11] : []);
  face(R[0][15], R[0][0], R[0][7], R[0][8]);   // the strip between the legs

  for (const s of ["L", "R"]) {
    const m = s === "L" ? 1 : -1, j = (b) => J[`${b}.${s}`], k0 = m > 0 ? 3 : 11;
    // the arm
    const S = j("upperArm"), E = j("lowerArm"), W = j("hand"), T1 = unit(sub(E, S)), T2 = unit(sub(W, E));
    const open = [R[4][k0], R[4][k0 + 1], R[5][k0 + 1], R[6][k0 + 1], R[7][k0 + 1], R[7][k0], R[6][k0], R[5][k0]];
    const wrist = tube(open, [{ c: lerp(S, E, 0.2), t: T1 }, { c: lerp(S, E, 0.6), t: T1 }, { c: E, t: unit(add(T1, T2)) }, { c: lerp(E, W, 0.5), t: T2 }], 0.12);
    hand(s, wrist);
    // the leg, out of its half of the bottom ring
    const H = j("upperLeg"), K = j("lowerLeg"), A = j("foot"), L1 = unit(sub(K, H)), L2 = unit(sub(A, K));
    const leg0 = m > 0 ? R[0].slice(0, 8) : R[0].slice(8);
    const toe = hit([A[0], 0.025, A[2]], [0, 0, 1], 0.3), tc = [A[0], 0.03, toe[2] - 0.012];
    const end = tube(leg0, [{ c: [H[0], Math.min(H[1], down[1]) - 0.03, H[2]], t: L1 }, { c: lerp(H, K, 0.55), t: L1 }, { c: K, t: unit(add(L1, L2)) }, { c: lerp(K, A, 0.4), t: L2 },
      { c: [A[0], A[1] - 0.015, A[2] + 0.005], t: unit([0, -1, 1]) }, { c: [A[0], 0.034, (A[2] + toe[2]) / 2], t: [0, 0, 1] }, { c: tc, t: [0, 0, 1] }], 0.12);
    capGrid(end, add(tc, [0, 0, -0.01]), 0.1);
  }

  // the hand: wrist and palm rings of 8 across the hand's frame (D the fingers' way, N the palm's, S the thumb's side), a knuckle ring of 12
  // (between the fingers on the back and on the palm), the four fingers out of it and the thumb out of the palm's side. Two of its faces are
  // 8-gons, two finger roots 5-gons: Catmull-Clark makes them quads
  function hand(s, wrist) {
    const { D, N, S } = HANDS[s], W = J[`hand.${s}`], pp = PARTS[`palm.${s}`], PC = [pp.cx, pp.cy, pp.cz];
    const DIRS = [sub(S, N), mul(N, -1), sub(mul(S, -1), N), mul(S, -1), sub(N, S), N, add(S, N), S].map(unit);   // A, back, B, pinky, C, palm, D, thumb
    const Wr = cast(add(W, mul(D, 0.008)), DIRS.map((d) => perp(d, D)), 0.06), Pm = cast(PC, DIRS.map((d) => perp(d, D)), 0.06);
    bridgeNear(wrist, Wr); bridge(Wr, Pm, [6]);
    const FI = [0, 1, 2, 3].map((i) => ({ a: PARTS[`finger${i}.${s}`], b: PARTS[`fingerTip${i}.${s}`] })), base = FI.map((f) => capA(f.a));
    const KC = sub(mean(base), mul(D, 0.004)), between = [0, 1, 2].map((i) => sub(lerp(base[i], base[i + 1], 0.5), mul(D, 0.004)));
    const kv = (o, d) => vtx(hit(o, unit(perp(d, D)), 0.05));
    const K = { A: kv(KC, DIRS[0]), B: kv(KC, DIRS[2]), pm: kv(KC, DIRS[3]), C: kv(KC, DIRS[4]), D: kv(KC, DIRS[6]), tm: kv(KC, DIRS[7]),
      t: between.map((o) => kv(o, mul(N, -1))), u: between.map((o) => kv(o, N)) };
    face(Pm[0], Pm[1], Pm[2], K.B, K.t[2], K.t[1], K.t[0], K.A);   // the back of the hand
    face(Pm[2], Pm[3], K.pm, K.B); face(Pm[3], Pm[4], K.C, K.pm);
    face(Pm[4], Pm[5], Pm[6], K.D, K.u[0], K.u[1], K.u[2], K.C);   // the palm
    face(Pm[6], Pm[7], K.tm, K.D); face(Pm[7], Pm[0], K.A, K.tm);
    const roots = [[K.A, K.t[0], K.u[0], K.D, K.tm], [K.t[0], K.t[1], K.u[1], K.u[0]], [K.t[1], K.t[2], K.u[2], K.u[1]], [K.t[2], K.B, K.pm, K.C, K.u[2]]];
    FI.forEach((f, i) => { const a = capA(f.a), mid = capB(f.a), tip = capB(f.b), d1 = unit(sub(mid, a)), d2 = unit(sub(tip, mid));
      const end = tube(roots[i], [{ c: mid, t: unit(add(d1, d2)) }, { c: tip, t: d2 }], 0.025); face(...end); });
    const th = PARTS[`thumb.${s}`], ta = capA(th), tb = capB(th), td = unit(sub(tb, ta));
    const end = tube([Wr[6], Wr[7], Pm[7], Pm[6]], [{ c: lerp(ta, tb, 0.3), t: td }, { c: tb, t: td }], 0.03); face(...end);
  }

  // neck and head. The neck's top ring sits just under the skull and the next one just outside it on the skull's underside, so the corner
  // where the neck meets the skull stays sharp (one ring each side of it); the head a globe of rings of 16 cast from its middle at
  // latitudes (cast level, the rings missed the back of the skull that hangs over the neck), capped by a 4 × 4 grid. From the neck up the
  // rings are twice as dense at the front as at the side and sparser at the back (HD): the nose and the lips need the points
  // (split into more triangles there afterwards, the outline came through between the slivers in lines round the nose)
  const top = hit([0, J.head[1] + 0.05, 0], [0, 1, 0], 0.6), front = hit([0, J.head[1] + 0.12, 0], [0, 0, 1]), back = hit([0, J.head[1] + 0.12, 0], [0, 0, -1]);
  const hc = [0, (J.head[1] + top[1]) / 2, (front[2] + back[2]) / 2], HA = ANG.map((u) => u - 0.5 * Math.sin(u)), HD = HA.map((a) => [Math.sin(a), 0, Math.cos(a)]);
  const N0 = cast([0, J.neck[1] + 0.01, J.neck[2]], DH, 0.2), N0b = cast([0, J.neck[1] + 0.022, J.neck[2]], HD, 0.2), N1o = [0, J.head[1] - 0.012, (J.neck[2] + hc[2]) / 2], N1 = cast(N1o, HD, 0.07);
  const into = (o, d, max) => { let t = 0; for (; t < max; t += 0.001) { const p = add(o, mul(d, t)); if (sdf(p[0], p[1], p[2]) < 0) break; } return add(o, mul(d, Math.min(t, max))); };   // from outside: the first point in
  const Nc = N1.map((i) => vtx(into(add(V[i], mul(unit([V[i][0] - N1o[0], 0, V[i][2] - N1o[2]]), 0.003)), [0, 1, 0], 0.09)));   // up from just outside the neck: the skull's underside
  // and one more ring on the neck just under each point of Nc (the corner as tight as the cells: with the next ring a cell lower, the
  // smoothing rounded it into a funnel, the neck 15 % wider under the skull)
  const N2 = Nc.map((i, k) => { const y = V[i][1] - 0.003, o = [N1o[0], y, N1o[2]]; return vtx(hit(o, unit([V[N1[k]][0] - N1o[0], 0, V[N1[k]][2] - N1o[2]]), 0.07)); });
  bridge(R[7], N0); bridge(N0, N0b); bridge(N0b, N1); bridge(N1, N2); bridge(N2, Nc);
  let prev = Nc;
  for (const lat of [-40, -28, -16, -6, 4, 14, 26, 42, 60]) { const q = lat * Math.PI / 180, r = cast(hc, HA.map((a) => [Math.cos(q) * Math.sin(a), Math.sin(q), Math.cos(q) * Math.cos(a)]), 0.4); bridge(prev, r); prev = r; }
  capGrid(prev, hc, 0.4);

  // Catmull-Clark, then every quad wound to face out (the distance's gradient at its middle: the tubes were bridged in whatever order
  // their first ring came, and normals summed over two windings cancel)
  let P = V, Q = F;
  for (let l = 0; l < level; l++) ({ P, Q } = catmullClark(P, Q));
  Q = Q.map((f) => { const c = mean(f.map((i) => P[i])), g = grad4(sdf, c[0], c[1], c[2]); return dot(cross(sub(P[f[2]], P[f[0]]), sub(P[f[3]], P[f[1]])), g) < 0 ? [f[3], f[2], f[1], f[0]] : f; });
  // onto the surface: along each point's normal to the nearest crossing (no further than SEEK), then relaxed along the surface
  const pos = new Float64Array(P.length * 3); P.forEach((p, i) => pos.set(p, i * 3));
  const N = normals(pos, Q), SEEK = 0.02;
  for (let v = 0; v < P.length; v++) {
    const o = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]], s0 = Math.sign(sdf(...o));
    for (let t = 0.001; t <= SEEK; t += 0.001) {
      const k = [1, -1].find((g) => { const p = add(o, mul(n, g * t)); return Math.sign(sdf(...p)) !== s0; });
      if (k) { let a = t - 0.001, b = t; for (let i = 0; i < 20; i++) { const m = (a + b) / 2, p = add(o, mul(n, k * m)); if (Math.sign(sdf(...p)) !== s0) b = m; else a = m; } pos.set(add(o, mul(n, k * (a + b) / 2)), v * 3); break; }
    }
  }
  const nor = new Float64Array(pos.length); projectVerts(sdf, pos, nor, 2);
  const nb = neighbours(P.length, Q);
  const yH = J.head[1] - 0.03;   // (over it the head: barely relaxed, else its rings even out round it and the face loses its points)
  for (let it = 0; it < relax; it++) {
    const np = Float64Array.from(pos);
    for (let v = 0; v < P.length; v++) { const w = pos[v * 3 + 1] > yH ? 0.1 : 0.5; const L = nb[v]; let c = [0, 0, 0]; for (const u of L) c = add(c, [pos[u * 3], pos[u * 3 + 1], pos[u * 3 + 2]]); c = mul(c, 1 / L.length);
      const n = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]], d = sub(c, [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]), tg = sub(d, mul(n, dot(d, n)));
      np[v * 3] += tg[0] * w; np[v * 3 + 1] += tg[1] * w; np[v * 3 + 2] += tg[2] * w; }
    pos.set(np); projectVerts(sdf, pos, nor, 2);
  }
  // triangles: each quad split along its shorter diagonal, wound to face along the surface's normal
  const idx = [], at = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], nv = (i) => [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]];
  const tri = (x, y, z) => { if (dot(cross(sub(at(y), at(x)), sub(at(z), at(x))), add(add(nv(x), nv(y)), nv(z))) >= 0) idx.push(x, y, z); else idx.push(x, z, y); };
  for (const [a, b, c, d] of Q) if (len(sub(at(a), at(c))) <= len(sub(at(b), at(d)))) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  const body = { pos: Float32Array.from(pos), nor: Float32Array.from(nor), idx: Uint32Array.from(idx) };
  return ears.length ? merge([body, ...ears.map(earShell)]) : body;
}

// an ear: a shell of its own pushed into the head (sdf: the ear alone), a cube of 2 × 2 faces cast from the ear's middle along its frame
// (u out and back, v up, w its face), smoothed once and pulled onto the ear
function earShell({ sdf, c, axes: [u, v, w], r }) {
  const hit = (o, d, max) => { let t = 0, prev = 0; for (let i = 0; i < 300 && t < max; i++) { const p = add(o, mul(d, t)); if (sdf(p[0], p[1], p[2]) > 0) break; prev = t; t += 0.0008; }
    let a = prev, b = Math.min(t, max); for (let i = 0; i < 20; i++) { const m = (a + b) / 2, p = add(o, mul(d, m)); if (sdf(p[0], p[1], p[2]) > 0) b = m; else a = m; } return add(o, mul(d, (a + b) / 2)); };
  const key = new Map(), V = [], F = [], pt = (q) => { const k = q.join(); if (!key.has(k)) { const d = unit(add(add(mul(u, q[0] * r[0]), mul(v, q[1] * r[1])), mul(w, q[2] * r[2]))); key.set(k, V.push(hit(c, d, 0.15)) - 1); } return key.get(k); };
  for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) { const b = (a + 1) % 3, e = (a + 2) % 3;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const g = (ii, jj) => { const q = [0, 0, 0]; q[a] = sg; q[b] = ii - 1; q[e] = jj - 1; return pt(q); }; F.push([g(i, j), g(i + 1, j), g(i + 1, j + 1), g(i, j + 1)]); } }
  let { P, Q } = catmullClark(V, F);
  Q = Q.map((f) => { const m = mean(f.map((i) => P[i])), g = grad4(sdf, m[0], m[1], m[2]); return dot(cross(sub(P[f[2]], P[f[0]]), sub(P[f[3]], P[f[1]])), g) < 0 ? [f[3], f[2], f[1], f[0]] : f; });
  const pos = new Float64Array(P.length * 3); P.forEach((p, i) => pos.set(p, i * 3)); const nor = new Float64Array(pos.length); projectVerts(sdf, pos, nor, 2);
  const idx = []; for (const [a, b, cc, d] of Q) idx.push(a, b, cc, a, cc, d);
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), idx: Uint32Array.from(idx) };
}

function merge(list) {
  const n = list.reduce((s, m) => s + m.pos.length, 0), pos = new Float32Array(n), nor = new Float32Array(n), idx = []; let o = 0;
  for (const m of list) { pos.set(m.pos, o); nor.set(m.nor, o); for (const i of m.idx) idx.push(i + o / 3); o += m.pos.length; }
  return { pos, nor, idx: Uint32Array.from(idx) };
}

// Catmull-Clark over faces of any size (out: quads); a closed mesh (every edge on two faces)
function catmullClark(P, Q) {
  const nv = P.length, edges = new Map(), ek = (a, b) => a < b ? a * 1e7 + b : b * 1e7 + a;
  const fp = Q.map((f) => mean(f.map((i) => P[i])));
  const vf = [...Array(nv)].map(() => []), ve = [...Array(nv)].map(() => new Set());
  Q.forEach((f, fi) => f.forEach((a, k) => { const b = f[(k + 1) % f.length], key = ek(a, b); if (!edges.has(key)) edges.set(key, { a, b, f: [] }); edges.get(key).f.push(fi); vf[a].push(fi); ve[a].add(b); ve[b].add(a); }));
  const out = P.slice(), eIndex = new Map();
  for (const [key, e] of edges) { const p = e.f.length === 2 ? mul(add(add(P[e.a], P[e.b]), add(fp[e.f[0]], fp[e.f[1]])), 0.25) : mul(add(P[e.a], P[e.b]), 0.5); eIndex.set(key, out.push(p) - 1); }
  const fIndex = fp.map((p) => out.push(p) - 1);
  for (let v = 0; v < nv; v++) { const n = vf[v].length; if (!n || ve[v].size !== n) continue;   // (a point on an edge with one face stays)
    const Fa = mean(vf[v].map((f) => fp[f])), Ra = mean([...ve[v]].map((u) => mul(add(P[v], P[u]), 0.5)));
    out[v] = mul(add(add(Fa, mul(Ra, 2)), mul(P[v], n - 3)), 1 / n); }
  const NQ = [];
  Q.forEach((f, fi) => f.forEach((a, k) => { const b = f[(k + 1) % f.length], z = f[(k + f.length - 1) % f.length]; NQ.push([a, eIndex.get(ek(a, b)), fIndex[fi], eIndex.get(ek(z, a))]); }));
  return { P: out, Q: NQ };
}

function normals(pos, Q) {
  const N = new Float64Array(pos.length), at = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  for (const [a, b, c, d] of Q) { const n = cross(sub(at(c), at(a)), sub(at(d), at(b))); for (const i of [a, b, c, d]) { N[i * 3] += n[0]; N[i * 3 + 1] += n[1]; N[i * 3 + 2] += n[2]; } }
  for (let v = 0; v < N.length; v += 3) { const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= l; N[v + 1] /= l; N[v + 2] /= l; }
  return N;
}

function neighbours(n, Q) {
  const S = [...Array(n)].map(() => new Set());
  for (const f of Q) f.forEach((a, k) => { const b = f[(k + 1) % f.length]; S[a].add(b); S[b].add(a); });
  return S.map((s) => [...s]);
}
