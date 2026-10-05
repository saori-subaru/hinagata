// Keyboard and touch: a move vector (screen right / up) and two buttons (shot, lob), with "pressed this frame" edges.
export function createInput() {
  const keys = new Set(), edges = new Set();
  const touch = { x: 0, y: 0, active: false };
  const MAP = { shot: ["Space", "KeyJ", "KeyZ", "Enter"], lob: ["KeyK", "KeyX", "ShiftLeft", "ShiftRight"] };
  addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  // touch: a stick on the left, two buttons on the right (shown on touch devices)
  const pad = document.getElementById("touch"), stick = document.getElementById("stick"), knob = document.getElementById("knob");
  if (pad) {
    let id = null, cx = 0, cy = 0;
    stick.addEventListener("pointerdown", (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
    const move = (e) => { if (e.pointerId !== id) return; let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      touch.x = dx; touch.y = -dy; touch.active = true; knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; };
    stick.addEventListener("pointermove", move);
    const up = (e) => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; touch.active = false; knob.style.transform = ""; };
    stick.addEventListener("pointerup", up); stick.addEventListener("pointercancel", up);
    for (const b of pad.querySelectorAll("[data-btn]")) {
      const code = b.dataset.btn === "shot" ? "TouchShot" : "TouchLob";
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); edges.add(code); keys.add(code); b.classList.add("on"); });
      const off = () => { keys.delete(code); b.classList.remove("on"); };
      b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("pointerleave", off);
    }
  }
  MAP.shot.push("TouchShot"); MAP.lob.push("TouchLob");
  const any = (codes) => codes.some((c) => keys.has(c));
  return {
    // x: right, y: up (toward the far side of the screen)
    move() {
      let x = (any(["ArrowRight", "KeyD"]) ? 1 : 0) - (any(["ArrowLeft", "KeyA"]) ? 1 : 0);
      let y = (any(["ArrowUp", "KeyW"]) ? 1 : 0) - (any(["ArrowDown", "KeyS"]) ? 1 : 0);
      if (touch.active) { x = touch.x; y = touch.y; }
      return { x, y };
    },
    down: (b) => any(MAP[b]),
    pressed: (b) => MAP[b].some((c) => edges.has(c)),
    key: (code) => edges.has(code),
    endFrame() { edges.clear(); },
  };
}
