// The ball: flight with gravity (more with topspin), bounces, the net; a solver for shots and a predictor for the players.
import * as THREE from "three";
import { C, netHeight } from "./court.js";

export const G = 9.5, R = 0.05;
const BOUNCE = { top: [0.6, 0.66], flat: [0.62, 0.62], slice: [0.5, 0.55], lob: [0.66, 0.6] };   // [vertical keep, horizontal keep]
export const SPIN_G = { top: 1.45, flat: 1.0, slice: 0.85, lob: 1.0 };

export class Ball {
  constructor() { this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.reset(); }
  reset() { this.active = false; this.held = true; this.spin = "flat"; this.g = G; this.bounces = 0; this.lastHitter = null; this.serve = false; this.netTouched = false; this.toss = false; this.hits = 0; }
  launch(p, v, spin, hitter) { this.pos.copy(p); this.vel.copy(v); this.spin = spin; this.g = G * SPIN_G[spin]; this.active = true; this.held = false; this.bounces = 0; this.lastHitter = hitter; this.netTouched = false; this.toss = false; this.hits++; }
  // one step; events: { type: "bounce" | "net", ... }
  step(dt, events) {
    if (!this.active) return;
    const p = this.pos, v = this.vel, z0 = p.z;
    v.y -= this.g * dt;
    p.addScaledVector(v, dt);
    // the net (z = 0): crossing it below the tape
    if (!this.toss && Math.sign(z0) !== Math.sign(p.z) && z0 !== 0) {
      const k = z0 / (z0 - p.z), y = p.y - v.y * dt * (1 - k), x = p.x - v.x * dt * (1 - k);
      if (Math.abs(x) < C.POST + 0.05 && y - R < netHeight(x)) {
        this.netTouched = true;
        if (y > netHeight(x) - 0.05 && Math.random() < 0.6) {   // the tape: it dribbles over
          v.z *= 0.25; v.x *= 0.5; v.y = Math.abs(v.y) * 0.3 + 0.9; events.push({ type: "net", cord: true, x, y });
        } else {   // into the net: back onto the hitter's side, dropping
          p.z = Math.sign(z0) * (R + 0.02); v.z = -v.z * 0.12; v.x *= 0.3; v.y = Math.min(v.y, 0) * 0.3; events.push({ type: "net", cord: false, x, y });
        }
      }
    }
    // the ground
    if (p.y < R && v.y < 0) {
      p.y = R;
      if (this.toss) { events.push({ type: "drop" }); return; }
      const [kv, kh] = BOUNCE[this.spin] || BOUNCE.flat, speed = -v.y;
      v.y = speed > 0.6 ? speed * kv : 0; v.x *= kh; v.z *= kh;
      if (speed > 0.6) events.push({ type: "bounce", x: p.x, z: p.z, n: ++this.bounces });
      this.g = G;   // after the bounce, the spin is spent (mostly)
      if (this.spin !== "slice") this.spin = "flat";
      if (v.y === 0) { v.x *= 0.98; v.z *= 0.98; }
    }
  }
}

// velocity that takes the ball from p to (tx, tz) on the ground, at horizontal speed s, with gravity g; slowed (a higher arc) until it
// clears the net by clear. Returns { v, T }
export function solveShot(p, tx, tz, s, g, clear = 0.15, apex = 0) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  let T = d / s;
  for (let i = 0; i < 60; i++) {
    const vx = dx / T, vz = dz / T, vy = (R - p.y + 0.5 * g * T * T) / T;
    const tn = vz !== 0 ? -p.z / vz : -1;
    let ok = true;
    if (tn > 0 && tn < T) { const yn = p.y + vy * tn - 0.5 * g * tn * tn, xn = p.x + vx * tn; if (yn - R < netHeight(xn) + clear) ok = false; }
    if (apex && p.y + vy * vy / (2 * g) < apex) ok = false;
    if (ok) return { v: new THREE.Vector3(vx, vy, vz), T };
    T *= 1.05;
  }
  const vx = dx / T, vz = dz / T, vy = (R - p.y + 0.5 * g * T * T) / T;
  return { v: new THREE.Vector3(vx, vy, vz), T };
}

// where the ball will be: samples every dt for up to maxT s (stops after the 2nd bounce). Same physics as step (the net is left out
// when the ball has already crossed it toward the predicting side)
const _ev = [];
export function predict(ball, maxT = 2.5, dt = 1 / 60) {
  const b = Object.assign(Object.create(Ball.prototype), { pos: ball.pos.clone(), vel: ball.vel.clone(), active: true, toss: ball.toss, spin: ball.spin, g: ball.g, bounces: ball.bounces });
  const out = [];
  const rnd = Math.random; Math.random = () => 0.99;   // the net: assume it drops (no luck in a prediction)
  try {
    for (let t = dt; t <= maxT; t += dt) {
      _ev.length = 0; b.step(dt, _ev);
      out.push({ t, x: b.pos.x, y: b.pos.y, z: b.pos.z, vy: b.vel.y, bounces: b.bounces });
      if (b.bounces >= 2 || _ev.some((e) => e.type === "drop")) break;
    }
  } finally { Math.random = rnd; }
  return out;
}
