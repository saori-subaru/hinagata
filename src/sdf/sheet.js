// Thin cloth (a skirt, its petticoat, a cape, a bell sleeve) made as one sheet through its middle, then given its two sides and a rim.
// As a distance, a shell 1-2 cm thick needs cells under half its thickness (a cell spanning both sides put its vertex between them):
// 8 mm cells, both sides, a skirt of 42,000 triangles. Its middle is one smooth surface: meshed at coarse cells, cut exactly along
// cut = 0 (the hem's own line, not the cells' steps), each of its points pushed out onto both sides (an inner point is the twin of an
// outer one: cloth.js moves the outer side and carries the inner along), and a rounded rim along the cut. Pure math, no three.js.
import { surfaceNets } from "./mesh.js";

// value and gradient from 4 samples (a tetrahedron), not normalized: [gx, gy, gz, value]
function g4(f, x, y, z, e = 0.0008) {
  const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e), k = 1 / (4 * e);
  return [(a - b - c + d) * k, (-a - b + c + d) * k, (-a + b - c + d) * k, (a + b + c + d) / 4];
}
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// onto f = 0 along its gradient (Newton, n steps of at most lim: where the field bends, a long step flew off)
function onto(f, p, n = 3, lim = 0.03) { for (let i = 0; i < n; i++) { const g = g4(f, p[0], p[1], p[2]), l = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]; if (!l) break;
  let s = g[3] / l; const d = Math.abs(s) * Math.sqrt(l); if (d > lim) s *= lim / d; p = [p[0] - g[0] * s, p[1] - g[1] * s, p[2] - g[2] * s]; } return p; }

/**
 * sheet: { o(x, y, z): < 0 under the cloth's outer side (about a distance); of: the same from a quicker body, for the grid's samples
 * only (where the body's grid is read far off the body it is blocky: the points are put on o itself); tk: its thickness, a number or
 * (x, y, z) → (the inner side at o = -tk); cut(x, y, z): < 0 where the cloth is; smooth: rounds of averaging the push directions (0) }. lo, hi: a box holding the cloth; h: the middle's cells.
 * Returns { pos, nor, idx } (Float32Array, Float32Array, Uint32Array): the outer side, the inner side and the rim along the cut.
 * one (the lite quality): the outer side alone, to be drawn double-sided, and along the cut a lip of no width for the outline (below).
 */
export function sheetMesh({ o, of = o, tk, cut, smooth = 0 }, lo, hi, h, one = false) {
  const T = typeof tk === "function" ? tk : () => tk, mid = (x, y, z) => o(x, y, z) + T(x, y, z) / 2;
  // the middle and, past the cut, two cells more (cut away below: there it ends in the cells' steps)
  const r = surfaceNets((x, y, z) => Math.max(mid(x, y, z), cut(x, y, z) - 2 * h), lo, hi, h, { proj: 2, fast: (x, y, z) => Math.max(of(x, y, z) + T(x, y, z) / 2, cut(x, y, z) - 2 * h) });
  // (a point the projection left off the middle is not the sheet's: the cut and the middle are no distances everywhere; such points made
  // fins inside the body, and are dropped with their triangles)
  const P0 = r.pos, I0 = r.idx, n0 = P0.length / 3, C = new Float64Array(n0), off = new Uint8Array(n0);
  for (let v = 0; v < n0; v++) { const x = P0[v * 3], y = P0[v * 3 + 1], z = P0[v * 3 + 2]; C[v] = cut(x, y, z); off[v] = Math.abs(mid(x, y, z)) > 0.3 * h ? 1 : 0; }
  const P = [], map = new Int32Array(n0).fill(-1), X = new Map(), at = (v) => [P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]];
  const keep = (v) => { if (map[v] < 0) { map[v] = P.length / 3; P.push(...at(v)); } return map[v]; };
  // where the edge from a (in) to b (out) crosses the cut: halved along it, then onto the middle (the edge is a chord: under a millimetre)
  const onCut = (a, b) => { const key = a * n0 + b; let i = X.get(key); if (i != null) return i;
    const A = at(a), B = at(b); let s0 = 0, s1 = 1;
    for (let k = 0; k < 14; k++) { const s = (s0 + s1) / 2; if (cut(A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s) < 0) s0 = s; else s1 = s; }
    const s = (s0 + s1) / 2, p = onto(mid, [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s], 2, h / 4);
    i = P.length / 3; P.push(...p); X.set(key, i); return i; };
  const I = [];
  for (let t = 0; t < I0.length; t += 3) {
    const v = [I0[t], I0[t + 1], I0[t + 2]], inn = v.map((q) => C[q] < 0), n = inn[0] + inn[1] + inn[2];
    if (off[v[0]] || off[v[1]] || off[v[2]]) continue;
    if (!n) continue;
    if (n === 3) { I.push(keep(v[0]), keep(v[1]), keep(v[2])); continue; }
    const k = n === 1 ? inn.indexOf(true) : inn.indexOf(false), a = v[k], b = v[(k + 1) % 3], c = v[(k + 2) % 3];   // a: the odd one (the order kept)
    if (n === 1) I.push(keep(a), onCut(a, b), onCut(a, c));
    else { const xc = onCut(c, a), xb = onCut(b, a); I.push(keep(b), keep(c), xc, keep(b), xc, xb); }
  }
  const nm = P.length / 3;
  // the edge's points: once in a triangle (as wound there)
  const E = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], key = a < b ? a * nm + b : b * nm + a, e = E.get(key); if (e) e[2]++; else E.set(key, [a, b, 1]); }
  const edges = [...E.values()].filter((e) => e[2] === 1), rimOf = new Map();
  for (const [a, b] of edges) for (const v of [a, b]) if (!rimOf.has(v)) rimOf.set(v, nm * 2 + rimOf.size);
  const nr = rimOf.size, pos = new Float32Array((nm * 2 + nr) * 3), nor = new Float32Array((nm * 2 + nr) * 3);
  const set = (i, p, n) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2]; };
  const inner = (x, y, z) => o(x, y, z) + T(x, y, z);
  // each side found along the middle's normal: an inner point straight behind its outer one (pulled onto each side along its own
  // gradient, where the field is no distance — the cape's cone meeting the body round the neck, 4.5 cm "thick" — they slid apart and
  // the sides' triangles crossed in spikes). On the line from the middle, out (dir 1) to f = 0; none within 4 thicknesses: half one
  const side = (f, p, n, dir, t) => { const at = (u) => f(p[0] + n[0] * u, p[1] + n[1] * u, p[2] + n[2] * u); let a = 0, b = dir * t / 2;
    while (at(b) * dir < 0 && Math.abs(b) < 4 * t) { a = b; b *= 1.5; }
    if (at(b) * dir < 0) return [p[0] + n[0] * dir * t / 2, p[1] + n[1] * dir * t / 2, p[2] + n[2] * dir * t / 2];
    for (let k = 0; k < 12; k++) { const c = (a + b) / 2; if (at(c) * dir < 0) a = c; else b = c; }
    const u = (a + b) / 2; return [p[0] + n[0] * u, p[1] + n[1] * u, p[2] + n[2] * u]; };
  // the directions to the sides: the middle's normals, averaged over their neighbours `smooth` times. Over a hollow (the nape under the hood's
  // bag, 2-3 cm thick) the normals met before the outer side, and its points crossed over in dark wedges. Not for every sheet: along the
  // cape's neckline, where it turns over the shoulders, averaged normals twisted its rim into shards
  let NN = new Float64Array(nm * 3); for (let v = 0; v < nm; v++) NN.set(unit(g4(mid, P[v * 3], P[v * 3 + 1], P[v * 3 + 2])), v * 3);
  if (smooth) { const nb = Array.from({ length: nm }, () => new Set()); for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; nb[a].add(b); nb[b].add(a); }
    for (let it = 0; it < smooth; it++) { const M2 = new Float64Array(nm * 3); for (let v = 0; v < nm; v++) { let x = NN[v * 3], y = NN[v * 3 + 1], z = NN[v * 3 + 2]; for (const u of nb[v]) { x += NN[u * 3]; y += NN[u * 3 + 1]; z += NN[u * 3 + 2]; } M2.set(unit([x, y, z]), v * 3); } NN = M2; } }
  for (let v = 0; v < nm; v++) {
    const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], n0 = [NN[v * 3], NN[v * 3 + 1], NN[v * 3 + 2]], t0 = T(p[0], p[1], p[2]), q = side(o, p, n0, 1, t0);
    set(v, q, unit(g4(o, q[0], q[1], q[2])));
    if (!one) { const w = side(inner, p, n0, -1, t0), g = unit(g4(o, w[0], w[1], w[2])); set(nm + v, w, [-g[0], -g[1], -g[2]]); }
    const ri = rimOf.get(v); if (ri == null) continue;
    // the rim: 2 mm out from the middle, the way the cut grows along the sheet (nearly square: rounded by half the thickness it stood under a
    // skirt's hem as a band of its own, in the petticoat's color, with its own outline under it)
    const n = unit(g4(mid, p[0], p[1], p[2])), gc = g4(cut, p[0], p[1], p[2]), dn = gc[0] * n[0] + gc[1] * n[1] + gc[2] * n[2], d = unit([gc[0] - dn * n[0], gc[1] - dn * n[1], gc[2] - dn * n[2]]), s = Math.min(0.002, T(p[0], p[1], p[2]) / 2);
    if (one) set(ri - nm, q, d); else set(ri, [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s], d);
  }
  // one side: each edge point once more where it is, its normal out along the sheet (d). The cloth's own triangles there have no area; the
  // outline's (pushed out along the normals) open into a facet under the edge, wound to be its back: without it a hem has no line
  if (one) { const L = [...I], at = (i, k) => pos[i * 3 + k] + nor[i * 3 + k];
    for (const [a, b] of edges) { const la = rimOf.get(a) - nm, lb = rimOf.get(b) - nm, u = [0, 1, 2].map((k) => at(b, k) - at(a, k)), w = [0, 1, 2].map((k) => at(lb, k) - at(a, k));
      const f = (u[1] * w[2] - u[2] * w[1]) * (nor[a * 3] + nor[la * 3]) + (u[2] * w[0] - u[0] * w[2]) * (nor[a * 3 + 1] + nor[la * 3 + 1]) + (u[0] * w[1] - u[1] * w[0]) * (nor[a * 3 + 2] + nor[la * 3 + 2]);
      if (f < 0) L.push(a, b, lb, a, lb, la); else L.push(a, lb, b, a, la, lb); }
    return { pos: pos.slice(0, (nm + nr) * 3), nor: nor.slice(0, (nm + nr) * 3), idx: Uint32Array.from(L) }; }
  const idx = [];
  for (let t = 0; t < I.length; t += 3) idx.push(I[t], I[t + 1], I[t + 2], nm + I[t], nm + I[t + 2], nm + I[t + 1]);
  const face = (a, b, c, n) => { const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], wx = pos[c * 3] - pos[a * 3], wy = pos[c * 3 + 1] - pos[a * 3 + 1], wz = pos[c * 3 + 2] - pos[a * 3 + 2];
    return (uy * wz - uz * wy) * nor[n * 3] + (uz * wx - ux * wz) * nor[n * 3 + 1] + (ux * wy - uy * wx) * nor[n * 3 + 2]; };
  for (const [a, b] of edges) { const ra = rimOf.get(a), rb = rimOf.get(b), q = [[a, b, rb, ra], [ra, rb, nm + b, nm + a]];
    const flip = face(a, b, rb, ra) < 0;
    for (const [w, x, y, z] of q) if (flip) idx.push(w, y, x, w, z, y); else idx.push(w, x, y, w, y, z); }
  return { pos, nor, idx: new Uint32Array(idx) };
}

/** Several meshes ({ pos, nor, idx }, arrays or typed) as one. */
export function joinMeshes(list) {
  const nv = list.reduce((s, m) => s + m.pos.length / 3, 0), ni = list.reduce((s, m) => s + m.idx.length, 0), pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let v = 0, i = 0; for (const m of list) { pos.set(m.pos, v * 3); nor.set(m.nor, v * 3); for (let k = 0; k < m.idx.length; k++) idx[i + k] = m.idx[k] + v; v += m.pos.length / 3; i += m.idx.length; }
  return { pos, nor, idx };
}
/** Sheets ({ o, tk, cut, lo?, hi?, h?: their cells at most }) made and joined: each in its own box or lo..hi, grown by its cells' margin
 *  (the cut's two cells and one more). */
export function sheetsMesh(sheets, lo, hi, h, one = false) {
  return joinMeshes(sheets.map((s) => { const c = Math.min(h, s.h ?? h), g = 3 * c; return sheetMesh(s, (s.lo ?? lo).map((v) => v - g), (s.hi ?? hi).map((v) => v + g), c, one); }));
}
