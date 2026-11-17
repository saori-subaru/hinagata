// Clothes: shirt, pants, shoes (upper + sole) and socks, as signed distances built around the body.
// Functions taking B (the body distance) can be given a faster lookup of the same body while meshing.
import { smin, E, C, cut, blend, blendFast, sstep, dPrim } from "../sdf/prim.js";
import { skirtOf } from "../options.js";
import { buildArmor } from "./armor.js";
import { buildPlate } from "./plate.js";
import { buildWeapons } from "./weapons.js";
import { buildExtras } from "./extras.js";
import { buildGarments } from "../garments/index.js";
import { armReach, heelBend, makeStretch } from "../body/index.js";

/** High heels (shoes.kind "heels"): the foot tilted toes-down by theta (shoes.heelAngle) about the ankle; lift: how far the body rises so the
 *  ball of the foot stays on the floor; heel: how high the heel's back is then (the heel's length) */
export function heelPose(OPT, J) {
  const th = (OPT.outfit.shoes.heelAngle ?? 24) * Math.PI / 180, A = J["foot.L"], c = Math.cos(th), s = Math.sin(th), FK = OPT.body.proportion?.feet ?? 1;   // FK: the feet's size
  const ball = A[1] + ((0 - A[1]) * c - (0.06 * FK - A[2]) * s), lift = Math.max(0, -ball);   // the ball (y 0, z 0.06) turned with the foot
  const heelY = A[1] + ((-0.001 - A[1]) * c - (-0.035 * FK - A[2]) * s) + lift;   // the heel's underside, turned and lifted
  return { theta: th, lift, heel: Math.max(0.01, heelY) };
}

/** the cape's shoulder line (rest pose): where the mantle over the shoulders turns into the part that hangs */
export const capeTop = (J) => J["upperArm.L"][1] + 0.005;
/** boots' straps (shoes.straps, strapAt, strapWidth, strapGap): [from, to] in m under the boot's top (clothes and index.js' bands) */
export const strapRanges = (S) => Array.from({ length: Math.max(0, Math.min(2, Math.round(S.straps ?? 0))) }, (_, i) => { const a = (S.strapAt ?? 0.03) + i * ((S.strapWidth ?? 0.012) + (S.strapGap ?? 0.014)); return [a, a + (S.strapWidth ?? 0.012)]; });

export function buildClothes(OPT, { P, J, HT, CROTCH, bodySdf, ARMPIT = [] }) {
  const pick = (...names) => names.flatMap((n) => [P[n]?.cloth ?? P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);   // .cloth: a part's own shape for clothes (the bust: joined across the middle)
  // shirt.sleeve: "short" (to the middle of the upper arm) | "none" (cut off at the armhole) | "long" (to the wrist)
  // shirt.length: "tuck" (hem inside the pants) | "out" (hem over the pants) | "crop" (above the navel)
  const SH = OPT.outfit.shirt, SLEEVE = SH.sleeve ?? "short", LEN = SH.length ?? "tuck";
  // shirt.underarm: "fit" = the cloth follows the body's armpit hollow (ARMPIT, body/index.js) / "loose" = it bridges it (poncho-like: hangs from the sleeve down the side)
  //   Why: the shirt is the body's parts melted and puffed up 1.4 cm, so where a chibi arm hangs close to the side the sleeve and the side melted into one
  //   sheet; raising the arms (T-pose) stretched it into a web (2026-10-02 Saori: 「袖下の付け根の位置が下すぎて水かきみたい」)
  const PIT = (SH.underarm ?? "fit") === "loose" || !SLEEVE || SLEEVE === "none" ? [] : ARMPIT;
  const LONG = SLEEVE === "long" || SLEEVE === "bell", BELL = SLEEVE === "bell" ? (SH.bell ?? 0.06) : 0;   // bell: a long sleeve that widens into an open bell past the wrist (a robe's)
  const AR = armReach(OPT);
  // long arms (body.proportion.arms) reach below the shirt's hem in the base body: the hem cuts only the torso, not a long sleeve beside it
  const HEM_X = OPT.body.proportion?.arms != null ? (LEN === "crop" ? 0.19 : 0.24) + 0.115 * ((OPT.body.proportion.shoulders ?? 1) - 1) : Infinity;
  const armParts = LONG ? ["sleeve", "upperArm", "foreArm"] : SLEEVE === "short" ? ["sleeve"] : [];
  const shirtCore = blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "neck", "trap", "shoulder", ...armParts, ...(LEN === "out" ? ["butt"] : [])), [-0.4 - AR.x, 0.4 - AR.y, -0.25], [0.4 + AR.x, 0.95, 0.27]);   // (AR: longer arms reach further)   // out: over the bottom too (else the pants show through at the back)
  const arm = (s) => { const a = P[`upperArm.${s}`], f = P[`foreArm.${s}`], L = Math.hypot(a.bx, a.by), Lf = Math.hypot(f.bx, f.by, f.bz);   // armhole and cuff: planes across the arm
    const gx = f.bx / Lf, gy = f.by / Lf, gz = f.bz / Lf, dx = gx * gy, dy = gy * gy - 1, dz = gz * gy, dl = Math.hypot(dx, dy, dz) || 1;   // d: straight down, across the forearm
    return { ax: a.ax, ay: a.ay, az: a.az, ux: a.bx / L, uy: a.by / L, fx: f.ax, fy: f.ay, fz: f.az, gx, gy, gz, dx: dx / dl, dy: dy / dl, dz: dz / dl, Lf, side: Math.sign(a.ax) }; };
  const ARMS = [arm("L"), arm("R")];
  const FIT = OPT.fit ?? {}, HEM = FIT.shirtHem ?? { tuck: 0.455, out: 0.44, crop: SH.crop ?? 0.6 }[LEN] ?? 0.455;   // (FIT: the heights on the adult body, body/index.js adultFit)   // the bottom edge   // シャツは胴と袖の部品を溶かした形(袖はこの形がいちばん自然)
  const COLLAR = { y: OPT.outfit.shirt.collar.y, bowl: OPT.outfit.shirt.collar.bowl, tilt: OPT.outfit.shirt.collar.tilt, front: OPT.outfit.shirt.collar.front, fwd: OPT.outfit.shirt.collar.forward };   // えりぐり: 首のまわりの高さ / 首から離れるほど上がる量(おわん形) / 後ろ上がりの傾き / 前を首に近づける / 中心を前へ
  const SHOULDER_FIT = { x0: OPT.outfit.shirt.shoulderFit.x0, xw: OPT.outfit.shirt.shoulderFit.xWidth, off: OPT.outfit.shirt.shoulderFit.offset, y0: OPT.outfit.shirt.shoulderFit.y0, y1: OPT.outfit.shirt.shoulderFit.y1 };   // 肩の上だけ体にそわせる: 浮き / ここから / ここまでで効ききる
  // the bell sleeve: a shell around the forearm from the elbow (as wide as the sleeve) to the cuff, open there. It hangs: the bell's middle
  // drops below the arm toward the cuff, and its lower side reaches further (a slanted opening that shows from the front)
  const bellShell = (x, y, z, A) => { const t = (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz, px = x - A.fx - t * A.gx, py = y - A.fy - t * A.gy, pz = z - A.fz - t * A.gz;
    const u = Math.min(1, Math.max(0, t / A.Lf)), c = BELL * 0.6 * u * u, s = px * A.dx + py * A.dy + pz * A.dz;   // s: how far below the arm (across it)
    const cone = (Math.hypot(px - c * A.dx, py - c * A.dy, pz - c * A.dz) - (0.042 + BELL * Math.pow(u, 1.6))) * 0.85;
    return Math.max(cone, -(cone + 0.014), t - (A.Lf + 0.01 + 0.7 * Math.max(0, s)), -t); };
  // which arm's bell a point of the shirt belongs to ("L" / "R"), or null: on the bell's surface and off the body (the shirt's own side is
  // 1.4 cm off it). For the skin weights: the bell's lower side hangs by the hips, and following them it stretched into a web from the waist
  // to the arm when the arms went up (2026-10-05, Saori: "Tポーズで袖の裾が腰に張り付いてる")
  // (nearer the bell's surface than the shirt without the bell: where the bell's lower side lies against the hips, "off the body" missed some)
  const bellOf = BELL ? (x, y, z, B = bodySdf) => { for (const A of ARMS) { if (x * A.side <= 0) continue; const b = Math.abs(bellShell(x, y, z, A));
    if (b < 0.008 && b < Math.abs(shirtSdf(x, y, z, B, true)) - 0.001) return A.side > 0 ? "L" : "R"; } return null; } : null;
  // a long or bell sleeve's cuff: how far up the sleeve from its end (m, square to the slanted bell's opening), 1 off the sleeves (shirt.cuffColor's band)
  const cuffOf = LONG ? (x, y, z) => { for (const A of ARMS) { if (x * A.side <= 0) continue;
    const t = (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz, px = x - A.fx - t * A.gx, py = y - A.fy - t * A.gy, pz = z - A.fz - t * A.gz, s = px * A.dx + py * A.dy + pz * A.dz;
    if (t < A.Lf * 0.3 || Math.hypot(px, py, pz) > 0.08 + BELL * 1.6) continue;
    return BELL ? (A.Lf + 0.01 + 0.7 * Math.max(0, s) - t) / (s > 0 ? 1.22 : 1) : A.Lf - 0.012 - t; } return 1; } : null;
  const shirtSdf = (x, y, z, B = bodySdf, noBell = false, noHole = false) => {   // noHole: without shirt.armhole (the sailor collar lies on over the bare shoulder: cut with the shirt it ended halfway along the shoulder)
      // B: 体の距離(服を作るときは格子から読む速い版を渡す)
    const t = Math.min(1, Math.max(0, (y - 0.725) / 0.12)), nx = x, nz = z - (-0.032 + 0.038 * t + COLLAR.fwd), rz = nz > 0 ? nz * (1 + COLLAR.front) : nz;   // 首の柱(少し前に傾く)からの位置
    const neck = y - (COLLAR.y - COLLAR.tilt * nz + COLLAR.bowl * (nx * nx + rz * rz));   // えりぐり: 首から離れるほど高くなるおわん形の面で切る(首に沿う布と平行にならないので、ふちがガタつかない)
    const sm = (a, b) => -smin(-a, -b, 0.012);   // 角を丸めて切る
    const fit = y > SHOULDER_FIT.y0 ? B(x, y, z) - SHOULDER_FIT.off - 0.3 * (1 - sstep(SHOULDER_FIT.y0, SHOULDER_FIT.y1, y) * sstep(SHOULDER_FIT.x0, SHOULDER_FIT.x0 + SHOULDER_FIT.xw, Math.abs(x))) : -1;   // 肩の上は体から離れすぎないように(怒り肩にしない)。首のまわりは効かせない
    // the armpit hollow: near it the cloth is thin (0.4 cm instead of 1.4: two 1.4 cm layers would fill the hollow again), and it follows the hollow 0.4 cm off the body
    let pit = 1e9; for (const c of PIT) if (Math.abs(x - c.bx0) < c.br) pit = Math.min(pit, c.f(x, y, z));
    let d = shirtCore(x, y, z) - (0.014 - 0.01 * (1 - sstep(0, 0.025, pit))) - (LEN === "out" ? 0.01 * sstep(0.56, 0.5, y) : 0);   // out: a little looser at the bottom, so it lies over the pants
    if (pit < 0.03) d = -smin(-d, pit + 0.004, 0.006);
    for (const A of ARMS) { if (x * A.side <= 0) continue;
      if (SLEEVE === "none" && SH.armhole != null && !noHole) {   // shirt.armhole (2026-10-10, for 島風's bare shoulders): the armhole a line from the shoulder's top, armhole m in from the joint, down to the armpit; the arm's side of it is cut away above the armpit (the cut below kept the shoulder's cap: a puffed little sleeve)
        const x0 = A.ax * A.side - SH.armhole, y0 = A.ay + 0.03, x1 = A.ax * A.side + 0.004, y1 = A.ay - 0.05, L = Math.hypot(x1 - x0, y1 - y0), s = (x * A.side - x0) * (y0 - y1) / L + (y - y0) * (x1 - x0) / L;   // s > 0: the arm's side
        d = sm(d, Math.min(s, y - y1)); }
      else if (SLEEVE === "none" && SH.armhole == null) { const t = (x - A.ax) * A.ux + (y - A.ay) * A.uy, px = x - A.ax - t * A.ux, py = y - A.ay - t * A.uy;   // sleeveless: cut off the arm just inside the shoulder joint
        d = sm(d, -Math.max(t + 0.012, Math.hypot(px, py, z - A.az) - 0.063)); }   // 0.063: around the sleeve only, not the back or chest beside it   // (only around the arm: a plane alone would cut through the body too)
      if (LONG) d = sm(d, (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz - (A.Lf - 0.012));   // long: the cuff just before the wrist
      if (BELL && !noBell) d = smin(d, bellShell(x, y, z, A), 0.008); }
    return Math.max(sm(sm(d, neck), fit), HEM - y - (HEM_X < Infinity ? 1.5 * Math.max(0, Math.abs(x) - HEM_X) : 0)); };   // tuck: すそはズボンの中に入れる
  // pants.length: "shorts" (hem = pants.hem) | "knee" (just below the knee) | "long" (to the ankle)
  const PL = OPT.outfit.pants.length ?? "shorts", PANTS_HEM = FIT.pantsHem ?? { knee: 0.2, long: 0.1 }[PL] ?? OPT.outfit.pants.hem;   // ズボンのすその高さ
  const pantsMask = blend([...pick("pelvis", "butt", "leghole", "belly", "thighF", "thighB", "thighIn", "thighOut", ...(PL === "shorts" ? [] : ["thigh", "calf", "calfO", "calfB"])), CROTCH]);   // ズボンを着せる範囲
  const PANTS_OFF = OPT.outfit.pants.offset, PANTS_TOP = FIT.pantsTop ?? OPT.outfit.pants.top, PANTS_TILT = OPT.outfit.pants.tilt;   // ズボンの厚み / 上の高さ / 後ろ上がりの傾き
  const PM = PL === "shorts" ? 0 : 0.1;   // longer pants: below the thighs the legs alone shape them (the mask's edge made a fold at the knee); higher up the margin would reach the hands
  const LEGS = PL === "shorts" ? null : blend(pick("thigh", "thighF", "thighB", "thighOut", "calf", "calfO", "calfB"));   // the legs without the dent at the outside of the knee (cloth bridges it; following it folded the pants there)
  const pantsCore = (x, y, z, B = bodySdf) => Math.max((LEGS && y < 0.38 ? (b0 => b0 + (Math.min(b0, LEGS(x, y, z)) - b0) * sstep(0.38, 0.33, y))(B(x, y, z)) : B(x, y, z)) + 0.024 - PANTS_OFF, pantsMask(x, y, z) - 0.03 - PM * sstep(0.36, 0.3, y));   // 体の形にそって着せる(横から見て分厚くならないように)
  // the waistband over a tucked shirt: from 5 cm under the top it goes over the shirt itself, 7 mm out (3 mm: the shirt showed through in streaks at the cells' size), not the body pushed out (that stood
  // 7–10 mm out of the shirt at the sides and the back: a step all round. 2026-10-07, Saori: "ズボン系が分厚くてシャツと段ができている")
  const BAND = LEN === "tuck" ? (OPT.fit ? Math.min(0.05, Math.max(0, PANTS_TOP - HEM - 0.008)) : 0.05) : 0;   // (adult: never under the shirt's hem, which is close under the top there: the band hung below it in holes)
  // the legs' shape (pants.puff: balloon legs, gathered toward the hem; pants.bell: widening toward the hem; 2026-10-07, Saori: "ズボンを膨らませたり、
  // 先端を広げたり"): the cloth further out around each leg, not across the middle (the legs would join)
  const PUFF = OPT.outfit.pants.puff ?? 0, BELLB = OPT.outfit.pants.bell ?? 0, LSPAN = Math.max(0.05, 0.4 - PANTS_HEM);
  const legGrow = (x, y) => { if (!PUFF && !BELLB) return 0; const t = (0.4 - y) / LSPAN; if (t <= 0) return 0;
    return sstep(0.02, 0.07, Math.abs(x)) * (PUFF * 0.045 * Math.sin(Math.PI * Math.min(1, t) * 0.92) + BELLB * 0.07 * sstep(0.55, 1, t)); };
  const pantsShape = (x, y, z, B = bodySdf) => { const top = PANTS_TOP - PANTS_TILT * z; let d = pantsCore(x, y, z, B) - 0.024 - legGrow(x, y);
    if (BAND && y > top - BAND) { const w = sstep(top - BAND, top - 0.015, y) * (1 - sstep(0.17, 0.21, Math.abs(x))); d += (shirtSdf(x, y, z, B, true) - 0.007 - d) * w; }   // (the torso only: not round a long sleeve hanging beside it)
    return Math.max(d, y - top, PANTS_HEM - y); };
  // skirt (pants.kind "skirt"): a pleated cone hanging from the waist, a thin shell (open at the bottom, so the legs come out of it).
  // Its cross-section is an ellipse around the hips that widens toward the hem (flare per m of drop); pleats are folds around it that
  // deepen toward the hem. Where the body sticks out of the cone (the bottom at the back) the cloth drapes over it: from the top straight to
  // the furthest point, then straight down (DRAPE). It followed the body's own shape there, so the bottom's round showed through even with
  // the bottom, the hips and the thighs at their smallest (2026-10-07, Saori: "ワンピースでお尻の膨らみのシルエットが出てしまう")
  const SK = skirtOf(OPT) ?? { hem: 0.3, flare: 0.4, pleats: 16, pleatDepth: 0.008, thick: 0.018 }, TO = OPT.body.torso;   // a dress's skirt is the same (skirtOf, options.js)
  const SK_Y0 = SK.top ?? PANTS_TOP, SK_TILT = SK.tilt ?? PANTS_TILT;   // a dress's skirt starts higher (skirtOf)
  let SK_AX = 0.158 * (TO.hips ?? 1) + 0.022, SK_AZ = 0.128, SK_ZC = -0.012;
  // a dress's skirt starts under the chest: its top ellipse is measured off the body there (just over the shirt), so it neither stands off
  // the back as a ledge (the hips' ellipse is wider than the chest) nor lets the belly push out under it (it is centered on the body, not on the hips)
  if (SK.dress) { const out = (dx, dz) => { let t = 0; while (t < 0.4 && bodySdf(dx * t, SK_Y0, -0.01 + dz * t) < 0) t += 0.001; return t; };
    const zf = out(0, 1) - 0.01, zb = -out(0, -1) - 0.01, m = 0.015;   // m: over the shirt (1.4 cm) and a little air
    SK_AX = out(1, 0) + m; SK_ZC = (zf + zb) / 2; SK_AZ = (zf - zb) / 2 + m; }
  // (adult: the outer thighs' tops too: the hips' line runs on into them, and outside the mask they stood out through the skirt's sides,
  // 2026-10-09, Saori: "普通のスカートをはくと太ももがつきでる")
  // skirtMask: the hips, the bottom and the belly, inside the body itself too (so the waist's cut applies: on the pelvis alone a strong waist
  // still had the cloth hang out at the pelvis' width beside it, 2026-10-07)
  const SKIRT = !!skirtOf(OPT), skirtHips = SKIRT ? blend(pick("pelvis", "butt", "belly", ...(OPT.fit ? ["thighOut"] : []))) : null, skirtMask0 = SKIRT ? (x, y, z) => Math.max(skirtHips(x, y, z), bodySdf(x, y, z)) : null;
  // adult body, the shirt (or a dress's top) under the skirt: the skirt goes over it too, not only over the body (its sides stood out of the
  // skirt's top at the waist, seen with the arms out: 2026-10-09, Saori: "Aにしてみて … ぼこぼこ")
  const UNDER = SKIRT && OPT.fit && (OPT.outfit.shirt.on || OPT.outfit.dress?.on) && HEM < (SK_Y0 ?? 1);
  const skirtMask = !SKIRT ? null : UNDER ? (x, y, z) => Math.min(skirtMask0(x, y, z), y < HEM ? 1 : shirtSdf(x, y, z, bodySdf, true) + 0.002) : skirtMask0;
  // the cone starts from the body at its top, measured each way (a body's narrowest a little over it), not from an ellipse at the hips'
  // width: a long, strong waist ran on under the band at the top, and below it the cone came out at the hips' width with a corner at each
  // side (2026-10-07, Saori: "くびれを作ると…スカートの問題"). Never wider than the old cone; the hips below are draped over as before (DRAPE)
  const TOPR = SKIRT ? (() => { const NA = 48, R = new Float32Array(NA);
    for (let a = 0; a < NA; a++) { const f = a / NA * Math.PI * 2, s = Math.sin(f), c = Math.cos(f); let t = 0; while (t < 0.4 && (UNDER ? skirtMask(s * t, SK_Y0, SK_ZC + c * t) : bodySdf(s * t, SK_Y0, SK_ZC + c * t)) < 0) t += 0.001; R[a] = t + (UNDER ? 0.008 : 0.015); }
    return (s, c) => { const g = (Math.atan2(s, c) / (Math.PI * 2) + 1) % 1 * NA, a0 = Math.floor(g) % NA, t = g - Math.floor(g); return R[a0] * (1 - t) + R[(a0 + 1) % NA] * t; }; })() : null;
  // adult body: the flare eases in under the top (EZ: the drop's first EZ m flare little), so the skirt comes out of the waist in a curve,
  // not a corner (2026-10-09, Saori, circling where the dress's front went straight down and then bent out)
  const EZ = OPT.fit ? 0.05 : 0, ease = (d) => EZ ? d - EZ * (1 - Math.exp(-d / EZ)) : d;
  const coneR = (s, c, y) => { const drop = ease(Math.max(0, SK_Y0 - y)), ax = SK_AX + SK.flare * drop, az = SK_AZ + SK.flare * 0.8 * drop, old = 1 / Math.hypot(s / ax, c / az);   // the cone's radius that way (s, c: sin, cos around the center)
    return Math.min(old, TOPR(s, c) + SK.flare * drop * Math.hypot(s, 0.8 * c)); };
  // DRAPE: the skirt's radius per angle and height (a grid from the top to the hem): at least the cone's; under the furthest the hips reach
  // (skirtMask, 1.5 cm out) straight down, and above it on the line from the top's edge to it (cloth hangs from the top over the bulge, not into its curve)
  // AL (adult body): the lines from the top's edge over the hips go on down, an A-line, instead of hanging straight under the hips'
  // furthest: the skirt no longer shows the bottom's or the thighs' shape under it (2026-10-09, Saori: "後ろから見たときにお尻が浮き出てる",
  // "普通のスカートをはくと太ももがつきでる")
  const AL = !!OPT.fit;
  const DRAPE = SKIRT ? (() => { const NA = 48, DY = 0.01, NY = Math.max(2, Math.ceil((SK_Y0 - SK.hem) / DY) + 1), R = new Float32Array(NA * NY), M = 0.015;
    for (let a = 0; a < NA; a++) { const f = a / NA * Math.PI * 2, s = Math.sin(f), c = Math.cos(f), top = coneR(s, c, SK_Y0), need = [];
      for (let j = 0; j < NY; j++) { const y = SK_Y0 - j * DY; let t = 0; if (skirtMask(0, y, SK_ZC) < 0) { while (t < 0.4 && skirtMask(s * t, y, SK_ZC + c * t) < 0) t += 0.002; } need.push(t > 0 ? t + (0.008 + (M - 0.008) * sstep(0, 0.06, j * DY)) : 0); }   // (just under the top only a little out: it hugs the hips there and flares on below, so a strong waist doesn't leave a shelf where the band at the top lets go, 2026-10-07)
      // (AL: the steepest line from the top's edge over the hips, from 4 cm down, its slope at most the skirt's flare: lines from just under the
      // top flared out wildly)
      let ka = NY, sa = 0; if (AL) for (let k = 4; k < NY; k++) if (need[k] && (need[k] - top) / (k * DY) > sa) { sa = (need[k] - top) / (k * DY); ka = k; }
      sa = Math.min(sa, SK.flare);
      for (let j = 0; j < NY; j++) { let r = coneR(s, c, SK_Y0 - j * DY);
        for (let k = 0; k < NY; k++) { if (!need[k]) continue; r = Math.max(r, k <= j ? need[k] : top + (need[k] - top) * j / k); }   // k above j: hangs straight under it; k below: the line from the top
        if (AL && j > ka) r = Math.max(r, top + sa * ease(j * DY));   // AL: past the steepest point the line from the top goes on
        R[a * NY + j] = r; } }
    // adult body: the cloth bridges hollows round the body (the valley between the buttocks, behind the waist): each radius at least the
    // chord between two points up to 40° either side (where it crosses this direction), so the skirt lies over the bottom as one round, not
    // hugging each side (2026-10-09, Saori: "後ろから見たときにお尻が浮き出てる"). A chord never reaches past a convex outline, so only hollows fill
    if (OPT.fit) { const R0 = Float32Array.from(R), K = Math.round(NA * 40 / 360);
      for (let j = 0; j < NY; j++) for (let a = 0; a < NA; a++) { let r = R0[a * NY + j];
        for (let d = 1; d <= K; d++) { const r1 = R0[((a - d + NA) % NA) * NY + j], r2 = R0[((a + d) % NA) * NY + j]; r = Math.max(r, 2 * r1 * r2 * Math.cos(d / NA * Math.PI * 2) / (r1 + r2)); }
        R[a * NY + j] = r; } }
    return (x, y, z) => { const dz = z - SK_ZC, f = (Math.atan2(x, dz) / (Math.PI * 2) + 1) % 1 * NA, a0 = Math.floor(f) % NA, a1 = (a0 + 1) % NA, ta = f - Math.floor(f);
      const g = Math.min(NY - 1, Math.max(0, (SK_Y0 - y) / DY)), j0 = Math.min(NY - 2, Math.floor(g)), tj = g - j0, at = (a, j) => R[a * NY + j];
      const r = (at(a0, j0) * (1 - ta) + at(a1, j0) * ta) * (1 - tj) + (at(a0, j0 + 1) * (1 - ta) + at(a1, j0 + 1) * ta) * tj;
      return (Math.hypot(x, dz) - r) * 0.9; }; })() : null;
  // over a shirt whose hem is inside the skirt: its top goes over the shirt itself (7 mm out), as the pants' waistband does (a dress stood 2 cm
  // out from the body there, the shirt 1.4 cm: a step under the chest). A dress's 3 mm, and over the last 2 cm it sinks under its own top, so
  // the skirt comes out from under it (its rim over the top caught the light as a line all round, 2026-10-07)
  const SK_BAND = HEM < SK_Y0 - 0.03 ? 0.06 : 0;
  // the hem's shape (skirtOf: hemShape, hemCount, hemDepth, curl; 2026-10-07, Saori): zigzag / scallop cut the hem's edge up between points
  // or round lobes around it; tiers stack the skirt in steps, each tier flaring out over the top of the next; curl flares the last part out
  // and up (> 0) or draws it in (< 0)
  const HS = SK.hemShape ?? "plain", HN = Math.max(2, Math.round(SK.hemCount ?? 10)), HD = SK.hemDepth ?? 0.05, CURL = SK.curl ?? 0, SPAN = Math.max(0.05, SK_Y0 - SK.hem);
  // side panels (skirtOf's sideDrop, sideAt, sideOut; for シルヴィ): the sides hang sideDrop m lower than the middle panels in front and
  // behind, from sideAt (the sine of the angle round from the middle line) on, standing sideOut m out over them: two layers, a petticoat
  // showing under the shorter middle ones
  const SD = SKIRT ? SK.sideDrop ?? 0 : 0, SAT = SK.sideAt ?? 0.4, SOUT = SD > 0 ? SK.sideOut ?? 0.005 : 0, SW = 0.04;
  const sideOf = (x, dz) => SD > 0 ? sstep(SAT - SW, SAT + SW, Math.abs(x) / (Math.hypot(x, dz) || 1)) : 0;
  const hemAt = (x, dz) => { const h = SK.hem - SD * sideOf(x, dz); if (HS !== "zigzag" && HS !== "scallop") return h; const e = 2 * (((Math.atan2(x, dz) / (2 * Math.PI) + 1) * HN) % 1) - 1;
    return h + HD * (HS === "zigzag" ? Math.abs(e) : 1 - Math.sqrt(Math.max(0, 1 - e * e))); };
  // the hem's cut as a distance: over the panels' step it is steep round the skirt, so divided by its slope there (else 3x too far, and
  // the mesher's coarse pass skipped the step)
  const hemCut = (x, y, dz) => { const v = hemAt(x, dz) - y; if (!SD) return v; const r = Math.hypot(x, dz) || 1, u = Math.min(1, Math.max(0, (Math.abs(x) / r - SAT + SW) / (2 * SW)));
    return v / Math.hypot(1, SD * 6 * u * (1 - u) / (2 * SW) * Math.abs(dz) / (r * r)); };
  const shapeOut = (y) => { const t = Math.min(1, Math.max(0, (SK_Y0 - y) / SPAN)); let e = CURL * 0.12 * sstep(0.55, 1, t) ** 2;
    return e; };
  // a petticoat (skirtOf's under: m it shows below the hem, for シルヴィ): a pleated layer just inside the skirt from 3 cm over the hem down
  // past it, flaring on as the skirt does, with its own pleats (underPleats). Part of the skirt's mesh, so it moves with the cloth; its
  // color is the skirt's bands below the hem (index.js, by skirtHem: the hem's height, base, at a point's angle)
  // (1 cm inside the skirt and as thick: thinner than its cells' 0.45 × it came out ragged under the hem)
  const PETTI = SKIRT && (SK.under ?? 0) > 0 ? (() => { const UP = SK.underPleats ?? 24, Y1 = SK.hem - SK.under, tk = SK.thick * Math.hypot(1, SK.flare);
    return (x, y, z) => { const drop = Math.max(0, SK_Y0 - y), dz = z - SK_ZC, th = Math.atan2(x / (SK_AX + SK.flare * drop), dz / (SK_AZ + SK.flare * 0.8 * drop));
      const o = DRAPE(x, y, z) - SK.flare * Math.max(0, SK.hem - y) * 0.9 + 0.01 + 0.008 * Math.abs(Math.sin(th * UP / 2)) * sstep(SK.hem + 0.02, Y1, y);
      return Math.max(-smin(-Math.max(o, -(o + tk)), -(Y1 - y), 0.008), y - SK.hem - 0.03); }; })() : null;
  const skirtSdf = (x, y, z, B = bodySdf) => { const d = skirtSdf0(x, y, z, B); return PETTI ? smin(d, PETTI(x, y, z), 0.005) : d; };
  function skirtSdf0(x, y, z, B = bodySdf) {
    const drop = Math.max(0, SK_Y0 - y), ax = SK_AX + SK.flare * drop, az = SK_AZ + SK.flare * 0.8 * drop, dz = z - SK_ZC;
    const th = Math.atan2(x / ax, dz / az), pl = SK.pleatDepth * sstep(SK_Y0 - 0.02, SK.hem, y) * Math.abs(Math.sin(th * SK.pleats / 2));
    const top = SK_Y0 - SK_TILT * z; let outer = DRAPE(x, y, z) + pl - shapeOut(y) * 0.9;   // < 0 inside
    if (SD) outer -= SOUT * sideOf(x, dz) + SK.flare * Math.max(0, SK.hem - y) * 0.9;   // side panels: out over the middle ones, flaring on below the middle's hem
    if (SK_BAND && y > top - SK_BAND) outer += (Math.min(shirtSdf(x, y, z, B, true), B(x, y, z) - 0.008) - (SK.dress ? 0.003 - 0.006 * sstep(top - 0.02, top, y) : 0.007) - outer) * sstep(top - SK_BAND, top - 0.015, y) * (1 - sstep(SK_AX - 0.01, SK_AX + 0.03, Math.abs(x)));   // (the torso only: round long sleeves at the elbows it made fins, 2026-10-07)
    const slope = Math.abs(shapeOut(y + 0.005) - shapeOut(y - 0.005)) / 0.01 + SK.flare;   // where it flares nearly flat a sideways thickness is thin across the cloth: thicker by the slope
    const tk = SK.thick * Math.hypot(1, slope), shell = (o) => Math.max(o, -(o + tk));
    // the hem's edge rounded (HR, m): cut square through the thin shell it meshed in steps, and the outline stood out of the steps in black
    // slivers (2026-10-09, Saori: "裾の黒いの"; worst at the scallops' notches)
    if (HS !== "tiers") return Math.max(-smin(-shell(outer), -hemCut(x, y, dz), 0.008), y - top);
    // tiers: a shell each, flaring out within it, its top tucked 1.2 cm up under the one above, so each tier has its own hem edge (and outline)
    const n = Math.min(5, HN), t = (SK_Y0 - y) / SPAN; let d = 1e9;
    for (let i = 0; i < n; i++) { const l = Math.min(1, Math.max(0, t * n - i)), o = outer - HD * (0.8 * i + 0.9 * l) * 0.9, yTop = i ? SK_Y0 - SPAN * i / n + 0.012 : top, yBot = SK_Y0 - SPAN * (i + 1) / n;
      d = Math.min(d, Math.max(shell(o), y - Math.min(top, yTop), yBot - y)); }
    return d; };
  const pantsSdf = SKIRT ? skirtSdf : pantsShape;   // シャツより少し外側。上の口は後ろ上がり   // シャツより少し外側。上の口は後ろ上がり
  // 靴: 足とくるぶしを包むスニーカー。甲(色つき)と底(白いゴム)の2つ。足の裏の高さはそのまま(地面にめりこまない)
  const SHOE = { off: OPT.outfit.shoes.offset, top: OPT.outfit.shoes.top, tilt: OPT.outfit.shoes.tilt, sole: OPT.outfit.shoes.sole, rim: OPT.outfit.shoes.rim };   // 足からの浮き / はき口の高さ / はき口の傾き / 底の厚み / 底のはみ出し
  // shoes.kind (2026-10-05, Saori: boots, high heels, laced sneakers): "sneaker" (as before) / "laced" (the same with laces, a part of its own)
  // / "boots" (up the calf, following it, the top a little flared) / "heels" (low-cut pumps with a heel: the foot is tilted toes-down in every
  // pose, heelPose; the heel is built slanted so that tilted it stands straight down to the floor)
  // / "heelBoots" (2026-10-10, for 島風's: boots on a high heel, the foot tilted as in heels; the heel a flat block (a rudder's fin) and the
  // sole under the toes are the soles' part, in their own color). Boots of both kinds can have a cuff at the top (shoes.cuff, m: a band
  // standing out a little, painted shoes.cuffColor in index.js)
  const KIND = OPT.outfit.shoes.kind ?? "sneaker", HBOOTS = KIND === "heelBoots", BOOTS = KIND === "boots" || HBOOTS, HEELS = KIND === "heels" || HBOOTS, PUMPS = KIND === "heels";
  const FK = OPT.body.proportion?.feet ?? 1;   // the feet's size (body.proportion.feet): the heels' own pieces grow with them
  const TOP = BOOTS ? OPT.outfit.shoes.bootHeight : HEELS ? 0.058 : SHOE.top, TILT = BOOTS ? 0.12 : HEELS ? 0.3 : SHOE.tilt;
  const SHOE_PARTS = ["shoeLast", "calf", "toeBox", ...(BOOTS ? ["calfO", "calfB", ...(HBOOTS ? ["calfLow", "heel", "ball", "toe0", "toe1", "toe2", "toe3"] : [])] : [])], SOLE_PARTS = ["shoeLast", "toeBox", ...(HBOOTS ? ["heel", "ball", "toe0", "toe1", "toe2", "toe3"] : [])];   // (heel boots: over the bare foot's own heel and toes too: they stood out under the boot)   // toeBox: over bare toes (body foot.toes), none without them
  // each foot's from its own side's pieces only: blended together, the two heel boots' cuffs met between the knees and stretched into a web
  // when the legs parted (2026-10-10, 島風 in the official picture's pose), and so did any shoes on feet set close (the adult type's,
  // ankles 7 cm from the middle: Saori, "大人体形で歩くと足同士がくっついています")
  const bySide = (names) => { const L = blend(names.flatMap((n) => P[`${n}.L`] ? [P[`${n}.L`]] : [])), R = blend(names.flatMap((n) => P[`${n}.R`] ? [P[`${n}.R`]] : [])); return (x, y, z) => x >= 0 ? L(x, y, z) : R(x, y, z); };
  const shoeCore = bySide(SHOE_PARTS), soleCore = bySide(SOLE_PARTS);
  const HP = HEELS ? heelPose(OPT, J) : null, heelSpikes = HEELS ? ["L", "R"].map((s) => { const f = P[`shoeLast.${s}`], a = [f.cx, -0.001, f.cz - 0.05 * FK], d = [0, -Math.cos(HP.theta), Math.sin(HP.theta)];
    if (HBOOTS) { const L = HP.heel - 0.01, w = [0, d[2], -d[1]];   // a block: thin across, long front to back (tapering toward the floor), along d; w: forward across it
      return { t: 3, bx0: a[0], by0: a[1] - L / 2, bz0: a[2], br: L, k: 0.004, f: (x, y, z) => { const q = [x - a[0], y - a[1] + 0.012, z - a[2] - 0.004], u = q[1] * d[1] + q[2] * d[2], v = q[1] * w[1] + q[2] * w[2], t = Math.min(1, Math.max(0, u / L));
        const hl = (0.026 - 0.008 * t) * FK, c = (0.004 + 0.006 * t) * FK;   // half its length front to back, its middle moving forward toward the floor
        const bx = Math.abs(q[0]) - 0.0105 * FK, bv = Math.abs(v - c) - hl, bu = Math.max(-u, u - L);
        return Math.min(Math.max(bx, bv, bu), 0) + Math.hypot(Math.max(bx, 0), Math.max(bv, 0), Math.max(bu, 0)) - 0.002; } }; }
    return C(a, a.map((v, i) => v + d[i] * (HP.heel - 0.005)), 0.011, 0.005, `foot.${s}`, 0.006); }) : [];   // from under the heel, slanted forward by the tilt: straight down once tilted
  // heels: a pointed toe (a flat cone forward and a little toward the big toe, smoothly joined), and no rubber sole: the shoe itself goes down
  // to the floor, all one color (2026-10-05, Saori: "ゴム部分がついてる、先も尖ってない")
  const toePoints = PUMPS ? ["L", "R"].map((s) => { const f = P[`foot.${s}`], m = Math.sign(f.cx), a = [f.cx, 0.016, 0.03 * FK], b = [f.cx - m * 0.01 * FK, 0.006, 0.128 * FK], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), u = [0, 1, 2].map((i) => (b[i] - a[i]) / L), FY = 0.45;
    return (x, y, z) => { const p = [x - a[0], y - a[1], z - a[2]], t = Math.min(1, Math.max(0, (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) / L)), q = [0, 1, 2].map((i) => p[i] - u[i] * t * L), r = (0.028 * (1 - t) + 0.003) * FK;
      return (Math.hypot(q[0], q[2], q[1] / FY) - r) * FY; }; }) : [];
  // heels: thin leather close to the foot (0.6 cm, not a sneaker's 1.2), over a narrower foot (body/index.js) and a slimmer toe (2026-10-07)
  const SHOE_OFF = PUMPS ? 0.006 : SHOE.off, CUFF = BOOTS ? OPT.outfit.shoes.cuff ?? 0 : 0;
  const shoeTop = (x, y, z) => TOP - TILT * z - y;   // how far under the top (m, base): the cuff is painted by it
  // boots' straps (shoes.straps, for シルヴィ): up to 2 bands round the shaft under the top, 2.5 mm out (their color: index.js paintBands)
  const STRAPS = BOOTS ? strapRanges(OPT.outfit.shoes) : [], strapIn = (t) => { let v = 0; for (const [a, b] of STRAPS) v = Math.max(v, sstep(a - 0.002, a + 0.002, t) * sstep(b + 0.002, b - 0.002, t)); return v; };
  const shoeSdf0 = (x, y, z) => { let c = shoeCore(x, y, z) - SHOE_OFF - (BOOTS ? (HBOOTS ? 0.001 + 0.006 : 0.004 + 0.008) * sstep(TOP - 0.04, TOP, y) + (HBOOTS ? 0.001 : 0.004) * (1 - sstep(TOP - 0.04, TOP, y)) : 0) - (CUFF ? 0.006 * sstep(CUFF + 0.004, CUFF - 0.004, shoeTop(x, y, z)) : 0) - (STRAPS.length ? 0.0025 * strapIn(shoeTop(x, y, z)) : 0); for (const t of toePoints) c = smin(c, t(x, y, z), 0.02);   // (boots: a little looser, flared at the top; a cuff a little further out)
    let d = Math.max(c, y - (TOP - TILT * z), PUMPS ? -0.003 - y : HBOOTS ? 0.004 - y : -0.003 + SHOE.sole * 0.6 - y);   // はき口は前が低い / 甲は底の上にのる (heels: down to the floor, no sole under it)
    if (!HBOOTS) for (const h of heelSpikes) d = Math.min(d, dPrim(h, x, y, z)); return d; };
  const HB = heelBend(OPT), shoeSdf = HB ? (x, y, z) => shoeSdf0(x, HB(x, y, z), z) : shoeSdf0;   // heels: the forefoot bent up at the ball as the body's is (body/index.js heelBend), flat on the floor once tilted
  const soleSdf0 = PUMPS ? () => 1 : HBOOTS ? (x, y, z) => Math.max(soleCore(x, y, z) - SHOE.off - 0.004, y - 0.009, -0.007 - y)   // (heel boots: a thin sole, a little wider than the boot, its bottom under the socks' (2.5 mm under the foot): they showed white under it)
    : (x, y, z) => Math.max(soleCore(x, y, z) - SHOE.off - SHOE.rim, y - (-0.003 + SHOE.sole), -0.007 - y);   // (heels: none) (its bottom under the socks', as the heel boots')
  const soleSdf = HBOOTS ? (x, y, z) => { let d = soleSdf0(x, HB ? HB(x, y, z) : y, z); for (const h of heelSpikes) d = Math.min(d, dPrim(h, x, y, z)); return d; } : soleSdf0;   // heel boots: the sole bent as the boot is, and the heels
  // laces (shoes.kind "laced"): across the instep in four rows, each from an eyelet over the top to the other (three points on the shoe's
  // surface, a little above it), and a bow at the top row: two loops and two ends
  const lacesSdf = KIND === "laced" ? (() => { const parts = [], surf = (x, z) => { let lo = 0.025, hi = 0.14; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (shoeSdf(x, m, z) < 0) lo = m; else hi = m; } return lo; };
    // criss-cross in four rows and a bow (2026-10-05, Saori chose this one of bow / criss-cross / straight bars; a bar at the toe end didn't stay)
    const ZS = [0.046, 0.058, 0.07, 0.082], nrm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    for (const s of ["L", "R"]) { const cx = P[`foot.${s}`].cx, r = 0.0038, bn = `foot.${s}`, k = 0.003;
      const pt = (x, z) => [x, surf(x, z) + 0.0025, z], w = (i) => 0.018 - 0.0025 * i;
      const seg = (a, b) => { const m = pt(cx, (a[2] + b[2]) / 2); parts.push(C(a, m, r, r, bn, k), C(m, b, r, r, bn, k)); };   // from one eyelet over the top to another
      ZS.forEach((z, i) => { const L = pt(cx - w(i), z), R = pt(cx + w(i), z);
        if (i + 1 < ZS.length) { const z2 = ZS[i + 1]; seg(L, pt(cx + w(i + 1), z2)); seg(R, pt(cx - w(i + 1), z2)); } });   // each row to the other side of the next
      { const z = ZS[0] + 0.012, b = [cx, surf(cx, z) + 0.01, z];   // the bow: a knot, two loops out and up, two ends hanging forward
        parts.push(E(b, [0.006, 0.005, 0.006], bn, k));
        for (const sx of [-1, 1]) { const u = nrm([sx, 0.55, 0]), v = [0, 0, 1], ww = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          parts.push(E(b.map((c, q) => c + u[q] * 0.017), [0.018, 0.011, 0.005], bn, k, [u, v, ww]), C(b, [cx + sx * 0.012, b[1] - 0.012, z + 0.022], 0.0034, 0.003, bn, k)); } } }
    return (x, y, z) => { let d = 1; for (const q of parts) d = Math.min(d, dPrim(q, x, y, z)); return d; }; })() : null;   // (the top found from inside the shoe: lo starts above the sole, where it is inside)
  // 靴下: 形は足のまま、色だけ変える(体の表面にごく薄くかぶせる)
  const SOCK_TOP = FIT.socksTop ?? OPT.outfit.socks.top;   // 靴下のはき口の高さ
  const sockSdf = (x, y, z, B = bodySdf) => Math.max(B(x, y, z) - 0.0025, y - SOCK_TOP);
  // the full-body suit (outfit.suit; 2026-10-07, Saori: "プラグスーツのような全身スーツ"): the body itself 2.5 mm out (as the socks are), from a
  // high collar (higher at the back) down over the feet, cut off at the wrists. Its second color (collar, cuffs, boots, side panels): index.js
  const WRISTS = ["L", "R"].map((s) => { const h = J[`hand.${s}`], a = J[`lowerArm.${s}`], l = Math.hypot(h[0] - a[0], h[1] - a[1], h[2] - a[2]); return { h, d: [0, 1, 2].map((i) => (h[i] - a[i]) / l) }; });
  const suitSdf = (x, y, z, B = bodySdf) => { let d = Math.max(B(x, y, z) - 0.0025, y - (0.81 - 0.12 * z));
    for (const W of WRISTS) { const q = [x - W.h[0], y - W.h[1], z - W.h[2]]; if (Math.hypot(...q) < 0.15) d = Math.max(d, q[0] * W.d[0] + q[1] * W.d[1] + q[2] * W.d[2] + 0.006); }   // past the wrist (only near the hand: the plane would cut the thigh beside it)
    return d; };
  const armor = (OPT.outfit.armor.style === "full" ? buildPlate : buildArmor)(OPT, { P, J, HT, bodySdf });   // 鎧: 体にそわせず、かんたんな形をかぶせた硬い部品(軽鎧 armor.js / 全身鎧 plate.js)
  const weapons = buildWeapons(OPT, { J, bodySdf });   // 武器: 手に持つ硬い部品(weapons.js)
  // cape (outfit.cape): a shell over the shoulders that hangs down the back, open in front. Over the shoulders it is the body pushed out
  // (a mantle); from the shoulder line down, an elliptic cone around the body that flares toward the hem (more at the back than at the sides).
  // Its front edge is behind the arms (they hang forward of it), and over the shoulders it wraps forward (cape.wrap). It moves as cloth (cloth.js)
  // cape.front "closed" (a capelet, for シルヴィ): it goes on round the front, closed at cape.close and opening below it (cape.open: the
  // half-width gained per m down), its top dipping in front to the closure. Its sides flare at the upper arm's slope (rest pose), so the arms
  // stay under it, and it never goes inside the body pushed out (the chest). Its hem rises toward the front by cape.tilt per m.
  // capeSdf.lo / .hi: its box (parts.js); .edge: how far in from the hem or the front's edges (m, as built: the trim line, index.js); .hemOf: the hem's height (base)
  const CA = OPT.outfit.cape, CAPE_Y = capeTop(J), capeSdf = CA?.on ? (() => {
    const CLOSED = CA.front === "closed", ST = makeStretch(OPT, J);
    const out = (dx, dz) => { let t = 0; while (t < 0.4 && bodySdf(dx * t, CAPE_Y, dz * t) < 0) t += 0.001; return t; };
    const off = 0.026, ax0 = out(1, 0) + off, az0 = out(0, -1) + off, k = 0.02;   // off: over the shirt and its sleeves
    // over a skirt (or a dress's): at least as wide as the skirt at every height (it goes on flaring below the hem), else the skirt showed through its sides
    // (above the skirt's top it narrows at 45°: a step there showed as a crack across the cape)
    const sk = SKIRT ? (y) => { const d = SK_Y0 - y, m = 0.02 + SK.pleatDepth; return [SK_AX + (d > 0 ? SK.flare * d : d) + m, SK_AZ + (d > 0 ? SK.flare * 0.8 * d : d) + m + Math.abs(SK_ZC)]; } : null;
    const smax = (a, b, k = 0.02) => -smin(-a, -b, k);
    // the upper arm's outer side at a height (rest pose): its axis, and 7.5 cm round it (the arm, a sleeve, the cape's offset) across the slant
    const UA = J["upperArm.L"], LA = J["lowerArm.L"], armK = (LA[0] - UA[0]) / Math.max(0.05, UA[1] - LA[1]), armX = (y) => UA[0] + armK * (UA[1] - y) + 0.075 * Math.hypot(1, armK);
    // with a hood the cut round the neck is the hood's (inside its rim), so the collar's line is raised: cut there it laid the shirt's shoulders bare beside the rim
    const HOOD_UP = 0.025;
    const CLOSE = CA.close ?? 0.7, OPEN = CA.open ?? 0.6, ON = Math.hypot(1, OPEN), TILT = CLOSED ? CA.tilt ?? 0 : 0;
    const top = (x, z) => CA.collar - 0.12 * z + (CLOSED ? (CLOSE + 0.015 - CA.collar) * sstep(-0.01, 0.07, z) * (1 - sstep(0.03, 0.07, Math.abs(x))) : 0) + (CA.hood ? HOOD_UP : 0);   // the collar a little higher at the back
    const hemY = (z) => CA.hem + TILT * z;
    const opening = (x, y, z) => Math.max((Math.abs(x) - 0.004 - OPEN * Math.max(0, CLOSE - y)) / ON, 0.02 - z);   // < 0 in the front's opening
    // the cape's outside before its cuts (S): the cone, and the body pushed out
    const outside = (x, y, z, B = bodySdf) => {
      const drop = Math.max(0, CAPE_Y - y), s = sk ? sk(y) : null, ax1 = ax0 + CA.flare * 0.6 * drop, ax0_ = CLOSED ? smax(ax1, armX(y), 0.03) : ax1, az0_ = az0 + CA.flare * drop, ax = s ? smax(ax0_, s[0]) : ax0_, az = s ? smax(az0_, s[1]) : az0_;
      const q = Math.hypot(x / ax, z / az), cone = Math.max(CLOSED ? (q - 1) * q / Math.max(1e-6, Math.hypot(x / (ax * ax), z / (az * az))) : (q - 1) * Math.min(ax, az), y - CAPE_Y);   // (closed: a flat ellipse, so its distance to first order)
      const mantle = CLOSED ? B(x, y, z) - off : Math.max(B(x, y, z) - off, CAPE_Y - 0.03 - y);
      return smin(cone, mantle, k); };
    // cape.hood: a hood lying down. Its rim (its own part, "hood": finer cells than the cloth's, which left it ragged): a roll lying on the cape round the neck, a U on an ellipse from one end of the closure (closed:
    // beside the middle at cape.close; open: the neck's sides) round the back, standing up behind the neck (taller and thicker there); inside
    // the U the cape is cut away (the shirt shows between the closure's ends). A rim ending at the neck's sides stood behind it like a screen.
    // Its body: a second layer on the cape's back (its outside pushed out), as wide as the shoulders at the collar and narrowing to a
    // rounded point down the back, puffed in the middle
    const hood = CA.hood ? (() => {
      const NK = P.neck, HS = CA.hoodSize ?? 1, zAx = (y) => NK.az + NK.bz * (y - NK.ay) / NK.by, a = NK.ra + 0.045, zB = zAx(CA.collar) - NK.ra - 0.03;
      let XF = a, zF = zAx(CA.collar) + 0.03;   // the U's ends (open: at the neck's sides)
      if (CLOSED) { XF = NK.ra * 0.95; zF = 0.3; while (zF > 0 && outside(XF, CLOSE, zF) > 0) zF -= 0.001; }   // (closed: on the cape's front at the closure)
      const c = Math.sqrt(Math.max(0, 1 - (XF / a) ** 2)), b = (zF - zB) / (1 + c), zc = zB + b, PH = Math.PI - Math.asin(Math.min(1, XF / a));   // ellipse: half axes a, b about z = zc; the U from -PH to PH (0 at the back)
      // the roll's centre line (PX, PY, PZ: on the cape, its radius RR up) and how far it stands up from there (ST: behind the neck)
      const N = 64, PX = [], PY = [], PZ = [], Y0 = [], RR = [], ST = [];
      for (let i = 0; i <= N; i++) { const ph = -PH + 2 * PH * i / N, x = a * Math.sin(ph), z = zc - b * Math.cos(ph), back = Math.cos(ph / 2) ** 2;   // back: 1 behind the neck, 0 at the ends
        let y = top(x, z); while (y > CAPE_Y - 0.12 && outside(x, y, z) > 0) y -= 0.001;   // its foot on the cape (or on its cut top)
        const r = 0.008 + 0.008 * Math.min(1, 3 * back);
        PX.push(x); PY.push(y - 0.004 + r); PZ.push(z); Y0.push(y - 0.004); RR.push(r); ST.push(0.03 * back * back * HS); }
      const yLo = Math.min(...Y0) - 0.03, yHi = Math.max(...PY.map((y, i) => y + ST[i] + RR[i])) + 0.03, xHi = a + 0.03, zLo = zB - 0.03, zHi = zF + 0.03;
      const footAt = (ph) => { const t = Math.min(N, Math.max(0, (ph + PH) / (2 * PH) * N)), i = Math.min(N - 1, Math.floor(t)), f = t - i; return Y0[i] * (1 - f) + Y0[i + 1] * f; };
      const yT = footAt(0) + 0.01, hw = 0.13 * HS, hd = 0.13 * HS;   // the body starts under the roll behind the neck (above it, it climbed the neck's back as a board)
      return { lo: [-xHi, yLo, zLo], hi: [xHi, yHi, zHi],
        rim: (x, y, z) => { const db = Math.hypot(Math.max(0, Math.abs(x) - xHi), Math.max(0, yLo - y, y - yHi), Math.max(0, zLo - z, z - zHi)); if (db > 0) return db + 0.01;   // (outside its box: a lower bound)
          let best = 1e9;
          for (let i = 0; i < N; i++) { const ax = PX[i], ay = PY[i], az = PZ[i], dx = PX[i + 1] - ax, dy = PY[i + 1] - ay, dz = PZ[i + 1] - az;
            const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz || 1))), qx = ax + t * dx, qy = ay + t * dy, qz = az + t * dz;
            const h = Math.hypot(x - qx, z - qz); if (h - 0.017 > best) continue;
            const r = RR[i] + (RR[i + 1] - RR[i]) * t, st = ST[i] + (ST[i + 1] - ST[i]) * t, v = y - qy;
            best = Math.min(best, Math.hypot(h, v > 0 ? Math.max(0, v - st) : v) - r); }   // a roll along the line, standing up st over it
          return best; },
        hole: (x, y, z) => Math.max((Math.hypot(x / a, (z - zc) / b) - 1) * Math.min(a, b), footAt(Math.atan2(x / a, -(z - zc) / b)) + 0.004 - y),   // < 0 inside the U, over its foot
        layer: (x, y, z, S) => { const t = Math.min(1, Math.max(0, (yT - y) / hd)), e = Math.hypot(x / (hw * (1 - 0.4 * t)), (y - yT) / hd);
          return Math.max(S - 0.008 - 0.014 * Math.max(0, 1 - e * e), -S - 0.002, (e - 1) * Math.min(hw, hd), z + 0.02, y - yT); } };
    })() : null;
    const f = (x, y, z, B = bodySdf) => {
      const S = outside(x, y, z, B), cut = CLOSED ? -opening(x, y, z) : z - (-0.04 + (CA.wrap + 0.04) * sstep(CAPE_Y - 0.04, CAPE_Y + 0.03, y));   // open: the front edge behind the arms below the shoulders
      const d = Math.max(S, -(S + CA.thick), y - top(x, z), cut, hemY(z) - y);
      return hood ? Math.max(smin(d, hood.layer(x, y, z, S), 0.004), -hood.hole(x, y, z)) : d; };
    const w = CLOSED ? Math.max(0.3 + CA.flare * 0.6, armX(Math.min(CA.hem, hemY(-0.3))) + 0.05) : 0.3 + CA.flare * 0.6, d = 0.2 + CA.flare * 0.7;
    f.lo = [-w, Math.min(CA.hem, hemY(-d)) - 0.02, -d]; f.hi = [w, CA.collar + 0.05, CLOSED ? d : CA.wrap + 0.1];
    f.edge = (x, y, z) => Math.min((y - hemY(z)) * ST.slope(y), CLOSED ? opening(x, y, z) : Infinity);
    f.hemOf = (x, z) => hemY(z);
    f.closed = CLOSED;
    f.rim = hood ? { sdf: hood.rim, lo: hood.lo, hi: hood.hi } : null;   // the hood's rim (parts.js "hood")
    return f;
  })() : null;
  // and the shoes and soles never within 4 mm of the middle: on the adult type's close feet (3 cm apart) two sneakers, pushed out 2 cm, met
  // there in one mesh and tore apart walking
  const apart = (f) => (x, y, z) => Math.max(f(x, y, z), 0.004 - Math.abs(x));
  return { pantsSdf, shirtSdf, bellOf, cuffOf, petticoat: !!PETTI, skirtHem: SKIRT ? (x, z) => hemAt(x, z - SK_ZC) : null, shoeSdf: apart(shoeSdf), shoeTop, sockSdf, soleSdf: apart(soleSdf), lacesSdf, capeSdf, suitSdf, WRISTS, armor, weapons, extras: buildExtras(OPT),   // extras: animal ears, wings (extras.js)
    garments: buildGarments(OPT, { P, J, bodySdf, shirtSdf, slope: ((ST) => (y) => ST.slope(y))(makeStretch(OPT, J)) }) };   // the garment parts (src/garments: a sailor collar and scarf, gloves, hip strings, a headband...)
}
