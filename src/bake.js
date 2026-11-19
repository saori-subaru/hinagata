// A baked character: the meshes of one build as a file, so a game whose character doesn't change skips the building (avatar.bake(), then
// createAvatar(recipe, { baked })). The same records the cache keeps (cache.js), under the same key: the recipe's shape, the quality and
// the engine's source. Another recipe or another engine doesn't match, and the character is built as without it.
// The file: "HNBK", the header's length (uint32), the header (JSON: { v, key, parts: { part: { field: [type, offset, count] | value } } }),
// then the arrays, each at a multiple of 4 bytes.

const MAGIC = 0x4b424e48, TYPES = { Float32Array, Float64Array, Uint32Array, Uint16Array, Uint8Array, Int32Array, Int16Array, Int8Array };

/** { key, parts } (parts: { name: { pos, nor, idx, si, sw, … } | Uint8Array }) → ArrayBuffer */
export function encodeBake({ key, parts }) {
  const head = { v: 1, key, parts: {} }, blobs = []; let at = 0;
  const put = (a) => { if (Array.isArray(a)) a = Float32Array.from(a); const type = a.constructor.name; if (!TYPES[type]) throw new Error("bake: " + type);
    const r = [type, at, a.length]; blobs.push([at, new Uint8Array(a.buffer, a.byteOffset, a.byteLength)]); at += (a.byteLength + 3) & ~3; return r; };
  const many = (a) => ArrayBuffer.isView(a) || (Array.isArray(a) && a.length > 16 && typeof a[0] === "number");
  for (const [name, rec] of Object.entries(parts)) { if (rec == null) continue;
    head.parts[name] = many(rec) ? put(rec) : Object.fromEntries(Object.entries(rec).filter(([, v]) => v != null && typeof v !== "function").map(([k, v]) => [k, many(v) ? put(v) : { json: v }])); }
  const H = new TextEncoder().encode(JSON.stringify(head)), start = (8 + H.length + 3) & ~3, out = new Uint8Array(start + at), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, H.length, true); out.set(H, 8);
  for (const [o, b] of blobs) out.set(b, start + o);
  return out.buffer;
}

/** ArrayBuffer → { key, parts }, or null when it is not a bake of this format */
export function decodeBake(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 8) return null;
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== MAGIC) return null;
  const n = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), start = (8 + n + 3) & ~3;
  if (head.v !== 1) return null;
  const get = ([type, o, count]) => new TYPES[type](buf.slice(start + o, start + o + count * TYPES[type].BYTES_PER_ELEMENT));   // (a copy: its own buffer, as a built array has)
  const parts = {};
  for (const [name, rec] of Object.entries(head.parts)) parts[name] = Array.isArray(rec) ? get(rec) : Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, Array.isArray(v) ? get(v) : v.json]));
  return { key: head.key, parts };
}

/** settings.baked as given (a URL, an ArrayBuffer, a typed array of the file, or { key, parts }) → { key, parts } or null */
export async function openBake(b) {
  try {
    if (typeof b === "string" || b instanceof URL) { const r = await fetch(b); if (!r.ok) throw new Error(r.status + " " + b); b = await r.arrayBuffer(); }
    if (ArrayBuffer.isView(b)) b = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    if (b instanceof ArrayBuffer) return decodeBake(b);
    return b?.key && b.parts ? b : null;
  } catch (e) { console.warn("Hinagata: the baked character could not be read; building it.", e); return null; }
}
