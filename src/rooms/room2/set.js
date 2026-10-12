// Room 2 set dressing: shell, lights, shelves, benches, window, door, herbs, clutter.
// Everything static lives here; puzzles live in their own modules.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as L from '../../engine/props/lights.js';
import { makeCanvas, canvasTexture, rng } from '../../engine/props/textures.js';
import { physGlass, tube, mergeInto, softDot } from './util.js';

export const ROOM = { w: 7, d: 7, h: 4.2 };
export const SHELF = { x: -1.1, z: -3.27, w: 2.2, h: 2.62, d: 0.42, boards: [0.06, 0.62, 1.12, 1.62, 2.12, 2.6] };
export const shelfTop = (i) => SHELF.boards[i] + 0.0175;
export const BENCH = { x: -3.1, z: -0.4, len: 2.0, depth: 0.7, h: 0.86 };
export const ALEMBIC = { x: 3.15, z: -2.75, len: 1.1, depth: 0.55, h: 0.82 };
// round window in the north wall (faces +z, toward the vantage), above the alembic table
export const WINDOW = { x: 2.75, y: 2.1, z: -3.5, r: 0.5 };
export const CAULDRON = { x: -0.15, z: -0.65 };
export const STAIR = { x: 2.45, z: 0.95, r: 0.95 };

// ---------------------------------------------------------------------------------------------
// round window with a rain-on-glass shader
// ---------------------------------------------------------------------------------------------
const rainVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const rainFrag = /* glsl */`
  uniform float uTime; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
  vec3 sky(vec2 uv){
    vec3 col = mix(vec3(0.03,0.07,0.09), vec3(0.06,0.14,0.19), uv.y);
    float cl = fbm(uv*vec2(3.0,2.0) + vec2(uTime*0.015, 0.0));
    col = mix(col, vec3(0.16,0.22,0.26), smoothstep(0.45, 0.85, cl) * 0.7);
    vec2 md = uv - vec2(0.68, 0.7);
    float m = length(md);
    col += vec3(0.75,0.85,0.95) * (smoothstep(0.075, 0.065, m) * (1.0 - 0.5*smoothstep(0.5,0.8,cl)) + 0.22*exp(-m*7.0));
    // far tower roofs silhouette
    float roof = 0.18 + 0.05*step(0.5, fract(uv.x*3.0)) + 0.08*smoothstep(0.02,0.0,abs(fract(uv.x*3.0)-0.25)-0.04);
    col = mix(col, vec3(0.015,0.025,0.03), step(uv.y, roof));
    return col;
  }
  vec3 drops(vec2 uv, float t, float scale, float seed, inout vec2 off){
    vec2 g = uv * vec2(scale, scale*0.6);
    vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float h = hash(id + seed);
    float y = fract(-t * (0.12 + h*0.25) + h*7.0);
    vec2 p = vec2((hash(id + 3.1 + seed) - 0.5) * 0.6, y - 0.5);
    vec2 d = (f - p) * vec2(1.0, 1.4);
    float r = 0.1 + 0.08 * hash(id + 9.0 + seed);
    float m = smoothstep(r, r*0.6, length(d)) * step(0.35, h);
    float trail = smoothstep(0.04, 0.0, abs(f.x - p.x)) * smoothstep(p.y, p.y + 0.5, f.y) * (1.0 - smoothstep(0.0, 0.5, f.y - p.y)) * step(0.35, h);
    off += d * m * 0.08 + vec2(0.0, trail * 0.01);
    return vec3(m, trail, 0.0);
  }
  void main(){
    vec2 uv = vUv;
    vec2 off = vec2(0.0);
    vec3 a = drops(uv, uTime, 9.0, 0.0, off);
    vec3 b = drops(uv * 1.7 + 0.3, uTime * 1.3, 9.0, 4.0, off);
    float still = smoothstep(0.75, 0.97, noise(uv * 60.0)) * 0.6;
    vec3 col = sky(uv + off);
    col += vec3(0.5,0.65,0.75) * (a.x + b.x) * 0.22 + vec3(0.35,0.45,0.5) * (a.y + b.y) * 0.12 + vec3(0.3,0.4,0.45) * still * 0.25;
    float r = length(vUv - 0.5) * 2.0;
    col *= 1.0 - smoothstep(0.75, 1.0, r) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }`;

function roundWindow() {
  const g = new THREE.Group(); g.name = 'roundWindow';
  const r = WINDOW.r;
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: rainVert, fragmentShader: rainFrag, toneMapped: false });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
  glass.position.z = -0.06;
  g.add(glass);
  // deep stone reveal
  const reveal = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.06, 0.24, 40, 1, true), M.smoothStone({ color: '#6f7671' }));
  reveal.rotation.x = Math.PI / 2; reveal.position.z = 0.04;
  reveal.material = reveal.material.clone(); reveal.material.side = THREE.BackSide;
  g.add(reveal);
  const brass = M.brass({ color: '#b58d3e' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.045, 14, 48), brass);
  ring.position.z = 0.15; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r - 0.005, 0.018, 10, 48), M.iron({ color: '#2c2a27' }));
  ring2.position.z = -0.05; g.add(ring2);
  // mullions: a cross + inner ring
  const mm = M.iron({ color: '#2c2a27' });
  const bars = [];
  for (const rot of [0, Math.PI / 2]) { const b = F.rbox(r * 2, 0.022, 0.025, mm, 0.004); b.rotation.z = rot; b.position.z = -0.05; bars.push(b); }
  for (const b of bars) g.add(b);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(r * 0.45, 0.012, 8, 32), mm); inner.position.z = -0.05; g.add(inner);
  // rivets on the brass ring
  const rivG = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.012, 8, 6); s.translate(Math.cos(a) * (r + 0.03), Math.sin(a) * (r + 0.03), 0.19); rivG.push(new THREE.Mesh(s));
  }
  g.add(mergeInto(rivG, brass));
  // sill
  const sill = F.rbox(r * 2 + 0.3, 0.06, 0.3, M.smoothStone({ color: '#7e837d' }), 0.012);
  sill.position.set(0, -r - 0.08, 0.15);
  g.add(sill);
  g.userData.glass = glass;
  g.userData.sillTopY = -r - 0.05;
  g.userData.update = (dt, t) => { mat.uniforms.uTime.value = t; };
  return g;
}

// ---------------------------------------------------------------------------------------------
// shelf unit
// ---------------------------------------------------------------------------------------------
function shelfUnit() {
  const g = new THREE.Group(); g.name = 'shelfUnit';
  const wood = M.walnut({ tint: '#4a3020' });
  const { w, h, d, boards } = SHELF;
  for (const s of [-1, 1]) { const p = F.rbox(0.045, h + 0.04, d, wood, 0.008); p.position.set(s * (w / 2 - 0.0225), (h + 0.04) / 2, 0); g.add(p); }
  const back = F.rbox(w, h, 0.02, M.walnut({ tint: '#2e1f15' }), 0.004); back.position.set(0, h / 2, -d / 2 + 0.01); g.add(back);
  for (const y of boards) { const b = F.rbox(w - 0.06, 0.035, d - 0.02, wood, 0.006); b.position.set(0, y, 0.005); g.add(b); }
  const crown = F.rbox(w + 0.08, 0.05, d + 0.04, wood, 0.012); crown.position.set(0, h + 0.045, 0.01); g.add(crown);
  // brass label rails on the jar shelves
  for (const i of [2, 3]) { const rail = F.rbox(w - 0.08, 0.012, 0.008, M.brass(), 0.003); rail.position.set(0, boards[i] + 0.03, d / 2 - 0.01); g.add(rail); }
  return g;
}

// ---------------------------------------------------------------------------------------------
// herbs hanging from a rod
// ---------------------------------------------------------------------------------------------
function herbRack(len, seed = 3) {
  const g = new THREE.Group(); g.name = 'herbs';
  const r = rng(seed);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 10), M.iron());
  rod.rotation.x = Math.PI / 2; g.add(rod);
  for (const s of [-1, 1]) { const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 6), M.iron()); hang.position.set(0, 0.3, s * (len / 2 - 0.05)); g.add(hang); }
  const strings = [], greens = [], browns = [], flowers = [];
  const n = Math.floor(len / 0.16);
  for (let i = 0; i < n; i++) {
    const z = -len / 2 + 0.1 + (i + r() * 0.4) * ((len - 0.2) / n);
    const drop = 0.12 + r() * 0.14;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, drop, 4)); st.position.set(0, -drop / 2, z); strings.push(st);
    const bl = 0.22 + r() * 0.16, rad = 0.035 + r() * 0.03;
    const bundle = new THREE.Mesh(new THREE.ConeGeometry(rad, bl, 7, 3, true));
    bundle.position.set((r() - 0.5) * 0.02, -drop - bl / 2 + 0.02, z);
    bundle.rotation.set((r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.2);
    (r() < 0.6 ? greens : browns).push(bundle);
    // a few leaf tufts
    for (let k = 0; k < 4; k++) {
      const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02 + r() * 0.015, 0));
      lf.position.set((r() - 0.5) * rad * 1.6, -drop - bl * (0.6 + r() * 0.4), z + (r() - 0.5) * rad * 1.6);
      lf.scale.set(1, 1.8, 0.6);
      (r() < 0.25 ? flowers : r() < 0.6 ? greens : browns).push(lf);
    }
  }
  g.add(mergeInto(strings, M.matte('#8a6a40')));
  g.add(mergeInto(greens, M.matte('#5a6b3a', { roughness: 0.95 })));
  g.add(mergeInto(browns, M.matte('#7a5a34', { roughness: 0.95 })));
  if (flowers.length) g.add(mergeInto(flowers, M.matte('#8a5a8a', { roughness: 0.9 })));
  return g;
}

function scorchDecal(radius = 0.9) {
  const c = makeCanvas(256, 256), x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.5, 'rgba(5,8,6,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  // chalk circle around it
  x.strokeStyle = 'rgba(220,230,220,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.5; x.beginPath(); x.arc(128, 128, 110, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.save(); x.translate(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114); x.rotate(a); x.fillStyle = 'rgba(220,230,220,0.35)'; x.fillRect(-4, -4, 8, 8); x.restore(); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshStandardMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.003; m.receiveShadow = true;
  m.userData.noRaycast = true; m.raycast = () => {};
  return m;
}

function mortarAndPestle() {
  const g = new THREE.Group(); g.name = 'mortar';
  const st = M.smoothStone({ color: '#8d8a80' });
  g.add(F.lathe([[0, 0], [0.06, 0], [0.07, 0.01], [0.075, 0.05], [0.07, 0.075], [0.062, 0.078], [0.058, 0.07], [0.05, 0.035], [0, 0.03]], st, 24));
  const pestle = F.lathe([[0, 0], [0.018, 0.003], [0.02, 0.02], [0.012, 0.06], [0.01, 0.12], [0.014, 0.13], [0, 0.135]], st, 14);
  pestle.position.set(0.02, 0.04, 0); pestle.rotation.z = -0.6; g.add(pestle);
  const dust = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), M.matte('#b9b0d8'));
  dust.rotation.x = -Math.PI / 2; dust.position.y = 0.045; g.add(dust);
  return g;
}

function bookStack(n, seed) {
  const g = new THREE.Group(); const r = rng(seed);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.16 + r() * 0.08, d = 0.22 + r() * 0.06, t = 0.03 + r() * 0.03;
    const col = F.BOOK_COLORS[Math.floor(r() * F.BOOK_COLORS.length)];
    const b = F.rbox(w, t, d, M.matte(col, { roughness: 0.75 }), 0.004);
    b.position.set((r() - 0.5) * 0.02, y + t / 2, (r() - 0.5) * 0.02); b.rotation.y = (r() - 0.5) * 0.4;
    const pages = F.rbox(w - 0.012, t - 0.008, d - 0.006, M.matte('#e2d3ae'), 0.002); pages.position.copy(b.position); pages.position.x += 0.004; pages.rotation.copy(b.rotation);
    g.add(b, pages); y += t;
  }
  return g;
}

function scroll(len = 0.3) {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 14), M.parchment());
  roll.rotation.z = Math.PI / 2; roll.position.y = 0.022; g.add(roll);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.003, 6, 16), M.matte('#7a1f1f')); tie.rotation.y = Math.PI / 2; tie.position.set(0.04, 0.022, 0); g.add(tie);
  return F.shadowAll(g);
}

function barrel() {
  const g = new THREE.Group();
  g.add(F.lathe([[0, 0], [0.2, 0], [0.23, 0.15], [0.245, 0.3], [0.23, 0.45], [0.2, 0.6], [0, 0.6]], M.oak({ tint: '#6a4a2c' }), 20));
  for (const y of [0.1, 0.5]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.008, 6, 24), M.iron()); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); }
  return F.shadowAll(g);
}

function chalkboardFrame(tex) {
  const g = new THREE.Group(); g.name = 'chalkboard';
  const w = 1.5, h = 0.95;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  board.position.z = 0.02; g.add(board);
  const wood = M.oak({ tint: '#6a4a2c' });
  const t = 0.05;
  const top = F.rbox(w + t * 2, t, 0.04, wood, 0.008); top.position.set(0, h / 2 + t / 2, 0.02);
  const bot = top.clone(); bot.position.y = -h / 2 - t / 2;
  const l = F.rbox(t, h, 0.04, wood, 0.008); l.position.set(-w / 2 - t / 2, 0, 0.02);
  const r = l.clone(); r.position.x = w / 2 + t / 2;
  g.add(top, bot, l, r);
  const tray = F.rbox(w + 0.04, 0.025, 0.11, wood, 0.006); tray.position.set(0, -h / 2 - t - 0.005, 0.07); g.add(tray);
  const lip = F.rbox(w + 0.04, 0.03, 0.012, wood, 0.003); lip.position.set(0, -h / 2 - t + 0.012, 0.12); g.add(lip);
  // chalk sticks + eraser
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06 + i * 0.01, 8), M.matte(['#f2f2ea', '#e8d8f0', '#d8f0e8'][i]));
    c.rotation.z = Math.PI / 2; c.rotation.y = 0.2 * i; c.position.set(-0.5 + i * 0.08, -h / 2 - t + 0.014, 0.07); g.add(c);
  }
  const eraser = F.rbox(0.12, 0.03, 0.05, M.walnut(), 0.006); eraser.position.set(0.45, -h / 2 - t + 0.022, 0.07); g.add(eraser);
  const felt = F.rbox(0.115, 0.012, 0.045, M.matte('#d0ccc0'), 0.003); felt.position.set(0.45, -h / 2 - t + 0.006, 0.07); g.add(felt);
  F.shadowAll(g);
  g.userData.board = board;
  g.userData.trayY = -h / 2 - t + 0.0075;
  g.userData.trayZ = 0.07;
  return g;
}

function gasTank() {
  const g = new THREE.Group(); g.name = 'gasTank';
  const cu = M.copper();
  g.add(F.lathe([[0, 0], [0.2, 0], [0.22, 0.03], [0.22, 0.8], [0.18, 0.9], [0.06, 0.95], [0.05, 1.0], [0, 1.0]], cu, 28));
  for (const y of [0.15, 0.6]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.01, 6, 28), M.brass()); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 18), M.iron({ color: '#7a2a1a' })); valve.position.y = 1.04; valve.rotation.x = Math.PI / 2; g.add(valve);
  return F.shadowAll(g);
}

function stool() {
  const g = new THREE.Group(); g.name = 'stool';
  const wood = M.oak({ tint: '#6e4a2a' });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), wood); top.position.y = 0.6; g.add(top);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = F.rbox(0.035, 0.62, 0.035, wood, 0.006); l.position.set(Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); g.add(l); }
  return F.shadowAll(g);
}

// ---------------------------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------------------------
export function buildSet(room) {
  const G = room.group;
  const out = {};

  // shell
  const shell = F.roomShell({
    w: ROOM.w, d: ROOM.d, h: ROOM.h,
    floor: M.stone({ tint: '#525a56', rows: 4, cols: 4, repeat: [3.5, 3.5], seed: 21 }),
    wall: M.stone({ tint: '#5a6460', rows: 7, cols: 3, repeat: [3.5, 2.1], seed: 22 }),
    ceiling: M.walnut({ tint: '#2a2018', repeat: [3, 3] }),
    beams: 0, wainscot: 0, baseboard: false,
  });
  G.add(shell);
  // ceiling beams (the one over the stair stops short of the stairwell)
  const beamM = M.walnut({ tint: '#3a2416' });
  for (let i = 0; i < 4; i++) {
    const z = -ROOM.d / 2 + (ROOM.d * (i + 0.5)) / 4;
    const cut = Math.abs(z - STAIR.z) < STAIR.r + 0.2;
    const x0 = -ROOM.w / 2, x1 = cut ? STAIR.x - STAIR.r - 0.2 : ROOM.w / 2;
    const b = F.rbox(x1 - x0, 0.22, 0.18, beamM, 0.02); b.position.set((x0 + x1) / 2, ROOM.h - 0.11, z); G.add(b);
  }
  out.shell = shell;
  // ceiling hole for the stair: a dark disc with a stone collar
  const hole = new THREE.Mesh(new THREE.CircleGeometry(STAIR.r + 0.1, 40), new THREE.MeshBasicMaterial({ color: '#020304' }));
  hole.rotation.x = Math.PI / 2; hole.position.set(STAIR.x, ROOM.h - 0.005, STAIR.z); G.add(hole);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(STAIR.r + 0.12, 0.06, 8, 40), M.smoothStone({ color: '#6a6f6a' }));
  collar.rotation.x = Math.PI / 2; collar.position.set(STAIR.x, ROOM.h - 0.02, STAIR.z); G.add(collar);
  // the beams cross the stair hole; hide that with a faint glow from above
  const upGlow = L.lightShaft({ from: [STAIR.x, ROOM.h + 0.2, STAIR.z], to: [STAIR.x, ROOM.h - 1.0, STAIR.z], radiusTop: 0.7, radiusBottom: 0.9, color: '#6a8cff', opacity: 0.08, square: false });
  G.add(upGlow);

  // lights
  G.add(L.ambientRig({ sky: '#9cc8c0', ground: '#1a1410', hemi: 0.42, ambient: '#24302e', ambientIntensity: 0.32 }));
  const moon = L.keyLight({ color: '#a8c8ff', intensity: 9, position: [WINDOW.x - 0.6, 3.4, -6.8], target: [0.9, 0, -1.0], angle: 0.32, penumbra: 0.7, distance: 12, mapSize: 1024 });
  G.add(moon);
  out.moon = moon;
  const shelfGlow = new THREE.PointLight('#3fd0b0', 1.6, 3.2, 2); shelfGlow.position.set(SHELF.x, 1.5, SHELF.z + 0.6); G.add(shelfGlow);
  const fill = new THREE.PointLight('#ffc890', 1.2, 6, 2); fill.position.set(0.2, 3.3, 1.8); G.add(fill); // warm fill near the door
  out.shelfGlow = shelfGlow;

  // north: shelf unit
  const shelf = shelfUnit();
  shelf.position.set(SHELF.x, 0, SHELF.z);
  G.add(shelf);
  out.shelf = shelf;

  // bench (west) + chalkboard
  const bench = F.table({ w: BENCH.len, d: BENCH.depth, h: BENCH.h, material: M.oak({ tint: '#7a5232' }), legs: 'square', topThickness: 0.06 });
  bench.position.set(BENCH.x, 0, BENCH.z); bench.rotation.y = Math.PI / 2;
  G.add(bench);
  // lower shelf of the bench with crates
  const lower = F.rbox(BENCH.depth - 0.12, 0.03, BENCH.len - 0.14, M.oak({ tint: '#6a4a2c' }), 0.004); lower.position.set(BENCH.x, 0.18, BENCH.z); G.add(lower);
  const crate = F.rbox(0.42, 0.26, 0.5, M.wood({ tint: '#8a6a44', planks: 3, seed: 5 }), 0.01); crate.position.set(BENCH.x + 0.02, 0.325, BENCH.z + 0.45); G.add(crate);
  const bs = bookStack(4, 7); bs.position.set(BENCH.x, 0.195, BENCH.z - 0.5); G.add(bs);

  const chalkTex = room.chalkTexture;
  const board = chalkboardFrame(chalkTex);
  board.position.set(-ROOM.w / 2 + 0.005, 2.15, -0.55); board.rotation.y = Math.PI / 2;
  G.add(board);
  out.chalkboard = board;

  // bench clutter
  const mortar = mortarAndPestle(); mortar.position.set(BENCH.x + 0.12, BENCH.h, BENCH.z - 0.55); G.add(mortar);
  out.mortar = mortar;
  const bk = bookStack(3, 11); bk.position.set(BENCH.x - 0.12, BENCH.h, BENCH.z - 0.85); bk.rotation.y = 0.3; G.add(bk);
  const sc = scroll(0.32); sc.position.set(ALEMBIC.x + 0.12, ALEMBIC.h, ALEMBIC.z + 0.05); sc.rotation.y = 0.3; G.add(sc);
  const lamp = F.candle({ holder: 'dish', light: true, intensity: 0.8, distance: 2.6, h: 0.09 });
  lamp.position.set(BENCH.x - 0.26, BENCH.h, BENCH.z + 0.08); G.add(lamp);
  out.lamp = lamp;

  // herbs over the bench and by the window
  const herbs = herbRack(1.9, 3); herbs.position.set(-2.75, 3.35, -0.4); G.add(herbs);
  const herbs2 = herbRack(1.2, 8); herbs2.position.set(2.85, 3.35, -2.6); G.add(herbs2);
  out.herbs = [herbs, herbs2];

  // north: round window
  const win = roundWindow();
  win.position.set(WINDOW.x, WINDOW.y, WINDOW.z + 0.08);
  G.add(win);
  out.window = win;
  const shaft = L.lightShaft({ from: [WINDOW.x, WINDOW.y, WINDOW.z + 0.1], to: [1.5, 0.0, -1.3], radiusTop: 0.45, radiusBottom: 0.8, color: '#9cc4ff', opacity: 0.1, square: false });
  G.add(shaft);
  G.add(P.dustMotes({ box: [1.4, 1.6, 2.0], center: [2.1, 1.1, -2.3], count: 160, color: '#cfe6ff', opacity: 0.35 }));

  // alembic table under/next to the window
  const at = F.table({ w: ALEMBIC.len, d: ALEMBIC.depth, h: ALEMBIC.h, material: M.walnut({ tint: '#4a3020' }), legs: 'turned' });
  at.position.set(ALEMBIC.x, 0, ALEMBIC.z); at.rotation.y = -Math.PI / 2; G.add(at);
  // retort flask with green bubbling liquid on a tripod
  const tripod = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 20), M.iron()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; tripod.add(ring);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 5), M.iron()); l.position.set(Math.cos(a) * 0.07, 0.08, Math.sin(a) * 0.07); tripod.add(l); }
  const spirit = F.candle({ holder: 'none', light: false, h: 0.04, r: 0.02, color: '#58b0ff' }); spirit.position.y = 0.0; tripod.add(spirit);
  tripod.position.set(ALEMBIC.x - 0.05, ALEMBIC.h, ALEMBIC.z - 0.2); G.add(tripod);
  const retortGlass = physGlass({ color: '#e0fff4', opacity: 0.28 });
  const retort = F.lathe([[0, 0.0], [0.05, 0.005], [0.085, 0.04], [0.095, 0.09], [0.08, 0.14], [0.04, 0.17], [0.022, 0.19], [0.02, 0.24], [0.024, 0.245]], retortGlass, 28);
  retort.castShadow = false;
  retort.position.set(ALEMBIC.x - 0.05, ALEMBIC.h + 0.155, ALEMBIC.z - 0.2); G.add(retort);
  const retLiquid = F.lathe([[0, 0.0], [0.045, 0.008], [0.078, 0.04], [0.087, 0.075], [0, 0.075]], new THREE.MeshBasicMaterial({ color: new THREE.Color('#38e0a0').multiplyScalar(1.3) }), 24);
  retLiquid.position.copy(retort.position).add(new THREE.Vector3(0, 0.004, 0)); G.add(retLiquid);
  G.add(P.bubbles({ origin: [ALEMBIC.x - 0.05, ALEMBIC.h + 0.17, ALEMBIC.z - 0.2], radius: 0.05, rise: 0.05, count: 18, size: 0.01, color: '#c8fff0' }));
  const greenLight = new THREE.PointLight('#40e0a8', 0.9, 2.2, 2); greenLight.position.set(ALEMBIC.x - 0.2, ALEMBIC.h + 0.3, ALEMBIC.z - 0.2); G.add(greenLight);
  // copper condenser coil from the retort neck into a receiving flask
  const coilPts = [];
  const cx = ALEMBIC.x - 0.05, cz = ALEMBIC.z + 0.22, top = ALEMBIC.h + 0.42;
  coilPts.push([ALEMBIC.x - 0.05, ALEMBIC.h + 0.4, ALEMBIC.z - 0.2], [cx, top + 0.05, ALEMBIC.z]);
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2 * 3.5; coilPts.push([cx + Math.cos(a) * 0.07, top - i / 40 * 0.3, cz + Math.sin(a) * 0.07]); }
  coilPts.push([cx, ALEMBIC.h + 0.08, cz + 0.12]);
  G.add(tube(coilPts, 0.008, M.copper({ polished: true }), { segments: 240, radial: 8, tension: 0.5 }));
  const recv = F.bottle({ shape: 'round', r: 0.05, h: 0.14, color: '#bfe8de', contents: '#38e0a0', glow: 1.4 });
  recv.position.set(cx, ALEMBIC.h, cz + 0.16); G.add(recv);
  const bk2 = bookStack(2, 19); bk2.position.set(ALEMBIC.x + 0.05, ALEMBIC.h, ALEMBIC.z + 0.42); G.add(bk2);
  out.alembic = { retort, recv };

  // floor clutter
  const brl = barrel(); brl.position.set(-2.95, 0, -2.9); G.add(brl);
  const tank = gasTank(); tank.position.set(0.55, 0, -3.15); tank.scale.setScalar(0.9);
  G.add(tank);
  out.tank = tank;
  const st = stool(); st.position.set(0.85, 0, -0.25); G.add(st);
  out.stool = st;
  const scorch = scorchDecal(0.95); scorch.position.set(CAULDRON.x, 0.003, CAULDRON.z); G.add(scorch);

  // entry door (back to the study), west wall near the south corner
  const door = F.door({ rune: false, frame: 'stone', tint: '#5a3a22', seed: 6 });
  door.position.set(-ROOM.w / 2 + 0.02, 0, 2.3); door.rotation.y = Math.PI / 2;
  G.add(door);
  out.door = door;

  // a few candles about (no lights)
  for (const [x, y, z] of [[SHELF.x + 0.95, shelfTop(4), SHELF.z + 0.08], [ALEMBIC.x + 0.1, ALEMBIC.h, ALEMBIC.z - 0.45]]) {
    const c = F.candle({ holder: 'stick', light: false, h: 0.12 }); c.position.set(x, y, z); G.add(c);
  }
  // pointy hat on a hook by the door (slightly crushed; nobody slept in it)
  const hat = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 20, 4), M.velvet({ color: '#2a3a6a' }));
  cone.position.y = 0.21; cone.rotation.z = 0.25; cone.scale.set(1, 1, 0.85); hat.add(cone);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.015, 24), M.velvet({ color: '#2a3a6a' })); hat.add(brim);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), M.brass({ polished: true })); star.position.set(0.04, 0.17, 0.13); hat.add(star);
  F.shadowAll(hat);
  hat.position.set(-3.3, 1.75, 1.35); hat.rotation.set(0, Math.PI / 2, 0.3);
  G.add(hat);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), M.brass()); hook.rotation.z = Math.PI / 2; hook.position.set(-3.44, 1.86, 1.35); G.add(hook);
  out.hat = hat;

  // faint cool fog glow near the floor around the cauldron is done by steam; here: warm/cool sparkles near shelves
  G.add(P.sparkles({ box: [2.0, 1.8, 0.3], center: [SHELF.x, 1.5, SHELF.z + 0.3], count: 30, color: '#9ff0e0', color2: '#ffe0a0', size: 0.03, opacity: 0.6 }));

  return out;
}

export { softDot };
