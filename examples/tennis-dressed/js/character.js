// プリミティブで組んだ階層リグの選手と、手続き的なアニメーション
// ローカル座標では +z が正面、キャラクターの右手側は -x。
import * as THREE from 'three';
import { clamp, smooth, wrapAngle } from './constants.js';

const KEYS = ['pelvis', 'spine', 'head', 'shR', 'elR', 'haR', 'shL', 'elL', 'haL', 'hipR', 'knR', 'anR', 'hipL', 'knL', 'anL'];

function makePose(o) {
  const p = { y: 0 };
  for (const k of KEYS) p[k] = [0, 0, 0];
  if (o) for (const k in o) p[k] = Array.isArray(o[k]) ? o[k].slice() : o[k];
  return p;
}

function resolveInto(dst, base, part) {
  dst.y = base.y;
  for (const k of KEYS) {
    const s = base[k], d = dst[k];
    d[0] = s[0]; d[1] = s[1]; d[2] = s[2];
  }
  if (part) {
    for (const k in part) {
      if (k === 'y') { dst.y = part.y; continue; }
      const s = part[k], d = dst[k];
      d[0] = s[0]; d[1] = s[1]; d[2] = s[2];
    }
  }
  return dst;
}

function lerpInto(dst, a, b, t) {
  dst.y = a.y + (b.y - a.y) * t;
  for (const k of KEYS) {
    const A = a[k], B = b[k], D = dst[k];
    D[0] = A[0] + (B[0] - A[0]) * t;
    D[1] = A[1] + (B[1] - A[1]) * t;
    D[2] = A[2] + (B[2] - A[2]) * t;
  }
  return dst;
}

function set(a, x, y, z) { a[0] = x; a[1] = y; a[2] = z; }

// ---- ポーズ定義（ラジアン）----
// 肩: x負=腕を前に上げる / z負(右腕)=外側へ上げる / y=水平に振る
const READY = makePose({
  y: -0.06, spine: [0.22, 0, 0], head: [-0.18, 0, 0],
  shR: [-0.42, 0, 0.2], elR: [-1.3, 0, 0], haR: [0, 1.57, 0],
  shL: [-0.5, 0, -0.32], elL: [-1.45, 0, 0],
  hipR: [-0.42, 0, -0.1], knR: [0.72, 0, 0], anR: [-0.3, 0, 0.1],
  hipL: [-0.42, 0, 0.1], knL: [0.72, 0, 0], anL: [-0.3, 0, -0.1],
});

function runPose(p, ph) {
  const a = Math.sin(ph), c = Math.cos(ph);
  p.y = -0.07 + 0.05 * Math.abs(a);
  set(p.pelvis, 0, a * 0.12, 0);
  set(p.spine, 0.32, -a * 0.2, 0);
  set(p.head, -0.25, 0, 0);
  set(p.hipR, -0.3 - a * 0.75, 0, -0.04);
  set(p.knR, 0.35 + Math.max(0, c) * 1.25, 0, 0);
  set(p.anR, -0.15, 0, 0);
  set(p.hipL, -0.3 + a * 0.75, 0, 0.04);
  set(p.knL, 0.35 + Math.max(0, -c) * 1.25, 0, 0);
  set(p.anL, -0.15, 0, 0);
  set(p.shR, -0.5 + a * 0.35, 0, 0.18);
  set(p.elR, -1.25, 0, 0);
  set(p.haR, 0, 1.57, 0);
  set(p.shL, -0.2 - a * 0.7, 0, -0.12);
  set(p.elL, -1.5, 0, 0);
  set(p.haL, 0, 0, 0);
}

// フォアハンド
const FH_BACK = { spine: [0.2, -1.15, 0], shR: [-0.15, -0.55, -1.1], elR: [-0.6, 0, 0], haR: [0, 0.6, 0.3], shL: [-1.35, 0.2, -0.15], elL: [-0.2, 0, 0] };
const FH_HIT = { spine: [0.2, -0.05, 0], shR: [-0.3, 0.65, -1.2], elR: [-0.2, 0, 0], haR: [0, 0, 0], shL: [-0.7, 0, -0.7], elL: [-0.6, 0, 0] };
const FH_FOLLOW = { spine: [0.1, 0.95, 0], shR: [-1.7, 1.1, -0.4], elR: [-1.7, 0, 0], haR: [0, 0.3, 0], shL: [-0.4, 0, -0.3], elL: [-1.4, 0, 0] };
// バックハンド（片手打ち、左手はスロートに添える）
const BH_BACK = { spine: [0.2, 1.2, 0], shR: [-0.5, 0.3, 1.0], elR: [-0.6, 0, 0], haR: [0, 0.4, 0], shL: [-0.7, 0, -0.1], elL: [-1.5, 0, 0] };
const BH_HIT = { spine: [0.2, 0.1, 0], shR: [-0.4, -0.9, 0.9], elR: [-0.15, 0, 0], haR: [0, 0, 0], shL: [-0.3, 0, -0.5], elL: [-0.5, 0, 0] };
const BH_FOLLOW = { spine: [0.1, -0.75, 0], shR: [-1.6, -1.2, 0.5], elR: [-0.4, 0, 0], haR: [0, 0, 0], shL: [0.3, 0, -0.6], elL: [-0.3, 0, 0] };
// サーブ（トロフィーポーズ → 打点 → フォロースルー）
const SV_TROPHY = {
  y: -0.14, spine: [-0.35, -0.9, 0], shR: [-2.4, 0, -0.4], elR: [-2.1, 0, 0], haR: [0, 0, 0],
  shL: [-2.95, 0, -0.1], elL: [-0.05, 0, 0],
  hipR: [-0.6, 0, -0.1], knR: [1.1, 0, 0], anR: [-0.5, 0, 0.1], hipL: [-0.6, 0, 0.1], knL: [1.1, 0, 0], anL: [-0.5, 0, -0.1],
};
const SV_HIT = {
  y: 0.06, spine: [0.15, -0.2, 0], shR: [-3.0, 0, -0.12], elR: [-0.05, 0, 0], haR: [0, 0, 0],
  shL: [-1.4, 0, -0.4], elL: [-1.0, 0, 0],
  hipR: [0, 0, -0.05], knR: [0.05, 0, 0], anR: [0.25, 0, 0], hipL: [0.1, 0, 0.05], knL: [0.1, 0, 0], anL: [0.3, 0, 0],
};
const SV_FOLLOW = {
  y: -0.05, spine: [0.55, 0.55, 0], shR: [-0.5, 0, 0.95], elR: [-0.6, 0, 0], haR: [0, 0, 0],
  shL: [-0.3, 0, -0.3], elL: [-1.2, 0, 0],
  hipR: [-0.6, 0, -0.1], knR: [0.5, 0, 0], anR: [0, 0, 0], hipL: [0.3, 0, 0.1], knL: [0.6, 0, 0], anL: [0, 0, 0],
};
const OH_BACK = { spine: [-0.2, -0.6, 0], shR: [-2.4, 0, -0.4], elR: [-2.1, 0, 0], haR: [0, 0, 0], shL: [-2.6, 0, -0.2], elL: [-0.2, 0, 0] };

const ANIMS = {
  fh: { prep: [[0, null], [0.22, FH_BACK]], swing: [[-0.12, null], [0, FH_BACK], [0.07, FH_HIT], [0.3, FH_FOLLOW], [0.62, null]], contact: 0.07 },
  bh: { prep: [[0, null], [0.22, BH_BACK]], swing: [[-0.12, null], [0, BH_BACK], [0.07, BH_HIT], [0.3, BH_FOLLOW], [0.62, null]], contact: 0.07 },
  serve: { prep: [[0, null], [0.5, SV_TROPHY]], swing: [[-0.15, null], [0, SV_TROPHY], [0.1, SV_HIT], [0.42, SV_FOLLOW], [0.85, null]], contact: 0.1 },
  oh: { prep: [[0, null], [0.3, OH_BACK]], swing: [[-0.12, null], [0, OH_BACK], [0.08, SV_HIT], [0.35, SV_FOLLOW], [0.7, null]], contact: 0.08 },
};

const MOODS = {
  celebrate(t) {
    const pump = Math.sin(t * 9);
    const jump = t < 1.3 ? Math.max(0, Math.sin(t * 9)) * 0.14 : 0;
    return {
      y: jump, spine: [-0.15, 0, 0], head: [-0.35, 0, 0],
      shR: [-2.75 + pump * 0.2, 0, -0.35], elR: [-0.5 - pump * 0.3, 0, 0], haR: [0, 0, 0],
      shL: [-2.75 - pump * 0.2, 0, 0.35], elL: [-0.5 + pump * 0.3, 0, 0],
      hipR: [-0.05, 0, -0.06], knR: [0.12, 0, 0], anR: [-0.07, 0, 0.06],
      hipL: [-0.05, 0, 0.06], knL: [0.12, 0, 0], anL: [-0.07, 0, -0.06],
    };
  },
  dejected(t) {
    const sway = Math.sin(t * 2) * 0.08;
    return {
      y: -0.01, spine: [0.45, sway, 0], head: [0.55, 0, 0],
      shR: [0.15, 0, 0.15], elR: [-0.4, 0, 0], haR: [0, 1.57, 0],
      shL: [0.05, 0, -0.12], elL: [-0.2, 0, 0],
      hipR: [-0.05, 0, -0.05], knR: [0.1, 0, 0], anR: [-0.05, 0, 0.05],
      hipL: [-0.05, 0, 0.05], knL: [0.1, 0, 0], anL: [-0.05, 0, -0.05],
    };
  },
};

export const SIT_POSE = {
  y: -0.45, spine: [0.05, 0, 0], head: [0, 0, 0],
  shR: [-0.6, 0, 0.12], elR: [-0.9, 0, 0], shL: [-0.6, 0, -0.12], elL: [-0.9, 0, 0],
  hipR: [-1.5, 0, -0.06], knR: [1.5, 0, 0], anR: [0, 0, 0],
  hipL: [-1.5, 0, 0.06], knL: [1.5, 0, 0], anL: [0, 0, 0],
};

function stringsTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(245,245,235,0.9)';
  g.lineWidth = 2;
  for (let i = 4; i < 128; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let STRINGS_TEX = null;

function buildRacket(color) {
  const grp = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.2, 8), gripMat);
  handle.position.y = -0.08;
  grp.add(handle);
  for (const sx of [-1, 1]) {
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 6), frameMat);
    throat.position.set(sx * 0.03, -0.235, 0);
    throat.rotation.z = sx * 0.42;
    grp.add(throat);
  }
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.011, 8, 36), frameMat);
  head.scale.set(1, 1.3, 1);
  head.position.y = -0.445;
  grp.add(head);
  if (!STRINGS_TEX) STRINGS_TEX = stringsTexture();
  const str = new THREE.Mesh(
    new THREE.CircleGeometry(0.122, 32),
    new THREE.MeshBasicMaterial({ map: STRINGS_TEX, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 })
  );
  str.scale.set(1, 1.3, 1);
  str.position.y = -0.445;
  grp.add(str);
  grp.traverse((o) => { if (o.isMesh && o !== str) o.castShadow = true; });
  return grp;
}

export class Character {
  constructor(opt = {}) {
    const o = Object.assign({
      shirt: 0xd23a3a, shorts: 0xffffff, skin: 0xf0c4a0, hair: 0x2a1a10, shoes: 0xffffff, sole: 0x333333,
      accent: 0xffffff, headwear: 'cap', capColor: 0xffffff, racket: true, racketColor: 0xd22020, wristband: true,
    }, opt);
    const std = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const M = {
      shirt: std(o.shirt, 0.8), shorts: std(o.shorts, 0.8), skin: std(o.skin, 0.6), hair: std(o.hair, 0.9),
      shoes: std(o.shoes, 0.5), sole: std(o.sole, 0.6), accent: std(o.accent, 0.6), cap: std(o.capColor, 0.7),
      dark: std(0x1a1a1a, 0.4), white: std(0xffffff, 0.6),
    };
    const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const grp = (parent, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    const root = (this.root = new THREE.Group());
    this.pelvis = grp(root, 0, 1.0, 0);
    add(this.pelvis, new THREE.CylinderGeometry(0.165, 0.185, 0.24, 14), M.shorts, 0, -0.06, 0).scale.set(1, 1, 0.72);

    // 胴体
    this.spine = grp(this.pelvis, 0, 0.06, 0);
    add(this.spine, new THREE.CapsuleGeometry(0.16, 0.3, 4, 14), M.shirt, 0, 0.27, 0).scale.set(1.15, 1, 0.72);
    add(this.spine, new THREE.CylinderGeometry(0.188, 0.186, 0.05, 16), M.accent, 0, 0.36, 0).scale.set(1, 1, 0.72);
    add(this.spine, new THREE.TorusGeometry(0.07, 0.016, 6, 16), M.accent, 0, 0.5, 0.02).rotation.x = Math.PI / 2;

    // 首と頭
    this.neck = grp(this.spine, 0, 0.55, 0);
    add(this.neck, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), M.skin, 0, 0.03, 0);
    this.head = grp(this.neck, 0, 0.08, 0);
    add(this.head, new THREE.SphereGeometry(0.11, 22, 16), M.skin, 0, 0.1, 0).scale.set(0.92, 1.06, 1);
    const hair = add(this.head, new THREE.SphereGeometry(0.117, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, 0, 0.11, -0.012);
    hair.rotation.x = -0.35;
    for (const sx of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.014, 8, 6), M.dark, sx * 0.037, 0.12, 0.094);
      add(this.head, new THREE.SphereGeometry(0.022, 8, 6), M.skin, sx * 0.1, 0.1, 0.0).scale.set(0.6, 1, 1);
      add(this.head, new THREE.BoxGeometry(0.035, 0.008, 0.01), M.hair, sx * 0.038, 0.145, 0.097);
    }
    add(this.head, new THREE.SphereGeometry(0.018, 8, 6), M.skin, 0, 0.092, 0.105).scale.set(0.8, 1, 1);
    add(this.head, new THREE.BoxGeometry(0.04, 0.007, 0.01), std(0x8a4a3a), 0, 0.055, 0.1);
    if (o.headwear === 'cap') {
      add(this.head, new THREE.SphereGeometry(0.121, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), M.cap, 0, 0.125, 0);
      const visor = add(this.head, new THREE.CylinderGeometry(0.09, 0.09, 0.01, 18, 1, false, -Math.PI / 2, Math.PI), M.cap, 0, 0.165, 0.08);
      visor.scale.set(1, 1, 1.2);
      visor.rotation.x = 0.12;
    } else if (o.headwear === 'band') {
      const band = add(this.head, new THREE.TorusGeometry(0.108, 0.017, 8, 24), M.cap, 0, 0.16, 0);
      band.rotation.x = Math.PI / 2;
      band.scale.set(0.95, 1.02, 1);
    }

    // 腕
    const arm = (side) => {
      const sh = grp(this.spine, side * 0.215, 0.46, 0);
      add(sh, new THREE.SphereGeometry(0.068, 12, 10), M.shirt, 0, 0, 0);
      add(sh, new THREE.CapsuleGeometry(0.058, 0.08, 3, 10), M.shirt, 0, -0.06, 0);
      add(sh, new THREE.CapsuleGeometry(0.047, 0.2, 3, 10), M.skin, 0, -0.16, 0);
      const el = grp(sh, 0, -0.3, 0);
      add(el, new THREE.SphereGeometry(0.046, 10, 8), M.skin, 0, 0, 0);
      add(el, new THREE.CapsuleGeometry(0.042, 0.18, 3, 10), M.skin, 0, -0.12, 0);
      const ha = grp(el, 0, -0.27, 0);
      add(ha, new THREE.SphereGeometry(0.047, 10, 8), M.skin, 0, -0.01, 0).scale.set(0.85, 1.1, 1);
      return { sh, el, ha };
    };
    const R = arm(-1), L = arm(1);
    this.shR = R.sh; this.elR = R.el; this.haR = R.ha;
    this.shL = L.sh; this.elL = L.el; this.haL = L.ha;
    if (o.wristband) add(this.elR, new THREE.CylinderGeometry(0.048, 0.048, 0.05, 12), M.accent, 0, -0.21, 0);
    if (o.racket) {
      this.racket = buildRacket(o.racketColor);
      this.racket.position.y = -0.02;
      this.haR.add(this.racket);
    }

    // 脚
    const leg = (side) => {
      const hip = grp(this.pelvis, side * 0.095, -0.05, 0);
      add(hip, new THREE.CylinderGeometry(0.088, 0.082, 0.2, 12), M.shorts, 0, -0.07, 0);
      add(hip, new THREE.CapsuleGeometry(0.07, 0.26, 3, 10), M.skin, 0, -0.22, 0);
      const kn = grp(hip, 0, -0.44, 0);
      add(kn, new THREE.SphereGeometry(0.064, 10, 8), M.skin, 0, 0, 0.005);
      add(kn, new THREE.CapsuleGeometry(0.056, 0.3, 3, 10), M.skin, 0, -0.2, 0);
      add(kn, new THREE.CylinderGeometry(0.053, 0.05, 0.12, 10), M.white, 0, -0.36, 0);
      const an = grp(kn, 0, -0.44, 0);
      add(an, new THREE.BoxGeometry(0.1, 0.07, 0.27), M.shoes, 0, -0.03, 0.05);
      add(an, new THREE.BoxGeometry(0.104, 0.018, 0.275), M.sole, 0, -0.063, 0.05);
      return { hip, kn, an };
    };
    const LR = leg(-1), LL = leg(1);
    this.hipR = LR.hip; this.knR = LR.kn; this.anR = LR.an;
    this.hipL = LL.hip; this.knL = LL.kn; this.anL = LL.an;

    this.joints = {
      pelvis: this.pelvis, spine: this.spine, head: this.head,
      shR: this.shR, elR: this.elR, haR: this.haR, shL: this.shL, elL: this.elL, haL: this.haL,
      hipR: this.hipR, knR: this.knR, anR: this.anR, hipL: this.hipL, knL: this.knL, anL: this.anL,
    };

    this.time = Math.random() * 10;
    this.phase = 0;
    this.action = null;
    this.mood = null;
    this.moodKind = null;
    this.moodT = 0;
    this.moodW = 0;
    this.headYaw = 0;
    this.staticPose = null;
    this._base = makePose(); this._run = makePose(); this._act = makePose();
    this._m = makePose(); this._A = makePose(); this._B = makePose(); this._out = makePose();
    this.update(0);
  }

  // ---- アクション ----
  prep(kind) {
    if (this.action && this.action.phase === 'swing') return;
    if (this.action && this.action.kind === kind) return;
    const t = this.action ? Math.min(this.action.t, 0.12) : 0;
    this.action = { kind, phase: 'prep', t };
  }

  swing(kind, atContact = false) {
    const A = ANIMS[kind];
    const cur = this.action;
    if (cur && cur.phase === 'swing' && cur.kind === kind) {
      if (atContact && cur.t < A.contact) cur.t = A.contact;
      return;
    }
    const fromPrep = cur && cur.phase === 'prep' && cur.kind === kind;
    let t = fromPrep ? 0 : A.swing[0][0];
    if (atContact) t = fromPrep ? A.contact : A.contact - 0.03;
    this.action = { kind, phase: 'swing', t };
  }

  isSwinging() { return !!(this.action && this.action.phase === 'swing'); }

  setMood(kind) {
    this.mood = kind;
    if (kind) { this.moodKind = kind; this.moodT = 0; }
  }

  reset() {
    this.action = null;
    this.mood = null;
    this.moodW = 0;
  }

  leftHandWorld(v) {
    this.root.updateMatrixWorld(true);
    return this.haL.getWorldPosition(v);
  }

  evalTimeline(dst, keys, t, base) {
    if (t <= keys[0][0]) return resolveInto(dst, base, keys[0][1]);
    for (let i = 0; i < keys.length - 1; i++) {
      const t0 = keys[i][0], t1 = keys[i + 1][0];
      if (t <= t1) {
        const u = smooth((t - t0) / (t1 - t0));
        resolveInto(this._A, base, keys[i][1]);
        resolveInto(this._B, base, keys[i + 1][1]);
        return lerpInto(dst, this._A, this._B, u);
      }
    }
    return resolveInto(dst, base, keys[keys.length - 1][1]);
  }

  // speed: 移動速度, fwd: 体の向きに対する前進成分, look: 目で追う点
  update(dt, speed = 0, fwd = 0, look = null) {
    this.time += dt;
    let base;
    if (this.staticPose) {
      base = resolveInto(this._base, READY, this.staticPose);
    } else {
      const k = clamp(speed / 5.5, 0, 1);
      this.phase += (fwd < -0.6 ? -1 : 1) * speed * dt * ((Math.PI * 2) / 2.4);
      runPose(this._run, this.phase);
      base = lerpInto(this._base, READY, this._run, k);
      base.y += Math.sin(this.time * 3.2) * 0.008 * (1 - k);
    }

    if (this.mood) { this.moodT += dt; this.moodW = Math.min(1, this.moodW + dt * 4); }
    else this.moodW = Math.max(0, this.moodW - dt * 4);
    let out = base;
    if (this.moodW > 0 && this.moodKind) {
      resolveInto(this._m, base, MOODS[this.moodKind](this.moodT));
      out = lerpInto(this._out, base, this._m, smooth(this.moodW));
    }

    if (this.action) {
      const A = ANIMS[this.action.kind];
      this.action.t += dt;
      const keys = this.action.phase === 'prep' ? A.prep : A.swing;
      this.evalTimeline(this._act, keys, this.action.t, out);
      out = this._act;
      if (this.action.phase === 'swing' && this.action.t >= keys[keys.length - 1][0]) this.action = null;
    }
    this.apply(out, dt, look);
  }

  apply(p, dt, look) {
    this.pelvis.position.y = 1.0 + p.y;
    const J = this.joints;
    for (const k of KEYS) {
      const r = p[k];
      J[k].rotation.set(r[0], r[1], r[2]);
    }
    // ボールを目で追う
    let want = -p.spine[1] * 0.6;
    if (look && !this.mood) {
      const dx = look.x - this.root.position.x, dz = look.z - this.root.position.z;
      want = clamp(wrapAngle(Math.atan2(dx, dz) - this.root.rotation.y - p.spine[1] - p.pelvis[1]), -1.25, 1.25);
    }
    this.headYaw += (want - this.headYaw) * Math.min(1, dt * 8);
    J.head.rotation.y = p.head[1] + this.headYaw;
  }
}
