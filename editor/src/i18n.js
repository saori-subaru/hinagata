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
  },
};

// Motion names (keys of POSES)
const POSE = {
  aPose: ["A-pose", "Aポーズ"], tPose: ["T-pose", "Tポーズ"], idle: ["Idle", "立つ"], walk: ["Walk", "歩く"], wave: ["Wave", "手をふる"], cheer: ["Cheer", "ばんざい"],
  sitChair: ["Sit", "いすに座る"], sitFloor: ["Sit on the floor", "床に座る"], hugKnees: ["Hug knees", "体育座り"],
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
