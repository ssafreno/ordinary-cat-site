// ENDING — the cinematic set: the ritual circle under the dome, a door at the edge of the light, dawn beyond.
// Everything is in the set group's local space (origin = circle centre, floor y = 0, north = -Z).
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as T from '../../engine/props/textures.js';
import * as L from '../../engine/props/lights.js';
import { makeSardineTin } from './props.js';

const TAU = Math.PI * 2;

// Door placement: on a ring of radius DOOR_R, at angle DOOR_A (x = sin a * r, z = cos a * r), facing the circle.
export const DOOR_R = 3.6;
export const DOOR_A = -2.0;
export const doorPoint = (r = DOOR_R, y = 0) => new THREE.Vector3(Math.sin(DOOR_A) * r, y, Math.cos(DOOR_A) * r);
export const DOOR_FACING = DOOR_A + Math.PI; // rotation.y that faces the circle centre

/** Canvas texture: gilt ritual-circle inlay (rings, glyph band, five-point star, compass rose). Transparent. */
function circleInlayTexture() {
  const S = 1024, c = T.makeCanvas(S, S), g = c.getContext('2d'), r = T.rng(77);
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#fff'; g.shadowBlur = 10;
  const R = S * 0.47;
  const ring = (rad, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke(); };
  ring(R, 7); ring(R * 0.94, 3); ring(R * 0.8, 4); ring(R * 0.76, 2);
  // glyph band between 0.80 and 0.94
  g.lineWidth = 3.2;
  const glyphs = 40;
  for (let i = 0; i < glyphs; i++) {
    const a = (i / glyphs) * TAU;
    g.save(); g.rotate(a); g.translate(0, -R * 0.87);
    const k = Math.floor(r() * 6);
    g.beginPath();
    if (k === 0) { g.moveTo(-10, 12); g.lineTo(0, -12); g.lineTo(10, 12); g.moveTo(-6, 3); g.lineTo(6, 3); }
    else if (k === 1) { g.arc(0, 0, 10, 0.3, TAU - 0.3); g.moveTo(0, -14); g.lineTo(0, 14); }
    else if (k === 2) { g.moveTo(-10, -12); g.lineTo(10, 12); g.moveTo(10, -12); g.lineTo(-10, 12); g.moveTo(-12, 0); g.lineTo(12, 0); }
    else if (k === 3) { g.moveTo(0, -13); g.lineTo(0, 13); g.moveTo(0, -4); g.lineTo(10, -12); g.moveTo(0, 4); g.lineTo(-10, 12); }
    else if (k === 4) { g.arc(0, -5, 7, 0, TAU); g.moveTo(-10, 13); g.quadraticCurveTo(0, 0, 10, 13); }
    else { g.moveTo(-10, -10); g.lineTo(10, -10); g.lineTo(-10, 10); g.lineTo(10, 10); }
    g.stroke(); g.restore();
  }
  // five-pointed star through the candle points (E, N, W, SW, SE as compass angles on the canvas: +x = east, -y = north)
  const pts = [0, -90, 180, 135, 45].map((deg) => [Math.cos((deg * Math.PI) / 180) * R * 0.76, Math.sin((deg * Math.PI) / 180) * R * 0.76]);
  const order = [0, 2, 4, 1, 3, 0];
  g.lineWidth = 4;
  g.beginPath(); order.forEach((i, j) => (j ? g.lineTo(...pts[i]) : g.moveTo(...pts[i]))); g.stroke();
  for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 18, 0, TAU); g.stroke(); }
  // compass rose
  ring(R * 0.2, 3); ring(R * 0.12, 2);
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, L = i % 2 ? R * 0.17 : R * 0.3;
    g.beginPath();
    g.moveTo(Math.cos(a) * L, Math.sin(a) * L);
    g.lineTo(Math.cos(a + 0.35) * R * 0.06, Math.sin(a + 0.35) * R * 0.06);
    g.lineTo(Math.cos(a - 0.35) * R * 0.06, Math.sin(a - 0.35) * R * 0.06);
    g.closePath(); g.stroke();
  }
  g.font = '700 46px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [['N', 0, -R * 0.38], ['E', R * 0.38, 0], ['S', 0, R * 0.38], ['W', -R * 0.38, 0]].forEach(([t, x, y]) => g.fillText(t, x, y));
  return T.canvasTexture(c);
}

/** Dawn sky seen through the open door: gradient, low sun, a ridge of hills, a few lit clouds. */
function dawnTexture() {
  const w = 512, h = 768, c = T.makeCanvas(w, h), g = c.getContext('2d'), r = T.rng(5);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#6f86c4'); gr.addColorStop(0.35, '#c9a2c4'); gr.addColorStop(0.62, '#ffc59a');
  gr.addColorStop(0.78, '#fff0c8'); gr.addColorStop(1, '#ffd9a0');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // sun glow
  const sx = w * 0.52, sy = h * 0.74;
  let s = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.9);
  s.addColorStop(0, 'rgba(255,250,230,1)'); s.addColorStop(0.08, 'rgba(255,240,200,0.95)'); s.addColorStop(0.3, 'rgba(255,200,140,0.35)'); s.addColorStop(1, 'rgba(255,180,120,0)');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  // clouds
  for (let i = 0; i < 14; i++) {
    const cx = r() * w, cy = h * (0.25 + r() * 0.35), rw = 60 + r() * 120, rh = 6 + r() * 10;
    const cg = g.createRadialGradient(cx, cy, 0, cx, cy, rw);
    cg.addColorStop(0, `rgba(255,${200 + Math.floor(r() * 40)},${170 + Math.floor(r() * 40)},0.45)`); cg.addColorStop(1, 'rgba(255,210,180,0)');
    g.save(); g.translate(cx, cy); g.scale(1, rh / rw); g.translate(-cx, -cy);
    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, rw, 0, TAU); g.fill(); g.restore();
  }
  // hills
  const hill = (base, amp, col, seed) => {
    const rr = T.rng(seed);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.012 + seed)) - rr() * 3);
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  hill(h * 0.8, 40, 'rgba(176,130,150,0.85)', 2);
  hill(h * 0.86, 30, 'rgba(120,86,112,0.95)', 7);
  hill(h * 0.93, 22, '#4a3346', 11);
  return T.canvasTexture(c);
}

/** Soft floor spill of light falling through the doorway: a long feathered trapezoid. */
function spillTexture() {
  const w = 256, h = 512, c = T.makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 at the door, 1 far
    const half = 0.18 + v * 0.3;
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / w - 0.5);
      const edge = THREE.MathUtils.smoothstep(half, half - 0.1, u);
      const fall = Math.pow(1 - v, 1.4) * THREE.MathUtils.smoothstep(0, 0.04, v);
      const a = edge * fall;
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 214; img.data[i + 2] = 160; img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return T.canvasTexture(c);
}

/** Radial soft glow (for the circle's light pool). */
function glowTexture(inner = 'rgba(255,220,160,1)') {
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.4, 'rgba(255,190,120,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return T.canvasTexture(c);
}

export function buildSet() {
  const G = new THREE.Group(); G.name = 'endingSet';
  const parts = {};

  // ---- floor: dark flagstones that fall away into the blue -------------------------------------
  const floorM = M.stone({ tint: '#4a4640', rows: 6, cols: 6, repeat: [22, 22], seed: 31, unique: true });
  floorM.color = new THREE.Color('#9a948c');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(38, 72), floorM);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  G.add(floor);

  // circle inset: a darker smooth disc + brass rim + glowing inlay
  const inset = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), M.smoothStone({ color: '#2c2a2e', roughness: 0.55 }));
  inset.rotation.x = -Math.PI / 2; inset.position.y = 0.004; inset.receiveShadow = true;
  G.add(inset);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.025, 8, 96), M.brass({ polished: true }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; rim.receiveShadow = true;
  G.add(rim);
  const inlayM = new THREE.MeshBasicMaterial({ map: circleInlayTexture(), color: new THREE.Color('#ffc870').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), inlayM);
  inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.012;
  inlay.userData.noRaycast = true;
  G.add(inlay);
  const inlayBase = inlayM.color.clone();
  parts.inlay = inlay;
  parts.inlayLevel = { v: 1 };
  // the light pool around the circle (soft additive glow on the floor)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006;
  G.add(pool);

  // ---- candles at E, W, N, SE, SW ----------------------------------------------------------------
  const candleSpots = [[1.28, 0], [-1.28, 0], [0, -1.28], [0.9, 0.9], [-0.9, 0.9]];
  parts.candles = candleSpots.map(([x, z], i) => {
    const cd = F.candle({ holder: 'stick', h: 0.2 + (i % 3) * 0.03, r: 0.026, intensity: 1.5, distance: 4.5, light: true });
    cd.position.set(x, 0, z);
    G.add(cd);
    return cd;
  });

  // ---- the opened sardine tin at the centre ----------------------------------------------------
  const tin = makeSardineTin();
  tin.position.set(0.32, 0.012, 0.36); tin.rotation.y = 0.5;
  G.add(tin);
  parts.tin = tin;

  // ---- rising sparkles + embers from the circle --------------------------------------------------
  const embers = P.embers({ origin: [0, 0.05, 0], spread: 1.3, rise: 3.2, count: 140, color: '#ffd48a', color2: '#d7b0ff', size: 0.035 });
  G.add(embers);
  const sparks = P.sparkles({ box: [3.0, 2.6, 3.0], center: [0, 1.3, 0], count: 70, color: '#fff2c0', color2: '#c9a0ff', size: 0.05 });
  G.add(sparks);
  parts.embers = embers; parts.sparks = sparks;

  // ---- dome: a starfield sphere + faint brass ribs ---------------------------------------------
  const skyM = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#02040c') }, uHor: { value: new THREE.Color('#16204a') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP; void main(){ float h = clamp(vP.y, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.55)), 1.0); }',
  });
  const sky = new THREE.Group();
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), skyM);
  skyDome.renderOrder = -10;
  sky.add(skyDome);
  // crisp stars: screen-sized points on the upper hemisphere
  {
    const N = 1800, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rr = T.rng(33);
    for (let i = 0; i < N; i++) {
      const u = rr() * TAU, v = Math.pow(rr(), 0.7) * 0.95 + 0.04; // elevation 0..1 (sin)
      const ce = Math.sqrt(1 - v * v);
      pos.set([Math.cos(u) * ce * 36, v * 36, Math.sin(u) * ce * 36], i * 3);
      const b = 0.35 + Math.pow(rr(), 3) * 1.4, warm = rr() < 0.15;
      col.set([b * (warm ? 1.0 : 0.85), b * (warm ? 0.85 : 0.9), b * (warm ? 0.7 : 1.0)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, toneMapped: false }));
    stars.raycast = () => {};
    sky.add(stars);
  }
  G.add(sky);
  parts.sky = sky;
  const ribM = M.brass({ color: '#6e5426', roughness: 0.6 });
  const ribs = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.05, 6, 64, Math.PI / 2), ribM);
    rib.rotation.y = (i / 10) * TAU;
    ribs.add(rib);
  }
  const ribRing = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.07, 6, 120), ribM);
  ribRing.rotation.x = Math.PI / 2; ribRing.position.y = 0.02;
  ribs.add(ribRing);
  G.add(ribs);

  // ---- brass railing silhouettes on the far ring --------------------------------------------------
  const railR = 5.4;
  const railM = M.brass({ color: '#8f6c26', roughness: 0.45 });
  const postGeo = new THREE.CylinderGeometry(0.022, 0.026, 1.0, 8); postGeo.translate(0, 0.5, 0);
  const posts = new THREE.InstancedMesh(postGeo, railM, 56);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * TAU;
    m4.makeTranslation(Math.sin(a) * railR, 0, Math.cos(a) * railR);
    posts.setMatrixAt(i, m4);
  }
  G.add(posts);
  for (const y of [1.0, 0.55]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(railR, y > 0.9 ? 0.03 : 0.016, 6, 160), railM);
    rail.rotation.x = Math.PI / 2; rail.position.y = y;
    G.add(rail);
  }

  // ---- the tower wall around the exit door, with a hole for the doorway -------------------------
  const wallR = DOOR_R + 0.1, wallH = 4.2;
  const wallM = M.stone({ tint: '#5f5a52', rows: 7, cols: 4, repeat: [3, 2], seed: 41, unique: true });
  wallM.side = THREE.BackSide;
  const doorW = 1.2, doorH = 2.25, fw = 0.16;
  const halfA = (doorW / 2 + fw) / wallR;
  const span = 0.62;
  const seg = (a0, len, h, y0) => {
    const geo = new THREE.CylinderGeometry(wallR, wallR, h, 24, 1, true, a0, len);
    const m = new THREE.Mesh(geo, wallM);
    m.position.y = y0 + h / 2; m.receiveShadow = true;
    G.add(m);
    return m;
  };
  seg(DOOR_A + halfA, span, wallH, 0);
  seg(DOOR_A - halfA - span, span, wallH, 0);
  seg(DOOR_A - halfA, halfA * 2, wallH - doorH - fw + 0.02, doorH + fw - 0.02);
  const pillarM = M.smoothStone({ color: '#6f685e' });
  for (const a of [DOOR_A + halfA + span, DOOR_A - halfA - span]) {
    const pil = new THREE.Group();
    const shaftP = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, wallH, 20), pillarM);
    shaftP.position.y = wallH / 2; pil.add(shaftP);
    const baseP = F.rbox(0.56, 0.22, 0.56, pillarM, 0.03); baseP.position.y = 0.11; pil.add(baseP);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 8, 28), M.brass({ color: '#8f6c26' }));
    band.rotation.x = Math.PI / 2; band.position.y = 1.2; pil.add(band);
    pil.position.set(Math.sin(a) * wallR, 0, Math.cos(a) * wallR);
    F.shadowAll(pil);
    G.add(pil);
  }

  // the door
  const door = F.door({ w: doorW, h: doorH, tint: '#5a3a22', rune: true, runeColor: '#bfe0ff', frame: 'stone', seed: 9 });
  door.position.copy(doorPoint());
  door.rotation.y = DOOR_FACING;
  door.children[0].visible = false; // the engine's "darkness behind the leaf" — we have dawn back there instead
  G.add(door);
  parts.door = door;
  // the rune throws a cold light on whoever stands before it
  const runeLight = new THREE.PointLight('#9fc4ff', 3.0, 3.5, 1.6);
  runeLight.position.copy(doorPoint(DOOR_R - 0.55, 1.45));
  G.add(runeLight);
  parts.runeLight = runeLight;
  // a soft warm fill from the candle pool toward the door, so he isn't a pure silhouette there
  const doorFill = new THREE.SpotLight('#ffcf9a', 9, 8, 0.32, 0.8, 1.2);
  doorFill.position.set(0.6, 2.3, 0.6);
  doorFill.target.position.copy(doorPoint(DOOR_R - 0.8, 1.1));
  G.add(doorFill, doorFill.target);

  // dawn beyond the doorway (unlit, bright enough to bloom)
  const dawnM = new THREE.MeshBasicMaterial({ map: dawnTexture(), toneMapped: false, color: new THREE.Color(0.0, 0.0, 0.0), fog: false });
  const dawn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), dawnM);
  dawn.position.copy(doorPoint(DOOR_R + 0.3, 1.2));
  dawn.rotation.y = DOOR_FACING;
  G.add(dawn);
  parts.dawn = dawn;
  // a bit of dark sill/landing beyond the threshold so the doorway has depth
  const landing = F.rbox(1.5, 0.05, 0.6, M.smoothStone({ color: '#6d665c' }), 0.01);
  landing.position.copy(doorPoint(DOOR_R + 0.3, 0.0));
  landing.rotation.y = DOOR_FACING;
  G.add(landing);

  // light pouring through: spotlight from the doorway toward the circle, a shaft, and a floor spill
  const doorLight = new THREE.SpotLight('#ffc78e', 0, 14, 0.5, 0.75, 1.1);
  doorLight.position.copy(doorPoint(DOOR_R + 1.2, 1.8));
  doorLight.target.position.set(0.3, 0.0, 0.6);
  doorLight.castShadow = true;
  doorLight.shadow.mapSize.set(1024, 1024);
  doorLight.shadow.bias = -0.0008;
  doorLight.shadow.normalBias = 0.02;
  G.add(doorLight, doorLight.target);
  parts.doorLight = doorLight;

  const shaftFrom = doorPoint(DOOR_R - 0.05, 1.5).toArray();
  const shaftTo = doorPoint(DOOR_R - 2.4, 0.0).toArray();
  const shaft = L.lightShaft({ from: shaftFrom, to: shaftTo, radiusTop: 0.55, radiusBottom: 1.05, color: '#ffd09a', opacity: 0, square: true });
  G.add(shaft);
  parts.shaft = shaft;

  const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), new THREE.MeshBasicMaterial({ map: spillTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  spill.rotation.x = -Math.PI / 2;
  spill.rotation.z = DOOR_FACING; // texture top points at the door
  spill.position.copy(doorPoint(DOOR_R - 2.0, 0.008));
  G.add(spill);
  parts.spill = spill;

  const dawnMotes = P.dustMotes({ box: [1.6, 2.2, 1.6], center: doorPoint(DOOR_R - 1.1, 1.1).toArray(), count: 160, color: '#ffe2b0', size: 0.022, opacity: 0.6 });
  dawnMotes.userData.setOpacity(0);
  G.add(dawnMotes);
  parts.dawnMotes = dawnMotes;

  // ---- lighting -------------------------------------------------------------------------------
  G.add(new THREE.HemisphereLight('#4a5a9a', '#120c10', 0.55));
  G.add(new THREE.AmbientLight('#1a2040', 0.35));
  // key: a warm pool from the dome slit straight onto the circle
  const key = new THREE.SpotLight('#ffd8a8', 26, 12, 0.34, 0.65, 1.4);
  key.position.set(0.4, 6.5, 0.8); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  G.add(key, key.target);
  parts.key = key;
  // cool moon rim from behind
  const rimL = new THREE.SpotLight('#9fbaff', 40, 14, 0.45, 0.8, 1.3);
  rimL.position.set(1.2, 3.4, -3.6); rimL.target.position.set(0, 1.2, 0);
  G.add(rimL, rimL.target);
  parts.rim = rimL;
  // circle up-glow (gold/violet), flares at the start
  const glow = new THREE.PointLight('#ffcf8a', 3.0, 5, 1.6);
  glow.position.set(0, 0.35, 0);
  G.add(glow);
  parts.glow = glow;
  parts.glowBase = 3.0;

  // per-frame: inlay shimmer, sky rotation, glow breathing
  G.userData.update = (dt, t) => {
    const lv = parts.inlayLevel.v;
    inlayM.color.copy(inlayBase).multiplyScalar(lv * (0.88 + 0.12 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 7.3)));
    pool.material.opacity = 0.18 + 0.14 * lv;
    sky.rotation.y = t * 0.006;
    glow.intensity = parts.glowBase * lv * (0.9 + 0.1 * Math.sin(t * 2.3));
    ribs.rotation.y = t * 0.006;
  };

  parts.wallMaterial = wallM;
  G.userData.parts = parts;
  return G;
}
