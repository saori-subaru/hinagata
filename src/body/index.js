// The body: joints (bones) and the signed-distance parts that make the naked body, head and face sculpt.
import { handFrame } from "../clothes/weapons.js";
import { smin, E, axes, cut, G, C, dPrim, blend, blendFast, plane, sstep, thicken } from "../sdf/prim.js";
const HEAD_SCALE0 = 0.9;   // the head size the neck width is set for (neck.follow): the chibi's, the default until 2026-10-06 (not DEFAULTS' now: every neck would change)
const ARM0 = { "upperArm.L": [0.115, 0.732, 0], "lowerArm.L": [0.232, 0.612, 0.005], "hand.L": [0.322, 0.52, 0.01] };   // the base arm (left), as built at the base proportions

/**
 * The left arm's joints (base proportions) for body.proportion.shoulders and .arms (2026-10-06, the 5-head tall body; Saori: "頭でかすぎて
 * バランス悪い", the arms to reach the thighs):
 * shoulders (×): the shoulder joint further out (the arm with it); the shoulder's flesh, the slope from the neck and the chest widen with it.
 * arms (×, null = none): arms of their own length (× the base arm's), which the torso's stretch then leaves as they are: they ride on the
 * shoulder (makeStretch's rigid arms) instead of being stretched upright with the torso, so the hands keep their shape and can reach below
 * the hip joint (there the legs' stretch would pull a hand long). Laid out the way the stretch would have turned them (steeper by the torso's
 * factor), so a pose turns them where it turns a stretched arm. null (the chibi types) = the arms stretch with the torso, as before.
 */
export function armJoints(OPT) {
  const PR = OPT.body.proportion ?? {}, A = PR.arms ?? null, SHW = 0.115 * ((PR.shoulders ?? 1) - 1), out = {};
  for (const [k, v] of Object.entries(ARM0)) out[k] = [v[0] + SHW, v[1], v[2]];
  // adult: the arm laid out only part of the way steeper (adult.armSteep of the torso's factor): at torso 2 the whole way hung the hand
  // straight down into the adult body's wider hips, and they melted into one surface there (the hip's skin went with the arm: 2026-10-08,
  // Saori: "腰の両端が上に引っ張られてない？")
  if (A != null) { const sT = OPT.body.adult?.on ? 1 + ((PR.torso ?? 1) - 1) * (OPT.body.adult.armSteep ?? 0.5) : PR.torso ?? 1, ua = out["upperArm.L"];
    const seg = (a, b) => { const d = [b[0] - a[0], (b[1] - a[1]) * sT, b[2] - a[2]], k = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * A / Math.hypot(...d); return d.map((v) => v * k); };
    const d1 = seg(ARM0["upperArm.L"], ARM0["lowerArm.L"]), d2 = seg(ARM0["lowerArm.L"], ARM0["hand.L"]);
    out["lowerArm.L"] = ua.map((v, i) => v + d1[i]); out["hand.L"] = out["lowerArm.L"].map((v, i) => v + d2[i]); }
  return out;
}
/** How much further the hands reach than the base arm's (body.proportion: shoulders, arms, hands), in base space: { x: out to the side,
 *  y: down }. The boxes the body and the clothes around the arms are meshed in (parts.js, clothes) grow by it. */
export function armReach(OPT) {
  const PR = OPT.body.proportion ?? {}, h = armJoints(OPT)["hand.L"], K = PR.hands ?? 1, tip = 0.115 * K;   // the fingertips: about 11.5 cm from the wrist along the hand
  return { x: Math.max(0, h[0] - ARM0["hand.L"][0] + 0.876 * (tip - 0.115)), y: Math.max(0, ARM0["hand.L"][1] - h[1] + 0.483 * (tip - 0.115) + (PR.arms != null ? 0.06 : 0)) };   // (a rigid hand turns down with its steeper forearm: a margin)
}

/**
 * The clothes' heights on the adult body (body.adult; 2026-10-08, Saori, the 6-head body dressed: bare skin between the shirt and the pants,
 * the hands inside the shirt, a dress's skirt starting at the bottom). The outfit's heights (pants.top, a dress's waist, hems, socks.top) are
 * in base terms, made for the chibi torso and legs: there they are read as places between the base body's ankle (0.085), knee (0.25), hip
 * joint (0.44) and shoulder (0.732) and put at the same places between the adult body's, after the stretch, then read back. Returns
 * { pantsTop, pantsHem, shirtHem, dressWaist, dressHem, skirtHem, socksTop } (base heights; a value left out keeps its own), or null. (The cape not yet.)
 * The user's options are left as they are (avatar.options): these go to OPT.fit.
 */
export function adultFit(OPT) {
  const AD = OPT.body.adult; if (!AD?.on) return null;
  const HIP_Y = OPT.body.joints.hipY ?? 0.4, A = armJoints(OPT)["upperArm.L"][1];
  const J = { "upperLeg.L": [0, HIP_Y, 0], neck: [0, 0.74, 0], chest: [0, 0.62, 0], "upperArm.L": [0, A, 0], "lowerLeg.L": [0, 0.25, 0], "foot.L": [0, 0.085, 0] };
  const S = makeStretch(OPT, J), yA = S.fwd(0.085), yH = S.fwd(HIP_Y), yS = S.bone("upperArm.L", A), yK = yA + (AD.knee ?? 0.53) * (yH - yA);
  const R = [[0.085, yA], [0.25, yK], [0.44, yH], [0.732, yS]];
  const map = (c) => { if (c == null || c <= R[0][0] || c >= R[3][0]) return c; let i = 0; while (c > R[i + 1][0]) i++; const t = (c - R[i][0]) / (R[i + 1][0] - R[i][0]); return S.inv(R[i][1] + t * (R[i + 1][1] - R[i][1])); };
  const O = OPT.outfit, LEN = O.shirt?.length ?? "tuck", PL = O.pants?.length ?? "shorts";
  // a tucked shirt goes 3 cm (base; 6 at torso 2) into the pants: at its place it went in 1.7 and the two surfaces crossed in a jagged line
  const pantsTop = map(O.pants.top), shirtHem = LEN === "tuck" ? Math.min(map(0.455), pantsTop - 0.03) : map({ out: 0.44, crop: 0.6 }[LEN] ?? 0.455);
  return { pantsTop, pantsHem: map({ knee: 0.2, long: 0.1 }[PL] ?? O.pants.hem), shirtHem,
    dressWaist: map(O.dress?.waist), dressHem: map(O.dress?.hem), skirtHem: map(O.pants.skirt?.hem ?? 0.3), socksTop: map(O.socks?.top) };
}
/** High heels worn: the bare foot isn't bent or narrowed for them when the shoes are off (2026-10-08, Saori, the shoes taken off a character
 *  made with heels: "つま先がうえにかたむいて浮いてる", the toes narrowed out of sight) */
export const heelsWorn = (OPT) => OPT.outfit?.shoes?.kind === "heels" && OPT.outfit.shoes.on !== false;
/** High heels (shoes.kind "heels"): the foot is tilted toes-down by heelAngle about the ankle, the ball of the foot on the floor (heelPose,
 *  clothes/index.js). In front of the ball the foot went under the floor (the toes about 2 cm; 2026-10-07, Saori: "ヒールが地面に埋まっている").
 *  So in the shape the forefoot is bent up at the ball by the same angle, as a foot in a heel is: tilted, it lies flat on the floor. The body
 *  and the shoes are both read through it: (x, y, z) → the y to read their shape at. null without heels. */
export function heelBend(OPT) {
  if (!heelsWorn(OPT)) return null;
  const t = Math.tan((OPT.outfit.shoes.heelAngle ?? 24) * Math.PI / 180), ball = 0.06 * (OPT.body.proportion?.feet ?? 1);
  return (x, y, z) => y - Math.max(0, z - ball) * t * (1 - sstep(0.08, 0.13, y));   // (the ball: z 0.06 × the feet's size; only the foot, not the shin above it)
}

/**
 * Build the body from options.
 * slow: use the plain (unculled) blend, for checking. oldSock: the older eye-socket shape, for comparison.
 * Returns joints, bone names, parts, and the body's signed distance function.
 */
export function buildBody(OPT, { slow = false, oldSock = false } = {}) {
  // 関節(骨のつけ根)。寸法は見本から
  const FOOT_X = OPT.body.joints.footX;   // 足首の横位置(小さいほど内側に着く。がに股に見えないように)
  const KNEE_X = OPT.body.joints.kneeX;   // 膝の横位置(足首を内側に寄せたのに合わせる)
  // 脚の付け根(股関節)の高さ。上げると脚が長く胴が短くなり、股下・骨盤の底・太ももの付け根の肉が一緒に上がる(2026-10-02 サオリ「股下が低すぎて胴が長い」)。
  // ⚠️前は股のあいだの溝(CROTCH)だけを上げていたので、骨盤の底とお尻が股より下に垂れたままで見た目の股下が上がらなかった。HL = 0.40 からの上げ幅
  const HIP_Y = OPT.body.joints.hipY ?? 0.4, HL = HIP_Y - 0.4;
  // hipX: the hip joints' distance from the middle (2026-10-07, Saori, with a Genshin model beside ours: the legs stood apart at the hips' width
  // and went straight down, so the tops of the thighs stuck out square however narrow the hips; theirs meet at the top and close in to the knees).
  // legDX(y): how far the leg's line is moved from the default one (0.11 at the hip to 0.108 at the knee) at height y, for the thigh's own pieces
  const HX = OPT.body.joints.hipX ?? 0.11, legX = (hx, kx, y) => hx + (kx - hx) * Math.min(1, Math.max(0, (HIP_Y - y) / (HIP_Y - 0.25))), legDX = (y) => legX(HX, KNEE_X, y) - legX(0.11, 0.108, y);
  const J = {
    hips: [0, 0.42 + HL * 0.5, 0], spine: [0, 0.5, 0.01], chest: [0, 0.62, 0], upperChest: [0, 0.68, -0.005], neck: [0, 0.74, -0.005], head: [0, 0.82, 0],
    "shoulder.L": [0.03, 0.732, -0.005], "upperArm.L": [0.115, 0.732, 0], "lowerArm.L": [0.232, 0.612, 0.005], "hand.L": [0.322, 0.52, 0.01],
    "upperLeg.L": [HX, HIP_Y, 0], "lowerLeg.L": [KNEE_X, 0.25, OPT.body.adult?.on ? (OPT.body.adult.kneeZ ?? -0.006) : -0.006],   // (adult.kneeZ: the knee further back or forward; under it the leg leans back by itself: makeStretch shz)
    "foot.L": [FOOT_X, 0.085, -0.005],
  };
  // body.proportion: the shoulders and arms (armJoints above; SHW: how much further out the shoulder joint is), hands: their size (× around the wrist)
  const HK = OPT.body.proportion?.hands ?? 1, SHW = 0.115 * ((OPT.body.proportion?.shoulders ?? 1) - 1);
  Object.assign(J, armJoints(OPT));
  // neck.length: a longer neck lifts the head (its bone and everything built in head space: the head, the face, the hair; headTransform's lift)
  // jawLength (> 1): the face under the mouth comes down (headTransform); the head goes up by as much as the chin does, so the neck stays as long
  const JL = OPT.body.head.jawLength ?? 1, JAW_Y = (OPT.face?.layout?.mouthY ?? 0.896) - 0.016, JAW_LIFT = JL > 1 ? (JAW_Y - OPT.body.sculpt.chin.y) * (JL - 1) * OPT.body.head.scale : 0;
  const NK = OPT.body.sculpt.neck, LIFT = (NK.length ?? 0) + JAW_LIFT; J.head[1] += LIFT;
  for (const k of Object.keys(J)) if (k.endsWith(".L")) { const v = J[k]; J[k.replace(".L", ".R")] = [-v[0], v[1], v[2]]; }
  // adult: the knee at adult.knee of the way from the ankle up to the hip joint, after the stretch (2026-10-08, beside Saori's VRoid body: its
  // knee 53 % up, ours 39 %: the thighs long, the shins short)
  if (OPT.body.adult?.on) { const S0 = makeStretch(OPT, J), yA = S0.fwd(J["foot.L"][1]), yHf = S0.fwd(J["upperLeg.L"][1]);
    J["lowerLeg.L"][1] = J["lowerLeg.R"][1] = S0.inv(yA + (OPT.body.adult.knee ?? 0.53) * (yHf - yA)); }
  // 背中は3か所で曲がる(spine 0.50 / chest 0.62 / upperChest 0.68)=丸まった背中が段にならず曲線になる。
  // 肩の骨(鎖骨)は首の付け根から肩の関節まで、肩の高さで水平にのびる=両肩は肩の高さで回る(2026-10-02 サオリ。旧=upperChestを肩の高さ0.732に置いていた)
  const PARENT = { hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck" };
  for (const s of ["L", "R"]) Object.assign(PARENT, { [`shoulder.${s}`]: "upperChest", [`upperArm.${s}`]: `shoulder.${s}`, [`lowerArm.${s}`]: `upperArm.${s}`, [`hand.${s}`]: `lowerArm.${s}`, [`upperLeg.${s}`]: "hips", [`lowerLeg.${s}`]: `upperLeg.${s}`, [`foot.${s}`]: `lowerLeg.${s}` });
  // スカートの前の骨(左右): ウエストの前、太ももの上の高さで回る。太ももの回転を写す(motion)=座ると前の布が太ももの上へ倒れる(股関節で回すと前の裾がお腹へはね上がる)
  for (const s of ["L", "R"]) { J[`skirt.${s}`] = [(s === "L" ? 1 : -1) * 0.08, HIP_Y + 0.08, 0.09]; PARENT[`skirt.${s}`] = "hips"; }
  // 指の骨(左右に3本): 4本の指の付け根(fingers)・指の中ほど(fingerTips)・親指の付け根(thumb)。ポーズで指を曲げてグーにする(motion の grip)
  //   指4本は1本の骨でまとめて曲げる(1本ずつは動かさない)。手の向き(D=指の向き N=手のひら S=親指の側)は weapons.js の handFrame と同じ
  const HANDS = {};
  for (const s of ["L", "R"]) { const H = handFrame(J, s, HK), at = (o, ...t) => o.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0)); HANDS[s] = { D: H.D, N: H.N, S: H.S, G: H.G };   // G: the middle of the fist (where a held thing's grip goes: avatar.hold)
    J[`fingers.${s}`] = at(H.palm, [H.D, 0.022 * HK]); J[`fingerTips.${s}`] = at(H.palm, [H.D, 0.042 * HK], [H.N, 0.003 * HK]); J[`thumb.${s}`] = at(H.palm, [H.S, 0.04 * HK], [H.D, -0.008 * HK], [H.N, 0.006 * HK]);
    Object.assign(PARENT, { [`fingers.${s}`]: `hand.${s}`, [`fingerTips.${s}`]: `fingers.${s}`, [`thumb.${s}`]: `hand.${s}` }); }
  const BONES = Object.keys(PARENT);
  const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

  // 体の部品(見本の正面・横のシルエットに合わせた)
  const FOOT_H = OPT.body.sculpt.foot.thickness;   // 足の厚み(平たく)
  const SHOULDER_DROP = OPT.body.sculpt.shoulders.drop;   // 肩の頂点を下げる量(なで肩に)
  const P = {}, CUT = {}, EARS = [], FOOT_CUT = [];   // FOOT_CUT: the foot's front top shaved down to the toes
  FOOT_CUT.push(plane((x, y) => y > 0.06 ? 1 : y + 0.003, 0.006));   // FOOT_FLAT: the soles cut level with the floor (the feet's parts reach under it), so they stand flat (2026-10-07, Saori)
  const FACE_DY = -0.015;   // 顔の絵と眼窩をまとめて上下にずらす量
  const SOCKET_OUT = 0.065;
  // the eye sockets and the sculpt around the eyes follow the eye position of the face picture (defaults: eyeX 0.112, eyeY 0.998)
  const EX = OPT.face.layout.eyeX - 0.112, EY = OPT.face.layout.eyeY - 0.998;
  const TEMPLE_Z0 = OPT.body.sculpt.temple.minZ;   // これより後ろ(顔の横)は前へ出さない
  const TEMPLE = { d: OPT.body.sculpt.temple.depth, x: OPT.body.sculpt.temple.x + EX, y: OPT.body.sculpt.temple.y + EY, w: 0.06, h: OPT.body.sculpt.temple.height };   // 目じりの横を前へ出す量 / 中心の横位置 / 横・縦の広がり
  const SIDE_TRIM = { d: OPT.body.sculpt.cheekTrim.depth, x: OPT.body.sculpt.cheekTrim.x, y: OPT.body.sculpt.cheekTrim.y, w: OPT.body.sculpt.cheekTrim.width, h: OPT.body.sculpt.cheekTrim.height };   // ほおの横を抑える量 / 位置 / 広がり
  const CHEEK_FILL = { d: OPT.body.sculpt.cheekFill.depth, x: OPT.body.sculpt.cheekFill.x + EX, y: OPT.body.sculpt.cheekFill.y + EY, w: OPT.body.sculpt.cheekFill.width, h: OPT.body.sculpt.cheekFill.height };   // 目の下のほおを足す量 / 位置 / 広がり
  const EYE_UNDER = { d: OPT.body.sculpt.underEye.depth, x: OPT.body.sculpt.underEye.x + EX, y: OPT.body.sculpt.underEye.y, wi: OPT.body.sculpt.underEye.widthInner, wo: OPT.body.sculpt.underEye.widthOuter, h: OPT.body.sculpt.underEye.height };   // 目の下半分のうしろだけを沈める(眼窩の外側は触らない): 量 / 中心 / 目頭側・目じり側の広がり / 上下の広がり
  const SOCK_IN = { d: OPT.body.sculpt.socketInner.depth, x: OPT.body.sculpt.socketInner.x + EX, w: OPT.body.sculpt.socketInner.width, h: 0.065 };   // 眼窩の目頭側を引っこめる量 / 位置 / 広がり
  const SOCK_BAND = { on: !oldSock, len: OPT.body.sculpt.socketBand.length, lift: OPT.body.sculpt.socketBand.lift };   // 眼窩の目じり側: 届く長さ / 外側を浅くする(前へ出す)割合
  const SOCKET_LOW = { d: OPT.body.sculpt.socketLow.depth, y: OPT.body.sculpt.socketLow.y ?? 0.035, w: OPT.body.sculpt.socketLow.width ?? 0.085, h: OPT.body.sculpt.socketLow.height ?? 0.06, hu: OPT.body.sculpt.socketLow.heightUp };   // 上側は広くゆっくり消す(段が出ないように)   // 眼窩の下側を沈める量 / 中心の下がり / 横・縦の広がり   // 眼窩の外側(こめかみ側)への広がり
  const EAR = { flare: 0.7, tilt: 0.3, x: OPT.body.sculpt.ears.x ?? 0.24 * OPT.body.sculpt.skull.width / 0.249, y: OPT.body.sculpt.ears.y, lean: 0.6 };   // 耳: 後ろの縁の開き / 上ほど外へ倒す量 / 位置
  // neck.follow: the neck gets thinner with a smaller head (and thicker with a bigger one), relative to the default head size (2026-10-05, Saori:
  // "頭を小さくすると首が太く見える"); 0 = the same width whatever the head
  const NW = NK.width * Math.pow(OPT.body.head.scale / HEAD_SCALE0, NK.follow ?? 0);
  // (adult: blended narrowly, so it stands straight up from the shoulders: with 4 cm it flared into them, narrower at the top; 2026-10-09,
  // Saori: "首が上すぼまりになってるから垂直にしたい")
  P.neck = C([0, 0.725, -0.032], [0, 0.845 + LIFT, 0.006], 0.057 * NW, 0.056 * NW, "neck", OPT.body.adult?.on ? 0.015 : 0.04);   // 首: 太さの変わらない柱を、上が前へ来るように少し倒す
  // the back of the neck reaching up to the base of the skull (which ends level at chin.napeY behind the ear, as a real skull's does): only
  // the back, so the throat and where it meets the jaw stay as they were (lengthening the whole neck filled the corner under the jaw)
  { const NN = NK.nape; if (NN?.on) P.nape = C([0, NN.y0, NN.z0], [0, NN.y1 + LIFT, NN.z1], NN.r * NW, NN.r * NW, "neck", NN.k); }
  P.trap = E([0, 0.77, -0.016 + 0.03 * (1 - (OPT.body.torso.back ?? 1))], [0.12 + SHW, 0.03, 0.056 - 0.03 * (1 - (OPT.body.torso.back ?? 1))], "upperChest", 0.035);
  // adult: the slope from the neck to the shoulders starts lower and lies flatter, so the neck stands straight down to it instead of widening
  // into a mound from high up (2026-10-09, Saori: "首が上すぼまり … 垂直にしたい", seen from the front)
  if (OPT.body.adult?.on) { P.trap.cy -= 0.022; P.trap.by0 = P.trap.cy; P.trap.ry = 0.022; P.trap.k = 0.02; }   // 首の根元から肩へ: 高めの位置から肩へつなぐ(首は台形に広げない)
  // torso shape (1 = the toddler body of the reference sheet): chest size, belly size (shrinks toward the back, the back line stays), waist pinch depth, hip width
  const TO = OPT.body.torso;
  const BD = 0.06 * (1 - (TO.back ?? 1));   // back < 1: a thinner back (the front stays; the back comes forward by BD)
  P.chest = E([0, 0.68, 0.015 + BD / 2], [0.13 * TO.chest + 0.6 * SHW, 0.1, 0.1 * TO.chest - BD / 2], "chest", 0.05);       // 胸は細め(脇の下を高くする)
  // body.adult (on: a grown-up torso; 2026-10-08, Saori, after a 6-head picture and its three views: "横から見ると凄い太って見える"). The
  // torso above was the toddler's, stretched upright: stretching left its depth (deeper than wide at the belly and hips) and smeared what is
  // placed on it (raising the hips put the torso's whole stretch into 6 cm of belly, 3.25×: no waist, a △). Here the chest, waist, pelvis
  // and bottom are laid out where they come out, after the stretch (AD.*: m, after it), from the shoulder joint (yS) and the hip joint (yH)
  // by the torso's length T between them, and read back through the stretch (fin). The neck, shoulders, arms and legs are as before.
  const AD = OPT.body.adult?.on ? { chest: {}, waist: {}, hips: {}, butt: {}, k: 0.05, ...OPT.body.adult } : null, STA = AD ? makeStretch(OPT, J) : null;
  const yS = AD ? STA.bone("upperArm.L", J["upperArm.L"][1]) : 0, yH = AD ? STA.fwd(J["upperLeg.L"][1]) : 0, T = yS - yH;
  // a part made where it comes out (after the stretch) → one read at the base proportions: its height through the stretch, its distance as
  // it is after the stretch (exact across, where these surfaces face: the clothes stand off them by the distance. Scaled down by the steepest
  // stretch, it put the pants 2x as far off the adult legs, round the hands too); its bounds measured back
  const fin = (q) => { const lo = STA.inv(q.by0 - q.br - q.k), hi = STA.inv(q.by0 + q.br + q.k);   // (by0 / br: any part's bounding sphere, an ellipsoid's or a capsule's)
    return { t: 3, k: q.k, bone: q.bone, bx0: q.bx0, by0: (lo + hi) / 2, bz0: q.bz0, br: Math.max(q.br, (hi - lo) / 2) + q.k, f: (x, y, z) => dPrim(q, x, STA.fwd(y), z) }; };
  const adultPart = (o, d, bone, rot = 0) => E([o.x ?? 0, o.y, o.z ?? d.z], [o.w ?? d.w, o.h ?? d.h, o.d ?? d.d], bone, o.k ?? d.k ?? AD.k, rot);
  // the posture (2026-10-08, Saori: "猫背ぽい … 見本みたいに背中を反らせる"): the chest a little forward, the waist further forward (its back
  // comes in: the hollow of the back), the bottom back; in the picture the back at the waist is ~6 cm in front of the back at the shoulders
  // The ribcage leans back at the top (chest.tilt, rad; 2026-10-08, Saori: "肩甲骨の位置が下すぎる", "見本は鎖骨からなだらかなラインで胸が
  // 繋がってるけど、ルミナは鎖骨から急に直角に胸がはじまってる"): upright, its back was fullest at its middle (the shoulder blades too low) and
  // its front stood forward right up to the collarbone (a shelf the bust hung from). Leaning, the back is fullest high up and the front slopes
  // from the collarbone down to the bust
  const CHEST_D = { w: 0.094, d: 0.072, z: 0.014 };   // (2026-10-08, beside the VRoid body in an A-pose: 20 % wider; Saori: "体細すぎる気がする")
  if (AD) { const q = adultPart({ ...AD.chest, y: yS + (AD.chest.y ?? -0.25) * T }, { ...CHEST_D, h: 0.3 * T }, "chest", axes(-(AD.chest.tilt ?? 0.25)));   // (2026-10-08, beside the VRoid body: its bust 0.24 T under the shoulder joint, the waist 0.5 T)
    P.chest = fin(q);   // the ribcage: under the arms to just over the waist
    P.chest.adult = q;   // (as made after the stretch: the bust is set on its front)
    // the shoulder blades: the back fullest just under the shoulders, coming in to the waist (AD.blades: m from the middle, under the shoulder
    // joint, z of the center, radii; 2026-10-08, Saori: "肩甲骨の位置が下すぎるのかな"). Off (d 0) since: "肩甲骨はちょっとやりすぎて不自然", then
    // "肩甲骨の修正一旦戻して" (d 0.014 was the smaller try)
    const BL = { x: 0.038, y: -0.02, z: -0.03, w: 0.032, h: 0.05, d: 0, ...(AD.blades ?? {}) };
    if (BL.d > 0) for (const [sd, m] of [["L", 1], ["R", -1]]) P[`blade.${sd}`] = fin(E([m * BL.x, yS + BL.y, BL.z], [BL.w, BL.h, BL.d], "upperChest", AD.k)); }
  // bust (0 = none; a girl's chest, not the chest board): two round swellings on the front of the chest, kept apart (a valley between
  // them even when big). Each is an ellipsoid long above its center (it rises gently out of the chest), short below (a nearly level
  // underside); the forward point is a little low. The part holds the chest itself so the blend can be wider above than below
  // (a step under it); a wide blend above made a crease across the chest like a strap, so it stays narrow and the ellipsoid's long top does the slope.
  // P.bust.cloth: the same with the two sides joined across the middle, for the shirt (cloth bridges the valley)
  if (TO.bust) { const r = 0.058 * Math.cbrt(TO.bust), CA = AD ? { ...CHEST_D, ...AD.chest } : null, bx = OPT.body.sculpt.bustX ?? (AD ? 0.5 * CA.w : Math.max(0.06 * Math.max(1, TO.chest), r * 1.05)), KU = 0.03, KD = 0.007;
  const cy = AD ? STA.inv(yS + (AD.bustY ?? -0.24) * T) : 0.645 + (OPT.body.sculpt.bustY ?? 0);   // (adult: AD.bustY, × T from the shoulder joint)
  // a chest shortened by the stretch (body.proportion.chest below 0) squashes what is built here upright (at -2 to half: "胸が上下につぶれて
  // 小さくとがって見える", 2026-10-08 Saori). Then the bust's height is measured after the stretch (FY: a height here → where it goes, about
  // the bust's center), so it comes out round; it reaches past the short chest into the belly, whose stretch FY undoes too. Only below 0
  const ST = AD ? STA : (OPT.body.proportion?.chest ?? 0) < 0 ? makeStretch(OPT, J) : null, FY = ST ? (y) => cy + ST.fwd(y) - ST.fwd(cy) : (y) => y;
  const ru = r * 1.45, rd = r * 0.72, rz = r * 0.9, RB = ST ? Math.max(ru, ST.inv(ST.fwd(cy) + ru + KU) - cy, cy - ST.inv(ST.fwd(cy) - rd)) : ru;   // RB: its reach above or below here
  // (bustY: the bust up or down, m; bustX: how far each side is from the middle, m, null = from the chest. 2026-10-07: a slender 6-head body
  // wanted it higher and closer: the spacing never went under 6 cm, so on a narrow chest the bust stood apart and the chest looked wide)
    const zf = AD ? (() => { const q = P.chest.adult, Y = STA.fwd(cy); let z = q.cz + 0.3; while (z > q.cz && dPrim(q, bx, Y, z) > 0) z -= 0.001; return z; })() : 0.015 + 0.098 * TO.chest * Math.sqrt(1 - (bx / (0.13 * TO.chest)) ** 2), cz = zf - r * (0.6 - 0.5 * TO.bust), chest = P.chest;   // zf: the chest's front surface there
    const part = (e) => { const ell = (x, y, z) => { const Y = FY(y), ry = Y > cy ? ru : rd, a = (Math.sqrt(x * x + e * e) - bx) / r, b = (Y - cy) / ry, c = (z - cz) / rz, k0 = Math.hypot(a, b, c), k1 = Math.hypot(a / r, b / ry, c / rz); return k0 * (k0 - 1) / k1; };   // both sides at once (mirrored; e rounds the middle)
      return { t: 3, k: 0.002, bone: "chest", bx0: 0, by0: cy, bz0: cz, br: bx + RB + KU, f: (x, y, z) => smin(dPrim(chest, x, y, z), ell(x, y, z), KD + (KU - KD) * sstep(cy - 0.3 * r, cy + 0.9 * r, FY(y))) }; };
    P.bust = Object.assign(part(0.01), { cloth: part(0.04) }); }
  // adult: the upper chest slopes from the collarbone down to the bust (AD.collar; 2026-10-08, Saori: "見本は鎖骨からなだらかなラインで胸が繋がってる
  // けど、ルミナは鎖骨から急に直角に胸がはじまってる"): the ribcage's and the bust's tops reached above the shoulder joint, so 1.5 cm under the neck's
  // front the chest stood 7 cm forward. Everything ahead of a line from the neck's front at the collarbone (y above the shoulder joint, z) going
  // forward by slope per m down is taken off them (softly), in the middle only (|x| under 9 cm, fading to 13), where it comes out
  if (AD) { const CL = { y: 0.04, z: 0.03, slope: 1, k: 0.02, ...(AD.collar ?? {}) }, yC = yS + CL.y, L = Math.hypot(1, CL.slope), smax = (a, b, k) => -smin(-a, -b, k);
    const line = (x, Y) => CL.z + (Y > yC ? 0 : CL.slope * (yC - Y)) + 0.5 * sstep(0.09, 0.13, Math.abs(x));   // (above the collarbone straight up, along the neck's front: no jump in the distance, which tore holes; beside the chest: none)
    const trim = (q) => { if (!q) return; const f0 = q.f; q.f = (x, y, z) => smax(f0(x, y, z), (z - line(x, STA.fwd(y))) / L, CL.k); };   // (both are made after the stretch: t 3)
    // the upper chest filled out to that line (2026-10-08, Saori: "なんで鎖骨の下が窪んでるのかな"): between the neck's piece, which ends just
    // under the collarbone, and the ribcage, whose top leans back, nothing came forward: straight down 2 cm, then out 2 cm in 1.5 cm. A piece
    // reaching past the line fills it, so from the collarbone to the bust the front is the line itself
    P.upperChest = fin(E([0, yS - 0.03, 0.035], [0.07, 0.05, 0.07], "upperChest", 0.03));   // its back stays inside the ribcage (centered at z 0 it stood 5 cm out of the back: a hump between the shoulders); the shirt is made over it too (clothes/index.js)
    trim(P.chest); trim(P.bust); trim(P.bust?.cloth); trim(P.upperChest); }
  P.belly = E([0, 0.52, -0.08 + 0.115 * TO.belly + BD / 2], [0.165 * TO.belly, 0.14, 0.115 * TO.belly - BD / 2], "spine", 0.1);  // おなかはぽっこり(下ぶくれ)
  // hips: a tall pelvis and a long, soft waist cut, so the side line runs from the waist out to the hips in one smooth curve
  // (a short pelvis and a short cut made the hips jut out suddenly with a corner, like a clay figurine)
  { const PV = OPT.body.sculpt.pelvis ?? {}, sq = PV.squash ?? 1;   // 底を HL 上げる: sq=1 なら上はそのまま(つぶす) / sq=0 なら形ごと上げる
    // a thinner back (torso.back < 1) thins the pelvis's back too, most of the way (the bottom has its own parts and slider): with only the
    // chest and belly thinned, the back went flat high up and the hips stood out behind it (2026-10-07, Saori: "凹む場所が上すぎて、下半身がもっさりする")
    const PB = 0.75 * BD;
    P.pelvis = E([0, 0.435 + HL * (1 - sq / 2), -0.005 + PB / 2], [0.157 * TO.hips, 0.115 - HL * sq / 2, 0.1 - PB / 2], "hips", PV.blend ?? 0.12); }
  // くびれ: 脇腹を左右から削る(腕より前に溶かすので腕は削れない)。肋骨の下と骨盤の上のあいだ(本当のウエスト)を、縦に短く削る。
  // 前は胸のすぐ下(0.6)を中心に縦 0.16 の広い範囲を削っていて、胸の下から一直線に細くなるだけだった(2026-10-07 サオリ「くびれが上の方から細くなるだけ」)
  const WS = { y: 0.555, height: 0.07, width: 0.09, x: 0.225, blend: 0.04, ...(OPT.body.sculpt.waist ?? {}) };
  if (TO.waist) for (const [sd, m] of [["L", 1], ["R", -1]]) P[`waist.${sd}`] = cut(E([m * (WS.x - TO.waist), WS.y, 0], [WS.width, WS.height, 0.14], "spine", WS.blend));
  if (AD) { delete P["waist.L"]; delete P["waist.R"];   // the waist is the narrow piece between the ribcage and the pelvis (no cut)
    // the waist reaches well down into the pelvis, its front under the bust's (2026-10-08, Saori: "胸の下の段をはっきりさせて、お腹の凹みは
    // なだらかな方が自然"): it stood as far forward as the bust just under it (no step there) and ended above the pelvis's top (a dip between)
    P.belly = fin(adultPart({ ...AD.waist, y: yS + (AD.waist.y ?? -0.5) * T }, { w: 0.074, h: 0.3 * T, d: 0.056, z: 0.03 }, "spine"));
    P.pelvis = fin(adultPart({ ...AD.hips, y: yH + (AD.hips.y ?? 0.1) * T }, { w: 0.126, h: 0.4 * T, d: 0.068, z: 0.01 }, "hips")); }
  // 頭: 中だけでなめらかに溶かして、首とはくっきり分ける
  const SK = OPT.body.sculpt.skull;
  P.skull = E([0, SK.y, -0.005], [SK.width, SK.height, SK.depth], "head", 0.06);
  // skullTop: a slightly wider piece over the upper head (above the forehead), so the head widens there without changing the face
  { const ST = OPT.body.sculpt.skullTop; if (ST.extra) P.skullTop = E([0, ST.y, ST.z], [SK.width + ST.extra, ST.ry, ST.rz], "head", 0.06); }   // 頭(大きな丸。横幅・前後とも見本どおり)
  { const OC = OPT.body.sculpt.occiput ?? {}; P.occiput = E([0, OC.y ?? 1.0, OC.z ?? -0.07], [OC.rx ?? 0.17, OC.ry ?? 0.09, OC.rz ?? 0.14], "head", 0.08); }   // 後頭部の下(首の上まで丸くふくらむ)
  P.face = E([0, OPT.body.sculpt.cheeks.y ?? 0.935, 0.08], [OPT.body.sculpt.cheeks.width, OPT.body.sculpt.cheeks.height ?? 0.115, 0.168], "head", 0.08);   // y / height: where the cheeks are fullest and how far down they reach (higher and shorter: a face that narrows to the chin)   // ほお〜あご(頭と同じ幅のまま下りて、なめらかにすぼまる)
  P.jaw = E([0, 0.868, 0.094], [OPT.body.sculpt.jaw.width, 0.062, 0.142], "head", 0.07);
  // chinTip: a small round piece at the bottom of the chin, so the face ends in a small point below round cheeks (Saori, after Nahida). The chin
  // cut's middle comes down with it (chin.point), else the cut would take it off again
  { const T = OPT.body.sculpt.chinTip; if (T?.on) P.chinTip = E([0, T.y, T.z], [T.rx, T.ry, T.rz], "head", T.k); }      // あご先(下は平らぎみ)
  P.muzzle = E([0, OPT.body.sculpt.muzzle.y, 0.17], [OPT.body.sculpt.muzzle.width, 0.075, 0.1], "head", 0.05);   // 口まわりのふくらみ(鼻の下がへこまず、あごまでなめらかに続く)
  const NOSE_DY = -0.035;
  const NOSE_Z = OPT.body.sculpt.nose.tipZ;   // 鼻先の前後(前は0.273。少し内側へ)
  const LIP_CURVE = OPT.body.sculpt.mouth.curve;   // 鼻の下〜あご: 鼻先から1本のなめらかな弧になるよう、上ほど前へ反らせる
  P.muzzle2 = E([0, OPT.body.sculpt.muzzle.baseY, 0.243], [0.035, 0.045, 0.04], "head", 0.03);   // その弧の下地(前を削る面で形が決まる)
  const NOSE_UNDER = { dent: OPT.body.sculpt.nose.under.dent, dy: OPT.body.sculpt.nose.under.dentY, y: OPT.body.sculpt.nose.under.y, slope: OPT.body.sculpt.nose.under.slope };   // 鼻の下側を切る線: 先端からの下がり / 傾き(奥へ)
  const MOUTH_FREE = OPT.body.sculpt.mouth.free;   // 鼻の下を削る面を、この高さより上では前へ逃がす   // 鼻(鼻筋・付け根の凹みごと)を顔の絵の鼻の点に合わせて下げる量
  const NOSE_LIFT = OPT.body.sculpt.nose.lift;   // raise the tip (an upturned nose)
  { const c = C([0, 0.976 + NOSE_DY, 0.238], [0, 0.964 + NOSE_DY + NOSE_LIFT, NOSE_Z], 0.012, OPT.body.sculpt.nose.tipRadius, "head"), yt = 0.964 + NOSE_DY + NOSE_LIFT - NOSE_UNDER.y, zt = NOSE_Z + 0.007, sl = NOSE_UNDER.slope, L = Math.hypot(1, sl);
    P.nose = { t: 3, k: OPT.body.sculpt.nose.blend, bone: "head", bx0: c.bx0, by0: c.by0, bz0: c.bz0, br: c.br,   // 鼻: 付け根から急に立ち上がって、先が尖る。下側は先端からまっすぐ奥へ切る(先端をひとつに)
      f: (x, y, z) => Math.max(dPrim(c, x, y, z), ((z - zt) - (y - yt) * sl) / L) }; }
  CUT.nasion = cut(E([0, 1.005 + NOSE_DY, 0.266], [0.05, 0.035, 0.025], "head", 0.025));   // 鼻の付け根(凹みのいちばん深いところ)
  CUT.brow = cut(E([0, 1.012 + NOSE_DY, 0.314], [0.19, 0.05, 0.07], "head", 0.05));   // 目の高さを横にゆるく凹ませる
  const CH = OPT.body.sculpt.chin;   // under the chin: height at the middle, how fast it rises toward the sides (rounder U), softness of the corner
  // backRise: seen from the side the underside of the jaw rises from the chin toward the ear (by backRise per m behind backZ, at most backMax),
  // so there is no corner under the ear: the jaw line runs up to it and the neck sits behind (2026-10-04, Saori: "the jaw looks heavy, under the ear bulges")
  const rise = (z) => { if (!CH.backRise) return 0; const s = (CH.backZ ?? 0.12) - z, r = CH.backRise * 0.5 * (s + Math.sqrt(s * s + 0.0004)), m = CH.backMax ?? 0.06;
    return r - 0.5 * (r - m + Math.sqrt((r - m) ** 2 + 0.0001)); };   // a smooth ramp, then a smooth cap
  // napeY: behind the ear (z behind napeZ) the bottom of the head is level at this height, as a real skull's base is (about the ear's
  // height, cut off level, the neck below; Saori, with a photo of a skull). Before, the skull's ball reached down below the earlobe and
  // showed under the ear seen from below. The neck reaches up to it (neck.top)
  // napeDrop: at the back, toward the middle, the level base slopes down to the neck (a chamfer seen from the side, so the head doesn't end
  // in a flat shelf over the neck): lower by napeDrop at the neck's back (z napeNeckZ), nothing at the back of the head (napeBackZ) or behind the ears
  const chamfer = (x, z) => CH.napeDrop ? CH.napeDrop * sstep(CH.napeBackZ ?? -0.2, CH.napeNeckZ ?? -0.07, z) * (1 - sstep(CH.napeDropX?.[0] ?? 0.05, CH.napeDropX?.[1] ?? 0.13, Math.abs(x))) : 0;
  const level = (x, z, base) => { if (CH.napeY == null) return base; const t = CH.napeY - chamfer(x, z); return base + Math.max(0, t - base) * sstep(CH.napeZ ?? 0, (CH.napeZ ?? 0) - 0.04, z); };
  // point / pointW: seen from the front the middle of the jaw's bottom dips further into a small, sharp chin (round cheeks, a pointed chin: Saori,
  // after Nahida); sides (m per m of |x|): the bottom rises straight toward the sides as well as curving, a V more than a U
  const pointAt = (x) => (CH.point ?? 0) * Math.exp(-x * x / ((CH.pointW ?? 0.03) ** 2)) - (CH.sides ?? 0) * Math.sqrt(x * x + 0.0001);
  // sharp: seen from the front the jaw's bottom line rises straight from the chin toward the sides (sharp m per m of |x|: a V, not a flat U),
  // at the front only (it fades out behind sharpZ, so under the ears nothing changes): this line is what makes a chin round or pointed
  const sharpAt = (x, z) => CH.sharp ? CH.sharp * (Math.sqrt(x * x + 0.00004) - 0.0063) * sstep(CH.sharpZ?.[0] ?? 0.03, CH.sharpZ?.[1] ?? 0.09, z) : 0;
  // vChin: seen from the front the lower face narrows in a V to a small chin: each side is cut by a slanted plane, |x| = halfW at the chin's
  // bottom (y CH.y) widening by slope per m up, only below y0 (above it the cheeks stay round) and only at the front (z ahead of z0, so
  // under the ears nothing changes). Soft (k) where it meets the rest
  { const V = CH.v; if (V?.on) { const L = Math.hypot(1, V.slope);
    // the cut fades out (its planes move outward) toward y0 and toward z0 instead of stopping there: no ledge at its edges
    const fade = (y, z) => sstep(V.y0, V.y0 - (V.fadeY ?? 0.06), y) * sstep(V.z0 ?? 0.04, (V.z0 ?? 0.04) + (V.fadeZ ?? 0.06), z);
    CUT.vChin = plane((x, y, z) => (V.halfW + V.slope * (y - CH.y) + 0.3 * (1 - fade(y, z)) - Math.abs(x)) / L, V.k ?? 0.02); } }
  CUT.chin = plane((x, y, z) => (y - level(x, z, CH.y + rise(z) - 0.014 * Math.exp(-x * x / 0.0032) - pointAt(x) * sstep(-0.02, 0.06, z) + CH.curve * x * x + sharpAt(x, z))) / Math.sqrt(1 + (CH.curve === 0.95 ? 4 : 4 * CH.curve * CH.curve) * x * x + (CH.backRise ?? 0) ** 2), CH.k);   // あご先: 顔の中心の一点だけ少し下げる   // あごの下: 真ん中の一点がいちばん低く、左右へ上がる
  // seen from above, the front below the nose curves back beside the center and levels off toward the sides (depth cheekBack, reached at about
  // cheekBackWidth from the center), so in a 3/4 view the outline is the nose-mouth-chin line instead of the edge of a flat front
  const CHEEK_BACK = OPT.body.sculpt.mouth.cheekBack, CHEEK_W = OPT.body.sculpt.mouth.cheekBackWidth;
  // profile (mouth.profile, 0 = the straight chibi line; 2026-10-07, Saori: "鼻の下の凹みや口のラインなどがあるタイプの横顔"): seen from the side a
  // soft dip under the nose (halfway down to the mouth, wide across), placed by the face picture's mouth (face.layout.mouthY). Not the upper
  // lip forward ("かえるみたい", Saori) nor a crease under the mouth (the outline came through over the drawn mouth: a line across it, its smile
  // cut off). The chin forward, a set-back mouth and a longer face were tried and taken out ("全てがダメ … 鼻下の凹みだけは残して他は消しましょう")
  const PRF = OPT.body.sculpt.mouth.profile ?? 0, MY = OPT.face?.layout?.mouthY ?? 0.896, gs = (v) => Math.exp(-v * v);
  const NB = 0.964 + NOSE_DY + NOSE_LIFT - NOSE_UNDER.y, DY = (NB + MY) / 2;   // NB: under the nose; DY: halfway down to the mouth
  // mouth.underLip (2026-10-09, Saori, with a Genshin profile: "見本には口のへこみもあるよね"): a soft dip under the lower lip, between the mouth and
  // the chin's front (m, at the middle; 0 = none): the line from the nose comes down past the lips, goes in, and out again to the chin
  const UL = OPT.body.sculpt.mouth.underLip ?? 0, UY = MY - (OPT.body.sculpt.mouth.underLipY ?? 0.024);
  const profile = PRF || UL ? (x, y) => -PRF * 0.006 * gs((y - DY) / 0.014) * gs(x / 0.06) - UL * gs((y - UY) / 0.011) * gs(x / 0.045) : () => 0;
  CUT.mouth = plane((x, y, z) => (0.222 + profile(x, y) - OPT.body.sculpt.mouth.back - CHEEK_BACK * (1 - Math.exp(-x * x / CHEEK_W ** 2)) * (1 - sstep(0.88, 1.0, y)) + 0.9 * (y - 0.842) - 3.9 * (y - 0.842) ** 2 + LIP_CURVE * Math.max(0, y - 0.86) ** 3 + 10 * Math.max(0, y - MOUTH_FREE) ** 2 - NOSE_UNDER.dent * Math.exp(-(((y - NOSE_UNDER.dy) / (OPT.body.sculpt.nose.under.dentWidth ?? 0.014)) ** 2)) - z) / 1.15, 0.015);   // 鼻の下〜あご先は、なめらかに奥へ下がる斜めの面(鼻のところでは前へ逃がす)
  { const CR = OPT.body.sculpt.crown;   // flat top; tilt > 0 makes it rise toward the back (pivoting at z = pivotZ), so the line from the hairline runs on up to the back of the head
    CUT.crown = plane((x, y, z) => (CR.y + CR.tilt * (CR.pivotZ - z) - y) / Math.hypot(1, CR.tilt), CR.blend); }   // 頭のてっぺんを少しだけ平たく
  // flat back of the head: cut behind z = -backPlane.z, tilted so the plane leans forward at the top (0 = off)
  { const BP = OPT.body.sculpt.backPlane; if (BP.z) CUT.back = cut({ t: 3, k: BP.k, bone: "head", bx0: 0, by0: 0, bz0: 0, br: 1e9, f: (x, y, z) => (z + BP.z - BP.tilt * (y - 1.1)) / Math.hypot(1, BP.tilt) }); }
  CUT.nape = plane((x, y, z) => (z + 0.15 + 3.5 * (y - 0.89)) / 3.64, 0.018);   // 後頭部の下は首の手前で内側へ巻き込む(首の後ろとの間にくびれ)
  for (const [s, m] of [["L", 1], ["R", -1]]) {
    const j = (n) => J[`${n}.${s}`];
    // 耳: 前の縁は頭にぴったり付き、後ろの縁が外へ開いて浮く板。くぼみは前・外を向く(横から見ると前がまっすぐのD字)
    const nrm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const eu = nrm([m * EAR.flare, 0, -1]), ev0 = [m * EAR.tilt, 1, 0], ev = nrm(ev0.map((c, i) => c - dot(ev0, eu) * eu[i]));
    const ew = [eu[1] * ev[2] - eu[2] * ev[1], eu[2] * ev[0] - eu[0] * ev[2], eu[0] * ev[1] - eu[1] * ev[0]].map((c) => c * m), ec = [m * EAR.x, EAR.y, -0.022];   // ew: 耳の表(前・外向き)
    { const c = Math.cos(EAR.lean), sn = Math.sin(EAR.lean), u = eu.slice(), v = ev.slice(); for (let i = 0; i < 3; i++) { eu[i] = u[i] * c - v[i] * sn; ev[i] = v[i] * c + u[i] * sn; } }   // 上を後ろへ倒す(横から見て上が広い形に)
    const EL = OPT.body.sculpt.ears.elf, ELF = !!EL?.on;
    // ear size. Elf ears: the round ear is smaller (0.62), inside the blade's root, which starts lower: the round ear stood out under the blade
    // (2026-10-07, Saori: "エルフ耳が耳に尖りを被せただけで、下の丸い耳が見えちゃってる"); its line and shade (EARS) shrink with it
    const ES = OPT.body.sculpt.ears.scale * (ELF ? 0.62 : 1);
    // seen from the side, turn the whole ear so its bottom comes forward and its top goes back (the front edge leans like a real ear)
    const ER = OPT.body.sculpt.ears.turn, rotE = (v) => [v[0], v[1] * Math.cos(ER) + v[2] * Math.sin(ER), -v[1] * Math.sin(ER) + v[2] * Math.cos(ER)];
    if (ER) for (const a of [eu, ev, ew]) { const r = rotE(a); a[0] = r[0]; a[1] = r[1]; a[2] = r[2]; }
    { const e0 = E(ec, [0.062 * ES, 0.067 * ES, 0.019 * ES], "head", OPT.body.sculpt.ears.blend, [eu, ev, ew]), ta = OPT.body.sculpt.ears.trimAngle, tc = OPT.body.sculpt.ears.trimDepth * ES, n = eu.map((c, i) => c * Math.cos(ta) - ev[i] * Math.sin(ta));
      // hollow: a crescent inside the rim (like the drawn ear line, filled) pressed into the ear's front, with soft edges so it follows the ear's curve
      const HO = OPT.body.sculpt.ears.hollow, dent = !HO.on ? () => 0 : (x, y, z) => { const d = [x - ec[0], y - ec[1], z - ec[2]], u = (d[0] * eu[0] + d[1] * eu[1] + d[2] * eu[2]) / ES, v = (d[0] * ev[0] + d[1] * ev[1] + d[2] * ev[2]) / ES, w = (d[0] * ew[0] + d[1] * ew[1] + d[2] * ew[2]) / ES;
        const r1 = Math.hypot((u - HO.cu) / HO.ru, (v - HO.cv) / HO.rv), r2 = Math.hypot((u - HO.cu + HO.shift) / HO.ru, (v - HO.cv) / (HO.rv * HO.inner));
        return HO.depth * ES * sstep(1 + HO.soft, 1 - HO.soft, r1) * sstep(1 - HO.soft, 1 + HO.soft, r2) * sstep(-0.004, 0.008, w); };
      P[`ear.${s}`] = { ...e0, t: 3, f: (x, y, z) => -smin(-dPrim(e0, x, y, z), -(n[0] * (x - ec[0]) + n[1] * (y - ec[1]) + n[2] * (z - ec[2]) - tc), 0.012) + dent(x, y, z) }; }   // 耳の後ろの下側をななめに落として、下へ細くとがらせる
    // earlobe: a small lump at the bottom front of the ear, against the head, so seen from the front the ear's lower edge first runs down from
    // where it meets the head, then turns out diagonally to the widest point (one more corner)
    const LB = OPT.body.sculpt.ears.lobe;
    if (LB) { const lo = rotE([-m * OPT.body.sculpt.ears.lobeIn, -0.056 * ES, 0.008]), lc = ec.map((v, i) => v + lo[i]);
      P[`earLobe.${s}`] = E(lc, [0.016 * LB * ES, 0.022 * LB * ES, 0.014 * LB * ES], "head", 0.016);
      // lobeFill: a straight piece from the lobe up to the ear's widest point, so the edge between them has no dip (without it: a big "lucky" earlobe)
      const LF = OPT.body.sculpt.ears.lobeFill;
      if (LF) { const tip = ec.map((v, i) => v + (eu[i] * LF.out + ev[i] * LF.up) * ES); P[`earFill.${s}`] = C(lc, tip, 0.011 * ES, 0.009 * ES, "head", 0.01); } }
    // elf ears (ears.elf, 2026-10-05, Saori): a flat blade from inside the ear out to the side, up and a little back, tapering to a point, its
    // tip bent up a little (curve), flat (its face toward the front). It starts at the ear's middle: the ear's own plate already reaches ~6 cm
    // that way, so length is from there. The hair keeps off it as off the ear
    if (ELF) { const ES0 = OPT.body.sculpt.ears.scale, up = EL.angle * Math.PI / 180, bk = EL.back * Math.PI / 180, L0 = 0.035 * ES0, L = EL.length * ES0 + L0, W = Math.max(EL.width, 0.042) * ES0, FL = EL.flat, CV = EL.curve;
      const a = [m * Math.cos(bk) * Math.cos(up), Math.sin(up), -Math.sin(bk) * Math.cos(up)];   // out to the side, up by angle, back by back (degrees)
      const bu = nrm([-a[0] * a[1], 1 - a[1] * a[1], -a[2] * a[1]]), bn = nrm([a[1] * bu[2] - a[2] * bu[1], a[2] * bu[0] - a[0] * bu[2], a[0] * bu[1] - a[1] * bu[0]]);   // bu: up across the blade (the tip bends that way), bn: its face
      const s0 = ec.map((v, i) => v - a[i] * L0), mid = s0.map((v, i) => v + a[i] * L * 0.5 + bu[i] * CV * L * 0.25);
      P[`earTip.${s}`] = { t: 3, k: EL.k, bone: "head", bx0: mid[0], by0: mid[1], bz0: mid[2], br: L * 0.6 + W + CV * L,
        f: (x, y, z) => { const d = [x - s0[0], y - s0[1], z - s0[2]], t = Math.min(1, Math.max(0, (d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) / L));
          const q = [0, 1, 2].map((i) => d[i] - a[i] * t * L - bu[i] * CV * L * t * t), qa = q[0] * a[0] + q[1] * a[1] + q[2] * a[2], qw = q[0] * bn[0] + q[1] * bn[1] + q[2] * bn[2];
          const qb = Math.sqrt(Math.max(0, q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - qa * qa - qw * qw)), r = W * (1 - Math.pow(t, 1.3)) + 0.0015;   // a leaf: widest at the ear, to a point
          return (Math.hypot(qa, qb, qw / FL) - r) * FL * 0.9; } }; }
    EARS.push({ m, c: ec.slice(), eu: eu.slice(), ev: ev.slice(), ew: ew.slice(), ES });   // the ear's frame (head space), for the ear line
    CUT[`ear.${s}`] = cut(E(ec.map((v, i) => v + (ew[i] * 0.025 + eu[i] * 0.024) * ES), [0.026 * ES, 0.042 * ES, 0.011 * ES], "head", 0.014, [eu, ev, ew]));   // 耳の内側のくぼみ
    if (AD) { const B = AD.butt; P[`butt.${s}`] = fin(adultPart({ ...B, x: m * (B.x ?? 0.055), y: yH + (B.y ?? -0.06) * T }, { w: 0.062, h: 0.2 * T, d: 0.05, z: -0.04 }, "hips")); }
    else { const B = TO.butt ?? 1, BB = 0.6 * BD; P[`butt.${s}`] = E([m * 0.07 * TO.hips, OPT.body.sculpt.buttY ?? 0.452, -0.05 + 0.03 * (1 - B) + BB / 2], [0.08, 0.066, 0.075 * B - BB / 2], "hips", 0.05); }   // butt: how far the bottom sticks out at the back (1 = the reference sheet). BB: a thinner back (torso.back) takes some of it in too, so the bottom doesn't jut out under a flat back
    { const ks = Math.min(1, 0.4 + 0.6 * OPT.body.thickness.upperArm); P[`shoulder.${s}`] = E([m * (0.116 + SHW), 0.742 - SHOULDER_DROP, 0], [0.054 * ks, (0.045 - SHOULDER_DROP * 0.6) * ks, 0.048 * ks], `upperArm.${s}`, 0.04); }   // the shoulder slims with a thin upper arm (else it stays as a bump at the top of the arm)   // なで肩
    P[`upperArm.${s}`] = C(j("upperArm"), j("lowerArm"), 0.047, 0.043, `upperArm.${s}`, 0.022);   // 付け根は細く、脇はくっきり
    P[`foreArm.${s}`] = C(j("lowerArm"), j("hand"), 0.045, OPT.body.sculpt.forearm.wristRadius, `lowerArm.${s}`, OPT.body.sculpt.forearm.elbowBlend);   // ひじ: 溶かす幅を小さく(つなぎ目に余分な肉がついて一段ふくらまないように)
    { const a = j("lowerArm"), b = j("hand"), t = OPT.body.sculpt.forearm.bulge.start, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;   // ひじの下の前腕のふくらみ: 下寄りにふくらませ(上側は控えめ)、手首へ細くなりながらなめらかにつなぐ
      const nd = [m * uy, -m * ux], od = OPT.body.sculpt.forearm.bulge.offset, c = [a[0] + (b[0] - a[0]) * t + nd[0] * od, a[1] + (b[1] - a[1]) * t + nd[1] * od, a[2] + (b[2] - a[2]) * t];
      P[`foreBulge.${s}`] = C(c, [b[0] + nd[0] * od * 0.3, b[1] + nd[1] * od * 0.3, b[2]], OPT.body.sculpt.forearm.bulge.radius, OPT.body.sculpt.forearm.bulge.radiusEnd, `lowerArm.${s}`, OPT.body.sculpt.forearm.bulge.blend);
      Object.assign(P[`foreBulge.${s}`], { t: 4, n: handFrame(J, s, HK).N, flat: OPT.body.sculpt.forearm.bulge.flat }); }   // 手のひらの向きに平たい(手首に向かって平たくしぼる。丸太にならないように)
    // 手: Aポーズで手のひらが下を向く。指4本(少し開く)+親指
    // 何か持つ手(outfit.weapon)は握りこぶし(手首はまっすぐのまま。柄は親指の側へ抜ける)。盾は前腕に留めるので手は開いたまま(構えでだけ握る: motion の guard)
    const held = (OPT.outfit?.weapon ?? {})[s === "L" ? "left" : "right"] ?? "none", fist = held !== "none" && held !== "shield" && held !== "round";
    const { w, D, N, S } = handFrame(J, s, HK);   // D=指の向き N=手のひらの向き S=親指の側
    const at = (o, ...t) => o.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k * HK, 0));   // (offsets in the hand's size)
    const palm = at(w, [D, 0.03], [N, 0.002]);
    // adult hands (2026-10-08, Saori: "手がちびキャラ用に作ったやつだからデカくて指も太いよね"; beside the VRoid hand): a narrower, thinner palm and
    // slender fingers half again as long (FR: the fingers' radius, FL: their length, FS: their spread across the palm)
    const FR = AD ? 0.55 : 1, FL = AD ? 1.45 : 1, FS = AD ? 0.7 : 1;
    P[`palm.${s}`] = E(palm, [0.034 * HK, (AD ? 0.036 : 0.05) * HK, (AD ? 0.012 : 0.019) * HK], `hand.${s}`, 0.02 * HK, [D, S, N]);   // 見本の手は大きめ(横から見ると扇に開く)
    // 握りこぶし: 指は付け根から手のひら側へ曲がって、もう一度内へ折れる(握った柄を包む)。親指は指の前にかぶさる
    [[0.039, 0.4, 0.04], [0.013, 0.13, 0.046], [-0.013, -0.13, 0.044], [-0.039, -0.4, 0.036]].forEach(([o, sp, len], i) => {
      const fd = D.map((v, k) => v * Math.cos(sp * FS) + S[k] * Math.sin(sp * FS)), b0 = at(palm, [D, 0.022], [S, o * FS * (fist ? 0.85 : 1)]);
      if (fist) { const k1 = at(b0, [D, 0.014], [N, 0.026]); P[`finger${i}.${s}`] = C(b0, k1, 0.0125 * HK * FR, 0.012 * HK * FR, `fingers.${s}`, 0.006); P[`fingerTip${i}.${s}`] = C(k1, at(k1, [N, 0.012], [D, -0.022]), 0.012 * HK * FR, 0.011 * HK * FR, `fingerTips.${s}`, 0.006); return; }
      // 開いた指: 付け根側(fingers の骨)と先側(fingerTips の骨)の2本に分ける = 中ほどで曲がる。つなぎ目は溶かす幅を小さく(同じ太さの継ぎ目がふくらまないように)
      const mid = at(b0, [fd, len * FL * 0.48], [N, 0.003]);
      P[`finger${i}.${s}`] = C(b0, mid, 0.0125 * HK * FR, 0.012 * HK * FR, `fingers.${s}`, 0.008);   // 指の股はくっきり
      P[`fingerTip${i}.${s}`] = C(mid, at(b0, [fd, len * FL], [N, 0.006]), 0.012 * HK * FR, (AD ? 0.0095 : 0.0115) * HK * FR, `fingerTips.${s}`, 0.002);
    });
    const tb = at(palm, [S, 0.04], [D, -0.008], [N, 0.006]);
    P[`thumb.${s}`] = fist ? C(tb, at(tb, [S, -0.004], [D, 0.024], [N, 0.03]), 0.013 * HK * FR, 0.011 * HK * FR, `thumb.${s}`, 0.012) : C(tb, at(tb, [S, 0.022 * FL], [D, 0.016 * FL], [N, 0.016]), 0.013 * HK * FR, 0.011 * HK * FR, `thumb.${s}`, 0.012);
    { const a = j("upperLeg"), b = j("lowerLeg"), d = OPT.body.sculpt.thigh.topDrop ?? 0, L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);   // topDrop: 太ももの肉の上端だけを脚の向きに下げる(股関節=骨の回る点は動かさない)。外側の付け根の張り出しが下がり、くびれから腰へのカーブがゆるくなる
      P[`thigh.${s}`] = C(a.map((v, i) => v + (b[i] - v) * d / L), b, 0.08, 0.066, `upperLeg.${s}`, 0.05); }
    P[`thighB.${s}`] = E([m * (0.11 + legDX(OPT.body.sculpt.thigh.back.y + HL)), OPT.body.sculpt.thigh.back.y + HL, OPT.body.sculpt.thigh.back.z], [0.058, OPT.body.sculpt.thigh.back.height, OPT.body.sculpt.thigh.back.depth], `upperLeg.${s}`, 0.05);   // 太ももの裏: おしりからひざへ、うしろ側をなめらかにつなぐ(正面の幅は変えない)
    P[`thighF.${s}`] = E([m * (0.11 + legDX(OPT.body.sculpt.thigh.front.y + HL)), OPT.body.sculpt.thigh.front.y + HL, OPT.body.sculpt.thigh.front.z], [OPT.body.sculpt.thigh.front.width, OPT.body.sculpt.thigh.front.height, OPT.body.sculpt.thigh.front.depth], `upperLeg.${s}`, OPT.body.sculpt.thigh.front.blend);   // 太ももの前: 前側にも肉をつける(正面の幅は変えない)
    P[`thighIn.${s}`] = E([m * (OPT.body.sculpt.thigh.inner.x + legDX(OPT.body.sculpt.thigh.inner.y + HL)), OPT.body.sculpt.thigh.inner.y + HL, 0.002], [OPT.body.sculpt.thigh.inner.width, OPT.body.sculpt.thigh.inner.height, 0.05], `upperLeg.${s}`, 0.04);   // 内もも: 付け根の内側に肉をつけて、ひざへまっすぐ絞る
    P[`calfO.${s}`] = E([m * (FOOT_X + OPT.body.sculpt.calf.outer.x), OPT.body.sculpt.calf.outer.y, -0.008], [OPT.body.sculpt.calf.outer.width, OPT.body.sculpt.calf.outer.height, 0.045], `lowerLeg.${s}`, 0.04);   // ふくらはぎの外側: 膝の下で外へふくらむ(見本の正面の線)
    P[`calf.${s}`] = C(j("lowerLeg"), j("foot"), 0.062, 0.05, `lowerLeg.${s}`, 0.05);   // narrowing to the ankle (0.057 there before: the shin came down as thick as the calf onto the foot, like a boot; 0.045 then narrowed too suddenly. 2026-10-07)
    P[`calfB.${s}`] = E([m * (FOOT_X - 0.008), 0.18, OPT.body.sculpt.calf.back.z], [OPT.body.sculpt.calf.back.width, 0.068, OPT.body.sculpt.calf.back.depth], `lowerLeg.${s}`, 0.05);   // ふくらはぎのふくらみ
    // legShape (0–1; 2026-10-07, Saori: "太ももから膝までが中心に向かって、膝から下は垂直に近い。膝上は内側に入っていて、膝下は少し外側にずれたところから
    // 始まる…膝はアウトラインに段がある。横から見ると、膝から膝下は少し後ろに出て…段がある。いまただの棒に近い"): placed by the joints, so it fits
    // legs closed in or apart. The thigh narrows into the knee; a kneecap at the front; under the knee the calf starts a little outside it (its
    // outer head high, the inner one lower) and bulges out at the back, then narrows to a slim ankle: steps at the knee, front and side
    { const LS = OPT.body.sculpt.legShape ?? 0;
      if (LS > 0) { const k = j("lowerLeg"), f = j("foot"), kx = Math.abs(k[0]), LL = k[1] - f[1], q = LS;
        P[`thigh.${s}`].rb *= 1 - 0.28 * q;   // a slimmer knee
        P[`calf.${s}`].rb *= 1 - 0.22 * q;   // a slimmer ankle
        P[`kneeCap.${s}`] = E([m * kx, k[1] + 0.01, k[2] + 0.04 * q], [0.03, 0.032, 0.026], `lowerLeg.${s}`, 0.02);
        P[`calfOut.${s}`] = E([m * (kx + 0.03 * q), k[1] - 0.26 * LL, k[2] - 0.012], [0.05, 0.3 * LL, 0.05], `lowerLeg.${s}`, 0.035);
        P[`calfInner.${s}`] = E([m * (kx - 0.022 * q), k[1] - 0.4 * LL, k[2] - 0.014], [0.046, 0.28 * LL, 0.05], `lowerLeg.${s}`, 0.035);
        P[`calfBack.${s}`] = E([m * kx, k[1] - 0.32 * LL, k[2] - 0.035 * q], [0.05, 0.32 * LL, 0.05], `lowerLeg.${s}`, 0.035); } }
    // adult: the back of the knee filled (seen from the side the slim knee was pinched front and back, "膝がちぎれそう"), made where it comes out
    if (AD) { const k = j("lowerLeg"), yK = STA.fwd(k[1]), tc = OPT.body.thickness?.calf ?? 1;
      P[`kneeBack.${s}`] = fin(E([k[0], yK + 0.005, k[2] - 0.012], [0.05 * tc, 0.07, 0.045 * tc], `lowerLeg.${s}`, 0.04)); }
    // in high heels the foot is narrower (a pump holds it in; the shoe is made around it, and around the round chibi foot it stood out to the
    // sides seen from the front: 2026-10-07, Saori: "ハイヒールもスニーカーの使い回しなので正面から見ると横に膨らみすぎ")
    { const fx = m * (FOOT_X - 0.002), HEELS = OPT.outfit?.shoes?.kind === "heels", n = heelsWorn(OPT) ? 0.68 : 1;
      // shoeLast: what shoes (and the plate's sabatons) are made around: the round foot of before (clothes/index.js). Not part of the body
      // (adult: the last's back with the foot's, 1.4 cm in: the shoes stood out behind the adult heel; 2026-10-08, Saori: "ハイヒールがまだかかと後ろに出てる")
      P[`shoeLast.${s}`] = E([fx, -0.003 + FOOT_H, AD ? 0.02 : 0.015], [HEELS ? 0.035 : 0.052, FOOT_H, AD ? 0.072 : 0.075], `foot.${s}`, 0.04);
      // the bare foot (2026-10-07, Saori: "裸足の造形が変、元の丸い足に脚の指をつけただけ"): a narrow heel, a long middle, the forefoot wide and
      // flat under the toes (the ball, a little toward the big toe); all within the shoe's last, so a shoe still covers it
      // Then (Saori, with a photo): the heel stood out too far behind (−0.064 → −0.05), the sole is flat on the floor (the parts reach 4 mm
      // under it and FOOT_FLAT cuts them level there), and the instep runs from the ankle down to the forefoot as one slope (instep, made below
      // with the feet's size: its top stays at the ankle, so a small foot doesn't come apart from the leg)
      // adult: the forefoot longer and thinner, the toes further forward (2026-10-08, Saori: "つま先側は指を含めてもう少し伸ばして薄くしたい")
      const FH = FOOT_H * (AD ? 0.82 : 0.92);
      P[`foot.${s}`] = E([fx, -0.007 + FH, AD ? 0.02 : 0.012], [0.04 * n, FH, AD ? 0.064 : 0.068], `foot.${s}`, 0.03);   // (adult: thinner, its back 1 cm in, at the heel's line (it reached 5.6 cm back, behind the heel: the bump over a heel shoe, 2026-10-08, Saori: "ハイヒールがまだかかと後ろに出てる"); the toes make the front: reaching past them it swallowed them)
      P[`heel.${s}`] = E([fx + m * 0.002, -0.007 + 0.024, AD ? -0.015 : -0.026], [0.028 * n, 0.024, 0.024], `foot.${s}`, 0.025);   // (adult: under the Achilles tendon, not 2 cm behind it with a dip above: 2026-10-08, Saori, "かかとが後ろにですぎ、かかとの上で急に凹んでる")
      P[`ball.${s}`] = AD ? E([fx - m * 0.004, -0.007 + 0.011, 0.056], [0.047 * n, 0.011, 0.03], `foot.${s}`, 0.02) : E([fx - m * 0.004, -0.007 + 0.015, 0.05], [0.047 * n, 0.015, 0.03], `foot.${s}`, 0.02); }
    // toes (foot.toes, 2026-10-05, Saori: barefoot like Nahida; "足の指丸まってない？"): the foot's front top is shaved down to them (FOOT_CUT), so the
    // instep slopes to the toes instead of ending in a dome they sat under (curled-looking); the toes lie flat on the ground, pointing forward.
    // A shoe is made around the foot and a smooth toe box over them (toeBox: for the clothes only), so it covers them without their bumps.
    // Four along the front of the foot (chibi style), the big toe on the inside, each a
    // round piece joined with a narrow blend so the gaps between them show. Inside a shoe they are hidden (the body under it isn't drawn)
    // and within the shoe's shape (it is made around the foot alone, 1.2 cm out), so a shoe looks the same
    { const TS = OPT.body.sculpt.foot.toes; if (TS?.on) { const cx = m * (FOOT_X - 0.002), z0 = AD ? 0.035 : 0.015, k = TS.size ?? 1, hx = heelsWorn(OPT) ? 0.68 : 1, ky = AD ? 0.8 : 1;   // (adult: further forward, flatter)   // hx: in heels the toes close up (with the narrower foot)
      [[-0.027, 0.06, 0.015, 0.0105, 0.02], [-0.005, 0.062, 0.0115, 0.0095, 0.017], [0.014, 0.057, 0.011, 0.009, 0.016], [0.031, 0.047, 0.0105, 0.0085, 0.015]].forEach(([dx, dz, rx, ry, rz], i) =>   // four: smaller than the grid the fifth only blurred the edge
        P[`toe${i}.${s}`] = E([cx + m * dx * k * hx, -0.003 + ry * k * ky + 0.001, z0 + dz * k], [rx * k * hx, ry * k * ky, rz * k], `foot.${s}`, 0.004));
      P[`toeBox.${s}`] = E([cx, 0.011, z0 + 0.058 * k], [0.05 * hx, 0.015, 0.032 * k], `foot.${s}`, 0.03);
      FOOT_CUT.push(cut(E([cx, 0.068, z0 + 0.085], [0.08, 0.04, 0.06], `foot.${s}`, 0.012))); } }
    // the feet's size (body.proportion.feet, ×; 2026-10-07, Saori: "手や足の大きさもスライダーで変えられるようにしたい"): every part of the foot
    // grown about the ankle, the sole kept on the floor (shoes are made around them: they grow too)
    { const FK = OPT.body.proportion?.feet ?? 1; if (FK !== 1) { const O = [m * (FOOT_X - 0.002), -0.003, 0];
      const grow = (p) => { if (!p) return; p.cx = O[0] + (p.cx - O[0]) * FK; p.cy = O[1] + (p.cy - O[1]) * FK; p.cz = O[2] + (p.cz - O[2]) * FK; p.rx *= FK; p.ry *= FK; p.rz *= FK; p.k *= FK;
        p.bx0 = p.cx; p.by0 = p.cy; p.bz0 = p.cz; p.br = Math.max(p.rx, p.ry, p.rz); };
      for (const n of ["shoeLast", "foot", "heel", "ball", "toe0", "toe1", "toe2", "toe3", "toeBox"]) grow(P[`${n}.${s}`]);
      if (OPT.body.sculpt.foot.toes?.on) grow(FOOT_CUT.at(-1)); } }
    // the instep: from the ankle (as thick as the leg is there) down to the top of the forefoot, one slope; its top stays at the ankle whatever the feet's size
    { const FK = OPT.body.proportion?.feet ?? 1, fx = m * (FOOT_X - 0.002), th = OPT.body.thickness?.calf ?? 1;
      // (adult: from under the ankle's front, low, to the toes' roots, blended narrowly: the shin's front comes straight down and the instep arches
      // forward out of it, as in a heel or the VRoid foot (2026-10-08, Saori: "足の上の方が、ハイヒールだと反ってるけど、裸足でもこんな風に反るようにしたい");
      // from the ankle itself it was one straight slope down from high up. On over the toes it buried them)
      P[`instep.${s}`] = AD ? (() => { const a = j("foot"); return C([fx, a[1] - 0.028, a[2] + 0.018], [fx, -0.003 + 0.014 * FK, 0.062 * FK], 0.026 * Math.max(th, 0.6), 0.012 * FK, `foot.${s}`, 0.02); })()
        : C(j("foot"), [fx, -0.003 + 0.02 * FK, 0.05 * FK], 0.04 * th, 0.017 * FK, `foot.${s}`, 0.03); }
    // 服用: 半分の長さの袖・すそ
    const ua = j("upperArm"), la = j("lowerArm"), mid = ua.map((v, i) => v + (la[i] - v) * 0.5);
    P[`sleeve.${s}`] = C(ua, mid, 0.046, 0.044, `upperArm.${s}`, 0.04);
    const ul = j("upperLeg"), ll = j("lowerLeg"), mk = ul.map((v, i) => v + (ll[i] - v) * 0.45);
    P[`leghole.${s}`] = C(ul, mk, 0.078, 0.072, `upperLeg.${s}`, 0.05);
    // 手足の太さ(1 = そのまま)。袖とズボンの範囲も一緒に太らせる
    const TH = OPT.body.thickness;
    for (const n of ["upperArm", "sleeve"]) thicken(P[`${n}.${s}`], j("upperArm"), j("lowerArm"), TH.upperArm);
    for (const n of ["foreArm", "foreBulge"]) thicken(P[`${n}.${s}`], j("lowerArm"), j("hand"), TH.forearm);
    for (const n of ["thigh", "thighB", "thighF", "thighIn", "leghole"]) thicken(P[`${n}.${s}`], j("upperLeg"), j("lowerLeg"), TH.thighTop ?? TH.thigh, TH.thigh);   // thighTop: at the hip joint (slimmer = the hips don't bulge out at the top of the legs)
    for (const n of ["calf", "calfO", "calfB", "calfOut", "calfInner", "calfBack", "kneeCap"]) if (P[`${n}.${s}`]) thicken(P[`${n}.${s}`], j("lowerLeg"), j("foot"), TH.calf);
    // adult legs (2026-10-08, Saori: "腕や脚も元がチビだから、大人体型ように作り直した方がいいのかな"; beside her VRoid body): the chibi's leg
    // pieces stretched 2.1× upright (a long kneecap, long calves). Made where they come out, between the joints: the thigh tapering from the
    // hip to the knee with flesh in front and behind (the thigh as deep as wide), a small kneecap, the shin tapering to the ankle with the
    // calf behind, high. Sizes in m (AD.legs); the same names as before, so pants are made over them
    if (AD) { for (const n of ["thigh", "thighB", "thighF", "thighIn", "calfO", "calf", "calfB", "kneeCap", "calfOut", "calfInner", "calfBack", "kneeBack"]) delete P[`${n}.${s}`];
      const F = (p) => [p[0], STA.fwd(p[1]), p[2]], Hf = F(j("upperLeg")), Kf = F(j("lowerLeg")), Af = F(j("foot")), LT = Hf[1] - Kf[1], LS = Kf[1] - Af[1];
      const LG = { thigh: [0.06, 0.032], shin: [0.03, 0.017], front: 0.04, back: 0.04, calf: 0.046, ...(AD.legs ?? {}) }, at = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
      P[`thigh.${s}`] = fin(C([Hf[0], Hf[1] + 0.02, Hf[2]], Kf, LG.thigh[0], LG.thigh[1], `upperLeg.${s}`, 0.04));
      // the outside of the thigh's top, from the hips' width down (2026-10-08, Saori: "くびれから太ももにかけて見本は広がってるけど、雛形は腰で終わって
      // ストンと落ちてるから、太ももが棒っぽく見える"): the hips' line runs on into the thigh and narrows toward the knee, not ending at the hip
      { const o = LG.out ?? 0.02, b = at(Hf, Kf, 0.75); P[`thighOut.${s}`] = fin(C([Hf[0] + m * o, Hf[1] - 0.045, Hf[2] - 0.004], [b[0] + m * o * 0.3, b[1], b[2]], 0.046, 0.034, `upperLeg.${s}`, 0.05)); }
      // (a capsule from just under the hips' widest down toward the knee: as a tall ellipsoid its top reached over the hips and stood up at each
      // side as a spike, 2026-10-08, Saori: "腰の両端が上に引っ張られてない？")
      { const c = at(Hf, Kf, 0.5); P[`thighF.${s}`] = fin(E([c[0], c[1], c[2] + 0.012], [0.037, 0.44 * LT, LG.front], `upperLeg.${s}`, 0.04)); }   // (down to the knee: it ended above it, a dip there seen from the side)
      { const c = at(Hf, Kf, 0.3); P[`thighB.${s}`] = fin(E([c[0], c[1], c[2] - 0.018], [0.04, 0.3 * LT, LG.back], `upperLeg.${s}`, 0.04)); }
      P[`kneeCap.${s}`] = fin(E([Kf[0], Kf[1] + 0.006, Kf[2] + 0.014], [0.02, 0.026, 0.014], `lowerLeg.${s}`, 0.03));
      P[`calf.${s}`] = fin(C(Kf, [Af[0], Af[1], Af[2] - 0.004], LG.shin[0], LG.shin[1], `lowerLeg.${s}`, 0.04));
      { const c = at(Kf, Af, 0.32); P[`calfB.${s}`] = fin(E([c[0], c[1], c[2] - 0.024], [0.034, 0.27 * LS, LG.calf], `lowerLeg.${s}`, 0.04)); }
      // under the calf, down to the heel: the calf narrowing into the Achilles tendon, not ending in a step halfway (2026-10-08, Saori:
      // "ふくらはぎが突然途中で細くなってる")
      { const a = at(Kf, Af, 0.45), b = at(Af, Af, 0); P[`calfLow.${s}`] = fin(C([a[0], a[1], a[2] - 0.014], [b[0], b[1] - (heelsWorn(OPT) ? 0 : 0.035), b[2] - 0.012], 0.02, 0.014, `lowerLeg.${s}`, 0.05)); } }   // (down onto the heel; in heels only to the ankle: the heel tilts back and up with the shoe, and the tendon's skin, on the shin, stood out of the shoe behind)
  }
  const isHead = (k) => /^(skull|occiput|face|jaw|chinTip|muzzle|nose|ear)/.test(k);
  const BRIDGE = C([0, 1.04 + NOSE_DY, 0.216], [0, 0.97 + NOSE_DY, 0.236], 0.009, 0.011, "head", 0.035);   // 鼻筋(凹ませたあとに足すので、目のあいだは鞍の形になる)
  const BODY = Object.entries(P).filter(([k, v]) => !/^(sleeve|leghole|toeBox|shoeLast)/.test(k) && !v.sub).map(([, v]) => v).concat(BRIDGE);   // 重みづけ用(削る部品は入れない)
  // experimental: a rounded box in front of the face, so the face front (forehead to under the eyes) is a flat plane and the eyes don't wrap around a sphere
  const FB = OPT.body.sculpt.faceBox, faceBox = FB.on ? roundBox([0, FB.y, FB.front - FB.depth], [FB.width, FB.height, FB.depth], FB.round, FB.blend) : null;
  // flat planes: cut the face front at z = cutFront (between cutY0 and cutY1), and the face sides at |x| = sideX (in front of z = sideZ, ahead of the ears)
  const ramp = (s) => 0.5 * (s + Math.sqrt(s * s + 0.0004)), ramp1 = (s) => 0.5 * (1 + s / Math.sqrt(s * s + 0.0004));   // a ramp with a rounded knee (no crease), and its slope
  const planeCuts = [];
  // the planes fade out instead of stopping: below cutY0 the front plane moves forward, behind sideZ the side planes move outward (no steps at their edges)
  if (FB.cutFront) planeCuts.push(cut({ t: 3, k: FB.cutK, bx0: 0, by0: 0, bz0: 0, br: 1e9, f: (x, y, z) => Math.max(FB.cutFront + FB.cutSlope * ramp(FB.cutY0 - y) - z, y - FB.cutY1) / Math.hypot(1, FB.cutSlope * ramp1(FB.cutY0 - y)) }));
  // round lower face: seen from the front, trim what's outside a U (an elliptical bottom below y, opening out above it), front half only
  const JU = OPT.body.sculpt.jawU;
  if (JU.on) planeCuts.push(cut({ t: 3, k: JU.k, bx0: 0, by0: 0, bz0: 0, br: 1e9, f: (x, y, z) => {
    const grow = 1.5 * ramp(JU.z0 - z) + JU.open * ramp(y - JU.y), rx = JU.rx + grow, ry = JU.ry + grow, dy = Math.min(0, y - JU.y);   // behind z0 and above y the U opens out (no step, the skull is untouched)
    const qx = x / rx, qy = dy / ry, k0 = Math.hypot(qx, qy), k1 = Math.hypot(qx / rx, qy / ry);
    return -(k1 < 1e-9 ? -Math.min(rx, ry) : k0 * (k0 - 1) / k1); } }));
  if (FB.sideX) planeCuts.push(cut({ t: 3, k: FB.sideK, bx0: 0, by0: 0, bz0: 0, br: 1e9, f: (x, y, z) => Math.max((FB.sideX + FB.sideSlope * ramp(FB.sideZ - z) - Math.abs(x)) / Math.hypot(1, FB.sideSlope * ramp1(FB.sideZ - z)), 0.86 - y) }));
  // ears go on after the shape cuts (so the chin cut and flat planes don't clip them), their hollows right after
  const isEar = (k) => /^ear(Lobe|Fill|Tip)?\./.test(k);
  const HEAD = G([...Object.entries(P).filter(([k]) => isHead(k) && k !== "nose" && !isEar(k)).map(([, v]) => v), ...(faceBox ? [faceBox] : []), ...Object.entries(CUT).filter(([k]) => !isEar(k)).map(([, v]) => v), ...planeCuts,
    ...Object.entries(P).filter(([k]) => isEar(k)).map(([, v]) => v), ...Object.entries(CUT).filter(([k]) => isEar(k)).map(([, v]) => v), BRIDGE, P.nose], 0.022);   // 鼻筋と鼻は削ったあとに足す
  // 目のくぼみ(眼窩): 目が大きく平たいので、広く浅く、なだらかに沈める。下側に広く(目の下半分が前に出ないように)
  const SOCK_K = OPT.body.sculpt.socketScale ?? 1;   // 0 = no eye sockets (a flat face under the eyes: drawn eyes stay straight from any angle)
  // socketSize: the whole socket (its dips and the band toward the temple) scaled around the eye's middle, its depth with it (2026-10-07, Saori:
  // "眼窩が輪郭に影響しないよう、目を眼窩ごとすこし小さく"): smaller eyes with their sockets, so the band no longer reaches the face's outline
  const SS = OPT.body.sculpt.socketSize ?? 1;
  const socket = (X0, Y0, z) => { if (!SOCK_K) return 0; let d = 0; const zf = sstep(0.03, 0.11, z);   // zf: the wide dip under the eyes stays on the front of the face (wide, it reached the ears and made them jagged)
    for (const m of [1, -1]) { const ecx = m * (0.112 + EX), ecy = 0.998 + FACE_DY + EY, x = SS === 1 ? X0 : ecx + (X0 - ecx) / SS, y = SS === 1 ? Y0 : ecy + (Y0 - ecy) / SS;
      const dx = x - m * (0.128 + EX), dy = y - 0.995 - FACE_DY - EY, ry = dy > 0 ? 0.088 : 0.105;
      if (dx * m <= 0 || !SOCK_BAND.on) { const r = Math.hypot(dx / (dx * m > 0 ? SOCKET_OUT : 0.09), dy / ry); if (r < 1) d += 0.014 * (1 - r * r) ** 2; }
      else { const v = Math.abs(dy) / ry, t = dx * m / SOCK_BAND.len;   // 目じり側: 上下のふちは平行のまま、頭の横へ向かってなだらかに浅くなる(1点にすぼまらない)
        if (v < 1 && t < 1) d += 0.014 * (1 - v * v) ** 2 * (1 - t * t) ** 2 * (1 - SOCK_BAND.lift * Math.min(1, t * 2)); }
    { const ix = (x - m * SOCK_IN.x) / SOCK_IN.w, iy = dy / SOCK_IN.h, ir = ix * ix + iy * iy; if (ir < 1) d += SOCK_IN.d * (1 - ir) ** 2; }   // 目頭側(鼻すじのとなり)を少し引っこめて、目の乗る面を平らに
    { const ex = x - m * EYE_UNDER.x, ux = ex / (ex * m > 0 ? EYE_UNDER.wo : EYE_UNDER.wi), uy = (dy - EYE_UNDER.y) / EYE_UNDER.h, ur = ux * ux + uy * uy; if (ur < 1) d += EYE_UNDER.d * (1 - ur) ** 2; }   // 目の下だけ: 目じり側は早めに消す
    const ly = dy + SOCKET_LOW.y, lr = Math.hypot(dx / SOCKET_LOW.w, ly / (ly > 0 ? SOCKET_LOW.hu : SOCKET_LOW.h)); if (lr < 1) d += SOCKET_LOW.d * (1 - lr * lr) ** 2 * zf; } return d * SOCK_K * SS; };   // 目の下半分のうしろ: 前に出ないよう、広くなだらかに沈める(横に広いので、描いた目の横線は上から見ても曲がりにくい。狭いと穴に見えた)
  // 顔の側面の目じりのあたりを少し前(外)へ出す。眼窩の帯の外の端あたりを中心に、上下は帯と同じ幅で、なだらかに
  const temple = (x, y, z) => { if (z < -0.02) return 0; let d = 0, trim = 0; for (const m of [1, -1]) { const dx = (x - m * TEMPLE.x) / TEMPLE.w, dy = (y - TEMPLE.y) / TEMPLE.h, r = dx * dx + dy * dy; if (r < 1) d += TEMPLE.d * (1 - r) ** 2; } for (const m of [1, -1]) { const dx = (x - m * CHEEK_FILL.x) / CHEEK_FILL.w, dy = (y - CHEEK_FILL.y) / CHEEK_FILL.h, r = dx * dx + dy * dy; if (r < 1) d += CHEEK_FILL.d * (1 - r) ** 2; }   // 目の下〜鼻の横のほお(上から見てこけないように)
    for (const m of [1, -1]) { const dx = (x - m * SIDE_TRIM.x) / SIDE_TRIM.w, dy = (y - SIDE_TRIM.y) / SIDE_TRIM.h, r = dx * dx + dy * dy; if (r < 1) trim += SIDE_TRIM.d * (1 - r) ** 2; }   // ほおの横のでっぱりを少し抑える(上・斜めから見て角ばらないように)
    return d * Math.min(1, Math.max(0, (z - TEMPLE_Z0) / 0.06)) - trim; };   // 前を向いた面だけ前へ出す(横には広げない)
  if (!slow) HEAD.f = blendFast(HEAD.list, [-0.32, 0.7, -0.34], [0.32, 1.44, 0.4], OPT.quality.headCell);   // 頭の部品も速い版で
  // a groove around where the nose meets the face (a thin ring around the nose base, front of the face only), so the nose stands out from the face
  const NG = OPT.body.sculpt.noseGroove;
  const groove = (x, y, z) => { if (!NG.depth || z < 0.1) return 0; const r = Math.hypot(x / NG.rx, (y - NG.y) / NG.ry), t = (r - 1) * Math.min(NG.rx, NG.ry) / NG.width; return NG.depth * Math.exp(-t * t) * sstep(0.1, 0.16, z); };
  // faceNarrow: squeeze the head sideways only below the brows (k at y0 and below, none from y1 up), so the face gets narrower while the
  // skull above stays as wide; the eye sockets aren't squeezed, so they stay under the eyes of the face picture
  const FN = OPT.body.sculpt.faceNarrow, faceWarp = (y) => FN.k === 1 ? 1 : 1 - (1 - FN.k) * (1 - sstep(FN.y0, FN.y1, y));
  if (FN.k !== 1) { const f0 = HEAD.f, kmin = Math.min(1, FN.k); HEAD.f = (x, y, z) => f0(x / faceWarp(y), y, z) * kmin; }
  // faceWiden: the face's sides moved out by shift, as they are (2026-10-07, Saori: "輪郭の左右の角度は変えずに並行移動する方法はないんですかね";
  // faceNarrow's factor moved the cheeks out more than the jaw, so the sides opened toward the top): a band beside the middle (from inner,
  // width wide) is stretched across, and everything outside it moves out by shift, so the outline keeps its angles. Only between the brows
  // (fading out from y0 up to y1) and above the chin (fading out from yc1 down to yc0), so the skull and the chin's point stay; the ears move
  // with the sides; the eye sockets (added after) stay under the eyes. Across it only shrinks distances; the fades shear it up and down a
  // little, so the distance is scaled by KW (it never overstates)
  const FW = OPT.body.sculpt.faceWiden ?? {}, FWD = FW.shift ?? 0;
  if (FWD) { const f0 = HEAD.f, X0 = FW.inner ?? 0.1, BW = (FW.band ?? 0.06) + FWD, Y0 = FW.y0 ?? 1.02, Y1 = FW.y1 ?? 1.12, C0 = FW.yc0 ?? OPT.body.sculpt.chin.y, C1 = FW.yc1 ?? OPT.body.sculpt.chin.y + 0.07;
    const KW = 1 / (1 + 1.5 * FWD / Math.min(Y1 - Y0, C1 - C0));
    HEAD.f = (x, y, z) => { const a = Math.abs(x), s = FWD * (1 - sstep(Y0, Y1, y)) * sstep(C0, C1, y) * sstep(X0, X0 + BW, a); return f0(Math.sign(x) * (a - s), y, z) * KW; }; }
  // chin.taper (0–1): a pointed chin in straight lines under round cheeks (2026-10-07, Saori: "頬丸いまま顎を尖らせるようにできませんか"; the old
  // chin.sharp hollowed the cheeks). The face's front outline is measured (its half width W(y), seen from the front over z ≥ 0: the ears and
  // the back of the head left out). It is convex all the way down, so no line from the chin touches it from outside: the jaw is cut along the
  // straight line from just above the chin's bottom (narrowed by taper) to the outline at a joint (higher with taper), below the joint only,
  // and the joint is softened (over 0.04, head space): the cheeks above stay round, the jaw runs straight to the point. Measured per face, so it fits any
  // face without tuning. Front only (fading out behind z 0 to −0.12, so under the ears it doesn't carve)
  const TP = 0.65 * Math.min(1, OPT.body.sculpt.chin.taper ?? 0);   // (the slider's 1: beyond about this the cut reached the chin's tip and shortened it)
  if (TP > 0) { const f0 = HEAD.f, CY = OPT.body.sculpt.chin.y, Ws = []; let prev = 0.12;
    const halfWidth = (y, from) => { for (let x = from; x > 0; x -= 0.001) for (let z = 0; z <= 0.25; z += 0.02) if (f0(x, y, z) < 0) return x; return 0; };
    for (let y = CY - 0.04; y < CY + 0.15; y += 0.002) { const w = halfWidth(y, Math.min(0.3, prev + 0.03)); Ws.push([y, w]); if (w) prev = w; }
    const at = (y) => Ws.reduce((b, q) => Math.abs(q[0] - y) < Math.abs(b[0] - y) ? q : b)[1];
    const tip = Ws.find(([, w]) => w > 0.002), YA = (tip ? tip[0] : CY) + 0.01, HA = at(YA) * (1 - 0.7 * TP), YT = YA + 0.025 + 0.035 * TP, WT = at(YT);
    if (WT > HA) { const S = (WT - HA) / (YT - YA), L = Math.hypot(1, S), smax = (a, b, k) => -smin(-a, -b, k);
      HEAD.f = (x, y, z) => { const d = f0(x, y, z), w = (1 - sstep(YT - 0.005, YT + 0.02, y)) * sstep(-0.12, 0, z); if (w <= 0) return d;
        const c = (Math.abs(x) - HA - S * (y - YA)) / L; return d + w * (smax(d, c, 0.006) - d); }; } }
  { const f0 = HEAD.f; HEAD.f = (x, y, z) => f0(x, y, z) + socket(x, y, z) - temple(x, y, z) + groove(x, y, z); }
  // head size / width / depth: the head is built in its own space, then scaled around a pivot at the top of the neck
  const HT = headTransform({ ...OPT.body.head, lift: LIFT, jawY: JAW_Y, crownY: (OPT.face?.layout?.browY ?? 1.092) + 0.018 }), HEAD_RAW = { ...HEAD };   // (crown: bent just over the brows)
  if (!HT.identity) { const f0 = HEAD_RAW.f, c = HT.fromHead(HEAD.bx0, HEAD.by0, HEAD.bz0); HEAD.f = HT.wrap(f0); [HEAD.bx0, HEAD.by0, HEAD.bz0] = c; HEAD.br = HEAD_RAW.br * HT.max; }
  const CROTCH = cut(E([0, OPT.body.sculpt.crotch.y + HL, 0], [OPT.body.sculpt.crotch.width, OPT.body.sculpt.crotch.height, 0.13], "hips", 0.02));   // 股下を少し上げる(左右の脚のあいだを上へ削る)
  const KNEE_OUT = [1, -1].map((m) => cut(E([m * (KNEE_X + OPT.body.sculpt.knee.outer.x), OPT.body.sculpt.knee.outer.y, 0], [OPT.body.sculpt.knee.outer.width, OPT.body.sculpt.knee.outer.height, 0.06], "hips", 0.02)));   // 膝の外側を少し入りこませる
  const KNEE_IN = cut(E([0, OPT.body.sculpt.knee.inner.y, 0], [OPT.body.sculpt.knee.inner.width * Math.min(1, KNEE_X / 0.108), OPT.body.sculpt.knee.inner.height, 0.09], "hips", 0.02));   // 正面から見た膝の内側を少し引き締める(左右の膝のあいだを削る)
  // 脇の下のくぼみ(2026-10-02 サオリ「青い線(脇)を上げればいい。女の子より上げる必要はない」)。腕の付け根は胴の中にあるので、胸の太い体型(幼児)は
  //   腕と胴が脇より4cm下までひとかたまりになり、腕を上げると水かきのように伸びた。腕の下側の線より下・胴の側面(女の子の幅 x)より外・前後の帯の中だけを削る
  //   = 胸の前と背中の肉は残る(本物の脇と同じく、前後のひだにはさまれたくぼみ)。もともと腕と胴が離れている体型では空を削るだけで形は変わらない
  const AP = OPT.body.sculpt.armpit ?? {};
  const ARMPIT = AP.on === false ? [] : [1, -1].map((m) => { const s = m > 0 ? "L" : "R", ja = J[`upperArm.${s}`], jb = J[`lowerArm.${s}`], a = [Math.abs(ja[0]), ja[1]], b = [Math.abs(jb[0]), jb[1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);   // 右側も左と同じ向きの座標で(X = |x| で計算するので、関節も |x| にそろえる)
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = uy, ny = -ux, r = P[`upperArm.${s}`].ra + (AP.margin ?? 0.004);   // n: 腕の下側(下・内向き)
    const A0 = [(AP.x ?? 0.105) + 0.6 * SHW, AP.y ?? 0.67], B0 = [(AP.x ?? 0.105) + 0.05 + 0.3 * SHW, (AP.y ?? 0.67) - 0.1], dl = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]), qx = -(B0[1] - A0[1]) / dl, qy = (B0[0] - A0[0]) / dl;   // 胴の側面の線(外向きの法線 q)
    const ZW = AP.depth ?? 0.07, RND = AP.round ?? 0.02;
    return { t: 3, sub: true, k: AP.blend ?? 0.015, bone: "chest", bx0: m * 0.15, by0: 0.64, bz0: 0, br: 0.14,
      f: (x, y, z) => { const X = x * m; if (X <= 0) return 1; const c1 = r - ((X - a[0]) * nx + (y - a[1]) * ny), c2 = -((X - A0[0]) * qx + (y - A0[1]) * qy), c4 = Math.abs(z) - ZW;
        const cut0 = -smin(-(-smin(-c1, -c2, RND)), -c4, RND);
        // adult: only under the shoulder joint. The torso's side line (c2) runs on inward above the armpit, and on the slim adult chest it
        // reached the collarbones: holes in the mesh there (2026-10-08)
        return AD ? -smin(-cut0, -(y - (a[1] - 0.015)), RND) : cut0; } }; });   // 角を丸める(とがった先は細いひびになって、メッシュに切れ端が出た)
  const BODY_LIST = [...Object.entries(P).filter(([k]) => !isHead(k) && !/^(sleeve|leghole|toeBox|shoeLast)/.test(k)).map(([, v]) => v), CROTCH, ...(AD ? [] : [KNEE_IN, ...KNEE_OUT]), ...ARMPIT, ...FOOT_CUT, HEAD];
  const BX = 0.5 + armReach(OPT).x;   // (longer arms and wider shoulders reach further out)
  const HB = heelBend(OPT), bent = (f) => HB ? (x, y, z) => f(x, HB(x, y, z), z) : f;   // in heels the forefoot bent up (heelBend)
  const bodySdfSlow = bent(blend(BODY_LIST)), bodySdf = slow ? bodySdfSlow : bent(blendFast(BODY_LIST, [-BX, -0.04, -0.34], [BX, 1.46, 0.4], OPT.quality.bodyCell));   // ?slow で元の遅い版(確認用)
  const bodySdfRaw = HT.identity ? bodySdf : bent(blendFast(BODY_LIST.map((p) => p === HEAD ? HEAD_RAW : p), [-BX, -0.04, -0.34], [BX, 1.46, 0.4], OPT.quality.bodyCell));   // the body with the head untransformed (hair is built against it, then transformed with the head)
  return { J, PARENT, BONES, BI, HANDS, P, CUT, EARS, faceWarp, PLANES: planeCuts, BODY, HEAD, CROTCH, ARMPIT, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT };
}

/**
 * Scale the head around a pivot at the top of the neck. h = { scale, width (x), depth (z), pivotY, pivotZ, shift: { z, z0, z1 }, lift }.
 * lift: then move it up (a longer neck).
 * shift: everything in front of z1 (head space) moves back by z, fading in between z0 and z1, so the head gets shorter front to back
 * while the side silhouette keeps its shape (skin, hair and face picture move together).
 * jawLength (> 1, with jawY: just under the mouth): below jawY the face is that much longer, at the front only (fading out behind the
 * cheeks, so the nape and the ears stay), with a soft bend (about 1 cm). The nose and mouth above it stay where they are: the jaw gets longer,
 * so a pointed chin has room below the cheeks (2026-10-07, Saori: "顎をとがらせれば美少女っぽくなりますが、そうするには今のモデルは頬から下が
 * 短すぎてこけてしまってた"; faceLength, taken out, stretched from under the eyes and brought the nose and mouth down too).
 * toHead: world point → head-space point. fromHead: the reverse. wrap(sdf): a head-space distance function seen in world space.
 */
export function headTransform(h) {
  const sx = h.scale * h.width, sy = h.scale, sz = h.scale * h.depth, py = h.pivotY, pz = h.pivotZ, S = h.shift ?? { z: 0 }, ly = h.lift ?? 0;
  const warp = S.z ? (z) => z + S.z * sstep(S.z0, S.z1, z) : (z) => z, unwarp = S.z ? (z) => { let w = z; for (let i = 0; i < 4; i++) w = z - S.z * sstep(S.z0, S.z1, w); return w; } : (z) => z;
  const stretch = S.z ? 1 + 1.5 * S.z / (S.z1 - S.z0) : 1;   // the warp stretches distances by up to this much; divide it out so distances never overstate
  // the jaw: JS(y, z) a stretched height → the head's own, JU back (a few steps; its slope stays under 1)
  const JL = h.jawLength ?? 1, JY = h.jawY ?? 0.88, JK = 1 - 1 / JL, fr = (d) => 0.5 * (d + Math.sqrt(d * d + 0.0001)), fa = (z) => sstep(-0.06, 0.08, z);
  const JS = JL === 1 ? (y) => y : (y, z) => y + JK * fa(z) * fr(JY - y), JU = JL === 1 ? (y) => y : (y, z) => { let v = y; for (let i = 0; i < 8; i++) v = y - JK * fa(z) * fr(JY - v); return v; };
  // crown (2026-10-07, Saori: "あたまの横幅はあるけど縦幅がなくて、シルヴィの眉毛より上を縮めたい"): above crownY (just over the brows) the head is
  // that much as tall (front and back alike, with a soft bend): the skull, the hair, its tails and ties, what is put on the head all come down
  // together, and the face under the brows stays. CS: a squashed height → the head's own, CU back
  const CR = h.crown ?? 1, CRY = h.crownY ?? 1.11, CK = 1 / CR - 1;
  const CS = CR === 1 ? (y) => y : (y) => y + CK * fr(y - CRY), CU = CR === 1 ? (y) => y : (y) => { let v = y; for (let i = 0; i < 10; i++) v = y - CK * fr(v - CRY); return v; };
  const identity = sx === 1 && sy === 1 && sz === 1 && !S.z && !ly && JL === 1 && CR === 1, k = Math.min(sx, sy, sz) / stretch * (JL === 1 ? 1 : 0.9) * Math.min(1, CR);
  const toHead = (x, y, z) => { const Z = warp(pz + (z - pz) / sz); return [x / sx, CS(JS(py + (y - ly - py) / sy, Z)), Z]; };
  return {
    identity, sx, sy, sz, k, max: Math.max(sx, sy, sz) * JL * Math.max(1, CR),
    toHead,
    fromHead: (x, y, z) => [x * sx, py + (JU(CU(y), z) - py) * sy + ly, pz + (unwarp(z) - pz) * sz],
    wrap: (f) => identity ? f : (x, y, z) => f(...toHead(x, y, z)) * k,
  };
}

/** A box with rounded edges (center c, half sizes h, edge radius r), as a head part blended with k. */
function roundBox(c, h, r, k) {
  return { t: 3, k, bone: "head", bx0: c[0], by0: c[1], bz0: c[2], br: Math.hypot(...h),
    f: (x, y, z) => { const qx = Math.abs(x - c[0]) - (h[0] - r), qy = Math.abs(y - c[1]) - (h[1] - r), qz = Math.abs(z - c[2]) - (h[2] - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; } };
}

/**
 * Proportions (body.proportion: legs, torso): the body is built at the base proportions, then stretched upward. The legs (from just above the
 * ankle to the hip joint) and the torso (hip joint to the neck) get longer by their factors; their widths stay, so the figure gets taller and
 * slimmer. Below, nothing changes (the feet and shoes keep their shape); above the neck everything moves up as one (the head, the face, the hair).
 * Every mesh is made at the base proportions and its points are moved by fwd (normals by the slope); bones likewise. The changes between the
 * parts fade over a few cm (no kink in the shading).
 * Returns { identity, fwd(y), inv(y), slope(y), k (the least a distance shrinks: for distances read through inv), lift (how far the head moved), legK }.
 * Rigid arms (body.proportion.arms set, 2026-10-06): the arms are not stretched; they move up with the shoulder as one piece (armDy). A point's
 * share on the arm bones (a: its skin weights there, 0..1) says how much: up(y, a) / upSlope(y, a) / down(Y, a) are fwd / slope / inv for it.
 * bone(name, y): where a joint goes. Without rigid arms they are fwd / slope / inv whatever a.
 */
export const isArmBone = (b) => /^(upperArm|lowerArm|hand|fingers|fingerTips|thumb)\./.test(b);
export function makeStretch(OPT, J) {
  const PR = OPT.body.proportion ?? {}, sL = PR.legs ?? 1, sT = PR.torso ?? 1;
  // adult: the leg under the knee leans back (2026-10-08, Saori: "膝から下が後ろにずれてなくない？"; her VRoid body's ankle is 2.4 cm behind its
  // knee, ours was ahead of it): every point is moved back by shz(y) (base height), 0 at the knee to adult.shinBack (m, < 0) at the ankle and
  // below, smoothly; bones, body, shoes and clothes alike (applied with the stretch, index.js). shzD: its slope, for the normals
  const AO = OPT.body.adult?.on ? OPT.body.adult : null, yk = J["lowerLeg.L"][1], ya0 = J["foot.L"][1], FZ = AO ? (AO.shinBack ?? -0.025) : 0;
  const shz = !FZ ? () => 0 : (y) => FZ * sstep(yk, ya0, y), shzD = !FZ ? () => 0 : (y) => (shz(y + 0.0005) - shz(y - 0.0005)) / 0.001;
  if (sL === 1 && sT === 1) { const id = (y) => y; return { identity: true, fwd: id, inv: id, slope: () => 1, k: 1, lift: 0, legK: 1, rigid: false, armDy: 0, up: id, upSlope: () => 1, down: id, bone: (b, y) => y, shz, shzD }; }
  const ya = 0.12, yh = J["upperLeg.L"][1], yn = J.neck[1], w = 0.03, Y0 = -0.2, D = 0.0005, N = Math.ceil((2.6 - Y0) / D);
  // 脚が伸びるのは股（骨盤の底）から下だけ。股関節までを伸ばしていたので、骨盤の底も一緒に伸びて股が垂れ、股上が長く見えた
  // （2026-10-06 サオリ「足の長さ伸ばすと股上ものびる」）。骨盤の底 = pelvis の楕円の下端 ≈ 股関節の 0.08 下
  const yc = yh - 0.08;
  const box = (y, a, b) => sstep(a - w, a + w, y) * (1 - sstep(b - w, b + w, y));
  // 胴の伸びは おなか・腰が受け持ち、胸はあまり伸ばさない(2026-10-06 サオリ「高等身にしたとき胸が引き延ばされてたてにのびる」。body-fixes 3a352c6 から):
  // 首と股関節の高さは前と同じ。胸(胸の関節の 4 cm 下から首まで)は胴の伸びの CHEST 割(body.proportion.chest、既定 0.3)、残りを おなか・腰が
  const yw = Math.min(yn - 0.06, J.chest[1] - 0.04), CHEST = PR.chest ?? 0.3;
  const sc = 1 + (sT - 1) * CHEST, sw = 1 + ((sT - 1) * (yn - yh) - (sc - 1) * (yn - yw)) / (yw - yh);
  const slope = (y) => 1 + (sL - 1) * box(y, ya, yc) + (sw - 1) * box(y, yh, yw) + (sc - 1) * box(y, yw, yn);
  const F = new Float64Array(N + 1); for (let i = 1; i <= N; i++) F[i] = F[i - 1] + D * slope(Y0 + (i - 0.5) * D);   // fwd(Y0 + i D) - Y0
  const fwd = (y) => { const t = (y - Y0) / D; if (t <= 0) return y; if (t >= N) return Y0 + F[N] + (y - Y0 - N * D); const i = Math.floor(t); return Y0 + F[i] + (F[i + 1] - F[i]) * (t - i); };
  const inv = (y) => { const v = y - Y0; if (v <= 0) return y; if (v >= F[N]) return Y0 + N * D + (v - F[N]);
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m] <= v) lo = m; else hi = m; } return Y0 + (lo + (v - F[lo]) / (F[hi] - F[lo])) * D; };
  const rigid = PR.arms != null, ys = J["upperArm.L"][1], armDy = rigid ? fwd(ys) - ys : 0;
  const up = (y, a) => !rigid || !a ? fwd(y) : (1 - a) * fwd(y) + a * (y + armDy), upSlope = (y, a) => !rigid || !a ? slope(y) : (1 - a) * slope(y) + a;
  const down = (Y, a) => { if (!rigid || !a) return inv(Y); if (a >= 1) return Y - armDy;
    let lo = Math.min(inv(Y), Y - armDy), hi = Math.max(inv(Y), Y - armDy); for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (up(m, a) < Y) lo = m; else hi = m; } return (lo + hi) / 2; };
  return { identity: false, fwd, inv, slope, k: 1 / Math.max(1, sL, sc, sw), lift: fwd(yn + 0.1) - (yn + 0.1), legK: (fwd(yh) - fwd(ya)) / (yh - ya),
    rigid, armDy, up, upSlope, down, bone: (b, y) => rigid && isArmBone(b) ? y + armDy : fwd(y), shz, shzD };   // bone: where a joint at base height y goes
}
