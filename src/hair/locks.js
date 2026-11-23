// Hair locks: hair made as separate ribbons (flat, tapering to a sharp point) built straight as triangles, not sampled from a distance
// field. A field sampled on a 7-14 mm grid can't make anything thinner than about two cells, so hair built that way is thick and its tips
// blunt (2026-10-04, Saori: "the hair is all thick, the tips are fat, a helmet"). Ribbons are as thin and as sharp as asked at any quality.
// Each lock is also a chain of points that moves on its own, in the same position-based way as the skirt (cloth.js):
//   1. the first two points ride on the head (the root and its direction)
//   2. the others keep their motion (damped), fall, and are pulled a little toward where the head would carry them (firmly near the root,
//      hardly at the tip: the hair keeps its style but hangs and swings)
//   3. a few rounds of: links pulled back to their length, points pushed out of the head (an ellipsoid fitted to the hair underneath) and
//      out of spheres along the neck, back, shoulders and arms
// The mesh is skinned to the head bone alone; each frame the chain's points are turned back through the head's matrix into the mesh's
// rest positions, so the GPU's skinning puts them where the chain is (as cloth.js does for the skirt).
import * as THREE from "three";

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const RING = [[-1, 0], [-0.55, 1], [0.55, 1], [1, 0], [0.55, -1], [-0.55, -1]];   // the cross-section: a flat lens (across, out), 6 points
const SUB = 3;
// a rigid lock (hair.rigid) is pulled toward its rest along its whole length (per step, × rigid × stiff), and keeps more of its up-and-down
// (a bounce of the whole tuft, not jelly). At 0.12 / VDAMP the hair stood still on a run; at 0 it tilted back flat
const RIGID_HOLD = 0.03, RIGID_VDAMP = 0.6;
// a tail hangs from its tie with no hair under it: twice the hold (its stiff is 1 to the hanging locks' ~3), or the wind lays it out flat like a stick
export const TAIL_HOLD = 0.06, TAIL_VDAMP = 0.8;
const TIER_STEP = 0.25, TIER_OUT = 0.3;   // hair.tail.tiers: each step of the tail's tips this share of its length shorter than the next
// rigid hanging locks: the inner layer held 4x as firmly and kept whole, so a run lifts the outer one over hair, not over the block (its smooth dome, as pale as the skin, read as a bald head)
export const INNER_HOLD = 4, INNER_RIGID = 2;
const RING_LITE = [[-1, 0], [0, 1], [1, 0], [0, -1]];   // quality "lite": a diamond, and 2 rings per link (the locks were a quarter of a light avatar's vertices)
const DRAG = 10, VDAMP = 0.25;   // the wind's pull per m/s of it (m/s²) / how much of its own up-and-down a lock keeps against the head's (per step)
// falling and rising (2026-10-07, Saori: "下に行ったら空気におされて全体的に外側に膨らんで、上に行ったら直線体にくっつくみたいに、横向きに大きく動く"):
// the head's speed up or down (smoothed) pushes the locks out from the head's middle line while it falls (the air from below spreads them,
// more toward the tips) and in against the head and the body while it rises: across, not up and down (they bobbed like jelly)
const SPREAD_OUT = 0.35, SPREAD_IN = 0.07, SPREAD_V0 = 0.6, SPREAD_V = 0.8, SPREAD_K = 0.1, SPREAD_BACK = 4;   // the tip spread out / drawn in (for the lock's length: a short lock lying on the head hardly moves); the speed (m/s) under which nothing happens (a run's bobbing) and over it for all of it; how firmly they follow; how fast it goes back (/s)
// a tuft (tuftLocks): its underside bulges at most this share of its top / on top of the head it is this share as thick / how thick along it
// (to nothing over the last `point` of its length, straight: with its width, a point with flat sides)
const UNDER = 0.45, TOP = 0.35, tuftThick = (t, point) => sstep(0, 0.22, t) * Math.pow(Math.min(1, Math.max(0, (1 - t) / point)), 0.8);
const LEAVE = 0.2, SPIKE_TIP = 32;   // a spike's ridge leaves the tuft at this slope (a three-sided point from all its base, not a thorn out of the tuft's side) / the angle of its point (degrees)
const girth = (uy) => sstep(0.8, 0.25, uy);   // 0 on top of the head … 1 round its widest part and below (uy: how far up a direction from the head's middle points)
const OWN = 0.4;   // how much a lock's own roundness shows in its shading (its edges turn toward the shadow, so each lock reads apart)   // drawn rings per link (a Catmull-Rom curve through the chain's points)

/**
 * Where the locks grow and how they hang (root space, rest pose): a ring of locks around the back and sides of the head, in two layers
 * (the inner one between the outer one's locks), each draped once over the hair underneath and the body.
 * L: { count, span (degrees each side of the back), width, thick, ph: [outer, inner] (degrees up from the head's middle, where they grow), flick }
 * bottom(th): the height the lock reaches at this angle around the head (0 = front) / cap(x, y, z): the hair under the locks (distance, root space)
 * center: the head's center (root space) / coll: the colliders (see colliders()) / ellipsoid: the head for the drape
 */
// one lock's own changes (L.edits: [{ i, dy, da, w, th, fl }], i = the lock's number, outer layer first): dy moves its tip up (m, < 0 = longer),
// da turns it around the head (degrees), w and th scale its width and thickness, fl flicks it out (m, > 0) or curls it in (< 0)
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));   // an angle into -π..π
const editOf = (L, i) => (L.edits ?? []).find((e) => e?.i === i) ?? {};
/**
 * Flick out / curl in (2026-10-05, Saori: "全体がななめに移動してる。途中からカーブしてくるんとはねる、顔に沿うみたいに"): the lock stays as it is
 * down to its middle, then bends: each link a little more than the one before, so it curves, tighter toward the tip. fl (m, as the sliders
 * have always given it): ±0.04 turns the tip about 150° (> 0 out from the head and up, a flip; < 0 in toward it). keepOut(p): keeps a
 * point out of what is under it, so a lock curling in slides along the head and the face instead of into them.
 */
export function bendLock(P, fl, { center, keepOut = null, from = 0.5 }) {
  const N = P.length, TH = Math.max(-1.25, Math.min(1.25, fl / 0.04)) * 150 * Math.PI / 180; if (!TH || N < 3) return P;
  const k0 = Math.max(1, Math.min(N - 2, Math.round((N - 1) * from))), sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const d = nrm(sub3(P[k0], P[k0 - 1])); let o = [P[k0][0] - center[0], 0, P[k0][2] - center[2]]; const od = o[0] * d[0] + o[2] * d[2]; o = nrm([o[0] - d[0] * od, -d[1] * od, o[2] - d[2] * od]);   // out from the head, across the lock
  const a = nrm([d[1] * o[2] - d[2] * o[1], d[2] * o[0] - d[0] * o[2], d[0] * o[1] - d[1] * o[0]]);   // turning about a (d × o) by + takes the lock toward "out"
  const rot = (v, t) => { const c = Math.cos(t), s = Math.sin(t), k = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];   // Rodrigues
    return [0, 1, 2].map((i) => v[i] * c + (a[(i + 1) % 3] * v[(i + 2) % 3] - a[(i + 2) % 3] * v[(i + 1) % 3]) * s + a[i] * k * (1 - c)); };
  const Q = P.map((p) => [...p]);
  for (let i = k0 + 1; i < N; i++) { const u = (i - k0) / (N - 1 - k0), r = rot(sub3(P[i], P[i - 1]), TH * Math.pow(u, 1.3)); Q[i] = [Q[i - 1][0] + r[0], Q[i - 1][1] + r[1], Q[i - 1][2] + r[2]]; if (keepOut) keepOut(Q[i], i); }
  return Q;
}
export function ringLocks(L, { cap, center, coll, ellipsoid, bottom, hugY = null, innerHugY = hugY, N = 12 }) {
  const deg = Math.PI / 180, specs = [], n = Math.max(3, Math.round(L.count ?? 13)), span = L.span ?? 110, PH = L.ph ?? [52, 30];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // the same small differences every build
  for (const layer of [0, 1]) for (let i = 0; i < n - layer; i++) {
    const E = editOf(L, specs.length), u = (i + (layer ? 1 : 0.5)) / n, th = (180 - span + 2 * span * u + (E.da ?? 0)) * deg, ph = PH[layer] * deg;   // th: around the head (0 = front), ph: up from the head's middle
    const dir = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)];
    const t = surfaceAlong(cap, center, dir);   // the hair's surface along this direction
    const root = dir.map((v, k) => center[k] + v * (t - 0.012));   // a little under the surface: the root is hidden in the hair
    const len = Math.max(0.05, (root[1] - bottom(th)) * (1 + (L.vary ?? 0.12) * (rnd() - 0.5)) + 0.04 - (E.dy ?? 0));
    const w = (L.width ?? 0.075) * (0.85 + 0.3 * rnd()) * (layer ? 1.15 : 1) * (E.w ?? 1);
    specs.push({ root, len, w, thick: (L.thick ?? 0.3) * (E.th ?? 1), layer, curl: (rnd() - 0.5) * 0.04, rise: true, fl: (L.flick ?? 0) + (E.fl ?? 0), hold: layer ? INNER_HOLD : 1, rigid: layer ? INNER_RIGID : 1,   // rise: it gets its thickness gently (no ridge at the root)
      group: `ring${Math.min(2, Math.floor(u * 3))}`, cohere: L.cohere ?? 0.45, hugW: sstep(0.2, 0.7, -Math.cos(th)) });   // the left, the back and the right swing each as one (createLocks; 2026-10-07)
  }
  // flick (m): from the middle down the locks curve away from the head and up (> 0) or in under it (< 0), kept out of the head and the body
  const keepOut = (p, i) => { const r = 0.004; pushOutEllipsoid(p, ellipsoid.c, ellipsoid.r, r); for (const c of coll) pushOutSphere(p, c.c, c.r + r); };
  // hugY / innerHugY (the inner layer): the locks lie on the head down to there, fully at the back, not at all at the sides (hugW): the nape
  // hugs while the sides keep standing out (hugged all round, the sides came in and the hair's outline shrank to a ball)
  return specs.map((s) => { const hy = s.layer ? innerHugY : hugY; let pts = drape(s, coll, ellipsoid, N, hy == null ? null : hy + (1 - s.hugW) * Math.max(0, s.root[1] - hy));
    if (s.fl) pts = bendLock(pts, s.fl, { center, keepOut });
    return { ...s, pts }; });
}
/**
 * Short hair: locks that lie along the hair underneath (root space), from near the crown down to the hem, following its shape (into the
 * nape's inward curve) instead of hanging from the back of the skull (draped short locks fell straight from its widest point: a boxy
 * outline over the neck). L: as ringLocks, plus flick (m: the tips lift off a little) / bottom(th): the hem's height at this angle
 */
export function surfaceLocks(L, { cap, center, bottom, N = 8 }) {
  const deg = Math.PI / 180, specs = [], n = Math.max(3, Math.round(L.count ?? 15)), span = L.span ?? 115, PH = L.ph ?? [64, 44];
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const layer of [0, 1]) for (let i = 0; i < n - layer; i++) {
    const E = editOf(L, specs.length), u = (i + (layer ? 1 : 0.5)) / n, th = (180 - span + 2 * span * u + (E.da ?? 0)) * deg, ph = PH[layer] * deg;
    const rd = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)], root = rd.map((v, k) => center[k] + v * (surfaceAlong(cap, center, rd) - 0.01));
    const ty = bottom(th) - (L.vary ?? 0.15) * 0.1 * rnd() + (E.dy ?? 0), c = [center[0], ty, center[2]], hd = [Math.sin(th), 0, Math.cos(th)], tip = hd.map((v, k) => c[k] + v * surfaceAlong(cap, c, hd));
    const w = (L.width ?? 0.075) * (0.85 + 0.3 * rnd()) * (layer ? 1.15 : 1) * (E.w ?? 1), thick = (L.thick ?? 0.25) * (E.th ?? 1), puff = (L.puff ?? 0.008) * rnd(), pts = [];   // puff: some locks stand a little off the others
    for (let q = 0; q < N; q++) { const t = q / (N - 1), p = root.map((v, k) => v + (tip[k] - v) * t), d = p.map((v, k) => v - center[k]), dl = Math.hypot(...d), e = d.map((v) => v / dl);
      const off = rise(t, (layer ? -0.003 : 0.003) + puff * Math.sin(Math.PI * t) + ((L.flick ?? 0.02) + (E.fl ?? 0)) * t ** 3), at = surfaceAlong(cap, center, e) + Math.max(-0.006, off);   // half sunk into the hair (it keeps the hair's own volume; on top of it the locks made the head 2-4 cm bigger, a step where they began); the outer layer over the inner one
      pts.push(e.map((v, k) => center[k] + v * at)); }
    let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
    specs.push({ root: pts[0], pts, len, w, thick, layer, curl: (rnd() - 0.5) * 0.03, rise: true });
  }
  return specs;
}
// long hair: down to L.bottom, the sides a little shorter (the hem curves up toward the face)
// split (0..1; 2026-10-10, Saori, with 島風's figure from behind: "うしろがみは…二股にわかれてもちあげる"): the long hair parted down the
// back into two bundles, each lifted out to its side and a little back, its locks gathered toward the tips and swinging as one
const hemOf = (L) => (th) => L.bottom + 0.18 * Math.sin(th) ** 2 * 0.5;   // L.bottom: root space
export const longLocks = (L, kit) => { const specs = ringLocks(L, { ...kit, bottom: hemOf(L) });   // kit.hugY: see drape
  const S = L.split ?? 0; if (!(S > 0)) return specs;
  const A = S * (L.splitAngle ?? 55) * Math.PI / 180, GAP = 0.03 * S, rotZ = (v, t) => [v[0] * Math.cos(t) - v[1] * Math.sin(t), v[0] * Math.sin(t) + v[1] * Math.cos(t), v[2]], rotX = (v, t) => [v[0], v[1] * Math.cos(t) - v[2] * Math.sin(t), v[1] * Math.sin(t) + v[2] * Math.cos(t)];
  for (const s of specs) { const side = s.root[0] >= 0 ? 1 : -1, P = s.pts, N = P.length, Q = [P[0]];
    for (let i = 1; i < N; i++) { const u = i / (N - 1); let d = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]];
      d = rotX(rotZ(d, side * A * u ** 0.8), A * 0.35 * u); Q.push([Q[i - 1][0] + d[0] + side * GAP * (Math.min(1, u * 4) - Math.min(1, (i - 1) / (N - 1) * 4)), Q[i - 1][1] + d[1], Q[i - 1][2] + d[2]]); }   // out to its side (about the front-back axis) and back; the two bundles parted by GAP from near the root (the nape shows between them)
    s.pts = Q; s.side = side; s.group = `split${side}`; s.cohere = Math.max(s.cohere ?? 0, 0.7); }
  for (const side of [1, -1]) { const B = specs.filter((s) => s.side === side); if (!B.length) continue; const N = B[0].pts.length;   // each bundle's locks gathered toward its middle line, more toward the tips
    for (let i = 1; i < N; i++) { const m = [0, 1, 2].map((k) => B.reduce((a, s) => a + s.pts[i][k], 0) / B.length), g = 0.55 * S * (i / (N - 1)) ** 1.4;
      for (const s of B) for (let k = 0; k < 3; k++) s.pts[i][k] += (m[k] - s.pts[i][k]) * g; } }
  return specs; };
/**
 * Long hair from the whorl (hair.sculpt.whorl on, no block): the outer locks laid over the head from the whorl as the bangs are (bangLocks,
 * one per row round the back, the tips on the hem), and where they leave the head let fall against it and the body as drape does (bangLocks
 * hangs them straight down: through the shoulders), flicked from that part's middle. No inner layer: the ring's, draped as thick as it is,
 * lay over these. L: as longLocks / W: bangLocks' whorl options / bk: bangKit() (head space) / toHeadY: a root-space height in head space
 */
export function whorlLongLocks(L, W, bk, { center, coll, ellipsoid: ell, toHeadY, N = 16 }) {
  const bottom = hemOf(L), n = Math.max(3, Math.round(L.count ?? 13)), span = L.span ?? 110, tips = [];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) { const E = editOf(L, i), a = -span + 2 * span * (i + 0.5) / n + (E.da ?? 0), b = bottom((180 + a) * Math.PI / 180);   // a: from the back
    tips.push([a, toHeadY(b - 0.04 - (L.vary ?? 0.12) * (rnd() - 0.5) * (center[1] - b) + (E.dy ?? 0)), null, null, null, 0, 0, 0, E.w ?? 1, 0, 0]); }   // 4 cm past the hem as the ring's (draped, they rise)
  const specs = bangLocks({ span, lockSpan: 360, overlap: L.overlap ?? 1.3, lockBand: L.band ?? 0.3, lockHangY: L.hangY ?? 0.86, aOff: 180, noFront: true, N, tips, lockThick: L.thick ?? 0.22, puff: L.puff ?? 0.004, ...W }, bk);
  const keepOut = (p) => { pushOutEllipsoid(p, ell.c, ell.r, 0.004); for (const c of coll) pushOutSphere(p, c.c, c.r + 0.004); };
  specs.forEach((s, l) => { const P = s.pts, k0 = Math.max(1, Math.floor(s.frontFrom * (N - 1))), seg = P.map((p, i) => i ? Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1], p[2] - P[i - 1][2]) : 0);
    const r = P.map((_, i) => 0.5 * s.w * s.thick * (s.prof ?? width)(i / (N - 1)) + 0.003);
    if (s.hang) for (let it = 0; it < 160; it++) { for (let i = k0 + 1; i < N; i++) P[i][1] -= 0.002;   // drape's steps, the part on the head held
      for (let k = 0; k < 3; k++) { for (let i = k0 + 1; i < N; i++) { const a = P[i - 1], b = P[i], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dl = Math.hypot(...d) || 1; for (let q = 0; q < 3; q++) b[q] = a[q] + d[q] * seg[i] / dl; }
        for (let i = k0 + 1; i < N; i++) { pushOutEllipsoid(P[i], ell.c, ell.r, r[i]); for (const c of coll) pushOutSphere(P[i], c.c, c.r + r[i]); } } }
    // long.fan (m at the tips): the hanging part out from the head's axis, more toward the tips (a wider silhouette down the back);
    // long.wave (m), waves: it sways sideways, each lock from its own phase (a wavy outline, not a straight curtain)
    if (s.hang && (L.fan || L.wave)) for (let i = k0 + 1; i < N; i++) { const t = (i - k0) / (N - 1 - k0), p = P[i], dx = p[0] - center[0], dz = p[2] - center[2], dl = Math.hypot(dx, dz) || 1, f = (L.fan ?? 0) * t ** 1.5;
      p[0] += dx / dl * f + (L.wave ?? 0) * Math.sin(2 * Math.PI * (L.waves ?? 1.5) * t + l * 2.4) * sstep(0, 0.3, t); p[2] += dz / dl * f; }
    const fl = (L.flick ?? 0) + (editOf(L, l).fl ?? 0); if (fl) s.pts = bendLock(P, fl, { center, keepOut, from: (k0 + 0.5 * (N - 1 - k0)) / (N - 1) });
    Object.assign(s, { stiff: 1, group: `ring${Math.min(2, Math.floor(l / n * 3))}`, cohere: L.cohere ?? 0.45 }); });   // the left, the back and the right each swinging as one
  return specs;
}

/** How far from c along the unit direction d the surface of f is (c inside it): halving the range, inside → outside. */
export function surfaceAlong(f, c, d, t0 = 0, t1 = 0.6) {
  for (let k = 0; k < 30; k++) { const t = 0.5 * (t0 + t1); if (f(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t) < 0) t0 = t; else t1 = t; }
  return 0.5 * (t0 + t1);
}
/**
 * Bangs as locks (head space, then carried into root space by toRoot). B: options.hair.sculpt.nendo — the same tips the "nendo" bangs are
 * cut from ([angle, tip height, slope, skew, group, sweep (degrees), extra thickness, flick (m), width (×), wave (m), lean]): each tip becomes one lock, from the top of the head
 * to that tip, as wide as the gap between its neighbours (and a little more, so they overlap), lying over the hair and the forehead with
 * a little puff in the middle. surf: the hair under the bangs and the head (distance, head space) / center: the head's center (head space)
 */
export function bangLocks(B, { surf, center, toRoot, sx = 1, N: N0 = 8 }) {
  const N = B.N ?? (B.tips.some((t) => t[7]) ? 14 : N0);   // a flick needs the points for its curve (every lock of the mesh has as many; B.N: two calls into one mesh)
  const RW = B.lockRootW ?? 1, prof0 = widthFor(B.lockBand ?? 0), prof = RW < 1 ? (t) => prof0(t) * (RW + (1 - RW) * sstep(0, 0.4, t)) : prof0;   // lockBand: how late the locks narrow to their points; lockRootW: the root's width (rooted at the whorl)
  const deg = Math.PI / 180, T = B.tips.map(([a, y, , , , sw, tk, fl, wd, wv, ln]) => ({ a: a * deg, y, sw: (sw ?? 0) * deg, tk: tk ?? 0, fl: fl ?? 0, wd: wd ?? 1, wv: wv ?? 0, ln: ln ?? 0 })).sort((p, q) => p.a - q.a), span = (B.span ?? 92) * deg;
  const HY = B.lockHangY ?? 0.86;   // below this (head space) a tuft hangs straight down: off the head, over the shoulders and the chest
  // aOff (degrees): the rows' angles are from there (the back's locks from the whorl: 180, so the rows run -span..span as the bangs' do).
  // whorl { d: unit direction from center (head space), r: the roots' ring around it (radians) }: every lock rooted there (see hair.sculpt.whorl)
  const A0 = (B.aOff ?? 0) * deg, WH = B.whorl, PART = (B.part ?? 0) * deg;
  // shape { hang, flare: [[y, m], …], sides } (the back's from the whorl): the hair's outline set first, the locks laid on it. Below the head's
  // widest part a lock stands off the head and the nape by hang (0: along them, 1: hanging straight from the widest part) plus flare at that
  // height (head space, m), the flare × sides at the sides (else flicks lock by lock set the outline, and it would not come out as wanted)
  const SH = B.shape, FL = SH?.flare ?? [], flareAt = (y) => { if (!FL.length) return 0; if (y >= FL[0][0]) return FL[0][1]; for (let i = 1; i < FL.length; i++) if (y >= FL[i][0]) { const [y0, m0] = FL[i - 1], [y1, m1] = FL[i]; return m0 + (m1 - m0) * (y0 - y) / (y0 - y1); } return FL.at(-1)[1]; };
  const out = [], horiz = (y, th) => { const c = [0, y, center[2]], d = [Math.sin(th + A0), 0, Math.cos(th + A0)], t = surfaceAlong(surf, c, d); return [c[0] + d[0] * t, y, c[2] + d[2] * t]; };
  // where a tuft leaves the head to hang: at its height, but no closer in than the head is anywhere above it (at the sides HY is below the
  // jaw, and the surface there is the neck: a side tuft hung from the neck, as narrow as the neck's radius made it, a row of strings)
  // (with a shape: on the shape at that height, so the tips and the locks' widths follow it, not the neck under it). noTuck: above HY too
  // (the back from the whorl without a shape: a tip at the nape's height lay under the skull, a strand as thin as a thread along the neck)
  const shWof = (th) => SH ? (SH.sides ?? 1) + (1 - (SH.sides ?? 1)) * sstep(0.2, 0.7, -Math.cos(th + A0)) : 0;
  const leave = (y, th) => { const p = horiz(y, th); if (y > HY && !SH && !B.noTuck) return p; const hs = Math.hypot(p[0], p[2] - center[2]); let R = hs;
    for (let yy = y + 0.03; yy <= center[1]; yy += 0.03) { const q = horiz(yy, th); R = Math.max(R, Math.hypot(q[0], q[2] - center[2])); }
    if (SH) R = hs + (R - hs) * (SH.hang ?? 0) + flareAt(y) * shWof(th);
    return [Math.sin(th + A0) * R, y, center[2] + Math.cos(th + A0) * R]; };
  T.forEach((tp, i) => {
    const gl = i > 0 ? tp.a - T[i - 1].a : 2 * (tp.a + span), gr = i + 1 < T.length ? T[i + 1].a - tp.a : 2 * (span - tp.a), half = 0.5 * Math.max(Math.min(gl, gr) * 1.2, Math.max(gl, gr) * 0.8);   // half the clump's angle
    // a wide clump is several locks side by side whose tips gather toward the clump's tip (the outer ones end a little higher): strands, not a sheet.
    // A tuft made narrow (its width wd) splits into fewer
    const k = Math.max(1, Math.round(2 * half * tp.wd / ((B.lockSpan ?? 13) * deg)));
    const mid = leave(Math.max(tp.y, HY), tp.a - tp.sw);   // where the clump's middle leaves the head: its hanging locks gather under it
    for (let j = 0; j < k; j++) {
      const f = k > 1 ? (j + 0.5) / k * 2 - 1 : 0, tipY = tp.y + Math.abs(f) * (B.lockRise ?? 0.03); let tipA = tp.a - tp.sw + f * half * (B.lockTipSpread ?? 0.45) * tp.wd;   // f: -1..1 across the clump
      const yH = Math.max(tipY, HY), hang = yH - tipY;   // the part on the head ends at yH; the rest (hang) falls straight down from there
      let tip = leave(yH, tipA); const r0 = Math.hypot(tip[0], tip[2] - center[2]), w = 2 * half / k * r0 * (B.overlap ?? 1.25) * (k > 1 ? 1.35 : 1) * tp.wd * sx;
      // lean (the row's 11th value, -1..1; + the way a + sweep goes): the lock's point at its edge on that side, the other edge cut aslant to it
      // (the mesh's doing: createLocks). The lock itself goes half its width the other way, so the point stays at the row's tip
      const side = tp.ln ? tp.ln * 0.5 * w / sx / r0 : 0; if (side) { tipA += side; tip = leave(yH, tipA); }
      // sweep (the row's 6th value): the lock comes straight down, then curves over to the swept tip in its lower part (2026-10-05, Saori:
      // "流れも毛先が横に移動してるだけ"; it ran straight from the root to the swept tip, a slanted lock)
      const tip0 = tp.sw ? leave(yH, tipA + tp.sw) : tip, swk = (u) => u <= 0.4 ? 0 : ((u - 0.4) / 0.6) ** 2;
      const ph = (B.lockRoot ?? 70) * deg, ra = A0 + (tp.a + side + f * half) * (B.lockRootSpread ?? 0.45);   // they grow from near the crown (where the back's locks start too)
      let rd = [Math.sin(ra) * Math.cos(ph), Math.sin(ph), Math.cos(ra) * Math.cos(ph)];
      if (WH) { const td = tip.map((v, q) => v - center[q]), dd = td[0] * WH.d[0] + td[1] * WH.d[1] + td[2] * WH.d[2], tg = td.map((v, q) => v - WH.d[q] * dd), tl = Math.hypot(...tg) || 1;   // off the whorl toward its tip
        rd = WH.d.map((v, q) => v + tg[q] / tl * WH.r); const rl = Math.hypot(...rd); rd = rd.map((v) => v / rl); }
      const rt = surfaceAlong(surf, center, rd), root = rd.map((v, q) => center[q] + v * (rt - 0.006));
      let reach = 0, last = null;
      const thick = (B.lockThick ?? 0.22) + tp.tk * 6, puff = B.puff ?? 0.012, pts = [];
      const upper = 1.15 * Math.hypot(...tip.map((v, m) => v - root[m])), share = upper / (upper + hang);   // the points spread over the whole length
      for (let q = 0; q < N; q++) { const t = q / (N - 1);
        let px, py, pz;
        if (t <= share || !hang) { const tu = hang ? t / share : t, p = root.map((v, m) => v + (tip0[m] - v) * tu + (tip[m] - tip0[m]) * swk(tu)), d = p.map((v, m) => v - center[m]), dl = Math.hypot(...d), u = d.map((v) => v / dl);
          const off = 0.5 * w / sx * thick * prof(t) + 0.002 + puff * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.004 * (1 - Math.abs(f)), at = surfaceAlong(surf, center, u) + rise(t, off);   // along the surface (the root a little inside the hair); the middle of a clump on top
          px = center[0] + u[0] * at; py = center[1] + u[1] * at; pz = center[2] + u[2] * at; const hr = Math.hypot(px, pz - center[2]);
          if (WH && py > center[1]) {} else if (SH) {   // on the shape at the height it was headed for (pushed onto the head along the ray from its middle, it rose up the neck: short locks, short flicks)
            const q = leave(p[1], Math.atan2(px, pz - center[2]) - A0), qh = Math.hypot(q[0], q[2] - center[2]) || 1, k = (qh + Math.max(0.002, off)) / qh; px = q[0] * k; py = q[1]; pz = center[2] + (q[2] - center[2]) * k; }
          else if (hr < reach) { const k = reach / (hr || 1); px *= k; pz = center[2] + (pz - center[2]) * k; } else reach = hr;   // below the head's widest part the lock hangs down instead of tucking in under it (a tuft ending low wrapped under the head into a lump below the ear)
          last = [px, py, pz]; }
        else { const th = (t - share) / (1 - share), gt = 0.7 * Math.sin(0.5 * Math.PI * th); px = last[0] + (mid[0] - last[0]) * gt; pz = last[2] + (mid[2] - last[2]) * gt; py = last[1] - (last[1] - tipY) * th;   // hanging down, the clump's locks gathering into one tuft (else they hung apart, a row of strings)
          if (tp.wv) { const nx = Math.sin(tp.a + A0), nz = Math.cos(tp.a + A0) + 0.9, nl = Math.hypot(nx, nz), e = tp.wv * Math.sin(2 * Math.PI * (B.waves ?? 1.5) * th) * sstep(0, 0.3, th); px += nz / nl * e; pz -= nx / nl * e; } }   // wave (the row's 10th value, m): the hanging part snakes side to side across its flat side
        pts.push([px, py, pz]); }
      // flick (the row's 8th value, m): from its middle (or where it starts to hang) the lock curves out and up (> 0) or in (< 0: along the
      // forehead, the cheek, the jaw: it stays 2 mm over whatever it meets, so it follows the face)
      if (tp.fl) { const keepOut = (p) => { const hx = p[0], hz = p[2] - center[2], h = Math.hypot(hx, hz) || 1, floor = surfaceAlong(surf, [0, p[1], center[2]], [hx / h, 0, hz / h]) + 0.002 + 0.25 * w * thick; if (h < floor) { p[0] = hx / h * floor; p[2] = center[2] + hz / h * floor; } };
        // from the whorl: where it passes below the head's widest part, where it leaves the head (from its middle it was still on the skull's
        // curve over the top, and a flick there curled in at the ear)
        let from = hang ? share + (1 - share) * 0.45 : 0.5; if (WH) { const q = pts.findIndex((p) => p[1] < center[1]); if (q > 0) from = Math.min(q, N - 3) / (N - 1); }
        const B2 = bendLock(pts, tp.fl, { center, keepOut, from }); pts.splice(0, N, ...B2); }
      for (let q = 0; q < N; q++) pts[q] = toRoot(...pts[q]);
      let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
      out.push({ root: pts[0], pts, len, w, thick, layer: 0, curl: 0, rise: true, prof: B.lockBand || RW < 1 ? prof : undefined, lean: tp.ln, stiff: hang > 0.02 ? Math.max(0.15, 0.06 / hang) : 1,   // a tuft hanging long is softer: it swings like long hair
        front: hang > 0.02 && !B.noFront ? 0.9 : 0, frontFrom: share, hang: hang > 0.02,
        // shingle: the lock's edge toward the part raised, the other tucked under its neighbour (roof tiles); none on the lock across from the part
        tilt: B.shingle ? B.shingle * (Math.abs(Math.abs(wrapA(tipA + A0 - PART)) - Math.PI) < 0.02 ? 0 : Math.sign(wrapA(tipA + A0 - PART))) : 0 });   // and turns its flat side to the front where it hangs (createLocks): a tuft beside the face hung edge-on to the view, thin as a string
    }
  });
  return out;
}

/**
 * Side-swept bangs as locks (2026-10-07, Saori: the locks / block switch apart from the style): each of the block's big strands
 * ([from angle, to angle, to height angle, radius, bend], degrees; hair/index.js SIDE) is a few locks side by side, from the crown (58°
 * up) sweeping across the forehead along the hair, coming together a little toward the tip. surf / center / toRoot: as bangLocks
 */
export function sideLocks(defs, { surf, center, toRoot, sx = 1, N = 10 }) {
  const deg = Math.PI / 180, out = [];
  for (const [th0, th1, ph1, w, bend] of defs) {
    const k = Math.max(1, Math.round(w / 0.026)), lw = 2 * w / k * 1.35 * sx, thick = 0.3;
    for (let j = 0; j < k; j++) { const f = k > 1 ? (j + 0.5) / k * 2 - 1 : 0, df = f * (w / 0.25) * 0.9, pts = [];   // df: its place across the strand (radians at the root)
      for (let q = 0; q < N; q++) { const t = q / (N - 1), th = (th0 + (th1 - th0) * t + bend * Math.sin(Math.PI * t)) * deg + df * (1 - 0.55 * t), ph = (58 + (ph1 - 58) * t) * deg;
        const d = [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)], off = 0.5 * lw / sx * thick * width(t) + 0.003 + 0.006 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (1 - 0.5 * Math.abs(f));
        const at = surfaceAlong(surf, center, d) + rise(t, off); pts.push(toRoot(center[0] + d[0] * at, center[1] + d[1] * at, center[2] + d[2] * at)); }
      let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
      out.push({ root: pts[0], pts, len, w: lw, thick, layer: 0, curl: 0, rise: true, stiff: 1 }); } }
  return out;
}

/**
 * Locks drawn by hand (options.hair.drawn). Each: { pts: [[x, y, z], …] the stroke from root to tip (head space), width (m, default 0.03),
 * thick (× width, default 0.3), stiff (default 1: how firmly it keeps its drawn shape; a loop needs it), mirror (also on the other side), taper,
 * curl (m: the stroke becomes the axis of a ringlet of this radius, 0 = none), turns (of the ringlet, default 2), curlFrom (0..1 along the stroke: straight to there, a lock lying on the head first), twist (rad, root to tip: the
 * ribbon turns about its own line), wave (m: it snakes side to side in its own face, < 0 the other way first), waves (how many, default 1.5);
 * all need center (root space: the head's, for the side that faces out),
 * fromWhorl (with W = { d, surf, center, rootW }, hair.sculpt.whorl on): a path from the whorl over the head, under the other locks, to the
 * stroke's first point goes before it, narrow at the whorl and full from that point (a sidelock drawn from the temple showed its root's stub) }.
 * The stroke is resampled to N points evenly along its length (every lock of one mesh has the same number of points). toRoot: head → root space
 */
export function drawnLocks(list, { toRoot, N: N0 = 16, W = null, center = null, rigid = 0 }) {   // rigid: the hair's (hair.rigid), for the locks beside a ringlet (see coiled)
  const out = [], N = Math.max(N0, ...(list ?? []).map((d) => d?.curl > 0 ? Math.min(40, Math.ceil(8 * (d.turns ?? 2)) + 1) : 0));   // 8 points a turn
  const nz = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), kv = dot(k, v); return [0, 1, 2].map((i) => v[i] * c + (k[(i + 1) % 3] * v[(i + 2) % 3] - k[(i + 2) % 3] * v[(i + 1) % 3]) * s + k[i] * kv * (1 - c)); };
  const tan = (P, q) => nz(P[Math.min(P.length - 1, q + 1)].map((v, k) => v - P[Math.max(0, q - 1)][k]));
  for (const d of list ?? []) {
    if (!d?.pts || d.pts.length < 2) continue;
    for (const m of d.mirror ? [1, -1] : [1]) {
      let P = d.pts.map(([x, y, z]) => [x * m, y, z]), t0 = 0; const acc = [0];
      if (d.fromWhorl && W) { const c = W.center, e0 = P[0].map((v, k) => v - c[k]), r0 = Math.hypot(...e0), u0 = e0.map((v) => v / r0), h0 = r0 - surfaceAlong(W.surf, c, u0), pre = [];
        for (let q = 0; q < 8; q++) { const t = q / 8, u = W.d.map((v, k) => v * (1 - t) + u0[k] * t), ul = Math.hypot(...u), e = u.map((v) => v / ul), at = surfaceAlong(W.surf, c, e) + 0.003 + (h0 - 0.003) * sstep(0.5, 1, t);   // along the surface, lifting to the stroke's start over the last half
          pre.push(e.map((v, k) => c[k] + v * at)); }
        P = [...pre, ...P]; }
      for (let i = 1; i < P.length; i++) acc.push(acc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
      const L = acc.at(-1); if (L < 0.01) continue; if (d.fromWhorl && W) t0 = acc[8] / L;
      const pts = []; let j = 0;
      for (let q = 0; q < N; q++) { const s = L * q / (N - 1); while (j < P.length - 2 && acc[j + 1] < s) j++; const f = (s - acc[j]) / ((acc[j + 1] - acc[j]) || 1);
        pts.push(toRoot(...[0, 1, 2].map((k) => P[j][k] + (P[j + 1][k] - P[j][k]) * Math.min(1, Math.max(0, f))))); }
      let nrm;
      if (center && d.wave) { const C = pts.map((p) => [...p]), WN = d.waves ?? 1.5; let po = null;
        C.forEach((p, q) => { const T = tan(C, q), t = q / (N - 1), o0 = [p[0] - center[0], Math.max(0, p[1] - center[1]), p[2] - center[2]]; let o = o0.map((v, k) => v - T[k] * dot(o0, T)); if (po && Math.hypot(...o) < 0.3 * (Math.hypot(...o0) || 1)) o = po; o = po = nz(o);
          const a = [T[1] * o[2] - T[2] * o[1], T[2] * o[0] - T[0] * o[2], T[0] * o[1] - T[1] * o[0]], e = m * d.wave * sstep(0.08, 0.4, t) * Math.sin(2 * Math.PI * WN * t); pts[q] = p.map((v, k) => v + a[k] * e); }); }
      if (center && (d.curl > 0 || d.twist)) { const R = Math.max(0, d.curl ?? 0), TU = d.turns ?? 2, TW = d.twist ?? 0, CF = Math.min(0.9, Math.max(0, d.curlFrom ?? 0)), C = pts.map((p) => [...p]); let po = null;
        nrm = C.map((p, q) => { const T = tan(C, q), t = q / (N - 1), o0 = [p[0] - center[0], Math.max(0, p[1] - center[1]), p[2] - center[2]], ol = Math.hypot(...o0) || 1;
          let o = o0.map((v, k) => v - T[k] * dot(o0, T)); if (po && Math.hypot(...o) < 0.3 * ol) o = po.map((v, k) => v - T[k] * dot(po, T));   // the stroke runs along "out" there: the last point's
          o = po = nz(o); if (!R) return o;
          const tc = Math.max(0, (t - CF) / (1 - CF)), e = rot(o, T, m * 2 * Math.PI * TU * tc), r = R * sstep(0, 0.12, tc); pts[q] = p.map((v, k) => v + e[k] * r); return e; });   // the ribbon's flat side faces away from the axis (a mirrored one winds the other way)
        if (TW) nrm = nrm.map((e, q) => rot(e, tan(pts, q), m * TW * q / (N - 1)));
        nrm = nrm.map((e, q) => { const T = tan(pts, q), k = dot(e, T); return nz(e.map((v, i) => v - T[i] * k)); }); }
      let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
      const tp = Math.min(1, Math.max(0, d.taper ?? 0)), p1 = tp ? (t) => width(t) * (1 - tp) + (1 - t) * tp : width;   // taper (0..1): narrowing evenly from the root to the point (a cone, a wing of hair), not full to the middle
      out.push({ root: pts[0], pts, len, w: d.width ?? 0.03, thick: d.thick ?? 0.3, layer: 0, curl: 0, rise: true, stiff: d.stiff ?? 1, nrm, keepPts: d.curl > 0, rigid: d.curl > 0 ? 1 : rigid, prof: t0 ? (t) => t < t0 ? W.rootW + (1 - W.rootW) * sstep(0, t0, t) : p1((t - t0) / (1 - t0)) : tp ? p1 : undefined });
    }
  }
  return out;
}
/** a ringlet among the drawn locks: a rope's links unwind it, so the part is built rigid (each lock's share: spec.rigid) and with all its points */
export const coiled = (list) => (list ?? []).some((d) => d?.curl > 0 && d.pts?.length >= 2);

/**
 * Tufts (options.hair.tufts): few big blocks of hair from the whorl, each lying on the hair to where its tip ends (the other locks are
 * ribbons, flat on the head). Wide (the mesh bends round the head: createLocks' cols and curv), solid from the hair out (thick), its end a
 * point or cut into points, and spikes growing out of it. list: [{ to: [angle, y], width, thick, tips, notch, edge, out, lift, bow, hook, flick, flickFrom, hug, from,
 * band, ridge, rootWidth, wide, endWidth, shade, stiff, mirror, spikes: [{ y | at, length, out, up, width, side, ridge }] }]
 * (head space; schema.js hair.tufts). whorl: [x, z], where they grow from, from the top's middle. surf / center / toRoot / sx: as bangLocks.
 * cols: the points across a tuft (more when one has more points than fit). Each spec's src: { i, k, m }: the tuft in the list it is of, its
 * spike (-1: the tuft itself), the mirrored copy (m -1)
 */
export function tuftLocks(list, { surf, center, toRoot, sx = 1, whorl = [0, 0], N = 9, cols = 7 }) {
  const deg = Math.PI / 180, out = [], L = (list ?? []).filter((d) => Array.isArray(d?.to)), M = Math.max(cols, ...L.map((d) => 2 * (d.tips?.length ?? 1) + 1));
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const over = (x, z) => { let lo = center[1], hi = center[1] + 0.6; for (let k = 0; k < 30; k++) { const m = 0.5 * (lo + hi); if (surf(x, m, z) < 0) lo = m; else hi = m; } return [x, lo, z]; };   // the hair's top straight over (x, z)
  const horiz = (y, th) => { const c = [0, y, center[2]], d = [Math.sin(th), 0, Math.cos(th)], t = surfaceAlong(surf, c, d); return [d[0] * t, y, c[2] + d[2] * t]; };
  // across a tuft: a rounded block, or (ridge 1) a roof coming to a ridge along its middle: with the end's point a three-sided spike
  const shape = (K, ridge) => K.map((c) => { const u = c[0]; return Math.pow(Math.max(0, 1 - u * u), 0.6) * (1 - ridge) + (1 - Math.abs(u)) * ridge; });
  // a tuft or a spike as createLocks takes it: H its points (head space), TK its thickness at each (m, head space), CV how sharply the hair
  // turns across it there (1/m, head space), point: the share of its length it thins to its end over
  // NR (a spike): which way its thickness goes at each point (head space; a tuft's is the head's out)
  const put = (H, K, { w, TH, prof, TK, CV, point, ridge, shade, stiff, NR = null, src }) => { const pts = H.map((P) => toRoot(...P)); let len = 0; for (let q = 1; q < N; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1], pts[q][2] - pts[q - 1][2]);
    const nr = NR?.map((n, q) => { const b = toRoot(H[q][0] + n[0] * 0.01, H[q][1] + n[1] * 0.01, H[q][2] + n[2] * 0.01); return b.map((v, k) => (v - pts[q][k]) / 0.01); });   // (root space; its length: the head's scale that way)
    out.push({ root: pts[0], pts, len, w: w * sx, thick: TH / w, layer: 0, curl: 0, rise: true, stiff, prof, curv: CV.map((v) => v / sx), tk: TK.map((v, q) => v * (nr ? Math.hypot(...nr[q]) : sx)), nrm: nr?.map(norm), point, under: Math.min(UNDER, 0.006 / TH), shade, src,   // (under: a thick block's underside hardly bulges: it lies on the hair)
      cols: { u: K.map((c) => c[0]), e: K.map((c) => c[1]), d: shape(K, ridge), t0: Math.max(0.1, Math.min(0.45, Math.min(...K.map((c) => c[1])) - 0.1)) } }); };
  const TS = [];   // the tufts as built (the spikes grow out of them, and stay over them all)
  const even = (e) => { const K = []; for (let j = 0; j < M; j++) K.push([-1 + 2 * j / (M - 1), e]); return K; };
  for (const d of L) for (const m of d.mirror ? [1, -1] : [1]) {
    // the points of its end, across it from the left as seen from outside, the root up (u runs the other way: reversed), and the columns:
    // the edges, each point and the cuts between them, the rest on the flanks
    const tips = (d.tips?.length ? d.tips : [1]).map((v) => clamp(v, 0.3, 1)), n = tips.length; if (m > 0) tips.reverse();
    const notch = d.notch ?? 0.14, edge = d.edge ?? notch * 1.3; let K = [];
    if (n === 1) K = even(tips[0]);
    else { K.push([-1, tips[0] - edge]); for (let k = 0; k < n; k++) { K.push([-1 + (2 * k + 1) / n, tips[k]]); if (k + 1 < n) K.push([-1 + (2 * k + 2) / n, Math.min(tips[k], tips[k + 1]) - notch]); } K.push([1, tips[n - 1] - edge]); }
    for (let side = 0; K.length < M; side ^= 1) { let b = 0, w = 0; for (let i = 0; i + 1 < K.length; i++) { const g = K[i + 1][0] - K[i][0]; if (g > w + 1e-9 || (side && g > w - 1e-9)) { w = g; b = i; } } K.splice(b + 1, 0, [0.5 * (K[b][0] + K[b + 1][0]), Math.min(K[b][1], K[b + 1][1]) + 0.38 * Math.abs(K[b][1] - K[b + 1][1])]); }   // (halfway across a flank a little short of halfway along: the points sharp, the cuts rounded)
    // its width along it: narrow where it leaves the whorl, full by `wide`, then straight to one point over the last `point` of its length
    // (band: how late; a block with a point, not a leaf) or wide to its cut end
    const rootW = d.rootWidth ?? 0.25, wide = d.wide ?? 0.45, band = clamp(d.band ?? 0.5, 0, 1), endW = d.endWidth ?? 0.6, point = n === 1 ? 0.75 - 0.5 * band : clamp(notch + 0.12, 0.15, 0.4);
    const prof = (s) => (rootW + (1 - rootW) * sstep(0, wide, s)) * (n === 1 ? (s < 1 - point ? 1 : Math.pow(Math.max(0, (1 - s) / point), 0.9)) : 1 - (1 - endW) * s * s * s);
    const w = d.width ?? 0.1, TH = d.thick ?? 0.014, base = Math.min(UNDER, 0.006 / TH) * TH + 0.002, lift = d.lift ?? 0, outT = d.out ?? 0, hug = clamp(d.hug ?? 0, 0, 1), bow = (d.bow ?? 0) * m * deg, hook = (d.hook ?? 0) * m * deg, flick = d.flick ?? 0, flickFrom = clamp(d.flickFrom ?? 0.6, 0.2, 0.9);
    const a = d.to[0] * m * deg, R0 = d.from ? over(d.from[0] * m, d.from[1]) : over(whorl[0], whorl[1]), rd = norm(R0.map((v, q) => v - center[q]));
    let H, U, F, FO;   // the points (head space), their directions from the head's middle, the hair under each, how far each has left the hair (0..1)
    const path = (yt) => { const td = norm(horiz(yt, a).map((v, q) => v - center[q])), om = Math.acos(clamp(rd[0] * td[0] + rd[1] * td[1] + rd[2] * td[2], -1, 1)), so = Math.sin(om) || 1; let reach = 0; H = []; U = []; F = []; FO = [];
      for (let q = 0; q < N; q++) { const t = q / (N - 1), k0 = Math.sin((1 - t) * om) / so, k1 = Math.sin(t * om) / so, b = bow * Math.sin(Math.PI * t) + (t > 0.6 ? hook * ((t - 0.6) / 0.4) ** 2 : 0), cb = Math.cos(b), sb = Math.sin(b);
        let u = norm(rd.map((v, i) => v * k0 + td[i] * k1)); if (b) u = [u[0] * cb + u[2] * sb, u[1], -u[0] * sb + u[2] * cb];   // bow: its middle swung round the head; hook: only its end, curving round to the tip
        const sAt = surfaceAlong(surf, center, u), fo = t > 0.5 ? ((t - 0.5) / 0.5) ** 2 : 0, at = sAt + rise(t, base + lift * girth(u[1])) + outT * fo, P = center.map((v, i) => v + u[i] * at);
        // under the head's widest part it hangs straight down, not in under the head (hug 1: it follows the head in to the nape)
        let free = fo; if (u[1] < 0.3) { const hr = Math.hypot(P[0], P[2] - center[2]) || 1; if (hr < reach) { const k = 1 + (reach / hr - 1) * (1 - hug); free = Math.max(free, Math.min(1, (k - 1) * hr / 0.03)); P[0] *= k; P[2] = center[2] + (P[2] - center[2]) * k; } else reach = hr; }
        H.push(P); U.push(u); F.push(center.map((v, i) => v + u[i] * sAt)); FO.push(free); } };
    { let yt = d.to[1]; for (let it = 0; it < 4; it++) { path(yt); yt += d.to[1] - H[N - 1][1]; } }   // its tip at the height asked (what stands it off the hair also carries it down)
    // flick (m, as a lock's: 0.04 turns the tip 150°): from flickFrom along it its end curves out from the head and up (following the head
    // to its tip it points down however far out it stands: no flicked outline). to's height is the tip's before the flick (fitted after
    // it, the tuft grew longer by what the flick raised it: a tail)
    if (flick) { H = bendLock(H, flick, { center, from: flickFrom }); for (let q = Math.round((N - 1) * flickFrom) + 1; q < N; q++) FO[q] = 1; }
    // how sharply the hair under it turns across it (1/m): the mesh's edges go down round the head by this; flat where it has left the hair
    const CV = H.map((P, q) => { const T = norm((H[Math.min(N - 1, q + 1)]).map((v, i) => v - H[Math.max(0, q - 1)][i])), ac = norm(cross(T, U[q])), hw = Math.max(0.02, 0.5 * w * prof(q / (N - 1)));
      const drop = 0.5 * (surf(F[q][0] + ac[0] * hw, F[q][1] + ac[1] * hw, F[q][2] + ac[2] * hw) + surf(F[q][0] - ac[0] * hw, F[q][1] - ac[1] * hw, F[q][2] - ac[2] * hw));
      return Math.min(0.9 / hw, Math.max(0, 2 * drop / Math.max(1e-6, hw * hw - drop * drop))) * (1 - FO[q]); });   // (a round head: the distance drop at hw to the side is of a circle of radius (hw² - drop²) / 2 drop)
    for (let q = 1; q + 1 < N; q++) CV[q] = 0.25 * CV[q - 1] + 0.5 * CV[q] + 0.25 * CV[q + 1];
    const TK = U.map((u) => TH * (TOP + (1 - TOP) * girth(u[1])));   // thick round the head's widest part, thin on top of it (as lift)
    put(H, K, { w, TH, prof, TK, CV, point, ridge: clamp(d.ridge ?? 0.15, 0, 1), shade: clamp(d.shade ?? 0, 0, 1), stiff: d.stiff ?? 1, src: { i: list.indexOf(d), k: -1, m } });
    TS.push({ d, m, H, U, TK, CV, K, prof, w, point, RD: clamp(d.ridge ?? 0.15, 0, 1), T0: Math.max(0.1, Math.min(0.45, Math.min(...K.map((c) => c[1])) - 0.1)) });
  }
  // the tufts' tops, as createLocks builds them: t's at s along it, u across it (-1..1). Its thickness there (null past that column's end),
  // the place and which way it faces, and how far under the highest top a point is (negative: over them all)
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const frame = (t, i, fr) => { const C = mix(t.H[i], t.H[i + 1], fr), T = norm(t.H[i + 1].map((v, k) => v - t.H[i][k])), o0 = norm(mix(t.U[i], t.U[i + 1], fr)), od = dot(o0, T), o = norm(o0.map((v, k) => v - T[k] * od)); return { C, o, ac: cross(T, o) }; };
  const thickAt = (t, s, u, i, fr, whole = false) => { const K = t.K; let j = 0; while (j + 2 < K.length && K[j + 1][0] < u) j++; const e = whole ? Math.max(...K.map((c) => c[1])) : K[j][1] + (K[j + 1][1] - K[j][1]) * clamp((u - K[j][0]) / ((K[j + 1][0] - K[j][0]) || 1), 0, 1); if (s > e) return null;
    return (t.TK[i] + (t.TK[i + 1] - t.TK[i]) * fr) * tuftThick(s <= t.T0 ? s : t.T0 + (s - t.T0) * (1 - t.T0) / Math.max(1e-3, e - t.T0), t.point) * shape([[u]], t.RD)[0]; };
  const topAt = (t, s, u) => { const f = clamp(s, 0, 1) * (N - 1), i = Math.min(N - 2, Math.floor(f)), fr = f - i, { C, o, ac } = frame(t, i, fr), x = u * 0.5 * t.w * t.prof(s), h = thickAt(t, s, u, i, fr, true) ?? 0,   // (whole: as if its end were not cut into points: over a cut, a spike's base went down into it and its point came short)
    kap = t.CV[i] + (t.CV[i + 1] - t.CV[i]) * fr, ph = clamp(kap * x, -1.5, 1.5), sn = Math.sin(ph), cs = Math.cos(ph);
    const xa = (kap > 1e-3 ? sn / kap : x) + h * sn, xo = h * cs - (kap > 1e-3 ? (1 - cs) / kap : 0);
    return { p: C.map((v, k) => v + ac[k] * xa + o[k] * xo), n: norm(o.map((v, k) => v * cs + ac[k] * sn)) }; };
  const buried = (P) => { let best = -1;
    for (const t of TS) { let bi = -1, bf = 0, bd = (0.5 * t.w + 0.12) ** 2;
      for (let i = 0; i + 1 < N; i++) { const a = t.H[i], ab = t.H[i + 1].map((v, k) => v - a[k]), g = clamp(dot(P.map((v, k) => v - a[k]), ab) / (dot(ab, ab) || 1), 0, 1), dd = Math.hypot(P[0] - a[0] - ab[0] * g, P[1] - a[1] - ab[1] * g, P[2] - a[2] - ab[2] * g) ** 2; if (dd < bd) { bd = dd; bi = i; bf = g; } }
      if (bi < 0 || (!bi && bf <= 0) || (bi === N - 2 && bf >= 1)) continue; const sv = (bi + bf) / (N - 1),   // (nearest one of its ends: past it, not over it)
        { C, o, ac } = frame(t, bi, bf), x = dot(P.map((v, k) => v - C[k]), ac), hw = 0.5 * t.w * t.prof(sv); if (hw < 1e-4 || Math.abs(x) >= hw) continue;
      const kap = t.CV[bi] + (t.CV[bi + 1] - t.CV[bi]) * bf, ph = kap > 1e-3 ? Math.asin(clamp(kap * x, -0.95, 0.95)) : 0, u = kap > 1e-3 ? ph / (kap * hw) : x / hw; if (Math.abs(u) > 1) continue;
      const h = thickAt(t, sv, u, bi, bf); if (h != null) best = Math.max(best, h * Math.cos(ph) - (kap > 1e-3 ? (1 - Math.cos(ph)) / kap : 0) - dot(P.map((v, k) => v - C[k]), o)); }
    return best; };
  // spikes: bent three-sided points growing out of a tuft. A spike's base lies on the tuft's top, `length` up it from where it leaves
  // (y: its point's height, or at: 0..1 along the tuft), as wide as `width`; its ridge goes from the base's upper end to the point, `out`
  // off the tuft, bending upward on its way: a flick (a ridge following the head down bends downward). Its underside goes from the base's
  // lower end up to the point by `up` degrees. side: where across the tuft (a pair: from .. to)
  for (const T of TS) { const { d, m, H, w, prof } = T; if (!d.spikes?.length) continue;
    let HL = 0; for (let q = 1; q < N; q++) HL += Math.hypot(H[q][0] - H[q - 1][0], H[q][1] - H[q - 1][1], H[q][2] - H[q - 1][2]);
    const sAtY = (y) => { for (let q = N - 1; q > 0; q--) if ((H[q - 1][1] - y) * (H[q][1] - y) <= 0 && H[q - 1][1] > H[q][1]) return (q - 1 + (H[q - 1][1] - y) / ((H[q - 1][1] - H[q][1]) || 1)) / (N - 1); return 0.6; };
    for (const [sk, sp] of d.spikes.entries()) { const so = sp.out ?? 0.07, ua = clamp(sp.up ?? 12, -60, 60) * deg, ty = so * Math.tan(ua), sw = sp.width ?? clamp(0.45 * w, 0.08, 0.12);
      const at = clamp(sp.y != null ? sAtY(sp.y - ty) : sp.at ?? 0.6, 0.15, 1), ln = clamp((sp.length ?? 0.16) / (HL || 1), 0.05, at - 0.03);
      const sd = Array.isArray(sp.side) ? sp.side : [sp.side ?? 0, sp.side ?? 0], u0 = -clamp(sd[0] ?? 0, -1, 1) * m * 0.8, u1 = -clamp(sd[1] ?? 0, -1, 1) * m * 0.8;   // (side: + toward the right as seen from outside, the root up)
      // its base at t along it: the tuft's top there, and its middle sunk to where the tuft's top is at its two edges (the tuft is round
      // across and the base flat: neither edge stands off it)
      const base = (t, hw) => { const sv = at - ln * (1 - t), u = u0 + (u1 - u0) * t, du = hw / Math.max(1e-3, 0.5 * w * prof(sv)), c = topAt(T, sv, u); let sink = 0;
        for (const e of [-1, 1]) { const p = topAt(T, sv, clamp(u + e * du, -1, 1)).p; sink = Math.max(sink, (c.p[0] - p[0]) * c.n[0] + (c.p[1] - p[1]) * c.n[1] + (c.p[2] - p[2]) * c.n[2]); }
        return { top: c.p, n: c.n, p: c.p.map((v, k) => v - c.n[k] * (sink + 0.004)) }; };
      const A0 = base(0, 0), B0 = base(1, 0), TA = norm(norm(base(0.1, 0).top.map((v, k) => v - A0.top[k])).map((v, k) => v + A0.n[k] * LEAVE)), TB = norm(B0.top.map((v, k) => v - base(0.9, 0).top[k]));
      // its point: off the tuft where the base ends, and as far round the head as the base runs (side: [from, to])
      let nh = [B0.n[0], 0, B0.n[2]]; if (Math.hypot(nh[0], nh[2]) < 0.2) nh = [TB[0], 0, TB[2]]; nh = norm(nh); const pv = [nh[2], 0, -nh[0]], be = Math.asin(clamp(dot(TB, pv), -0.9, 0.9)), dh = nh.map((v, k) => v * Math.cos(be) + pv[k] * Math.sin(be));
      const A = A0.top.map((v, k) => v - A0.n[k] * 0.002), Q = [B0.top[0] + dh[0] * so, sp.y ?? B0.top[1] + ty, B0.top[2] + dh[2] * so], c0 = Math.hypot(Q[0] - A[0], Q[1] - A[1], Q[2] - A[2]);
      const tb = ln * HL / (ln * HL + Math.hypot(Q[0] - B0.p[0], Q[1] - B0.p[1], Q[2] - B0.p[2])), sprof = (t) => t < tb ? 0.3 + 0.7 * sstep(0, tb, t) : Math.pow(Math.max(0, (1 - t) / (1 - tb)), 0.9);   // tb: the share of it over its base / widest where the base ends
      // the ridge: a curve from along the tuft (leaving it at LEAVE) to the point, coming down to it SPIKE_TIP steeper than the underside
      // comes up. It clears the tufts' tops by what it has risen so far (its own tuft's round top as the base crosses it, a thicker
      // neighbour's lying over the base): a ridge passing under them came out in rags
      const el = ua - SPIKE_TIP * deg, D1 = [dh[0] * Math.cos(el), Math.sin(el), dh[2] * Math.cos(el)], B1 = A.map((v, k) => v + TA[k] * 0.4 * c0), B2 = Q.map((v, k) => v - D1[k] * 0.4 * c0);
      const Hs = [], NR = [], TKs = [];
      for (let q = 0; q < N; q++) { const t = q / (N - 1), a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3, S = A.map((v, k) => v * a + B1[k] * b + B2[k] * c + Q[k] * e), bs = t < tb ? base(t / tb, 0.5 * sw * sprof(t)) : null;
        if (q && q < N - 1) { const need = Math.min(LEAVE * c0 * t, 0.02), ud = buried(S) + need; if (ud > 0) { const n = (bs ?? B0).n; for (let k = 0; k < 3; k++) S[k] += n[k] * ud; } }
        const G = bs ? bs.p : mix(B0.p, Q, (t - tb) / (1 - tb)), v = S.map((x, k) => x - G[k]), th = Math.hypot(v[0], v[1], v[2]);
        Hs.push(G); TKs.push(th); NR.push(th > 1e-4 ? v.map((x) => x / th) : NR[q - 1] ?? A0.n); }
      put(Hs, even(1), { w: sw, TH: 0.06, prof: sprof, TK: TKs, CV: Hs.map(() => 0), point: 0.75, ridge: clamp(sp.ridge ?? 0.8, 0, 1), shade: clamp(d.shade ?? 0, 0, 1), stiff: d.stiff ?? 1, NR, src: { i: list.indexOf(d), k: sk, m } }); }
  }
  return out;
}

/**
 * Tails (hair.tail, 2026-10-05, Saori: side tails, twin tails, ponytails): a bundle of locks from a tie on the head. Each lock leaves the tie
 * outward (o: away from the head, a little up), arcs over and falls, the tips fanning out; then it is pushed out of the head and the body.
 * T: { count, length, volume (the bundle's radius at the tie, m), width, thick, lift (how far it stands out before falling), spread, stiff,
 *      size (×: the bundle and each lock's width together, how thick the tail looks), flare (m: the tips fanned out from the head) }
 * anchors: [{ p, o }] the ties (root space, rest) and their outward directions / coll, ell: as for the other locks (colliders(), the head)
 */
export function tailLocks(T, { anchors, coll, ell, N = 14 }) {
  const out = [], n = Math.max(1, Math.round(T.count ?? 9)), S = T.size ?? 1, VOL = T.volume * S, hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
  // gather (0..1): the tips drawn together to the bundle's middle and the outer locks a little shorter, so the tail narrows to a point as one
  // bundle (2026-10-07, Saori: "全部先端がバラバラに広がっているけど、収束させて先を細くし、一つの塊として靡くように"); 0 = fanned out as before
  const GA = T.gather ?? 0.8;
  anchors.forEach(({ p, o }, ai) => {
    const ul = Math.hypot(o[2], o[0]) || 1, u = [o[2] / ul, 0, -o[0] / ul], v = [o[1] * u[2] - o[2] * u[1], o[2] * u[0] - o[0] * u[2], o[0] * u[1] - o[1] * u[0]];   // across the tie: u sideways (level), v
    const dirOf = (i) => { const a = i * 2.39996 + 0.3; return [0, 1, 2].map((k) => u[k] * Math.cos(a) + v[k] * Math.sin(a)); };   // spread over the bundle's cross-section (golden angle)
    // tiers: the locks end in TN steps, each TIER_STEP of the length shorter, the ones furthest out from the head shortest, so the steps
    // show on the tail's outer edge (spread over the bundle, the short ones' tips were lost inside it)
    const TN = Math.max(1, Math.round(T.tiers ?? 1)), tierOf = new Array(n).fill(0), outOf = new Array(n).fill(0), FLARE = T.flare ?? 0;
    if (TN > 1 || FLARE) [...Array(n).keys()].map((i) => [Math.sqrt((i + 0.5) / n) * (dirOf(i)[0] * o[0] + dirOf(i)[2] * o[2]) / ul, i]).sort((p, q) => q[0] - p[0]).forEach(([, i], k) => { if (TN > 1) tierOf[i] = TN - 1 - Math.floor(k * TN / n); outOf[i] = n > 1 ? 1 - k / (n - 1) : 1; });
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt((i + 0.5) / n), dir = dirOf(i), tier = tierOf[i];
      const len = T.length * (1 - tier * TIER_STEP) * ((0.82 + 0.3 * hash(i)) * (1 - GA) + (1.02 - 0.2 * r * r) * GA), lift = T.lift * (0.8 + 0.4 * hash(i + 7)), fan = (T.spread ?? 1.5) * VOL * r;
      const sh = [o[0] / ul, 0, o[2] / ul].map((x) => x * VOL * TIER_OUT * tier);   // a shorter step hangs further out, over the longer ones (shingles), so its tips show on the edge
      const root = p.map((x, k) => x + dir[k] * VOL * r * 0.45), tipIn = VOL * r * 0.45 * GA * (TN > 1 ? 1 - tier / (TN - 1) : 1);   // tipIn: back toward the bundle's middle at the tip (not a short step's: its tip stays on the outer edge)
      const fo = [o[0] / ul, 0, o[2] / ul].map((x) => x * FLARE * outOf[i]);   // flare (m): the tips fan out from the head, the outermost lock by all of it, the innermost hanging straight
      const B = [root, root.map((x, k) => x + o[k] * lift * 1.6 + (k === 1 ? 0.015 : 0)),   // a cubic Bezier: out from the tie, over, and down
        root.map((x, k) => x + o[k] * lift * 1.3 + dir[k] * fan * 0.5 + sh[k] * 0.6 + fo[k] * 0.4 - (k === 1 ? len * 0.45 : 0)), root.map((x, k) => x + o[k] * lift * 0.7 + dir[k] * (fan * (1 - GA) - tipIn) + sh[k] + fo[k] - (k === 1 ? len : 0))];
      const P = []; for (let q = 0; q < N; q++) { const t = q / (N - 1), m = 1 - t; P.push([0, 1, 2].map((k) => m * m * m * B[0][k] + 3 * m * m * t * B[1][k] + 3 * m * t * t * B[2][k] + t * t * t * B[3][k])); }
      if (T.wave) { const ol = Math.hypot(o[0], o[2]) || 1, wd = [o[0] / ol, 0, o[2] / ol], ph = 0.4 * (hash(i + 11) - 0.5);   // wave (m): the bundle snakes out and in from the head as it falls, all its locks together (2026-10-05, Saori: Nahida's tail)
        P.forEach((q, j) => { const t = j / (N - 1), e = T.wave * Math.sin(2 * Math.PI * (T.waves ?? 1.5) * t + ph) * sstep(0.1, 0.4, t); for (let k = 0; k < 3; k++) q[k] += wd[k] * e; }); }
      if (TN > 1 && T.tierFlick && tier) P.splice(0, N, ...bendLock(P, T.tierFlick * tier / (TN - 1), { center: ell?.c ?? p, from: 0.7 }));   // only the shorter steps' tips, out a little: the longest hangs straight (bent from the middle, the whole tail swung out)   // each step's tips flick out from the head
      const seg = []; for (let q = 1; q < N; q++) seg.push(Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1], P[q][2] - P[q - 1][2]));
      const w = T.width * S * (0.8 + 0.4 * hash(i + 3)), rad = (q) => 0.5 * w * T.thick * width(q / (N - 1)) + 0.003;
      for (let it = 0; it < 30; it++) for (let q = 2; q < N; q++) {   // off the head and the body, keeping the links' lengths (from the root down)
        if (ell) pushOutEllipsoid(P[q], ell.c, ell.r, rad(q)); for (const c of coll) pushOutSphere(P[q], c.c, c.r + rad(q));
        const A = P[q - 1], d = [P[q][0] - A[0], P[q][1] - A[1], P[q][2] - A[2]], l = Math.hypot(...d) || 1; for (let k = 0; k < 3; k++) P[q][k] = A[k] + d[k] * seg[q - 1] / l; }
      let L = 0; for (let q = 1; q < N; q++) L += Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1], P[q][2] - P[q - 1][2]);
      const pinch = T.tie?.on ? Math.min(1, VOL * 0.9 / w) : 1;   // squeezed by the tie: no wider there than the bundle (wide locks stuck out of the ring)
      out.push({ root: P[0], pts: P, len: L, w, thick: T.thick, prof: pinch < 1 ? (t) => width(t) * (pinch + (1 - pinch) * sstep(0, 0.3, t)) : undefined, layer: 0, curl: 0, rise: false, stiff: T.stiff ?? 1, group: `tail${ai}`, cohere: 0.7 * GA });   // group: they swing together (createLocks)
    }
  });
  return out;
}

/** Where a tip of the nendo bangs is (root space, rest): at this angle around the head (degrees, 0 = front) and this height (head space),
 *  just outside the hair and the head there. For an editor's handles (the same surface the bang locks lie on). */
export function bangTipAt(angle, y, { surf, center, toRoot, hangY = 0.86 }) {   // below hangY the tuft hangs straight down: the tip is under where it leaves the head
  const th = angle * Math.PI / 180, yH = Math.max(y, hangY), d = [Math.sin(th), 0, Math.cos(th)];
  let t = 0; for (let yy = yH; yy <= Math.max(yH, center[1]) + 1e-9; yy += 0.03) { t = Math.max(t, surfaceAlong(surf, [0, yy, center[2]], d)); if (y > hangY) break; }   // a hanging tuft leaves the head where it is widest above (bangLocks' leave)
  return toRoot(d[0] * (t + 0.012), y, center[2] + d[2] * (t + 0.012));
}

// hang one lock under gravity in the rest pose, against the same colliders it meets when moving (so the first frame doesn't jump)
// hugY (root space, or null): above this height the lock lies on the head (held onto the ellipsoid, not just kept out of it), so it follows
// the head's shape, curving in below its widest part, and only hangs free below: the outline of the long block it replaced (2026-10-04,
// Saori: "it used to follow the head, dent in a little, then fall; now it falls straight from the top")
function drape(s, coll, ell, N = 12, hugY = null) {
  const seg = s.len / (N - 1), P = [];
  for (let i = 0; i < N; i++) P.push([s.root[0], s.root[1] - seg * i, s.root[2]]);
  const RR = P.map((_, i) => 0.5 * s.w * s.thick * width(i / (N - 1)) + 0.003), r = (i) => RR[i];   // once: asked for in every step for every collider, the sine and the power were most of the hair's build
  for (let it = 0; it < 160; it++) {
    for (let i = 2; i < N; i++) P[i][1] -= 0.002;
    for (let k = 0; k < 3; k++) {
      for (let i = 1; i < N; i++) { const a = P[i - 1], b = P[i], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; for (let q = 0; q < 3; q++) b[q] = a[q] + d[q] * seg / l; }   // from the root down: the root stays
      for (let i = 1; i < N; i++) { if (hugY != null && P[i][1] > hugY) onEllipsoid(P[i], ell.c, ell.r, r(i)); else pushOutEllipsoid(P[i], ell.c, ell.r, r(i)); for (const c of coll) pushOutSphere(P[i], c.c, c.r + r(i)); }
    }
  }
  return P;
}
// a lock lying on the hair comes out of it gently: its lift over the surface (off) grows from under the surface over the first third,
// and the mesh gets its thickness over the first fifth (else the root's cut edge stood out as a ridge — a step between the bangs and the
// back on top of the head, read as a helmet's rim from the front: 2026-10-04, Saori)
const rise = (t, off) => -0.006 + (off + 0.006) * sstep(0, 0.33, t);
// how wide a lock is along its length (t: 0 root → 1 tip): a little fuller in the middle, then to a sharp point
export const width = (t) => (1 + 0.25 * Math.sin(Math.PI * t)) * Math.pow(Math.max(0, 1 - t * t * t), 0.8);
// band (0..1): the lock keeps its width further down and narrows to its point later (0: from its middle, a spike; 1: a band cut to a point at its end)
export const widthFor = (band) => { if (!(band > 0)) return width; const p = 3 + 6 * Math.min(1, band); return (t) => (1 + 0.25 * Math.sin(Math.PI * t)) * Math.pow(Math.max(0, 1 - Math.pow(t, p)), 0.8); };

// n points spaced evenly along the polyline P, its ends kept. bend > 0: closer where it turns (each link counts its length plus bend × the
// whole length × its ends' turns, radians, half each): a lock from the whorl in 5 points lost the flick at its tip between two of them
function resample(P, n, bend = 0) {
  const sl = [], tu = [0]; for (let i = 1; i < P.length; i++) sl.push(Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  for (let i = 1; i + 1 < P.length; i++) { const a = P[i].map((v, c) => v - P[i - 1][c]), b = P[i + 1].map((v, c) => P[i + 1][c] - P[i][c]); tu.push(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((sl[i - 1] * sl[i]) || 1))))); } tu.push(0);
  const Lt = sl.reduce((a, b) => a + b, 0), L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + sl[i - 1] + bend * Lt * 0.5 * (tu[i - 1] + tu[i]));
  const out = []; let k = 0; for (let q = 0; q < n; q++) { const d = L.at(-1) * q / (n - 1); while (k < P.length - 2 && L[k + 1] < d) k++; const t = (d - L[k]) / ((L[k + 1] - L[k]) || 1); out.push(P[k].map((v, c) => v + (P[k + 1][c] - v) * t)); }
  return out;
}
function pushOutSphere(p, c, r) { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], d = Math.hypot(dx, dy, dz); if (d >= r || d < 1e-9) return; const k = r / d; p[0] = c[0] + dx * k; p[1] = c[1] + dy * k; p[2] = c[2] + dz * k; }
// onto an ellipsoid (grown by m), from inside or outside
function onEllipsoid(p, c, r, m) { const qx = (p[0] - c[0]) / (r[0] + m), qy = (p[1] - c[1]) / (r[1] + m), qz = (p[2] - c[2]) / (r[2] + m), d = Math.hypot(qx, qy, qz); if (d < 1e-9) return; p[0] = c[0] + qx / d * (r[0] + m); p[1] = c[1] + qy / d * (r[1] + m); p[2] = c[2] + qz / d * (r[2] + m); }
// out of an ellipsoid (center c, radii r, grown by m): along the scaled direction (good enough near the surface)
function pushOutEllipsoid(p, c, r, m) { const qx = (p[0] - c[0]) / (r[0] + m), qy = (p[1] - c[1]) / (r[1] + m), qz = (p[2] - c[2]) / (r[2] + m), d = Math.hypot(qx, qy, qz); if (d >= 1 || d < 1e-9) return; p[0] = c[0] + qx / d * (r[0] + m); p[1] = c[1] + qy / d * (r[1] + m); p[2] = c[2] + qz / d * (r[2] + m); }

/**
 * Spheres inside the body for the locks to stay out of (rest pose, root space), each on a bone: along the neck, the back and the shoulders
 * and upper arms. Each is as big as fits inside the body there (sdf), so they never stick out of it; extra ones toward the back and sides
 * cover the torso's width. J: the joints / BI: bone indices.
 */
export function colliders(J, BI, sdf) {
  const out = [], add = (bone, c) => { const r = -sdf(...c); if (r > 0.01) out.push({ bone: BI[bone], c, r }); };
  const seg = (bone, a, b, n, spread = []) => { for (let i = 0; i <= n; i++) { const t = i / n, c = a.map((v, k) => v + (b[k] - v) * t); add(bone, c);
    const r = -sdf(...c); for (const [dx, dz] of spread) add(bone, [c[0] + dx * r, c[1], c[2] + dz * r]); } };
  const T = [[0, -0.6], [0.6, -0.4], [-0.6, -0.4], [0.7, 0], [-0.7, 0]];   // toward the back and the sides (in units of the radius there)
  seg("neck", J.neck, J.head, 2); seg("upperChest", J.upperChest, J.neck, 1, T); seg("chest", J.chest, J.upperChest, 1, T); seg("spine", J.spine, J.chest, 2, T); seg("hips", J.hips, J.spine, 1, T);
  for (const s of ["L", "R"]) { seg(`shoulder.${s}`, J[`shoulder.${s}`], J[`upperArm.${s}`], 2); seg(`upperArm.${s}`, J[`upperArm.${s}`], J[`lowerArm.${s}`], 2); }
  // the bottom and the backs of the thighs: long hair may reach down past the waist (2026-10-05, Saori: "ロングヘアの長さいじれなくない?")
  const BK = [[0, -0.7], [0.6, -0.5], [-0.6, -0.5]];
  for (const s of ["L", "R"]) { const h = J[`upperLeg.${s}`], k = J[`lowerLeg.${s}`]; seg(`upperLeg.${s}`, h, k.map((v, i) => h[i] + (v - h[i]) * 0.8), 3, BK);
    add("hips", [h[0] * 0.6, h[1] + 0.01, h[2] - 0.04]); }
  return out;
}

/**
 * The moving locks. specs: from longLocks or bangLocks (all with the same number of points) / head: the head bone's index / coll: colliders() / ell: { c, r } the head (root space, rest) /
 * outward(p): the direction the hair faces at p (for the cross-section's "out" and the shading normals) / opts: { stiff, damping }
 * floor: each point stays out of the head's side of a plane through where it rests, facing out (outward there): the bangs lie close over the
 *   forehead with nothing else to keep them off it (2026-10-06, Saori: "走った時に前髪がおでこにめり込む": the head ran ahead and the locks
 *   trailing behind went into it). slack: how far in past the rest it may go (m)
 * Returns { geometry, update(dt, instant), rest() }; the geometry is skinned to the head bone (skinIndex / skinWeight set).
 */
// rigid (0..1): each lock keeps its own shape and only tilts about its second point (shape matching: the rest shape turned to where the lock
//   leans, the points pulled toward it). 0 = a rope bending anywhere (it went limp like konjac on a run). points: the lock remade with this many
//   points along it (0 = as built); a rigid lock needs few, so the mesh gets lighter
export function createLocks({ specs, head, coll, ell, skeleton, root, outward, stiff = 1, damping = 0.9, lite = false, floor = false, slack = 0.001, uvAt = null, rigid = 0, points = 0, bendPts = 0, oneShade = 0, hold = RIGID_HOLD, vdamp = rigid > 0 ? RIGID_VDAMP : VDAMP }) {   // uvAt(x, y, z) → [u, v]: a "hairUV" per vertex from where its lock's middle line rests (the angel ring, index.js)
  if (points >= 3 && points < (specs[0]?.pts.length ?? 0) && !specs.some((s) => s.keepPts)) specs = specs.map((s) => { if (!s.curv && s.nrm) { const Q = resample(s.pts.map((p, i) => [...p, ...s.nrm[i]]), points, bendPts); return { ...s, pts: Q.map((p) => p.slice(0, 3)), nrm: Q.map((p) => p.slice(3, 6)) }; } if (!s.curv) return { ...s, pts: resample(s.pts, points, bendPts) }; const Q = resample(s.pts.map((p, i) => [...p, s.curv[i], s.tk[i], ...(s.nrm?.[i] ?? [])]), points, bendPts); return { ...s, pts: Q.map((p) => p.slice(0, 3)), curv: Q.map((p) => p[3]), tk: Q.map((p) => p[4]), nrm: s.nrm && Q.map((p) => p.slice(5, 8)) }; });
  const RG = lite ? RING_LITE : RING, SB = lite ? 2 : SUB;   // lite: fewer vertices
  // tufts (tuftLocks: every spec of the part has cols): a ring is M points across the top and M - 2 back along the underside; column c of
  // ring r is at sv along the tuft (the columns end one by one: the points of its cut end)
  const TM = specs[0]?.cols ? specs[0].cols.u.length : 0, RN = TM ? 2 * TM - 2 : RG.length, colOf = (k) => k < TM ? k : 2 * TM - 2 - k;
  const N = specs[0]?.pts.length ?? 0, NL = specs.length, NP = NL * N, ringsPer = (N - 1) * SB + 1, VPL = ringsPer * RN, NV = NL * VPL;
  const svOf = (s, r, k) => { const t = r / (ringsPer - 1), e = s.cols.e[colOf(k)], T0 = s.cols.t0; return t <= T0 ? t : T0 + (t - T0) * (e - T0) / (1 - T0); };   // (the columns run together to t0, then each to its own end)
  const R = new Float32Array(NP * 3), X = new Float32Array(NP * 3), P = new Float32Array(NP * 3), T = new Float32Array(NP * 3), K = new Float32Array(NP), RAD = new Float32Array(NP), SEG = new Float32Array(NP);   // SEG[p]: the link from point p - 1 to p
  specs.forEach((s, l) => { s.pts.forEach((p, i) => { R.set(p, (l * N + i) * 3); const t = i / (N - 1); K[l * N + i] = (0.012 + 0.45 * (1 - t) ** 3) * stiff * (s.stiff ?? 1); RAD[l * N + i] = 0.5 * s.w * s.thick * (s.prof ?? width)(t) + 0.003;
    if (i) SEG[l * N + i] = Math.hypot(p[0] - s.pts[i - 1][0], p[1] - s.pts[i - 1][1], p[2] - s.pts[i - 1][2]); }); });
  X.set(R); P.set(R);
  // bundles (spec.group, cohere 0..1): the locks of a tied tail swing as one. Each point's move off its rest is drawn toward the bundle's mean
  // move there, and they share the flutter's phase (each lock alone fluttered and swung apart, the tips spreading)
  const GL = new Map(); specs.forEach((s, l) => { if (s.group != null && s.cohere > 0) { if (!GL.has(s.group)) GL.set(s.group, []); GL.get(s.group).push(l); } });
  const BUNDLES = [...GL.values()].filter((ls) => ls.length > 1).map((ls) => ({ ls, c: specs[ls[0]].cohere })), PH = specs.map((s, l) => s.group != null ? [...GL.keys()].indexOf(s.group) : l);
  let FN = null, FD = null;   // floor: per point, the plane's normal (rest space) and its offset
  if (floor) { FN = new Float32Array(NP * 3); FD = new Float32Array(NP); const I = new THREE.Matrix4();
    for (let i = 0; i < NP; i++) { const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2], o = outward(x, y, z, I), l = Math.hypot(...o) || 1;
      FN[i * 3] = o[0] / l; FN[i * 3 + 1] = o[1] / l; FN[i * 3 + 2] = o[2] / l; FD[i] = (o[0] * x + o[1] * y + o[2] * z) / l - slack; } }
  // the mesh
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), shn = new Float32Array(NV * 3), idx = [];
  for (let l = 0; l < NL; l++) for (let r = 0; r + 1 < ringsPer; r++) for (let k = 0; k < RN; k++) {
    const a = l * VPL + r * RN + k, b = l * VPL + r * RN + (k + 1) % RN, c = a + RN, d = b + RN, F = lite || TM ? null : specs[l].fork;
    if (F && r >= ringsPer - F.n && Math.abs(RG[k][0]) < 0.99 && Math.abs(RG[(k + 1) % RG.length][0]) < 0.99) idx.push(a, a, a, a, a, a);   // a fork's notch: no face between the teeth (kept as empty triangles: the count per lock stays)
    else idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("shadeN", new THREE.BufferAttribute(shn, 3));
  g.setIndex(idx);
  { const gt = new Float32Array(NV); for (let v = 0; v < NV; v++) { const s = specs[Math.floor(v / VPL)], r = Math.floor((v % VPL) / RN); gt[v] = (TM ? svOf(s, r, v % RN) : r / (ringsPer - 1)) * (s.grad ?? 1); } g.setAttribute("gradT", new THREE.BufferAttribute(gt, 1)); }   // along the lock: 0 at the root, 1 at the tip (a gradient, materials.js withGrad); a spec's grad 0 leaves it out
  if (uvAt) { const U = new Float32Array(NV * 2);   // per ring: the point along the rest chain at its share of the lock (the mesh isn't made yet: it comes with the first update)
    for (let l = 0; l < NL; l++) for (let r = 0; r < ringsPer; r++) for (let k = 0; k < RN; k++) { if (k && !TM) { const v = l * VPL + r * RN + k; U[v * 2] = U[v * 2 - 2]; U[v * 2 + 1] = U[v * 2 - 1]; continue; }
      const f = (TM ? svOf(specs[l], r, k) : r / (ringsPer - 1)) * (N - 1), i = Math.min(N - 2, Math.floor(f)), t = f - i, a = specs[l].pts[i], b = specs[l].pts[i + 1];
      const uv = uvAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t), v = l * VPL + r * RN + k; U[v * 2] = uv[0]; U[v * 2 + 1] = uv[1]; }
    g.setAttribute("hairUV", new THREE.BufferAttribute(U, 2)); }
  const si = new Uint16Array(NV * 4), sw = new Float32Array(NV * 4); for (let v = 0; v < NV; v++) { si[v * 4] = head; sw[v * 4] = 1; }
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  for (const a of ["position", "normal", "shadeN"]) g.attributes[a].setUsage(THREE.DynamicDrawUsage);

  const bones = skeleton.bones, M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), inv = new THREE.Matrix4(), tmp = new THREE.Matrix4(), BM = new Float32Array(bones.length * 16);
  const CN = coll.map((c) => ({ ...c, now: [0, 0, 0] })), v3 = new THREE.Vector3();
  // the chains move in world space, so the hair trails behind when the character itself moves (walks across the scene, turns, jumps)
  function matrices() {   // each bone's skinning matrix (world space) and the head's, and its inverse
    root.updateMatrixWorld(true);
    for (let k = 0; k < bones.length; k++) { tmp.multiplyMatrices(bones[k].matrixWorld, skeleton.boneInverses[k]); BM.set(tmp.elements, k * 16); }
    floorY = root.matrixWorld.elements[13];
    M.fromArray(BM, head * 16); Mi.copy(M).invert(); SC = Math.hypot(M.elements[0], M.elements[1], M.elements[2]) || 1;   // SC: the avatar's scale (its object scaled to the world): the chains are in world space, their lengths and radii in rest space
    { const e = M.elements, l = Math.hypot(e[4], e[5], e[6]) || 1; GR[0] = e[4] / l; GR[1] = e[5] / l - 1; GR[2] = e[6] / l; }   // gravity, less what the head carries (see step)
    for (const c of CN) { const e = c.bone * 16, [x, y, z] = c.c; c.now[0] = BM[e] * x + BM[e + 4] * y + BM[e + 8] * z + BM[e + 12]; c.now[1] = BM[e + 1] * x + BM[e + 5] * y + BM[e + 9] * z + BM[e + 13]; c.now[2] = BM[e + 2] * x + BM[e + 6] * y + BM[e + 10] * z + BM[e + 14]; }
    TP.set(T); const e = M.elements; for (let i = 0; i < NP; i++) { const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2]; T[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; T[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; T[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    CW[0] = e[0] * RC[0] + e[4] * RC[1] + e[8] * RC[2] + e[12]; CW[1] = e[1] * RC[0] + e[5] * RC[1] + e[9] * RC[2] + e[13]; CW[2] = e[2] * RC[0] + e[6] * RC[1] + e[10] * RC[2] + e[14];   // the head's middle (or the roots')
  }
  // the middle the locks spread out from (rest): the head's, or the roots' (a tail on the hips) / CW: it now (world) / VY: the roots' speed up (smoothed) / SPR: the spread now (-1 in .. 1 out)
  const RC = ell ? [...ell.c] : [0, 1, 2].map((q) => specs.reduce((s, sp) => s + sp.pts[0][q], 0) / Math.max(1, NL)), CW = [0, 0, 0]; const LEN = specs.map((s, l) => { let L = 0; for (let i = 1; i < N; i++) L += SEG[l * N + i]; return L; }); let VY = 0, SPR = 0;
  const pp = [0, 0, 0], GR = [0, 0, 0], AIR = [0, 0, 0], TP = new Float32Array(NP * 3); let floorY = 0, sub = 1, SC = 1;   // TP: the targets a frame ago / sub: steps this frame
  function collide(i) {   // point i (root space) out of the head (in its rest space) and the spheres
    const e = Mi.elements, j = i * 3, x = X[j], y = X[j + 1], z = X[j + 2], r = RAD[i];
    pp[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; pp[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pp[2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    const q0 = pp[0], q1 = pp[1], q2 = pp[2]; if (ell) pushOutEllipsoid(pp, ell.c, ell.r, r);
    if (FN) { const k = FN[j] * pp[0] + FN[j + 1] * pp[1] + FN[j + 2] * pp[2] - FD[i]; if (k < 0) { pp[0] -= FN[j] * k; pp[1] -= FN[j + 1] * k; pp[2] -= FN[j + 2] * k; } }
    if (pp[0] !== q0 || pp[1] !== q1 || pp[2] !== q2) { const f = M.elements; X[j] = f[0] * pp[0] + f[4] * pp[1] + f[8] * pp[2] + f[12]; X[j + 1] = f[1] * pp[0] + f[5] * pp[1] + f[9] * pp[2] + f[13]; X[j + 2] = f[2] * pp[0] + f[6] * pp[1] + f[10] * pp[2] + f[14]; }
    for (const c of CN) { pp[0] = X[j]; pp[1] = X[j + 1]; pp[2] = X[j + 2]; pushOutSphere(pp, c.now, (c.r + r) * SC); X[j] = pp[0]; X[j + 1] = pp[1]; X[j + 2] = pp[2]; }
    if (X[j + 1] < floorY + r * SC) X[j + 1] = floorY + r * SC;   // the floor (the avatar's feet)
  }
  const RIG = rigid > 0 ? specs.map((s) => Math.min(1, rigid * (s.rigid ?? 1))) : null, va = new THREE.Vector3(), vb = new THREE.Vector3(), qr = new THREE.Quaternion();
  // a rigid lock is held toward its rest along all its length (a rope only near the root); s.hold: this lock's share of the hold
  if (RIG) specs.forEach((s, l) => { for (let i = 2; i < N; i++) K[l * N + i] = Math.max(K[l * N + i], hold * (s.hold ?? 1) * RIG[l] * stiff * (s.stiff ?? 1)); });
  let KS = K, KN = null, kn = 1;   // KS: the pull toward the rest shape for this step: K, or what n steps of K add up to (a coarse step, KN)
  function step(h, keep, fk = 1) {   // one step of h seconds (fk: the share of the forces' h² that n small steps would have moved it, (n + 1) / 2n)
    // the rest shape already hangs (it was draped under gravity), and the pull toward it carries that shape with the head. So only the part of
    // gravity the head's turn has taken away acts here: world down less the rest's down turned with the head. Upright that is nothing (no sag
    // off the rest shape: before, the locks sank a few cm and left the head); a head bent forward or lying down lets the hair fall
    const g = 9.8 * h * h * fk, gx = GR[0] * g, gy = GR[1] * g, gz = GR[2] * g;
    for (let l = 0; l < NL; l++) for (let i = 0; i < N; i++) { const p = l * N + i, j = p * 3;
      if (i < 2) { for (let q = 0; q < 3; q++) { P[j + q] = X[j + q]; X[j + q] = T[j + q]; } continue; }   // the root and the next point ride on the head
      for (let q = 0; q < 3; q++) { const raw = X[j + q] - P[j + q], tv = (T[j + q] - TP[j + q]) / sub; let v = raw * keep;
        if (keep) v = q === 1 ? tv + (v - tv) * vdamp : tv + (raw - tv) * keep;   // its swing is kept against the head's motion, not the world's: moving fast, the world's drag
        P[j + q] = X[j + q]; X[j + q] += v; }                                     // had laid it out flat behind like a stick (the tennis player's 7 m/s, 2026-10-05); the wind (AIR) streams it now   // up and down it mostly goes with the head (it bobbed like jelly on a run's steps)
      const ph = PH[l], fl = 1 + 0.35 * Math.sin(clock * 7 + ph * 1.9 + i * 0.8), up = 0.22 * Math.sin(clock * 5.3 + ph * 2.3 + i * 1.1) * airN;   // a flutter along the stream, and a little up and down: waves, not a straight line
      X[j] += gx + AIR[0] * fl * h * h * fk; X[j + 1] += gy + (AIR[1] * fl + up) * h * h * fk; X[j + 2] += gz + AIR[2] * fl * h * h * fk;   // the wind (air drag pulling it along)
      if (SPR) { const t = i / (N - 1), dx = T[j] - CW[0], dz = T[j + 2] - CW[2], dl = Math.hypot(dx, dz) || 1, o = (SPR > 0 ? SPR * SPREAD_OUT * t ** 1.5 : SPR * SPREAD_IN * t) * LEN[l] * SC * (floor ? 0.3 : 1), k = Math.min(1, KS[p] + Math.abs(SPR) * SPREAD_K);   // its rest place out or in (not up: what was lifted fell back onto the lock on landing and crumpled it), followed more firmly
        X[j] += (T[j] + dx / dl * o - X[j]) * k; X[j + 1] += (T[j + 1] - X[j + 1]) * k; X[j + 2] += (T[j + 2] + dz / dl * o - X[j + 2]) * k; }
      else for (let q = 0; q < 3; q++) X[j + q] += (T[j + q] - X[j + q]) * KS[p]; }
    if (RIG) for (let l = 0; l < NL; l++) { const rg = RIG[l]; if (!rg) continue; const b1 = (l * N + 1) * 3; let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
      for (let i = 2; i < N; i++) { const j = (l * N + i) * 3; ax += T[j] - T[b1]; ay += T[j + 1] - T[b1 + 1]; az += T[j + 2] - T[b1 + 2]; bx += X[j] - X[b1]; by += X[j + 1] - X[b1 + 1]; bz += X[j + 2] - X[b1 + 2]; }
      va.set(ax, ay, az).normalize(); vb.set(bx, by, bz).normalize(); qr.setFromUnitVectors(va, vb);   // how far the lock leans off its rest, as one turn
      for (let i = 2; i < N; i++) { const j = (l * N + i) * 3; va.set(T[j] - T[b1], T[j + 1] - T[b1 + 1], T[j + 2] - T[b1 + 2]).applyQuaternion(qr);
        X[j] += (X[b1] + va.x - X[j]) * rg; X[j + 1] += (X[b1 + 1] + va.y - X[j + 1]) * rg; X[j + 2] += (X[b1 + 2] + va.z - X[j + 2]) * rg; } }
    for (const { ls, c } of BUNDLES) for (let i = 2; i < N; i++) { const m = [0, 0, 0];
      for (const l of ls) { const j = (l * N + i) * 3; for (let q = 0; q < 3; q++) m[q] += (X[j + q] - T[j + q]) / ls.length; }
      for (const l of ls) { const j = (l * N + i) * 3; for (let q = 0; q < 3; q++) X[j + q] += (T[j + q] + m[q] - X[j + q]) * c; } }
    for (let it = 0; it < 4; it++) for (let l = 0; l < NL; l++) {
      for (let i = 2; i < N; i++) { const a = (l * N + i - 1) * 3, b = a + 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = (d - SEG[l * N + i] * SC) / d;
        if (i === 2) { X[b] -= dx * f; X[b + 1] -= dy * f; X[b + 2] -= dz * f; }   // the one before rides on the head: only this one moves
        else { X[a] += dx * f * 0.5; X[a + 1] += dy * f * 0.5; X[a + 2] += dz * f * 0.5; X[b] -= dx * f * 0.5; X[b + 1] -= dy * f * 0.5; X[b + 2] -= dz * f * 0.5; } }
      for (let i = 2; i < N; i++) collide(l * N + i);
    }
    // then each link exactly its length, from the root out (follow the leader): four rounds left a long chain a few % longer when the head
    // went up or down fast, and the hair stretched and sprang back on a jump (2026-10-07, Saori: "ジャンプなどで上下に動いた時の髪がバネのように
    // 伸び縮みする"). The move goes into the point's last position too, so it adds no speed of its own (no jitter, no extra swing)
    for (let l = 0; l < NL; l++) for (let i = 2; i < N; i++) { const a = (l * N + i - 1) * 3, b = a + 3, dx = X[b] - X[a], dy = X[b + 1] - X[a + 1], dz = X[b + 2] - X[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, f = 1 - SEG[l * N + i] * SC / d;
      const cx = -dx * f, cy = -dy * f, cz = -dz * f; X[b] += cx; X[b + 1] += cy; X[b + 2] += cz; P[b] += cx; P[b + 1] += cy; P[b + 2] += cz; }
  }
  // the mesh from the chain: rings along a Catmull-Rom curve through the points, each a flat lens across the lock, facing out
  const C = new Float32Array(ringsPer * 3), Dd = new Float32Array(ringsPer * 3);
  const FR = TM ? new Float32Array(ringsPer * 12) : null, WP = TM ? new Float32Array(VPL * 3) : null;   // a tuft's rings (the middle's point, out, across, the head's out) / its vertices (world)
  function mesh() {
    const e = Mi.elements;
    const toRest = (out, o, x, y, z, dir) => { if (dir) { out[o] = e[0] * x + e[4] * y + e[8] * z; out[o + 1] = e[1] * x + e[5] * y + e[9] * z; out[o + 2] = e[2] * x + e[6] * y + e[10] * z; }
      else { out[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } };
    for (let l = 0; l < NL; l++) { const s = specs[l], b0 = l * N * 3; let px = 0, py = 0, pz = 0;   // p: the last ring's "out"
      const at = (i) => Math.min(N - 1, Math.max(0, i)) * 3 + b0;
      for (let i = 0; i + 1 < N; i++) for (let k = 0; k < SB; k++) { const t = k / SB, r = i * SB + k, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), t2 = t * t, t3 = t2 * t;
        for (let q = 0; q < 3; q++) { const a = X[p0 + q], b = X[p1 + q], c = X[p2 + q], d = X[p3 + q];
          C[r * 3 + q] = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
          Dd[r * 3 + q] = 0.5 * ((c - a) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t2); } }
      { const r = ringsPer - 1, a = at(N - 2), b = at(N - 1); for (let q = 0; q < 3; q++) { C[r * 3 + q] = X[b + q]; Dd[r * 3 + q] = X[b + q] - X[a + q]; } }
      for (let r = 0; r < ringsPer; r++) { const t = r / (ringsPer - 1), cx = C[r * 3], cy = C[r * 3 + 1], cz = C[r * 3 + 2];
        let dx = Dd[r * 3], dy = Dd[r * 3 + 1], dz = Dd[r * 3 + 2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
        let [ox, oy, oz] = outward(cx, cy, cz, M); const rl = Math.hypot(ox, oy, oz) || 1, rx = ox / rl, ry = oy / rl, rz = oz / rl;   // the hair's "out" as it is: the shading's, at oneShade
        if (s.front) { const fw = s.front * sstep(s.frontFrom - 0.08, s.frontFrom + 0.12, t), ol0 = Math.hypot(ox, oy, oz) || 1, me = M.elements; ox = ox / ol0 + me[8] * fw; oy = oy / ol0 + me[9] * fw; oz = oz / ol0 + me[10] * fw; }   // front: the flat side turned toward the head's front (a hanging bang tuft)
        const o0 = Math.hypot(ox, oy, oz) || 1; let ol;
        if (s.nrm) { const f = Math.min(N - 1.000001, r / SB), i = Math.floor(f), a = s.nrm[i], b = s.nrm[i + 1], nx = a[0] + (b[0] - a[0]) * (f - i), ny = a[1] + (b[1] - a[1]) * (f - i), nz = a[2] + (b[2] - a[2]) * (f - i), me = M.elements;   // a spike: its own out, with the head (it turns off the head, and the head's out runs along it there: no "across" to take from it)
          ox = me[0] * nx + me[4] * ny + me[8] * nz; oy = me[1] * nx + me[5] * ny + me[9] * nz; oz = me[2] * nx + me[6] * ny + me[10] * nz; }
        else { const od = ox * dx + oy * dy + oz * dz; ox -= dx * od; oy -= dy * od; oz -= dz * od; }   // out: across the lock's direction
        ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
        // where the lock runs (almost) along "out" (a wing or a flick standing out from the head), "out" across it is undefined and the lock
        // twisted there: the last ring's carried over instead (turned square to this ring's direction)
        if (!s.nrm && r > 0 && ol / o0 < 0.6) { const pd = px * dx + py * dy + pz * dz, qx = px - dx * pd, qy = py - dy * pd, qz = pz - dz * pd, ql = Math.hypot(qx, qy, qz);
          if (ql > 1e-6) { const w = sstep(0.25, 0.6, ol / o0); ox = ox * w + qx / ql * (1 - w); oy = oy * w + qy / ql * (1 - w); oz = oz * w + qz / ql * (1 - w); ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol; } }
        px = ox; py = oy; pz = oz;
        let ax = dy * oz - dz * oy, ay = dz * ox - dx * oz, az = dx * oy - dy * ox; if (s.nrm) { const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al; }   // across
        if (TM) { const F = r * 12; FR[F] = cx; FR[F + 1] = cy; FR[F + 2] = cz; FR[F + 3] = ox; FR[F + 4] = oy; FR[F + 5] = oz; FR[F + 6] = ax; FR[F + 7] = ay; FR[F + 8] = az; FR[F + 9] = rx; FR[F + 10] = ry; FR[F + 11] = rz; continue; }
        const hw = 0.5 * s.w * (s.prof ?? width)(t), ht = Math.max(0.0012, hw * s.thick * (s.rise ? sstep(0, 0.2, t) : 1) * (s.blunt ? 1 - 0.9 * sstep(1 - s.blunt, 1, t) : 1)), cu = s.curl * t * t + (s.lean ? s.lean * Math.max(0, 0.5 * s.w - hw) : 0);   // half width / half thickness; curl: the tip bends a little sideways; lean: where the lock narrows it goes to one edge, which stays straight to the point; blunt (a share of the length): as wide to the end and thinning there into a straight edge (a cut fringe, the hime's)
        // fork (spec.fork { n: rings, short: rings the shorter tooth ends early, side: which }): the tip split in two points. Over the last n rings
        // the face's middle closes to a notch one ring in, then its two sides run apart, each to its edge's point: two flat teeth (the faces
        // between them are emptied where the triangles are listed). Their normals lie across, so the outline goes round each tooth. Not at lite (no points to spare)
        const FK = lite ? null : s.fork, fr = FK ? r - (ringsPer - 1 - FK.n) : 0, fhw = FK && fr > 0 ? 0.5 * s.w * (s.prof ?? width)((ringsPer - 1 - FK.n) / (ringsPer - 1)) : 0;
        for (let k = 0; k < RG.length; k++) { const [u0, w0] = RG[k], v = (l * VPL + r * RG.length + k) * 3, bulge = w0 > 0 ? 1 : 0.6;   // the outer face rounder than the inner
          let u = u0, w = w0, hwk = hw, fn = 0;   // fn: a tooth's point, its normal across (toward the notch or outward)
          if (fr > 0) { const mid = Math.abs(u0) < 0.99;
            const end = FK.n - (u0 * FK.side > 0 ? FK.short : 0);
            if (fr > end) { const o = v - RG.length * 3; for (let q = 0; q < 3; q++) { pos[v + q] = pos[o + q]; nor[v + q] = nor[o + q]; shn[v + q] = shn[o + q]; } continue; }
            hwk = fhw; const sg = Math.sign(u0), f = Math.max(0, (fr - 1) / Math.max(1, end - 1)); w = 0; u = mid ? sg * 0.6 * f : sg * (1 - 0.4 * f); fn = mid ? -sg : sg; }
          const tl = w * ht * bulge + (s.tilt ? s.tilt * u * hwk : 0);   // tilt: across the lock, one edge up and the other down (bangLocks' shingle)
          const x = cx + ax * (u * hwk + cu) + ox * tl, y = cy + ay * (u * hwk + cu) + oy * tl, z = cz + az * (u * hwk + cu) + oz * tl;
          toRest(pos, v, x, y, z, false);
          let nx = ax * u / Math.max(hw, 1e-4) * ht + ox * w, ny = ay * u / Math.max(hw, 1e-4) * ht + oy * w, nz = az * u / Math.max(hw, 1e-4) * ht + oz * w;
          if (fn) { nx = ax * fn + ox * w0 * 0.6; ny = ay * fn + oy * w0 * 0.6; nz = az * fn + oz * w0 * 0.6; } const nl = Math.hypot(nx, ny, nz) || 1;   // the lens's normal (an ellipse's)
          toRest(nor, v, nx / nl, ny / nl, nz / nl, true);
          const io = s.layer ? 0.1 + 0.5 * oneShade : 0.6, own = OWN * (1 - 0.75 * oneShade), qx = ox + (rx - ox) * oneShade, qy = oy + (ry - oy) * oneShade, qz = oz + (rz - oz) * oneShade;
          const sx = qx * io + nx / nl * own, sy = qy * io + ny / nl * own, sz = qz * io + nz / nl * own, sl = Math.hypot(sx, sy, sz) || 1;   // shading: mostly the hair's "out" (the whole hair shades as one volume); the inner layer turned away, so it shows in shadow between the outer locks.
          // oneShade 1: the "out" of the head, not the one squared to each lock's run, and little of the lock's own round: one shadow with a smooth edge (each lock split light and dark at its own height: a stepped, patchy shadow)
          toRest(shn, v, sx / sl, sy / sl, sz / sl, true); } }
      if (!TM) continue;
      // a tuft: each column at its own place along it (sv), between the rings there. The edges go down round the head (curv), the top is a
      // dome and the underside a shallower one; normals from the mesh itself
      const cu = s.cols.u, dm = s.cols.d, cv = s.curv, R1 = ringsPer - 1, own = OWN * (1 - 0.75 * oneShade);
      for (let r = 0; r < ringsPer; r++) { const tt = s.nrm ? 1 : tuftThick(r / R1, s.point);   // (a spike: as thick as its points say, from its base to its ridge)
        for (let k = 0; k < RN; k++) { const c = colOf(k), sv = svOf(s, r, k), f = sv * R1, i0 = Math.min(R1 - 1, Math.floor(f)), fr = f - i0, A = i0 * 12, B = A + 12, gq = sv * (N - 1), j0 = Math.min(N - 2, Math.floor(gq));
          const x = cu[c] * 0.5 * s.w * s.prof(sv), th = (s.tk[j0] + (s.tk[j0 + 1] - s.tk[j0]) * (gq - j0)) * tt, h = (k < TM ? th : -s.under * th) * dm[c], kap = cv[j0] + (cv[j0 + 1] - cv[j0]) * (gq - j0), ph = Math.max(-1.5, Math.min(1.5, kap * x)), w = (r * RN + k) * 3;
          const sn = Math.sin(ph), cs = Math.cos(ph), xa = (kap > 1e-3 ? sn / kap : x) + h * sn, xo = h * cs - (kap > 1e-3 ? (1 - cs) / kap : 0);   // round a cylinder of that curvature: x along its arc, h out from it
          for (let q = 0; q < 3; q++) WP[w + q] = FR[A + q] + (FR[B + q] - FR[A + q]) * fr + (FR[A + 6 + q] + (FR[B + 6 + q] - FR[A + 6 + q]) * fr) * xa + (FR[A + 3 + q] + (FR[B + 3 + q] - FR[A + 3 + q]) * fr) * xo; } }
      for (let r = 0; r < ringsPer; r++) for (let k = 0; k < RN; k++) { const w = (r * RN + k) * 3, v = (l * VPL + r * RN + k) * 3, kp = (r * RN + (k + 1) % RN) * 3, km = (r * RN + (k + RN - 1) % RN) * 3, rp = (Math.min(R1, r + 1) * RN + k) * 3, rm = (Math.max(0, r - 1) * RN + k) * 3, F = r * 12, top = k < TM;
        const ux = WP[kp] - WP[km], uy = WP[kp + 1] - WP[km + 1], uz = WP[kp + 2] - WP[km + 2], vx = WP[rp] - WP[rm], vy = WP[rp + 1] - WP[rm + 1], vz = WP[rp + 2] - WP[rm + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) { const sg = top ? 1 : -1; nx = FR[F + 3] * sg; ny = FR[F + 4] * sg; nz = FR[F + 5] * sg; nl = 1; } nx /= nl; ny /= nl; nz /= nl;
        // ⛔ the cut end's own row alone points out along the tuft (the outline's shell then ends beyond the points). Leaning the rows before
        // it that way too put the shell in the tuft's own faces there: dark streaks fanning out of every point
        const vl = r === R1 && !s.nrm ? Math.hypot(vx, vy, vz) : 0;   // (not a spike's: it may point at the eye, and the shell's end beyond its point was a black dot on it)
        toRest(pos, v, WP[w], WP[w + 1], WP[w + 2], false); if (vl > 1e-9) toRest(nor, v, vx / vl, vy / vl, vz / vl, true); else toRest(nor, v, nx, ny, nz, true);
        // shading: the top as the other locks' (the hair's out and a share of its own round); the underside by its own normal (it faces away from the light)
        let sx = nx, sy = ny, sz = nz; if (top) { const o = s.nrm ? 1 : oneShade, w = s.nrm ? own * 0.4 : own; sx = (FR[F + 3] + (FR[F + 9] - FR[F + 3]) * o) * 0.6 + nx * w; sy = (FR[F + 4] + (FR[F + 10] - FR[F + 4]) * o) * 0.6 + ny * w; sz = (FR[F + 5] + (FR[F + 11] - FR[F + 5]) * o) * 0.6 + nz * w; }   // (a spike: the head's out, as the tuft it grows out of: it is that tuft's hair, not a thing set on it)
        let sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
        if (s.shade) { sx *= 1 - s.shade; sy = sy * (1 - s.shade) - s.shade; sz *= 1 - s.shade; sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl; }   // shade: turned down, away from the light (a tuft under the others, in their shadow)
        toRest(shn, v, sx, sy, sz, true); } }
    for (const a of ["position", "normal", "shadeN"]) g.attributes[a].needsUpdate = true;
    g.computeBoundingSphere();
  }
  let first = true, acc = 0, clock = 0, airN = 0;
  const H = 1 / 60;
  return {
    geometry: g,
    /** Each frame after the pose is set. instant: settle at once (no swing carried over). */
    update(dt, instant = false, wind = null, coarse = false) {   // coarse: one step for all the time since the last (a far or small character: see the avatar's update)
      matrices();
      for (let q = 0; q < 3; q++) AIR[q] = (wind?.[q] ?? 0) * DRAG; airN = Math.hypot(AIR[0], AIR[1], AIR[2]); clock += dt;
      let jump = 0; for (let i = 0; i < NP * 3; i += 3 * N) jump = Math.max(jump, Math.abs(T[i] - X[i]) + Math.abs(T[i + 1] - X[i + 1]) + Math.abs(T[i + 2] - X[i + 2]));   // the roots against where they were
      { let dy = 0; for (let i = 0; i < NP * 3; i += 3 * N) dy += T[i + 1] - TP[i + 1]; const vy = first || instant || jump > 0.5 || !(dt > 0) ? 0 : dy / NL / dt;
        VY += (vy - VY) * (1 - Math.exp(-dt * 12)); { const want = Math.max(-1, Math.min(1, -Math.sign(VY) * Math.max(0, Math.abs(VY) - SPREAD_V0) / SPREAD_V)); SPR += (want - SPR) * (1 - Math.exp(-dt * (Math.abs(want) > Math.abs(SPR) ? 12 : SPREAD_BACK))); } if (Math.abs(SPR) < 0.02) SPR = 0; }   // (smoothed: frame times vary)
      if (first || instant || jump > 0.5) { X.set(T); P.set(T); for (let s = 0; s < (first ? 40 : 20); s++) step(H, 0); first = false; acc = 0; }   // settle (also when the avatar was moved far at once: no whip across the scene)
      else if (coarse) { acc = Math.min(acc + dt, 4 * H); const n = Math.floor(acc / H); if (n) { sub = 1; if (n !== kn) { kn = n; KN = K.map((k) => 1 - (1 - k) ** n); } KS = n > 1 ? KN : K; step(n * H, damping ** n, (n + 1) / (2 * n)); KS = K; acc -= n * H; } }
      else { acc = Math.min(acc + dt, 4 * H); sub = Math.max(1, Math.floor(acc / H)); while (acc >= H) { step(H, damping); acc -= H; } }
      mesh();
    },
    /** the locks' rest shapes (root space): [{ pts, w, … }] in build order (an editor's handles) */
    specs,
    /** The locks as they hang in the rest pose (glTF export). The next update moves them again. */
    rest() { M.identity(); Mi.identity(); X.set(R); mesh(); first = true; },
  };
}
