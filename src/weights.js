// Skin weights from the body parts. No three.js here: the build workers (worker.js) import this too.
import { dPrim } from "./sdf/prim.js";

/**
 * Skin weights: each point follows the bone of the nearest body part; nearby parts share smoothly.
 * Returns weightsAt(x, y, z, out, only) — out: { idx[4], w[4] }, only: a RegExp of bones allowed (e.g. pants never follow the arms).
 */
export function makeWeights({ BODY, BONES, BI }) {
  const SIG = 0.013;
  const WL = new Map(), WACC = new Float32Array(64), WD = new Float64Array(512), WF = new Float64Array(512);
  function weightsAt(x, y, z, out, only) {   // only: この骨だけに付ける(ズボンが腕に引っぱられないように)
    const key = only ? only.source : "";
    let L = WL.get(key); if (!L) { L = only ? BODY.filter((p) => only.test(p.bone)) : BODY; WL.set(key, L); }
    // まず外接球で大まかな距離を出し、いちばん近そうな部品で上限を決める。上限より十分遠い部品は測らない(結果は同じ)
    let best = 0; for (let n = 0; n < L.length; n++) { const p = L[n]; WF[n] = Math.hypot(x - p.bx0, y - p.by0, z - p.bz0) - p.br; if (WF[n] < WF[best]) best = n; }
    const ub = dPrim(L[best], x, y, z), cut = ub + 12 * SIG; let dmin = ub;
    for (let n = 0; n < L.length; n++) { if (n === best) { WD[n] = ub; continue; } if (WF[n] >= cut) { WD[n] = Infinity; continue; } const d = dPrim(L[n], x, y, z); WD[n] = d; if (d < dmin) dmin = d; }
    const acc = WACC; acc.fill(0, 0, BONES.length);
    for (let n = 0; n < L.length; n++) { const e = (WD[n] - dmin) / SIG; if (e < 12) acc[BI[L[n].bone]] += Math.exp(-e); }
    let sum = 0; for (let k = 0; k < 4; k++) { let bi = 0, bv = -1; for (let b = 0; b < BONES.length; b++) if (acc[b] > bv) { bv = acc[b]; bi = b; } out.idx[k] = bi; out.w[k] = bv; sum += bv; acc[bi] = -1; }   // 重い順に4本
    for (let k = 0; k < 4; k++) out.w[k] /= sum;
  }
  return weightsAt;
}
