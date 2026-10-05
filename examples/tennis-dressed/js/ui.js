// HTML の HUD（スコアボード・メッセージ・パワーゲージなど）
const $ = (id) => document.getElementById(id);
const DEFAULT_HINT = '移動: WASD / 矢印　ショット: J・スペース（長押しで強打）　ロブ: K　スライス: L　カメラ: C　一時停止: P';

function ptsLabel(a, b) {
  if (a >= 3 && b >= 3) return a > b ? 'AD' : '40';
  return ['0', '15', '30', '40'][Math.min(a, 3)];
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), title: $('title'), pause: $('pause'), result: $('result'),
      msg: $('message'), msgMain: $('msg-main'), msgSub: $('msg-sub'),
      speed: $('speed'), power: $('power'), powerFill: $('power-fill'), hint: $('hint'), cam: $('cam'),
      rows: [$('row-p'), $('row-c')], resultTitle: $('result-title'), resultSub: $('result-sub'),
    };
    this.msgTimer = null;
  }

  show(name, v) { this.el[name].classList.toggle('hidden', !v); }

  setScore(g) {
    const ath = [g.p, g.c];
    for (let i = 0; i < 2; i++) {
      const row = this.el.rows[i];
      row.querySelector('.name').textContent = ath[i].name;
      row.querySelector('.games').textContent = g.games[i];
      row.querySelector('.pts').textContent = ptsLabel(g.points[i], g.points[1 - i]);
      row.querySelector('.srv').classList.toggle('on', g.server === ath[i]);
    }
  }

  message(main, sub = '', dur = 1.6) {
    const e = this.el;
    e.msgMain.textContent = main;
    e.msgSub.textContent = sub || '';
    e.msg.classList.add('show');
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => e.msg.classList.remove('show'), dur * 1000);
  }

  clearMessage() {
    clearTimeout(this.msgTimer);
    this.el.msg.classList.remove('show');
  }

  speed(kmh, label) {
    this.el.speed.innerHTML = `<b>${kmh}</b> km/h<span>${label || ''}</span>`;
  }

  power(v) {
    if (v === null || v === undefined) { this.el.power.classList.remove('show'); return; }
    this.el.power.classList.add('show');
    this.el.powerFill.style.width = `${Math.round(v * 100)}%`;
  }

  hint(text) { this.el.hint.textContent = text || DEFAULT_HINT; }
  camLabel(text) { this.el.cam.textContent = text; }

  showResult(title, sub, win) {
    this.el.resultTitle.textContent = title;
    this.el.resultTitle.classList.toggle('win', !!win);
    this.el.resultSub.textContent = sub;
    this.show('result', true);
  }
}
