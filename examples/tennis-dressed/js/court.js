// コート・ネット・スタジアム・観客
import * as THREE from 'three';
import { COURT, netHeightAt } from './constants.js';

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckleTex(base, repeatX, repeatY) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const l = Math.random() < 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${l},${l},${l},${Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  return t;
}

function bannerTex(text, bg, fg) {
  return canvasTex(1024, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, bg[0]);
    gr.addColorStop(1, bg[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '900 72px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

export function buildStadium(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 空
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      uniforms: { top: { value: new THREE.Color(0x2d74d8) }, bottom: { value: new THREE.Color(0xd8ecff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 1.5 + 0.04, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.65)), 1.0);
        #include <colorspace_fragment>
        }`,
    })
  );
  root.add(sky);
  scene.fog = new THREE.Fog(0xd8ecff, 90, 300);

  // 光
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x3d6a4a, 1.1);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-14, 30, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 24; sc.bottom = -24; sc.near = 5; sc.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  root.add(sun);
  root.add(sun.target);

  const mat = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9 }, o));
  const plane = (w, l, material, y) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), material);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // 地面とコート（アウトコートは緑、インコートは青のハードコート）
  plane(140, 160, mat({ color: 0x2a5e45 }), -0.02);
  plane(23, 38.2, mat({ map: speckleTex('#3c8a63', 6, 10), roughness: 0.85 }), 0);
  plane(COURT.doublesHalfW * 2, COURT.halfLen * 2, mat({ map: speckleTex('#2f62b2', 3, 6), roughness: 0.8 }), 0.002);

  // ライン
  const lineMat = mat({ color: 0xf8f8f8, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const line = (cx, cz, w, l) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.004, cz);
    m.receiveShadow = true;
    root.add(m);
  };
  const LW = 0.05, HL = COURT.halfLen, SW = COURT.singlesHalfW, DW = COURT.doublesHalfW, SL = COURT.serviceLine;
  for (const s of [-1, 1]) {
    line(0, s * (HL - 0.05), DW * 2, 0.1); // ベースライン
    line(s * (DW - LW / 2), 0, LW, HL * 2); // ダブルスサイドライン
    line(s * (SW - LW / 2), 0, LW, HL * 2); // シングルスサイドライン
    line(0, s * (SL - LW / 2), SW * 2, LW); // サービスライン
    line(0, s * (HL - 0.15), LW, 0.2); // センターマーク
  }
  line(0, 0, LW, SL * 2); // センターサービスライン

  // ネット
  const netGroup = new THREE.Group();
  root.add(netGroup);
  const postMat = mat({ color: 0x1d3b2c, roughness: 0.5, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, COURT.postH + 0.05, 12), postMat);
    post.position.set(s * COURT.postX, (COURT.postH + 0.05) / 2, 0);
    post.castShadow = true;
    netGroup.add(post);
  }
  const netTex = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(15,15,15,0.95)';
    g.lineWidth = 6;
    g.strokeRect(0, 0, 64, 64);
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.repeat.set(12.8 / 0.06, 1 / 0.06);
  const netGeo = new THREE.PlaneGeometry(COURT.postX * 2, 1, 64, 1);
  const pos = netGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setY(i, pos.getY(i) > 0 ? netHeightAt(x) - 0.03 : 0.02);
  }
  netGeo.computeVertexNormals();
  const net = new THREE.Mesh(netGeo, new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }));
  netGroup.add(net);
  const topPts = [];
  for (let i = 0; i <= 32; i++) {
    const x = -COURT.postX + (i / 32) * COURT.postX * 2;
    topPts.push(new THREE.Vector3(x, netHeightAt(x) - 0.02, 0));
  }
  const tape = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPts), 64, 0.028, 6, false), mat({ color: 0xffffff, roughness: 0.5 }));
  tape.castShadow = true;
  netGroup.add(tape);
  const strap = new THREE.Mesh(new THREE.PlaneGeometry(0.05, COURT.netH), mat({ color: 0xffffff, side: THREE.DoubleSide }));
  strap.position.set(0, COURT.netH / 2, 0.003);
  netGroup.add(strap);

  // 広告ボードと壁
  const banners = [
    ['THREE.JS OPEN', ['#0c2a5c', '#123a7a'], '#ffffff'],
    ['テニス選手権 2026', ['#123a2c', '#1c5a42'], '#e4ff3a'],
    ['WEBGL', ['#5c0c1e', '#80142b'], '#ffffff'],
    ['ACE  SERVE  VOLLEY', ['#202020', '#3a3a3a'], '#e4ff3a'],
  ];
  const boardH = 1.0;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const [txt, bg, fg] = banners[(i + (s > 0 ? 0 : 2)) % 4];
      const b = new THREE.Mesh(new THREE.BoxGeometry(5.5, boardH, 0.15), [
        mat({ color: 0x14382a }), mat({ color: 0x14382a }), mat({ color: 0x14382a }), mat({ color: 0x14382a }),
        mat({ map: bannerTex(txt, bg, fg), roughness: 0.6 }), mat({ map: bannerTex(txt, bg, fg), roughness: 0.6 }),
      ]);
      b.position.set(-8.25 + i * 5.5, boardH / 2, s * 18.85);
      if (s < 0) b.rotation.y = 0; else b.rotation.y = Math.PI;
      b.receiveShadow = true;
      root.add(b);
    }
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, boardH, 37.8), mat({ color: 0x173f30 }));
    side.position.set(s * 11.15, boardH / 2, 0);
    side.receiveShadow = true;
    root.add(side);
  }

  // スタンドと観客席
  const seats = [];
  const standMat = mat({ color: 0x5f6873 });
  const seatMats = [mat({ color: 0x24406e }), mat({ color: 0x2d4f86 })];
  const ROWS = 9;
  for (let r = 0; r < ROWS; r++) {
    const h = 1.15 + r * 0.42;
    for (const s of [-1, 1]) {
      // エンド側
      const e = new THREE.Mesh(new THREE.BoxGeometry(24.4, h, 0.9), r % 2 ? standMat : seatMats[r % 2]);
      e.position.set(0, h / 2, s * (19.5 + r * 0.9));
      e.receiveShadow = true;
      root.add(e);
      for (let x = -11.6; x <= 11.6; x += 0.62) seats.push({ x: x + (Math.random() - 0.5) * 0.08, y: h, z: s * (19.5 + r * 0.9) });
      // サイド側
      const sd = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 37.8), r % 2 ? standMat : seatMats[(r + 1) % 2]);
      sd.position.set(s * (11.9 + r * 0.9), h / 2, 0);
      sd.receiveShadow = true;
      root.add(sd);
      for (let z = -18.2; z <= 18.2; z += 0.62) seats.push({ x: s * (11.9 + r * 0.9), y: h, z: z + (Math.random() - 0.5) * 0.08 });
    }
  }
  const people = seats.filter(() => Math.random() < 0.86);
  const n = people.length;
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.21, 0.62, 6), new THREE.MeshLambertMaterial(), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshLambertMaterial(), n);
  const shirtCols = [0xffffff, 0xeeeeee, 0x2b59c3, 0xd8343c, 0xf2c53d, 0x2f9e5b, 0x1a1a1a, 0xff8a3d, 0x8e5bd6, 0x5fc3e4, 0xf5a6c0, 0xe4ff3a];
  const skinCols = [0xf3d0b0, 0xe0ac7e, 0xc68642, 0x8d5524, 0xffdbac];
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const baseY = new Float32Array(n), ph = new Float32Array(n), amp = new Float32Array(n), spd = new Float32Array(n);
  people.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y + 0.36, p.z);
    bodies.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, p.y + 0.77, p.z);
    heads.setMatrixAt(i, m4);
    bodies.setColorAt(i, col.setHex(shirtCols[(Math.random() * shirtCols.length) | 0]));
    heads.setColorAt(i, col.setHex(skinCols[(Math.random() * skinCols.length) | 0]));
    baseY[i] = p.y;
    ph[i] = Math.random() * Math.PI * 2;
    amp[i] = 0.08 + Math.random() * 0.22;
    spd[i] = 7 + Math.random() * 5;
  });
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(bodies, heads);

  // 主審台とベンチ
  const chairMat = mat({ color: 0x1f4f3b, roughness: 0.6 });
  const umpX = -7.4;
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), chairMat);
    leg.position.set(umpX + dx, 1.05, dz);
    leg.castShadow = true;
    root.add(leg);
  }
  const addBox = (w, h, d, x, y, z, m = chairMat) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    root.add(b);
    return b;
  };
  addBox(0.75, 0.08, 0.75, umpX, 2.12, 0);
  addBox(0.06, 0.65, 0.7, umpX - 0.36, 2.5, 0);
  addBox(0.5, 0.05, 0.8, umpX + 0.45, 1.58, 0);
  for (let i = 0; i < 5; i++) addBox(0.04, 0.04, 0.6, umpX - 0.45, 0.3 + i * 0.4, 0);
  const benchMat = mat({ color: 0x2b5a8a, roughness: 0.6 });
  for (const s of [-1, 1]) {
    addBox(0.5, 0.45, 1.6, -9.2, 0.225, s * 2.6, benchMat);
    addBox(0.08, 0.5, 1.6, -9.45, 0.7, s * 2.6, benchMat);
  }

  let t = 0;
  let dirty = false;
  return {
    umpireSeat: new THREE.Vector3(umpX, 1.62, 0),
    update(dt, excite) {
      t += dt;
      if (excite < 0.01 && !dirty) return;
      const B = bodies.instanceMatrix.array, H = heads.instanceMatrix.array;
      for (let i = 0; i < n; i++) {
        const off = excite * amp[i] * Math.max(0, Math.sin(t * spd[i] + ph[i]));
        B[i * 16 + 13] = baseY[i] + 0.36 + off;
        H[i * 16 + 13] = baseY[i] + 0.77 + off;
      }
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      dirty = excite >= 0.01;
    },
  };
}
