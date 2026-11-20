// 花畑の舞台(tools/grow.html ?stage=flowers / tools/grow.mjs --stage flowers): 花・草・空・遠い丘、舞う花びらと蝶、光の粒、カメラ、仕上げ(ブルームと色)。
// 動くものは全部「時刻の関数」(状態を持たない): 育ちのコマごとに体を作り直し、途中のコマから撮っても同じ時刻は同じ絵になる。
// 長さ・カメラ・花びらの渦は踊り(dance: 16拍 9.6 秒)に合わせてある: 引きから寄り、指さしを下から、回転で渦、決めのポーズで散る。単位はメートル。
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { softToon } from "../src/materials.js";

export const SIZE = [1280, 544];   // 2.35:1。grow.mjs が上下に黒い帯を足して 1280×720 にする
export const SET = { "shading.rim.on": true };   // 外の光: 体の縁を明るく
const SECONDS = 11.6, GROW = [1.4, 8.75], VORTEX = 6.8, BURST = 8.75, HOLD = 8.7, CLEAR = 0.55;   // 秒。CLEAR: 足もとの花の無い輪(m)
const WIND = [0.6, 0, -0.15];   // m/s。花びら・草・髪が同じ風に流れる
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const smoother = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (6 * x - 15) + 10); };
const growAt = (t) => smoother((t - GROW[0]) / (GROW[1] - GROW[0]));
const C = (h) => new THREE.Color(h);   // sRGB の16進 → three の線形

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (x, z) => { let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; }
const fbm = (x, z) => 0.55 * vnoise(x, z) + 0.3 * vnoise(x * 2.1 + 17, z * 2.1 - 9) + 0.15 * vnoise(x * 4.3 - 31, z * 4.3 + 5);

// 花の色の群生: 足もとはピンクと白、後ろに青(ネモフィラ)の帯、横に黄と藤色。遠くは地面の色(同じ関数)が続ける
const PAL = { pink: ["#ff8fb8", "#ffa8c8", "#ffc4da", "#ff7aa6", "#fff0f5"], blue: ["#5aa8ff", "#78b8ff", "#9fcbff", "#4f96ef", "#ffffff"],
  yellow: ["#ffe15a", "#fff09a", "#ffd02e", "#fffbe0"], white: ["#ffffff", "#fff7fb", "#fdeef6", "#f6f0ff", "#fff9e8"], lilac: ["#c7a6ff", "#d9c2ff", "#b28cf2", "#efe4ff"] };
const DRIFTS = [["pink", 0.5, 1, 6], ["pink", 7, 12, 7], ["pink", -14, -3, 6], ["blue", -4, -16, 11], ["lilac", 16, -22, 13], ["blue", -24, -14, 11], ["blue", 4, -40, 18],
  ["yellow", 14, -4, 6], ["yellow", -17, 9, 7], ["yellow", -30, -36, 14], ["lilac", -8, 8, 5], ["lilac", 22, 8, 8], ["lilac", 30, -40, 15]];
function zoneW(x, z) {
  const wx = x + (fbm(x * 0.08, z * 0.08) - 0.5) * 9, wz = z + (fbm(x * 0.08 + 9.2, z * 0.08 - 4.1) - 0.5) * 9, w = { pink: 0, blue: 0, yellow: 0, lilac: 0, white: 0.3 };
  for (const [k, cx, cz, r] of DRIFTS) { const d = Math.hypot(wx - cx, wz - cz) / r; if (d < 1) w[k] += (1 - d * d) ** 1.5 * 1.6; }
  let s = 0; for (const k in w) s += w[k]; for (const k in w) w[k] /= s; return w;
}
const pick = (w, u) => { for (const k in w) { if (u < w[k]) return k; u -= w[k]; } return "white"; };
function density(x, z) {
  const r = Math.hypot(x, z); if (r < CLEAR) return 0;
  const gap = ss(0.28, 0.46, fbm(x * 0.13 + 40, z * 0.13 - 13));   // ところどころ草だけの所
  return ss(CLEAR, CLEAR + 0.5, r) * Math.max(r < 5 ? 0.85 : 0, (0.45 + 0.55 * fbm(x * 0.4 - 7, z * 0.4 + 3)) * gap);
}

// 上を向いた花(半径 1): 縁を花びらの数だけ波打たせた扇。外ほど持ち上げて皿形に。法線は上(地面と同じ光。花びらの傾きで陰の帯がちらついた)
function flowerGeo(n, sharp, lift) {
  const P = [0, 0.02, 0], Cc = [0.78, 0.78, 0.78], I = [], S = 72;
  for (let i = 0; i <= S; i++) { const a = (i / S) * Math.PI * 2, r = 0.22 + 0.78 * Math.pow(Math.abs(Math.cos((n * a) / 2)), sharp);
    P.push(Math.cos(a) * r, lift * r * r, Math.sin(a) * r); const k = 0.82 + 0.18 * r; Cc.push(k, k, k); if (i) I.push(0, i + 1, i); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(I); return g;
}
function discGeo(r, y) { const g = new THREE.CircleGeometry(r, 10); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }
function stemGeo() {   // 高さ 1 の十字の板(インスタンスの縦の縮尺が茎の長さ)
  const w = 0.004, P = [-w, 0, 0, w, 0, 0, w, 1, 0, -w, 1, 0, 0, 0, -w, 0, 0, w, 0, 1, w, 0, 1, -w];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.setAttribute("normal", new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); return g;
}
function bladeGeo() {   // 高さ 1 の草の葉: 根もとが暗く先が明るい
  const P = [-0.007, 0, 0, 0.007, 0, 0, -0.0045, 0.5, 0.004, 0.0045, 0.5, 0.004, 0, 1, 0.012], Cc = [0.5, 0.55, 0.5, 0.5, 0.55, 0.5, 0.8, 0.85, 0.8, 0.8, 0.85, 0.8, 1, 1, 1];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); return g;
}

const NOISE = `float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;
// 風の揺れ(m): o = 草花の根もと(世界)。風の波が野を渡る(gust)
const SWAY = `uniform float uTime; uniform vec3 uSway; uniform vec4 uShadow; varying vec3 vW;
vec3 sway(vec3 o) { float g = 0.55 + 0.45 * sin(uTime * 0.8 - o.x * 0.35 + o.z * 0.1); float s = 0.6 * sin(uTime * 2.2 - o.x * 0.9 + dot(o.xz, vec2(0.37, 0.71))) + 0.3 * sin(uTime * 3.4 + o.z * 1.3);
  return uSway * (0.55 + 0.45 * s) * g; }`;
const BLOB = `uniform vec4 uShadow; varying vec3 vW; float blob() { return uShadow.w * (1.0 - smoothstep(0.35, 1.0, length(vW.xz - uShadow.xy) / uShadow.z)); }`;   // 足もとの丸い影(xz, 半径, 濃さ)

export function createStage({ renderer, scene, cam, W, H }) {
  const SUN = new THREE.Vector3(1.5, 3, 2.2).normalize();   // 体の既定の光と同じ向き(キャラの色はこの光で決めてある)
  const HAZE = C("#e6eff3"), U = { uTime: { value: 0 }, uSway: { value: new THREE.Vector3(WIND[0], 0, WIND[2]).multiplyScalar(0.07) }, uShadow: { value: new THREE.Vector4(0, 0, 0.4, 0) } };
  scene.background = null; scene.fog = new THREE.Fog(HAZE, 30, 170); cam.near = 0.06; cam.far = 1200; cam.updateProjectionMatrix();
  scene.add(new THREE.HemisphereLight(C("#f2f7ff"), C("#c4d8a0"), 1.55)); const sun = new THREE.DirectionalLight(C("#fff4e4"), 1.75); sun.position.copy(SUN).multiplyScalar(10); scene.add(sun);
  const R = rng(11), add = (o, order = 0) => { o.renderOrder = order; o.frustumCulled = false; scene.add(o); return o; };
  // トゥーンの材質に頂点・画素の手を足す(同じ種類の材質がシェーダーを取り違えないよう key を分ける)
  // plant: 両面を同じ向きの光で(薄い葉の裏が裏返った法線で暗くなり、草むらがまだらに見えた)
  const toonWith = (color, key, { vert, frag, vertexColors, plant } = {}) => { const m = softToon(color); m.vertexColors = !!vertexColors; const prev = m.onBeforeCompile;
    if (plant) { m.side = THREE.DoubleSide; const f0 = frag; frag = (s) => (f0 ? f0(s) : s).replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n normal = normalize(vNormal);"); }
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, U); if (vert) sh.vertexShader = vert(sh.vertexShader); if (frag) sh.fragmentShader = frag(sh.fragmentShader); };
    m.customProgramCacheKey = () => "stage-" + key; return m; };
  // 根もと(インスタンスの原点)から k の割合で風に揺れる。k: 花は 1、茎と草は高さの2乗
  const swayVert = (k) => (s) => s.replace("#include <common>", "#include <common>\n" + SWAY)
    .replace("#include <project_vertex>", `vec4 wp = instanceMatrix * vec4(transformed, 1.0); float hh = length(instanceMatrix[1].xyz); wp.xyz += sway(instanceMatrix[3].xyz) * (${k});
      vW = wp.xyz; vec4 mvPosition = modelViewMatrix * wp; gl_Position = projectionMatrix * mvPosition;`);
  const blobFrag = (s) => s.replace("#include <common>", "#include <common>\n" + BLOB).replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= 1.0 - blob();");

  // 空: 上が青、地平が霞の色、低い雲
  add(new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.uTime, uZen: { value: C("#3f8fe4") }, uHor: { value: HAZE }, uSun: { value: SUN } },
    vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uZen, uHor, uSun; uniform float uTime; varying vec3 vDir; ${NOISE}
      void main() { vec3 d = normalize(vDir); float h = d.y; vec3 c = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.5));
        c += vec3(1.0, 0.86, 0.66) * 0.18 * pow(max(dot(d, uSun), 0.0), 5.0);
        if (h > 0.0) { vec2 uv = d.xz / (h + 0.22) * 1.1 + vec2(uTime * 0.006, 0.0); float n = fbm(uv * 1.2), m = smoothstep(0.5, 0.62, n) * smoothstep(0.0, 0.1, h) * (1.0 - smoothstep(0.45, 0.85, h));
          float sh = smoothstep(0.55, 0.9, fbm(uv * 1.2 + vec2(0.05, 0.08))); c = mix(c, mix(vec3(1.0), vec3(0.8, 0.84, 0.93), sh * 0.7), m * 0.92); }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` })), -2);

  // 遠景(3重の輪): 手前は木の並び(丸い樹冠を重ねた線)、なだらかな丘、青い山。遠いほど霞に溶ける
  const ring = (rad, hAt, top, bot, order) => { const N = 1440, pos = [], cols = [], idx = [];
    for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, h = hAt(a), x = Math.sin(a) * rad, z = Math.cos(a) * rad;
      pos.push(x, -3, z, x, h, z); cols.push(bot.r, bot.g, bot.b, top.r, top.g, top.b); if (i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })), order); };
  const rh = rng(5), P3 = () => [rh() * 6.3, rh() * 6.3, rh() * 6.3], wave = (ph, a, f) => 0.5 + 0.25 * Math.sin(a * f + ph[0]) + 0.15 * Math.sin(a * f * 2.6 + ph[1]) + 0.1 * Math.sin(a * f * 5.3 + ph[2]);
  { const ph = P3(); ring(190, (a) => 10 + 34 * Math.pow(wave(ph, a, 3), 1.6) + 3 * Math.abs(Math.sin(a * 17 + ph[0])), C("#8eaad0").lerp(HAZE, 0.45), C("#a9bfd8").lerp(HAZE, 0.6), -1.3); }
  { const ph = P3(); ring(110, (a) => 2 + 11 * wave(ph, a, 2), C("#7fae86").lerp(HAZE, 0.4), C("#8fb79a").lerp(HAZE, 0.55), -1.2); }
  { const crowns = []; for (let i = 0; i < 230; i++) crowns.push([rh() * Math.PI * 2, (1.6 + 2.2 * rh()) / 64, 2.5 + 3.5 * rh()]);   // [方位, 幅(rad), 高さ m]
    ring(64, (a) => { let h = 0.5; for (const [c, w, ht] of crowns) { let d = Math.abs(a - c); d = Math.min(d, Math.PI * 2 - d); if (d < w) h = Math.max(h, ht - w * 64 * (1 - Math.sqrt(1 - (d / w) ** 2))); } return h; },
      C("#5f9a55").lerp(HAZE, 0.22), C("#4e8148").lerp(HAZE, 0.38), -1.1); }

  // 地面: 群生の色(遠くの花畑)×細かい点(花の粒)。近くは本物の花と草が覆う
  const SPAN = 260, TS = 1024, cv = document.createElement("canvas"); cv.width = cv.height = TS; const cx = cv.getContext("2d"), img = cx.createImageData(TS, TS);
  const avg = {}; for (const k in PAL) { const c = new THREE.Color(0, 0, 0); for (const h of PAL[k]) c.add(new THREE.Color().setStyle(h, THREE.SRGBColorSpace)); avg[k] = c.multiplyScalar(1 / PAL[k].length); }
  for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const x = ((i + 0.5) / TS - 0.5) * SPAN, z = (0.5 - (j + 0.5) / TS) * SPAN, w = zoneW(x, z), o = (j * TS + i) * 4;
    let r = 0, g = 0, b = 0; for (const k in w) { r += avg[k].r * w[k]; g += avg[k].g * w[k]; b += avg[k].b * w[k]; }
    img.data[o] = r * 255; img.data[o + 1] = g * 255; img.data[o + 2] = b * 255; img.data[o + 3] = 255 * Math.min(1, density(x, z) * 1.15); }
  cx.putImageData(img, 0, 0); const patch = new THREE.CanvasTexture(cv); patch.colorSpace = THREE.SRGBColorSpace; patch.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const dv = document.createElement("canvas"); dv.width = dv.height = 512; const dx = dv.getContext("2d"); dx.fillStyle = "#000"; dx.fillRect(0, 0, 512, 512);
  dx.fillStyle = "#f00"; for (let i = 0; i < 1100; i++) { const x = R() * 512, y = R() * 512, r = 3 + R() * 5; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { dx.beginPath(); dx.arc(x + ox, y + oy, r, 0, 7); dx.fill(); } }
  const detail = new THREE.CanvasTexture(dv); detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.anisotropy = patch.anisotropy;
  Object.assign(U, { uPatch: { value: patch }, uDetail: { value: detail }, uG1: { value: C("#5f9c45") }, uG2: { value: C("#9ccc62") } });
  const ground = toonWith(0xffffff, "ground", {
    vert: (s) => s.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <project_vertex>", "#include <project_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;"),
    frag: (s) => s.replace("#include <common>", `#include <common>\nuniform sampler2D uPatch, uDetail; uniform vec3 uG1, uG2;\n${NOISE}\n${BLOB}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec4 pa = texture2D(uPatch, vW.xz / ${SPAN.toFixed(1)} + 0.5); float de = texture2D(uDetail, vW.xz / 2.6).r;
        vec3 gr = mix(uG1, uG2, 0.3 + 0.6 * fbm(vW.xz * 0.35));
        diffuseColor.rgb = mix(gr, pa.rgb, clamp(de * pa.a * 1.2, 0.0, 1.0)) * (1.0 - blob());`) });
  // 近く(花のある所)は平ら、遠くはゆるくうねる(平らなままだと遠くの花畑が水面に見えた)
  const groundY = (x, z) => ss(18, 60, Math.hypot(x, z)) * 4 * (fbm(x * 0.025 + 3, z * 0.025 - 8) - 0.45), gg = new THREE.BufferGeometry(), gp = [], gi = [], RINGS = 90, SEG = 160;
  for (let j = 0; j <= RINGS; j++) { const r = 400 * Math.pow(j / RINGS, 2.2); for (let i = 0; i <= SEG; i++) { const a = (i / SEG) * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
    gp.push(x, groundY(x, z), z); if (j < RINGS && i < SEG) { const k = j * (SEG + 1) + i; gi.push(k, k + SEG + 1, k + 1, k + 1, k + SEG + 1, k + SEG + 2); } } }
  gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3)); gg.setIndex(gi); gg.computeVertexNormals(); add(new THREE.Mesh(gg, ground));

  // 花と茎(インスタンス): 中心ほど密に。色は群生から
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qs = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const kinds = { daisy: [], round: [] }, LIM = 17, FLOWERS = 9000; let tries = 0;
  while (kinds.daisy.length + kinds.round.length < FLOWERS && tries++ < 80000) {
    const a = R() * Math.PI * 2, d = LIM * Math.pow(R(), 0.75), x = Math.sin(a) * d, z = Math.cos(a) * d; if (R() > density(x, z)) continue;
    const zone = pick(zoneW(x, z), R()), kind = zone === "blue" || R() < 0.3 ? "round" : "daisy", P = PAL[zone], col = C(P[(R() * P.length) | 0]).multiplyScalar(0.94 + 0.12 * R());
    const size = zone === "blue" ? 0.024 + 0.014 * R() : kind === "round" ? 0.03 + 0.016 * R() : 0.036 + 0.024 * R(), h = d < 7 ? 0.12 + 0.13 * Math.pow(R(), 1.3) : 0.07 + 0.08 * R();   // 遠くは茎を描かず低く(細い茎が針山のように並んで見えた)
    const eye = zone === "yellow" ? "#f2a33a" : kind === "round" ? "#fff8e8" : "#ffd84a";
    kinds[kind].push({ x, z, h, size, col, eye: C(eye), yaw: R() * 6.283, tilt: 0.2 + 0.4 * R(), lean: Math.atan2(SUN.x, SUN.z) + (R() - 0.5) * 2.2, stem: d < 7 });
  }
  const stems = new THREE.InstancedMesh(stemGeo(), toonWith(C("#5c9a45"), "stem", { plant: true, vert: swayVert("hh / 0.3 * position.y * position.y") }), FLOWERS); let ns = 0;
  for (const [kind, geo, eyeR] of [["daisy", flowerGeo(9, 2.2, 0.16), 0.24], ["round", flowerGeo(5, 0.7, 0.22), 0.16]]) {
    const L = kinds[kind], heads = new THREE.InstancedMesh(geo, toonWith(0xffffff, "head", { plant: true, vertexColors: true, vert: swayVert("instanceMatrix[3].y / 0.3") }), L.length);
    const eyes = new THREE.InstancedMesh(discGeo(eyeR, 0.045), toonWith(0xffffff, "head", { plant: true, vert: swayVert("instanceMatrix[3].y / 0.3") }), L.length);
    L.forEach((f, i) => { const up = v.set(Math.sin(f.lean) * Math.sin(f.tilt), Math.cos(f.tilt), Math.cos(f.lean) * Math.sin(f.tilt)); q.setFromUnitVectors(UP, up).multiply(qs.setFromAxisAngle(UP, f.yaw));
      m4.compose(new THREE.Vector3(f.x, f.h, f.z), q, sc.setScalar(f.size)); heads.setMatrixAt(i, m4); eyes.setMatrixAt(i, m4); heads.setColorAt(i, f.col); eyes.setColorAt(i, f.eye);
      if (f.stem) { m4.compose(new THREE.Vector3(f.x, 0, f.z), qs.setFromAxisAngle(UP, f.yaw), sc.set(1, f.h, 1)); stems.setMatrixAt(ns++, m4); } });
    add(heads); add(eyes);
  }
  stems.count = ns; add(stems);
  // 草: 中心ほど密に。足もとの輪の中は低く(靴が隠れないよう)
  const BLADES = 34000, grass = new THREE.InstancedMesh(bladeGeo(), toonWith(0xffffff, "grass", { plant: true, vertexColors: true, vert: swayVert("hh / 0.3 * position.y * position.y * 1.6"), frag: blobFrag }), BLADES);
  const GREENS = ["#6fb04e", "#82bf58", "#5ea446", "#9ccc62", "#76b85a"].map(C), YG = C("#b9d86e"), DG = C("#4a8a3c");
  for (let i = 0; i < BLADES; i++) { const a = R() * Math.PI * 2, d = 11 * Math.pow(R(), 0.7), x = Math.sin(a) * d, z = Math.cos(a) * d, h = d < CLEAR + 0.1 ? 0.04 + 0.04 * R() : 0.08 + 0.14 * R(), tone = fbm(x * 0.3 + 5, z * 0.3 - 2);
    q.setFromAxisAngle(UP, R() * 6.283).multiply(qs.setFromAxisAngle(v.set(1, 0, 0), (R() - 0.5) * 0.5)); m4.compose(new THREE.Vector3(x, 0, z), q, sc.set(1, h, 1)); grass.setMatrixAt(i, m4);
    grass.setColorAt(i, GREENS[(R() * GREENS.length) | 0].clone().lerp(YG, 0.6 * ss(0.55, 0.8, tone)).lerp(DG, 0.5 * ss(0.45, 0.2, tone)).multiplyScalar(0.9 + 0.2 * R())); }
  add(grass);

  // 桜の木(遠景の目印): 幹と枝、平たい傘の形に小さな花の塊を重ねる(大きな球だと風船に見えた)。中に濃い塊を詰めて透けを隠す。下ほど濃い桃色
  const bark = softToon(C("#6e4c3e")), BLOOMS = ["#f29bbb", "#ffb3cd", "#ffcadb", "#ffe2ec"], blobs = BLOOMS.map(() => []);
  for (const [x, z, s] of [[-14, -18, 1.25], [19, -23, 1.4], [-26, 3, 1.1], [34, -6, 1.2]]) { const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = R() * 6.28; t.updateMatrix();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.27, 2.4, 7), bark); trunk.position.y = 1.2; t.add(trunk);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.11, 1.8, 6), bark), a = i * 1.57 + R() * 0.6; b.position.set(Math.sin(a) * 0.55, 2.7, Math.cos(a) * 0.55); b.rotation.set(Math.cos(a) * 0.85, 0, -Math.sin(a) * 0.85); t.add(b); }
    const blob = (x, y, z, r, k) => blobs[k].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.8, r)).premultiply(t.matrix));
    for (let i = 0; i < 12; i++) { const a = R() * 6.283, d = 1.6 * R(); blob(Math.sin(a) * d, 3.3 + 0.4 * R(), Math.cos(a) * d, 0.75, 0); }
    for (let i = 0; i < 130; i++) { const a = R() * 6.283, e = Math.acos(1 - 1.35 * R()), y = Math.cos(e) * 1.2;
      blob(Math.sin(a) * Math.sin(e) * 2.7, 3.35 + y, Math.cos(a) * Math.sin(e) * 2.7, 0.22 + 0.2 * R(), Math.min(3, Math.max(0, Math.round((y + 0.4) * 1.7 + R() - 0.6)))); }
    scene.add(t); }
  BLOOMS.forEach((c, k) => { const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), softToon(C(c)), blobs[k].length); blobs[k].forEach((x, i) => m.setMatrixAt(i, x)); scene.add(m); });

  // 花びら: 舞い落ちる(mode 0)と、回転で渦を巻いて決めで散る(mode 1)。手前のものほど大きくぼかす(被写界深度のまね)
  const DOF = { uFocus: { value: 4 }, uCoc: { value: 0.5 } }, VTX = { uVortex: { value: new THREE.Vector4(VORTEX, BURST, 1.4, 0) }, uCenter: { value: new THREE.Vector3() } };
  const petalMat = (mode) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...U, ...DOF, ...VTX, uMode: { value: mode }, uWind: { value: new THREE.Vector3(...WIND) }, uSun: { value: SUN }, uFog: { value: new THREE.Vector2(30, 170) }, uHaze: { value: HAZE }, uSize: { value: 0.022 } },
    vertexShader: `attribute vec4 aSeed; attribute vec3 aColor; uniform float uTime, uFocus, uCoc, uMode, uSize; uniform vec3 uWind, uSun, uCenter; uniform vec4 uVortex; uniform vec2 uFog;
      varying vec2 vUv; varying float vA, vSoft, vFogK, vLit; varying vec3 vCol;
      mat3 rot(vec3 a, float t) { a = normalize(a); float c = cos(t), s = sin(t), o = 1.0 - c;
        return mat3(o*a.x*a.x + c, o*a.x*a.y + a.z*s, o*a.z*a.x - a.y*s, o*a.x*a.y - a.z*s, o*a.y*a.y + c, o*a.y*a.z + a.x*s, o*a.z*a.x + a.y*s, o*a.y*a.z - a.x*s, o*a.z*a.z + c); }
      void main() { vec4 s = aSeed; vec3 P; float A;
        if (uMode < 0.5) { float L = 8.0 + 6.0 * s.x, u = fract(uTime / L + s.y), age = u * L;   // 寿命ごとに上から出直す(出入りは薄くして見せない)
          P = vec3((s.z - 0.5) * 24.0, 2.2 + 4.5 * s.w, (fract(s.x * 7.13 + s.y * 3.71) - 0.5) * 20.0 - 2.0) + vec3(uWind.x, -0.3 - 0.25 * s.x, uWind.z) * age;
          P += vec3(sin(age * (1.2 + s.w) + s.z * 6.28) * 0.4, sin(age * 2.3 + s.x * 6.28) * 0.06, cos(age * (0.9 + s.x) + s.y * 6.28) * 0.3);
          P.x = mod(P.x + 12.0, 24.0) - 12.0;
          A = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.88, 1.0, u)) * smoothstep(-0.02, 0.2, P.y) * (1.0 - smoothstep(10.5, 12.0, abs(P.x))); }
        else { float delay = s.z * 0.9, tau = uTime - uVortex.x - delay, tb = uTime - uVortex.y, Hh = uVortex.z, tt = clamp(tau, 0.0, uVortex.y - uVortex.x - delay);
          float om = 2.6 + 1.8 * s.w, th = s.x * 6.2832 + om * tt + 0.8 * tt * tt, r = mix(0.9 + 1.5 * s.y, Hh * (0.3 + 0.32 * s.y), smoothstep(0.0, 1.2, tt));
          P = vec3(sin(th) * r, mix(0.15 + 0.15 * s.w, Hh * (0.06 + 1.05 * s.w), smoothstep(0.0, 1.7, tt)) + 0.05 * sin(tt * 5.0 + s.x * 20.0), cos(th) * r);
          A = smoothstep(0.0, 0.35, tau);
          if (tb > 0.0) { float f = (1.0 - exp(-1.6 * tb)) / 1.6;   // 決めで外へ吹き散り、風に流れて落ちる
            P += (vec3(sin(th), 0.0, cos(th)) * (2.8 + 2.4 * s.y) + vec3(cos(th), 0.0, -sin(th)) * om * r * 0.7 + vec3(0.0, 0.8 + 1.6 * s.z, 0.0)) * f + vec3(uWind.x, -0.28, uWind.z) * tb;
            A *= 1.0 - smoothstep(2.0, 3.4 + s.w, tb); } }
        if (A < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        P.y = max(P.y, 0.02); P += uCenter;
        mat3 Rm = rot(vec3(s.z - 0.5, 0.7, s.x - 0.5), uTime * (1.6 + 2.6 * s.w) + s.y * 6.28) * rot(vec3(1.0, 0.0, 0.3), sin(uTime * 3.0 + s.x * 9.0) * 0.8);
        vec4 c = viewMatrix * vec4(P, 1.0); float z = -c.z, coc = clamp(uCoc * abs(z - uFocus) / max(z, 0.1), 0.0, 1.2);
        vec3 Wp = P + Rm * vec3(position.xy * uSize * (0.75 + 0.5 * s.w) * (1.0 + 1.4 * coc), 0.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(Wp, 1.0);
        vUv = position.xy; vSoft = coc; vA = A / (1.0 + 1.3 * coc); vLit = 0.8 + 0.3 * abs(dot(Rm * vec3(0.0, 0.0, 1.0), uSun)); vCol = aColor; vFogK = smoothstep(uFog.x, uFog.y, z); }`,
    fragmentShader: `uniform vec3 uHaze; varying vec2 vUv; varying float vA, vSoft, vFogK, vLit; varying vec3 vCol;
      void main() { float y = vUv.y, yy = (y - 0.1) / 1.1, w = 0.6 * sqrt(max(0.0, 1.0 - yy * yy)) * (0.45 + 0.55 * smoothstep(-1.0, 0.2, y));
        float d = max(abs(vUv.x) - w, 0.2 - length(vec2(vUv.x * 1.3, y - 1.0))), soft = 0.06 + 0.5 * vSoft, a = (1.0 - smoothstep(-soft, soft, d)) * vA;   // 桜の花びら(先に切れ込み)
        if (a < 0.004) discard;
        vec3 c = mix(vCol * vec3(0.93, 0.8, 0.86), mix(vCol, vec3(1.0), 0.45), smoothstep(-1.0, 0.7, y)) * vLit;
        gl_FragColor = vec4(mix(c, uHaze, vFogK), a);
        #include <colorspace_fragment>
      }` });
  const PETAL_COLS = ["#ffb7cf", "#ffc9da", "#ffe4ee", "#ffffff", "#ff9fc0", "#fff3c4"].map(C);
  for (const [mode, n] of [[0, 650], [1, 300]]) { const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2)), seeds = new Float32Array(n * 4), cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { for (let k = 0; k < 4; k++) seeds[i * 4 + k] = R(); const c = PETAL_COLS[(R() * (mode ? 5 : 6)) | 0]; cols.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4)); g.setAttribute("aColor", new THREE.InstancedBufferAttribute(cols, 3)); g.instanceCount = n;
    add(new THREE.Mesh(g, petalMat(mode)), 5); }

  // 光の粒: 漂う花粉のきらめき(mode 0、手前はぼけた玉)と、育つあいだ体のまわりを昇る粒(1)、回転の渦と決めで散る星(2)
  const PX = H / 544, RATE = { uRate: { value: 0 } };
  const sparkMat = (mode) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, ...DOF, ...VTX, ...RATE, uMode: { value: mode }, uPx: { value: PX }, uWind: { value: new THREE.Vector3(...WIND) }, uCol: { value: C(mode ? "#fff2c8" : "#fffbe8") } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime, uFocus, uCoc, uMode, uPx, uRate; uniform vec3 uCenter, uWind; uniform vec4 uVortex; varying float vA, vSoft, vStar;
      void main() { vec4 s = aSeed; vec3 P; float A, size; vStar = 0.0;
        if (uMode < 0.5) { P = vec3((s.x - 0.5) * 14.0, 0.15 + s.y * 2.8, (s.z - 0.5) * 12.0 - 1.0) + 0.35 * vec3(sin(uTime * 0.3 + s.w * 30.0), 0.5 * sin(uTime * 0.5 + s.x * 20.0), cos(uTime * 0.25 + s.y * 25.0));
          P.x = mod(P.x + uTime * uWind.x * 0.5 + 7.0, 14.0) - 7.0; A = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.5 + 2.0 * s.w) + s.x * 40.0), 3.0)) * 0.55; size = 2.2 + 2.0 * s.w; }
        else if (uMode < 1.5) { float L = 1.6 + s.w, u = fract(uTime / L + s.x), th = s.y * 6.2832 + u * 2.5, Hh = uVortex.z, r = Hh * (0.22 + 0.25 * s.z) * (1.0 - 0.3 * u);   // 昇る粒(育つ速さで濃さが変わる)
          P = vec3(sin(th) * r, Hh * (0.02 + 1.15 * u), cos(th) * r); A = uRate * sin(3.1416 * u) * (0.6 + 0.4 * sin(uTime * 9.0 + s.x * 50.0)); size = 3.0 + 4.0 * s.w; vStar = 1.0; }
        else { float delay = s.z * 0.6, tau = uTime - uVortex.x - 0.4 - delay, tb = uTime - uVortex.y, Hh = uVortex.z, tt = clamp(tau, 0.0, uVortex.y - uVortex.x - 0.4 - delay);
          float th = s.x * 6.2832 + 4.5 * tt + 1.2 * tt * tt, r = Hh * (0.25 + 0.3 * s.y);
          P = vec3(sin(th) * r, Hh * (0.1 + 1.0 * s.w) + 0.06 * sin(tt * 4.0 + s.y * 9.0), cos(th) * r); A = smoothstep(0.0, 0.3, tau);
          if (tb > 0.0) { P += (vec3(sin(th), 0.4 + s.z, cos(th)) * (2.0 + 2.0 * s.y)) * (1.0 - exp(-2.2 * tb)) / 2.2; A *= 1.0 - smoothstep(0.6, 1.8 + s.w, tb); }
          A *= 0.7 + 0.3 * sin(uTime * 12.0 + s.x * 60.0); size = 6.0 + 10.0 * s.w * s.w; vStar = 1.0; }
        if (A < 0.004) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        P += uCenter; vec4 c = viewMatrix * vec4(P, 1.0); float z = -c.z, coc = clamp(uCoc * abs(z - uFocus) / max(z, 0.1), 0.0, 1.0);
        gl_Position = projectionMatrix * c; vSoft = coc * (1.0 - vStar); gl_PointSize = uPx * size * (1.0 + 5.0 * vSoft); vA = A / (1.0 + 5.0 * vSoft); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA, vSoft, vStar;
      void main() { vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);
        float a = vStar > 0.5 ? exp(-abs(q.x) * 10.0) * exp(-abs(q.y) * 2.2) + exp(-abs(q.y) * 10.0) * exp(-abs(q.x) * 2.2) + exp(-r * r * 9.0) * 0.8   // 4本の光の星
          : vSoft > 0.12 ? smoothstep(1.0, 0.86, r) * (0.55 + 0.45 * smoothstep(0.4, 0.95, r)) : exp(-r * r * 5.0);   // ぼけた玉は縁が明るい
        gl_FragColor = vec4(uCol, a * vA);
        #include <colorspace_fragment>
      }` });
  for (const [mode, n] of [[0, 170], [1, 140], [2, 170]]) { const g = new THREE.BufferGeometry(), seeds = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) seeds[i] = R();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4)); add(new THREE.Points(g, sparkMat(mode)), 6); }

  // 蝶: 前羽と後ろ羽(2つの楕円)を画素で描いた板を、胴を軸に羽ばたかせる。近くの3匹は体のまわりを回り、最後の1匹は指さした手に寄る
  const wingGeo = new THREE.BufferGeometry(); wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -1, 1, 0, -1, 1, 0, 1, 0, 0, 1], 3));
  wingGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); wingGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const WINGS = [["#ffffff", "#a9d8ff", "#2f63a8"], ["#fffbe6", "#ffe070", "#b97c10"], ["#ffffff", "#fbf7f0", "#3b3b48"], ["#fff2f8", "#ffa6cb", "#a8457a"]];
  const BF = [[0.2, 0.3, 1.3, 0.95, 0.55, 0, 1], [-0.4, -0.5, 1.7, 1.25, -0.45, 3, 0.9], [0.6, 0.8, 2.3, 0.7, 0.4, 1, 1], [-3.5, -2, 2, 0.9, 0.35, 2, 0.9], [4, -3, 2.4, 1.2, -0.3, 0, 1],
    [-6, 2, 2, 0.8, 0.4, 1, 0.9], [6.5, 3, 2.2, 1, -0.38, 3, 1], [1.5, -6.5, 3, 1.4, 0.3, 2, 1], [2.5, 2.5, 1.6, 1.1, 0.42, 0, 1]];
  const flies = BF.map(([x, z, rad, y, w, pal, s], i) => { const [a, b, c] = WINGS[pal].map(C), g = new THREE.Group(), ph = [0, 1, 2, 3, 4, 5].map(() => R() * 6.283);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uIn: { value: a }, uMid: { value: b }, uEdge: { value: c } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uIn, uMid, uEdge; varying vec2 vUv;
        float ell(vec2 p, vec2 c, vec2 r, float a) { p -= c; float cs = cos(a), sn = sin(a); p = mat2(cs, -sn, sn, cs) * p; return (length(p / r) - 1.0) * min(r.x, r.y); }
        void main() { vec2 p = vec2(vUv.x, vUv.y * 2.0 - 1.0); float d = min(ell(p, vec2(0.42, 0.3), vec2(0.6, 0.42), 0.5), ell(p, vec2(0.3, -0.38), vec2(0.4, 0.38), -0.3));
          float aa = fwidth(d) * 1.5, al = 1.0 - smoothstep(-aa, aa, d); if (al < 0.01) discard;
          vec3 c = mix(uIn, uMid, smoothstep(0.05, 0.5, length(p))); c = mix(c, uEdge, smoothstep(-0.08, -0.025, d)); if (p.x < 0.05 && abs(p.y) < 0.55) c = vec3(0.16, 0.12, 0.12);
          gl_FragColor = vec4(c, al);
          #include <colorspace_fragment>
        }` });
    const L = new THREE.Mesh(wingGeo, mat), Rw = new THREE.Mesh(wingGeo, mat); Rw.scale.x = -1; g.add(L, Rw); g.scale.set(0.085 * s, 0.085 * s, 0.065 * s); g.rotation.order = "YXZ"; add(g, 7);
    return { g, L, Rw, x, z, rad, y, w, ph, i }; });
  const path = (f, t, o) => o.set(f.x + f.rad * Math.sin(f.w * t + f.ph[0]) + 0.35 * f.rad * Math.sin(2.7 * f.w * t + f.ph[1]), f.y + 0.22 * Math.sin(1.3 * t + f.ph[2]),
    f.z + 0.8 * f.rad * Math.cos(f.w * t + f.ph[0]) + 0.3 * f.rad * Math.cos(2.1 * f.w * t + f.ph[3]));

  // 決めの瞬間の光: 体の後ろから外へ広がる光の輪だけ(光の芯は小さくてもブルームが体ごと白く飛ばした)
  const flash = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: -1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT; varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0, x = (r - 0.12 - 0.8 * (1.0 - exp(-3.5 * max(uT, 0.0)))) / 0.04;
      float ring = uT > 0.0 ? exp(-x * x) * exp(-2.6 * uT) : 0.0;
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.86), 0.6 * ring * (1.0 - smoothstep(0.9, 1.0, r)));
      #include <colorspace_fragment>
    }` })), 8);

  // 仕上げ: ブルーム(白い所がにじむ)、色(少し鮮やか・影をほんのり藤色・上を暖かく)、周辺減光、決めの閃光
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });   // stencil: 髪の線が使う
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.55, 0.88); composer.addPass(bloom);
  const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uFlash: { value: 0 }, uAspect: { value: W / H } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uFlash, uAspect; varying vec2 vUv;
      void main() { vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, 1.1); col += vec3(0.018, 0.01, 0.03) * (1.0 - smoothstep(0.0, 0.6, l)); col *= mix(vec3(0.95, 0.96, 1.02), vec3(1.04, 1.02, 0.97), vUv.y);
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0); col *= 1.0 - 0.22 * smoothstep(0.45, 1.25, length(q)); col = mix(col, vec3(1.0, 0.97, 0.93), uFlash);
        vec2 rp = (vUv - vec2(0.1, 1.3)) * vec2(uAspect, 1.0); float ra = atan(rp.y, rp.x), rl = length(rp);   // 左上から差す光の筋と、隅の暖かい光
        col += vec3(1.0, 0.93, 0.8) * (pow(0.5 + 0.5 * sin(ra * 23.0 + sin(ra * 9.0) * 2.0), 6.0) * 0.06 * smoothstep(1.9, 0.4, rl) + 0.08 * smoothstep(1.3, 0.0, rl));
        gl_FragColor = vec4(max(col, 0.0), c.a); }` });
  composer.addPass(grade); composer.addPass(new OutputPass());

  // カメラ: [秒, 方位(0 = 正面, + = 本人の左), 高さ, 距離(m, 本人の最後の背 1.5 m あたり), 注視の高さ(今の背に対する割合), 画角]
  const KEYS = [[0, -0.75, 2.4, 8.2, 0.5, 34], [2.4, -0.45, 1.2, 5.0, 0.55, 30], [4.8, 0.15, 0.95, 4.0, 0.56, 28], [6.4, 0.95, 0.35, 3.3, 0.66, 30],
    [7.7, 0.3, 0.8, 3.6, 0.55, 30], [9.0, 0.3, 1.0, 3.2, 0.56, 28], [SECONDS, 0.26, 1.15, 2.2, 0.7, 26]];
  const camAt = (t) => { const i = Math.max(0, Math.min(KEYS.length - 2, KEYS.findIndex((k) => k[0] > t) - 1)), a = KEYS[i], b = KEYS[i + 1], u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
    const tan = (j, c) => { const p = KEYS[j - 1], n = KEYS[j + 1]; return p && n ? ((n[c] - p[c]) / (n[0] - p[0])) * (b[0] - a[0]) : 0; };   // Catmull-Rom(両端は止まる)
    return [1, 2, 3, 4, 5].map((c) => { const m0 = tan(i, c), m1 = tan(i + 1, c), u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * a[c] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * b[c] + (u3 - u2) * m1; }); };
  const HP = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), HIPS = new THREE.Vector3();

  return { seconds: SECONDS, grow: growAt,
    motion: (t) => (t < HOLD ? t : HOLD + 0.35 * (1 - Math.exp(-(t - HOLD) / 0.35))),   // 決めのポーズで時を止める(髪・布・花びらは動き続ける)
    wind: (t) => { const k = t > BURST ? Math.exp(-(t - BURST) / 0.5) : 0; return [WIND[0], 1.6 * k, WIND[2] + 1.2 * k]; },   // 決めで下から吹き上げる
    render(t, { av, H: h, H1 }) {
      const s = (H1 || 1.5) / 1.5, [az, cy, dist, look, fov] = camAt(t);
      U.uTime.value = t; cam.fov = fov; cam.aspect = W / H; cam.updateProjectionMatrix();
      cam.position.set(Math.sin(az) * dist * s + 0.02 * Math.sin(t * 0.7), cy * s + 0.015 * Math.sin(t * 0.9 + 1), Math.cos(az) * dist * s); cam.lookAt(0, look * h, 0);
      av?.bones?.hips?.getWorldPosition(HIPS); U.uShadow.value.set(HIPS.x, HIPS.z, 0.3 * h, 0.35);
      DOF.uFocus.value = cam.position.distanceTo(tmp.set(0, 0.55 * h, 0)); VTX.uVortex.value.z = h;
      RATE.uRate.value = Math.min(1, (growAt(t + 0.05) - growAt(t - 0.05)) / 0.1 / 0.25);
      // 蝶: 羽ばたき 4.5 回/秒(24 コマで読める速さ)。最後の1匹は指さし(拍 10–12)の間、手のまわりを回る
      const hand = av?.bones?.["hand.L"], near = ss(5.7, 6.4, t) * (1 - ss(7.0, 7.7, t)); if (hand) hand.getWorldPosition(HP);
      for (const f of flies) { path(f, t, tmp); path(f, t + 0.05, tmp2);
        if (f.i === flies.length - 1 && hand && near > 0) { const a = t * 3.2, ho = HP.clone().add(v.set(Math.sin(a) * 0.09, 0.08 + 0.03 * Math.sin(t * 5), Math.cos(a) * 0.09)), ho2 = HP.clone().add(v.set(Math.sin(a + 0.16) * 0.09, 0.08, Math.cos(a + 0.16) * 0.09));
          tmp.lerp(ho, near); tmp2.lerp(ho2, near); }
        const fl = 4.5 * 2 * Math.PI * t + f.ph[4], th = -0.25 + 1.45 * (0.5 + 0.5 * Math.sin(fl)); f.g.position.copy(tmp); f.g.position.y += 0.02 * Math.sin(fl);
        tmp2.sub(tmp); f.g.rotation.set(-Math.atan2(tmp2.y, Math.hypot(tmp2.x, tmp2.z)) * 0.6, Math.atan2(tmp2.x, tmp2.z), 0); f.L.rotation.z = th; f.Rw.rotation.z = -th; }
      const k = Math.exp(-(((t - BURST) / 0.18) ** 2)) + (t > BURST ? 0.25 * Math.exp(-(t - BURST) / 0.5) : 0);
      flash.position.set(0, 0.6 * h, 0); flash.position.addScaledVector(tmp.copy(flash.position).sub(cam.position).normalize(), 0.6); flash.quaternion.copy(cam.quaternion);
      flash.scale.setScalar(3.2 * h); flash.material.uniforms.uT.value = t - BURST;
      bloom.strength = 0.3 + 0.1 * k; grade.uniforms.uFlash.value = 0.06 * Math.exp(-(((t - BURST) / 0.15) ** 2));
      composer.render();
    } };
}
