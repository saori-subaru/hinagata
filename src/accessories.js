// Accessories (options.accessories, 2026-10-05, Saori: Nahida's leaf hair ornament and golden anklets): small pieces stuck on the character,
// each riding on one bone. Not shapes in the body's distance field: plain little meshes (fast to add and move in an editor).
// An item: { kind, bone, at: [x, y, z], n: [x, y, z], spin (degrees), size (m), color, mirror, lift (m), outline (m), metal }
//   at: where it sits: for the head bone in head space (it follows the head's size and shape), for any other bone the offset from the
//       bone's joint (rest pose). n: the way it faces (the surface's normal there, rest pose). spin: turned around n. mirror: also on the
//       other side (x mirrored, .L and .R bones swapped).
// Kinds: leaf (a pointed leaf with a midrib), gem (a cut stone), flower (five petals), star, star4 (four points, cut in facets), ball, ribbon (a bow with tails), button, anchor, cross (an X),
// tassel, tab and strap (hanging down from where they are put; a strap: a narrow belt end, 1 long), buckle (a frame), pinBuckle (a thin frame with a prong), cord (a rod across, 1 long: one button to the other), band (a ring around the limb at that
// point: a bracelet, an anklet, a choker; its radius reaches the surface where it was put, size is how thick the ring is).
import * as THREE from "three";

export const ACCESSORY_KINDS = ["leaf", "gem", "flower", "star", "star4", "ball", "ribbon", "band", "button", "anchor", "cross", "tassel", "buckle", "pinBuckle", "tab", "strap", "cord"];

// the shapes, 1 unit across, facing +z (the surface's normal), their "up" +y
function flat(shape, depth, bevel = 0.04) {   // a flat shape with rounded edges, its back on z = 0 (bevel: how far its edges round out past the shape)
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, depth * 0.6); return g;
}
function merge(list) {   // geometries (position + normal, indexed or not) → one
  const P = [], N = [], I = []; let o = 0;
  for (const g of list) { const pa = g.attributes.position.array, na = g.attributes.normal.array, n = pa.length / 3;
    P.push(...pa); N.push(...na); if (g.index) for (const i of g.index.array) I.push(i + o); else for (let i = 0; i < n; i++) I.push(i + o); o += n; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); return g;
}
const SHAPES = {
  leaf: () => { const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.32, -0.3, 0.3, 0.2, 0, 0.5); s.bezierCurveTo(-0.3, 0.2, -0.32, -0.3, 0, -0.5);
    const g = flat(s, 0.05), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, P.getZ(i) + 0.18 * x * x * 4 * 0.5 - 0.05 * Math.abs(x) * 2 + 0.06 * (1 - y * y * 4)); }   // cupped a little along the midrib, which stands up
    g.computeVertexNormals();
    const rib = new THREE.CylinderGeometry(0.018, 0.03, 0.95, 6); rib.translate(0, -0.02, 0.13);
    const stem = new THREE.CylinderGeometry(0.02, 0.025, 0.16, 6); stem.translate(0, -0.56, 0.06);
    return merge([g, rib, stem]); },
  gem: () => { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.8, 1, 0.45); g.translate(0, 0, 0.12); g.computeVertexNormals(); return g; },
  flower: () => { const parts = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.SphereGeometry(0.2, 10, 8); p.scale(0.85, 1.25, 0.35); p.translate(0, 0.25, 0.08); p.rotateZ(a); parts.push(p); }
    const c = new THREE.SphereGeometry(0.13, 10, 8); c.scale(1, 1, 0.7); c.translate(0, 0, 0.14); parts.push(c); return merge(parts); },
  star: () => { const s = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 0.21 : 0.5; s[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
    const g = flat(s, 0.08); g.computeVertexNormals(); return g; },
  // a four-pointed star cut in facets (for アステル's clasp), as on his sheet: about as wide as tall, the lower point longer, fat points with
  // straight sides into round valleys (sharp valleys read hard; sides curved all along, a sparkle). A ridge from the raised middle to each
  // point; each facet keeps one normal (flat). Painted as drawn (userData.bands, index.js makeAccessories): the facets facing away from the
  // upper right darker (the scene's sun lit every facet alike), a thin light line along each ridge (a metal glint lit a whole facet white).
  // bandT: how far from its facet's ridge (units), + 2 on a dark facet. The back's rim normals lean out: seen face-on the outline had nothing to push out
  star4: () => { const T = [[0, 0.45], [0.5, 0], [0, -0.55], [-0.5, 0]], V = 0.17, RV = 0.3, R = 0.045, TOP = 0.21, K = 8, W = 0.006, P = [], N = [], B = [];
    const put = (p, n, b) => { P.push(...p); N.push(...n); B.push(b); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
    for (let i = 0; i < 4; i++) { const a = T[i], b = T[(i + 1) % 4], v = [Math.sign(a[0] + b[0]) * V, Math.sign(a[1] + b[1]) * V];
      // the side from point a to point b (clockwise): straight to RV of the way from the valley's corner, round through it (a quadratic), straight on
      const f1 = [0, 1].map((m) => v[m] + (a[m] - v[m]) * RV), f2 = [0, 1].map((m) => v[m] + (b[m] - v[m]) * RV), lerp = (p, q, t) => [0, 1].map((m) => p[m] + (q[m] - p[m]) * t);
      const at = (t) => t < 0.25 ? lerp(a, f1, t * 4) : t > 0.75 ? lerp(f2, b, t * 4 - 3) : ((s) => [0, 1].map((m) => (1 - s) ** 2 * f1[m] + 2 * (1 - s) * s * v[m] + s * s * f2[m]))(t * 2 - 0.5);
      const dir = (t) => t < 0.25 ? [f1[0] - a[0], f1[1] - a[1]] : t > 0.75 ? [b[0] - f2[0], b[1] - f2[1]] : ((s) => [0, 1].map((m) => (1 - s) * (v[m] - f1[m]) + s * (f2[m] - v[m])))(t * 2 - 0.5);
      const out = (s) => s === 0 ? unit(a) : s === 2 * K ? unit(b) : ((d) => unit([-d[1], d[0]]))(dir(s / (2 * K)));   // outward: the side's direction turned left (at a point straight out, so the outline closes there)
      const C = Array.from({ length: 2 * K + 1 }, (_, s) => at(s / (2 * K))), mid = C[K];
      for (const [tip, s0] of [[a, 0], [b, K]]) {   // point a's facet (to the valley's middle), then point b's
        const n = unit(cross([tip[0], tip[1], R - TOP], [mid[0], mid[1], R - TOP]).map((x, _, l) => x * Math.sign(l[2]))), L = Math.hypot(...tip), o = n[0] + n[1] < 0 ? 2 : 0, d = (p) => o + Math.abs(tip[0] * p[1] - tip[1] * p[0]) / L;
        for (let s = s0; s < s0 + K; s++) { put([0, 0, TOP], n, o); put([...C[s + 1], R], n, d(C[s + 1])); put([...C[s], R], n, d(C[s])); } }
      for (let s = 0; s < 2 * K; s++) { const p = C[s], q = C[s + 1], op = out(s), oq = out(s + 1), np = [...op, 0], nq = [...oq, 0], bp = unit([...op, -0.6]), bq = unit([...oq, -0.6]);
        put([...p, R], np, -9); put([...q, R], nq, -9); put([...q, 0], nq, -9); put([...p, R], np, -9); put([...q, 0], nq, -9); put([...p, 0], np, -9);   // the rim
        put([0, 0, 0], [0, 0, -1], -9); put([...p, 0], bp, -9); put([...q, 0], bq, -9); } }   // the back
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("bandT", new THREE.Float32BufferAttribute(B, 1));
    g.userData.bands = [[1.5, 9, "dark"], [-1, W, "light"], [1.5, 2 + W, "light"]]; return g; },
  ball: () => { const g = new THREE.SphereGeometry(0.5, 16, 12); g.translate(0, 0, 0.42); return g; },
  // a bow (2026-10-07, for a 超絶美少女's hair): two loops puffed out and swept back a little, a knot, two tails with V-cut ends.
  // Cloth, so its normals are smoothed (the leaf's facets would show on its soft curves)
  ribbon: () => { const parts = [];
    for (const m of [1, -1]) {
      const s = new THREE.Shape(); s.moveTo(0.05 * m, 0.07); s.bezierCurveTo(0.2 * m, 0.36, 0.52 * m, 0.38, 0.5 * m, 0.06); s.bezierCurveTo(0.49 * m, -0.24, 0.2 * m, -0.22, 0.05 * m, -0.07); s.lineTo(0.05 * m, 0.07);
      const g = flat(s, 0.06), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), d = ((x - 0.3 * m) / 0.26) ** 2 + ((y - 0.06) / 0.22) ** 2; P.setZ(i, P.getZ(i) + 0.13 * Math.max(0, 1 - d) - 0.16 * Math.max(0, Math.abs(x) - 0.08)); }   // puffed, the ends swept back
      parts.push(smooth(g));
      const t = new THREE.Shape(); t.moveTo(0.03 * m, -0.04); t.lineTo(0.12 * m, -0.07); t.lineTo(0.32 * m, -0.62); t.lineTo(0.24 * m, -0.56); t.lineTo(0.17 * m, -0.66); t.lineTo(0.03 * m, -0.04);
      const tg = flat(t, 0.04), TP = tg.attributes.position;
      for (let i = 0; i < TP.count; i++) { const y = TP.getY(i), x = TP.getX(i); TP.setZ(i, TP.getZ(i) - 0.06 + 0.05 * Math.sin(-y * 5) * Math.sign(x) * m); }   // behind the loops, a little wave
      parts.push(smooth(tg)); }
    const k = new THREE.SphereGeometry(0.13, 14, 10); k.scale(0.85, 1, 0.75); k.translate(0, 0, 0.1); parts.push(k);
    return merge(parts); },
  // for シルヴィ: an X of two rounded bars (spin 45: a +), 1 across; a tassel hanging 1 down from where it is put (a knot, a collar, a fringe
  // of cords); a buckle's frame, 1 wide; a tab, a strap 0.36 wide hanging 1 down from where it is put, its end cut in a V
  cross: () => { const bar = (a) => { const s = new THREE.Shape(), w = 0.12, l = 0.5; s.moveTo(-l + w, -w); s.lineTo(l - w, -w); s.absarc(l - w, 0, w, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-l + w, w); s.absarc(-l + w, 0, w, Math.PI / 2, Math.PI * 1.5, false);
      const g = flat(s, 0.06); g.rotateZ(a); return g; };
    const g = merge([bar(Math.PI / 4), bar(-Math.PI / 4)]); g.computeVertexNormals(); return g; },
  tassel: () => { const parts = [], up = new THREE.Vector3(0, 1, 0);
    const knot = new THREE.SphereGeometry(0.14, 12, 10); knot.translate(0, -0.12, 0); parts.push(knot);
    const neck = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12); neck.translate(0, -0.3, 0); parts.push(neck);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, t = new THREE.Vector3(0.07 * Math.cos(a), -0.34, 0.07 * Math.sin(a)), b = new THREE.Vector3(0.13 * Math.cos(a), -1, 0.13 * Math.sin(a)), d = b.clone().sub(t);
      const c = new THREE.CylinderGeometry(0.035, 0.03, d.length(), 5); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize())); c.translate((t.x + b.x) / 2, (t.y + b.y) / 2, (t.z + b.z) / 2); parts.push(c); }
    const g = merge(parts); g.translate(0, 0, 0.15); return g; },
  buckle: () => { const box = (p, w, h, r) => { p.moveTo(-w + r, -h); p.lineTo(w - r, -h); p.quadraticCurveTo(w, -h, w, -h + r); p.lineTo(w, h - r); p.quadraticCurveTo(w, h, w - r, h); p.lineTo(-w + r, h); p.quadraticCurveTo(-w, h, -w, h - r); p.lineTo(-w, -h + r); p.quadraticCurveTo(-w, -h, -w + r, -h); return p; };
    const s = box(new THREE.Shape(), 0.5, 0.35, 0.1); s.holes.push(box(new THREE.Path(), 0.3, 0.16, 0.05)); const g = flat(s, 0.08); g.computeVertexNormals(); return g; },
  // a belt buckle with its prong (for アステル's): a thin frame 0.84 high, the prong's tip coming in from its left side at the middle, 1 wide.
  // Its bevel small: the buckle's 0.04 rounds every edge out, and a thin frame came out as thick as the buckle's
  pinBuckle: () => { const W = 0.49, H = 0.41, F = 0.06, iw = W - F, ih = H - F, r = 0.07, ri = 0.03, PL = 0.2, PH = 0.06, s = new THREE.Shape(), h = new THREE.Path();
    s.moveTo(-W + r, -H); s.lineTo(W - r, -H); s.quadraticCurveTo(W, -H, W, -H + r); s.lineTo(W, H - r); s.quadraticCurveTo(W, H, W - r, H); s.lineTo(-W + r, H); s.quadraticCurveTo(-W, H, -W, H - r); s.lineTo(-W, -H + r); s.quadraticCurveTo(-W, -H, -W + r, -H);
    h.moveTo(-iw, -ih + ri); h.lineTo(-iw, -PH); h.lineTo(-iw + PL, -PH); h.lineTo(-iw + PL, PH); h.lineTo(-iw, PH); h.lineTo(-iw, ih - ri); h.quadraticCurveTo(-iw, ih, -iw + ri, ih); h.lineTo(iw - ri, ih);
    h.quadraticCurveTo(iw, ih, iw, ih - ri); h.lineTo(iw, -ih + ri); h.quadraticCurveTo(iw, -ih, iw - ri, -ih); h.lineTo(-iw + ri, -ih); h.quadraticCurveTo(-iw, -ih, -iw, -ih + ri);
    s.holes.push(h); const g = flat(s, 0.05, 0.012); g.computeVertexNormals(); return g; },
  cord: () => { const g = new THREE.CapsuleGeometry(0.06, 0.88, 4, 10); g.rotateZ(Math.PI / 2); g.translate(0, 0, 0.06); return g; },
  tab: () => { const s = new THREE.Shape(), w = 0.18; s.moveTo(-w, 0.05); s.lineTo(w, 0.05); s.lineTo(w, -1); s.lineTo(0, -0.88); s.lineTo(-w, -1); s.lineTo(-w, 0.05);
    const g = flat(s, 0.05); g.computeVertexNormals(); return g; },
  // a strap (for クロエ's belt end): a narrow strip hanging down, 1 long and 0.13 wide, cut square (the tab is short and wide: at a strap's length it was a board)
  strap: () => { const s = new THREE.Shape(), w = 0.065; s.moveTo(-w, 0.03); s.lineTo(w, 0.03); s.lineTo(w, -1); s.lineTo(-w, -1); s.lineTo(-w, 0.03);
    const g = flat(s, 0.03, 0.01); g.computeVertexNormals(); return g; },
  // a button (2026-10-10, for 島風's gold buttons): a low dome with a rim, 1 across
  button: () => { const g = new THREE.LatheGeometry([[0, 0], [0.5, 0], [0.5, 0.1], [0.44, 0.17], [0.34, 0.16], [0.2, 0.2], [0, 0.22]].map(([x, y]) => new THREE.Vector2(x, y)), 20); g.rotateX(Math.PI / 2); g.computeVertexNormals(); return g; },
  // an anchor (2026-10-10, for 島風): the shank with a ring on top and the stock across under it, the arms curving up to the flukes; 1 tall,
  // flat (it lies on the surface)
  anchor: () => { const parts = [], d = 0.08;
    const shank = new THREE.CylinderGeometry(0.045, 0.05, 0.82, 10); shank.translate(0, 0.02, 0); parts.push(shank);
    const ring = new THREE.TorusGeometry(0.1, 0.035, 8, 20); ring.translate(0, 0.5, 0); parts.push(ring);
    const stock = new THREE.CylinderGeometry(0.035, 0.035, 0.52, 8); stock.rotateZ(Math.PI / 2); stock.translate(0, 0.3, 0); parts.push(stock);
    for (const m of [1, -1]) { const ball = new THREE.SphereGeometry(0.05, 10, 8); ball.translate(m * 0.26, 0.3, 0); parts.push(ball); }
    const arms = new THREE.TorusGeometry(0.34, 0.045, 8, 28, Math.PI); arms.rotateZ(Math.PI); arms.translate(0, -0.06, 0); parts.push(arms);
    for (const m of [1, -1]) { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(m * 0.14, -0.04); s.lineTo(m * 0.02, 0.2); s.lineTo(0, 0);
      const fl = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); fl.translate(m * 0.32, -0.08, -d / 2); parts.push(fl); }
    const tip = new THREE.ConeGeometry(0.08, 0.14, 10); tip.rotateZ(Math.PI); tip.translate(0, -0.45, 0); parts.push(tip);
    const g = merge(parts.map((p) => p.index ? p.toNonIndexed() : p)); g.scale(1, 1, 0.6); g.translate(0, 0, 0.05); g.computeVertexNormals(); return g; },
};
function smooth(g) {   // vertex normals averaged over the triangles that share a point (a non-indexed geometry, as ExtrudeGeometry makes)
  const P = g.attributes.position, N = new Float32Array(P.count * 3), acc = new Map(), key = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) { a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2); const n = c.sub(b).cross(a.sub(b));   // (area-weighted)
    for (let j = 0; j < 3; j++) { const k = key(i + j), v = acc.get(k) ?? [0, 0, 0]; v[0] += n.x; v[1] += n.y; v[2] += n.z; acc.set(k, v); } }
  for (let i = 0; i < P.count; i++) { const v = acc.get(key(i)), l = Math.hypot(...v) || 1; N[i * 3] = v[0] / l; N[i * 3 + 1] = v[1] / l; N[i * 3 + 2] = v[2] / l; }
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); return g;
}

/**
 * One item → its geometries (rest pose, avatar space), each { geo, bone }. ctx: { J (joints, rest), PARENT, fromHead (head → avatar space) }.
 * A mirrored item gives two.
 */
export function accessoryGeometries(item, { J, PARENT, fromHead, snap = null }) {
  const out = [];
  for (const m of item.mirror ? [1, -1] : [1]) {
    let bone = item.bone; if (m < 0) bone = bone.endsWith(".L") ? bone.replace(/\.L$/, ".R") : bone.endsWith(".R") ? bone.replace(/\.R$/, ".L") : bone;
    if (!J[bone]) continue;
    const at = [item.at[0] * m, item.at[1], item.at[2]], j = J[bone];
    const n = new THREE.Vector3(item.n?.[0] * m || 0, item.n?.[1] ?? 0, item.n?.[2] ?? 1).normalize(), S = item.size ?? 0.04;
    let p = bone === "head" ? fromHead(...at) : [j[0] + at[0], j[1] + at[1], j[2] + at[2]];
    if (snap && bone !== "head" && item.kind !== "band") p = snap(p, n) ?? p;   // (snap: onto the surface along n, see index.js makeAccessories)
    if (item.lift && item.kind !== "band") p = [p[0] + n.x * item.lift, p[1] + n.y * item.lift, p[2] + n.z * item.lift];   // lift (m): off the surface along n (a skirt's cloth swung over a button sitting on it, 2026-10-10)
    let g;
    if (item.kind === "band") {   // around the bone's axis (toward its child, or from its parent), through the point it was put on
      const child = Object.keys(PARENT).find((k) => PARENT[k] === bone && !/^(skirt|fingers|fingerTips|thumb)\./.test(k));
      const a = child ? J[child] : j, b = child ? j : J[PARENT[bone]] ?? [j[0], j[1] + 1, j[2]], ax = new THREE.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]).normalize();
      const P = new THREE.Vector3(...p), c = new THREE.Vector3(...j).addScaledVector(ax, P.clone().sub(new THREE.Vector3(...j)).dot(ax)), r = P.distanceTo(c) + S * 0.35;
      g = new THREE.TorusGeometry(r, S * 0.35, 8, 32); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax)); g.translate(c.x, c.y, c.z);
    } else {
      g = (SHAPES[item.kind] ?? SHAPES.ball)(); g.scale(S, S, S);
      const up0 = Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0), x = up0.clone().cross(n).normalize(), y = n.clone().cross(x);   // "up" as near the world's up as it can be
      g.rotateZ((item.spin ?? 0) * m * Math.PI / 180); g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, n)); g.translate(...p);
    }
    out.push({ geo: g, bone });
  }
  return out;
}
