// Cloth: a skirt that drapes instead of tearing (2026-10-03, Saori: "the thighs poke out of the skirt when sitting on the floor").
// Skin weights alone can't do it: the thighs turn ~90° inside one piece of cloth, so weighting the skirt to them tears its sides open and
// weighting it to the hips lets them poke through. Here the skirt is moved each frame as cloth, in a simple position-based way:
//   1. the target: where the usual skinning (hips, skirt bones, thighs) puts each point
//   2. each point is pulled toward its target — fully at the waistband (pinned), loosely toward the hem — and keeps a little of its motion (a soft sway)
//   3. a few rounds of: edges that got longer than they were are pulled back to their length (the cloth doesn't stretch; it may bunch up),
//      points inside a thigh or shin (capsules from the bones) are pushed out to its surface, points under the floor (or under the seat, sitting
//      on a chair) are lifted onto it
// Drawn as the same skinned skirt as before: each frame the cloth's points are turned back through the skinning (each point's blended bone
// matrix, inverted) into the mesh's rest positions and normals, so the GPU's skinning puts them exactly where the cloth is. Where the cloth
// sits where the skinning would put it, the mesh is the built one, unchanged. (A separate plain mesh drawn in its place shaded differently —
// a dark band across a standing skirt that we could not trace — so the skirt keeps its own mesh, material and outline.)
// rest() puts the built mesh back (glTF export).
import * as THREE from "three";

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** m, o: the skinned skirt and its outline. top / hem: the skirt's waist and hem heights (rest).
 *  legs: [{ hip, knee, foot, t0, rThigh, rKnee, rCalf, rAnkle }] bone names, where the thigh starts (0-1 from hip to knee) and radii (with a margin for the cloth). */
export function createCloth({ m, o, skeleton, root, top, hem, legs }) {
  const g0 = m.geometry, GP = g0.attributes.position.array, GN = g0.attributes.normal.array, R = Float32Array.from(GP), SI = g0.attributes.skinIndex.array, SW = g0.attributes.skinWeight.array, n = R.length / 3;   // GP / GN: what is drawn; R / NR: the built mesh (kept)
  // the skirt is a shell 1-2 cm thick: only its outer side is moved as cloth; each point of the inner side rides along with the nearest outer
  // point (keeping its offset from it, as skinned). Half the points and edges: the cost is about halved and the look is the same
  const NR = Float32Array.from(GN), OUT = new Uint8Array(n), NE = new Int32Array(n).fill(-1);
  for (let v = 0; v < n; v++) { const x = R[v * 3], z = R[v * 3 + 2] + 0.005, l = Math.hypot(x, z) || 1; OUT[v] = (NR[v * 3] * x + NR[v * 3 + 2] * z) / l > -0.2 ? 1 : 0; }   // facing out (rims at the waist and hem count as outer)
  { const CS = 0.015, key = (x, y, z) => `${Math.floor(x / CS)},${Math.floor(y / CS)},${Math.floor(z / CS)}`, grid = new Map();
    for (let v = 0; v < n; v++) if (OUT[v]) { const k = key(R[v * 3], R[v * 3 + 1], R[v * 3 + 2]); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(v); }
    for (let v = 0; v < n; v++) { if (OUT[v]) continue; const x = R[v * 3], y = R[v * 3 + 1], z = R[v * 3 + 2], gx = Math.floor(x / CS), gy = Math.floor(y / CS), gz = Math.floor(z / CS); let best = -1, bd = Infinity;
      for (let r = 1; r <= 3 && best < 0; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) for (const u of grid.get(`${gx + i},${gy + j},${gz + k}`) ?? []) { const d = (R[u * 3] - x) ** 2 + (R[u * 3 + 1] - y) ** 2 + (R[u * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = u; } }
      if (best < 0) OUT[v] = 1; else NE[v] = best; } }   // (none near: move it as cloth itself)
  // edges between outer points (each once) and their rest lengths
  const I = g0.index.array, seen = new Set(), E = [];
  for (let i = 0; i < I.length; i += 3) for (const [a, b] of [[I[i], I[i + 1]], [I[i + 1], I[i + 2]], [I[i + 2], I[i]]]) { if (!OUT[a] || !OUT[b]) continue; const k = a < b ? a * n + b : b * n + a; if (!seen.has(k)) { seen.add(k); E.push(a, b); } }
  const EA = new Uint32Array(E), EL = new Float32Array(EA.length / 2);
  for (let e = 0; e < EL.length; e++) { const a = EA[e * 2] * 3, b = EA[e * 2 + 1] * 3; EL[e] = Math.hypot(R[a] - R[b], R[a + 1] - R[b + 1], R[a + 2] - R[b + 2]); }
  // how firmly each point follows its target per frame: 1 at the waistband (pinned) → PULL_HEM at the hem
  const PULL_HEM = 0.18, A = new Float32Array(n), W = new Float32Array(n);   // W: 0 = pinned (doesn't move for the edges), 1 = free
  for (let v = 0; v < n; v++) { const u = (top - R[v * 3 + 1]) / (top - hem); A[v] = 1 - (1 - PULL_HEM) * sstep(0.08, 0.7, u); W[v] = A[v] > 0.97 || !OUT[v] ? 0 : 1; }   // inner points: placed after (ride)
  const T = new Float32Array(R.length), TN = new Float32Array(R.length), X = new Float32Array(R), P = new Float32Array(R);   // TN: the skinned normals
  const FR = new Uint8Array(n); for (let v = 0; v < n; v++) FR[v] = R[v * 3 + 2] > 0.02 ? 1 : 0;   // the front of the skirt (rest)
  const bones = skeleton.bones, BM = new Float32Array(bones.length * 16), inv = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  // each leg: the thigh from t0 (0-1 from the hip toward the knee) to the knee, moved forward by `front` (the thigh is fuller in front), and the shin.
  // The ends are kept in the bones' own space, so the capsules turn with the bones
  root.updateMatrixWorld(true);
  const LEG = legs.map((L) => { const b = [L.hip, L.knee, L.foot].map((nm) => bones.find((x) => x.name === nm)), w = b.map((x) => x.getWorldPosition(new THREE.Vector3())), f = new THREE.Vector3(0, 0, L.front ?? 0);
    const tA = w[1].clone().sub(w[0]).multiplyScalar(L.t0 ?? 0).add(f), tB = w[1].clone().sub(w[0]).add(f), sA = new THREE.Vector3(), sB = w[2].clone().sub(w[1]);   // in the bones' frames (they rest unturned)
    return { ...L, b, ends: [[b[0], tA], [b[0], tB], [b[1], sA], [b[1], sB]] }; }), wp = new THREE.Vector3();
  let first = true;

  function targets() {   // the usual skinning (the same as the GPU does), into root space
    inv.copy(root.matrixWorld).invert();
    for (let k = 0; k < bones.length; k++) { tmp.multiplyMatrices(inv, bones[k].matrixWorld).multiply(skeleton.boneInverses[k]); BM.set(tmp.elements, k * 16); }
    for (let v = 0; v < n; v++) { const x = R[v * 3], y = R[v * 3 + 1], z = R[v * 3 + 2]; let tx = 0, ty = 0, tz = 0;
      for (let q = 0; q < 4; q++) { const w = SW[v * 4 + q]; if (!w) continue; const e = SI[v * 4 + q] * 16;
        tx += w * (BM[e] * x + BM[e + 4] * y + BM[e + 8] * z + BM[e + 12]); ty += w * (BM[e + 1] * x + BM[e + 5] * y + BM[e + 9] * z + BM[e + 13]); tz += w * (BM[e + 2] * x + BM[e + 6] * y + BM[e + 10] * z + BM[e + 14]); }
      T[v * 3] = tx; T[v * 3 + 1] = ty; T[v * 3 + 2] = tz;
      const nx = NR[v * 3], ny = NR[v * 3 + 1], nz = NR[v * 3 + 2]; let sx = 0, sy = 0, sz = 0;   // the skinned normal (the built mesh's smooth one, turned)
      for (let q = 0; q < 4; q++) { const w = SW[v * 4 + q]; if (!w) continue; const e = SI[v * 4 + q] * 16; sx += w * (BM[e] * nx + BM[e + 4] * ny + BM[e + 8] * nz); sy += w * (BM[e + 1] * nx + BM[e + 5] * ny + BM[e + 9] * nz); sz += w * (BM[e + 2] * nx + BM[e + 6] * ny + BM[e + 10] * nz); }
      TN[v * 3] = sx; TN[v * 3 + 1] = sy; TN[v * 3 + 2] = sz; }
  }
  function capsules() {   // thighs and shins now (root space): [ax, ay, az, bx, by, bz, ra, rb, thigh?]
    const out = [], at = ([b, v]) => root.worldToLocal(b.localToWorld(wp.copy(v))).toArray();
    for (const L of LEG) { const e = L.ends.map(at); out.push([...e[0], ...e[1], L.rThigh, L.rKnee, 1], [...e[2], ...e[3], L.rCalf, L.rAnkle, 0]); }   // last: 1 = a thigh (the skirt's front goes over it)
    return out;
  }
  // a point of the skirt already inside a capsule when standing (the skirt's top over the thigh's root) keeps clear of that capsule: bit ci set = skip
  const SKIP = new Uint8Array(n);
  { const C0 = capsules(); for (let v = 0; v < n; v++) C0.forEach((c, ci) => { const x = R[v * 3], y = R[v * 3 + 1], z = R[v * 3 + 2], bx = c[3] - c[0], by = c[4] - c[1], bz = c[5] - c[2], t = Math.min(1, Math.max(0, ((x - c[0]) * bx + (y - c[1]) * by + (z - c[2]) * bz) / (bx * bx + by * by + bz * bz)));
      if (Math.hypot(x - c[0] - bx * t, y - c[1] - by * t, z - c[2] - bz * t) < c[6] + (c[7] - c[6]) * t) SKIP[v] |= 1 << ci; }); }
  // up: for each capsule, the direction across it that is closest to straight up — only for a thigh turned up past ~55° (sitting, crouching).
  // A walking thigh (up to ~30°) is left to the plain push: there "up across it" points forward and flipped the skirt's inner side out
  const UP = (c) => { const bx = c[3] - c[0], by = c[4] - c[1], bz = c[5] - c[2], L = Math.hypot(bx, by, bz), ay = by / L; if (Math.abs(ay) > 0.57) return null;
    const ux = -bx / L * ay, uy = 1 - ay * ay, uz = -bz / L * ay, ul = Math.hypot(ux, uy, uz); return [ux / ul, uy / ul, uz / ul]; };
  function collide(C, seat) {
    const U = C.map((c) => c[8] ? UP(c) : null), BX = C.map((c) => { const r = Math.max(c[6], c[7]); return [Math.min(c[0], c[3]) - r, Math.max(c[0], c[3]) + r, Math.min(c[1], c[4]) - r, Math.max(c[1], c[4]) + r, Math.min(c[2], c[5]) - r, Math.max(c[2], c[5]) + r]; });   // each capsule's box (most points are far from most capsules)
    for (let v = 0; v < n; v++) { if (!W[v]) continue; const i = v * 3; let x = X[i], y = X[i + 1], z = X[i + 2];
      for (let ci = 0; ci < C.length; ci++) {   // push out of each capsule (radius changes along it)
        if (SKIP[v] & (1 << ci)) continue; const B = BX[ci]; if (x < B[0] || x > B[1] || y < B[2] || y > B[3] || z < B[4] || z > B[5]) continue;
        const c = C[ci], bx = c[3] - c[0], by = c[4] - c[1], bz = c[5] - c[2], L2 = bx * bx + by * by + bz * bz, t = Math.min(1, Math.max(0, ((x - c[0]) * bx + (y - c[1]) * by + (z - c[2]) * bz) / L2));
        const px = c[0] + bx * t, py = c[1] + by * t, pz = c[2] + bz * t, r = c[6] + (c[7] - c[6]) * t; let dx = x - px, dy = y - py, dz = z - pz; const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r || d2 < 1e-12) continue; const d = Math.sqrt(d2);
        // a thigh turned up (sitting): the front of the skirt goes over it, not under (pushed the nearest way, the part under the thigh tucked
        // beneath it and the thigh showed through a hole). The back of the skirt stays under (you sit on it)
        const u = U[ci]; if (u && FR[v]) { const s = dx * u[0] + dy * u[1] + dz * u[2]; if (s < 0) { dx -= 2 * s * u[0]; dy -= 2 * s * u[1]; dz -= 2 * s * u[2]; } }
        const k = r / d; x = px + dx * k; y = py + dy * k; z = pz + dz * k; }
      if (y < 0.003) y = 0.003;   // the floor
      if (seat && z < seat.front && Math.abs(x) < 0.2 && y < seat.y && y > seat.y - 0.06) y = seat.y;   // the chair's seat (the part of it under the bottom)
      X[i] = x; X[i + 1] = y; X[i + 2] = z; }
  }
  function edges() {   // stretched edges back to their length (not pushed apart when shorter: the cloth may bunch)
    for (let e = 0; e < EL.length; e++) { const a = EA[e * 2], b = EA[e * 2 + 1], wa = W[a], wb = W[b], ws = wa + wb; if (!ws) continue;
      const ia = a * 3, ib = b * 3, dx = X[ib] - X[ia], dy = X[ib + 1] - X[ia + 1], dz = X[ib + 2] - X[ia + 2], d2 = dx * dx + dy * dy + dz * dz, L = EL[e];
      if (d2 <= L * L) continue; const d = Math.sqrt(d2);   // (Math.hypot is several times slower than this in V8)
      const f = (d - L) / d / ws;
      X[ia] += dx * f * wa; X[ia + 1] += dy * f * wa; X[ia + 2] += dz * f * wa; X[ib] -= dx * f * wb; X[ib + 1] -= dy * f * wb; X[ib + 2] -= dz * f * wb; }
  }
  const PROF = { targets: 0, edges: 0, collide: 0, normals: 0 }, now = () => performance.now();   // ms in the last update (for checking)
  const NA = new Float32Array(R.length);   // the cloth's normals (root space)
  const MOV = new Uint8Array(n);   // 1 = the cloth moved this point off its target (else the built mesh is used as it is)
  function normals() {   // area-weighted vertex normals (the same as computeVertexNormals, without the Vector3s) — only around moved points
    for (let v = 0, i = 0; v < n; v++, i += 3) MOV[v] = Math.abs(X[i] - T[i]) + Math.abs(X[i + 1] - T[i + 1]) + Math.abs(X[i + 2] - T[i + 2]) > 1e-5 ? 1 : 0;
    NA.fill(0);
    for (let t = 0; t < I.length; t += 3) { if (!MOV[I[t]] && !MOV[I[t + 1]] && !MOV[I[t + 2]]) continue; const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      NA[a] += nx; NA[a + 1] += ny; NA[a + 2] += nz; NA[b] += nx; NA[b + 1] += ny; NA[b + 2] += nz; NA[c] += nx; NA[c + 1] += ny; NA[c + 2] += nz; }
    // where the cloth sits where the skinning put it, keep the built mesh's smooth normal (the mesh's own faces shade a little bumpier: a dark band
    // showed on the standing skirt); where the cloth was moved off (over a thigh), its own faces' normal, blended over 2 mm - 1 cm
    for (let i = 0; i < NA.length; i += 3) { if (!MOV[i / 3]) continue; const l = Math.sqrt(NA[i] * NA[i] + NA[i + 1] * NA[i + 1] + NA[i + 2] * NA[i + 2]) || 1, dev = Math.sqrt((X[i] - T[i]) ** 2 + (X[i + 1] - T[i + 1]) ** 2 + (X[i + 2] - T[i + 2]) ** 2), k = sstep(0.002, 0.01, dev);
      const tl = Math.sqrt(TN[i] * TN[i] + TN[i + 1] * TN[i + 1] + TN[i + 2] * TN[i + 2]) || 1;
      let x = TN[i] / tl + (NA[i] / l - TN[i] / tl) * k, y = TN[i + 1] / tl + (NA[i + 1] / l - TN[i + 1] / tl) * k, z = TN[i + 2] / tl + (NA[i + 2] / l - TN[i + 2] / tl) * k; const m = Math.sqrt(x * x + y * y + z * z) || 1;
      NA[i] = x / m; NA[i + 1] = y / m; NA[i + 2] = z / m; }
  }
  // the cloth's points and normals (root space) → the mesh's own (rest) positions and normals: through each point's blended bone matrix, inverted
  //   (position: A⁻¹ (X − t); normal: Aᵀ n, as normals turn by the inverse transpose)
  function unskin() {
    for (let v = 0; v < n; v++) { const i = v * 3; if (!MOV[v]) { GP[i] = R[i]; GP[i + 1] = R[i + 1]; GP[i + 2] = R[i + 2]; GN[i] = NR[i]; GN[i + 1] = NR[i + 1]; GN[i + 2] = NR[i + 2]; continue; }   // where the skinning put it: the built mesh
      let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0, c0 = 0, c1 = 0, c2 = 0, t0 = 0, t1 = 0, t2 = 0;
      for (let q = 0; q < 4; q++) { const w = SW[v * 4 + q]; if (!w) continue; const e = SI[v * 4 + q] * 16;
        a0 += w * BM[e]; a1 += w * BM[e + 1]; a2 += w * BM[e + 2]; b0 += w * BM[e + 4]; b1 += w * BM[e + 5]; b2 += w * BM[e + 6]; c0 += w * BM[e + 8]; c1 += w * BM[e + 9]; c2 += w * BM[e + 10]; t0 += w * BM[e + 12]; t1 += w * BM[e + 13]; t2 += w * BM[e + 14]; }
      const dx = X[i] - t0, dy = X[i + 1] - t1, dz = X[i + 2] - t2;
      const r00 = b1 * c2 - b2 * c1, r01 = b2 * c0 - b0 * c2, r02 = b0 * c1 - b1 * c0, det = a0 * r00 + a1 * r01 + a2 * r02;   // rows of the inverse: (b×c, c×a, a×b) / det
      if (Math.abs(det) < 1e-9) { GP[i] = R[i]; GP[i + 1] = R[i + 1]; GP[i + 2] = R[i + 2]; GN[i] = NR[i]; GN[i + 1] = NR[i + 1]; GN[i + 2] = NR[i + 2]; continue; }
      const r10 = c1 * a2 - c2 * a1, r11 = c2 * a0 - c0 * a2, r12 = c0 * a1 - c1 * a0, r20 = a1 * b2 - a2 * b1, r21 = a2 * b0 - a0 * b2, r22 = a0 * b1 - a1 * b0;
      GP[i] = (r00 * dx + r01 * dy + r02 * dz) / det; GP[i + 1] = (r10 * dx + r11 * dy + r12 * dz) / det; GP[i + 2] = (r20 * dx + r21 * dy + r22 * dz) / det;
      const nx = NA[i], ny = NA[i + 1], nz = NA[i + 2], ux = a0 * nx + a1 * ny + a2 * nz, uy = b0 * nx + b1 * ny + b2 * nz, uz = c0 * nx + c1 * ny + c2 * nz, l = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
      GN[i] = ux / l; GN[i + 1] = uy / l; GN[i + 2] = uz / l; }
    g0.attributes.position.needsUpdate = g0.attributes.normal.needsUpdate = true;
  }
  const T0 = new Float32Array(R.length); let still = 0;   // the targets last frame / frames in a row that nothing moved
  function step(keep, iters, C, seat) {
    for (let i = 0; i < X.length; i++) { const v = (i / 3) | 0, vel = (X[i] - P[i]) * keep; P[i] = X[i]; let x = X[i] + vel; x += (T[i] - x) * A[v]; X[i] = W[v] ? x : T[i]; }
    for (let k = 0; k < iters; k++) { let t0 = now(); edges(); PROF.edges += now() - t0; t0 = now(); collide(C, seat); PROF.collide += now() - t0; }
    for (let v = 0; v < n; v++) { const u = NE[v]; if (u < 0) continue; for (let q = 0; q < 3; q++) X[v * 3 + q] = X[u * 3 + q] + T[v * 3 + q] - T[u * 3 + q]; }   // the inner side rides on the outer
  }
  return {
    prof: PROF,
    /** For checking: how many points the cloth has moved off their targets now, and the farthest (m). */
    moved() { let c = 0, mx = 0; for (let v = 0, i = 0; v < n; v++, i += 3) { const d = Math.hypot(X[i] - T[i], X[i + 1] - T[i + 1], X[i + 2] - T[i + 2]); if (d > 1e-5) c++; if (d > mx) mx = d; } return { count: c, of: n, max: mx }; },
    /** Each frame after the pose is set. instant: settle at once (no sway carried over). seat: { y, front } when sitting on a chair. */
    update(dt, instant = false, seat = null) {
      if (!m.visible) { first = true; return; }
      for (const k in PROF) PROF[k] = 0; let t0 = now();
      root.updateMatrixWorld(true); targets(); const C = capsules(); PROF.targets = now() - t0;
      let moved = 0; for (let i = 0; i < T.length; i++) { const d = Math.abs(T[i] - T0[i]); if (d > moved) moved = d; } T0.set(T);
      if (first || instant) { X.set(T); P.set(T); for (let s = 0; s < (first ? 30 : 10); s++) step(0, 2, C, seat); first = false; still = 0; }   // settle: no motion carried over
      else { still = moved < 1e-5 ? still + 1 : 0; if (still > 40) return;   // resting (the skirt's bones haven't moved for a while, the sway has died down): nothing to do
        step(Math.pow(0.55, Math.min(dt, 0.05) * 60), 2, C, seat); }   // keep a little of the motion (55% per 1/60 s)
      t0 = now(); normals(); unskin(); PROF.normals = now() - t0;
    },
    /** Put the built mesh back (as skinned from the rest pose; e.g. for the glTF export). The next update moves the cloth again. */
    rest() { GP.set(R); GN.set(NR); g0.attributes.position.needsUpdate = g0.attributes.normal.needsUpdate = true; first = true; },
  };
}
