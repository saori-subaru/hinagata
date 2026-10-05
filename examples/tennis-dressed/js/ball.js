// ボールの見た目（本体・影・残像・着地マーク）
import * as THREE from 'three';
import { BALL_R, clamp } from './constants.js';
import { makeBallState } from './physics.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ballTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d6ee2e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.12)' : 'rgba(120,150,20,0.12)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = '#f7f8ec';
    g.lineWidth = 6;
    g.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 4) * h * 0.27;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  });
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Ball {
  constructor(scene) {
    this.s = makeBallState();

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 24, 16),
      new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.8, emissive: 0x3d4d00, emissiveIntensity: 0.45 })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // 接地影（高さの把握を助ける）
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 24),
      new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);

    // 残像
    const N = (this.trailN = 18);
    this.trailPos = new Float32Array(N * 3);
    this.trailA = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.trailA, 1));
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float alpha; varying float vA; uniform float scale;
        void main(){
          vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = scale * 0.08 * (0.35 + 0.65 * alpha) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c);
          if (d > 0.5) discard;
          gl_FragColor = vec4(0.96, 1.0, 0.62, vA * 0.45 * (1.0 - d * 2.0));
        }`,
    });
    this.trail = new THREE.Points(geo, this.trailMat);
    this.trail.frustumCulled = false;
    scene.add(this.trail);

    // ホークアイ風の着地マーク
    this.mark = new THREE.Mesh(
      new THREE.RingGeometry(0.05, 0.075, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
    );
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.scale.set(1, 1.7, 1);
    this.mark.renderOrder = 2;
    scene.add(this.mark);
    this.markLife = 0;
  }

  resetTrail() {
    this.trailA.fill(0);
    this.trailInit = false;
  }

  showMark(x, z, out) {
    this.mark.position.set(x, 0.008, z);
    this.mark.material.color.set(out ? 0xff3048 : 0xffffff);
    this.markLife = 2.6;
  }

  hideMark() {
    this.markLife = 0;
    this.mark.material.opacity = 0;
  }

  setVisible(v) {
    this.mesh.visible = this.shadow.visible = this.trail.visible = v;
  }

  sync(dt) {
    const p = this.s.p, v = this.s.v;
    this.mesh.position.set(p.x, p.y, p.z);
    const sp = Math.hypot(v.x, v.y, v.z);
    this.mesh.rotation.x += sp * dt * 6;
    this.mesh.rotation.z += sp * dt * 2;

    const h = Math.max(0, p.y);
    this.shadow.position.set(p.x, 0.009, p.z);
    const sc = 1 + h * 0.35;
    this.shadow.scale.set(sc, sc, sc);
    this.shadow.material.opacity = 0.55 / (1 + h * 0.6);

    // 残像を更新
    const N = this.trailN, P = this.trailPos, A = this.trailA;
    if (!this.trailInit) {
      for (let i = 0; i < N; i++) { P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z; }
      this.trailInit = true;
    }
    for (let i = N - 1; i > 0; i--) {
      P[i * 3] = P[(i - 1) * 3];
      P[i * 3 + 1] = P[(i - 1) * 3 + 1];
      P[i * 3 + 2] = P[(i - 1) * 3 + 2];
    }
    P[0] = p.x; P[1] = p.y; P[2] = p.z;
    const strength = clamp((sp - 7) / 12, 0, 1);
    for (let i = 0; i < N; i++) A[i] = (1 - i / N) * strength;
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.alpha.needsUpdate = true;

    if (this.markLife > 0) {
      this.markLife -= dt;
      this.mark.material.opacity = clamp(this.markLife / 0.8, 0, 0.9);
    }
  }
}
