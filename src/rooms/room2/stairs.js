// Spiral staircase up to the observatory, with a runed iron gate at the bottom and a missing eleventh step.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { STAIR, ROOM } from './set.js';

const RISE = 0.19;
const STEPS = 22;
const DA = THREE.MathUtils.degToRad(27);
const PHI = THREE.MathUtils.degToRad(48); // gate angle (radial line from the column toward +x/+z)
export const MISSING = 10; // the eleventh step

const angleOf = (i) => PHI - (i + 0.5) * DA;

function wedgeGeo(r0, r1, a0, a1, thick) {
  const s = new THREE.Shape();
  const N = 6;
  s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
  for (let k = 0; k <= N; k++) { const a = a0 + (a1 - a0) * (k / N); s.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 });
  // shape is in XY; extrude along +Z. Lay it flat: X stays X, shape Y → world -Z (so angle a ↔ (cos a, sin a) in x/z after flip)
  g.rotateX(Math.PI / 2);
  return g;
}

export function buildStairs(room) {
  const { ctx } = room;
  const G = room.group;
  const root = new THREE.Group(); root.name = 'spiralStair';
  root.position.set(STAIR.x, 0, STAIR.z);
  G.add(root);
  const iron = M.iron({ color: '#2a2826', roughness: 0.5 });
  const wood = M.oak({ tint: '#6a4a2c', seed: 9 });

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, ROOM.h, 16), iron); column.position.y = ROOM.h / 2; root.add(column);
  const footRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 20), iron); footRing.position.y = 0.04; root.add(footRing);

  // steps (merged), each a wedge at angle a with its top at (i+1)*RISE
  const stepGeos = [], bracketGeos = [];
  const stepPos = [];
  for (let i = 0; i < STEPS; i++) {
    const a = angleOf(i);
    const y = (i + 1) * RISE;
    stepPos.push({ a, y });
    if (i === MISSING) continue;
    // wedgeGeo uses shape (x, y) → after rotateX(+90°) y maps to +z, so angle a ↔ (cos a, sin a) in x/z
    const g = wedgeGeo(0.08, STAIR.r, a - DA / 2 - 0.01, a + DA / 2 + 0.01, 0.045);
    g.translate(0, y, 0);
    stepGeos.push(g);
    // iron bracket under each step
    const b = new THREE.BoxGeometry(STAIR.r - 0.15, 0.03, 0.025);
    b.translate((STAIR.r - 0.15) / 2 + 0.08, 0, 0);
    b.rotateY(-a);
    b.translate(0, y - 0.065, 0);
    bracketGeos.push(b);
  }
  const steps = new THREE.Mesh(mergeGeometries(stepGeos.map((g) => g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g)), wood);
  steps.castShadow = true; steps.receiveShadow = true; root.add(steps);
  const brackets = new THREE.Mesh(mergeGeometries(bracketGeos.map((g) => (g.index ? g.toNonIndexed() : g))), iron);
  brackets.castShadow = true; root.add(brackets);

  // outer handrail (helix) + balusters
  const railPts = [];
  for (let k = 0; k <= 160; k++) {
    const f = k / 160 * (STEPS - 0.2);
    const a = PHI - f * DA, y = f * RISE + 0.95;
    railPts.push(new THREE.Vector3(Math.cos(a) * (STAIR.r - 0.04), Math.min(y, ROOM.h + 0.3), Math.sin(a) * (STAIR.r - 0.04)));
  }
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 240, 0.02, 8), M.brass({ color: '#a8843a' }));
  rail.castShadow = true; root.add(rail);
  const balG = [];
  for (let i = 0; i < STEPS; i++) {
    const { a, y } = stepPos[i];
    const len = 0.9;
    const b = new THREE.CylinderGeometry(0.009, 0.009, len, 6);
    b.translate(Math.cos(a) * (STAIR.r - 0.04), y + len / 2 + 0.04, Math.sin(a) * (STAIR.r - 0.04));
    balG.push(b.index ? b.toNonIndexed() : b);
  }
  const balusters = new THREE.Mesh(mergeGeometries(balG), iron); balusters.castShadow = true; root.add(balusters);

  // step 11: a clickable gap (a little dust where it should be + two bare bolts)
  const m = stepPos[MISSING];
  const gap = ctx.hotspots.proxyBox(0.5, 0.16, 0.3);
  gap.position.set(Math.cos(m.a) * 0.55, m.y, Math.sin(m.a) * 0.55); gap.rotation.y = -m.a;
  root.add(gap);
  for (const r of [0.3, 0.7]) { const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6), M.brass()); bolt.position.set(Math.cos(m.a) * r, m.y - 0.04, Math.sin(m.a) * r); root.add(bolt); }
  ctx.hotspots.add({ id: 'r2.step11', object: gap, label: 'The eleventh step', onClick: () => ctx.dialogue.caption('caption.step11') });

  // ---- the gate: radial at angle PHI + a little, from the column to the outer rail
  const gate = new THREE.Group(); gate.name = 'stairGate';
  const ga = PHI + 0.08;
  gate.position.set(Math.cos(ga) * 0.1, 0, Math.sin(ga) * 0.1);
  gate.rotation.y = -ga; // local +x runs outward along the radial line; local +z faces the vantage side
  root.add(gate);
  const GW = STAIR.r - 0.08, GH = 1.95;
  const frameL = F.rbox(0.05, GH, 0.05, iron, 0.01); frameL.position.set(0.0, GH / 2, 0); gate.add(frameL);
  const frameR = frameL.clone(); frameR.position.x = GW + 0.02; gate.add(frameR);
  const archTop = new THREE.Mesh(new THREE.TorusGeometry((GW + 0.02) / 2, 0.025, 8, 24, Math.PI), iron); archTop.position.set((GW + 0.02) / 2, GH, 0); gate.add(archTop);
  // the leaf (hinged at the column side)
  const leaf = new THREE.Group(); leaf.userData.dynamic = true; leaf.position.set(0.03, 0, 0); gate.add(leaf);
  const barsG = [];
  const nb = 7;
  for (let i = 0; i < nb; i++) {
    const x = 0.04 + (i / (nb - 1)) * (GW - 0.1);
    const b = new THREE.CylinderGeometry(0.009, 0.009, 1.7, 6); b.translate(x, 0.92, 0); barsG.push(b.index ? b.toNonIndexed() : b);
    const tip = new THREE.ConeGeometry(0.02, 0.06, 6); tip.translate(x, 1.8, 0); barsG.push(tip.index ? tip.toNonIndexed() : tip);
  }
  for (const y of [0.12, 0.95, 1.7]) { const r = new THREE.BoxGeometry(GW - 0.04, 0.03, 0.02); r.translate((GW - 0.04) / 2 + 0.01, y, 0); barsG.push(r.index ? r.toNonIndexed() : r); }
  const bars = new THREE.Mesh(mergeGeometries(barsG), iron); bars.castShadow = true; leaf.add(bars);
  // scrollwork ring around the rune
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 32), M.brass({ color: '#a8843a' })); ring.position.set(GW / 2, 1.2, 0.015); leaf.add(ring);
  // rune
  const runeMat = new THREE.MeshBasicMaterial({ map: F.runeTexture(11), color: new THREE.Color('#5ff0d0').multiplyScalar(2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), runeMat); rune.position.set(GW / 2, 1.2, 0.03); rune.userData.noHighlight = true; rune.userData.dynamic = true; leaf.add(rune);
  const runeLight = new THREE.PointLight('#4fe0c0', 0.9, 2.2, 2); runeLight.position.set(GW / 2, 1.2, 0.3); leaf.add(runeLight);
  F.shadowAll(frameL); F.shadowAll(frameR);
  const gateProxy = ctx.hotspots.proxyBox(GW, 1.9, 0.12); gateProxy.position.set(GW / 2, 0.95, 0); gate.add(gateProxy);

  const baseCol = runeMat.color.clone();
  let runeK = 1;
  root.userData.update = (dt, t) => {
    const k = runeK * (0.82 + 0.18 * Math.sin(t * 2.1));
    runeMat.color.copy(baseCol).multiplyScalar(k);
    rune.visible = runeK > 0.01;
    runeLight.intensity = 0.9 * runeK * (0.85 + 0.15 * Math.sin(t * 2.1));
  };

  return {
    root, gate, leaf, gateProxy,
    gateWorld: () => gate.localToWorld(new THREE.Vector3(GW / 2, 1.2, 0)),
    setOpen(open, animate) {
      if (!open) { runeK = 1; leaf.rotation.y = 0; return Promise.resolve(); }
      if (!animate) { runeK = 0; leaf.rotation.y = 1.7; return Promise.resolve(); }
      return (async () => {
        await ctx.tween.run(1.4, (k) => { runeK = (1 - k) * (k < 0.9 ? 0.75 + Math.random() * 0.5 : 1); }, { ease: 'inQuad' });
        runeK = 0;
        ctx.audio.play('doorOpen', { gain: 0.6, pitch: 1.3 });
        await ctx.tween.to(leaf.rotation, { y: 1.7 }, { duration: 1.4, ease: 'inOutSine' });
      })();
    },
  };
}
