// Glowing vials, instanced. Every vial plays its own glass note when clicked (DESIGN Room 2 delight).
// One InstancedMesh per shape for glass, liquid and cork; instance colours carry the (HDR) glow so bloom
// picks them up without per-vial materials.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import { rng } from '../../engine/props/textures.js';
import { SHELF, shelfTop, BENCH, ALEMBIC, WINDOW } from './set.js';

const SHAPES = {
  tube: { prof: [[0, 0.004], [0.011, 0.001], [0.016, 0.012], [0.016, 0.13], [0.019, 0.134], [0.016, 0.136]], fill: 0.09, top: 0.13, cork: 0.013 },
  flask: { prof: [[0, 0.002], [0.024, 0], [0.04, 0.024], [0.041, 0.048], [0.026, 0.074], [0.012, 0.09], [0.012, 0.13], [0.015, 0.134]], fill: 0.05, top: 0.13, cork: 0.011 },
  bottle: { prof: [[0, 0.002], [0.027, 0], [0.03, 0.01], [0.03, 0.095], [0.02, 0.112], [0.01, 0.122], [0.01, 0.15], [0.013, 0.154]], fill: 0.075, top: 0.15, cork: 0.009 },
  tall: { prof: [[0, 0.002], [0.02, 0], [0.022, 0.01], [0.022, 0.17], [0.012, 0.19], [0.008, 0.2], [0.008, 0.23], [0.011, 0.234]], fill: 0.13, top: 0.23, cork: 0.007 },
};

const COLORS = ['#3fe0c0', '#3fe0c0', '#5af08a', '#40c8ff', '#2fd0a0', '#b080ff', '#ffb040', '#ff7090', '#c8f060', '#7af0ff'];
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

function liquidProfile(prof, fillY) {
  const out = [];
  for (const [x, y] of prof) { if (y < fillY) out.push([x * 0.86, y + 0.003]); }
  // interpolate radius at fill height
  let rAt = prof[0][0];
  for (let i = 1; i < prof.length; i++) {
    const [x0, y0] = prof[i - 1], [x1, y1] = prof[i];
    if (fillY >= y0 && fillY <= y1) { rAt = x0 + (x1 - x0) * ((fillY - y0) / Math.max(1e-5, y1 - y0)); break; }
  }
  out.push([rAt * 0.86, fillY], [0, fillY]);
  return out;
}

function latheGeo(prof, seg) {
  return new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y)), seg);
}

/** Scattered vial placements around the room (room-space positions). */
export function scatterSpecs({ jarSlots = [], catZone = null } = {}) {
  const r = rng(77);
  const specs = [];
  const pick = (a) => a[Math.floor(r() * a.length)];
  const shapesFor = (tall) => (tall ? ['tube', 'flask', 'bottle', 'tall', 'bottle'] : ['tube', 'flask', 'bottle']);
  // shelf boards: 0 floor, 1 low, 2 jars, 3 jars (eye), 4 high, 5 top
  const boards = [
    { i: 1, density: 0.6, tall: true }, { i: 2, density: 0.8, tall: true }, { i: 3, density: 0.8, tall: true },
    { i: 4, density: 1.0, tall: true }, { i: 5, density: 0.35, tall: false },
  ];
  for (const b of boards) {
    const y = shelfTop(b.i);
    let x = -SHELF.w / 2 + 0.1;
    let deg = Math.floor(r() * 4);
    while (x < SHELF.w / 2 - 0.08) {
      const wx = SHELF.x + x;
      const blocked = jarSlots.some((s) => s.board === b.i && Math.abs(s.x - wx) < 0.12) || (b.i === 5 && catZone && wx > catZone[0] && wx < catZone[1]);
      if (!blocked && r() < b.density) {
        const n = 1 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          specs.push({ shape: pick(shapesFor(b.tall)), pos: [wx + (r() - 0.5) * 0.03, y, SHELF.z + 0.02 + (k ? -0.09 : 0.06) + (r() - 0.5) * 0.04], color: pick(COLORS), glow: 0.7 + r() * 1.1, fill: 0.5 + r() * 0.5, note: SCALE[(deg++) % SCALE.length], s: 0.85 + r() * 0.4 });
        }
      }
      x += 0.07 + r() * 0.07;
    }
  }
  // window sill
  const sillY = WINDOW.y - WINDOW.r - 0.05;
  for (const [dx, sh, c] of [[-0.5, 'flask', '#7af0ff'], [-0.4, 'tube', '#3fe0c0'], [0.52, 'bottle', '#b080ff']]) {
    specs.push({ shape: sh, pos: [WINDOW.x + dx, sillY, WINDOW.z + 0.23], color: c, glow: 1.2, fill: 0.7, note: pick(SCALE), s: 1 });
  }
  // alembic table
  for (let i = 0; i < 6; i++) {
    specs.push({ shape: pick(['tube', 'flask', 'bottle', 'tall']), pos: [ALEMBIC.x + 0.12 + (r() - 0.5) * 0.12, ALEMBIC.h, ALEMBIC.z - 0.48 + i * 0.075], color: pick(COLORS), glow: 0.8 + r(), fill: 0.6 + r() * 0.4, note: SCALE[i + 2], s: 1 });
  }
  // bench back edge
  for (let i = 0; i < 4; i++) {
    specs.push({ shape: pick(['flask', 'bottle', 'tall']), pos: [BENCH.x - 0.26, BENCH.h, BENCH.z - 0.08 - i * 0.07 - (i > 1 ? 0.45 : 0)], color: pick(COLORS), glow: 0.9 + r() * 0.6, fill: 0.7, note: SCALE[(i * 3) % 12], s: 1 });
  }
  return specs;
}

/**
 * Build an instanced vial set. Returns a Group with userData:
 *   glassMeshes (raycast targets), entryFor(hit) → spec, pulse(spec), update(dt)
 */
export function vialSet(specs, { glassOpacity = 0.28 } = {}) {
  const g = new THREE.Group(); g.name = 'vials';
  const glassMat = M.glass({ color: '#d8f4ee', opacity: glassOpacity, roughness: 0.05 });
  const liquidMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true });
  const corkMat = M.matte('#a88058', { roughness: 0.95 });
  const corkGeo = new THREE.CylinderGeometry(1, 0.85, 1, 10);
  const byShape = {};
  specs.forEach((s, i) => { (byShape[s.shape] ||= []).push(i); });
  const glassMeshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  const all = [];
  const corks = new THREE.InstancedMesh(corkGeo, corkMat, specs.length);
  corks.castShadow = true;
  for (const [shape, idxs] of Object.entries(byShape)) {
    const S = SHAPES[shape];
    const glass = new THREE.InstancedMesh(latheGeo(S.prof, 16), glassMat, idxs.length);
    glass.renderOrder = 3;
    const liq = new THREE.InstancedMesh(latheGeo(liquidProfile(S.prof, S.fill), 14), liquidMat, idxs.length);
    liq.raycast = () => {};
    liq.castShadow = false;
    idxs.forEach((si, k) => {
      const s = specs[si];
      s.base = new THREE.Color(s.color).multiplyScalar(s.glow);
      s.glassMesh = glass; s.liqMesh = liq; s.k = k; s.pulse = 0; s.rotY = (si * 2.39) % (Math.PI * 2);
      s.corkIndex = si;
      s.shapeDef = S;
      glass.userData[k] = s;
      all.push(s);
      writeInstance(s, 0);
    });
    glass.userData.entries = idxs.map((i) => specs[i]);
    g.add(liq, glass);
    glassMeshes.push(glass);
  }
  g.add(corks);
  function writeInstance(s, bounce) {
    const sy = s.s * (1 + bounce * 0.12), sxz = s.s * (1 - bounce * 0.05);
    p.set(...s.pos); q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.rotY);
    sc.set(sxz, sy, sxz);
    m4.compose(p, q, sc); s.glassMesh.setMatrixAt(s.k, m4);
    sc.set(sxz, sy * s.fill / 1, sxz);
    // liquid: scale height by fill (around base)
    m4.compose(p, q, sc); s.liqMesh.setMatrixAt(s.k, m4);
    col.copy(s.base).multiplyScalar(1 + s.pulse * 2.2);
    s.liqMesh.setColorAt(s.k, col);
    const cr = s.shapeDef.cork * s.s;
    p.set(s.pos[0], s.pos[1] + s.shapeDef.top * sy + cr * 1.2, s.pos[2]);
    sc.set(cr, cr * 2.4, cr);
    m4.compose(p, q, sc); corks.setMatrixAt(s.corkIndex, m4);
  }
  const flush = () => {
    for (const gm of glassMeshes) gm.instanceMatrix.needsUpdate = true;
    g.traverse((o) => { if (o.isInstancedMesh) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; } });
  };
  flush();
  for (const gm of glassMeshes) gm.computeBoundingSphere();
  const active = new Set();
  g.userData.glassMeshes = glassMeshes;
  g.userData.specs = specs;
  g.userData.entryFor = (hit) => (hit?.object?.isInstancedMesh && hit.instanceId != null ? hit.object.userData[hit.instanceId] : null);
  g.userData.pulse = (s) => { s.pulse = 1; s.t0 = 0; active.add(s); };
  g.userData.update = (dt) => {
    if (!active.size) return;
    for (const s of active) {
      s.t0 += dt;
      s.pulse = Math.max(0, 1 - s.t0 / 0.9);
      const bounce = Math.sin(Math.min(1, s.t0 / 0.35) * Math.PI) * (1 - Math.min(1, s.t0 / 0.35));
      writeInstance(s, bounce);
      if (s.pulse <= 0) { writeInstance(s, 0); active.delete(s); }
    }
    flush();
  };
  return g;
}
