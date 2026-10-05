// Accessories (options.accessories, 2026-10-05, Saori: Nahida's leaf hair ornament and golden anklets): small pieces stuck on the character,
// each riding on one bone. Not shapes in the body's distance field: plain little meshes (fast to add and move in an editor).
// An item: { kind, bone, at: [x, y, z], n: [x, y, z], spin (degrees), size (m), color, mirror }
//   at: where it sits: for the head bone in head space (it follows the head's size and shape), for any other bone the offset from the
//       bone's joint (rest pose). n: the way it faces (the surface's normal there, rest pose). spin: turned around n. mirror: also on the
//       other side (x mirrored, .L and .R bones swapped).
// Kinds: leaf (a pointed leaf with a midrib), gem (a cut stone), flower (five petals), star, ball, band (a ring around the limb at that
// point: a bracelet, an anklet, a choker; its radius reaches the surface where it was put, size is how thick the ring is).
import * as THREE from "three";

export const ACCESSORY_KINDS = ["leaf", "gem", "flower", "star", "ball", "band"];

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
  gem: () => { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.8, 1, 0.45); g.translate(0, 0, 0.12); g.computeVertexNormals(); return g.toNonIndexed(); },
  flower: () => { const parts = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.SphereGeometry(0.2, 10, 8); p.scale(0.85, 1.25, 0.35); p.translate(0, 0.25, 0.08); p.rotateZ(a); parts.push(p); }
    const c = new THREE.SphereGeometry(0.13, 10, 8); c.scale(1, 1, 0.7); c.translate(0, 0, 0.14); parts.push(c); return merge(parts); },
  star: () => { const s = new THREE.Shape(); for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 0.21 : 0.5; s[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
    const g = flat(s, 0.08); g.computeVertexNormals(); return g; },
  ball: () => { const g = new THREE.SphereGeometry(0.5, 16, 12); g.translate(0, 0, 0.42); return g; },
};

/**
 * One item → its geometries (rest pose, avatar space), each { geo, bone }. ctx: { J (joints, rest), PARENT, fromHead (head → avatar space) }.
 * A mirrored item gives two.
 */
export function accessoryGeometries(item, { J, PARENT, fromHead }) {
  const out = [];
  for (const m of item.mirror ? [1, -1] : [1]) {
    let bone = item.bone; if (m < 0) bone = bone.endsWith(".L") ? bone.replace(/\.L$/, ".R") : bone.endsWith(".R") ? bone.replace(/\.R$/, ".L") : bone;
    if (!J[bone]) continue;
    const at = [item.at[0] * m, item.at[1], item.at[2]], j = J[bone];
    const p = bone === "head" ? fromHead(...at) : [j[0] + at[0], j[1] + at[1], j[2] + at[2]];
    const n = new THREE.Vector3(item.n?.[0] * m || 0, item.n?.[1] ?? 0, item.n?.[2] ?? 1).normalize(), S = item.size ?? 0.04;
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
