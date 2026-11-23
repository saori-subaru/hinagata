// A baked character's body and close clothes as one skin (avatar.bake({ skin })): their shapes joined into one, meshed once and thinned
// as one, then cut back into each part's patch (the same points along the cuts). No layers to come through each other, no part's edge
// to keep, so it thins far past what the parts do one by one. The helpers that know nothing of the character; the rest is in index.js.

/** the grid's samples the air outside reaches (from the box's sides through the samples outside the shape): 1 there. A gap closed in
 *  between two layers is not reached */
export function outsideAir({ V, nx, ny, nz }) {
  const A = new Uint8Array(V.length), st = [], sx = nx * ny, push = (c) => { if (!A[c] && V[c] > 0) { A[c] = 1; st.push(c); } };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!i || !j || !k || i === nx - 1 || j === ny - 1 || k === nz - 1) push(i + nx * (j + ny * k));
  while (st.length) { const c = st.pop(), i = c % nx, j = ((c / nx) | 0) % ny, k = (c / sx) | 0;
    if (i) push(c - 1); if (i < nx - 1) push(c + 1); if (j) push(c - nx); if (j < ny - 1) push(c + nx); if (k) push(c - sx); if (k < nz - 1) push(c + sx); }
  return A;
}

/** per vertex of a mesh made on that grid (extractVerts' cell): 1 where its cell touches the air outside */
export function outerVerts(cell, air, nx, ny, nz, count) {
  const out = new Uint8Array(count), cx = nx - 1, cy = ny - 1;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) { const v = cell[i + cx * (j + cy * k)]; if (v < 0) continue;
    for (let c = 0; c < 8 && !out[v]; c++) if (air[i + (c & 1) + nx * (j + ((c >> 1) & 1) + ny * (k + (c >> 2)))]) out[v] = 1; }
  return out;
}

/** the record with only these triangles (corner indices, three per triangle) and the vertices they use */
export function subRecord(rec, tris) {
  const n0 = rec.pos.length / 3, map = new Int32Array(n0).fill(-1); let n = 0; for (const v of tris) if (map[v] < 0) map[v] = n++;
  const pick = (a, w) => { if (!a) return a; const o = new a.constructor(n * w); for (let v = 0; v < n0; v++) if (map[v] >= 0) for (let q = 0; q < w; q++) o[map[v] * w + q] = a[v * w + q]; return o; };
  return { ...rec, pos: pick(rec.pos, 3), nor: pick(rec.nor, 3), si: pick(rec.si, 4), sw: pick(rec.sw, 4), idx: Uint32Array.from(tris, (v) => map[v]) };
}

/** two records as one */
export function joinRecords(a, b) {
  const cat = (x, y) => { const o = new x.constructor(x.length + y.length); o.set(x); o.set(y, x.length); return o; }, n = a.pos.length / 3;
  return { ...a, pos: cat(a.pos, b.pos), nor: cat(a.nor, b.nor), si: cat(a.si, b.si), sw: cat(a.sw, b.sw), idx: cat(a.idx, Uint32Array.from(b.idx, (v) => v + n)) };
}

// A one-sided sheet's edge has each point twice, the second with its normal out, and between them facets of no area (the outline's rim:
// sdf/sheet.js). To thin the edge too, the facets are taken off, the sheet thinned, and facets made again along the edge that is left.
/** src: the sheet's triangles, flat: the facets' → { twin: per vertex its second (-1: none), rev: the facets run against the sheet's
 *  triangles along the edge, bare: edge points with no second }, or null when the facets are not of that kind */
export function edgeTwins(pos, src, flat) {
  const n = pos.length / 3, used = new Uint8Array(n), twin = new Int32Array(n).fill(-1); for (const v of src) used[v] = 1;
  const same = (a, b) => pos[a * 3] === pos[b * 3] && pos[a * 3 + 1] === pos[b * 3 + 1] && pos[a * 3 + 2] === pos[b * 3 + 2];
  const dir = new Set(); for (let t = 0; t < src.length; t += 3) for (let k = 0; k < 3; k++) dir.add(src[t + k] * n + src[t + (k + 1) % 3]);
  let along = 0, against = 0;
  for (let t = 0; t < flat.length; t += 3) for (let k = 0; k < 3; k++) { const a = flat[t + k], b = flat[t + (k + 1) % 3];
    if (same(a, b)) { if (used[a] && !used[b]) twin[a] = b; else if (used[b] && !used[a]) twin[b] = a; else if (used[a] && used[b]) return null; }
    else if (used[a] && used[b]) { if (dir.has(a * n + b)) along++; else if (dir.has(b * n + a)) against++; } }
  if (!along && !against) return null;
  const bare = []; for (const [a, b] of openEdges(src, n)) { if (twin[a] < 0) bare.push(a); if (twin[b] < 0) bare.push(b); }
  return { twin, rev: against >= along, bare };
}
/** the edges only one triangle has, as that triangle runs them: [a, b] */
function openEdges(idx, n) {
  const c = new Map(); for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3], key = a < b ? a * n + b : b * n + a, e = c.get(key); if (e) e[2]++; else c.set(key, [a, b, 1]); }
  return [...c.values()].filter((e) => e[2] === 1);
}
/** the facets along the thinned sheet's edge (corner indices) */
export function edgeFacets(idx, pos, { twin, rev }) {
  const out = []; for (const [a, b] of openEdges(idx, pos.length / 3)) { const A = twin[a], B = twin[b]; if (A < 0 || B < 0) continue;
    if (rev) out.push(b, a, A, b, A, B); else out.push(a, b, B, a, B, A); }
  return out;
}
