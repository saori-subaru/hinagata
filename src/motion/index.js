// Motion: poses as functions of time. Each returns { b: { boneName: [x, y, z] Euler angles }, y: hips lift, chair?: true, seat?: height,
//   air?: the speed (m/s) the pose would go at, for the wind the hair meets while it is played in place }.
// seat: the top of what the character sits on (seatFront: its front edge, z; what is beyond it hangs off the seat). The avatar then moves the hips so the lowest point of the bottom (body or pants, as worn)
//   rests on it: body types and clothes differ by 1-3 cm there, so a fixed y alone left some floating above the chair.
// grip?: { L, R } — how far each hand closes into a fist (0 = open, 1 = a fist): the finger bones curl toward the palm and the thumb folds
//   over them (gripHand below). A hand that holds something (outfit.weapon) is already a fist in its shape and is left alone.
// sharp: a fast pose (a jump) — after it has blended in, the bones follow it exactly each frame instead of easing toward it (easing slowed the drop just before landing).
// Bones not listed rest in the A-pose (the bind pose).
import * as THREE from "three";

const sin = Math.sin, cos = Math.cos, mx = Math.max;
const ARMS_DOWN = { "upperArm.L": [0, 0, -0.45], "upperArm.R": [0, 0, 0.45], "lowerArm.L": [0, 0, -0.08], "lowerArm.R": [0, 0, 0.08] };
// 手をふる: 肩と二の腕は上げたまま止め、肘から先だけを体の正面の面で(z軸のまわりに)左右に振る。
// 前腕をそのまま回すと(前腕の向きのまわりに回ると)前後に振れて見えるので、肘を中心に「正面から見た回転」をかけた向きを毎フレーム作る
// 二の腕・前腕・手の向きは、手のひらが正面を向くように手首のひねりを小さく抑えて選んだ(上げた腕全体をひねると、ぐねって見えた)
const WAVE = (() => {
  const sh = [0, 0, -0.2], chest = [0, -0.08, -0.05], ua = [-0.49, 0.54, -0.8], la = [-0.54, 0.23, -0.53], hand = [-0.22, -0.2, -0.04], amp = 0.36, mid = 0.14;   // mid: the swing is centred a little outward (the inner end stays clear of the hair)
  const Q = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...e));
  const up = Q(chest).multiply(Q(sh)).multiply(Q(ua)), upInv = up.clone().invert(), la0 = Q(la);   // up: the upper arm's world turn (its parents: chest, shoulder)
  const qz = new THREE.Quaternion(), q = new THREE.Quaternion(), e = new THREE.Euler(), Z = new THREE.Vector3(0, 0, 1);
  return { sh, chest, ua, hand, amp, mid, fore: (a) => { qz.setFromAxisAngle(Z, a); q.copy(upInv).multiply(qz).multiply(up).multiply(la0); e.setFromQuaternion(q); return [e.x, e.y, e.z]; } };   // a > 0: the hand toward the outside
})();
// ばんざいジャンプの時間割(1回 CHEER.T 秒)。u = 1回の中の位置(0〜1)。立ち止まらず、着地からそのまま次のためへつながる
//   0.78 つま先から着地(脚は伸び切ったまま) → かかとを下ろしながら、ひざを曲げて受ける(はじめは速く、深くなるほどゆっくり = ため)
//   0.26〜0.34 一気に伸びて、つま先で床をけって跳ぶ / 0.34〜0.57 上がる(頂点に近いほどゆっくり = 少し浮く) / 0.57〜0.78 落ちる(だんだん速く = ストン)
// 腰の高さ: しゃがんだ分だけ下げ(太もも・すねの長さから計算)、つま先立ちの分だけ上げる = 床についている足が浮かない/めり込まない
// ⚠️ポーズの切りかえの「なめらかに寄せる」をこのポーズでは途中から切る(sharp)。寄せると着地の直前で遅くなり、ストンと落ちなくなる
const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const CHEER = { T: 1.4, H: 0.15, thigh: 0.75, knee: 1.3, LT: 0.19, LS: 0.165, point: 0.4, toe: 0.077, armLag: 0.03,   // toe: つま先までの長さ(つま先立ちで足首が上がる分 = toe × sin(角度)。測った値)
  up: { sh: [0, 0, 0.28], ua: [-0.64, -0.38, 1.35], la: [0, -0.04, 0.15], hand: [-0.54, 0.54, -0.25] },   // 頂点: 腕をまっすぐ上へ、手のひらは正面(ひねりは計算で選んだ)
  low: { sh: [0, 0, 0.04], ua: [-0.65, -1.18, -0.2], la: [-1.84, -0.55, -0.05], hand: [-0.22, 0.17, -0.28] },   // ため: 肘を曲げて、手を顔の前(あごの前)へ。腕が短いのでここまで(頬の横より前へは届かない)
  arm(k, a) { const q = this._q ??= {}, e = this._e ??= new THREE.Euler(); if (!q[k]) { const Qe = (v) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...v)); q[k] = [Qe(this.low[k]), Qe(this.up[k]), new THREE.Quaternion()]; }
    const [lo, hi, m] = q[k]; m.slerpQuaternions(lo, hi, a); e.setFromQuaternion(m); return [e.x, e.y, e.z]; },   // 下ろした腕と上げた腕のあいだ(角度をそのまま混ぜると途中で腕が変に回るので、回転として混ぜる)
  at(t) { const u = ((t / this.T) % 1 + 1) % 1, LAND = 0.78, OFF = 0.26, UP = 0.34, TOP = 0.57;
    const d = (u - LAND + 1) % 1, sink = OFF + 1 - LAND;   // d: 着地してからの時間 / sink: 着地から伸び始めるまで
    const bend = d < sink ? 1 - (1 - d / sink) ** 2 : 1 - ss(OFF, UP, u);   // 着地〜ため: 受けて沈む / けり出し: 一気に伸びる
    const air = u >= UP && u < LAND, rise = u < TOP ? 1 - (1 - (u - UP) / (TOP - UP)) ** 2.6 : 1 - ((u - TOP) / (LAND - TOP)) ** 2.6;
    const pt = u >= LAND ? 1 - ss(LAND, LAND + 0.05, u) : ss(OFF + 0.02, UP + 0.02, u);   // つま先の向き: けり出しで下へ、着地したらかかとを下ろす
    const stretch = u >= LAND ? 1 - ss(LAND, LAND + 0.12, u) : ss(OFF + 0.02, UP + 0.04, u);
    const drop = this.LT * (1 - cos(this.thigh * bend)) + this.LS * (1 - cos((this.knee - this.thigh) * bend));
    const arms = d < sink ? 1 - bend : ss(OFF + this.armLag, UP + this.armLag + 0.03, u);   // 腕: 着地からは脚と一緒に下ろし、けり出しでは脚より少し遅れて上がる(同時だと速すぎた)
    return { bend, stretch, point: pt, arms, y: (air ? this.H * rise : 0) + this.toe * Math.sin(this.point * pt) - drop }; },
};
export const POSES = {
  "aPose": () => ({ b: {}, y: 0 }),
  "tPose": () => ({ b: { "shoulder.L": [0, 0, 0.15], "shoulder.R": [0, 0, -0.15], "upperArm.L": [0, 0, 0.65], "upperArm.R": [0, 0, -0.65] }, y: 0 }),   // arms straight out to the sides (the A-pose arm is about 46° down). The shoulders take a little of the lift (else the seam by the neck stretches into a step)
  "idle": (t) => ({ b: { ...ARMS_DOWN, chest: [sin(t * 1.6) * 0.02, 0, 0], head: [sin(t * 0.8) * 0.04, sin(t * 0.5) * 0.12, sin(t * 0.7) * 0.05] }, y: 0 }),
  "walk": (t) => { const ph = t * 6.2, s = sin(ph), kL = 0.12 + 0.75 * mx(0, sin(ph + 1.9)), kR = 0.12 + 0.75 * mx(0, sin(ph + 1.9 + Math.PI));
    return { b: { hips: [0, s * 0.12, 0], spine: [0.05, -s * 0.08, 0], head: [0.02, -s * 0.05, 0], "upperLeg.L": [-0.5 * s, 0, 0], "upperLeg.R": [0.5 * s, 0, 0], "lowerLeg.L": [kL, 0, 0], "lowerLeg.R": [kR, 0, 0], "foot.L": [-0.25 * s - kL * 0.3, 0, 0], "foot.R": [0.25 * s - kR * 0.3, 0, 0],
      "upperArm.L": [0.5 * s, 0, -0.36], "upperArm.R": [-0.5 * s, 0, 0.36], "lowerArm.L": [-0.25 + 0.22 * s, 0, -0.05], "lowerArm.R": [-0.25 - 0.22 * s, 0, 0.05] }, y: Math.abs(cos(ph)) * 0.02, air: 1 }; },   // 腕は体から少し離し、後ろへ振ったときは肘を伸ばす
  // 手をふる: 腕を上げて止め、肘から先を左右に振る(WAVE)。手のひらは正面の相手へ。手首は曲げない(振ると前腕とずれて見えた)
  "wave": (t) => ({ b: { "upperArm.L": [0.18, 0, -0.18], "lowerArm.L": [0, 0.4, -0.08], "shoulder.R": WAVE.sh, "upperArm.R": WAVE.ua, "lowerArm.R": WAVE.fore(WAVE.mid + sin(t * 8) * WAVE.amp), "hand.R": WAVE.hand, head: [0.04, -0.15, -0.14], chest: WAVE.chest }, y: 0 }),
  // ばんざいジャンプ: 腕を下ろしてしゃがみ(ため) → 跳ね上がって頂点で伸び切り、少し浮く → ストンと落ちてひざで受ける。手のひらは正面へ(CHEER)
  "cheer": (t) => { const J = CHEER.at(t), q = J.bend, e = J.stretch, a = J.arms, aL = (k) => CHEER.arm(k, a), aR = (k) => aL(k).map((v, i) => i ? -v : v);
    return { b: { "shoulder.L": aL("sh"), "shoulder.R": aR("sh"), "upperArm.L": aL("ua"), "upperArm.R": aR("ua"), "lowerArm.L": aL("la"), "lowerArm.R": aR("la"), "hand.L": aL("hand"), "hand.R": aR("hand"),
      "upperLeg.L": [-CHEER.thigh * q, 0, 0.08], "upperLeg.R": [-CHEER.thigh * q, 0, -0.08], "lowerLeg.L": [CHEER.knee * q, 0, 0], "lowerLeg.R": [CHEER.knee * q, 0, 0],
      "foot.L": [-(CHEER.knee - CHEER.thigh) * q + CHEER.point * J.point, 0, 0], "foot.R": [-(CHEER.knee - CHEER.thigh) * q + CHEER.point * J.point, 0, 0],   // しゃがむ間は足の裏を床に平らに。けり出し〜空中〜着地の瞬間はつま先が下を向く
      spine: [0.3 * q - 0.06 * e, 0, 0], head: [0.1 * q - 0.15 * e, 0, 0] }, grip: { L: 1 - a, R: 1 - a }, y: J.y, sharp: true }; },   // ためでは手をグーに、上げると開く
  "sitChair": (t) => ({ b: { "upperLeg.L": [-1.57, 0, 0.05], "upperLeg.R": [-1.57, 0, -0.05], "lowerLeg.L": [1.5 + sin(t * 2) * 0.15, 0, 0], "lowerLeg.R": [1.5 - sin(t * 2) * 0.15, 0, 0], "foot.L": [0.05, 0, 0], "foot.R": [0.05, 0, 0],
      // 腕は横へ下ろして、手は太ももの外・座面の少し上(腕が短いので座面までは届かない)
      "upperArm.L": [-0.1, 0, -0.36], "upperArm.R": [-0.1, 0, 0.36], "lowerArm.L": [0.1, 0, 0], "lowerArm.R": [0.1, 0, 0], spine: [0.05, 0, 0], head: [0.06, sin(t * 0.6) * 0.2, sin(t * 0.9) * 0.1] }, y: -0.118, chair: true, seat: 0.2, seatFront: 0.1 }),
  // いすに座る(内股): 膝をとじてつま先を内へ、すねは外へ開く。少し前かがみで、手は膝の上
  "sitChairGirl": (t) => ({ b: { "upperLeg.L": [-1.57, 0, -0.17], "upperLeg.R": [-1.57, 0, 0.17], "lowerLeg.L": [1.5, 0, 0.36], "lowerLeg.R": [1.5, 0, -0.36], "foot.L": [0.05 + sin(t * 1.4) * 0.08, -0.28, 0], "foot.R": [0.05 - sin(t * 1.4) * 0.08, 0.28, 0],
      // 肘は胴の外へ張り、手は手のひらを下にして膝に乗せる(指先は膝の前へ沿って下りる)
      spine: [0.15, 0, 0], "shoulder.L": [0, -0.15, -0.05], "shoulder.R": [0, 0.15, 0.05],
      "upperArm.L": [0, -0.55, -0.15], "upperArm.R": [0, 0.55, 0.15], "lowerArm.L": [-1.18, 0, -0.77], "lowerArm.R": [-1.18, 0, 0.77], "hand.L": [0.65, -0.8, 0], "hand.R": [0.65, 0.8, 0],
      head: [-0.065, sin(t * 0.5) * 0.12, 0.08 + sin(t * 0.7) * 0.04] }, y: -0.118, chair: true, seat: 0.2, seatFront: 0.1 }),
  "sitFloor": (t) => ({ b: { "upperLeg.L": [-1.5, 0, 0.14], "upperLeg.R": [-1.5, 0, -0.14], "lowerLeg.L": [0.05, 0, 0], "lowerLeg.R": [0.05, 0, 0], "foot.L": [0.25 + sin(t * 3) * 0.2, 0, 0], "foot.R": [0.25 - sin(t * 3) * 0.2, 0, 0],
      // 手は腰の少しうしろ横で床につく(肩を少し落とし、手首を外へ折って指先を床へ)
      "shoulder.L": [0, 0, -0.31], "shoulder.R": [0, 0, 0.31], "upperArm.L": [0.41, 0, -0.19], "upperArm.R": [0.41, 0, 0.19], "lowerArm.L": [0, 0, 0], "lowerArm.R": [0, 0, 0], "hand.L": [-0.2, 0, 0.7], "hand.R": [-0.2, 0, -0.7],
      spine: [-0.18, 0, 0], chest: [-0.05, 0, 0], head: [0.18, 0, sin(t * 0.8) * 0.12] }, y: -0.355 }),
  // 構え(盾と武器): 左足を前に少し腰を落とし、盾の腕を前に上げて(前腕を横にして盾を正面へ)、右手の武器は肩の上に振りかぶる
  "guard": (t) => { const br = sin(t * 2.2) * 0.02;
    return { b: { spine: [0.06 + br * 0.5, 0, 0], chest: [0.02, 0, 0], head: [-0.04, 0, 0],
      "upperLeg.L": [-0.35, 0, 0.1], "lowerLeg.L": [0.4, 0, 0], "foot.L": [-0.05, 0, 0], "upperLeg.R": [0.22, 0, -0.1], "lowerLeg.R": [0.32, 0, 0], "foot.R": [-0.5, 0, 0],
      // 腕の角度は、ねらった向き(上腕・前腕の方向と手の甲の向き)から解いた値。上腕のひねりは、肩とひじの回る量がいちばん小さくなるように選ぶ(大きく回すと、構えに入るときに腕が後ろへ回り込む)(盾の腕: 肘は下・少し外、前腕を立てて手の甲=盾を正面へ。盾の上は手首の側 / 武器の腕: 肘は肩より下で外・前へ、前腕を前へ出して、刃は内側(頭の方)へ少し倒して立てる(肘を上げすぎると肩がつぶれた)。手首はまっすぐ: 柄は前腕と直角に拳を抜ける)
      "shoulder.L": [0, -0.25, 0], "upperArm.L": [-1.617, 0.734, -0.057], "lowerArm.L": [-0.368, 0.379, -1.77],
      "upperArm.R": [-0.955, 0.123, -0.03], "lowerArm.R": [-0.633, -0.005, 1.029] }, y: -0.03 + br * 0.3 }; },
  "hugKnees": (t) => ({ b: { "upperLeg.L": [-2.35, 0, 0.1], "upperLeg.R": [-2.35, 0, -0.1], "lowerLeg.L": [2.45, 0, 0], "lowerLeg.R": [2.45, 0, 0], "foot.L": [-0.1, 0, 0], "foot.R": [-0.1, 0, 0],
      "upperArm.L": [-1.25, 0, -0.25], "upperArm.R": [-1.25, 0, 0.25], "lowerArm.L": [0, 0, -1.25], "lowerArm.R": [0, 0, 1.25],
      // 丸まった背中: 背中の3か所を少しずつ曲げ、肩を前へ巻く。顔は起こして前を見る
      spine: [0.2, 0, 0], chest: [0.2, 0, 0], upperChest: [0.25, 0, 0], "shoulder.L": [0, -0.3, -0.06], "shoulder.R": [0, 0.3, 0.06], neck: [0.04, 0, 0], head: [-0.22 + sin(t * 1.2) * 0.04, 0, 0.12] }, y: -0.31 }),
};

// Holding a weapon in the right hand (outfit.weapon.right), standing and walking change that arm (the elbow kept out from the side, not into it):
//   spear / staff: the elbow bent, the forearm forward, the back of the hand out and the thumb up — the grip (across the fist) then stands
//     nearly upright, with the wrist straight. sword / axe: the arm hangs loose, the blade pointing forward and a little down (the wrist
//     turned in some ~35°: a straight wrist would hold the blade level, stiffly). Solved from those directions; walking swings it a little.
const ARMED = { idle: true, walk: true };
const ARMED_R = {
  upright: { "upperArm.R": [-0.111, -0.041, 0.191], "lowerArm.R": [-1.215, 0.131, 0.749] },
  hang: { "upperArm.R": [-0.013, 0.02, 0.304], "lowerArm.R": [-0.137, -0.068, 0.371], "hand.R": [0.407, -0.365, 0.41] },
  // a greatsword held low in front in both hands, the blade forward and down (solved as motion/combat.js; 2026-10-07, Saori: carried on the
  // shoulder it went into the elbow, with the right hand alone and the blade pointing back: "肩に担ぐなら、鞘をつけないと厳しい")
  low2: { "upperArm.L": [-0.372, -0.141, -0.759], "lowerArm.L": [-0.347, -0.116, -0.961], "hand.L": [-0.434, 1.128, 0.166], "upperArm.R": [-0.762, 0.257, 0.753], "lowerArm.R": [-0.037, 0.033, 0.072], "hand.R": [1.137, -0.814, 0.598] },
};
const ARMED_OF = { spear: "upright", staff: "upright", sword: "hang", axe: "hang", greatsword: "low2" };
const TWO_HANDS = { spear: true, greatsword: true };   // their guard and attack hold them in both hands (motion/combat.js: guard_<weapon>, attack_<weapon>)
const armedArm = (P0, A) => ({ ...A, "upperArm.R": [A["upperArm.R"][0] + 0.35 * (P0.b["upperArm.R"]?.[0] ?? 0), A["upperArm.R"][1], A["upperArm.R"][2]] });

// The guard's arms depend on what each hand holds (the pose itself has the sword's and the straight shield's): a spear is held low at
// the side, the head forward and a little up (ready to thrust); a staff is raised in front, slanting up and forward. A diagonal shield
// (shieldMount) raises the forearm slantwise across the front, so the shield stands upright. With a shield, the shoulder rolls forward and
// the elbow comes up in front (the arms are short: else the shield sat against the chin, and a big helm stuck out in front of it). Empty hands (or fists) take a fighter's
// guard: the lead (left) fist out in front at chin height, the rear (right) fist by the chin, both elbows down. Solved like the rest.
const GUARD_R = {
  spear: { "upperArm.R": [0.385,  -0.208,  0.407], "lowerArm.R": [-0.985,  0.347,  1.208] },
  staff: { "upperArm.R": [-0.972, 0.27, 0.444], "lowerArm.R": [-0.279, -0.316, 0.878] },
  bare: { "upperArm.R": [-0.896, 0.131, 0.461], "lowerArm.R": [-1.508, 0.312, 0.927] },
};
const GUARD_L = {
  diagonal: { "shoulder.L": [0, -0.25, 0], "upperArm.L": [-1.575, 0.55, -0.265], "lowerArm.L": [0.043, 0.23, -1.976] },
  bare: { "shoulder.L": [0, 0, 0], "upperArm.L": [-1.104, -0.186, -0.562], "lowerArm.L": [-1.091, -0.307, -0.612] },
};
const BARE = { none: true, fist: true };

// グー(grip): 指の付け根と中ほどを手のひらの側へ曲げ、親指を指の前へたたむ。回す軸は手の向き(HANDS: D=指 N=手のひら S=親指の側。体から)から作る
//   (骨は休みの姿勢で回っていないので、休みの向きの軸で回せばそのまま骨の回転になる)
const GRIP = { fingers: 1.6, fingerTips: 0.95, thumb: [1.1, 0.5] };   // 曲げる角度(ラジアン)。親指: 手のひらの側へ / 指の側へ
function gripHand(H) {
  const v = (a) => new THREE.Vector3(...a), D = v(H.D), N = v(H.N), S = v(H.S);
  const curl = new THREE.Vector3().crossVectors(D, N).normalize(), fold = new THREE.Vector3().crossVectors(S, N).normalize(), lean = new THREE.Vector3().crossVectors(S, D).normalize();   // curl: 指を手のひらへ / fold: 親指を手のひらへ / lean: 親指を指の側へ
  const Qa = (ax, a) => new THREE.Quaternion().setFromAxisAngle(ax, a);
  const full = { fingers: Qa(curl, GRIP.fingers), fingerTips: Qa(curl, GRIP.fingerTips), thumb: Qa(fold, GRIP.thumb[0]).multiply(Qa(lean, GRIP.thumb[1])) };
  const q = new THREE.Quaternion(), e = new THREE.Euler(), I = new THREE.Quaternion();
  return (k, g) => { q.slerpQuaternions(I, full[k], g); e.setFromQuaternion(q); return [e.x, e.y, e.z]; };
}

/** Blend the bones toward a pose each frame (smoothly; instant = jump straight to it). weapon / left: what each hand holds ("none", "sword", ..., "fist"), shieldMount: "straight" | "diagonal"
 *  yK: the legs' length against the base proportions (body.proportion): a pose's hip lift (crouching, sitting) scales with it */
export function createPosePlayer({ bone, BONES, HIPS0, HANDS = null, weapon = "none", left = "none", shieldMount = "diagonal", yK = 1, footTilt = () => 0, lift = () => 0, skirtFlare = 0, held = () => null }) {   // footTilt / lift: high heels (feet tilted toes-down, the body raised). held: { L, R } fists for what avatar.hold put in a hand
  const armed = ARMED_R[ARMED_OF[weapon]], shield = left === "shield" || left === "round";
  const guardR = BARE[weapon] ? GUARD_R.bare : GUARD_R[weapon], guardL = BARE[left] ? GUARD_L.bare : shield && shieldMount === "diagonal" ? GUARD_L.diagonal : null, fighter = BARE[weapon] && BARE[left];
  const qT = new THREE.Quaternion(), eT = new THREE.Euler(), qI = new THREE.Quaternion(), vD = new THREE.Vector3();
  const FLARE = Math.atan(skirtFlare);   // the skirt's own slant out from the body at the front (an A-line: flare × 0.8 front to back, clothes): a thigh swinging less than that doesn't reach its front
  // a shield is strapped to the forearm (clothes/weapons.js): its hand is open, and grips only in the guard (2026-10-07, Saori)
  const HOLD = { L: left !== "none" && !shield, R: weapon !== "none" }, GRIPS = HANDS && bone["fingers.L"] ? { L: gripHand(HANDS.L), R: gripHand(HANDS.R) } : null;   // HOLD: 何か持っている手(形がもうグー)
  let cur = null, heldT = 0;   // いまのポーズと、それに切りかえてからの時間
  // blend: seconds the switch to a pose eases over (about; the default ~0.35 s), 0 = the pose at once (2026-10-06: a tennis swing started
  //   0.35 s late, softened, when its pose was switched to)
  return function apply(name, t, dt, instant = false, yAdd = 0, blend = null) {   // yAdd: extra hip height (the seat fit in index.js)
    if (name !== cur) { cur = name; heldT = 0; } else heldT += dt;
    let P0 = POSES[name](t); if (yK !== 1 && P0.y) P0 = { ...P0, y: P0.y * yK };
    const k = instant || blend === 0 || (P0.sharp && heldT > (blend ?? 0.35)) ? 1 : 1 - Math.exp(-dt * (blend ? 3 / blend : 9));   // sharp: 切りかえてしばらくしたら、寄せずにそのまま当てる(速い動きが鈍らない)
    if (armed && ARMED[name]) P0 = ARMED_OF[weapon] === "low2" ? { ...P0, b: { ...P0.b, ...armed }, grip: { ...P0.grip, L: 1 } } : { ...P0, b: { ...P0.b, ...armedArm(P0, armed) } };   // (both hands: no arm swing, the left closed on the grip)
    if (name === "guard" && TWO_HANDS[weapon]) P0 = POSES[`guard_${weapon}`](t);   // two hands on it (the spear held low in one hand ran through the leg)
    else if (name === "attack") { const kind = BARE[weapon] ? "punch" : weapon, A = POSES[`attack_${kind}`] ?? POSES.attack_punch; P0 = A(t);   // the swing for what the right hand holds
      if (!TWO_HANDS[weapon]) P0 = { ...P0, b: { ...P0.b, ...(guardL ?? GUARD_L.bare) }, grip: { ...P0.grip, L: 1 } }; }   // the left keeps its guard (a shield up, or a fist)
    else if (name === "guard") { const b = { ...P0.b, ...guardR, ...guardL };
      if (fighter) { b.spine = [b.spine[0], -0.3, 0]; b.head = [b.head[0], 0.3, 0]; }   // bare-handed: the lead (left) shoulder turned forward, the face kept to the front
      P0 = { ...P0, b, ...(shield ? { grip: { ...P0.grip, L: 1 } } : {}) }; }
    const hg = held(), grip = hg ? { L: Math.max(P0.grip?.L ?? 0, hg.L ?? 0), R: Math.max(P0.grip?.R ?? 0, hg.R ?? 0) } : P0.grip;
    if (grip && GRIPS) { const b = { ...P0.b }; for (const s of ["L", "R"]) { const g = grip[s] ?? 0; if (g > 0 && !HOLD[s]) for (const k of ["fingers", "fingerTips", "thumb"]) b[`${k}.${s}`] = GRIPS[s](k, g); } P0 = { ...P0, b }; }
    const ft = footTilt();
    for (const b of BONES) { const r = P0.b[b] || [0, 0, 0]; eT.set(r[0] + (ft && (b === "foot.L" || b === "foot.R") ? ft : 0), r[1], r[2]); qT.setFromEuler(eT); bone[b].quaternion.slerp(qT, k); }
    bone.hips.position.y += (HIPS0.y + (P0.y || 0) + yAdd + lift() - bone.hips.position.y) * k;
    // the skirt's front bones turn with the thighs (about a point at the front of the waist), less the skirt's own slant: the front already
    // stands that far out, and turned the whole way with a thigh raised (sitting) its flare pointed up, the hem lifted over the lap
    // (2026-10-05, Saori: "座った時前が捲れ上がる")
    for (const s of ["L", "R"]) if (bone[`skirt.${s}`]) { const q = bone[`upperLeg.${s}`].quaternion, d = vD.set(0, -1, 0).applyQuaternion(q), a = Math.acos(Math.max(-1, Math.min(1, -d.y)));
      bone[`skirt.${s}`].quaternion.copy(qI).slerp(q, a > FLARE ? 1 - FLARE / a : 0); }
    return P0;
  };
}
