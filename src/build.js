// Build one part's mesh with the workers' help: the grid is sampled slab by slab, and the vertices are projected and
// weighted slice by slice, all at once on the workers. The cheap steps in between (fixing ambiguous faces, finding the
// vertices, making the quads) run here. Same steps in the same order as surfaceNets → the same mesh.
import { gridDims, fixAmbiguous, extractVerts, quads } from "./sdf/mesh.js";
import { runPart, buildPool } from "./pool.js";

const ranges = (n, parts) => { const out = [], k = Math.max(1, Math.min(parts, n)); for (let i = 0; i < k; i++) { const a = Math.floor(n * i / k), b = Math.floor(n * (i + 1) / k); if (b > a) out.push([a, b]); } return out; };

/**
 * job: { key, opt, debug, H } (what the workers need to rebuild the shapes) / spec: this part's entry from parts.js (main thread's copy)
 * grid: the body's grid for the clothes (or null) / split: how many pieces (1 for small parts)
 * Resolves { rec: { pos, nor, idx, si, sw }, grid, ms } or rejects (then the caller builds it itself).
 */
export async function buildPartInWorkers(part, job, spec, grid = null, split = null) {
  const T0 = performance.now(), ws = buildPool(); if (!ws) throw new Error("no workers");
  split ??= ws.length;
  const { lo, hi, h } = spec, [nx, ny, nz] = gridDims(lo, hi, h), base = { ...job, part, grid };
  // 1) sample the grid, slab by slab
  const slabs = ranges(nz, split), Vs = await Promise.all(slabs.map(([k0, k1]) => runPart({ ...base, type: "sample", k0, k1 })));
  const V = new Float32Array(nx * ny * nz); slabs.forEach(([k0], n) => V.set(Vs[n].V, nx * ny * k0));
  // 2) here: ambiguous faces and the vertices (cheap)
  fixAmbiguous(V, spec.sdf, lo, h, nx, ny, nz);
  const { cell, pos } = extractVerts(V, lo, h, nx, ny, nz), nv = pos.length / 3;
  // 3) project and weight the vertices, slice by slice
  const P64 = Float64Array.from(pos), cuts = ranges(nv, split);
  const outs = await Promise.all(cuts.map(([v0, v1]) => { const p = P64.slice(v0 * 3, v1 * 3); return runPart({ ...base, grid: grid, type: "project", pos: p }, [p.buffer]); }));
  const P = new Array(nv * 3), nor = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  cuts.forEach(([v0], n) => { const o = outs[n]; for (let i = 0; i < o.pos.length; i++) P[v0 * 3 + i] = o.pos[i]; nor.set(o.nor, v0 * 3); si.set(o.si, v0 * 4); sw.set(o.sw, v0 * 4); });
  // 4) here: the quads
  const idx = quads(V, cell, P, nor, nx, ny, nz);
  return { rec: { pos: new Float32Array(P), nor, idx: new Uint32Array(idx), si, sw }, grid: { V, lo, h, nx, ny, nz }, ms: Math.round(performance.now() - T0) };
}
