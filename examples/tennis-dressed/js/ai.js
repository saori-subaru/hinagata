// CPU の思考：ボールの軌道を先読みして打点に走り込み、コースを選んで打ち返す
import { LEVELS, clamp, rand } from './constants.js';
import { stepBall, cloneState } from './physics.js';

export class AIController {
  constructor(game, athlete, level) {
    this.g = game;
    this.a = athlete;
    this.setLevel(level);
    this.reset();
  }

  setLevel(level) {
    this.lv = LEVELS[level] || LEVELS.normal;
    this.a.maxSpeed = this.lv.speed;
  }

  reset() {
    this.plan = null;
    this.tracking = false;
    this.leave = false;
    this.planAt = 0;
    this.nextPlan = 0;
  }

  // 相手が打った（またはサーブした）瞬間に呼ばれる
  onIncoming() {
    this.tracking = true;
    this.plan = null;
    this.leave = false;
    this.leaveRoll = Math.random();
    this.planAt = this.g.time + this.lv.react * rand(0.8, 1.3);
    this.nextPlan = 0;
    this.a.request = null;
  }

  update() {
    const g = this.g, a = this.a, s = a.side;
    let tx = a.pos.x, tz = a.pos.z;

    if (g.state === 'serveReady' || g.state === 'toss') {
      if (g.server !== a) {
        const r = g.receivePos(a);
        tx = r.x; tz = r.z;
      }
    } else if (g.state === 'play') {
      if (this.tracking && g.lastHitter !== a) {
        if (g.time >= this.planAt && g.time >= this.nextPlan) {
          this.nextPlan = g.time + 0.2;
          const plan = this.computePlan();
          if (plan && plan.leave) {
            // 明らかなアウトは見送る
            this.plan = null;
            this.leave = true;
            a.request = null;
          } else {
            this.plan = plan;
            if (plan) {
              if (!a.request) a.request = { auto: true, type: 'top', charge: 0 };
              a.request.noVolley = !plan.volley;
            }
          }
        }
        if (this.plan) {
          tx = this.plan.x;
          tz = this.plan.z;
          const until = this.plan.hitTime - g.time;
          if (!a.char.action && until < 0.5 && until > 0) a.char.prep(this.plan.kind);
        }
      } else if (g.lastHitter === a) {
        // 打ったらポジションに戻る
        tx = clamp((g.lastTargetX || 0) * 0.3, -2.2, 2.2);
        tz = s * 12.2;
      }
    }

    const dx = tx - a.pos.x, dz = tz - a.pos.z;
    const d = Math.hypot(dx, dz);
    const sp = Math.min(a.maxSpeed, d * 4.5);
    if (d > 0.04) a.desired.set((dx / d) * sp, 0, (dz / d) * sp);
    else a.desired.set(0, 0, 0);
  }

  computePlan() {
    const g = this.g, a = this.a, s = a.side;
    const st = cloneState(g.ball.s);
    let bounces = g.bounces;
    const ev = [];
    const dt = 1 / 60;
    const nearNet = Math.abs(a.pos.z) < 7.5;
    let best = null, bestScore = Infinity;
    for (let i = 1; i <= 210; i++) {
      ev.length = 0;
      stepBall(st, dt, ev);
      const t = i * dt;
      for (const e of ev) {
        if (e.type !== 'bounce') continue;
        bounces++;
        if (bounces === 1 && g.bounces === 0) {
          const m = g.outMargin(e.x, e.z, g.isServe);
          if (m > 0.2 && this.leaveRoll < this.lv.leave) return { leave: true };
        }
      }
      if (bounces >= 2) break;
      const p = st.p;
      if (p.z * s < 0.5) continue;
      const volley = bounces === 0;
      if (volley && (g.isServe || !nearNet)) continue;
      if (p.y < 0.18 || p.y > 2.6 || Math.abs(p.z) > 15) continue;
      const sz = p.z + 0.35 * s;
      const fx = p.x - 0.85 * s, bx = p.x + 0.85 * s;
      const df = Math.hypot(fx - a.pos.x, sz - a.pos.z);
      const db = Math.hypot(bx - a.pos.x, sz - a.pos.z);
      const useF = df <= db + 0.7;
      const dist = useF ? df : db;
      const need = dist / a.maxSpeed + 0.12;
      const late = Math.max(0, need - t);
      const score = Math.abs(p.y - 0.95) + late * 8 + (st.v.y > 0 ? 0.3 : 0) + t * 0.12 + (volley ? 0.2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { x: useF ? fx : bx, z: sz, t, volley, kind: p.y > 1.9 ? 'oh' : useF ? 'fh' : 'bh' };
      }
    }
    if (best) best.hitTime = g.time + best.t;
    return best;
  }

  // 打球の種類とコースを決める（q: 打点の良さ 0..1）
  chooseShot(q) {
    const g = this.g, a = this.a, s = a.side, lv = this.lv, o = g.other(a);
    let type = 'top';
    const r = Math.random();
    if (Math.abs(o.pos.z) < 6 && r < 0.45) type = 'lob';
    else if (q < 0.35 && r < 0.5) type = 'slice';
    else if (r < 0.1) type = 'slice';
    const wide = 2.4 + 1.2 * lv.aggr;
    const away = -Math.sign(o.pos.x || Math.random() - 0.5);
    const tx = Math.random() < 0.7 ? away * rand(0.6, wide) : rand(-wide, wide);
    let depth = rand(8.0, 9.8) + lv.aggr * 0.9;
    if (type === 'lob') depth = rand(9.0, 10.4);
    let charge = clamp(lv.power * rand(0.6, 1) * (0.55 + 0.45 * q), 0, 1);
    // チャンスボール（浅い球・相手が大きく外れている）は角度をつけて決めにいく
    const short = Math.abs(a.pos.z) < 10.5;
    if (type === 'top' && q > 0.6 && (short || Math.abs(o.pos.x) > 2.6) && Math.random() < 0.35 + lv.aggr * 0.4) {
      return { type, tx: away * rand(2.7, 3.6), tz: -s * rand(7.5, 10), charge: clamp(lv.power + 0.15, 0, 1) };
    }
    return { type, tx, tz: -s * depth, charge };
  }
}
