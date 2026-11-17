// Hair in layers (options.hair.layers): each layer a thin shell hanging from the head, its hem cut into points the way a drawn anime
// character's hair is, keeping that outline while it moves: it hangs on a few guide chains (createLocks' chains, without their mesh), so a
// layer swings as one piece. Locks can't hold such an outline (each hangs and swings on its own) and the block's grid rounds the points off.
// Built in root space at rest, skinned to the head bone alone; each frame the guides are read back in rest space and carry the shell.
import * as THREE from "three";
import { createLocks, drape, pushOutSphere, bendLock, surfaceAlong } from "./locks.js";

const D2R = Math.PI / 180;
const seeded = (seed) => { let s = 1 + Math.abs(Math.round(seed * 7919)) % 2147483646; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** A layer's defaults (options.hair.layers.list[i]); angles in degrees around the head (0 = front, + = the character's left). */
export const LAYER = { from: 180, span: 100, mirror: false, root: 35, out: 0, bottom: 0.5, sides: 0.1, tips: 7, depth: 0.1, sharp: 1.5, slit: 0.3, sweep: 0.3, jag: 0.3, flare: 0.15, flick: 0, seed: 1 };

/**
 * Built-in sets of layers (options.hair.layers.style, used while hair.layers.list is null), made to be picked and then sized with the
 * layers' length / volume / points. wolf: a long wolf cut, a full back with big points, short layers flaring out beside the face, a lock
 * in front of each shoulder.
 */
export const LAYER_STYLES = {
  wolf: [
    { from: 180, span: 115, root: 30, bottom: 0.36, sides: 0.2, tips: 9, depth: 0.2, slit: 0.4, sharp: 1.6, sweep: 0.35, flare: 0.5, seed: 1 },
    { from: 180, span: 95, root: 50, out: 0.014, bottom: 0.42, sides: 0.18, tips: 6, depth: 0.22, slit: 0.45, sharp: 1.6, sweep: 0.35, flare: 0.45, seed: 2 },
    { from: 108, span: 42, mirror: true, root: 45, out: 0.024, bottom: 0.82, sides: 0.03, tips: 4, depth: 0.13, slit: 0.35, sharp: 1.5, sweep: 0.3, flare: 0.4, flick: 0.01, seed: 3 },
    { from: 66, span: 18, mirror: true, root: 18, bottom: 0.58, sides: 0.02, tips: 2, depth: 0.18, slit: 0.4, sharp: 1.6, sweep: 0.4, flare: 0.2, seed: 4 },
  ],
};
/** The layers a recipe asks for: its own list, else its style's, each sized by length (in kit), volume (× flare) and points (× depth). */
export const layersOf = (LY) => (LY.list ?? LAYER_STYLES[LY.style] ?? []).filter((L) => L && L.on !== false).map((L) => ({ ...LAYER, ...L, flare: (L.flare ?? LAYER.flare) * (LY.volume ?? 1), depth: (L.depth ?? LAYER.depth) * (LY.points ?? 1) }));

/** Points along a polyline at the lengths S (each S[i] from its start; past its end, along the last link). */
function resample(pts, S) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  return S.map((s) => { let k = 0; while (k < pts.length - 2 && L[k + 1] < s) k++; const f = (s - L[k]) / ((L[k + 1] - L[k]) || 1), a = pts[k], b = pts[k + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; });
}
const lengthOf = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(...sub(pts[i], pts[i - 1])); return l; };

/**
 * One layer at rest (root space): columns side by side across it, each from its root on the hair down to the hem. The hem's points each fall
 * on a column (P columns from one notch to the next), so they stay sharp. sgn -1: the mirrored copy (the other side of the head).
 * kit: { cap, center, coll, ell, bottomY (base → root space height), hugY, thick, P, K }
 */
function layerRest(L0, kit, sgn) {
  const L = { ...LAYER, ...L0 }, { cap, center, coll, ell, P, K } = kit, rnd = seeded(L.seed), n = Math.max(1, Math.round(L.tips)), jag = Math.max(0, Math.min(1, L.jag)), half = P / 2;
  // a point's edge (d: 0 at its tip, 1 at the notch): sharp > 1 draws the tip out to a needle; slit: the share of the depth that is a narrow
  // cut between two points (the notch column alone stays up there)
  const a0 = L.from - L.span, a1 = L.from + L.span, prof = (d) => d >= 1 ? 0 : 1 - (1 - L.slit) * Math.pow(d, 1 / L.sharp);
  const notch = [0]; for (let k = 1; k < n; k++) notch.push((k + (rnd() - 0.5) * 0.5 * jag) / n); notch.push(1);
  const cols = [], arc = (a1 - a0) * D2R * 0.28;   // u: across the layer (0..1) / e: the point's length below the hem there / sw: its tip's sideways bend (m) / arc: the layer's width about the hem (m)
  for (let k = 0; k < n; k++) { const tip = notch[k] + (notch[k + 1] - notch[k]) * (0.5 + (rnd() - 0.5) * 0.6 * jag), d = L.depth * (1 - 0.6 * jag * rnd()), sw = (rnd() - 0.5) * 2 * L.sweep * (notch[k + 1] - notch[k]) * arc;
    for (let q = 0; q < half; q++) cols.push({ u: notch[k] + (tip - notch[k]) * q / half, e: d * prof(1 - q / half), d, sw });
    for (let q = 0; q < half; q++) cols.push({ u: tip + (notch[k + 1] - tip) * q / half, e: d * prof(q / half), d, sw }); }
  cols.push({ u: 1, e: 0, d: 0, sw: 0 });
  for (let k = 1; k < n; k++) { const c = cols[k * P]; c.sw = (cols[k * P - 1].sw + cols[k * P + 1].sw) / 2; } cols[0].sw = 0;   // a notch between two points bends half as each
  const T = kit.thick, r = T / 2 + L.out + 0.003, ph = L.root * D2R, yF = ell.c[1] - ell.r[1] * 0.7;   // r: how far it keeps off the head and the body / yF: below this it flares out
  // a column: draped as long as the layer's longest point there (so a neighbour's drape, turned to its place, is a start that settles in a
  // few rounds: draping every column from scratch took seconds), then cut to its own length
  const column = (u, extra, N, { sw = 0, d = 0, warm = null, full = extra } = {}) => {
    const th = sgn * (a0 + (a1 - a0) * u) * D2R, dir = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)];
    const root = dir.map((v, k) => center[k] + v * (surfaceAlong(cap, center, dir) - 0.012));   // a little under the hair's surface: its top edge hidden
    const base = (root[1] - kit.bottomY(L.bottom + L.sides * (2 * u - 1) ** 2)) * (kit.length ?? 1) + 0.04, len = Math.max(0.05, base + extra), lenD = Math.max(len, base + full);   // the hem rises toward the layer's edges by sides
    let init = null; if (warm) { const a = th - warm.th, ca = Math.cos(a), sa = Math.sin(a); init = warm.raw.map((p) => { const x = p[0] - center[0], z = p[2] - center[2]; return [center[0] + x * ca + z * sa, p[1], center[2] - x * sa + z * ca]; }); init[0] = root; }
    const raw = drape({ root, len: lenD }, coll, ell, N, kit.hugY, (i) => r - L.out * (1 - Math.min(1, i / (0.2 * (N - 1)))), init, init ? 30 : 160);   // an outer layer comes out over the others within its first fifth
    let pts = lenD > len ? resample(raw, Array.from({ length: N }, (_, i) => len * i / (N - 1))) : raw;
    // on the head it lies on the hair itself, not on the ellipsoid the drape used (it crossed the hair's surface in a ragged line about the
    // crown): points near the hair are put at their offset over it, rising out of it over the first 5 cm
    { let s = 0; pts = pts.map((p, i) => { if (i) s += Math.hypot(...sub(p, pts[i - 1])); const d = nrm(sub(p, center)), rho = Math.hypot(...sub(p, center)), sA = surfaceAlong(cap, center, d);
      const off = -0.008 + (r + 0.008) * Math.min(1, s / 0.05), w = 1 - Math.min(1, Math.max(0, (rho - sA - 0.01) / 0.03)), to = rho + (sA + off - rho) * w;
      return [center[0] + d[0] * to, center[1] + d[1] * to, center[2] + d[2] * to]; }); }
    if (L.flare) { const hx = Math.sin(th), hz = Math.cos(th);   // below the head the layer stands further and further out, along its way around the head: a fuller hem
      pts = pts.map((p) => { const o = L.flare * Math.max(0, yF - p[1]), q = [p[0] + hx * o, p[1], p[2] + hz * o]; for (const c of coll) pushOutSphere(q, c.c, c.r + r); return q; }); }
    if (sw) { const tx = Math.cos(th) * sgn, tz = -Math.sin(th) * sgn, end = lengthOf(pts), s0 = end - extra - 0.3 * d; let s = 0;   // the point bends sideways toward its tip (a flame's)
      pts = pts.map((p, i) => { if (i) s += Math.hypot(...sub(p, pts[i - 1])); const t = Math.max(0, Math.min(1, (s - s0) / (end - s0))), o = sw * t * t, q = [p[0] + tx * o, p[1], p[2] + tz * o]; for (const c of coll) pushOutSphere(q, c.c, c.r + r); return q; }); }
    if (L.flick) pts = bendLock(pts, L.flick, { center, from: 0.65, keepOut: (p) => { for (const c of coll) pushOutSphere(p, c.c, c.r + r); } });
    return { th, pts, raw };
  };
  let warm = null;
  const grid = cols.map(({ u, e, sw, d }) => { const c = column(u, e, 22, { sw, d, warm, full: L.depth }), Lc = lengthOf(c.pts); warm = c; return { u, th: c.th, len: Lc, pts: resample(c.pts, Array.from({ length: K }, (_, i) => Lc * i / (K - 1))) }; });
  const G = Math.max(2, Math.round((a1 - a0) / 32) + 1), guides = [];   // the guides: a chain every 30° or so across the layer, as long as its middle
  for (let g = 0; g < G; g++) { const u = g / (G - 1), c = column(u, L.depth * 0.5, 8); guides.push({ u, pts: c.pts }); }
  return { grid, guides, r, M: grid.length, K, out: L.out, mid: sgn * L.from * D2R };
}

/**
 * The layers' mesh and motion. LY: options.hair.layers / kit: as layerRest, plus center (the head's middle, root space: the hair's shading
 * volume) / uvAt(x, y, z) → [u, v] (the angel ring). Returns what createLocks does: { geometry, update, rest, specs } (the guides' specs).
 */
export function createShell({ LY, kit, head, coll, ell, skeleton, root, lite = false, uvAt = null }) {
  const P = lite ? 4 : 6, K = lite ? 12 : 20, kitQ = { ...kit, P, K, length: LY.length ?? 1 }, center = kit.center;
  const layers = []; layersOf(LY).forEach((L, li) => { for (const sg of L.mirror ? [1, -1] : [1]) layers.push(Object.assign(layerRest(L, kitQ, sg), { rank: (L.out ?? 0) + li * 1e-4 })); });
  // shade under the hem of a layer lying over this one (rank: out, then the list's order): a band below its hem, following its points, as
  // drawn hair has (the same color everywhere read as one flat sheet). OCC: 1 there (and where it is covered), fading out over LY.shade (m)
  // angles about each layer's own middle (mid): a layer across the back would wrap at ±180° and break the hem in two
  const band = LY.shade ?? 0.05, angleOf = (p, mid) => { const a = Math.atan2(p[0] - center[0], p[2] - center[2]) - mid; return Math.atan2(Math.sin(a), Math.cos(a)); };
  for (const ly of layers) { ly.hem = ly.grid.map((c) => [angleOf(c.pts[K - 1], ly.mid), c.pts[K - 1][1]]).sort((a, b) => a[0] - b[0]); }
  const hemY = (ly, a) => { const H = ly.hem; if (a < H[0][0] || a > H[H.length - 1][0]) return null; let k = 0; while (k < H.length - 2 && H[k + 1][0] < a) k++; const f = (a - H[k][0]) / ((H[k + 1][0] - H[k][0]) || 1); return H[k][1] + (H[k + 1][1] - H[k][1]) * f; };
  for (const ly of layers) { ly.OCC = new Float32Array(ly.M * K); const over = layers.filter((o) => o.rank > ly.rank);
    for (let j = 0; j < ly.M; j++) for (let i = 0; i < K; i++) { const p = ly.grid[j].pts[i]; let occ = 0;
      for (const o of over) { const y = hemY(o, angleOf(p, o.mid)); if (y != null) occ = Math.max(occ, 1 - Math.min(1, Math.max(0, (y - p[1]) / band))); }
      ly.OCC[j * K + i] = occ; } }
  // the guides of every layer in one set of chains (each layer a bundle: its chains share their swing)
  const NG = 8, specs = [];
  layers.forEach((ly, li) => { ly.g0 = specs.length; for (const g of ly.guides) specs.push({ root: g.pts[0], pts: g.pts, len: lengthOf(g.pts), w: 1, thick: 2 * (ly.r - 0.003), prof: () => 1, layer: 0, curl: 0, group: `layer${li}`, cohere: LY.cohere ?? 0.8 }); });
  const sim = createLocks({ specs, head, coll, ell, skeleton, root, outward: () => [0, 0, 1], stiff: LY.stiff ?? 3, damping: LY.damping ?? 0.88, meshless: true });
  const GR = new Float32Array(specs.length * NG * 3); specs.forEach((s, l) => s.pts.forEach((p, i) => GR.set(p, (l * NG + i) * 3)));   // the guides at rest
  const GS = specs.map((s) => { const S = [0]; for (let i = 1; i < NG; i++) S.push(S[i - 1] + Math.hypot(...sub(s.pts[i], s.pts[i - 1]))); return S; });   // their lengths along
  // each grid point hangs on the two guides beside it (by its place across the layer) at its length along: the guide's point there and its
  // offset from it, turned as the guide turns there
  let NV = 0;
  for (const ly of layers) {
    const { M } = ly; ly.B = []; for (let j = 0; j < M; j++) ly.B.push([j, 0]); for (let i = 1; i < K; i++) ly.B.push([M - 1, i]); for (let j = M - 2; j >= 0; j--) ly.B.push([j, K - 1]); for (let i = K - 2; i > 0; i--) ly.B.push([0, i]);   // the edge, around
    ly.v0 = NV; NV += 2 * M * K + ly.B.length;
    const G0 = ly.g0, NGL = ly.guides.length; ly.hang = [];
    for (let j = 0; j < M; j++) { const u = ly.grid[j].u, gf = Math.min(NGL - 1.000001, u * (NGL - 1)), ga = Math.floor(gf), w = gf - ga;
      let s = 0; for (let i = 0; i < K; i++) { const p = ly.grid[j].pts[i]; if (i) s += Math.hypot(...sub(p, ly.grid[j].pts[i - 1]));
        const on = (g) => { const S = GS[g]; let k = 0; while (k < NG - 2 && S[k + 1] < s) k++; const f = (s - S[k]) / ((S[k + 1] - S[k]) || 1), o = (g * NG + k) * 3;
          const at = [0, 1, 2].map((q) => GR[o + q] + (GR[o + 3 + q] - GR[o + q]) * f); return { g, k, f, off: sub(p, at) }; };
        ly.hang.push([on(G0 + ga), on(G0 + ga + 1), w]); } }
  }
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), shn = new Float32Array(NV * 3), gt = new Float32Array(NV), U = new Float32Array(NV * 2), idx = [];
  const g = new THREE.BufferGeometry();
  // per layer, per frame: the middle sheet (C), its normals (NN), the half thickness (HT)
  for (const ly of layers) { ly.C = new Float32Array(ly.M * K * 3); ly.NN = new Float32Array(ly.M * K * 3); ly.E = new Float32Array(ly.B.length * 3);
    ly.HT = new Float32Array(ly.M * K); for (let j = 0; j < ly.M; j++) for (let i = 0; i < K; i++) { const t = i / (K - 1), edge = j === 0 || j === ly.M - 1 ? 0.5 : 1;
      ly.HT[j * K + i] = kit.thick / 2 * edge * Math.max(0.08, Math.pow(1 - t * t * t, 0.6)); } }   // thinning to an edge at the hem (seen from the side the points stay sharp)
  const GN = new Float32Array(specs.length * NG * 3), RT = new Float32Array(specs.length * NG * 9);   // the guides now (rest space) / each point's turn from its rest
  const tan = (A, l, i) => { const a = (l * NG + Math.max(0, i - 1)) * 3, b = (l * NG + Math.min(NG - 1, i + 1)) * 3; return nrm([A[b] - A[a], A[b + 1] - A[a + 1], A[b + 2] - A[a + 2]]); };
  function turns() {   // RT: the rotation taking each guide point's rest direction to its direction now (no twist about it)
    for (let l = 0; l < specs.length; l++) for (let i = 0; i < NG; i++) { const a = tan(GR, l, i), b = tan(GN, l, i), v = cross(a, b), c = dot(a, b), k = 1 / Math.max(1e-6, 1 + c), o = (l * NG + i) * 9;
      const [x, y, z] = v;   // Rodrigues: I + [v]x + [v]x² / (1 + c)
      RT[o] = 1 - (y * y + z * z) * k; RT[o + 1] = -z + x * y * k; RT[o + 2] = y + x * z * k;
      RT[o + 3] = z + x * y * k; RT[o + 4] = 1 - (x * x + z * z) * k; RT[o + 5] = -x + y * z * k;
      RT[o + 6] = -y + x * z * k; RT[o + 7] = x + y * z * k; RT[o + 8] = 1 - (x * x + y * y) * k; }
  }
  const carry = (h, out) => {   // a grid point on guide h now: the guide's point there plus the turned offset
    const o = (h.g * NG + h.k) * 3, r0 = (h.g * NG + h.k) * 9, r1 = r0 + 9, f = h.f, fr = Math.min(1, Math.max(0, f));
    for (let q = 0; q < 3; q++) { const m0 = RT[r0 + q * 3] + (RT[r1 + q * 3] - RT[r0 + q * 3]) * fr, m1 = RT[r0 + q * 3 + 1] + (RT[r1 + q * 3 + 1] - RT[r0 + q * 3 + 1]) * fr, m2 = RT[r0 + q * 3 + 2] + (RT[r1 + q * 3 + 2] - RT[r0 + q * 3 + 2]) * fr;
      out[q] = GN[o + q] + (GN[o + 3 + q] - GN[o + q]) * f + m0 * h.off[0] + m1 * h.off[1] + m2 * h.off[2]; }
  };
  const pa = [0, 0, 0], pb = [0, 0, 0];
  function sheet() {   // every layer's middle sheet and normals from the guides now
    for (const ly of layers) { const { M, C, NN } = ly;
      for (let v = 0; v < M * K; v++) { const [ha, hb, w] = ly.hang[v]; carry(ha, pa); carry(hb, pb); for (let q = 0; q < 3; q++) C[v * 3 + q] = pa[q] + (pb[q] - pa[q]) * w; }
      for (let j = 0; j < M; j++) for (let i = 0; i < K; i++) { const at = (jj, ii) => (Math.min(M - 1, Math.max(0, jj)) * K + Math.min(K - 1, Math.max(0, ii))) * 3, a = at(j - 1, i), b = at(j + 1, i), c = at(j, i - 1), d = at(j, i + 1);
        const n = nrm(cross([C[b] - C[a], C[b + 1] - C[a + 1], C[b + 2] - C[a + 2]], [C[d] - C[c], C[d + 1] - C[c + 1], C[d + 2] - C[c + 2]])), v = (j * K + i) * 3;
        NN[v] = n[0] * ly.sg; NN[v + 1] = n[1] * ly.sg; NN[v + 2] = n[2] * ly.sg; }
      ly.B.forEach(([j, i], b) => { const at = (jj, ii) => (Math.min(M - 1, Math.max(0, jj)) * K + Math.min(K - 1, Math.max(0, ii))) * 3, v = (j * K + i) * 3, n = [NN[v], NN[v + 1], NN[v + 2]];
        const dir = (a, c) => { const d = [C[c] - C[a], C[c + 1] - C[a + 1], C[c + 2] - C[a + 2]], k = dot(d, n); return nrm([d[0] - n[0] * k, d[1] - n[1] * k, d[2] - n[2] * k]); };   // along the sheet, out of the edge
        let e = [0, 0, 0]; const add = (d) => { e = [e[0] + d[0], e[1] + d[1], e[2] + d[2]]; };
        if (i === K - 1) add(dir(at(j, i - 1), at(j, i))); if (i === 0) add(dir(at(j, 1), at(j, 0))); if (j === 0) add(dir(at(1, i), at(0, i))); if (j === M - 1) add(dir(at(M - 2, i), at(M - 1, i)));
        e = nrm(e); ly.E.set(e, b * 3); });
    }
  }
  const vol = (x, y, z) => nrm([x - center[0], Math.max(0, y - center[1]), z - center[2]]);   // the hair's volume: from the head's middle or the line under it
  function write() {
    for (const ly of layers) { const { M, C, NN, HT, E } = ly, MK = M * K, o0 = ly.v0;
      for (let v = 0; v < MK; v++) { const x = C[v * 3], y = C[v * 3 + 1], z = C[v * 3 + 2], n = [NN[v * 3], NN[v * 3 + 1], NN[v * 3 + 2]], h = HT[v], vo = vol(x, y, z), oc = ly.OCC[v];
        if (oc) for (let q = 0; q < 3; q++) vo[q] += ((q === 1 ? -1.6 : -0.4 * vo[q]) - vo[q]) * oc;   // under a layer's hem: turned down and in, away from the light
        for (const [side, s] of [[o0 + v, 1], [o0 + MK + v, -1]]) { pos[side * 3] = x + n[0] * h * s; pos[side * 3 + 1] = y + n[1] * h * s; pos[side * 3 + 2] = z + n[2] * h * s;
          nor[side * 3] = n[0] * s; nor[side * 3 + 1] = n[1] * s; nor[side * 3 + 2] = n[2] * s;
          const sh = s > 0 ? nrm([vo[0] * 0.6 + n[0] * 0.4, vo[1] * 0.6 + n[1] * 0.4, vo[2] * 0.6 + n[2] * 0.4]) : nrm([-vo[0] * 0.3 - n[0] * 0.7, -vo[1] * 0.3 - n[1] * 0.7, -vo[2] * 0.3 - n[2] * 0.7]);   // the inside in shadow
          shn.set(sh, side * 3); } }
      ly.B.forEach(([j, i], b) => { const v = j * K + i, vv = o0 + 2 * MK + b, h = HT[v], e = [E[b * 3], E[b * 3 + 1], E[b * 3 + 2]], vo = vol(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
        const f = i === K - 1 ? 1 : j === 0 || j === M - 1 ? Math.min(1, Math.max(0, (i / (K - 1) - 0.4) / 0.45)) : 0, on = nrm([e[0] * f + NN[v * 3] * (1 - f), e[1] * f + NN[v * 3 + 1] * (1 - f), e[2] * f + NN[v * 3 + 2] * (1 - f)]);   // the outline (the normal it is pushed along): out of the hem, out of the side edges only toward their ends (else a long seam from the crown), not out of the top
        for (let q = 0; q < 3; q++) { pos[vv * 3 + q] = C[v * 3 + q] + e[q] * h; nor[vv * 3 + q] = on[q]; }
        shn.set(nrm([vo[0] * 0.6 + e[0] * 0.4, vo[1] * 0.6 + e[1] * 0.4, vo[2] * 0.6 + e[2] * 0.4]), vv * 3); }); }
    for (const a of ["position", "normal", "shadeN"]) g.attributes[a].needsUpdate = true;
    g.computeBoundingSphere();
  }
  // at rest: which way the sheet's normal faces (out), and the triangles wound to face where their side faces
  sim.rest(); sim.restPoints(GN); turns();
  for (const ly of layers) ly.sg = 1;
  sheet();
  for (const ly of layers) { let s = 0; for (let v = 0; v < ly.M * K; v++) { const p = [ly.C[v * 3], ly.C[v * 3 + 1], ly.C[v * 3 + 2]]; s += dot([ly.NN[v * 3], ly.NN[v * 3 + 1], ly.NN[v * 3 + 2]], vol(...p)); } ly.sg = s < 0 ? -1 : 1; }
  sheet();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("shadeN", new THREE.BufferAttribute(shn, 3));
  write();
  const tri = (a, b, c, want) => { const A = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], n = cross(sub([pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], A), sub([pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]], A));
    if (dot(n, want) < 0) idx.push(a, c, b); else idx.push(a, b, c); };
  for (const ly of layers) { const { M } = ly, MK = M * K, o0 = ly.v0, NNv = (v) => [ly.NN[v * 3], ly.NN[v * 3 + 1], ly.NN[v * 3 + 2]];
    for (let j = 0; j + 1 < M; j++) for (let i = 0; i + 1 < K; i++) { const a = j * K + i, b = a + K, c = a + 1, d = b + 1, n = NNv(a), m = n.map((x) => -x);
      tri(o0 + a, o0 + b, o0 + c, n); tri(o0 + b, o0 + d, o0 + c, n); tri(o0 + MK + a, o0 + MK + b, o0 + MK + c, m); tri(o0 + MK + b, o0 + MK + d, o0 + MK + c, m); }
    const NB = ly.B.length; for (let b = 0; b < NB; b++) { const b2 = (b + 1) % NB, [j0, i0] = ly.B[b], [j1, i1] = ly.B[b2], v0 = j0 * K + i0, v1 = j1 * K + i1, r0 = o0 + 2 * MK + b, r1 = o0 + 2 * MK + b2, e = [ly.E[b * 3], ly.E[b * 3 + 1], ly.E[b * 3 + 2]];
      tri(o0 + v0, o0 + v1, r1, e); tri(o0 + v0, r1, r0, e); tri(r0, r1, o0 + MK + v1, e); tri(r0, o0 + MK + v1, o0 + MK + v0, e); }
    // along the layer: 0 at the root, 1 at the hem (a gradient); the angel ring's place from where the sheet rests
    for (let j = 0; j < M; j++) for (let i = 0; i < K; i++) { const v = j * K + i, t = i / (K - 1), uv = uvAt ? uvAt(ly.C[v * 3], ly.C[v * 3 + 1], ly.C[v * 3 + 2]) : [0, 0];
      for (const vv of [o0 + v, o0 + MK + v]) { gt[vv] = t; U[vv * 2] = uv[0]; U[vv * 2 + 1] = uv[1]; } }
    ly.B.forEach(([j, i], b) => { const vv = o0 + 2 * MK + b, v = o0 + j * K + i; gt[vv] = gt[v]; U[vv * 2] = U[v * 2]; U[vv * 2 + 1] = U[v * 2 + 1]; }); }
  g.setIndex(idx); g.setAttribute("gradT", new THREE.BufferAttribute(gt, 1)); if (uvAt) g.setAttribute("hairUV", new THREE.BufferAttribute(U, 2));
  const si = new Uint16Array(NV * 4), sw = new Float32Array(NV * 4); for (let v = 0; v < NV; v++) { si[v * 4] = head; sw[v * 4] = 1; }
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  for (const a of ["position", "normal", "shadeN"]) g.attributes[a].setUsage(THREE.DynamicDrawUsage);
  return {
    geometry: g, specs,
    update(dt, instant = false, wind = null, coarse = false) { sim.update(dt, instant, wind, coarse); sim.restPoints(GN); turns(); sheet(); write(); },
    rest() { sim.rest(); sim.restPoints(GN); turns(); sheet(); write(); },
  };
}
