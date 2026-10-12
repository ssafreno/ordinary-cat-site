// R2-P1 — the brass pipe apparatus: a 3×3 grid of rotatable pipe segments on the north wall.
// Gas enters at the left edge (middle row) and must reach the outlet on the right edge (bottom row).
//
// Directions: 0=N 1=E 2=S 3=W. A piece's base openings rotate clockwise by k quarter-turns: d → (d+k)%4.
//   straight base = N,S     elbow base = N,E
// Intended (unique) path:  in → (1,0) W-N → (0,0) S-E → (0,1) W-E → (0,2) W-S → (1,2) N-S → (2,2) N-E → out
// Decoys: (1,1) elbow, (2,0) elbow, (2,1) straight. The alternative route along the bottom dead-ends (see notes).
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { makeTextPlane } from '../../engine/props/text.js';
import { tube, mergeInto } from './util.js';

export const TYPES = [
  ['elbow', 'straight', 'elbow'],
  ['elbow', 'elbow', 'straight'],
  ['elbow', 'straight', 'elbow'],
];
export const START = [3, 0, 0, 1, 1, 1, 0, 0, 2];
const INLET = { r: 1, d: 3 };
const OUTLET = { r: 2, d: 1 };
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];

export function openings(type, k) {
  const base = type === 'straight' ? [0, 2] : [0, 1];
  return base.map((d) => (d + k) % 4);
}

/** Cells reachable from the inlet, and whether the outlet is reached. */
export function trace(rot) {
  const open = (r, c) => openings(TYPES[r][c], rot[r * 3 + c]);
  const reached = new Set();
  let solved = false;
  if (!open(INLET.r, 0).includes(INLET.d)) return { reached, solved };
  const q = [[INLET.r, 0]];
  reached.add(INLET.r * 3);
  while (q.length) {
    const [r, c] = q.shift();
    for (const d of open(r, c)) {
      if (r === OUTLET.r && c === 2 && d === OUTLET.d) solved = true;
      const nr = r + DR[d], nc = c + DC[d];
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      if (!open(nr, nc).includes((d + 2) % 4)) continue;
      const id = nr * 3 + nc;
      if (!reached.has(id)) { reached.add(id); q.push([nr, nc]); }
    }
  }
  return { reached, solved };
}

const CELL = 0.27;
export const PANEL = { x: 1.45, y: 1.55, z: -3.47 };

export function buildValves(room) {
  const { ctx } = room;
  const { state, hotspots } = ctx;
  const G = room.group;
  const panel = new THREE.Group(); panel.name = 'apparatus';
  panel.position.set(PANEL.x, PANEL.y, PANEL.z);
  G.add(panel);

  const brass = M.brass({ color: '#b8913e' });
  const brassDark = M.brass({ color: '#7a5e26', roughness: 0.45 });
  const iron = M.iron({ color: '#242322' });
  // backing plate + frame
  const plate = F.rbox(1.0, 1.08, 0.04, brassDark, 0.02); plate.position.z = 0.02; panel.add(plate);
  const inset = F.rbox(0.86, 0.86, 0.02, iron, 0.01); inset.position.set(0, 0, 0.045); panel.add(inset);
  const rivets = [];
  for (let i = 0; i < 10; i++) for (const [x, y] of [[-0.47 + i * 0.104, 0.51], [-0.47 + i * 0.104, -0.51]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5)); s.position.set(x, y, 0.045); rivets.push(s); }
  for (let i = 1; i < 9; i++) for (const x of [-0.47, 0.47]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5)); s.position.set(x, -0.51 + i * 0.1133, 0.045); rivets.push(s); }
  panel.add(mergeInto(rivets, brass));

  // cell tiles (recessed sockets)
  const sockets = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.115, 0.012, 32)); s.rotation.x = Math.PI / 2; s.position.set((c - 1) * CELL, (1 - r) * CELL, 0.058); sockets.push(s);
  }
  panel.add(mergeInto(sockets, M.iron({ color: '#3a3632', roughness: 0.5 })));

  // pieces
  const pieceMats = [];
  const pieces = [];
  const rot = state.get('room2.valves.rot', START.slice());
  const R = 0.026;
  const straightGeo = new THREE.CylinderGeometry(R, R, CELL, 14);
  const elbowGeo = new THREE.TorusGeometry(CELL / 2, R, 12, 18, Math.PI / 2);
  const flangeGeo = new THREE.CylinderGeometry(R * 1.35, R * 1.35, 0.014, 14);
  const hubGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.03, 20);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const i = r * 3 + c;
    const mat = new THREE.MeshStandardMaterial({ color: '#c47a48', metalness: 1, roughness: 0.3, emissive: '#000000' });
    pieceMats.push(mat);
    const cell = new THREE.Group(); cell.position.set((c - 1) * CELL, (1 - r) * CELL, 0.09);
    const rotG = new THREE.Group(); cell.add(rotG);
    const type = TYPES[r][c];
    const flanges = [];
    if (type === 'straight') {
      const m = new THREE.Mesh(straightGeo, mat); rotG.add(m);
      for (const y of [-CELL / 2 + 0.012, CELL / 2 - 0.012]) { const f = new THREE.Mesh(flangeGeo, brass); f.position.y = y; rotG.add(f); flanges.push(f); }
    } else {
      const m = new THREE.Mesh(elbowGeo, mat); m.position.set(CELL / 2, CELL / 2, 0); m.rotation.z = Math.PI; rotG.add(m);
      const f1 = new THREE.Mesh(flangeGeo, brass); f1.position.set(0, CELL / 2 - 0.012, 0); rotG.add(f1);
      const f2 = new THREE.Mesh(flangeGeo, brass); f2.rotation.z = Math.PI / 2; f2.position.set(CELL / 2 - 0.012, 0, 0); rotG.add(f2);
    }
    const hub = new THREE.Mesh(hubGeo, brass); hub.rotation.x = Math.PI / 2; hub.position.z = 0.03;
    // hub sits on the pipe centre for straights; for elbows on the bend
    if (type === 'elbow') hub.position.set(0.04, 0.04, 0.03);
    rotG.add(hub);
    F.shadowAll(rotG);
    rotG.rotation.z = -rot[i] * Math.PI / 2;
    panel.add(cell);
    const proxy = hotspots.proxyBox(CELL * 0.95, CELL * 0.95, 0.08); cell.add(proxy);
    pieces.push({ r, c, i, cell, rotG, proxy, mat });
  }

  // inlet / outlet stubs on the panel edge
  const cu = M.copper({ polished: true });
  const inletStub = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.12, 12), cu); inletStub.rotation.z = Math.PI / 2; inletStub.position.set(-1.5 * CELL - 0.04, 0, 0.09); panel.add(inletStub);
  const outletStub = inletStub.clone(); outletStub.position.set(1.5 * CELL + 0.04, -CELL, 0.09); panel.add(outletStub);
  const tagIn = makeTextPlane('GAS IN', { width: 0.12, font: '700 48px "Cormorant Garamond", Georgia, serif', color: '#2a1a08', bg: '#c9a24a', padding: 10 });
  tagIn.position.set(-0.37, 0.12, 0.06); panel.add(tagIn);
  const tagOut = makeTextPlane('BURNER', { width: 0.12, font: '700 48px "Cormorant Garamond", Georgia, serif', color: '#2a1a08', bg: '#c9a24a', padding: 10 });
  tagOut.position.set(0.37, -0.42, 0.06); panel.add(tagOut);

  // gauge + three valve wheels on top
  const gauge = new THREE.Group(); gauge.position.set(-0.22, 0.62, 0.06);
  gauge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 32), brass).rotateX(Math.PI / 2));
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), new THREE.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.7 })); dial.position.z = 0.021; gauge.add(dial);
  for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.75 - (i / 8) * Math.PI * 1.5; const t = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.014), M.matte(i > 6 ? '#8a1a1a' : '#2a1a08')); t.position.set(Math.cos(a) * 0.058, Math.sin(a) * 0.058, 0.022); t.rotation.z = a - Math.PI / 2; gauge.add(t); }
  const needle = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.06), M.matte('#7a1010')); needle.geometry.translate(0, 0.028, 0); needle.position.z = 0.024; gauge.add(needle);
  const glassG = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), M.glass({ opacity: 0.15 })); glassG.position.z = 0.03; gauge.add(glassG);
  panel.add(gauge);
  needle.rotation.z = Math.PI * 0.75;
  needle.userData.dynamic = true;
  const wheels = [];
  for (let i = 0; i < 3; i++) {
    const wg = new THREE.Group(); wg.position.set(0.02 + i * 0.16, 0.66, 0.1);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), brass); stem.rotation.x = Math.PI / 2; stem.position.z = -0.05; wg.add(stem);
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 24), M.iron({ color: '#7a2a1a', roughness: 0.4 })));
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 6), M.iron({ color: '#7a2a1a', roughness: 0.4 })); sp.rotation.z = k * Math.PI / 4; wheel.add(sp); }
    wheel.userData.dynamic = true;
    wg.add(wheel);
    // pipe stub from the top of the panel to each wheel
    const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), cu); pp.position.set(0, -0.08, -0.05); wg.add(pp);
    F.shadowAll(wg);
    panel.add(wg);
    wheels.push(wheel);
  }
  const wheelsProxy = hotspots.proxyBox(0.5, 0.16, 0.12); wheelsProxy.position.set(0.18, 0.66, 0.1); panel.add(wheelsProxy);

  // external piping: tank → inlet, outlet → floor → burner
  const wp = (x, y, z) => [PANEL.x + x, PANEL.y + y, PANEL.z + z];
  G.add(tube([wp(-1.5 * CELL - 0.1, 0, 0.09), wp(-0.62, 0, 0.09), wp(-0.82, -0.12, 0.2), [0.6, 1.2, -3.25], [0.55, 0.98, -3.15]], 0.026, cu, { segments: 80, tension: 0.4 }));
  const outPts = [wp(1.5 * CELL + 0.1, -CELL, 0.09), wp(0.66, -CELL, 0.09), wp(0.78, -CELL - 0.15, 0.1), [PANEL.x + 0.8, 0.5, PANEL.z + 0.1], [PANEL.x + 0.8, 0.08, PANEL.z + 0.14],
    [PANEL.x + 0.65, 0.04, PANEL.z + 0.5], [1.4, 0.04, -1.8], [0.55, 0.04, -0.9], [0.32, 0.12, -0.7], [0.05 + -0.15, 0.12, -0.65]];
  G.add(tube(outPts, 0.022, cu, { segments: 160, tension: 0.35 }));
  // pipe clamps on the wall run
  for (const y of [0.9, 0.35]) { const cl = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), M.iron()); cl.position.set(PANEL.x + 0.8, y, PANEL.z + 0.1); cl.rotation.x = Math.PI / 2; G.add(cl); }

  // ---------------------------------------------------------------- logic
  const glowCol = new THREE.Color('#2a6aff');
  const idleCol = new THREE.Color('#5a2a12');
  const refresh = () => {
    const { reached, solved } = trace(rot);
    pieces.forEach((p) => {
      const on = reached.has(p.i);
      // QA: unlit pieces were near-black against the dark inset; a faint warm self-glow keeps their shapes readable
      p.mat.emissive.copy(on ? glowCol : idleCol);
      p.mat.emissiveIntensity = on ? (solved ? 0.9 : 0.45) : 0.55;
    });
    const frac = reached.size / 6;
    ctx.tween.to(needle.rotation, { z: Math.PI * 0.75 - Math.min(1, solved ? 0.92 : frac * 0.55) * Math.PI * 1.5 }, { duration: 0.5, ease: 'outBack' });
    return solved;
  };
  refresh();

  const focus = () => ctx.camera.focus({ position: [PANEL.x, PANEL.y + 0.02, PANEL.z + 1.2], lookAt: [PANEL.x, PANEL.y, PANEL.z], scope: 'focus:r2.valves', onExit: () => ctx.dialogue.hideCaption() });
  hotspots.add({
    id: 'r2.apparatus', object: panel, label: 'Brass pipe apparatus',
    onClick: () => focus(),
  });
  hotspots.add({
    id: 'r2.valvewheels', object: wheelsProxy, label: 'Valve wheels', scope: ['room', 'focus:r2.valves'],
    onClick: () => {
      wheels.forEach((w, i) => ctx.tween.to(w.rotation, { z: w.rotation.z + Math.PI * (0.5 + i * 0.25) }, { duration: 0.6, ease: 'outBack', delay: i * 0.08 }));
      ctx.audio.play('ratchet', { gain: 0.6, pitch: 0.8 });
      ctx.dialogue.caption('caption.r2.valvewheels');
    },
  });
  let busy = false;
  pieces.forEach((p) => {
    hotspots.add({
      id: `r2.pipe${p.i}`, object: p.cell, highlight: p.rotG, label: 'Pipe segment', scope: 'focus:r2.valves',
      enabled: () => !state.isSolved('valves'),
      onClick: () => {
        if (busy) return;
        rot[p.i] = (rot[p.i] + 1) % 4;
        ctx.audio.play('ratchet');
        ctx.tween.to(p.rotG.rotation, { z: p.rotG.rotation.z - Math.PI / 2 }, { duration: 0.22, ease: 'outBack' });
        state.set('room2.valves.rot', rot.slice());
        if (refresh() && !state.isSolved('valves')) {
          busy = true;
          room.onValvesSolved().finally(() => { busy = false; });
        }
      },
    });
  });

  return {
    panel, refresh,
    setSolvedVisual() { refresh(); },
  };
}
