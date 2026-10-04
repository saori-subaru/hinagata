// Hair locks: hair made as separate ribbons (flat, tapering to a sharp point) built straight as triangles, not sampled from a distance
// field. A field sampled on a 7-14 mm grid can't make anything thinner than about two cells, so hair built that way is thick and its tips
// blunt (2026-10-04, Saori: "the hair is all thick, the tips are fat, a helmet"). Ribbons are as thin and as sharp as asked at any quality.
// Each lock is also a chain of points that moves on its own, in the same position-based way as the skirt (cloth.js):
//   1. the first two points ride on the head (the root and its direction)
//   2. the others keep their motion (damped), fall, and are pulled a little toward where the head would carry them (firmly near the root,
//      hardly at the tip: the hair keeps its style but hangs and swings)
//   3. a few rounds of: links pulled back to their length, points pushed out of the head (an ellipsoid fitted to the hair underneath) and
//      out of spheres along the neck, back, shoulders and arms
// The mesh is skinned to the head bone alone; each frame the chain's points are turned back through the head's matrix into the mesh's
// rest positions, so the GPU's skinning puts them where the chain is (as cloth.js does for the skirt).
import * as THREE from "three";

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const RING = [[-1, 0], [-0.55, 1], [0.55, 1], [1, 0], [0.55, -1], [-0.55, -1]];   // the cross-section: a flat lens (across, out), 6 points
const SUB = 3;
const OWN = 0.4;   // how much a lock's own roundness shows in its shading (its edges turn toward the shadow, so each lock reads apart)   // drawn rings per link (a Catmull-Rom curve through the chain's points)

/**
 * Where the locks grow and how they hang (root space, rest pose): a ring of locks around the back and sides of the head, in two layers
 * (the inner one between the outer one's locks), each draped once over the hair underneath and the body.
 * L: { count, span (degrees each side of the back), width, thick, ph: [outer, inner] (degrees up from the head's middle, where they grow) }
 * bottom(th): the height the lock reaches at this angle around the head (0 = front) / cap(x, y, z): the hair under the locks (distance, root space)
 * center: the head's center (root space) / coll: the colliders (see colliders()) / ellipsoid: the head for the drape
 */
export function ringLocks(L, { cap, center, coll, ellipsoid, bottom, N = 12 }) {
  const deg = Math.PI / 180, specs = [], n = Math.max(3, Math.round(L.count ?? 13)), span = L.span ?? 110, PH = L.ph ?? [52, 30];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // the same small differences every build
  for (const layer of [0, 1]) for (let i = 0; i < n - layer; i++) {
    const u = (i + (layer ? 1 : 0.5)) / n, th = (180 - span + 2 * span * u) * deg, ph = PH[layer] * deg;   // th: around the head (0 = front), ph: up from the head's middle
    const dir = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)];
    const t = surfaceAlong(cap, center, dir);   // the hair's surface along this direction
    const root = dir.map((v, k) => center[k] + v * (t - 0.012));   // a little under the surface: the root is hidden in the hair
    const len = Math.max(0.05, (root[1] - bottom(th)) * (1 + (L.vary ?? 0.12) * (rnd() - 0.5)) + 0.04);
    const w = (L.width ?? 0.075) * (0.85 + 0.3 * rnd()) * (layer ? 1.15 : 1);
    specs.push({ root, len, w, thick: L.thick ?? 0.3, layer, curl: (rnd() - 0.5) * 0.04, rise: true });   // rise: it gets its thickness gently (no ridge at the root)
  }
  return specs.map((s) => ({ ...s, pts: drape(s, coll, ellipsoid, N) }));
}
/**
 * Short hair: locks that lie along the hair underneath (root space), from near the crown down to the hem, following its shape (into the
 * nape's inward curve) instead of hanging from the back of the skull (draped short locks fell straight from its widest point: a boxy
 * outline over the neck). L: as ringLocks, plus flick (m: the tips lift off a little) / bottom(th): the hem's height at this angle
 */
export function surfaceLocks(L, { cap, center, bottom, N = 8 }) {
  const deg = Math.PI / 180, specs = [], n = Math.max(3, Math.round(L.count ?? 15)), span = L.span ?? 115, PH = L.ph ?? [64, 44];
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const layer of [0, 1]) for (let i = 0; i < n - layer; i++) {
    const u = (i + (layer ? 1 : 0.5)) / n, th = (180 - span + 2 * span * u) * deg, ph = PH[layer] * deg;
    const rd = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)], root = rd.map((v, k) => center[k] + v * (surfaceAlong(cap, center, rd) - 0.01));
    const ty = bottom(th) - (L.vary ?? 0.15) * 0.1 * rnd(), c = [center[0], ty, center[2]], hd = [Math.sin(th), 0, Math.cos(th)], tip = hd.map((v, k) => c[k] + v * surfaceAlong(cap, c, hd));
    const w = (L.width ?? 0.075) * (0.85 + 0.3 * rnd()) * (layer ? 1.15 : 1), thick = L.thick ?? 0.25, puff = (L.puff ?? 0.008) * rnd(), pts = [];   // puff: some locks stand a little off the others
    for (let q = 0; q < N; q++) { const t = q / (N - 1), p = root.map((v, k) => v + (tip[k] - v) * t), d = p.map((v, k) => v - center[k]), dl = Math.hypot(...d), e = d.map((v) => v / dl);
      const off = rise(t, (layer ? -0.003 : 0.003) + puff * Math.sin(Math.PI * t) + (L.flick ?? 0.02) * t ** 3), at = surfaceAlong(cap, center, e) + off;   // half sunk into the hair (it keeps the hair's own volume; on top of it the locks made the head 2-4 cm bigger, a step where they began); the outer layer over the inner onehe inner one
      pts.push(e.map((v, k) => center[k] + v * at)); }
    let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
    specs.push({ root: pts[0], pts, len, w, thick, layer, curl: (rnd() - 0.5) * 0.03, rise: true });
  }
  return specs;
}
// long hair: down to L.bottom, the sides a little shorter (the hem curves up toward the face)
export const longLocks = (L, kit) => ringLocks(L, { ...kit, bottom: (th) => L.bottom + 0.18 * Math.sin(th) ** 2 * 0.5 });

/** How far from c along the unit direction d the surface of f is (c inside it): halving the range, inside → outside. */
export function surfaceAlong(f, c, d, t0 = 0, t1 = 0.6) {
  for (let k = 0; k < 30; k++) { const t = 0.5 * (t0 + t1); if (f(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t) < 0) t0 = t; else t1 = t; }
  return 0.5 * (t0 + t1);
}
/**
 * Bangs as locks (head space, then carried into root space by toRoot). B: options.hair.sculpt.nendo — the same tips the "nendo" bangs are
 * cut from ([angle, tip height, slope, skew, group, sweep (degrees), extra thickness]): each tip becomes one lock, from the top of the head
 * to that tip, as wide as the gap between its neighbours (and a little more, so they overlap), lying over the hair and the forehead with
 * a little puff in the middle. surf: the hair under the bangs and the head (distance, head space) / center: the head's center (head space)
 */
export function bangLocks(B, { surf, center, toRoot, sx = 1, N = 8 }) {
  const deg = Math.PI / 180, T = B.tips.map(([a, y, , , , sw, tk]) => ({ a: a * deg, y, sw: (sw ?? 0) * deg, tk: tk ?? 0 })).sort((p, q) => p.a - q.a), span = (B.span ?? 92) * deg;
  const out = [], horiz = (y, th) => { const c = [0, y, center[2]], d = [Math.sin(th), 0, Math.cos(th)], t = surfaceAlong(surf, c, d); return [c[0] + d[0] * t, y, c[2] + d[2] * t]; };
  T.forEach((tp, i) => {
    const gl = i > 0 ? tp.a - T[i - 1].a : 2 * (tp.a + span), gr = i + 1 < T.length ? T[i + 1].a - tp.a : 2 * (span - tp.a), half = 0.5 * Math.max(Math.min(gl, gr) * 1.2, Math.max(gl, gr) * 0.8);   // half the clump's angle
    // a wide clump is several locks side by side whose tips gather toward the clump's tip (the outer ones end a little higher): strands, not a sheet
    const k = Math.max(1, Math.round(2 * half / ((B.lockSpan ?? 13) * deg)));
    for (let j = 0; j < k; j++) {
      const f = k > 1 ? (j + 0.5) / k * 2 - 1 : 0, tipA = tp.a - tp.sw + f * half * 0.45, tipY = tp.y + Math.abs(f) * (B.lockRise ?? 0.03);   // f: -1..1 across the clump
      const tip = horiz(tipY, tipA), r0 = Math.hypot(tip[0], tip[2] - center[2]);
      const ph = (B.lockRoot ?? 70) * deg, ra = (tp.a + f * half) * (B.lockRootSpread ?? 0.45),   // they grow from near the crown (where the back's locks start too)
        rd = [Math.sin(ra) * Math.cos(ph), Math.sin(ph), Math.cos(ra) * Math.cos(ph)];
      const rt = surfaceAlong(surf, center, rd), root = rd.map((v, q) => center[q] + v * (rt - 0.006));
      const w = 2 * half / k * r0 * (B.overlap ?? 1.25) * (k > 1 ? 1.35 : 1) * sx, thick = (B.lockThick ?? 0.22) + tp.tk * 6, puff = B.puff ?? 0.012, pts = [];
      for (let q = 0; q < N; q++) { const t = q / (N - 1), p = root.map((v, m) => v + (tip[m] - v) * t), d = p.map((v, m) => v - center[m]), dl = Math.hypot(...d), u = d.map((v) => v / dl);
        const off = 0.5 * w / sx * thick * width(t) + 0.002 + puff * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.004 * (1 - Math.abs(f)), at = surfaceAlong(surf, center, u) + rise(t, off);   // along the surface (the root a little inside the hair); the middle of a clump on top
        pts.push(toRoot(center[0] + u[0] * at, center[1] + u[1] * at, center[2] + u[2] * at)); }
      let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
      out.push({ root: pts[0], pts, len, w, thick, layer: 0, curl: 0, rise: true });
    }
  });
  return out;
}

/** Where a tip of the nendo bangs is (root space, rest): at this angle around the head (degrees, 0 = front) and this height (head space),
 *  just outside the hair and the head there. For an editor's handles (the same surface the bang locks lie on). */
export function bangTipAt(angle, y, { surf, center, toRoot }) {
  const th = angle * Math.PI / 180, c = [0, y, center[2]], d = [Math.sin(th), 0, Math.cos(th)], t = surfaceAlong(surf, c, d) + 0.012;
  return toRoot(c[0] + d[0] * t, y, c[2] + d[2] * t);
}

// hang one lock under gravity in the rest pose, against the same colliders it meets when moving (so the first frame doesn't jump)
function drape(s, coll, ell, N = 12) {
  const seg = s.len / (N - 1), P = [];
  for (let i = 0; i < N; i++) P.push([s.root[0], s.root[1] - seg * i, s.root[2]]);
  const r = (i) => 0.5 * s.w * s.thick * width(i / (N - 1)) + 0.003;
  for (let it = 0; it < 160; it++) {
    for (let i = 2; i < N; i++) P[i][1] -= 0.002;
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < N; i++) { const a = P[i - 1], b = P[i], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; for (let q = 0; q < 3; q++) b[q] = a[q] + d[q] * seg / l; }   // from the root down: the root stays
      for (let i = 1; i < N; i++) { pushOutEllipsoid(P[i], ell.c, ell.r, r(i)); for (const c of coll) pushOutSphere(P[i], c.c, c.r + r(i)); }
    }
  }
  return P;
}
// a lock lying on the hair comes out of it gently: its lift over the surface (off) grows from under the surface over the first third,
// and the mesh gets its thickness over the first fifth (else the root's cut edge stood out as a ridge — a step between the bangs and the
// back on top of the head, read as a helmet's rim from the front: 2026-10-04, Saori)
const rise = (t, off) => -0.006 + (off + 0.006) * sstep(0, 0.33, t);
// how wide a lock is along its length (t: 0 root → 1 tip): a little fuller in the middle, then to a sharp point
export const width = (t) => (1 + 0.25 * Math.sin(Math.PI * t)) * Math.pow(Math.max(0, 1 - t * t * t), 0.8);

function pushOutSphere(p, c, r) { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], d = Math.hypot(dx, dy, dz); if (d >= r || d < 1e-9) return; const k = r / d; p[0] = c[0] + dx * k; p[1] = c[1] + dy * k; p[2] = c[2] + dz * k; }
// out of an ellipsoid (center c, radii r, grown by m): along the scaled direction (good enough near the surface)
function pushOutEllipsoid(p, c, r, m) { const qx = (p[0] - c[0]) / (r[0] + m), qy = (p[1] - c[1]) / (r[1] + m), qz = (p[2] - c[2]) / (r[2] + m), d = Math.hypot(qx, qy, qz); if (d >= 1 || d < 1e-9) return; p[0] = c[0] + qx / d * (r[0] + m); p[1] = c[1] + qy / d * (r[1] + m); p[2] = c[2] + qz / d * (r[2] + m); }

/**
 * Spheres inside the body for the locks to stay out of (rest pose, root space), each on a bone: along the neck, the back and the shoulders
 * and upper arms. Each is as big as fits inside the body there (sdf), so they never stick out of it; extra ones toward the back and sides
 * cover the torso's width. J: the joints / BI: bone indices.
 */
export function colliders(J, BI, sdf) {
  const out = [], add = (bone, c) => { const r = -sdf(...c); if (r > 0.01) out.push({ bone: BI[bone], c, r }); };
  const seg = (bone, a, b, n, spread = []) => { for (let i = 0; i <= n; i++) { const t = i / n, c = a.map((v, k) => v + (b[k] - v) * t); add(bone, c);
    const r = -sdf(...c); for (const [dx, dz] of spread) add(bone, [c[0] + dx * r, c[1], c[2] + dz * r]); } };
  const T = [[0, -0.6], [0.6, -0.4], [-0.6, -0.4], [0.7, 0], [-0.7, 0]];   // toward the back and the sides (in units of the radius there)
  seg("neck", J.neck, J.head, 2); seg("upperChest", J.upperChest, J.neck, 1, T); seg("chest", J.chest, J.upperChest, 1, T); seg("spine", J.spine, J.chest, 2, T); seg("hips", J.hips, J.spine, 1, T);
  for (const s of ["L", "R"]) { seg(`shoulder.${s}`, J[`shoulder.${s}`], J[`upperArm.${s}`], 2); seg(`upperArm.${s}`, J[`upperArm.${s}`], J[`lowerArm.${s}`], 2); }
  return out;
}

/**
 * The moving locks. specs: from longLocks or bangLocks (all with the same number of points) / head: the head bone's index / coll: colliders() / ell: { c, r } the head (root space, rest) /
 * outward(p): the direction the hair faces at p (for the cross-section's "out" and the shading normals) / opts: { stiff, damping }
 * Returns { geometry, update(dt, instant), rest() }; the geometry is skinned to the head bone (skinIndex / skinWeight set).
 */
export function createLocks({ specs, head, coll, ell, skeleton, root, outward, stiff = 1, damping = 0.9 }) {
  const N = specs[0]?.pts.length ?? 0, NL = specs.length, NP = NL * N, ringsPer = (N - 1) * SUB + 1, VPL = ringsPer * RING.length, NV = NL * VPL;
  const R = new Float32Array(NP * 3), X = new Float32Array(NP * 3), P = new Float32Array(NP * 3), T = new Float32Array(NP * 3), K = new Float32Array(NP), RAD = new Float32Array(NP), SEG = new Float32Array(NP);   // SEG[p]: the link from point p - 1 to p
  specs.forEach((s, l) => { s.pts.forEach((p, i) => { R.set(p, (l * N + i) * 3); const t = i / (N - 1); K[l * N + i] = (0.012 + 0.45 * (1 - t) ** 3) * stiff; RAD[l * N + i] = 0.5 * s.w * s.thick * width(t) + 0.003;
    if (i) SEG[l * N + i] = Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1], p[2] - s.pts[i - 1][2]); }); });
  X.set(R); P.set(R);
  // the mesh
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), shn = new Float32Array(NV * 3), idx = [];
  for (let l = 0; l < NL; l++) for (let r = 0; r + 1 < ringsPer; r++) for (let k = 0; k < RING.length; k++) {
    const a = l * VPL + r * RING.length + k, b = l * VPL + r * RING.length + (k + 1) % RING.length, c = a + RING.length, d = b + RING.length; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("shadeN", new THREE.BufferAttribute(shn, 3));
  g.setIndex(idx);
  const si = new Uint16Array(NV * 4), sw = new Float32Array(NV * 4); for (let v = 0; v < NV; v++) { si[v * 4] = head; sw[v * 4] = 1; }
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  for (const a of ["position", "normal", "shadeN"]) g.attributes[a].setUsage(THREE.DynamicDrawUsage);

  const bones = skeleton.bones, M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), inv = new THREE.Matrix4(), tmp = new THREE.Matrix4(), BM = new Float32Array(bones.length * 16);
  const CN = coll.map((c) => ({ ...c, now: [0, 0, 0] })), v3 = new THREE.Vector3();
  // the chains move in world space, so the hair trails behind when the character itself moves (walks across the scene, turns, jumps)
  function matrices() {   // each bone's skinning matrix (world space) and the head's, and its inverse
    root.updateMatrixWorld(true);
    for (let k = 0; k < bones.length; k++) { tmp.multiplyMatrices(bones[k].matrixWorld, skeleton.boneInverses[k]); BM.set(tmp.elements, k * 16); }
    floorY = root.matrixWorld.elements[13];
    M.fromArray(BM, head * 16); Mi.copy(M).invert();
    for (const c of CN) { const e = c.bone * 16, [x, y, z] = c.c; c.now[0] = BM[e] * x + BM[e + 4] * y + BM[e + 8] * z + BM[e + 12]; c.now[1] = BM[e + 1] * x + BM[e + 5] * y + BM[e + 9] * z + BM[e + 13]; c.now[2] = BM[e + 2] * x + BM[e + 6] * y + BM[e + 10] * z + BM[e + 14]; }
    const e = M.elements; for (let i = 0; i < NP; i++) { const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; T[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; T[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; T[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
  }
  const pp = [0, 0, 0]; let floorY = 0;
  function collide(i) {   // point i (root space) out of the head (in its rest space) and the spheres
    const e = Mi.elements, j = i * 3, x = X[j], y = X[j + 1], z = X[j + 2], r = RAD[i];
    pp[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; pp[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pp[2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    const q0 = pp[0], q1 = pp[1], q2 = pp[2]; if (ell) pushOutEllipsoid(pp, ell.c, ell.r, r);
    if (pp[0] !== q0 || pp[1] !== q1 || pp[2] !== q2) { const f = M.elements; X[j] = f[0] * pp[0] + f[4] * pp[1] + f[8] * pp[2] + f[12]; X[j + 1] = f[1] * pp[0] + f[5] * pp[1] + f[9] * pp[2] + f[13]; X[j + 2] = f[2] * pp[0] + f[6] * pp[1] + f[10] * pp[2] + f[14]; }
    for (const c of CN) { pp[0] = X[j]; pp[1] = X[j + 1]; pp[2] = X[j + 2]; pushOutSphere(pp, c.now, c.r + r); X[j] = pp[0]; X[j + 1] = pp[1]; X[j + 2] = pp[2]; }
    if (X[j + 1] < floorY + r) X[j + 1] = floorY + r;   // the floor (the avatar's feet)
  }
  function step(h, keep) {   // one step of h seconds
    const gy = -9.8 * h * h;
    for (let l = 0; l < NL; l++) for (let i = 0; i < N; i++) { const p = l * N + i, j = p * 3;
      if (i < 2) { for (let q = 0; q < 3; q++) { P[j + q] = X[j + q]; X[j + q] = T[j + q]; } continue; }   // the root and the next point ride on the head
      for (let q = 0; q < 3; q++) { const v = (X[j + q] - P[j + q]) * keep; P[j + q] = X[j + q]; X[j + q] += v; }
      X[j + 1] += gy;
      for (let q = 0; q < 3; q++) X[j + q] += (T[j + q] - X[j + q]) * K[p]; }
    for (let it = 0; it < 4; it++) for (let l = 0; l < NL; l++) {
      for (let i = 2; i < N; i++) { const a = (l * N + i - 1) * 3, b = a + 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = (d - SEG[l * N + i]) / d;
        if (i === 2) { X[b] -= dx * f; X[b + 1] -= dy * f; X[b + 2] -= dz * f; }   // the one before rides on the head: only this one moves
        else { X[a] += dx * f * 0.5; X[a + 1] += dy * f * 0.5; X[a + 2] += dz * f * 0.5; X[b] -= dx * f * 0.5; X[b + 1] -= dy * f * 0.5; X[b + 2] -= dz * f * 0.5; } }
      for (let i = 2; i < N; i++) collide(l * N + i);
    }
  }
  // the mesh from the chain: rings along a Catmull-Rom curve through the points, each a flat lens across the lock, facing out
  const C = new Float32Array(ringsPer * 3), Dd = new Float32Array(ringsPer * 3);
  function mesh() {
    const e = Mi.elements;
    const toRest = (out, o, x, y, z, dir) => { if (dir) { out[o] = e[0] * x + e[4] * y + e[8] * z; out[o + 1] = e[1] * x + e[5] * y + e[9] * z; out[o + 2] = e[2] * x + e[6] * y + e[10] * z; }
      else { out[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } };
    for (let l = 0; l < NL; l++) { const s = specs[l], b0 = l * N * 3;
      const at = (i) => Math.min(N - 1, Math.max(0, i)) * 3 + b0;
      for (let i = 0; i + 1 < N; i++) for (let k = 0; k < SUB; k++) { const t = k / SUB, r = i * SUB + k, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), t2 = t * t, t3 = t2 * t;
        for (let q = 0; q < 3; q++) { const a = X[p0 + q], b = X[p1 + q], c = X[p2 + q], d = X[p3 + q];
          C[r * 3 + q] = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
          Dd[r * 3 + q] = 0.5 * ((c - a) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t2); } }
      { const r = ringsPer - 1, a = at(N - 2), b = at(N - 1); for (let q = 0; q < 3; q++) { C[r * 3 + q] = X[b + q]; Dd[r * 3 + q] = X[b + q] - X[a + q]; } }
      for (let r = 0; r < ringsPer; r++) { const t = r / (ringsPer - 1), cx = C[r * 3], cy = C[r * 3 + 1], cz = C[r * 3 + 2];
        let dx = Dd[r * 3], dy = Dd[r * 3 + 1], dz = Dd[r * 3 + 2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
        let [ox, oy, oz] = outward(cx, cy, cz, M); const od = ox * dx + oy * dy + oz * dz; ox -= dx * od; oy -= dy * od; oz -= dz * od; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;   // out: across the lock's direction
        const ax = dy * oz - dz * oy, ay = dz * ox - dx * oz, az = dx * oy - dy * ox;   // across
        const hw = 0.5 * s.w * width(t), ht = Math.max(0.0012, hw * s.thick * (s.rise ? sstep(0, 0.2, t) : 1)), cu = s.curl * t * t;   // half width / half thickness; curl: the tip bends a little sideways
        for (let k = 0; k < RING.length; k++) { const [u, w] = RING[k], v = (l * VPL + r * RING.length + k) * 3, bulge = w > 0 ? 1 : 0.6;   // the outer face rounder than the inner
          const x = cx + ax * (u * hw + cu) + ox * w * ht * bulge, y = cy + ay * (u * hw + cu) + oy * w * ht * bulge, z = cz + az * (u * hw + cu) + oz * w * ht * bulge;
          toRest(pos, v, x, y, z, false);
          let nx = ax * u / Math.max(hw, 1e-4) * ht + ox * w, ny = ay * u / Math.max(hw, 1e-4) * ht + oy * w, nz = az * u / Math.max(hw, 1e-4) * ht + oz * w; const nl = Math.hypot(nx, ny, nz) || 1;   // the lens's normal (an ellipse's)
          toRest(nor, v, nx / nl, ny / nl, nz / nl, true);
          const io = s.layer ? 0.1 : 0.6, sx = ox * io + nx / nl * OWN, sy = oy * io + ny / nl * OWN, sz = oz * io + nz / nl * OWN, sl = Math.hypot(sx, sy, sz) || 1;   // shading: mostly the hair's "out" (the whole hair shades as one volume); the inner layer turned away, so it shows in shadow between the outer locks
          toRest(shn, v, sx / sl, sy / sl, sz / sl, true); } } }
    for (const a of ["position", "normal", "shadeN"]) g.attributes[a].needsUpdate = true;
    g.computeBoundingSphere();
  }
  let first = true, acc = 0;
  const H = 1 / 60;
  return {
    geometry: g,
    /** Each frame after the pose is set. instant: settle at once (no swing carried over). */
    update(dt, instant = false) {
      matrices();
      let jump = 0; for (let i = 0; i < NP * 3; i += 3 * N) jump = Math.max(jump, Math.abs(T[i] - X[i]) + Math.abs(T[i + 1] - X[i + 1]) + Math.abs(T[i + 2] - X[i + 2]));   // the roots against where they were
      if (first || instant || jump > 0.5) { X.set(T); P.set(T); for (let s = 0; s < (first ? 40 : 20); s++) step(H, 0); first = false; acc = 0; }   // settle (also when the avatar was moved far at once: no whip across the scene)
      else { acc = Math.min(acc + dt, 4 * H); while (acc >= H) { step(H, damping); acc -= H; } }
      mesh();
    },
    /** The locks as they hang in the rest pose (glTF export). The next update moves them again. */
    rest() { M.identity(); Mi.identity(); X.set(R); mesh(); first = true; },
  };
}
