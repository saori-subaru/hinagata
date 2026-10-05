// Painting on the character (2026-10-05, Saori: "VRoid みたくアプリ上でテクスチャを描けるといい"). The meshes have no UVs (they are remade from
// shapes on every change), so each paintable part (the skin and each garment) has one picture of six views of it, side by side (an atlas):
// from the front, the back, its left, its right, above and below. A point of the surface shows the view its normal faces most; a brush
// paints a disc around the 3D point it touches into every view that point could show in, so a stroke runs on across where the views meet.
// Points are taken at the base proportions (before body.proportion stretches the body) and in the rest pose, so the paint stays on the body
// when it moves, when its proportions change and mostly when its shape is changed a little.
// Shared by the engine (the shader, index.js) and the editor's brush (editor/src/paint.js).

export const PAINT_TARGETS = ["body", "shirt", "pants", "dress", "cape"];

/** The atlas: PPM pixels per m over the box X × Y × Z (base proportions, rest pose; body: up to the top of the head, garments: up to the neck). */
export function paintLayout(target) {
  const PPM = 600, X = [-0.45, 0.45], Z = [-0.35, 0.35], Y = target === "body" ? [-0.02, 1.5] : [-0.02, 1.0];
  const w = Math.round((X[1] - X[0]) * PPM), d = Math.round((Z[1] - Z[0]) * PPM), h = Math.round((Y[1] - Y[0]) * PPM);
  // views (axis, sign) and where they sit in the atlas: one row of front, back, left (+x), right (-x); under it top and bottom
  const V = [[2, 1, 0, 0, w, h], [2, -1, w, 0, w, h], [0, 1, 2 * w, 0, d, h], [0, -1, 2 * w + d, 0, d, h], [1, 1, 0, h, w, d], [1, -1, w, h, w, d]];
  return { PPM, X, Y, Z, W: 2 * w + 2 * d, H: h + d, views: V.map(([axis, sign, x, y, cw, ch]) => ({ axis, sign, x, y, w: cw, h: ch })) };
}

/** A point (base proportions) seen in one view → pixel coordinates in the atlas (canvas: y down). Each view as seen from outside, not mirrored. */
export function paintPixel(L, v, p) {
  const [x, y, z] = p; let u, t;
  if (v.axis === 2) { u = v.sign > 0 ? x - L.X[0] : L.X[1] - x; t = y - L.Y[0]; }
  else if (v.axis === 0) { u = v.sign > 0 ? L.Z[1] - z : z - L.Z[0]; t = y - L.Y[0]; }
  else { u = x - L.X[0]; t = v.sign > 0 ? z - L.Z[0] : L.Z[1] - z; }
  return [v.x + u * L.PPM, v.y + v.h - t * L.PPM];
}

/** The same in GLSL, for the shader: vec2 paintUV(vec3 p, vec3 n) → the atlas's texture coordinates (flipY: canvas row 0 at the top). */
export function paintGLSL(L) {
  const f = (x) => (+x).toFixed(5), view = (v) => `{ vec2 q = ${v.axis === 2 ? (v.sign > 0 ? `vec2(p.x - ${f(L.X[0])}, p.y - ${f(L.Y[0])})` : `vec2(${f(L.X[1])} - p.x, p.y - ${f(L.Y[0])})`)
    : v.axis === 0 ? (v.sign > 0 ? `vec2(${f(L.Z[1])} - p.z, p.y - ${f(L.Y[0])})` : `vec2(p.z - ${f(L.Z[0])}, p.y - ${f(L.Y[0])})`)
    : (v.sign > 0 ? `vec2(p.x - ${f(L.X[0])}, p.z - ${f(L.Z[0])})` : `vec2(p.x - ${f(L.X[0])}, ${f(L.Z[1])} - p.z)`)} * ${f(L.PPM)};
    q = clamp(q, vec2(0.5), vec2(${f(v.w - 0.5)}, ${f(v.h - 0.5)}));
    return vec2((${f(v.x)} + q.x) / ${f(L.W)}, 1.0 - (${f(v.y + v.h)} - q.y) / ${f(L.H)}); }`;
  const V = L.views, pick = (a) => V.filter((v) => v.axis === a);
  const by = (a) => { const [pos, neg] = pick(a); return `if (n${"xyz"[a]} >= 0.0) ${view(pos)} else ${view(neg)}`; };
  return `vec2 paintUV(vec3 p, vec3 n) { vec3 m = abs(n); float nx = n.x, ny = n.y, nz = n.z;
  if (m.z >= m.x && m.z >= m.y) { ${by(2)} }
  if (m.x >= m.y) { ${by(0)} }
  ${by(1)} }`;
}

/** Which views a surface point with this normal could show in near the brush (its own, and the next ones where the normal is nearly between). */
export function paintViews(L, n) {
  const m = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])], top = Math.max(...m);
  return L.views.filter((v) => n[v.axis] * v.sign > 0 && m[v.axis] > top * 0.55);
}
