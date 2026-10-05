// 試合の進行・ルール・打球処理
import * as THREE from 'three';
import { COURT, BALL_R, clamp, rand, gauss, wrapAngle } from './constants.js';
import { stepBall, solveShot } from './physics.js';
import { AIController } from './ai.js';

const PTS = ['0', '15', '30', '40'];

export class Athlete {
  constructor(side, char, name) {
    this.side = side; // +1: 手前（プレイヤー側） / -1: 奥
    this.char = char;
    this.name = name;
    this.pos = new THREE.Vector3(0, 0, side * 12.3);
    this.vel = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.baseYaw = side > 0 ? Math.PI : 0;
    this.yaw = this.baseYaw;
    this.maxSpeed = 7;
    this.request = null; // スイングの予約（人間: キー入力 / CPU: 自動）
    this.ai = null;
  }
}

export class Game {
  constructor({ ball, playerChar, cpuChar, ui, sfx, input }) {
    this.ball = ball;
    this.ui = ui;
    this.sfx = sfx;
    this.input = input;
    this.p = new Athlete(1, playerChar, 'あなた');
    this.c = new Athlete(-1, cpuChar, 'CPU');
    this.all = [this.p, this.c];
    this.ev = [];
    this.time = 0;
    this.state = 'idle';
    this.demo = true;
    this.paused = false;
    this.excite = 0;
    this.stats = { hits: 0, playerHits: 0, points: 0, serves: 0 };
    this._v = new THREE.Vector3();
  }

  other(a) { return a === this.p ? this.c : this.p; }
  idx(a) { return a === this.p ? 0 : 1; }

  newMatch({ level = 'normal', games = 3, demo = false } = {}) {
    this.level = level;
    this.target = games;
    this.demo = demo;
    this.points = [0, 0];
    this.games = [0, 0];
    this.matchWinner = null;
    this.paused = false;
    this.p.name = demo ? 'RED' : 'あなた';
    this.c.name = demo ? 'BLUE' : 'CPU';
    this.c.ai = new AIController(this, this.c, level);
    this.p.ai = demo ? new AIController(this, this.p, 'normal') : null;
    if (!demo) this.p.maxSpeed = 7.0;
    this.server = demo && Math.random() < 0.5 ? this.c : this.p;
    this.ui.power(null);
    this.nextPoint();
  }

  nextPoint() {
    this.faults = 0;
    this.startPoint();
  }

  // ---- 位置関係 ----
  isDeuceSide() { return (this.points[0] + this.points[1]) % 2 === 0; }
  serverXSign() { return this.isDeuceSide() ? this.server.side : -this.server.side; }
  receivePos(a) { return { x: -this.serverXSign() * 2.5, z: a.side * 12.3 }; }

  outMargin(x, z, serve) {
    let m = Math.abs(x) - COURT.singlesHalfW;
    if (serve) {
      const sv = this.server.side;
      m = Math.max(m, Math.abs(z) - COURT.serviceLine);
      if (z * sv > 0) m = Math.max(m, Math.abs(z));
      m = Math.max(m, x * this.serverXSign());
    } else {
      m = Math.max(m, Math.abs(z) - COURT.halfLen);
    }
    return m;
  }
  isIn(x, z, serve) { return this.outMargin(x, z, serve) <= BALL_R * 0.5; }

  startPoint() {
    this.state = 'serveReady';
    this.timer = this.demo ? 1.0 : 1.3;
    const sv = this.server, rc = this.other(sv), sx = this.serverXSign();
    sv.pos.set(sx * 0.85, 0, sv.side * 12.25);
    rc.pos.set(-sx * 2.5, 0, rc.side * 12.3);
    for (const a of this.all) {
      a.vel.set(0, 0, 0);
      a.desired.set(0, 0, 0);
      a.request = null;
      a.yaw = a.baseYaw;
      a.char.reset();
      if (a.ai) a.ai.reset();
    }
    this.lastHitter = null;
    this.bounces = 0;
    this.isServe = false;
    this.rallyHits = 0;
    this.focus = null;
    const b = this.ball.s;
    b.v.x = b.v.y = b.v.z = 0;
    b.spin = 0; b.kind = 'flat'; b.netTouched = false; b.netCord = false;
    sv.char.leftHandWorld(this._v);
    b.p.x = this._v.x; b.p.y = this._v.y; b.p.z = this._v.z;
    this.ball.resetTrail();
    this.ball.hideMark();
    if (!this.demo) {
      this.ui.setScore(this);
      this.ui.hint(sv === this.p
        ? `${this.faults ? 'セカンドサーブ ・ ' : ''}J/スペース: フラットサーブ　K: スピンサーブ（トス→もう一度押して打つ）　←→: 立ち位置/コース`
        : null);
    }
  }

  clearRequests() {
    for (const a of this.all) {
      a.request = null;
      const act = a.char.action;
      if (act && act.phase === 'prep') a.char.action = null; // 構えたままにしない
    }
    this.ui.power(null);
  }

  // ---- メインループ（固定ステップ） ----
  step(dt) {
    if (this.paused || this.state === 'idle') return;
    this.time += dt;
    for (const a of this.all) {
      if (a.ai) a.ai.update(dt);
      else this.humanControl(a);
    }
    for (const a of this.all) this.move(a, dt);

    const b = this.ball.s;
    switch (this.state) {
      case 'serveReady': {
        this.timer -= dt;
        const sv = this.server;
        sv.char.leftHandWorld(this._v);
        b.p.x = this._v.x; b.p.y = this._v.y; b.p.z = this._v.z;
        if (sv.ai && this.timer <= 0) this.toss(sv, this.faults === 0 ? 'flat' : 'kick');
        break;
      }
      case 'toss': {
        this.ev.length = 0;
        stepBall(b, dt, this.ev);
        const sv = this.server;
        if (sv.ai && b.v.y < -0.3) this.serveHit(sv, this.serveType);
        else if (b.p.y < 1.2 && b.v.y < 0) {
          if (!this.demo) this.ui.message('トスやり直し', '', 0.9);
          this.state = 'fault';
          this.timer = 0.8;
          sv.char.reset();
        }
        break;
      }
      case 'play': {
        this.ev.length = 0;
        stepBall(b, dt, this.ev);
        for (const e of this.ev) {
          this.fxEvent(e);
          if (e.type === 'bounce') this.onBounce(e);
          if (this.state !== 'play') break;
        }
        if (this.state !== 'play') break;
        for (const a of this.all) this.tickRequest(a, dt);
        if (this.state === 'play' && this.time - this.lastHitTime > 7) this.resolveStall();
        break;
      }
      case 'fault':
      case 'pointOver':
      case 'matchOver': {
        this.ev.length = 0;
        stepBall(b, dt, this.ev);
        for (const e of this.ev) this.fxEvent(e);
        this.timer -= dt;
        if (this.timer <= 0) this.afterPause();
        break;
      }
    }
  }

  afterPause() {
    if (this.state === 'fault') this.startPoint();
    else if (this.state === 'pointOver') {
      if (this.matchWinner) {
        this.state = 'matchOver';
        this.timer = this.demo ? 3 : Infinity;
        if (!this.demo) {
          const win = this.matchWinner === this.p;
          this.ui.showResult(win ? 'あなたの勝ち！' : 'CPU の勝ち…', `ゲームカウント ${this.games[0]} - ${this.games[1]}`, win);
          this.ui.hint(null);
        }
      } else this.nextPoint();
    } else if (this.state === 'matchOver' && this.demo) {
      this.newMatch({ demo: true, level: 'normal', games: 3 });
    }
  }

  humanControl(a) {
    const inp = this.input.axis();
    let mx = inp.x, mz = -inp.y;
    let sp = a.maxSpeed;
    if (a.request && a.request.held) sp *= 0.45; // 溜めている間は足が止まる
    const st = this.state;
    if (st === 'serveReady' && this.server === a) mz = 0;
    if ((st === 'toss' && this.server === a) || st === 'pointOver' || st === 'matchOver' || st === 'fault') { mx = 0; mz = 0; }
    a.desired.set(mx * sp, 0, mz * sp);
  }

  move(a, dt) {
    const acc = 34 * dt;
    const dvx = a.desired.x - a.vel.x, dvz = a.desired.z - a.vel.z;
    const l = Math.hypot(dvx, dvz);
    const k = l > acc ? acc / l : 1;
    a.vel.x += dvx * k;
    a.vel.z += dvz * k;
    a.pos.x += a.vel.x * dt;
    a.pos.z += a.vel.z * dt;
    a.pos.x = clamp(a.pos.x, -9.8, 9.8);
    a.pos.z = a.side > 0 ? clamp(a.pos.z, 0.6, 17.5) : clamp(a.pos.z, -17.5, -0.6);
    if (this.state === 'serveReady' && this.server === a) {
      const sx = this.serverXSign();
      a.pos.x = sx > 0 ? clamp(a.pos.x, 0.25, 4.0) : clamp(a.pos.x, -4.0, -0.25);
      a.pos.z = a.side * 12.25;
    }
  }

  // ---- 人間の入力 ----
  humanPress(type) {
    if (this.demo || this.paused) return;
    const a = this.p;
    if (this.state === 'serveReady' && this.server === a) { this.toss(a, type === 'top' ? 'flat' : 'kick'); return; }
    if (this.state === 'toss' && this.server === a) { this.serveHit(a, this.serveType); return; }
    if (this.state !== 'play' || a.request || a.char.isSwinging()) return;
    const b = this.ball.s.p;
    const lat = (b.x - a.pos.x) * a.side;
    a.request = { type, held: true, hold: 0, charge: 0, after: 0, kind: lat >= 0 ? 'fh' : 'bh' };
    a.char.prep(a.request.kind);
  }

  humanRelease(type) {
    const r = this.p.request;
    if (r && r.held && r.type === type) r.held = false;
  }

  tickRequest(a, dt) {
    const r = a.request;
    if (!r) return;
    if (!a.ai) {
      if (r.held) {
        r.hold += dt;
        r.charge = Math.min(1, r.hold / 0.8);
      } else {
        r.after += dt;
        if (r.after > 1.2) {
          a.request = null;
          this.ui.power(null);
          if (!a.char.isSwinging()) a.char.swing(a.char.action ? a.char.action.kind : 'fh');
          return;
        }
      }
      this.ui.power(r.charge);
    }
    this.checkHit(a);
  }

  canHit(a) {
    if (this.state !== 'play' || this.lastHitter === a) return false;
    const b = this.ball.s;
    if (b.p.z * a.side <= 0) return false;
    if (this.isServe && this.bounces === 0) return false; // サーブはノーバウンドで返せない
    return this.bounces < 2;
  }

  checkHit(a) {
    const r = a.request;
    if (!r || !this.canHit(a)) return;
    if (r.noVolley && this.bounces === 0) return;
    const b = this.ball.s;
    const lat = (b.p.x - a.pos.x) * a.side; // 正: 利き手（フォア）側
    const depth = (a.pos.z - b.p.z) * a.side; // 正: 体より前
    const h = b.p.y;
    const closing = b.v.z * a.side;
    const kind = h > 1.9 ? 'oh' : lat >= 0 ? 'fh' : 'bh';
    const okLat = Math.abs(lat) < 1.6 && h > 0.05 && h < 2.8;

    const act = a.char.action;
    if (act && act.phase === 'prep' && act.kind !== kind && Math.abs(lat) > 0.3 && depth < 6) a.char.prep(kind);
    if (okLat && !a.char.isSwinging() && depth < 3) {
      const ttc = (depth - 0.35) / Math.max(closing, 0.01);
      if (ttc < 0.08) a.char.swing(kind);
    }
    if (okLat && depth < 1.6 && depth > -0.9) {
      if (depth <= 0.35 || closing < 1.0 || (this.bounces >= 1 && h < 0.16 && b.v.y < 0)) this.strike(a, lat, depth, h, kind);
    }
  }

  strike(a, lat, depth, h, kind) {
    const b = this.ball.s, s = a.side, r = a.request;
    const volley = this.bounces === 0;
    let q = 1 - Math.min(1, Math.abs(Math.abs(lat) - 0.85) / 0.95);
    if (h < 0.3) q -= (0.3 - h) * 2;
    if (h > 1.8) q -= (h - 1.8) * 0.35;
    if (depth < 0) q += depth * 0.5;
    q -= 0.3 * clamp(Math.hypot(a.vel.x, a.vel.z) / a.maxSpeed - 0.35, 0, 1); // 走りながらの打球は乱れやすい
    q -= clamp((Math.hypot(b.v.x, b.v.y, b.v.z) - 18) / 30, 0, 0.3); // 速い球ほど難しい
    q = clamp(q, 0, 1);

    let type, tx, tz, charge;
    if (a.ai) {
      ({ type, tx, tz, charge } = a.ai.chooseShot(q));
    } else {
      type = r.type;
      charge = r.charge || 0;
      const inp = this.input.axis();
      tx = Math.abs(inp.x) > 0.25 ? inp.x * 3.1 : clamp(-a.pos.x * 0.3, -1.5, 1.5) + rand(-0.7, 0.7);
      tz = -s * (type === 'lob' ? 10 + inp.y * 0.5 : 9 + inp.y * 1.7);
    }

    let speed, spin, clear;
    if (type === 'lob') { speed = 8.5 + 2 * charge; spin = 1.0; clear = 1.6; }
    else if (type === 'slice') { speed = 14 + 4.5 * charge; spin = -2.6; clear = 0.25; }
    else { speed = 17.5 + 10 * charge; spin = 4.2; clear = 0.32; }
    if (h > 2.0 && type !== 'lob') { speed = 24 + 5 * charge; spin = 1.5; clear = 0.15; type = 'smash'; kind = 'oh'; }
    if (volley && type !== 'smash') speed *= 0.85;
    speed *= 0.72 + 0.28 * q;

    const lv = a.ai ? a.ai.lv : null;
    let sig = (lv ? lv.err : 0.26) + (1 - q) * 1.2 + (type === 'top' ? charge * 0.25 : 0);
    if (lv && Math.random() < lv.miss) sig *= 2.6; // CPU のうっかりミス
    tx += gauss() * sig;
    tz += gauss() * sig;
    const v = solveShot(b.p, { x: tx, z: tz }, speed, spin, clear);
    const vErr = 0.15 + (lv ? lv.err * 0.45 : 0.1) + (1 - q) * 0.7;
    b.v.x = v.x;
    b.v.y = v.y + gauss() * vErr;
    b.v.z = v.z;
    b.spin = spin;
    b.kind = type === 'smash' ? 'flat' : type;
    b.netTouched = false;
    b.netCord = false;

    this.lastHitter = a;
    this.lastTargetX = tx;
    this.bounces = 0;
    this.isServe = false;
    this.rallyHits++;
    this.lastHitTime = this.time;
    this.stats.hits++;
    if (a === this.p && !a.ai) this.stats.playerHits++;
    a.request = null;
    if (!a.ai) this.ui.power(null);
    a.char.swing(kind, true);

    const kmh = Math.round(Math.hypot(b.v.x, b.v.y, b.v.z) * 3.6);
    this.sfx.hit(clamp(speed / 26, 0.2, 1));
    if (!this.demo) this.ui.speed(kmh, { top: 'トップスピン', lob: 'ロブ', slice: 'スライス', smash: 'スマッシュ' }[type] + (volley && type !== 'smash' ? '（ボレー）' : ''));
    const o = this.other(a);
    if (o.ai) o.ai.onIncoming();
  }

  // ---- サーブ ----
  toss(a, type) {
    this.state = 'toss';
    this.serveType = type;
    const s = a.side, b = this.ball.s;
    b.p.x = a.pos.x + s * 0.12;
    b.p.y = 1.5;
    b.p.z = a.pos.z - s * 0.3;
    b.v.x = 0; b.v.y = 5.7; b.v.z = -s * 0.4;
    b.spin = 0; b.kind = 'flat';
    a.char.prep('serve');
  }

  serveHit(a, type) {
    const b = this.ball.s;
    if (b.p.y < 1.6) return;
    const q = 1 - clamp((Math.abs(b.p.y - 3.05) - 0.12) / 0.8, 0, 1);
    const s = a.side, box = -this.serverXSign();
    let tx, tz, speed, spin, sig, vErr;
    if (a.ai) {
      const lv = a.ai.lv;
      tx = box * [0.6, 2.0, 3.5][(Math.random() * 3) | 0];
      tz = -s * rand(4.9, 5.8);
      if (type === 'flat') { speed = 24 + 9 * lv.serve * rand(0.85, 1); spin = 1.5; sig = 0.36; }
      else { speed = 19 + 3 * lv.serve; spin = 6; sig = 0.22; }
      vErr = 0.12;
    } else {
      const inp = this.input.axis();
      tx = box * 2.0 + inp.x * 1.6;
      tx = box > 0 ? clamp(tx, 0.3, 3.8) : clamp(tx, -3.8, -0.3);
      tz = -s * (5.3 + inp.y * 0.6);
      if (type === 'flat') { speed = 31; spin = 1.5; sig = 0.28; } else { speed = 21; spin = 6; sig = 0.16; }
      sig += (1 - q) * 1.1;
      vErr = 0.1 + (1 - q) * 0.6;
    }
    tx += gauss() * sig;
    tz += gauss() * sig;
    const v = solveShot(b.p, { x: tx, z: tz }, speed, spin, 0.06);
    b.v.x = v.x;
    b.v.y = v.y + gauss() * vErr;
    b.v.z = v.z;
    b.spin = spin;
    b.kind = type === 'flat' ? 'flat' : 'top';
    b.netTouched = false;
    b.netCord = false;

    this.state = 'play';
    this.isServe = true;
    this.lastHitter = a;
    this.lastTargetX = tx;
    this.bounces = 0;
    this.rallyHits = 0;
    this.lastHitTime = this.time;
    this.stats.serves++;
    a.char.swing('serve', true);
    this.sfx.hit(0.95);
    this.ball.resetTrail();
    if (!this.demo) {
      this.ui.speed(Math.round(Math.hypot(b.v.x, b.v.y, b.v.z) * 3.6), type === 'flat' ? 'フラットサーブ' : 'スピンサーブ');
      this.ui.hint(undefined);
    }
    const rc = this.other(a);
    if (rc.ai) rc.ai.onIncoming();
  }

  // ---- 判定 ----
  fxEvent(e) {
    if (e.type === 'bounce') this.sfx.bounce(e.iv);
    else if (e.type === 'net') this.sfx.net(1);
    else if (e.type === 'netcord') this.sfx.net(0.5);
  }

  onBounce(e) {
    const h = this.lastHitter;
    if (!h) return;
    const sideB = e.z > 0 ? 1 : -1;
    if (this.bounces === 0) {
      if (sideB === h.side) {
        if (this.isServe) this.fault();
        else this.pointTo(this.other(h), this.ball.s.netTouched ? 'ネット' : 'ミス');
        return;
      }
      const inside = this.isIn(e.x, e.z, this.isServe);
      this.ball.showMark(e.x, e.z, !inside);
      if (!inside) {
        if (this.isServe) this.fault();
        else this.pointTo(this.other(h), 'アウト');
        return;
      }
      if (this.isServe && this.ball.s.netTouched) { this.let(); return; }
      this.bounces = 1;
    } else {
      this.bounces = 2;
      this.pointTo(h, this.isServe ? 'サービスエース！' : this.rallyHits >= 8 ? 'ナイスラリー！' : 'ウィナー！');
    }
  }

  resolveStall() {
    const h = this.lastHitter;
    if (this.bounces === 0) this.pointTo(this.other(h), 'アウト');
    else this.pointTo(h, 'ウィナー！');
  }

  fault() {
    this.clearRequests();
    if (this.faults === 0) {
      this.faults = 1;
      this.state = 'fault';
      this.timer = 1.4;
      if (!this.demo) this.ui.message('フォルト', 'セカンドサーブ', 1.2);
    } else {
      this.pointTo(this.other(this.server), 'ダブルフォルト');
    }
  }

  let() {
    this.clearRequests();
    this.state = 'fault';
    this.timer = 1.2;
    if (!this.demo) this.ui.message('レット', 'サーブやり直し', 1.0);
  }

  callText() {
    const si = this.idx(this.server);
    const a = this.points[si], b = this.points[1 - si];
    if (a >= 3 && b >= 3) {
      if (a === b) return 'デュース';
      return 'アドバンテージ ' + (a > b ? this.server.name : this.other(this.server).name);
    }
    return `${a === 0 ? 'ラブ' : PTS[a]} - ${b === 0 ? 'ラブ' : PTS[b]}`;
  }

  pointTo(w, reason) {
    if (this.state === 'pointOver' || this.state === 'matchOver') return;
    this.clearRequests();
    this.lastReason = reason;
    const wi = this.idx(w), li = 1 - wi, l = this.other(w);
    this.points[wi]++;
    this.stats.points++;
    let sub;
    if (this.points[wi] >= 4 && this.points[wi] - this.points[li] >= 2) {
      this.games[wi]++;
      this.points = [0, 0];
      this.server = this.other(this.server);
      const g = this.games, N = this.target;
      const won = N >= 6 ? (g[wi] >= N && g[wi] - g[li] >= 2) || g[wi] >= N + 1 : g[wi] >= N;
      sub = `ゲーム ${w.name}　${g[0]} - ${g[1]}`;
      if (won) {
        this.matchWinner = w;
        sub = `ゲームセット！ ${w.name} の勝利`;
      }
    } else sub = this.callText();
    this.state = 'pointOver';
    this.timer = this.matchWinner ? 3.4 : 2.8;
    this.pointT = 0;
    this.focus = w;
    w.char.setMood('celebrate');
    l.char.setMood('dejected');
    this.excite = 1;
    if (!this.demo) {
      this.ui.message(reason, sub, 2.3);
      this.ui.setScore(this);
      this.sfx.applause(w === this.p ? 1 : 0.55);
    }
  }

  // ---- 描画用の更新（毎フレーム） ----
  updateVisuals(dt) {
    const look = this.ball.s.p;
    if (this.state === 'pointOver' || this.state === 'matchOver') this.pointT = (this.pointT || 0) + dt;
    for (const a of this.all) {
      const sp = Math.hypot(a.vel.x, a.vel.z);
      let target = a.baseYaw;
      if (!a.char.action && !a.char.mood && sp > 1.2) {
        const my = Math.atan2(a.vel.x, a.vel.z);
        const k = clamp((sp - 1.2) / 3.5, 0, 1);
        target = a.baseYaw + clamp(wrapAngle(my - a.baseYaw), -1.35, 1.35) * k;
      }
      a.yaw += wrapAngle(target - a.yaw) * Math.min(1, dt * 10);
      a.char.root.position.set(a.pos.x, 0, a.pos.z);
      a.char.root.rotation.y = a.yaw;
      const fwd = a.vel.x * Math.sin(a.yaw) + a.vel.z * Math.cos(a.yaw);
      a.char.update(dt, sp, fwd, look);
    }
    if (this.state === 'serveReady') {
      const b = this.ball.s.p;
      this.server.char.leftHandWorld(this._v);
      b.x = this._v.x; b.y = this._v.y; b.z = this._v.z;
    }
    this.ball.sync(dt);
    this.excite = Math.max(0, this.excite - dt * 0.45);
  }
}
