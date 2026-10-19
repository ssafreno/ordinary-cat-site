// R2-P3 — the glass display case on the bench, with a balance scale for a lid, plus the little chest of drawers.
// Left pan: fixed brass owl (7). Right pan: the player's weights. Level at exactly 7 → the case opens.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import { makeTextPlane } from '../../engine/props/text.js';
import { BENCH } from './set.js';
import { physGlass, weightMesh, owlWeight } from './util.js';

export const WEIGHTS = { w1: 1, w2: 2, w4: 4, w8: 8 };
export const CASE = { x: BENCH.x + 0.06, z: 0.22 };
const CW = 0.5, CD = 0.34, CH = 0.3;
const PIVOT_Y = 0.72, ARM = 0.22, HANG = 0.21;
const SLOTS = [[-0.035, 0.012], [0.035, 0.012], [0.0, -0.035], [0.0, 0.05]];

export function buildCase(room) {
  const { ctx } = room;
  const { state, hotspots } = ctx;
  const G = room.group;
  const root = new THREE.Group(); root.name = 'displayCase';
  root.position.set(CASE.x, BENCH.h, CASE.z); root.rotation.y = Math.PI / 2;
  G.add(root);
  const wood = M.walnut({ tint: '#3e2818' });
  const brass = M.brass({ color: '#c09a48', polished: true });
  const glassMat = physGlass({ color: '#eefcf8', opacity: 0.12 });

  const base = F.rbox(CW + 0.04, 0.05, CD + 0.04, wood, 0.01); base.position.y = 0.025; root.add(base);
  const cushion = F.rbox(CW - 0.04, 0.025, CD - 0.04, M.velvet({ color: '#1f4a36' }), 0.01); cushion.position.y = 0.062; root.add(cushion);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = F.rbox(0.018, CH, 0.018, brass, 0.004); post.position.set(sx * (CW / 2 - 0.005), 0.05 + CH / 2, sz * (CD / 2 - 0.005)); root.add(post);
  }
  const mkPane = (w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); m.castShadow = false; m.renderOrder = 2; m.userData.noRaycast = true; return m; };
  const back = mkPane(CW - 0.02, CH); back.position.set(0, 0.05 + CH / 2, -CD / 2 + 0.005); root.add(back);
  for (const s of [-1, 1]) { const p = mkPane(CD - 0.02, CH); p.rotation.y = Math.PI / 2; p.position.set(s * (CW / 2 - 0.005), 0.05 + CH / 2, 0); root.add(p); }
  // front door, hinged on the left (local -x)
  const door = new THREE.Group(); door.userData.dynamic = true; door.position.set(-CW / 2 + 0.01, 0.05, CD / 2 - 0.004); root.add(door);
  const dp = mkPane(CW - 0.03, CH - 0.01); dp.position.set((CW - 0.02) / 2, CH / 2, 0); door.add(dp);
  const dframeT = F.rbox(CW - 0.02, 0.012, 0.01, brass, 0.003); dframeT.position.set((CW - 0.02) / 2, CH - 0.006, 0.004); door.add(dframeT);
  const dframeB = dframeT.clone(); dframeB.position.y = 0.006; door.add(dframeB);
  const latch = F.rbox(0.02, 0.04, 0.012, brass, 0.004); latch.position.set(CW - 0.035, CH / 2, 0.01); door.add(latch);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), M.matte('#0a0604')); keyhole.position.set(CW - 0.035, CH / 2 + 0.006, 0.0165); door.add(keyhole);
  const lid = F.rbox(CW + 0.04, 0.035, CD + 0.04, wood, 0.01); lid.position.y = 0.05 + CH + 0.0175; root.add(lid);
  const lidTop = 0.05 + CH + 0.035;
  const trim = F.rbox(CW + 0.05, 0.01, CD + 0.05, brass, 0.003); trim.position.y = 0.05 + CH + 0.002; root.add(trim);
  const plaque = makeTextPlane('PROPERTY OF B. QUINCE · DO NOT TIP', { width: 0.26, font: '700 40px "Cormorant Garamond", Georgia, serif', color: '#2a1a08', bg: '#c9a24a', padding: 12 });
  plaque.position.set(0, 0.025, CD / 2 + 0.021); root.add(plaque);

  // jar of dawn salt inside
  const jar = F.jar({ r: 0.055, h: 0.14, contents: '#ff9a78', glow: 0.9, label: 'Dawn\nSalt', lid: 'brass', labelColor: '#f4e2c8' });
  jar.position.set(0.02, 0.075, -0.01); root.add(jar);
  const jarLight = new THREE.PointLight('#ffb090', 0.35, 0.8, 2); jarLight.position.set(0, 0.2, 0); root.add(jarLight);

  // ---- the balance on the lid
  const post = F.lathe([[0, 0], [0.05, 0], [0.05, 0.012], [0.025, 0.03], [0.012, 0.05], [0.01, PIVOT_Y - lidTop - 0.03], [0.018, PIVOT_Y - lidTop - 0.01], [0.012, PIVOT_Y - lidTop], [0, PIVOT_Y - lidTop]], brass, 20);
  post.position.y = lidTop; root.add(post);
  // fixed arc scale behind the needle
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 6, 24, Math.PI * 0.4), brass); arc.rotation.z = Math.PI * 0.3; arc.position.set(0, PIVOT_Y, -0.014); root.add(arc);
  const mid = F.rbox(0.004, 0.022, 0.004, M.matte('#7a1010'), 0.001); mid.position.set(0, PIVOT_Y + 0.105, -0.014); root.add(mid);
  const beam = new THREE.Group(); beam.position.y = PIVOT_Y; beam.userData.dynamic = true; root.add(beam);
  const bar = F.rbox(ARM * 2 + 0.02, 0.014, 0.012, brass, 0.004); beam.add(bar);
  for (const s of [-1, 1]) { const end = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), brass); end.position.x = s * (ARM + 0.012); beam.add(end); }
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.1, 6), M.matte('#2a1a08')); needle.position.y = 0.05; needle.position.z = -0.008; beam.add(needle);
  const hubB = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 14), brass); hubB.rotation.x = Math.PI / 2; beam.add(hubB);
  F.shadowAll(beam);

  const makePan = () => {
    const g = new THREE.Group(); g.userData.dynamic = true;
    const dish = F.lathe([[0, -HANG], [0.075, -HANG + 0.004], [0.088, -HANG + 0.018], [0.09, -HANG + 0.02], [0.08, -HANG + 0.012], [0, -HANG + 0.006]], brass, 28);
    g.add(dish);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const p = new THREE.Vector3(Math.cos(a) * 0.085, -HANG + 0.018, Math.sin(a) * 0.085);
      const len = p.length();
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, len, 4), M.iron({ color: '#5a5040' }));
      ch.position.copy(p).multiplyScalar(0.5);
      ch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
      g.add(ch);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12), brass); hook.position.y = -0.006; g.add(hook);
    F.shadowAll(g);
    const contents = new THREE.Group(); contents.position.y = -HANG + 0.01; g.add(contents);
    g.userData.contents = contents;
    root.add(g);
    return g;
  };
  const leftPan = makePan(), rightPan = makePan();
  const owl = owlWeight(); owl.scale.setScalar(0.85); leftPan.userData.contents.add(owl);
  const panProxy = hotspots.proxyBox(0.21, 0.012, 0.21); panProxy.position.y = -HANG + 0.006; rightPan.add(panProxy); // flat and below the weights' base (contents sit at -HANG+0.01) so a click on a placed weight takes it back instead of hitting the pan (release-qa)
  const owlProxy = hotspots.proxyBox(0.12, 0.14, 0.12); owlProxy.position.y = -HANG + 0.07; leftPan.add(owlProxy);

  // ---- state
  const placed = state.get('room2.scale.right', []).filter((id) => WEIGHTS[id]);
  const meshes = {};
  const sum = () => placed.reduce((a, id) => a + WEIGHTS[id], 0);
  let theta = 0, omega = 0;
  const targetTheta = () => THREE.MathUtils.clamp((7 - sum()) * 0.045, -0.24, 0.24);
  const solved = () => state.isSolved('scale');
  theta = solved() ? 0 : targetTheta();

  const layout = () => placed.forEach((id, i) => { const m = meshes[id]; const [x, z] = SLOTS[i % SLOTS.length]; m.position.set(x, 0, z); });
  const addMesh = (id) => {
    const m = weightMesh(WEIGHTS[id]);
    meshes[id] = m;
    rightPan.userData.contents.add(m);
    hotspots.add({
      id: `r2.placed.${id}`, object: m, label: `${ctx.items[id]?.name || 'Weight'} (take back)`, scope: ['room', 'focus:r2.case'],
      enabled: () => !solved(),
      onClick: () => removeWeight(id),
    });
    return m;
  };
  placed.forEach(addMesh);
  layout();

  const place = (id) => {
    if (solved() || placed.includes(id)) return;
    ctx.inventory.remove(id);
    placed.push(id);
    state.set('room2.scale.right', placed.slice());
    const m = addMesh(id);
    layout();
    const y0 = 0.12; m.position.y = y0;
    ctx.tween.to(m.position, { y: 0 }, { duration: 0.35, ease: 'outBounce' });
    ctx.audio.play('drop', { gain: 0.8, pitch: 1.6 - WEIGHTS[id] * 0.06 });
    omega -= 0.6 + WEIGHTS[id] * 0.15;
    room.onScaleChanged(sum(), id);
  };
  const removeWeight = (id) => {
    if (solved()) return;
    const i = placed.indexOf(id); if (i < 0) return;
    placed.splice(i, 1);
    state.set('room2.scale.right', placed.slice());
    const m = meshes[id]; delete meshes[id];
    hotspots.remove(`r2.placed.${id}`);
    ctx.inventory.add(id, { from: m });
    rightPan.userData.contents.remove(m);
    layout();
    ctx.audio.play('pickup');
    omega += 0.4;
    if (sum() === 7) room.onScaleChanged(sum(), null);
  };

  // polish: ~10% closer and a touch higher (was x + 0.82, y + 0.62, look at y + 0.38) so the stamped numerals on the pans read
  const focus = () => ctx.camera.focus({ position: [CASE.x + 0.74, BENCH.h + 0.68, CASE.z + 0.02], lookAt: [CASE.x, BENCH.h + 0.43, CASE.z], scope: 'focus:r2.case', onExit: () => ctx.dialogue.hideCaption() });
  const weightUse = {};
  for (const id of Object.keys(WEIGHTS)) weightUse[id] = () => { if (!ctx.camera.inFocus) focus(); place(id); };

  hotspots.add({
    id: 'r2.case', object: root, label: 'Glass display case',
    onClick: () => { focus(); if (!solved()) ctx.dialogue.caption('caption.case.locked'); },
    useItem: weightUse,
  });
  hotspots.add({
    id: 'r2.pan.right', object: rightPan, label: 'Right pan', scope: 'focus:r2.case',
    enabled: () => !solved(),
    onClick: () => ctx.dialogue.caption(placed.length ? 'caption.r2.pan.loaded' : 'caption.r2.pan'),
    useItem: weightUse,
  });
  hotspots.add({
    id: 'r2.owl', object: leftPan, label: 'Brass owl', scope: 'focus:r2.case',
    onClick: () => ctx.dialogue.caption('caption.r2.owl'),
    useItem: { '*': () => ctx.dialogue.caption('caption.r2.owl.full') },
  });
  hotspots.add({
    id: 'r2.case.jar', object: jar, label: () => (solved() ? 'Dawn Salt' : 'Jar behind glass'), scope: 'focus:r2.case',
    enabled: () => !state.get('room2.jar.dawn.taken'),
    onClick: () => {
      if (!solved()) { ctx.audio.play('error', { gain: 0.3 }); ctx.dialogue.caption('caption.case.locked'); return; }
      room.takeJar('dawn', jar);
    },
  });

  // ---- visuals from state
  const openDoor = (animate) => {
    if (!animate) { door.rotation.y = -1.9; return Promise.resolve(); }
    return ctx.tween.to(door.rotation, { y: -1.9 }, { duration: 1.1, ease: 'outBack' });
  };
  if (solved()) openDoor(false);
  if (state.get('room2.jar.dawn.taken')) { jar.visible = false; jarLight.intensity = 0; }

  root.userData.update = (dt) => {
    const tgt = solved() ? 0 : targetTheta();
    omega += ((tgt - theta) * 38 - omega * 4.2) * dt;
    theta += omega * dt;
    beam.rotation.z = theta;
    const c = Math.cos(theta), s = Math.sin(theta);
    leftPan.position.set(-ARM * c, PIVOT_Y - ARM * s, 0);
    rightPan.position.set(ARM * c, PIVOT_Y + ARM * s, 0);
  };

  return {
    root, jar, jarLight, sum, placed,
    async solve() {
      ctx.audio.play('unlock');
      P.burst(ctx, G, [CASE.x, BENCH.h + 0.3, CASE.z], { color: '#ffd9a0', count: 50, radius: 0.35 });
      await openDoor(true);
    },
    hideJar() { jar.visible = false; ctx.tween.to(jarLight, { intensity: 0 }, { duration: 0.4 }); },
  };
}

// ---------------------------------------------------------------------------------------------
// the small chest of drawers on the bench
// ---------------------------------------------------------------------------------------------
export function buildDrawers(room, { position }) {
  const { ctx } = room;
  const { state, hotspots } = ctx;
  const root = new THREE.Group(); root.name = 'smallDrawers';
  root.position.set(...position); root.rotation.y = Math.PI / 2;
  room.group.add(root);
  const W = 0.38, H = 0.33, D = 0.3;
  const wood = M.mahogany({ tint: '#5a2a1a' });
  const carcass = F.rbox(W, H, D, wood, 0.01); carcass.position.set(0, H / 2, -0.01); root.add(carcass);
  const topB = F.rbox(W + 0.03, 0.02, D + 0.03, wood, 0.006); topB.position.set(0, H + 0.01, -0.01); root.add(topB);
  const labels = ['ODDS', 'ENDS', 'SUNDRIES'];
  const open = state.get('room2.drawers', [false, false, false]);
  const drawers = [];
  for (let i = 0; i < 3; i++) {
    const dh = (H - 0.04) / 3;
    const g = new THREE.Group(); g.userData.dynamic = true; g.position.set(0, 0.02 + dh * (2 - i) + dh / 2, D / 2 - 0.005);
    const front = F.rbox(W - 0.04, dh - 0.012, 0.018, M.mahogany({ tint: '#6a3220' }), 0.004); g.add(front);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), M.brass()); knob.position.set(0, -0.008, 0.016); g.add(knob);
    const lbl = makeTextPlane(labels[i], { width: 0.07, font: '700 40px "Cormorant Garamond", Georgia, serif', color: '#2a1a08', bg: '#e9d7ad', padding: 8 });
    lbl.position.set(0, 0.016, 0.0095); g.add(lbl);
    // tray behind the front
    const trayB = F.rbox(W - 0.06, 0.006, D - 0.06, M.oak(), 0.002); trayB.position.set(0, -dh / 2 + 0.012, -(D - 0.06) / 2 - 0.01); g.add(trayB);
    for (const s of [-1, 1]) { const sd = F.rbox(0.006, dh - 0.03, D - 0.06, M.oak(), 0.002); sd.position.set(s * (W / 2 - 0.035), -0.004, -(D - 0.06) / 2 - 0.01); g.add(sd); }
    const interior = new THREE.Group(); interior.position.set(0, -dh / 2 + 0.015, -0.1); g.add(interior);
    F.shadowAll(g);
    root.add(g);
    const closedZ = g.position.z;
    if (open[i]) g.position.z = closedZ + 0.17;
    drawers.push({ g, closedZ, interior, i });
    hotspots.add({
      id: `r2.drawer${i}`, object: g, label: () => (open[i] ? 'Close drawer' : `Small drawer (${labels[i].toLowerCase()})`), scope: ['room', 'focus:r2.case', 'focus:r2.drawers'],
      onClick: () => {
        open[i] = !open[i];
        state.set('room2.drawers', open.slice());
        ctx.audio.play('drawerOpen', { gain: 0.7, pitch: 1.3 });
        ctx.tween.to(g.position, { z: closedZ + (open[i] ? 0.17 : 0) }, { duration: 0.45, ease: 'outCubic' });
        if (open[i]) room.onDrawerOpened(i);
      },
    });
  }
  // a little whimsy inside the other drawers
  const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), M.matte('#f0f0e8')); chalk.rotation.z = Math.PI / 2; chalk.position.set(-0.06, 0.006, 0.02); drawers[0].interior.add(chalk);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 14), M.brass()); button.position.set(0.05, 0.003, 0.03); drawers[0].interior.add(button);
  // (the sundries drawer is bare on purpose: a loop of string in here kept reading as something to click)
  return { root, drawers };
}
