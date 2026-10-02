// Skin weights from the body parts. No three.js here: the build workers (worker.js) import this too.
import { dPrim, sstep } from "./sdf/prim.js";

/**
 * Skin weights: each point follows the bone of the nearest body part; nearby parts share smoothly.
 * Returns weightsAt(x, y, z, out, only) — out: { idx[4], w[4] }, only: a RegExp of bones allowed (e.g. pants never follow the arms).
 * J (joint positions, optional): around the shoulder joint the parts share over a wider band, and the part of the shoulder next to
 * the neck stays with the chest (arm weight rises along the arm). Before, the whole shoulder up to the neck followed the arm, so raising
 * the arm (T-pose) made a corner by the neck and a wavy shoulder line. Kept mild so arms-down poses look as before.
 */
export function makeWeights({ BODY, BONES, BI, J }) {
  const SH = J ? ["L", "R"].map((s) => { const a = J[`upperArm.${s}`], b = J[`lowerArm.${s}`], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    return { bone: `upperArm.${s}`, ia: BI[`upperArm.${s}`], a, u: [ux, uy] }; }) : [];   // u: along the arm (rest pose)
  const IU = BI.upperChest, IC = BI.chest;
  const SIG = 0.013;
  const WL = new Map(), WACC = new Float32Array(64), WD = new Float64Array(512), WF = new Float64Array(512);
  function weightsAt(x, y, z, out, only) {   // only: この骨だけに付ける(ズボンが腕に引っぱられないように)
    const key = only ? only.source : "";
    let L = WL.get(key); if (!L) { L = only ? BODY.filter((p) => only.test(p.bone)) : BODY; WL.set(key, L); }
    // まず外接球で大まかな距離を出し、いちばん近そうな部品で上限を決める。上限より十分遠い部品は測らない(結果は同じ)
    let best = 0; for (let n = 0; n < L.length; n++) { const p = L[n]; WF[n] = Math.hypot(x - p.bx0, y - p.by0, z - p.bz0) - p.br; if (WF[n] < WF[best]) best = n; }
    let sg = SIG;   // around the shoulder joint the parts share over a wider band (the arm/chest seam bends smoothly instead of creasing)
    for (const S of SH) { if (only && !only.test(S.bone)) continue; const dx = x - S.a[0], dy = y - S.a[1], dz = z - S.a[2];
      sg = Math.max(sg, SIG + (0.025 - SIG) * (1 - sstep(0.08, 0.13, Math.hypot(dx, dy, dz)))); }
    const ub = dPrim(L[best], x, y, z), cut = ub + 12 * sg; let dmin = ub;
    for (let n = 0; n < L.length; n++) { if (n === best) { WD[n] = ub; continue; } if (WF[n] >= cut) { WD[n] = Infinity; continue; } const d = dPrim(L[n], x, y, z); WD[n] = d; if (d < dmin) dmin = d; }
    const acc = WACC; acc.fill(0, 0, BONES.length);
    for (let n = 0; n < L.length; n++) { const e = (WD[n] - dmin) / sg; if (e < 12) acc[BI[L[n].bone]] += Math.exp(-e); }
    for (const S of SH) {   // next to the neck: arm weight rises along the arm (from the chest's side of the joint) instead of reaching the neck (only ever lowered: the chest below the armpit stays the chest's)
      if (only && !only.test(S.bone)) continue;
      const dx = x - S.a[0], dy = y - S.a[1], dz = z - S.a[2], zone = 1 - sstep(0.1, 0.16, Math.hypot(dx, dy, dz)); if (zone <= 0) continue;
      const pool = acc[S.ia] + acc[IU] + acc[IC]; if (pool <= 0) continue;
      const arm = acc[S.ia] + zone * (Math.min(acc[S.ia], pool * sstep(-0.09, 0.02, dx * S.u[0] + dy * S.u[1])) - acc[S.ia]), rest = pool - arm, tor = acc[IU] + acc[IC];
      if (tor > 0) { acc[IU] = rest * acc[IU] / tor; acc[IC] = rest * acc[IC] / tor; } else acc[IU] = rest;
      acc[S.ia] = arm;
    }
    let sum = 0; for (let k = 0; k < 4; k++) { let bi = 0, bv = -1; for (let b = 0; b < BONES.length; b++) if (acc[b] > bv) { bv = acc[b]; bi = b; } out.idx[k] = bi; out.w[k] = bv; sum += bv; acc[bi] = -1; }   // 重い順に4本
    for (let k = 0; k < 4; k++) out.w[k] /= sum;
  }
  return weightsAt;
}
