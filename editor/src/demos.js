// Motions played through, with what they need around them (2026-10-05, Saori: "乗り越えるとかよじ登るとか…動きじゃなくて静止ポーズしか
// 見えない"). Pulling up, vaulting, climbing, crawling, jumping, hanging and gliding are made of poses that a game strings together:
// it times them, moves the body (up the ledge, over the log) and puts the hands and feet on what is there with IK (src/motion/ik.js).
// Picked one by one in the editor, each stood frozen, the hands in the air. Here each is played the way the forest game (genseirin,
// player.js / climbpose.js / main.js) plays it — the same steps, timings, paths and IK — with a ledge, a box, a wall or a leaf in the view.
// The game's numbers are metres for its 0.86 m character; here they are scaled to this character (U: avatar units per game metre).
import * as THREE from "three";
import { measureBody, climbLimbs, crawlLimbs, holdPole, LIMBS, ik2 } from "hinagata/index.js";

const SIDE = [1, 0.3, -0.12], BEHIND = [0.9, 0.4, -1.3], QUARTER = [1.15, 0.33, 2.75];   // camera directions (QUARTER: the free view; BEHIND: over the shoulder, at the wall)
const ease = (x) => x * x * (3 - 2 * x), heavy = (x) => x * x * x * (x * (6 * x - 15) + 10), lerp = (a, b, k) => a + (b - a) * k;
const GAME_H = 0.86;   // the forest's character height (m)
const RIGHT = new THREE.Vector3(-1, 0, 0), OUT = new THREE.Vector3(0, 0, -1), FWD = new THREE.Vector3(0, 0, 1);   // the body faces +z: its right is -x
const _p = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Vector3();

// steps: [[name, seconds], ...] → which step at time t (looping), and how far into it (0-1)
function stepAt(steps, t) {
  const total = steps.reduce((s, x) => s + x[1], 0); let r = ((t % total) + total) % total;
  for (const [name, d] of steps) { if (r < d) return { name, u: r / d }; r -= d; }
  return { name: steps[steps.length - 1][0], u: 1 };
}
// both hands onto an edge (the forest's mantle / hang hands): either side of `edge` along the body's right, the elbows out and down
function handsOnEdge(av, D, edge, sway = 0) {
  av.object.updateMatrixWorld(true);
  for (const name of ["hand.L", "hand.R"]) {
    const L = LIMBS[name], lat = -L.side * D.shX * 1.2 + sway * L.side;
    _p.copy(edge).addScaledVector(RIGHT, lat);
    av.bones[L.root].getWorldPosition(_pole); _pole.addScaledVector(RIGHT, -L.side * 0.3); _pole.y -= 0.3;
    ik2(av.bones, L, _p, _pole);
  }
}

export function createDemos(scene) {
  const wood = new THREE.MeshToonMaterial({ color: 0xb59a7b }), stone = new THREE.MeshToonMaterial({ color: 0xa9a49b }), groove = new THREE.MeshToonMaterial({ color: 0x8c877f });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x6fa35a, side: THREE.DoubleSide }), stalkMat = new THREE.MeshToonMaterial({ color: 0x55803f });
  const box = (mat, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };
  const props = new THREE.Group(); scene.add(props);
  let M = null;   // the body measured for the demos: { av, D, U }
  const measure = (av) => {
    if (M?.av === av) return M;
    const D = measureBody(av); av.object.updateMatrixWorld(true);
    const h = new THREE.Box3().setFromObject(av.object).getSize(_q).y;
    return (M = { av, D, U: h / GAME_H });
  };
  const clear = () => { for (const c of [...props.children]) { props.remove(c); c.traverse((o) => o.geometry?.dispose()); } };

  // each demo: build(M) makes the props and returns what step() needs; step(av, S, t, dt) poses the body for time t.
  // view: where the camera looks (target height and distance, in this character's heights) and from where (a direction; the side for
  // what has a ledge or a wall in front, else the front view would look at the box); floor: false hides the floor
  const DEMOS = {
    // pull up onto a ledge at shoulder height: reach → haul (slow to start, as if heavy) → a knee on the edge → crouched on top → stand
    demoMantle: {
      view: [0.75, 1.25, SIDE],
      build({ D, U }) {
        const H = D.shY, ez = 0.1 * U, E = new THREE.Vector3(0, H + 0.02 * U, ez), T = new THREE.Vector3(0, H, ez + 0.35 * U), z0 = -0.3 * U;
        const b = box(stone, 1.3, H, 0.9); b.position.set(0, H / 2, ez + 0.45 + z0); props.add(b);
        const h = H / U, steps = [["wait", 0.7], ["reach", 0.22], ["pull", 0.3 + 0.55 * h], ["knee", 0.3], ["stand", 0.34], ["top", 1.0]];
        return { E, T, F: new THREE.Vector3(0, 0, 0), steps, hipY: E.y - 0.32 * U, U, z0 };
      },
      step(av, S, t, dt, D) {
        const { name, u } = stepAt(S.steps, t), F = S.F, T = S.T, at = (k, y) => av.object.position.set(0, y, lerp(F.z, T.z, k) + S.z0);
        const pose = { wait: "idle", reach: "mantleReach", pull: "mantlePull", knee: "mantleKnee", stand: "crouch", top: "idle" }[name];
        if (name === "wait") at(0, 0);
        else if (name === "reach") at(0, -0.03 * S.U * Math.sin(Math.PI * u));
        else if (name === "pull") at(0.2 * ease(u), lerp(F.y, Math.max(F.y, S.hipY), heavy(u)));
        else if (name === "knee") at(0.2 + 0.35 * ease(u), lerp(Math.max(F.y, S.hipY), T.y, ease(u)));
        else if (name === "stand") at(0.55 + 0.45 * ease(u), T.y);
        else at(1, T.y);
        av.update(dt, { t, pose, instant: S.last === "top" && name === "wait" }); S.last = name;
        if (name === "reach" || name === "pull" || name === "knee") handsOnEdge(av, D, _q.copy(S.E).setZ(S.E.z + S.z0));
      },
    },
    // over something low: hands on it, the body lifted and the legs swung to the side over it, landing on the knees
    demoVault: {
      view: [0.5, 1.3, SIDE],
      build({ D, U }) {
        const H = 0.22 * U, zf = 0.13 * U, dep = 0.22 * U, z0 = -(zf + dep / 2);
        const b = box(wood, 0.9, H, dep); b.position.set(0, H / 2, zf + dep / 2 + z0); props.add(b);
        const h = H / U, steps = [["wait", 0.7], ["reach", 0.14], ["vault", 0.34 + 0.25 * h], ["land", 0.26], ["after", 0.9]];
        return { E: new THREE.Vector3(0, H + 0.02 * U, zf + 0.04 * U + z0), F: new THREE.Vector3(0, 0, z0), T: new THREE.Vector3(0, 0, zf + dep + 0.3 * U + z0), steps, U };
      },
      step(av, S, t, dt, D) {
        const { name, u } = stepAt(S.steps, t), F = S.F, T = S.T, E = S.E, at = (k, y) => av.object.position.set(0, y, lerp(F.z, T.z, k));
        if (name === "wait") at(0, 0);
        else if (name === "reach") at(0, -0.02 * S.U * Math.sin(Math.PI * u));
        else if (name === "vault") { const k = ease(u), peak = Math.max(F.y, T.y, E.y + 0.05 * S.U); at(k, lerp(F.y, T.y, k) + (peak - lerp(F.y, T.y, 0.5)) * Math.sin(Math.PI * Math.min(1, u * 1.15))); }
        else at(1, 0);
        const pose = { wait: "idle", reach: "mantleReach", vault: "vault", land: "jumpLand", after: "idle" }[name];
        av.update(dt, { t, pose, instant: S.last === "after" && name === "wait" }); S.last = name;
        if (name === "reach" || (name === "vault" && u < 0.55)) handsOnEdge(av, D, E);
      },
    },
    // climbing a wall, hand and foot one at a time. Played in place (as the walk is): the wall's stones slide down instead
    demoClimb: {
      view: [0.75, 1.35, BEHIND], floor: false,
      build({ D, U }) {
        const W = 0.17 * U, wall = new THREE.Group(), gap = 0.16, Y0 = 0.35 * U;
        const w = box(stone, 1.4, 4, 0.1); w.position.set(0, 1.2, W + 0.05); wall.add(w);
        const rows = new THREE.Group(); for (let i = -4; i < 20; i++) { const g = box(groove, 1.4, 0.012, 0.01); g.position.set(0, i * gap, W - 0.001); g.castShadow = false; rows.add(g); }
        wall.add(rows); props.add(wall);
        return { W, Y0, rows, gap, step: D.arm * 0.7, rate: 3.2, U, phase: 0 };   // the game: a cycle carries the body 0.7 of an arm, 3.2 cycles a second
      },
      step(av, S, t, dt, D) {
        S.phase += dt * S.rate;
        const w = Math.sin(S.phase * Math.PI * 2);   // the body leans toward the hand that reaches (once each way per cycle)
        av.object.position.set(w * 0.015 * S.U, S.Y0, 0); av.object.rotation.z = w * 0.06;
        S.rows.position.y = -((S.phase * S.step) % S.gap);
        av.update(dt, { t, pose: "climb" });
        const pos = av.object.position;
        climbLimbs(av, { body: D, phase: S.phase, step: S.step, dir: { s: 0, h: 1 }, right: RIGHT, out: OUT,
          place: (lat, up, lift, out) => out.set(pos.x + RIGHT.x * lat, pos.y + up, S.W - 0.02 * S.U - lift) });
      },
      end(av) { av.object.rotation.z = 0; },
    },
    // on hands and knees, one limb at a time (in place, as the walk)
    demoCrawl: {
      view: [0.25, 1.1, QUARTER],
      build({ D }) { return { phase: 0, step: D.arm * 0.8, rate: 1.8 }; },
      step(av, S, t, dt, D) {
        S.phase += dt * S.rate; av.object.position.set(0, 0, 0);
        av.update(dt, { t, pose: "crawl" });
        crawlLimbs(av, { body: D, phase: S.phase, step: S.step, fwd: FWD, right: RIGHT, ground: () => 0 });
      },
    },
    // a jump on the spot: the wind-up, taking off, the top, the landing
    demoJump: {
      view: [0.7, 1.15, QUARTER],
      build({ U }) { const h = 0.3 * U, g = 9.8 * U, v = Math.sqrt(2 * g * h); return { g, v, air: 2 * v / g, U }; },
      step(av, S, t, dt) {
        const steps = [["wait", 0.8], ["crouch", 0.16], ["air", S.air], ["land", 0.22], ["after", 0.5]], { name, u } = stepAt(steps, t);
        let y = 0, pose = "idle";
        if (name === "crouch") pose = "jumpCrouch";
        else if (name === "air") { const a = u * S.air, vy = S.v - S.g * a; y = S.v * a - 0.5 * S.g * a * a; pose = vy > S.v * 0.35 ? "jumpRise" : "jumpAir"; }
        else if (name === "land") pose = "jumpLand";
        av.object.position.set(0, Math.max(0, y), 0);
        av.update(dt, { t, pose });
      },
    },
    // hanging from an edge by the hands, moving along it and back
    demoHang: {
      view: [0.9, 1.45, BEHIND],
      build({ D, U }) {
        const reach = D.shY + D.arm * 0.92, Ey = reach + 0.12 * U, zf = 0.16 * U;
        const b = box(stone, 1.6, Ey, 0.5); b.position.set(0, Ey / 2, zf + 0.25); props.add(b);
        return { E: new THREE.Vector3(0, Ey + 0.02 * U, zf + 0.02 * U), y: Ey - reach, z: zf + 0.02 * U - 0.16 * U, v: 0.35 * U, U };
      },
      step(av, S, t, dt, D) {
        // hang, along to the right, hang, back past the start to the left, hang, back to the start (the game: 0.35 m/s)
        const steps = [["hang", 1.0], ["right", 0.9], ["hang", 0.6], ["left", 1.8], ["hang", 0.6], ["right", 0.9]];
        let r = t % steps.reduce((a, x) => a + x[1], 0), along = 0, moved = 0, s = 0;
        for (const [name, d] of steps) { const k = Math.min(r, d), dir = name === "right" ? 1 : name === "left" ? -1 : 0; along += dir * k; moved += Math.abs(dir) * k; if (r < d) { s = dir; break; } r -= d; }
        const x = RIGHT.x * along * S.v, phase = moved * S.v / (0.12 * S.U);   // the hands take turns going first, as the game's
        av.object.position.set(x, S.y, S.z);
        av.update(dt, { t, pose: s ? "shimmy" : "hang" });
        handsOnEdge(av, D, _q.copy(S.E).setX(x), s ? Math.sin(phase * Math.PI) * 0.05 * S.U : 0);
      },
    },
    // gliding, hanging from a big leaf held overhead by its stalk
    demoGlide: {
      view: [1.05, 1.5, QUARTER],
      build({ U }) {
        // the forest's leaf (genseirin leaf.js): a round leaf like a butterbur's, a notch at the back, its rim drooping into an umbrella; held by
        // the stalk in front of the chin, the leaf over the head (the short arms can't reach over it). Origin: where the hands hold it
        const R = 0.62 * U, STEM = 0.5 * U, LEAN = 0.12 * U, NR = 9, NA = 48, pos = [], idx = [];
        const rim = (phi) => R * (1 - 0.6 * Math.exp(-(((phi - Math.PI) / 0.3) ** 2))) * (1 + 0.035 * Math.sin(phi * 9));
        for (let i = 0; i <= NR; i++) for (let j = 0; j <= NA; j++) { const phi = j / NA * Math.PI * 2, rho = i / NR, r = rim(phi) * rho;
          pos.push(Math.sin(phi) * r, STEM - 0.3 * R * rho * rho + 0.02 * U * Math.sin(phi * 9) * rho, LEAN + Math.cos(phi) * r); }
        for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        const leaf = new THREE.Group(), blade = new THREE.Mesh(g, leafMat); blade.castShadow = true; leaf.add(blade);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.06 * U, 0), new THREE.Vector3(0, STEM * 0.5, LEAN * 0.4), new THREE.Vector3(0, STEM, LEAN));
        leaf.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.011 * U, 6), stalkMat));
        props.add(leaf);
        return { leaf, U };
      },
      step(av, S, t, dt, D) {
        const y = 0.3 * S.U + Math.sin(t * 1.3) * 0.03 * S.U;
        av.object.position.set(0, y, 0);
        av.update(dt, { t, pose: "glide" });
        S.leaf.position.set(0, y + D.shY + D.arm * 0.25, D.arm * 0.8); S.leaf.rotation.set(0.12, 0, 0);
        S.leaf.updateMatrixWorld(true);
        holdPole(av, { at: S.leaf.position, up: _q.set(0, 1, 0).applyQuaternion(S.leaf.quaternion), right: RIGHT });
      },
    },
  };

  let cur = null, S = null, T = 0;
  return {
    names: Object.keys(DEMOS),
    has: (k) => !!DEMOS[k],
    get active() { return cur; },
    /** which demo to play (null: none). The props are made for the avatar's size at the next step */
    set(name, av) { if (cur && av) { DEMOS[cur].end?.(av); av.object.position.set(0, 0, 0); } clear(); cur = DEMOS[name] ? name : null; S = null; T = 0; M = null; },
    /** the camera for the demo: { y: target height, d: distance (avatar units), dir: from where } (null: no demo) */
    view(av) { if (!cur || !av) return null; const { U } = measure(av), [y, d, dir] = DEMOS[cur].view; return { y: y * GAME_H * U, d: d * GAME_H * U, dir }; },
    floor() { return !cur || DEMOS[cur].floor !== false; },
    /** each frame instead of avatar.update(dt) */
    step(av, dt) {
      if (!cur) return false;
      const m = measure(av);
      if (!S) { clear(); S = DEMOS[cur].build(m); T = 0; }
      T += dt; DEMOS[cur].step(av, S, T, dt, m.D);
      return true;
    },
    /** the avatar was rebuilt: measure it again and remake the props */
    reset(av) { if (cur && av) DEMOS[cur].end?.(av); M = null; S = null; },
  };
}
