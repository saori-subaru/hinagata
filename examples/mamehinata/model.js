// まめひなた: 三面図(sheet.jpg)のピクセルをそのまま座標に使って起こした形(エンジン src/ は使わない)。
// 単位=絵のピクセル。X=本人の左が+、Y=靴底から上、Z=前が+。X=0 は正面図の x=205、Z=0 は横図の x=515。
// 絵 → 座標: X = x(正面) - 205(背面は 833 - x) , Y = 705 - y , Z = 515 - x(横)。三面の縦位置は絵の中で揃っている。
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
const interp = (arr, t) => {
  if (typeof arr === "number") return arr;
  if (typeof arr === "function") return arr(t);
  const f = Math.min(Math.max(t, 0), 1) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f));
  return lerp(arr[i], arr[i + 1], f - i);
};
// 縦の通路用: [[Y, 値], …] を t(0..1, 通路の頭→尻)の関数にする
const byY = (y0, y1, levels) => (t) => {
  const y = lerp(y0, y1, t);
  for (let i = 0; i < levels.length - 1; i++) {
    const [ya, va] = levels[i], [yb, vb] = levels[i + 1];
    if ((y <= ya && y >= yb) || i === levels.length - 2) return lerp(va, vb, (ya - y) / (ya - yb));
  }
};

const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...o });
const INK = "#2a1d1a";

// 断面が楕円(p>2 で角張る)の管。rx=b軸(通路に垂直で ref と直交)、rz=a軸(ref 側)の半径
function sweepGeo({ pts, rx, rz, n = 20, seg = 24, ref = [0, 0, 1], closed = false, p = 2, caps = true, colorFn }) {
  const curve = new THREE.CatmullRomCurve3(pts.map((q) => V(...q)), closed, "centripetal");
  const rows = closed ? seg : seg + 1, pos = [], col = [], idx = [], R = V(...ref);
  for (let i = 0; i < rows; i++) {
    const t = i / seg, c = curve.getPointAt(Math.min(t, 1)), T = curve.getTangentAt(Math.min(t, 1)).normalize();
    let a = R.clone().addScaledVector(T, -R.dot(T));
    if (a.lengthSq() < 1e-6) a = V(1, 0, 0).addScaledVector(T, -T.x);
    a.normalize(); const b = new THREE.Vector3().crossVectors(T, a).normalize();
    const ra = interp(rz, t), rb = interp(rx, t);
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th), e = 2 / p;
      const q = c.clone().addScaledVector(a, ra * Math.sign(cs) * Math.abs(cs) ** e).addScaledVector(b, rb * Math.sign(sn) * Math.abs(sn) ** e);
      pos.push(q.x, q.y, q.z);
      if (colorFn) { const cc = colorFn(t, j / n); col.push(cc.r, cc.g, cc.b); }
    }
  }
  const last = closed ? rows : rows - 1;
  for (let i = 0; i < last; i++) for (let j = 0; j < n; j++) {
    const i2 = (i + 1) % rows, j2 = (j + 1) % n;
    const A = i * n + j, B = i * n + j2, C = i2 * n + j, D = i2 * n + j2;
    idx.push(A, B, C, B, D, C);
  }
  if (!closed && caps) for (const [row, flip, t] of [[0, true, 0], [rows - 1, false, 1]]) {
    const c = curve.getPointAt(t), ci = pos.length / 3; pos.push(c.x, c.y, c.z);
    if (colorFn) { const cc = colorFn(t, 0); col.push(cc.r, cc.g, cc.b); }
    for (let j = 0; j < n; j++) { const A = row * n + j, B = row * n + (j + 1) % n; idx.push(...(flip ? [ci, B, A] : [ci, A, B])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (colorFn) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function ellipsoidGeo(rx, ry, rz, { ws = 32, hs = 22, phi0 = 0, phiLen = Math.PI * 2, th0 = 0, thLen = Math.PI, tweak } = {}) {
  const g = new THREE.SphereGeometry(1, ws, hs, phi0, phiLen, th0, thLen), p = g.attributes.position, v = V(0, 0, 0);
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i) * rx, p.getY(i) * ry, p.getZ(i) * rz); tweak?.(v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}

// 輪郭: 継ぎ目をつなぎ直して滑らかな法線で押し出した裏面
function outlineOf(geo, w) {
  const g = geo.clone(); for (const k of ["normal", "uv", "color"]) g.deleteAttribute(k);
  const m = mergeVertices(g, 0.02); m.computeVertexNormals();
  const p = m.attributes.position, n = m.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  return new THREE.Mesh(m, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
}

export function buildMamehinata({ outline = 1.5 } = {}) {
  const root = new THREE.Group(); root.name = "mamehinata";
  const outlines = [];
  const add = (geo, mat, { at = [0, 0, 0], rot = [0, 0, 0], line = outline, parent = root, name } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(...at); m.rotation.set(...rot); if (name) m.name = name; parent.add(m);
    if (line > 0 && !mat.transparent) { const o = outlineOf(geo, line); o.position.copy(m.position); o.rotation.copy(m.rotation); o.userData.outline = true; parent.add(o); outlines.push(o); }
    return m;
  };
  const both = (fn) => { fn(1); fn(-1); };   // 左右(s=+1 が本人の左)

  const C = { skin: "#fde3d3", hair: "#b0814f", hairD: "#966a3e", hairL: "#c99a66", red: "#c4412f", redD: "#a4332a", collar: "#862e26", white: "#e6e4e3", teal: "#2f9a9c",
    tealD: "#27868a", orange: "#f2a238", sole: "#e9e6de", black: "#1c1c26", gold: "#d9a640", cream: "#ecd0a0", lime: "#c3e486", visor: "#bfe27a", pink: "#f1a0a8" };

  // ───────── 頭 ─────────
  {   // 顎に向けて細る頭蓋(中心 (0,490,-7))
    const g = ellipsoidGeo(66, 69, 70, { tweak: (v) => { const s = Math.max(0, -v.y / 69); v.x *= 1 - 0.22 * s * s; v.z *= 1 - 0.12 * s * s; v.y += 489; v.z -= 7; } });
    add(g, toon(C.skin), { name: "skull" });
  }
  // 首
  add(sweepGeo({ pts: [[0, 440, -2], [0, 395, 0]], rx: 24, rz: 22 }), toon(C.skin), { line: 0 });

  // 顔の絵(目・口・ほお): 前から見た面に貼る
  const faceCanvas = (() => {
    const W = 800, H = 440, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    // X -100..100 → 0..W、Y 395..505 → H..0
    const px = (X) => (X + 100) * (W / 200), py = (Y) => (505 - Y) * (H / 110), k = W / 200;
    const eye = (X, Y, s) => {
      const cx = px(X), cy = py(Y);
      g.save(); g.translate(cx, cy); g.scale(0.74, 0.74);
      g.fillStyle = "#23262f"; g.beginPath(); g.ellipse(0, 0, 21 * k, 26 * k, 0, 0, 7); g.fill();            // 黒目の外
      const gr = g.createLinearGradient(0, -22 * k, 0, 24 * k); gr.addColorStop(0, "#1f232c"); gr.addColorStop(0.45, "#3a4655"); gr.addColorStop(1, "#7f95ad");
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 1.5 * k, 18.5 * k, 23.5 * k, 0, 0, 7); g.fill();          // 虹彩(下が明るい青灰)
      g.fillStyle = "#14161c"; g.beginPath(); g.ellipse(0, -1 * k, 11 * k, 14 * k, 0, 0, 7); g.fill();       // 瞳孔
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(-s * 6 * k, -9 * k, 6.2 * k, 7.5 * k, 0, 0, 7); g.fill(); // 大きいハイライト
      g.beginPath(); g.ellipse(s * 8 * k, 11 * k, 3 * k, 3.4 * k, 0, 0, 7); g.fill();
      g.strokeStyle = "#1a1a20"; g.lineWidth = 4.2 * k; g.lineCap = "round";                                  // 上まつげの太い線
      g.beginPath(); g.ellipse(0, 0, 21 * k, 26 * k, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
      g.restore();
    };
    eye(-27, 460, -1); eye(30, 462, 1);
    // ほお
    g.fillStyle = "rgba(255,120,130,0.45)";
    for (const X of [-45, 50]) { g.beginPath(); g.ellipse(px(X), py(443), 11 * k, 6.5 * k, 0, 0, 7); g.fill(); }
    // 口(開いた笑い)
    g.save(); g.translate(px(3), py(441));
    g.fillStyle = "#c9494f"; g.strokeStyle = "#6c2a2c"; g.lineWidth = 3 * k; g.lineJoin = "round";
    g.beginPath(); g.moveTo(-12 * k, -5 * k); g.quadraticCurveTo(0, -3 * k, 12 * k, -5 * k); g.quadraticCurveTo(10 * k, 13 * k, 0, 14 * k); g.quadraticCurveTo(-10 * k, 13 * k, -12 * k, -5 * k); g.fill(); g.stroke();
    g.fillStyle = "#f0848f"; g.beginPath(); g.ellipse(0, 8 * k, 6.5 * k, 4.2 * k, 0, 0, 7); g.fill();
    g.restore();
    return cv;
  })();
  {
    const tex = new THREE.CanvasTexture(faceCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const g = ellipsoidGeo(66.6, 69.6, 70.6, { phi0: Math.PI / 2 - 1.0, phiLen: 2.0, th0: 0.5, thLen: 2.5, tweak: (v) => { const s = Math.max(0, -v.y / 69); v.x *= 1 - 0.22 * s * s; v.z *= 1 - 0.12 * s * s; v.y += 489; v.z -= 7; } });
    const p = g.attributes.position, uv = [];
    for (let i = 0; i < p.count; i++) uv.push((p.getX(i) + 100) / 200, (p.getY(i) - 395) / 110);
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.name = "face"; root.add(m);
  }

  // ───────── 髪 ─────────
  const hairM = toon(C.hair), hairD = toon(C.hairD), hairL = toon(C.hairL);
  // 頭のまるい毛の層。前の下側(生え際より下)は頭の中へ押し込んで顔を出す
  {
    const g = ellipsoidGeo(80, 74, 80, { ws: 40, hs: 28, tweak: (v) => {
      const Y = v.y + 497, front = v.z > 8;
      if (front && Y < 523 + Math.max(0, Math.abs(v.x) - 38) * 0.9 && Math.abs(v.x) < 62) { v.multiplyScalar(0.55); }
      v.y += 497; v.z -= 10;
    } });
    add(g, hairM, { name: "hairCap" });
  }
  // 前髪の房(額の上から目の少し上へ、毛先は尖って横へ流れる)
  for (const [x, w, y1, z, sw] of [[0, 13, 492, 72, 0], [-24, 14, 490, 70, -6], [24, 14, 488, 70, 6], [-46, 13, 478, 60, -14], [46, 13, 474, 60, 14]]) {
    add(sweepGeo({ pts: [[x * 0.6, 560, 38], [x * 0.9, 525, z - 8], [x + sw, y1 + 14, z]], rx: [w, w * 0.9, w * 0.2], rz: [9, 8, 4], seg: 12 }), hairM, { line: 1 });
  }
  // 横の長い房(耳の前を通って胸のあたりまで)
  both((s) => {
    const len = s > 0 ? 385 : 352;
    add(sweepGeo({ pts: [[s * 66, 520, 6], [s * 80, 470, -2], [s * 88, 420, -10], [s * 88, len + 20, -14], [s * 84, len - 15, -16]], rx: [15, 16, 16, 13, 4], rz: [12, 13, 12, 9, 4], seg: 24, ref: [0, 0, 1] }), hairM);
  });
  // 後ろ髪(頭のうしろから首の後ろまで一枚の幕。横図で頭より後ろへはみ出さない厚みに)
  add(sweepGeo({ pts: [[0, 540, -38], [0, 480, -58], [0, 430, -56], [0, 395, -46]], rx: [62, 76, 72, 58], rz: [22, 24, 20, 12], seg: 20, p: 2.6 }), hairM);
  // 後ろ髪の裾の毛先(背中側に肩の上あたりまで)
  both((s) => add(sweepGeo({ pts: [[s * 52, 430, -50], [s * 70, 385, -52], [s * 80, 340, -45], [s * 78, 305, -40]], rx: [20, 20, 14, 3], rz: [16, 15, 11, 4], seg: 16 }), hairM, { line: 1.2 }));
  // 低い位置のポニーテール(結び目は首のうしろ、背中側へ流れる)
  add(sweepGeo({ pts: [[0, 415, -42], [0, 385, -70], [0, 345, -92], [0, 322, -112]], rx: [14, 21, 22, 5], rz: [12, 19, 18, 5], seg: 20 }), hairM);
  add(sweepGeo({ pts: [[0, 417, -44], [0, 411, -47]], rx: 17, rz: 14, n: 14 }), toon("#4a3425"));   // 結び目の紐
  both((s) => add(sweepGeo({ pts: [[s * 4, 412, -46], [s * 22, 392, -52], [s * 28, 372, -55]], rx: [4, 5, 2], rz: [2.5, 2.5, 1.5], seg: 8 }), toon("#4a3425"), { line: 0.8 }));
  // アホ毛
  add(sweepGeo({ pts: [[-12, 556, 28], [-16, 578, 36], [-6, 590, 50], [4, 586, 56]], rx: [5, 4, 2.5, 1], rz: [4, 3.5, 2.5, 1], seg: 12 }), hairM, { line: 1.1 });
  // ヘアピン(左に白とオレンジ、右にオレンジ)
  const pin = (X, Y, Z, c, rz = 0) => add(new THREE.BoxGeometry(24, 8, 4), toon(c), { at: [X, Y, Z], rot: [0, 0, rz], line: 0.8 });
  pin(-62, 460, 30, "#f6f6f0", -0.06); pin(-54, 480, 34, C.orange, 0.1); pin(60, 482, 32, C.orange, -0.12);

  // ───────── 耳(犬耳) ─────────
  both((s) => {
    const earPts = [[s * 38, 530, -32], [s * 43, 575, -26], [s * 47, 622, -15]];
    add(sweepGeo({ pts: earPts, rx: [31, 29, 17, 3], rz: [34, 28, 16, 4], seg: 24, ref: [0, 0, 1] }), hairM, { name: "ear" });
    add(sweepGeo({ pts: [[s * 38, 544, -5], [s * 43, 578, -3], [s * 46, 608, 1]], rx: [18, 15, 8, 1.5], rz: [5, 4, 3, 1], seg: 16 }), toon(C.cream), { line: 0.6 });   // 耳の内側(明るい)
    add(sweepGeo({ pts: [[s * 38, 545, -1], [s * 40, 562, 0]], rx: [11, 8], rz: 4, seg: 6 }), toon("#f8f4ee"), { line: 0 });                                                // 白いふわふわ
  });

  // ───────── バイザー ─────────
  {
    const band = new THREE.Group(); band.position.set(0, 484, -9); band.rotation.x = -0.22; root.add(band);
    const ringPts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ringPts.push([Math.sin(a) * 87, 0, Math.cos(a) * 88]); }
    add(sweepGeo({ pts: ringPts, closed: true, rx: 3.5, rz: 12, seg: 48, ref: [0, 1, 0], p: 3 }), toon("#2b8f95"), { parent: band, line: 1.2, name: "visorBand" });
    // うしろのバックル(明るい黄緑の留め具)
    add(new THREE.BoxGeometry(64, 19, 3), toon(C.lime), { parent: band, at: [0, 0, -92], rot: [0, 0, 0], line: 1 });
    // つば: 透けた黄緑の扇
    const pos = [], idx = [], N = 28; const a0 = -1.25, a1 = 1.25;
    for (let i = 0; i <= N; i++) {
      const a = lerp(a0, a1, i / N), r1 = 88, r2 = 88 + 52 * (1 - 0.2 * Math.abs(Math.sin(a)));
      pos.push(Math.sin(a) * r1, 8, Math.cos(a) * r1, Math.sin(a) * r2, -14, Math.cos(a) * r2);
    }
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const brim = new THREE.Mesh(g, toon(C.visor, { transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false })); brim.name = "brim"; band.add(brim);
  }

  // ───────── 首輪(赤茶の革ベルトに金のバックルと骨のタグ) ─────────
  add(sweepGeo({ pts: [[0, 424, 2], [0, 401, 2]], rx: 53, rz: 47, p: 2.4, seg: 4 }), toon(C.collar), { name: "collar" });
  add(sweepGeo({ pts: [[0, 424, 2], [0, 421, 2]], rx: 54.5, rz: 48.5, p: 2.4, seg: 2 }), toon(C.collar), { line: 0 });
  {
    const frame = new THREE.Group(); frame.position.set(-5, 412, 51); root.add(frame);
    add(new THREE.BoxGeometry(30, 4, 4), toon(C.gold), { parent: frame, at: [0, 10, 0], line: 0.7 });
    add(new THREE.BoxGeometry(30, 4, 4), toon(C.gold), { parent: frame, at: [0, -10, 0], line: 0.7 });
    add(new THREE.BoxGeometry(4, 24, 4), toon(C.gold), { parent: frame, at: [-13, 0, 0], line: 0.7 });
    add(new THREE.BoxGeometry(4, 24, 4), toon(C.gold), { parent: frame, at: [13, 0, 0], line: 0.7 });
    add(new THREE.BoxGeometry(3, 18, 3), toon(C.gold), { parent: frame, at: [-2, 0, 1], line: 0.6 });
  }
  // 骨のタグ
  {
    const bone = new THREE.Shape();   // 骨: 長方形の両端に丸が2つずつ
    bone.moveTo(-14, -8); bone.lineTo(14, -8);
    bone.absarc(18, -9, 6.5, -1.7, 1.7, false); bone.absarc(18, 9, 6.5, -1.5, 1.7, false);
    bone.lineTo(-14, 8); bone.absarc(-18, 9, 6.5, 1.4, Math.PI + 1.5, false); bone.absarc(-18, -9, 6.5, 1.6, Math.PI + 1.6, false);
    const geo = new THREE.ExtrudeGeometry(bone, { depth: 4, bevelEnabled: false, curveSegments: 10 });
    const tag = new THREE.Group(); tag.position.set(33, 376, 64); tag.rotation.set(-0.08, 0, -0.2); root.add(tag);
    add(geo, toon("#d2ac66"), { parent: tag, line: 0.9 });
    add(new THREE.BoxGeometry(26, 13, 0.8), toon("#fbf8f0"), { parent: tag, at: [0, 0, 4.4], line: 0 });
    add(new THREE.TorusGeometry(3.4, 0.9, 6, 12), toon(C.gold), { parent: tag, at: [-5, 15, 2], line: 0 });
  }

  // ───────── 胴: 赤いチュニック(高い立ち襟・胸ポケット・ファスナー) ─────────
  const tunY0 = 410, tunY1 = 207;
  const tunR = byY(tunY0, tunY1, [[410, 52], [385, 72], [355, 78], [300, 82], [250, 88], [207, 93]]);
  const tunZ = byY(tunY0, tunY1, [[410, 44], [385, 52], [355, 58], [300, 66], [250, 74], [207, 80]]);
  const tunC = byY(tunY0, tunY1, [[410, 5], [355, 3], [300, 5], [250, 8], [207, 9]]);
  add(sweepGeo({ pts: [[0, 410, 5], [0, 385, 3], [0, 355, 3], [0, 300, 5], [0, 250, 8], [0, 207, 9]], rx: tunR, rz: tunZ, seg: 36, p: 2.3 }), toon(C.red), { name: "tunic" });
  // 立ち襟(首輪の下に見える高い赤)
  add(sweepGeo({ pts: [[0, 405, 4], [0, 378, 3]], rx: [52, 58], rz: [45, 49], p: 2.4, seg: 4 }), toon(C.redD), { line: 0.8 });
  // 胸ポケット
  {
    const zAt = (Y) => tunC(0) + 0, pocket = new THREE.Group(); pocket.position.set(-3, 318, 71.5); pocket.rotation.x = -0.18; root.add(pocket);
    add(new THREE.BoxGeometry(94, 82, 7), toon("#bb3a2a"), { parent: pocket, line: 1 });
    add(new THREE.BoxGeometry(80, 3, 2), toon(C.redD), { parent: pocket, at: [0, 20, 4], line: 0 });
    add(new THREE.CapsuleGeometry(1.8, 14, 4, 8), toon("#7a2a22"), { parent: pocket, at: [4, 22, 4.5], line: 0 });   // 引き紐
  }
  add(new THREE.BoxGeometry(5, 26, 3), toon("#f1eeea"), { at: [-21, 391, 56], line: 0.6 });   // ファスナーの引き手

  // 斜めがけの黒い紐(前: 左肩から右腰へ、背中: 左肩からうしろの鞄へ)と紐の金具
  const strapMat = toon("#201c22");
  add(sweepGeo({ pts: [[62, 390, 36], [30, 358, 62], [-10, 337, 71], [-45, 318, 65], [-68, 302, 48], [-84, 292, 12]], rx: 11, rz: 3.5, seg: 30, ref: [0, 0, 1] }), strapMat, { line: 1 });
  add(sweepGeo({ pts: [[58, 392, -52], [66, 400, -10], [62, 390, 36]], rx: 11, rz: 3.5, seg: 12, ref: [0, 1, 0] }), strapMat, { line: 1 });
  add(sweepGeo({ pts: [[58, 392, -52], [40, 376, -64], [15, 352, -72]], rx: 11, rz: 3.5, seg: 12, ref: [0, 0, 1] }), strapMat, { line: 1 });
  add(new THREE.BoxGeometry(64, 26, 14), toon("#2a252c"), { at: [-52, 306, 56], rot: [0, 0.35, 0.55], line: 1 });   // 紐の端の太い所

  // 背中のウエストポーチ(青緑・ベージュの縁取り)
  {
    const bag = new THREE.Group(); bag.position.set(-22, 300, -84); bag.rotation.set(0.15, 0, 0.08); root.add(bag);
    add(sweepGeo({ pts: [[0, 40, 0], [0, -40, 0]], rx: [44, 46], rz: [16, 14], p: 3.2, seg: 8, ref: [0, 0, 1] }), toon(C.teal), { parent: bag, name: "bag" });
    add(sweepGeo({ pts: [[0, 30, 14], [0, -26, 13]], rx: [32, 36], rz: 3, p: 3, seg: 6 }), toon(C.cream), { parent: bag, at: [0, 0, -6.5], line: 0.6 });
    add(sweepGeo({ pts: [[0, 26, 15], [0, -22, 14]], rx: [26, 30], rz: 2, p: 3, seg: 6 }), toon(C.teal), { parent: bag, at: [0, 0, -8], line: 0.6 });
  }

  // ───────── 腕: 赤い短い袖 → 白い長袖(袖口はしぼる) → 手 ─────────
  both((s) => {
    const sh = V(s * 75, 352, 0), dir = V(s * 0.74, -0.67, 0.06).normalize();
    const P = (t) => sh.clone().addScaledVector(dir, t).toArray();
    add(sweepGeo({ pts: [P(-12), P(40)], rx: 29, rz: 28, seg: 6 }), toon(C.red), { name: "sleeveRed" });
    add(sweepGeo({ pts: [P(30), P(55), P(80), P(104)], rx: [24, 27, 28, 17], rz: [24, 27, 28, 17], seg: 18 }), toon(C.white), { name: "sleeveWhite" });
    add(sweepGeo({ pts: [P(96), P(112), P(134)], rx: [12, 12, 4], rz: [7, 6.5, 2.5], seg: 10 }), toon(C.skin), { name: "hand" });
    // 指(ぴらっと広がる)
    for (const d of [-0.5, -0.17, 0.17, 0.5]) {
      const base = V(...P(120)), side = V(dir.y * -1 * s, dir.x * s, 0).normalize();
      const tip = base.clone().addScaledVector(dir, 14).addScaledVector(side, d * 12);
      add(sweepGeo({ pts: [base.toArray(), tip.toArray()], rx: [3.2, 1.6], rz: [3, 1.4], seg: 3, n: 8 }), toon(C.skin), { line: 0.6 });
    }
  });

  // ───────── 下半身: 黒のショーツ・脚・白いレッグウォーマー・靴 ─────────
  both((s) => {
    add(sweepGeo({ pts: [[s * 45, 222, 2], [s * 45, 190, 2], [s * 45, 152, 2]], rx: [48, 49, 46], rz: [57, 57, 55], seg: 10, p: 2.6 }), toon(C.black), { name: "shorts" });
    add(sweepGeo({ pts: [[s * 35, 165, 2], [s * 35, 110, 3], [s * 35, 55, 4]], rx: [21, 19, 17], rz: [21, 19, 17], seg: 8 }), toon(C.skin), { name: "leg" });
    add(sweepGeo({ pts: [[s * 35, 135, 0], [s * 35, 95, -4], [s * 35, 52, -8]], rx: [30, 33, 37], rz: [26, 30, 37], seg: 14, p: 2.4 }), toon(C.white), { name: "legWarmer" });
    // 靴
    const shoe = new THREE.Group(); shoe.position.set(s * 35, 0, 7); root.add(shoe);
    add(ellipsoidGeo(29, 27, 54, { tweak: (v) => { if (v.y < 0) v.y *= 0.0; v.y += 22; if (v.z > 0) v.y *= 1 - 0.3 * (v.z / 54); } }), toon(C.teal), { parent: shoe, name: "shoe" });
    add(sweepGeo({ pts: [[0, 3, 0], [0, 8, 0]], rx: 28, rz: 54, p: 2.4, seg: 2 }), toon(C.sole), { parent: shoe, line: 1 });
    add(new THREE.BoxGeometry(34, 9, 20), toon(C.orange), { parent: shoe, at: [0, 31, 14], line: 0.8 });
    add(new THREE.BoxGeometry(28, 8, 8), toon(C.orange), { parent: shoe, at: [0, 10, -48], line: 0.7 });
    // ショーツの横の白いひも
    add(new THREE.BoxGeometry(2.5, 70, 11), toon("#dcdad8"), { at: [s * 99, 168, -10], line: 0.7 });
  });
  // 股の埋め
  add(sweepGeo({ pts: [[0, 215, 2], [0, 160, 2]], rx: [60, 40], rz: [56, 50], seg: 4 }), toon(C.black), { line: 0 });

  // ───────── しっぽ ─────────
  {
    const tailCol = (t, u) => { const c = new THREE.Color(C.hair); if (t > 0.78) c.lerp(new THREE.Color(C.cream), (t - 0.78) / 0.22); if (u > 0.55 && u < 0.95) c.lerp(new THREE.Color(C.cream), 0.85 * Math.min(1, t * 2)); return c; };
    add(sweepGeo({ pts: [[0, 246, -70], [-30, 256, -112], [-74, 238, -156], [-98, 196, -176]], rx: [20, 36, 40, 22], rz: [20, 34, 38, 22], seg: 24, ref: [0, 1, 0], colorFn: tailCol }), toon("#ffffff", { vertexColors: true }), { name: "tail" });
  }
  return { root, outlines };
}
