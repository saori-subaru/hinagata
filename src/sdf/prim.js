// Signed-distance building blocks: primitives, smooth blending, carving.
// Units: the character is 1.4 tall, front is +z, the character's left hand is +x.
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export function E(c, r, bone, k = 0.045, rot = 0) {   // rot: z軸の角度、または体の向きの軸3本 [[x軸],[y軸],[z軸]]
  const M = Array.isArray(rot) ? rot.flat() : null, a = M ? 0 : rot;
  return { t: 0, cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2], cr: Math.cos(a), sr: Math.sin(a), M, bone, k, bx0: c[0], by0: c[1], bz0: c[2], br: Math.max(...r) };
}
// 回転(x→y→zの順に回した軸3本)
export function axes(ax, ay = 0, az = 0) {
  const rx = (v) => [v[0], v[1] * Math.cos(ax) - v[2] * Math.sin(ax), v[1] * Math.sin(ax) + v[2] * Math.cos(ax)];
  const ry = (v) => [v[0] * Math.cos(ay) + v[2] * Math.sin(ay), v[1], -v[0] * Math.sin(ay) + v[2] * Math.cos(ay)];
  const rz = (v) => [v[0] * Math.cos(az) - v[1] * Math.sin(az), v[0] * Math.sin(az) + v[1] * Math.cos(az), v[2]];
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => rz(ry(rx(v))));
}
export const cut = (p) => Object.assign(p, { sub: true });   // 削る部品
export function G(list, k) {   // まとめて溶かした部品を、ひとかたまりとして扱う
  const a = list.filter((p) => !p.sub), cx = a.reduce((s, p) => s + p.bx0, 0) / a.length, cy = a.reduce((s, p) => s + p.by0, 0) / a.length, cz = a.reduce((s, p) => s + p.bz0, 0) / a.length;
  return { t: 2, f: blend(list), list, k, bx0: cx, by0: cy, bz0: cz, br: Math.max(...a.map((p) => Math.hypot(p.bx0 - cx, p.by0 - cy, p.bz0 - cz) + p.br)) };
}
export function C(a, b, ra, rb, bone, k = 0.045, sx = 1) { const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L = Math.hypot(bx, by, bz); return { t: 1, ax: a[0], ay: a[1], az: a[2], bx, by, bz, il: 1 / (L * L), ra, rb, sx, bone, k, bx0: a[0] + bx / 2, by0: a[1] + by / 2, bz0: a[2] + bz / 2, br: L / 2 + Math.max(ra, rb) }; }
export function dPrim(p, x, y, z) {
  if (p.t === 2) return p.f(x, y, z);
  if (p.t === 3) return p.f(x, y, z);   // 平面・曲面で削る用
  if (p.t === 0) {   // 楕円体(近似。z軸まわりに回せる)
    let dx = x - p.cx, dy = y - p.cy, dz = z - p.cz; if (p.M) { const M = p.M, u = M[0] * dx + M[1] * dy + M[2] * dz, v = M[3] * dx + M[4] * dy + M[5] * dz; dz = M[6] * dx + M[7] * dy + M[8] * dz; dx = u; dy = v; } else if (p.sr) { const u = dx * p.cr + dy * p.sr, v = -dx * p.sr + dy * p.cr; dx = u; dy = v; }
    const qx = dx / p.rx, qy = dy / p.ry, qz = dz / p.rz, k0 = Math.sqrt(qx * qx + qy * qy + qz * qz), k1 = Math.sqrt((qx / p.rx) ** 2 + (qy / p.ry) ** 2 + (qz / p.rz) ** 2);
    return k1 < 1e-9 ? -Math.min(p.rx, p.ry, p.rz) : k0 * (k0 - 1) / k1;
  }
  if (p.t === 4) {   // 毛束: 頭に沿って平たいカプセル
    const qx = x - p.ax, qy = y - p.ay, qz = z - p.az, h = Math.min(1, Math.max(0, (qx * p.bx + qy * p.by + qz * p.bz) * p.il));
    const vx = qx - p.bx * h, vy = qy - p.by * h, vz = qz - p.bz * h, vn = vx * p.n[0] + vy * p.n[1] + vz * p.n[2];
    return Math.sqrt(vx * vx + vy * vy + vz * vz - vn * vn + (vn / p.flat) ** 2) - (p.ra + (p.rb - p.ra) * h);
  }
  const px = (x - p.ax) * p.sx, py = y - p.ay, pz = z - p.az;   // 太さの変わるカプセル(sx<1で横に太る)
  const h = Math.min(1, Math.max(0, (px * p.bx + py * p.by + pz * p.bz) * p.il));
  const dx = px - p.bx * h, dy = py - p.by * h, dz = pz - p.bz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * h);
}
// 溶け合わせ。遠い部品は計算を飛ばす(結果は変わらない)
export function blend(list) {
  return (x, y, z) => {
    let d = 1e9;
    for (const p of list) {
      const dx = x - p.bx0, dy = y - p.by0, dz = z - p.bz0, far = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br;
      if (p.sub) { if (far >= p.k - d) continue; const di = dPrim(p, x, y, z); d = -smin(-d, di, p.k); continue; }   // 削る(なめらかに)
      if (far >= d + p.k) continue; const di = dPrim(p, x, y, z); d = d > 1e8 ? di : smin(d, di, p.k);
    }
    return d;
  };
}


// 速い溶け合わせ: 箱を小さなマスに分け、マスごとに「そこで効きうる部品」だけを先に選んでおく(結果はほぼ同じで、ずっと速い)
//   効きうる = マスの中心で測った距離から、マスの大きさぶんの余裕を見ても、部品の外接球が届く範囲にあるもの。並び順はそのまま
export function blendFast(list, lo, hi, C = 0.04) {
  const slow = blend(list), nx = Math.ceil((hi[0] - lo[0]) / C), ny = Math.ceil((hi[1] - lo[1]) / C), nz = Math.ceil((hi[2] - lo[2]) / C);
  let cells = null;
  const build = () => { cells = new Array(nx * ny * nz); const r = C * 0.866, M = 2.5 * r + 0.01;   // M: 距離の見積もりの余裕
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = lo[0] + (i + 0.5) * C, y = lo[1] + (j + 0.5) * C, z = lo[2] + (k + 0.5) * C, d = slow(x, y, z);
      cells[i + nx * (j + ny * k)] = list.filter((p) => { const far = Math.hypot(x - p.bx0, y - p.by0, z - p.bz0) - p.br - r; return p.sub ? far < p.k - d + M : far < d + p.k + M; });
    } };
  return (x, y, z) => {
    const i = Math.floor((x - lo[0]) / C), j = Math.floor((y - lo[1]) / C), k = Math.floor((z - lo[2]) / C);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return slow(x, y, z);
    if (!cells) build();
    const L = cells[i + nx * (j + ny * k)]; let d = 1e9;
    for (let n = 0; n < L.length; n++) { const p = L[n], dx = x - p.bx0, dy = y - p.by0, dz = z - p.bz0, far = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br;
      if (p.sub) { if (far >= p.k - d) continue; const di = dPrim(p, x, y, z); d = -smin(-d, di, p.k); continue; }
      if (far >= d + p.k) continue; const di = dPrim(p, x, y, z); d = d > 1e8 ? di : smin(d, di, p.k); }
    return d > 1e8 ? slow(x, y, z) : d;
  };
}
export const plane = (f, k) => cut({ t: 3, f, k, bx0: 0, by0: 0, bz0: 0, br: 1e9 });
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
