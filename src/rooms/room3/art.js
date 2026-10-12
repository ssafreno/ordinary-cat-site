// Room 3 — canvas art: ritual-circle inlay, star chart, orrery dial, the 3-ring glyph, dome paint.
import * as THREE from 'three';
import { rng } from '../../engine/props/textures.js';

export const SERIF = '"Cormorant Garamond", Georgia, serif';

export function tex(canvas, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------------------------------------
// Ritual circle inlay. Geometry in metres around the circle centre; canvas top = north.
// ---------------------------------------------------------------------------------------------
export const INLAY_HALF = 1.38;            // metres from centre to the canvas edge
export const CANDLE_R = 1.0;
export const BEARINGS = { N: 0, E: 90, SE: 135, SW: 225, W: 270 };
export const bearingVec = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)]; // [x, z]

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

/**
 * mode 'base': engraved brass lines on transparent (map)
 * mode 'mask': white lines on black (emissiveMap)
 * mode 'glow': blurred soft version (additive halo)
 */
export function drawInlay(mode, S = 2048) {
  const c = canvas(S, S), g = c.getContext('2d');
  const s = S / (2 * INLAY_HALF);
  const cx = S / 2, cy = S / 2;
  const P = (x, z) => [cx + x * s, cy + z * s];
  if (mode === 'mask' || mode === 'glow') { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); }
  const ink = mode === 'base' ? '#c9a24a' : '#ffffff';
  const dim = mode === 'base' ? 'rgba(201,162,74,0.55)' : 'rgba(255,255,255,0.55)';
  if (mode === 'glow') g.filter = `blur(${Math.round(S * 0.008)}px)`;
  g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  const ring = (r, w, col = ink) => { g.strokeStyle = col; g.lineWidth = w * s; g.beginPath(); g.arc(cx, cy, r * s, 0, Math.PI * 2); g.stroke(); };

  if (mode === 'base') {
    // a slightly darker stone disc inside the outer ring, so the circle reads as an inlay
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 1.25 * s);
    gr.addColorStop(0, 'rgba(20,18,30,0.55)'); gr.addColorStop(0.9, 'rgba(20,18,30,0.4)'); gr.addColorStop(1, 'rgba(20,18,30,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 1.25 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
  }
  ring(1.25, 0.022); ring(1.13, 0.012); ring(CANDLE_R, 0.008, dim); ring(0.62, 0.008, dim);
  // runes in the band
  const r = rng(5);
  g.font = `${Math.round(0.075 * s)}px ${SERIF}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const nR = 44;
  for (let i = 0; i < nR; i++) {
    const a = (i / nR) * Math.PI * 2;
    g.save(); g.translate(cx + Math.sin(a) * 1.19 * s, cy - Math.cos(a) * 1.19 * s); g.rotate(a);
    g.fillStyle = ink; g.fillText(RUNES[Math.floor(r() * RUNES.length)], 0, 0);
    g.restore();
  }
  // pentagram through the candle points (star order)
  const pts = {};
  for (const [k, b] of Object.entries(BEARINGS)) { const [x, z] = bearingVec(b); pts[k] = P(x * CANDLE_R, z * CANDLE_R); }
  g.strokeStyle = ink; g.lineWidth = 0.014 * s;
  g.beginPath();
  ['N', 'SE', 'W', 'E', 'SW', 'N'].forEach((k, i) => (i ? g.lineTo(...pts[k]) : g.moveTo(...pts[k])));
  g.stroke();
  for (const k of Object.keys(BEARINGS)) {
    g.lineWidth = 0.012 * s; g.beginPath(); g.arc(...pts[k], 0.1 * s, 0, Math.PI * 2); g.stroke();
  }
  // compass rose at the centre
  const rose = (len, wid, n, off, fillA, fillB) => {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      const tip = [cx + Math.sin(a) * len * s, cy - Math.cos(a) * len * s];
      const l = [cx + Math.sin(a - Math.PI / 2) * wid * s, cy - Math.cos(a - Math.PI / 2) * wid * s];
      const rr = [cx + Math.sin(a + Math.PI / 2) * wid * s, cy - Math.cos(a + Math.PI / 2) * wid * s];
      g.fillStyle = fillA; g.beginPath(); g.moveTo(cx, cy); g.lineTo(...l); g.lineTo(...tip); g.closePath(); g.fill();
      g.fillStyle = fillB; g.beginPath(); g.moveTo(cx, cy); g.lineTo(...rr); g.lineTo(...tip); g.closePath(); g.fill();
    }
  };
  const dark = mode === 'base' ? '#7a5a22' : 'rgba(255,255,255,0.6)';
  rose(0.3, 0.05, 4, Math.PI / 4, dark, ink);
  rose(0.46, 0.07, 4, 0, ink, dark);
  ring(0.17, 0.01);
  g.font = `700 ${Math.round(0.13 * s)}px ${SERIF}`;
  g.fillStyle = ink;
  for (const [L, b] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const [x, z] = bearingVec(b);
    g.fillText(L, cx + x * 0.56 * s, cy + z * 0.56 * s);
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// The 3-ring planet diagram (canonical: inner 12, middle 3, outer 9)
// ---------------------------------------------------------------------------------------------
export const SOLUTION = [0, 3, 9];   // clock positions (0 = twelve o'clock)

export function drawRings(g, cx, cy, R, { ink = '#3a2410', planet = '#7a1c22', sun = '#c98a1a', lw = 2, labels = true, glow = false } = {}) {
  g.save();
  g.lineCap = 'round';
  if (glow) { g.shadowColor = ink; g.shadowBlur = R * 0.08; }
  const radii = [0.38, 0.66, 0.94].map((k) => k * R);
  // ticks at 12 positions on the outer edge
  g.strokeStyle = ink; g.lineWidth = lw;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = R * 1.02, r1 = R * (i % 3 === 0 ? 1.12 : 1.07);
    g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke();
  }
  for (const r of radii) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
  if (labels) {
    g.fillStyle = ink; g.font = `700 ${Math.round(R * 0.17)}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, i] of [['XII', 0], ['III', 3], ['VI', 6], ['IX', 9]]) {
      const a = (i / 12) * Math.PI * 2;
      g.fillText(t, cx + Math.sin(a) * R * 1.27, cy - Math.cos(a) * R * 1.27);
    }
  }
  // sun
  g.fillStyle = sun;
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? R * 0.09 : R * 0.15; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  // planets at the canonical positions
  SOLUTION.forEach((p, i) => {
    const a = (p / 12) * Math.PI * 2, r = radii[i];
    const x = cx + Math.sin(a) * r, y = cy - Math.cos(a) * r;
    g.fillStyle = planet; g.beginPath(); g.arc(x, y, R * (0.06 + i * 0.012), 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke();
  });
  g.restore();
}

export function drawGlyph(S = 512) {
  const c = canvas(S, S), g = c.getContext('2d');
  drawRings(g, S / 2, S / 2, S * 0.34, { ink: '#bcd4ff', planet: '#ffe2a0', sun: '#ffd27a', lw: S * 0.006, labels: true, glow: true });
  return c;
}

// ---------------------------------------------------------------------------------------------
// Star chart (wall). Felis circled; note + diagram on the right.
// ---------------------------------------------------------------------------------------------
export const FELIS = [  // sitting cat, facing right, unit box ~[-0.27..0.17] x [-0.2..0.25]
  [0.10, -0.18], [0.11, 0.0], [0.13, 0.08], [0.18, 0.115], [0.15, 0.17], [0.16, 0.245], [0.105, 0.19],
  [0.065, 0.25], [0.045, 0.15], [-0.06, 0.06], [-0.12, -0.08], [-0.10, -0.18], [0.10, -0.18],
];
export const FELIS_TAIL = [[-0.10, -0.18], [-0.20, -0.17], [-0.26, -0.08], [-0.22, 0.0]];

// silly constellations (index into caption.constellation.other)
export const OTHERS = [
  { name: 0, at: [-0.9, 0.35], pts: [[-0.08, 0.06], [-0.02, 0.1], [0.04, 0.06], [-0.02, 0.0], [-0.08, 0.06], [0.0, 0.0], [0.08, -0.08], [0.14, -0.14]] },        // Lesser Spoon
  { name: 1, at: [0.2, -0.45], pts: [[0, 0.12], [0, 0.0], [-0.07, -0.12], [0, 0.0], [0.07, -0.12], [0, 0.0], [0, 0.07], [-0.08, 0.04], [0, 0.07], [0.08, 0.04]] }, // Gerald
  { name: 2, at: [-0.35, -0.55], pts: [[-0.12, -0.12], [-0.05, 0.0], [-0.06, 0.1], [0.0, 0.14], [0.08, 0.1], [0.0, 0.05], [0.06, -0.04]] },                       // Heron
  { name: 3, at: [0.75, -0.3], pts: [[-0.1, 0.0], [-0.05, 0.06], [0.05, 0.06], [0.1, 0.0], [0.05, -0.06], [-0.05, -0.06], [-0.1, 0.0], [-0.17, 0.05], [0.1, 0.0], [0.17, 0.06]] }, // Teapot
  { name: 4, at: [-1.15, -0.2], pts: [[-0.12, -0.06], [0.0, 0.14], [0.12, -0.06], [-0.12, -0.06]] },                                                                 // Hat
  { name: 5, at: [-0.15, 0.62], pts: [[-0.05, 0.03], [0.0, 0.05], [0.05, 0.03], [0.0, 0.0], [-0.05, 0.03], [0.0, 0.0], [0.03, -0.04]] },                              // Greater Spoon (small)
  { name: 6, at: [1.25, 0.05], pts: [[-0.08, 0.08], [0.08, 0.08], [0.08, -0.08], [-0.08, -0.08], [-0.08, 0.08], [0.0, 0.0], [0.08, -0.08]] },                          // Accountant
];
export const FELIS_AT = [0.95, 0.42];    // sky-local position (scope view units) of Felis' centre

export function drawStarChart({ note = [], names = [], W = 1536, H = 1024 } = {}) {
  const c = canvas(W, H), g = c.getContext('2d');
  const r = rng(91);
  // aged paper
  const gr = g.createRadialGradient(W * 0.5, H * 0.45, H * 0.1, W * 0.5, H * 0.5, W * 0.7);
  gr.addColorStop(0, '#efe0b8'); gr.addColorStop(0.7, '#dcc590'); gr.addColorStop(1, '#a98a52');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,60,20,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, rr = 20 + r() * 70;
    const s = g.createRadialGradient(x, y, 0, x, y, rr); s.addColorStop(0, 'rgba(120,80,30,0.12)'); s.addColorStop(1, 'rgba(120,80,30,0)');
    g.fillStyle = s; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const ink = '#2e1d0e';
  g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(24, 24, W - 48, H - 48);
  g.lineWidth = 1.5; g.strokeRect(36, 36, W - 72, H - 72);

  // --- star map (left), a circular plate
  const mx = W * 0.33, my = H * 0.52, mr = H * 0.42;
  g.save();
  g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(30,40,80,0.10)'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(46,29,14,0.35)'; g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(mx, my, (mr * k) / 4, 0, Math.PI * 2); g.stroke(); }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(a) * mr, my + Math.sin(a) * mr); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = ink; g.beginPath(); g.arc(mx + (r() - 0.5) * 2 * mr, my + (r() - 0.5) * 2 * mr, 0.8 + Math.pow(r(), 3) * 3.2, 0, 7); g.fill(); }
  const sc = mr * 0.62; // sky units → px
  const toPx = ([x, y], at) => [mx + (at[0] + x) * sc, my - (at[1] + y) * sc];
  const drawConst = (pts, at, lw = 2) => {
    g.strokeStyle = ink; g.lineWidth = lw; g.setLineDash([6, 5]);
    g.beginPath(); pts.forEach((p, i) => { const [x, y] = toPx(p, at); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.setLineDash([]);
    for (const p of pts) { const [x, y] = toPx(p, at); g.fillStyle = ink; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
  };
  // chart is a reduced map: positions scaled into the plate
  const shrink = (o) => [o[0] * 0.55, o[1] * 0.55];
  OTHERS.forEach((o) => {
    const at = shrink(o.at);
    drawConst(o.pts.map(([x, y]) => [x * 0.6, y * 0.6]), at, 1.5);
    if (names[o.name]) {
      g.font = `italic ${Math.round(H * 0.022)}px ${SERIF}`; g.fillStyle = ink; g.textAlign = 'center';
      const [x, y] = toPx([0, -0.13], at);
      g.fillText(names[o.name].replace(/\.$/, '').split(/[,.]/)[0], x, y);
    }
  });
  const fat = shrink(FELIS_AT);
  drawConst([...FELIS, ...FELIS_TAIL].map(([x, y]) => [x * 0.6, y * 0.6]), fat, 2.2);
  g.restore();
  g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.stroke();
  // Felis label + two circles (one in red ink, one shakier)
  const [fx, fy] = toPx([0, 0.02], fat);
  g.font = `700 italic ${Math.round(H * 0.034)}px ${SERIF}`; g.fillStyle = ink; g.textAlign = 'center';
  g.fillText('Felis', fx, fy + sc * 0.22);
  g.strokeStyle = '#8a1a14'; g.lineWidth = 4;
  g.beginPath(); g.ellipse(fx, fy + 6, sc * 0.21, sc * 0.2, 0.1, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.ellipse(fx + 4, fy + 2, sc * 0.235, sc * 0.215, -0.15, 0.2, Math.PI * 2.05); g.stroke();
  // little crescent moon under Felis
  const [qx, qy] = toPx([0.0, -0.17], fat);
  g.fillStyle = ink; g.beginPath(); g.arc(qx, qy, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e6d3a2'; g.beginPath(); g.arc(qx + 5, qy - 3, 10, 0, Math.PI * 2); g.fill();

  // --- the note and the diagram (right)
  const nx = W * 0.78;
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `italic ${Math.round(H * 0.042)}px ${SERIF}`;
  note.slice(0, 2).forEach((line, i) => g.fillText(line, nx, H * 0.14 + i * H * 0.055));
  drawRings(g, nx, H * 0.55, H * 0.2, { ink, planet: '#8a1a14', sun: '#b07a18', lw: 3 });
  g.font = `${Math.round(H * 0.03)}px ${SERIF}`;
  note.slice(2, 5).forEach((line, i) => g.fillText(line, nx, H * 0.84 + i * H * 0.042));
  return c;
}

// ---------------------------------------------------------------------------------------------
// Orrery dial face (top view; canvas top = north = twelve o'clock)
// ---------------------------------------------------------------------------------------------
export function drawDial(S = 1024) {
  const c = canvas(S, S), g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S * 0.49;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  gr.addColorStop(0, '#1d2a5a'); gr.addColorStop(0.8, '#121b3e'); gr.addColorStop(1, '#0b1028');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const r = rng(12);
  for (let i = 0; i < 400; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.95; g.fillStyle = `rgba(255,236,190,${0.2 + r() * 0.6})`; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.6 + r() * 1.6, 0, 7); g.fill(); }
  g.strokeStyle = '#d9b45a'; g.fillStyle = '#e8c56a';
  g.lineWidth = S * 0.006; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, Math.PI * 2); g.stroke();
  g.lineWidth = S * 0.003; g.beginPath(); g.arc(cx, cy, R * 0.84, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    const r0 = R * 0.84, r1 = R * (big ? 0.93 : 0.88);
    g.lineWidth = S * (big ? 0.006 : 0.0025);
    g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke();
  }
  const NUM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  NUM.forEach((t, i) => {
    const a = (i / 12) * Math.PI * 2, rr = R * 0.765;
    // final: bigger, brighter quarter numerals with a dark outline so XII/III/VI/IX read against the sun's glow
    const major = i % 3 === 0;
    g.font = `700 ${Math.round(S * (major ? 0.074 : 0.046))}px ${SERIF}`;
    g.save(); g.translate(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr); g.rotate(a);
    g.lineJoin = 'round'; g.lineWidth = S * (major ? 0.012 : 0.008); g.strokeStyle = '#070b1e'; g.strokeText(t, 0, 0);
    g.fillStyle = major ? '#ffe7a6' : '#f0d283'; g.fillText(t, 0, 0); g.restore();
  });
  return c;
}

// ---------------------------------------------------------------------------------------------
// Dome interior paint: deep ultramarine with faint gilt stars
// ---------------------------------------------------------------------------------------------
export function drawDomePaint(W = 2048, H = 1024) {
  const c = canvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1a2550'); gr.addColorStop(1, '#0f1636');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const r = rng(3);
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${20 + r() * 30},${30 + r() * 30},${70 + r() * 40},0.25)`; g.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 6); }
  for (let i = 0; i < 420; i++) {
    const x = r() * W, y = r() * H * 0.95, s = 2 + Math.pow(r(), 3) * 9;
    g.fillStyle = `rgba(226,190,110,${0.35 + r() * 0.5})`;
    g.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? s * 0.4 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  return c;
}
