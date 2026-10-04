// Face templates: a picture to draw face parts on, and reading the drawn parts back from it.
//   "parts" (1024×768, the face picture's own size): the head from the front, the code face faintly, and a frame for each part
//     at its place on the face — eye, closed eye (on the other eye), brow, mouth, nose. Read back into face.images.*.
//   "sheet" (3072×1536: 3×2 such tiles): the same for every drawn expression — ふつう (all five frames), then にこっ / びっくり /
//     じとー / すやすや (eye, brow, mouth; each tile shows that expression's code face as a guide). Read back into
//     face.images.* and face.images.sets.<expression>.*.
// Only frames with something drawn in them are read; the rest keep what they had. A frame's middle is where the part's middle
// goes on the face. Draw on a transparent layer and save only that layer (a flat color background, say green, is cut out too).
import * as THREE from "three";
import { EXPRESSIONS, DRAWN } from "./names.js";

const FRAMES = {   // the frame's size (px on the face picture); at: the part's point; other: drawn on the other eye (read back mirrored); mirror: the other side is drawn for you
  eye: { size: [340, 290], at: (f) => f.EYE, label: ["目", "Eye"] },
  eyeClosed: { size: [340, 290], at: (f) => f.EYE, other: true, label: ["とじ目", "Closed eye"] },
  brow: { size: [330, 110], at: (f) => f.BROW, mirror: true, label: ["眉", "Brow"] },
  mouth: { size: [260, 90], at: (f) => f.MOUTHP, label: ["口", "Mouth"] },
  nose: { size: [120, 100], at: (f) => f.NOSEP, label: ["鼻", "Nose"] },
};
/** The tiles of a sheet, in order: id, name, the code expression drawn faintly as a guide, its frames, and the option path for each frame. */
export const SHEET_TILES = [
  { id: "normal", name: EXPRESSIONS.normal, guide: "normal", frames: ["eye", "eyeClosed", "brow", "mouth", "nose"], path: (k) => `face.images.${k}.src` },
  ...DRAWN.map((id) => ({ id, name: EXPRESSIONS[id], guide: id, frames: ["eye", "brow", "mouth"], path: (k) => `face.images.sets.${id}.${k}.src` })),
];
const COLS = 3, ROWS = 2;

function frameRect(face, k) {   // [x, y, w, h] on the face picture
  const F = FRAMES[k], P = face.PART_IMG[k], A = F.at(face), [w, h] = F.size, x = Math.round(face.px(A.x + (P.dx ?? 0)) - w / 2);
  return [F.other ? face.faceCanvas.width - x - w : x, Math.round(face.py(A.y + (P.dy ?? 0)) - h / 2), w, h];
}

/** The head (skin only) from straight in front, over exactly the face picture's area, in the bind pose. Returns a canvas. */
function headShot(avatar) {
  const { face, HT } = avatar.internals, { FACE, faceCanvas } = face, W = faceCanvas.width, H = faceCanvas.height;
  const [l, b] = HT.fromHead(FACE.x0, FACE.y0, 0.2), [r, t] = HT.fromHead(FACE.x1, FACE.y1, 0.2);
  const cam = new THREE.OrthographicCamera(l, r, t, b, 0.1, 10); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
  const obj = avatar.object, parent = obj.parent, pos = obj.position.clone(), quat = obj.quaternion.clone();
  const bones = avatar.skeleton.bones.map((x) => [x, x.position.clone(), x.quaternion.clone(), x.scale.clone()]);
  const vis = Object.values(avatar.parts).map((x) => [x, x.m.visible, x.o.visible]), fl = avatar.faceLayer?.visible, el = avatar.earLine?.visible;
  const scene = new THREE.Scene(), renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0xffffff, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8b8, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(1.5, 3, 2.2); scene.add(sun);
    scene.add(obj); obj.position.set(0, 0, 0); obj.quaternion.identity(); avatar.skeleton.pose(); obj.updateMatrixWorld(true);
    for (const x of Object.values(avatar.parts)) { x.m.visible = x === avatar.parts.body; x.o.visible = false; }
    if (avatar.faceLayer) avatar.faceLayer.visible = false; if (avatar.earLine) avatar.earLine.visible = false;
    renderer.render(scene, cam);
    const shot = document.createElement("canvas"); shot.width = W; shot.height = H; shot.getContext("2d").drawImage(renderer.domElement, 0, 0);
    return shot;
  } finally {
    for (const [x, p, q, s] of bones) { x.position.copy(p); x.quaternion.copy(q); x.scale.copy(s); }
    for (const [x, m, o] of vis) { x.m.visible = m; x.o.visible = o; }
    if (avatar.faceLayer) avatar.faceLayer.visible = fl; if (avatar.earLine) avatar.earLine.visible = el;
    obj.position.copy(pos); obj.quaternion.copy(quat); if (parent) parent.add(obj); else scene.remove(obj);
    renderer.dispose(); renderer.forceContextLoss();
  }
}

/** Where every frame is on a template: [{ tile, frame, path, x, y, w, h }] (px on the template). kind as in faceSheet. */
export function sheetLayout(avatar, { kind = "sheet" } = {}) {
  const { face } = avatar.internals, W = face.faceCanvas.width, H = face.faceCanvas.height, out = [];
  (kind === "sheet" ? SHEET_TILES : SHEET_TILES.slice(0, 1)).forEach((T, i) => { const ox = kind === "sheet" ? (i % COLS) * W : 0, oy = kind === "sheet" ? Math.floor(i / COLS) * H : 0;
    for (const k of T.frames) { const [x, y, w, h] = frameRect(face, k); out.push({ tile: T.id, frame: k, path: T.path(k), x: ox + x, y: oy + y, w, h }); } });
  return out;
}

/** The code-drawn face of an expression, on its own (the avatar's face is drawn back afterwards). */
function codeFace(avatar, expr) {
  const { face } = avatar.internals, c = document.createElement("canvas"); c.width = face.faceCanvas.width; c.height = face.faceCanvas.height;
  face.drawParts({ ...avatar.faceSel, ...EXPRESSIONS[expr].parts, nose: "none" }); c.getContext("2d").drawImage(face.faceCanvas, 0, 0); avatar.drawFace();
  return c;
}

/** One tile: the head, the guide face (faint), the frames (red; a dashed grey one where the other side is drawn for you), a title. */
function drawTile(g, avatar, head, tile, lang, title) {
  const { face } = avatar.internals, W = face.faceCanvas.width, H = face.faceCanvas.height;
  g.drawImage(head, 0, 0); g.globalAlpha = 0.35; g.drawImage(codeFace(avatar, tile.guide), 0, 0); g.globalAlpha = 1;
  g.font = "bold 18px sans-serif"; g.textBaseline = "bottom";
  for (const k of tile.frames) { const [x, y, w, h] = frameRect(face, k), F = FRAMES[k], name = tile.id === "sleeping" && k === "eye" ? (lang === "ja" ? "とじた目" : "Closed eye") : F.label[lang === "ja" ? 0 : 1];
    g.setLineDash([]); g.lineWidth = 3; g.strokeStyle = "#ff3b6b"; g.strokeRect(x, y, w, h); g.fillStyle = "#ff3b6b"; g.fillText(lang === "ja" ? `${name}をここに描く` : `Draw the ${name.toLowerCase()} here`, x + 4, y - 3);
    if (F.mirror) { const mx = W - x - w; g.setLineDash([8, 8]); g.lineWidth = 2; g.strokeStyle = "#0006"; g.strokeRect(mx, y, w, h); g.fillStyle = "#0008"; g.fillText(lang === "ja" ? "(描かない: 自動で左右反転)" : "(leave empty: mirrored for you)", mx + 4, y - 3); } }
  g.setLineDash([6, 6]); g.strokeStyle = "#0003"; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);   // the face's middle
  if (title) { g.font = "bold 40px sans-serif"; g.textBaseline = "bottom"; const tw = g.measureText(title).width; g.fillStyle = "#ffffffd0"; g.fillRect(16, H - 74, tw + 28, 58); g.fillStyle = "#2b2230"; g.fillText(title, 30, H - 24); }   // bottom left (clear of the frames)
  g.strokeStyle = "#0002"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
}

/** Make a template. kind "parts" = the ふつう face alone (1024×768) / "sheet" = every drawn expression (3072×1536). Returns a canvas. */
export function faceSheet(avatar, { kind = "sheet", lang = "ja" } = {}) {
  const { face } = avatar.internals, W = face.faceCanvas.width, H = face.faceCanvas.height, head = headShot(avatar), c = document.createElement("canvas"), g = c.getContext("2d");
  if (kind === "parts") { c.width = W; c.height = H; drawTile(g, avatar, head, SHEET_TILES[0], lang, null); return c; }
  c.width = W * COLS; c.height = H * ROWS; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  SHEET_TILES.forEach((T, i) => { g.save(); g.translate((i % COLS) * W, Math.floor(i / COLS) * H); drawTile(g, avatar, head, T, lang, (lang === "ja" ? "絵: " : "Picture: ") + T.name[lang === "ja" ? "ja" : "en"]); g.restore(); });
  { const i = SHEET_TILES.length; g.save(); g.translate((i % COLS) * W, Math.floor(i / COLS) * H); g.fillStyle = "#2b2230"; g.textBaseline = "top";   // the last tile: how to use it
    const lines = lang === "ja" ? ["使い方", "", "・赤い枠の中に、パーツを1つずつ描く", "・枠の真ん中が、顔の上でパーツの真ん中になる", "・目と眉は片側だけ(反対側は左右反転)", "・ふつう以外で描かなかったパーツは、ふつうの絵を使う", "・描いた線だけのレイヤーを、透明な背景のPNGで", "   (この大きさのまま)書き出して「テンプレを読む」", "・透明にできないときは緑のべた塗りで(自動で抜く)", "・描いていない枠は読まない(いまの絵のまま)"]
      : ["How to use", "", "- Draw one part inside each red frame", "- A frame's middle is the part's middle on the face", "- Eyes and brows: one side only (mirrored)", "- Parts left out of an expression use the normal ones", "- Save only your drawing layer as a PNG with a", "   transparent background (this size) and load it", "- No transparency? Use flat green (it is cut out)", "- Empty frames are skipped (the face keeps its parts)"];
    lines.forEach((s, j) => { g.font = j === 0 ? "bold 40px sans-serif" : "26px sans-serif"; g.fillText(s, 40, 40 + j * 56); }); g.restore(); }
  return c;
}

function cutBackground(c, tol = 48) {   // clear the color that runs in from the frame's edges (a flat green cuts cleanest)
  const w = c.width, h = c.height, g = c.getContext("2d"), d = g.getImageData(0, 0, w, h), D = d.data, seen = new Uint8Array(w * h);
  const border = []; for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map((k) => border.map((i) => D[i * 4 + k]).sort((a, b) => a - b)[border.length >> 1]);   // the edge's median color = the background
  const dist = (i) => Math.max(Math.abs(D[i * 4] - bg[0]), Math.abs(D[i * 4 + 1] - bg[1]), Math.abs(D[i * 4 + 2] - bg[2])), green = bg[1] > 150 && bg[1] - Math.max(bg[0], bg[2]) > 80;
  const q = [...border]; while (q.length) { const i = q.pop(); if (seen[i] || dist(i) > tol) continue; seen[i] = 1; D[i * 4 + 3] = 0; const x = i % w; if (x > 0) q.push(i - 1); if (x < w - 1) q.push(i + 1); if (i >= w) q.push(i - w); if (i < w * (h - 1)) q.push(i + w); }
  for (let i = 0; i < w * h; i++) { if (seen[i]) continue; const x = i % w; if ((x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (i >= w && seen[i - w]) || (i < w * (h - 1) && seen[i + w])) { if (green) D[i * 4 + 1] = Math.min(D[i * 4 + 1], Math.max(D[i * 4], D[i * 4 + 2])); D[i * 4 + 3] = Math.min(D[i * 4 + 3], Math.round(255 * Math.min(1, dist(i) / (tol * 2.5)))); } }
  g.putImageData(d, 0, 0); return c;
}

/** Read a drawn template (an Image or canvas, 4:3 = "parts" or 2:1 = "sheet"). Returns { changes: { optionPath: dataURL }, read: [[tileId, frame], …] }
 *  — only the frames with something drawn in them. Put the changes into the options (or a recipe) and rebuild. */
export function readFaceSheet(avatar, im) {
  const { face } = avatar.internals, W = face.faceCanvas.width, H = face.faceCanvas.height, ratio = im.width / im.height;
  const sheet = Math.abs(ratio - COLS * W / (ROWS * H)) < 0.02;
  if (!sheet && Math.abs(ratio - W / H) > 0.02) throw new Error(`not a face template: ${im.width}×${im.height} (want 4:3 or 2:1)`);
  const full = document.createElement("canvas"); full.width = sheet ? W * COLS : W; full.height = sheet ? H * ROWS : H;
  const fg = full.getContext("2d"); fg.drawImage(im, 0, 0, full.width, full.height);   // to the template's own size
  const A = fg.getImageData(0, 0, full.width, full.height).data; let alpha = false; for (let i = 3; i < A.length; i += 4) if (A[i] < 255) { alpha = true; break; }
  const changes = {}, read = [];
  for (const { tile, frame: k, path, x, y, w, h } of sheetLayout(avatar, { kind: sheet ? "sheet" : "parts" })) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const cg = c.getContext("2d");
    if (FRAMES[k].other) { cg.translate(w, 0); cg.scale(-1, 1); }   // drawn on the other eye: flip it to the side the face draws
    cg.drawImage(full, x, y, w, h, 0, 0, w, h);
    const part = alpha ? c : cutBackground(c), D = part.getContext("2d").getImageData(0, 0, w, h).data;
    let ink = 0; for (let j = 3; j < D.length; j += 4) if (D[j] > 24) ink++; if (ink < 20) continue;   // nothing drawn here
    changes[path] = part.toDataURL("image/png"); read.push([tile, k]); }
  return { changes, read, kind: sheet ? "sheet" : "parts" };
}
