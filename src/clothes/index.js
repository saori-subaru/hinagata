// Clothes: shirt, pants, shoes (upper + sole) and socks, as signed distances built around the body.
// Functions taking B (the body distance) can be given a faster lookup of the same body while meshing.
import { smin, E, cut, blend, blendFast, sstep } from "../sdf/prim.js";

export function buildClothes(OPT, { P, CROTCH, bodySdf }) {
  const pick = (...names) => names.flatMap((n) => [P[n] ?? null, P[`${n}.L`] ?? null, P[`${n}.R`] ?? null]).filter(Boolean);
  const shirtCore = blendFast(pick("chest", "belly", "pelvis", "neck", "trap", "shoulder", "sleeve"), [-0.36, 0.4, -0.25], [0.36, 0.95, 0.27]);   // シャツは胴と袖の部品を溶かした形(袖はこの形がいちばん自然)
  const COLLAR = { y: OPT.outfit.shirt.collar.y, bowl: OPT.outfit.shirt.collar.bowl, tilt: OPT.outfit.shirt.collar.tilt, front: OPT.outfit.shirt.collar.front, fwd: OPT.outfit.shirt.collar.forward };   // えりぐり: 首のまわりの高さ / 首から離れるほど上がる量(おわん形) / 後ろ上がりの傾き / 前を首に近づける / 中心を前へ
  const SHOULDER_FIT = { x0: OPT.outfit.shirt.shoulderFit.x0, xw: OPT.outfit.shirt.shoulderFit.xWidth, off: OPT.outfit.shirt.shoulderFit.offset, y0: OPT.outfit.shirt.shoulderFit.y0, y1: OPT.outfit.shirt.shoulderFit.y1 };   // 肩の上だけ体にそわせる: 浮き / ここから / ここまでで効ききる
  const shirtSdf = (x, y, z, B = bodySdf) => {   // B: 体の距離(服を作るときは格子から読む速い版を渡す)
    const t = Math.min(1, Math.max(0, (y - 0.725) / 0.12)), nx = x, nz = z - (-0.032 + 0.038 * t + COLLAR.fwd), rz = nz > 0 ? nz * (1 + COLLAR.front) : nz;   // 首の柱(少し前に傾く)からの位置
    const neck = y - (COLLAR.y - COLLAR.tilt * nz + COLLAR.bowl * (nx * nx + rz * rz));   // えりぐり: 首から離れるほど高くなるおわん形の面で切る(首に沿う布と平行にならないので、ふちがガタつかない)
    const sm = (a, b) => -smin(-a, -b, 0.012);   // 角を丸めて切る
    const fit = y > SHOULDER_FIT.y0 ? B(x, y, z) - SHOULDER_FIT.off - 0.3 * (1 - sstep(SHOULDER_FIT.y0, SHOULDER_FIT.y1, y) * sstep(SHOULDER_FIT.x0, SHOULDER_FIT.x0 + SHOULDER_FIT.xw, Math.abs(x))) : -1;   // 肩の上は体から離れすぎないように(怒り肩にしない)。首のまわりは効かせない
    return Math.max(sm(sm(shirtCore(x, y, z) - 0.014, neck), fit), 0.455 - y); };   // すそはズボンの中に入れる
  const PANTS_HEM = OPT.outfit.pants.hem;   // ズボンのすその高さ
  const pantsMask = blend([...pick("pelvis", "butt", "leghole", "belly", "thighF", "thighB", "thighIn"), CROTCH]);   // ズボンを着せる範囲
  const PANTS_OFF = OPT.outfit.pants.offset, PANTS_TOP = OPT.outfit.pants.top, PANTS_TILT = OPT.outfit.pants.tilt;   // ズボンの厚み / 上の高さ / 後ろ上がりの傾き
  const pantsCore = (x, y, z, B = bodySdf) => Math.max(B(x, y, z) + 0.024 - PANTS_OFF, pantsMask(x, y, z) - 0.03);   // 体の形にそって着せる(横から見て分厚くならないように)
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
