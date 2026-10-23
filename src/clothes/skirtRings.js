// The skirt as rings (settings.skirt "rings"): columns round the skirt's axis on its pleats' crests and troughs, rows from the top to
// the hem; along each, a ray from the axis enters the cloth (its inner side) and leaves it (its outer side). The top and the hem close the
// shell with a band each. A meshed grid spends ten times the triangles on the same pleats. Returns { pos, nor, idx } (base proportions).
import { projectVerts } from "../sdf/mesh.js";

export function buildSkirtRings(sdf, { pleats, y0, tilt, zc, ax, az, flare, hemAt, hemPoints = 0 }, { per = 2, rows = 6 } = {}) {
  // the columns: on the pleats' crests and troughs (the pleats go round the ellipse's own angle); with a zigzag or scalloped hem, on
  // its points and notches instead (they go round the true angle) and six to a point at least: on the pleats there, the scallops came out pointed
  const HP = Math.round(hemPoints), NP = HP ? HP * 2 * Math.max(3, Math.round(Math.max(8, pleats) * per / HP / 2)) : Math.max(8, Math.round(pleats)) * per;
  // along a ray: where it enters the shell and where it leaves it (from r0 on; null where it never enters)
  const through = (o, d, r0) => {
    const at = (t) => sdf(o[0] + d[0] * t, o[1], o[2] + d[2] * t), cross = (a, b, inside) => { for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if ((at(m) < 0) === inside) b = m; else a = m; } return (a + b) / 2; };
    let t = r0, prev = t;
    for (; t < r0 + 0.25; t += 0.001) { if (at(t) < 0) break; prev = t; }
    if (t >= r0 + 0.25) return null;
    const tin = cross(prev, t, true); prev = t;
    for (; t < tin + 0.1; t += 0.0005) { if (at(t) >= 0) break; prev = t; }
    return [tin, cross(prev, t, false)];
  };
  const O = [], I = [];
  for (let k = 0; k < NP; k++) {
    const th = k / NP * Math.PI * 2, s = Math.sin(th), c = Math.cos(th), col = [[], []];   // (the ellipse's angle, or with hemPoints the true one)
    const yTop = y0 - tilt * (zc + az * c) - 0.004, yHem = (HP ? hemAt(s, c) : hemAt(ax * s, az * c)) + 0.004;
    for (let i = 0; i <= rows; i++) {
      const y = yTop + (yHem - yTop) * i / rows, drop = Math.max(0, y0 - y), a = ax + flare * drop, b = az + flare * 0.8 * drop;
      const dl = HP ? 1 / Math.hypot(s / a, c / b) : Math.hypot(a * s, b * c), d = HP ? [s, 0, c] : [a * s / dl, 0, b * c / dl], r = Math.max(0, dl - 0.08), o = [0, y, zc];
      const h = through(o, d, r) ?? through(o, d, 0) ?? [dl, dl + 0.01];
      col[0].push([o[0] + d[0] * h[1], y, o[2] + d[2] * h[1]]); col[1].push([o[0] + d[0] * h[0], y, o[2] + d[2] * h[0]]);
    }
    O.push(col[0]); I.push(col[1]);
  }
  const pos = [], vi = (p) => (pos.push(...p), pos.length / 3 - 1), Oi = O.map((col) => col.map(vi)), Ii = I.map((col) => col.map(vi));
  const F = [], q = (a, b, c, d) => F.push([a, b, c, d]);
  for (let k = 0; k < NP; k++) { const n = (k + 1) % NP;
    for (let i = 0; i < rows; i++) { q(Oi[k][i], Oi[n][i], Oi[n][i + 1], Oi[k][i + 1]); q(Ii[k][i + 1], Ii[n][i + 1], Ii[n][i], Ii[k][i]); }
    q(Ii[k][0], Ii[n][0], Oi[n][0], Oi[k][0]); q(Oi[k][rows], Oi[n][rows], Ii[n][rows], Ii[k][rows]); }
  // outward: the first outer quad's normal against the way out from the axis; the others were laid out to agree with it
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = (f) => { const u = sub(P(f[2]), P(f[0])), v = sub(P(f[3]), P(f[1])); return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
  const f0 = F[0], n0 = nrm(f0), out0 = sub(P(f0[0]), [0, P(f0[0])[1], zc]), flip = n0[0] * out0[0] + n0[2] * out0[2] < 0;
  const idx = []; for (const [a, b, c, d] of F) flip ? idx.push(a, c, b, a, d, c) : idx.push(a, b, c, a, c, d);
  const P32 = Float64Array.from(pos), nor = new Float64Array(pos.length); projectVerts(sdf, P32, nor, 2);
  return { pos: Float32Array.from(P32), nor: Float32Array.from(nor), idx: Uint32Array.from(idx) };
}
