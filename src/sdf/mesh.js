// Signed distance → triangle mesh (surface nets). Pure math, no three.js, so it can run in a worker.

// Normalized gradient by central differences.
export function grad(sdf, x, y, z, e = 0.0012) { const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e); const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l]; }
// Gradient and value from 4 samples (tetrahedron). Returns [nx, ny, nz, distance].
export function grad4(sdf, x, y, z, e = 0.0012) { const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d = sdf(x + e, y + e, z + e);
  const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d, l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l, (a + b + c + d) / 4]; }

/**
 * Mesh the zero surface of `sdf` inside the box lo..hi with cell size h.
 * opts.fast: a cheaper sdf used only for grid sampling (defaults to sdf)
 * opts.band: grid cells farther than band*h from the surface (on the coarse grid) are not sampled finely
 * opts.proj: how many times vertices are pulled onto the surface (1 or 2)
 * Returns { pos, nor, idx, grid, time } — pos/idx are plain arrays, nor a Float32Array, grid the sampled distances.
 */
export function surfaceNets(sdf, lo, hi, h, { fast = sdf, band = 6, proj = 1 } = {}) {
  const T0 = performance.now(), time = {};
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const V = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  // coarse grid first (every 4 cells); far from the surface the coarse value is enough
  const S = 4, mx = Math.ceil((nx - 1) / S) + 1, my = Math.ceil((ny - 1) / S) + 1, mz = Math.ceil((nz - 1) / S) + 1, Cg = new Float32Array(mx * my * mz);
  for (let k = 0; k < mz; k++) for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) Cg[i + mx * (j + my * k)] = fast(lo[0] + i * S * h, lo[1] + j * S * h, lo[2] + k * S * h);
  // then a medium grid (every 2 cells) near the surface, and the fine grid only where the medium grid is close
  const qx = Math.ceil((nx - 1) / 2) + 1, qy = Math.ceil((ny - 1) / 2) + 1, Mg = new Float32Array(qx * qy * (Math.ceil((nz - 1) / 2) + 1)).fill(NaN);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const dc = Cg[Math.round(i / S) + mx * (Math.round(j / S) + my * Math.round(k / S))];
    if (Math.abs(dc) > band * h) { V[id(i, j, k)] = dc; continue; }
    const mi = Math.round(i / 2), mj = Math.round(j / 2), mk = Math.round(k / 2), m = mi + qx * (mj + qy * mk);
    let dm = Mg[m]; if (dm !== dm) dm = Mg[m] = fast(lo[0] + mi * 2 * h, lo[1] + mj * 2 * h, lo[2] + mk * 2 * h);
    V[id(i, j, k)] = Math.abs(dm) > 3.5 * h ? dm : fast(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  }
  // ambiguous faces: a grid face whose corners alternate inside / outside (a surface that just grazes a grid plane, e.g. the top of a
  // limb running diagonally) makes folded triangles. Ask the field at the face center which way it connects, and flip the shallow
  // corners that disagree (they move by less than a quarter cell, and the projection below puts the vertices back on the surface)
  const eps = 0.25 * h, tiny = 1e-6 * h;
  for (let pass = 0; pass < 2; pass++) {
    let flips = 0;
    for (const [ax, bx] of [[[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]]]) {
      const da = ax[0] + nx * (ax[1] + ny * ax[2]), db = bx[0] + nx * (bx[1] + ny * bx[2]);
      for (let k = 0; k < nz - ax[2] - bx[2]; k++) for (let j = 0; j < ny - ax[1] - bx[1]; j++) for (let i = 0; i < nx - ax[0] - bx[0]; i++) {
        const o = id(i, j, k), a = V[o], b = V[o + da], c = V[o + db], d = V[o + da + db];
        if ((a < 0) !== (d < 0) || (b < 0) !== (c < 0) || (a < 0) === (b < 0)) continue;   // not a checkerboard
        const m = sdf(lo[0] + (i + (ax[0] + bx[0]) / 2) * h, lo[1] + (j + (ax[1] + bx[1]) / 2) * h, lo[2] + (k + (ax[2] + bx[2]) / 2) * h);
        // the pair on the other side from the center is cut off from each other; flip its shallow corners to the center's side
        for (const q of a < 0 === m < 0 ? [o + da, o + db] : [o, o + da + db]) if (Math.abs(V[q]) < eps) { V[q] = m < 0 ? -tiny : tiny; flips++; }
      }
    }
    if (!flips) break;
  }
  const grid = { V, lo, h, nx, ny, nz };
  time.sample = performance.now() - T0;
  // one vertex per cell that the surface crosses: the average of the edge crossings
  const cx = nx - 1, cy = ny - 1, cell = new Int32Array(cx * cy * (nz - 1)).fill(-1), cid = (i, j, k) => i + cx * (j + cy * k);
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const ED = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const pos = [], v8 = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0; for (let c = 0; c < 8; c++) { v8[c] = V[id(i + CO[c][0], j + CO[c][1], k + CO[c][2])]; if (v8[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of ED) { const va = v8[a], vb = v8[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb); sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t; sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t; sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t; n++; }
    cell[cid(i, j, k)] = pos.length / 3; pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  // pull vertices onto the surface; the last gradient is the normal
  const nor = new Float32Array(pos.length);
  for (let v = 0; v < pos.length; v += 3) {
    let g = proj > 1 ? grad4(sdf, pos[v], pos[v + 1], pos[v + 2]) : null; if (g) { pos[v] -= g[0] * g[3]; pos[v + 1] -= g[1] * g[3]; pos[v + 2] -= g[2] * g[3]; }
    g = grad4(sdf, pos[v], pos[v + 1], pos[v + 2]); pos[v] -= g[0] * g[3]; pos[v + 1] -= g[1] * g[3]; pos[v + 2] -= g[2] * g[3]; nor[v] = g[0]; nor[v + 1] = g[1]; nor[v + 2] = g[2];
  }
  time.project = performance.now() - T0 - time.sample;
  // one quad per grid edge the surface crosses, wound to face along the normals
  const idx = [];
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az, wx = pos[c * 3] - ax, wy = pos[c * 3 + 1] - ay, wz = pos[c * 3 + 2] - az;
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    if (fx * (nor[a * 3] + nor[c * 3]) + fy * (nor[a * 3 + 1] + nor[c * 3 + 1]) + fz * (nor[a * 3 + 2] + nor[c * 3 + 2]) >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[id(i, j, k)] < 0;
    if (v0 !== (V[id(i + 1, j, k)] < 0)) quad(cell[cid(i, j - 1, k - 1)], cell[cid(i, j, k - 1)], cell[cid(i, j, k)], cell[cid(i, j - 1, k)]);
    if (v0 !== (V[id(i, j + 1, k)] < 0)) quad(cell[cid(i - 1, j, k - 1)], cell[cid(i, j, k - 1)], cell[cid(i, j, k)], cell[cid(i - 1, j, k)]);
    if (v0 !== (V[id(i, j, k + 1)] < 0)) quad(cell[cid(i - 1, j - 1, k)], cell[cid(i, j - 1, k)], cell[cid(i, j, k)], cell[cid(i - 1, j, k)]);
  }
  return { pos, nor, idx, grid, time };
}

/**
 * Read distances back from a sampled grid (trilinear) instead of recomputing them.
 * Only used where all 8 surrounding samples are fine samples near the surface; elsewhere falls back to `fallback`.
 */
export function gridSampler(G, fallback) {
  return (x, y, z) => {
    const fx = (x - G.lo[0]) / G.h, fy = (y - G.lo[1]) / G.h, fz = (z - G.lo[2]) / G.h, i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    if (i >= 0 && j >= 0 && k >= 0 && i < G.nx - 1 && j < G.ny - 1 && k < G.nz - 1) {
      const V = G.V, nx = G.nx, nxy = G.nx * G.ny, o = i + nx * j + nxy * k, tx = fx - i, ty = fy - j, tz = fz - k, lim = 4 * G.h;
      const a = V[o], b = V[o + 1], c = V[o + nx], d = V[o + nx + 1], e = V[o + nxy], f = V[o + nxy + 1], g = V[o + nxy + nx], hh = V[o + nxy + nx + 1];
      if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), Math.abs(e), Math.abs(f), Math.abs(g), Math.abs(hh)) < lim) {
        const ab = a + (b - a) * tx, cd = c + (d - c) * tx, ef = e + (f - e) * tx, gh = g + (hh - g) * tx, l0 = ab + (cd - ab) * ty, l1 = ef + (gh - ef) * ty; return l0 + (l1 - l0) * tz;
      }
    }
    return fallback(x, y, z);
  };
}
