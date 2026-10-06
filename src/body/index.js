// The body: joints (bones) and the signed-distance parts that make the naked body, head and face sculpt.
import { handFrame } from "../clothes/weapons.js";
import { smin, E, axes, cut, G, C, dPrim, blend, blendFast, plane, sstep, thicken } from "../sdf/prim.js";
const HEAD_SCALE0 = 0.9;   // the head size the neck width is set for (neck.follow): the chibi's, the default until 2026-10-06 (not DEFAULTS' now: every neck would change)

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
  const J = {
    hips: [0, 0.42 + HL * 0.5, 0], spine: [0, 0.5, 0.01], chest: [0, 0.62, 0], upperChest: [0, 0.68, -0.005], neck: [0, 0.74, -0.005], head: [0, 0.82, 0],
    "shoulder.L": [0.03, 0.732, -0.005], "upperArm.L": [0.115, 0.732, 0], "lowerArm.L": [0.232, 0.612, 0.005], "hand.L": [0.322, 0.52, 0.01],
    "upperLeg.L": [0.11, HIP_Y, 0], "lowerLeg.L": [KNEE_X, 0.25, -0.006], "foot.L": [FOOT_X, 0.085, -0.005],
  };
  // neck.length: a longer neck lifts the head (its bone and everything built in head space: the head, the face, the hair; headTransform's lift)
  const NK = OPT.body.sculpt.neck, LIFT = NK.length ?? 0; J.head[1] += LIFT;
  for (const k of Object.keys(J)) if (k.endsWith(".L")) { const v = J[k]; J[k.replace(".L", ".R")] = [-v[0], v[1], v[2]]; }
  // 背中は3か所で曲がる(spine 0.50 / chest 0.62 / upperChest 0.68)=丸まった背中が段にならず曲線になる。
  // 肩の骨(鎖骨)は首の付け根から肩の関節まで、肩の高さで水平にのびる=両肩は肩の高さで回る(2026-10-02 サオリ。旧=upperChestを肩の高さ0.732に置いていた)
  const PARENT = { hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck" };
  for (const s of ["L", "R"]) Object.assign(PARENT, { [`shoulder.${s}`]: "upperChest", [`upperArm.${s}`]: `shoulder.${s}`, [`lowerArm.${s}`]: `upperArm.${s}`, [`hand.${s}`]: `lowerArm.${s}`, [`upperLeg.${s}`]: "hips", [`lowerLeg.${s}`]: `upperLeg.${s}`, [`foot.${s}`]: `lowerLeg.${s}` });
  // スカートの前の骨(左右): ウエストの前、太ももの上の高さで回る。太ももの回転を写す(motion)=座ると前の布が太ももの上へ倒れる(股関節で回すと前の裾がお腹へはね上がる)
  for (const s of ["L", "R"]) { J[`skirt.${s}`] = [(s === "L" ? 1 : -1) * 0.08, HIP_Y + 0.08, 0.09]; PARENT[`skirt.${s}`] = "hips"; }
  // 指の骨(左右に3本): 4本の指の付け根(fingers)・指の中ほど(fingerTips)・親指の付け根(thumb)。ポーズで指を曲げてグーにする(motion の grip)
  //   指4本は1本の骨でまとめて曲げる(1本ずつは動かさない)。手の向き(D=指の向き N=手のひら S=親指の側)は weapons.js の handFrame と同じ
  const HANDS = {};
  for (const s of ["L", "R"]) { const H = handFrame(J, s), at = (o, ...t) => o.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0)); HANDS[s] = { D: H.D, N: H.N, S: H.S };
    J[`fingers.${s}`] = at(H.palm, [H.D, 0.022]); J[`fingerTips.${s}`] = at(H.palm, [H.D, 0.042], [H.N, 0.003]); J[`thumb.${s}`] = at(H.palm, [H.S, 0.04], [H.D, -0.008], [H.N, 0.006]);
    Object.assign(PARENT, { [`fingers.${s}`]: `hand.${s}`, [`fingerTips.${s}`]: `fingers.${s}`, [`thumb.${s}`]: `hand.${s}` }); }
  const BONES = Object.keys(PARENT);
  const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

  // 体の部品(見本の正面・横のシルエットに合わせた)
  const FOOT_H = OPT.body.sculpt.foot.thickness;   // 足の厚み(平たく)
  const SHOULDER_DROP = OPT.body.sculpt.shoulders.drop;   // 肩の頂点を下げる量(なで肩に)
  const P = {}, CUT = {}, EARS = [], FOOT_CUT = [];   // FOOT_CUT: the foot's front top shaved down to the toes
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
  P.neck = C([0, 0.725, -0.032], [0, 0.845 + LIFT, 0.006], 0.057 * NW, 0.056 * NW, "neck", 0.04);   // 首: 太さの変わらない柱を、上が前へ来るように少し倒す
  // the back of the neck reaching up to the base of the skull (which ends level at chin.napeY behind the ear, as a real skull's does): only
  // the back, so the throat and where it meets the jaw stay as they were (lengthening the whole neck filled the corner under the jaw)
  { const NN = NK.nape; if (NN?.on) P.nape = C([0, NN.y0, NN.z0], [0, NN.y1 + LIFT, NN.z1], NN.r * NW, NN.r * NW, "neck", NN.k); }
  P.trap = E([0, 0.77, -0.016 + 0.03 * (1 - (OPT.body.torso.back ?? 1))], [0.12, 0.03, 0.056 - 0.03 * (1 - (OPT.body.torso.back ?? 1))], "upperChest", 0.035);   // 首の根元から肩へ: 高めの位置から肩へつなぐ(首は台形に広げない)
  // torso shape (1 = the toddler body of the reference sheet): chest size, belly size (shrinks toward the back, the back line stays), waist pinch depth, hip width
  const TO = OPT.body.torso;
  const BD = 0.06 * (1 - (TO.back ?? 1));   // back < 1: a thinner back (the front stays; the back comes forward by BD)
  P.chest = E([0, 0.68, 0.015 + BD / 2], [0.13 * TO.chest, 0.1, 0.1 * TO.chest - BD / 2], "chest", 0.05);       // 胸は細め(脇の下を高くする)
  // bust (0 = none; a girl's chest, not the chest board): two round swellings on the front of the chest, kept apart (a valley between
  // them even when big). Each is an ellipsoid long above its center (it rises gently out of the chest), short below (a nearly level
  // underside); the forward point is a little low. The part holds the chest itself so the blend can be wider above than below
  // (a step under it); a wide blend above made a crease across the chest like a strap, so it stays narrow and the ellipsoid's long top does the slope.
  // P.bust.cloth: the same with the two sides joined across the middle, for the shirt (cloth bridges the valley)
  if (TO.bust) { const r = 0.058 * Math.cbrt(TO.bust), bx = Math.max(0.06 * Math.max(1, TO.chest), r * 1.05), cy = 0.645, ru = r * 1.45, rd = r * 0.72, rz = r * 0.9, KU = 0.03, KD = 0.007;
    const zf = 0.015 + 0.098 * TO.chest * Math.sqrt(1 - (bx / (0.13 * TO.chest)) ** 2), cz = zf - r * (0.6 - 0.5 * TO.bust), chest = P.chest;   // zf: the chest's front surface there
    const part = (e) => { const ell = (x, y, z) => { const ry = y > cy ? ru : rd, a = (Math.sqrt(x * x + e * e) - bx) / r, b = (y - cy) / ry, c = (z - cz) / rz, k0 = Math.hypot(a, b, c), k1 = Math.hypot(a / r, b / ry, c / rz); return k0 * (k0 - 1) / k1; };   // both sides at once (mirrored; e rounds the middle)
      return { t: 3, k: 0.002, bone: "chest", bx0: 0, by0: cy, bz0: cz, br: bx + ru + KU, f: (x, y, z) => smin(dPrim(chest, x, y, z), ell(x, y, z), KD + (KU - KD) * sstep(cy - 0.3 * r, cy + 0.9 * r, y)) }; };
    P.bust = Object.assign(part(0.01), { cloth: part(0.04) }); }
  P.belly = E([0, 0.52, -0.08 + 0.115 * TO.belly + BD / 2], [0.165 * TO.belly, 0.14, 0.115 * TO.belly - BD / 2], "spine", 0.1);  // おなかはぽっこり(下ぶくれ)
  // hips: a tall pelvis and a long, soft waist cut, so the side line runs from the waist out to the hips in one smooth curve
  // (a short pelvis and a short cut made the hips jut out suddenly with a corner, like a clay figurine)
  { const PV = OPT.body.sculpt.pelvis ?? {}, sq = PV.squash ?? 1;   // 底を HL 上げる: sq=1 なら上はそのまま(つぶす) / sq=0 なら形ごと上げる
    P.pelvis = E([0, 0.435 + HL * (1 - sq / 2), -0.005], [0.157 * TO.hips, 0.115 - HL * sq / 2, 0.1], "hips", PV.blend ?? 0.12); }
  if (TO.waist) for (const [sd, m] of [["L", 1], ["R", -1]]) P[`waist.${sd}`] = cut(E([m * (0.235 - TO.waist), 0.6, 0], [0.08, 0.16, 0.14], "spine", 0.08));   // くびれ: 脇腹を左右から削る(腕より前に溶かすので腕は削れない)
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
  CUT.mouth = plane((x, y, z) => (0.222 - OPT.body.sculpt.mouth.back - CHEEK_BACK * (1 - Math.exp(-x * x / CHEEK_W ** 2)) * (1 - sstep(0.88, 1.0, y)) + 0.9 * (y - 0.842) - 3.9 * (y - 0.842) ** 2 + LIP_CURVE * Math.max(0, y - 0.86) ** 3 + 10 * Math.max(0, y - MOUTH_FREE) ** 2 - NOSE_UNDER.dent * Math.exp(-(((y - NOSE_UNDER.dy) / (OPT.body.sculpt.nose.under.dentWidth ?? 0.014)) ** 2)) - z) / 1.15, 0.015);   // 鼻の下〜あご先は、なめらかに奥へ下がる斜めの面(鼻のところでは前へ逃がす)
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
    const ES = OPT.body.sculpt.ears.scale;   // ear size
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
    const EL = OPT.body.sculpt.ears.elf;
    if (EL?.on) { const up = EL.angle * Math.PI / 180, bk = EL.back * Math.PI / 180, L = EL.length * ES, W = EL.width * ES, FL = EL.flat, CV = EL.curve;
      const a = [m * Math.cos(bk) * Math.cos(up), Math.sin(up), -Math.sin(bk) * Math.cos(up)];   // out to the side, up by angle, back by back (degrees)
      const bu = nrm([-a[0] * a[1], 1 - a[1] * a[1], -a[2] * a[1]]), bn = nrm([a[1] * bu[2] - a[2] * bu[1], a[2] * bu[0] - a[0] * bu[2], a[0] * bu[1] - a[1] * bu[0]]);   // bu: up across the blade (the tip bends that way), bn: its face
      const s0 = ec.slice(), mid = s0.map((v, i) => v + a[i] * L * 0.5 + bu[i] * CV * L * 0.25);
      P[`earTip.${s}`] = { t: 3, k: EL.k, bone: "head", bx0: mid[0], by0: mid[1], bz0: mid[2], br: L * 0.6 + W + CV * L,
        f: (x, y, z) => { const d = [x - s0[0], y - s0[1], z - s0[2]], t = Math.min(1, Math.max(0, (d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) / L));
          const q = [0, 1, 2].map((i) => d[i] - a[i] * t * L - bu[i] * CV * L * t * t), qa = q[0] * a[0] + q[1] * a[1] + q[2] * a[2], qw = q[0] * bn[0] + q[1] * bn[1] + q[2] * bn[2];
          const qb = Math.sqrt(Math.max(0, q[0] * q[0] + q[1] * q[1] + q[2] * q[2] - qa * qa - qw * qw)), r = W * (1 - Math.pow(t, 1.3)) + 0.0015;   // a leaf: widest at the ear, to a point
          return (Math.hypot(qa, qb, qw / FL) - r) * FL * 0.9; } }; }
    EARS.push({ m, c: ec.slice(), eu: eu.slice(), ev: ev.slice(), ew: ew.slice(), ES });   // the ear's frame (head space), for the ear line
    CUT[`ear.${s}`] = cut(E(ec.map((v, i) => v + (ew[i] * 0.025 + eu[i] * 0.024) * ES), [0.026 * ES, 0.042 * ES, 0.011 * ES], "head", 0.014, [eu, ev, ew]));   // 耳の内側のくぼみ
    { const B = TO.butt ?? 1; P[`butt.${s}`] = E([m * 0.07 * TO.hips, OPT.body.sculpt.buttY ?? 0.452, -0.05 + 0.03 * (1 - B)], [0.08, 0.066, 0.075 * B], "hips", 0.05); }   // butt: how far the bottom sticks out at the back (1 = the reference sheet)
    { const ks = Math.min(1, 0.4 + 0.6 * OPT.body.thickness.upperArm); P[`shoulder.${s}`] = E([m * 0.116, 0.742 - SHOULDER_DROP, 0], [0.054 * ks, (0.045 - SHOULDER_DROP * 0.6) * ks, 0.048 * ks], `upperArm.${s}`, 0.04); }   // the shoulder slims with a thin upper arm (else it stays as a bump at the top of the arm)   // なで肩
    P[`upperArm.${s}`] = C(j("upperArm"), j("lowerArm"), 0.047, 0.043, `upperArm.${s}`, 0.022);   // 付け根は細く、脇はくっきり
    P[`foreArm.${s}`] = C(j("lowerArm"), j("hand"), 0.045, OPT.body.sculpt.forearm.wristRadius, `lowerArm.${s}`, OPT.body.sculpt.forearm.elbowBlend);   // ひじ: 溶かす幅を小さく(つなぎ目に余分な肉がついて一段ふくらまないように)
    { const a = j("lowerArm"), b = j("hand"), t = OPT.body.sculpt.forearm.bulge.start, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;   // ひじの下の前腕のふくらみ: 下寄りにふくらませ(上側は控えめ)、手首へ細くなりながらなめらかにつなぐ
      const nd = [m * uy, -m * ux], od = OPT.body.sculpt.forearm.bulge.offset, c = [a[0] + (b[0] - a[0]) * t + nd[0] * od, a[1] + (b[1] - a[1]) * t + nd[1] * od, a[2] + (b[2] - a[2]) * t];
      P[`foreBulge.${s}`] = C(c, [b[0] + nd[0] * od * 0.3, b[1] + nd[1] * od * 0.3, b[2]], OPT.body.sculpt.forearm.bulge.radius, OPT.body.sculpt.forearm.bulge.radiusEnd, `lowerArm.${s}`, OPT.body.sculpt.forearm.bulge.blend);
      Object.assign(P[`foreBulge.${s}`], { t: 4, n: [-0.483 * m, -0.876, 0], flat: OPT.body.sculpt.forearm.bulge.flat }); }   // 手のひらの向きに平たい(手首に向かって平たくしぼる。丸太にならないように)
    // 手: Aポーズで手のひらが下を向く。指4本(少し開く)+親指
    // 何か持つ手(outfit.weapon)は握りこぶし(手首はまっすぐのまま。柄は親指の側へ抜ける)
    const fist = ((OPT.outfit?.weapon ?? {})[s === "L" ? "left" : "right"] ?? "none") !== "none";
    const { w, D, N, S } = handFrame(J, s);   // D=指の向き N=手のひらの向き S=親指の側
    const at = (o, ...t) => o.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0));
    const palm = at(w, [D, 0.03], [N, 0.002]);
    P[`palm.${s}`] = E(palm, [0.034, 0.05, 0.019], `hand.${s}`, 0.02, [D, S, N]);   // 見本の手は大きめ(横から見ると扇に開く)
    // 握りこぶし: 指は付け根から手のひら側へ曲がって、もう一度内へ折れる(握った柄を包む)。親指は指の前にかぶさる
    [[0.039, 0.4, 0.04], [0.013, 0.13, 0.046], [-0.013, -0.13, 0.044], [-0.039, -0.4, 0.036]].forEach(([o, sp, len], i) => {
      const fd = D.map((v, k) => v * Math.cos(sp) + S[k] * Math.sin(sp)), b0 = at(palm, [D, 0.022], [S, o * (fist ? 0.85 : 1)]);
      if (fist) { const k1 = at(b0, [D, 0.014], [N, 0.026]); P[`finger${i}.${s}`] = C(b0, k1, 0.0125, 0.012, `fingers.${s}`, 0.006); P[`fingerTip${i}.${s}`] = C(k1, at(k1, [N, 0.012], [D, -0.022]), 0.012, 0.011, `fingerTips.${s}`, 0.006); return; }
      // 開いた指: 付け根側(fingers の骨)と先側(fingerTips の骨)の2本に分ける = 中ほどで曲がる。つなぎ目は溶かす幅を小さく(同じ太さの継ぎ目がふくらまないように)
      const mid = at(b0, [fd, len * 0.48], [N, 0.003]);
      P[`finger${i}.${s}`] = C(b0, mid, 0.0125, 0.012, `fingers.${s}`, 0.008);   // 指の股はくっきり
      P[`fingerTip${i}.${s}`] = C(mid, at(b0, [fd, len], [N, 0.006]), 0.012, 0.0115, `fingerTips.${s}`, 0.002);
    });
    const tb = at(palm, [S, 0.04], [D, -0.008], [N, 0.006]);
    P[`thumb.${s}`] = fist ? C(tb, at(tb, [S, -0.004], [D, 0.024], [N, 0.03]), 0.013, 0.011, `thumb.${s}`, 0.012) : C(tb, at(tb, [S, 0.022], [D, 0.016], [N, 0.016]), 0.013, 0.011, `thumb.${s}`, 0.012);
    { const a = j("upperLeg"), b = j("lowerLeg"), d = OPT.body.sculpt.thigh.topDrop ?? 0, L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);   // topDrop: 太ももの肉の上端だけを脚の向きに下げる(股関節=骨の回る点は動かさない)。外側の付け根の張り出しが下がり、くびれから腰へのカーブがゆるくなる
      P[`thigh.${s}`] = C(a.map((v, i) => v + (b[i] - v) * d / L), b, 0.08, 0.066, `upperLeg.${s}`, 0.05); }
    P[`thighB.${s}`] = E([m * 0.11, OPT.body.sculpt.thigh.back.y + HL, OPT.body.sculpt.thigh.back.z], [0.058, OPT.body.sculpt.thigh.back.height, OPT.body.sculpt.thigh.back.depth], `upperLeg.${s}`, 0.05);   // 太ももの裏: おしりからひざへ、うしろ側をなめらかにつなぐ(正面の幅は変えない)
    P[`thighF.${s}`] = E([m * 0.11, OPT.body.sculpt.thigh.front.y + HL, OPT.body.sculpt.thigh.front.z], [OPT.body.sculpt.thigh.front.width, OPT.body.sculpt.thigh.front.height, OPT.body.sculpt.thigh.front.depth], `upperLeg.${s}`, OPT.body.sculpt.thigh.front.blend);   // 太ももの前: 前側にも肉をつける(正面の幅は変えない)
    P[`thighIn.${s}`] = E([m * OPT.body.sculpt.thigh.inner.x, OPT.body.sculpt.thigh.inner.y + HL, 0.002], [OPT.body.sculpt.thigh.inner.width, OPT.body.sculpt.thigh.inner.height, 0.05], `upperLeg.${s}`, 0.04);   // 内もも: 付け根の内側に肉をつけて、ひざへまっすぐ絞る
    P[`calfO.${s}`] = E([m * (FOOT_X + OPT.body.sculpt.calf.outer.x), OPT.body.sculpt.calf.outer.y, -0.008], [OPT.body.sculpt.calf.outer.width, OPT.body.sculpt.calf.outer.height, 0.045], `lowerLeg.${s}`, 0.04);   // ふくらはぎの外側: 膝の下で外へふくらむ(見本の正面の線)
    P[`calf.${s}`] = C(j("lowerLeg"), j("foot"), 0.062, 0.057, `lowerLeg.${s}`, 0.05);
    P[`calfB.${s}`] = E([m * (FOOT_X - 0.008), 0.18, OPT.body.sculpt.calf.back.z], [OPT.body.sculpt.calf.back.width, 0.068, OPT.body.sculpt.calf.back.depth], `lowerLeg.${s}`, 0.05);   // ふくらはぎのふくらみ
    P[`foot.${s}`] = E([m * (FOOT_X - 0.002), -0.003 + FOOT_H, 0.015], [0.052, FOOT_H, 0.075], `foot.${s}`, 0.04);
    // toes (foot.toes, 2026-10-05, Saori: barefoot like Nahida; "足の指丸まってない？"): the foot's front top is shaved down to them (FOOT_CUT), so the
    // instep slopes to the toes instead of ending in a dome they sat under (curled-looking); the toes lie flat on the ground, pointing forward.
    // A shoe is made around the foot and a smooth toe box over them (toeBox: for the clothes only), so it covers them without their bumps.
    // Four along the front of the foot (chibi style), the big toe on the inside, each a
    // round piece joined with a narrow blend so the gaps between them show. Inside a shoe they are hidden (the body under it isn't drawn)
    // and within the shoe's shape (it is made around the foot alone, 1.2 cm out), so a shoe looks the same
    { const TS = OPT.body.sculpt.foot.toes; if (TS?.on) { const cx = m * (FOOT_X - 0.002), z0 = 0.015, k = TS.size ?? 1;
      [[-0.027, 0.06, 0.015, 0.0105, 0.02], [-0.005, 0.062, 0.0115, 0.0095, 0.017], [0.014, 0.057, 0.011, 0.009, 0.016], [0.031, 0.047, 0.0105, 0.0085, 0.015]].forEach(([dx, dz, rx, ry, rz], i) =>   // four: smaller than the grid the fifth only blurred the edge
        P[`toe${i}.${s}`] = E([cx + m * dx * k, -0.003 + ry * k + 0.001, z0 + dz * k], [rx * k, ry * k, rz * k], `foot.${s}`, 0.004));
      P[`toeBox.${s}`] = E([cx, 0.011, z0 + 0.058 * k], [0.05, 0.015, 0.032 * k], `foot.${s}`, 0.03);
      FOOT_CUT.push(cut(E([cx, 0.068, z0 + 0.085], [0.08, 0.04, 0.06], `foot.${s}`, 0.012))); } }
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
    for (const n of ["calf", "calfO", "calfB"]) thicken(P[`${n}.${s}`], j("lowerLeg"), j("foot"), TH.calf);
  }
  const isHead = (k) => /^(skull|occiput|face|jaw|chinTip|muzzle|nose|ear)/.test(k);
  const BRIDGE = C([0, 1.04 + NOSE_DY, 0.216], [0, 0.97 + NOSE_DY, 0.236], 0.009, 0.011, "head", 0.035);   // 鼻筋(凹ませたあとに足すので、目のあいだは鞍の形になる)
  const BODY = Object.entries(P).filter(([k, v]) => !/^(sleeve|leghole|toeBox)/.test(k) && !v.sub).map(([, v]) => v).concat(BRIDGE);   // 重みづけ用(削る部品は入れない)
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
  const socket = (x, y, z) => { if (!SOCK_K) return 0; let d = 0; const zf = sstep(0.03, 0.11, z);   // zf: the wide dip under the eyes stays on the front of the face (wide, it reached the ears and made them jagged)
    for (const m of [1, -1]) { const dx = x - m * (0.128 + EX), dy = y - 0.995 - FACE_DY - EY, ry = dy > 0 ? 0.088 : 0.105;
      if (dx * m <= 0 || !SOCK_BAND.on) { const r = Math.hypot(dx / (dx * m > 0 ? SOCKET_OUT : 0.09), dy / ry); if (r < 1) d += 0.014 * (1 - r * r) ** 2; }
      else { const v = Math.abs(dy) / ry, t = dx * m / SOCK_BAND.len;   // 目じり側: 上下のふちは平行のまま、頭の横へ向かってなだらかに浅くなる(1点にすぼまらない)
        if (v < 1 && t < 1) d += 0.014 * (1 - v * v) ** 2 * (1 - t * t) ** 2 * (1 - SOCK_BAND.lift * Math.min(1, t * 2)); }
    { const ix = (x - m * SOCK_IN.x) / SOCK_IN.w, iy = dy / SOCK_IN.h, ir = ix * ix + iy * iy; if (ir < 1) d += SOCK_IN.d * (1 - ir) ** 2; }   // 目頭側(鼻すじのとなり)を少し引っこめて、目の乗る面を平らに
    { const ex = x - m * EYE_UNDER.x, ux = ex / (ex * m > 0 ? EYE_UNDER.wo : EYE_UNDER.wi), uy = (dy - EYE_UNDER.y) / EYE_UNDER.h, ur = ux * ux + uy * uy; if (ur < 1) d += EYE_UNDER.d * (1 - ur) ** 2; }   // 目の下だけ: 目じり側は早めに消す
    const ly = dy + SOCKET_LOW.y, lr = Math.hypot(dx / SOCKET_LOW.w, ly / (ly > 0 ? SOCKET_LOW.hu : SOCKET_LOW.h)); if (lr < 1) d += SOCKET_LOW.d * (1 - lr * lr) ** 2 * zf; } return d * SOCK_K; };   // 目の下半分のうしろ: 前に出ないよう、広くなだらかに沈める(横に広いので、描いた目の横線は上から見ても曲がりにくい。狭いと穴に見えた)
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
  { const f0 = HEAD.f; HEAD.f = (x, y, z) => f0(x, y, z) + socket(x, y, z) - temple(x, y, z) + groove(x, y, z); }
  // head size / width / depth: the head is built in its own space, then scaled around a pivot at the top of the neck
  const HT = headTransform({ ...OPT.body.head, lift: LIFT }), HEAD_RAW = { ...HEAD };
  if (!HT.identity) { const f0 = HEAD_RAW.f, c = HT.fromHead(HEAD.bx0, HEAD.by0, HEAD.bz0); HEAD.f = HT.wrap(f0); [HEAD.bx0, HEAD.by0, HEAD.bz0] = c; HEAD.br = HEAD_RAW.br * HT.max; }
  const CROTCH = cut(E([0, OPT.body.sculpt.crotch.y + HL, 0], [OPT.body.sculpt.crotch.width, OPT.body.sculpt.crotch.height, 0.13], "hips", 0.02));   // 股下を少し上げる(左右の脚のあいだを上へ削る)
  const KNEE_OUT = [1, -1].map((m) => cut(E([m * (KNEE_X + OPT.body.sculpt.knee.outer.x), OPT.body.sculpt.knee.outer.y, 0], [OPT.body.sculpt.knee.outer.width, OPT.body.sculpt.knee.outer.height, 0.06], "hips", 0.02)));   // 膝の外側を少し入りこませる
  const KNEE_IN = cut(E([0, OPT.body.sculpt.knee.inner.y, 0], [OPT.body.sculpt.knee.inner.width, OPT.body.sculpt.knee.inner.height, 0.09], "hips", 0.02));   // 正面から見た膝の内側を少し引き締める(左右の膝のあいだを削る)
  // 脇の下のくぼみ(2026-10-02 サオリ「青い線(脇)を上げればいい。女の子より上げる必要はない」)。腕の付け根は胴の中にあるので、胸の太い体型(幼児)は
  //   腕と胴が脇より4cm下までひとかたまりになり、腕を上げると水かきのように伸びた。腕の下側の線より下・胴の側面(女の子の幅 x)より外・前後の帯の中だけを削る
  //   = 胸の前と背中の肉は残る(本物の脇と同じく、前後のひだにはさまれたくぼみ)。もともと腕と胴が離れている体型では空を削るだけで形は変わらない
  const AP = OPT.body.sculpt.armpit ?? {};
  const ARMPIT = AP.on === false ? [] : [1, -1].map((m) => { const s = m > 0 ? "L" : "R", ja = J[`upperArm.${s}`], jb = J[`lowerArm.${s}`], a = [Math.abs(ja[0]), ja[1]], b = [Math.abs(jb[0]), jb[1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);   // 右側も左と同じ向きの座標で(X = |x| で計算するので、関節も |x| にそろえる)
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = uy, ny = -ux, r = P[`upperArm.${s}`].ra + (AP.margin ?? 0.004);   // n: 腕の下側(下・内向き)
    const A0 = [AP.x ?? 0.105, AP.y ?? 0.67], B0 = [(AP.x ?? 0.105) + 0.05, (AP.y ?? 0.67) - 0.1], dl = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]), qx = -(B0[1] - A0[1]) / dl, qy = (B0[0] - A0[0]) / dl;   // 胴の側面の線(外向きの法線 q)
    const ZW = AP.depth ?? 0.07, RND = AP.round ?? 0.02;
    return { t: 3, sub: true, k: AP.blend ?? 0.015, bone: "chest", bx0: m * 0.15, by0: 0.64, bz0: 0, br: 0.14,
      f: (x, y, z) => { const X = x * m; if (X <= 0) return 1; const c1 = r - ((X - a[0]) * nx + (y - a[1]) * ny), c2 = -((X - A0[0]) * qx + (y - A0[1]) * qy), c4 = Math.abs(z) - ZW;
        return -smin(-(-smin(-c1, -c2, RND)), -c4, RND); } }; });   // 角を丸める(とがった先は細いひびになって、メッシュに切れ端が出た)
  const BODY_LIST = [...Object.entries(P).filter(([k]) => !isHead(k) && !/^(sleeve|leghole|toeBox)/.test(k)).map(([, v]) => v), CROTCH, KNEE_IN, ...KNEE_OUT, ...ARMPIT, ...FOOT_CUT, HEAD];
  const bodySdfSlow = blend(BODY_LIST), bodySdf = slow ? bodySdfSlow : blendFast(BODY_LIST, [-0.5, -0.04, -0.34], [0.5, 1.46, 0.4], OPT.quality.bodyCell);   // ?slow で元の遅い版(確認用)
  const bodySdfRaw = HT.identity ? bodySdf : blendFast(BODY_LIST.map((p) => p === HEAD ? HEAD_RAW : p), [-0.5, -0.04, -0.34], [0.5, 1.46, 0.4], OPT.quality.bodyCell);   // the body with the head untransformed (hair is built against it, then transformed with the head)
  return { J, PARENT, BONES, BI, HANDS, P, CUT, EARS, faceWarp, PLANES: planeCuts, BODY, HEAD, CROTCH, ARMPIT, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT };
}

/**
 * Scale the head around a pivot at the top of the neck. h = { scale, width (x), depth (z), pivotY, pivotZ, shift: { z, z0, z1 }, lift }.
 * lift: then move it up (a longer neck).
 * shift: everything in front of z1 (head space) moves back by z, fading in between z0 and z1, so the head gets shorter front to back
 * while the side silhouette keeps its shape (skin, hair and face picture move together).
 * toHead: world point → head-space point. fromHead: the reverse. wrap(sdf): a head-space distance function seen in world space.
 */
export function headTransform(h) {
  const sx = h.scale * h.width, sy = h.scale, sz = h.scale * h.depth, py = h.pivotY, pz = h.pivotZ, S = h.shift ?? { z: 0 }, ly = h.lift ?? 0;
  const warp = S.z ? (z) => z + S.z * sstep(S.z0, S.z1, z) : (z) => z, unwarp = S.z ? (z) => { let w = z; for (let i = 0; i < 4; i++) w = z - S.z * sstep(S.z0, S.z1, w); return w; } : (z) => z;
  const stretch = S.z ? 1 + 1.5 * S.z / (S.z1 - S.z0) : 1;   // the warp stretches distances by up to this much; divide it out so distances never overstate
  const identity = sx === 1 && sy === 1 && sz === 1 && !S.z && !ly, k = Math.min(sx, sy, sz) / stretch;
  return {
    identity, sx, sy, sz, k, max: Math.max(sx, sy, sz),
    toHead: (x, y, z) => [x / sx, py + (y - ly - py) / sy, warp(pz + (z - pz) / sz)],
    fromHead: (x, y, z) => [x * sx, py + (y - py) * sy + ly, pz + (unwarp(z) - pz) * sz],
    wrap: (f) => identity ? f : (x, y, z) => f(x / sx, py + (y - ly - py) / sy, warp(pz + (z - pz) / sz)) * k,
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
 */
export function makeStretch(OPT, J) {
  const PR = OPT.body.proportion ?? {}, sL = PR.legs ?? 1, sT = PR.torso ?? 1;
  if (sL === 1 && sT === 1) { const id = (y) => y; return { identity: true, fwd: id, inv: id, slope: () => 1, k: 1, lift: 0, legK: 1 }; }
  const ya = 0.12, yh = J["upperLeg.L"][1], yn = J.neck[1], w = 0.03, Y0 = -0.2, D = 0.0005, N = Math.ceil((2.6 - Y0) / D);
  const box = (y, a, b) => sstep(a - w, a + w, y) * (1 - sstep(b - w, b + w, y));
  const slope = (y) => 1 + (sL - 1) * box(y, ya, yh) + (sT - 1) * box(y, yh, yn);
  const F = new Float64Array(N + 1); for (let i = 1; i <= N; i++) F[i] = F[i - 1] + D * slope(Y0 + (i - 0.5) * D);   // fwd(Y0 + i D) - Y0
  const fwd = (y) => { const t = (y - Y0) / D; if (t <= 0) return y; if (t >= N) return Y0 + F[N] + (y - Y0 - N * D); const i = Math.floor(t); return Y0 + F[i] + (F[i + 1] - F[i]) * (t - i); };
  const inv = (y) => { const v = y - Y0; if (v <= 0) return y; if (v >= F[N]) return Y0 + N * D + (v - F[N]);
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m] <= v) lo = m; else hi = m; } return Y0 + (lo + (v - F[lo]) / (F[hi] - F[lo])) * D; };
  return { identity: false, fwd, inv, slope, k: 1 / Math.max(1, sL, sT), lift: fwd(yn + 0.1) - (yn + 0.1), legK: (fwd(yh) - fwd(ya)) / (yh - ya) };
}
