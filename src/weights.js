// Skin weights from the body parts. No three.js here: the build workers (worker.js) import this too.
import { dPrim, sstep } from "./sdf/prim.js";

/**
 * Skin weights: each point follows the bone of the nearest body part; nearby parts share smoothly.
 * Returns weightsAt(x, y, z, out, only) — out: { idx[4], w[4] }, only: a RegExp of bones allowed (e.g. pants never follow the arms).
 * J (joint positions, optional): around the shoulder joint the parts share over a wider band, and the part of the shoulder next to
 * the neck stays with the chest (arm weight rises along the arm). Before, the whole shoulder up to the neck followed the arm, so raising
 * the arm (T-pose) made a corner by the neck and a wavy shoulder line. Kept mild so arms-down poses look as before.
 * Shoulder bones (clavicles, J["shoulder.L"] → J["upperArm.L"]): of the torso's share on top of the shoulder, the part along the clavicle
 * goes to the shoulder bone, more toward the arm. Lifting or rolling the shoulder then carries the top of the shoulder with the arm's root.
 * Bottom (J["upperLeg.L"]): behind the hip joint and above the fold under the bottom, the thigh's share goes to the hips. Before, the lower
 * half of the bottom followed the thigh, so sitting (thigh forward ~90°) pulled it forward and the back of the bottom became a slanted flat cut.
 * Torso side under the arm: below the armpit, a point nearer the torso than the arm keeps (almost) no arm weight. The chibi arm hangs only
 * 2-4 cm from the side, closer than the sharing band, so the side of the chest followed the arm (up to ~50%, even the forearm) and raising
 * the arms (T-pose) flared it out like gills into a drum-shaped body. The same the other way: a point on the arm (its inner side, facing the
 * waist) keeps no torso weight, else it stayed at the waist when the arm went up and stretched into a web from the waist to the arm.
 */
export function makeWeights({ BODY, BONES, BI, J }) {
  const SH = J ? ["L", "R"].map((s) => { const a = J[`upperArm.${s}`], b = J[`lowerArm.${s}`], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const c = J[`shoulder.${s}`] ?? null, v = c ? [a[0] - c[0], a[1] - c[1], a[2] - c[2]] : null;
    return { bone: `upperArm.${s}`, ia: BI[`upperArm.${s}`], a, u: [ux, uy], is: c ? BI[`shoulder.${s}`] : -1, c, v, v2: v ? v[0] * v[0] + v[1] * v[1] + v[2] * v[2] : 1 }; }) : [];   // u: along the arm (rest pose) / c→a: the clavicle
  const IU = BI.upperChest, IC = BI.chest, IH = BI.hips;
  const TORSO = new Set(["hips", "spine", "chest", "upperChest"].map((b) => BI[b]));
  const ARM = J ? ["L", "R"].map((s) => { const a = J[`upperArm.${s}`], b = J[`lowerArm.${s}`], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), u = [0, 1, 2].map((i) => (b[i] - a[i]) / L);
    const ra = BODY.find((p) => p.bone === `upperArm.${s}` && p.t === 1)?.ra ?? 0.047;   // the upper arm's radius (the capsule)
    return { m: s === "L" ? 1 : -1, y: a[1], a, u, L, near: ra + 0.012, bones: [`upperArm.${s}`, `lowerArm.${s}`, `hand.${s}`].map((bn) => BI[bn]) }; }) : [];
  const HP = J ? ["L", "R"].map((s) => ({ bone: `upperLeg.${s}`, ia: BI[`upperLeg.${s}`], a: J[`upperLeg.${s}`] })) : [];   // hip joints
  const SIG = 0.013;
  const WL = new Map(), WACC = new Float32Array(64), WD = new Float64Array(512), WF = new Float64Array(512);
  function weightsAt(x, y, z, out, only) {   // only: この骨だけに付ける(ズボンが腕に引っぱられないように)
    // under the ankles only the point's own side: on feet set close (the adult type's, 3 cm apart) a foot's toes took weight from the other
    // foot and stretched back toward it walking (2026-10-10, Saori: "つまさきがはみでてる…後ろ足のくつがのびます")
    const side = y < 0.07 ? (x >= 0 ? ".L" : ".R") : "", key = (only ? only.source : "") + side;
    let L = WL.get(key); if (!L) { L = BODY.filter((p) => (!only || only.test(p.bone)) && (!side || !/\.[LR]$/.test(p.bone) || p.bone.endsWith(side))); WL.set(key, L); }
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
      const arm = acc[S.ia] + zone * (Math.min(acc[S.ia], pool * sstep(-0.09, 0.02, dx * S.u[0] + dy * S.u[1])) - acc[S.ia]), tor = acc[IU] + acc[IC];
      let rest = pool - arm;
      if (S.is >= 0) {   // along the clavicle (t: 0 by the neck → 1 at the arm joint), near its line: the shoulder bone takes that part of the torso's share
        const cx = x - S.c[0], cy = y - S.c[1], cz = z - S.c[2], t = Math.min(1, Math.max(0, (cx * S.v[0] + cy * S.v[1] + cz * S.v[2]) / S.v2));
        const d = Math.hypot(cx - S.v[0] * t, cy - S.v[1] * t, cz - S.v[2] * t), f = sstep(0.1, 0.8, t) * (1 - sstep(0.05, 0.1, d));
        acc[S.is] += rest * f; rest *= 1 - f;
      }
      if (tor > 0) { acc[IU] = rest * acc[IU] / tor; acc[IC] = rest * acc[IC] / tor; } else acc[IU] = rest;
      acc[S.ia] = arm;
    }
    for (const S of HP) {   // the bottom stays with the hips: behind the hip joint (dz) and above the fold under it (dy)
      if (only && !only.test(S.bone)) continue;
      const dx = x - S.a[0], dy = y - S.a[1], dz = z - S.a[2]; if (dx * dx + dy * dy + dz * dz > 0.04 || acc[S.ia] <= 0) continue;
      const f = sstep(-0.01, -0.05, dz) * sstep(-0.075, -0.02, dy); if (f <= 0) continue;
      const m = acc[S.ia] * f; acc[S.ia] -= m; acc[IH] += m;
    }
    if (ARM.length) {   // torso side under the arm: nearer the torso than the arm → the arm's share fades out (sharply, over ~1 cm)
      let dT = Infinity, dA = Infinity; const A = ARM[x >= 0 ? 0 : 1];
      for (let n = 0; n < L.length; n++) { const bi = BI[L[n].bone]; if (TORSO.has(bi)) dT = Math.min(dT, WD[n]); else if (A.bones.includes(bi)) dA = Math.min(dA, WD[n]); }
      // within ~1 cm of the upper arm's surface it stays the arm's (the thin flesh just under the arm, above the armpit hollow, else it stayed behind as a fin)
      const qx = x - A.a[0], qy = y - A.a[1], qz = z - A.a[2], tt = Math.min(A.L, Math.max(0, qx * A.u[0] + qy * A.u[1] + qz * A.u[2])), perp = Math.hypot(qx - A.u[0] * tt, qy - A.u[1] * tt, qz - A.u[2] * tt);
      const low = sstep(A.y - 0.04, A.y - 0.09, y), r = low * sstep(0, 0.012, dA - dT) * sstep(A.near, A.near + 0.008, perp), ra = low * sstep(0, 0.012, dT - dA);
      if (r > 0) { let moved = 0; for (const b of A.bones) { moved += acc[b] * r; acc[b] *= 1 - r; }
        let tb = IC, tv = -1; for (const b of TORSO) if (acc[b] > tv) { tv = acc[b]; tb = b; } acc[tb] += moved; }
      if (ra > 0) { let moved = 0; for (const b of TORSO) { moved += acc[b] * ra; acc[b] *= 1 - ra; }   // on the arm: the torso's share goes to the arm
        let ab = A.bones[0], av = -1; for (const b of A.bones) if (acc[b] > av) { av = acc[b]; ab = b; } acc[ab] += moved; }
    }
    let sum = 0; for (let k = 0; k < 4; k++) { let bi = 0, bv = -1; for (let b = 0; b < BONES.length; b++) if (acc[b] > bv) { bv = acc[b]; bi = b; } out.idx[k] = bi; out.w[k] = bv; sum += bv; acc[bi] = -1; }   // 重い順に4本
    for (let k = 0; k < 4; k++) out.w[k] /= sum;
  }
  return weightsAt;
}
