// Room 1 (The Study) — local prop builders. Extends the engine props library with the study's
// bespoke pieces: fireplace + fire, grandfather clock, globe, portrait painting, grimoire + word lock,
// and small dressing (skull, hourglass, inkpot, quill, magnifier, sardine tin, key, bowl, cobwebs…).
// Every builder returns a Group with origin at its base centre (unless noted), front facing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { makeCanvas, canvasTexture, rng, noiseTexture } from '../../engine/props/textures.js';

const TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", Georgia, serif';

const noRay = (o) => { o.raycast = () => {}; o.userData.noRaycast = true; return o; };
const mesh = (geo, mat, { cast = true, receive = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; };

// cached small materials ----------------------------------------------------------------------
const matCache = new Map();
function cached(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
export const bone = () => cached('bone', () => new THREE.MeshStandardMaterial({ color: '#d9ccab', roughness: 0.72, bumpMap: noiseTexture({ scale: 30, seed: 71 }), bumpScale: 0.4 }));
export const leather = (color = '#5a1a14') => cached('leather' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.62, bumpMap: noiseTexture({ scale: 60, seed: 77, contrast: 1.2 }), bumpScale: 0.5 }));
export const blued = () => cached('blued', () => new THREE.MeshStandardMaterial({ color: '#141a26', metalness: 0.7, roughness: 0.32 }));
export const soot = () => cached('soot', () => new THREE.MeshStandardMaterial({ color: '#0b0705', roughness: 1 }));
export const ink = () => cached('ink', () => new THREE.MeshStandardMaterial({ color: '#07070c', roughness: 0.08, metalness: 0.2 }));
export const feather = () => cached('feather', () => new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.8, side: THREE.DoubleSide }));
export const tin = () => cached('tin', () => new THREE.MeshStandardMaterial({ color: '#b8bcc0', metalness: 0.9, roughness: 0.35 }));

// ---------------------------------------------------------------------------------------------
// FIRE — layered noise-flame shader planes, coals, logs
// ---------------------------------------------------------------------------------------------
const fireVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const fireFrag = /* glsl */`
  uniform float uTime; uniform float uSeed; uniform float uBoost;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.07; a *= 0.5; } return v; }
  void main(){
    vec2 uv = vUv;
    float t = uTime + uSeed;
    float n  = fbm(vec2(uv.x*3.2 + uSeed, uv.y*2.4 - t*1.7));
    float n2 = fbm(vec2(uv.x*5.0 - uSeed, uv.y*3.5 - t*2.6));
    float x = (uv.x - 0.5) * 2.0;
    float y = uv.y / (1.0 + uBoost * 0.6);
    float width = mix(0.95, 0.04, pow(clamp(y, 0.0, 1.0), 0.75));
    float wob = (n2 - 0.5) * 0.7 * y;
    float body = 1.0 - smoothstep(width * 0.35, width, abs(x + wob));
    float heat = body * (1.15 - y * 1.25) + (n - 0.5) * 0.85;
    heat *= 0.95 + uBoost * 0.5;
    heat = clamp(heat, 0.0, 1.0);
    float a = smoothstep(0.1, 0.55, heat) * smoothstep(0.0, 0.08, uv.y) * (1.0 - smoothstep(0.85, 1.0, uv.y));
    vec3 col = mix(vec3(0.75, 0.10, 0.01), vec3(1.0, 0.45, 0.06), smoothstep(0.2, 0.55, heat));
    col = mix(col, vec3(1.0, 0.86, 0.55), smoothstep(0.6, 0.95, heat));
    gl_FragColor = vec4(col * a * 2.4, 1.0);
  }`;

/** Animated hearth fire: crossed flame planes, glowing coals, logs. userData: { setBoost(v), update } */
export function fire({ w = 0.62, h = 0.62 } = {}) {
  const g = new THREE.Group(); g.name = 'fire';
  const mats = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSeed: { value: i * 3.7 + 1.3 }, uBoost: { value: 0 } },
      vertexShader: fireVert, fragmentShader: fireFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    mats.push(mat);
    const geo = new THREE.PlaneGeometry(w * (1 - i * 0.18), h * (1 - i * 0.12));
    geo.translate(0, h * (1 - i * 0.12) / 2, 0);
    const p = noRay(new THREE.Mesh(geo, mat));
    p.rotation.y = (i - 1) * 0.75;
    p.position.set((i - 1) * 0.06, 0.05, (i - 1) * 0.03);
    p.renderOrder = 4;
    g.add(p);
  }
  // logs
  const bark = M.wood({ tint: '#2a1a10', seed: 44, roughness: 0.95 });
  const logGeo = new THREE.CylinderGeometry(0.055, 0.065, w * 1.05, 10);
  const lg = [[0, 0.06, 0.06, 0.15], [0, 0.06, -0.08, -0.12], [0, 0.15, -0.01, 0.4]];
  for (const [x, y, z, rot] of lg) {
    const l = mesh(logGeo, bark);
    l.rotation.z = Math.PI / 2; l.rotation.y = rot; l.position.set(x, y, z);
    g.add(l);
  }
  // coal bed
  const coalTex = noiseTexture({ scale: 14, seed: 91, contrast: 1.6 });
  const coalMat = new THREE.MeshStandardMaterial({ color: '#1a0a05', emissive: '#ff4a10', emissiveIntensity: 1.6, emissiveMap: coalTex, roughness: 1 });
  const coals = mesh(new THREE.SphereGeometry(w * 0.48, 18, 8, 0, TAU, 0, Math.PI / 2), coalMat, { cast: false });
  coals.scale.set(1, 0.16, 0.55);
  g.add(coals);
  // iron grate
  const iron = M.iron({ color: '#1e1c1a' });
  const bars = [];
  for (let i = 0; i < 7; i++) { const b = new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6); b.rotateX(Math.PI / 2); b.translate(-w / 2 + 0.06 + i * ((w - 0.12) / 6), 0.03, 0); bars.push(b); }
  const fr = new THREE.CylinderGeometry(0.01, 0.01, w, 6); fr.rotateZ(Math.PI / 2); fr.translate(0, 0.03, 0.14); bars.push(fr);
  for (const s of [-1, 1]) { const leg = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6); leg.translate(s * (w / 2 - 0.04), 0.08, 0.14); bars.push(leg); const fin = new THREE.SphereGeometry(0.022, 10, 8); fin.translate(s * (w / 2 - 0.04), 0.17, 0.14); bars.push(fin); }
  g.add(mesh(mergeGeometries(bars), iron));

  let boost = 0, boostTarget = 0;
  g.userData.setBoost = (v) => { boostTarget = v; };
  g.userData.update = (dt, t) => {
    boost += (boostTarget - boost) * Math.min(1, dt * 6);
    for (const m of mats) { m.uniforms.uTime.value = t; m.uniforms.uBoost.value = boost; }
    coalMat.emissiveIntensity = 1.4 + Math.sin(t * 1.3) * 0.2 + Math.sin(t * 3.7) * 0.1 + boost * 0.8;
  };
  return g;
}

/**
 * Stone fireplace with chimney breast, firebox, hearth slab and a walnut mantel. Front faces +Z;
 * origin at the floor, centred on the breast's front face plane (so put it against a wall).
 * userData: { mantelY, fireOrigin (local Vector3), firebox (Mesh), fire }
 */
export function fireplace({ w = 1.7, h = 3.6, depth = 0.4, mantelY = 1.28 } = {}) {
  const g = new THREE.Group(); g.name = 'fireplace';
  const stoneM = M.stone({ tint: '#857a6c', rows: 6, cols: 3, seed: 21 });
  const smooth = M.smoothStone({ color: '#8d8476' });
  // chimney breast (plastered above the mantel)
  const upper = mesh(F.roundedBoxGeometry(w - 0.1, h - mantelY, depth, 0.02), M.plaster({ tint: '#a08a6a', repeat: [1, 1.4] }));
  upper.position.set(0, mantelY + (h - mantelY) / 2, -depth / 2);
  g.add(upper);
  // stone surround around the opening
  const ow = 0.98, oh = 0.82;
  const sideW = (w - ow) / 2;
  for (const s of [-1, 1]) {
    const p = mesh(F.roundedBoxGeometry(sideW, mantelY, depth + 0.06, 0.015), stoneM);
    p.position.set(s * (ow / 2 + sideW / 2), mantelY / 2, -depth / 2 + 0.03);
    g.add(p);
  }
  const lintel = mesh(F.roundedBoxGeometry(ow + 0.02, mantelY - oh, depth + 0.06, 0.015), stoneM);
  lintel.position.set(0, oh + (mantelY - oh) / 2, -depth / 2 + 0.03);
  g.add(lintel);
  const key = F.rbox(0.2, 0.2, 0.04, smooth, 0.02); key.position.set(0, oh + 0.1, 0.045); g.add(key);
  // firebox (dark sooty recess)
  const boxD = 0.42;
  // build inner faces only: back, sides, top (BackSide box)
  const inner = mesh(new THREE.BoxGeometry(ow - 0.012, oh - 0.006, boxD), new THREE.MeshStandardMaterial({ color: '#120a06', roughness: 1, side: THREE.BackSide, emissive: '#3a1404', emissiveIntensity: 0.25 }), { cast: false });
  inner.position.set(0, (oh - 0.006) / 2, -boxD / 2 + 0.03);
  g.add(inner);
  // hearth slab
  const hearth = mesh(F.roundedBoxGeometry(w + 0.2, 0.06, 0.55, 0.012), smooth);
  hearth.position.set(0, 0.03, 0.2);
  g.add(hearth);
  // mantel shelf with corbels
  const wal = M.walnut({ tint: '#3e2416' });
  const shelf = F.rbox(w + 0.18, 0.07, depth * 0.55 + 0.16, wal, 0.015);
  shelf.position.set(0, mantelY + 0.035, 0.04);
  g.add(shelf);
  const mould = F.rbox(w + 0.08, 0.06, 0.07, wal, 0.012); mould.position.set(0, mantelY - 0.03, 0.06); g.add(mould);
  for (const s of [-1, 1]) {
    const c = F.rbox(0.09, 0.22, 0.12, wal, 0.02); c.position.set(s * (w / 2 - 0.02), mantelY - 0.14, 0.05); g.add(c);
  }
  // fire
  const f = fire({ w: ow * 0.7, h: oh * 0.78 });
  f.position.set(0, 0.0, -boxD / 2 + 0.06);
  g.add(f);
  g.userData.mantelY = mantelY + 0.07;
  g.userData.fire = f;
  g.userData.fireOrigin = new THREE.Vector3(0, 0.12, -boxD / 2 + 0.08);
  g.userData.opening = { w: ow, h: oh };
  return g;
}

// ---------------------------------------------------------------------------------------------
// GRANDFATHER CLOCK
// ---------------------------------------------------------------------------------------------
function clockFaceTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  const R = S / 2;
  const gr = g.createRadialGradient(R, R * 0.9, 10, R, R, R);
  gr.addColorStop(0, '#f3e9cf'); gr.addColorStop(0.8, '#e6d6b0'); gr.addColorStop(1, '#bfa776');
  g.fillStyle = gr; g.beginPath(); g.arc(R, R, R, 0, TAU); g.fill();
  // aged speckle
  const r = rng(5);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,60,20,${r() * 0.06})`; g.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 3); }
  g.strokeStyle = '#3a2614'; g.lineWidth = 3;
  g.beginPath(); g.arc(R, R, R * 0.95, 0, TAU); g.stroke();
  g.beginPath(); g.arc(R, R, R * 0.86, 0, TAU); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(R, R, R * 0.62, 0, TAU); g.stroke();
  // minute ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const r0 = R * 0.86, r1 = i % 5 ? R * 0.9 : R * 0.95;
    g.lineWidth = i % 5 ? 2 : 4;
    g.beginPath(); g.moveTo(R + Math.cos(a) * r0, R + Math.sin(a) * r0); g.lineTo(R + Math.cos(a) * r1, R + Math.sin(a) * r1); g.stroke();
  }
  const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.fillStyle = '#1e140c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(S * 0.085)}px ${SERIF}`;
  nums.forEach((n, i) => {
    const a = (i / 12) * TAU - Math.PI / 2;
    g.save(); g.translate(R + Math.cos(a) * R * 0.74, R + Math.sin(a) * R * 0.74); g.rotate(a + Math.PI / 2);
    g.fillText(n, 0, 0); g.restore();
  });
  g.font = `italic 600 ${Math.round(S * 0.042)}px ${SERIF}`;
  g.fillStyle = '#4a321c';
  g.fillText('Quince · Tower', R, R * 1.32);
  g.fillText('MDCCLXII', R, R * 1.42);
  return canvasTexture(c);
}

function moonDialTexture() {
  const W = 512, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#0f1a3c'); gr.addColorStop(1, '#22346a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(12);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,240,200,${0.4 + r() * 0.6})`; const x = r() * W, y = r() * H * 0.9; g.beginPath(); g.arc(x, y, 1 + r() * 2, 0, TAU); g.fill(); }
  // moon with a face
  g.fillStyle = '#f0dc9a'; g.beginPath(); g.arc(W * 0.5, H * 0.55, H * 0.3, 0, TAU); g.fill();
  g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(W * 0.46, H * 0.5, 6, 0, TAU); g.arc(W * 0.55, H * 0.5, 6, 0, TAU); g.fill();
  g.strokeStyle = '#a8843a'; g.lineWidth = 3; g.beginPath(); g.arc(W * 0.5, H * 0.6, 18, 0.3, Math.PI - 0.3); g.stroke();
  return canvasTexture(c);
}

function handShape(len, width, tail, spade = true) {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.35, -tail);
  s.lineTo(width * 0.35, -tail);
  s.lineTo(width * 0.22, len * 0.55);
  if (spade) {
    s.quadraticCurveTo(width * 1.4, len * 0.68, width * 0.25, len * 0.8);
    s.lineTo(0, len);
    s.lineTo(-width * 0.25, len * 0.8);
    s.quadraticCurveTo(-width * 1.4, len * 0.68, -width * 0.22, len * 0.55);
  } else {
    s.lineTo(width * 0.08, len);
    s.lineTo(-width * 0.08, len);
    s.lineTo(-width * 0.22, len * 0.55);
  }
  s.closePath();
  // counterweight ring on the tail
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false });
  const ring = new THREE.CylinderGeometry(width * 0.5, width * 0.5, 0.002, 16); ring.rotateX(Math.PI / 2); ring.translate(0, -tail * 0.7, 0.001);
  const ni = (x) => (x.index ? x.toNonIndexed() : x);
  return mergeGeometries([ni(geo), ni(ring)]);
}

/**
 * Longcase clock. Front +Z. userData: { faceCenter (local V3), faceRadius, hourHand, minuteHand (Groups, rotate .z negative = clockwise),
 *   pendulum (Group, swing .rotation.z), panel (Group hinged at its left edge — rotate .y negative to open), keySpot (Group inside the base) }
 */
export function grandfatherClock() {
  const g = new THREE.Group(); g.name = 'grandfatherClock';
  const wood = M.mahogany({ tint: '#5a2416' });
  const dark = M.walnut({ tint: '#2a140c' });
  const brass = M.brass();
  const W = 0.56, D = 0.36;
  // plinth + base
  const plinth = F.rbox(W + 0.06, 0.08, D + 0.05, dark, 0.012); plinth.position.y = 0.04; g.add(plinth);
  // base: a recessed core plus a front frame around the panel opening (so the cavity is really open)
  const pw = 0.3, ph = 0.28, py = 0.34;
  const fz0 = 0.03, fd = D / 2 - fz0; // frame depth
  const core = F.rbox(W, 0.5, D / 2 + fz0, wood, 0.015); core.position.set(0, 0.33, (-D / 2 + fz0) / 2); g.add(core);
  const ox = (pw - 0.02) / 2, oy = (ph - 0.02) / 2;
  const fr = (x0, x1, y0, y1) => { const m = F.rbox(x1 - x0, y1 - y0, fd, wood, 0.006); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, fz0 + fd / 2); g.add(m); };
  fr(-W / 2, -ox, 0.08, 0.58); fr(ox, W / 2, 0.08, 0.58); fr(-ox, ox, 0.08, py - oy); fr(-ox, ox, py + oy, 0.58);
  const baseCap = F.rbox(W + 0.04, 0.04, D + 0.04, dark, 0.012); baseCap.position.y = 0.6; g.add(baseCap);
  // base panel (door) + cavity
  const cav = mesh(new THREE.BoxGeometry(pw - 0.03, ph - 0.03, 0.15), new THREE.MeshStandardMaterial({ color: '#160b06', roughness: 1, side: THREE.BackSide }), { cast: false });
  cav.position.set(0, py, D / 2 - 0.068);
  g.add(cav);
  const panel = new THREE.Group(); panel.name = 'clockPanel';
  panel.position.set(-pw / 2, py, D / 2 + 0.004);
  const pf = F.rbox(pw, ph, 0.02, wood, 0.006); pf.position.x = pw / 2; panel.add(pf);
  const pin = F.rbox(pw - 0.06, ph - 0.06, 0.008, dark, 0.004); pin.position.set(pw / 2, 0, 0.012); panel.add(pin);
  const knobM = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), brass); knobM.position.set(pw - 0.03, 0, 0.02); panel.add(knobM);
  const rose = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 24), brass); rose.position.set(pw / 2, 0, 0.018); panel.add(rose);
  g.add(panel);
  const keySpot = new THREE.Group(); keySpot.position.set(0, py - ph / 2 + 0.02, D / 2 - 0.06); g.add(keySpot);
  const cavLight = new THREE.PointLight('#ffc070', 0, 0.7, 2); cavLight.position.set(0, py + 0.08, D / 2 - 0.02); g.add(cavLight);
  // waist
  const waistW = 0.44, waistH = 0.92, waistY0 = 0.62;
  const waist = F.rbox(waistW, waistH, D - 0.06, wood, 0.012); waist.position.set(0, waistY0 + waistH / 2, -0.03); g.add(waist);
  // trunk window (glass) with dark interior + pendulum
  const winW = 0.24, winH = 0.62, winY = waistY0 + 0.15 + winH / 2;
  const interior = mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshStandardMaterial({ color: '#1a0d07', roughness: 1 }), { cast: false });
  interior.position.set(0, winY, D / 2 - 0.08);
  g.add(interior);
  const frame = [];
  for (const [x, y, w, h] of [[0, winY + winH / 2 + 0.015, winW + 0.06, 0.03], [0, winY - winH / 2 - 0.015, winW + 0.06, 0.03], [-winW / 2 - 0.015, winY, 0.03, winH], [winW / 2 + 0.015, winY, 0.03, winH]]) {
    const b = F.rbox(w, h, 0.03, dark, 0.006); b.position.set(x, y, D / 2 - 0.045); g.add(b); frame.push(b);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), M.glass({ opacity: 0.12 }));
  glass.position.set(0, winY, D / 2 - 0.04); glass.renderOrder = 3;
  g.add(glass);
  const pendulum = new THREE.Group(); pendulum.name = 'pendulum';
  pendulum.position.set(0, waistY0 + waistH + 0.05, D / 2 - 0.1);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.66, 8), brass); rod.position.y = -0.33; pendulum.add(rod);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.014, 32), M.brass({ polished: true })); bob.rotation.x = Math.PI / 2; bob.position.y = -0.66; pendulum.add(bob);
  const bobRim = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.006, 8, 32), brass); bobRim.position.y = -0.66; pendulum.add(bobRim);
  g.add(pendulum);
  // weights on chains
  for (const x of [-0.07, 0.07]) {
    const wt = F.lathe([[0, 0], [0.022, 0], [0.024, 0.01], [0.024, 0.16], [0.02, 0.17], [0, 0.17]], brass, 16);
    wt.position.set(x, winY + 0.02 + (x > 0 ? -0.06 : 0), D / 2 - 0.12); g.add(wt);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.3, 4), brass); ch.position.set(x, winY + 0.33 + (x > 0 ? -0.06 : 0), D / 2 - 0.12); g.add(ch);
  }
  // hood
  const hoodY0 = waistY0 + waistH, hoodH = 0.6;
  const hoodCap = F.rbox(W + 0.04, 0.04, D + 0.04, dark, 0.012); hoodCap.position.y = hoodY0 + 0.02; g.add(hoodCap);
  const hood = F.rbox(W, hoodH, D, wood, 0.015); hood.position.y = hoodY0 + 0.04 + hoodH / 2; g.add(hood);
  for (const s of [-1, 1]) {
    const col = F.lathe([[0, 0], [0.022, 0], [0.018, 0.03], [0.016, hoodH - 0.06], [0.022, hoodH - 0.03], [0.022, hoodH - 0.02], [0, hoodH - 0.02]], brass, 14);
    col.position.set(s * (W / 2 - 0.02), hoodY0 + 0.05, D / 2 + 0.01); g.add(col);
  }
  // face plate (brass square dial plate) + painted face
  const faceR = 0.165;
  const faceCenter = new THREE.Vector3(0, hoodY0 + 0.04 + 0.25, D / 2 + 0.004);
  const plate = F.rbox(faceR * 2 + 0.06, faceR * 2 + 0.06, 0.006, brass, 0.003); plate.position.copy(faceCenter); plate.position.z -= 0.003; g.add(plate);
  const face = mesh(new THREE.CircleGeometry(faceR, 48), new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.55 }), { cast: false });
  face.position.copy(faceCenter); face.position.z += 0.002; g.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(faceR + 0.006, 0.008, 10, 48), M.brass({ polished: true })); bezel.position.copy(faceCenter); bezel.position.z += 0.004; g.add(bezel);
  // arch with moon dial
  const archR = faceR + 0.03;
  const archY = faceCenter.y + faceR + 0.03;
  const archShape = new THREE.Shape(); archShape.absarc(0, 0, archR, 0, Math.PI, false); archShape.lineTo(archR, 0);
  const archGeo = new THREE.ShapeGeometry(archShape, 24);
  const ap = archGeo.attributes.position, au = archGeo.attributes.uv;
  for (let i = 0; i < ap.count; i++) au.setXY(i, (ap.getX(i) + archR) / (archR * 2), ap.getY(i) / archR);
  const archM = mesh(archGeo, new THREE.MeshStandardMaterial({ map: moonDialTexture(), roughness: 0.5 }), { cast: false });
  archM.position.set(0, archY, D / 2 + 0.003); g.add(archM);
  const archHood = F.rbox(W, 0.26, D, wood, 0.015); archHood.position.set(0, archY + 0.09, -0.006); g.add(archHood);
  // pediment + finials
  const ped = F.rbox(W + 0.08, 0.05, D + 0.06, dark, 0.012); ped.position.y = archY + 0.24; g.add(ped);
  const pedShape = new THREE.Shape(); pedShape.moveTo(-W / 2 - 0.02, 0); pedShape.lineTo(W / 2 + 0.02, 0); pedShape.lineTo(0.05, 0.12); pedShape.lineTo(-0.05, 0.12); pedShape.closePath();
  const pedM = mesh(new THREE.ExtrudeGeometry(pedShape, { depth: D * 0.9, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }), wood);
  pedM.position.set(0, archY + 0.265, -D * 0.45); g.add(pedM);
  for (const [x, y] of [[-W / 2, archY + 0.27], [W / 2, archY + 0.27], [0, archY + 0.4]]) {
    const fin = F.lathe([[0, 0], [0.02, 0], [0.012, 0.02], [0.022, 0.05], [0.01, 0.08], [0.003, 0.1], [0, 0.1]], M.brass({ polished: true }), 14);
    fin.position.set(x, y, D * 0.1); g.add(fin);
  }
  // hands
  const handMat = blued();
  const hourHand = new THREE.Group(); hourHand.position.copy(faceCenter); hourHand.position.z += 0.008;
  const hh = new THREE.Mesh(handShape(faceR * 0.55, 0.026, 0.03), handMat); hourHand.add(hh);
  const minuteHand = new THREE.Group(); minuteHand.position.copy(faceCenter); minuteHand.position.z += 0.013;
  const mh = new THREE.Mesh(handShape(faceR * 0.86, 0.02, 0.04, false), handMat); minuteHand.add(mh);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 16), M.brass({ polished: true }));
  cap.rotation.x = Math.PI / 2; cap.position.copy(faceCenter); cap.position.z += 0.017; g.add(cap);
  g.add(hourHand, minuteHand);
  F.shadowAll(g);
  [face, archM, interior, glass].forEach((m) => { m.castShadow = false; });
  g.userData = { ...g.userData, faceCenter, faceRadius: faceR, hourHand, minuteHand, pendulum, panel, keySpot, face, cavLight };
  return g;
}

// ---------------------------------------------------------------------------------------------
// GLOBE
// ---------------------------------------------------------------------------------------------
function globeTexture() {
  const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#a99d78'); gr.addColorStop(0.5, '#b7ab84'); gr.addColorStop(1, '#a3966f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(33);
  // continents: blobby polygons in old-map ochre/green
  const blob = (cx, cy, rx, ry, col) => {
    g.fillStyle = col; g.strokeStyle = '#5a4022'; g.lineWidth = 2;
    g.beginPath();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, k = 0.7 + r() * 0.5;
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); g.fill(); g.stroke();
  };
  const land = ['#c9a96a', '#b89a5e', '#a8a060', '#c4b07a'];
  [[180, 160, 110, 80], [230, 300, 60, 110], [520, 150, 140, 70], [560, 290, 70, 90], [760, 170, 120, 90], [820, 360, 70, 40], [380, 420, 120, 25], [960, 220, 40, 60], [60, 260, 40, 50]].forEach(([x, y, a, b], i) => blob(x, y, a, b, land[i % land.length]));
  // graticule
  g.strokeStyle = 'rgba(70,50,25,0.35)'; g.lineWidth = 1;
  for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo((i / 12) * W, 0); g.lineTo((i / 12) * W, H); g.stroke(); }
  for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(0, (j / 6) * H); g.lineTo(W, (j / 6) * H); g.stroke(); }
  // sea monster & labels
  g.fillStyle = '#4a3420'; g.font = `italic 600 26px ${SERIF}`; g.textAlign = 'center';
  g.fillText('Mare Incognitum', 420, 250);
  g.fillText('Here be Newts', 700, 460);
  g.fillText('Patagonia', 250, 360);
  g.strokeStyle = '#4a3420'; g.lineWidth = 3;
  g.beginPath(); for (let i = 0; i < 4; i++) g.arc(640 + i * 26, 420, 12, Math.PI, 0, false); g.stroke();
  // ageing
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(60,40,15,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 3, 3); }
  return canvasTexture(c);
}

/** Floor-standing globe. userData: { sphere (Group to spin about local Y), update(dt) with spin(vel) } */
export function globe({ r = 0.24 } = {}) {
  const g = new THREE.Group(); g.name = 'globe';
  const wood = M.walnut();
  const brass = M.brass();
  // tripod
  const legH = 0.62;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    const leg = F.lathe([[0, 0], [0.018, 0], [0.024, legH * 0.3], [0.03, legH * 0.55], [0.02, legH * 0.85], [0.022, legH], [0, legH]], wood, 10);
    leg.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
    leg.rotation.set(Math.sin(a) * -0.22, 0, Math.cos(a) * 0.22);
    g.add(leg);
  }
  const hub = F.lathe([[0, 0], [0.05, 0], [0.06, 0.03], [0.03, 0.07], [0.02, 0.12], [0, 0.12]], wood, 16); hub.position.y = legH - 0.02; g.add(hub);
  const centerY = legH + 0.1 + r;
  // horizon ring
  const horizon = new THREE.Mesh(new THREE.TorusGeometry(r + 0.04, 0.018, 8, 48), wood);
  horizon.rotation.x = Math.PI / 2; horizon.scale.z = 0.5; horizon.position.y = centerY; g.add(horizon);
  const horizonTop = new THREE.Mesh(new THREE.RingGeometry(r + 0.02, r + 0.06, 48), M.parchment({ tint: '#d8c49a' }));
  horizonTop.rotation.x = -Math.PI / 2; horizonTop.position.y = centerY + 0.01; g.add(horizonTop);
  for (const s of [-1, 1]) { const post = F.lathe([[0, 0], [0.012, 0], [0.012, centerY - legH - 0.1], [0, centerY - legH - 0.1]], wood, 8); post.position.set(s * (r + 0.04), legH + 0.1, 0); g.add(post); }
  // tilted axis group
  const tilt = new THREE.Group(); tilt.position.y = centerY; tilt.rotation.z = 0.41; g.add(tilt);
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(r + 0.015, 0.006, 8, 64), brass); meridian.rotation.y = Math.PI / 2; tilt.add(meridian);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, r * 2 + 0.06, 6), brass); tilt.add(axle);
  const sphere = new THREE.Group(); tilt.add(sphere);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.45, metalness: 0 }));
  sphere.add(ball);
  F.shadowAll(g);
  horizonTop.castShadow = false;
  let vel = 0;
  g.userData.sphere = sphere;
  g.userData.spin = (v) => { vel += v; };
  g.userData.update = (dt) => {
    if (Math.abs(vel) < 0.002) { vel = 0; return; }
    sphere.rotation.y += vel * dt;
    vel *= Math.exp(-dt * 0.45);
  };
  return g;
}

// ---------------------------------------------------------------------------------------------
// PORTRAIT — painted wizard holding an open pocket watch (7:35)
// ---------------------------------------------------------------------------------------------
/** Paints the portrait into a canvas (pw × ph). Eyes (irises) are separate meshes; this paints the whites. */
export function paintPortrait(g, w, h) {
  const r = rng(77);
  // background: dark olive with warm glow behind the head
  let gr = g.createRadialGradient(w * 0.5, h * 0.3, w * 0.05, w * 0.5, h * 0.45, w * 0.95);
  gr.addColorStop(0, '#6a5a3a'); gr.addColorStop(0.5, '#3a3020'); gr.addColorStop(1, '#16110b');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // drape on the left
  gr = g.createLinearGradient(0, 0, w * 0.25, 0);
  gr.addColorStop(0, '#3a0c0e'); gr.addColorStop(0.6, '#6a1a1c'); gr.addColorStop(1, 'rgba(90,20,22,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.28, 0); g.bezierCurveTo(w * 0.12, h * 0.3, w * 0.22, h * 0.6, w * 0.08, h); g.lineTo(0, h); g.fill();
  // robe / shoulders
  gr = g.createLinearGradient(0, h * 0.45, 0, h);
  gr.addColorStop(0, '#4b5263'); gr.addColorStop(1, '#262a35');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(w * 0.08, h); g.bezierCurveTo(w * 0.1, h * 0.62, w * 0.3, h * 0.5, w * 0.5, h * 0.5);
  g.bezierCurveTo(w * 0.7, h * 0.5, w * 0.9, h * 0.62, w * 0.92, h); g.fill();
  // robe folds
  g.strokeStyle = 'rgba(20,22,30,0.5)'; g.lineWidth = w * 0.008;
  for (let i = 0; i < 6; i++) { const x = w * (0.2 + i * 0.12); g.beginPath(); g.moveTo(x, h * 0.62); g.bezierCurveTo(x - w * 0.02, h * 0.75, x + w * 0.03, h * 0.88, x, h); g.stroke(); }
  // star embroidery on robe
  g.fillStyle = '#c9a24a';
  for (let i = 0; i < 14; i++) { const x = w * (0.15 + r() * 0.7), y = h * (0.62 + r() * 0.35); g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? w * 0.004 : w * 0.011; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
  // face
  const fx = w * 0.5, fy = h * 0.34, fw = w * 0.16, fh = h * 0.12;
  gr = g.createRadialGradient(fx - fw * 0.3, fy - fh * 0.3, 2, fx, fy, fw * 1.2);
  gr.addColorStop(0, '#e8bf98'); gr.addColorStop(0.7, '#c99470'); gr.addColorStop(1, '#8a5a40');
  g.fillStyle = gr; g.beginPath(); g.ellipse(fx, fy, fw, fh, 0, 0, TAU); g.fill();
  // ears
  g.fillStyle = '#b88262'; g.beginPath(); g.ellipse(fx - fw * 0.98, fy + fh * 0.05, fw * 0.14, fh * 0.26, 0, 0, TAU); g.ellipse(fx + fw * 0.98, fy + fh * 0.05, fw * 0.14, fh * 0.26, 0, 0, TAU); g.fill();
  // beard: long, grey, flowing to the chest
  gr = g.createLinearGradient(0, fy, 0, h * 0.78);
  gr.addColorStop(0, '#d8d6d0'); gr.addColorStop(1, '#9a9890');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(fx - fw * 0.95, fy + fh * 0.1);
  g.bezierCurveTo(fx - fw * 1.1, fy + fh * 1.6, fx - fw * 0.5, h * 0.72, fx, h * 0.8);
  g.bezierCurveTo(fx + fw * 0.5, h * 0.72, fx + fw * 1.1, fy + fh * 1.6, fx + fw * 0.95, fy + fh * 0.1);
  g.bezierCurveTo(fx + fw * 0.6, fy + fh * 0.7, fx - fw * 0.6, fy + fh * 0.7, fx - fw * 0.95, fy + fh * 0.1);
  g.fill();
  g.strokeStyle = 'rgba(110,108,100,0.6)'; g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) { const x0 = fx + (r() - 0.5) * fw * 1.6; g.beginPath(); g.moveTo(x0, fy + fh * 0.7); g.bezierCurveTo(x0 + (r() - 0.5) * 20, fy + fh * 2, x0 + (r() - 0.5) * 30, h * 0.65, fx + (x0 - fx) * 0.3, h * (0.7 + r() * 0.08)); g.stroke(); }
  // moustache
  g.fillStyle = '#c8c6c0';
  g.beginPath(); g.moveTo(fx, fy + fh * 0.45); g.bezierCurveTo(fx - fw * 0.4, fy + fh * 0.3, fx - fw * 0.8, fy + fh * 0.6, fx - fw * 0.9, fy + fh * 0.95); g.bezierCurveTo(fx - fw * 0.5, fy + fh * 0.75, fx - fw * 0.2, fy + fh * 0.75, fx, fy + fh * 0.65);
  g.bezierCurveTo(fx + fw * 0.2, fy + fh * 0.75, fx + fw * 0.5, fy + fh * 0.75, fx + fw * 0.9, fy + fh * 0.95); g.bezierCurveTo(fx + fw * 0.8, fy + fh * 0.6, fx + fw * 0.4, fy + fh * 0.3, fx, fy + fh * 0.45); g.fill();
  // nose
  g.fillStyle = 'rgba(150,90,60,0.6)'; g.beginPath(); g.ellipse(fx, fy + fh * 0.22, fw * 0.12, fh * 0.2, 0, 0, TAU); g.fill();
  // eyes: whites (irises are 3D meshes on top)
  for (const s of [-1, 1]) {
    g.fillStyle = '#efe6d2'; g.beginPath(); g.ellipse(fx + s * fw * 0.42, fy - fh * 0.12, fw * 0.2, fh * 0.12, 0, 0, TAU); g.fill();
    g.strokeStyle = '#3a2416'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(fx + s * fw * 0.42, fy - fh * 0.12, fw * 0.2, fh * 0.12, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  }
  // bushy brows
  g.strokeStyle = '#e4e2dc'; g.lineWidth = 3;
  for (const s of [-1, 1]) for (let i = 0; i < 18; i++) { const x0 = fx + s * fw * (0.22 + r() * 0.45); g.beginPath(); g.moveTo(x0, fy - fh * 0.32); g.lineTo(x0 + s * (6 + r() * 10), fy - fh * (0.42 + r() * 0.15)); g.stroke(); }
  // hat: tall, crumpled, midnight blue with stars
  gr = g.createLinearGradient(fx - fw, 0, fx + fw, 0);
  gr.addColorStop(0, '#1a2346'); gr.addColorStop(0.5, '#2c3a6e'); gr.addColorStop(1, '#151c38');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(fx - fw * 1.25, fy - fh * 0.5);
  g.bezierCurveTo(fx - fw * 0.6, fy - fh * 1.6, fx - fw * 0.1, fy - fh * 2.4, fx + fw * 0.15, h * 0.02);
  g.bezierCurveTo(fx + fw * 0.5, fy - fh * 2.2, fx + fw * 1.4, fy - fh * 2.0, fx + fw * 1.6, fy - fh * 1.8); // the crumpled tip flops right
  g.bezierCurveTo(fx + fw * 1.0, fy - fh * 1.7, fx + fw * 0.7, fy - fh * 1.2, fx + fw * 1.25, fy - fh * 0.5);
  g.closePath(); g.fill();
  g.fillStyle = '#121a36'; g.beginPath(); g.ellipse(fx, fy - fh * 0.52, fw * 1.5, fh * 0.22, 0, 0, TAU); g.fill();
  g.fillStyle = '#e1b84f';
  for (const [sx, sy, sr] of [[-0.4, -1.3, 0.09], [0.2, -1.8, 0.07], [0.5, -1.0, 0.06]]) { const x = fx + sx * fw, y = fy + sy * fh; g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? fw * sr * 0.4 : fw * sr; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
  // hand holding the watch (lower right of chest)
  const hx = w * 0.62, hy = h * 0.78;
  g.fillStyle = '#c99470';
  g.beginPath(); g.ellipse(hx, hy + h * 0.035, w * 0.075, h * 0.03, -0.2, 0, TAU); g.fill();
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(hx - w * 0.055 + i * w * 0.035, hy + h * 0.055, w * 0.016, h * 0.022, 0, 0, TAU); g.fill(); }
  // sleeve
  g.fillStyle = '#353b4a'; g.beginPath(); g.moveTo(hx + w * 0.06, hy + h * 0.02); g.lineTo(w * 0.95, hy - h * 0.05); g.lineTo(w * 0.95, hy + h * 0.14); g.lineTo(hx + w * 0.05, hy + h * 0.08); g.fill();
  // watch chain
  g.strokeStyle = '#d9b45a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(hx - w * 0.02, hy - h * 0.04); g.bezierCurveTo(w * 0.5, h * 0.7, w * 0.42, h * 0.66, w * 0.36, h * 0.62); g.stroke();
  // (watch face itself is a crisp overlay mesh; paint its gold case shadow)
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(hx + 3, hy - h * 0.005 + 4, w * 0.068, 0, TAU); g.fill();
  // varnish craquelure + vignette
  g.strokeStyle = 'rgba(20,12,4,0.12)'; g.lineWidth = 1;
  for (let i = 0; i < 120; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  gr = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,2,0.55)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return { face: { x: fx / w, y: fy / h, fw: fw / w, fh: fh / h }, watch: { x: hx / w, y: (hy - h * 0.005) / h, r: (w * 0.068) / w } };
}

/** Pocket-watch face reading 7:35 (crisp overlay for the portrait). */
export function watchTexture() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), R = S / 2;
  let gr = g.createRadialGradient(R * 0.8, R * 0.8, 10, R, R, R);
  gr.addColorStop(0, '#ffe7a0'); gr.addColorStop(0.7, '#d4a845'); gr.addColorStop(1, '#7a5a1c');
  g.fillStyle = gr; g.beginPath(); g.arc(R, R, R, 0, TAU); g.fill();
  gr = g.createRadialGradient(R, R * 0.85, 5, R, R, R * 0.84);
  gr.addColorStop(0, '#fbf5e4'); gr.addColorStop(1, '#e2d4b0');
  g.fillStyle = gr; g.beginPath(); g.arc(R, R, R * 0.84, 0, TAU); g.fill();
  g.strokeStyle = '#2b1a10'; g.lineWidth = 4;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2, r0 = R * 0.76, r1 = i % 5 ? R * 0.8 : R * 0.83;
    g.lineWidth = i % 5 ? 2 : 6;
    g.beginPath(); g.moveTo(R + Math.cos(a) * r0, R + Math.sin(a) * r0); g.lineTo(R + Math.cos(a) * r1, R + Math.sin(a) * r1); g.stroke();
  }
  g.fillStyle = '#1e140c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(S * 0.1)}px ${SERIF}`;
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * TAU - Math.PI / 2; g.fillText(String(i), R + Math.cos(a) * R * 0.63, R + Math.sin(a) * R * 0.63); }
  const hand = (frac, len, wid) => {
    const a = frac * TAU - Math.PI / 2;
    g.save(); g.translate(R, R); g.rotate(a);
    g.fillStyle = '#141a26'; g.beginPath(); g.moveTo(-R * 0.08, -wid); g.lineTo(len * 0.85, -wid * 0.6); g.lineTo(len, 0); g.lineTo(len * 0.85, wid * 0.6); g.lineTo(-R * 0.08, wid); g.closePath(); g.fill();
    g.restore();
  };
  hand((7 + 35 / 60) / 12, R * 0.42, 10); // hour
  hand(35 / 60, R * 0.68, 7);              // minute
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(R, R, 12, 0, TAU); g.fill();
  // crystal glint
  gr = g.createLinearGradient(R * 0.3, R * 0.3, R, R);
  gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(R * 0.75, R * 0.65, R * 0.38, R * 0.18, -0.7, 0, TAU); g.fill();
  return canvasTexture(c);
}

// ---------------------------------------------------------------------------------------------
// EMBROIDERY (mantel sampler) & CUSHION faces
// ---------------------------------------------------------------------------------------------
function stitchGrid(g, w, h, cell, fn) {
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const col = fn(x / w, y / h, x, y);
    if (!col) continue;
    g.strokeStyle = col; g.lineWidth = cell * 0.28;
    g.beginPath(); g.moveTo(x + cell * 0.2, y + cell * 0.2); g.lineTo(x + cell * 0.8, y + cell * 0.8); g.moveTo(x + cell * 0.8, y + cell * 0.2); g.lineTo(x + cell * 0.2, y + cell * 0.8); g.stroke();
  }
}
/** Cross-stitch sampler: "BLESS THIS TOWER" with a small cat and a tower. */
export function paintSampler(g, w, h) {
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
  // linen weave
  g.strokeStyle = 'rgba(150,130,90,0.15)'; g.lineWidth = 1;
  for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
  for (let j = 0; j < h; j += 4) { g.beginPath(); g.moveTo(0, j); g.lineTo(w, j); g.stroke(); }
  // border
  const cell = Math.round(w / 64);
  stitchGrid(g, w, h, cell, (u, v, x, y) => {
    const bx = x < cell * 3 || x > w - cell * 4 || y < cell * 3 || y > h - cell * 4;
    if (bx && ((x / cell + y / cell) % 4 < 2)) return '#7a1c22';
    return null;
  });
  g.fillStyle = '#1f4a36'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(h * 0.13)}px ${SERIF}`;
  g.fillText('BLESS THIS', w / 2, h * 0.24);
  g.fillText('TOWER', w / 2, h * 0.4);
  // tower
  g.fillStyle = '#5a4630';
  g.fillRect(w * 0.18, h * 0.55, w * 0.12, h * 0.33);
  g.beginPath(); g.moveTo(w * 0.16, h * 0.55); g.lineTo(w * 0.24, h * 0.45); g.lineTo(w * 0.32, h * 0.55); g.fill();
  g.fillStyle = '#e1b84f'; g.fillRect(w * 0.225, h * 0.62, w * 0.03, h * 0.05);
  // cat (a big round one — Bean, surely)
  g.fillStyle = '#4a4a4e';
  g.beginPath(); g.ellipse(w * 0.68, h * 0.78, w * 0.16, h * 0.1, 0, 0, TAU); g.fill();
  g.beginPath(); g.arc(w * 0.56, h * 0.68, w * 0.065, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(w * 0.51, h * 0.65); g.lineTo(w * 0.52, h * 0.58); g.lineTo(w * 0.55, h * 0.63); g.fill();
  g.beginPath(); g.moveTo(w * 0.61, h * 0.65); g.lineTo(w * 0.6, h * 0.58); g.lineTo(w * 0.57, h * 0.63); g.fill();
  g.strokeStyle = '#4a4a4e'; g.lineWidth = w * 0.02; g.beginPath(); g.moveTo(w * 0.83, h * 0.8); g.quadraticCurveTo(w * 0.92, h * 0.72, w * 0.86, h * 0.62); g.stroke();
  g.fillStyle = '#e1b84f'; g.beginPath(); g.arc(w * 0.54, h * 0.675, w * 0.009, 0, TAU); g.arc(w * 0.585, h * 0.675, w * 0.009, 0, TAU); g.fill();
  g.fillStyle = '#7a1c22'; g.font = `italic 600 ${Math.round(h * 0.06)}px ${SERIF}`; g.fillText('B.Q. & B.', w * 0.68, h * 0.93);
}

/** The cushion's embroidered face. The tiny row of four spines (the clue) sits along the bottom edge. */
export function paintCushion(g, w, h) {
  g.fillStyle = '#2a3c2a'; g.fillRect(0, 0, w, h);
  const r = rng(8);
  // fussy floral medallion
  g.save(); g.translate(w / 2, h * 0.45);
  for (let ring = 0; ring < 3; ring++) {
    const n = 8 + ring * 4, rad = w * (0.1 + ring * 0.11);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.2;
      g.save(); g.rotate(a); g.translate(rad, 0);
      g.fillStyle = ['#c9a24a', '#b8484a', '#d8c8a0'][ring];
      g.beginPath(); g.ellipse(0, 0, w * 0.045, w * 0.018, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a2a2a'; g.beginPath(); g.arc(0, 0, w * 0.007, 0, TAU); g.fill();
      g.restore();
    }
  }
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(0, 0, w * 0.06, 0, TAU); g.fill();
  g.fillStyle = '#7a1c22'; g.beginPath(); g.arc(0, 0, w * 0.03, 0, TAU); g.fill();
  g.restore();
  // vines & tiny leaves everywhere
  g.strokeStyle = '#8aa060'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h * 0.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60, x + (r() - 0.5) * 80, y + (r() - 0.5) * 80); g.stroke(); g.fillStyle = '#6a8a4a'; g.beginPath(); g.ellipse(x, y, 5, 2.5, r() * 3, 0, TAU); g.fill(); }
  // border
  g.strokeStyle = '#c9a24a'; g.lineWidth = w * 0.025; g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
  g.strokeStyle = '#7a1c22'; g.lineWidth = w * 0.008; g.strokeRect(w * 0.075, h * 0.075, w * 0.85, h * 0.85);
  // THE CLUE: a tiny stitched row of four book spines, bottom centre (unreadable without magnification)
  drawSpineRow(g, w * 0.5, h * 0.84, w * 0.1);
}

export const CLUE_COLORS = ['#2f8a3a', '#7a38a8', '#b8221e', '#d9aa22']; // green, violet, red, gold
export function drawSpineRow(g, cx, cy, width) {
  const bw = width / 5.2, bh = width * 0.55;
  CLUE_COLORS.forEach((col, i) => {
    const x = cx - width / 2 + i * bw * 1.4 + bw * 0.2;
    g.fillStyle = col; g.fillRect(x, cy - bh / 2, bw, bh);
    g.fillStyle = 'rgba(255,230,160,0.8)'; g.fillRect(x, cy - bh * 0.3, bw, bh * 0.07); g.fillRect(x, cy + bh * 0.2, bw, bh * 0.07);
  });
}

/** Magnified view of the stitching, shown inside the lens. */
export function paintMagnified(g, w, h) {
  // linen + stitches
  g.fillStyle = '#2a3c2a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 0; i < w; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
  for (let j = 0; j < h; j += 10) { g.beginPath(); g.moveTo(0, j); g.lineTo(w, j); g.stroke(); }
  const bw = w * 0.13, bh = h * 0.46, gap = w * 0.06;
  const x0 = w / 2 - (bw * 4 + gap * 3) / 2;
  const names = ['', '', '', ''];
  CLUE_COLORS.forEach((col, i) => {
    const x = x0 + i * (bw + gap), y = h * 0.27;
    // stitched spine: filled with thread lines
    g.fillStyle = col; g.fillRect(x, y, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
    for (let k = 0; k < bh; k += 6) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + bw, y + k + 4); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    for (let k = 3; k < bh; k += 6) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + bw, y + k + 4); g.stroke(); }
    g.fillStyle = '#f0d27a'; g.fillRect(x, y + bh * 0.15, bw, bh * 0.05); g.fillRect(x, y + bh * 0.78, bw, bh * 0.05);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(x, y, bw, bh);
    void names;
  });
  // a stitched arrow underneath: left → right
  g.strokeStyle = '#d8c8a0'; g.lineWidth = 5; g.setLineDash([12, 8]);
  g.beginPath(); g.moveTo(x0, h * 0.84); g.lineTo(x0 + bw * 4 + gap * 3, h * 0.84); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#d8c8a0'; g.beginPath(); const ax = x0 + bw * 4 + gap * 3; g.moveTo(ax + 18, h * 0.84); g.lineTo(ax - 4, h * 0.84 - 14); g.lineTo(ax - 4, h * 0.84 + 14); g.fill();
  g.font = `italic 600 ${Math.round(h * 0.07)}px ${SERIF}`; g.textAlign = 'center';
  g.fillText('as the dawn arrives', w / 2, h * 0.16);
}

// ---------------------------------------------------------------------------------------------
// small dressing
// ---------------------------------------------------------------------------------------------
/** Skull with a candle stub melted onto it. Front +Z. */
export function skull() {
  const g = new THREE.Group(); g.name = 'skull';
  const b = bone();
  const cran = mesh(new THREE.SphereGeometry(0.075, 24, 18), b); cran.scale.set(0.92, 0.9, 1.08); cran.position.y = 0.085; g.add(cran);
  const face = mesh(F.roundedBoxGeometry(0.1, 0.07, 0.07, 0.025), b); face.position.set(0, 0.045, 0.045); g.add(face);
  const cheek = mesh(new THREE.SphereGeometry(0.03, 12, 10), b);
  for (const s of [-1, 1]) { const c = cheek.clone(); c.position.set(s * 0.036, 0.05, 0.06); g.add(c); }
  const sock = new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 1 });
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.02, 12, 10), sock); e.scale.set(1, 0.9, 0.6); e.position.set(s * 0.028, 0.072, 0.085); g.add(e); }
  const nose = mesh(new THREE.ConeGeometry(0.01, 0.02, 3), sock); nose.rotation.x = Math.PI; nose.position.set(0, 0.048, 0.093); g.add(nose);
  const teeth = mesh(F.roundedBoxGeometry(0.05, 0.014, 0.01, 0.004), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.5 })); teeth.position.set(0, 0.022, 0.082); g.add(teeth);
  const jaw = mesh(F.roundedBoxGeometry(0.08, 0.02, 0.06, 0.008), b); jaw.position.set(0, 0.008, 0.055); g.add(jaw);
  // melted candle stub on top
  const wax = M.wax();
  const puddle = mesh(new THREE.SphereGeometry(0.035, 16, 8, 0, TAU, 0, Math.PI / 2), wax); puddle.scale.y = 0.3; puddle.position.set(0, 0.15, -0.005); g.add(puddle);
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; const d = mesh(new THREE.CapsuleGeometry(0.004, 0.03 + i * 0.006, 3, 6), wax); d.position.set(Math.cos(a) * 0.045, 0.13, Math.sin(a) * 0.045 - 0.005); d.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(d); }
  return g;
}

/** Hourglass on brass-and-walnut caps. */
export function hourglass({ h = 0.2 } = {}) {
  const g = new THREE.Group(); g.name = 'hourglass';
  const wd = M.walnut();
  const capR = h * 0.32;
  const bot = F.lathe([[0, 0], [capR, 0], [capR, h * 0.06], [0, h * 0.06]], wd, 20); g.add(bot);
  const top = bot.clone(); top.position.y = h * 0.94; g.add(top);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const p = F.lathe([[0, 0], [0.006, 0], [0.008, h * 0.4], [0.006, h * 0.88], [0, h * 0.88]], M.brass(), 8); p.position.set(Math.cos(a) * capR * 0.8, h * 0.06, Math.sin(a) * capR * 0.8); g.add(p); }
  const prof = [[0.002, h * 0.06], [capR * 0.7, h * 0.08], [capR * 0.7, h * 0.22], [0.008, h * 0.48], [0.008, h * 0.52], [capR * 0.7, h * 0.78], [capR * 0.7, h * 0.92], [0.002, h * 0.94]];
  const glassM = F.lathe(prof, M.glass({ opacity: 0.25 }), 20); glassM.castShadow = false; glassM.renderOrder = 2; g.add(glassM);
  const sandM = M.matte('#d8b070', { roughness: 0.95 });
  const sandBot = F.lathe([[0, h * 0.065], [capR * 0.65, h * 0.08], [capR * 0.4, h * 0.16], [0, h * 0.22]], sandM, 16); g.add(sandBot);
  const sandTop = F.lathe([[0, h * 0.62], [capR * 0.5, h * 0.7], [capR * 0.62, h * 0.78], [0, h * 0.78]], sandM, 16); g.add(sandTop);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, h * 0.42, 4), sandM); stream.position.y = h * 0.42; g.add(stream);
  return g;
}

/** Inkpot (with ink) — origin at base. */
export function inkpot() {
  const g = new THREE.Group(); g.name = 'inkpot';
  const glassM = F.lathe([[0.002, 0], [0.035, 0], [0.04, 0.01], [0.04, 0.04], [0.03, 0.05], [0.016, 0.055], [0.016, 0.065], [0.019, 0.068], [0.002, 0.068]], M.glass({ color: '#2a3a4a', opacity: 0.55 }), 20);
  glassM.renderOrder = 2; glassM.castShadow = true; g.add(glassM);
  const inkM = F.lathe([[0, 0.003], [0.033, 0.004], [0.036, 0.035], [0, 0.035]], ink(), 18); g.add(inkM);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 16), M.brass()); collar.rotation.x = Math.PI / 2; collar.position.y = 0.066; g.add(collar);
  return g;
}

/** Quill pen. Origin at the nib; the feather extends along +Y. */
export function quill({ len = 0.3 } = {}) {
  const g = new THREE.Group(); g.name = 'quill';
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0028, len, 6), M.matte('#e8dcc0')); shaft.position.y = len / 2; g.add(shaft);
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.003, 0.02, 6), M.matte('#1a120a')); nib.rotation.x = Math.PI; nib.position.y = -0.008; g.add(nib);
  const s = new THREE.Shape();
  s.moveTo(0, len * 0.25);
  s.bezierCurveTo(0.03, len * 0.4, 0.035, len * 0.8, 0.004, len * 1.02);
  s.bezierCurveTo(-0.012, len * 0.85, -0.018, len * 0.5, 0, len * 0.25);
  const vane = new THREE.Mesh(new THREE.ShapeGeometry(s, 16), feather());
  vane.castShadow = true;
  g.add(vane);
  const vane2 = vane.clone(); vane2.rotation.y = 0.5; g.add(vane2);
  return g;
}

/** Magnifying glass lying flat (lens +Y). */
export function magnifier() {
  const g = new THREE.Group(); g.name = 'magnifier';
  const ring = mesh(new THREE.TorusGeometry(0.045, 0.006, 10, 32), M.brass({ polished: true })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.007; g.add(ring);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.004, 32), M.glass({ color: '#e0f0ff', opacity: 0.3 })); lens.position.y = 0.007; lens.renderOrder = 2; g.add(lens);
  const neck = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.025, 8), M.brass()); neck.rotation.z = Math.PI / 2; neck.position.set(0.062, 0.007, 0); g.add(neck);
  const handle = F.lathe([[0, 0], [0.009, 0], [0.012, 0.03], [0.011, 0.08], [0.008, 0.09], [0, 0.09]], M.wood({ tint: '#2e1a0e', seed: 3 }), 12);
  handle.rotation.z = -Math.PI / 2; handle.position.set(0.074, 0.007, 0); g.add(handle);
  return g;
}

function sardineLabel() {
  const c = makeCanvas(256, 160), g = c.getContext('2d');
  g.fillStyle = '#c8b27a'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#1f3f6a'; g.fillRect(8, 8, 240, 144);
  g.fillStyle = '#e8d8a8'; g.textAlign = 'center';
  g.font = `700 34px ${SERIF}`; g.fillText('SARDINES', 128, 50);
  g.font = `italic 600 18px ${SERIF}`; g.fillText('finest · oil-packed', 128, 76);
  g.fillStyle = '#c0c8d0'; g.beginPath(); g.ellipse(120, 112, 52, 14, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(168, 112); g.lineTo(190, 98); g.lineTo(190, 126); g.fill();
  g.fillStyle = '#1f3f6a'; g.beginPath(); g.arc(84, 108, 3, 0, TAU); g.fill();
  return canvasTexture(c);
}
/** Sardine tin with key on the lid. */
export function sardineTin() {
  const g = new THREE.Group(); g.name = 'sardines';
  const body = mesh(F.roundedBoxGeometry(0.11, 0.025, 0.07, 0.012), tin()); body.position.y = 0.0125; g.add(body);
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.058), new THREE.MeshStandardMaterial({ map: sardineLabel(), roughness: 0.5, metalness: 0.3 }));
  lid.rotation.x = -Math.PI / 2; lid.position.y = 0.0256; g.add(lid);
  const key = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0018, 6, 14), tin()); key.rotation.x = Math.PI / 2; key.position.set(0.05, 0.027, 0.02); g.add(key);
  const keyBar = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 5), tin()); keyBar.rotation.x = Math.PI / 2; keyBar.position.set(0.05, 0.027, -0.005); g.add(keyBar);
  return g;
}

/** Small brass key lying flat (+X along its length). */
export function brassKey() {
  const g = new THREE.Group(); g.name = 'key_brass';
  const m = M.brass({ polished: true });
  const bow = mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 20), m); bow.rotation.x = Math.PI / 2; g.add(bow);
  const shaft = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 8), m); shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.038; g.add(shaft);
  const bit = mesh(F.roundedBoxGeometry(0.012, 0.004, 0.014, 0.001), m); bit.position.set(0.055, 0, 0.008); g.add(bit);
  const bit2 = mesh(F.roundedBoxGeometry(0.005, 0.004, 0.01, 0.001), m); bit2.position.set(0.045, 0, 0.007); g.add(bit2);
  g.position.y = 0.004;
  return g;
}

/** Big brass cat bowl engraved BEAN (the engraving faces +Z). */
export function catBowl() {
  const g = new THREE.Group(); g.name = 'catBowl';
  const prof = [[0, 0], [0.11, 0], [0.13, 0.008], [0.136, 0.07], [0.142, 0.075], [0.132, 0.078], [0.122, 0.024], [0, 0.022]];
  const bowl = F.lathe(prof, M.brass({ color: '#b08a3e', roughness: 0.4 }), 40); g.add(bowl);
  // engraving: transparent canvas band on the outer wall
  const c = makeCanvas(512, 96), x = c.getContext('2d');
  // polish: bright scratched-brass letters with a dark cut shadow (dark-on-dark letters vanished in the hearth's shade)
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 70px ${SERIF}`;
  x.fillStyle = 'rgba(30,16,4,0.85)'; x.fillText('B  E  A  N', 259, 55);
  x.fillStyle = 'rgba(255,224,160,0.97)'; x.fillText('B  E  A  N', 256, 52);
  x.strokeStyle = 'rgba(255,214,140,0.7)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(40, 10); x.lineTo(472, 10); x.moveTo(40, 88); x.lineTo(472, 88); x.stroke();
  const tex = canvasTexture(c);
  const arc = 1.5;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1385, 0.1335, 0.045, 32, 1, true, -arc / 2, arc), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffc070', emissiveMap: tex, emissiveIntensity: 0.32, transparent: true, roughness: 0.45, metalness: 0.4, depthWrite: false }));
  band.position.y = 0.042;
  band.userData.noHighlight = true;
  g.add(band);
  // a few kibbles
  const kib = M.matte('#6a4022');
  const r = rng(4);
  for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), kib); k.position.set((r() - 0.5) * 0.12, 0.028, (r() - 0.5) * 0.12); g.add(k); }
  return g;
}

/** Corner cobweb: a translucent radial web texture on a triangle-ish plane. */
let _webTex = null;
export function cobweb({ size = 0.6 } = {}) {
  if (!_webTex) {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = rng(19);
    g.strokeStyle = 'rgba(230,230,230,0.55)'; g.lineWidth = 1.4;
    const spokes = 9;
    for (let i = 0; i < spokes; i++) { const a = (i / (spokes - 1)) * (Math.PI / 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * S, Math.sin(a) * S); g.stroke(); }
    for (let k = 1; k < 12; k++) {
      const rad = (k / 12) * S * (0.9 + r() * 0.1);
      g.beginPath();
      for (let i = 0; i < spokes; i++) { const a = (i / (spokes - 1)) * (Math.PI / 2); const rr = rad * (0.92 + r() * 0.1); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i ? g.quadraticCurveTo(Math.cos(a - 0.1) * rr * 0.9, Math.sin(a - 0.1) * rr * 0.9, px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    _webTex = canvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: _webTex, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, color: '#b8b0a0' }));
  noRay(m);
  return m;
}

/** A rolled scroll with a ribbon. Lies along X. */
export function scroll({ len = 0.28, r = 0.022 } = {}) {
  const g = new THREE.Group(); g.name = 'scroll';
  const p = mesh(new THREE.CylinderGeometry(r, r, len, 16), M.parchment()); p.rotation.z = Math.PI / 2; p.position.y = r; g.add(p);
  const rib = mesh(new THREE.TorusGeometry(r + 0.002, 0.003, 6, 20), M.matte('#7a1c22')); rib.rotation.y = Math.PI / 2; rib.position.y = r; g.add(rib);
  return g;
}

/** A merged stack of books lying flat. */
export function bookStack({ count = 4, seed = 1, colors = ['#5a1a14', '#1f3a2a', '#3a2a14', '#22304a', '#4a3a1a', '#2a1a2a'] } = {}) {
  const r = rng(seed); const geos = []; let y = 0;
  for (let i = 0; i < count; i++) {
    const t = 0.03 + r() * 0.03, w = 0.17 + r() * 0.07, d = 0.23 + r() * 0.06;
    const geo = F.bookGeometry(t, w, d, colors[Math.floor(r() * colors.length)]); // standing book t thick, w tall
    // lying flat: rotate so spine faces +X-ish, page edges up
    geo.rotateZ(Math.PI / 2); geo.translate(t / 2, 0, 0); geo.rotateY((r() - 0.5) * 0.4 + (i % 2 ? 0.1 : -0.1));
    geo.translate(0, y, 0);
    // after rotateZ(90°) the book's height axis lies along -X; recentre
    geo.computeBoundingBox(); const bb = geo.boundingBox; geo.translate(-(bb.min.x + bb.max.x) / 2, y - bb.min.y, -(bb.min.z + bb.max.z) / 2);
    y += t;
    geos.push(geo);
  }
  const m = mesh(mergeGeometries(geos), F.bookMaterial());
  m.name = 'bookStack';
  return m;
}

// ---------------------------------------------------------------------------------------------
// GRIMOIRE on a stand, with chain and a 4-letter word lock
// ---------------------------------------------------------------------------------------------
function pageTexture() {
  const W = 512, H = 640, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(61);
  g.fillStyle = '#e9d9b0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(120,80,30,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 3, 3); }
  g.strokeStyle = 'rgba(60,30,10,0.75)'; g.lineWidth = 2;
  // pseudo-script lines
  for (let l = 0; l < 18; l++) {
    const y = 120 + l * 26; let x = 50;
    while (x < W - 60) { const len = 15 + r() * 45; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < len; k += 5) g.lineTo(x + k, y + Math.sin(k * 0.8 + r() * 3) * 4); g.stroke(); x += len + 10; }
  }
  // illuminated circle
  g.strokeStyle = '#8a3a1a'; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, 64, 40, 0, TAU); g.stroke();
  g.fillStyle = '#c9a24a'; g.font = `700 52px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', W / 2, 66);
  return canvasTexture(c);
}
function incantationTexture() {
  const W = 512, H = 640, c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(63);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f2e4bc'); gr.addColorStop(1, '#e2cf9a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,80,30,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 3, 3); }
  g.strokeStyle = '#8a3a1a'; g.lineWidth = 6; g.strokeRect(24, 24, W - 48, H - 48); g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
  g.fillStyle = '#4a1a0a'; g.textAlign = 'center'; g.font = `700 42px ${SERIF}`; g.fillText('The Rite of', W / 2, 100); g.fillText('Reversion', W / 2, 146);
  // pentagram of candles
  g.strokeStyle = '#7a2a1a'; g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 5; i++) { const a = (i * 2 / 5) * TAU - Math.PI / 2; const x = W / 2 + Math.cos(a) * 110, y = 360 + Math.sin(a) * 110; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.beginPath(); g.arc(W / 2, 360, 120, 0, TAU); g.stroke();
  g.font = `italic 600 22px ${SERIF}`; g.fillStyle = '#4a1a0a';
  ['Light the five as the Rite demands…', "…the lectern's neighbour first, then the last."].forEach((t, i) => g.fillText(t, W / 2, 530 + i * 34, W - 90));
  return canvasTexture(c);
}

/** Dial letter strip: 26 letters around a cylinder (axis = local X after rotation). */
function letterStripTexture() {
  const cell = 64, W = cell * 26, H = 64, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#b8923e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)'; g.fillRect(i * cell, 0, cell, H);
    g.strokeStyle = 'rgba(60,40,10,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, H); g.stroke();
    g.save(); g.translate(i * cell + cell / 2, H / 2); g.rotate(Math.PI / 2);
    g.fillStyle = '#2a1a08'; g.font = `700 50px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String.fromCharCode(65 + i), 0, 3);
    g.restore();
  }
  const t = canvasTexture(c);
  return t;
}

/**
 * Lectern-style stand with the chained grimoire and its word lock. Origin at the floor; front +Z.
 * userData: { book, cover (pivot Group; open = rotation.z → +2.95), pageMesh (incantation page on the open book),
 *   chain (Group), lock (Group), dials: [Group×4] (rotation.x per letter), arrows: [{ up, down }×4], diary (Mesh),
 *   lockCenter (local V3), bookTop (local V3), setLetter(i, v) }
 */
export function grimoireStand() {
  const g = new THREE.Group(); g.name = 'grimoireStand';
  const wd = M.walnut({ tint: '#3a2214' });
  // stand: turned column + tilted top
  const col = F.lathe([[0, 0], [0.18, 0], [0.18, 0.04], [0.12, 0.07], [0.05, 0.1], [0.04, 0.5], [0.055, 0.6], [0.04, 0.7], [0.04, 0.88], [0.09, 0.92], [0, 0.92]], wd, 20);
  g.add(col);
  const topG = new THREE.Group(); topG.position.set(0, 0.95, 0); topG.rotation.x = 0.32; g.add(topG);
  const board = F.rbox(0.5, 0.03, 0.38, wd, 0.01); topG.add(board);
  const lip = F.rbox(0.5, 0.04, 0.025, wd, 0.008); lip.position.set(0, 0.03, 0.19); topG.add(lip);
  // diary page tucked under the lip, sticking out
  const diary = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15), M.parchment({ tint: '#e6d6b2' }));
  diary.rotation.set(-Math.PI / 2 + 0.05, 0, 0.35); diary.position.set(0.19, 0.017, 0.15); diary.castShadow = true;
  topG.add(diary);
  // book
  const bw = 0.3, bd = 0.24, bt = 0.07;
  const book = new THREE.Group(); book.position.set(-0.01, 0.015, 0); topG.add(book);
  const lth = leather('#4a1410');
  const backCover = F.rbox(bw + 0.016, 0.008, bd + 0.016, lth, 0.003); backCover.position.y = 0.004; book.add(backCover);
  const pagesM = new THREE.MeshStandardMaterial({ color: '#e6d6ae', roughness: 0.9 });
  const pageBlock = F.rbox(bw - 0.004, bt - 0.016, bd - 0.008, pagesM, 0.004); pageBlock.position.set(0.004, 0.008 + (bt - 0.016) / 2, 0); book.add(pageBlock);
  const topPage = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.03, bd - 0.03), new THREE.MeshStandardMaterial({ map: pageTexture(), roughness: 0.9 }));
  topPage.rotation.x = -Math.PI / 2; topPage.position.set(0.006, bt - 0.0075, 0); book.add(topPage);
  const spine = mesh(new THREE.CylinderGeometry(bt / 2, bt / 2, bd + 0.016, 16, 1, false, Math.PI, Math.PI), lth); spine.rotation.x = Math.PI / 2; spine.position.set(-bw / 2 - 0.004, bt / 2, 0); book.add(spine);
  // front cover on a pivot at the spine edge (opens by rotating about local Z)
  const cover = new THREE.Group(); cover.position.set(-bw / 2 - 0.004, bt, 0); book.add(cover);
  const coverM = F.rbox(bw + 0.016, 0.008, bd + 0.016, lth, 0.003); coverM.position.set(bw / 2 + 0.004, 0.004, 0); cover.add(coverM);
  // tooled cover: brass corners + central sigil
  const brass = M.brass();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const cc = F.rbox(0.035, 0.004, 0.035, brass, 0.002); cc.position.set(bw / 2 + 0.004 + sx * (bw / 2 - 0.012), 0.009, sz * (bd / 2 - 0.012)); cover.add(cc); }
  const sig = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 6, 32), brass); sig.rotation.x = Math.PI / 2; sig.position.set(bw / 2 + 0.004, 0.0095, 0); cover.add(sig);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), M.glowing({ color: '#e05a3a', glow: 1.4 })); eye.scale.y = 0.4; eye.position.set(bw / 2 + 0.004, 0.01, 0); cover.add(eye);
  // endpaper on the inside of the cover
  const endp = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.01, bd - 0.01), M.parchment({ tint: '#c8a87a' })); endp.rotation.x = Math.PI / 2; endp.position.set(bw / 2 + 0.004, -0.0005, 0); cover.add(endp);
  // incantation page (rests on top of the page block; lifts out on solve)
  const page = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.05, bd - 0.04), new THREE.MeshStandardMaterial({ map: incantationTexture(), roughness: 0.85, emissive: '#ffd27a', emissiveIntensity: 0, side: THREE.DoubleSide }));
  page.rotation.x = -Math.PI / 2; page.position.set(0.008, bt - 0.006, 0); page.visible = false;
  book.add(page);
  // chain: links in two loops around the closed book (across its width)
  const chain = new THREE.Group(); chain.name = 'chain'; book.add(chain);
  const linkGeo = new THREE.TorusGeometry(0.009, 0.0026, 6, 12);
  const loopPts = [];
  const hw = bw / 2 + 0.012, th = bt + 0.012;
  for (const z of [-0.06, 0.06]) {
    const per = 2 * (bw + 0.024) + 2 * th, n = Math.round(per / 0.015);
    for (let i = 0; i < n; i++) {
      let s = (i / n) * per, x, y, dir;
      if (s < bw + 0.024) { x = -hw + s; y = th; dir = 0; } else if ((s -= bw + 0.024) < th) { x = hw; y = th - s; dir = 1; } else if ((s -= th) < bw + 0.024) { x = hw - s; y = -0.004; dir = 0; } else { s -= bw + 0.024; x = -hw; y = -0.004 + s; dir = 1; }
      loopPts.push({ x, y, z, dir, i });
    }
  }
  const links = new THREE.InstancedMesh(linkGeo, M.iron({ color: '#3a3836', roughness: 0.45 }), loopPts.length);
  const dm = new THREE.Object3D();
  loopPts.forEach((p, k) => { dm.position.set(p.x, p.y, p.z); dm.rotation.set(p.i % 2 ? Math.PI / 2 : 0, 0, p.dir ? Math.PI / 2 : 0); if (!p.dir) dm.rotation.set(p.i % 2 ? Math.PI / 2 : 0, Math.PI / 2, 0); dm.updateMatrix(); links.setMatrixAt(k, dm.matrix); });
  links.castShadow = true;
  chain.add(links);
  // lock: hangs from the chain at the book's front edge
  const lock = new THREE.Group(); lock.name = 'wordLock';
  // hangs plumb in front of the stand's lip (counter the lectern tilt) so its dials face the reader
  lock.position.set(0, 0.075, bd / 2 + 0.085); lock.rotation.x = -0.32;
  book.add(lock);
  const lockBody = F.rbox(0.15, 0.075, 0.03, M.brass({ color: '#a8843a', roughness: 0.35 }), 0.008); lock.add(lockBody);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 20, Math.PI), M.iron({ color: '#5a5650', roughness: 0.4 })); shackle.position.set(0, 0.035, -0.004); lock.add(shackle);
  const strip = letterStripTexture();
  const dialGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.024, 26, 1);
  dialGeo.rotateZ(Math.PI / 2); // axis along X
  const dials = [], arrows = [];
  const arrowMat = M.brass({ polished: true });
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Group(); d.position.set(-0.0465 + i * 0.031, -0.002, 0.018);
    const tex = strip.clone(); tex.needsUpdate = true;
    const dm2 = new THREE.Mesh(dialGeo, new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.4 }));
    d.add(dm2);
    lock.add(d);
    dials.push(d);
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.01, 3), arrowMat); up.position.set(d.position.x, 0.028, 0.017); up.rotation.set(0, 0, 0);
    const down = up.clone(); down.position.y = -0.032; down.rotation.z = Math.PI;
    lock.add(up, down);
    arrows.push({ up, down });
  }
  // reading window bar
  for (const sy of [1, -1]) { const bar = F.rbox(0.13, 0.0018, 0.003, M.brass({ polished: true }), 0.0006); bar.position.set(0, -0.002 + sy * 0.0029, 0.0355); lock.add(bar); } // reading window: one letter per dial between the rails
  F.shadowAll(g);
  page.castShadow = false;
  const STEP = TAU / 26;
  // Calibrated so the letter facing the viewer (+Z) is index v. (Cylinder u=0 starts at +Z… rotate by -v steps)
  const setLetter = (i, v) => { dials[i].rotation.x = (v + 0.5) * STEP; };
  g.userData = { ...g.userData, book, cover, page, chain, lock, dials, arrows, diary, setLetter, STEP, topG, coverClosedZ: 0 };
  return g;
}

export { noRay };
