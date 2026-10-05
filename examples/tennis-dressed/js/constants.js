// 共通定数とユーティリティ（単位はメートル・秒）
export const COURT = Object.freeze({
  halfLen: 11.885,      // ネットからベースラインまで
  singlesHalfW: 4.115,  // シングルスサイドラインまで
  doublesHalfW: 5.485,  // ダブルスサイドラインまで
  serviceLine: 6.4,     // ネットからサービスラインまで
  netH: 0.914,          // センターのネットの高さ
  postH: 1.07,          // ポスト位置のネットの高さ
  postX: 6.4,           // ネットポストのX位置
});

export const G = 9.81;
export const BALL_R = 0.045; // 見やすさのため実物(0.033)より少し大きめ
export const STEP = 1 / 120; // 物理の固定ステップ

// CPU の強さ
export const LEVELS = {
  easy:   { label: 'かんたん',   speed: 5.2, react: 0.34, err: 0.95, power: 0.5,  aggr: 0.2, serve: 0.6,  leave: 0.35, miss: 0.14 },
  normal: { label: 'ふつう',     speed: 6.2, react: 0.22, err: 0.72, power: 0.75, aggr: 0.5, serve: 0.85, leave: 0.7,  miss: 0.08 },
  hard:   { label: 'むずかしい', speed: 7.0, react: 0.14, err: 0.5,  power: 0.95, aggr: 0.8, serve: 1.0,  leave: 0.92, miss: 0.04 },
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
// ネットはポストに向かって少し高くなる（たるみを近似）
export function netHeightAt(x) {
  const t = Math.min(1, Math.abs(x) / COURT.postX);
  return COURT.netH + (COURT.postH - COURT.netH) * t * t;
}
