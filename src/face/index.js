// Face: parts (eyes, brows, mouth, cheeks) drawn into a canvas texture, shown on a thin copy of the front of the head.
// Parts are code-drawn by default; image parts (img/parts/*.png, see facekit/) are a preset.
import * as THREE from "three";

import { PART_LABELS, EXPRESSIONS, DRAWN_PREFIX, partIds, expressionId } from "./names.js";
import { shaded, pulled } from "../materials.js";
export { PART_LABELS, EXPRESSIONS, DRAWN_PREFIX, partIds, expressionId };

// Eyes that blink (the closed eye is drawn for a moment)
const BLINKS0 = ["round", "sparkle", "classic", "surprised", "glare", "sanpaku", "lidded", "tall", "image"];
const SHUT = { tall: "tallClosed" };   // an eye's own closed eye, drawn while it blinks (the others: "closed")

// Iris colors from one base color: a darker top, the base, two lighter bands toward the bottom (the default's hand-picked steps, as offsets in HSL)
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHsl = ([r, g, b]) => { const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; let h = 0, s = 0;
  if (M !== m) { const d = M - m; s = l > 0.5 ? d / (2 - M - m) : d / (M + m); h = (M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6; } return [h, s, l]; };
const hslHex = ([h, s, l]) => { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return "#" + (s ? [f(h + 1 / 3), f(h), f(h - 1 / 3)] : [l, l, l]).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join(""); };
const IRIS_STEPS = [[0.0145, 1.0356, 0.5665, 0], [0, 0, 0, 1], [-0.0031, 0.1047, 0.3935, 1], [-0.0077, 0.2627, 0.769, 1]];   // [hue shift, saturation, lightness, toward white?]
export function irisColors(base) {
  const [h, s, l] = rgbHsl(hexRgb(base)), sk = Math.min(1, s / 0.15);   // grey eyes stay grey
  return IRIS_STEPS.map(([dh, ks, kl, up]) => hslHex([h + dh * sk, up ? s + (1 - s) * ks * sk : Math.min(1, s * ks), up ? l + (1 - l) * kl : l * kl]));
}

/**
 * OPT: options. FACE_DY: vertical shift of the face picture (shared with the eye sockets).
 * onImage(kind): called when an image part finishes loading (redraw then).
 */
export function createFace(OPT, { FACE_DY, onImage } = {}) {
  const FACE = { x0: -0.2, x1: 0.2, y0: 0.82, y1: 1.12, S: 2560, dy: FACE_DY };   // 顔の絵が受け持つ範囲(体の座標)と、1単位あたりのピクセル数
  const faceCanvas = document.createElement("canvas"); faceCanvas.width = (FACE.x1 - FACE.x0) * FACE.S; faceCanvas.height = (FACE.y1 - FACE.y0) * FACE.S;
  const mainCtx = faceCanvas.getContext("2d"); let fctx = mainCtx;   // (the brows' own picture swaps in while they are drawn: BROWS)
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  // 顔の絵も体と同じ陰影で(光を無視すると暗い場所で目だけ光って見える)。setShading で作り直す
  const faceMatFor = (style, bands = OPT.shading.bands) => Object.assign(shaded(style, 0xffffff, bands), { map: faceTex, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const faceMat = faceMatFor(OPT.shading.style);
  // face.browsOverHair: the brows on their own picture (the layer over the hair must show nothing else), BROWS.up higher on the head than the
  // face picture (a high brow, past its top at 1.12, isn't cut), on a layer drawn BROWS.pull nearer the camera than it is (index.js browLayer)
  const BROWS = OPT.face.browsOverHair ? { up: 0.14, pull: 0.045 } : null;
  if (BROWS) { const c = BROWS.canvas = document.createElement("canvas"); c.width = faceCanvas.width; c.height = faceCanvas.height; BROWS.ctx = c.getContext("2d");
    BROWS.tex = new THREE.CanvasTexture(c); BROWS.tex.colorSpace = THREE.SRGBColorSpace; BROWS.tex.anisotropy = 4; BROWS.frame = { y0: FACE.y0 + BROWS.up, y1: FACE.y1 + BROWS.up }; }
  const browMatFor = (style, bands = OPT.shading.bands) => pulled(Object.assign(shaded(style, 0xffffff, bands), { map: BROWS.tex, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), BROWS.pull);
  // ⏳ face.mouth3d (a try): an open mouth is a hole into a mouth made in 3D (index.js mouthInside), not a picture of its inside: from aside
  // the tongue lies behind the lips, not on the cheek like a sticker. The mouth's shape goes on HOLE's own picture; a layer drawn from it marks
  // the pixels (stencil bit 4: the hair takes 1 and 2, index.js) where the inside shows through the head. The lips' lines stay on the face's picture, over it
  const HOLE = OPT.face.mouth3d?.on ? {} : null;
  if (HOLE) { const c = HOLE.canvas = document.createElement("canvas"); c.width = faceCanvas.width; c.height = faceCanvas.height; HOLE.ctx = c.getContext("2d"); HOLE.tex = new THREE.CanvasTexture(c);
    HOLE.mat = new THREE.MeshBasicMaterial({ map: HOLE.tex, alphaTest: 0.5, colorWrite: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      stencilWrite: true, stencilRef: 4, stencilWriteMask: 4, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }); }
  const hole = (shape) => { const c = fctx; fctx = HOLE.ctx; fctx.setTransform(c.getTransform()); shape(); fctx.fillStyle = "#fff"; fctx.fill(); fctx = c; };
  const px = (x) => (x - FACE.x0) * FACE.S, py = (y) => (FACE.y1 - y - FACE.dy) * FACE.S, pu = (d) => d * FACE.S;   // 体の座標 → 絵のピクセル
  const INK0 = "#3a2632", MOUTH = "#b8475e";
  // face.lashTrace: the ink toward a dark of the hair's color (warm: a pale or grey hair still gives a brown), by its amount
  const traced = (c, warm = 0) => { const t = OPT.face.lashTrace ?? 0; if (!t) return c; const a = hexRgb(c), [h, s] = rgbHsl(hexRgb(OPT.colors.hair)), k = Math.min(1, s / 0.2);
    const b = hexRgb(hslHex([(h * k + 0.05 * (1 - k)) * (1 - warm) + 0.02 * warm, Math.min(0.6, Math.max(0.3, s)), 0.24 + 0.16 * warm]));
    return "#" + a.map((v, i) => Math.round((v + (b[i] - v) * t) * 255).toString(16).padStart(2, "0")).join("") + c.slice(7); };
  const ink = () => traced(INK0);
  // the other lines (brows, lids, mouth) toward the skin's line color (as outline.trace's on the skin), each keeping its own lightness
  const skinInk = (c) => { const t = OPT.face.lashTrace ?? 0; if (!t) return c; const a = hexRgb(c), [h, s] = rgbHsl(hexRgb(OPT.colors.skin)), b = hexRgb(hslHex([h, Math.min(s, 0.5), Math.max(rgbHsl(a)[2], 0.27)]));
    return "#" + a.map((v, i) => Math.round((v + (b[i] - v) * t) * 255).toString(16).padStart(2, "0")).join("") + c.slice(7); };
  const LAY = { eyeSize: OPT.face.eyeSize };   // 目の大きさ(コードで描く目)。あとから setLayout で変えられる
  const EYE_COL = irisColors(OPT.colors.eyes);   // 虹彩の色(上の暗い色 → 下の明るい色)。setEyeColor で変えられる
  // 目・眉・ほっぺはキャラの左側(+x)を描き、右側は左右反転して写す
  const FL = OPT.face.layout, EYE = { x: FL.eyeX, y: FL.eyeY }, BROW = { x: FL.browX, y: FL.browY }, MOUTHP = { x: 0, y: FL.mouthY }, CHEEK = { x: 0.152, y: 0.955 };   // 顔の絵の上の位置(体の座標)
  const line = (w, c = INK0, tr = skinInk) => { fctx.lineWidth = pu(w); fctx.strokeStyle = tr(c); fctx.lineCap = "round"; fctx.lineJoin = "round"; };
  // the lash of the tall eyes on the current path: solid, or (face.lashHatch) a pale opaque fill (the iris must not show through) with short
  // strokes laid along the lash's curve (an arc round the eye: they tilt down toward its ends) and a thin edge, like a pencil drawing's
  const lashFill = (c0 = "#3f3a52") => { const c = traced(c0);
    if (!OPT.face.lashHatch) { fctx.fillStyle = c;   // lashTrace: redder and lighter toward the outer corner
      if (OPT.face.lashTrace) { const g = fctx.createLinearGradient(px(EYE.x), 0, px(EYE.x + 0.064 * LAY.eyeSize), 0); g.addColorStop(0, c); g.addColorStop(1, traced(c0, 1)); fctx.fillStyle = g; }
      fctx.fill(); return; }
    // the ground is opaque (a half-tint of c over skin) so the iris under the lash can't show through
    const half = "#" + hexRgb(c).map((v, i) => Math.round((v + [0.95, 0.86, 0.84][i]) / 2 * 255).toString(16).padStart(2, "0")).join("");
    fctx.fillStyle = half; fctx.fill(); fctx.save(); fctx.clip(); const h = new Path2D(), W = fctx.canvas.width, H = fctx.canvas.height, d = pu(0.0034);
    for (let t = -H; t < W; t += d) { h.moveTo(t, H); h.lineTo(t + H * 0.6, 0); } fctx.lineWidth = pu(0.0011); fctx.strokeStyle = c; fctx.stroke(h); fctx.restore();
    fctx.lineWidth = pu(0.0012); fctx.strokeStyle = c; fctx.lineJoin = "round"; fctx.stroke(); };
  const ell = (x, y, rx, ry, fill) => { fctx.beginPath(); fctx.ellipse(px(x), py(y), pu(rx), pu(ry), 0, 0, Math.PI * 2); fctx.fillStyle = fill; fctx.fill(); };
  const lash = (m, x, y, rx, lift) => { line(0.0075, INK0, traced); fctx.beginPath(); fctx.moveTo(px(x - m * rx * 1.05), py(y - 0.004)); fctx.quadraticCurveTo(px(x), py(y + lift), px(x + m * rx * 1.15), py(y - 0.002)); fctx.lineTo(px(x + m * rx * 1.35), py(y + 0.006)); fctx.stroke(); };
  // 描いてもらったパーツの絵(片側ぶん。右側は左右反転して使う)。下絵と切り出しは facekit/(face-template.psd → cut_face_parts.py)。w: 顔の上での横幅(0なら原寸 = 下絵と同じ1px) / dx, dy: 基準点からのずらし
  const PART_IMG = { eye: { src: OPT.face.images.eye.src ?? new URL("../../img/parts/eye.png", import.meta.url).href, w: OPT.face.images.eye.width, dx: OPT.face.images.eye.dx, dy: OPT.face.images.eye.dy }, eyeClosed: { src: OPT.face.images.eyeClosed?.src ?? null, w: OPT.face.images.eyeClosed?.width ?? 0, dx: OPT.face.images.eyeClosed?.dx ?? 0.004, dy: OPT.face.images.eyeClosed?.dy ?? 0.004 }, brow: { src: OPT.face.images.brow.src ?? new URL("../../img/parts/brow.png", import.meta.url).href, w: OPT.face.images.brow.width, dx: OPT.face.images.brow.dx, dy: OPT.face.images.brow.dy }, mouth: { src: OPT.face.images.mouth.src ?? new URL("../../img/parts/mouth.png", import.meta.url).href, w: OPT.face.images.mouth.width, dx: 0, dy: OPT.face.images.mouth.dy },
    nose: { src: OPT.face.images.nose?.src ?? null, w: OPT.face.images.nose?.width ?? 0, dx: 0, dy: OPT.face.images.nose?.dy ?? 0 } };   // nose: no picture unless one is given
  // eyeL: the other eye's own picture (drawn in the template's frame on that side; placed as the eye is, mirrored across the face, the picture
  // itself not flipped). Without one the eye is mirrored (2026-10-07, Saori: odd eyes, a highlight on one side)
  PART_IMG.eyeL = { ...PART_IMG.eye, src: OPT.face.images.eyeL?.src ?? null };
  const NOSEP = { x: 0, y: 0.929 + OPT.body.sculpt.nose.lift - FACE.dy };   // the nose tip on the face picture (head space, same as the tip in body/index.js)
  // the character's drawn expressions (face.drawn): their own eye / brow / mouth, placed like the ふつう ones ("eye@<id>" …)
  const DRAWN = (OPT.face.drawn ?? []).filter((d) => d && d.id != null), BLINKS = new Set([...BLINKS0, ...DRAWN.filter((d) => d.blink !== false).map((d) => DRAWN_PREFIX + d.id)]);
  for (const d of DRAWN) for (const k of ["eye", "eyeL", "brow", "mouth"]) PART_IMG[`${k}@${d.id}`] = { ...PART_IMG[k], src: d[k] ?? null };
  for (const k in PART_IMG) { if (!PART_IMG[k].src) continue; const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { PART_IMG[k].img = im; onImage?.(k); }; im.src = PART_IMG[k].src; }
  const TINT = new Map();   // drawn part → [ink, canvas]: its darks lifted to the traced ink ("lighten"), its own alpha kept
  const tinted = (img) => { const c = ink(); if (c === INK0) return img; const hit = TINT.get(img); if (hit?.[0] === c) return hit[1];
    const cv = document.createElement("canvas"), x = cv.getContext("2d"); cv.width = img.width; cv.height = img.height; x.drawImage(img, 0, 0); x.globalCompositeOperation = "lighten"; x.fillStyle = c; x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = "destination-in"; x.drawImage(img, 0, 0); TINT.set(img, [c, cv]); return cv; };
  const imgPart = (k, x, y) => { const p = PART_IMG[k]; if (!p.img) return; const w = p.w ? pu(p.w) : p.img.width, h = w * p.img.height / p.img.width; fctx.drawImage(tinted(p.img), px(x + p.dx) - w / 2, py(y + p.dy) - h / 2, w, h); };   // 基準点に絵の真ん中を合わせる
  const imgOr = (keys, x, y) => { const k = keys.find((q) => PART_IMG[q]?.img); if (k) imgPart(k, x, y); return !!k; };   // the first of these pictures that is loaded
  const PARTS = {
    eyes: {
      image: () => imgPart("eye", EYE.x, EYE.y),
      imageClosed: () => imgPart("eyeClosed", EYE.x, EYE.y),   // a drawn closed eye (also used for blinking drawn eyes)
      round: () => {   // アニメの目: 白目・虹彩(上が暗く下が明るい)・瞳・ハイライト・太い上まつげ(目じりで跳ねる)・二重の線・下まぶた
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        const IR = EYE_COL; fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));   // 大きさは LAY.eyeSize で
        // 目の形(白目)
        const open = () => { fctx.beginPath(); mv(-0.033, 0.0); bz(-0.03, 0.03, 0.012, 0.042, 0.042, 0.016); bz(0.042, -0.012, 0.022, -0.038, -0.002, -0.038); bz(-0.02, -0.038, -0.034, -0.02, -0.033, 0.0); fctx.closePath(); };
        open(); { const g = fctx.createLinearGradient(...P(0, 0.04), ...P(0, -0.03)); g.addColorStop(0, "#c9c6cf"); g.addColorStop(0.35, "#f3f1f2"); g.addColorStop(1, "#fbfafa"); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); open(); fctx.clip();
        // 虹彩
        const ir = () => { fctx.beginPath(); fctx.ellipse(...P(-0.001, -0.003), pu(0.027), pu(0.037), 0, 0, Math.PI * 2); };
        ir(); { const g = fctx.createLinearGradient(...P(0, 0.034), ...P(0, -0.04)); g.addColorStop(0, IR[0]); g.addColorStop(0.42, IR[1]); g.addColorStop(0.78, IR[2]); g.addColorStop(1, IR[3]); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); ir(); fctx.clip();
        ell(cx - 0.001, cy - 0.03, 0.022, 0.016, IR[3] + "c0");                                   // 下の明るい三日月
        ell(cx - 0.001, cy + 0.03, 0.03, 0.022, IR[0] + "b0");                                    // 上まつげの影
        fctx.restore();
        ell(cx - 0.001, cy + 0.0, 0.0085, 0.014, "#2a1c22");                                      // 瞳
        line(0.0024, "#2b2533"); ir(); fctx.stroke();                                              // 虹彩のふち
        fctx.restore();
        // 下まぶた(細い線、目じり寄り)
        line(0.0022, "#6a4c50"); fctx.beginPath(); mv(0.006, -0.0375); qc(0.03, -0.034, 0.04, -0.012); fctx.stroke();
        // 上まつげ(内側は細く、目じりへ太く、最後に外へ跳ねる)
        fctx.beginPath(); mv(-0.035, -0.002); bz(-0.031, 0.031, 0.012, 0.045, 0.043, 0.02); qc(0.05, 0.012, 0.056, 0.0); qc(0.047, 0.006, 0.04, 0.009);
        bz(0.012, 0.034, -0.026, 0.024, -0.033, 0.002); fctx.closePath(); fctx.fillStyle = "#3a2830"; fctx.fill();
        // 二重の線
        line(0.0028, "#c98c80"); fctx.beginPath(); mv(-0.016, 0.046); qc(0.012, 0.056, 0.036, 0.04); fctx.stroke();
        // ハイライト
        ell(cx - 0.012, cy + 0.014, 0.0085, 0.0085, "#ffffff"); ell(cx + 0.012, cy - 0.018, 0.0035, 0.0035, "#ffffffe0"); ell(cx - 0.004, cy + 0.002, 0.0022, 0.0022, "#ffffffd0");
        fctx.restore();
      },
      // キラキラ目 (2026-10-07, for a 超絶美少女): the round eye's build, dressed up — an almond eye lifted at the outer corner, a bigger iris
      // with fibers, a dark band under the lid and a glowing crescent at the bottom, a pupil with its own ring, highlights (a big one, a star
      // glint, small dots), a winged upper lash with spikes, lower lashes, a soft eyeshadow at the outer corner
      sparkle: () => {
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), ln = (x, y) => fctx.lineTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        const dot = (x, y, rx, ry, fill, rot = 0) => { fctx.beginPath(); fctx.ellipse(...P(x, y), pu(rx), pu(ry), rot, 0, Math.PI * 2); fctx.fillStyle = fill; fctx.fill(); };
        const glow = (x, y, rx, ry, col, a) => { const g = fctx.createRadialGradient(...P(x, y), 0, ...P(x, y), pu(rx)); g.addColorStop(0, col + a); g.addColorStop(1, col + "00");
          fctx.save(); fctx.translate(...P(x, y)); fctx.scale(1, ry / rx); fctx.translate(-px(cx + x), -py(cy + y)); fctx.fillStyle = g; fctx.fillRect(px(cx + x - rx), py(cy + y + rx), pu(rx * 2), pu(rx * 2)); fctx.restore(); };
        const IR = EYE_COL; fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        glow(0.026, 0.03, 0.036, 0.02, "#f59ab0", "55");                                                   // eyeshadow over the outer corner
        const open = () => { fctx.beginPath(); mv(-0.034, -0.002); bz(-0.03, 0.032, 0.014, 0.046, 0.047, 0.02); bz(0.046, -0.014, 0.024, -0.041, -0.002, -0.041); bz(-0.022, -0.041, -0.036, -0.022, -0.034, -0.002); fctx.closePath(); };
        open(); { const g = fctx.createLinearGradient(...P(0, 0.042), ...P(0, -0.04)); g.addColorStop(0, "#c4bdd2"); g.addColorStop(0.32, "#f1eff4"); g.addColorStop(1, "#fdfcfd"); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); open(); fctx.clip();
        const ir = () => { fctx.beginPath(); fctx.ellipse(...P(0.002, -0.003), pu(0.0295), pu(0.04), 0, 0, Math.PI * 2); };
        ir(); { const g = fctx.createLinearGradient(...P(0, 0.037), ...P(0, -0.043)); g.addColorStop(0, IR[0]); g.addColorStop(0.4, IR[1]); g.addColorStop(0.75, IR[2]); g.addColorStop(1, IR[3]); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); ir(); fctx.clip();
        fctx.lineCap = "round"; fctx.lineWidth = pu(0.0011); fctx.strokeStyle = IR[3] + "48";                // fibers, out from the pupil
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + 0.1, r0 = 0.011 + (i % 3) * 0.002, r1 = 0.026 - (i % 2) * 0.004; fctx.beginPath(); mv(0.002 + Math.cos(a) * r0, -0.003 + Math.sin(a) * r0 * 1.35); ln(0.002 + Math.cos(a) * r1, -0.003 + Math.sin(a) * r1 * 1.35); fctx.stroke(); }
        glow(0.002, -0.029, 0.026, 0.016, IR[3].slice(0, 7), "e0");                                         // the glowing crescent at the bottom
        line(0.0016, IR[2] + "70"); fctx.beginPath(); fctx.ellipse(...P(0.002, -0.004), pu(0.019), pu(0.027), 0, 0, Math.PI * 2); fctx.stroke();   // an inner ring
        dot(0.002, 0.03, 0.036, 0.026, IR[0] + "c8");                                                      // the lid's shadow over the top
        dot(0.002, 0.04, 0.04, 0.016, "#1a1028a0");
        fctx.restore();
        { const g = fctx.createRadialGradient(...P(0.002, -0.001), 0, ...P(0.002, -0.001), pu(0.014)); g.addColorStop(0, "#120a1a"); g.addColorStop(0.75, "#22142e"); g.addColorStop(1, "#22142e00");   // the pupil
          fctx.save(); fctx.translate(...P(0.002, -0.001)); fctx.scale(0.66, 1); fctx.translate(-px(cx + 0.002), -py(cy - 0.001)); fctx.fillStyle = g; fctx.fillRect(px(cx - 0.012), py(cy + 0.013), pu(0.028), pu(0.028)); fctx.restore(); }
        line(0.0022, "#2a1c36"); ir(); fctx.stroke();                                                      // the iris's rim
        { const g = fctx.createLinearGradient(...P(0, 0.046), ...P(0, 0.018)); g.addColorStop(0, "#5a4a6a90"); g.addColorStop(1, "#5a4a6a00"); open(); fctx.fillStyle = g; fctx.fill(); }   // the lid's shadow on the white
        fctx.restore();
        // lower lashes: a thin line toward the outer corner, two short ticks on it (longer ones, off the line, read as whiskers: Saori's
        // picture with smaller eyes)
        line(0.002, "#6e4c62"); fctx.beginPath(); mv(0.002, -0.0425); qc(0.032, -0.04, 0.046, -0.012); fctx.stroke();
        line(0.0015, "#6e4c62"); fctx.beginPath(); mv(0.035, -0.0315); ln(0.0375, -0.035); mv(0.0415, -0.0225); ln(0.0447, -0.0252); fctx.stroke();
        // upper lash: thin at the inner corner, thick toward the outer, a wing and spikes
        fctx.beginPath(); mv(-0.037, -0.004); bz(-0.033, 0.035, 0.014, 0.051, 0.048, 0.023);
        qc(0.054, 0.03, 0.06, 0.033); qc(0.054, 0.024, 0.053, 0.019);                                      // a spike up
        qc(0.059, 0.014, 0.066, 0.005); qc(0.056, 0.008, 0.046, 0.011);                                    // the wing
        bz(0.014, 0.037, -0.026, 0.027, -0.035, 0.0); fctx.closePath(); fctx.fillStyle = "#2a1a2c"; fctx.fill();
        fctx.beginPath(); mv(0.022, 0.041); qc(0.032, 0.05, 0.041, 0.053); qc(0.034, 0.045, 0.031, 0.04); fctx.closePath(); fctx.fill();   // two lashes standing up
        fctx.beginPath(); mv(0.035, 0.036); qc(0.045, 0.043, 0.054, 0.044); qc(0.046, 0.037, 0.043, 0.032); fctx.closePath(); fctx.fill();
        line(0.0026, "#c98a8e"); fctx.beginPath(); mv(-0.014, 0.053); qc(0.014, 0.063, 0.042, 0.046); fctx.stroke();   // the double lid
        // highlights: a big one, a four-pointed glint, small dots
        dot(-0.01, 0.014, 0.0088, 0.0112, "#ffffff", -0.35);
        { const sx = 0.013, sy = 0.012, r = 0.0075, w = 0.0016; fctx.beginPath(); mv(sx, sy + r); qc(sx + w, sy + w, sx + r, sy); qc(sx + w, sy - w, sx, sy - r); qc(sx - w, sy - w, sx - r, sy); qc(sx - w, sy + w, sx, sy + r); fctx.closePath(); fctx.fillStyle = "#fffffff0"; fctx.fill(); }
        dot(0.012, -0.02, 0.0042, 0.0042, "#ffffffe0"); dot(-0.007, -0.013, 0.0018, 0.0018, "#ffffffc0"); dot(0.018, -0.006, 0.0013, 0.0013, "#ffffffb0");
        fctx.restore();
      },
      classic: (m) => { const { x, y } = EYE, rx = 0.035, ry = 0.047, IR = EYE_COL;   // ひとつ前の、塗りつぶしの丸い目。色は目の色(上が暗く下が明るい。2026-10-09 サオリ「くりくりにも色を」)
        const g = fctx.createLinearGradient(0, py(y + ry), 0, py(y - ry)); g.addColorStop(0, IR[0]); g.addColorStop(0.55, IR[1]); g.addColorStop(1, IR[3]);
        ell(x, y, rx, ry, g); ell(x, y - 0.004, rx * 0.5, ry * 0.55, "#21141d");
        ell(x - 0.012, y + 0.019, 0.011, 0.014, "#fff"); ell(x + 0.014, y - 0.019, 0.005, 0.005, "#ffffffd8");
        lash(m, x, y + ry * 0.92, rx, 0.012); },
      sanpaku: () => {   // 三白眼(2026-10-09 サオリ): 切れ長の白目に 小さな虹彩が上まぶたへ寄る = 下と左右に白目が見える。太い上まつげ・下まぶたの線
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        const IR = EYE_COL; fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        const open = () => { fctx.beginPath(); mv(-0.034, 0.002); bz(-0.03, 0.028, 0.012, 0.036, 0.044, 0.014); bz(0.044, -0.01, 0.022, -0.03, -0.002, -0.03); bz(-0.02, -0.03, -0.034, -0.016, -0.034, 0.002); fctx.closePath(); };
        open(); { const g = fctx.createLinearGradient(...P(0, 0.034), ...P(0, -0.03)); g.addColorStop(0, "#cfcbd3"); g.addColorStop(0.4, "#f3f1f2"); g.addColorStop(1, "#fbfafa"); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); open(); fctx.clip();
        const ir = () => { fctx.beginPath(); fctx.ellipse(...P(0.001, 0.01), pu(0.0165), pu(0.021), 0, 0, Math.PI * 2); };
        ir(); { const g = fctx.createLinearGradient(...P(0, 0.031), ...P(0, -0.011)); g.addColorStop(0, IR[0]); g.addColorStop(0.45, IR[1]); g.addColorStop(0.8, IR[2]); g.addColorStop(1, IR[3]); fctx.fillStyle = g; fctx.fill(); }
        ell(cx + 0.001, cy + 0.01, 0.0065, 0.009, "#2a1c22");                                     // 瞳
        line(0.0022, "#2b2533"); ir(); fctx.stroke();
        ell(cx - 0.006, cy + 0.018, 0.0045, 0.0045, "#ffffff");                                   // ハイライト(小さく)
        fctx.restore();
        line(0.0026, "#6a4c50"); fctx.beginPath(); mv(-0.022, -0.027); qc(0.012, -0.035, 0.041, -0.008); fctx.stroke();   // 下まぶた(長め)
        fctx.beginPath(); mv(-0.036, 0.0); bz(-0.031, 0.027, 0.012, 0.04, 0.045, 0.018); qc(0.052, 0.01, 0.058, -0.002); qc(0.049, 0.005, 0.042, 0.008);   // 上まつげ(平たく、目じりで跳ねる)
        bz(0.012, 0.029, -0.026, 0.02, -0.034, 0.0); fctx.closePath(); fctx.fillStyle = "#3a2830"; fctx.fill();
        fctx.restore();
      },
      happy: (m) => { const { x, y } = EYE; line(0.0075); fctx.beginPath(); fctx.moveTo(px(x - 0.028), py(y - 0.012)); fctx.quadraticCurveTo(px(x), py(y + 0.028), px(x + 0.028), py(y - 0.012)); fctx.stroke(); },
      closed: (m) => { const { x, y } = EYE; line(0.007); fctx.beginPath(); fctx.moveTo(px(x - 0.028), py(y - 0.002)); fctx.quadraticCurveTo(px(x), py(y - 0.026), px(x + 0.028), py(y - 0.002)); fctx.stroke();
        fctx.beginPath(); fctx.moveTo(px(x + m * 0.028), py(y - 0.002)); fctx.lineTo(px(x + m * 0.036), py(y + 0.004)); fctx.stroke(); },
      surprised: (m) => { const { x, y } = EYE; ell(x, y, 0.027, 0.04, "#fff"); line(0.003); fctx.beginPath(); fctx.ellipse(px(x), py(y), pu(0.027), pu(0.04), 0, 0, Math.PI * 2); fctx.stroke();
        ell(x, y - 0.002, 0.012, 0.016, ink()); ell(x - 0.004, y + 0.004, 0.004, 0.005, "#fff"); lash(m, x, y + 0.04, 0.027, 0.012); },
      glare: (m) => { const { x, y } = EYE, rx = 0.03, ry = 0.041; fctx.save(); fctx.beginPath(); fctx.rect(0, py(y + 0.006), faceCanvas.width, faceCanvas.height); fctx.clip();
        ell(x, y, rx, ry, "#3a2632"); ell(x + 0.012, y - 0.016, 0.0045, 0.0045, "#ffffffd8"); fctx.restore();
        line(0.0075); fctx.beginPath(); fctx.moveTo(px(x - m * rx * 1.1), py(y + 0.006)); fctx.lineTo(px(x + m * rx * 1.25), py(y + 0.008)); fctx.stroke(); },
      // 半目 (2026-10-10, Saori: 島風's eyes "もっとジト目っぽくてハイライトが下のほうについてる"): the round eye's build with the upper lid
      // low and nearly straight, rising a little to the outer corner, over the iris's top third; the iris dark under the lid and lighter
      // toward the bottom, where the highlights are (a flat oval and a dot), a small pupil
      lidded: () => {
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        const dot = (x, y, rx, ry, fill, rot = 0) => { fctx.beginPath(); fctx.ellipse(...P(x, y), pu(rx), pu(ry), rot, 0, Math.PI * 2); fctx.fillStyle = fill; fctx.fill(); };
        const IR = EYE_COL; fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        const TOP = 0.012;   // the upper lid's height over the eye's middle (the round eye's top is at 0.042)
        const open = () => { fctx.beginPath(); mv(-0.035, -0.004); qc(-0.012, TOP + 0.004, 0.044, TOP + 0.006); bz(0.046, -0.01, 0.026, -0.036, 0.0, -0.036); bz(-0.02, -0.036, -0.034, -0.02, -0.035, -0.004); fctx.closePath(); };
        open(); { const g = fctx.createLinearGradient(...P(0, TOP), ...P(0, -0.036)); g.addColorStop(0, "#bdb8c4"); g.addColorStop(0.4, "#f1eff2"); g.addColorStop(1, "#fbfafa"); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); open(); fctx.clip();
        const ir = () => { fctx.beginPath(); fctx.ellipse(...P(0.003, -0.007), pu(0.026), pu(0.033), 0, 0, Math.PI * 2); };
        ir(); { const g = fctx.createLinearGradient(...P(0, TOP), ...P(0, -0.04)); g.addColorStop(0, IR[0]); g.addColorStop(0.45, IR[0]); g.addColorStop(0.8, IR[1]); g.addColorStop(1, IR[2]); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); ir(); fctx.clip();
        dot(0.003, -0.034, 0.018, 0.009, IR[2] + "a0");                                  // a lighter crescent at the bottom (dark eyes: only a little lighter)
        dot(0.003, TOP + 0.004, 0.034, 0.016, IR[0] + "c0");                              // the lid's shadow over the top
        fctx.restore();
        dot(0.003, -0.006, 0.0075, 0.011, "#241a2278");                                   // the pupil, faint (the iris is dark at the top anyway)
        line(0.0022, "#2b2533"); ir(); fctx.stroke();                                     // the iris's rim
        dot(-0.007, -0.025, 0.0055, 0.0032, "#ffffffe8", 0.2);                            // highlights, small and low in the iris, toward the nose
        dot(0.012, -0.03, 0.0022, 0.0022, "#ffffffb0");
        fctx.restore();
        line(0.0021, "#6a4c50"); fctx.beginPath(); mv(0.008, -0.036); qc(0.032, -0.032, 0.043, -0.01); fctx.stroke();   // the lower lid, toward the outer corner
        // the upper lash along the low lid: thin at the inner corner, thick to the outer, a short flick down and out
        fctx.beginPath(); mv(-0.037, -0.005); qc(-0.012, TOP + 0.01, 0.046, TOP + 0.012); qc(0.049, TOP + 0.006, 0.051, TOP - 0.004); qc(0.046, TOP - 0.002, 0.043, TOP + 0.001);
        qc(-0.012, TOP - 0.006, -0.034, -0.003); fctx.closePath(); fctx.fillStyle = "#33242a"; fctx.fill();
        line(0.0018, "#c98c80b0"); fctx.beginPath(); mv(-0.012, TOP + 0.013); qc(0.014, TOP + 0.018, 0.038, TOP + 0.017); fctx.stroke();   // the lid's crease, close over it
        fctx.restore();
      },
      // たて長の目 (シルヴィ's design sheet): flat colors, no rim. A thick lash across the top, sloping down to the outer corner and hanging
      // there as a wing (a drooping eye); a tall iris with rounded lower corners, darker under the lid, a lighter zone below the pupil with a
      // pale box in it; the white shows beside it. ⛔ Its proportions are Saori's choice: don't refit them to the sheet (the sheet's eye is smaller)
      tall: () => {
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), ln = (x, y) => fctx.lineTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        const box = (x0, y0, x1, y1, r, fill) => { const [ax, ay] = P(x0, y1), [bx, by] = P(x1, y0), q = pu(r); fctx.beginPath(); fctx.moveTo(ax + q, ay); fctx.arcTo(bx, ay, bx, by, q); fctx.arcTo(bx, by, ax, by, q); fctx.arcTo(ax, by, ax, ay, q); fctx.arcTo(ax, ay, bx, ay, q); fctx.closePath(); fctx.fillStyle = fill; fctx.fill(); };   // (arcTo: Safari 15 has no roundRect)
        const tint = (c, t) => "#" + hexRgb(c).map((v) => Math.round((v + (1 - v) * t) * 255).toString(16).padStart(2, "0")).join("");
        const flip = fctx.getTransform().a < 0, hx = flip ? 1 : -1;   // the highlight stays on the same side of both eyes (the light's side), not mirrored
        const IR = EYE_COL; fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        const open = () => { fctx.beginPath(); mv(-0.033, 0.03); qc(0.0, 0.04, 0.038, 0.032); bz(0.055, 0.012, 0.044, -0.03, 0.022, -0.043); qc(0.0, -0.048, -0.022, -0.043); bz(-0.031, -0.032, -0.035, 0.0, -0.033, 0.03); fctx.closePath(); };
        open(); { const g = fctx.createLinearGradient(...P(0, 0.034), ...P(0, -0.02)); g.addColorStop(0, "#cfc9d2"); g.addColorStop(0.45, "#eeebee"); g.addColorStop(1, "#fbfafa"); fctx.fillStyle = g; fctx.fill(); }
        fctx.save(); open(); fctx.clip();
        const ir = () => { fctx.beginPath(); mv(-0.028, 0.04); ln(0.028, 0.04); bz(0.031, 0.0, 0.03, -0.045, 0.011, -0.045); ln(-0.011, -0.045); bz(-0.03, -0.045, -0.031, 0.0, -0.028, 0.04); fctx.closePath(); };
        ir(); fctx.fillStyle = IR[1]; fctx.fill();
        fctx.save(); ir(); fctx.clip();
        fctx.beginPath(); mv(-0.04, 0.045); ln(0.04, 0.045); ln(0.04, 0.02); qc(0.0, 0.01, -0.04, 0.02); fctx.closePath(); fctx.fillStyle = IR[0] + "66"; fctx.fill();   // darker under the lid
        fctx.beginPath(); mv(-0.04, -0.006); bz(-0.02, -0.01, -0.014, 0.004, 0.0, 0.004); bz(0.014, 0.004, 0.02, -0.01, 0.04, -0.006); ln(0.04, -0.05); ln(-0.04, -0.05); fctx.closePath(); fctx.fillStyle = tint(IR[1], 0.27); fctx.fill();   // the lighter zone
        box(-0.016, -0.052, 0.016, -0.02, 0.009, tint(IR[1], 0.6)); box(-0.0095, -0.052, 0.0095, -0.027, 0.006, tint(IR[1], 0.78));   // the pale box at the bottom
        fctx.restore();
        ell(cx, cy + 0.004, 0.0052, 0.0125, IR[0]); ell(cx, cy + 0.004, 0.0052, 0.0125, "#20282a60");   // the pupil: the iris's dark, not black
        fctx.restore();
        ell(cx + hx * 0.0245, cy + 0.02, 0.005, 0.0042, "#ffffff"); ell(cx + hx * 0.026, cy - 0.029, 0.0016, 0.0016, "#ffffff"); ell(cx - hx * 0.026, cy - 0.026, 0.0016, 0.0016, "#ffffffe0");
        // the lash: its inner end cut aslant, highest over the inner half and sloping down to the outer corner (a drooping eye), where it
        // hangs down and out as a wing, a tick out of its edge
        fctx.beginPath(); mv(-0.042, 0.02); qc(-0.04, 0.036, -0.031, 0.043); bz(-0.012, 0.0525, 0.016, 0.05, 0.036, 0.04); qc(0.047, 0.033, 0.054, 0.022); ln(0.064, 0.019); ln(0.057, 0.013);
        qc(0.062, 0.003, 0.062, -0.01); bz(0.055, 0.0, 0.046, 0.012, 0.034, 0.022); qc(0.004, 0.037, -0.033, 0.026); fctx.closePath(); lashFill();
        line(0.0016, "#8f7f8a90"); fctx.beginPath(); mv(-0.02, 0.06); qc(0.002, 0.065, 0.026, 0.056); fctx.stroke();   // the lid's crease
        fctx.restore();
      },
      // たて長の目のとじ目 (シルヴィ's design sheet): the lash as a thick bar low in the eye (where the lids meet), sagging a little and
      // fullest in the middle, its outer end split in two; the lid's crease over its inner part
      tallClosed: () => {
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), ln = (x, y) => fctx.lineTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y));
        fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        fctx.beginPath(); mv(-0.037, -0.011); qc(0.008, -0.0185, 0.05, -0.011); ln(0.057, -0.0095); ln(0.0505, -0.0165); ln(0.056, -0.0225); qc(0.008, -0.04, -0.036, -0.022); ln(-0.032, -0.016); fctx.closePath(); lashFill();
        line(0.0016, "#8f7f8a90"); fctx.beginPath(); mv(-0.032, 0.002); qc(-0.018, 0.001, -0.003, -0.001); fctx.stroke();
        fctx.restore();
      },
      // たて長の目のにっこり: a low arch of the thick lash, its outer end split in two, a thin line over it from the top toward the inner corner
      tallHappy: () => {
        const { x: cx, y: cy } = EYE, P = (x, y) => [px(cx + x), py(cy + y)], mv = (x, y) => fctx.moveTo(...P(x, y)), ln = (x, y) => fctx.lineTo(...P(x, y)), qc = (a, b, x, y) => fctx.quadraticCurveTo(...P(a, b), ...P(x, y)), bz = (a, b, c, d, x, y) => fctx.bezierCurveTo(...P(a, b), ...P(c, d), ...P(x, y));
        fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(LAY.eyeSize, LAY.eyeSize); fctx.translate(-px(cx), -py(cy));
        fctx.beginPath(); mv(-0.04, -0.012); qc(0.003, 0.022, 0.0495, -0.015); ln(0.0575, -0.016); ln(0.0505, -0.022); ln(0.053, -0.03); qc(0.004, -0.003, -0.034, -0.017); fctx.closePath(); lashFill();
        line(0.0018, "#3f3a5280", traced); fctx.beginPath(); mv(0.006, 0.0115); qc(-0.01, 0.0125, -0.024, 0.0055); fctx.stroke();   // a thin line of the lash color, half see-through, from the top toward the inner corner
        fctx.restore();
      },
    },
    brows: {
      image: () => imgPart("brow", BROW.x, BROW.y),
      normal: () => { const { x, y } = BROW; fctx.beginPath(); fctx.moveTo(px(x - 0.034), py(y - 0.006)); fctx.quadraticCurveTo(px(x - 0.002), py(y + 0.014), px(x + 0.04), py(y - 0.002));   // 細くとがる眉(内側が太め)
        fctx.quadraticCurveTo(px(x), py(y + 0.006), px(x - 0.033), py(y - 0.012)); fctx.closePath(); fctx.fillStyle = "#6a4a3e"; fctx.fill(); },
      thin: () => { const { x, y } = BROW; line(0.0028, "#6a5a5e"); fctx.beginPath(); fctx.moveTo(px(x - 0.044), py(y + 0.012)); fctx.quadraticCurveTo(px(x - 0.006), py(y + 0.017), px(x + 0.044), py(y - 0.017)); fctx.stroke(); },   // a long thin arc, its outer end lower
      classic: (m) => { const { x, y } = BROW; line(0.0055); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y - 0.002)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + m * 0.026), py(y - 0.004)); fctx.stroke(); },
      worried: (m) => { const { x, y } = BROW; line(0.0055); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y + 0.008)); fctx.quadraticCurveTo(px(x), py(y + 0.004), px(x + m * 0.026), py(y - 0.008)); fctx.stroke(); },
      angry: (m) => { const { x, y } = BROW; line(0.006); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y - 0.01)); fctx.quadraticCurveTo(px(x), py(y), px(x + m * 0.026), py(y + 0.004)); fctx.stroke(); },
      none: () => {},
    },
    mouth: {
      image: () => imgPart("mouth", MOUTHP.x, MOUTHP.y),
      smile: () => { const { x, y } = MOUTHP; line(0.0045); fctx.beginPath(); fctx.moveTo(px(x - 0.014), py(y + 0.003)); fctx.quadraticCurveTo(px(x), py(y - 0.01), px(x + 0.014), py(y + 0.003)); fctx.stroke(); },
      open: () => { const { x, y } = MOUTHP;
        const shape = () => { fctx.beginPath(); fctx.moveTo(px(x - 0.02), py(y + 0.006)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + 0.02), py(y + 0.006)); fctx.quadraticCurveTo(px(x + 0.016), py(y - 0.02), px(x), py(y - 0.02)); fctx.quadraticCurveTo(px(x - 0.016), py(y - 0.02), px(x - 0.02), py(y + 0.006)); fctx.closePath(); };
        if (HOLE) hole(shape); else { shape(); fctx.fillStyle = MOUTH; fctx.fill();
          fctx.save(); shape(); fctx.clip(); ell(x, y - 0.02, 0.012, 0.009, "#f08a9c"); fctx.restore(); }
        line(0.003); shape(); fctx.stroke(); },   // ふちは口の形を引き直してから(前は 舌の楕円の線を描いていて、口とずれて見えた。2026-10-09 サオリ)
      // シルヴィの笑う口(絵を用意するまで): 線は上だけで口角で細くはね、口角から脇を下りて消える。下は線なし。舌は大きく
      openSoft: () => { const { x, y } = MOUTHP, P = (a, b) => [px(x + a), py(y + b)], k = OPT.face.openSize ?? 1;
        fctx.save(); fctx.translate(px(x), py(y)); fctx.scale(k, k); fctx.translate(-px(x), -py(y));   // face.openSize: the open mouth bigger or smaller
        const shape = () => { fctx.beginPath(); fctx.moveTo(...P(-0.019, 0.006)); fctx.quadraticCurveTo(...P(0, 0.009), ...P(0.019, 0.006)); fctx.bezierCurveTo(...P(0.0195, -0.011), ...P(0.012, -0.021), ...P(0, -0.021)); fctx.bezierCurveTo(...P(-0.012, -0.021), ...P(-0.0195, -0.011), ...P(-0.019, 0.006)); fctx.closePath(); };
        if (HOLE) hole(shape); else { shape(); fctx.fillStyle = MOUTH; fctx.fill(); }
        fctx.save(); shape(); fctx.clip(); if (HOLE) fctx.globalAlpha = 0;
        ell(x, y - 0.023, 0.016, 0.0125, "#ee8798"); ell(x - 0.003, y - 0.017, 0.006, 0.0035, "#f6a8b4");   // 舌とそのつや
        ell(x, y + 0.009, 0.022, 0.006, "#7a2a3c70"); fctx.restore();                                    // 上唇の下の影
        fctx.fillStyle = "#8a2f40"; for (const m of [1, -1]) {   // 濃い赤の細い線: 上の線(中ほど 2.6mm、口角で少し上へはねる)と、口角から脇を下りて消える線(下は線なし)
          fctx.beginPath(); fctx.moveTo(...P(0, 0.0094)); fctx.quadraticCurveTo(...P(m * 0.012, 0.0094), ...P(m * 0.0215, 0.0078)); fctx.lineTo(...P(m * 0.0235, 0.0098));
          fctx.lineTo(...P(m * 0.0205, 0.0055)); fctx.quadraticCurveTo(...P(m * 0.012, 0.0068), ...P(0, 0.0068)); fctx.closePath(); fctx.fill();
          fctx.beginPath(); fctx.moveTo(...P(m * 0.0207, 0.0072)); fctx.quadraticCurveTo(...P(m * 0.0205, -0.003), ...P(m * 0.0165, -0.011)); fctx.quadraticCurveTo(...P(m * 0.0192, -0.002), ...P(m * 0.0192, 0.0068)); fctx.closePath(); fctx.fill(); } fctx.restore(); },
      o: () => { const { x, y } = MOUTHP; ell(x, y - 0.004, 0.009, 0.011, MOUTH); line(0.003); fctx.stroke(); },
      cat: () => { const { x, y } = MOUTHP; line(0.004); fctx.beginPath(); fctx.moveTo(px(x - 0.016), py(y + 0.002)); fctx.quadraticCurveTo(px(x - 0.008), py(y - 0.012), px(x), py(y)); fctx.quadraticCurveTo(px(x + 0.008), py(y - 0.012), px(x + 0.016), py(y + 0.002)); fctx.stroke(); },
      small: () => { const { x, y } = MOUTHP; line(0.0022, "#5a3c48"); fctx.beginPath(); fctx.moveTo(px(x - 0.0065), py(y - 0.002)); fctx.quadraticCurveTo(px(x), py(y + 0.004), px(x + 0.0065), py(y - 0.002)); fctx.stroke(); },   // a tiny arc
      frown: () => { const { x, y } = MOUTHP; line(0.0045); fctx.beginPath(); fctx.moveTo(px(x - 0.013), py(y - 0.006)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + 0.013), py(y - 0.006)); fctx.stroke(); },
    },
    nose: {   // 鼻の下の影: 光に関係なく、いつも同じ所に描く(アニメ調の塗り)。位置は頭の座標で、絵のずれ(FACE_DY)を打ち消して置く
      shadow: () => { const N = OPT.face.noseShadow, x = 0, y = N.y - FACE.dy, g = fctx.createRadialGradient(px(x), py(y), 0, px(x), py(y), pu(N.width));
        g.addColorStop(0, N.color); g.addColorStop(1, N.color.slice(0, 7) + "00");
        fctx.save(); fctx.translate(px(x), py(y)); fctx.scale(1, N.height / N.width); fctx.translate(-px(x), -py(y)); fctx.fillStyle = g; fctx.fillRect(px(x - N.width), py(y + N.width), pu(N.width * 2), pu(N.width * 2)); fctx.restore(); },
      image: () => imgPart("nose", NOSEP.x, NOSEP.y),
      // code-drawn noses (2026-10-07, Saori: "鼻を書いてみてもらえますか"), just under the nose's tip: a small dot, or a short stroke down
      // the shadow side with a soft shadow beside it
      dot: () => { const k = OPT.face.noseSize ?? 1; ell(NOSEP.x, NOSEP.y - 0.003, 0.0026 * k, 0.0021 * k, OPT.face.noseColor ?? "#5e3a46e0"); },
      line: () => { const { x, y } = NOSEP, g = fctx.createRadialGradient(px(x + 0.004), py(y - 0.002), 0, px(x + 0.004), py(y - 0.002), pu(0.008)); g.addColorStop(0, "#d9897a50"); g.addColorStop(1, "#d9897a00");
        fctx.fillStyle = g; fctx.fillRect(px(x - 0.006), py(y + 0.008), pu(0.02), pu(0.02));
        line(0.0026, OPT.face.noseColor ?? "#7a4a52"); fctx.beginPath(); fctx.moveTo(px(x + 0.002), py(y + 0.006)); fctx.quadraticCurveTo(px(x + 0.0035), py(y - 0.001), px(x - 0.001), py(y - 0.004)); fctx.stroke(); },
      // highlight: no nose drawn, only a soft white glint on its tip (a light on the round of it, as anime faces have)
      highlight: () => { const { x, y } = NOSEP, k = OPT.face.noseSize ?? 1, cx = x + 0.002 * k, cy = y + 0.004, g = fctx.createRadialGradient(px(cx), py(cy), 0, px(cx), py(cy), pu(0.0075 * k));
        g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#ffffffd0"); g.addColorStop(1, "#ffffff00");
        fctx.save(); fctx.translate(px(cx), py(cy)); fctx.scale(1, 1.5); fctx.translate(-px(cx), -py(cy)); fctx.fillStyle = g; fctx.fillRect(px(cx - 0.008 * k), py(cy + 0.008 * k), pu(0.016 * k), pu(0.016 * k)); fctx.restore(); },
      none: () => {},
    },
    cheeks: {
      none: () => {},
      flush: (m) => { const { x, y } = CHEEK, g = fctx.createRadialGradient(px(x), py(y), 0, px(x), py(y), pu(0.034)); g.addColorStop(0, "#ff8fa8a0"); g.addColorStop(1, "#ff8fa800");
        fctx.save(); fctx.translate(px(x), py(y)); fctx.scale(1, 0.62); fctx.translate(-px(x), -py(y)); fctx.fillStyle = g; fctx.fillRect(px(x - 0.04), py(y + 0.04), pu(0.08), pu(0.08)); fctx.restore();
        line(0.0025, "#e8607e"); for (let i = -1; i <= 1; i++) { fctx.beginPath(); fctx.moveTo(px(x + i * 0.011 + 0.004), py(y + 0.007)); fctx.lineTo(px(x + i * 0.011 - 0.003), py(y - 0.007)); fctx.stroke(); } },
    },
  };
  // ほっぺと鼻先の「ほわっ」とした赤み(OPT.face.blush)。表情とは別で、いちばん下に塗る。線は描かない(線つきの「ぽっ」は表情の cheeks)
  const soft = (x, y, r, sy, col, a) => { const c = col.slice(0, 7), A = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0"), g = fctx.createRadialGradient(px(x), py(y), 0, px(x), py(y), pu(r));
    g.addColorStop(0, c + A); g.addColorStop(0.55, c + Math.round(parseInt(A, 16) * 0.45).toString(16).padStart(2, "0")); g.addColorStop(1, c + "00");
    fctx.save(); fctx.translate(px(x), py(y)); fctx.scale(1, sy); fctx.translate(-px(x), -py(y)); fctx.fillStyle = g; fctx.fillRect(px(x - r), py(y + r), pu(r * 2), pu(r * 2)); fctx.restore(); };
  function drawBlush() {
    const B = OPT.face.blush; if (!B) return;
    if (B.cheeks.on) for (const m of [1, -1]) soft(m * B.cheeks.x, B.cheeks.y, B.cheeks.size, 0.68, B.cheeks.color, B.cheeks.strength);
    const n = B.cheeks.on ? B.cheeks.hatch ?? 0 : 0;   // thin upright strokes over the blush (a pencil drawing's cheeks), longest in the middle
    if (n) for (const m of [1, -1]) { const { x, y, size: r } = B.cheeks; line(0.0011, B.cheeks.hatchColor ?? "#e07a8a");
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n * 2 - 1, h = r * 0.62 * Math.sqrt(1 - u * u) * (0.8 + 0.2 * Math.cos(i * 2.3)), X = m * x + u * r * 0.8;
        // broken like a pencil stroke: each line in 2–3 pieces with small gaps, placed by the line's index (the same every redraw)
        const k = 2 + (i % 2), g = 0.12 + 0.06 * Math.sin(i * 1.7); for (let j = 0; j < k; j++) { const t0 = j / k + (j ? g / k : 0), t1 = (j + 1) / k - (j < k - 1 ? g / k : 0), Y = (t) => y + h - 2 * h * t, Xt = (t) => X + 0.001 - 0.002 * t;
          fctx.beginPath(); fctx.moveTo(px(Xt(t0)), py(Y(t0))); fctx.lineTo(px(Xt(t1)), py(Y(t1))); fctx.stroke(); } } }
    if (B.nose.on) soft(0, 0.929 + OPT.body.sculpt.nose.lift - FACE.dy, B.nose.size, 0.85, B.nose.color, B.nose.strength);   // 鼻先(頭の座標。body/index.js の鼻の先端と同じ高さ)
  }
  for (const { id } of DRAWN) {   // a part not drawn for this expression falls back to the ふつう picture
    PARTS.eyes[DRAWN_PREFIX + id] = () => imgOr([`eye@${id}`, "eye"], EYE.x, EYE.y);
    PARTS.brows[DRAWN_PREFIX + id] = () => imgOr([`brow@${id}`, "brow"], BROW.x, BROW.y);
    PARTS.mouth[DRAWN_PREFIX + id] = () => imgOr([`mouth@${id}`, "mouth"], MOUTHP.x, MOUTHP.y); }
  const SLOTS = ["nose", "brows", "eyes", "cheeks", "mouth"];   // 下から順に重ねる
  const SIDED = { eyes: true, brows: true, cheeks: true };
  const PRESETS = Object.fromEntries(Object.entries(EXPRESSIONS).map(([id, e]) => [id, e.parts]));   // expression id → parts (the drawn ones too)
  for (const d of DRAWN) PRESETS[DRAWN_PREFIX + d.id] = { eyes: DRAWN_PREFIX + d.id, brows: DRAWN_PREFIX + d.id, mouth: DRAWN_PREFIX + d.id, cheeks: d.cheeks ?? "none" };
  /** An expression's display name ({ ja, en }): the code ones from EXPRESSIONS, a drawn one "絵: <its name>". */
  const presetName = (id) => { const d = DRAWN.find((q) => DRAWN_PREFIX + q.id === id); return d ? { ja: `絵: ${d.name ?? d.id}`, en: `Picture: ${d.name ?? d.id}` } : EXPRESSIONS[id] ?? { ja: id, en: id }; };
  const otherEye = (eyes) => { const k = eyes === "image" ? "eyeL" : eyes?.startsWith(DRAWN_PREFIX) ? `eyeL@${eyes.slice(DRAWN_PREFIX.length)}` : null; return k && PART_IMG[k]?.img ? k : null; };
  /** Draw a face: sel = { eyes, brows, mouth, cheeks } (names in PARTS). blinking swaps open eyes for closed ones. */
  function drawParts(sel, blinking = false) {
    fctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    if (HOLE) { HOLE.ctx.setTransform(1, 0, 0, 1, 0, 0); HOLE.ctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height); HOLE.tex.needsUpdate = true; }
    drawBlush();
    // blinking: the closed eye drawn as its own entry (face.images.eyeClosed) whatever the open eye is, else the code's line
    for (const slot of SLOTS) { const shut = slot === "eyes" && blinking && BLINKS.has(sel.eyes), name = shut ? (PART_IMG.eyeClosed.img ? "imageClosed" : SHUT[sel.eyes] ?? "closed") : sel[slot], draw = PARTS[slot][name] ?? (() => {});
      const other = slot === "eyes" && !shut ? otherEye(name) : null;   // the other eye's own picture, if this eye has one
      const own = slot === "brows" && BROWS; if (own) { fctx = BROWS.ctx; fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height); fctx.translate(0, pu(BROWS.up)); }
      if (SIDED[slot]) for (const m of [1, -1]) { if (m < 0 && other) { imgPart(other, -(EYE.x + 2 * PART_IMG[other].dx), EYE.y); continue; }   // (placed at the mirrored point: imgPart adds dx)
        fctx.save(); const cx = px(0); fctx.translate(cx, 0); fctx.scale(m, 1); fctx.translate(-cx, 0); draw(m * m); fctx.restore(); }   // the right side is the left side mirrored
      else draw(1);
      if (own) { fctx = mainCtx; BROWS.tex.needsUpdate = true; } }
    faceTex.needsUpdate = true;
  }
  function faceLayerGeometry(src, FACE_WRAP, toHead = null, F = FACE) {   // the front of the head mesh, lifted slightly, with UVs that project the face picture onto it. toHead: world → head space (when the head is scaled). F: the picture's heights (the brows' own: BROWS.frame)
    const P0 = src.attributes.position.array, N0 = src.attributes.normal.array, NS = src.attributes.shadeN?.array ?? N0, SI = src.attributes.skinIndex.array, SW = src.attributes.skinWeight.array, I0 = src.index.array;
    const H = (v) => toHead ? toHead(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]) : [P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]];   // the face picture lives in head space
    // (the head's front down to where it faces 80° aside: from 72° (normal z 0.3) and z 0.05 the blush ended square on the cheek and the brows'
    // outer ends were cut off, seen from aside or on a narrower head, 2026-10-09, Saori. The picture is clear outside its parts, so a wider layer costs nothing)
    const ok = (v) => { const [x, y, z] = H(v); return y > F.y0 + 0.004 && y < F.y1 - 0.004 && Math.abs(x) < FACE.x1 - 0.004 && z > 0.0 && N0[v * 3 + 2] > 0.17; };
    const map = new Map(), pos = [], nor = [], uv = [], col = [], si = [], sw = [], idx = [];
    const add = (v) => { if (map.has(v)) return map.get(v); const n = pos.length / 3, [x, y, z] = H(v);
      pos.push(P0[v * 3] + N0[v * 3] * 0.0012, P0[v * 3 + 1] + N0[v * 3 + 1] * 0.0012, P0[v * 3 + 2] + N0[v * 3 + 2] * 0.0012); nor.push(NS[v * 3], NS[v * 3 + 1], NS[v * 3 + 2]);   // 陰影は体の肌と同じ向き(shadeN)で
      const ux = FACE_WRAP ? Math.atan2(x, z - FACE_WRAP.zc) * FACE_WRAP.r : x;   // 巻きつけ: 頭のまわりの角度で横の位置を決める(横顔で絵が引きのばされない)
      uv.push((ux - FACE.x0) / (FACE.x1 - FACE.x0), (y - F.y0) / (F.y1 - F.y0));
      { const nz = N0[v * 3 + 2], t = (a, b, q) => Math.min(1, Math.max(0, (q - a) / (b - a))), a = t(0.17, 0.3, nz) * t(0.0, 0.03, z) * t(FACE.x1 - 0.004, FACE.x1 - 0.012, Math.abs(x)); col.push(1, 1, 1, a * a * (3 - 2 * a)); }   // the picture fades out toward the layer's edge (no square end on a cheek seen from aside)
      for (let q = 0; q < 4; q++) { si.push(SI[v * 4 + q]); sw.push(SW[v * 4 + q]); } map.set(v, n); return n; };
    for (let t = 0; t < I0.length; t += 3) { const a = I0[t], b = I0[t + 1], c = I0[t + 2]; if (ok(a) && ok(b) && ok(c)) idx.push(add(a), add(b), add(c)); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx);
    return g;
  }
  /** Move face parts on the picture (no rebuild): { eyeX, eyeY, eyeSize, browX, browY, mouthY }. Redraw afterwards. */
  function setLayout(l) {
    if (l.eyeX != null) EYE.x = l.eyeX; if (l.eyeY != null) EYE.y = l.eyeY; if (l.eyeSize != null) LAY.eyeSize = l.eyeSize;
    if (l.browX != null) BROW.x = l.browX; if (l.browY != null) BROW.y = l.browY; if (l.mouthY != null) MOUTHP.y = l.mouthY;
  }
  const setEyeColor = (c) => { EYE_COL.splice(0, 4, ...irisColors(c)); };
  const getLayout = () => ({ eyeX: EYE.x, eyeY: EYE.y, eyeSize: LAY.eyeSize, browX: BROW.x, browY: BROW.y, mouthY: MOUTHP.y });
  return { setLayout, getLayout, setEyeColor, FACE, faceCanvas, fctx, faceTex, faceMat, faceMatFor, BROWS, browMatFor, HOLE, px, py, pu, EYE, BROW, MOUTHP, NOSEP, PART_IMG, PARTS, PRESETS, presetName, DRAWN, drawParts, faceLayerGeometry };
}
