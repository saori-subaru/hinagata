// A tennis player: a Hinagata avatar with a racket, moved by the game, posed by one pose of its own (a mix of the ready stance, the
// engine's run, the swings and the engine's cheer / pant), so the swing is followed exactly.
import * as THREE from "three";
import { POSES, measureGait } from "../../../src/index.js";
import { stance, swingPose, mixPose, victory, CONTACT } from "./poses.js";
import { makeRacket, holdRacket } from "./racket.js";
import { C } from "./court.js";

// where the ball is best met, in the hitter's frame (lat: to its right, fwd: in front, metres of the avatar's world)
export const IDEAL = { fh: { lat: 0.72, fwd: 0.3 }, bh: { lat: -0.5, fwd: 0.38 }, smash: { lat: 0.15, fwd: 0.2 }, serve: { lat: 0.15, fwd: 0.2 } };
export const REACH = { lat: 0.55, low: 0.06, high: 1.55, smashHigh: 2.2 };
export const SWING_T = 0.36, CONTACT_T = SWING_T * CONTACT;   // the forward swing; the racket meets the ball CONTACT_T after it starts
const LEGS = ["upperLeg.L", "upperLeg.R", "lowerLeg.L", "lowerLeg.R", "foot.L", "foot.R"];

let nextId = 0;
export class Player {
  constructor(avatar, { side, name, racketColor, speed = 4.6 }) {
    this.avatar = avatar; this.side = side; this.name = name; this.maxSpeed = speed; this.id = nextId++;
    this.pos = new THREE.Vector3(0, 0, side * (C.HALF_L + 0.5)); this.vel = new THREE.Vector3(); this.want = new THREE.Vector3();
    this.yaw = this.netYaw; this.time = 0; this.runT = 0; this.wRun = 0; this.wSwing = 0;
    this.mode = "play"; this.swing = null; this.out = stance(0); this.charge = 0;
    this.racket = makeRacket(racketColor);
    this.hold = holdRacket(avatar, this.racket);
    this.gait = Math.max(0.5, measureGait(avatar, "run"));   // units/s at playback speed 1 (measured once)
    const poseName = `tennis${this.id}`;
    POSES[poseName] = () => ({ ...this.out, grip: { R: 1, L: this.mode === "play" ? 0.4 : this.mode === "victory" ? 1 : 0.2 }, sharp: true });
    avatar.play(poseName);
    avatar.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  get netYaw() { return this.side > 0 ? Math.PI : 0; }
  // the ball in my frame
  rel(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return { lat: dx * this.side, fwd: -dz * this.side, y: p.y }; }
  // a world point from my frame
  world(lat, fwd, y = 0) { return new THREE.Vector3(this.pos.x + lat * this.side, y, this.pos.z - fwd * this.side); }
  place(x, z, yaw = this.netYaw) { this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.avatar.object.position.copy(this.pos); this.avatar.object.rotation.y = yaw; }
  setMove(x, z, k = 1) { this.want.set(x, 0, z); const l = this.want.length(); if (l > 1) this.want.divideScalar(l); this.want.multiplyScalar(k); }

  // swings: wind up (held while the ball comes: a charge), then the forward swing
  windup(kind, h = 0.4) { if (this.swing && this.swing.phase === "swing") return; this.swing = { kind, phase: "windup", t: 0, h, hit: false }; }
  release(kind = this.swing?.kind ?? "fh", h = this.swing?.h ?? 0.4) {
    if (this.swing?.phase === "swing") return;
    const held = this.swing?.phase === "windup" && this.swing.kind === kind ? this.swing.t : 0;
    this.swing = { kind, phase: "swing", t: 0, h, hit: false, held };
  }
  get swinging() { return this.swing?.phase === "swing"; }
  get busy() { return !!this.swing; }

  // per physics step: moving and the swing's clock
  tick(dt, bounds) {
    const slow = this.swing ? (this.swing.phase === "windup" ? 0.55 : 0.25) : 1;
    const target = this.want.clone().multiplyScalar(this.maxSpeed * slow);
    const acc = 26 * dt; const dv = target.sub(this.vel); if (dv.length() > acc) dv.setLength(acc); this.vel.add(dv);
    this.pos.addScaledVector(this.vel, dt);
    if (bounds) { this.pos.x = THREE.MathUtils.clamp(this.pos.x, bounds.x0, bounds.x1); this.pos.z = THREE.MathUtils.clamp(this.pos.z, bounds.z0, bounds.z1); }
    if (this.swing) { this.swing.t += dt; if (this.swing.phase === "windup") this.charge = Math.min(1, this.swing.t / 0.9); if (this.swing.phase === "swing" && this.swing.t > SWING_T + 0.12) { this.swing = null; this.charge = 0; } }
  }
  // per frame: facing, the pose, the avatar
  update(dt, camera) {
    this.time += dt;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    // facing: toward the net while ready / swinging, along the run when running far
    let yawT = this.netYaw;
    if (this.mode === "play" && !this.swing && speed > 1.8) yawT = Math.atan2(this.vel.x, this.vel.z);
    if (this.mode !== "play") yawT = this.faceYaw ?? this.netYaw;
    let dy = ((yawT - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.yaw += dy * Math.min(1, dt * 12);
    // pose
    const runK = this.mode === "play" && speed > 0.7 && !(this.swing && this.swing.phase === "swing") ? 1 : 0;
    this.wRun += (runK - this.wRun) * Math.min(1, dt * 10);
    this.runT += dt * Math.max(0.6, speed) / this.gait * (runK ? 1 : 0.5);
    let target_;
    if (this.mode === "cheer") target_ = POSES.cheer(this.time);
    else if (this.mode === "victory") target_ = victory(this.time);
    else if (this.mode === "sad") target_ = POSES.pant ? POSES.pant(this.time) : stance(this.time, 0);
    else if (this.mode === "idle") target_ = POSES.idle(this.time);
    else if (this.mode === "wave") target_ = POSES.wave(this.time);
    else {
      const run = POSES.run(this.runT);
      // moving sideways while ready: the run's legs under a ready upper body (a shuffle) when facing the net
      let base = mixPose(stance(this.time, 1 - this.wRun), run, this.wRun);
      if (this.swing) {
        const s = this.swing, u = s.phase === "windup" ? 0 : Math.min(1, s.t / SWING_T);
        const sp = swingPose(s.kind, u, s.h);
        const b = { ...sp.b };
        for (const k of LEGS) if (base.b[k] || sp.b[k]) b[k] = mixPose({ b: { x: base.b[k] || [0, 0, 0] } }, { b: { x: sp.b[k] || [0, 0, 0] } }, 1 - this.wRun).b.x;
        base = { b, y: sp.y * (1 - this.wRun) + base.y * this.wRun };
      }
      target_ = base;
    }
    const exact = this.swing?.phase === "swing" && this.swing.t > 0.05;
    this.out = mixPose(this.out, { b: target_.b, y: target_.y ?? 0 }, exact ? 1 : 1 - Math.exp(-dt * (this.swing ? 22 : 14)));
    const o = this.avatar.object; o.position.copy(this.pos); o.rotation.y = this.yaw;
    this.avatar.update(dt, { camera });
  }
  // the centre of the strings, in the world
  sweet() { return this.hold.sweet.getWorldPosition(new THREE.Vector3()); }
  setFace(f) { try { this.avatar.setFace(f); } catch { /* an expression this character doesn't have */ } }
}
