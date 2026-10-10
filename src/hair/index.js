// Hair: a front block (bangs) + a back block, each swappable. Bang strands are placed by where they
// grow on the scalp (angle around the head, height) and where their tips end, and follow the head's shape.
import { smin, E, C, G, dPrim, blend, sstep } from "../sdf/prim.js";
import { grad } from "../sdf/mesh.js";
import { makeStretch } from "../body/index.js";

export function buildHair(OPT, { P, J = null, CUT = {}, PLANES = [], faceWarp = () => 1, bodySdf }) {
  // hair.sculpt.long.bottom is a height in base space (the body before body.proportion stretches it; recipe version 5): the block's curtain
  // takes it as built (as it did the number before), so the same long hair looks the same
  const LONG_BOTTOM = J ? makeStretch(OPT, J).fwd(OPT.hair.sculpt.long.bottom) : OPT.hair.sculpt.long.bottom;
  //  髪: 前髪ブロック + 後ろ髪ブロック(ピーロと同じ分け方)。それぞれ差し替えられる
  //  前髪の毛束は「根元の位置(頭のまわりの角度・高さ)→毛先の高さ」で決めて、頭の形に沿わせる
  const KX = OPT.body.sculpt.skull.width / 0.249;   // hair follows the skull width
  const EAR_PARTS = ["ear.L", "ear.R", "earTip.L", "earTip.R"].map((k) => P[k]).filter(Boolean), earDist = (x, y, z) => { let d = 1e9; for (const e of EAR_PARTS) d = Math.min(d, dPrim(e, x, y, z)); return d; };   // the ears and elf ears' tips
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
  function strand({ th0, ph0, th1, ph1, w, off0 = 0.012, off1 = 0.024, flat = 0.55, bend = 0, N = 7, tipPow = 2.2 }) {
    const segs = []; let prev = null, prevR = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = (th0 + (th1 - th0) * t + bend * Math.sin(Math.PI * t)) * deg, ph = (ph0 + (ph1 - ph0) * t) * deg;
      const p = onScalp(th, ph, off0 + (off1 - off0) * t * t), r = Math.max(0.0042, w * (1 - Math.pow(t, tipPow)) * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, t * 1.6))));
      if (prev) segs.push(strandSeg(prev, p, prevR, r, flat)); prev = p; prevR = r;
    }
    return G(segs, 0.006);
  }
  const AY = Math.min(OPT.body.sculpt.crown.y, SK.y + SK.height) - 1.39;   // the ahoge sits on the top of the head
  // ahoge: one curled strand standing up from the top of the hair, arching forward (size: hair.sculpt.ahogeSize)
  const ahogeOn = (shell) => { const S = OPT.hair.sculpt.ahogeSize ?? 1, top = Math.min(OPT.body.sculpt.crown.y, SK.y + SK.height) + (shell || 0.02);   // standing on hair this thick
    const D = (OPT.hair.sculpt.ahogeDir ?? 0) * deg, cd = Math.cos(D), sd = Math.sin(D);   // direction it curls: 0 = forward, 90 = toward the character's left
    const pts = [[0, -0.02, -0.02], [0.002, 0.025, -0.012], [0.006, 0.058, 0.004], [0.012, 0.072, 0.032], [0.016, 0.062, 0.058], [0.018, 0.044, 0.068]].map(([x, y, z]) => [(x * cd + z * sd) * S, top + y * S, (-x * sd + z * cd) * S]), segs = [];
    for (let i = 0; i + 1 < pts.length; i++) { const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1); segs.push(strandSeg(pts[i], pts[i + 1], (0.014 * (1 - t0 * 0.55)) * S, (0.014 * (1 - t1 * 0.55)) * S, 0.6)); }
    return G(segs, 0.006); };
  const smax = (a, b, k) => -smin(-a, -b, k);
  // 前髪ブロック: 大きな毛束を数本(太く・平たく・先がとがる)。顔の前に乗る
  const HELMET = E([0, 1.13, 0.07], [0.268, 0.135, 0.212], "head");
  // side-swept: big strands from the crown (58° up) sweeping across the forehead: [from angle, to angle, to height angle, radius, bend] (degrees;
  // hair.sculpt.side.strands, the editor's bangs tool moves their tips: read each time, so a change needs no new kit)
  const SIDE = () => OPT.hair.sculpt.side?.strands ?? [[-12, 22, -14, 0.085, 10], [-38, -10, -18, 0.07, 8], [24, 46, -20, 0.06, 4], [50, 60, -26, 0.05, 0]];
  const BANGS = {
    "side": () => SIDE().map(([th0, th1, ph1, w, bend]) => strand({ th0, ph0: 58, th1, ph1, w, bend, off1: 0.03, flat: 0.5, N: 5 })),
    // nendo: figure-style bangs. One thick layer over the forehead that follows the head (thicker toward the hem), its lower edge cut into V points
    // (each tip: angle around the head, height), with shallow grooves running up from the notches between them, so it reads as clumps
    // tips: [angle, height, slope?, skew?, group?]. skew: the left/right edges get different slopes (the clump sweeps sideways);
    // tips with the same group form one big clump whose end splits into small points (no groove between them). curve: edges bow (<1) or bulge (>1)
    // tips[i][6] (thickness): this clump is that much thicker (m, minus = thinner), fading out toward its neighbours (a bell over the angle, B.thickSpread degrees)
    "nendo": (pick = {}, B = OPT.hair.sculpt.nendo) => { const T = B.tips.map(([a, y, sl, sk, g, sw, tk]) => [a * deg, y, sl ?? B.slope, sk ?? 0, g ?? null, (sw ?? 0) * deg, tk ?? 0]), CV = B.curve ?? 1;
      const TK = T.filter((t) => t[6]), TKS = (B.thickSpread ?? 9) * deg, tipThick = (th) => { let s = 0; for (const t of TK) s += t[6] * Math.exp(-(((th - t[0]) / TKS) ** 2)); return s; };
      const BK = BACKS[pick.back], backExtra = (y) => BK ? backOff(BK, y) : 0;   // match the back hair's thickness (the bob is a little thicker below), so there's no step where they meet
      const backFlare = (y) => (BK?.flare ? BK.flare * sstep(1.05, BK.side, y) : 0) + (BK?.flick ? BK.flick * sstep(BK.side + BK.flickH, BK.side - 0.01, y) : 0);   // and its outward flick at the bottom (the bob's): else the side locks sat inside the bob, a step like a helmet's edge
      const notches = T.slice(1).map(([a, , , , g], i) => g != null && g === T[i][4] ? null : (a + T[i][0]) / 2).filter((a) => a != null);
      return [{ t: 3, k: 0.008, bx0: 0, by0: 1.1, bz0: 0.1, br: 0.4, f: (x, y, z) => {
        const th = Math.atan2(x, z), rr = Math.hypot(x, z);
        // sweep: near its tip the clump bends sideways (both edges together), more and more toward the tip: a curve, not a slant (squared, 2026-10-05)
        let hem = 9; for (const [a, ty, sl, sk, , sw] of T) { const d = th - a + (sw ? sw * (1 - sstep(ty, ty + B.sweepLen, y)) ** 2 : 0), ad = Math.abs(d), e = sl * (1 + (d < 0 ? sk : -sk)) * ad * (CV === 1 ? 1 : Math.pow(ad / 0.3, CV - 1)); hem = -smax(-hem, -(ty + e), B.round); }   // V points: lines rising from each tip meet at the (slightly rounded) notches
        if (B.slits) for (const [a, len, w] of B.slits) { const v = 1 - Math.abs(th - a * deg) * rr / w; if (v > 0) hem += len * v * v * (3 - 2 * v); }   // slits: a narrow gap running up between two clumps here and there (len up from the hem, w half-width in m)
        let groove = 0; for (const a of notches) groove += B.groove * Math.exp(-(((th - a) / (B.grooveW * deg)) ** 2));
        const thick = B.thick + backExtra(y) + backFlare(y) + B.extra * sstep(B.top, hem, y) - groove * sstep(hem + 0.1, hem, y) + (TK.length ? tipThick(th) : 0);
        const shell = (B.smooth ? skullSmooth : skullOnly)(x, y, z) - thick, side = (Math.abs(th) - B.span * deg) * rr;   // smooth: follow the head without the face's cut planes (a layer hugging the cheeks folded at their edges)
        const ear = earDist(x, y, z) - EAR_GAP.gap;   // keep off the ears
        const d = smax(smax(shell, hem - y, 0.006), side, 0.01); return B.overEars ? d : smax(d, -ear, EAR_GAP.k); } }]; },   // overEars: no cut around the ears (the hime's side locks: the cut left folds in them)
    // nendoStrands: the same idea made of separate strands (thin tips break up on a coarse mesh)
    "nendoStrands": () => { const B = OPT.hair.sculpt.nendo;   // wide, flat clumps that overlap, tips at the brows, longer locks at the sides
      return B.clumps.map(([th0, th1, ph1, w, bend, layer = 1]) => strand({ th0, ph0: B.root, th1, ph1, w: w * B.width, bend, off0: 0.014 * layer, off1: B.lift * layer, flat: B.flat, N: 8, tipPow: B.tipPow })); },   // layer: clumps in front / behind, so their edges show
    "none": () => [],
    // block: the nendo bangs as one layer (the tufts before they became locks; the same tips, so the tuft tool moves them too). 2026-10-05, Saori:
    // "かたまりのふさタイプの髪型を追加して、分け目は消していい" (the parted bangs had a tuft in the middle of the parting; old recipes' "parted" become this)
    "block": (pick) => BANGS.nendo(pick),
    // hime: a princess cut. The same layer as nendo, but square-ended clumps: a straight fringe across the forehead and straight side locks
    // down to the cheeks (a steep curve keeps each clump's end flat; the grooves between them show the clumps)
    // curl: the side locks bend forward toward their ends (seen from the side the lock curves toward the chin): below curlY0 the lock is
    // shifted forward, more and more toward curlY1 (curl m there), only at the sides (|x| beyond curlX)
    "hime": (pick = {}) => { const H = { ...OPT.hair.sculpt.nendo, ...OPT.hair.sculpt.hime }, parts = BANGS.nendo(pick, H);
      if (!H.curl) return parts;
      return parts.map((p) => ({ ...p, f: (x, y, z) => { const t = sstep(H.curlY0, H.curlY1, y) * sstep(H.curlX, H.curlX + 0.05, Math.abs(x)); return p.f(x, y, z - H.curl * t * t); } })); },
  };
  Object.defineProperty(BANGS, "blunt", { value: BANGS.hime, enumerable: false });   // the old helmet-shaped "blunt" was replaced by hime
  // 後ろ髪ブロック: 頭をひとまわり大きく包む一枚。すそは横=耳の前、後ろ=えりあし。すそに大きめの毛先を刻む
  const NAPE = OPT.hair.sculpt.nape;
  const BACKS = { "short": { r: [0.282, 0.292, 0.29], side: 0.965, back: OPT.hair.sculpt.shortBack, top: 1.215, arch: 0.3, tips: 0.024, flare: 0, nape: true }, "bob": { r: [0.3, 0.3, 0.305], side: 0.885, back: 0.86, top: 1.215, arch: 0.3, tips: 0.03, flare: 0.03, coverEars: true },
    "flip": { r: [0.3, 0.3, 0.305], side: 0.9, back: 0.875, top: 1.215, arch: 0.3, tips: 0.04, teeth: 7, sharp: 2, flare: 0.01, flick: 0.06, flickH: 0.07, flickLift: 0.075, coverEars: true },   // 外はね: a bob whose ends flip out and up
    "long": { r: [0.282, 0.292, 0.29], side: 0.965, back: 0.9, top: 1.215, arch: 0.3, tips: 0, flare: 0, long: OPT.hair.sculpt.long, nape: true } };
  if (KX !== 1) for (const b of Object.values(BACKS)) b.r = [b.r[0] * KX, b.r[1], b.r[2]];
  if (OPT.hair.sculpt.hairline != null) for (const b of Object.values(BACKS)) b.top = OPT.hair.sculpt.hairline;
  // how far the back hair stands off the skull: the short hair's, plus (the bob) a little more below the top of the head only,
  // so every kind of bangs meets it without a step on top (the bob used to be thicker everywhere: other bangs sat inside it like a helmet's rim)
  const backOff = (o, y) => (BACKS.short.r[0] - 0.282 * KX) + (o.r[0] - BACKS.short.r[0]) * sstep(1.12, 1.0, y);
  { const BT = OPT.hair.sculpt.bob; if (BT) Object.assign(BACKS.bob, BT); }
  BACKS.hang = BACKS.short;   // short hair hanging from the back of the head (hair/locks.js): the same block under it   // bob overrides: tips (depth of the hem's points), teeth (how many), flare (outward flick)   // height of the hairline at the forehead
  // shell > 0: the back block is the head surface pushed out by this thickness instead of its own ellipsoid (follows a flat top / back)
  const CORNER = OPT.hair.sculpt.corner ?? null, TAPER_SIDES = OPT.hair.sculpt.taperSides ?? null;
  const EAR_GAP = OPT.hair.sculpt.earGap ?? { gap: 0.01, k: 0.006 };   // the hair keeps this far from the ears, with this much rounding
  const BACKV_TOP = OPT.hair.sculpt.backVolumeTop ?? null;   // fades out again toward the top (the sides get fuller, the top doesn't rise, no groove down the middle)
  const BACKV_Z = OPT.hair.sculpt.backVolumeZ ?? [0.12, -0.12], BACKV_Y = OPT.hair.sculpt.backVolumeY ?? [1.08, 1.3];   // where the extra volume fades in: front→back (z) and bottom→top (y)
  const BACKV = OPT.hair.sculpt.backVolume ?? 0, TAPER0 = OPT.hair.sculpt.taper ?? 0, TAPER_BACK = OPT.hair.sculpt.taperBack ?? 0, TMIN = 0.15, PEAK = OPT.hair.sculpt.peak ?? { depth: 0 }, SQ = OPT.hair.sculpt.square ?? 0, SHELL = OPT.hair.sculpt.shell, skullOnly = SHELL ? ((f) => (x, y, z) => f(x / faceWarp(y), y, z) * Math.min(1, faceWarp(0)))(blend([P.skull, P.skullTop, P.occiput, P.face, CUT.crown, CUT.back, CUT.nape, ...PLANES].filter(Boolean))) : null;   // the head without ears and face details
  const skullSmooth = SHELL ? ((f) => (x, y, z) => f(x / faceWarp(y), y, z) * Math.min(1, faceWarp(0)))(blend([P.skull, P.skullTop, P.occiput, P.face, CUT.crown, CUT.back, CUT.nape].filter(Boolean))) : null;   // the same without the face's cut planes
  // long: the hair's cross-section at height yc, carried straight down (a curtain behind the head and shoulders), behind z = zc,
  // widening a little toward the bottom (spread), with pointed tips along its lower edge
  function longCurtain(o, base) {
    const L = o.long, e = (x, z) => skullOnly(x, L.yc, z) - (o.r[0] - 0.282 * KX) - SHELL;
    const f = (x, y, z) => { const sp = 1 + L.spread * Math.max(0, L.yc - y), th = Math.atan2(x, z);
      const bottom = LONG_BOTTOM + L.tips * (1 - Math.pow(Math.abs(Math.cos(th * L.teeth)), 2)) + L.curve * x * x;   // points along the lower edge, the sides a little higher
      const ear = earDist(x, y, z) - EAR_GAP.gap;
      return smax(smax(smax(smax(e(x / sp, z), z - L.zc, 0.03), bottom - y, 0.012), y - L.yc - 0.04, 0.05), -ear, EAR_GAP.k); };
    return { ...base, by0: 0.85, br: 0.65, f: (x, y, z) => smin(base.f(x, y, z), f(x, y, z), 0.03) };
  }
  // lumps: the hair's surface swells into rounded bundles that run down from the crown, twisting a little, so the head's outline is bumpy
  // (count around the head, must be whole; twist: on the sides the bundles sweep back as they go down (mirrored left/right), which is what
  //  makes bumps on the front outline; sharp < 1: rounder bundles, narrower creases)
  const LU = OPT.hair.sculpt.lumps, SKY = OPT.body.sculpt.skull.y;
  const lumpOf = (x, y, z) => { if (!LU?.amp) return 0; const dz = z + 0.005, th = Math.atan2(Math.hypot(x, dz), y - SKY), ph = Math.atan2(x, dz), s = ph * LU.count / (2 * Math.PI) + LU.twist * th * Math.sin(ph);
    return LU.amp * (Math.pow(Math.abs(Math.sin(Math.PI * s)), LU.sharp) - 0.6) * sstep(LU.from, LU.from + 0.35, th); };   // fades out toward the crown, where the bundles meet
  function backBlock(o) { const b = backBlock0(o); return o.long && !o.long.locks ? longCurtain(o, b) : b; }   // long.locks: the long hair is made of locks (hair/locks.js) over this block
  function backBlock0(o) {
    const e0 = E([0, 1.125, -0.02], o.r, "head"), e = SHELL ? { t: 3, f: (x, y, z) => skullOnly(x, y, z) - backOff(o, y) } : e0;   // bob: a little thicker (below the top only)
    return { t: 3, k: 0.012, bx0: 0, by0: 1.1, bz0: -0.02, br: 0.45, f: (x, y, z) => {
      const th = Math.atan2(x, z), c = Math.cos(th);
      const s2 = Math.sin(th) ** 2, arch = CORNER ? (CORNER.drop ?? o.top - o.side) * sstep(CORNER.a0, CORNER.a1, Math.abs(th) / deg) : o.arch * (SQ ? (1 - SQ) * s2 + SQ * s2 ** 3 : s2);   // corner: the hairline turns down between these angles (degrees from the front), so it reaches the ear without receding at the temples   // square: the hairline stays level across the forehead and turns down at the corners
      const pk = PEAK.depth && c > 0 ? PEAK.depth * Math.max(0, 1 - Math.abs(th) / (PEAK.width * Math.PI / 180)) ** 2 : 0;   // widow's peak: the middle of the hairline dips down in a small V
      let hem = c < 0 ? o.side + (o.side - o.back) * c : -smin(-o.side, -(o.top - arch - pk), 0.05);   // 額の生え際: 上向きの弧(真ん中がいちばん高く、横へなだらかに下りる)
      if (c < 0.35) hem -= o.tips * Math.pow(Math.abs(Math.cos(th * (o.teeth ?? 6))), o.sharp ?? 6) * sstep(-0.15, -0.45, c);          // すその毛先(30度ごと)
      const flare = o.flare * sstep(1.05, o.side, y);                                                          // ボブはすそが少し外へ広がる
      const ear = earDist(x, y, z) - EAR_GAP.gap;   // 耳のまわりは髪をよける(耳に髪がはみ出さないように)
      // shell: the hair thins toward the hairline (front and sides), so it blends into the skin instead of ending in a thick step
      // thinning toward the hairline: measured from smooth hairline curves (no hair tips), front and back blended by z, so nothing jumps
      // (the hem's angle flips from front to back right on top of the head, so it can't be used for this)
      const TAPER = o.taper ?? TAPER0;   // (a back block may bring its own)
      let tf = 1; if (TAPER || TAPER_BACK) { const s2x = Math.min(1, (x / 0.21) ** 2), front = o.top - (CORNER ? (CORNER.drop ?? o.top - o.side) * sstep(CORNER.a0, CORNER.a1, Math.abs(Math.atan2(x, Math.max(z, 0.02))) / deg) : o.arch * (SQ ? (1 - SQ) * s2x + SQ * s2x ** 3 : s2x)), back = o.back + (o.side - o.back) * s2x;
        const sideKeep = TAPER_SIDES ? sstep(TAPER_SIDES.a0, TAPER_SIDES.a1, Math.abs(Math.atan2(x, Math.max(z, 0.02))) / deg) * (1 - sstep(1.12, 1.24, y)) : 0;   // only on the sides: on top of the head the angle swings across the middle, which made ridges   // taperSides: no thinning on the sides of the head (the outline stays full at the temples)
        const ff = TAPER ? 1 - (1 - sstep(0, TAPER, y - Math.max(front, o.side - 0.05))) * (1 - sideKeep) : 1, fb = TAPER_BACK ? sstep(0, TAPER_BACK, y - back) : 1;
        tf = TMIN + (1 - TMIN) * (fb + (ff - fb) * sstep(-0.08, 0.08, z)); }
      const thick = SHELL ? (o.shell ?? SHELL) * tf
        + BACKV * sstep(BACKV_Z[0], BACKV_Z[1], z) * sstep(BACKV_Y[0], BACKV_Y[1], y) * (BACKV_TOP ? 1 - sstep(BACKV_TOP[0], BACKV_TOP[1], y) : 1) : 0;   // backVolume: thicker toward the back of the top, so the hair line rises from the hairline toward the back (the skull stays as it is)
      // flick (the flip): near the hem the hair bends out sideways, and the further out, the higher its bottom edge, so the ends curl up and out
      let base = dPrim(e, x, y, z), thk = thick;
      // nape (the short hair): below the back of the skull the hair hugs the head and runs into the neck with an inward curve, getting thin
      // toward the hem, like clipped hair. Before, the 3.6 cm shell kept its thickness around the bottom of the skull's ball: a round bulge
      // over the neck (2026-10-04, Saori: "the clipped part bulges; it should curve the other way")
      if (o.nape && NAPE?.on && SHELL) { const w = sstep(NAPE.y1, NAPE.y0, y) * sstep(0.02, -0.06, z);
        if (w > 0) { const nb = smin(skullOnly(x, y, z), dPrim(P.neck, x, y, z), NAPE.k) - backOff(o, y); base += (nb - base) * w; thk = thick * (1 - (1 - NAPE.thin) * w); } }
      const fk = o.flick ? o.flick * sstep(o.side + o.flickH, o.side - 0.01, y) : 0, hemF = o.flick ? hem + o.flickLift * Math.min(1, Math.max(0, (base - thick) / o.flick)) : hem;
      const d = smax(base - thk - flare - fk - lumpOf(x, y, z), hemF - y, 0.012);
      return o.coverEars ? smin(d, Math.max(ear - 0.012, hem - y), 0.02) : smax(d, -ear, EAR_GAP.k);   // coverEars (the bob): the hair goes over the ears instead of around them (carving them out left little holes at the hem)
    } };
  }
  const bangsAsLocks = (pick) => ["nendo", "hime", "side"].includes(pick.bangs) && OPT.hair.sculpt.nendo.locks;   // the nendo bangs (and the hime cut from its own tips, the side-swept from its strands) made of locks (hair/locks.js) instead of this layer
  // under bangs made of locks the block thins toward the front hairline (hair is thin where it grows), so a gap between the locks shows the
  // forehead running into thin hair, not the 3.6 cm rim the block ended in (it was hidden by the bangs' own layer). The hairline stays where
  // it is: it belongs to the head, not to the hairstyle (2026-10-04, Saori). nendo.lockTaper: how far above the hairline the hair reaches its full thickness
  const underLocks = (o) => ({ ...o, taper: OPT.hair.sculpt.nendo.lockTaper ?? 0.08 });
  // with locks over it (the back's and the bangs' both) the block is only what shows between them: thin (lockShell), else the locks on top
  // of a full-thickness block made the head swell (2026-10-04, Saori). The bangs alone (a bob behind them) keep the block as it is
  const backAsLocks = (pick) => (["short", "hang", "bob", "flip"].includes(pick.back) && OPT.hair.sculpt.shortLocks?.on) || (pick.back === "long" && OPT.hair.sculpt.long.locks);
  const hairSdfOf = (pick) => { const L = bangsAsLocks(pick), thin = L && backAsLocks(pick) && OPT.hair.sculpt.lockShell != null, sh = thin ? OPT.hair.sculpt.lockShell : SHELL;
    let o = BACKS[pick.back]; if ((pick.back === "bob" || pick.back === "flip") && backAsLocks(pick)) o = BACKS.short;   // a bob or a flip in locks: the locks over the short hair's block (the bob's own reaches the jaw)
    if (L) o = underLocks(o); if (thin) o = { ...o, shell: sh };
    return blend([backBlock(o), ...(L ? [] : BANGS[pick.bangs](pick)), ...(pick.ahoge ? [ahogeOn(sh)] : [])]); };   // pick: { bangs, back, ahoge }
  return { BANGS, BACKS, SIDE, hairSdfOf, bangsAsLocks };
}
