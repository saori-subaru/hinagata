// Schema: what every option is — type, range, display name (ja / en), where an editor shows it, and what changing it costs.
// Built from DEFAULTS, so a new option is never missing: values described in MAIN get names and ranges by hand,
// every other value (the sculpt tuning) gets an entry made from its default (a guessed range, marked soft).
// No three.js here (node tools and workers can read it). tools/schema.mjs writes docs/options.schema.json from it.
import { DEFAULTS } from "./options.js";
import { PART_LABELS, partIds } from "./face/names.js";

/*
 Entry: {
   path      "body.torso.chest"
   type      "number" | "boolean" | "color" | "enum" | "image" | "json"   (json: arrays, or a value whose default is null / any shape)
   default
   min, max, step   numbers. soft: true = a guessed range (an editor may let people type outside it)
   options   enum: [{ value, label: { ja, en } }]
   nullable  null is allowed (and means what `help` says)
   label     { ja?, en }
   help      { ja?, en }  optional
   group     "look" | "body" | "face" | "hair" | "outfit" | "quality"   (the editor's tab)
   section   a heading inside the group
   tier      "main" (shown) | "advanced" (folded)
   cost      what changing it rebuilds: "instant" (redraw / recolor) | "paint" (materials or painted attributes, no new mesh)
             | "hair" | "clothes" | "body" (body, clothes and hair)
   apply     the avatar method that applies it without a rebuild ("setColors" …), or null (needs a new build for now)
   alsoShapes  set when an instant change also moves a shape on the next build (eye position → eye sockets)
   order     main values: their place in the editor's panels
   when      { path: value, … }: the value only matters (and an editor only shows it) when those other values are set so
 }
*/

const L = (ja, en) => ({ ja, en });
const opts = (o) => Object.entries(o).map(([value, [ja, en]]) => ({ value, label: L(ja, en) }));
const partOpts = (slot) => Object.entries(PART_LABELS[slot]).map(([value, l]) => ({ value, label: { ...l } }));

// [path, label, extra]. extra: { min, max, step, options, nullable, help, section, cost, apply, tier, alsoShapes }
const MAIN = [
  // look
  ["colors.skin", L("肌の色", "Skin"), { group: "body", section: L("色", "Colors"), apply: "setColors" }],
  ["colors.hair", L("髪の色", "Hair"), { group: "hair", section: L("色", "Colors"), apply: "setColors" }],
  ["colors.eyes", L("瞳の色", "Eyes"), { group: "face", section: L("色", "Colors"), apply: "setColors", help: L("この1色から虹彩のグラデーションを作る", "The iris gradient is made from this one color") }],
  ["outline.on", L("輪郭線", "Outline"), { apply: "setOutline" }],
  ["outline.width", L("輪郭線の太さ", "Outline width"), { when: { "outline.on": true }, min: 0, max: 3, step: 0.05, apply: "setOutline" }],
  ["outline.color", L("輪郭線の色", "Outline color"), { when: { "outline.on": true }, apply: "setOutline" }],
  ["shading.style", L("塗り", "Shading"), { options: opts({ toon: ["アニメ", "Toon"], smooth: ["なめらか", "Smooth"], flat: ["べた塗り", "Flat"] }), apply: "setShading" }],
  ["shading.bands", L("影の段数", "Shadow bands"), { when: { "shading.style": "toon" }, min: 2, max: 3, step: 1, apply: "setShading", help: L("2 = 光と影だけ(すっきり) / 3 = 中間の色つき", "2 = light and shadow only (clean) / 3 = with a mid tone") }],
  ["shading.soften", L("影のなめらかさ", "Shadow smoothing"), { when: { "shading.style": "toon" }, min: 0, max: 2, step: 0.05, apply: "setShading", help: L("影の境目を大きな形にそわせる(0 = メッシュの凹凸のまま)", "how much the shadow follows the big shapes instead of small bumps (0 = the mesh as is)") }],

  // body
  ["body.head.scale", L("頭の大きさ", "Head size"), { min: 0.8, max: 1.05, step: 0.01, section: L("頭", "Head") }],
  ["body.head.width", L("頭の幅", "Head width"), { min: 0.85, max: 1.15, step: 0.01, section: L("頭", "Head") }],
  ["body.head.depth", L("頭の奥行き", "Head depth"), { min: 0.85, max: 1.15, step: 0.01, section: L("頭", "Head") }],
  ["body.sculpt.temple.depth", L("こめかみの張り", "Temple fullness"), { min: 0, max: 0.015, step: 0.001, section: L("輪郭", "Face shape"), help: L("目じりの横を外へ張り出す(m)", "pushes the side of the face beside the eyes out (m)") }],
  ["body.sculpt.cheekFill.depth", L("ほおの肉付け", "Cheek fill"), { min: 0, max: 0.02, step: 0.001, section: L("輪郭", "Face shape"), help: L("ほおの前を足す(m)", "adds to the front of the cheeks (m)") }],
  ["body.sculpt.cheekTrim.depth", L("ほおの横の削り", "Cheek trim"), { min: 0, max: 0.02, step: 0.001, section: L("輪郭", "Face shape"), help: L("ほおの横を削る(m)", "takes off the side of the cheeks (m)") }],
  ["body.sculpt.cheeks.y", L("ほおの高さ", "Cheek height"), { min: 0.9, max: 0.99, step: 0.002, section: L("輪郭", "Face shape"), help: L("ほおがいちばん張る高さ", "where the cheeks are fullest") }],
  ["body.sculpt.cheeks.height", L("ほおの長さ", "Cheek length"), { min: 0.07, max: 0.14, step: 0.002, section: L("輪郭", "Face shape"), help: L("ほおがどこまで下へ続くか", "how far down the cheeks reach") }],
  ["body.sculpt.chin.k", L("あごの角の丸み", "Chin corner"), { min: 0.005, max: 0.04, step: 0.001, section: L("輪郭", "Face shape"), help: L("あごの正面から下への角(小さいほどくっきり)", "the corner from the chin's front to its underside (smaller is crisper)") }],
  ["body.sculpt.chin.sharp", L("あごのとがり", "Chin sharpness"), { min: 0, max: 0.5, step: 0.01, section: L("輪郭", "Face shape"), help: L("正面から見たあごの下の線: 0 = U字(丸い) / 大きいほどV字", "the jaw's bottom line seen from the front: 0 = a U (round), higher = a V") }],
  ["body.sculpt.chinTip.on", L("あご先の肉", "Chin tip"), { section: L("輪郭", "Face shape"), help: L("あご先に小さなふくらみを足す", "a small piece at the bottom of the chin") }],
  ["body.torso.chest", L("胸板", "Chest"), { min: 0.8, max: 1.4, step: 0.01, section: L("胴", "Torso") }],
  ["body.torso.bust", L("胸(ふくらみ)", "Bust"), { min: 0, max: 1, step: 0.01, section: L("胴", "Torso") }],
  ["body.torso.belly", L("おなか", "Belly"), { min: 0.6, max: 1.15, step: 0.01, section: L("胴", "Torso") }],
  ["body.torso.waist", L("くびれ", "Waist"), { min: 0, max: 0.04, step: 0.001, section: L("胴", "Torso") }],
  ["body.torso.hips", L("腰の幅", "Hips"), { min: 0.75, max: 1.2, step: 0.01, section: L("胴", "Torso") }],
  ["body.torso.butt", L("おしり", "Bottom"), { min: 0.4, max: 1.2, step: 0.01, section: L("胴", "Torso") }],
  ["body.torso.back", L("背中の厚み", "Back"), { min: 0.3, max: 1.2, step: 0.01, section: L("胴", "Torso") }],
  ["body.thickness.upperArm", L("二の腕", "Upper arm"), { min: 0.6, max: 1.15, step: 0.01, section: L("手足の太さ", "Limbs") }],
  ["body.thickness.forearm", L("前腕", "Forearm"), { min: 0.6, max: 1.15, step: 0.01, section: L("手足の太さ", "Limbs") }],
  ["body.thickness.thigh", L("太もも", "Thigh"), { min: 0.6, max: 1.15, step: 0.01, section: L("手足の太さ", "Limbs") }],
  ["body.thickness.thighTop", L("太ももの付け根", "Thigh top"), { min: 0.5, max: 1.15, step: 0.01, nullable: true, section: L("手足の太さ", "Limbs"), help: L("null = 太ももと同じ", "null = same as the thigh") }],
  ["body.thickness.calf", L("ふくらはぎ", "Calf"), { min: 0.6, max: 1.15, step: 0.01, section: L("手足の太さ", "Limbs") }],

  // face
  ["face.parts.eyes", L("目", "Eyes"), { options: partOpts("eyes"), section: L("パーツ", "Parts"), apply: "setFace" }],
  ["face.parts.brows", L("眉", "Brows"), { options: partOpts("brows"), section: L("パーツ", "Parts"), apply: "setFace" }],
  ["face.parts.mouth", L("口", "Mouth"), { options: partOpts("mouth"), section: L("パーツ", "Parts"), apply: "setFace" }],
  ["face.parts.cheeks", L("ほっぺ", "Cheeks"), { options: partOpts("cheeks"), section: L("パーツ", "Parts"), apply: "setFace" }],
  ["face.parts.nose", L("鼻", "Nose"), { options: partOpts("nose"), nullable: true, section: L("パーツ", "Parts"), apply: "setFace", help: L("null = 「鼻の影」のオンオフに合わせる", "null = follow the nose shadow switch") }],
  ["face.eyeSize", L("目の大きさ", "Eye size"), { min: 0.8, max: 1.8, step: 0.01, section: L("位置", "Layout"), apply: "setFaceLayout" }],
  ["face.layout.eyeX", L("目の間隔", "Eye spacing"), { min: 0.07, max: 0.16, step: 0.001, section: L("位置", "Layout"), apply: "setFaceLayout", alsoShapes: "body" }],
  ["face.layout.eyeY", L("目の高さ", "Eye height"), { min: 0.94, max: 1.06, step: 0.001, section: L("位置", "Layout"), apply: "setFaceLayout", alsoShapes: "body" }],
  ["face.layout.browX", L("眉の間隔", "Brow spacing"), { min: 0.07, max: 0.16, step: 0.001, section: L("位置", "Layout"), apply: "setFaceLayout" }],
  ["face.layout.browY", L("眉の高さ", "Brow height"), { min: 1.02, max: 1.14, step: 0.001, section: L("位置", "Layout"), apply: "setFaceLayout" }],
  ["face.layout.mouthY", L("口の高さ", "Mouth height"), { min: 0.86, max: 0.95, step: 0.001, section: L("位置", "Layout"), apply: "setFaceLayout" }],
  ["face.blush.cheeks.on", L("ほっぺの赤み", "Cheek blush"), { section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.cheeks.color", L("ほっぺの色", "Cheek color"), { when: { "face.blush.cheeks.on": true }, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.cheeks.strength", L("ほっぺの濃さ", "Cheek strength"), { when: { "face.blush.cheeks.on": true }, min: 0, max: 1, step: 0.01, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.cheeks.size", L("ほっぺの大きさ", "Cheek size"), { when: { "face.blush.cheeks.on": true }, min: 0.02, max: 0.07, step: 0.001, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.cheeks.x", L("ほっぺの間隔", "Cheek spacing"), { when: { "face.blush.cheeks.on": true }, min: 0.1, max: 0.19, step: 0.001, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.cheeks.y", L("ほっぺの高さ", "Cheek height"), { when: { "face.blush.cheeks.on": true }, min: 0.9, max: 1.0, step: 0.001, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.nose.on", L("鼻先の赤み", "Nose blush"), { section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.nose.color", L("鼻先の色", "Nose blush color"), { when: { "face.blush.nose.on": true }, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.nose.strength", L("鼻先の濃さ", "Nose blush strength"), { when: { "face.blush.nose.on": true }, min: 0, max: 1, step: 0.01, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.blush.nose.size", L("鼻先の大きさ", "Nose blush size"), { when: { "face.blush.nose.on": true }, min: 0.008, max: 0.03, step: 0.001, section: L("赤み", "Blush"), apply: "setBlush" }],
  ["face.noseShadow.on", L("鼻の下の影", "Nose shadow"), { section: L("影と線", "Shadows and lines") }],
  ["face.jawShadow.on", L("あごの影", "Jaw shadow"), { section: L("影と線", "Shadows and lines") }],
  ["face.earLine.on", L("耳の線", "Ear line"), { section: L("影と線", "Shadows and lines") }],
  ["face.earShade.on", L("耳の陰", "Ear shade"), { section: L("影と線", "Shadows and lines") }],
  ["face.images.eye.src", L("目の絵", "Eye picture"), { section: L("描いたパーツ", "Drawn parts"), help: L("null = 同梱の img/parts/eye.png", "null = the bundled img/parts/eye.png") }],
  ["face.images.eyeClosed.src", L("とじ目の絵", "Closed eye picture"), { section: L("描いたパーツ", "Drawn parts"), help: L("描いた目のまばたきと、目の「絵のとじ目」に使う。null = なし(まばたきはコードのとじ目)", "Used when drawn eyes blink, and by the eye part \"Picture (closed)\". null = none (blinking uses the code-drawn closed eye)") }],
  ["face.images.brow.src", L("眉の絵", "Brow picture"), { section: L("描いたパーツ", "Drawn parts"), help: L("null = 同梱の img/parts/brow.png", "null = the bundled img/parts/brow.png") }],
  ["face.images.mouth.src", L("口の絵", "Mouth picture"), { section: L("描いたパーツ", "Drawn parts"), help: L("null = 同梱の img/parts/mouth.png", "null = the bundled img/parts/mouth.png") }],
  ["face.images.nose.src", L("鼻の絵", "Nose picture"), { section: L("描いたパーツ", "Drawn parts"), help: L("null = なし", "null = none") }],
  ["face.drawn", L("描いた表情", "Drawn expressions"), { section: L("描いた表情", "Drawn expressions"), help: L("[{ id, name, eye, brow, mouth, cheeks, blink }] 名前をつけた表情をいくつでも。eye / brow / mouth は絵(data URL か パス)、null = ふつうの絵。表情とパーツの名前は image@<id>", "[{ id, name, eye, brow, mouth, cheeks, blink }] named expressions, as many as you like. eye / brow / mouth: pictures (data URL or path), null = the normal picture. Their expression and part ids are image@<id>") }],

  // hair
  ["hair.bangs", L("前髪", "Bangs"), { options: opts({ nendo: ["ふさ", "Clumps"], hime: ["姫カット", "Hime cut"], parted: ["分け目", "Parted"], side: ["横流し", "Side-swept"], none: ["なし", "None"] }), section: L("髪型", "Style"), apply: "setHair" }],
  ["hair.back", L("後ろ髪", "Back"), { options: opts({ hang: ["ショート(たらし)", "Short, hanging"], short: ["ショート", "Short"], bob: ["ボブ", "Bob"], flip: ["外ハネ", "Flip"], long: ["ロング", "Long"] }), section: L("髪型", "Style"), apply: "setHair" }],
  ["hair.ahoge", L("アホ毛", "Ahoge"), { section: L("髪型", "Style"), apply: "setHair" }],
  ["hair.sculpt.shortLocks.count", L("毛束の数", "Lock count"), { when: { "hair.back": "hang" }, min: 6, max: 30, step: 1, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.shortLocks.width", L("毛束の幅", "Lock width"), { when: { "hair.back": "hang" }, min: 0.03, max: 0.16, step: 0.005, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.shortLocks.thick", L("毛束の厚み", "Lock thickness"), { when: { "hair.back": "hang" }, min: 0.1, max: 0.6, step: 0.01, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("幅に対する厚さ", "thickness for the width") }],
  ["hair.sculpt.shortLocks.below", L("長さ(足す)", "Length (extra)"), { when: { "hair.back": "hang" }, min: -0.04, max: 0.12, step: 0.005, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("すそより下へ伸ばす(m)", "how far below the hem (m)") }],
  ["hair.sculpt.shortLocks.flick", L("はね(+) / 内巻き(−)", "Flick out (+) / curl in (−)"), { when: { "hair.back": "hang" }, min: -0.04, max: 0.06, step: 0.002, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.shortLocks.stiff", L("硬さ", "Stiffness"), { when: { "hair.back": "hang" }, min: 0.3, max: 6, step: 0.1, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("小さいほどよく揺れる", "lower swings more") }],
  ["hair.sculpt.shortLocks.lie.count", L("毛束の数", "Lock count"), { when: { "hair.back": "short" }, min: 6, max: 30, step: 1, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.shortLocks.lie.width", L("毛束の幅", "Lock width"), { when: { "hair.back": "short" }, min: 0.03, max: 0.16, step: 0.005, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.shortLocks.lie.thick", L("毛束の厚み", "Lock thickness"), { when: { "hair.back": "short" }, min: 0.1, max: 0.6, step: 0.01, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("幅に対する厚さ", "thickness for the width") }],
  ["hair.sculpt.shortLocks.lie.flick", L("はね(+) / 内巻き(−)", "Flick out (+) / curl in (−)"), { when: { "hair.back": "short" }, min: -0.02, max: 0.06, step: 0.002, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.long.count", L("毛束の数", "Lock count"), { when: { "hair.back": "long" }, min: 6, max: 24, step: 1, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.long.width", L("毛束の幅", "Lock width"), { when: { "hair.back": "long" }, min: 0.03, max: 0.16, step: 0.005, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.long.thick", L("毛束の厚み", "Lock thickness"), { when: { "hair.back": "long" }, min: 0.1, max: 0.6, step: 0.01, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("幅に対する厚さ", "thickness for the width") }],
  ["hair.sculpt.long.bottom", L("毛先の高さ", "Tip height"), { when: { "hair.back": "long" }, min: 0.47, max: 0.85, step: 0.005, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("低いほど長い(腰まで)", "lower is longer (down to the waist)") }],
  ["hair.sculpt.long.flick", L("はね(+) / 内巻き(−)", "Flick out (+) / curl in (−)"), { when: { "hair.back": "long" }, min: -0.06, max: 0.08, step: 0.002, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks" }],
  ["hair.sculpt.long.stiff", L("硬さ", "Stiffness"), { when: { "hair.back": "long" }, min: 0.3, max: 4, step: 0.1, section: L("後ろ髪の毛束", "Back locks"), apply: "setLocks", help: L("小さいほどよく揺れる", "lower swings more") }],
  ["hair.sculpt.nendo.overlap", L("ふさの重なり", "Tuft overlap"), { when: { "hair.bangs": "nendo", "hair.sculpt.nendo.locks": true }, min: 0.8, max: 2, step: 0.01, section: L("前髪のふさ", "Bang tufts"), apply: "setBangs", help: L("ふさの幅(となりのふさとの間に対して)", "how wide a tuft is, for the gap to its neighbours") }],
  ["hair.sculpt.nendo.lockSpan", L("ふさを分ける幅(度)", "Split tufts wider than (°)"), { when: { "hair.bangs": "nendo", "hair.sculpt.nendo.locks": true }, min: 6, max: 40, step: 0.5, section: L("前髪のふさ", "Bang tufts"), apply: "setBangs", help: L("これより広いふさは何本かの毛束に分かれる", "a tuft wider than this splits into several locks") }],
  ["hair.sculpt.nendo.lockThick", L("ふさの厚み", "Tuft thickness"), { when: { "hair.bangs": "nendo", "hair.sculpt.nendo.locks": true }, min: 0.08, max: 0.6, step: 0.01, section: L("前髪のふさ", "Bang tufts"), apply: "setBangs", help: L("幅に対する厚さ", "thickness for the width") }],
  ["hair.sculpt.nendo.puff", L("ふくらみ", "Puff"), { when: { "hair.bangs": "nendo", "hair.sculpt.nendo.locks": true }, min: 0, max: 0.04, step: 0.001, section: L("前髪のふさ", "Bang tufts"), apply: "setBangs", help: L("おでこからの浮き(m)", "how far the tufts stand off the forehead in the middle (m)") }],
  ["hair.sculpt.ahogeSize", L("アホ毛の大きさ", "Ahoge size"), { when: { "hair.ahoge": true }, min: 0.6, max: 1.6, step: 0.01, section: L("髪型", "Style") }],
  ["hair.sculpt.ahogeDir", L("アホ毛の向き(度)", "Ahoge direction (°)"), { when: { "hair.ahoge": true }, min: -180, max: 180, step: 5, section: L("髪型", "Style"), help: L("0 = 前 / 90 = キャラの左", "0 = forward, 90 = toward the character's left") }],
  ["hair.paint.strands.on", L("髪の筋", "Strands"), { section: L("塗り", "Paint") }],
  ["hair.paint.strands.count", L("筋の本数", "Strand count"), { when: { "hair.paint.strands.on": true }, min: 10, max: 60, step: 1, section: L("塗り", "Paint") }],
  ["hair.paint.strands.strength", L("筋の濃さ", "Strand strength"), { when: { "hair.paint.strands.on": true }, min: 0, max: 0.6, step: 0.01, section: L("塗り", "Paint") }],
  ["hair.paint.ring.on", L("天使の輪", "Angel ring"), { section: L("塗り", "Paint") }],
  ["hair.paint.ring.color", L("天使の輪の色", "Ring color"), { when: { "hair.paint.ring.on": true },  nullable: true, section: L("塗り", "Paint"), help: L("null = 髪の色から自動", "null = from the hair color") }],
  ["hair.paint.ring.strength", L("天使の輪の濃さ", "Ring strength"), { when: { "hair.paint.ring.on": true }, min: 0, max: 1, step: 0.01, section: L("塗り", "Paint") }],

  // outfit
  ["outfit.shirt.on", L("着る", "Wear"), { section: L("シャツ", "Shirt"), apply: "setWorn" }],
  ["outfit.shirt.color", L("シャツの色", "Shirt color"), { section: L("シャツ", "Shirt"), apply: "setColors" }],
  ["outfit.shirt.sleeve", L("袖", "Sleeves"), { options: opts({ short: ["半袖", "Short"], none: ["そでなし", "None"], long: ["長袖", "Long"] }), section: L("シャツ", "Shirt") }],
  ["outfit.shirt.length", L("丈", "Length"), { options: opts({ tuck: ["入れる", "Tucked in"], out: ["出す", "Out"], crop: ["短い", "Cropped"] }), section: L("シャツ", "Shirt") }],
  ["outfit.shirt.underarm", L("わきの下", "Underarm"), { options: opts({ fit: ["ぴったり", "Fitted"], loose: ["ゆったり", "Loose"] }), section: L("シャツ", "Shirt") }],
  ["outfit.dress.on", L("ワンピースにする", "Dress"), { cost: "clothes", section: L("ワンピース", "Dress"), help: L("シャツとスカートをひと続きの1着にする(ズボンの種類は無視)。袖・えりはシャツの設定", "makes the shirt and a skirt one garment (the pants' kind is ignored). Sleeves and collar come from the shirt") }],
  ["outfit.dress.color", L("ワンピースの色", "Dress color"), { when: { "outfit.dress.on": true }, nullable: true, section: L("ワンピース", "Dress"), apply: "setColors", help: L("null = シャツの色", "null = the shirt's color") }],
  ["outfit.dress.hem", L("すその高さ", "Hem height"), { when: { "outfit.dress.on": true }, min: 0.12, max: 0.4, step: 0.005, section: L("ワンピース", "Dress") }],
  ["outfit.dress.flare", L("すその広がり", "Flare"), { when: { "outfit.dress.on": true }, min: 0, max: 0.8, step: 0.01, section: L("ワンピース", "Dress") }],
  ["outfit.dress.pleats", L("ひだの数", "Pleats"), { when: { "outfit.dress.on": true }, min: 0, max: 32, step: 1, section: L("ワンピース", "Dress") }],
  ["outfit.pants.on", L("はく", "Wear"), { section: L("ズボン", "Pants"), apply: "setWorn" }],
  ["outfit.pants.color", L("ズボンの色", "Pants color"), { section: L("ズボン", "Pants"), apply: "setColors" }],
  ["outfit.pants.kind", L("ズボン / スカート", "Pants or skirt"), { options: opts({ pants: ["ズボン", "Pants"], skirt: ["スカート", "Skirt"] }), section: L("ズボン", "Pants") }],
  ["outfit.pants.length", L("丈", "Length"), { when: { "outfit.pants.kind": "pants" }, options: opts({ shorts: ["短パン", "Shorts"], knee: ["ひざ下", "Below the knee"], long: ["長ズボン", "Long"] }), section: L("ズボン", "Pants") }],
  ["outfit.pants.hem", L("短パンの裾の高さ", "Shorts hem height"), { when: { "outfit.pants.kind": "pants", "outfit.pants.length": "shorts" }, min: 0.22, max: 0.4, step: 0.005, section: L("ズボン", "Pants"), help: L("丈が「短パン」のときだけ", "Only for shorts") }],
  ["outfit.pants.tilt", L("ウエストの後ろ上がり", "Waist rise at the back"), { min: 0, max: 0.4, step: 0.01, section: L("ズボン", "Pants"), help: L("ズボンとスカートの上端の傾き。0 = 水平", "How much the top of the pants or skirt rises toward the back. 0 = level") }],
  ["outfit.pants.skirt.hem", L("スカートの裾の高さ", "Skirt hem height"), { when: { "outfit.pants.kind": "skirt" }, min: 0.2, max: 0.4, step: 0.005, section: L("ズボン", "Pants"), help: L("スカートのときだけ", "Only for the skirt") }],
  ["outfit.pants.skirt.flare", L("スカートの広がり", "Skirt flare"), { when: { "outfit.pants.kind": "skirt" }, min: 0, max: 0.8, step: 0.01, section: L("ズボン", "Pants"), help: L("スカートのときだけ", "Only for the skirt") }],
  ["outfit.pants.skirt.pleats", L("プリーツの数", "Pleats"), { when: { "outfit.pants.kind": "skirt" }, min: 0, max: 32, step: 1, section: L("ズボン", "Pants"), help: L("スカートのときだけ", "Only for the skirt") }],
  ["outfit.armor.on", L("着る", "Wear"), { section: L("鎧", "Armor"), apply: "setWorn" }],
  ["outfit.armor.style", L("鎧の種類", "Armor style"), { options: opts({ light: ["軽鎧(服の上に)", "Light (over the clothes)"], full: ["全身鎧(兜まで)", "Full plate (with a helm)"] }), section: L("鎧", "Armor") }],
  ["outfit.armor.color", L("鎧の色", "Armor color"), { section: L("鎧", "Armor"), apply: "setColors" }],
  ["outfit.armor.helm", L("兜の形", "Helm"), { options: opts({ great: ["バケツ(目のすき間だけ)", "Great helm (eye slit)"], visor: ["目元が黒・口が見える", "Visor (mouth shows)"], open: ["顔が見える丸い兜", "Open (face shows)"], close: ["くちばしの面頬(クローズヘルム)", "Close helm (beaked visor)"], kettle: ["つば付き(ケトルハット)", "Kettle hat (brimmed)"], sallet: ["後ろが長い(サレット)", "Sallet (long tail)"] }), section: L("鎧", "Armor"), help: L("全身鎧のとき", "Full plate") }],
  ["outfit.armor.deco", L("兜の飾り", "Helm decoration"), { options: opts({ none: ["なし", "None"], plume: ["羽飾り", "Plume"], horns: ["角", "Horns"], wings: ["翼", "Wings"] }), section: L("鎧", "Armor"), help: L("全身鎧のとき", "Full plate") }],
  ["outfit.armor.decoColor", L("飾りの色", "Decoration color"), { nullable: true, section: L("鎧", "Armor"), help: L("null = 飾りごとの色(羽は赤・角は象牙・翼は白)", "null = its own color (red plume, ivory horns, white wings)") }],
  ["outfit.armor.mailColor", L("鎖かたびらの色", "Mail color"), { section: L("鎧", "Armor"), help: L("全身鎧のとき、板のすき間に見える", "Full plate: shows between the plates") }],
  ["outfit.armor.visorColor", L("兜のすき間の色", "Visor slit color"), { section: L("鎧", "Armor") }],
  ["outfit.armor.gap", L("体からの浮き", "Gap from the body"), { min: 0.01, max: 0.05, step: 0.001, section: L("鎧", "Armor") }],
  ["outfit.armor.thick", L("板の厚み", "Plate thickness"), { min: 0.004, max: 0.02, step: 0.001, section: L("鎧", "Armor") }],
  ["outfit.weapon.right", L("右手に持つもの", "Right hand"), { options: opts({ none: ["なし", "None"], sword: ["剣", "Sword"], axe: ["斧", "Axe"], spear: ["槍", "Spear"], staff: ["杖", "Staff"], fist: ["こぶし(素手)", "Fist (bare)"] }), section: L("武器", "Weapons"), help: L("持つ手は握りこぶしになる", "A hand that holds something makes a fist") }],
  ["outfit.weapon.left", L("左手に持つもの", "Left hand"), { options: opts({ none: ["なし", "None"], shield: ["盾", "Shield"], round: ["丸い盾", "Round shield"], fist: ["こぶし(素手)", "Fist (bare)"] }), section: L("武器", "Weapons") }],
  ["outfit.weapon.shieldMount", L("盾のつけ方", "Shield mount"), { options: opts({ straight: ["まっすぐ(上が手首の側)", "Straight (top toward the hand)"], diagonal: ["ななめ(45°)", "Diagonal (45°)"] }), section: L("武器", "Weapons"), help: L("ななめは、構えで前腕をななめに上げたとき盾がまっすぐ立つ", "Diagonal: the shield stands upright when the guard raises the forearm slantwise") }],
  ["outfit.weapon.color", L("金属の色", "Metal color"), { section: L("武器", "Weapons"), apply: "setColors" }],
  ["outfit.weapon.gripColor", L("柄の色", "Grip color"), { section: L("武器", "Weapons"), apply: "setColors" }],
  ["outfit.weapon.shieldColor", L("盾の色", "Shield color"), { section: L("武器", "Weapons"), apply: "setColors" }],
  ["outfit.socks.on", L("はく", "Wear"), { section: L("靴下", "Socks"), apply: "setWorn" }],
  ["outfit.socks.color", L("靴下の色", "Socks color"), { section: L("靴下", "Socks"), apply: "setColors" }],
  ["outfit.socks.top", L("靴下の高さ", "Socks height"), { min: 0.06, max: 0.3, step: 0.005, section: L("靴下", "Socks") }],
  ["outfit.shoes.on", L("はく", "Wear"), { section: L("靴", "Shoes"), apply: "setWorn" }],
  ["outfit.shoes.color", L("靴の色", "Shoes color"), { section: L("靴", "Shoes"), apply: "setColors" }],
  ["outfit.shoes.soleColor", L("靴底の色", "Sole color"), { section: L("靴", "Shoes"), apply: "setColors" }],
];

// Where a path goes and what it costs, for every value (MAIN entries may override)
function place(path) {
  const p = path.split("."), top = p[0];
  if (top === "colors" || top === "outline" || top === "shading") return { group: "look", cost: "instant" };
  if (top === "quality") return { group: "quality", cost: "body" };
  if (top === "body") return { group: "body", cost: "body" };
  if (path.startsWith("hair.sculpt.nendo.")) return { group: "hair", cost: "hair", apply: "setBangs" };   // the nendo bangs: avatar.setBangs (bangs made of locks rebuild only themselves)
  if (path === "hair.drawn") return { group: "hair", cost: "hair", apply: "setDrawn" };   // locks drawn by hand: avatar.setDrawnHair
  if (/^hair\.sculpt\.(shortLocks|long)\.(lie\.)?edits$/.test(path)) return { group: "hair", cost: "hair", apply: "setLocks" };   // the back locks' own changes (editor/src/backs.js)   // locks drawn by hand: avatar.setDrawnHair   // the nendo bangs: avatar.setBangs (bangs made of locks rebuild only themselves)
  if (top === "hair") return { group: "hair", cost: p[1] === "paint" ? "paint" : "hair" };
  if (top === "outfit") return { group: "outfit", cost: p[2] === "on" || /color$/i.test(p[2]) ? "instant" : "clothes" };
  if (top === "face") {   // drawn into the face picture → instant; painted onto the head mesh or built from it → paint
    if (["parts", "eyeSize", "layout", "blush", "noseShadow", "images"].includes(p[1])) return { group: "face", cost: "instant" };
    return { group: "face", cost: "paint" };
  }
  return { group: top, cost: "body" };
}

const human = (path) => path.split(".").slice(1).filter((k) => k !== "sculpt").map((k) => k.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase()).join(" › ") || path;   // "body.sculpt.nose.tipZ" → "nose › tip z"
const decimals = (x) => { const s = String(x); return s.includes(".") ? s.split(".")[1].length : 0; };
const round = (x, n = 6) => +x.toFixed(n);
function guessRange(d) {   // a range around the default for values nobody described (soft: the editor may go outside)
  if (d === 0) return { min: -0.05, max: 0.05, step: 0.001 };
  const a = Math.abs(d);
  if (Number.isInteger(d) && a >= 2) return a >= 10 ? { min: Math.min(0, d - a), max: d + a, step: 1 } : { min: Math.round(d - a / 2), max: Math.round(d + a / 2), step: 1 };   // counts, degrees
  const n = Math.min(4, Math.max(2, decimals(d) + 1)), step = round(10 ** -n, n);   // one digit finer than the default, 0.01 .. 0.0001
  return { min: round(d - a / 2), max: round(d + a / 2), step };
}
const typeOf = (v, ex) => ex?.options ? "enum" : /\.src$/.test(ex?.path ?? "") ? "image" : typeof v === "boolean" ? "boolean" : typeof v === "number" ? "number"
  : typeof v === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? "color" : typeof v === "string" ? "enum" : "json";

function build() {
  const S = {}, main = new Map(MAIN.map(([path, label, ex], i) => [path, { label, ...ex, order: i }]));
  const walk = (o, pre) => { for (const [k, v] of Object.entries(o)) { const path = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) { walk(v, path); continue; }
    const ex = main.get(path), at = place(path);
    let type = typeOf(v, { ...ex, path });
    if (ex && v === null) type = /\.src$/.test(path) ? "image" : ex.options ? "enum" : /color/i.test(path) ? "color" : "number";   // described values whose default is null
    if (type === "enum" && !ex?.options) type = "json";   // an undescribed string: free value
    const e = { path, type, default: v, label: ex?.label ?? { en: human(path) }, group: ex?.group ?? at.group, tier: ex ? "main" : "advanced", cost: ex?.cost ?? at.cost, apply: ex?.apply ?? at.apply ?? null };
    if (type === "number") Object.assign(e, ex && ex.min != null ? { min: ex.min, max: ex.max, step: ex.step } : { ...guessRange(v ?? 0), soft: true });
    if (ex?.options) e.options = ex.options;
    if (ex) e.order = ex.order;   // the editor lists main values in this order
    if (ex?.nullable || v === null) e.nullable = true;
    for (const k of ["section", "help", "alsoShapes", "when"]) if (ex?.[k]) e[k] = ex[k];
    if (!ex) e.section = { en: human(path.split(".").slice(0, -1).join(".")) || path };
    S[path] = e; } };
  walk(DEFAULTS, "");
  for (const path of main.keys()) if (!S[path]) throw new Error(`schema: "${path}" is described but not in DEFAULTS`);
  return S;
}

/** Every option by path: { "body.torso.chest": { type, default, min, max, … } }. */
export const SCHEMA = build();

/** Check options (a recipe, or what an agent wrote) against the schema. Returns a list of { path, problem } (empty = fine).
 *  Unknown paths, wrong types, enum values that don't exist, and numbers outside a described (not soft) range. */
export function checkOptions(options) {
  const out = [], keys = Object.keys(SCHEMA);
  const walk = (o, pre) => { for (let [k, v] of Object.entries(o ?? {})) { const path = pre ? `${pre}.${k}` : k, e = SCHEMA[path];
    if (pre === "face.parts") v = partIds({ [k]: v })[k];   // the old Japanese part names are still accepted
    if (!e) { if (v && typeof v === "object" && !Array.isArray(v) && keys.some((x) => x.startsWith(path + "."))) walk(v, path); else out.push({ path, problem: "unknown option" }); continue; }
    if (v === null) { if (!e.nullable) out.push({ path, problem: "null is not allowed" }); continue; }
    if (e.type === "json") continue;
    if (e.type === "number") { if (typeof v !== "number" || !isFinite(v)) out.push({ path, problem: "not a number" }); else if (!e.soft && (v < e.min || v > e.max)) out.push({ path, problem: `outside ${e.min}..${e.max}` }); }
    else if (e.type === "boolean") { if (typeof v !== "boolean") out.push({ path, problem: "not true / false" }); }
    else if (e.type === "color") { if (typeof v !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) out.push({ path, problem: "not a #rrggbb color" }); }
    else if (e.type === "enum") { if (pre === "face.parts" && typeof v === "string" && v.startsWith("image@")) { if (!(options.face?.drawn ?? []).some((d) => `image@${d.id}` === v)) out.push({ path, problem: "no drawn expression with that id (face.drawn)" }); }
      else if (!e.options.some((o) => o.value === v)) out.push({ path, problem: `not one of ${e.options.map((o) => o.value).join(", ")}` }); }
    else if (e.type === "image") { if (typeof v !== "string") out.push({ path, problem: "not an image path or data URL" }); } } };
  walk(options, "");
  return out;
}
