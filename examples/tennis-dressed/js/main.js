// 起動・描画ループ・カメラ・メニュー
import * as THREE from 'three';
import { STEP, clamp } from './constants.js';
import { buildStadium } from './court.js';
import { Character, SIT_POSE } from './character.js';
import { Ball } from './ball.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { dressInHinagata, recipeFromText } from './hina.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 700);

const stadium = buildStadium(scene);
const ball = new Ball(scene);
const playerChar = new Character({
  shirt: 0xe0383e, shorts: 0xf4f4f4, skin: 0xf1c6a3, hair: 0x3a2516, accent: 0xffffff,
  headwear: 'cap', capColor: 0xffffff, shoes: 0xf6f6f6, sole: 0xe0383e, racketColor: 0xe0383e,
});
const cpuChar = new Character({
  shirt: 0x2f6fe0, shorts: 0x1b2a44, skin: 0xb98053, hair: 0x15100c, accent: 0xffd23a,
  headwear: 'band', capColor: 0xffffff, shoes: 0x2a2a2a, sole: 0xffd23a, racketColor: 0x1a1a1a,
});
const umpire = new Character({
  shirt: 0x1d2d4f, shorts: 0x5d616b, skin: 0xe6b98f, hair: 0x8a8a8a, accent: 0x1d2d4f,
  headwear: 'none', racket: false, wristband: false, shoes: 0x222222, sole: 0x111111,
});
umpire.staticPose = SIT_POSE;
umpire.root.position.copy(stadium.umpireSeat);
umpire.root.rotation.y = Math.PI / 2;
scene.add(playerChar.root, cpuChar.root, umpire.root);

// ---- 雛形のキャラ（高等身）を着せる ----
// キャラは characters/ のファイル（雛形エディタの「書き出し → JSON」そのもの）。差し替えるときはファイルを置き換えるだけ
const RECIPES = { player: 'characters/player.json', cpu: 'characters/cpu.json', umpire: 'characters/umpire.json' };
const startBtn = document.getElementById('btn-start');
startBtn.disabled = true; startBtn.textContent = 'キャラクター読み込み中…';
// 作っている間もスタジアムとタイトルは動かす（人形は隠しておき、できた順に雛形が現れる）
for (const c of [playerChar, cpuChar, umpire]) c.root.traverse((o) => { if (o.isMesh) o.visible = false; });
// あなたのキャラ: 用意したキャラか、エディタで作った自分のキャラ（貼り付けたものはこのブラウザに覚えておく）
const MINE_KEY = 'hinagataTennis.mine', mineBox = document.getElementById('mine'), mineMsg = document.getElementById('mine-msg');
const store = { get() { try { return localStorage.getItem(MINE_KEY); } catch { return null; } }, set(v) { try { v ? localStorage.setItem(MINE_KEY, v) : localStorage.removeItem(MINE_KEY); } catch { /* 覚えられないだけ */ } } };
let useMine = false, mineText = store.get() || '';
mineBox.value = mineText;
function playerRecipe() { if (!useMine) return RECIPES.player; try { return recipeFromText(mineText) ?? RECIPES.player; } catch { return RECIPES.player; } }
let dressing = Promise.resolve();
function redressPlayer() {
  startBtn.disabled = true; startBtn.textContent = 'キャラクター読み込み中…';
  dressing = dressing.then(() => dressInHinagata(playerChar, playerRecipe(), { camera }))
    .then(() => { startBtn.disabled = false; startBtn.textContent = '試合開始'; mineMsg.textContent = useMine ? 'このキャラで遊びます' : ''; if (startWhenReady) { startWhenReady = false; startMatch(); } },
      (e) => { startBtn.disabled = false; startBtn.textContent = '試合開始'; mineMsg.textContent = 'このキャラは作れませんでした: ' + e.message; console.error(e); });
}
document.querySelectorAll('#opt-char button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#opt-char button').forEach((x) => x.classList.toggle('on', x === b));
  useMine = b.dataset.v === 'mine'; document.getElementById('mine-box').hidden = !useMine;
  if (!useMine || mineText) redressPlayer(); else mineMsg.textContent = 'エディタのリンクか書き出したファイルの中身を貼ってください';
}));
document.getElementById('mine-file').addEventListener('change', async (e) => {   // 書き出した .hinagata.json（リンクには描いた絵が入らない）
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  mineBox.value = await f.text(); mineBox.dispatchEvent(new Event('change'));
});
mineBox.addEventListener('change', () => {
  if (mineBox.value === mineText && useMine) return;   // （同じ中身で二度目の change: ボタンを押してフォーカスが外れたとき）
  mineText = mineBox.value;
  try { if (!recipeFromText(mineText)) throw new Error('空です'); store.set(mineText); redressPlayer(); }
  catch (e) { mineMsg.textContent = '読めませんでした: ' + e.message; }
});
Promise.all([
  dressInHinagata(playerChar, RECIPES.player, { camera }),
  dressInHinagata(cpuChar, RECIPES.cpu, { camera }),
  dressInHinagata(umpire, RECIPES.umpire, { camera, racket: false }),
]).then(() => { startBtn.disabled = false; startBtn.textContent = '試合開始'; },
  (e) => { startBtn.textContent = 'キャラクターを作れませんでした'; console.error(e); });

const ui = new UI();
const sfx = new Sfx();
const input = new Input();
const game = new Game({ ball, playerChar, cpuChar, ui, sfx, input });

// ---- カメラ ----
const CAM_MODES = [
  { id: 'broadcast', label: 'カメラ: 中継' },
  { id: 'behind', label: 'カメラ: 背後' },
  { id: 'high', label: 'カメラ: 俯瞰' },
];
const cam = { mode: 0, pos: new THREE.Vector3(0, 9, 30), look: new THREE.Vector3(), forced: null, cp: new THREE.Vector3(), cl: new THREE.Vector3() };
const tp = new THREE.Vector3(), tl = new THREE.Vector3();
let titleOpen = true;

function updateCamera(dt) {
  let fov = 45, rate = 5;
  const P = game.p.pos;
  const close = (game.state === 'pointOver' || game.state === 'matchOver') && game.focus && game.pointT > 0.7;
  const mode = cam.forced || (titleOpen ? 'title' : close ? 'close' : CAM_MODES[cam.mode].id);
  if (mode === 'custom') {
    tp.copy(cam.cp);
    tl.copy(cam.cl);
    fov = cam.fov || 40;
    rate = 50;
  } else if (mode === 'title') {
    const a = game.time * 0.05 + 0.6;
    tp.set(Math.sin(a) * 9.5, 7.5, Math.cos(a) * 23);
    tl.set(0, 0.6, 0);
    rate = 3;
  } else if (mode === 'close') {
    const a = game.focus;
    const ang = a.yaw + 0.5 + (game.pointT - 0.7) * 0.18;
    tp.set(a.pos.x + Math.sin(ang) * 4.2, 1.5, a.pos.z + Math.cos(ang) * 4.2);
    tl.set(a.pos.x, 1.15, a.pos.z);
    fov = 40;
    rate = 2.5;
  } else if (mode === 'behind') {
    tp.set(P.x * 0.75, 2.9, P.z + 6.2);
    tl.set(P.x * 0.3, 0.9, P.z - 14);
    fov = 55;
  } else if (mode === 'high') {
    tp.set(0, 19, 21);
    tl.set(0, 0, 1);
    fov = 50;
  } else {
    tp.set(P.x * 0.35, 6.4, 21.5 + Math.max(0, P.z - 12) * 0.6);
    tl.set(P.x * 0.15, 0.3, -1.5);
    fov = 44;
  }
  // 縦長画面ではコートの横幅が入るように画角を広げる
  if (camera.aspect < 1.25 && mode !== 'custom') {
    const t = Math.tan((fov * Math.PI) / 360) * (1.25 / camera.aspect);
    fov = Math.min(78, (Math.atan(t) * 360) / Math.PI);
  }
  const k = 1 - Math.exp(-dt * rate);
  cam.pos.lerp(tp, k);
  cam.look.lerp(tl, k);
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov += (fov - camera.fov) * k;
    camera.updateProjectionMatrix();
    resizeTrail();
  }
}

function resizeTrail() {
  const h = renderer.domElement.height;
  ball.trailMat.uniforms.scale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeTrail();
}
window.addEventListener('resize', onResize);
resizeTrail();

// ---- メニュー ----
const settings = { level: 'normal', games: 3 };
function bindSeg(id, key, parse) {
  const seg = document.getElementById(id);
  seg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      settings[key] = parse(b.dataset.v);
      sfx.init();
      sfx.click();
    });
  });
}
bindSeg('opt-level', 'level', (v) => v);
bindSeg('opt-games', 'games', (v) => parseInt(v, 10));

let startWhenReady = false;   // キャラを作っている間に押された「試合開始」は、できてから
function startMatch() {
  if (startBtn.disabled) { startWhenReady = true; return; }
  sfx.init();
  titleOpen = false;
  ui.show('title', false);
  ui.show('result', false);
  ui.show('pause', false);
  ui.show('hud', true);
  ui.clearMessage();
  ui.speed('--', '');
  ui.camLabel(CAM_MODES[cam.mode].label);
  game.newMatch({ level: settings.level, games: settings.games, demo: false });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function toTitle() {
  titleOpen = true;
  ui.show('hud', false);
  ui.show('result', false);
  ui.show('pause', false);
  ui.show('title', true);
  ui.clearMessage();
  game.newMatch({ demo: true, level: 'normal', games: 3 });
}

function setPaused(v) {
  if (titleOpen || game.state === 'matchOver') return;
  game.paused = v;
  ui.show('pause', v);
}

document.getElementById('btn-start').addEventListener('click', startMatch);
document.getElementById('btn-again').addEventListener('click', startMatch);
document.getElementById('btn-title').addEventListener('click', toTitle);
document.getElementById('btn-resume').addEventListener('click', () => setPaused(false));
document.getElementById('btn-quit').addEventListener('click', toTitle);

input.on('press', (shot) => { if (!titleOpen) game.humanPress(shot); });
input.on('release', (shot) => game.humanRelease(shot));
input.on('key', (code) => {
  if (titleOpen) {
    if (code === 'Enter') startMatch();
    return;
  }
  if (code === 'KeyP' || code === 'Escape') setPaused(!game.paused);
  else if (code === 'KeyC') {
    cam.mode = (cam.mode + 1) % CAM_MODES.length;
    ui.camLabel(CAM_MODES[cam.mode].label);
  } else if (code === 'KeyM') {
    ui.camLabel(sfx.toggleMute() ? 'サウンド: OFF' : 'サウンド: ON');
  } else if (code === 'Enter' && game.state === 'matchOver') startMatch();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

if (window.matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('touch');
  input.bindTouch(document.getElementById('stick'), document.getElementById('knob'), document.querySelectorAll('#tbtns button'));
}

// ---- ループ ----
game.newMatch({ demo: true, level: 'normal', games: 3 });
ui.hint(null);
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = clamp(dt, 0, 0.1);
  const vdt = game.paused ? 0 : dt;
  if (!game.paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 14) { game.step(STEP); acc -= STEP; n++; }
    if (n >= 14) acc = 0;
  }
  game.updateVisuals(vdt);
  umpire.update(vdt, 0, 0, ball.s.p);
  stadium.update(vdt, game.excite);
  updateCamera(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// デバッグ・自動テスト用
window.__tennis = { game, camera, cam, renderer, startMatch, toTitle, setPaused };
