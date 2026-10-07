// Face part ids and expressions, with display names. No three.js here, so options.js can use it.

// Part ids per slot, with display names (an editor shows these). Recipes store the ids (options.face.parts).
export const PART_LABELS = {
  eyes: { round: { ja: "まる目", en: "Round" }, sparkle: { ja: "キラキラ目", en: "Sparkly" }, classic: { ja: "まる目(前)", en: "Round (classic)" }, happy: { ja: "にっこり", en: "Happy" }, closed: { ja: "とじ目", en: "Closed" }, surprised: { ja: "びっくり", en: "Surprised" }, glare: { ja: "ジト目", en: "Glare" }, image: { ja: "絵の目", en: "Picture" }, imageClosed: { ja: "絵のとじ目", en: "Picture (closed)" } },
  brows: { normal: { ja: "ふつう", en: "Normal" }, classic: { ja: "ふつう(前)", en: "Normal (classic)" }, worried: { ja: "こまり", en: "Worried" }, angry: { ja: "おこ", en: "Angry" }, none: { ja: "なし", en: "None" }, image: { ja: "絵の眉", en: "Picture" } },
  mouth: { smile: { ja: "にこ", en: "Smile" }, open: { ja: "あーん", en: "Open" }, o: { ja: "お", en: "O" }, cat: { ja: "ω", en: "Cat (ω)" }, frown: { ja: "へ", en: "Frown" }, image: { ja: "絵の口", en: "Picture" } },
  nose: { shadow: { ja: "影", en: "Shadow" }, dot: { ja: "点", en: "Dot" }, line: { ja: "線", en: "Line" }, none: { ja: "なし", en: "None" }, image: { ja: "絵の鼻", en: "Picture" } },
  cheeks: { none: { ja: "なし", en: "None" }, flush: { ja: "ぽっ", en: "Flush" } },
};
// Drawn expressions of a character (options.face.drawn: [{ id, name, eye, brow, mouth, cheeks, blink }]) add their own part ids
// "image@<id>" and expressions of the same id; they belong to the character, so they are not listed here (face/index.js makes them).
export const DRAWN_PREFIX = "image@";
// Expressions: a set of parts under one name. avatar.setFace("happy") picks one; slots it doesn't list keep their part.
export const EXPRESSIONS = {
  normal: { ja: "ふつう", en: "Normal", parts: { eyes: "round", brows: "normal", mouth: "smile", cheeks: "none" } },
  happy: { ja: "にこっ", en: "Happy", parts: { eyes: "happy", brows: "normal", mouth: "open", cheeks: "flush" } },
  sleeping: { ja: "すやすや", en: "Sleeping", parts: { eyes: "closed", brows: "normal", mouth: "o", cheeks: "flush" } },
  surprised: { ja: "びっくり", en: "Surprised", parts: { eyes: "surprised", brows: "worried", mouth: "o", cheeks: "none" } },
  glare: { ja: "じとー", en: "Glare", parts: { eyes: "glare", brows: "angry", mouth: "frown", cheeks: "none" } },
  sad: { ja: "しょんぼり", en: "Sad", parts: { eyes: "round", brows: "worried", mouth: "frown", cheeks: "none" } },
  angry: { ja: "おこ", en: "Angry", parts: { eyes: "glare", brows: "angry", mouth: "o", cheeks: "none" } },
  classic: { ja: "ふつう(前)", en: "Classic", parts: { eyes: "classic", brows: "classic", mouth: "smile", cheeks: "none" } },
  image: { ja: "絵: ふつう", en: "Picture: normal", parts: { eyes: "image", brows: "image", mouth: "image", cheeks: "none" } },
};
// The names a game asks for (avatar.setFace("happy")). A character can have its own version of each (options.face.expressions, made in
// the editor): a drawn character smiles with its own pictures, not the stock parts (2026-10-05, Saori: "表情はキャラクターごとのセット単位に")
export const EXPRESSION_SET = ["normal", "happy", "sad", "angry", "surprised"];
// Older recipes and pages used the Japanese names as ids: accept them
const JA_ID = {}; for (const [slot, L] of Object.entries(PART_LABELS)) { JA_ID[slot] = {}; for (const [id, l] of Object.entries(L)) JA_ID[slot][l.ja] = id; }
const JA_EXPR = Object.fromEntries(Object.entries(EXPRESSIONS).map(([id, e]) => [e.ja, id]));
/** Part selection with ids: { eyes: "まる目" } → { eyes: "round" } (unknown names are kept as they are). */
export function partIds(sel = {}) { const out = {}; for (const [slot, v] of Object.entries(sel)) out[slot] = v == null ? v : JA_ID[slot]?.[v] ?? v; return out; }
export const expressionId = (name) => JA_EXPR[name] ?? name;
