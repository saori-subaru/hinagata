// Build worker: does the heavy steps of one part's mesh off the main thread (build.js sends the jobs through pool.js).
//   "sample":  the grid's distances for a slab of z layers (sampleGrid)
//   "project": pull a slice of vertices onto the surface and give them skin weights (projectVerts + skinOf)
// Same modules and the same part table (parts.js) as the main thread, so the result is the same mesh.
// No three.js here (workers don't see the page's import map).
import { buildBody } from "./body/index.js";
import { buildClothes } from "./clothes/index.js";
import { buildHair } from "./hair/index.js";
import { gridSampler, sampleGrid, projectVerts } from "./sdf/mesh.js";
import { makeWeights } from "./weights.js";
import { partSpec, skinOf } from "./parts.js";

let kit = null, kitKey = null;   // the shapes for the last character (one character's jobs usually come together)

onmessage = ({ data: m }) => {
  try {
    if (kitKey !== m.key) {
      const B = buildBody(m.opt, m.debug);
      kit = { bodySdf: B.bodySdf, HT: B.HT, BI: B.BI, weightsAt: makeWeights({ BODY: B.BODY, BONES: B.BONES, BI: B.BI, J: B.J }),
        clothes: buildClothes(m.opt, { P: B.P, CROTCH: B.CROTCH, bodySdf: B.bodySdf, ARMPIT: B.ARMPIT }),
        hairKit: buildHair(m.opt, { P: B.P, CUT: B.CUT, PLANES: B.PLANES, faceWarp: B.faceWarp, bodySdf: B.bodySdfRaw }) };
      kitKey = m.key;
    }
    const s = partSpec(m.part, { OPT: m.opt, H: m.H, kit, bodyAt: m.grid ? gridSampler(m.grid, kit.bodySdf) : null });
    if (m.type === "sample") {
      const V = sampleGrid(s.fast || s.sdf, s.lo, s.hi, s.h, m.opt.quality.band, m.k0, m.k1);
      postMessage({ id: m.id, V }, [V.buffer]);
    } else {
      const pos = m.pos, nor = new Float32Array(pos.length);   // pos: Float64 (the same numbers the main thread would project)
      projectVerts(s.sdf, pos, nor, m.opt.quality.project);
      const { si, sw } = skinOf(new Float32Array(pos), kit.weightsAt, kit.BI, s.bone1, s.only);   // weights from the stored (float32) positions, as on the main thread
      postMessage({ id: m.id, pos, nor, si, sw }, [pos.buffer, nor.buffer, si.buffer, sw.buffer]);
    }
  } catch (e) { postMessage({ id: m.id, error: String((e && e.message) || e) }); }
};
