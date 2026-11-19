// A hand-drawn look as one post-process pass: wobbly ink lines, a watercolor wash, hatching in the shade, paper.
// It only reads the finished picture and its depth, so the engine (src/) is untouched: use it in place of renderer.render.
//
//   const sketch = createSketch(renderer);            // after renderer.setSize; call sketch.setSize() on resize
//   sketch.render(scene, camera);                     // instead of renderer.render(scene, camera)
//   sketch.uniforms.hatch.value = 0;                  // every knob is a uniform (see DEFAULTS)
//
// ⏳ The paper, the wobble and the hatching are fixed to the screen: fine for a still, they slide over a moving character.
import * as THREE from "three";

export const DEFAULTS = {
  paper: "#f1ece1",    // the sheet's color
  ink: "#3b332e",      // the line's color
  line: 1.0,           // 0-1: the ink lines found from depth and color
  lineWidth: 1.0,      // px
  wobble: 2.2,         // px: how far the picture strays from the true position (the hand's shake)
  wash: 0.3,           // 0-1: how much the paint is thinned toward the paper
  bleed: 0.55,         // 0-1: pigment gathering at the borders of a color, and uneven within it
  hatch: 0.6,          // 0-1: strokes in the shade
  grain: 0.5,          // 0-1: the paper's grain
  fade: 0.35,          // 0-1: the picture fading into the paper toward the frame
};

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tColor, tDepth;
uniform vec2 px;             // one pixel, in uv
uniform float near, far, line, lineWidth, wobble, wash, bleed, hatch, grain, fade;
uniform vec3 paper, ink;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

// depth in metres from the camera
float depthAt(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main() {
  vec2 pix = vUv / px;
  // the hand's shake: a slow drift plus a finer tremble
  vec2 w = vec2(fbm(pix * 0.012), fbm(pix * 0.012 + 31.7)) - 0.5 + 0.35 * (vec2(noise(pix * 0.07), noise(pix * 0.07 + 9.1)) - 0.5);
  vec2 uv = vUv + w * wobble * 2.0 * px;

  vec3 col = toSRGB(texture2D(tColor, uv).rgb);
  float d = depthAt(uv), bg = step(far * 0.98, d);

  // edges: a jump in depth (relative, so far things don't all become lines) and a jump in color
  vec2 o = px * lineWidth;
  float dl = depthAt(uv - vec2(o.x, 0)), dr = depthAt(uv + vec2(o.x, 0)), du = depthAt(uv + vec2(0, o.y)), dd = depthAt(uv - vec2(0, o.y));
  float eDepth = smoothstep(0.02, 0.06, (abs(dl - dr) + abs(du - dd)) / min(d, min(min(dl, dr), min(du, dd))));
  vec3 cl = toSRGB(texture2D(tColor, uv - vec2(o.x, 0)).rgb), cr = toSRGB(texture2D(tColor, uv + vec2(o.x, 0)).rgb),
       cu = toSRGB(texture2D(tColor, uv + vec2(0, o.y)).rgb), cd = toSRGB(texture2D(tColor, uv - vec2(0, o.y)).rgb);
  float grad = length(cl - cr) + length(cu - cd);
  float eColor = smoothstep(0.25, 0.6, grad);

  // paint: thinned toward the paper, uneven, darker where it pooled at a border
  float pool = fbm(pix * 0.02 + 5.0);
  vec3 paint = mix(col, paper * (0.6 + 0.4 * col), wash);
  paint = pow(paint, vec3(1.0 + bleed * (0.9 * (pool - 0.5) + 0.8 * smoothstep(0.05, 0.3, grad))));
  // where the brush ran dry the paper shows through
  paint = mix(paint, paper, bleed * 0.5 * smoothstep(0.62, 0.8, fbm(pix * vec2(0.01, 0.045) + 3.0)) * (1.0 - bg));

  // hatching: two directions of strokes, the second only in the deepest shade; broken up so they read as pencil
  float shade = 1.0 - lum(col);
  vec2 hp = pix + w * 14.0;
  float s1 = smoothstep(0.55, 0.9, sin((hp.x + hp.y * 0.55) * 1.15) * 0.5 + 0.5) * smoothstep(0.3, 0.6, noise(hp * vec2(0.35, 0.02)));
  float s2 = smoothstep(0.55, 0.9, sin((hp.x * 0.5 - hp.y) * 1.15) * 0.5 + 0.5) * smoothstep(0.3, 0.6, noise(hp.yx * vec2(0.35, 0.02) + 7.0));
  float strokes = s1 * smoothstep(0.42, 0.62, shade) + s2 * smoothstep(0.6, 0.8, shade);
  paint = mix(paint, ink, hatch * 0.45 * min(strokes, 1.0) * (1.0 - bg));

  // the ink line, pressed unevenly
  float press = 0.55 + 0.45 * noise(pix * 0.09 + 2.0);
  paint = mix(paint, ink, line * press * max(eDepth, eColor * 0.8));

  // the paper: grain everywhere, and the picture fading into it toward the frame
  vec2 c = vUv - 0.5;
  float f = fade * smoothstep(0.25, 0.75, length(c * vec2(1.0, 1.15)) + 0.25 * (fbm(pix * 0.006) - 0.5));
  paint = mix(paint, paper, f);
  float g = fbm(pix * 0.9) * 0.6 + noise(pix * vec2(0.08, 0.5)) * 0.4;
  paint *= 1.0 - grain * 0.16 * g;

  gl_FragColor = vec4(paint, 1.0);
}`;

export function createSketch(renderer, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  // ⛔ keep the stencil: the engine's hair lines use it (llms.txt). Half floats so the wash has no banding.
  const depth = new THREE.DepthTexture(1, 1); depth.format = THREE.DepthStencilFormat; depth.type = THREE.UnsignedInt248Type;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthTexture: depth });
  const uniforms = { tColor: { value: target.texture }, tDepth: { value: depth }, px: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 50 },
    paper: { value: new THREE.Color(o.paper).convertLinearToSRGB() }, ink: { value: new THREE.Color(o.ink).convertLinearToSRGB() } };   // the shader works in sRGB
  for (const k of ["line", "lineWidth", "wobble", "wash", "bleed", "hatch", "grain", "fade"]) uniforms[k] = { value: o[k] };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false }));
  quad.frustumCulled = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), size = new THREE.Vector2();
  const setSize = () => { renderer.getDrawingBufferSize(size); target.setSize(size.x, size.y); uniforms.px.value.set(1 / size.x, 1 / size.y); };
  setSize();
  return { uniforms, target, setSize,
    render(scene, camera) {
      uniforms.near.value = camera.near; uniforms.far.value = camera.far;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(prev); renderer.render(quad, cam);
    },
    dispose() { target.dispose(); depth.dispose(); quad.geometry.dispose(); quad.material.dispose(); } };
}
