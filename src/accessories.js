// Accessories (options.accessories, 2026-10-05, Saori: Nahida's leaf hair ornament and golden anklets): small pieces stuck on the character,
// each riding on one bone. Not shapes in the body's distance field: plain little meshes (fast to add and move in an editor).
// An item: { kind, bone, at: [x, y, z], n: [x, y, z], spin (degrees), size (m), color, mirror }
//   at: where it sits: for the head bone in head space (it follows the head's size and shape), for any other bone the offset from the
//       bone's joint (rest pose). n: the way it faces (the surface's normal there, rest pose). spin: turned around n. mirror: also on the
//       other side (x mirrored, .L and .R bones swapped).
// Kinds: leaf (a pointed leaf with a midrib), gem (a cut stone), flower (five petals), star, ball, ribbon (a bow with tails), button, anchor, band (a ring around the limb at that
// point: a bracelet, an anklet, a choker; its radius reaches the surface where it was put, size is how thick the ring is).
import * as THREE from "three";

export const ACCESSORY_KINDS = ["leaf", "gem", "flower", "star", "ball", "ribbon", "band", "button", "anchor"];

// the shapes, 1 unit across, facing +z (the surface's normal), their "up" +y
function flat(shape, depth) {   // a flat shape with rounded edges, its back on z = 0
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.6, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
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
      const fl = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); fl.translate(m * 0.32, -0.08, -d / 2); parts.push(fl.toNonIndexed()); }
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
