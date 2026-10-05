// The court, the net and the stadium around them. Units: the avatars' (about 1.35 tall), the court scaled to match (a real court is
// about 13.5 player-heights long: so is this one). The net is at z = 0; the human plays on +z (near the camera), the CPU on -z.
import * as THREE from "three";

export const C = {
  HALF_L: 9,          // net to baseline
  HALF_W: 3.15,       // singles sideline
  DBL_W: 4.15,        // doubles sideline (drawn only)
  SERVICE: 4.85,      // net to service line
  POST: 4.6,          // net posts
  NET_H: 0.7,         // net height at the centre
};
export const netHeight = (x) => C.NET_H + 0.09 * Math.min(1, (x / C.POST) ** 2);

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildCourt(scene) {
  const g = new THREE.Group(); scene.add(g);
  // the ground around (green) and the court (blue), drawn in one texture with its lines so they stay crisp
  const PX = 64;   // pixels per unit
  const OW = 12, OL = 22;   // the painted area: half-width / half-length
  const tex = canvasTex(OW * 2 * PX / 2, OL * 2 * PX / 2, (x, w, h) => {
    const s = PX / 2, cx = w / 2, cy = h / 2, X = (u) => cx + u * s, Y = (v) => cy + v * s;
    x.fillStyle = "#3f8f5a"; x.fillRect(0, 0, w, h);
    // speckle
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = "#3b6fb6"; x.fillRect(X(-C.DBL_W - 0.9), Y(-C.HALF_L - 1.6), (C.DBL_W + 0.9) * 2 * s, (C.HALF_L + 1.6) * 2 * s);
    for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; x.fillRect(X(-C.DBL_W - 0.9) + Math.random() * (C.DBL_W + 0.9) * 2 * s, Y(-C.HALF_L - 1.6) + Math.random() * (C.HALF_L + 1.6) * 2 * s, 2, 2); }
    x.strokeStyle = "#ffffff"; x.lineWidth = 0.06 * s; x.lineCap = "square";
    const line = (x0, z0, x1, z1) => { x.beginPath(); x.moveTo(X(x0), Y(z0)); x.lineTo(X(x1), Y(z1)); x.stroke(); };
    for (const sx of [-1, 1]) { line(sx * C.HALF_W, -C.HALF_L, sx * C.HALF_W, C.HALF_L); line(sx * C.DBL_W, -C.HALF_L, sx * C.DBL_W, C.HALF_L); }
    for (const sz of [-1, 1]) { line(-C.DBL_W, sz * C.HALF_L, C.DBL_W, sz * C.HALF_L); line(-C.HALF_W, sz * C.SERVICE, C.HALF_W, sz * C.SERVICE);
      line(0, sz * C.HALF_L, 0, sz * (C.HALF_L - 0.25)); }
    line(0, -C.SERVICE, 0, C.SERVICE);
    // logo in the run-off behind each baseline
    x.save(); x.fillStyle = "rgba(255,255,255,0.22)"; x.font = `bold ${1.1 * s}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("HINAGATA OPEN", cx, Y(C.HALF_L + 1.0)); x.translate(cx, Y(-C.HALF_L - 1.0)); x.rotate(Math.PI); x.fillText("HINAGATA OPEN", 0, 0); x.restore();
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(OW * 2, OL * 2), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ color: "#356f47" }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; g.add(outer);

  // the net: a mesh texture between two posts, a white tape on top, a centre strap
  const netTex = canvasTex(256, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = "rgba(20,24,30,0.85)"; x.lineWidth = 1.2;
    for (let i = 0; i <= w; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let j = 0; j <= h; j += 6) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(14, 1.6);
  const netGeo = new THREE.PlaneGeometry(C.POST * 2, 1, 24, 1);
  const pos = netGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), top = pos.getY(i) > 0; pos.setY(i, top ? netHeight(x) : 0.03); }
  netGeo.computeVertexNormals();
  const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  g.add(net);
  const tapePts = []; for (let i = 0; i <= 24; i++) { const x = -C.POST + i * C.POST * 2 / 24; tapePts.push(new THREE.Vector3(x, netHeight(x) - 0.02, 0)); }
  const tape = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tapePts), 48, 0.025, 6), new THREE.MeshLambertMaterial({ color: "#ffffff" }));
  g.add(tape);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, C.NET_H, 0.01), new THREE.MeshLambertMaterial({ color: "#ffffff" })); strap.position.set(0, C.NET_H / 2, 0); g.add(strap);
  const postM = new THREE.MeshLambertMaterial({ color: "#2b3440" });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, netHeight(C.POST) + 0.06, 10), postM); p.position.set(s * C.POST, (netHeight(C.POST) + 0.06) / 2, 0); p.castShadow = true; g.add(p); }

  // walls (sponsor boards) and stands with a crowd made of simple instanced shapes
  const boardTex = canvasTex(1024, 64, (x, w, h) => {
    const cols = ["#1f3b63", "#22b0a0", "#e5484d", "#f2b134"]; const words = ["HINAGATA", "THREE.JS", "CHIBI SPORTS", "ACE!", "LOVE ALL"];
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * w / 8, 0, w / 8, h); x.fillStyle = "#fff"; x.font = "bold 26px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(words[i % words.length], (i + 0.5) * w / 8, h / 2 + 1); }
  });
  boardTex.wrapS = THREE.RepeatWrapping;
  const boardM = new THREE.MeshLambertMaterial({ map: boardTex });
  const wall = (w, x, z, ry) => { const t = boardTex.clone(); t.needsUpdate = true; t.repeat.set(w / 16, 1); const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 0.12), new THREE.MeshLambertMaterial({ map: t })); m.position.set(x, 0.4, z); m.rotation.y = ry; g.add(m); };
  wall(24, 0, -OL + 7.5, 0); wall(24, 0, OL - 5.5, Math.PI); wall(28, -OW + 3.2, 1, Math.PI / 2); wall(28, OW - 3.2, 1, -Math.PI / 2);

  const standM = new THREE.MeshLambertMaterial({ color: "#c9d2dc" });
  const crowdGeo = new THREE.CapsuleGeometry(0.16, 0.22, 3, 6);
  const crowdM = new THREE.MeshLambertMaterial({ color: "#ffffff" });
  const seats = [];
  const stand = (cx, cz, len, ry, rows = 6) => {
    for (let r = 0; r < rows; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.9), standM);
      const off = new THREE.Vector3(0, 0.25 + r * 0.5, -r * 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      step.position.set(cx + off.x, off.y, cz + off.z); step.rotation.y = ry; step.scale.y = 1 + r * 0.0; g.add(step);
      for (let i = 0; i < len / 0.55; i++) {
        if (Math.random() < 0.18) continue;
        const along = new THREE.Vector3(-len / 2 + 0.3 + i * 0.55, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
        seats.push({ x: cx + off.x + along.x, y: off.y + 0.55, z: cz + off.z + along.z, ph: Math.random() * 6.28 });
      }
    }
  };
  stand(0, -OL + 6.5, 24, 0); stand(-OW + 2.2, 1, 26, Math.PI / 2); stand(OW - 2.2, 1, 26, -Math.PI / 2);
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdM, seats.length);
  const palette = ["#e5484d", "#f2b134", "#3b6fb6", "#22b0a0", "#ffffff", "#8e6bd8", "#f08bb0", "#2f3542", "#ff8c42"].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4();
  seats.forEach((s, i) => { m4.makeTranslation(s.x, s.y, s.z); crowd.setMatrixAt(i, m4); crowd.setColorAt(i, palette[(Math.random() * palette.length) | 0]); });
  g.add(crowd);
  // umpire chair
  const chair = new THREE.Group(); const cm = new THREE.MeshLambertMaterial({ color: "#2b3440" });
  for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), cm); l.position.set(x, 0.8, z); chair.add(l); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: "#22b0a0" })); seat.position.y = 1.6; chair.add(seat);
  chair.position.set(C.POST + 0.9, 0, 0); g.add(chair);
  // trees beyond the stands
  const treeM = new THREE.MeshLambertMaterial({ color: "#2f6b45" }), trunkM = new THREE.MeshLambertMaterial({ color: "#6b4a30" });
  for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 30 + Math.random() * 6; const t = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 + Math.random(), 4 + Math.random() * 2, 7), treeM); c.position.y = 3.5; t.add(c);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 6), trunkM); tr.position.y = 0.8; t.add(tr);
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.add(t); }

  // the crowd bobs a little, more when cheering
  let excite = 0;
  return {
    group: g,
    cheer(k = 1) { excite = Math.max(excite, k); },
    update(time, dt) {
      excite = Math.max(0, excite - dt * 0.6);
      const amp = 0.02 + excite * 0.18;
      seats.forEach((s, i) => { m4.makeTranslation(s.x, s.y + Math.max(0, Math.sin(time * (6 + excite * 6) + s.ph)) * amp, s.z); crowd.setMatrixAt(i, m4); });
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
}
