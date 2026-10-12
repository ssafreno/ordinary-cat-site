// An Ordinary Cat — the cat (and, for the ending, the wizard he really is).
// Procedural model + procedural animation. No rig, no assets.
//
// Conventions: cat.group origin = between the feet on the ground, +Z = forward (nose),
// facing direction = group.rotation.y, units = metres. See docs/notes/cat.md.

import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeInOut = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t));
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
/** attack / hold / release envelope, 0..1 */
function env(t, a, h, r) {
  if (t <= 0) return 0;
  if (t < a) return smooth(t / a);
  if (t < a + h) return 1;
  if (t < a + h + r) return 1 - smooth((t - a - h) / r);
  return 0;
}
/** rounded end-cap factor: d = distance from the end along the spine, c = cap radius */
const capF = (d, c) => (d >= c ? 1 : Math.sqrt(Math.max(0, 1 - (1 - d / c) * (1 - d / c))));
const rand = (a, b) => a + Math.random() * (b - a);

/** Overall heights (top of the ear tips, metres) and footprint (x width, z depth) per pose. */
export const CAT_HEIGHT = { sit: 0.48, loaf: 0.32, stand: 0.48 };
/** [x width, z depth] including the tail at rest (the tail curls to his right, -X, when sitting/loafing) */
export const CAT_FOOTPRINT = { sit: [0.44, 0.4], loaf: [0.45, 0.64], stand: [0.28, 0.75] };
export const WIZARD_HEIGHT = 1.92;

// ------------------------------------------------------------------------------------------
// Palette, textures, shared materials (created once, on first Cat/Wizard construction)
// ------------------------------------------------------------------------------------------

const COL = {
  fur: '#8f8a85',
  furDark: '#4a4541',
  furMid: '#6f6964',
  furLight: '#b6afa8',
  cream: '#f3eee6',
  nose: '#e3909a',
  innerEar: '#e7a9ae',
  mouth: '#5a2630',
  tongue: '#df7d8a',
  pupil: '#120d0b',
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, { repeatU = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeatU) t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** sprinkle short fur strokes for a little texture */
function furNoise(g, w, h, r, n, alpha) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, l = 2 + r() * 5;
    g.strokeStyle = r() < 0.5 ? `rgba(255,250,240,${alpha})` : `rgba(30,25,20,${alpha})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y + l); g.stroke();
  }
}

/** soft blob: radial gradient ellipse */
function softEllipse(g, x, y, rx, ry, color, alpha = 1, hard = 0.55) {
  g.save();
  g.translate(x, y); g.scale(rx, ry);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, color); gr.addColorStop(hard, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha; g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
  g.restore();
}

/** Body tube texture. u: 0 ventral → .25 left(+X) → .5 dorsal → .75 right → 1 ventral. v: 0 rump → 1 neck. */
function bodyTexture() {
  return canvasTex(512, 512, (g, W, H) => {
    const r = rng(7);
    const X = (u) => u * W, Y = (v) => (1 - v) * H;
    g.fillStyle = COL.fur; g.fillRect(0, 0, W, H);
    // lighter underside
    const lg = g.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, '#c9c2ba'); lg.addColorStop(0.13, COL.fur); lg.addColorStop(0.87, COL.fur); lg.addColorStop(1, '#c9c2ba');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // darker back
    const dg = g.createLinearGradient(0, 0, W, 0);
    dg.addColorStop(0.3, 'rgba(60,55,50,0)'); dg.addColorStop(0.5, 'rgba(60,55,50,0.35)'); dg.addColorStop(0.7, 'rgba(60,55,50,0)');
    g.fillStyle = dg; g.fillRect(0, 0, W, H);
    // mackerel stripes, from the spine down each flank
    g.lineCap = 'round';
    for (let v0 = 0.07; v0 < 0.9; v0 += 0.072 + r() * 0.012) {
      for (const s of [-1, 1]) {
        const N = 14, ph = r() * 6;
        let px = X(0.5), py = Y(v0);
        for (let i = 1; i <= N; i++) {
          const k = i / N;
          const u = 0.5 + s * k * 0.33;
          const v = v0 + 0.016 * Math.sin(k * 7 + ph) - 0.05 * k;
          const x = X(u), y = Y(v);
          g.strokeStyle = COL.furDark;
          g.globalAlpha = 0.85 * (1 - smooth((k - 0.65) / 0.35));
          g.lineWidth = lerp(15, 4, k);
          g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
          px = x; py = y;
        }
      }
    }
    g.globalAlpha = 1;
    // dorsal line
    g.strokeStyle = COL.furDark; g.lineWidth = 16; g.beginPath();
    for (let v = 0; v <= 1.001; v += 0.02) {
      const x = X(0.5 + 0.006 * Math.sin(v * 20)), y = Y(v);
      v === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    // necklace stripes near the neck
    for (const vn of [0.86, 0.93]) {
      g.strokeStyle = COL.furDark; g.lineWidth = 9; g.globalAlpha = 0.7; g.beginPath();
      for (let u = 0.2; u <= 0.8; u += 0.02) {
        const x = X(u), y = Y(vn - 0.04 * Math.cos((u - 0.5) * Math.PI * 1.6));
        u === 0.2 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    furNoise(g, W, H, r, 3500, 0.07);
    // white bib on the chest (ventral side, near the neck end), drawn at both wrap edges
    for (const ux of [0, 1]) {
      softEllipse(g, X(ux), Y(0.8), W * 0.2, H * 0.34, COL.cream, 1, 0.72);
      softEllipse(g, X(ux), Y(0.5), W * 0.11, H * 0.3, '#ddd6cd', 0.6, 0.4);
    }
  }, { repeatU: true });
}

/** Head sphere texture (three SphereGeometry UVs: u .25 = front, .5 = left(+X), v 1 = top) */
function headTexture() {
  return canvasTex(512, 256, (g, W, H) => {
    const r = rng(11);
    const X = (u) => u * W, Y = (v) => (1 - v) * H;
    g.fillStyle = COL.fur; g.fillRect(0, 0, W, H);
    // darker crown / back
    const vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, 'rgba(70,64,58,0.35)'); vg.addColorStop(0.45, 'rgba(70,64,58,0)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // cream chin / lower face
    softEllipse(g, X(0.25), Y(0.1), W * 0.2, H * 0.36, COL.cream, 1, 0.6);
    const bg = g.createLinearGradient(0, Y(0.25), 0, H);
    bg.addColorStop(0, 'rgba(225,218,208,0)'); bg.addColorStop(1, 'rgba(225,218,208,0.9)');
    g.fillStyle = bg; g.fillRect(0, Y(0.25), W, H - Y(0.25));
    softEllipse(g, X(0.25), Y(0.38), W * 0.07, H * 0.12, '#e7e0d6', 0.9, 0.4);
    // light rings around the eyes
    for (const u of [0.18, 0.32]) softEllipse(g, X(u), Y(0.55), W * 0.04, H * 0.075, '#d8d1c8', 0.75, 0.4);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = COL.furDark;
    // the forehead "M" and stripes over the crown
    g.lineWidth = 5; g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(X(0.205), Y(0.63)); g.lineTo(X(0.222), Y(0.76)); g.lineTo(X(0.25), Y(0.68));
    g.lineTo(X(0.278), Y(0.76)); g.lineTo(X(0.295), Y(0.63));
    g.stroke();
    g.lineWidth = 6;
    for (const [u, v0] of [[0.235, 0.74], [0.25, 0.7], [0.265, 0.74]]) {
      g.beginPath(); g.moveTo(X(u), Y(v0)); g.lineTo(X(u), Y(1)); g.stroke();
    }
    // back of the head / nape stripes
    for (const u of [0.7, 0.75, 0.8]) {
      g.lineWidth = 9; g.beginPath(); g.moveTo(X(u), Y(1)); g.lineTo(X(u + (u - 0.75) * 0.5), Y(0.35)); g.stroke();
    }
    // side-of-head stripes
    for (const u of [0.05, 0.45, 0.58, 0.92]) {
      g.lineWidth = 7; g.beginPath(); g.moveTo(X(u), Y(0.95)); g.lineTo(X(u + 0.01), Y(0.6)); g.stroke();
    }
    // cheek "mascara" lines from the outer eye corners
    g.lineWidth = 4;
    for (const s of [-1, 1]) {
      const u0 = 0.25 + s * 0.11;
      g.beginPath(); g.moveTo(X(u0), Y(0.53));
      g.quadraticCurveTo(X(u0 + s * 0.05), Y(0.5), X(u0 + s * 0.11), Y(0.44)); g.stroke();
      g.beginPath(); g.moveTo(X(u0 + s * 0.005), Y(0.42));
      g.quadraticCurveTo(X(u0 + s * 0.05), Y(0.39), X(u0 + s * 0.1), Y(0.34)); g.stroke();
    }
    g.globalAlpha = 1;
    furNoise(g, W, H, r, 2000, 0.06);
  }, { repeatU: true });
}

/** banded legs (CapsuleGeometry uv v runs along the length) */
function legTexture() {
  return canvasTex(64, 128, (g, W, H) => {
    g.fillStyle = COL.fur; g.fillRect(0, 0, W, H);
    for (let y = 18; y < H - 8; y += 26) {
      const gr = g.createLinearGradient(0, y - 7, 0, y + 7);
      gr.addColorStop(0, 'rgba(74,69,65,0)'); gr.addColorStop(0.5, 'rgba(74,69,65,0.8)'); gr.addColorStop(1, 'rgba(74,69,65,0)');
      g.fillStyle = gr; g.fillRect(0, y - 7, W, 14);
    }
    furNoise(g, W, H, rng(3), 300, 0.06);
  }, { repeatU: true });
}

/** tail: rings along v, dark tip */
function tailTexture() {
  return canvasTex(64, 256, (g, W, H) => {
    g.fillStyle = COL.fur; g.fillRect(0, 0, W, H);
    const Y = (v) => (1 - v) * H;
    for (let v = 0.1; v < 0.86; v += 0.105) {
      const gr = g.createLinearGradient(0, Y(v) - 10, 0, Y(v) + 10);
      gr.addColorStop(0, 'rgba(74,69,65,0)'); gr.addColorStop(0.35, 'rgba(74,69,65,0.9)');
      gr.addColorStop(0.65, 'rgba(74,69,65,0.9)'); gr.addColorStop(1, 'rgba(74,69,65,0)');
      g.fillStyle = gr; g.fillRect(0, Y(v) - 10, W, 20);
    }
    const tg = g.createLinearGradient(0, Y(0.86), 0, Y(1));
    tg.addColorStop(0, 'rgba(60,55,50,0)'); tg.addColorStop(0.3, COL.furDark); tg.addColorStop(1, '#3a3532');
    g.fillStyle = tg; g.fillRect(0, 0, W, Y(0.86));
    furNoise(g, W, H, rng(5), 400, 0.06);
  }, { repeatU: true });
}

/** amber iris; sphere front (u .25, v .5) is the centre */
function irisTexture() {
  return canvasTex(256, 128, (g, W, H) => {
    g.fillStyle = '#6b3a0e'; g.fillRect(0, 0, W, H);
    const cx = W * 0.25, cy = H * 0.5, R = H * 0.5;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, '#fbe38c'); gr.addColorStop(0.22, '#f6c552'); gr.addColorStop(0.55, '#e69a2c');
    gr.addColorStop(0.8, '#c06a16'); gr.addColorStop(0.93, '#7a4210'); gr.addColorStop(1, '#5a300c');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    const r = rng(9);
    g.globalAlpha = 0.18;
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, r0 = R * 0.15, r1 = R * (0.55 + r() * 0.35);
      g.strokeStyle = r() < 0.5 ? '#fff2b0' : '#8a4a10'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.globalAlpha = 1;
  });
}

/** wizard robe wool with fold shading (lathe: u around, v up) */
function robeTexture() {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#85858b'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / W) * TAU * 9 + 0.6 * Math.sin((x / W) * TAU * 4));
      g.fillStyle = `rgba(40,40,48,${0.22 * k})`; g.fillRect(x, 0, 1, H);
    }
    g.fillStyle = 'rgba(40,40,50,0.35)'; g.fillRect(0, H - 14, W, 14);
    g.fillStyle = 'rgba(200,190,160,0.35)'; g.fillRect(0, H - 18, W, 3);
    furNoise(g, W, H, rng(21), 1500, 0.05);
  }, { repeatU: true });
}

let _M = null;
function getMaterials() {
  if (_M) return _M;
  const fur = (map, color = '#ffffff') => new THREE.MeshPhysicalMaterial({
    map, color, roughness: 0.82, metalness: 0,
    sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#d9d2c8'),
  });
  const iris = irisTexture();
  _M = {
    body: fur(bodyTexture()),
    head: fur(headTexture()),
    leg: fur(legTexture()),
    tail: fur(tailTexture()),
    plain: fur(null, COL.fur),
    lid: new THREE.MeshStandardMaterial({ color: '#5d5752', roughness: 0.8 }),
    cream: new THREE.MeshPhysicalMaterial({ color: COL.cream, roughness: 0.85, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }),
    nose: new THREE.MeshStandardMaterial({ color: COL.nose, roughness: 0.45 }),
    innerEar: new THREE.MeshStandardMaterial({ color: COL.innerEar, roughness: 0.75, side: THREE.DoubleSide }),
    mouth: new THREE.MeshStandardMaterial({ color: COL.mouth, roughness: 0.6 }),
    tongue: new THREE.MeshStandardMaterial({ color: COL.tongue, roughness: 0.5 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 0.3 }),
    eye: new THREE.MeshPhysicalMaterial({
      map: iris, emissiveMap: iris, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.32,
      roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04,
    }),
    pupil: new THREE.MeshStandardMaterial({ color: COL.pupil, roughness: 0.25 }),
    glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    whisker: new THREE.LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.75 }),
    // wizard
    robe: new THREE.MeshPhysicalMaterial({ map: robeTexture(), roughness: 0.92, sheen: 0.7, sheenRoughness: 0.7, sheenColor: new THREE.Color('#b9b6c4') }),
    skin: new THREE.MeshPhysicalMaterial({ color: '#e8c0a0', roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c0') }),
    nose2: new THREE.MeshPhysicalMaterial({ color: '#e1a58c', roughness: 0.55 }),
    beard: new THREE.MeshPhysicalMaterial({ color: '#cdc8c1', roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }),
    hat: new THREE.MeshPhysicalMaterial({ color: '#555a6e', roughness: 0.9, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#9aa0c0') }),
    band: new THREE.MeshStandardMaterial({ color: '#8c6b3d', roughness: 0.7 }),
    star: new THREE.MeshStandardMaterial({ color: '#e8c25a', roughness: 0.35, metalness: 0.6, emissive: '#5a3f08', emissiveIntensity: 0.4 }),
  };
  _M.whisker.userData.noHighlight = true;
  _M.glint.userData.noHighlight = true;
  return _M;
}

// ------------------------------------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------------------------------------

/** After displacing a SphereGeometry, compute normals and stitch the u-seam and the poles. */
function smoothSphereNormals(geo, ws, hs) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const row = ws + 1;
  for (let iy = 0; iy <= hs; iy++) {
    const a = iy * row, b = iy * row + ws;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  for (const iy of [0, hs]) {
    let x = 0, y = 0, z = 0;
    for (let ix = 0; ix <= ws; ix++) { const i = iy * row + ix; x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (let ix = 0; ix <= ws; ix++) n.setXYZ(iy * row + ix, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

function displacedSphere(ws, hs, fn) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z);
  }
  smoothSphereNormals(g, ws, hs);
  return g;
}

/**
 * Cat ear: a gridded, cupped "lens" (front and back surfaces meet at the rim, so no hard bevel),
 * plus a matching pink inner patch. side +1 = left(+X), -1 = right. Left ear can be notched.
 */
function earGeometries(side, notched) {
  const W = 0.032, H = 0.062, AX = 0.004, T = 0.0055, NU = 9, NV = 9;
  const edge = (v, s) => {
    // s = +1 outer edge, -1 inner edge (outer = away from the head centre)
    const base = s * W * Math.pow(1 - v, 0.85) + AX * v;
    let notch = 0;
    if (notched && s === 1) notch = 0.0105 * Math.max(0, 1 - Math.abs(v - 0.5) / 0.1);
    return base - s * notch + s * 0.004 * Math.sin(PI * v); // slightly convex edges
  };
  const at = (u, v, out) => {
    const xl = edge(v, -1), xr = edge(v, 1);
    const x = lerp(xl, xr, (u + 1) / 2) * side;
    const y = v * H;
    const e = Math.max(0, (1 - u * u)) * (1 - Math.pow(v, 4));
    const h = T * Math.sqrt(e);
    const cup = 0.0095 * u * u * (1 - 0.5 * v) - 0.004 * v * v; // edges forward, tip curls back
    out[0] = x; out[1] = y; out[2] = cup; out[3] = h;
  };
  const tmp = [0, 0, 0, 0];
  const build = (front, back, uS, vS, dz) => {
    const pos = [], idx = [];
    const surfaces = [];
    if (front) surfaces.push(1);
    if (back) surfaces.push(-1);
    for (const sf of surfaces) {
      const o = pos.length / 3;
      for (let j = 0; j <= NV; j++) {
        for (let i = 0; i <= NU; i++) {
          const u = (-1 + (2 * i) / NU) * uS, v = (j / NV) * vS;
          at(u, v, tmp);
          const z = sf === 1 ? tmp[2] + tmp[3] + dz : tmp[2] - tmp[3] * 1.4;
          pos.push(tmp[0], tmp[1] + (dz ? 0.004 : 0), z);
        }
      }
      for (let j = 0; j < NV; j++) {
        for (let i = 0; i < NU; i++) {
          const a = o + j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
          if (sf === 1) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make sure the front faces +Z (winding flips with the mirrored side)
    const n = g.attributes.normal;
    const centre = Math.floor(NV / 2) * (NU + 1) + Math.floor(NU / 2);
    if (n.getZ(centre) < 0) {
      const ix = g.index.array;
      for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
      g.computeVertexNormals();
    }
    return g;
  };
  return { outer: build(true, true, 1, 1, 0), inner: build(true, false, 0.66, 0.8, 0.0007) };
}

// ------------------------------------------------------------------------------------------
// Tube: a deformable skinned tube (body + tails). Rebuilt in place, no allocation per frame.
// ------------------------------------------------------------------------------------------

class Tube {
  constructor(rings, segs, material) {
    this.rings = rings; this.segs = segs;
    const vpr = segs + 1, n = rings * vpr;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.uvs = new Float32Array(n * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * vpr + j, b = a + vpr, c = b + 1, d = a + 1;
        idx.push(a, d, b, d, c, b);
      }
    }
    geo.setIndex(idx);
    this.cs = new Float32Array(vpr); this.sn = new Float32Array(vpr);
    for (let j = 0; j <= segs; j++) {
      const th = -Math.PI / 2 + (TAU * j) / segs;
      this.cs[j] = Math.cos(th); this.sn[j] = Math.sin(th);
    }
    this.C = new Float32Array(rings * 3);
    this.N = new Float32Array(rings * 3);
    this.B = new Float32Array(rings * 3);
    this.rw = new Float32Array(rings); this.rh = new Float32Array(rings);
    this.v = new Float32Array(rings); this.belly = new Float32Array(rings);
    this.floorY = -1e9;
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }
  commit() {
    const { rings, segs, pos, uvs, cs, sn, C, N, B, rw, rh, v, belly, floorY } = this;
    const vpr = segs + 1;
    for (let i = 0; i < rings; i++) {
      const cx = C[i * 3], cy = C[i * 3 + 1], cz = C[i * 3 + 2];
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
      const bx = B[i * 3], by = B[i * 3 + 1], bz = B[i * 3 + 2];
      for (let j = 0; j <= segs; j++) {
        const c = cs[j], s = sn[j];
        const w = rw[i] * c, h = rh[i] * s * (s < 0 ? 1 - belly[i] * s : 1);
        const k = (i * vpr + j) * 3;
        pos[k] = cx + nx * w + bx * h;
        let y = cy + ny * w + by * h;
        if (y < floorY) y = floorY;
        pos[k + 1] = y;
        pos[k + 2] = cz + nz * w + bz * h;
        const q = (i * vpr + j) * 2;
        uvs[q] = j / segs; uvs[q + 1] = v[i];
      }
    }
    const geo = this.geo;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();
    const nn = geo.attributes.normal.array;
    for (let i = 0; i < rings; i++) {
      const a = i * vpr * 3, b = (i * vpr + segs) * 3;
      let x = nn[a] + nn[b], y = nn[a + 1] + nn[b + 1], z = nn[a + 2] + nn[b + 2];
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      nn[a] = nn[b] = x; nn[a + 1] = nn[b + 1] = y; nn[a + 2] = nn[b + 2] = z;
    }
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }
}

/** Catmull-Rom on a flat xyz array of n points; u in [0, n-1]. Writes out[o..o+2]. */
function catmull(out, o, P, n, u) {
  let i = Math.floor(u); if (i > n - 2) i = n - 2; if (i < 0) i = 0;
  const t = u - i, t2 = t * t, t3 = t2 * t;
  const i0 = Math.max(i - 1, 0) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(i + 2, n - 1) * 3;
  for (let k = 0; k < 3; k++) {
    const p0 = P[i0 + k], p1 = P[i1 + k], p2 = P[i2 + k], p3 = P[i3 + k];
    out[o + k] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
}

/** compute tangents from ring centres and a parallel-transported frame into tube.N / tube.B */
function transportFrames(tube) {
  const { C, N, B, rings } = tube;
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < rings; i++) {
    const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, rings - 1) * 3;
    let tx = C[b] - C[a], ty = C[b + 1] - C[a + 1], tz = C[b + 2] - C[a + 2];
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    if (i === 0) {
      if (Math.abs(ty) < 0.9) { px = 0; py = 1; pz = 0; } else { px = 1; py = 0; pz = 0; }
    }
    const d = px * tx + py * ty + pz * tz;
    px -= tx * d; py -= ty * d; pz -= tz * d;
    const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
    N[i * 3] = px; N[i * 3 + 1] = py; N[i * 3 + 2] = pz;
    // B = T x N
    B[i * 3] = ty * pz - tz * py; B[i * 3 + 1] = tz * px - tx * pz; B[i * 3 + 2] = tx * py - ty * px;
  }
}

// ------------------------------------------------------------------------------------------
// Tail rig: chain of segments with lagging spring offsets → tube
// ------------------------------------------------------------------------------------------

class TailRig {
  constructor(material, { segs = 6, segLen = 0.065, r0 = 0.03, r1 = 0.0185, rings = 24, radial = 12, floorY = 0.02 } = {}) {
    this.n = segs; this.segLen = segLen; this.r0 = r0; this.r1 = r1;
    this.tube = new Tube(rings, radial, material);
    this.tube.floorY = 0.002;
    this.mesh = this.tube.mesh;
    this.base = new THREE.Vector3();
    this.heading = Math.PI; this.elev = 0;
    this.pitch = new Float32Array(segs); this.yaw = new Float32Array(segs); this.gain = new Float32Array(segs).fill(0.3);
    this.sway = 0.3; this.swaySpeed = 1; this.phase = Math.random() * 10;
    this.o = new Float32Array(segs); this.vo = new Float32Array(segs);
    this.pts = new Float32Array((segs + 1) * 3);
    this.floorY = floorY;
  }
  flick(strength = 1) {
    const s = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < this.n; i++) this.vo[i] += s * strength * (0.4 + i / (this.n - 1)) * 7;
  }
  update(dt, t) {
    const n = this.n, o = this.o, vo = this.vo;
    const ts = t * this.swaySpeed + this.phase;
    const drv = this.sway * (0.62 * Math.sin(ts * 0.85) + 0.38 * Math.sin(ts * 2.05 + 1.3));
    for (let i = 0; i < n; i++) {
      const target = i === 0 ? drv : o[i - 1];
      vo[i] += (70 * (target - o[i]) - 9 * vo[i]) * dt;
      o[i] += vo[i] * dt;
    }
    const P = this.pts, L = this.segLen;
    let h = this.heading, e = this.elev;
    let x = this.base.x, y = this.base.y, z = this.base.z;
    P[0] = x; P[1] = y; P[2] = z;
    for (let i = 0; i < n; i++) {
      h += this.yaw[i] + o[i] * this.gain[i];
      e = clamp(e + this.pitch[i], -1.45, 1.45);
      const ce = Math.cos(e);
      x += L * Math.sin(h) * ce; y += L * Math.sin(e); z += L * Math.cos(h) * ce;
      if (y < this.floorY) y = this.floorY;
      P[(i + 1) * 3] = x; P[(i + 1) * 3 + 1] = y; P[(i + 1) * 3 + 2] = z;
    }
    const tube = this.tube, R = tube.rings;
    for (let r = 0; r < R; r++) {
      const v = r / (R - 1);
      catmull(tube.C, r * 3, P, n + 1, v * n);
      let rad = lerp(this.r0, this.r1, Math.pow(v, 0.75));
      rad *= capF((1 - v) * n * L, this.r1 * 1.15);
      tube.rw[r] = rad; tube.rh[r] = rad; tube.v[r] = v;
    }
    transportFrames(tube);
    tube.commit();
  }
}

// ------------------------------------------------------------------------------------------
// Eye: socket (almond squash + orientation) → unit (scale r) → gaze (rotates) + glints + lids
// ------------------------------------------------------------------------------------------

const _eyeGeo = {};
function eyeGeos() {
  if (_eyeGeo.ball) return _eyeGeo;
  _eyeGeo.ball = new THREE.SphereGeometry(1, 22, 14);
  _eyeGeo.pupil = new THREE.SphereGeometry(1, 10, 8);
  _eyeGeo.upper = new THREE.SphereGeometry(1.075, 22, 6, 0, TAU, 0, Math.PI / 2);
  _eyeGeo.lower = new THREE.SphereGeometry(1.065, 22, 6, 0, TAU, Math.PI / 2, Math.PI / 2);
  _eyeGeo.glint = new THREE.CircleGeometry(0.2, 16);
  _eyeGeo.glint2 = new THREE.CircleGeometry(0.09, 12);
  return _eyeGeo;
}

function makeEye(r, M, lidMat) {
  const G = eyeGeos();
  const socket = new THREE.Group();
  const unit = new THREE.Group(); unit.scale.setScalar(r); socket.add(unit);
  const gaze = new THREE.Group(); unit.add(gaze);
  const ball = new THREE.Mesh(G.ball, M.eye); gaze.add(ball);
  const pupil = new THREE.Mesh(G.pupil, M.pupil);
  pupil.position.z = 0.93; pupil.scale.set(0.2, 0.8, 0.11); gaze.add(pupil);
  const glint = new THREE.Mesh(G.glint, M.glint);
  const gdir = new THREE.Vector3(0.36, 0.42, 0.83).normalize();
  glint.position.copy(gdir).multiplyScalar(1.012); glint.lookAt(gdir.clone().multiplyScalar(2)); unit.add(glint);
  const glint2 = new THREE.Mesh(G.glint2, M.glint);
  const gdir2 = new THREE.Vector3(-0.2, -0.3, 0.93).normalize();
  glint2.position.copy(gdir2).multiplyScalar(1.012); glint2.lookAt(gdir2.clone().multiplyScalar(2)); unit.add(glint2);
  const upper = new THREE.Mesh(G.upper, lidMat); unit.add(upper);
  const lower = new THREE.Mesh(G.lower, lidMat); unit.add(lower);
  return { socket, unit, gaze, pupil, upper, lower };
}

/** openU: 0 closed .. 1 wide; openL: 0 up .. 1 down */
function setLids(eye, openU, openL) {
  eye.upper.rotation.x = lerp(0.2, -1.12, openU);
  eye.lower.rotation.x = lerp(-0.18, 1.0, openL);
}

// ------------------------------------------------------------------------------------------
// Poses
// ------------------------------------------------------------------------------------------

const POSE_LAYOUT = [
  ['spine', 12], ['rw', 5], ['rh', 5], ['belly', 1],
  ['head', 3], ['headPitch', 1],
  ['shoulder', 3], ['fpaw', 3], ['hip', 3], ['htoe', 3], ['hock', 3],
  ['tailBase', 3], ['tailDir', 2], ['tailPitch', 6], ['tailYaw', 6], ['tailGain', 6], ['tailSway', 1],
];
const O = {}; let POSE_SIZE = 0;
for (const [k, n] of POSE_LAYOUT) { O[k] = POSE_SIZE; POSE_SIZE += n; }
function packPose(obj) {
  const a = new Float32Array(POSE_SIZE);
  for (const [k, n] of POSE_LAYOUT) {
    const v = obj[k];
    for (let i = 0; i < n; i++) a[O[k] + i] = Array.isArray(v) ? v[i] : v;
  }
  return a;
}

const PI = Math.PI;
const POSES = {
  sit: packPose({
    spine: [0, -0.035, -0.1, 0, 0.075, -0.083, 0, 0.18, -0.04, 0, 0.262, -0.002],
    rw: [0.112, 0.112, 0.094, 0.08, 0.06], rh: [0.112, 0.112, 0.098, 0.088, 0.06], belly: 0.14,
    head: [0, 0.364, 0.047], headPitch: 0.06,
    shoulder: [0.04, 0.19, 0.012], fpaw: [0.038, 0.017, 0.082],
    hip: [0.07, 0.115, -0.06], htoe: [0.066, 0.016, 0.07], hock: [0, 0.006, -0.08],
    tailBase: [0, 0.035, -0.17], tailDir: [PI, -0.12],
    tailPitch: [0.08, 0.04, 0, 0, 0, 0], tailYaw: [0.72, 0.66, 0.56, 0.45, 0.34, 0.24],
    tailGain: [0, 0.04, 0.1, 0.22, 0.42, 0.65], tailSway: 0.3,
  }),
  loaf: packPose({
    spine: [0, 0.095, -0.23, 0, 0.102, -0.1, 0, 0.108, 0.025, 0, 0.12, 0.115],
    rw: [0.1, 0.118, 0.122, 0.1, 0.048], rh: [0.096, 0.104, 0.108, 0.098, 0.048], belly: 0.05,
    head: [0, 0.205, 0.175], headPitch: 0.04,
    shoulder: [0.05, 0.12, 0.105], fpaw: [0.044, 0.016, 0.158],
    hip: [0.072, 0.1, -0.13], htoe: [0.08, 0.014, -0.025], hock: [0, 0.006, -0.075],
    tailBase: [0, 0.06, -0.25], tailDir: [PI, -0.35],
    tailPitch: [0.2, 0.12, 0, 0, 0, 0], tailYaw: [0.42, 0.55, 0.55, 0.48, 0.38, 0.28],
    tailGain: [0, 0.04, 0.1, 0.22, 0.42, 0.65], tailSway: 0.25,
  }),
  stand: packPose({
    spine: [0, 0.24, -0.23, 0, 0.245, -0.115, 0, 0.245, 0.0, 0, 0.262, 0.1],
    rw: [0.085, 0.098, 0.102, 0.088, 0.058], rh: [0.088, 0.102, 0.106, 0.098, 0.058], belly: 0.2,
    head: [0, 0.36, 0.2], headPitch: 0.08,
    shoulder: [0.046, 0.24, 0.105], fpaw: [0.044, 0.017, 0.13],
    hip: [0.06, 0.25, -0.15], htoe: [0.052, 0.017, -0.11], hock: [0, 0.07, -0.04],
    tailBase: [0, 0.265, -0.215], tailDir: [PI, 0.45],
    tailPitch: [0.22, 0.24, 0.2, 0.06, -0.28, -0.42], tailYaw: [0, 0, 0, 0, 0, 0],
    tailGain: [0.22, 0.26, 0.28, 0.3, 0.32, 0.36], tailSway: 0.32,
  }),
  stretch: packPose({
    spine: [0, 0.27, -0.22, 0, 0.24, -0.1, 0, 0.18, 0.02, 0, 0.14, 0.13],
    rw: [0.08, 0.094, 0.098, 0.088, 0.048], rh: [0.085, 0.098, 0.1, 0.092, 0.048], belly: 0.1,
    head: [0, 0.205, 0.25], headPitch: -0.3,
    shoulder: [0.048, 0.13, 0.135], fpaw: [0.045, 0.017, 0.33],
    hip: [0.058, 0.27, -0.16], htoe: [0.052, 0.017, -0.12], hock: [0, 0.07, -0.04],
    tailBase: [0, 0.29, -0.21], tailDir: [PI, 0.9],
    tailPitch: [0.15, 0.12, 0.05, 0, -0.15, -0.3], tailYaw: [0, 0, 0, 0, 0, 0],
    tailGain: [0.2, 0.2, 0.2, 0.2, 0.25, 0.3], tailSway: 0.15,
  }),
};

// leg bone lengths
const FRONT_A = 0.11, FRONT_B = 0.115, HIND_A = 0.105, HIND_B = 0.1, FOOT = 0.075;
const _ik = { a1: 0, a2: 0, ky: 0, kz: 0 };
function ik2(Ry, Rz, Ty, Tz, a, b, bend) {
  const dy = Ty - Ry, dz = Tz - Rz;
  const d = clamp(Math.hypot(dy, dz), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const phi = Math.atan2(dz, -dy);
  const psi1 = phi + bend * Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const ky = Ry - a * Math.cos(psi1), kz = Rz + a * Math.sin(psi1);
  _ik.a1 = psi1; _ik.a2 = Math.atan2(Tz - kz, -(Ty - ky)); _ik.ky = ky; _ik.kz = kz;
}

// ------------------------------------------------------------------------------------------
// The Cat
// ------------------------------------------------------------------------------------------

const _v = new THREE.Vector3();
const _dense = new Float32Array(65 * 3);
const _denseS = new Float32Array(65);
const _ctrl = new Float32Array(15);

export class Cat {
  constructor(ctx = {}) {
    this.ctx = ctx;
    const M = (this.M = getMaterials());
    this.group = new THREE.Group();
    this.group.name = 'cat';
    this.root = new THREE.Group();
    this.group.add(this.root);

    // pose state
    this.pose = 'sit';
    this._pFrom = new Float32Array(POSE_SIZE);
    this._pTo = POSES.sit;
    this._pBase = new Float32Array(POSES.sit);
    this._pW = new Float32Array(POSE_SIZE);
    this._poseK = 1; this._poseDur = 0.6; this._poseResolve = null;

    // body
    this.body = new Tube(28, 26, M.body);
    this.body.floorY = 0.003;
    this.body.mesh.castShadow = true;
    this.root.add(this.body.mesh);

    // tail
    this.tail = new TailRig(M.tail, { segs: 6, segLen: 0.066, r0: 0.03, r1: 0.019, floorY: 0.021 });
    this.tail.mesh.castShadow = true;
    this.root.add(this.tail.mesh);

    this._buildLegs();
    this._buildHead();

    // animation state
    this._t = 0;
    this._fx = [];
    this._headYaw = 0; this._headPitch = 0; this._headRoll = 0;
    this._eyeYaw = 0; this._eyePitch = 0;
    this._idleYaw = 0; this._idlePitch = 0; this._idleRoll = 0; this._idleTimer = rand(1.5, 4);
    this._blinkTimer = rand(1.5, 4);
    this._earTimer = rand(2, 6);
    this._fidgetTimer = rand(12, 25);
    this._lookTarget = new THREE.Vector3(); this._hasLook = false;
    this._speaking = false; this._speakAmt = 0; this._jaw = 0;
    this._walk = null; this._walkW = 0; this._gait = 0; this._speed = 0;
    this._hotspotExtra = null;

    this._apply(0, 0);
  }

  // ---------------------------------------------------------------- construction

  _buildLegs() {
    const M = this.M;
    const upperF = new THREE.CapsuleGeometry(0.029, FRONT_A - 0.03, 4, 12);
    const foreF = new THREE.CapsuleGeometry(0.023, FRONT_B - 0.026, 4, 12);
    const thigh = new THREE.SphereGeometry(1, 16, 10);
    const shin = new THREE.CapsuleGeometry(0.02, HIND_B - 0.02, 4, 10);
    const foot = new THREE.CapsuleGeometry(0.017, FOOT - 0.02, 4, 10);
    const paw = new THREE.SphereGeometry(1, 14, 8);
    this.legs = [];
    for (const front of [true, false]) {
      for (const side of [1, -1]) {
        const j0 = new THREE.Group(), j1 = new THREE.Group(), j2 = new THREE.Group(), j3 = new THREE.Group();
        this.root.add(j0); j0.add(j1); j1.add(j2);
        const add = (parent, geo, mat, y, sx = 1, sy = 1, sz = 1, z = 0) => {
          const m = new THREE.Mesh(geo, mat);
          m.position.set(0, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
        };
        if (front) {
          add(j0, upperF, M.leg, -FRONT_A / 2);
          j1.position.y = -FRONT_A;
          add(j1, foreF, M.leg, -FRONT_B / 2);
          j2.position.y = -FRONT_B;
          add(j2, paw, M.cream, 0, 0.026, 0.017, 0.032, 0.008);
        } else {
          add(j0, thigh, M.plain, -HIND_A * 0.42, 0.044, 0.08, 0.07, 0.004);
          j1.position.y = -HIND_A;
          add(j1, shin, M.leg, -HIND_B / 2);
          j2.position.y = -HIND_B; j2.add(j3);
          add(j2, foot, M.leg, -FOOT / 2);
          j3.position.y = -FOOT;
          add(j3, paw, M.cream, 0, 0.024, 0.016, 0.031, 0.009);
        }
        this.legs.push({ front, side, j0, j1, j2, j3 });
      }
    }
  }

  _buildHead() {
    const M = this.M;
    const R = 0.074;
    this.headPivot = new THREE.Group();
    this.headPivot.rotation.order = 'YXZ';
    this.root.add(this.headPivot);
    const head = (this.head = new THREE.Group());
    this.headPivot.add(head);
    head.scale.setScalar(1.07);

    // skull: wide, a bit flat, chubby cheeks
    const WS = 36, HS = 24;
    const skullGeo = displacedSphere(WS, HS, (v) => {
      const cheek = smooth((-v.y + 0.15) / 0.75) * smooth((1 - Math.abs(v.z - 0.1)) / 0.9);
      let x = v.x * (1.12 + 0.13 * cheek);
      let y = v.y * 0.9;
      let z = v.z * 0.96;
      if (z > 0.55) z = 0.55 + (z - 0.55) * 0.72; // flatter face
      if (v.y < -0.2) y += 0.06 * (v.y + 0.2) * smooth(v.z); // jowl drop at the front-bottom
      v.set(x * R, y * R, z * R);
    });
    {
      // stylised soft underside: bend downward-facing normals forward so the chin doesn't go black
      const n = skullGeo.attributes.normal;
      for (let i = 0; i < n.count; i++) {
        const ny = n.getY(i);
        if (ny < 0) {
          const nx = n.getX(i), nz = n.getZ(i) + -ny * 0.5, y2 = ny * 0.6;
          const l = Math.hypot(nx, y2, nz);
          n.setXYZ(i, nx / l, y2 / l, nz / l);
        }
      }
    }
    const skull = new THREE.Mesh(skullGeo, M.head);
    skull.castShadow = true;
    head.add(skull);

    // muzzle: two whisker pads + chin (on the jaw)
    const pad = new THREE.SphereGeometry(0.021, 16, 10);
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(pad, M.cream);
      m.position.set(0.0165 * s, -0.025, 0.06); m.scale.set(1, 0.84, 0.86);
      head.add(m);
    }
    // nose: rounded triangle
    const noseGeo = displacedSphere(16, 12, (v) => {
      const k = v.y < 0 ? 1 + v.y * 0.55 : 1;
      v.set(v.x * 0.0115 * k * 1.15, v.y * 0.0075, v.z * 0.008);
    });
    const nose = new THREE.Mesh(noseGeo, M.nose);
    nose.position.set(0, -0.009, 0.0735); nose.rotation.x = -0.35;
    head.add(nose);
    // mouth interior, teeth
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), M.mouth);
    mouth.position.set(0, -0.036, 0.036); mouth.scale.set(1.15, 1.0, 1.2);
    head.add(mouth);
    const fang = new THREE.ConeGeometry(0.0028, 0.008, 8);
    for (const s of [1, -1]) {
      const f = new THREE.Mesh(fang, M.tooth);
      f.position.set(0.0085 * s, -0.037, 0.059); f.rotation.x = PI;
      head.add(f);
    }
    // jaw
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.034, 0.03);
    head.add(this.jaw);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 8), M.cream);
    chin.position.set(0, -0.005, 0.017); chin.scale.set(0.78, 0.55, 0.9);
    this.jaw.add(chin);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), M.tongue);
    tongue.position.set(0, -0.002, 0.012); tongue.scale.set(0.9, 0.35, 1.2);
    this.jaw.add(tongue);

    // eyes
    this.eyes = [];
    for (const s of [1, -1]) {
      const e = makeEye(0.0205, M, M.lid);
      const yaw = 0.43 * s, pitch = 0.13;
      const dist = 0.061;
      e.socket.position.set(Math.sin(yaw) * Math.cos(pitch) * dist * 1.12, Math.sin(pitch) * dist * 0.9, Math.cos(yaw) * Math.cos(pitch) * dist * 0.96);
      e.socket.rotation.order = 'YXZ';
      e.socket.rotation.set(-pitch * 0.6, yaw * 0.85, -0.12 * s);
      e.socket.scale.set(1.08, 0.92, 0.62);
      e.baseYaw = -yaw * 0.62;
      e.side = s;
      head.add(e.socket);
      this.eyes.push(e);
    }

    // ears (left = +X has the notch)
    this.ears = [];
    for (const s of [1, -1]) {
      const { outer, inner } = earGeometries(s, s === 1);
      const pivot = new THREE.Group();
      pivot.position.set(0.043 * s, 0.047, -0.008);
      pivot.rotation.order = 'YXZ';
      const o = new THREE.Mesh(outer, M.plain); o.castShadow = true;
      const i = new THREE.Mesh(inner, M.innerEar);
      pivot.add(o, i);
      head.add(pivot);
      this.ears.push({ pivot, side: s, flick: 0 });
    }

    // whiskers
    const wp = [];
    for (const s of [1, -1]) {
      for (let k = 0; k < 3; k++) {
        const y0 = -0.022 - k * 0.004, z0 = 0.062 - k * 0.002;
        wp.push(0.026 * s, y0, z0, (0.115 + k * 0.006) * s, y0 + 0.012 - k * 0.016, z0 - 0.025 - k * 0.006);
      }
      // brow whiskers
      wp.push(0.03 * s, 0.035, 0.055, 0.07 * s, 0.075, 0.05);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    const whiskers = new THREE.LineSegments(wg, M.whisker);
    whiskers.raycast = () => {};
    head.add(whiskers);
  }

  // ---------------------------------------------------------------- public API

  placeAt(parentGroup, { position = [0, 0, 0], rotationY = 0, pose = 'sit', hotspot = null } = {}) {
    if (parentGroup && this.group.parent !== parentGroup) parentGroup.add(this.group);
    this.group.position.set(position[0], position[1], position[2]);
    this.group.rotation.y = rotationY;
    if (this._walk) { const w = this._walk; this._walk = null; w.resolve(); }
    this._walkW = 0;
    this.setPose(pose, 0);
    if (hotspot) this._hotspotExtra = hotspot;
    const hs = this.ctx?.hotspots;
    if (hs?.add) {
      hs.add({
        id: 'cat', object: this.group, label: 'An ordinary cat',
        onClick: () => this.ctx?.hints?.ask?.(),
        ...(this._hotspotExtra || {}),
      });
    }
    return this;
  }

  lookAt(worldPoint) {
    if (worldPoint) {
      if (Array.isArray(worldPoint)) this._lookTarget.set(worldPoint[0], worldPoint[1], worldPoint[2]);
      else this._lookTarget.copy(worldPoint);
      this._hasLook = true;
    } else this._hasLook = false;
  }

  setPose(pose, duration = 0.6) {
    const target = POSES[pose];
    if (!target || pose === 'stretch') return Promise.resolve();
    this.pose = pose;
    if (this._poseResolve) { const r = this._poseResolve; this._poseResolve = null; r(); }
    this._pFrom.set(this._pBase);
    this._pTo = target;
    if (duration <= 0) {
      this._poseK = 1; this._pBase.set(target);
      return Promise.resolve();
    }
    this._poseK = 0; this._poseDur = duration;
    return new Promise((res) => { this._poseResolve = res; });
  }

  react(kind) {
    const durs = { flinch: 1.0, perk: 1.6, blink: 0.26, slowBlink: 1.3, tailFlick: 0.9, yawn: 2.4, stretch: 3.4, earFlickL: 0.32, earFlickR: 0.32 };
    const dur = durs[kind];
    if (!dur) return Promise.resolve();
    if (kind === 'tailFlick') this.tail.flick(1);
    if (kind === 'flinch') this.tail.flick(0.6);
    if (kind === 'stretch') {
      for (const e of this._fx) if (e.kind === 'stretch') return e.promise;
    }
    const fx = { kind, t: 0, dur, resolve: null, promise: null };
    fx.promise = new Promise((res) => { fx.resolve = res; });
    this._fx.push(fx);
    return fx.promise;
  }

  walkTo(target, { duration } = {}) {
    if (this._walk) { const w = this._walk; this._walk = null; w.resolve(); }
    const from = this.group.position.clone();
    const to = new THREE.Vector3(target[0], target[1], target[2]);
    const dx = to.x - from.x, dz = to.z - from.z;
    const dist = Math.hypot(dx, to.y - from.y, dz);
    const yaw0 = this.group.rotation.y;
    let yaw1 = Math.hypot(dx, dz) > 1e-3 ? Math.atan2(dx, dz) : yaw0;
    while (yaw1 - yaw0 > PI) yaw1 -= TAU;
    while (yaw1 - yaw0 < -PI) yaw1 += TAU;
    return new Promise((resolve) => {
      this._walk = {
        stage: 0, t: 0, from, to, yaw0, yaw1,
        turnDur: 0.3 + Math.abs(yaw1 - yaw0) * 0.22,
        dur: duration ?? Math.max(0.8, dist / 0.42), resolve,
      };
      this.setPose('stand', 0.45);
    });
  }

  speak(on) { this._speaking = !!on; }
  setVisible(b) { this.group.visible = !!b; }

  // ---------------------------------------------------------------- per-frame

  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 1 / 20);
    this._t = t ?? this._t + dt;
    this._sardineWatch();
    this._hoverWatch(dt);
    this._apply(dt, this._t);
  }

  /** polish delight: rest the cursor on him for a couple of seconds and he gives you the slow blink. Once per hover. */
  _hoverWatch(dt) {
    const hov = this.ctx.hotspots?.hovered?.id === 'cat';
    if (!hov) { this._hoverT = 0; this._hoverDone = false; return; }
    this._hoverT = (this._hoverT || 0) + dt;
    if (!this._hoverDone && this._hoverT > 2.2) { this._hoverDone = true; this.react('slowBlink'); }
  }

  /**
   * polish delight: while the sardines are the selected item, the cat perks up once and his eyes follow
   * the item cursor. Lets go only of a look target he set himself (room scripts may have set their own).
   */
  _sardineWatch() {
    const ctx = this.ctx;
    const on = ctx.inventory?.selected === 'sardines' && this.group.visible && !!this.group.parent && !ctx.game?._titleMode;
    if (on) {
      const cam = ctx.camera?.camera, ptr = ctx.hotspots?.pointer;
      if (!cam || !ptr) return;
      if (!this._sardinePt) { this._sardinePt = new THREE.Vector3(); this._sardineRay = new THREE.Raycaster(); }
      if (!this._sardineOn) { this._sardineOn = true; this.react('perk'); }
      this._sardineRay.setFromCamera(ptr, cam);
      this._sardineRay.ray.at(1.1, this._sardinePt);
      this.lookAt(this._sardinePt);
    } else if (this._sardineOn) {
      this._sardineOn = false;
      if (this._hasLook && this._lookTarget.equals(this._sardinePt)) this.lookAt(null);
    }
  }

  _apply(dt, t) {
    // ---- random idle events
    if (dt > 0) {
      if ((this._blinkTimer -= dt) <= 0) {
        const r = Math.random();
        if (r < 0.1) this.react('slowBlink');
        else { this.react('blink'); if (r > 0.86) setTimeout(() => this.react('blink'), 300); }
        this._blinkTimer = rand(2.2, 6.5);
      }
      if ((this._earTimer -= dt) <= 0) {
        this.react(Math.random() < 0.5 ? 'earFlickL' : 'earFlickR');
        this._earTimer = rand(3, 9);
      }
      if ((this._fidgetTimer -= dt) <= 0) {
        if (!this._walk) this.tail.flick(0.5);
        this._fidgetTimer = rand(10, 25);
      }
      if ((this._idleTimer -= dt) <= 0) {
        if (Math.random() < 0.3) { this._idleYaw = 0; this._idlePitch = 0; }
        else { this._idleYaw = rand(-0.65, 0.65); this._idlePitch = rand(-0.18, 0.15); }
        this._idleRoll = Math.random() < 0.25 ? rand(-0.2, 0.2) : 0;
        this._idleTimer = rand(2, 6);
      }
    }

    // ---- reactions → channels
    let earBack = 0, earPerk = 0, recoil = 0, jaw = 0, squint = 0, blink = 0, dilate = 0, headUp = 0, wide = 0, stretchW = 0;
    let flickL = 0, flickR = 0;
    const fx = this._fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.t += dt; const u = e.t;
      switch (e.kind) {
        case 'flinch':
          earBack = Math.max(earBack, env(u, 0.05, 0.4, 0.5));
          recoil = Math.max(recoil, env(u, 0.05, 0.12, 0.55));
          blink = Math.max(blink, env(u, 0.03, 0.05, 0.12));
          dilate = Math.max(dilate, env(u, 0.05, 0.4, 0.5));
          break;
        case 'perk':
          earPerk = Math.max(earPerk, env(u, 0.12, 0.95, 0.5));
          headUp = Math.max(headUp, 0.5 * env(u, 0.15, 0.9, 0.5));
          dilate = Math.max(dilate, env(u, 0.1, 1.0, 0.5));
          wide = Math.max(wide, env(u, 0.1, 0.95, 0.5));
          break;
        case 'blink': blink = Math.max(blink, env(u, 0.07, 0.04, 0.14)); break;
        case 'slowBlink': blink = Math.max(blink, env(u, 0.4, 0.35, 0.5)); break;
        case 'yawn':
          jaw = Math.max(jaw, 0.85 * env(u - 0.15, 0.7, 0.65, 0.6));
          squint = Math.max(squint, env(u, 0.45, 1.2, 0.55));
          headUp = Math.max(headUp, env(u, 0.6, 0.8, 0.7));
          earBack = Math.max(earBack, 0.45 * env(u, 0.6, 0.8, 0.6));
          break;
        case 'stretch':
          stretchW = Math.max(stretchW, env(u, 0.9, 1.4, 1.0));
          squint = Math.max(squint, env(u - 0.6, 0.4, 1.2, 0.5));
          jaw = Math.max(jaw, 0.4 * env(u - 0.9, 0.5, 0.5, 0.5));
          earBack = Math.max(earBack, 0.35 * env(u - 0.6, 0.4, 1.1, 0.5));
          break;
        case 'earFlickL': flickL = Math.max(flickL, env(u, 0.04, 0.05, 0.2)); break;
        case 'earFlickR': flickR = Math.max(flickR, env(u, 0.04, 0.05, 0.2)); break;
      }
      if (u >= e.dur) { fx.splice(i, 1); e.resolve(); }
    }
    const walking = this._walk !== null;

    // ---- walk state machine
    let gaitAmp = 0;
    if (this._walk && dt > 0) {
      const w = this._walk; w.t += dt;
      const g = this.group;
      if (w.stage === 0) {
        g.rotation.y = lerp(w.yaw0, w.yaw1, easeInOut(w.t / w.turnDur));
        if (w.t >= Math.max(w.turnDur, 0.4)) { w.stage = 1; w.t = 0; }
        this._speed = 0;
      } else if (w.stage === 1) {
        const k = clamp(w.t / w.dur, 0, 1);
        const e = easeInOut(k);
        const px = g.position.x, pz = g.position.z;
        g.position.lerpVectors(w.from, w.to, e);
        this._speed = Math.hypot(g.position.x - px, g.position.z - pz) / dt;
        if (k >= 1) { w.stage = 2; w.t = 0; this._speed = 0; this.setPose('sit', 0.65); }
      } else if (w.t >= 0.7) {
        this._walk = null; w.resolve();
      }
    }
    this._walkW = damp(this._walkW, this._walk && this._walk.stage === 1 ? 1 : 0, 8, dt);
    const stride = 0.13;
    this._gait = (this._gait + dt * (0.6 * this._speed) / stride + dt * 0.4 * (this._walk?.stage === 0 ? 1 : 0)) % 1;
    gaitAmp = this._walkW;

    // ---- pose blend
    if (this._poseK < 1) {
      this._poseK = Math.min(1, this._poseK + dt / this._poseDur);
      const k = easeInOut(this._poseK);
      const a = this._pFrom, b = this._pTo, o = this._pBase;
      for (let i = 0; i < POSE_SIZE; i++) o[i] = a[i] + (b[i] - a[i]) * k;
      if (this._poseK >= 1 && this._poseResolve) { const r = this._poseResolve; this._poseResolve = null; r(); }
    }
    const P = this._pW;
    if (stretchW > 0) {
      const s = POSES.stretch, b = this._pBase;
      for (let i = 0; i < POSE_SIZE; i++) P[i] = b[i] + (s[i] - b[i]) * stretchW;
    } else P.set(this._pBase);

    // ---- breathing, recoil, walk bob
    const breath = Math.sin((t * TAU) / 3.4);
    const root = this.root;
    root.position.set(0, gaitAmp * 0.006 * Math.cos(this._gait * 2 * TAU), -0.03 * recoil);
    root.rotation.z = gaitAmp * 0.03 * Math.sin(this._gait * TAU);
    root.rotation.x = -0.05 * recoil;

    // ---- head
    const hx = P[O.head], hy = P[O.head + 1] + 0.0025 * breath + 0.012 * headUp, hz = P[O.head + 2] - 0.02 * recoil;
    this.headPivot.position.set(hx, hy, hz);
    let tYaw = this._idleYaw, tPitch = this._idlePitch, tRoll = this._idleRoll;
    if (this._hasLook && this.group.parent) {
      _v.copy(this._lookTarget);
      this.root.updateWorldMatrix(true, false);
      this.root.worldToLocal(_v);
      const dx = _v.x - hx, dy = _v.y - hy, dz = _v.z - hz;
      tYaw = Math.atan2(dx, dz);
      tPitch = -Math.atan2(dy, Math.hypot(dx, dz));
      tRoll = 0;
      if (Math.abs(tYaw) > 2.4) { tYaw = 0; tPitch = 0; } // behind him: not worth the effort
    }
    if (walking) { tYaw *= 0.3; tPitch = 0.05; tRoll = 0; }
    const cYaw = clamp(tYaw, -1.0, 1.0), cPitch = clamp(tPitch, -0.55, 0.45);
    this._headYaw = damp(this._headYaw, cYaw, 4.5, dt);
    this._headPitch = damp(this._headPitch, cPitch, 4.5, dt);
    this._headRoll = damp(this._headRoll, tRoll, 2.5, dt);
    this._eyeYaw = damp(this._eyeYaw, clamp(tYaw - this._headYaw, -0.42, 0.42), 20, dt);
    this._eyePitch = damp(this._eyePitch, clamp(tPitch - this._headPitch, -0.3, 0.3), 20, dt);
    const hp = this.headPivot;
    hp.rotation.y = this._headYaw;
    hp.rotation.x = P[O.headPitch] + this._headPitch * 0.85 - 0.3 * headUp + gaitAmp * 0.03 * Math.sin(this._gait * 2 * TAU);
    hp.rotation.z = this._headRoll * (1 - headUp);

    // ---- eyes
    const restU = 0.8, restL = 0.93;
    let openU = lerp(restU, 1.0, wide);
    let openL = restL;
    openU = lerp(openU, 0.32, squint); openL = lerp(openL, 0.42, squint);
    openU = lerp(openU, 0.0, blink); openL = lerp(openL, 0.8, blink);
    const pupilW = lerp(0.2, 0.62, dilate);
    for (const e of this.eyes) {
      setLids(e, openU, openL);
      e.gaze.rotation.set(this._eyePitch * 1.1, e.baseYaw + this._eyeYaw * 1.2, 0);
      e.pupil.scale.x = pupilW;
    }

    // ---- ears
    for (const ear of this.ears) {
      const s = ear.side;
      const fl = s === 1 ? flickL : flickR;
      let rx = -0.12, ry = 0.28, rz = -0.3;
      rx = lerp(rx, 0.06, earPerk); ry = lerp(ry, 0.05, earPerk); rz = lerp(rz, -0.16, earPerk);
      rx = lerp(rx, -0.55, earBack); ry = lerp(ry, 1.05, earBack); rz = lerp(rz, -1.0, earBack);
      rx += -0.35 * fl; ry += 0.55 * fl;
      ear.pivot.rotation.set(rx, ry * s, rz * s);
    }

    // ---- jaw
    this._speakAmt = damp(this._speakAmt, this._speaking ? 1 : 0, 14, dt);
    const talk = this._speakAmt * 0.11 * (0.5 + 0.5 * Math.sin(t * 19)) * (0.65 + 0.35 * Math.sin(t * 5.3));
    this.jaw.rotation.x = Math.max(jaw, talk);

    // ---- legs (2-bone IK in the sagittal plane, plus foot for hind legs)
    const g = this._gait;
    for (let li = 0; li < 4; li++) {
      const L = this.legs[li];
      const s = L.side;
      // gait phase offsets: HL 0, FL .25, HR .5, FR .75
      const off = L.front ? (s === 1 ? 0.25 : 0.75) : (s === 1 ? 0 : 0.5);
      let p = (g + off) % 1, dzS = 0, lift = 0;
      if (p < 0.6) dzS = stride * (0.5 - p / 0.6);
      else { const q = (p - 0.6) / 0.4; dzS = stride * (-0.5 + smooth(q)); lift = Math.sin(PI * q) * 0.03; }
      dzS *= gaitAmp; lift *= gaitAmp;
      if (L.front) {
        const rx = P[O.shoulder] * s, ry = P[O.shoulder + 1] + 0.003 * breath, rz = P[O.shoulder + 2];
        const ty = P[O.fpaw + 1] + lift, tz = P[O.fpaw + 2] + dzS;
        ik2(ry, rz, ty, tz, FRONT_A, FRONT_B, -1);
        L.j0.position.set(rx, ry, rz);
        L.j0.rotation.set(-_ik.a1, 0, 0);
        L.j1.rotation.x = -(_ik.a2 - _ik.a1);
        L.j2.rotation.x = _ik.a2;
        L.j0.position.x = lerp(rx, P[O.fpaw] * s, 0.3);
      } else {
        const rx = P[O.hip] * s, ry = P[O.hip + 1], rz = P[O.hip + 2];
        const toeY = P[O.htoe + 1] + lift, toeZ = P[O.htoe + 2] + dzS;
        const hockY = toeY + P[O.hock + 1] + lift * 0.6, hockZ = toeZ + P[O.hock + 2];
        ik2(ry, rz, hockY, hockZ, HIND_A, HIND_B, 1);
        const a1 = _ik.a1, a2 = _ik.a2;
        const hy2 = _ik.ky - HIND_B * Math.cos(a2), hz2 = _ik.kz + HIND_B * Math.sin(a2);
        const a3 = Math.atan2(toeZ - hz2, -(toeY - hy2));
        L.j0.position.set(rx, ry, rz);
        L.j0.rotation.set(-a1, 0, 0);
        L.j1.rotation.x = -(a2 - a1);
        L.j2.rotation.x = -(a3 - a2);
        L.j3.rotation.x = a3;
      }
    }

    // ---- body tube
    this._buildBody(P, breath, hx, hy, hz);

    // ---- tail
    const tr = this.tail;
    tr.base.set(P[O.tailBase], P[O.tailBase + 1], P[O.tailBase + 2]);
    tr.heading = P[O.tailDir]; tr.elev = P[O.tailDir + 1] + 0.25 * gaitAmp;
    for (let i = 0; i < 6; i++) {
      tr.pitch[i] = P[O.tailPitch + i]; tr.yaw[i] = P[O.tailYaw + i]; tr.gain[i] = P[O.tailGain + i];
    }
    tr.sway = P[O.tailSway] * (1 + 0.6 * gaitAmp) * (1 - 0.6 * earBack);
    tr.swaySpeed = 1 + gaitAmp * 0.8;
    if (dt > 0) tr.update(dt, t); else tr.update(1 / 60, t);
  }

  _buildBody(P, breath, hx, hy, hz) {
    const tube = this.body, R = tube.rings;
    // control points: 4 spine + neck (tucked inside the head)
    for (let i = 0; i < 12; i++) _ctrl[i] = P[O.spine + i];
    _ctrl[12] = 0; _ctrl[13] = hy - 0.045; _ctrl[14] = hz - 0.03;
    const D = 64;
    let acc = 0;
    for (let k = 0; k <= D; k++) {
      catmull(_dense, k * 3, _ctrl, 5, (k / D) * 4);
      if (k > 0) {
        const a = (k - 1) * 3, b = k * 3;
        acc += Math.hypot(_dense[b] - _dense[a], _dense[b + 1] - _dense[a + 1], _dense[b + 2] - _dense[a + 2]);
      }
      _denseS[k] = acc;
    }
    const Ltot = acc;
    const rw0 = P[O.rw], rh0 = P[O.rh];
    const capRear = Math.max(rw0, rh0) * 0.95, capFront = 0.04;
    const belly = P[O.belly];
    let seg = 0;
    for (let i = 0; i < R; i++) {
      const x = i / (R - 1);
      const s = Ltot * (0.45 * x + 0.55 * (1 - Math.cos(PI * x)) / 2);
      while (seg < D - 1 && _denseS[seg + 1] < s) seg++;
      const s0 = _denseS[seg], s1 = _denseS[seg + 1];
      const f = s1 > s0 ? clamp((s - s0) / (s1 - s0), 0, 1) : 0;
      const a = seg * 3, b = (seg + 1) * 3;
      tube.C[i * 3] = _dense[a] + (_dense[b] - _dense[a]) * f;
      tube.C[i * 3 + 1] = _dense[a + 1] + (_dense[b + 1] - _dense[a + 1]) * f;
      tube.C[i * 3 + 2] = _dense[a + 2] + (_dense[b + 2] - _dense[a + 2]) * f;
      // radius keys indexed by the curve parameter (0..4)
      const u = ((seg + f) / D) * 4;
      const ki = Math.min(3, Math.floor(u)), kf = smooth(u - ki);
      let w = lerp(P[O.rw + ki], P[O.rw + ki + 1], kf);
      let h = lerp(P[O.rh + ki], P[O.rh + ki + 1], kf);
      const tN = s / Ltot;
      const br = 1 + 0.022 * breath * Math.sin(PI * clamp(tN * 1.2, 0, 1));
      const cap = capF(s, capRear) * capF(Ltot - s, capFront);
      tube.rw[i] = w * cap * br;
      tube.rh[i] = h * cap * br;
      tube.belly[i] = belly * Math.sin(PI * clamp((tN - 0.05) / 0.75, 0, 1));
      tube.v[i] = tN;
    }
    // planar frame: N = +X, B = T x N
    const C = tube.C;
    for (let i = 0; i < R; i++) {
      const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, R - 1) * 3;
      let ty = C[b + 1] - C[a + 1], tz = C[b + 2] - C[a + 2];
      const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
      tube.N[i * 3] = 1; tube.N[i * 3 + 1] = 0; tube.N[i * 3 + 2] = 0;
      tube.B[i * 3] = 0; tube.B[i * 3 + 1] = tz; tube.B[i * 3 + 2] = -ty;
    }
    tube.commit();
  }

  dispose() {
    this.ctx?.hotspots?.remove?.('cat');
    this.group.removeFromParent();
  }
}

// ------------------------------------------------------------------------------------------
// Bartholomew Quince — the wizard, for the ending
// ------------------------------------------------------------------------------------------

export function createWizard() {
  const M = getMaterials();
  const group = new THREE.Group();
  group.name = 'wizard';

  const latheFolds = (profile, segs, foldAmp, foldFn) => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const th = Math.atan2(x, z);
      const k = 1 + foldAmp * foldFn(y) * (Math.sin(th * 9 + 0.6 * Math.sin(th * 4)) * 0.7 + Math.sin(th * 5 + 1) * 0.3);
      p.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    // stitch the lathe seam
    const n = g.attributes.normal, rows = profile.length;
    for (let r = 0; r < rows; r++) {
      const a = r, b = segs * rows + r;
      const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(nx, ny, nz) || 1;
      n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
    }
    return g;
  };

  // skirt of the robe (0 → 1.0 m)
  const skirtProfile = [];
  for (let i = 0; i <= 14; i++) {
    const y = (i / 14) * 1.02;
    const r = 0.21 + 0.15 * Math.pow(1 - y / 1.02, 1.6) + (i === 0 ? -0.01 : 0);
    skirtProfile.push([r, y]);
  }
  skirtProfile.unshift([0.0, 0.01]);
  const skirt = new THREE.Mesh(latheFolds(skirtProfile, 56, 0.07, (y) => Math.pow(clamp(1 - y / 1.0, 0, 1), 1.2)), M.robe);
  skirt.castShadow = true;
  const skirtPivot = new THREE.Group(); skirtPivot.position.y = 0; skirtPivot.add(skirt);
  group.add(skirtPivot);

  // upper body (pivots at the waist for bowing)
  const upper = new THREE.Group(); upper.position.y = 1.0; group.add(upper);
  const torsoProfile = [[0.205, -0.02], [0.215, 0.12], [0.205, 0.26], [0.18, 0.36], [0.135, 0.43], [0.075, 0.48], [0.05, 0.52], [0.0, 0.53]];
  const torso = new THREE.Mesh(latheFolds(torsoProfile, 40, 0.025, (y) => clamp(1 - y / 0.45, 0, 1)), M.robe);
  torso.scale.set(1, 1, 0.86); torso.castShadow = true;
  upper.add(torso);
  // rope belt
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.018, 8, 40), M.band);
  belt.rotation.x = PI / 2; belt.scale.set(1, 0.84, 1); belt.position.y = 0.01;
  upper.add(belt);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M.band);
  knot.position.set(0.08, 0.0, 0.17); upper.add(knot);
  for (const dx of [0.07, 0.095]) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.22, 3, 6), M.band);
    c.position.set(dx, -0.13, 0.172); c.rotation.z = (dx - 0.08) * 2; upper.add(c);
  }

  // head
  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.5, 0.02); headPivot.rotation.order = 'YXZ';
  upper.add(headPivot);
  const head = new THREE.Group(); head.position.y = 0.12; head.scale.setScalar(1.3); headPivot.add(head);
  const skullG = displacedSphere(32, 24, (v) => v.set(v.x * 0.098, v.y * 0.112, v.z * 0.1));
  const skull = new THREE.Mesh(skullG, M.skin); skull.castShadow = true; head.add(skull);
  const nose = new THREE.Mesh(displacedSphere(16, 12, (v) => v.set(v.x * 0.022, v.y * 0.03, v.z * 0.028 + (v.y < 0 ? -v.y * 0.006 : 0))), M.nose2);
  nose.position.set(0, -0.008, 0.1); nose.rotation.x = -0.25; head.add(nose);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), M.skin);
    ear.position.set(0.097 * s, 0.0, -0.005); ear.scale.set(0.5, 1, 0.8); head.add(ear);
    const hair = new THREE.Mesh(displacedSphere(16, 12, (v) => v.set(v.x * 0.045, v.y * 0.06, v.z * 0.05)), M.beard);
    hair.position.set(0.085 * s, 0.0, -0.045); head.add(hair);
  }
  const wEyes = [];
  for (const s of [1, -1]) {
    const e = makeEye(0.019, M, M.skin);
    e.socket.position.set(0.04 * s, 0.022, 0.082);
    e.socket.rotation.order = 'YXZ';
    e.socket.rotation.set(-0.05, 0.32 * s, 0);
    e.socket.scale.set(1.05, 0.9, 0.7);
    e.baseYaw = -0.25 * s;
    head.add(e.socket); wEyes.push(e);
    // bushy brow
    const brow = new THREE.Mesh(displacedSphere(14, 10, (v) => v.set(v.x * 0.03, v.y * 0.011, v.z * 0.014)), M.beard);
    brow.position.set(0.042 * s, 0.05, 0.088); brow.rotation.z = -0.25 * s; brow.rotation.y = 0.3 * s;
    head.add(brow);
  }
  // moustache
  for (const s of [1, -1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.004 * s, -0.034, 0.106), new THREE.Vector3(0.04 * s, -0.045, 0.094), new THREE.Vector3(0.068 * s, -0.07, 0.07), new THREE.Vector3(0.074 * s, -0.095, 0.062),
    ]);
    const tg = new THREE.TubeGeometry(curve, 12, 0.012, 8, false);
    const tp = tg.attributes.position;
    // taper toward the tip
    for (let i = 0; i < tp.count; i++) {
      const seg = Math.floor(i / 9) / 12;
      const c = curve.getPointAt(Math.min(1, seg));
      const k = lerp(1, 0.35, seg);
      tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, c.y + (tp.getY(i) - c.y) * k, c.z + (tp.getZ(i) - c.z) * k);
    }
    tg.computeVertexNormals();
    head.add(new THREE.Mesh(tg, M.beard));
  }
  // beard: a long, lumpy, wavy cone from the jaw
  const beardG = displacedSphere(28, 24, (v) => {
    const d = (1 - v.y) / 2; // 0 top .. 1 bottom
    const len = 0.42;
    const y = 0.02 - d * len;
    const taper = Math.pow(Math.sin(Math.min(1, d * 1.05) * PI * 0.5 + 0.35), 1) * (1 - d * 0.85);
    const ang = Math.atan2(v.x, v.z);
    const wav = 1 + 0.08 * Math.sin(ang * 7 + d * 6);
    const rx = 0.1 * taper * wav, rz = 0.075 * taper * wav;
    const r = Math.hypot(v.x, v.z) || 1e-6;
    v.set((v.x / r) * rx * Math.min(1, r * 1.5), y, (v.z / r) * rz * Math.min(1, r * 1.5) + 0.02 + d * 0.05 + 0.03 * Math.sin(d * 5));
  });
  const beard = new THREE.Mesh(beardG, M.beard);
  beard.position.set(0, -0.045, 0.055); beard.castShadow = true;
  head.add(beard);

  // hat: a crushed cone + drooping brim + band + a small brass star
  const hat = new THREE.Group(); hat.position.set(0, 0.07, -0.005); hat.rotation.x = -0.08; head.add(hat);
  const brimProfile = [];
  for (let i = 0; i <= 6; i++) { const k = i / 6; brimProfile.push(new THREE.Vector2(0.11 + 0.135 * k, -0.02 * k * k)); }
  for (let i = 6; i >= 0; i--) { const k = i / 6; brimProfile.push(new THREE.Vector2(0.11 + 0.135 * k, -0.02 * k * k + 0.01)); }
  const brimG = new THREE.LatheGeometry(brimProfile, 40);
  const bp = brimG.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z), th = Math.atan2(x, z);
    bp.setY(i, bp.getY(i) - 0.03 * Math.max(0, r - 0.15) * (1 + Math.sin(th * 3 + 0.5)) * 3);
  }
  brimG.computeVertexNormals();
  const brim = new THREE.Mesh(brimG, M.hat); brim.castShadow = true; hat.add(brim);
  const coneG = new THREE.ConeGeometry(0.128, 0.42, 28, 14, true);
  const cp = coneG.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    let x = cp.getX(i), y = cp.getY(i) + 0.21, z = cp.getZ(i);
    const h = y / 0.42;
    // crumple ripples and a slump: the tip folds back and to the side
    const th = Math.atan2(x, z);
    const rip = 1 + 0.06 * Math.sin(th * 5 + h * 8) * h;
    x *= rip; z *= rip;
    const bend = Math.pow(Math.max(0, h - 0.45) / 0.55, 2);
    x += bend * 0.16; z -= bend * 0.1; y -= bend * 0.12;
    cp.setXYZ(i, x, y, z);
  }
  coneG.computeVertexNormals();
  const cone = new THREE.Mesh(coneG, M.hat); cone.castShadow = true; hat.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.131, 0.04, 28, 1, true), M.band);
  band.position.y = 0.025; hat.add(band);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + PI / 2, r = i % 2 ? 0.011 : 0.026;
    i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.004, bevelEnabled: false }), M.star);
  star.position.set(0.04, 0.17, 0.095); star.rotation.set(-0.2, 0.3, 0.1); hat.add(star);

  // arms: shoulder → elbow, wide sleeve cuffs, hands
  const arms = [];
  const upperSleeve = new THREE.CylinderGeometry(0.06, 0.075, 0.3, 16, 1, true); upperSleeve.translate(0, -0.15, 0);
  const lowerSleeve = new THREE.CylinderGeometry(0.075, 0.12, 0.3, 18, 1, true); lowerSleeve.translate(0, -0.15, 0);
  const hand = new THREE.SphereGeometry(0.045, 14, 10);
  const robeDS = M.robe.clone(); robeDS.side = THREE.DoubleSide;
  for (const s of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(0.165 * s, 0.4, 0.0); upper.add(sh);
    const us = new THREE.Mesh(upperSleeve, robeDS); us.castShadow = true; sh.add(us);
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), M.robe); shoulderBall.scale.set(1, 0.8, 1); sh.add(shoulderBall);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    const ls = new THREE.Mesh(lowerSleeve, robeDS); ls.castShadow = true; el.add(ls);
    const h = new THREE.Mesh(hand, M.skin); h.position.y = -0.31; h.scale.set(0.9, 1.15, 0.8); el.add(h);
    sh.rotation.z = 0.12 * s; el.rotation.x = -0.25;
    arms.push({ sh, el, s });
  }

  // the tail, sticking out of the back of the robe
  const tail = new TailRig(M.tail, { segs: 6, segLen: 0.1, r0: 0.042, r1: 0.027, rings: 26, radial: 14, floorY: 0.03 });
  tail.base.set(0, 0.5, -0.2);
  tail.heading = PI; tail.elev = -0.35;
  tail.pitch.set([0.1, 0.3, 0.35, 0.32, 0.2, -0.15]);
  tail.gain.set([0.2, 0.25, 0.3, 0.35, 0.4, 0.45]);
  tail.sway = 0.35;
  tail.mesh.castShadow = true;
  group.add(tail.mesh);

  // animation
  const fx = [];
  let blinkT = rand(1.5, 4), idleT = 2, idleYaw = 0, idlePitch = 0, hYaw = 0, hPitch = 0;
  const run = (kind, dur) => new Promise((res) => fx.push({ kind, t: 0, dur, res }));

  function update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 1 / 20);
    if ((blinkT -= dt) <= 0) { fx.push({ kind: 'blink', t: 0, dur: 0.26, res: () => {} }); blinkT = rand(2.5, 6); }
    if ((idleT -= dt) <= 0) { idleYaw = rand(-0.4, 0.4); idlePitch = rand(-0.1, 0.12); idleT = rand(2, 5); }
    let blink = 0, waveRaise = 0, waveWag = 0, bow = 0;
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i]; e.t += dt; const u = e.t;
      if (e.kind === 'blink') blink = Math.max(blink, env(u, 0.07, 0.04, 0.14));
      if (e.kind === 'wave') { waveRaise = env(u, 0.45, 1.6, 0.5); waveWag = Math.sin((u - 0.45) * 11) * env(u - 0.3, 0.3, 1.4, 0.4); }
      if (e.kind === 'bow') bow = env(u, 0.7, 0.5, 0.8);
      if (u >= e.dur) { fx.splice(i, 1); e.res(); }
    }
    const breath = Math.sin((t * TAU) / 4);
    upper.scale.set(1 + 0.008 * breath, 1 + 0.006 * breath, 1 + 0.008 * breath);
    upper.rotation.x = 0.5 * bow;
    skirtPivot.rotation.z = 0.01 * Math.sin(t * 0.7);
    hYaw = damp(hYaw, idleYaw * (1 - bow), 3, dt);
    hPitch = damp(hPitch, idlePitch, 3, dt);
    headPivot.rotation.y = hYaw;
    headPivot.rotation.x = hPitch + 0.25 * bow;
    for (const e of wEyes) {
      setLids(e, lerp(0.62, 0, blink), lerp(0.95, 0.8, blink));
      e.gaze.rotation.set(0, e.baseYaw, 0);
    }
    // arms: the right arm (-X) waves; both sweep forward a little in the bow
    for (const a of arms) {
      const isWave = a.s === -1;
      const raise = isWave ? waveRaise : 0;
      a.sh.rotation.z = lerp(0.12 * a.s, -1.25, raise) * (isWave ? 1 : 1);
      a.sh.rotation.x = -0.35 * bow * (isWave ? 1 - raise : 1);
      a.el.rotation.x = -0.25 - 0.3 * bow;
      a.el.rotation.z = isWave ? -1.35 * raise + 0.35 * waveWag : 0;
    }
    tail.sway = 0.35 + 0.15 * Math.sin(t * 0.3);
    tail.update(dt || 1 / 60, t);
  }
  // scale the whole figure to ~1.9 m including the hat
  const inner = new THREE.Group();
  while (group.children.length) inner.add(group.children[0]);
  inner.scale.setScalar(0.9);
  group.add(inner);
  update(0, 0);

  return {
    group,
    update,
    wave: () => run('wave', 2.6),
    bow: () => run('bow', 2.0),
  };
}
