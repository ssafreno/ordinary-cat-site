// R2-P2 — the ingredient shelf: seven labelled jars (Dawn Salt lives in the display case), the ghost in the
// DO NOT OPEN jar, and the cat's precarious vial on the top shelf.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import { SHELF, shelfTop } from './set.js';
import { softDot } from './util.js';

export const JARS = [
  { key: 'fish', label: 'Fish\nScales', board: 3, x: -0.78, contents: '#a8c8dc', glow: 0.45, lid: 'cork', item: 'jar_fish' },
  { key: 'newt', label: 'Newt Eyes\n(assorted)', board: 3, x: -0.3, contents: '#6a7a3a', glow: 0.08, lid: 'cloth' },
  { key: 'moon', label: 'Powdered\nMoonlight', board: 3, x: 0.2, contents: '#c8b8ff', glow: 1.0, lid: 'brass', item: 'jar_moon' },
  { key: 'thunder', label: 'Ground\nThunder', board: 3, x: 0.72, contents: '#3a4260', glow: 0.15, lid: 'brass' },
  { key: 'frog', label: 'Frog\nOpinions', board: 2, x: -0.72, contents: '#5a8a3a', glow: 0.12, lid: 'cloth' },
  { key: 'sighs', label: 'Bottled\nSighs', board: 2, x: -0.18, contents: '#b8d8ff', glow: 0.7, lid: 'cork' },
  { key: 'donotopen', label: 'DO NOT\nOPEN', board: 2, x: 0.52, contents: '#1e2a2a', glow: 0.05, lid: 'brass', labelColor: '#e8c8a8' },
];
export const jarSlots = () => JARS.map((j) => ({ board: j.board, x: SHELF.x + j.x }));

function ghost() {
  const g = new THREE.Group(); g.name = 'ghost';
  const mat = new THREE.MeshStandardMaterial({ color: '#d8fff4', emissive: '#a8ffe8', emissiveIntensity: 1.4, transparent: true, opacity: 0.85, depthWrite: false });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat); head.position.y = 0.035; g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 16, 1, true), mat); tail.rotation.x = Math.PI; tail.position.y = 0.005; g.add(tail);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), M.matte('#0a1414')); eye.position.set(s * 0.011, 0.04, 0.026); g.add(eye);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.02, 3, 6), mat); arm.position.set(s * 0.032, 0.02, 0); arm.rotation.z = s * 0.9; g.add(arm);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.005, 0.0015, 6, 10), M.matte('#0a1414')); mouth.position.set(0, 0.027, 0.028); g.add(mouth);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#7affd8', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.2); halo.position.y = 0.03; g.add(halo);
  g.traverse((o) => { o.raycast = () => {}; o.userData.noRaycast = true; o.castShadow = false; });
  g.userData.mat = mat; g.userData.halo = halo;
  return g;
}

export function buildJars(room) {
  const { ctx } = room;
  const { state, hotspots } = ctx;
  const G = room.group;
  const meshes = {};
  const clicks = {};
  for (const J of JARS) {
    const j = F.jar({ r: 0.068, h: 0.19, contents: J.contents, glow: J.glow, label: J.label, lid: J.lid, labelColor: J.labelColor || '#efe2c0', fill: J.key === 'donotopen' ? 0.85 : 0.7 });
    j.position.set(SHELF.x + J.x, shelfTop(J.board), SHELF.z + 0.06);
    j.rotation.y = (Math.random() - 0.5) * 0.25;
    G.add(j);
    meshes[J.key] = j;
    if (J.item && state.get(`room2.jar.${J.key}.taken`)) j.visible = false;
  }
  // newt eyes: little eyeballs pressed to the glass
  const nj = meshes.newt;
  for (let i = 0; i < 7; i++) {
    const eye = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), M.matte('#e8e4c8', { roughness: 0.4 }));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), M.matte('#101008', { roughness: 0.2 })); pupil.position.z = 0.009;
    eye.add(ball, pupil);
    const a = (i / 7) * 1.6 - 0.8;
    eye.position.set(Math.sin(a) * 0.05, 0.02 + (i % 3) * 0.032, Math.cos(a) * 0.05);
    eye.rotation.y = a + (Math.random() - 0.5) * 0.6; eye.rotation.x = (Math.random() - 0.5) * 0.5;
    nj.add(eye);
  }
  // fish scales glitter
  const fishSpark = P.sparkles({ box: [0.1, 0.1, 0.1], center: [0, 0.07, 0], count: 10, color: '#e8f4ff', color2: '#a8d8ff', size: 0.02, opacity: 0.9 });
  meshes.fish.add(fishSpark);
  const moonSpark = P.sparkles({ box: [0.1, 0.1, 0.1], center: [0, 0.07, 0], count: 10, color: '#efe2ff', color2: '#c8b8ff', size: 0.02, opacity: 0.9 });
  meshes.moon.add(moonSpark);
  // thunder: occasional flicker inside
  const thunderMat = meshes.thunder.userData.contents.material;
  let nextFlash = 3;
  // DO NOT OPEN: the ghost
  const dno = meshes.donotopen;
  const gh = ghost(); gh.position.y = 0.06; gh.visible = false; dno.add(gh);
  const lid = dno.userData.lid; const lidY = lid.position.y; lid.userData.dynamic = true; gh.userData.dynamic = true;
  let ghostBusy = false;

  const animator = new THREE.Object3D();
  animator.userData.update = (dt, t) => {
    if (t > nextFlash) {
      nextFlash = t + 2.5 + Math.random() * 5;
      const k = { v: 2.2 };
      ctx.tween.to(k, { v: 0.15 }, { duration: 0.35, ease: 'outQuad', onUpdate: () => { thunderMat.emissiveIntensity = k.v; } });
    }
    if (gh.visible) { gh.rotation.y = Math.sin(t * 3) * 0.4; gh.userData.halo.material.opacity = 0.5 + Math.sin(t * 5) * 0.15; }
  };
  G.add(animator);

  const openGhost = async () => {
    if (ghostBusy) return;
    ghostBusy = true;
    const n = state.inc('room2.ghost.count');
    ctx.audio.play('keyTurn', { gain: 0.4, pitch: 1.4 });
    await ctx.tween.to(lid.position, { y: lidY + 0.07 }, { duration: 0.35, ease: 'outBack' });
    lid.rotation.z = 0.3;
    gh.visible = true; gh.position.y = 0.06; gh.scale.setScalar(0.3);
    ctx.audio.glassNote(19);
    ctx.tween.to(gh.scale, { x: 1, y: 1, z: 1 }, { duration: 0.6, ease: 'outBack' });
    await ctx.tween.to(gh.position, { y: 0.34 }, { duration: 1.1, ease: 'outCubic' });
    ctx.audio.play('gust', { gain: 0.25, pitch: 1.8 });
    ctx.dialogue.caption('caption.ghost');
    await ctx.tween.run(1.4, (k) => { gh.position.x = Math.sin(k * Math.PI * 2) * 0.03; gh.position.y = 0.34 - Math.sin(k * Math.PI) * 0.03; });
    await ctx.tween.to(gh.position, { y: 0.06, x: 0 }, { duration: 0.8, ease: 'inCubic' });
    ctx.tween.to(gh.scale, { x: 0.3, y: 0.3, z: 0.3 }, { duration: 0.3 });
    await ctx.tween.delay(0.2);
    gh.visible = false;
    lid.rotation.z = 0;
    await ctx.tween.to(lid.position, { y: lidY }, { duration: 0.25, ease: 'inQuad' });
    ctx.audio.play('click', { gain: 0.6 });
    ghostBusy = false;
    if (n === 1) await ctx.dialogue.say('react.jar.donotopen');
  };

  for (const J of JARS) {
    const j = meshes[J.key];
    const name = J.label.replace('\n', ' ');
    hotspots.add({
      id: `r2.jar.${J.key}`, object: j, label: J.item ? name : `${name}`,
      scope: ['room', 'focus:r2.shelf'],
      enabled: () => !(J.item && state.get(`room2.jar.${J.key}.taken`)),
      onClick: () => {
        if (J.item) { room.takeJar(J.key, j); return; }
        if (J.key === 'donotopen') { openGhost(); return; }
        clicks[J.key] = (clicks[J.key] || 0) + 1;
        ctx.audio.glassNote(-5 + JARS.indexOf(J) * 2);
        if (clicks[J.key] % 2 === 1) ctx.dialogue.caption(`caption.jar.${J.key}`);
        else { ctx.cat.react?.('earFlickL'); ctx.dialogue.say(`react.jar.${J.key}`); }
      },
    });
  }

  // the cat's vial on the top shelf
  const bat = F.bottle({ shape: 'flask', r: 0.03, h: 0.12, color: '#bff0e6', contents: '#3fe0c0', glow: 1.4 });
  const batHome = new THREE.Vector3(SHELF.x - 0.05, shelfTop(5), SHELF.z + 0.04);
  const edgeZ = SHELF.z + SHELF.d / 2 - 0.012;
  bat.position.copy(batHome);
  G.add(bat);
  hotspots.add({
    id: 'r2.batvial', object: bat, label: 'A vial, near the edge',
    onClick: () => {
      ctx.audio.glassNote(24);
      if (bat.position.z > batHome.z + 0.02) {
        ctx.tween.to(bat.position, { z: batHome.z, x: batHome.x }, { duration: 0.5, ease: 'outCubic' });
        ctx.dialogue.caption('caption.r2.vial.saved');
        ctx.cat.react?.('tailFlick');
      } else ctx.dialogue.caption('caption.vials');
    },
  });

  return { meshes, bat, batHome, edgeZ, openGhost };
}
