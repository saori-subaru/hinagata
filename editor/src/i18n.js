// UI text in English and Japanese. Option names come from the schema (src/schema.js); this file has everything else.
// The full editor opens in English; the choice is remembered in this browser.

const T = {
  en: {
    library: "Characters", name: "Character name", undo: "Undo", redo: "Redo", close: "Close",
    copyCode: "Copy as code", export: "Export", copied: "Copied the code (only what differs from the defaults)",
    exJson: "Save recipe (JSON)", exJsonSub: "The character as an options file", exImport: "Open recipe (JSON)…", exImportSub: "Adds it to your characters",
    exLink: "Copy share link", exLinkSub: "Opens this character in the editor", exPng: "Save picture (PNG)", exPngSub: "Transparent background, current view",
    exGlb: "Save 3D model (GLB)", exGlbSub: "A-pose, without outlines (opens in Blender)",
    linkCopied: "Copied the link", linkNoImages: "Copied the link (drawn face parts are left out: too large for a link)",
    building: "Building the character…", rebuilding: "Rebuilding…", camera: "Camera", display: "Display", background: "Background", motion: "Motion",
    v_free: "Free", v_front: "Front", v_side: "Side", v_back: "Back", v_face: "Face",
    d_clay: "Clay", d_wire: "Wireframe", d_bones: "Bones", d_floor: "Floor",
    bg_warm: "Warm", bg_white: "White", bg_grey: "Grey", bg_dark: "Dark",
    play: "Play", pause: "Pause", speed: "Speed",
    tab_body: "Body", tab_face: "Face", tab_hair: "Hair", tab_outfit: "Outfit", tab_look: "Look",
    bodyType: "Body type", expression: "Expression", advanced: "Advanced", advancedSub: "fine-tuning", filter: "Filter by name…", noMatch: "Nothing matches",
    resetTab: "Reset this tab", resetValue: "Reset to default", diffN: (n) => n === 1 ? "1 value differs from default" : `${n} values differ from default`, diff0: "All defaults",
    cost_hair: "Rebuilds the hair", cost_clothes: "Rebuilds the clothes · about 1 s", cost_body: "Rebuilds the body · about 1 s", cost_paint: "Rebuilds · about 1 s",
    softRange: "Guessed range: you can type values outside it", auto: "Auto", load: "Load PNG…", clear: "Clear", none: "None",
    savedHere: "Saved in this browser", notSaved: "Not saved (browser storage is full or blocked)",
    new: "New", duplicate: "Duplicate", delete: "Delete", untitled: "Untitled character", copyOf: (n) => `${n} (copy)`, shared: "Shared character",
    confirmDelete: (n) => `Delete “${n}”? This can't be undone.`, imported: (n) => `Opened “${n}”`, badJson: "That file isn't a Hinagata recipe",
    edited: (t) => `edited ${t}`, justNow: "just now", minAgo: (n) => `${n} min ago`, hAgo: (n) => `${n} h ago`,
    stats: (v, b, ms) => [`${v.toLocaleString()} verts · ${b} bones`, `built in ${ms} ms`], quality: "Mesh quality", q_game: "Game (fast)", q_high: "High (detailed)",
    imageNote: "Pictures are kept in the recipe; very large ones may not fit in browser storage.",
    drawn: "Drawn parts", tplSheet: "Make a template (every expression)", tplMake: "Make a template", tplReadShort: "Load drawing", tplReadInto: "Load a drawn template into this expression", tplParts: "Template (normal only)", tplRead: "Load drawn template…", tplClear: "Clear all",
    tplSave: "Save", tplLongPress: "If saving doesn't work, long-press (or right-click) the picture and save it",
    tplSheetText: "One tile per expression: normal, then each expression you added. Draw one part in each red frame on a transparent layer, save only that layer as a PNG (this size) and load it. Empty frames are skipped. After adding or removing expressions, make the template again.",
    tplPartsText: "One template for every expression (the frames are in the same places). Draw one part in each red frame on a transparent layer, save only that layer as a PNG and load it with “Load drawing” on the expression it is for. Normal reads all five frames; an expression you added reads its eye, brow and mouth (the closed eye and the nose are shared). Empty frames are skipped.",
    tplHelp: "Make a template, draw, and load it with “Load drawing” on the expression it is for (only frames with something drawn are read). Add as many named expressions as you like; parts left out use the normal ones. Switch expressions with “Picture: …” above.",
    tplRead0: "Nothing was drawn in the frames", tplReadN: (n) => `Read ${n} part${n === 1 ? "" : "s"}`, tplBad: "That picture isn't a face template (4:3 or 2:1)",
    f_eye: "Eye", f_eyeClosed: "Closed", f_brow: "Brow", f_mouth: "Mouth", f_nose: "Nose", confirmClearDrawn: "Remove every drawn picture from this character? (the expressions stay)",
    pic: "Picture", normalPic: "Normal", exprName: "Expression name", newExpr: (n) => `Expression ${n}`, addExpr: "Add expression", flush: "Flush", blink: "Blinks", delExpr: "Remove",
    bangTufts: "Moving the tufts", bangMove: "Move tufts on the face", bangHelp: "Drag a dot: left / right moves the tuft around the head, up / down moves its tip. Releasing it rebuilds the bangs.",
    bangPick: "Click a dot to pick a tuft", bangAdd: "Add a tuft", bangDel: "Remove this tuft", bangNeedNendo: "Tufts can be moved with the “Clumps” bangs",
    bangSweep: "Sweep (°)", bangFlick: "Flick out (+) / curl in (−)", bangThick: "Extra thickness", bangN: (n) => `${n} tufts`,
    confirmDelExpr: (n) => `Remove the expression “${n}” and its pictures?`, tplCount: "This template was made for a different number of expressions. Write it out again (or match the expressions) and redraw",
  },
  ja: {
    library: "キャラ一覧", name: "キャラの名前", undo: "元に戻す", redo: "やり直す", close: "閉じる",
    copyCode: "コードをコピー", export: "書き出し", copied: "コードをコピーした(デフォルトと違う値だけ)",
    exJson: "レシピを保存(JSON)", exJsonSub: "キャラを options のファイルで", exImport: "レシピを開く(JSON)…", exImportSub: "キャラ一覧に足す",
    exLink: "共有リンクをコピー", exLinkSub: "このキャラをエディタで開くリンク", exPng: "画像を保存(PNG)", exPngSub: "背景は透明・いまの視点で",
    exGlb: "3Dモデルを保存(GLB)", exGlbSub: "Aポーズ・輪郭線なし(Blender で開ける)",
    linkCopied: "リンクをコピーした", linkNoImages: "リンクをコピーした(描いた顔パーツは大きすぎるので入れていない)",
    building: "キャラを組み立て中…", rebuilding: "作り直し中…", camera: "カメラ", display: "表示", background: "背景", motion: "モーション",
    v_free: "自由", v_front: "正面", v_side: "横", v_back: "後ろ", v_face: "顔",
    d_clay: "ねんど", d_wire: "網目", d_bones: "骨", d_floor: "床",
    bg_warm: "暖色", bg_white: "白", bg_grey: "グレー", bg_dark: "暗い",
    play: "再生", pause: "一時停止", speed: "速さ",
    tab_body: "体", tab_face: "顔", tab_hair: "髪", tab_outfit: "服", tab_look: "見た目",
    bodyType: "体型", expression: "表情", advanced: "詳細設定", advancedSub: "細かい調整", filter: "名前でしぼりこむ…", noMatch: "見つからない",
    resetTab: "このタブを戻す", resetValue: "デフォルトに戻す", diffN: (n) => `デフォルトと違う値: ${n}個`, diff0: "すべてデフォルト",
    cost_hair: "髪を作り直す", cost_clothes: "服を作り直す・約1秒", cost_body: "体を作り直す・約1秒", cost_paint: "作り直す・約1秒",
    softRange: "仮の範囲: 外の値も入力できる", auto: "自動", load: "PNGを読む…", clear: "外す", none: "なし",
    savedHere: "このブラウザに保存済み", notSaved: "保存できていない(ブラウザの保存領域がいっぱいか、使えない)",
    new: "新しく作る", duplicate: "複製", delete: "削除", untitled: "名前なし", copyOf: (n) => `${n}(コピー)`, shared: "共有されたキャラ",
    confirmDelete: (n) => `「${n}」を削除する? 元に戻せない。`, imported: (n) => `「${n}」を開いた`, badJson: "Hinagata のレシピではないファイル",
    edited: (t) => `${t}に編集`, justNow: "さっき", minAgo: (n) => `${n}分前`, hAgo: (n) => `${n}時間前`,
    stats: (v, b, ms) => [`頂点 ${v.toLocaleString()} · 骨 ${b}`, `生成 ${ms} ms`], quality: "メッシュの細かさ", q_game: "ゲーム用(速い)", q_high: "高画質(細かい)",
    imageNote: "絵はレシピの中に入る。大きすぎる絵はブラウザに保存しきれないことがある。",
    drawn: "描いたパーツ", tplSheet: "テンプレを作る(表情ぜんぶ)", tplMake: "テンプレを作る", tplReadShort: "描いた絵を読む", tplReadInto: "描いたテンプレを、この表情に読みこむ", tplParts: "テンプレ(ふつうだけ)", tplRead: "描いたテンプレを読む…", tplClear: "ぜんぶ外す",
    tplSave: "保存する", tplLongPress: "保存できないときは、画像を長押し(右クリック)して保存",
    tplSheetText: "表情ごとに1マス: ふつう、そのあと足した表情の順。赤い枠の中にパーツを1つずつ透明なレイヤーに描き、そのレイヤーだけをPNG(この大きさのまま)で保存して読む。描いていない枠は読まない。表情を足したり消したりしたら、テンプレを作り直す。",
    tplPartsText: "テンプレはどの表情でも同じ(枠の場所が同じ)。赤い枠の中にパーツを1つずつ透明なレイヤーに描き、そのレイヤーだけをPNGで保存して、入れたい表情の「描いた絵を読む」で読む。ふつうは5つの枠を全部、足した表情は目・眉・口を読む(とじ目と鼻は共通)。描いていない枠は読まない。",
    tplHelp: "テンプレを作って描き、入れたい表情の「描いた絵を読む」で読む(描いた枠だけ取りこむ)。表情は名前をつけていくつでも足せる。描かなかったパーツは ふつう の絵を使う。表情は上の「絵: …」で切りかえる。",
    tplRead0: "枠の中に何も描かれていなかった", tplReadN: (n) => `${n}個のパーツを読んだ`, tplBad: "顔のテンプレではない絵(4:3 か 2:1)",
    f_eye: "目", f_eyeClosed: "とじ目", f_brow: "眉", f_mouth: "口", f_nose: "鼻", confirmClearDrawn: "このキャラの描いた絵を全部外す?(表情は残る)",
    pic: "絵", normalPic: "ふつう", exprName: "表情の名前", newExpr: (n) => `表情${n}`, addExpr: "表情を足す", flush: "ぽっ", blink: "まばたき", delExpr: "消す",
    bangTufts: "ふさを動かす", bangMove: "顔の上でふさを動かす", bangHelp: "玉を引っぱる: 左右 = 頭のまわりの位置 / 上下 = 毛先の高さ。離すと前髪を作り直す。",
    bangPick: "玉を押すとふさを選べる", bangAdd: "ふさを足す", bangDel: "このふさを消す", bangNeedNendo: "前髪が「ふさ」のときに動かせる",
    bangSweep: "流れ(度)", bangFlick: "はね(+) / 内巻き(−)", bangThick: "このふさの厚さ(足す)", bangN: (n) => `ふさ ${n}本`,
    confirmDelExpr: (n) => `表情「${n}」とその絵を消す?`, tplCount: "表情の数が違うキャラのテンプレ。書き出し直して(か、表情の数を合わせて)描き直して",
  },
};

// Motion names (keys of POSES)
const POSE = {
  aPose: ["A-pose", "Aポーズ"], tPose: ["T-pose", "Tポーズ"], idle: ["Idle", "立つ"], walk: ["Walk", "歩く"], wave: ["Wave", "手をふる"], cheer: ["Cheer", "ばんざい"],
  sitChair: ["Sit", "いすに座る"], sitChairGirl: ["Sit (knees together)", "いすに座る(ひざをそろえて)"], sitFloor: ["Sit on the floor", "床に座る"], hugKnees: ["Hug knees", "体育座り"], guard: ["Guard", "構え"],
  run: ["Run", "走る"], banzai: ["Banzai", "バンザイ"], jumpCrouch: ["Jump (wind-up)", "跳ぶ(ため)"], jumpRise: ["Jump (take-off)", "跳ぶ(踏み切り)"], jumpLeap: ["Running jump", "走って跳ぶ"], jumpAir: ["Jump (in the air)", "跳ぶ(空中)"], jumpLand: ["Land", "着地"], fall: ["Fall", "落ちる"], hardLand: ["Hard landing", "強い着地"], crouch: ["Crouch", "しゃがむ"], sneak: ["Sneak (crouched walk)", "しのび足"], crawl: ["Crawl (base)", "はう構え"], mantleReach: ["Pull-up: reach", "よじ登る(手をかける)"], mantlePull: ["Pull-up: haul", "よじ登る(引き上げる)"], mantleKnee: ["Pull-up: knee on the edge", "よじ登る(ひざをかける)"], vault: ["Vault", "乗り越える"], glide: ["Glide (hanging overhead)", "滑空(頭の上の物にぶら下がる)"], swim: ["Swim (dog paddle)", "泳ぐ(犬かき)"], treadWater: ["Tread water", "立ち泳ぎ"], wade: ["Wade", "水の中を歩く"], pant: ["Out of breath", "息が上がる"], shiver: ["Shiver (cold)", "寒くて震える"], limp: ["Limp", "足を引きずる"], lookAround: ["Look around", "見回す"], listen: ["Listen", "耳をすます"], hide: ["Hide (still)", "隠れる(じっと)"], balance: ["Balance", "バランスをとる"], balanceWalk: ["Walk a narrow beam", "細い所を渡る"], slide: ["Slide down a slope", "坂をすべり降りる"], stumble: ["Stumble", "つまずく"], roll: ["Forward roll", "前転(受け身)"], hang: ["Hang from an edge", "ぶら下がる"], shimmy: ["Shimmy along an edge", "ぶら下がって横へ"], drink: ["Drink (scoop water)", "水を飲む(手ですくう)"], dive: ["Swim under water", "潜って泳ぐ"], pickUp: ["Pick up", "拾う"], carry: ["Carry in both arms", "両手で抱える"], carryWalk: ["Walk carrying", "抱えて歩く"], throw: ["Throw", "投げる"], push: ["Push", "押す"], chop: ["Chop (axe)", "斧を振る"], eat: ["Eat", "食べる"], fireDrill: ["Make fire (hand drill)", "火をおこす(きりもみ)"], sleep: ["Sleep", "眠る"], stab: ["Spear thrust", "槍で突く"], knockdown: ["Knocked down", "突き飛ばされる"], climb: ["Climb (base)", "よじ登る構え"], climbOver: ["Over the edge", "乗り越えてしゃがむ"],
};
const BODY_TYPE = { standard: ["Standard", "標準"], toddler: ["Toddler", "幼児"], kid: ["Kid", "子ども"], girl: ["Girl", "女の子"], sturdy: ["Sturdy", "がっしり"] };

let lang = "en";
try { const l = localStorage.getItem("hinagata.editor.lang"); if (l === "en" || l === "ja") lang = l; } catch {}

export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem("hinagata.editor.lang", l); } catch {} document.documentElement.lang = l; }
/** UI text: t("undo"), t("diffN", 3) */
export const t = (k, ...a) => { const v = T[lang][k] ?? T.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };
/** A { ja, en } label from the schema (falls back to English, then to the text itself) */
export const L = (l) => !l ? "" : typeof l === "string" ? l : l[lang] ?? l.en ?? "";
export const poseName = (k) => (POSE[k] ?? [k, k])[lang === "ja" ? 1 : 0];
export const bodyTypeName = (k) => (BODY_TYPE[k] ?? [k, k])[lang === "ja" ? 1 : 0];

/** Fill static text: data-i18n="key" (text) and data-i18n-label="key" (aria-label and title) */
export function translatePage(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-label]")) { el.setAttribute("aria-label", t(el.dataset.i18nLabel)); el.title = t(el.dataset.i18nLabel); }
}
