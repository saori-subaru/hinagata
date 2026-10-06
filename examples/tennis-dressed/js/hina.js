// プリミティブの選手（character.js）に雛形のキャラを着せる（雛形の avatar.follow）。
// 選手のアニメーションはそのまま character.js が計算し、雛形がその関節の動きと位置を毎フレームなぞる。
import { createAvatar, openRecipe } from 'hinagata';

export async function dressInHinagata(char, recipe, { camera, racket = true }) {
  const av = await createAvatar(recipe);
  const j = char.joints;

  // 着せ替えの基準: 人形の静止姿勢（関節はまっすぐ、腰は 1.0 m）
  const saved = Object.entries(j).map(([k, o]) => [o, o.rotation.clone()]), py = char.pelvis.position.y;
  for (const o of Object.values(j)) o.rotation.set(0, 0, 0);
  char.pelvis.position.y = 1.0;
  const follower = av.follow({
    hips: j.pelvis, spine: j.spine, head: j.head,
    'upperArm.L': j.shL, 'lowerArm.L': j.elL, 'hand.L': j.haL, 'upperArm.R': j.shR, 'lowerArm.R': j.elR, 'hand.R': j.haR,
    'upperLeg.L': j.hipL, 'lowerLeg.L': j.knL, 'foot.L': j.anL, 'upperLeg.R': j.hipR, 'lowerLeg.R': j.knR, 'foot.R': j.anR,
  }, { root: char.root, fit: { height: 1.72 }, grip: racket ? { R: 1, L: 0.15 } : null });   // 身長 1.72 m に（ちびキャラでも同じ背丈）
  for (const [o, r] of saved) o.rotation.copy(r);
  char.pelvis.position.y = py;
  if (racket && char.racket) follower.attach(char.racket, 'hand.R');

  // 着せ替え直し（自分のキャラに替えたとき）: 前の雛形は片付ける
  if (char.hina) { char.hina.object.removeFromParent(); char.hina.dispose(); }
  char.hina = av;
  char.root.parent.add(av.object);

  if (!char.plain) {   // 人形のメソッドを一度だけ包む（中身は今の char.hina を使う）
    char.plain = { update: char.update.bind(char), setMood: char.setMood.bind(char), reset: char.reset.bind(char) };
    char.update = (dt, ...rest) => { char.plain.update(dt, ...rest); char.hina.update(dt, { camera }); };
    // サーブのトス: ボールは雛形の左手に
    char.leftHandWorld = (v) => { char.hina.object.updateMatrixWorld(true); return char.hina.bones['hand.L'].getWorldPosition(v); };
    // 喜ぶ・がっかりするときは、そのキャラの表情セットの顔で
    char.setMood = (kind) => { char.plain.setMood(kind); char.hina.setFace(kind === 'celebrate' ? 'happy' : kind === 'dejected' ? 'sad' : 'normal'); };
    char.reset = () => { char.plain.reset(); char.hina.setFace('normal'); };
  }
  char.update(0);
  return av;
}

/** エディタから持ってきたキャラ: 「書き出し → リンクをコピー」のリンク、書き出した JSON、「コードをコピー」のコード、どれでも */
export function recipeFromText(text) {
  text = text.trim();
  if (!text) return null;
  const m = text.match(/[?&]o=([^&#\s]+)/);
  if (m) return openRecipe(JSON.parse(decodeURIComponent(m[1])), { bare: 1 }).options;   // リンク: 版つきのファイル形か、2026-10-06 より前のリンク（ちびの既定）
  const at = text.indexOf('createAvatar(');   // 「コードをコピー」のコード: import { … } の後ろの createAvatar({ … }) の中身
  const a = text.indexOf('{', at < 0 ? 0 : at), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('キャラの形式が読めません');
  const o = JSON.parse(text.slice(a, b + 1));
  return openRecipe(o, { bare: at < 0 ? 1 : undefined }).options;   // 書き出した JSON は版つき（{ hinagata, name, options }）。「コードをコピー」のコードは今の既定、版のない JSON だけなら 2026-10-06 より前の物（ちびの既定）
}
