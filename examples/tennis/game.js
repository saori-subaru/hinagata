// Hinagata Tennis — a small 3D tennis game. The player is the Hinagata character in character.json (edit it live in the editor),
// the opponent is rival.json.
import * as THREE from "three";
import { createAvatar, POSES, measureGait } from "../../src/index.js";

const params = new URLSearchParams(location.search);
const DEMO = params.has("demo");   // ?demo: the computer plays both sides (for watching / testing)

// ── court (units: the characters are about 1.35 tall) ──
const HL = 7.5, HW = 3.2, SERVICE = 4, NET_H = 0.62, BALL_R = 0.075, G = 9.8;

// ── renderer, scene, camera ──
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#8fc9ef");
scene.fog = new THREE.Fog("#8fc9ef", 30, 60);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
// a tall screen (a phone held upright) gets a taller view, so the whole court's width stays in sight
const fit = () => { const a = innerWidth / innerHeight, wide = 1.15; camera.aspect = a; camera.fov = a >= wide ? 48 : 2 * Math.atan(Math.tan(24 * Math.PI / 180) * wide / a) * 180 / Math.PI; camera.updateProjectionMatrix(); };
fit(); addEventListener("resize", () => { fit(); renderer.setSize(innerWidth, innerHeight); });

scene.add(new THREE.HemisphereLight("#ffffff", "#7a9a6a", 1.2));
const sun = new THREE.DirectionalLight("#ffffff", 1.6);
sun.position.set(4, 10, 6);
scene.add(sun);

// ground, court, lines, net
const flat = (w, h, color, y = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ color })); m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); return m; };
flat(80, 80, "#6fae5c");
flat(HW * 2 + 4, HL * 2 + 6, "#c9774f", 0.002);   // clay surround
flat(HW * 2, HL * 2, "#3f7fc4", 0.004);           // the court
const line = (x, z, w, d) => { const m = flat(w, d, "#ffffff", 0.006); m.position.x = x; m.position.z = z; };
const LW = 0.07;
line(-HW, 0, LW, HL * 2); line(HW, 0, LW, HL * 2);                    // side lines
line(0, -HL, HW * 2 + LW, LW); line(0, HL, HW * 2 + LW, LW);          // base lines
line(0, -SERVICE, HW * 2, LW); line(0, SERVICE, HW * 2, LW);          // service lines
line(0, 0, LW, SERVICE * 2);                                          // centre service line
line(0, -HL + 0.15, LW, 0.3); line(0, HL - 0.15, LW, 0.3);            // centre marks
{
  const netW = HW * 2 + 0.8;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(netW, NET_H - 0.08), new THREE.MeshBasicMaterial({ color: "#1d2430", transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  net.position.set(0, (NET_H - 0.08) / 2, 0); scene.add(net);
  const band = new THREE.Mesh(new THREE.BoxGeometry(netW, 0.08, 0.03), new THREE.MeshLambertMaterial({ color: "#ffffff" }));
  band.position.set(0, NET_H - 0.04, 0); scene.add(band);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, NET_H + 0.05, 10), new THREE.MeshLambertMaterial({ color: "#2b2b2b" })); p.position.set(s * netW / 2, (NET_H + 0.05) / 2, 0); scene.add(p); }
}

// blob shadows (cheap and readable: they show where the ball is over the court)
const shadowMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.25, depthWrite: false });
const blob = (r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), shadowMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; scene.add(m); return m; };

// the ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshLambertMaterial({ color: "#e4f53a", emissive: "#3a4000" }));
scene.add(ball);
const ballShadow = blob(BALL_R * 1.2);

// a tennis racket (attached to the right hand once the avatars are built)
function makeRacket(color) {
  const g = new THREE.Group();
  const frameM = new THREE.MeshLambertMaterial({ color }), gripM = new THREE.MeshLambertMaterial({ color: "#2a2a2a" });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 8), gripM); handle.position.y = 0.06; g.add(handle);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), frameM); throat.position.y = 0.2; g.add(throat);
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 28), frameM); head.scale.set(1, 1.3, 1); head.position.y = 0.37; g.add(head);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: "#f4f4f0", transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  strings.scale.set(1, 1.3, 1); strings.position.y = 0.37; g.add(strings);
  return g;
}

// ── the swing: our own pose (Hinagata has no racket swing built in). A forehand with the right hand:
//    back-swing (body turned, racket back) → strike (arm comes through in front) → follow-through (across the body) → back to ready.
const sin = Math.sin, ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const SWING_T = 0.55;
const ARM = {   // upperArm.R, lowerArm.R, hand.R at each key
  ready:  { ua: [-0.35, 0.0, 0.25], la: [-0.9, 0, 0], h: [0, 0, 0] },
  back:   { ua: [0.15, 0.6, -0.55], la: [-0.5, 0, 0], h: [0, 0, 0.3] },
  hit:    { ua: [-0.9, -0.2, -0.7], la: [-0.25, 0, 0], h: [0, 0, 0] },
  follow: { ua: [-1.7, -0.5, 0.1], la: [-1.2, 0, 0], h: [0, 0, 0] },
};
function swingPose(state) {
  return (t) => {
    const u = Math.min(1, Math.max(0, (t - state.swingT0) / SWING_T));
    const b1 = ss(0, 0.3, u), b2 = ss(0.3, 0.55, u), b3 = ss(0.55, 0.8, u), b4 = ss(0.8, 1, u);
    const arm = (k) => mix(mix(mix(mix(ARM.ready[k], ARM.back[k], b1), ARM.hit[k], b2), ARM.follow[k], b3), ARM.ready[k], b4);
    const twist = 0.7 * b1 - 0.7 * b2 - 0.6 * b3 + 0.6 * b4;   // the chest turns away on the back-swing, then through
    const crouch = 0.25 + 0.15 * (b1 - b3);
    return { b: {
      spine: [0.12, twist * 0.6, 0], chest: [0, twist * 0.5, 0], head: [-0.05, -twist * 0.8, 0],
      "upperArm.R": arm("ua"), "lowerArm.R": arm("la"), "hand.R": arm("h"),
      "upperArm.L": [-0.6 + 0.6 * b2, 0, -0.35], "lowerArm.L": [-0.6, 0, 0],
      "upperLeg.L": [-0.45 * crouch, 0, 0.12], "upperLeg.R": [-0.45 * crouch, 0, -0.12],
      "lowerLeg.L": [0.8 * crouch, 0, 0], "lowerLeg.R": [0.8 * crouch, 0, 0],
      "foot.L": [-0.35 * crouch, 0, 0], "foot.R": [-0.35 * crouch, 0, 0] },
      y: -0.045 * crouch, grip: { L: 0.3, R: 1 } };
  };
}
// the ready stance between shots: knees bent a little, racket held in front
POSES.tennisReady = (t) => ({ b: {
  spine: [0.15, 0, 0], head: [-0.08, 0, 0],
  "upperArm.R": ARM.ready.ua, "lowerArm.R": ARM.ready.la, "upperArm.L": [-0.45, 0, -0.3], "lowerArm.L": [-0.9, 0, 0],
  "upperLeg.L": [-0.25, 0, 0.14], "upperLeg.R": [-0.25, 0, -0.14], "lowerLeg.L": [0.45, 0, 0], "lowerLeg.R": [0.45, 0, 0],
  "foot.L": [-0.2, 0, 0], "foot.R": [-0.2, 0, 0], chest: [sin(t * 3) * 0.02, 0, 0] }, y: -0.025 + sin(t * 6) * 0.006, grip: { L: 0.3, R: 1 } });

// ── players ──
const msgEl = document.getElementById("msg");
const loadJSON = async (f) => { const r = await fetch(f, { cache: "no-store" }); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); };
const [recipeYou, recipeCpu] = await Promise.all([loadJSON("character.json"), loadJSON("rival.json")]);
const [avYou, avCpu] = await Promise.all([createAvatar(recipeYou), createAvatar(recipeCpu)]);

function makePlayer(avatar, side, name, racketColor) {
  // side: +1 = near half (z > 0, facing -z), -1 = far half (z < 0, facing +z)
  const p = { avatar, side, name, at: 0, swingT0: -99, swinging: false, hitDone: false, x: 0, z: side * (HL - 0.6), face: side > 0 ? Math.PI : 0,
    speed: name === "you" ? 4.6 : 4.0, vx: 0, vz: 0, celebrate: 0, faceSel: { ...avatar.faceSel } };
  p.poseName = "swing_" + name;
  POSES[p.poseName] = swingPose(p);
  p.gait = measureGait(avatar, "run");   // units / s at playback speed 1 (measured once)
  avatar.play("tennisReady");
  scene.add(avatar.object);
  p.shadow = blob(0.38);
  // the racket in the right hand, its handle pointing on from the forearm
  const hand = avatar.bones["hand.R"], fore = avatar.bones["lowerArm.R"];
  avatar.object.updateMatrixWorld(true);
  const dir = hand.getWorldPosition(new THREE.Vector3()).sub(fore.getWorldPosition(new THREE.Vector3()));
  const q = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const local = dir.applyQuaternion(q).normalize();   // the arm's direction in the hand's own frame
  const racket = makeRacket(racketColor);
  racket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), local);
  racket.position.copy(local).multiplyScalar(0.02);
  racket.scale.setScalar(1 / hand.getWorldScale(new THREE.Vector3()).x);
  hand.add(racket);
  p.racket = racket;
  return p;
}
const you = makePlayer(avYou, +1, "you", "#2f6fd0");
const cpu = makePlayer(avCpu, -1, "cpu", "#c8343e");
const players = [you, cpu];
const other = (p) => (p === you ? cpu : you);

// ── game state ──
const B = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), live: false, held: null, bounces: 0, lastHitter: null, sideOfBounce: 0, spin: 0 };
const score = { you: 0, cpu: 0, gYou: 0, gCpu: 0, server: you };
let phase = "serve", phaseT = 0, message = "", messageT = 0;
const keys = new Set();
addEventListener("keydown", (e) => { keys.add(e.code); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault(); if (e.code === "Space" || e.code === "KeyJ") pressSwing(); });
addEventListener("keyup", (e) => keys.delete(e.code));
// touch: a pad (held arrows) and a swing button, on phones and tablets
if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
  const pad = document.createElement("div"); pad.id = "pad";
  for (const [code, label, cls] of [["ArrowUp", "▲", "u"], ["ArrowLeft", "◀", "l"], ["ArrowRight", "▶", "r"], ["ArrowDown", "▼", "d"]]) {
    const b = document.createElement("button"); b.textContent = label; b.className = cls; b.type = "button";
    const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); keys.add(code); b.classList.add("on"); }, off = () => { keys.delete(code); b.classList.remove("on"); };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
    pad.append(b); }
  const sw = document.createElement("button"); sw.id = "swingBtn"; sw.type = "button"; sw.textContent = "打つ";
  sw.addEventListener("pointerdown", (e) => { e.preventDefault(); pressSwing(); });
  document.body.append(pad, sw);
  document.getElementById("help").textContent = "左のパッドで移動 · 「打つ」でスイング/サーブ · 打つ瞬間にパッドで方向と深さ";
}

function say(text, t = 1.4) { message = text; messageT = t; msgEl.textContent = text; }
const NAMES = ["0", "15", "30", "40"];
function pointText() {
  const a = score.you, b = score.cpu;
  if (a >= 3 && b >= 3) return a === b ? "Deuce" : a > b ? "Adv YOU" : "Adv CPU";
  return `${NAMES[a]} - ${NAMES[b]}`;
}
function drawHud() {
  document.getElementById("pts").textContent = pointText();
  document.getElementById("games").textContent = `Games ${score.gYou} - ${score.gCpu}` + (phase === "serve" ? (score.server === you ? " · あなたのサーブ" : " · CPUのサーブ") : "");
}

function setupServe() {
  phase = "serve"; phaseT = 0;
  const s = score.server, r = other(s), total = score.you + score.cpu, deuceSide = total % 2 === 0 ? 1 : -1;   // alternate right / left court
  for (const p of players) { p.x = 0; p.z = p.side * (HL - 0.4); p.face = p.side > 0 ? Math.PI : 0; p.swinging = false; p.avatar.play("tennisReady"); p.avatar.setFace(p.faceSel); }
  s.x = deuceSide * s.side * 1.2; s.z = s.side * (HL + 0.3);
  r.x = -s.x; r.z = r.side * (HL - 0.5);
  B.live = false; B.held = s; B.bounces = 0; B.lastHitter = null;
  if (s === you && !DEMO) say("Space でサーブ!", 3);
  drawHud();
}

function winPoint(winner, why) {
  if (phase !== "rally") return;
  phase = "point"; phaseT = 0; B.live = false;
  score[winner.name]++;
  const w = score[winner.name], l = score[other(winner).name];
  let gameOver = w >= 4 && w - l >= 2;
  say(`${why} — ${winner === you ? "YOUのポイント!" : "CPUのポイント"}`);
  if (gameOver) {
    if (winner === you) score.gYou++; else score.gCpu++;
    score.you = 0; score.cpu = 0; score.server = other(score.server);
    say(`${why} — ${winner === you ? "YOUのゲーム!" : "CPUのゲーム"}`, 1.8);
  }
  winner.celebrate = 1.3; winner.avatar.play("cheer"); winner.avatar.setFace("happy");
  other(winner).avatar.setFace("surprised");
  drawHud();
}

// hit the ball from where it is now toward a point on the other half
function shoot(p, aimX, depth, speed) {
  const tz = -p.side * depth, tx = THREE.MathUtils.clamp(aimX, -HW + 0.35, HW - 0.35);
  const from = B.pos.clone();
  const dx = tx - from.x, dz = tz - from.z, dist = Math.hypot(dx, dz);
  let T = dist / speed, vy = 0;
  for (let i = 0; i < 20; i++) {   // make it clear the net (slow it down, i.e. higher arc, until it does)
    vy = (BALL_R - from.y + 0.5 * G * T * T) / T;
    const tn = (0 - from.z) / (dz / T), yn = from.y + vy * tn - 0.5 * G * tn * tn;
    if (yn > NET_H + 0.25) break;
    T *= 1.08;
  }
  B.vel.set(dx / T, vy, dz / T);
  B.live = true; B.held = null; B.bounces = 0; B.lastHitter = p;
  const o = other(p); o.err = o === cpu || DEMO ? (Math.random() - 0.5) * 1.5 : 0;   // the computer misjudges a little: sometimes it can't reach
}

function pressSwing() {
  if (DEMO) return;
  startSwing(you);
}
function startSwing(p) {
  if (p.swinging || phase === "point") return;
  if (phase === "serve" && score.server !== p) return;
  p.swinging = true; p.hitDone = false; p.swingT0 = p.at; p.avatar.play(p.poseName);
}
// where the strings meet the ball: to the player's right, a little in front
function contactPoint(p) { const r = new THREE.Vector3(-Math.cos(p.face), 0, Math.sin(p.face)); const f = new THREE.Vector3(Math.sin(p.face), 0, Math.cos(p.face));
  return new THREE.Vector3(p.x, 0, p.z).addScaledVector(r, 0.45).addScaledVector(f, 0.3); }

function tryHit(p) {
  const u = (p.at - p.swingT0) / SWING_T;
  if (p.hitDone || u < 0.12 || u > 0.75) return;
  if (phase === "serve" && B.held === p) {   // the serve: the toss is hit at the top of the swing
    if (u < 0.45) return;
    p.hitDone = true; phase = "rally"; drawHud(); if (message.startsWith("Space")) say("", 0);
    B.pos.set(p.x, 1.55, p.z - p.side * 0.25);
    const aim = p === you && !DEMO ? aimFromKeys() : other(p).x + (Math.random() - 0.5) * 1.6;
    shoot(p, aim, SERVICE - 1.2 + Math.random() * 0.8, 10.5);
    return;
  }
  if (!B.live || B.lastHitter === p) return;
  if (Math.sign(B.pos.z || 1) !== p.side) return;   // only on your own half
  const c = contactPoint(p), dxz = Math.hypot(B.pos.x - c.x, B.pos.z - c.z);
  if (dxz > 1.05 || B.pos.y > 1.9) return;
  p.hitDone = true;
  let aim, depth, speed;
  if (p === you && !DEMO) {
    aim = aimFromKeys();
    depth = keys.has("ArrowDown") || keys.has("KeyS") ? 3.2 : keys.has("ArrowUp") || keys.has("KeyW") ? HL - 1.0 : HL - 2.4;
    speed = keys.has("ArrowUp") || keys.has("KeyW") ? 13 : 11;
  } else {
    aim = (Math.random() - 0.5) * 2 * (HW - 0.6); depth = 4 + Math.random() * (HL - 5); speed = 10 + Math.random() * 2.5;
    if (Math.random() < 0.07) aim += (Math.random() < 0.5 ? -1 : 1) * 2.0;   // the CPU sometimes goes for too much (out)
  }
  if (B.pos.y < 0.35) B.pos.y = 0.35;   // scoop it up
  shoot(p, aim, depth, speed);
}
function aimFromKeys() {
  const L = keys.has("ArrowLeft") || keys.has("KeyA"), R = keys.has("ArrowRight") || keys.has("KeyD");
  return L && !R ? -HW + 0.6 : R && !L ? HW - 0.6 : (Math.random() - 0.5) * 1.5;
}

// the computer's side: run to where the ball will come, swing when it is near
function predictBall(p) {   // where the ball will be (x, z) when it is at a comfortable height on p's half after its bounce
  const q = B.pos.clone(), v = B.vel.clone(); let bounced = B.bounces > 0 && Math.sign(q.z) === p.side;
  for (let i = 0; i < 400; i++) {
    v.y -= G * 0.01; q.addScaledVector(v, 0.01);
    if (q.y < BALL_R) { q.y = BALL_R; v.y = -v.y * 0.72; v.x *= 0.88; v.z *= 0.88; bounced = true; }
    if (Math.sign(q.z) === p.side && bounced && v.y < 0 && q.y < 1.0) return q;
    if (Math.abs(q.z) > HL + 3) return q;
  }
  return q;
}
function think(p, dt) {
  let tx = 0, tz = p.side * (HL - 0.6);
  if (phase === "rally" && B.live && B.lastHitter !== p) {
    const q = predictBall(p);
    // stand so the ball arrives on the forehand side
    const r = -Math.cos(p.face);
    tx = q.x - r * 0.45 + (p.err || 0); tz = THREE.MathUtils.clamp(q.z + p.side * 0.5, p.side > 0 ? 1 : -HL - 2, p.side > 0 ? HL + 2 : -1);
  } else if (phase === "rally") { tx = 0; tz = p.side * (HL - 0.8); }
  if (phase === "serve") { tx = p.x; tz = p.z; if (score.server === p && phaseT > 1.0) startSwing(p); }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const mv = d > 0.12 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
  if (phase === "rally" && B.live && B.lastHitter !== p && !p.swinging) {
    const c = contactPoint(p), dist = Math.hypot(B.pos.x - c.x, B.pos.z - c.z);
    if (Math.sign(B.pos.z) === p.side && dist < 1.4 && B.pos.y < 1.7) startSwing(p);
  }
  return mv;
}
function control() {
  let x = 0, z = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) z -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) z += 1;
  const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l };
}

function stepPlayer(p, dt) {
  const mv = p === you && !DEMO ? control() : think(p, dt);
  const canMove = phase === "rally" || (phase === "serve" && score.server !== p && false);
  const moving = canMove && (mv.x || mv.z) && !(p.swinging && (p.at - p.swingT0) / SWING_T < 0.7);
  const sp = p.swinging ? p.speed * 0.35 : p.speed;
  if (canMove) { p.x += mv.x * sp * dt; p.z += mv.z * sp * dt; }
  p.x = THREE.MathUtils.clamp(p.x, -HW - 2.2, HW + 2.2);
  p.z = p.side > 0 ? THREE.MathUtils.clamp(p.z, 0.6, HL + 2) : THREE.MathUtils.clamp(p.z, -HL - 2, -0.6);
  // facing: toward where it runs, else toward the net
  const net = p.side > 0 ? Math.PI : 0;
  const want = moving ? Math.atan2(mv.x, mv.z) : net;
  let d = want - p.face; d = Math.atan2(Math.sin(d), Math.cos(d)); p.face += d * Math.min(1, dt * 12);
  // pose + playback speed
  let adv = dt;
  if (p.celebrate > 0) { p.celebrate -= dt; if (p.celebrate <= 0) { p.avatar.play("tennisReady"); } }
  else if (p.swinging) { if ((p.at - p.swingT0) > SWING_T) { p.swinging = false; p.avatar.play("tennisReady"); } }
  else if (moving) { p.avatar.play("run"); adv = dt * sp / p.gait; }
  else p.avatar.play("tennisReady");
  if (p.swinging) tryHit(p);
  p.at += adv;
  p.avatar.object.position.set(p.x, 0, p.z);
  p.avatar.object.rotation.y = p.face;
  p.avatar.update(adv);
  p.shadow.position.set(p.x, 0.01, p.z);
}

function stepBall(dt) {
  if (B.held) {   // waiting to serve: the ball bounces in the server's hand area
    const s = B.held, u = (s.at - s.swingT0) / SWING_T;
    const toss = s.swinging ? Math.sin(Math.min(1, u / 0.45) * Math.PI * 0.5) * 0.8 : Math.abs(Math.sin(phaseT * 4)) * 0.25;
    const l = new THREE.Vector3(Math.cos(s.face), 0, -Math.sin(s.face));   // the left hand's side
    B.pos.set(s.x, 0.75 + toss, s.z).addScaledVector(l, 0.25).addScaledVector(new THREE.Vector3(Math.sin(s.face), 0, Math.cos(s.face)), 0.2);
  } else if (B.live || phase === "point") {
    const sub = 4, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const prevZ = B.pos.z;
      B.vel.y -= G * h; B.pos.addScaledVector(B.vel, h);
      // the net
      if (Math.sign(prevZ) !== Math.sign(B.pos.z) && prevZ !== 0 && Math.abs(B.pos.x) < HW + 0.4 && B.pos.y < NET_H + BALL_R) {
        B.pos.z = Math.sign(prevZ) * BALL_R; B.vel.z *= -0.15; B.vel.x *= 0.3;
        if (B.live) winPoint(other(B.lastHitter), "ネット");
      }
      if (B.pos.y < BALL_R) {   // a bounce
        B.pos.y = BALL_R; B.vel.y = -B.vel.y * 0.72; B.vel.x *= 0.88; B.vel.z *= 0.88;
        if (Math.abs(B.vel.y) < 0.4) B.vel.y = 0;
        if (B.live) {
          const half = Math.sign(B.pos.z), hitter = B.lastHitter, receiver = other(hitter);
          B.bounces++;
          const inside = Math.abs(B.pos.x) <= HW + BALL_R && Math.abs(B.pos.z) <= HL + BALL_R && half === receiver.side;
          if (B.bounces === 1) { if (!inside) winPoint(receiver, "アウト"); else markBounce(); }
          else winPoint(hitter, half === receiver.side ? "ツーバウンド" : "ミス");
        }
      }
    }
    if (B.live && (Math.abs(B.pos.z) > HL + 9 || Math.abs(B.pos.x) > 14)) winPoint(other(B.lastHitter), "アウト");
  }
  ball.position.copy(B.pos);
  ballShadow.position.set(B.pos.x, 0.012, B.pos.z);
  ballShadow.scale.setScalar(1 + B.pos.y * 0.35);
}
// a small mark where the ball bounced
const mark = blob(0.1); mark.material = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });
function markBounce() { mark.position.set(B.pos.x, 0.011, B.pos.z); mark.material.opacity = 0.7; }

// camera: behind the player, following a little
const camTarget = new THREE.Vector3();
let camFree = false;   // the tests look from elsewhere
function stepCamera(dt) {
  if (camFree) return;
  const want = new THREE.Vector3(you.x * 0.5, 4.2, Math.max(you.z, 3) + 6.2);
  camera.position.lerp(want, Math.min(1, dt * 3));
  camTarget.lerp(new THREE.Vector3(you.x * 0.35, 0.2, Math.max(you.z, 3) - 6.5), Math.min(1, dt * 3));
  camera.lookAt(camTarget);
}

setupServe();
camera.position.set(0, 4.2, HL + 6.2); camTarget.set(0, 0.2, HL - 6.5); camera.lookAt(camTarget);
if (DEMO) say("DEMO", 2);

const clock = new THREE.Clock();
function tick(dt) {
  phaseT += dt;
  for (const p of players) stepPlayer(p, dt);
  stepBall(dt);
  if (phase === "point" && phaseT > 1.8) setupServe();
  if (messageT > 0) { messageT -= dt; if (messageT <= 0) msgEl.textContent = ""; }
  mark.material.opacity = Math.max(0, mark.material.opacity - dt * 0.4);
  stepCamera(dt);
}
renderer.setAnimationLoop(() => { tick(Math.min(clock.getDelta(), 1 / 20)); renderer.render(scene, camera); });

// for checking from outside (tests, the console)
window.game = { you, cpu, B, score, get phase() { return phase; }, keys, startSwing, POSES, camera, renderer, scene, freeCamera(on = true) { camFree = on; },
  run(seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) tick(dt); } };   // advance the game without drawing (tests)
