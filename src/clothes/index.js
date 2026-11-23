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
  // shirt.sleeveWidth (a bell sleeve, for アステル): the bell as wide as this from the elbow (m, its radius) and cut square at the cuff: a round
  // tube (the bell's 4.2 cm at the elbow, under the upper arm's sleeve, and its slanted opening made a trumpet)
  const SLW = BELL ? SH.sleeveWidth ?? 0 : 0, BR = SLW || 0.042, SLANT = SLW ? 0 : 0.7;
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
  // shirt.collar.notch (for シルヴィ): a V cut down from the neckline at the front middle, notch deep and notchWidth wide at the top. Past
  // the neckline's rounding (rounded with it, so small a cut came out a U)
  const NOTCH = (OPT.outfit.shirt.collar.notch ?? 0) > 0 ? (() => { const D = OPT.outfit.shirt.collar.notch, k = D / Math.max(0.002, (OPT.outfit.shirt.collar.notchWidth ?? 0.016) / 2), kn = Math.hypot(1, k);
    return (x, y, z) => { if (z < 0.02) return -1; const t = Math.min(1, Math.max(0, (y - 0.725) / 0.12)), nz = z - (-0.032 + 0.038 * t + COLLAR.fwd), rz = nz > 0 ? nz * (1 + COLLAR.front) : nz;
      return (y - (COLLAR.y - COLLAR.tilt * nz + COLLAR.bowl * (x * x + rz * rz) - D) - k * Math.abs(x)) / kn; }; })() : null;   // > 0 inside the V (its point notch under the neckline)
  // belt.blouse (m, アステル's): the shirt puffs out this much over a belt, right above it (tucked under at its top edge, gone 6 cm up), round
  // the torso alone (the sleeves hang by the waist). The belt's top in base heights, from its width in built metres
  const BL = OPT.outfit.belt, BLOUSE = BL?.on && (BL.blouse ?? 0) > 0 ? BL.blouse : 0, BT = BLOUSE ? (BL.y ?? 0.52) + (BL.width ?? 0.04) / 2 / makeStretch(OPT, J).slope(BL.y ?? 0.52) : 0;
  const blouseAt = (x, y, z) => { const u = y + (BL?.tilt ?? 0) * z; return sstep(BT, BT + 0.012, u) * (1 - sstep(BT + 0.02, BT + 0.06, u)) * (1 - sstep(0.135, 0.165, Math.abs(x))); };
  // belt.blouseUnder (m): a skirt's (or a dress's) top puffs out as much under the belt, from its bottom edge down 6 cm. Put the skirt's top at
  // the belt's bottom edge: its top hugs the shirt there and flares below, which read as a pinch under the belt
  const BLOUSE_U = BL?.on && (BL.blouseUnder ?? 0) > 0 ? BL.blouseUnder : 0, BB = BLOUSE_U ? (BL.y ?? 0.52) - (BL.width ?? 0.04) / 2 / makeStretch(OPT, J).slope(BL.y ?? 0.52) : 0;
  const underAt = (y, z) => { const u = y + (BL?.tilt ?? 0) * z; return sstep(BB, BB - 0.012, u) * (1 - sstep(BB - 0.025, BB - 0.06, u)); };
  const SHOULDER_FIT = { x0: OPT.outfit.shirt.shoulderFit.x0, xw: OPT.outfit.shirt.shoulderFit.xWidth, off: OPT.outfit.shirt.shoulderFit.offset, y0: OPT.outfit.shirt.shoulderFit.y0, y1: OPT.outfit.shirt.shoulderFit.y1 };   // 肩の上だけ体にそわせる: 浮き / ここから / ここまでで効ききる
  // the bell sleeve: a shell around the forearm from the elbow (as wide as the sleeve) to the cuff, open there. It hangs: the bell's middle
  // drops below the arm toward the cuff, and its lower side reaches further (a slanted opening that shows from the front)
  const bellAt = (x, y, z, A) => { const t = (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz, px = x - A.fx - t * A.gx, py = y - A.fy - t * A.gy, pz = z - A.fz - t * A.gz;
    const u = Math.min(1, Math.max(0, t / A.Lf)), c = BELL * 0.6 * u * u, s = px * A.dx + py * A.dy + pz * A.dz;   // s: how far below the arm (across it)
    const cone = (Math.hypot(px - c * A.dx, py - c * A.dy, pz - c * A.dz) - (BR + BELL * Math.pow(u, 1.6))) * 0.85;
    return [cone, t - (A.Lf + 0.01 + SLANT * Math.max(0, s)), t]; };   // its outside, the opening's cut, how far down the forearm
  const bellShell = (x, y, z, A) => { const [cone, end, t] = bellAt(x, y, z, A); return Math.max(cone, -(cone + 0.014), end, -t); };
  // each bell as a sheet (sdf/sheet.js), from 3 cm up inside the sleeve (its top hidden there) to the opening: joined to the shirt, which is
  // then meshed without them at its own cells (index.js withParts; at the bells' 7.4 mm cells the whole shirt was 37,000 triangles)
  const bellSheets = BELL ? ARMS.map((A) => { const R = BR + 1.6 * BELL + 0.04, e = A.Lf + 0.04 + 0.7 * R, ends = [[A.fx - 0.04 * A.gx, A.fy - 0.04 * A.gy, A.fz - 0.04 * A.gz], [A.fx + e * A.gx, A.fy + e * A.gy, A.fz + e * A.gz]];
    return { o: (x, y, z) => bellAt(x, y, z, A)[0], tk: 0.014, cut: (x, y, z) => { const b = bellAt(x, y, z, A); return Math.max(b[1], -b[2] - 0.03); },
      lo: [0, 1, 2].map((k) => Math.min(ends[0][k], ends[1][k]) - R), hi: [0, 1, 2].map((k) => Math.max(ends[0][k], ends[1][k]) + R) }; }) : null;
  // which arm's bell a point of the shirt belongs to ("L" / "R"), or null: on the bell's surface and off the body (the shirt's own side is
  // 1.4 cm off it). For the skin weights: the bell's lower side hangs by the hips, and following them it stretched into a web from the waist
  // to the arm when the arms went up (2026-10-05, Saori: "Tポーズで袖の裾が腰に張り付いてる")
  // (nearer the bell's surface than the shirt without the bell: where the bell's lower side lies against the hips, "off the body" missed some)
  const bellOf = BELL ? (x, y, z, B = bodySdf) => { for (const A of ARMS) { if (x * A.side <= 0) continue; const b = Math.abs(bellShell(x, y, z, A));
    if (b < 0.008 && b < Math.abs(shirtSdf(x, y, z, B, true)) - 0.001) return A.side > 0 ? "L" : "R"; } return null; } : null;
  // a long or bell sleeve's cuff: how far up the sleeve from its end (m, square to the slanted bell's opening), 1 off the sleeves (shirt.cuffColor's band)
  const cuffOf = LONG ? (x, y, z) => { for (const A of ARMS) { if (x * A.side <= 0) continue;
    const t = (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz, px = x - A.fx - t * A.gx, py = y - A.fy - t * A.gy, pz = z - A.fz - t * A.gz, s = px * A.dx + py * A.dy + pz * A.dz;
    if (t < A.Lf * 0.3 || Math.hypot(px, py, pz) > 0.038 + BR + BELL * 1.6) continue;
    return BELL ? (A.Lf + 0.01 + SLANT * Math.max(0, s) - t) / (s > 0 && SLANT ? 1.22 : 1) : A.Lf - 0.012 - t; } return 1; } : null;
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
    if (BLOUSE) d -= BLOUSE * blouseAt(x, y, z);
    return Math.max(sm(sm(d, neck), fit), HEM - y - (HEM_X < Infinity ? 1.5 * Math.max(0, Math.abs(x) - HEM_X) : 0), NOTCH ? NOTCH(x, y, z) : -1); };   // tuck: すそはズボンの中に入れる
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
  // side panels (skirtOf's sideDrop, sideAt, sideOut, middleBack; for シルヴィ): the sides hang sideDrop m lower than the middle panels in
  // front and behind (middleBack false: in front only, the back all one long panel), from sideAt (the sine of the angle round from the middle
  // line) on, standing sideOut m out over them: two layers, a petticoat showing under the shorter middle ones
  const SD = SKIRT ? SK.sideDrop ?? 0 : 0, SAT = SK.sideAt ?? 0.4, SOUT = SD > 0 ? SK.sideOut ?? 0.005 : 0, SW = 0.04;
  // slit (m, アステル's tunic): the middle panel cut apart from the side ones from the hem up this far, in a V: closed at its top, slitWidth (m)
  // across at the hem, as two panels hanging apart (a gap as wide all the way up read as a slit cut in one cloth). It runs as a front print's
  // borders do, in the front view: its middle at |x| = slitX at its top (null: where sideAt's angle meets the hem), slitLean further out at
  // the hem; put it in the middle of the print's band between the panels, so both keep a border. The step between them lies inside it
  const SLIT = SD > 0 ? SK.slit ?? 0 : 0, SLITW = SK.slitWidth ?? 0.012, YT = SK.hem + SLIT, XS = SLIT ? SK.slitX ?? (() => { const d = SK_Y0 - SK.hem, ax = SK_AX + SK.flare * d, az = SK_AZ + SK.flare * 0.8 * d;
    return SAT / Math.sqrt(SAT * SAT / (ax * ax) + (1 - SAT * SAT) / (az * az)); })() : 0, LEAN = SK.slitLean ?? 0;
  const slitAt = (y) => { const t = Math.min(1, Math.max(0, (YT - y) / Math.max(SLIT, 1e-6))); return [XS + LEAN * t, Math.max(0.002, SLITW / 2 * t)]; };   // its middle and half its width at y (m)
  const CINCH = SKIRT ? SK.cinch ?? 0 : 0, CINCH_AT = SK.cinchAt ?? 0.55;   // skirtOf's cinch (m) at cinchAt (base): drawn in there, as by a belt
  const MB = SK.middleBack !== false, sideOf = (x, dz, y = SK.hem) => { if (!(SD > 0)) return 0; if (!MB && dz < 0) return 1;
    if (SLIT) { const [c, h] = slitAt(y), w = Math.max(0.001, 0.7 * h); return sstep(c - w, c + w, Math.abs(x)); }
    return sstep(SAT - SW, SAT + SW, Math.abs(x) / (Math.hypot(x, dz) || 1)); };   // (at the sides |x| / r is 1 either way)
  const hemAt = (x, dz) => { const h = SK.hem - SD * sideOf(x, dz); if (HS !== "zigzag" && HS !== "scallop") return h; const e = 2 * (((Math.atan2(x, dz) / (2 * Math.PI) + 1) * HN) % 1) - 1;
    return h + HD * (HS === "zigzag" ? Math.abs(e) : 1 - Math.sqrt(Math.max(0, 1 - e * e))); };
  // the hem's cut as a distance: over the panels' step it is steep round the skirt, so divided by its slope there (else 3x too far, and
  // the mesher's coarse pass skipped the step)
  const hemCut = (x, y, dz) => { const v = hemAt(x, dz) - y; if (!SD || (!MB && dz < 0)) return v;
    if (SLIT) { const [c, h] = slitAt(SK.hem), w = Math.max(0.001, 0.7 * h), u = Math.min(1, Math.max(0, (Math.abs(x) - c + w) / (2 * w))); return v / Math.hypot(1, SD * 6 * u * (1 - u) / (2 * w)); }
    const r = Math.hypot(x, dz) || 1, u = Math.min(1, Math.max(0, (Math.abs(x) / r - SAT + SW) / (2 * SW)));
    return v / Math.hypot(1, SD * 6 * u * (1 - u) / (2 * SW) * Math.abs(dz) / (r * r)); };
  const slitCut = (x, y, dz) => { if (!SLIT || (!MB && dz < 0)) return -1; const [c, h] = slitAt(y), a = Math.abs(Math.abs(x) - c);
    return y > YT ? 0.002 - Math.hypot(a, y - YT) : h - a; };   // > 0 in the slit (a 4 mm round tip at its top)
  // front tabs (skirtOf's tabDrop, tabAt, tabWidth; for シルヴィ's straps' ends): two pointed tabs of the skirt hanging tabDrop below the hem
  // in front, tabAt out from the middle; as a distance in the front view (x, y), < 0 inside. Below the hem they lie on the petticoat and
  // take its color (bands by the plain hem): a print on the front shows on them. From the hem down they sink to the petticoat's face (1 cm
  // in), so their edges, standing out of it, don't frame the print like a shadow (Saori: "縦帯の下に緑の影")
  const TD = SKIRT ? SK.tabDrop ?? 0 : 0, TA = SK.tabAt ?? 0.1, TW = (SK.tabWidth ?? 0.04) / 2, TP = Math.min(TD, TW * 0.6), TN = Math.hypot(TW, TP);   // TP: the point's height
  const tabCut = (x, y, dz) => { if (!TD || dz <= 0) return 1; const u = Math.abs(Math.abs(x) - TA), h = hemAt(Math.sign(x) * TA, dz), tip = h - TD;
    return Math.max(u - TW, y - h - 0.02, (u * TP - (y - tip) * TW) / TN); };
  const shapeOut = (y) => { const t = Math.min(1, Math.max(0, (SK_Y0 - y) / SPAN)); let e = CURL * 0.12 * sstep(0.55, 1, t) ** 2;
    return e; };
  // a petticoat (skirtOf's under: m it shows below the hem, for シルヴィ): a pleated layer just inside the skirt from 3 cm over the hem down
  // past it, flaring on as the skirt does, with its own pleats (underPleats). Part of the skirt's mesh, so it moves with the cloth; its
  // color is the skirt's bands below the hem (index.js, by skirtHem: the hem's height, base, at a point's angle)
  // (1 cm inside the skirt and as thick: thinner than its cells' 0.45 × it came out ragged under the hem)
  const PETTI = SKIRT && (SK.under ?? 0) > 0 ? (() => { const UP = SK.underPleats ?? 24, Y1 = SK.hem - SK.under, tk = SK.thick * Math.hypot(1, SK.flare);
    const out = (x, y, z, flat = 0) => { const drop = Math.max(0, SK_Y0 - y), dz = z - SK_ZC, th = Math.atan2(x / (SK_AX + SK.flare * drop), dz / (SK_AZ + SK.flare * 0.8 * drop));
      return DRAPE(x, y, z) - SK.flare * Math.max(0, SK.hem - y) * 0.9 + 0.01 + 0.008 * Math.abs(Math.sin(th * UP / 2)) * sstep(SK.hem + 0.02, Y1, y) * (1 - flat); };
    const f = (x, y, z) => { const o = out(x, y, z); return Math.max(-smin(-Math.max(o, -(o + tk)), -(Y1 - y), 0.008), y - SK.hem - 0.03); };
    // as a sheet: 7 mm thick (in the skirt's cloth over the hem, its top out of sight from inside too; as thick as the skirt, its rim stood 1 cm
    // proud of the skirt's inside in a line), and flat under the front tabs: the straps' ends are printed there. As sheets the tabs, standing
    // apart from it, were framed in outlines (the shapes merged in one distance had no edge there; Saori: "縦帯の下に緑の影")
    f.sheet = { o: (x, y, z) => out(x, y, z, TD && z - SK_ZC > 0 ? sstep(0.012, 0, tabCut(x, y, z - SK_ZC)) : 0), tk: 0.007, cut: (x, y, z) => Math.max(Y1 - y, y - SK.hem - 0.03) }; return f; })() : null;
  const skirtSdf = (x, y, z, B = bodySdf) => { const d = skirtSdf0(x, y, z, B); return PETTI ? smin(d, PETTI(x, y, z), 0.005) : d; };
  // the skirt's outer side (< 0 inside; the cloth between it and -tk) and its thickness there
  function skirtOuter(x, y, z, B = bodySdf) {
    const drop = Math.max(0, SK_Y0 - y), ax = SK_AX + SK.flare * drop, az = SK_AZ + SK.flare * 0.8 * drop, dz = z - SK_ZC;
    const th = Math.atan2(x / ax, dz / az), pl = SK.pleatDepth * sstep(SK_Y0 - 0.02, SK.hem, y) * Math.abs(Math.sin(th * SK.pleats / 2));
    const top = SK_Y0 - SK_TILT * z; let outer = DRAPE(x, y, z) + pl - shapeOut(y) * 0.9;   // < 0 inside
    // side panels: out over the middle ones, flaring on below the middle's hem; sideOut < 0 (アステル's tunic): the middle panel out over the
    // sides near its hem (the sides pushed in went under the clothes below: the shorts showed through in slivers; cut apart by a slit, at the
    // cloth's 8 mm cells a few mm wide slit came out jagged)
    if (SD) outer -= (SOUT < 0 ? -SOUT * (1 - sideOf(x, dz, y)) * sstep(SK.hem + Math.max(0.05, SLIT), SK.hem, y) : SOUT * sideOf(x, dz)) + SK.flare * Math.max(0, SK.hem - y) * 0.9;
    if (CINCH) outer += CINCH * Math.exp(-(((y - CINCH_AT) / 0.035) ** 2));   // drawn in round cinchAt (a belt), smoothly: no step
    if (TD && dz > 0 && y < SK.hem + 0.01) { const tc = tabCut(x, y, dz); if (tc < 0.004) { const h = hemAt(Math.sign(x) * TA, dz); outer += 0.01 * sstep(h, h - TD, y) * sstep(0.004, 0, tc); } }   // the tabs sink toward their tips
    if (SK_BAND && y > top - SK_BAND) outer += (Math.min(shirtSdf(x, y, z, B, true), B(x, y, z) - 0.008) - (SK.dress ? 0.003 - 0.006 * sstep(top - 0.02, top, y) : 0.007) - outer) * sstep(top - SK_BAND, top - 0.015, y) * (1 - sstep(SK_AX - 0.01, SK_AX + 0.03, Math.abs(x)));   // (the torso only: round long sleeves at the elbows it made fins, 2026-10-07)
    if (BLOUSE_U) outer -= BLOUSE_U * underAt(y, z);   // (after the band: hugging the shirt it was gone)
    return outer; }
  const skirtTk = (y) => { const slope = Math.abs(shapeOut(y + 0.005) - shapeOut(y - 0.005)) / 0.01 + SK.flare;   // where it flares nearly flat a sideways thickness is thin across the cloth: thicker by the slope
    return SK.thick * Math.hypot(1, slope); };
  const skirtTop = (z) => SK_Y0 - SK_TILT * z, skirtCut = (x, y, z) => { const dz = z - SK_ZC; return Math.max(TD ? Math.min(hemCut(x, y, dz), tabCut(x, y, dz)) : hemCut(x, y, dz), slitCut(x, y, dz)); };
  // tiers: a shell each, flaring out within it, its top tucked 1.2 cm up under the one above, so each tier has its own hem edge (and outline):
  // tier i's outside, top and bottom
  const tierOf = (i, y) => { const n = Math.min(5, HN), t = (SK_Y0 - y) / SPAN, l = Math.min(1, Math.max(0, t * n - i));
    return { off: HD * (0.8 * i + 0.9 * l) * 0.9, yTop: i ? SK_Y0 - SPAN * i / n + 0.012 : Infinity, yBot: SK_Y0 - SPAN * (i + 1) / n }; };
  function skirtSdf0(x, y, z, B = bodySdf) {
    const dz = z - SK_ZC, top = skirtTop(z), outer = skirtOuter(x, y, z, B), tk = skirtTk(y), shell = (o) => Math.max(o, -(o + tk));
    // the hem's edge rounded (HR, m): cut square through the thin shell it meshed in steps, and the outline stood out of the steps in black
    // slivers (2026-10-09, Saori: "裾の黒いの"; worst at the scallops' notches)
    if (HS !== "tiers") return Math.max(-smin(-shell(outer), -skirtCut(x, y, z), 0.008), y - top);
    let d = 1e9;
    for (let i = 0, n = Math.min(5, HN); i < n; i++) { const T = tierOf(i, y); d = Math.min(d, Math.max(shell(outer - T.off), y - Math.min(top, T.yTop), T.yBot - y)); }
    return d; };
  // the skirt as sheets (sdf/sheet.js: each made through its middle, then given both sides): the skirt (or its tiers) and the petticoat.
  // h: their cells at most a quarter of a pleat round the hem. Deep pleats close together (the forest's 44, 2.2 cm deep, 3.6 cm apart, in
  // 2 cm cloth) are no sheet: its sides, pushed out, crossed inside each fold in holes. Such a skirt is meshed as a distance (null)
  const pleatCell = (n, depth) => { const d = SK_Y0 - SK.hem; return n > 0 && depth > 0.003 ? 2 * Math.PI * Math.min(SK_AX + SK.flare * d, SK_AZ + SK.flare * 0.8 * d) / n / 4 : Infinity; };
  const skirtSheets = SKIRT && pleatCell(SK.pleats, SK.pleatDepth) >= 0.0095 ? (B = bodySdf) => [
    ...(HS !== "tiers" ? [{ o: (x, y, z) => skirtOuter(x, y, z), of: (x, y, z) => skirtOuter(x, y, z, B), tk: (x, y, z) => skirtTk(y), h: pleatCell(SK.pleats, SK.pleatDepth), cut: (x, y, z) => Math.max(hemCut(x, y, z - SK_ZC), y - skirtTop(z), slitCut(x, y, z - SK_ZC)) }]   // (the front tabs: the petticoat's)
      : Array.from({ length: Math.min(5, HN) }, (_, i) => ({ o: (x, y, z) => skirtOuter(x, y, z) - tierOf(i, y).off, of: (x, y, z) => skirtOuter(x, y, z, B) - tierOf(i, y).off, tk: (x, y, z) => skirtTk(y), h: pleatCell(SK.pleats, SK.pleatDepth), cut: (x, y, z) => { const T = tierOf(i, y); return Math.max(y - Math.min(skirtTop(z), T.yTop), T.yBot - y); } }))),
    ...(PETTI ? [{ ...PETTI.sheet, h: pleatCell(SK.underPleats ?? 24, 0.008) }] : [])] : null;
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
  const SHOE_PARTS = ["shoeLast", "calf", "toeBox", ...(BOOTS ? ["calfO", "calfB", "calfOut", "calfInner", "calfBack", "achilles", ...(HBOOTS ? ["calfLow", "heel", "ball", "toe0", "toe1", "toe2", "toe3"] : [])] : [])], SOLE_PARTS = ["shoeLast", "toeBox", ...(HBOOTS ? ["heel", "ball", "toe0", "toe1", "toe2", "toe3"] : [])];   // (heel boots: over the bare foot's own heel and toes too: they stood out under the boot)   // toeBox: over bare toes (body foot.toes), none without them
  // each foot's from its own side's pieces only: blended together, the two heel boots' cuffs met between the knees and stretched into a web
  // when the legs parted (2026-10-10, 島風 in the official picture's pose), and so did any shoes on feet set close (the adult type's,
  // ankles 7 cm from the middle: Saori, "大人体形で歩くと足同士がくっついています")
  const bySide = (names) => { const L = blend(names.flatMap((n) => P[`${n}.L`] ? [P[`${n}.L`]] : [])), R = blend(names.flatMap((n) => P[`${n}.R`] ? [P[`${n}.R`]] : [])); return (x, y, z) => x >= 0 ? L(x, y, z) : R(x, y, z); };
  const shoeCore0 = bySide(SHOE_PARTS), soleCore0 = bySide(SOLE_PARTS);
  // shoes.shaft (boots, for スバル): leather doesn't follow a leg that narrows to the ankle. A straight tube down the leg's line from under the
  // top to the floor: at the ankle this much (0–1) of the way to as wide as the leg is under the top. Measured round the leg's axis (the calf
  // sits behind it); the sole is under it too (its back is the heel's)
  const SHAFT = BOOTS && !HBOOTS ? OPT.outfit.shoes.shaft ?? 0 : 0;
  const shafts = SHAFT > 0 ? ["L", "R"].map((s) => { const a = J[`foot.${s}`], b = J[`lowerLeg.${s}`], ax = (y) => { const t = (y - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]; };
    const ring = (y) => { const c = ax(y), far = (dx, dz) => { let t = 0.005; while (t < 0.15 && shoeCore0(c[0] + dx * t, y, c[1] + dz * t) < 0) t += 0.001; return t; }, x0 = far(-1, 0), x1 = far(1, 0), z0 = far(0, -1), z1 = far(0, 1);
      return [(x1 - x0) / 2, (z1 - z0) / 2, (x0 + x1) / 2, (z0 + z1) / 2]; };   // its middle off the axis (x, z), its radii (x, z)
    const y1 = TOP - 0.035, y0 = a[1] + 0.03, R1 = ring(y1), R0 = ring(y0).map((v, i) => v + (R1[i] - v) * SHAFT);
    return { ax, y0, y1, R0, R1 }; }) : null;
  const shaftD = shafts ? (x, y, z) => { const T = shafts[x >= 0 ? 0 : 1], f = Math.min(1, Math.max(0, (y - T.y0) / (T.y1 - T.y0))), c = T.ax(y), q = (i) => T.R0[i] + (T.R1[i] - T.R0[i]) * f, rx = q(2), rz = q(3);
    return (Math.hypot((x - c[0] - q(0)) / rx, (z - c[1] - q(1)) / rz) - 1) * Math.min(rx, rz); } : null;
  // shoes.toeLow (boots): the toe lower toward its tip (its height over the sole × 1 − toeLow there): a wedge from the side, not a dome
  const TOE_LOW = BOOTS && !HBOOTS ? OPT.outfit.shoes.toeLow ?? 0 : 0, LAST = P["shoeLast.L"], TZ0 = LAST.cz + 0.2 * LAST.rz, TZ1 = LAST.cz + LAST.rz, TY0 = -0.003 + SHOE.sole * 0.6;
  const shoeCore = shafts || TOE_LOW ? (x, y, z) => { const c = shoeCore0(x, TOE_LOW ? TY0 + (y - TY0) / (1 - TOE_LOW * sstep(TZ0, TZ1, z)) : y, z); return shafts ? smin(c, shaftD(x, y, z), 0.015) : c; } : shoeCore0;
  const soleCore = shafts ? (x, y, z) => Math.min(soleCore0(x, y, z), shaftD(x, y, z)) : soleCore0;
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
  // shoes.cuffTube (boots, for アステル): the cuff a round tube standing off the shaft (a turned-down cuff, cuffOut out past the shaft's widest
  // under it, CW thick) and open at the top round the leg; the shaft ends inside it. As the shaft pushed out (cuffOut alone) it read as one soft boot
  const TUBE = BOOTS && !HBOOTS && CUFF > 0 && OPT.outfit.shoes.cuffTube, CW = 0.008, FD = 0.014, FO = CW / 2 - 0.003, FW = 0.018, FN = Math.hypot(1, FD / FW);   // FD, FO, FW: the funnel's depth, where it starts in from the outside, how wide it is
  let tubes = null;
  const tubeO = (x, y, z) => { const T = tubes[x >= 0 ? 0 : 1], f = (y - T.a[1]) / T.l; return (Math.hypot((x - T.a[0] - T.u[0] * f) / T.rx, (z - T.a[2] - T.u[2] * f) / T.rz) - 1) * T.r; };   // (m) off the tube's middle
  // how far under the top (m, base): the cuff is painted by it (a tube's outside all of it: across its bottom edge onto the shaft the band's edge
  // was jagged; only on the tube: a toe box rising under it took the band's color)
  const shoeTop = (x, y, z) => { const t = TOP - TILT * z - y; if (!tubes || t <= 0 || t > CUFF) return t; const o = tubeO(x, y, z); return o > -CW / 2 - 0.002 && o < CW / 2 + 0.003 ? Math.min(t, CUFF - 0.004) : t; };
  // boots' straps (shoes.straps, for シルヴィ): up to 2 bands round the shaft under the top, 2.5 mm out (their color: index.js paintBands)
  const STRAPS = BOOTS ? strapRanges(OPT.outfit.shoes) : [], strapIn = (t) => { let v = 0; for (const [a, b] of STRAPS) v = Math.max(v, sstep(a - 0.002, a + 0.002, t) * sstep(b + 0.002, b - 0.002, t)); return v; };
  // shoes.notch (boots, for シルヴィ): a V cut down from the top at the front middle of each shaft (on the leg's axis there; the back half
  // keeps its top: the face between them is inside the leg)
  const SNOTCH = BOOTS && (OPT.outfit.shoes.notch ?? 0) > 0 ? (() => { const D = OPT.outfit.shoes.notch, k = D / Math.max(0.003, (OPT.outfit.shoes.notchWidth ?? 0.024) / 2), kn = Math.hypot(1, k);
    const axis = ["L", "R"].map((s) => { const a = J[`foot.${s}`], b = J[`lowerLeg.${s}`], t = (TOP - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]; });
    return (x, y, z) => { const c = axis[x >= 0 ? 0 : 1]; if (z < c[1]) return -1; return (y - (TOP - TILT * z - D) - k * Math.abs(x - c[0])) / kn; }; })() : null;
  // shoes.toeCap (boots, for アステル): a round toe box, toeCap times the last's height over it (the last alone tapers to a low, long toe)
  const SHOE_LOW = PUMPS ? -0.003 : HBOOTS ? 0.004 : -0.003 + SHOE.sole * 0.6;   // the upper's bottom: on the sole
  const TOE_CAP = BOOTS && !HBOOTS && (OPT.outfit.shoes.toeCap ?? 0) > 0 ? ["L", "R"].map((s) => { const l = P[`shoeLast.${s}`], ry = l.ry * (1 + OPT.outfit.shoes.toeCap);
    return E([l.cx, l.cy - l.ry + ry, l.cz + l.rz * 0.48], [l.rx * 0.94, ry, l.rz * 0.54], `foot.${s}`); }) : null;
  const shoeSdf0 = (x, y, z, low = SHOE_LOW) => { let c = shoeCore(x, y, z) - SHOE_OFF - (BOOTS ? (HBOOTS ? 0.001 + 0.006 : 0.004 + 0.008) * sstep(TOP - 0.04, TOP, y) + (HBOOTS ? 0.001 : 0.004) * (1 - sstep(TOP - 0.04, TOP, y)) : 0) - (CUFF && !TUBE ? (OPT.outfit.shoes.cuffOut ?? 0.006) * sstep(CUFF + 0.004, CUFF - 0.004, shoeTop(x, y, z)) : 0) - (STRAPS.length ? 0.0025 * strapIn(shoeTop(x, y, z)) : 0); for (const t of toePoints) c = smin(c, t(x, y, z), 0.02);   // (boots: a little looser, flared at the top; a cuff a little further out)
    if (TOE_CAP) c = smin(c, dPrim(TOE_CAP[x >= 0 ? 0 : 1], x, y, z) - SHOE_OFF, 0.012);
    let d = Math.max(c, y - (TOP - TILT * z), low - y, SNOTCH ? SNOTCH(x, y, z) : -1);   // はき口は前が低い / 甲は底の上にのる (heels: down to the floor, no sole under it)
    if (!HBOOTS) for (const h of heelSpikes) d = Math.min(d, dPrim(h, x, y, z));
    // (its outer edges rounded wider than a cell: cut sharp, the mesh's points fell on one face or the other in a saw.) Its top a funnel, from
    // a 3 mm rim down inward to FD under it, the shaft's top lowered to that floor: hollow, its 8 mm wall and the gap inside it were about a
    // cell at "game" (9.5 mm for the shoes) and came out as a saw
    if (tubes) { const o = tubeO(x, y, z), top = TOP - TILT * z, bot = top - CUFF + 0.002, r = -smin(-(o - CW / 2), -(bot - y), 0.008);
      const k = Math.min(1, Math.max(0, (FO - o) / FW)), ft = (y - top + FD * k) / (k > 0 && k < 1 ? FN : 1);
      d = Math.max(Math.min(d, r), ft); }
    return d; };
  if (TUBE) tubes = ["L", "R"].map((s) => { const a = J[`foot.${s}`], b = J[`lowerLeg.${s}`], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], m = Math.sign(a[0]) || 1;
    // the shaft's widest round the axis under the cuff (across and front to back), measured on the boot without the tube
    const at = (y) => a.map((v, i) => v + u[i] * (y - a[1]) / u[1]), wide = [0, 0];
    for (let y = TOP - CUFF; y <= TOP; y += 0.01) { const c = at(y);
      for (const [k, dx, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 1], [1, 0, -1]]) { let t = 0.01; while (t < 0.2 && shoeSdf0(c[0] + dx * m * t, y, c[2] + dz * t) < 0) t += 0.001; wide[k] = Math.max(wide[k], t); } }
    const OUT = OPT.outfit.shoes.cuffOut ?? 0.006, rx = wide[0] + OUT - CW / 2, rz = wide[1] + OUT - CW / 2;
    return { a, u, l: u[1], rx, rz, r: (rx + rz) / 2 }; });
  const ARCH = !HEELS ? Math.min(OPT.outfit.shoes.archCut ?? 0, SHOE.sole * 0.7) : 0, ARCH_L = 0.04 * FK;   // (m) the notch's height, its length front to back
  const HEEL_B = BOOTS && !HBOOTS ? OPT.outfit.shoes.heelBlock ?? 0 : 0, HEEL_Z = P["shoeLast.L"].cz - P["shoeLast.L"].rz * 0.3;   // (m; the step's place)
  const HB = heelBend(OPT), shoeSdf = HB ? (x, y, z) => shoeSdf0(x, HB(x, y, z), z) : (x, y, z) => shoeSdf0(x, y, z);   // heels: the forefoot bent up at the ball as the body's is (body/index.js heelBend), flat on the floor once tilted
  const soleSdf0 = PUMPS ? () => 1 : HBOOTS ? (x, y, z) => Math.max(soleCore(x, y, z) - SHOE.off - 0.004, y - 0.009, -0.007 - y)   // (heel boots: a thin sole, a little wider than the boot, its bottom under the socks' (2.5 mm under the foot): they showed white under it)
    : (x, y, z) => { const c = soleCore(x, y, z) - SHOE.off - SHOE.rim, d = Math.max(c, y - (-0.003 + SHOE.sole), -0.007 - y);   // (heels: none) (its bottom under the socks', as the heel boots')
      const e = HEEL_B ? Math.min(d, Math.max(c, y - (-0.003 + SHOE.sole + HEEL_B), -0.007 - y, z - HEEL_Z)) : d; if (!ARCH) return e;
      const up = -0.007 + ARCH - y, n = Math.max(-up, HEEL_Z - z, z - (HEEL_Z + ARCH_L) - 0.7 * up); return -smin(-e, n, 0.004); };   // shoes.archCut: a notch up into the sole before the heel (the heel's front upright, the front sole's end slanting)   // shoes.heelBlock: higher under the heel, its front a step
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
    const UA = J["upperArm.L"], LA = J["lowerArm.L"], armK = (LA[0] - UA[0]) / Math.max(0.05, UA[1] - LA[1]), HAND_Y = J["hand.L"][1];
    // cape.over "body" (アステル's long cloak): its sides hang from the shoulders, a little out (as arms hang), not along the rest pose's arms;
    // the arms push it out as they rise (cloth.js colliders) and it rides on the body alone (parts.js). Over the arms, a cloak down to the
    // knees was half on the arms and half on the hips, and folded over itself between them when the arms came down
    const OVER_BODY = CLOSED && CA.over === "body", armS = OVER_BODY ? Math.min(armK, 0.21) : armK;
    const torso = OVER_BODY ? blendFast(pick("chest", "upperChest", "bust", "belly", "pelvis", "waist", "neck", "trap", "shoulder", "butt"), [-0.4, 0.3, -0.3], [0.4, 0.95, 0.3]) : null;
    const armX = (y) => UA[0] + armS * (UA[1] - Math.max(y, HAND_Y)) + 0.075 * Math.hypot(1, armS);   // (under the hands a long cape's sides hang straight: the slope run on made a tent)
    // cape.closeX (m, アステル's): the closure that far toward the character's left, the right side's flap lying over the middle to it
    const CLOSE = CA.close ?? 0.7, OPEN = CA.open ?? 0.6, ON = Math.hypot(1, OPEN), TILT = CLOSED ? CA.tilt ?? 0 : 0, CX = CLOSED ? CA.closeX ?? 0 : 0;
    const collarTop = (x, z) => CA.collar - 0.12 * z + (CLOSED ? (CLOSE + 0.015 - CA.collar) * sstep(-0.01, 0.07, z) * (1 - sstep(0.03, 0.07, Math.abs(x - CX))) : 0);   // the collar a little higher at the back
    const hemY = (z) => CA.hem + TILT * z;
    // cape.sideEdge: under the opening the sides end this far forward of the body's middle (behind it, アステル's cloak: the arms hang in front of the cape)
    const SE = CA.sideEdge ?? 0.02;
    const opening = (x, y, z) => Math.max((Math.abs(x - CX) - 0.004 - OPEN * Math.max(0, CLOSE - y)) / ON, SE - z);   // < 0 in the front's opening
    // cape.cowl (アステル's): the hood lying down as a collar standing round the neck, cowl m off it, up to cape.collar at the sides (higher
    // behind) and down to the closure in front, its own rim the roll (no hood's fold). The cape is made round the body and a column round
    // the neck: lying on the shoulders, the hood's neckline and its fold read as a sailor's collar
    const COWL = CA.cowl ?? 0, NK0 = P.neck, cowlCol = COWL ? (x, y, z) => { const s = (Math.min(y, CA.collar) - NK0.ay) / NK0.by;
      return Math.max(Math.hypot(x - NK0.ax - NK0.bx * s, z - NK0.az - NK0.bz * s) - (NK0.ra + COWL - off + CA.thick / 2), CAPE_Y - 0.05 - y); } : null;
    const capeBody = COWL ? (x, y, z) => smin(bodySdf(x, y, z), cowlCol(x, y, z), 0.02) : bodySdf;
    // the cape's outside before its cuts (S): the cone, and the body pushed out
    const outside = (x, y, z, B = bodySdf, col = true) => {
      const drop = Math.max(0, CAPE_Y - y), s = sk ? sk(y) : null, ax1 = ax0 + CA.flare * 0.6 * drop, ax0_ = CLOSED ? smax(ax1, armX(y), 0.03) : ax1, az0_ = az0 + CA.flare * drop, ax = s ? smax(ax0_, s[0]) : ax0_, az = s ? smax(az0_, s[1]) : az0_;
      const q = Math.hypot(x / ax, z / az), cone = Math.max(CLOSED ? (q - 1) * q / Math.max(1e-6, Math.hypot(x / (ax * ax), z / (az * az))) : (q - 1) * Math.min(ax, az), y - CAPE_Y);   // (closed: a flat ellipse, so its distance to first order)
      const m0 = OVER_BODY ? torso(x, y, z) - off : CLOSED ? B(x, y, z) - off : Math.max(B(x, y, z) - off, CAPE_Y - 0.03 - y);   // (over the body: not round the arms, which stand out of its sides in the rest pose)
      const mantle = COWL && col ? smin(m0, cowlCol(x, y, z) - off, 0.02) : m0;
      return smin(cone, mantle, k); };
    // cape.neckOpen (シルヴィ): the neckline cut low and wide (the clothes' shoulders show inside it): level round the body, a little
    // higher behind, neckOpen out from the neck at its sides; closed, it dips in front to the closure's ends (XF, at cape.close).
    // null: the collar round the neck (with a hood: 0.07). Its cut goes across the cloth, not level: level, the thick shell lying nearly
    // flat over the shoulders was cut on a long slant, and its edge came out jagged at the cloth's cells
    const NO = COWL || (CA.neckOpen ?? (CA.hood ? 0.07 : null)), MID = off - CA.thick / 2, XF = COWL ? 0.012 : P.neck.ra * 0.95, NK = P.neck;   // MID: the shell's middle (m off the body); XF: the closure's half-width (a cowl's: a V down to it)
    const zA = NK.az + NK.bz * (CA.collar - NK.ay) / NK.by;   // the neck's axis (z)
    const neck = NO == null ? null : (() => {
      // its height at the sides: going up from inside the shoulder (going down from above, an elf's long ears were found first)
      const xs = NK.ra + NO; let Y = COWL ? CA.collar : J["upperArm.L"][1] - 0.03; while (!COWL && Y < CA.collar + 0.06 && bodySdf(xs, Y, 0) < MID) Y += 0.001;   // (a cowl: as high as the collar)
      const at = (x, z) => { const nf = Y - 0.12 * z; if (!CLOSED) return nf; const u = x - CX, nv = CLOSE + (u * CX < 0 ? 0.5 : 1.2) * Math.max(0, Math.abs(u) - XF); return nf - sstep(0, 0.05, z) * Math.max(0, nf - nv); };
      // on each ray from the neck's axis (th from the back round to the front, D apart): where the shell's middle is at that height, and the
      // way along the shell there, outward (tr, ty); the rays stop at the closure's end (open: at the cape's front edge)
      const rays = [], D = Math.PI / 360, e = 0.002;
      for (let i = 0; i <= 360; i++) { const th = D * i, sx = Math.sin(th), sz = -Math.cos(th); let p = null;
        for (let t = 0.005; t < 0.35; t += 0.0008) { const x = sx * t, z = zA + sz * t, y = at(x, z); if (capeBody(x, y, z) >= MID) { p = [x, y, z]; break; } }
        if (!p) break;
        // (a closure off the middle: they stop as far out as it is, both sides alike; nearer it the cut is level, at the dip, which rises gently
        // on the side lying over the middle: as steep as the other, that cloth stood up in a corner in front of the throat)
        if (CLOSED && th > Math.PI / 2 && p[0] <= XF + Math.abs(CX)) { const q = rays.at(-1)?.p; if (q) { const k = (q[0] - XF - Math.abs(CX)) / Math.max(1e-6, q[0] - p[0]); rays.push({ ...rays.at(-1), p: q.map((v, j) => v + (p[j] - v) * k) }); } break; }
        if (!CLOSED && p[2] > -0.04 + (CA.wrap + 0.04) * sstep(CAPE_Y - 0.04, CAPE_Y + 0.03, p[1])) break;
        const nr = (capeBody(p[0] + sx * e, p[1], p[2] + sz * e) - capeBody(p[0] - sx * e, p[1], p[2] - sz * e)), ny = capeBody(p[0], p[1] + e, p[2]) - capeBody(p[0], p[1] - e, p[2]), l = Math.hypot(nr, ny) || 1;
        rays.push({ p, t: Math.hypot(p[0], p[2] - zA), tr: ny / l, ty: -nr / l }); }
      const END = (rays.length - 1) * D;   // (rad)
      // the line's ray at (x, z): its distance from the axis (t), the rest interpolated (null past the rays)
      const ray = (x, z) => { const th = Math.atan2(Math.abs(x), zA - z), k = th / D, i = Math.floor(k); if (!rays.length || k >= rays.length - 1) return null;
        const f = k - i, a = rays[i], b = rays[i + 1], m = (u, v) => u + (v - u) * f; return { th, t: m(a.t, b.t), y: m(a.p[1], b.p[1]), tr: m(a.tr, b.tr), ty: m(a.ty, b.ty) }; };
      // > 0 above the cut: near the line across the shell through it, turning level toward the closure (past the rays: the dip to it), and level
      // 2 cm over it; farther out level (across, the shell round an elf's ears hanging over the shoulders stayed)
      // (the rays are the +x side's: with the closure off the middle the other side's line is lifted by the sides' level difference; else the
      // cut there ran up to 3 cm under that side's roll, a hole under it)
      const cut = (x, y, z) => { const level = y - at(x, z), r = ray(x, z); if (!r) return level;
        const rN = Math.hypot(x, z - zA), across = (r.t - rN) * r.tr - (y - r.y - (x < 0 ? at(x, z) - at(-x, z) : 0)) * r.ty, w = 1 - sstep(END - 0.35, END, r.th);
        return Math.max(w * across + (1 - w) * level, level - 0.02 * (1 - sstep(0.015, 0.035, rN - r.t))); };
      return { at, cut, ray, line: rays.map((r) => r.p) };
    })();
    // cape.hood (シルヴィ): a hood lying down: a fold along the neckline (cape.hoodRim; its own part, "hood": 4 mm cells; at the cloth's 8 mm
    // it came out ragged) and the bag on the back. Across the line the fold is a mound, rounded on top, its outer side going down into the cape and its
    // inner side down onto the clothes, so nothing shows between them; wider inside and higher toward the back. (A roll lying on the cut
    // read as a tube, the clothes' shoulders showing under it; a rim on an ellipse round the neck as a stiff collar; a mound of cape as a
    // neck pillow)
    const hood = CA.hood ? (() => {
      const HS = CA.hoodSize ?? 1, raw = neck.line, END = Math.PI * (raw.length - 1) / 360;   // raw: the neckline's line (on the rays, to END round from the back)
      // evenly along it (the rays bunch where it turns), then both sides: from one end round the back to the other
      const L = [0]; for (let i = 1; i < raw.length; i++) L.push(L[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1], raw[i][2] - raw[i - 1][2]));
      const NH = 40, half = []; for (let k = 0, j = 0; k <= NH; k++) { const l = L.at(-1) * k / NH; while (j < L.length - 2 && L[j + 1] < l) j++; const f = (l - L[j]) / Math.max(1e-9, L[j + 1] - L[j]); half.push({ p: raw[j].map((v, m) => v + (raw[j + 1][m] - v) * Math.min(1, f)), u: 1 - k / NH }); }
      const path = [...half.slice(1).reverse().map((q) => ({ p: [-q.p[0], q.p[1], q.p[2]], u: q.u })), ...half.map((q) => ({ p: q.p, u: q.u }))];
      // each point's frame (T along the line, N off the body, A across it, away from the neck) and its mound (n: m off the shell's middle):
      // TOP its top; out to WO the outer side goes 8 mm into the cape, in to WI the inner side 12 mm into the body (u: 0 at the closure, 1 at the back)
      const M = path.length, F = (k) => new Float64Array(M), X = F(), Y = F(), Z = F(), NX = F(), NY = F(), NZ = F(), AX = F(), AY = F(), AZ = F(), TOP = F(), WO = F(), WI = F(), KO = F(), KI = F();
      const C0 = CA.thick / 2, NIN = -(MID + 0.012), e = 0.002;
      path.forEach(({ p, u }, i) => { const a = path[Math.max(0, i - 1)].p, b = path[Math.min(M - 1, i + 1)].p;
        let T = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...T); T = T.map((v) => v / l);
        let N = [bodySdf(p[0] + e, p[1], p[2]) - bodySdf(p[0] - e, p[1], p[2]), bodySdf(p[0], p[1] + e, p[2]) - bodySdf(p[0], p[1] - e, p[2]), bodySdf(p[0], p[1], p[2] + e) - bodySdf(p[0], p[1], p[2] - e)];
        const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = N.map((v, j) => v - d * T[j]); l = Math.hypot(...N); N = N.map((v) => v / l);
        let A = [N[1] * T[2] - N[2] * T[1], N[2] * T[0] - N[0] * T[2], N[0] * T[1] - N[1] * T[0]]; if (A[0] * p[0] + A[2] * (p[2] - zA) < 0) A = A.map((v) => -v);
        const back = u * u, ends = sstep(0, 0.1, u), hd = (0.010 + 0.010 * back) * HS * ends;
        X[i] = p[0]; Y[i] = p[1]; Z[i] = p[2]; NX[i] = N[0]; NY[i] = N[1]; NZ[i] = N[2]; AX[i] = A[0]; AY[i] = A[1]; AZ[i] = A[2];
        TOP[i] = C0 + hd; WO[i] = (0.022 + 0.006 * back) * HS; WI[i] = (0.016 + 0.03 * sstep(0.15, 0.5, u)) * HS;
        KO[i] = (TOP[i] - (C0 - 0.008)) / WO[i] ** 2; KI[i] = (TOP[i] - NIN) / WI[i] ** 2; });
      const RB = Math.max(...WI, ...WO) + Math.max(...TOP, -NIN) + 0.005;
      const lo = [Math.min(...X) - RB, Math.min(...Y) - RB, Math.min(...Z) - RB], hi = [Math.max(...X) + RB, Math.max(...Y) + RB, Math.max(...Z) + RB];
      // the lining: the hood's inside, lying on the clothes inside the neckline (11 mm off the body: the cape's inside is at 8); toward the front it
      // sinks into them (the shirt shows between the fold's ends), and at the neck. Only inside the line, up to 5.5 cm over it, less farther out (an elf's ears hang there)
      const lining = (x, y, z) => { const rz = z - zA, rN = Math.hypot(x, rz), th = Math.atan2(Math.abs(x), -rz), B = bodySdf(x, y, z);
        const g = -0.005 + 0.016 * (1 - sstep(Math.min(1.75, END - 0.25), Math.min(2, END), th)) * sstep(NK.ra - 0.002, NK.ra + 0.008, rN);   // (sunk 5 mm: nothing left)
        const r = neck.ray(x, z), inside = r ? rN - r.t - 0.004 : 0;   // (past the rays it has sunk)
        return Math.max(B - g, -(B + 0.004), neck.at(x, z) - 0.008 - y, y - neck.at(x, z) - 0.055 + 0.3 * Math.max(0, rN - NK.ra), inside); };
      const LS = Math.min(HS, 1.3), yT = half[0].p[1], hw = 0.16 * LS, hd = 0.15 * LS;   // the bag hangs from the neckline behind
      // with a cowl its top SH (m, at x = 0.004 i) 2.5 cm under the shoulders' top as if no cowl stood there, coming down no steeper than 45°: higher, its
      // corners stood on the shoulders and beside the ring (seen from the front and either side); steeper, its edge stood upright under the ring
      const SH = COWL ? (() => { const T = [], out = (x, y) => outside(x, y, zA, bodySdf, false);
        for (let i = 0; i * 0.004 <= hw + 0.004; i++) { const x = 0.004 * i; let y = yT + 0.03, a = y; while (y > yT - hd && out(x, y) > 0) { a = y; y -= 0.002; }
          for (let k = 0; k < 4; k++) { const m = (a + y) / 2; if (out(x, m) > 0) a = m; else y = m; }
          T.push(Math.max(y - 0.025, i ? T[i - 1] - 0.004 : -Infinity)); }
        return T; })() : null;
      // the bag: inside an ellipse narrowing downward (bagCut < 0), its top bagTop (m) over the cape's outer side: 14 mm at its rim, 52 in the middle (at 22 it lay flat as a print)
      const bagE = (x, y) => { const t = Math.min(1, Math.max(0, (yT - y) / hd)); return Math.hypot(x / (hw * (1 - 0.4 * t)), (y - yT) / hd); };
      const bagTop = (x, y) => { const e = bagE(x, y); return 0.014 + 0.038 * Math.max(0, 1 - e * e); };
      const bagOut = (x, y, z) => Math.max((bagE(x, y) - 1) * Math.min(hw, hd), z + 0.02), bagCut = (x, y, z) => Math.max(bagOut(x, y, z), y - yT);   // bagOut: its outline but the top
      return { lo, hi, rim: CA.hoodRim === false || COWL ? null : (x, y, z) => { const db = Math.hypot(Math.max(0, lo[0] - x, x - hi[0]), Math.max(0, lo[1] - y, y - hi[1]), Math.max(0, lo[2] - z, z - hi[2])); if (db > 0) return db + 0.01;   // (outside its box: a lower bound)
          let best = 1e9;
          for (let i = 0; i < M - 1; i++) { const sx = X[i + 1] - X[i], sy = Y[i + 1] - Y[i], sz = Z[i + 1] - Z[i], ll = sx * sx + sy * sy + sz * sz || 1, s = ((x - X[i]) * sx + (y - Y[i]) * sy + (z - Z[i]) * sz) / ll;
            const t = Math.min(1, Math.max(0, s)), qx = x - X[i] - t * sx, qy = y - Y[i] - t * sy, qz = z - Z[i] - t * sz;
            if (Math.hypot(qx, qy, qz) - RB > best) continue;
            const w = 1 - t, a = qx * (AX[i] * w + AX[i + 1] * t) + qy * (AY[i] * w + AY[i + 1] * t) + qz * (AZ[i] * w + AZ[i + 1] * t), n = qx * (NX[i] * w + NX[i + 1] * t) + qy * (NY[i] * w + NY[i + 1] * t) + qz * (NZ[i] * w + NZ[i + 1] * t);
            const top = TOP[i] * w + TOP[i + 1] * t, k = a >= 0 ? KO[i] * w + KO[i + 1] * t : KI[i] * w + KI[i + 1] * t, Fa = top - k * a * a;
            const beyond = Math.max(0, -s, s - 1) * Math.sqrt(ll) - (i === 0 && s < 0 || i === M - 2 && s > 1 ? 0 : 0.004);   // a little past each piece's ends (none at the line's own ends)
            best = Math.min(best, Math.max((n - Fa) / Math.hypot(1, 2 * k * a), a - (WO[i] * w + WO[i + 1] * t), -a - (WI[i] * w + WI[i + 1] * t), NIN - n, beyond)); }
          return smin(best, lining(x, y, z), 0.006); },
        layer: (x, y, z, S, deep = 0.002) => Math.max(S - bagTop(x, y), -S - deep, bagCut(x, y, z)),
        bagTop, bagCut, bagOut, bagY: (x) => { if (!SH) return yT; const k = Math.min(SH.length - 1.001, Math.abs(x) / 0.004), i = Math.floor(k); return Math.min(yT, SH[i] + (SH[i + 1] - SH[i]) * (k - i)); },
        bag: { lo: [-hw - 0.01, yT - hd - 0.01], hi: [hw + 0.01, yT + 0.01] } };
    })() : null;
    // cape.cowlRoll (m, with the cowl): its top a roll that thick (the hood rolled into a ring, アステル's sheet), its own part ("hood", fine
    // cells): an ellipse 1.5 times as tall across the neckline itself to both of the closure's ends (round the neck's own circle it sank into the
    // chest where the neckline comes forward: the cut edge showed). The cowl higher alone, or its cloth thicker, was a standing collar
    const roll = COWL && (CA.cowlRoll ?? 0) > 0 && neck ? (() => {
      const RA = CA.cowlRoll / 2, RB = RA * 1.5, S = Math.sign(CX), D = Math.PI / 360;
      // each side's line on its own (the neckline's rays are one side's, mirrored, and a closure off the middle makes the sides differ: the path
      // dropped down the other side's V and jumped back), on to the closure's end; the flap lying over the middle goes on across it to the far end
      const traceSide = (sg) => { const out = [], over = S !== 0 && sg !== S;
        for (let i = 0; i <= 360; i++) { const th = D * i, sx = sg * Math.sin(th), sz = -Math.cos(th); let q = null;
          for (let t = 0.005; t < 0.35; t += 0.0008) { const x = sx * t, z = zA + sz * t, y = neck.at(x, z); if (capeBody(x, y, z) >= MID) { q = [x, y, z]; break; } }
          if (!q) break; out.push(q);
          if (over ? th > Math.PI - 0.06 : th > Math.PI / 2 && Math.abs(q[0]) <= XF + Math.abs(CX)) break; }
        if (over) { const from = out.at(-1)[0], to = CX - S * XF, n = Math.ceil(Math.abs(to - from) / 0.003);
          for (let i = 1; i <= n; i++) { const x = from + (to - from) * i / n; let z = zA, y = neck.at(x, z); while (z < zA + 0.3 && capeBody(x, y, z) < MID) { z += 0.0008; y = neck.at(x, z); } out.push([x, y, z]); } }
        return out; };
      const first = traceSide(S >= 0 ? -1 : 1), raw = [...first.reverse(), ...traceSide(S >= 0 ? 1 : -1).slice(1)];
      const Ls = [0]; for (let i = 1; i < raw.length; i++) Ls.push(Ls[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1], raw[i][2] - raw[i - 1][2]));
      const LT = Ls.at(-1), M = Math.max(8, Math.ceil(LT / 0.005)), P = [];   // evenly along it
      for (let k = 0, j = 0; k <= M; k++) { const l = LT * k / M; while (j < raw.length - 2 && Ls[j + 1] < l) j++; const f = Math.min(1, (l - Ls[j]) / Math.max(1e-9, Ls[j + 1] - Ls[j])); P.push(raw[j].map((v, m) => v + (raw[j + 1][m] - v) * f)); }
      // smoothed (the ends kept): where the neckline turns down to the closure it bends tighter than the roll is thick, and the roll folded into itself there in dark creases
      for (let it = 0; it < 12; it++) { const Q = P.map((q) => q.slice()); for (let i = 1; i < M; i++) for (let m = 0; m < 3; m++) P[i][m] = (Q[i - 1][m] + 2 * Q[i][m] + Q[i + 1][m]) / 4; }
      // each point's frame: N off the cloth, U across the line toward the cut-off side (from the neck's axis, the frame spun where the line comes
      // straight out of it near the closure: shards)
      const e = 0.002, grad = (f, q) => [f(q[0] + e, q[1], q[2]) - f(q[0] - e, q[1], q[2]), f(q[0], q[1] + e, q[2]) - f(q[0], q[1] - e, q[2]), f(q[0], q[1], q[2] + e) - f(q[0], q[1], q[2] - e)];
      const frames = (P, body) => P.map((q, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let T = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...T); T = T.map((v) => v / l);
        let N = grad(body, q); const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = N.map((v, m) => v - d * T[m]); l = Math.hypot(...N) || 1; N = N.map((v) => v / l);
        let U = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]]; const g = grad(neck.cut, q); if (U[0] * g[0] + U[1] * g[1] + U[2] * g[2] < 0) U = U.map((v) => -v);
        return { N, U }; });
      // a tube along a path: at each point an ellipse A across the cloth by B along it, its middle at C (m); DR (optional): its lower half X longer,
      // measured there off the cloth itself (surf, less L: the middle's lift; across the path's plane it sank into the cape flaring out under it), F more
      const tube = (F, A, B, C, DR = null) => { const M = C.length - 1, NV = F.map((f) => f.N), UV = F.map((f) => f.U), RM = Math.max(...B.map((v, i) => v + (DR ? DR.X[i] : 0)), ...A) * 1.05;
        const lo = [0, 1, 2].map((m) => Math.min(...C.map((c) => c[m])) - RM - 0.01), hi = [0, 1, 2].map((m) => Math.max(...C.map((c) => c[m])) + RM + 0.01);
        // measured at the path's nearest point (each piece's own ellipse rippled the surface every 5 mm: the shading's edge sawn)
        const sdf = (x, y, z) => { let bd = 1e9, bi = 0, bt = 0;
          for (let i = 0; i < M; i++) { const c0 = C[i], c1 = C[i + 1], sx = c1[0] - c0[0], sy = c1[1] - c0[1], sz = c1[2] - c0[2], ll = sx * sx + sy * sy + sz * sz || 1e-12;
            const t = Math.min(1, Math.max(0, ((x - c0[0]) * sx + (y - c0[1]) * sy + (z - c0[2]) * sz) / ll)), d = Math.hypot(x - c0[0] - t * sx, y - c0[1] - t * sy, z - c0[2] - t * sz);
            if (d < bd) { bd = d; bi = i; bt = t; } }
          if (bd > RM + 0.02) return bd - RM;   // (far off it: a lower bound)
          const i = bi, t = bt, w = 1 - t, c0 = C[i], c1 = C[i + 1], qx = x - c0[0] - t * (c1[0] - c0[0]), qy = y - c0[1] - t * (c1[1] - c0[1]), qz = z - c0[2] - t * (c1[2] - c0[2]);
          const N0 = NV[i], N1 = NV[i + 1], U0 = UV[i], U1 = UV[i + 1], a = A[i] * w + A[i + 1] * t, b = B[i] * w + B[i + 1] * t;
          let nx = N0[0] * w + N1[0] * t, ny = N0[1] * w + N1[1] * t, nz = N0[2] * w + N1[2] * t, ux = U0[0] * w + U1[0] * t, uy = U0[1] * w + U1[1] * t, uz = U0[2] * w + U1[2] * t;
          const ln = Math.hypot(nx, ny, nz) || 1, lu = Math.hypot(ux, uy, uz) || 1, n = (qx * nx + qy * ny + qz * nz) / ln, u = (qx * ux + qy * uy + qz * uz) / lu;
          const tx = c1[0] - c0[0], ty = c1[1] - c0[1], tz = c1[2] - c0[2], tl = Math.hypot(tx, ty, tz) || 1, along = (qx * tx + qy * ty + qz * tz) / tl;   // past the path's ends: capped there
          let nn = n, bb = b;
          if (DR && u < 0) { const xx = DR.X[i] * w + DR.X[i + 1] * t; if (xx > 0) { bb = b + xx; const k = sstep(0, 0.02, -u) * Math.min(1, xx / 0.01); if (k > 0) nn += (DR.surf(x, y, z) - (DR.L[i] * w + DR.L[i + 1] * t) - n) * k; nn -= DR.F * Math.min(1, xx / 0.02) * (u / bb) ** 2; } }
          const best = (Math.hypot(nn / a, u / bb) - 1) * Math.min(a, bb);
          return (i === 0 && t === 0 && along < 0) || (i === M - 1 && t === 1 && along > 0) ? Math.max(best, Math.abs(along) - 0.002) : best;
        };
        return { sdf, lo, hi }; };
      // the roll: thinner over 10 cm to each end; the ellipse's middle lifted 0.45 of its height
      const F1 = frames(P, capeBody), end = (i) => Math.min(LT * i / M, LT * (1 - i / M)), K1 = P.map((q, i) => 1 - 0.6 * (1 - sstep(0, 0.1, end(i))));
      const R1 = tube(F1, K1.map((k) => RA * k), K1.map((k) => RB * k), P.map((q, i) => q.map((v, m) => v + F1[i].U[m] * 0.45 * RB * K1[i])));
      // cape.cowlRoll2 (m): a second roll that thick under it, twice as wide along the cloth, its top under the first and its middle 0.7 of its half
      // thickness out (lower, it lay flat: no crease, no outline); along a line DN down the cloth from the first, coming up to it over 15 cm to each end.
      // The hood has no bag: behind, this ring's lower half droops into its point (a bag over the ring came up through it in ragged seams; under it, a step)
      const T2 = CA.cowlRoll2 ?? 0; if (!(T2 > 0)) return R1;
      const A2 = T2 / 2, B2 = A2 * 2, DN = B2 + 0.55 * RB - 0.01, shell = (x, y, z) => outside(x, y, z) + CA.thick / 2, K2 = P.map((q, i) => sstep(0, 0.15, end(i)));
      const P2 = P.map((q, i) => { let p = q.map((v, m) => v - F1[i].U[m] * DN * K2[i]);
        for (let it = 0; it < 3; it++) { const g = grad(shell, p), l = Math.hypot(...g) || 1, d = shell(...p); p = p.map((v, m) => v - g[m] / l * d); }   // onto the cloth's middle
        return p; });
      const F2 = frames(P2, shell), S2 = K2.map((k) => 0.3 + 0.7 * k);
      // the droop: EX m, 7 cm at the middle to a point, none from 12 cm out (wider, its fading sides creased); its lower part lifted off the cloth
      // up to F at the tip (flat on it, it read as stuck on)
      const EX = P2.map((q) => { const s = Math.min(1, Math.abs(q[0]) / 0.12); return 0.07 * (1 - s) ** 2 * (1 + s) * sstep(-0.02, -0.06, q[2]); });
      const R2 = tube(F2, S2.map((k) => A2 * k), S2.map((k) => B2 * k), P2.map((q, i) => q.map((v, m) => v + F2[i].N[m] * 0.7 * A2 * S2[i])), { X: EX, L: S2.map((k) => 0.7 * A2 * k), surf: shell, F: 0.015 });
      return { sdf: (x, y, z) => Math.min(R1.sdf(x, y, z), R2.sdf(x, y, z)), lo: R1.lo.map((v, m) => Math.min(v, R2.lo[m])), hi: R1.hi.map((v, m) => Math.max(v, R2.hi[m])), two: true };
    })() : null;
    const BAG = hood && !roll?.two;
    const cutOf = (x, y, z) => Math.max(neck ? neck.cut(x, y, z) : y - collarTop(x, z), CLOSED ? -opening(x, y, z) : z - (-0.04 + (CA.wrap + 0.04) * sstep(CAPE_Y - 0.04, CAPE_Y + 0.03, y)), hemY(z) - y);   // open: the front edge behind the arms below the shoulders
    const f = (x, y, z, B = bodySdf) => {
      const S = outside(x, y, z, B), d = Math.max(S, -(S + CA.thick), cutOf(x, y, z));
      return BAG ? smin(d, hood.layer(x, y, z, S), 0.004) : d; };
    const w = CLOSED ? Math.max(0.3 + CA.flare * 0.6, armX(Math.min(CA.hem, hemY(-0.3))) + 0.05) : 0.3 + CA.flare * 0.6, d = 0.2 + CA.flare * 0.7;
    f.lo = [-w, Math.min(CA.hem, hemY(-d), hemY(d)) - 0.02, -d]; f.hi = [w, CA.collar + 0.05, CLOSED ? d : CA.wrap + 0.1];   // (a hem falling toward the front, tilt < 0, is lowest there)
    f.edge = (x, y, z) => Math.min((y - hemY(z)) * ST.slope(y), CLOSED ? opening(x, y, z) : Infinity);
    f.hemOf = (x, z) => hemY(z);
    f.closed = CLOSED; f.overArms = CLOSED && !OVER_BODY;
    f.rim = hood?.rim ? { sdf: hood.rim, lo: hood.lo, hi: hood.hi } : roll;   // the hood's fold and lining, or the cowl's roll (parts.js "hood")
    // as a sheet (sdf/sheet.js), and the hood's bag on its back as a sheet of its own over it, its underside 1 cm into the cloth (out of sight):
    // its rim cut exactly along its outline. As a lump at 8 mm cells its 8 mm edge melted into a slope (a soft blob instead of the V)
    f.sheets = (B = bodySdf) => [{ o: (x, y, z) => outside(x, y, z), of: (x, y, z) => outside(x, y, z, B), tk: CA.thick, cut: cutOf }];
    // Its top ends 1 cm under the neckline (and under its height at the back) and rises out of the cape over 3 cm (sunk 4 mm at its top): ending
    // on the neckline itself, its rim and the cape's ran together in black shards, worst over the shoulders
    f.bag = BAG ? { sheet: (B = bodySdf, one = false) => { const dTop = (x, y, z) => Math.max(cutOf(x, y, z), y - hood.bagY(x)), top = (x, y, z) => { const w = sstep(-0.01, -0.04, dTop(x, y, z)); return (hood.bagTop(x, y) - rim(x, y, z)) * w - 0.004 * (1 - w); };
      // one-sided (sdf/sheet.js `one`): no wall under the bag's rim, so over its last 3 cm the bag comes down onto the cape (5 mm over it): its edge's facet is the hood's outline there. Standing 14 mm off, one saw under it
      const rim = (x, y, z) => one ? 0.009 * (1 - sstep(0, 0.03, -hood.bagOut(x, y, z))) : 0;
      return { o: (x, y, z) => outside(x, y, z) - top(x, y, z), of: (x, y, z) => outside(x, y, z, B) - top(x, y, z), tk: (x, y, z) => top(x, y, z) + 0.01, smooth: 3, line: true, cut: (x, y, z) => Math.max(hood.bagOut(x, y, z), dTop(x, y, z) + 0.01) }; },
      lo: [...hood.bag.lo, f.lo[2]], hi: [...hood.bag.hi, -0.01] } : null;
    return f;
  })() : null;
  // and the shoes and soles never within 4 mm of the middle: on the adult type's close feet (3 cm apart) two sneakers, pushed out 2 cm, met
  // there in one mesh and tore apart walking
  const apart = (f) => (x, y, z) => Math.max(f(x, y, z), 0.004 - Math.abs(x));
  // for the garment parts (src/garments):
  // legsSdf(hem, off): pants cut at their own hem, off (m) off the body, whatever the outfit's own pants are (shorts under a skirt or a dress)
  const legsMask = blend([...pick("pelvis", "butt", "leghole", "belly", "thighF", "thighB", "thighIn", "thighOut"), CROTCH]);
  const legsSdf = (hem, off = PANTS_OFF, top = PANTS_TOP) => (x, y, z, B = bodySdf) => Math.max(B(x, y, z) - off, legsMask(x, y, z) - 0.054, y - (top - PANTS_TILT * z), hem - y);
  // outerSdf: the outside of what is worn round the torso (< 0 inside): the shirt without its bells, the skirt under its top, the pants (a belt lies on it)
  const outerSdf = (x, y, z, B = bodySdf) => Math.min(B(x, y, z), OPT.outfit.shirt.on !== false || OPT.outfit.dress?.on ? shirtSdf(x, y, z, B, true) : 1,
    SKIRT ? Math.max(skirtOuter(x, y, z, B), y - skirtTop(z)) : OPT.outfit.pants.on !== false ? pantsShape(x, y, z, B) : 1);
  // sleeveEnd(side): a long or bell sleeve's end round the forearm, or null: { out(x, y, z): < 0 inside the sleeve's outer side there,
  // up(x, y, z): how far up the sleeve from its end (m; a bell's slanted opening followed), lo, hi: a box round it grown by r }
  const sleeveEnd = LONG ? (side, r = 0.06) => { const A = ARMS[side === "L" ? 0 : 1], F = blend(pick("foreArm", "foreBulge").filter((q) => Math.sign(q.bx0) === A.side));
    const R = BR + 0.008 + 1.6 * BELL + r, e = A.Lf + 0.03 + 0.7 * R, ends = [[A.fx + 0.2 * A.Lf * A.gx, A.fy + 0.2 * A.Lf * A.gy, A.fz + 0.2 * A.Lf * A.gz], [A.fx + e * A.gx, A.fy + e * A.gy, A.fz + e * A.gz]];
    const along = (x, y, z) => { const t = (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz; return [t, (x - A.fx - t * A.gx) * A.dx + (y - A.fy - t * A.gy) * A.dy + (z - A.fz - t * A.gz) * A.dz]; };
    return { out: BELL ? (x, y, z) => bellAt(x, y, z, A)[0] : (x, y, z) => F(x, y, z) - 0.014,
      up: BELL ? (x, y, z) => { const [t, s] = along(x, y, z); return (A.Lf + 0.01 + SLANT * Math.max(0, s) - t) / (s > 0 && SLANT ? 1.22 : 1); } : (x, y, z) => A.Lf - 0.012 - along(x, y, z)[0],
      lo: [0, 1, 2].map((k) => Math.min(ends[0][k], ends[1][k]) - R), hi: [0, 1, 2].map((k) => Math.max(ends[0][k], ends[1][k]) + R) }; } : () => null;
  // the shirt's mesh: under a dress with slits and shorts its torso ends 1 cm under the shorts' top (the skirt's top band still follows the
  // whole shirt; the sleeves hanging by it are kept): through the slits its front print showed as a white line. Put the shorts' top over
  // the slits' (shorts.top): cut under a lower top, the skin showed between
  const ST_TOP = OPT.outfit.shorts?.on ? OPT.outfit.shorts.top ?? PANTS_TOP : null;
  const shirtMesh = SKIRT && SK.dress && SLIT && ST_TOP != null ? (x, y, z, B, noBell, noHole) => { const d = shirtSdf(x, y, z, B, noBell, noHole), ax = Math.abs(x);
    return ax > 0.19 ? d : Math.max(d, ST_TOP - PANTS_TILT * z - 0.01 - y - 2 * sstep(0.16, 0.19, ax)); } : shirtSdf;
  return { pantsSdf, skirtSheets, shirtSdf, shirtMesh, bellOf, bellSheets, cuffOf, petticoat: !!PETTI, skirtHem: SKIRT ? (x, z) => hemAt(x, z - SK_ZC) : null, shoeSdf: apart(shoeSdf), shoeCover: ARCH ? apart((x, y, z) => shoeSdf0(x, y, z, -0.03) - 0.012 * sstep(ARCH + 0.02, ARCH + 0.005, y)) : null, shoeTop, sockSdf, soleSdf: apart(soleSdf), lacesSdf, capeSdf, suitSdf, WRISTS, armor, weapons, extras: buildExtras(OPT),   // extras: animal ears, wings (extras.js)
    garments: buildGarments(OPT, { P, J, bodySdf, shirtSdf, slope: ((ST) => (y) => ST.slope(y))(makeStretch(OPT, J)), legsSdf, outerSdf, sleeveEnd }) };   // the garment parts (src/garments: a sailor collar and scarf, gloves, hip strings, a headband...)
}
