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
    play: "Play", pause: "Pause", speed: "Speed", pickMotion: "Choose a motion",
    tab_body: "Body", tab_face: "Face", tab_hair: "Hair", tab_outfit: "Outfit", tab_look: "Look",
    bodyType: "Body type", bodyChibi: "Chibi", bodyTall: "Tall", garment: "Garment", g_plain: "Shirt + pants", g_dress: "Dress", g_robe: "Robe", expression: "Expression", advanced: "Advanced", advancedSub: "fine-tuning", filter: "Filter by name…", noMatch: "Nothing matches",
    resetTab: "Reset this tab", resetValue: "Reset to default", diffN: (n) => n === 1 ? "1 value differs from default" : `${n} values differ from default`, diff0: "All defaults",
    cost_hair: "Rebuilds the hair", cost_clothes: "Rebuilds the clothes · about 1 s", cost_body: "Rebuilds the body · about 1 s", cost_paint: "Rebuilds · about 1 s",
    softRange: "Guessed range: you can type values outside it", auto: "Auto", load: "Load PNG…", clear: "Clear", none: "None",
    syncOn: (f) => `⇄ live with ${f}`, syncOff: (f) => `⇄ ${f}: the sync helper stopped (waiting for it)`, syncErr: "⇄ can't reach the sync helper (is node sync.mjs running?)",
    savedHere: "Saved in this browser", notSaved: "Not saved (browser storage is full or blocked)",
    new: "New", duplicate: "Duplicate", delete: "Delete", untitled: "Untitled character", copyOf: (n) => `${n} (copy)`, shared: "Shared character",
    confirmDelete: (n) => `Delete “${n}”? This can't be undone.`, imported: (n) => `Opened “${n}”`, badJson: "That file isn't a Hinagata recipe",
    edited: (t) => `edited ${t}`, justNow: "just now", minAgo: (n) => `${n} min ago`, hAgo: (n) => `${n} h ago`,
    stats: (v, b, ms) => [`${v.toLocaleString()} verts · ${b} bones`, `built in ${ms} ms`], quality: "Mesh quality", q_game: "Game (fast)", q_high: "High (detailed)",
    imageNote: "Pictures are kept in the recipe; very large ones may not fit in browser storage.",
    drawn: "Drawn parts", tplSheet: "Make a template (every expression)", tplMake: "Make a template", tplNew: "Load a drawing", tplNewTitle: "Add a drawn template PNG as a new expression (rename it below)", newExprName: "New expression", tplNewExpr: (n) => `Added “${n}”. Rename it below`, tplReadShort: "Load drawing (replaces)", tplReadInto: "Load a drawn template PNG as this expression's pictures. Only the parts drawn in it are replaced (Undo brings them back)", tplParts: "Template (normal only)", tplRead: "Load drawn template…", tplClear: "Clear all",
    tplSave: "Save", tplLongPress: "If saving doesn't work, long-press (or right-click) the picture and save it",
    tplSheetText: "One tile per expression: normal, then each expression you added. Draw one part in each red frame on a transparent layer, save only that layer as a PNG (this size) and load it. Empty frames are skipped. After adding or removing expressions, make the template again.",
    tplPartsText: "The same template for every expression. Draw one part in each red frame on a transparent layer, save only that layer as a PNG and “Load a drawing”: it becomes a new expression (rename it later). To redraw an expression, use its “Load drawing (replaces)”. Empty frames are skipped (the normal parts are used).",
    tplHelp: "Make a template, draw, and “Load a drawing”: it becomes a new expression (rename it below; add as many as you like). To redraw an expression, use its “Load drawing (replaces)”: only the parts drawn are replaced (Undo brings them back). Parts left out use the normal ones. Switch expressions with “Picture: …” above.",
    tplRead0: "Nothing was drawn in the frames", tplReadN: (n) => `Read ${n} part${n === 1 ? "" : "s"}`, tplBad: "That picture isn't a face template (4:3 or 2:1)",
    f_eye: "Eye", f_eyeClosed: "Closed", f_brow: "Brow", f_mouth: "Mouth", f_nose: "Nose", confirmClearDrawn: "Remove every drawn picture from this character? (the expressions stay)",
    pic: "Picture", normalPic: "Normal", exprName: "Expression name", newExpr: (n) => `Expression ${n}`, addExpr: "Add expression", flush: "Flush", blink: "Blinks", delExpr: "Remove",
    myHair: "My hairstyles", myHairSave: "Save this hairstyle", myHairName: "Hairstyle name", myHairN: (n) => `Hairstyle ${n}`, myHairSaved: (n) => `Saved “${n}”`, myHairDel: (n) => `Remove the hairstyle “${n}”?`,
    myHairHelp: "The whole hair (style, shapes, tufts, drawn locks; not its color), kept in this browser. Click one to put it on this character.", myHairNone: "None yet",
    drawTitle: "Drawn locks", drawOn: "Draw on the character", drawHelp: "Draw from a lock's root to its tip. Over the hair it sticks to it; elsewhere it stays flat to the view and hangs (draw from the side to bend it sideways). While drawing the camera doesn't turn: switch drawing off to turn it.",
    drawMove: "Move the drawn locks", drawMoveHelp: "Drag a dot. Blue (root): the whole lock moves. Green (middle): it bends there. Pink (tip): it turns and stretches around its root, keeping its shape.",
    drawWidth: "Width (m)", drawThick: "Thickness (× width)", drawStiff: "Keeps its shape", drawMirror: "Mirror (both sides)", drawUndo: "Remove the last", drawClear: "Remove all", drawN: (n) => `${n} locks`, drawLock: (i) => `Lock ${i}`, drawDel: "Remove",
    fpOpen: "Draw in the app", fpNew: "Draw a new expression", fpOpenShort: "Draw", fpOpenTitle: "Draw this expression's parts in the app", fpAll: "All", fpSize: "Pen", fpUndo: "Undo", fpClear: "Clear", fpApply: "Put on the face",
    fpTitle: (n) => `Drawing the parts: ${n}`, fpTitleNew: "Drawing a new expression", fpHelp: "Draw each part inside its red frame (the frame's middle is the part's middle on the face; eyes and brows on one side only). The part buttons zoom onto their frame. \"Put on the face\" uses every frame with something in it; you can keep drawing and put it on again.",
    accTitle: "Accessories", accN: (n) => `${n}`, accOn: "Put on with a click", accMirror: "Both sides", accColor: "Color", accSize: "Size (m)", accSpin: "Turn (°)",
    accHelp: "Click the character (or its hair) where it goes: it sits on that spot and moves with it.", accHelpMove: "A click moves the picked one. “Add another” lets go of it.",
    accNew: "Add another", accDel: "Take it off", acc_leaf: "Leaf", acc_gem: "Gem", acc_flower: "Flower", acc_star: "Star", acc_ball: "Ball", acc_band: "Ring (wrist, ankle, neck)",
    paintTitle: "Paint", paintOn: "Paint on the character", paintErase: "Eraser", paintHelp: "Paint with the left button on the skin or a garment (whatever you touch). The camera doesn't turn while painting: turn it with this off. Each part keeps its own paint (Advanced → paint).",
    paintColor: "Color", paintSize: "Brush size (m)", paintOpacity: "Opacity", paintSoft: "Softness", paintClear: "Clear this part's paint", paintClearQ: (k) => `Clear the paint on ${k}?`,
    paint_body: "Skin", paint_shirt: "Shirt", paint_pants: "Pants", paint_dress: "Dress", paint_cape: "Cape",
    tieTitle: "Moving the ties", tieMove: "Move the ties on the head", tieHelp: "Drag a dot: around the head (twin tails move together, mirrored) and up or down. A side tail dragged to the other side changes sides. Releasing it rebuilds the tails.",
    backTitle: "Moving the back locks", backMove: "Move back locks", backHelp: "Drag a dot: up / down makes the lock shorter or longer (down to the waist), left / right turns it around the head. Releasing it rebuilds the back hair.",
    backPick: "Click a dot to pick a lock", backNone: "With hanging short hair, short hair or long hair", backW: "Width (×)", backTh: "Thickness (×)", backFl: "Flick out (+) / curl in (−)", backReset: "Reset this lock", backResetAll: "Reset all", backN: (n) => `${n} changed`,
    bangTufts: "Moving the tufts", bangMove: "Move tufts on the face", bangHelp: "Drag a dot: left / right moves the tuft around the head, up / down moves its tip (down to the waist: below the head it hangs). Releasing it rebuilds the bangs.",
    bangPick: "Click a dot to pick a tuft", bangAdd: "Add a tuft", bangDel: "Remove this tuft", bangNeedNendo: "Tufts can be moved with the “Clumps” bangs (locks or block)",
    bangWidth: "Width (×)", bangSweep: "Sweep (°)", bangFlick: "Flick out (+) / curl in (−)", bangWave: "Wave (hanging part)", bangThick: "Extra thickness", bangN: (n) => `${n} tufts`,
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
    play: "再生", pause: "一時停止", speed: "速さ", pickMotion: "モーションを選ぶ",
    tab_body: "体", tab_face: "顔", tab_hair: "髪", tab_outfit: "服", tab_look: "見た目",
    bodyType: "体型", bodyChibi: "ちび", bodyTall: "高頭身", garment: "服のかたち", g_plain: "シャツとズボン", g_dress: "ワンピース", g_robe: "ローブ", expression: "表情", advanced: "詳細設定", advancedSub: "細かい調整", filter: "名前でしぼりこむ…", noMatch: "見つからない",
    resetTab: "このタブを戻す", resetValue: "デフォルトに戻す", diffN: (n) => `デフォルトと違う値: ${n}個`, diff0: "すべてデフォルト",
    cost_hair: "髪を作り直す", cost_clothes: "服を作り直す・約1秒", cost_body: "体を作り直す・約1秒", cost_paint: "作り直す・約1秒",
    softRange: "仮の範囲: 外の値も入力できる", auto: "自動", load: "PNGを読む…", clear: "外す", none: "なし",
    syncOn: (f) => `⇄ ${f} と同期中`, syncOff: (f) => `⇄ ${f}: 同期ヘルパーが止まった(再開を待っている)`, syncErr: "⇄ 同期ヘルパーにつながらない(node sync.mjs は動いてる?)",
    savedHere: "このブラウザに保存済み", notSaved: "保存できていない(ブラウザの保存領域がいっぱいか、使えない)",
    new: "新しく作る", duplicate: "複製", delete: "削除", untitled: "名前なし", copyOf: (n) => `${n}(コピー)`, shared: "共有されたキャラ",
    confirmDelete: (n) => `「${n}」を削除する? 元に戻せない。`, imported: (n) => `「${n}」を開いた`, badJson: "Hinagata のレシピではないファイル",
    edited: (t) => `${t}に編集`, justNow: "さっき", minAgo: (n) => `${n}分前`, hAgo: (n) => `${n}時間前`,
    stats: (v, b, ms) => [`頂点 ${v.toLocaleString()} · 骨 ${b}`, `生成 ${ms} ms`], quality: "メッシュの細かさ", q_game: "ゲーム用(速い)", q_high: "高画質(細かい)",
    imageNote: "絵はレシピの中に入る。大きすぎる絵はブラウザに保存しきれないことがある。",
    drawn: "描いたパーツ", tplSheet: "テンプレを作る(表情ぜんぶ)", tplMake: "テンプレを作る", tplNew: "描いた絵を読みこむ", tplNewTitle: "描いたテンプレのPNGを、新しい表情として足す(名前は下で変えられる)", newExprName: "新しい表情", tplNewExpr: (n) => `表情「${n}」を足した。名前は下で変えられる`, tplReadShort: "絵を読みこむ(上書き)", tplReadInto: "描いたテンプレのPNGを、この表情の絵として読みこむ。描いてある枠のパーツだけ入れかわる(元に戻すで戻せる)", tplParts: "テンプレ(ふつうだけ)", tplRead: "描いたテンプレを読む…", tplClear: "ぜんぶ外す",
    tplSave: "保存する", tplLongPress: "保存できないときは、画像を長押し(右クリック)して保存",
    tplSheetText: "表情ごとに1マス: ふつう、そのあと足した表情の順。赤い枠の中にパーツを1つずつ透明なレイヤーに描き、そのレイヤーだけをPNG(この大きさのまま)で保存して読む。描いていない枠は読まない。表情を足したり消したりしたら、テンプレを作り直す。",
    tplPartsText: "テンプレはどの表情でも同じ。赤い枠の中にパーツを1つずつ透明なレイヤーに描き、そのレイヤーだけをPNGで保存して「描いた絵を読みこむ」で読むと、新しい表情になる(名前はあとで変えられる)。今ある表情を描き直すときは、その表情の「絵を読みこむ(上書き)」で。描いていない枠は読まない(ふつうの絵を使う)。",
    tplHelp: "テンプレを作って描き、「描いた絵を読みこむ」で読むと、新しい表情になる(名前は下で変えられる。いくつでも足せる)。今ある表情を描き直すときは、その表情の「絵を読みこむ(上書き)」で(描いた枠のパーツだけ入れかわる。元に戻すで戻せる)。描かなかったパーツは ふつう の絵を使う。表情は上の「絵: …」で切りかえる。",
    tplRead0: "枠の中に何も描かれていなかった", tplReadN: (n) => `${n}個のパーツを読んだ`, tplBad: "顔のテンプレではない絵(4:3 か 2:1)",
    f_eye: "目", f_eyeClosed: "とじ目", f_brow: "眉", f_mouth: "口", f_nose: "鼻", confirmClearDrawn: "このキャラの描いた絵を全部外す?(表情は残る)",
    pic: "絵", normalPic: "ふつう", exprName: "表情の名前", newExpr: (n) => `表情${n}`, addExpr: "表情を足す", flush: "ぽっ", blink: "まばたき", delExpr: "消す",
    myHair: "マイ髪型", myHairSave: "この髪型を保存", myHairName: "髪型の名前", myHairN: (n) => `髪型${n}`, myHairSaved: (n) => `「${n}」を保存した`, myHairDel: (n) => `髪型「${n}」を消す?`,
    myHairHelp: "髪まるごと(髪型・形・ふさ・描いた毛束。色は入らない)をこのブラウザに保存。押すとこのキャラにのせる。", myHairNone: "まだない",
    drawTitle: "描いた毛束", drawOn: "キャラに描く", drawHelp: "毛束の根元から毛先へなぞる。髪の上は触れたところに貼りつき、それ以外は画面に平らなまま垂れる(横から描けば横へ曲がる)。描いているあいだはカメラが回らない。回すときは描くをオフに。",
    drawMove: "描いた毛束を動かす", drawMoveHelp: "玉を引っぱる。青(根元)=毛束ごと移動。緑(真ん中)=そこで曲げる。ピンク(毛先)=根元を軸に形のまま向きと長さを変える。",
    drawWidth: "幅(m)", drawThick: "厚み(幅に対して)", drawStiff: "形の保ちやすさ", drawMirror: "左右対称", drawUndo: "最後の1本を消す", drawClear: "全部消す", drawN: (n) => `${n}本`, drawLock: (i) => `毛束${i}`, drawDel: "消す",
    fpOpen: "アプリで描く", fpNew: "新しい表情をアプリで描く", fpOpenShort: "描く", fpOpenTitle: "この表情のパーツをアプリで描く", fpAll: "全体", fpSize: "ペン", fpUndo: "ひとつ戻す", fpClear: "全部消す", fpApply: "顔に反映",
    fpTitle: (n) => `パーツを描く: ${n}`, fpTitleNew: "新しい表情を描く", fpHelp: "赤い枠の中にパーツを描く(枠の真ん中が顔の上でパーツの真ん中。目と眉は片側だけ)。パーツのボタンでその枠を大きく表示。「顔に反映」で描いてある枠が顔に入る。続けて描いて何度でも反映できる。",
    accTitle: "アクセサリー", accN: (n) => `${n}個`, accOn: "クリックで付ける", accMirror: "左右に", accColor: "色", accSize: "大きさ(m)", accSpin: "回転(度)",
    accHelp: "キャラ(髪の上も)の付けたい所をクリック。その場所にくっついて一緒に動く。", accHelpMove: "クリックで、選んでいる小物が移動する。「もう1つ付ける」で選ぶのをやめる。",
    accNew: "もう1つ付ける", accDel: "外す", acc_leaf: "葉っぱ", acc_gem: "宝石", acc_flower: "花", acc_star: "星", acc_ball: "玉", acc_band: "輪(腕・足首・首)",
    paintTitle: "ペイント", paintOn: "キャラに描く", paintErase: "消しゴム", paintHelp: "左ボタンで、さわった所(肌や服)に描く。描いている間はカメラが回らないので、回すときはオフにする。描いた絵はパーツごとに保存される(詳細設定の「paint」)。",
    paintColor: "色", paintSize: "筆の大きさ(m)", paintOpacity: "濃さ", paintSoft: "ぼかし", paintClear: "このパーツの絵を消す", paintClearQ: (k) => `${k}に描いた絵を消す?`,
    paint_body: "肌", paint_shirt: "シャツ", paint_pants: "ズボン", paint_dress: "ワンピース", paint_cape: "マント",
    tieTitle: "結び目を動かす", tieMove: "頭の上で結び目を動かす", tieHelp: "玉を引っぱる: 頭のまわりの位置と高さ。ツインテールは左右そろって動く。サイドテールは反対側へ持っていくと結ぶ側が変わる。離すと結び髪を作り直す。",
    backTitle: "後ろ髪を1本ずつ", backMove: "後ろ髪を動かす", backHelp: "玉を引っぱる: 上下 = 毛束の長さ(腰まで) / 左右 = 頭のまわりの位置。離すと後ろ髪を作り直す。",
    backPick: "玉を押すと毛束を選べる", backNone: "後ろ髪が「ショート(たらし)」「ショート」「ロング」のときに動かせる", backW: "この毛束の幅(倍)", backTh: "この毛束の厚み(倍)", backFl: "はね(+) / 内巻き(−)", backReset: "この毛束を元に戻す", backResetAll: "全部元に戻す", backN: (n) => `${n}本 変更`,
    bangTufts: "ふさを動かす", bangMove: "顔の上でふさを動かす", bangHelp: "玉を引っぱる: 左右 = 頭のまわりの位置 / 上下 = 毛先の高さ(腰まで。頭より下は垂れる)。離すと前髪を作り直す。",
    bangPick: "玉を押すとふさを選べる", bangAdd: "ふさを足す", bangDel: "このふさを消す", bangNeedNendo: "前髪が「ふさ(毛束)」か「ふさ(かたまり)」のときに動かせる",
    bangWidth: "このふさの幅(倍)", bangSweep: "流れ(度)", bangFlick: "はね(+) / 内巻き(−)", bangWave: "うねり(垂れた部分)", bangThick: "このふさの厚さ(足す)", bangN: (n) => `ふさ ${n}本`,
    confirmDelExpr: (n) => `表情「${n}」とその絵を消す?`, tplCount: "表情の数が違うキャラのテンプレ。書き出し直して(か、表情の数を合わせて)描き直して",
  },
};

// Motion names (keys of POSES)
const POSE = {
  aPose: ["A-pose", "Aポーズ"], tPose: ["T-pose", "Tポーズ"], idle: ["Idle", "立つ"], walk: ["Walk", "歩く"], wave: ["Wave", "手をふる"], cheer: ["Cheer", "ばんざい"],
  sitChair: ["Sit", "いすに座る"], sitChairGirl: ["Sit (knees together)", "いすに座る(ひざをそろえて)"], sitFloor: ["Sit on the floor", "床に座る"], hugKnees: ["Hug knees", "体育座り"], guard: ["Guard", "構え"],
  run: ["Run", "走る"], banzai: ["Banzai", "バンザイ"], jumpCrouch: ["Jump (wind-up)", "跳ぶ(ため)"], jumpRise: ["Jump (take-off)", "跳ぶ(踏み切り)"], jumpLeap: ["Running jump", "走って跳ぶ"], jumpAir: ["Jump (in the air)", "跳ぶ(空中)"], jumpLand: ["Land", "着地"], fall: ["Fall", "落ちる"], hardLand: ["Hard landing", "強い着地"], crouch: ["Crouch", "しゃがむ"], sneak: ["Sneak (crouched walk)", "しのび足"], crawl: ["Crawl (base)", "はう構え"], mantleReach: ["Pull-up: reach", "よじ登る(手をかける)"], mantlePull: ["Pull-up: haul", "よじ登る(引き上げる)"], mantleKnee: ["Pull-up: knee on the edge", "よじ登る(ひざをかける)"], vault: ["Vault", "乗り越える"], glide: ["Glide (hanging overhead)", "滑空(頭の上の物にぶら下がる)"], swim: ["Swim (dog paddle)", "泳ぐ(犬かき)"], treadWater: ["Tread water", "立ち泳ぎ"], wade: ["Wade", "水の中を歩く"], pant: ["Out of breath", "息が上がる"], shiver: ["Shiver (cold)", "寒くて震える"], limp: ["Limp", "足を引きずる"], lookAround: ["Look around", "見回す"], listen: ["Listen", "耳をすます"], hide: ["Hide (still)", "隠れる(じっと)"], balance: ["Balance", "バランスをとる"], balanceWalk: ["Walk a narrow beam", "細い所を渡る"], slide: ["Slide down a slope", "坂をすべり降りる"], stumble: ["Stumble", "つまずく"], roll: ["Forward roll", "前転(受け身)"], hang: ["Hang from an edge", "ぶら下がる"], shimmy: ["Shimmy along an edge", "ぶら下がって横へ"], drink: ["Drink (scoop water)", "水を飲む(手ですくう)"], dive: ["Swim under water", "潜って泳ぐ"], pickUp: ["Pick up", "拾う"], carry: ["Carry in both arms", "両手で抱える"], carryWalk: ["Walk carrying", "抱えて歩く"], throw: ["Throw", "投げる"], push: ["Push", "押す"], chop: ["Chop (axe)", "斧を振る"], eat: ["Eat", "食べる"], fireDrill: ["Make fire (hand drill)", "火をおこす(きりもみ)"], sleep: ["Sleep", "眠る"], stab: ["Spear thrust", "槍で突く"], breaststroke: ["Breaststroke (one stroke)", "平泳ぎ(ひとかき)"], knockdown: ["Knocked down", "突き飛ばされる"], climb: ["Climb (base)", "よじ登る構え"], climbOver: ["Over the edge", "乗り越えてしゃがむ"],
};
// Motions played through with what they need (demos.js), and the groups of the motion list
Object.assign(POSE, {
  demoMantle: ["Pull up onto a ledge", "段によじ登る"], demoVault: ["Vault over a box", "箱を乗り越える"], demoClimb: ["Climb a wall", "壁を登る"],
  demoCrawl: ["Crawl", "はって進む"], demoJump: ["Jump", "ジャンプ"], demoHang: ["Hang and move along an edge", "縁にぶら下がって横へ"], demoGlide: ["Glide under a leaf", "葉っぱで滑空"],
});
const GROUP = {
  demo: ["Played through (with a ledge, a wall…)", "通しで見る(段や壁といっしょに)"], basic: ["Stand, walk, run", "立つ・歩く・走る"], sit: ["Sit and rest", "座る・休む"],
  jump: ["Jump and fall", "跳ぶ・落ちる"], climb: ["Climb, get over, hang", "登る・越える・ぶら下がる"], low: ["Low: crouch, crawl, hide", "かがむ・はう・隠れる"],
  water: ["Water", "水"], hands: ["With the hands", "手を使う"], fight: ["Fight", "戦う"], state: ["How the body is", "体の様子"], other: ["Other", "その他"],
};
export const groupName = (k) => (GROUP[k] ?? [k, k])[lang === "ja" ? 1 : 0];
const BODY_TYPE = { standard: ["Standard", "標準"], toddler: ["Toddler", "幼児"], girl: ["Girl", "女の子"], sturdy: ["Sturdy", "がっしり"] };

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
