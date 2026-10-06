// ひなテニス: a 3D tennis game with Hinagata characters (three.js).
import * as THREE from "three";
import { createAvatar } from "../../../src/index.js";
import { C, buildCourt } from "./court.js";
import { Ball, G, R, solveShot, predict } from "./ball.js";
import { Player, IDEAL, REACH, CONTACT_T } from "./player.js";
import { initAudio, sfx, toggleMute } from "./audio.js";
import { createInput } from "./input.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = THREE.MathUtils.clamp;

// ── renderer, scene, camera, lights ──
const renderer = new THREE.WebGLRenderer({ canvas: $("c"), antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#9fd3f0"); scene.fog = new THREE.Fog("#9fd3f0", 45, 90);
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7f9f86, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(6, 14, 7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 40 }); sun.shadow.bias = -0.0005;
scene.add(sun); scene.add(sun.target);
const court = buildCourt(scene);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 58 : 40; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

// ── the ball and its helpers (shadow, trail, landing mark) ──
const ball = new Ball();
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12), new THREE.MeshToonMaterial({ color: "#dff23a" }));
ballMesh.castShadow = true; scene.add(ballMesh);
const blobTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
const trail = Array.from({ length: 7 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(R * (0.9 - i * 0.1), 8, 6), new THREE.MeshBasicMaterial({ color: "#f4ff9a", transparent: true, opacity: 0.35 - i * 0.045, depthWrite: false })); scene.add(m); return m; });
const trailPts = [];
const mark = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.19, 24), new THREE.MeshBasicMaterial({ color: "#ffef6a", transparent: true, opacity: 0.0, depthWrite: false }));
mark.rotation.x = -Math.PI / 2; mark.position.y = 0.012; scene.add(mark);
const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }));
spot.rotation.x = -Math.PI / 2; spot.position.y = 0.011; scene.add(spot);   // where the last ball bounced (fades)
const playerBlob = (s = 0.9) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.008; scene.add(m); return m; };

// ── game state ──
const DIFF = {
  easy: { speed: 3.7, react: 0.38, err: 0.75, pace: [9.5, 12], miss: 0.12, fault: 0.3, name: "かんたん" },
  normal: { speed: 4.3, react: 0.24, err: 0.5, pace: [11, 14.5], miss: 0.06, fault: 0.2, name: "ふつう" },
  hard: { speed: 5.0, react: 0.13, err: 0.32, pace: [12.5, 17], miss: 0.025, fault: 0.13, name: "つよい" },
};
const S = { phase: "loading", diff: "normal", target: 2, p: [0, 0], g: [0, 0], server: 0, serveNo: 1, timer: 0, time: 0, simTime: 0,
  rally: 0, longest: 0, log: [], fps: 0, stats: { aces: [0, 0], winners: [0, 0], errors: [0, 0], df: [0, 0] }, lastWinner: -1, matchWinner: -1, paused: false };
const input = createInput();
let P = [], pred = null, cpu = null, recipes = [];
const other = (i) => 1 - i;
const playerOnSide = (side) => (side > 0 ? 0 : 1);

// ── UI ──
let msgTimer = 0;
function showMsg(text, cls = "", sub = "", dur = 1.4) { $("msg").innerHTML = `<span class="${cls}">${text}</span>${sub ? `<small>${sub}</small>` : ""}`; msgTimer = dur; }
const CALL = ["0", "15", "30", "40"];
function pointText(i) {
  const a = S.p[i], b = S.p[other(i)];
  if (a >= 3 && b >= 3) return a === b ? "40" : a > b ? "AD" : "40";
  return CALL[Math.min(a, 3)];
}
function callText() {
  const s = S.server, a = S.p[s], b = S.p[other(s)];
  if (a >= 3 && b >= 3) { if (a === b) return "デュース"; return `アドバンテージ ${P[a > b ? s : other(s)].name}`; }
  if (a === 0 && b === 0) return "";
  if (a === b) return `${CALL[a]}-オール`;
  return `${CALL[Math.min(a, 3)]}-${CALL[Math.min(b, 3)]}`;
}
function updateScore() {
  for (const i of [0, 1]) { $(`g${i}`).textContent = S.g[i]; $(`p${i}`).textContent = pointText(i); $(`sv${i}`).classList.toggle("on", S.server === i); }
  $("info").innerHTML = `CPU: ${DIFF[S.diff].name} ・ ${S.target} ゲーム先取<br>ラリー ${S.rally}`;
}
const isTouch = matchMedia("(pointer: coarse)").matches || Q.has("touch");
document.body.classList.toggle("touch", isTouch);
function setHint(t) { $("hint").textContent = t; $("hint").classList.toggle("hidden", !t || isTouch); }

// ── the shot: from the hitter's contact to a target on the other side ──
function shoot(p, { kind, type, aimX = 0, aimY = 0, late = 0, off = 0, charge = 0, ai = null }) {
  const opp = -p.side;   // the side the ball goes to
  let tx, depth, pace, spin, clear = 0.14, apex = 0;
  if (type === "lob") { depth = rand(7.0, 8.3); tx = aimX * 2.2; pace = 6.5; spin = "lob"; clear = 1.6; apex = 3.6; }
  else if (kind === "smash") { depth = rand(5.5, 8.0); tx = aimX * 2.6 || rand(-2, 2); pace = 21; spin = "flat"; clear = 0.04; }
  else if (aimY < -0.3) { depth = rand(2.4, 3.6); tx = aimX * 2.6; pace = 7.5; spin = "slice"; clear = 0.12; }
  else { depth = aimY > 0.3 ? rand(7.6, 8.5) : rand(6.4, 8.0); tx = aimX * 2.5; pace = 11 + 6.5 * charge; spin = "top"; }
  if (ai) { tx = ai.tx; depth = ai.depth; pace = ai.pace ?? pace; if (ai.type === "lob") { spin = "lob"; clear = 1.6; apex = 3.6; pace = 6.5; } }
  // timing: a late hit goes out to the hitter's right on a forehand (left on a backhand), an early one the other way; off-centre and
  // late hits scatter
  const hand = kind === "bh" ? -1 : 1;
  tx += p.side * hand * clamp(late, -0.6, 0.9) * 2.6;
  const sd = (ai ? ai.err : 0.18) + off * 0.55 + Math.abs(late) * 0.7;
  tx += gauss() * sd; depth += gauss() * sd * 0.9;
  if (!ai && (late > 0.55 || off > 0.92) && Math.random() < 0.5) clear = -0.35;   // a bad hit: into the net
  if (ai?.net) clear = -0.35;
  const target = { x: tx, z: opp * depth };
  const g = G * (spin === "top" ? 1.45 : spin === "slice" ? 0.85 : 1);
  const { v } = solveShot(ball.pos, target.x, target.z, pace, g, clear, apex);
  S.log.push(`${S.simTime.toFixed(2)} hit ${p.name} ${kind}/${type || ai?.type} at ${ball.pos.toArray().map((x) => x.toFixed(2))} → ${tx.toFixed(1)},${(opp * depth).toFixed(1)} pace ${pace.toFixed(1)} late ${late.toFixed(2)} off ${off.toFixed(2)}`);
  ball.launch(ball.pos.clone(), v, spin, p); ball.serve = false;
  p.swing.hit = true;
  S.rally++; S.longest = Math.max(S.longest, S.rally);
  sfx(kind === "smash" ? "smash" : "hit", { vol: 0.6 + Math.min(0.4, pace / 40), pan: clamp(p.pos.x / 6, -1, 1) });
  newPrediction();
}

// predicted path of the ball (redone after each hit, bounce or net touch)
function newPrediction() { pred = ball.active ? { t0: S.simTime, s: predict(ball, 3.0, 1 / 120) } : null; mark.material.opacity = 0; }
function canHit(p) {
  return ball.active && !ball.toss && S.phase === "rally" && ball.lastHitter !== p && Math.sign(ball.pos.z) === p.side &&
    !(ball.serve && ball.bounces === 0) && ball.bounces <= 1;
}
// when and where the ball will reach my hitting plane (the first point on my side, hittable, at or behind it)
function contactInfo(p) {
  if (!pred || ball.lastHitter === p || !ball.active) return null;
  const now = S.simTime - pred.t0;
  for (const s of pred.s) {
    if (s.t < now) continue;
    if (Math.sign(s.z) !== p.side || s.bounces > 1 || (ball.serve && s.bounces === 0)) continue;
    const r = p.rel(s);
    if (r.fwd <= 0.34) return { dt: s.t - now, rel: r, s };
  }
  return null;
}
const kindFor = (rel, type) => (type !== "lob" && rel.y > 1.42 && Math.abs(rel.lat - IDEAL.smash.lat) < 0.6 ? "smash" : rel.lat >= -0.05 ? "fh" : "bh");
const heightK = (y) => clamp((y - 0.3) / 0.85, 0, 1);

// is the ball on my racket now? (checked every physics step for a player in a forward swing)
function tryContact(p) {
  const sw = p.swing; if (!sw || sw.phase !== "swing" || sw.hit || !canHit(p)) return;
  if (sw.t < CONTACT_T - 0.1 && !sw.late) return;
  if (sw.t > CONTACT_T + 0.14) return;
  const r = p.rel(ball.pos), id = IDEAL[sw.kind] || IDEAL.fh;
  const reachLat = REACH.lat + (p === P[0] ? 0.08 : 0);
  if (Math.abs(r.lat - id.lat) > reachLat) return;
  if (r.y < REACH.low || r.y > (sw.kind === "smash" ? REACH.smashHigh : REACH.high)) return;
  if (r.fwd > id.fwd + 0.6 || r.fwd < id.fwd - 0.5) return;
  if (r.fwd > id.fwd + 0.06 && sw.t < CONTACT_T) return;   // not yet: let it come to the racket
  const late = (id.fwd - r.fwd) / 0.5 + (sw.late ? 0.25 : 0), off = Math.abs(r.lat - id.lat) / reachLat;
  if (p === P[0]) {
    const m = input.move();
    shoot(p, { kind: sw.kind, type: sw.type, aimX: m.x, aimY: m.y, late: Math.max(-0.4, late), off, charge: sw.charge ?? 0 });
  } else cpu.shoot(late, off);
}

// ── the CPU player ──
function makeCPU() {
  const me = P[1], foe = P[0];
  let plan = null, home = new THREE.Vector3(0, 0, -(C.HALF_L + 0.6)), serveAt = 0;
  const D = () => DIFF[S.diff];
  function makePlan() {
    const now = S.simTime - pred.t0, d = D();
    let best = null;
    for (const s of pred.s) {
      if (s.t < now || Math.sign(s.z) !== me.side || s.bounces > 1 || (ball.serve && s.bounces === 0)) continue;
      if (s.y < 0.2 || s.y > 1.45) continue;
      if (s.bounces === 0 && me.pos.z < -5.5) continue;   // from the baseline, let it bounce
      for (const kind of ["fh", "bh"]) {
        const id = IDEAL[kind];
        const x = s.x - id.lat * me.side, z = s.z + id.fwd * me.side;
        const dist = Math.hypot(x - me.pos.x, z - me.pos.z), avail = s.t - now - d.react;
        const ok = dist <= d.speed * Math.max(0, avail) * 0.95 + 0.25;
        const nice = (s.bounces === 1 ? 0 : 0.4) + Math.abs(s.y - 0.85) * 0.6 + (kind === "bh" ? 0.25 : 0) + Math.max(0, -z * me.side - C.HALF_L - 1.2) * 0.5;
        const score = (ok ? 0 : 50 + dist - d.speed * Math.max(0, avail)) + nice + s.t * 0.8;
        if (!best || score < best.score) best = { score, x, z, t: s.t, kind };
      }
    }
    if (!best) return null;
    // sometimes (more when easy) misjudge it a little
    if (Math.random() < d.miss) best.x += (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.9);
    return { ...best, hits: ball.hits, readyAt: S.simTime + d.react };
  }
  return {
    reset() { plan = null; serveAt = S.simTime + rand(0.9, 1.4); },
    shoot(late, off) {
      const d = D(), fx = foe.pos.x, atNet = foe.pos.z < 5;
      let tx, depth = rand(6.3, 8.2), type = "drive", pace = rand(d.pace[0], d.pace[1]);
      if (atNet && Math.random() < 0.4) { type = "lob"; tx = rand(-1.8, 1.8); depth = rand(7, 8.2); }
      else if (atNet) { tx = (fx > 0 ? -1 : 1) * rand(2.0, 2.7); }
      else if (Math.random() < 0.62) tx = (Math.abs(fx) < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(fx)) * rand(1.0, 2.6);
      else tx = rand(-2.5, 2.5);
      if (type === "drive" && S.diff !== "easy" && Math.random() < 0.08) { depth = rand(3, 4); tx = (Math.random() < 0.5 ? -1 : 1) * 2.7; pace = 9; }
      const err = d.err * (1 + off * 0.8 + Math.abs(late) * 0.6);
      const net = Math.random() < d.miss * 0.6;
      // the CPU aims in the world: shoot's late/hand correction is left out (it is in err)
      shoot(me, { kind: me.swing.kind, type, ai: { tx, depth, pace, err, type, net } });
    },
    step(dt) {
      const d = D();
      if (S.phase === "serve" && S.server === 1) { me.setMove(0, 0); if (S.simTime > serveAt) toss(me); return; }
      if (S.phase === "toss" && S.server === 1) { if (ball.vel.y < -0.2 && !me.swinging) { me.release("serve", 1); } return; }
      if (S.phase !== "rally") { me.setMove(0, 0); return; }
      const incoming = ball.active && ball.lastHitter !== me && pred;
      if (incoming) {
        if (!plan || plan.hits !== ball.hits) plan = makePlan();
        if (plan && S.simTime >= plan.readyAt) {
          const dx = plan.x - me.pos.x, dz = plan.z - me.pos.z, l = Math.hypot(dx, dz);
          const k = l < 0.05 ? 0 : Math.min(1, l / 0.35); me.setMove(dx / (l || 1) * k, dz / (l || 1) * k);
        } else me.setMove(0, 0);
        const ci = contactInfo(me);
        if (ci) {
          const kind = kindFor(ci.rel, "drive");
          if (!me.busy && ci.dt < 0.5) { me.windup(kind, heightK(ci.rel.y)); }
          if (me.swing?.phase === "windup" && ci.dt <= CONTACT_T + 1 / 120) { me.release(kind, heightK(ci.rel.y)); me.swing.type = "drive"; }
        }
      } else {
        plan = null;
        // back to the middle of the baseline, a little toward where the ball went
        const tx = ball.active ? clamp(ball.pos.x * 0.35, -1.8, 1.8) : 0;
        home.set(tx, 0, -(C.HALF_L + 0.6));
        const dx = home.x - me.pos.x, dz = home.z - me.pos.z, l = Math.hypot(dx, dz), k = l < 0.1 ? 0 : Math.min(0.85, l / 0.6);
        me.setMove(dx / (l || 1) * k, dz / (l || 1) * k);
      }
    },
  };
}

// ── serving ──
function serveGeometry() {
  const srv = P[S.server], rcv = P[other(S.server)], even = (S.p[0] + S.p[1]) % 2 === 0;
  const xs = (even ? 1 : -1) * srv.side;   // the server's right (deuce court) or left (ad court), in world x
  return { srv, rcv, xs, box: { x0: Math.min(0, -xs * C.HALF_W), x1: Math.max(0, -xs * C.HALF_W), z0: Math.min(0, rcv.side * C.SERVICE), z1: Math.max(0, rcv.side * C.SERVICE) } };
}
function setupServe(again = false) {
  const { srv, rcv, xs } = serveGeometry();
  srv.place(xs * 0.9, srv.side * (C.HALF_L + 0.35)); rcv.place(-xs * 2.1, rcv.side * (C.HALF_L + 0.3));
  for (const p of P) { p.mode = "play"; p.swing = null; p.setFace("normal"); p.setMove(0, 0); }
  ball.reset(); ball.held = true; pred = null; S.rally = 0;
  S.phase = "serve"; S.timer = 0; cpu.reset(); updateScore();
  if (!again) { const c = callText(); if (c) showMsg(c, "", "", 1.0); }
  if (S.serveNo === 2) showMsg("セカンドサーブ", "", "", 0.9);
  setHint(S.server === 0 ? "Space でトス → 一番上で Space!  ←→ でコース" : "");
}
function heldBallPos(p) { return p.world(-0.3, 0.3, 0.62); }
function toss(p) {
  ball.reset(); ball.active = true; ball.toss = true; ball.held = false;
  ball.pos.copy(p.world(-0.1, 0.22, 0.8)); ball.vel.set(0, 4.4, 0); ball.g = G;
  p.windup("serve", 1); S.phase = "toss"; sfx("toss");
}
function hitServe(p) {
  const { box, xs } = serveGeometry(), first = S.serveNo === 1;
  const y = ball.pos.y, e = clamp(Math.abs(y - 1.7) / 0.45, 0, 1);   // timing: best near the top of the toss
  let tx, tz, pace, sd;
  const bw = box.x1 - box.x0, deep = P[other(S.server)].side * (C.SERVICE - 0.6);
  if (p === P[0]) {
    const a = (input.move().x + 1) / 2;   // screen right → +x
    tx = box.x0 + 0.4 + a * (bw - 0.8);
    pace = first ? 12.5 + 6.5 * (1 - e) : 10; sd = first ? 0.16 + e * 0.75 : 0.1 + e * 0.35;
  } else {
    const d = DIFF[S.diff];
    tx = box.x0 + 0.4 + Math.random() * (bw - 0.8); pace = first ? d.pace[1] + 2 : d.pace[0];
    sd = 0.12;
    if (Math.random() < (first ? d.fault : d.fault * 0.3)) { if (Math.random() < 0.5) tz = deep + P[other(S.server)].side * rand(0.7, 1.4); else tx = -xs * (C.HALF_W + rand(0.2, 0.7)); }
  }
  tz ??= deep;
  tx += gauss() * sd; tz += gauss() * sd * 1.3;
  const g = first ? G : G * 1.3;
  const { v } = solveShot(ball.pos, tx, tz, pace, g, 0.08);
  S.log.push(`${S.simTime.toFixed(2)} serve ${p.name} y ${y.toFixed(2)} → ${tx.toFixed(1)},${tz.toFixed(1)}`);
  ball.launch(ball.pos.clone(), v, first ? "flat" : "top", p); ball.serve = true; ball.g = g;
  p.swing.hit = true; S.phase = "rally"; S.rally = 0;
  sfx("smash", { vol: 0.7 }); newPrediction(); setHint("");
}

// ── points ──
function fault(reason) {
  S.log.push(`${S.simTime.toFixed(2)} fault ${reason}`);
  sfx("fault");
  if (S.serveNo === 1) { S.serveNo = 2; showMsg(reason, "bad"); S.phase = "between"; S.timer = 0; S.after = () => setupServe(true); }
  else { S.stats.df[S.server]++; pointTo(other(S.server), "ダブルフォルト", "bad"); }
}
function pointTo(w, reason, cls = "good") {
  if (S.phase === "point") return;
  S.log.push(`${S.simTime.toFixed(2)} point ${P[w].name} (${reason})`);
  S.phase = "point"; S.timer = 0; S.lastWinner = w; S.serveNo = 1;
  S.p[w]++;
  let game = false;
  if (S.p[w] >= 4 && S.p[w] - S.p[other(w)] >= 2) { game = true; S.g[w]++; S.p = [0, 0]; S.server = other(S.server); }
  if (game && S.g[w] >= S.target) S.matchWinner = w;
  const sub = S.matchWinner >= 0 ? `ゲームセット! ${P[w].name} の勝ち` : game ? `ゲーム ${P[w].name}  (${S.g[0]}-${S.g[1]})` : `${P[w].name} のポイント`;
  showMsg(reason, w === 0 ? cls : "bad", sub, 2.2);
  sfx(w === 0 ? "cheer" : "groan", { vol: game ? 1 : 0.7 }); court.cheer(w === 0 ? 1 : 0.4);
  updateScore();
}
function onBounce(e) {
  S.log.push(`${S.simTime.toFixed(2)} bounce ${e.n} at ${e.x.toFixed(2)},${e.z.toFixed(2)} phase ${S.phase}`);
  sfx("bounce", { vol: 0.5, pan: clamp(e.x / 6, -1, 1) });
  spot.position.set(e.x, 0.011, e.z); spot.material.opacity = 0.7;
  if (S.phase !== "rally") return;
  const side = Math.sign(e.z) || 1, hitter = ball.lastHitter, hi = P.indexOf(hitter);
  if (ball.serve && e.n === 1) {
    const { box } = serveGeometry();
    const inBox = e.x >= box.x0 - R && e.x <= box.x1 + R && e.z >= box.z0 - R && e.z <= box.z1 + R;
    if (!inBox) { fault(ball.netTouched && side === hitter.side ? "ネット" : "フォルト"); return; }
    if (ball.netTouched) { showMsg("レット", "", "", 1); S.phase = "between"; S.timer = 0; S.after = () => setupServe(true); return; }
    newPrediction(); return;
  }
  if (e.n === 1) {
    if (side === hitter.side) { S.stats.errors[hi]++; pointTo(other(hi), ball.netTouched ? "ネット" : "ミス", "good"); return; }
    if (Math.abs(e.x) > C.HALF_W + R || Math.abs(e.z) > C.HALF_L + R) { S.stats.errors[hi]++; pointTo(other(hi), "アウト", "good"); return; }
    newPrediction(); return;
  }
  if (e.n >= 2) {
    const loser = playerOnSide(side);
    if (loser === hi) { pointTo(other(hi), "ミス"); return; }
    if (ball.serve) { S.stats.aces[hi]++; pointTo(hi, "エース!"); } else { S.stats.winners[hi]++; pointTo(hi, S.rally >= 8 ? "ナイスラリー!" : "ウィナー!"); }
  }
}

// ── match flow ──
function newMatch() {
  S.p = [0, 0]; S.g = [0, 0]; S.server = Math.random() < 0.5 ? 0 : 1; S.serveNo = 1; S.matchWinner = -1; S.longest = 0;
  S.stats = { aces: [0, 0], winners: [0, 0], errors: [0, 0], df: [0, 0] };
  for (const id of ["title", "result"]) $(id).classList.add("hidden");
  for (const id of ["score", "info"]) $(id).classList.remove("hidden");
  $("touch").classList.toggle("hidden", !isTouch);
  setupServe(true);
  showMsg(S.server === 0 ? "ひなのサーブ" : "レンのサーブ", "", `${S.target} ゲーム先取`, 1.6);
}
function toTitle() {
  S.phase = "title"; ball.reset();
  for (const id of ["result", "score", "info", "power", "touch"]) $(id).classList.add("hidden"); setHint("");
  $("title").classList.remove("hidden");
  const wide = camera.aspect > 1.2 ? 1.0 : 0;
  P[0].place(wide - 0.55, 7.6, 0); P[1].place(wide + 0.55, 7.6, 0);
  P[0].mode = "wave"; P[1].mode = "idle"; P[0].faceYaw = 0.25; P[1].faceYaw = -0.2;
  P[0].setFace("happy"); P[1].setFace("normal");
}
function showResult() {
  S.phase = "result";
  const w = S.matchWinner, you = w === 0;
  $("resTitle").textContent = you ? "WIN!" : "LOSE…"; $("resTitle").style.color = you ? "var(--gold)" : "#9fb6d6";
  $("resScore").textContent = `${S.g[0]} - ${S.g[1]}`;
  const st = S.stats;
  $("resStats").innerHTML = `エース ${st.aces[0]} - ${st.aces[1]} ・ ウィナー ${st.winners[0]} - ${st.winners[1]}<br>ミス ${st.errors[0]} - ${st.errors[1]} ・ ダブルフォルト ${st.df[0]} - ${st.df[1]}<br>最長ラリー ${S.longest}`;
  $("result").classList.remove("hidden"); $("touch").classList.add("hidden");
  sfx(you ? "win" : "lose");
}

// ── per frame: input and phase timers; per step: physics and contacts ──
const STEP = 1 / 120;
function frame(dt) {
  if (input.key("KeyP") || input.key("Escape")) { if (["serve", "toss", "rally", "point", "between"].includes(S.phase)) { S.paused = !S.paused; $("pause").classList.toggle("hidden", !S.paused); } }
  if (input.key("KeyM")) $("mute").textContent = toggleMute() ? "🔇" : "🔊";
  if (S.paused) return;
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $("msg").innerHTML = ""; }
  $("msg").classList.toggle("low", closeUp());
  const me = P[0], m = input.move();
  if (S.phase === "title" || S.phase === "result" || S.phase === "loading") { if (S.phase === "title" && input.key("Enter")) start(); return; }
  // the human player
  if (S.phase === "rally") {
    me.setMove(m.x, -m.y);
    const press = input.pressed("shot") ? "drive" : input.pressed("lob") ? "lob" : null;
    if (press && !me.swinging) {
      const ci = contactInfo(me);
      if (!me.busy) { const kind = ci ? kindFor(ci.rel, press) : "fh"; me.windup(kind, ci ? heightK(ci.rel.y) : 0.4); me.swing.type = press; me.swing.armed = !!ci; }
      else me.swing.type = press;
      // pressed late (the ball is already at the racket): swing now
      if (ci && ci.dt < CONTACT_T * 0.6) { const k = me.swing.kind; me.release(k, me.swing.h); me.swing.type = press; me.swing.late = true; }
    }
  } else if (S.phase === "serve" && S.server === 0) {
    const { xs } = serveGeometry(); me.setMove(m.x, 0);
    if (input.pressed("shot") || input.pressed("lob")) toss(me);
    me.pos.x = xs > 0 ? clamp(me.pos.x, 0.25, 2.9) : clamp(me.pos.x, -2.9, -0.25);
  } else if (S.phase === "toss" && S.server === 0) {
    me.setMove(0, 0);
    if ((input.pressed("shot") || input.pressed("lob")) && !me.swinging) me.release("serve", 1);
  } else me.setMove(0, 0);
  if (S.phase === "serve") ball.pos.copy(heldBallPos(P[S.server]));
  // the power meter
  const charging = me.swing?.phase === "windup" && S.phase === "rally";
  $("power").classList.toggle("hidden", !charging); if (charging) $("power").firstElementChild.style.width = `${Math.round(me.charge * 100)}%`;
  // timers
  S.timer += dt;
  if (S.phase === "point") {
    const w = P[S.lastWinner], l = P[other(S.lastWinner)];
    if (S.timer > 0.6 && w.mode === "play") { w.mode = S.matchWinner >= 0 ? "cheer" : "victory"; l.mode = "sad"; w.faceYaw = w.netYaw; l.faceYaw = l.netYaw; w.setFace("happy"); l.setFace("sad"); w.setMove(0, 0); l.setMove(0, 0); }
    const long = S.matchWinner >= 0 ? 3.2 : 2.7;
    if (S.timer > long || (S.timer > 1.2 && (input.pressed("shot") || input.pressed("lob")))) { if (S.matchWinner >= 0) showResult(); else setupServe(); }
  }
  if (S.phase === "between" && S.timer > 1.1) S.after();
}
function physics(dt) {
  S.simTime += dt;
  const events = [];
  if (S.phase === "toss" || S.phase === "rally" || S.phase === "point" || S.phase === "between") ball.step(dt, events);
  if (S.phase !== "rally" && ball.active && (Math.abs(ball.pos.z) > 15.5 || Math.abs(ball.pos.x) > 9)) { ball.active = false; ball.vel.set(0, 0, 0); ball.pos.y = -1; }   // gone into the stands
  for (const e of events) {
    if (e.type === "bounce") onBounce(e);
    else if (e.type === "net") { sfx("net", { vol: 0.8 }); if (S.phase === "rally") newPrediction(); }
    else if (e.type === "drop" && S.phase === "toss") { S.phase = "serve"; ball.reset(); P[S.server].swing = null; cpu.reset(); }
  }
  // serve contact
  if (S.phase === "toss") {
    const sv = P[S.server];
    if (sv.swing?.phase === "swing" && !sv.swing.hit && sv.swing.t >= CONTACT_T) {
      if (ball.pos.y > 1.05 && ball.pos.y < 2.3) hitServe(sv); else { sv.swing.hit = true; sfx("whiff"); ball.toss = false; ball.lastHitter = sv; S.phase = "rally"; fault("フォルト"); }
    }
  }
  // the human's wound-up swing goes when the ball reaches the racket
  const me = P[0];
  if (S.phase === "rally" && me.swing?.phase === "windup") {
    const ci = contactInfo(me);
    if (ci && ci.dt > 0.25) { me.swing.kind = kindFor(ci.rel, me.swing.type); me.swing.h = heightK(ci.rel.y); me.swing.armed = true; }
    if (ci && ci.dt <= CONTACT_T + 1 / 120) { const ch = me.charge, ty = me.swing.type; me.release(kindFor(ci.rel, ty), heightK(ci.rel.y)); me.swing.type = ty; me.swing.charge = ch; }
    else if (!ci && me.swing.t > 0.3) { me.release(); me.swing.type = "drive"; sfx("whiff", { vol: 0.5 }); }
  }
  cpu.step(dt);
  for (const p of P) { if (S.phase === "rally") tryContact(p); }
  // the rally running too long without an end (stuck ball): play it again
  if (S.phase === "rally" && ball.active && Math.abs(ball.vel.x) + Math.abs(ball.vel.z) + Math.abs(ball.vel.y) < 0.05) { S.phase = "between"; S.timer = 0; S.after = () => setupServe(true); }
  // player bounds and swing clocks
  for (const p of P) {
    const s = p.side, b = ["serve", "toss", "title", "result"].includes(S.phase) ? null : { x0: -6.5, x1: 6.5, z0: s > 0 ? 0.7 : -13.5, z1: s > 0 ? 13.5 : -0.7 };
    p.tick(dt, b);
  }
}

// ── camera ──
const closeUp = () => (S.phase === "point" && S.timer > 0.7) || S.phase === "result";
const camPos = new THREE.Vector3(0, 6, 18), camLook = new THREE.Vector3(0, 0, 0), tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
function updateCamera(dt) {
  const me = P[0];
  let k = 1 - Math.exp(-dt * 4);
  if (S.debugCam !== undefined && S.debugCam >= 0 && S.phase !== "title") {   // testing: a close view of one player
    const p = P[S.debugCam]; tmpV.copy(p.world(-1.3, 2.0, 1.1)); tmpL.copy(p.pos).setY(0.65); k = 1;
  } else if (S.phase === "title") {
    const a = Math.sin(S.time * 0.25) * 0.35;
    const wide = camera.aspect > 1.2 ? 0.25 : 0;
    tmpV.set(Math.sin(a) * 3.4 + wide, 1.0, 7.6 + Math.cos(a) * 3.4); tmpL.set(wide, 0.68, 7.6);
  } else if (closeUp()) {
    const w = P[S.phase === "result" ? S.matchWinner : S.lastWinner];
    const side = Math.sin(S.time * 0.4) * 0.6;
    tmpV.copy(w.world(side, 2.6, 1.0)); tmpL.copy(w.pos).setY(0.8);
    if (S.phase === "result" && camera.aspect > 1.2) { tmpV.copy(w.world(0.9 + side, 2.6, 1.0)); tmpL.copy(w.world(0.75, 0, 0.7)); }
    k = 1 - Math.exp(-dt * 5);
  } else if ((S.phase === "serve" || S.phase === "toss") && S.server === 0) {   // serving: over the shoulder
    tmpV.set(me.pos.x + 1.9, 1.8, me.pos.z + 3.1); tmpL.set(me.pos.x - 0.7, 1.15, me.pos.z - 4);
  } else {
    const portrait = camera.aspect < 1;
    const x = me.pos.x * 0.45, z = Math.max(me.pos.z, 7.5) + (portrait ? 10 : 7.6);
    tmpV.set(x, portrait ? 8 : 5.6, z); tmpL.set(me.pos.x * 0.3 + (ball.active ? ball.pos.x * 0.12 : 0), 0, portrait ? -2 : -0.5);
  }
  camPos.lerp(tmpV, k); camLook.lerp(tmpL, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ── visuals per frame ──
const blobs = [];
function updateVisuals(dt) {
  ballMesh.visible = S.phase !== "title" && S.phase !== "loading";
  ballMesh.position.copy(ball.pos);
  ballShadow.visible = ballMesh.visible && ball.pos.y < 6; ballShadow.position.set(ball.pos.x, 0.01, ball.pos.z);
  const hh = clamp(ball.pos.y / 3, 0, 1); ballShadow.scale.setScalar(1 + hh * 1.2); ballShadow.material.opacity = 0.9 - hh * 0.6;
  // trail
  if (ball.active && !ball.toss) trailPts.unshift(ball.pos.clone()); else trailPts.length = 0;
  trailPts.length = Math.min(trailPts.length, trail.length * 2);
  trail.forEach((m, i) => { const p = trailPts[i * 2 + 1]; m.visible = !!p && ball.vel.length() > 8; if (p) m.position.copy(p); });
  // where the CPU's ball will land: a ring for the human
  if (pred && S.phase === "rally" && ball.lastHitter === P[1] && ball.bounces === 0) {
    const b = pred.s.find((s) => s.bounces === 1); if (b) { mark.position.set(b.x, 0.012, b.z); mark.material.opacity = Math.min(0.85, mark.material.opacity + dt * 3); }
  } else mark.material.opacity = Math.max(0, mark.material.opacity - dt * 3);
  spot.material.opacity = Math.max(0, spot.material.opacity - dt * 0.8);
  P.forEach((p, i) => { blobs[i] ??= playerBlob(0.9); blobs[i].position.set(p.pos.x, 0.008, p.pos.z); });
}

// ── start ──
function start() {
  initAudio(); sfx("select");
  S.target = +document.querySelector("#len .sel").dataset.v; S.diff = document.querySelector("#diff .sel").dataset.v;
  P[1].maxSpeed = DIFF[S.diff].speed;
  newMatch();
}
for (const seg of ["diff", "len"]) $(seg).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; for (const x of $(seg).children) x.classList.toggle("sel", x === b); initAudio(); sfx("beep"); });
$("start").addEventListener("click", start);
$("again").addEventListener("click", () => { initAudio(); sfx("select"); newMatch(); });
$("toTitle").addEventListener("click", () => { sfx("beep"); toTitle(); });
$("mute").addEventListener("click", () => { initAudio(); $("mute").textContent = toggleMute() ? "🔇" : "🔊"; });
addEventListener("pointerdown", () => initAudio(), { once: true });

async function load() {
  // the characters: one recipe file each (character.json: the player, rival.json: the CPU). The editor's export works as it is.
  const files = ["character.json", "rival.json"];
  recipes = await Promise.all(files.map(async (f) => { const r = await fetch(f, { cache: "no-cache" }); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); }));
  const avatars = await Promise.all(recipes.map((r) => createAvatar(r)));
  avatars.forEach((a) => scene.add(a.object));
  $("loadText").textContent = "コートを準備しています…";
  P = [new Player(avatars[0], { side: 1, name: recipes[0].name || "ひな", racketColor: "#22b0a0" }),
       new Player(avatars[1], { side: -1, name: recipes[1].name || "レン", racketColor: "#e5484d", speed: DIFF.normal.speed })];
  $("n0").textContent = P[0].name; $("n1").textContent = P[1].name;
  recipes.forEach((r, i) => { $(`edit${i}`).href = "https://hinagata.pages.dev/editor/?o=" + encodeURIComponent(JSON.stringify(r)); });   // the file as it is (its version too)
  cpu = makeCPU();
  $("loading").classList.add("hidden");
  toTitle();
}

const clock = new THREE.Clock(), MAXDT = +(Q.get("maxdt") || 0.1);
let acc = 0;
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta(), dt = Math.min(MAXDT, raw); S.fps = S.fps * 0.9 + 0.1 / Math.max(1e-3, raw);
  if (S.phase !== "loading") {
    frame(dt);
    if (!S.paused) {
      S.time += dt; acc += dt;
      while (acc >= STEP) { physics(STEP); acc -= STEP; }
      for (const p of P) p.update(dt, camera);
      court.update(S.time, dt);
      updateVisuals(dt);
      updateScore();
    }
    updateCamera(S.paused ? 0 : dt);
  }
  input.endFrame();
  renderer.render(scene, camera);
});
load().catch((e) => { console.error(e); $("loadText").textContent = "読み込みに失敗しました: " + e.message; });

// for testing (a bot, screenshots)
window.__game = { S, ball, get P() { return P; }, C, start: (diff = "normal", games = 2) => {
  for (const x of $("diff").children) x.classList.toggle("sel", x.dataset.v === diff); for (const x of $("len").children) x.classList.toggle("sel", x.dataset.v === String(games)); start(); },
  contactInfo: (i = 0) => contactInfo(P[i]), get pred() { return pred; }, serveBy(i) { S.server = i; setupServe(true); showMsg(`${P[i].name}のサーブ`, "", "", 1.2); } };
