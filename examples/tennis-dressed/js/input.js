// キーボードとタッチ入力
const SHOT_KEYS = { KeyJ: 'top', Space: 'top', KeyK: 'lob', KeyL: 'slice' };
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor() {
    this.down = new Set();
    this.listeners = { press: [], release: [], key: [] };
    this.touch = { x: 0, y: 0 };

    const typing = (e) => e.target?.closest?.('textarea, input');   // 入力欄に打っている文字はゲームの操作にしない
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (BLOCK.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      const shot = SHOT_KEYS[e.code];
      if (shot) this.emit('press', shot);
      this.emit('key', e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (typing(e)) return;
      if (BLOCK.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
      const shot = SHOT_KEYS[e.code];
      if (shot) this.emit('release', shot);
    });
    window.addEventListener('blur', () => {
      for (const code of this.down) {
        const shot = SHOT_KEYS[code];
        if (shot) this.emit('release', shot);
      }
      this.down.clear();
    });
  }

  on(type, fn) { this.listeners[type].push(fn); }
  emit(type, arg) { for (const fn of this.listeners[type]) fn(arg); }

  // x: 右が正 / y: 奥（ネット方向）が正
  axis() {
    const d = this.down;
    let x = 0, y = 0;
    if (d.has('ArrowLeft') || d.has('KeyA')) x -= 1;
    if (d.has('ArrowRight') || d.has('KeyD')) x += 1;
    if (d.has('ArrowUp') || d.has('KeyW')) y += 1;
    if (d.has('ArrowDown') || d.has('KeyS')) y -= 1;
    x += this.touch.x;
    y += this.touch.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  bindTouch(stick, knob, buttons) {
    let id = null, cx = 0, cy = 0;
    const R = 55;
    const reset = () => {
      id = null;
      this.touch.x = this.touch.y = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.setPointerCapture(id);
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      this.touch.x = dx / R;
      this.touch.y = -dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', reset);
    stick.addEventListener('pointercancel', reset);
    for (const b of buttons) {
      const shot = b.dataset.shot;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); this.emit('press', shot); });
      const up = () => { b.classList.remove('on'); this.emit('release', shot); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', () => { if (b.classList.contains('on')) up(); });
    }
  }
}
