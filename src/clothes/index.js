// Clothes: shirt, pants, shoes (upper + sole) and socks, as signed distances built around the body.
// Functions taking B (the body distance) can be given a faster lookup of the same body while meshing.
import { smin, E, C, cut, blend, blendFast, sstep, dPrim } from "../sdf/prim.js";
import { skirtOf } from "../options.js";
import { buildArmor } from "./armor.js";
import { buildPlate } from "./plate.js";
import { buildWeapons } from "./weapons.js";

/** High heels (shoes.kind "heels"): the foot tilted toes-down by theta (shoes.heelAngle) about the ankle; lift: how far the body rises so the
 *  ball of the foot stays on the floor; heel: how high the heel's back is then (the heel's length) */
export function heelPose(OPT, J) {
  const th = (OPT.outfit.shoes.heelAngle ?? 24) * Math.PI / 180, A = J["foot.L"], c = Math.cos(th), s = Math.sin(th);
  const ball = A[1] + ((0 - A[1]) * c - (0.06 - A[2]) * s), lift = Math.max(0, -ball);   // the ball (y 0, z 0.06) turned with the foot
  const heelY = A[1] + ((-0.001 - A[1]) * c - (-0.035 - A[2]) * s) + lift;   // the heel's underside, turned and lifted
  return { theta: th, lift, heel: Math.max(0.01, heelY) };
}

/** the cape's shoulder line (rest pose): where the mantle over the shoulders turns into the part that hangs */
export const capeTop = (J) => J["upperArm.L"][1] + 0.005;

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
  const armParts = LONG ? ["sleeve", "upperArm", "foreArm"] : SLEEVE === "short" ? ["sleeve"] : [];
  const shirtCore = blendFast(pick("chest", "bust", "belly", "pelvis", "waist", "neck", "trap", "shoulder", ...armParts, ...(LEN === "out" ? ["butt"] : [])), [-0.4, 0.4, -0.25], [0.4, 0.95, 0.27]);   // out: over the bottom too (else the pants show through at the back)
  const arm = (s) => { const a = P[`upperArm.${s}`], f = P[`foreArm.${s}`], L = Math.hypot(a.bx, a.by), Lf = Math.hypot(f.bx, f.by, f.bz);   // armhole and cuff: planes across the arm
    const gx = f.bx / Lf, gy = f.by / Lf, gz = f.bz / Lf, dx = gx * gy, dy = gy * gy - 1, dz = gz * gy, dl = Math.hypot(dx, dy, dz) || 1;   // d: straight down, across the forearm
    return { ax: a.ax, ay: a.ay, az: a.az, ux: a.bx / L, uy: a.by / L, fx: f.ax, fy: f.ay, fz: f.az, gx, gy, gz, dx: dx / dl, dy: dy / dl, dz: dz / dl, Lf, side: Math.sign(a.ax) }; };
  const ARMS = [arm("L"), arm("R")];
  const HEM = { tuck: 0.455, out: 0.44, crop: 0.6 }[LEN] ?? 0.455;   // the bottom edge   // シャツは胴と袖の部品を溶かした形(袖はこの形がいちばん自然)
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
  const shirtSdf = (x, y, z, B = bodySdf, noBell = false) => {   // B: 体の距離(服を作るときは格子から読む速い版を渡す)
    const t = Math.min(1, Math.max(0, (y - 0.725) / 0.12)), nx = x, nz = z - (-0.032 + 0.038 * t + COLLAR.fwd), rz = nz > 0 ? nz * (1 + COLLAR.front) : nz;   // 首の柱(少し前に傾く)からの位置
    const neck = y - (COLLAR.y - COLLAR.tilt * nz + COLLAR.bowl * (nx * nx + rz * rz));   // えりぐり: 首から離れるほど高くなるおわん形の面で切る(首に沿う布と平行にならないので、ふちがガタつかない)
    const sm = (a, b) => -smin(-a, -b, 0.012);   // 角を丸めて切る
    const fit = y > SHOULDER_FIT.y0 ? B(x, y, z) - SHOULDER_FIT.off - 0.3 * (1 - sstep(SHOULDER_FIT.y0, SHOULDER_FIT.y1, y) * sstep(SHOULDER_FIT.x0, SHOULDER_FIT.x0 + SHOULDER_FIT.xw, Math.abs(x))) : -1;   // 肩の上は体から離れすぎないように(怒り肩にしない)。首のまわりは効かせない
    // the armpit hollow: near it the cloth is thin (0.4 cm instead of 1.4: two 1.4 cm layers would fill the hollow again), and it follows the hollow 0.4 cm off the body
    let pit = 1e9; for (const c of PIT) if (Math.abs(x - c.bx0) < c.br) pit = Math.min(pit, c.f(x, y, z));
    let d = shirtCore(x, y, z) - (0.014 - 0.01 * (1 - sstep(0, 0.025, pit))) - (LEN === "out" ? 0.01 * sstep(0.56, 0.5, y) : 0);   // out: a little looser at the bottom, so it lies over the pants
    if (pit < 0.03) d = -smin(-d, pit + 0.004, 0.006);
    for (const A of ARMS) { if (x * A.side <= 0) continue;
      if (SLEEVE === "none") { const t = (x - A.ax) * A.ux + (y - A.ay) * A.uy, px = x - A.ax - t * A.ux, py = y - A.ay - t * A.uy;   // sleeveless: cut off the arm just inside the shoulder joint
        d = sm(d, -Math.max(t + 0.012, Math.hypot(px, py, z - A.az) - 0.063)); }   // 0.063: around the sleeve only, not the back or chest beside it   // (only around the arm: a plane alone would cut through the body too)
      if (LONG) d = sm(d, (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz - (A.Lf - 0.012));   // long: the cuff just before the wrist
      if (BELL && !noBell) d = smin(d, bellShell(x, y, z, A), 0.008); }
    return Math.max(sm(sm(d, neck), fit), HEM - y); };   // tuck: すそはズボンの中に入れる
  // pants.length: "shorts" (hem = pants.hem) | "knee" (just below the knee) | "long" (to the ankle)
  const PL = OPT.outfit.pants.length ?? "shorts", PANTS_HEM = { knee: 0.2, long: 0.1 }[PL] ?? OPT.outfit.pants.hem;   // ズボンのすその高さ
  const pantsMask = blend([...pick("pelvis", "butt", "leghole", "belly", "thighF", "thighB", "thighIn", ...(PL === "shorts" ? [] : ["thigh", "calf", "calfO", "calfB"])), CROTCH]);   // ズボンを着せる範囲
  const PANTS_OFF = OPT.outfit.pants.offset, PANTS_TOP = OPT.outfit.pants.top, PANTS_TILT = OPT.outfit.pants.tilt;   // ズボンの厚み / 上の高さ / 後ろ上がりの傾き
  const PM = PL === "shorts" ? 0 : 0.1;   // longer pants: below the thighs the legs alone shape them (the mask's edge made a fold at the knee); higher up the margin would reach the hands
  const LEGS = PL === "shorts" ? null : blend(pick("thigh", "thighF", "thighB", "calf", "calfO", "calfB"));   // the legs without the dent at the outside of the knee (cloth bridges it; following it folded the pants there)
  const pantsCore = (x, y, z, B = bodySdf) => Math.max((LEGS && y < 0.38 ? (b0 => b0 + (Math.min(b0, LEGS(x, y, z)) - b0) * sstep(0.38, 0.33, y))(B(x, y, z)) : B(x, y, z)) + 0.024 - PANTS_OFF, pantsMask(x, y, z) - 0.03 - PM * sstep(0.36, 0.3, y));   // 体の形にそって着せる(横から見て分厚くならないように)
  const pantsShape = (x, y, z, B = bodySdf) => Math.max(pantsCore(x, y, z, B) - 0.024, y - (PANTS_TOP - PANTS_TILT * z), PANTS_HEM - y);
  // skirt (pants.kind "skirt"): a pleated cone hanging from the waist, a thin shell (open at the bottom, so the legs come out of it).
  // Its cross-section is an ellipse around the hips that widens toward the hem (flare per m of drop); pleats are folds around it that
  // deepen toward the hem. Where the body sticks out of the cone (the bottom at the back) the cloth follows the body instead.
  const SK = skirtOf(OPT) ?? { hem: 0.3, flare: 0.4, pleats: 16, pleatDepth: 0.008, thick: 0.018 }, TO = OPT.body.torso;   // a dress's skirt is the same (skirtOf, options.js)
  const SK_Y0 = SK.top ?? PANTS_TOP, SK_TILT = SK.tilt ?? PANTS_TILT;   // a dress's skirt starts higher (skirtOf)
  let SK_AX = 0.158 * (TO.hips ?? 1) + 0.022, SK_AZ = 0.128, SK_ZC = -0.012;
  // a dress's skirt starts under the chest: its top ellipse is measured off the body there (just over the shirt), so it neither stands off
  // the back as a ledge (the hips' ellipse is wider than the chest) nor lets the belly push out under it (it is centered on the body, not on the hips)
  if (SK.dress) { const out = (dx, dz) => { let t = 0; while (t < 0.4 && bodySdf(dx * t, SK_Y0, -0.01 + dz * t) < 0) t += 0.001; return t; };
    const zf = out(0, 1) - 0.01, zb = -out(0, -1) - 0.01, m = 0.02;   // m: over the shirt (1.4 cm) and a little air
    SK_AX = out(1, 0) + m; SK_ZC = (zf + zb) / 2; SK_AZ = (zf - zb) / 2 + m; }
  const skirtSdf = (x, y, z, B = bodySdf) => {
    const drop = Math.max(0, SK_Y0 - y), ax = SK_AX + SK.flare * drop, az = SK_AZ + SK.flare * 0.8 * drop, dz = z - SK_ZC;
    const th = Math.atan2(x / ax, dz / az), pl = SK.pleatDepth * sstep(SK_Y0 - 0.02, SK.hem, y) * Math.abs(Math.sin(th * SK.pleats / 2));
    const cone = (Math.hypot(x / ax, dz / az) - 1) * Math.min(ax, az) + pl;   // < 0 inside the cone
    const outer = Math.min(cone, Math.max(B(x, y, z) - PANTS_OFF, skirtMask(x, y, z) - 0.03));   // the cloth: the cone, or the hips pushed out where they stick out of it (only the hips: not the hands hanging beside them)
    return Math.max(outer, -(cone + SK.thick), y - (SK_Y0 - SK_TILT * z), SK.hem - y); };
  const SKIRT = !!skirtOf(OPT), skirtMask = SKIRT ? blend(pick("pelvis", "butt", "belly")) : null;
  const pantsSdf = SKIRT ? skirtSdf : pantsShape;   // シャツより少し外側。上の口は後ろ上がり   // シャツより少し外側。上の口は後ろ上がり
  // 靴: 足とくるぶしを包むスニーカー。甲(色つき)と底(白いゴム)の2つ。足の裏の高さはそのまま(地面にめりこまない)
  const SHOE = { off: OPT.outfit.shoes.offset, top: OPT.outfit.shoes.top, tilt: OPT.outfit.shoes.tilt, sole: OPT.outfit.shoes.sole, rim: OPT.outfit.shoes.rim };   // 足からの浮き / はき口の高さ / はき口の傾き / 底の厚み / 底のはみ出し
  // shoes.kind (2026-10-05, Saori: boots, high heels, laced sneakers): "sneaker" (as before) / "laced" (the same with laces, a part of its own)
  // / "boots" (up the calf, following it, the top a little flared) / "heels" (low-cut pumps with a heel: the foot is tilted toes-down in every
  // pose, heelPose; the heel is built slanted so that tilted it stands straight down to the floor)
  const KIND = OPT.outfit.shoes.kind ?? "sneaker", BOOTS = KIND === "boots", HEELS = KIND === "heels";
  const TOP = BOOTS ? OPT.outfit.shoes.bootHeight : HEELS ? 0.058 : SHOE.top, TILT = BOOTS ? 0.12 : HEELS ? 0.3 : SHOE.tilt;
  const shoeCore = blend(pick("foot", "calf", "toeBox", ...(BOOTS ? ["calfO", "calfB"] : []))), soleCore = blend(pick("foot", "toeBox"));   // toeBox: over bare toes (body foot.toes), none without them
  const HP = HEELS ? heelPose(OPT, J) : null, heelSpikes = HEELS ? ["L", "R"].map((s) => { const f = P[`foot.${s}`], a = [f.cx, -0.001, f.cz - 0.05], d = [0, -Math.cos(HP.theta), Math.sin(HP.theta)];
    return C(a, a.map((v, i) => v + d[i] * HP.heel), 0.011, 0.005, `foot.${s}`, 0.006); }) : [];   // from under the heel, slanted forward by the tilt: straight down once tilted
  // heels: a pointed toe (a flat cone forward and a little toward the big toe, smoothly joined), and no rubber sole: the shoe itself goes down
  // to the floor, all one color (2026-10-05, Saori: "ゴム部分がついてる、先も尖ってない")
  const toePoints = HEELS ? ["L", "R"].map((s) => { const f = P[`foot.${s}`], m = Math.sign(f.cx), a = [f.cx, 0.016, 0.03], b = [f.cx - m * 0.01, 0.006, 0.128], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), u = [0, 1, 2].map((i) => (b[i] - a[i]) / L), FY = 0.45;
    return (x, y, z) => { const p = [x - a[0], y - a[1], z - a[2]], t = Math.min(1, Math.max(0, (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) / L)), q = [0, 1, 2].map((i) => p[i] - u[i] * t * L), r = 0.042 * (1 - t) + 0.003;
      return (Math.hypot(q[0], q[2], q[1] / FY) - r) * FY; }; }) : [];
  const shoeSdf = (x, y, z) => { let c = shoeCore(x, y, z) - SHOE.off - (BOOTS ? 0.004 + 0.008 * sstep(TOP - 0.04, TOP, y) : 0); for (const t of toePoints) c = smin(c, t(x, y, z), 0.02);   // (boots: a little looser, flared at the top)
    let d = Math.max(c, y - (TOP - TILT * z), HEELS ? -0.003 - y : -0.003 + SHOE.sole * 0.6 - y);   // はき口は前が低い / 甲は底の上にのる (heels: down to the floor, no sole under it)
    for (const h of heelSpikes) d = Math.min(d, dPrim(h, x, y, z)); return d; };
  const soleSdf = HEELS ? () => 1 : (x, y, z) => Math.max(soleCore(x, y, z) - SHOE.off - SHOE.rim, y - (-0.003 + SHOE.sole), -0.003 - y);   // (heels: none)
  // laces (shoes.kind "laced"): across the instep in four rows, each from an eyelet over the top to the other (three points on the shoe's
  // surface, a little above it), and a bow at the top row: two loops and two ends
  const lacesSdf = KIND === "laced" ? (() => { const parts = [], surf = (x, z) => { let lo = 0.025, hi = 0.14; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (shoeSdf(x, m, z) < 0) lo = m; else hi = m; } return lo; };
    for (const s of ["L", "R"]) { const cx = P[`foot.${s}`].cx, r = 0.0038;
      [0.046, 0.058, 0.07, 0.082].forEach((z, i) => { const w = 0.018 - 0.0025 * i, pt = (x) => [x, surf(x, z) + 0.0025, z], L = pt(cx - w), M = pt(cx), R = pt(cx + w);   // on the shoe's front slope (further back the leg comes out of the opening and hides them)
        parts.push(C(L, M, r, r, `foot.${s}`, 0.003), C(M, R, r, r, `foot.${s}`, 0.003));
        if (i === 0) { const b = [cx, M[1] + 0.003, z];   // the bow
          for (const sx of [-1, 1]) { parts.push(E([cx + sx * 0.013, b[1] + 0.002, z - 0.002], [0.011, 0.0045, 0.0075], `foot.${s}`, 0.003), C(b, [cx + sx * 0.008, b[1] - 0.006, z + 0.016], 0.003, 0.0026, `foot.${s}`, 0.003)); } } }); }
    return (x, y, z) => { let d = 1; for (const q of parts) d = Math.min(d, dPrim(q, x, y, z)); return d; }; })() : null;   // (the top found from inside the shoe: lo starts above the sole, where it is inside)
  // 靴下: 形は足のまま、色だけ変える(体の表面にごく薄くかぶせる)
  const SOCK_TOP = OPT.outfit.socks.top;   // 靴下のはき口の高さ
  const sockSdf = (x, y, z, B = bodySdf) => Math.max(B(x, y, z) - 0.0025, y - SOCK_TOP);
  const armor = (OPT.outfit.armor.style === "full" ? buildPlate : buildArmor)(OPT, { P, J, HT, bodySdf });   // 鎧: 体にそわせず、かんたんな形をかぶせた硬い部品(軽鎧 armor.js / 全身鎧 plate.js)
  const weapons = buildWeapons(OPT, { J, bodySdf });   // 武器: 手に持つ硬い部品(weapons.js)
  // cape (outfit.cape): a shell over the shoulders that hangs down the back, open in front. Over the shoulders it is the body pushed out
  // (a mantle); from the shoulder line down, an elliptic cone around the body that flares toward the hem (more at the back than at the sides).
  // Its front edge is behind the arms (they hang forward of it), and over the shoulders it wraps forward (cape.wrap). It moves as cloth (cloth.js)
  const CA = OPT.outfit.cape, CAPE_Y = capeTop(J), capeSdf = CA?.on ? (() => {
    const out = (dx, dz) => { let t = 0; while (t < 0.4 && bodySdf(dx * t, CAPE_Y, dz * t) < 0) t += 0.001; return t; };
    const off = 0.026, ax0 = out(1, 0) + off, az0 = out(0, -1) + off, k = 0.02;   // off: over the shirt and its sleeves
    // over a skirt (or a dress's): at least as wide as the skirt at every height (it goes on flaring below the hem), else the skirt showed through its sides
    // (above the skirt's top it narrows at 45°: a step there showed as a crack across the cape)
    const sk = SKIRT ? (y) => { const d = SK_Y0 - y, m = 0.02 + SK.pleatDepth; return [SK_AX + (d > 0 ? SK.flare * d : d) + m, SK_AZ + (d > 0 ? SK.flare * 0.8 * d : d) + m + Math.abs(SK_ZC)]; } : null;
    const smax = (a, b, k = 0.02) => -smin(-a, -b, k);
    return (x, y, z, B = bodySdf) => {
      const drop = Math.max(0, CAPE_Y - y), s = sk ? sk(y) : null, ax0_ = ax0 + CA.flare * 0.6 * drop, az0_ = az0 + CA.flare * drop, ax = s ? smax(ax0_, s[0]) : ax0_, az = s ? smax(az0_, s[1]) : az0_;
      const cone = Math.max((Math.hypot(x / ax, z / az) - 1) * Math.min(ax, az), y - CAPE_Y);
      const mantle = Math.max(B(x, y, z) - off, CAPE_Y - 0.03 - y);
      const S = smin(cone, mantle, k), zf = -0.04 + (CA.wrap + 0.04) * sstep(CAPE_Y - 0.04, CAPE_Y + 0.03, y);   // zf: the front edge (behind the arms below the shoulders)
      return Math.max(S, -(S + CA.thick), y - (CA.collar - 0.12 * z), z - zf, CA.hem - y); };   // the collar is a little higher at the back
  })() : null;
  return { pantsSdf, shirtSdf, bellOf, shoeSdf, sockSdf, soleSdf, lacesSdf, capeSdf, armor, weapons };
}
