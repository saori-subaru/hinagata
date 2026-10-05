// ボールの物理（純粋関数：ゲーム本体と CPU の軌道予測の両方で使う）
import { G, BALL_R, COURT, netHeightAt } from './constants.js';

export function makeBallState() {
  return {
    p: { x: 0, y: 1, z: 0 },
    v: { x: 0, y: 0, z: 0 },
    spin: 0,          // 回転による追加の下向き加速度（トップスピン>0、スライス<0）
    kind: 'flat',     // バウンドの性質
    netCord: false,
    netTouched: false,
  };
}

export function cloneState(s) {
  return { p: { ...s.p }, v: { ...s.v }, spin: s.spin, kind: s.kind, netCord: s.netCord, netTouched: s.netTouched };
}

// [反発係数, 水平方向の減速]
const BOUNCE = {
  top: [0.76, 0.87],
  flat: [0.73, 0.8],
  slice: [0.6, 0.68],
  lob: [0.74, 0.82],
};

export function stepBall(s, dt, out) {
  const p = s.p, v = s.v;
  const px = p.x, py = p.y, pz = p.z;

  v.y -= (G + s.spin) * dt;
  p.x += v.x * dt;
  p.y += v.y * dt;
  p.z += v.z * dt;

  // ネット判定（z=0 の平面を横切ったか）
  if ((pz > 0 && p.z <= 0) || (pz < 0 && p.z >= 0)) {
    const t = pz / (pz - p.z);
    const cx = px + (p.x - px) * t;
    const cy = py + (p.y - py) * t;
    if (Math.abs(cx) <= COURT.postX + 0.05) {
      const h = netHeightAt(cx);
      if (cy - BALL_R < h) {
        s.netTouched = true;
        if (cy > h - 0.025 && !s.netCord && Math.abs(v.z) > 2) {
          // ネットインのコードボール：勢いを失って向こう側へ落ちる
          s.netCord = true;
          v.z *= 0.35;
          v.x *= 0.6;
          v.y = Math.abs(v.y) * 0.25 + 0.9;
          p.y = Math.max(p.y, h + BALL_R);
          if (out) out.push({ type: 'netcord', x: cx, y: cy });
        } else {
          const sg = pz > 0 ? 1 : -1;
          p.z = sg * (BALL_R + 0.02);
          p.x = cx;
          p.y = Math.max(BALL_R, Math.min(cy, h - BALL_R));
          v.z = -v.z * 0.1;
          v.x *= 0.3;
          v.y = Math.min(v.y, 0) * 0.3;
          if (out) out.push({ type: 'net', x: cx, y: cy });
        }
      }
    }
  }

  // 地面
  if (p.y < BALL_R) {
    p.y = BALL_R;
    if (v.y < 0) {
      const iv = -v.y;
      const [e, f] = BOUNCE[s.kind] || BOUNCE.flat;
      if (iv > 0.4) {
        v.y = iv * Math.max(0.5, e - 0.02 * Math.max(0, iv - 4)); // 速い打球ほど弾みが抑えられる
        v.x *= f;
        v.z *= f;
        if (out) out.push({ type: 'bounce', x: p.x, z: p.z, iv });
      } else {
        v.y = 0;
      }
      s.spin *= 0.2;
      s.kind = 'flat';
    }
    if (v.y === 0) {
      const d = Math.max(0, 1 - 1.5 * dt);
      v.x *= d;
      v.z *= d;
    }
  }

  // スタジアムの壁
  if (Math.abs(p.x) > 10.9) { p.x = Math.sign(p.x) * 10.9; v.x *= -0.3; }
  if (Math.abs(p.z) > 18.6) { p.z = Math.sign(p.z) * 18.6; v.z *= -0.3; }
}

// from から target(x,z) の地点に着地する初速を求める。ネットを clearance 以上の余裕で越えるまで山なりにする
export function solveShot(from, target, speedH, spin, clearance) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const d = Math.max(0.5, Math.hypot(dx, dz));
  const g = G + spin;
  let T = d / speedH, vy = 0;
  const crosses = (from.z > 0) !== (target.z > 0);
  for (let i = 0; i < 80; i++) {
    vy = (BALL_R - from.y + 0.5 * g * T * T) / T;
    if (!crosses) break;
    const tn = -from.z / (dz / T);
    const yn = from.y + vy * tn - 0.5 * g * tn * tn;
    const xn = from.x + (dx / T) * tn;
    if (yn - BALL_R >= netHeightAt(xn) + clearance) break;
    T *= 1.035;
  }
  return { x: dx / T, y: vy, z: dz / T, T };
}
