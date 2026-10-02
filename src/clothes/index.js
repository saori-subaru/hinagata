// Clothes: shirt, pants, shoes (upper + sole) and socks, as signed distances built around the body.
// Functions taking B (the body distance) can be given a faster lookup of the same body while meshing.
import { smin, E, cut, blend, blendFast, sstep } from "../sdf/prim.js";

export function buildClothes(OPT, { P, CROTCH, bodySdf, ARMPIT = [] }) {
  const pick = (...names) => names.flatMap((n) => [P[n]?.cloth ?? P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);   // .cloth: a part's own shape for clothes (the bust: joined across the middle)
  // shirt.sleeve: "short" (to the middle of the upper arm) | "none" (cut off at the armhole) | "long" (to the wrist)
  // shirt.length: "tuck" (hem inside the pants) | "out" (hem over the pants) | "crop" (above the navel)
  const SH = OPT.outfit.shirt, SLEEVE = SH.sleeve ?? "short", LEN = SH.length ?? "tuck";
  // shirt.underarm: "fit" = the cloth follows the body's armpit hollow (ARMPIT, body/index.js) / "loose" = it bridges it (poncho-like: hangs from the sleeve down the side)
  //   Why: the shirt is the body's parts melted and puffed up 1.4 cm, so where a chibi arm hangs close to the side the sleeve and the side melted into one
  //   sheet; raising the arms (T-pose) stretched it into a web (2026-10-02 Saori: 「袖下の付け根の位置が下すぎて水かきみたい」)
  const PIT = (SH.underarm ?? "fit") === "loose" || !SLEEVE || SLEEVE === "none" ? [] : ARMPIT;
  const armParts = SLEEVE === "long" ? ["sleeve", "upperArm", "foreArm"] : SLEEVE === "short" ? ["sleeve"] : [];
  const shirtCore = blendFast(pick("chest", "bust", "belly", "pelvis", "waist", "neck", "trap", "shoulder", ...armParts, ...(LEN === "out" ? ["butt"] : [])), [-0.4, 0.4, -0.25], [0.4, 0.95, 0.27]);   // out: over the bottom too (else the pants show through at the back)
  const arm = (s) => { const a = P[`upperArm.${s}`], f = P[`foreArm.${s}`], L = Math.hypot(a.bx, a.by), Lf = Math.hypot(f.bx, f.by, f.bz);   // armhole and cuff: planes across the arm
    return { ax: a.ax, ay: a.ay, az: a.az, ux: a.bx / L, uy: a.by / L, fx: f.ax, fy: f.ay, fz: f.az, gx: f.bx / Lf, gy: f.by / Lf, gz: f.bz / Lf, Lf, side: Math.sign(a.ax) }; };
  const ARMS = [arm("L"), arm("R")];
  const HEM = { tuck: 0.455, out: 0.44, crop: 0.6 }[LEN] ?? 0.455;   // the bottom edge   // シャツは胴と袖の部品を溶かした形(袖はこの形がいちばん自然)
  const COLLAR = { y: OPT.outfit.shirt.collar.y, bowl: OPT.outfit.shirt.collar.bowl, tilt: OPT.outfit.shirt.collar.tilt, front: OPT.outfit.shirt.collar.front, fwd: OPT.outfit.shirt.collar.forward };   // えりぐり: 首のまわりの高さ / 首から離れるほど上がる量(おわん形) / 後ろ上がりの傾き / 前を首に近づける / 中心を前へ
  const SHOULDER_FIT = { x0: OPT.outfit.shirt.shoulderFit.x0, xw: OPT.outfit.shirt.shoulderFit.xWidth, off: OPT.outfit.shirt.shoulderFit.offset, y0: OPT.outfit.shirt.shoulderFit.y0, y1: OPT.outfit.shirt.shoulderFit.y1 };   // 肩の上だけ体にそわせる: 浮き / ここから / ここまでで効ききる
  const shirtSdf = (x, y, z, B = bodySdf) => {   // B: 体の距離(服を作るときは格子から読む速い版を渡す)
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
      if (SLEEVE === "long") d = sm(d, (x - A.fx) * A.gx + (y - A.fy) * A.gy + (z - A.fz) * A.gz - (A.Lf - 0.012)); }   // long: the cuff just before the wrist
    return Math.max(sm(sm(d, neck), fit), HEM - y); };   // tuck: すそはズボンの中に入れる
  // pants.length: "shorts" (hem = pants.hem) | "knee" (just below the knee) | "long" (to the ankle)
  const PL = OPT.outfit.pants.length ?? "shorts", PANTS_HEM = { knee: 0.2, long: 0.1 }[PL] ?? OPT.outfit.pants.hem;   // ズボンのすその高さ
  const pantsMask = blend([...pick("pelvis", "butt", "leghole", "belly", "thighF", "thighB", "thighIn", ...(PL === "shorts" ? [] : ["thigh", "calf", "calfO", "calfB"])), CROTCH]);   // ズボンを着せる範囲
  const PANTS_OFF = OPT.outfit.pants.offset, PANTS_TOP = OPT.outfit.pants.top, PANTS_TILT = OPT.outfit.pants.tilt;   // ズボンの厚み / 上の高さ / 後ろ上がりの傾き
  const PM = PL === "shorts" ? 0 : 0.1;   // longer pants: below the thighs the legs alone shape them (the mask's edge made a fold at the knee); higher up the margin would reach the hands
  const LEGS = PL === "shorts" ? null : blend(pick("thigh", "thighF", "thighB", "calf", "calfO", "calfB"));   // the legs without the dent at the outside of the knee (cloth bridges it; following it folded the pants there)
  const pantsCore = (x, y, z, B = bodySdf) => Math.max((LEGS && y < 0.38 ? (b0 => b0 + (Math.min(b0, LEGS(x, y, z)) - b0) * sstep(0.38, 0.33, y))(B(x, y, z)) : B(x, y, z)) + 0.024 - PANTS_OFF, pantsMask(x, y, z) - 0.03 - PM * sstep(0.36, 0.3, y));   // 体の形にそって着せる(横から見て分厚くならないように)
  const pantsSdf = (x, y, z, B = bodySdf) => Math.max(pantsCore(x, y, z, B) - 0.024, y - (PANTS_TOP - PANTS_TILT * z), PANTS_HEM - y);   // シャツより少し外側。上の口は後ろ上がり
  // 靴: 足とくるぶしを包むスニーカー。甲(色つき)と底(白いゴム)の2つ。足の裏の高さはそのまま(地面にめりこまない)
  const SHOE = { off: OPT.outfit.shoes.offset, top: OPT.outfit.shoes.top, tilt: OPT.outfit.shoes.tilt, sole: OPT.outfit.shoes.sole, rim: OPT.outfit.shoes.rim };   // 足からの浮き / はき口の高さ / はき口の傾き / 底の厚み / 底のはみ出し
  const shoeCore = blend(pick("foot", "calf")), soleCore = blend(pick("foot"));
  const shoeSdf = (x, y, z) => Math.max(shoeCore(x, y, z) - SHOE.off, y - (SHOE.top - SHOE.tilt * z), -0.003 + SHOE.sole * 0.6 - y);   // はき口は前が低い / 甲は底の上にのる
  const soleSdf = (x, y, z) => Math.max(soleCore(x, y, z) - SHOE.off - SHOE.rim, y - (-0.003 + SHOE.sole), -0.003 - y);
  // 靴下: 形は足のまま、色だけ変える(体の表面にごく薄くかぶせる)
  const SOCK_TOP = OPT.outfit.socks.top;   // 靴下のはき口の高さ
  const sockSdf = (x, y, z, B = bodySdf) => Math.max(B(x, y, z) - 0.0025, y - SOCK_TOP);
  return { pantsSdf, shirtSdf, shoeSdf, sockSdf, soleSdf };
}
