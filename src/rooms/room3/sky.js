// Room 3 — sky helpers: twinkling star points, the sky dome behind the slit, the crescent moon,
// and shooting stars. Everything procedural.
import * as THREE from 'three';
import { starfieldTexture, rng } from '../../engine/props/textures.js';

const starVert = /* glsl */`
  attribute float aSize; attribute float aSeed; attribute vec3 aColor;
  uniform float uTime; uniform float uPR; uniform float uScale;
  varying vec3 vColor; varying float vTw;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float sp = 0.6 + fract(aSeed * 13.7) * 2.6;
    float tw = 0.72 + 0.28 * sin(uTime * sp + aSeed * 61.0) * sin(uTime * sp * 0.37 + aSeed * 17.0 + 1.0);
    vTw = tw;
    vColor = aColor;
    gl_PointSize = max(1.0, aSize * uPR * uScale * (0.85 + 0.25 * tw));
  }`;
const starFrag = /* glsl */`
  uniform float uOpacity;
  varying vec3 vColor; varying float vTw;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float a = core * core * (0.6 + 0.4 * core);
    gl_FragColor = vec4(vColor * a * vTw * uOpacity, 1.0);
  }`;

/** Shared-shader star points. `stars` = [{ p:[x,y,z], size, color:[r,g,b] }] */
export function starPoints(stars, { scale = 1, opacity = 1, depthTest = true, renderOrder = 0 } = {}) {
  const n = stars.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
  stars.forEach((s, i) => {
    pos.set(s.p, i * 3); col.set(s.color, i * 3); size[i] = s.size; seed[i] = s.seed ?? Math.random();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uScale: { value: scale }, uOpacity: { value: opacity },
    },
    vertexShader: starVert, fragmentShader: starFrag,
    transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.raycast = () => {};
  pts.userData.noRaycast = true;
  pts.renderOrder = renderOrder;
  pts.userData.update = (dt, t) => { mat.uniforms.uTime.value = t; };
  pts.userData.setOpacity = (o) => { mat.uniforms.uOpacity.value = o; };
  return pts;
}

/** A believable star colour + size distribution. */
export function randomStar(r) {
  const m = Math.pow(r(), 4.2);                 // most stars faint
  const k = r();
  const tint = k < 0.12 ? [1.0, 0.82, 0.62] : k < 0.3 ? [0.72, 0.82, 1.0] : k < 0.36 ? [1.0, 0.68, 0.55] : [0.95, 0.96, 1.0];
  const b = 0.35 + m * 2.4;                     // >1 so the brightest ones bloom
  return { size: 1.1 + m * 5.5, color: tint.map((v) => v * b), seed: r() };
}

/**
 * The night sky outside the dome: a huge back-faced sphere with a painted milky-way texture,
 * plus thousands of twinkling points and a denser milky band. Returns a Group; rotate it slowly.
 */
export function skyDome({ radius = 60, count = 4200, seed = 33 } = {}) {
  const g = new THREE.Group();
  g.name = 'r3.sky';
  const tex = starfieldTexture({ w: 2048, h: 1024, count: 1800, seed: 77, band: true, bg: '#03050d' });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false, color: new THREE.Color(0.9, 0.95, 1.15) }),
  );
  sphere.renderOrder = -10;
  g.add(sphere);
  const r = rng(seed);
  const stars = [];
  const R = radius * 0.92;
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.01) { i--; continue; }
    v.normalize().multiplyScalar(R);
    stars.push({ p: [v.x, v.y, v.z], ...randomStar(r) });
  }
  // milky band: a tilted great circle, dense faint dust of stars
  const bandN = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
  const t1 = new THREE.Vector3().crossVectors(bandN, new THREE.Vector3(0, 1, 0)).normalize();
  const t2 = new THREE.Vector3().crossVectors(bandN, t1).normalize();
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2;
    const off = (r() + r() + r() - 1.5) * 0.16;
    const v = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).addScaledVector(bandN, off).normalize().multiplyScalar(R);
    const s = randomStar(r);
    s.size *= 0.7; s.color = s.color.map((c) => c * 0.6);
    stars.push({ p: [v.x, v.y, v.z], ...s });
  }
  const pts = starPoints(stars, { scale: 1 });
  pts.renderOrder = -9;
  g.add(pts);
  g.userData.points = pts;
  g.userData.sphere = sphere;
  return g;
}

/** Crescent moon textures: [open-eyed, winking]. A sleepy face lives on the inner curve. */
export function moonTextures() {
  const make = (wink) => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    // halo
    const halo = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
    halo.addColorStop(0, 'rgba(200,215,255,0.35)'); halo.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    // crescent: full disc minus offset disc
    const m = document.createElement('canvas'); m.width = m.height = S;
    const mg = m.getContext('2d');
    const body = mg.createRadialGradient(S * 0.42, S * 0.45, 4, S / 2, S / 2, S * 0.3);
    body.addColorStop(0, '#fffbea'); body.addColorStop(1, '#e8dcb0');
    mg.fillStyle = body;
    mg.beginPath(); mg.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2); mg.fill();
    mg.globalCompositeOperation = 'destination-out';
    mg.beginPath(); mg.arc(S / 2 + S * 0.15, S / 2 - S * 0.05, S * 0.27, 0, Math.PI * 2); mg.fill();
    mg.globalCompositeOperation = 'source-over';
    // craters
    mg.fillStyle = 'rgba(170,150,110,0.35)';
    for (const [x, y, rr] of [[0.3, 0.56, 0.025], [0.36, 0.7, 0.018], [0.27, 0.42, 0.015]]) { mg.beginPath(); mg.arc(S * x, S * y, S * rr, 0, 7); mg.fill(); }
    // face: eye + smile on the inner side
    mg.strokeStyle = 'rgba(90,70,40,0.85)'; mg.lineWidth = S * 0.012; mg.lineCap = 'round';
    const ex = S * 0.36, ey = S * 0.47;
    mg.beginPath();
    if (wink) { mg.moveTo(ex - S * 0.03, ey + S * 0.004); mg.quadraticCurveTo(ex, ey + S * 0.02, ex + S * 0.03, ey + S * 0.004); }
    else { mg.arc(ex, ey, S * 0.022, Math.PI * 0.05, Math.PI * 0.95); }
    mg.stroke();
    mg.beginPath(); mg.arc(S * 0.37, S * 0.58, S * 0.04, Math.PI * 0.15, Math.PI * 0.6); mg.stroke();
    g.drawImage(m, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return [make(false), make(true)];
}

/** Moon billboard plane (additive so its halo blends into any sky). */
export function moonMesh(size, tex, { depthTest = true, intensity = 1.6 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, fog: false, color: new THREE.Color(1, 1, 1).multiplyScalar(intensity) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.userData.noHighlight = true;
  return m;
}

let _streakTex = null;
function streakTexture() {
  if (_streakTex) return _streakTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 16;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.85, 'rgba(210,225,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 8); g.lineTo(250, 3); g.lineTo(256, 8); g.lineTo(250, 13); g.closePath(); g.fill();
  _streakTex = new THREE.CanvasTexture(c);
  _streakTex.colorSpace = THREE.SRGBColorSpace;
  return _streakTex;
}

/** A single reusable shooting-star streak. call fire(from, to, seconds); update(dt) each frame. */
export function shootingStar({ length = 6, width = 0.18 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: new THREE.Color(2.2, 2.3, 2.6), side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat);
  m.visible = false;
  m.raycast = () => {};
  m.userData.noRaycast = true;
  m.renderOrder = -8;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
  let t = 0, dur = 0;
  m.userData.active = () => m.visible;
  m.userData.fire = (a, b, seconds = 0.9, eye) => {
    from.copy(a); to.copy(b); t = 0; dur = seconds; m.visible = true;
    dir.subVectors(to, from).normalize();
    // orient plane: x axis along travel, facing the eye
    const toEye = new THREE.Vector3().subVectors(eye, a).normalize();
    const y = new THREE.Vector3().crossVectors(toEye, dir).normalize();
    const z = new THREE.Vector3().crossVectors(dir, y).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, y, z));
  };
  m.userData.update = (dt) => {
    if (!m.visible) return;
    t += dt;
    const k = Math.min(1, t / dur);
    m.position.lerpVectors(from, to, k).addScaledVector(dir, -length * 0.5);
    mat.opacity = Math.sin(Math.PI * k);
    if (k >= 1) m.visible = false;
  };
  return m;
}
