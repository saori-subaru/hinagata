// Face: parts (eyes, brows, mouth, cheeks) drawn into a canvas texture, shown on a thin copy of the front of the head.
// Parts are code-drawn by default; image parts (img/parts/*.png, see facekit/) are a preset.
import * as THREE from "three";

import { PART_LABELS, EXPRESSIONS, DRAWN, partIds, expressionId } from "./names.js";
import { shaded } from "../materials.js";
export { PART_LABELS, EXPRESSIONS, DRAWN, partIds, expressionId };

// Eyes that blink (the closed eye is drawn for a moment)
const BLINKS = new Set(["round", "classic", "surprised", "glare", "image", "image_surprised", "image_glare"]);

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
  const fctx = faceCanvas.getContext("2d");
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  // 顔の絵も体と同じ陰影で(光を無視すると暗い場所で目だけ光って見える)。setShading で作り直す
  const faceMatFor = (style) => Object.assign(shaded(style, 0xffffff), { map: faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const faceMat = faceMatFor(OPT.shading.style);
  const px = (x) => (x - FACE.x0) * FACE.S, py = (y) => (FACE.y1 - y - FACE.dy) * FACE.S, pu = (d) => d * FACE.S;   // 体の座標 → 絵のピクセル
  const INK = "#3a2632", MOUTH = "#b8475e";
  const LAY = { eyeSize: OPT.face.eyeSize };   // 目の大きさ(コードで描く目)。あとから setLayout で変えられる
  const EYE_COL = irisColors(OPT.colors.eyes);   // 虹彩の色(上の暗い色 → 下の明るい色)。setEyeColor で変えられる
  // 目・眉・ほっぺはキャラの左側(+x)を描き、右側は左右反転して写す
  const FL = OPT.face.layout, EYE = { x: FL.eyeX, y: FL.eyeY }, BROW = { x: FL.browX, y: FL.browY }, MOUTHP = { x: 0, y: FL.mouthY }, CHEEK = { x: 0.152, y: 0.955 };   // 顔の絵の上の位置(体の座標)
  const line = (w, c = INK) => { fctx.lineWidth = pu(w); fctx.strokeStyle = c; fctx.lineCap = "round"; fctx.lineJoin = "round"; };
  const ell = (x, y, rx, ry, fill) => { fctx.beginPath(); fctx.ellipse(px(x), py(y), pu(rx), pu(ry), 0, 0, Math.PI * 2); fctx.fillStyle = fill; fctx.fill(); };
  const lash = (m, x, y, rx, lift) => { line(0.0075); fctx.beginPath(); fctx.moveTo(px(x - m * rx * 1.05), py(y - 0.004)); fctx.quadraticCurveTo(px(x), py(y + lift), px(x + m * rx * 1.15), py(y - 0.002)); fctx.lineTo(px(x + m * rx * 1.35), py(y + 0.006)); fctx.stroke(); };
  // 描いてもらったパーツの絵(片側ぶん。右側は左右反転して使う)。下絵と切り出しは facekit/(face-template.psd → cut_face_parts.py)。w: 顔の上での横幅(0なら原寸 = 下絵と同じ1px) / dx, dy: 基準点からのずらし
  const PART_IMG = { eye: { src: OPT.face.images.eye.src ?? new URL("../../img/parts/eye.png", import.meta.url).href, w: OPT.face.images.eye.width, dx: OPT.face.images.eye.dx, dy: OPT.face.images.eye.dy }, eyeClosed: { src: OPT.face.images.eyeClosed?.src ?? null, w: OPT.face.images.eyeClosed?.width ?? 0, dx: OPT.face.images.eyeClosed?.dx ?? 0.004, dy: OPT.face.images.eyeClosed?.dy ?? 0.004 }, brow: { src: OPT.face.images.brow.src ?? new URL("../../img/parts/brow.png", import.meta.url).href, w: OPT.face.images.brow.width, dx: OPT.face.images.brow.dx, dy: OPT.face.images.brow.dy }, mouth: { src: OPT.face.images.mouth.src ?? new URL("../../img/parts/mouth.png", import.meta.url).href, w: OPT.face.images.mouth.width, dx: 0, dy: OPT.face.images.mouth.dy },
    nose: { src: OPT.face.images.nose?.src ?? null, w: OPT.face.images.nose?.width ?? 0, dx: 0, dy: OPT.face.images.nose?.dy ?? 0 } };   // nose: no picture unless one is given
  const NOSEP = { x: 0, y: 0.929 + OPT.body.sculpt.nose.lift - FACE.dy };   // the nose tip on the face picture (head space, same as the tip in body/index.js)
  // drawn expressions (face.images.sets): their own eye / brow / mouth, placed like the ふつう ones ("eye.happy" …)
  for (const id of DRAWN) for (const k of ["eye", "brow", "mouth"]) PART_IMG[`${k}.${id}`] = { ...PART_IMG[k], src: OPT.face.images.sets?.[id]?.[k]?.src ?? null };
  for (const k in PART_IMG) { if (!PART_IMG[k].src) continue; const im = new Image(); im.onload = () => { PART_IMG[k].img = im; onImage?.(k); }; im.src = PART_IMG[k].src; }
  const imgPart = (k, x, y) => { const p = PART_IMG[k]; if (!p.img) return; const w = p.w ? pu(p.w) : p.img.width, h = w * p.img.height / p.img.width; fctx.drawImage(p.img, px(x + p.dx) - w / 2, py(y + p.dy) - h / 2, w, h); };   // 基準点に絵の真ん中を合わせる
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
      classic: (m) => { const { x, y } = EYE, rx = 0.035, ry = 0.047;   // ひとつ前の、塗りつぶしの丸い目
        const g = fctx.createLinearGradient(0, py(y + ry), 0, py(y - ry)); g.addColorStop(0, "#2a1b26"); g.addColorStop(0.55, "#4a3042"); g.addColorStop(1, "#8a5a72");
        ell(x, y, rx, ry, g); ell(x, y - 0.004, rx * 0.5, ry * 0.55, "#21141d");
        ell(x - 0.012, y + 0.019, 0.011, 0.014, "#fff"); ell(x + 0.014, y - 0.019, 0.005, 0.005, "#ffffffd8");
        lash(m, x, y + ry * 0.92, rx, 0.012); },
      happy: (m) => { const { x, y } = EYE; line(0.0075); fctx.beginPath(); fctx.moveTo(px(x - 0.028), py(y - 0.012)); fctx.quadraticCurveTo(px(x), py(y + 0.028), px(x + 0.028), py(y - 0.012)); fctx.stroke(); },
      closed: (m) => { const { x, y } = EYE; line(0.007); fctx.beginPath(); fctx.moveTo(px(x - 0.028), py(y - 0.002)); fctx.quadraticCurveTo(px(x), py(y - 0.026), px(x + 0.028), py(y - 0.002)); fctx.stroke();
        fctx.beginPath(); fctx.moveTo(px(x + m * 0.028), py(y - 0.002)); fctx.lineTo(px(x + m * 0.036), py(y + 0.004)); fctx.stroke(); },
      surprised: (m) => { const { x, y } = EYE; ell(x, y, 0.027, 0.04, "#fff"); line(0.003); fctx.beginPath(); fctx.ellipse(px(x), py(y), pu(0.027), pu(0.04), 0, 0, Math.PI * 2); fctx.stroke();
        ell(x, y - 0.002, 0.012, 0.016, INK); ell(x - 0.004, y + 0.004, 0.004, 0.005, "#fff"); lash(m, x, y + 0.04, 0.027, 0.012); },
      glare: (m) => { const { x, y } = EYE, rx = 0.03, ry = 0.041; fctx.save(); fctx.beginPath(); fctx.rect(0, py(y + 0.006), faceCanvas.width, faceCanvas.height); fctx.clip();
        ell(x, y, rx, ry, "#3a2632"); ell(x + 0.012, y - 0.016, 0.0045, 0.0045, "#ffffffd8"); fctx.restore();
        line(0.0075); fctx.beginPath(); fctx.moveTo(px(x - m * rx * 1.1), py(y + 0.006)); fctx.lineTo(px(x + m * rx * 1.25), py(y + 0.008)); fctx.stroke(); },
    },
    brows: {
      image: () => imgPart("brow", BROW.x, BROW.y),
      normal: () => { const { x, y } = BROW; fctx.beginPath(); fctx.moveTo(px(x - 0.034), py(y - 0.006)); fctx.quadraticCurveTo(px(x - 0.002), py(y + 0.014), px(x + 0.04), py(y - 0.002));   // 細くとがる眉(内側が太め)
        fctx.quadraticCurveTo(px(x), py(y + 0.006), px(x - 0.033), py(y - 0.012)); fctx.closePath(); fctx.fillStyle = "#6a4a3e"; fctx.fill(); },
      classic: (m) => { const { x, y } = BROW; line(0.0055); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y - 0.002)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + m * 0.026), py(y - 0.004)); fctx.stroke(); },
      worried: (m) => { const { x, y } = BROW; line(0.0055); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y + 0.008)); fctx.quadraticCurveTo(px(x), py(y + 0.004), px(x + m * 0.026), py(y - 0.008)); fctx.stroke(); },
      angry: (m) => { const { x, y } = BROW; line(0.006); fctx.beginPath(); fctx.moveTo(px(x - m * 0.024), py(y - 0.01)); fctx.quadraticCurveTo(px(x), py(y), px(x + m * 0.026), py(y + 0.004)); fctx.stroke(); },
      none: () => {},
    },
    mouth: {
      image: () => imgPart("mouth", MOUTHP.x, MOUTHP.y),
      smile: () => { const { x, y } = MOUTHP; line(0.0045); fctx.beginPath(); fctx.moveTo(px(x - 0.014), py(y + 0.003)); fctx.quadraticCurveTo(px(x), py(y - 0.01), px(x + 0.014), py(y + 0.003)); fctx.stroke(); },
      open: () => { const { x, y } = MOUTHP; fctx.beginPath(); fctx.moveTo(px(x - 0.02), py(y + 0.006)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + 0.02), py(y + 0.006)); fctx.quadraticCurveTo(px(x + 0.016), py(y - 0.02), px(x), py(y - 0.02)); fctx.quadraticCurveTo(px(x - 0.016), py(y - 0.02), px(x - 0.02), py(y + 0.006)); fctx.fillStyle = MOUTH; fctx.fill();
        fctx.save(); fctx.clip(); ell(x, y - 0.02, 0.012, 0.009, "#f08a9c"); fctx.restore(); line(0.003); fctx.stroke(); },
      o: () => { const { x, y } = MOUTHP; ell(x, y - 0.004, 0.009, 0.011, MOUTH); line(0.003); fctx.stroke(); },
      cat: () => { const { x, y } = MOUTHP; line(0.004); fctx.beginPath(); fctx.moveTo(px(x - 0.016), py(y + 0.002)); fctx.quadraticCurveTo(px(x - 0.008), py(y - 0.012), px(x), py(y)); fctx.quadraticCurveTo(px(x + 0.008), py(y - 0.012), px(x + 0.016), py(y + 0.002)); fctx.stroke(); },
      frown: () => { const { x, y } = MOUTHP; line(0.0045); fctx.beginPath(); fctx.moveTo(px(x - 0.013), py(y - 0.006)); fctx.quadraticCurveTo(px(x), py(y + 0.008), px(x + 0.013), py(y - 0.006)); fctx.stroke(); },
    },
    nose: {   // 鼻の下の影: 光に関係なく、いつも同じ所に描く(アニメ調の塗り)。位置は頭の座標で、絵のずれ(FACE_DY)を打ち消して置く
      shadow: () => { const N = OPT.face.noseShadow, x = 0, y = N.y - FACE.dy, g = fctx.createRadialGradient(px(x), py(y), 0, px(x), py(y), pu(N.width));
        g.addColorStop(0, N.color); g.addColorStop(1, N.color.slice(0, 7) + "00");
        fctx.save(); fctx.translate(px(x), py(y)); fctx.scale(1, N.height / N.width); fctx.translate(-px(x), -py(y)); fctx.fillStyle = g; fctx.fillRect(px(x - N.width), py(y + N.width), pu(N.width * 2), pu(N.width * 2)); fctx.restore(); },
      image: () => imgPart("nose", NOSEP.x, NOSEP.y),
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
    if (B.nose.on) soft(0, 0.929 + OPT.body.sculpt.nose.lift - FACE.dy, B.nose.size, 0.85, B.nose.color, B.nose.strength);   // 鼻先(頭の座標。body/index.js の鼻の先端と同じ高さ)
  }
  for (const id of DRAWN) {   // a part not drawn for this expression falls back to the ふつう picture (a sleeping eye: to the closed eye, then the code's)
    PARTS.eyes[`image_${id}`] = id === "sleeping" ? (m) => { if (!imgOr([`eye.${id}`, "eyeClosed"], EYE.x, EYE.y)) PARTS.eyes.closed(m); } : () => imgOr([`eye.${id}`, "eye"], EYE.x, EYE.y);
    PARTS.brows[`image_${id}`] = () => imgOr([`brow.${id}`, "brow"], BROW.x, BROW.y);
    PARTS.mouth[`image_${id}`] = () => imgOr([`mouth.${id}`, "mouth"], MOUTHP.x, MOUTHP.y); }
  const SLOTS = ["nose", "brows", "eyes", "cheeks", "mouth"];   // 下から順に重ねる
  const SIDED = { eyes: true, brows: true, cheeks: true };
  const PRESETS = Object.fromEntries(Object.entries(EXPRESSIONS).map(([id, e]) => [id, e.parts]));   // expression id → parts
  /** Draw a face: sel = { eyes, brows, mouth, cheeks } (names in PARTS). blinking swaps open eyes for closed ones. */
  function drawParts(sel, blinking = false) {
    fctx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    drawBlush();
    for (const slot of SLOTS) { const name = slot === "eyes" && blinking && BLINKS.has(sel.eyes) ? (sel.eyes.startsWith("image") && PART_IMG.eyeClosed.img ? "imageClosed" : "closed") : sel[slot], draw = PARTS[slot][name] ?? (() => {});
      if (SIDED[slot]) for (const m of [1, -1]) { fctx.save(); const cx = px(0); fctx.translate(cx, 0); fctx.scale(m, 1); fctx.translate(-cx, 0); draw(m * m); fctx.restore(); }   // the right side is the left side mirrored
      else draw(1); }
    faceTex.needsUpdate = true;
  }
  function faceLayerGeometry(src, FACE_WRAP, toHead = null) {   // the front of the head mesh, lifted slightly, with UVs that project the face picture onto it. toHead: world → head space (when the head is scaled)
    const P0 = src.attributes.position.array, N0 = src.attributes.normal.array, NS = src.attributes.shadeN?.array ?? N0, SI = src.attributes.skinIndex.array, SW = src.attributes.skinWeight.array, I0 = src.index.array;
    const H = (v) => toHead ? toHead(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]) : [P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]];   // the face picture lives in head space
    const ok = (v) => { const [x, y, z] = H(v); return y > FACE.y0 + 0.004 && y < FACE.y1 - 0.004 && Math.abs(x) < FACE.x1 - 0.004 && z > 0.05 && N0[v * 3 + 2] > 0.3; };
    const map = new Map(), pos = [], nor = [], uv = [], si = [], sw = [], idx = [];
    const add = (v) => { if (map.has(v)) return map.get(v); const n = pos.length / 3, [x, y, z] = H(v);
      pos.push(P0[v * 3] + N0[v * 3] * 0.0012, P0[v * 3 + 1] + N0[v * 3 + 1] * 0.0012, P0[v * 3 + 2] + N0[v * 3 + 2] * 0.0012); nor.push(NS[v * 3], NS[v * 3 + 1], NS[v * 3 + 2]);   // 陰影は体の肌と同じ向き(shadeN)で
      const ux = FACE_WRAP ? Math.atan2(x, z - FACE_WRAP.zc) * FACE_WRAP.r : x;   // 巻きつけ: 頭のまわりの角度で横の位置を決める(横顔で絵が引きのばされない)
      uv.push((ux - FACE.x0) / (FACE.x1 - FACE.x0), (y - FACE.y0) / (FACE.y1 - FACE.y0));
      for (let q = 0; q < 4; q++) { si.push(SI[v * 4 + q]); sw.push(SW[v * 4 + q]); } map.set(v, n); return n; };
    for (let t = 0; t < I0.length; t += 3) { const a = I0[t], b = I0[t + 1], c = I0[t + 2]; if (ok(a) && ok(b) && ok(c)) idx.push(add(a), add(b), add(c)); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
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
  return { setLayout, getLayout, setEyeColor, FACE, faceCanvas, fctx, faceTex, faceMat, faceMatFor, px, py, pu, EYE, BROW, MOUTHP, NOSEP, PART_IMG, PARTS, PRESETS, drawParts, faceLayerGeometry };
}
