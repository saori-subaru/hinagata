// The body: joints (bones) and the signed-distance parts that make the naked body, head and face sculpt.
import { smin, E, axes, cut, G, C, dPrim, blend, blendFast, plane, sstep, thicken } from "../sdf/prim.js";

/**
 * Build the body from options.
 * slow: use the plain (unculled) blend, for checking. oldSock: the older eye-socket shape, for comparison.
 * Returns joints, bone names, parts, and the body's signed distance function.
 */
export function buildBody(OPT, { slow = false, oldSock = false } = {}) {
  // 関節(骨のつけ根)。寸法は見本から
  const FOOT_X = OPT.body.joints.footX;   // 足首の横位置(小さいほど内側に着く。がに股に見えないように)
  const KNEE_X = OPT.body.joints.kneeX;   // 膝の横位置(足首を内側に寄せたのに合わせる)
  const J = {
    hips: [0, 0.42, 0], spine: [0, 0.5, 0.01], chest: [0, 0.62, 0], upperChest: [0, 0.732, -0.005], neck: [0, 0.74, -0.005], head: [0, 0.82, 0],
    "upperArm.L": [0.115, 0.732, 0], "lowerArm.L": [0.232, 0.612, 0.005], "hand.L": [0.322, 0.52, 0.01],
    "upperLeg.L": [0.11, 0.4, 0], "lowerLeg.L": [KNEE_X, 0.25, -0.006], "foot.L": [FOOT_X, 0.085, -0.005],
  };
  for (const k of Object.keys(J)) if (k.endsWith(".L")) { const v = J[k]; J[k.replace(".L", ".R")] = [-v[0], v[1], v[2]]; }
  const PARENT = { hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck" };   // upperChest: 両肩をつなぐ点(肩の高さ)
  for (const s of ["L", "R"]) Object.assign(PARENT, { [`upperArm.${s}`]: "upperChest", [`lowerArm.${s}`]: `upperArm.${s}`, [`hand.${s}`]: `lowerArm.${s}`, [`upperLeg.${s}`]: "hips", [`lowerLeg.${s}`]: `upperLeg.${s}`, [`foot.${s}`]: `lowerLeg.${s}` });
  const BONES = Object.keys(PARENT);
  const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

  // 体の部品(見本の正面・横のシルエットに合わせた)
  const FOOT_H = OPT.body.sculpt.foot.thickness;   // 足の厚み(平たく)
  const SHOULDER_DROP = OPT.body.sculpt.shoulders.drop;   // 肩の頂点を下げる量(なで肩に)
  const P = {}, CUT = {};
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
  const SOCKET_LOW = { d: OPT.body.sculpt.socketLow.depth, y: 0.035, w: 0.085, h: 0.06, hu: OPT.body.sculpt.socketLow.heightUp };   // 上側は広くゆっくり消す(段が出ないように)   // 眼窩の下側を沈める量 / 中心の下がり / 横・縦の広がり   // 眼窩の外側(こめかみ側)への広がり
  const EAR = { flare: 0.7, tilt: 0.3, x: OPT.body.sculpt.ears.x ?? 0.24 * OPT.body.sculpt.skull.width / 0.249, y: OPT.body.sculpt.ears.y, lean: 0.6 };   // 耳: 後ろの縁の開き / 上ほど外へ倒す量 / 位置
  P.neck = C([0, 0.725, -0.032], [0, 0.845, 0.006], 0.057 * OPT.body.sculpt.neck.width, 0.056 * OPT.body.sculpt.neck.width, "neck", 0.04);   // 首: 太さの変わらない柱を、上が前へ来るように少し倒す
  P.trap = E([0, 0.77, -0.016], [0.12, 0.03, 0.056], "chest", 0.035);   // 首の根元から肩へ: 高めの位置から肩へつなぐ(首は台形に広げない)
  // torso shape (1 = the toddler body of the reference sheet): chest size, belly size (shrinks toward the back, the back line stays), waist pinch depth, hip width
  const TO = OPT.body.torso;
  P.chest = E([0, 0.68, 0.015], [0.13 * TO.chest, 0.1, 0.1 * TO.chest], "chest", 0.05);       // 胸は細め(脇の下を高くする)
  P.belly = E([0, 0.52, -0.08 + 0.115 * TO.belly], [0.165 * TO.belly, 0.14, 0.115 * TO.belly], "spine", 0.1);  // おなかはぽっこり(下ぶくれ)
  P.pelvis = E([0, 0.435, -0.005], [0.157 * TO.hips, 0.072, 0.1], "hips", 0.09);
  if (TO.waist) for (const [sd, m] of [["L", 1], ["R", -1]]) P[`waist.${sd}`] = cut(E([m * (0.215 - TO.waist), 0.575, 0], [0.05, 0.1, 0.14], "spine", 0.05));   // くびれ: 脇腹を左右から削る(腕より前に溶かすので腕は削れない)
  // 頭: 中だけでなめらかに溶かして、首とはくっきり分ける
  const SK = OPT.body.sculpt.skull;
  P.skull = E([0, SK.y, -0.005], [SK.width, SK.height, SK.depth], "head", 0.06);
  // skullTop: a slightly wider piece over the upper head (above the forehead), so the head widens there without changing the face
  { const ST = OPT.body.sculpt.skullTop; if (ST.extra) P.skullTop = E([0, ST.y, ST.z], [SK.width + ST.extra, ST.ry, ST.rz], "head", 0.06); }   // 頭(大きな丸。横幅・前後とも見本どおり)
  P.occiput = E([0, 1.0, -0.07], [0.17, 0.09, 0.14], "head", 0.08);   // 後頭部の下(首の上まで丸くふくらむ)
  P.face = E([0, 0.935, 0.08], [OPT.body.sculpt.cheeks.width, 0.115, 0.168], "head", 0.08);   // ほお〜あご(頭と同じ幅のまま下りて、なめらかにすぼまる)
  P.jaw = E([0, 0.868, 0.094], [OPT.body.sculpt.jaw.width, 0.062, 0.142], "head", 0.07);      // あご先(下は平らぎみ)
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
  CUT.chin = plane((x, y) => (y - CH.y + 0.014 * Math.exp(-x * x / 0.0032) - CH.curve * x * x) / Math.sqrt(1 + (CH.curve === 0.95 ? 4 : 4 * CH.curve * CH.curve) * x * x), CH.k);   // あご先: 顔の中心の一点だけ少し下げる   // あごの下: 真ん中の一点がいちばん低く、左右へ上がる
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
      P[`ear.${s}`] = { ...e0, t: 3, f: (x, y, z) => -smin(-dPrim(e0, x, y, z), -(n[0] * (x - ec[0]) + n[1] * (y - ec[1]) + n[2] * (z - ec[2]) - tc), 0.012) }; }   // 耳の後ろの下側をななめに落として、下へ細くとがらせる
    // earlobe: a small lump at the bottom front of the ear, against the head, so seen from the front the ear's lower edge first runs down from
    // where it meets the head, then turns out diagonally to the widest point (one more corner)
    const LB = OPT.body.sculpt.ears.lobe;
    if (LB) { const lo = rotE([-m * OPT.body.sculpt.ears.lobeIn, -0.056 * ES, 0.008]), lc = ec.map((v, i) => v + lo[i]);
      P[`earLobe.${s}`] = E(lc, [0.016 * LB * ES, 0.022 * LB * ES, 0.014 * LB * ES], "head", 0.016);
      // lobeFill: a straight piece from the lobe up to the ear's widest point, so the edge between them has no dip (without it: a big "lucky" earlobe)
      const LF = OPT.body.sculpt.ears.lobeFill;
      if (LF) { const tip = ec.map((v, i) => v + (eu[i] * LF.out + ev[i] * LF.up) * ES); P[`earFill.${s}`] = C(lc, tip, 0.011 * ES, 0.009 * ES, "head", 0.01); } }
    CUT[`ear.${s}`] = cut(E(ec.map((v, i) => v + (ew[i] * 0.025 + eu[i] * 0.024) * ES), [0.026 * ES, 0.042 * ES, 0.011 * ES], "head", 0.014, [eu, ev, ew]));   // 耳の内側のくぼみ
    P[`butt.${s}`] = E([m * 0.07 * TO.hips, 0.452, -0.05], [0.08, 0.066, 0.075], "hips", 0.05);
    P[`shoulder.${s}`] = E([m * 0.116, 0.742 - SHOULDER_DROP, 0], [0.054, 0.045 - SHOULDER_DROP * 0.6, 0.048], `upperArm.${s}`, 0.04);   // なで肩
    P[`upperArm.${s}`] = C(j("upperArm"), j("lowerArm"), 0.047, 0.043, `upperArm.${s}`, 0.022);   // 付け根は細く、脇はくっきり
    P[`foreArm.${s}`] = C(j("lowerArm"), j("hand"), 0.045, OPT.body.sculpt.forearm.wristRadius, `lowerArm.${s}`, OPT.body.sculpt.forearm.elbowBlend);   // ひじ: 溶かす幅を小さく(つなぎ目に余分な肉がついて一段ふくらまないように)
    { const a = j("lowerArm"), b = j("hand"), t = OPT.body.sculpt.forearm.bulge.start, L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;   // ひじの下の前腕のふくらみ: 下寄りにふくらませ(上側は控えめ)、手首へ細くなりながらなめらかにつなぐ
      const nd = [m * uy, -m * ux], od = OPT.body.sculpt.forearm.bulge.offset, c = [a[0] + (b[0] - a[0]) * t + nd[0] * od, a[1] + (b[1] - a[1]) * t + nd[1] * od, a[2] + (b[2] - a[2]) * t];
      P[`foreBulge.${s}`] = C(c, [b[0] + nd[0] * od * 0.3, b[1] + nd[1] * od * 0.3, b[2]], OPT.body.sculpt.forearm.bulge.radius, OPT.body.sculpt.forearm.bulge.radiusEnd, `lowerArm.${s}`, OPT.body.sculpt.forearm.bulge.blend);
      Object.assign(P[`foreBulge.${s}`], { t: 4, n: [-0.483 * m, -0.876, 0], flat: OPT.body.sculpt.forearm.bulge.flat }); }   // 手のひらの向きに平たい(手首に向かって平たくしぼる。丸太にならないように)
    // 手: Aポーズで手のひらが下を向く。指4本(少し開く)+親指
    const w = j("hand"), D = [m * 0.876, -0.483, 0], N = [-0.483 * m, -0.876, 0], S = [0, 0, 1];   // D=指の向き N=手のひらの向き S=親指の側
    const at = (o, ...t) => o.map((v, i) => v + t.reduce((q, [vec, k]) => q + vec[i] * k, 0));
    const palm = at(w, [D, 0.03], [N, 0.002]);
    P[`palm.${s}`] = E(palm, [0.034, 0.05, 0.019], `hand.${s}`, 0.02, [D, S, N]);   // 見本の手は大きめ(横から見ると扇に開く)
    [[0.039, 0.4, 0.04], [0.013, 0.13, 0.046], [-0.013, -0.13, 0.044], [-0.039, -0.4, 0.036]].forEach(([o, sp, len], i) => {
      const fd = D.map((v, k) => v * Math.cos(sp) + S[k] * Math.sin(sp)), b0 = at(palm, [D, 0.022], [S, o]);
      P[`finger${i}.${s}`] = C(b0, at(b0, [fd, len], [N, 0.006]), 0.0125, 0.0115, `hand.${s}`, 0.008);   // 指の股はくっきり
    });
    const tb = at(palm, [S, 0.04], [D, -0.008], [N, 0.006]);
    P[`thumb.${s}`] = C(tb, at(tb, [S, 0.022], [D, 0.016], [N, 0.016]), 0.013, 0.011, `hand.${s}`, 0.012);
    P[`thigh.${s}`] = C(j("upperLeg"), j("lowerLeg"), 0.08, 0.066, `upperLeg.${s}`, 0.05);
    P[`thighB.${s}`] = E([m * 0.11, OPT.body.sculpt.thigh.back.y, OPT.body.sculpt.thigh.back.z], [0.058, OPT.body.sculpt.thigh.back.height, OPT.body.sculpt.thigh.back.depth], `upperLeg.${s}`, 0.05);   // 太ももの裏: おしりからひざへ、うしろ側をなめらかにつなぐ(正面の幅は変えない)
    P[`thighF.${s}`] = E([m * 0.11, OPT.body.sculpt.thigh.front.y, OPT.body.sculpt.thigh.front.z], [OPT.body.sculpt.thigh.front.width, OPT.body.sculpt.thigh.front.height, OPT.body.sculpt.thigh.front.depth], `upperLeg.${s}`, OPT.body.sculpt.thigh.front.blend);   // 太ももの前: 前側にも肉をつける(正面の幅は変えない)
    P[`thighIn.${s}`] = E([m * OPT.body.sculpt.thigh.inner.x, OPT.body.sculpt.thigh.inner.y, 0.002], [OPT.body.sculpt.thigh.inner.width, OPT.body.sculpt.thigh.inner.height, 0.05], `upperLeg.${s}`, 0.04);   // 内もも: 付け根の内側に肉をつけて、ひざへまっすぐ絞る
    P[`calfO.${s}`] = E([m * (FOOT_X + OPT.body.sculpt.calf.outer.x), OPT.body.sculpt.calf.outer.y, -0.008], [OPT.body.sculpt.calf.outer.width, OPT.body.sculpt.calf.outer.height, 0.045], `lowerLeg.${s}`, 0.04);   // ふくらはぎの外側: 膝の下で外へふくらむ(見本の正面の線)
    P[`calf.${s}`] = C(j("lowerLeg"), j("foot"), 0.062, 0.057, `lowerLeg.${s}`, 0.05);
    P[`calfB.${s}`] = E([m * (FOOT_X - 0.008), 0.18, OPT.body.sculpt.calf.back.z], [OPT.body.sculpt.calf.back.width, 0.068, OPT.body.sculpt.calf.back.depth], `lowerLeg.${s}`, 0.05);   // ふくらはぎのふくらみ
    P[`foot.${s}`] = E([m * (FOOT_X - 0.002), -0.003 + FOOT_H, 0.015], [0.052, FOOT_H, 0.075], `foot.${s}`, 0.04);
    // 服用: 半分の長さの袖・すそ
    const ua = j("upperArm"), la = j("lowerArm"), mid = ua.map((v, i) => v + (la[i] - v) * 0.5);
    P[`sleeve.${s}`] = C(ua, mid, 0.046, 0.044, `upperArm.${s}`, 0.04);
    const ul = j("upperLeg"), ll = j("lowerLeg"), mk = ul.map((v, i) => v + (ll[i] - v) * 0.45);
    P[`leghole.${s}`] = C(ul, mk, 0.078, 0.072, `upperLeg.${s}`, 0.05);
    // 手足の太さ(1 = そのまま)。袖とズボンの範囲も一緒に太らせる
    const TH = OPT.body.thickness;
    for (const n of ["upperArm", "sleeve"]) thicken(P[`${n}.${s}`], j("upperArm"), j("lowerArm"), TH.upperArm);
    for (const n of ["foreArm", "foreBulge"]) thicken(P[`${n}.${s}`], j("lowerArm"), j("hand"), TH.forearm);
    for (const n of ["thigh", "thighB", "thighF", "thighIn", "leghole"]) thicken(P[`${n}.${s}`], j("upperLeg"), j("lowerLeg"), TH.thigh);
    for (const n of ["calf", "calfO", "calfB"]) thicken(P[`${n}.${s}`], j("lowerLeg"), j("foot"), TH.calf);
  }
  const isHead = (k) => /^(skull|occiput|face|jaw|muzzle|nose|ear)/.test(k);
  const BRIDGE = C([0, 1.04 + NOSE_DY, 0.216], [0, 0.97 + NOSE_DY, 0.236], 0.009, 0.011, "head", 0.035);   // 鼻筋(凹ませたあとに足すので、目のあいだは鞍の形になる)
  const BODY = Object.entries(P).filter(([k, v]) => !/^(sleeve|leghole)/.test(k) && !v.sub).map(([, v]) => v).concat(BRIDGE);   // 重みづけ用(削る部品は入れない)
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
  const isEar = (k) => /^ear(Lobe|Fill)?\./.test(k);
  const HEAD = G([...Object.entries(P).filter(([k]) => isHead(k) && k !== "nose" && !isEar(k)).map(([, v]) => v), ...(faceBox ? [faceBox] : []), ...Object.entries(CUT).filter(([k]) => !isEar(k)).map(([, v]) => v), ...planeCuts,
    ...Object.entries(P).filter(([k]) => isEar(k)).map(([, v]) => v), ...Object.entries(CUT).filter(([k]) => isEar(k)).map(([, v]) => v), BRIDGE, P.nose], 0.022);   // 鼻筋と鼻は削ったあとに足す
  // 目のくぼみ(眼窩): 目が大きく平たいので、広く浅く、なだらかに沈める。下側に広く(目の下半分が前に出ないように)
  const socket = (x, y) => { let d = 0; for (const m of [1, -1]) { const dx = x - m * (0.128 + EX), dy = y - 0.995 - FACE_DY - EY, ry = dy > 0 ? 0.088 : 0.105;
      if (dx * m <= 0 || !SOCK_BAND.on) { const r = Math.hypot(dx / (dx * m > 0 ? SOCKET_OUT : 0.09), dy / ry); if (r < 1) d += 0.014 * (1 - r * r) ** 2; }
      else { const v = Math.abs(dy) / ry, t = dx * m / SOCK_BAND.len;   // 目じり側: 上下のふちは平行のまま、頭の横へ向かってなだらかに浅くなる(1点にすぼまらない)
        if (v < 1 && t < 1) d += 0.014 * (1 - v * v) ** 2 * (1 - t * t) ** 2 * (1 - SOCK_BAND.lift * Math.min(1, t * 2)); }
    { const ix = (x - m * SOCK_IN.x) / SOCK_IN.w, iy = dy / SOCK_IN.h, ir = ix * ix + iy * iy; if (ir < 1) d += SOCK_IN.d * (1 - ir) ** 2; }   // 目頭側(鼻すじのとなり)を少し引っこめて、目の乗る面を平らに
    { const ex = x - m * EYE_UNDER.x, ux = ex / (ex * m > 0 ? EYE_UNDER.wo : EYE_UNDER.wi), uy = (dy - EYE_UNDER.y) / EYE_UNDER.h, ur = ux * ux + uy * uy; if (ur < 1) d += EYE_UNDER.d * (1 - ur) ** 2; }   // 目の下だけ: 目じり側は早めに消す
    const ly = dy + SOCKET_LOW.y, lr = Math.hypot(dx / SOCKET_LOW.w, ly / (ly > 0 ? SOCKET_LOW.hu : SOCKET_LOW.h)); if (lr < 1) d += SOCKET_LOW.d * (1 - lr * lr) ** 2; } return d; };   // 目の下半分のうしろ: 前に出ないよう、もう少し沈めて平らに
  // 顔の側面の目じりのあたりを少し前(外)へ出す。眼窩の帯の外の端あたりを中心に、上下は帯と同じ幅で、なだらかに
  const temple = (x, y, z) => { if (z < -0.02) return 0; let d = 0, trim = 0; for (const m of [1, -1]) { const dx = (x - m * TEMPLE.x) / TEMPLE.w, dy = (y - TEMPLE.y) / TEMPLE.h, r = dx * dx + dy * dy; if (r < 1) d += TEMPLE.d * (1 - r) ** 2; } for (const m of [1, -1]) { const dx = (x - m * CHEEK_FILL.x) / CHEEK_FILL.w, dy = (y - CHEEK_FILL.y) / CHEEK_FILL.h, r = dx * dx + dy * dy; if (r < 1) d += CHEEK_FILL.d * (1 - r) ** 2; }   // 目の下〜鼻の横のほお(上から見てこけないように)
    for (const m of [1, -1]) { const dx = (x - m * SIDE_TRIM.x) / SIDE_TRIM.w, dy = (y - SIDE_TRIM.y) / SIDE_TRIM.h, r = dx * dx + dy * dy; if (r < 1) trim += SIDE_TRIM.d * (1 - r) ** 2; }   // ほおの横のでっぱりを少し抑える(上・斜めから見て角ばらないように)
    return d * Math.min(1, Math.max(0, (z - TEMPLE_Z0) / 0.06)) - trim; };   // 前を向いた面だけ前へ出す(横には広げない)
  if (!slow) HEAD.f = blendFast(HEAD.list, [-0.32, 0.7, -0.34], [0.32, 1.44, 0.4], OPT.quality.headCell);   // 頭の部品も速い版で
  // a groove around where the nose meets the face (a thin ring around the nose base, front of the face only), so the nose stands out from the face
  const NG = OPT.body.sculpt.noseGroove;
  const groove = (x, y, z) => { if (!NG.depth || z < 0.1) return 0; const r = Math.hypot(x / NG.rx, (y - NG.y) / NG.ry), t = (r - 1) * Math.min(NG.rx, NG.ry) / NG.width; return NG.depth * Math.exp(-t * t) * sstep(0.1, 0.16, z); };
  { const f0 = HEAD.f; HEAD.f = (x, y, z) => f0(x, y, z) + socket(x, y) - temple(x, y, z) + groove(x, y, z); }
  // head size / width / depth: the head is built in its own space, then scaled around a pivot at the top of the neck
  const HT = headTransform(OPT.body.head), HEAD_RAW = { ...HEAD };
  if (!HT.identity) { const f0 = HEAD_RAW.f, c = HT.fromHead(HEAD.bx0, HEAD.by0, HEAD.bz0); HEAD.f = HT.wrap(f0); [HEAD.bx0, HEAD.by0, HEAD.bz0] = c; HEAD.br = HEAD_RAW.br * HT.max; }
  const CROTCH = cut(E([0, OPT.body.sculpt.crotch.y, 0], [OPT.body.sculpt.crotch.width, OPT.body.sculpt.crotch.height, 0.13], "hips", 0.02));   // 股下を少し上げる(左右の脚のあいだを上へ削る)
  const KNEE_OUT = [1, -1].map((m) => cut(E([m * (KNEE_X + OPT.body.sculpt.knee.outer.x), OPT.body.sculpt.knee.outer.y, 0], [OPT.body.sculpt.knee.outer.width, OPT.body.sculpt.knee.outer.height, 0.06], "hips", 0.02)));   // 膝の外側を少し入りこませる
  const KNEE_IN = cut(E([0, OPT.body.sculpt.knee.inner.y, 0], [OPT.body.sculpt.knee.inner.width, OPT.body.sculpt.knee.inner.height, 0.09], "hips", 0.02));   // 正面から見た膝の内側を少し引き締める(左右の膝のあいだを削る)
  const BODY_LIST = [...Object.entries(P).filter(([k]) => !isHead(k) && !/^(sleeve|leghole)/.test(k)).map(([, v]) => v), CROTCH, KNEE_IN, ...KNEE_OUT, HEAD];
  const bodySdfSlow = blend(BODY_LIST), bodySdf = slow ? bodySdfSlow : blendFast(BODY_LIST, [-0.5, -0.04, -0.34], [0.5, 1.46, 0.4], OPT.quality.bodyCell);   // ?slow で元の遅い版(確認用)
  const bodySdfRaw = HT.identity ? bodySdf : blendFast(BODY_LIST.map((p) => p === HEAD ? HEAD_RAW : p), [-0.5, -0.04, -0.34], [0.5, 1.46, 0.4], OPT.quality.bodyCell);   // the body with the head untransformed (hair is built against it, then transformed with the head)
  return { J, PARENT, BONES, BI, P, CUT, PLANES: planeCuts, BODY, HEAD, CROTCH, EAR, FACE_DY, bodySdf, bodySdfSlow, bodySdfRaw, HT };
}

/**
 * Scale the head around a pivot at the top of the neck. h = { scale, width (x), depth (z), pivotY, pivotZ, shift: { z, z0, z1 } }.
 * shift: everything in front of z1 (head space) moves back by z, fading in between z0 and z1, so the head gets shorter front to back
 * while the side silhouette keeps its shape (skin, hair and face picture move together).
 * toHead: world point → head-space point. fromHead: the reverse. wrap(sdf): a head-space distance function seen in world space.
 */
export function headTransform(h) {
  const sx = h.scale * h.width, sy = h.scale, sz = h.scale * h.depth, py = h.pivotY, pz = h.pivotZ, S = h.shift ?? { z: 0 };
  const warp = S.z ? (z) => z + S.z * sstep(S.z0, S.z1, z) : (z) => z, unwarp = S.z ? (z) => { let w = z; for (let i = 0; i < 4; i++) w = z - S.z * sstep(S.z0, S.z1, w); return w; } : (z) => z;
  const stretch = S.z ? 1 + 1.5 * S.z / (S.z1 - S.z0) : 1;   // the warp stretches distances by up to this much; divide it out so distances never overstate
  const identity = sx === 1 && sy === 1 && sz === 1 && !S.z, k = Math.min(sx, sy, sz) / stretch;
  return {
    identity, sx, sy, sz, k, max: Math.max(sx, sy, sz),
    toHead: (x, y, z) => [x / sx, py + (y - py) / sy, warp(pz + (z - pz) / sz)],
    fromHead: (x, y, z) => [x * sx, py + (y - py) * sy, pz + (unwarp(z) - pz) * sz],
    wrap: (f) => identity ? f : (x, y, z) => f(x / sx, py + (y - py) / sy, warp(pz + (z - pz) / sz)) * k,
  };
}

/** A box with rounded edges (center c, half sizes h, edge radius r), as a head part blended with k. */
function roundBox(c, h, r, k) {
  return { t: 3, k, bone: "head", bx0: c[0], by0: c[1], bz0: c[2], br: Math.hypot(...h),
    f: (x, y, z) => { const qx = Math.abs(x - c[0]) - (h[0] - r), qy = Math.abs(y - c[1]) - (h[1] - r), qz = Math.abs(z - c[2]) - (h[2] - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; } };
}
