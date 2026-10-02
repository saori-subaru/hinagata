// Hair: a front block (bangs) + a back block, each swappable. Bang strands are placed by where they
// grow on the scalp (angle around the head, height) and where their tips end, and follow the head's shape.
import { smin, E, C, G, dPrim, blend, sstep } from "../sdf/prim.js";
import { grad } from "../sdf/mesh.js";

export function buildHair(OPT, { P, CUT = {}, bodySdf }) {
  //  髪: 前髪ブロック + 後ろ髪ブロック(ピーロと同じ分け方)。それぞれ差し替えられる
  //  前髪の毛束は「根元の位置(頭のまわりの角度・高さ)→毛先の高さ」で決めて、頭の形に沿わせる
  const KX = OPT.body.sculpt.skull.width / 0.249;   // hair follows the skull width
  const SK = OPT.body.sculpt.skull, HC = { c: [0, SK.y, -0.005], r: [0.255 * KX, SK.height, SK.depth] };   // 毛束の通り道に使う頭の丸(頭の部品と同じ)
  const deg = Math.PI / 180;
  function onScalp(th, ph, off) {   // th: 頭のまわりの角度(0=正面, +=キャラの左) / ph: 高さの角度 / off: 頭の表面からの浮き
    let p = [HC.c[0] + HC.r[0] * Math.cos(ph) * Math.sin(th), HC.c[1] + HC.r[1] * Math.sin(ph), HC.c[2] + HC.r[2] * Math.cos(ph) * Math.cos(th)];
    for (let i = 0; i < 8; i++) { const d = bodySdf(...p), g = grad(bodySdf, ...p); p = p.map((v, k) => v + g[k] * (off - d)); }   // 体(顔・耳)にめりこまないよう、表面から off だけ離す
    return p;
  }
  // 毛束の断面: 頭に沿って平たく(厚みは幅の flat 倍)。毛先に向かって細くとがる
  function strandSeg(a, b, ra, rb, flat) {
    const c = C(a, b, ra, rb, "head", 0.004), mid = a.map((v, i) => (v + b[i]) / 2), n = grad(bodySdf, ...mid);
    return Object.assign(c, { t: 4, n, flat });
  }
  function strand({ th0, ph0, th1, ph1, w, off0 = 0.012, off1 = 0.024, flat = 0.55, bend = 0, N = 7 }) {
    const segs = []; let prev = null, prevR = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = (th0 + (th1 - th0) * t + bend * Math.sin(Math.PI * t)) * deg, ph = (ph0 + (ph1 - ph0) * t) * deg;
      const p = onScalp(th, ph, off0 + (off1 - off0) * t * t), r = Math.max(0.0042, w * (1 - Math.pow(t, 2.2)) * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, t * 1.6))));
      if (prev) segs.push(strandSeg(prev, p, prevR, r, flat)); prev = p; prevR = r;
    }
    return G(segs, 0.006);
  }
  const AY = Math.min(OPT.body.sculpt.crown.y, SK.y + SK.height) - 1.39;   // the ahoge sits on the top of the head
  const AHOGE = (() => { const pts = [[0, 1.392 + AY, 0.0], [0.004, 1.43 + AY, 0.012], [0.012, 1.455 + AY, 0.04], [0.02, 1.455 + AY, 0.07]], segs = []; for (let i = 0; i + 1 < pts.length; i++) segs.push(strandSeg(pts[i], pts[i + 1], 0.012 * (1 - i / 3) + 0.003, 0.012 * (1 - (i + 1) / 3) + 0.0028, 0.55)); return G(segs, 0.006); })();
  const smax = (a, b, k) => -smin(-a, -b, k);
  // 前髪ブロック: 大きな毛束を数本(太く・平たく・先がとがる)。顔の前に乗る
  const HELMET = E([0, 1.13, 0.07], [0.268, 0.135, 0.212], "head");
  const BANGS = {
    "parted": () => [[0, 2, -12, 0.074, 0], [-25, -30, -15, 0.07, -3], [25, 30, -15, 0.07, 3], [-47, -55, -24, 0.052, 0], [47, 55, -24, 0.052, 0]]
      .map(([th0, th1, ph1, w, bend]) => strand({ th0, ph0: 58, th1, ph1, w, bend, off1: 0.03, flat: 0.5, N: 5 })),
    "side": () => [[-12, 22, -14, 0.085, 10], [-38, -10, -18, 0.07, 8], [24, 46, -20, 0.06, 4], [50, 60, -26, 0.05, 0]]
      .map(([th0, th1, ph1, w, bend]) => strand({ th0, ph0: 58, th1, ph1, w, bend, off1: 0.03, flat: 0.5, N: 5 })),
    "none": () => [],
    "blunt": () => [{ t: 3, k: 0.02, bx0: 0, by0: 1.13, bz0: 0.07, br: 0.3, f: (x, y, z) => smax(dPrim(HELMET, x, y, z), 1.072 + 0.9 * x * x - y, 0.012) }],
  };
  // 後ろ髪ブロック: 頭をひとまわり大きく包む一枚。すそは横=耳の前、後ろ=えりあし。すそに大きめの毛先を刻む
  const BACKS = { "short": { r: [0.282, 0.292, 0.29], side: 0.965, back: OPT.hair.sculpt.shortBack, top: 1.215, arch: 0.3, tips: 0.024, flare: 0 }, "bob": { r: [0.3, 0.3, 0.305], side: 0.885, back: 0.86, top: 1.215, arch: 0.3, tips: 0.03, flare: 0.03 } };
  if (KX !== 1) for (const b of Object.values(BACKS)) b.r = [b.r[0] * KX, b.r[1], b.r[2]];
  // shell > 0: the back block is the head surface pushed out by this thickness instead of its own ellipsoid (follows a flat top / back)
  const SHELL = OPT.hair.sculpt.shell, skullOnly = SHELL ? blend([P.skull, P.occiput, P.face, CUT.crown, CUT.back, CUT.nape].filter(Boolean)) : null;   // the head without ears and face details
  function backBlock(o) {
    const e0 = E([0, 1.125, -0.02], o.r, "head"), e = SHELL ? { t: 3, f: (x, y, z) => skullOnly(x, y, z) - SHELL - (o.r[0] - 0.282 * KX) } : e0;   // bob: a little thicker
    return { t: 3, k: 0.012, bx0: 0, by0: 1.1, bz0: -0.02, br: 0.45, f: (x, y, z) => {
      const th = Math.atan2(x, z), c = Math.cos(th);
      let hem = c < 0 ? o.side + (o.side - o.back) * c : -smin(-o.side, -(o.top - o.arch * Math.sin(th) ** 2), 0.05);   // 額の生え際: 上向きの弧(真ん中がいちばん高く、横へなだらかに下りる)
      if (c < 0.35) hem -= o.tips * Math.pow(Math.abs(Math.cos(th * 6)), 6) * sstep(-0.15, -0.45, c);          // すその毛先(30度ごと)
      const flare = o.flare * sstep(1.05, o.side, y);                                                          // ボブはすそが少し外へ広がる
      const ear = Math.min(dPrim(P["ear.L"], x, y, z), dPrim(P["ear.R"], x, y, z)) - 0.01;   // 耳のまわりは髪をよける(耳に髪がはみ出さないように)
      return smax(smax(dPrim(e, x, y, z) - flare, hem - y, 0.012), -ear, 0.006);
    } };
  }
  const hairSdfOf = (pick) => blend([backBlock(BACKS[pick.back]), ...BANGS[pick.bangs](), ...(pick.ahoge ? [AHOGE] : [])]);   // pick: { bangs, back, ahoge }
  return { BANGS, BACKS, hairSdfOf };
}
