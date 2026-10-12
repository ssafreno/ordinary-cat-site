// ENDING — small hero props: the parcel (opens), the book (readable title), a quill, the opened sardine tin.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as T from '../../engine/props/textures.js';

export const BOOK_TITLE = 'Transfiguration Reversal for the Terminally Confident';
const SERIF = '"Cormorant Garamond", "Iowan Old Style", Palatino, Georgia, serif';

// ---------------------------------------------------------------------------------------------
// kraft paper
// ---------------------------------------------------------------------------------------------
let kraftTex = null;
function kraftTexture() {
  if (kraftTex) return kraftTex;
  const S = 512, c = T.makeCanvas(S, S), g = c.getContext('2d'), r = T.rng(19);
  g.fillStyle = '#b48a58'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, l = 4 + r() * 18, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(90,60,30,0.10)' : 'rgba(230,200,150,0.10)';
    g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // a couple of creases
  for (let i = 0; i < 5; i++) {
    const y = r() * S;
    const gr = g.createLinearGradient(0, y - 6, 0, y + 6);
    gr.addColorStop(0, 'rgba(255,235,200,0)'); gr.addColorStop(0.5, 'rgba(255,235,200,0.18)'); gr.addColorStop(0.55, 'rgba(70,45,20,0.2)'); gr.addColorStop(1, 'rgba(70,45,20,0)');
    g.save(); g.translate(S / 2, y); g.rotate((r() - 0.5) * 0.5); g.translate(-S / 2, -y);
    g.fillStyle = gr; g.fillRect(-50, y - 6, S + 100, 12); g.restore();
  }
  kraftTex = T.canvasTexture(c);
  return kraftTex;
}
const kraft = () => new THREE.MeshStandardMaterial({ map: kraftTexture(), roughness: 0.9, side: THREE.DoubleSide });

// ---------------------------------------------------------------------------------------------
// the parcel
// ---------------------------------------------------------------------------------------------
/**
 * Parcel, origin at the bottom centre, top +Y, label facing the viewer when the parcel is held flat.
 * userData: { flaps:[L,R], strings, seal, label, signature(k 0..1), open(ctx) → Promise, popSeal(ctx) → Promise, book (Group|null) }
 */
export function makeParcel() {
  const g = new THREE.Group(); g.name = 'endingParcel';
  const W = 0.34, D = 0.25, H = 0.11, t = 0.006;
  const km = kraft();
  const inner = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.95 });
  // open box: bottom + walls (outer kraft, darker interior)
  const add = (w, h, d, x, y, z, m = km) => { const b = F.rbox(w, h, d, m, 0.002); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  add(W, t, D, 0, t / 2, 0);
  add(W, H, t, 0, H / 2, D / 2 - t / 2);
  add(W, H, t, 0, H / 2, -D / 2 + t / 2);
  add(t, H, D, W / 2 - t / 2, H / 2, 0);
  add(t, H, D, -W / 2 + t / 2, H / 2, 0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * t, D - 2 * t), inner);
  floor.rotation.x = -Math.PI / 2; floor.position.y = t + 0.001; g.add(floor);
  // straw/tissue nest inside
  const tissue = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * t, D - 2 * t), new THREE.MeshStandardMaterial({ color: '#d9c9a8', roughness: 1 }));
  tissue.rotation.x = -Math.PI / 2; tissue.position.y = t + 0.003; g.add(tissue);

  // two top flaps hinged on the long edges (x = ±W/2)
  const flaps = [1, -1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set((W / 2) * s, H, 0);
    const flap = F.rbox(W / 2 + 0.004, 0.004, D + 0.006, km, 0.0015);
    flap.position.set((-W / 4) * s, 0.002, 0); flap.castShadow = true;
    pivot.add(flap);
    g.add(pivot);
    pivot.userData.side = s;
    return pivot;
  });

  // string: two bands crossing on top (they're attached to the box, they snap when the seal pops)
  const strings = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: '#d8c7a0', roughness: 0.9 });
  const band = (w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sm); strings.add(m); return m; };
  band(W + 0.008, 0.005, 0.01).position.set(0, H + 0.007, 0);
  band(0.01, 0.005, D + 0.012).position.set(0, H + 0.007, 0);
  for (const s of [1, -1]) { const m = band(0.01, H + 0.01, 0.004); m.position.set(0, H / 2, (D / 2 + 0.002) * s); }
  for (const s of [1, -1]) { const m = band(0.004, H + 0.01, 0.01); m.position.set((W / 2 + 0.002) * s, H / 2, 0); }
  // bow
  for (const s of [1, -1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 18), sm);
    loop.position.set(0.024 * s, H + 0.012, 0.0); loop.rotation.set(Math.PI / 2, 0, 0); loop.scale.set(1, 0.55, 1);
    strings.add(loop);
  }
  g.add(strings);

  // wax seal on top of the crossing
  const sealC = T.makeCanvas(128, 128), sg = sealC.getContext('2d');
  sg.fillStyle = '#9b1c1c'; sg.fillRect(0, 0, 128, 128);
  sg.strokeStyle = '#5e0e0e'; sg.lineWidth = 5; sg.beginPath(); sg.arc(64, 64, 44, 0, Math.PI * 2); sg.stroke();
  sg.fillStyle = '#5e0e0e'; sg.font = `700 54px ${SERIF}`; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('Q', 64, 68);
  const sealMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.canvasTexture(sealC), roughness: 0.35, metalness: 0.0 });
  const seal = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.037, 0.01, 22), [new THREE.MeshStandardMaterial({ color: '#8a1616', roughness: 0.4 }), sealMat, sealMat]);
  blob.castShadow = true;
  seal.add(blob);
  seal.position.set(0, H + 0.014, 0);
  g.add(seal);

  // shipping label on the right flap (front half, so it reads when held)
  const LW = 0.15, LH = 0.09;
  const lc = T.makeCanvas(600, 360), lg = lc.getContext('2d');
  const labelTex = T.canvasTexture(lc);
  const sigPts = [];
  {
    // a pre-computed signature path: "B. Quince" as a flourish (normalised 0..1 coords)
    const rr = T.rng(3);
    let x = 0.08;
    for (let i = 0; i < 140; i++) {
      const k = i / 139;
      x = 0.08 + k * 0.82;
      const loop = Math.sin(k * 38) * 0.08 * (1 - Math.abs(k - 0.35) * 0.8) + Math.sin(k * 9) * 0.05;
      const y = 0.5 + loop + (k < 0.12 ? -0.12 * Math.sin(k / 0.12 * Math.PI) : 0) + (rr() - 0.5) * 0.008;
      sigPts.push([x + Math.cos(k * 38) * 0.02, y]);
    }
    // the closing underline flourish
    for (let i = 0; i < 30; i++) { const k = i / 29; sigPts.push([0.9 - k * 0.75, 0.74 + Math.sin(k * Math.PI) * 0.06]); }
  }
  let sigK = 0;
  const drawLabel = () => {
    const w = 600, h = 360;
    lg.fillStyle = '#efe3c4'; lg.fillRect(0, 0, w, h);
    lg.strokeStyle = '#7a1c1c'; lg.lineWidth = 6; lg.strokeRect(12, 12, w - 24, h - 24);
    lg.fillStyle = '#7a1c1c'; lg.font = `600 26px ${SERIF}`; lg.textAlign = 'center';
    lg.fillText('PENNYWHISTLE & DAUGHTERS · ARCANE DELIVERIES', w / 2, 52);
    lg.fillStyle = '#2b1a10'; lg.font = `700 52px ${SERIF}`;
    lg.fillText('B. QUINCE — THE TOWER', w / 2, 120);
    lg.font = `italic 600 34px ${SERIF}`;
    lg.fillText('Handle with thumbs.', w / 2, 168);
    lg.strokeStyle = '#2b1a10'; lg.lineWidth = 2;
    lg.beginPath(); lg.moveTo(70, 300); lg.lineTo(w - 70, 300); lg.stroke();
    lg.font = `500 22px ${SERIF}`; lg.textAlign = 'left'; lg.fillText('signature', 72, 326);
    // signature in ink, drawn up to sigK
    const n = Math.floor(sigPts.length * sigK);
    if (n > 1) {
      lg.strokeStyle = '#1d2a5a'; lg.lineWidth = 4; lg.lineCap = 'round'; lg.lineJoin = 'round';
      lg.beginPath();
      for (let i = 0; i < n; i++) {
        const [px, py] = sigPts[i];
        const X = 80 + px * (w - 160), Y = 200 + py * 120;
        i ? lg.lineTo(X, Y) : lg.moveTo(X, Y);
      }
      lg.stroke();
    }
    labelTex.needsUpdate = true;
  };
  drawLabel();
  const label = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.85 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(-W / 4, 0.0045, 0.045); // centred on the +X flap, toward the front edge
  flaps[0].add(label);

  g.userData = {
    flaps, strings, seal, label,
    signature(k) { sigK = THREE.MathUtils.clamp(k, 0, 1); drawLabel(); },
    size: { W, D, H },
  };
  return g;
}

// ---------------------------------------------------------------------------------------------
// the book
// ---------------------------------------------------------------------------------------------
/**
 * The book, standing upright, front cover facing +Z, origin at its centre.
 * userData: { cover (Mesh), glow (Mesh additive halo), w, h, d }
 */
export function makeBook() {
  const g = new THREE.Group(); g.name = 'endingBook';
  const w = 0.22, h = 0.3, d = 0.045;
  const leather = new THREE.MeshStandardMaterial({ color: '#2a4a38', roughness: 0.55, map: T.noiseTexture({ scale: 40, seed: 61, contrast: 0.35, bias: 0.8 }) });
  const pages = new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.9 });
  // boards + spine
  const front = F.rbox(w, h, 0.006, leather, 0.002); front.position.z = d / 2 - 0.003; g.add(front);
  const back = F.rbox(w, h, 0.006, leather, 0.002); back.position.z = -d / 2 + 0.003; g.add(back);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 16, 1, false, Math.PI, Math.PI), leather);
  spine.position.x = -w / 2; g.add(spine);
  const block = F.rbox(w - 0.012, h - 0.012, d - 0.012, pages, 0.002); block.position.x = 0.004; g.add(block);
  // gilt corners
  const gilt = M.gold({ polished: true });
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const c = F.rbox(0.03, 0.03, 0.008, gilt, 0.002);
    c.position.set(sx * (w / 2 - 0.014), sy * (h / 2 - 0.014), d / 2 + 0.001);
    g.add(c);
  }

  // cover art: crisp, readable title
  const cw = 880, ch = 1200, c = T.makeCanvas(cw, ch), cg = c.getContext('2d');
  const bg = cg.createRadialGradient(cw / 2, ch * 0.42, 40, cw / 2, ch / 2, cw);
  bg.addColorStop(0, '#2f5642'); bg.addColorStop(1, '#16291f');
  cg.fillStyle = bg; cg.fillRect(0, 0, cw, ch);
  const goldGrad = () => { const gg = cg.createLinearGradient(0, 0, cw, ch); gg.addColorStop(0, '#f7dc8c'); gg.addColorStop(0.5, '#d4a640'); gg.addColorStop(1, '#f3d283'); return gg; };
  cg.strokeStyle = goldGrad(); cg.lineWidth = 10; cg.strokeRect(46, 46, cw - 92, ch - 92);
  cg.lineWidth = 3; cg.strokeRect(70, 70, cw - 140, ch - 140);
  // corner flourishes
  for (const [x, y] of [[70, 70], [cw - 70, 70], [70, ch - 70], [cw - 70, ch - 70]]) {
    cg.beginPath(); cg.arc(x, y, 22, 0, Math.PI * 2); cg.stroke();
  }
  cg.fillStyle = goldGrad(); cg.textAlign = 'center'; cg.textBaseline = 'middle';
  cg.shadowColor = 'rgba(0,0,0,0.55)'; cg.shadowBlur = 6; cg.shadowOffsetY = 3;
  const lines = [['TRANSFIGURATION', 600, 84, 250], ['REVERSAL', 600, 108, 360], ['for the', 'italic 500', 64, 470], ['Terminally', 'italic 600', 110, 570], ['Confident', 'italic 600', 110, 690]];
  for (const [txt, weight, size, y] of lines) {
    cg.font = `${weight} ${size}px ${SERIF}`;
    let s = size;
    while (cg.measureText(txt).width > cw - 190 && s > 30) { s -= 2; cg.font = `${weight} ${s}px ${SERIF}`; }
    cg.fillText(txt, cw / 2, y);
  }
  cg.shadowBlur = 0; cg.shadowOffsetY = 0;
  // a little cat-eye ornament
  cg.strokeStyle = goldGrad(); cg.lineWidth = 5;
  cg.beginPath(); cg.ellipse(cw / 2, 860, 70, 34, 0, 0, Math.PI * 2); cg.stroke();
  cg.beginPath(); cg.ellipse(cw / 2, 860, 10, 32, 0, 0, Math.PI * 2); cg.fillStyle = goldGrad(); cg.fill();
  cg.beginPath(); cg.moveTo(cw / 2 - 160, 860); cg.lineTo(cw / 2 - 90, 860); cg.moveTo(cw / 2 + 90, 860); cg.lineTo(cw / 2 + 160, 860); cg.stroke();
  cg.font = `600 40px ${SERIF}`; cg.fillStyle = goldGrad();
  cg.fillText('— Second Edition, Revised —', cw / 2, 1010);
  const coverTex = T.canvasTexture(c);
  coverTex.anisotropy = 8;
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.006, h - 0.006), new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: coverTex, emissiveIntensity: 0.18 }));
  cover.position.z = d / 2 + 0.0005;
  g.add(cover);
  // soft halo behind (shown while it floats)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2.6, h * 2.2), new THREE.MeshBasicMaterial({ map: haloTexture(), color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.position.z = -d / 2 - 0.02;
  g.add(halo);
  g.traverse((o) => { if (o.isMesh && o !== halo) o.castShadow = true; });
  g.userData = { cover, halo, w, h, d };
  return g;
}

let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const S = 256, c = T.makeCanvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  haloTex = T.canvasTexture(c);
  return haloTex;
}

// ---------------------------------------------------------------------------------------------
// quill
// ---------------------------------------------------------------------------------------------
/** A quill, origin at the nib, feather pointing +Y. */
export function makeQuill() {
  const g = new THREE.Group(); g.name = 'endingQuill';
  const vc = T.makeCanvas(64, 256), vg = vc.getContext('2d');
  const gr = vg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#f4ecdd'); gr.addColorStop(1, '#d8cbb4');
  vg.fillStyle = gr; vg.fillRect(0, 0, 64, 256);
  vg.strokeStyle = 'rgba(120,100,80,0.35)'; vg.lineWidth = 1;
  for (let y = 0; y < 256; y += 5) { vg.beginPath(); vg.moveTo(32, y); vg.lineTo(0, y - 14); vg.moveTo(32, y); vg.lineTo(64, y - 14); vg.stroke(); }
  vg.strokeStyle = '#bfae90'; vg.lineWidth = 3; vg.beginPath(); vg.moveTo(32, 0); vg.lineTo(32, 256); vg.stroke();
  const vane = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ map: T.canvasTexture(vc), roughness: 0.8, side: THREE.DoubleSide }));
  vane.scale.set(0.022, 0.11, 0.003); vane.position.y = 0.15; vane.rotation.z = 0.08;
  g.add(vane);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0015, 0.26, 6), M.matte('#e8dcc4'));
  shaft.position.y = 0.13; g.add(shaft);
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.02, 8), M.matte('#1d1a20', { roughness: 0.3 }));
  nib.rotation.x = Math.PI; nib.position.y = 0.0; g.add(nib);
  return g;
}

// ---------------------------------------------------------------------------------------------
// the opened sardine tin
// ---------------------------------------------------------------------------------------------
export function makeSardineTin() {
  const g = new THREE.Group(); g.name = 'endingTin';
  const tinM = new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.9, roughness: 0.3 });
  const W = 0.07, L = 0.12, H = 0.025;
  // body: rounded-rect tray (a squashed cylinder works well)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true), tinM);
  body.scale.set(L / 2, H, W / 2); body.position.y = H / 2; g.add(body);
  const base = new THREE.Mesh(new THREE.CircleGeometry(1, 32), tinM);
  base.rotation.x = -Math.PI / 2; base.scale.set(L / 2, W / 2, 1); base.position.y = 0.002; g.add(base);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), tinM);
  lip.rotation.x = Math.PI / 2; lip.scale.set(L / 2, W / 2, 0.06); lip.position.y = H; g.add(lip);
  // oil
  const oil = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: '#c79a3a', roughness: 0.08, metalness: 0.2, emissive: '#5a3a08', emissiveIntensity: 0.4 }));
  oil.rotation.x = -Math.PI / 2; oil.scale.set(L / 2 - 0.004, W / 2 - 0.004, 1); oil.position.y = H * 0.7; g.add(oil);
  // three sardines (one partly eaten, naturally)
  const fishM = new THREE.MeshStandardMaterial({ color: '#8fa3b8', metalness: 0.6, roughness: 0.3 });
  for (let i = 0; i < 2; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.075 - i * 0.025, 4, 8), fishM);
    f.rotation.z = Math.PI / 2; f.position.set(i * 0.006, H * 0.78, -0.012 + i * 0.022); g.add(f);
  }
  // peeled lid rolled back on its key
  const lidGeo = new THREE.CylinderGeometry(0.014, 0.014, W * 0.95, 20, 1, true, 0, Math.PI * 1.6);
  const lid = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({ color: '#d6c27a', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
  lid.rotation.x = Math.PI / 2; lid.position.set(L / 2 + 0.01, H + 0.012, 0); g.add(lid);
  const key = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.002, 6, 16), tinM);
  key.position.set(L / 2 + 0.01, H + 0.012, W / 2 + 0.012); g.add(key);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
