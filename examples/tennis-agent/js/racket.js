// A tennis racket held in an avatar's right hand (on the hand.R bone, placed in the bone's rest axes: the fingers point down-out along
// the A-pose arm, about 44° below level).
import * as THREE from "three";

function stringsTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2;
  for (let i = 4; i < 128; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let STR = null;

// built along +y (the handle's butt at y = 0), the face in the xy plane
export function makeRacket(color = "#22b0a0", grip = "#333a44") {
  const g = new THREE.Group();
  const frameM = new THREE.MeshToonMaterial({ color }), gripM = new THREE.MeshToonMaterial({ color: grip });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.13, 10), gripM); handle.position.y = 0.065; g.add(handle);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 10), gripM); cap.position.y = 0.004; g.add(cap);
  // throat: two bars in a V
  for (const s of [-1, 1]) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.085, 6), frameM);
    bar.position.set(s * 0.02, 0.17, 0); bar.rotation.z = -s * 0.42; g.add(bar); }
  // head: an oval ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 6, 28), frameM); ring.scale.set(0.82, 1.08, 1); ring.position.y = 0.315; g.add(ring);
  STR ??= stringsTexture();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ map: STR, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  face.scale.set(0.82, 1.08, 1); face.position.y = 0.315; g.add(face);
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

// hold it in the right hand: the handle along the fingers. twist turns the face about the handle; tilt bends it out of line with the arm.
export function holdRacket(avatar, racket, { along = 0.035, twist = 0, tilt = -0.35, scale = 1.35 } = {}) {
  const hand = avatar.bones["hand.R"];
  const down = 44.3 * Math.PI / 180, d = new THREE.Vector3(-Math.cos(down), -Math.sin(down), 0);
  const pivot = new THREE.Group();
  pivot.position.copy(d).multiplyScalar(along);
  // +y of the racket → along the fingers; then a twist about that line; then tilt toward the front (the wrist cocks the racket up a little)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), twist));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
  pivot.quaternion.copy(q);
  racket.position.set(0, -0.06, 0);   // the grip in the palm, the butt sticking out under the little finger
  pivot.add(racket); hand.add(pivot);
  // the bone may carry a scale: undo it so the racket keeps its size
  const ws = new THREE.Vector3(); avatar.object.updateMatrixWorld(true); hand.getWorldScale(ws); const os = new THREE.Vector3(); avatar.object.getWorldScale(os);
  pivot.scale.setScalar(scale * os.x / (ws.x || 1));
  // a point at the centre of the strings (for checking where the racket is)
  const sweet = new THREE.Object3D(); sweet.position.y = 0.315; racket.add(sweet);
  return { pivot, sweet };
}
