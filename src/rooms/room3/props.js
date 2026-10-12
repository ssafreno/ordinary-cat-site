// Room 3 — bespoke props: telescope, orrery, lectern, bowl, sardine tin, instruments, stairwell.
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { drawDial, tex, SERIF } from './art.js';

const Y = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------
// Telescope on a pier. The cat loafs on the flat pier head; the barrel hangs off the side.
// opts.dir: unit Vector3 the barrel points along; opts.side: unit horizontal Vector3 toward the barrel.
// ---------------------------------------------------------------------------------------------
export function telescope({ dir, side }) {
  const g = new THREE.Group(); g.name = 'r3.telescope';
  const brass = M.brass({ polished: true });
  const darkBrass = M.brass({ color: M.palette.brassDark, roughness: 0.4 });
  const wood = M.walnut();
  const iron = M.iron({ color: '#2a2a30' });
  // tripod feet + pier column
  const base = F.lathe([[0, 0], [0.3, 0], [0.3, 0.04], [0.24, 0.07], [0.14, 0.1], [0, 0.1]], iron, 28);
  g.add(base);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const foot = F.rbox(0.09, 0.06, 0.42, iron, 0.015);
    foot.position.set(Math.sin(a) * 0.32, 0.03, Math.cos(a) * 0.32);
    foot.rotation.y = a;
    g.add(foot);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), brass);
    claw.position.set(Math.sin(a) * 0.52, 0.035, Math.cos(a) * 0.52);
    g.add(claw);
  }
  const column = F.lathe([[0, 0.1], [0.12, 0.1], [0.1, 0.18], [0.075, 0.3], [0.07, 0.95], [0.09, 1.0], [0.13, 1.05], [0.13, 1.1], [0, 1.1]], wood, 24);
  g.add(column);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 10, 28), brass);
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.6; g.add(collar);
  // pier head (flat top: the cat's spot)
  const head = F.rbox(0.42, 0.3, 0.42, darkBrass, 0.03);
  head.position.y = 1.1 + 0.15;
  g.add(head);
  const top = F.rbox(0.46, 0.035, 0.46, wood, 0.01);
  top.position.y = 1.1 + 0.3 + 0.0175;
  g.add(top);
  const headTopY = 1.1 + 0.3 + 0.035;
  // engraved dial on the head's front
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 32), brass);
    ring.position.set(0, 1.25, s * 0.212); g.add(ring);
  }
  // declination axle from the head out to the barrel
  const pivot = new THREE.Vector3(0, 1.32, 0).addScaledVector(side, 0.4);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 16), brass);
  axle.quaternion.setFromUnitVectors(Y, side);
  axle.position.set(0, 1.32, 0).addScaledVector(side, 0.2);
  g.add(axle);
  const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 20), iron);  // counterweight on the other side
  cw.quaternion.setFromUnitVectors(Y, side);
  cw.position.set(0, 1.32, 0).addScaledVector(side, -0.3);
  g.add(cw);
  const cwRod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 10), brass);
  cwRod.quaternion.setFromUnitVectors(Y, side);
  cwRod.position.set(0, 1.32, 0).addScaledVector(side, -0.22);
  g.add(cwRod);

  // barrel, built along +Y then aimed along dir
  const barrel = new THREE.Group();
  barrel.position.copy(pivot);
  barrel.quaternion.setFromUnitVectors(Y, dir);
  g.add(barrel);
  const L0 = -0.62, L1 = 1.55;
  const tube = F.lathe([
    [0, L0], [0.085, L0], [0.095, L0 + 0.03], [0.1, L0 + 0.1], [0.11, -0.1], [0.125, 0.4], [0.14, 1.1], [0.15, L1 - 0.12], [0.165, L1 - 0.1],
    [0.165, L1], [0.155, L1], [0.155, L1 - 0.06], [0.0, L1 - 0.06],
  ], brass, 36);
  barrel.add(tube);
  for (const [y, r] of [[-0.45, 0.106], [0.05, 0.118], [0.6, 0.131], [1.2, 0.145]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 10, 36), darkBrass);
    band.rotation.x = Math.PI / 2; band.position.y = y; barrel.add(band);
  }
  const sleeve = F.lathe([[0.112, -0.2], [0.13, -0.2], [0.13, 0.25], [0.112, 0.25]], wood, 32);
  barrel.add(sleeve);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.152, 32), new THREE.MeshPhysicalMaterial({ color: '#1b2a4a', metalness: 0.2, roughness: 0.05, clearcoat: 1, emissive: '#16244a', emissiveIntensity: 0.6 }));
  lens.rotation.x = -Math.PI / 2; lens.position.y = L1 - 0.065; barrel.add(lens);
  // eyepiece + focus knobs
  const ep = F.lathe([[0, 0], [0.03, 0], [0.03, -0.1], [0.024, -0.12], [0.034, -0.14], [0.034, -0.19], [0.0, -0.19]], brass, 20);
  ep.position.y = L0; barrel.add(ep);
  const epCup = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 20), M.matte('#1a1410'));
  epCup.rotation.x = Math.PI / 2; epCup.position.y = L0 - 0.19; barrel.add(epCup);
  for (const s of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), darkBrass);
    knob.rotation.z = Math.PI / 2; knob.position.set(s * 0.12, L0 + 0.08, 0); barrel.add(knob);
  }
  // finder scope
  const finder = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.5, 16), brass);
  finder.position.set(0.0, 0.3, 0.2); barrel.add(finder);
  for (const y of [0.15, 0.45]) {
    const bracket = F.rbox(0.02, 0.02, 0.08, darkBrass, 0.004); bracket.position.set(0, y, 0.15); barrel.add(bracket);
  }
  F.shadowAll(g);

  g.updateMatrixWorld(true);
  const eyeLocal = new THREE.Vector3(0, L0 - 0.19, 0);
  g.userData = { ...g.userData, barrel, pivot, headTopY, eyeLocal, dir };
  return g;
}

// ---------------------------------------------------------------------------------------------
// The orrery: dial base, sun, three planets on arms with tiny moons. Origin at the top of its stand.
// ---------------------------------------------------------------------------------------------
export const ORBITS = [
  // final: rings spread wider, planets slightly smaller and set low (heights rising outward) under a near top-down focus
  // camera, so no two planets (or a planet and the sun) overlap on screen at any of the 12x12 position pairs.
  // (polish had inner r 0.104 / h 0.218, middle r 0.155 / h 0.152, outer r 0.215 / h 0.085)
  { r: 0.1, h: 0.12, size: 0.016, color: '#9fb6e6', moons: 0, prox: 0.026 },
  { r: 0.165, h: 0.132, size: 0.02, color: '#d9773e', moons: 1, prox: 0.028 },
  { r: 0.24, h: 0.144, size: 0.021, color: '#d8bf86', moons: 2, ring: true, prox: 0.036 },
];
export function orrery() {
  const g = new THREE.Group(); g.name = 'r3.orrery';
  const brass = M.brass({ polished: true });
  const base = F.lathe([[0, 0], [0.27, 0], [0.28, 0.012], [0.275, 0.03], [0.262, 0.04], [0, 0.04]], M.brass({ color: M.palette.brassDark, roughness: 0.35 }), 48);
  g.add(base);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.255, 64), new THREE.MeshStandardMaterial({ map: tex(drawDial(1024)), roughness: 0.35, metalness: 0.25 }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.0405; dial.receiveShadow = true;
  g.add(dial);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.16, 12), brass);
  spindle.position.y = 0.04 + 0.08; g.add(spindle);
  // sun
  const sunMat = new THREE.MeshStandardMaterial({ color: '#ffcf6a', emissive: '#ffa53a', emissiveIntensity: 2.2, roughness: 0.4 });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.042, 32, 20), sunMat);
  sun.position.y = 0.2; g.add(sun);
  const corona = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.003, 8, 48), brass);
  corona.position.y = 0.2; corona.rotation.x = Math.PI / 2; g.add(corona);
  const rays = new THREE.Group(); rays.position.y = 0.2; g.add(rays);
  for (let i = 0; i < 12; i++) {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.03, 6), brass);
    const a = (i / 12) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 0.064, 0, Math.sin(a) * 0.064); // final: was 0.072; tips now clear the inner planet from above
    ray.userData.noRaycast = true;
    ray.rotation.z = -Math.PI / 2; ray.rotation.y = -a;
    rays.add(ray);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ffb24a').multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.26); halo.position.y = 0.2; halo.raycast = () => {}; halo.userData.noRaycast = true; g.add(halo);
  const sunLight = new THREE.PointLight('#ffb35a', 0.16, 1.4, 1);
  sunLight.position.y = 0.2; g.add(sunLight);

  // orbit guide rings + planet arms
  const arms = ORBITS.map((o, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.0022, 6, 96), brass);
    ring.rotation.x = Math.PI / 2; ring.position.y = o.h; g.add(ring);
    const arm = new THREE.Group(); arm.position.y = 0; g.add(arm);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, o.r, 8), brass);
    rod.rotation.x = Math.PI / 2; rod.position.set(0, o.h - 0.02, -o.r / 2); arm.add(rod);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 16), brass);
    hub.position.y = o.h - 0.02; arm.add(hub);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 6), brass);
    post.position.set(0, o.h - 0.005, -o.r); arm.add(post);
    const pm = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.45, metalness: 0.15, emissive: o.color, emissiveIntensity: 0.15 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(o.size, 28, 18), pm);
    planet.position.set(0, o.h + o.size * 0.6, -o.r); arm.add(planet);
    if (o.ring) {
      const pr = new THREE.Mesh(new THREE.RingGeometry(o.size * 1.4, o.size * 2.1, 40), new THREE.MeshStandardMaterial({ color: '#e7d3a0', side: THREE.DoubleSide, roughness: 0.5, transparent: true, opacity: 0.85 }));
      pr.rotation.x = -Math.PI / 2 + 0.45; planet.add(pr);
    }
    const moons = [];
    for (let k = 0; k < o.moons; k++) {
      const piv = new THREE.Group(); planet.add(piv);
      piv.rotation.x = 0.3 * (k ? -1 : 1);
      const mn = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), new THREE.MeshStandardMaterial({ color: '#d8d8d0', roughness: 0.6, emissive: '#9a9a90', emissiveIntensity: 0.25 }));
      mn.position.x = o.size + 0.008 + k * 0.008; // final: tighter moon orbits (were +0.018 / 0.012) so they stay clear of the next ring piv.add(mn);
      moons.push({ piv, speed: 1.6 - k * 0.6 });
    }
    // generous click target
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(o.prox, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.copy(planet.position); arm.add(proxy);
    return { arm, planet, proxy, moons, orbit: o, index: i };
  });
  F.shadowAll(g);
  halo.castShadow = false;
  g.userData = { ...g.userData, sun, sunMat, halo, sunLight, rays, arms };
  g.userData.update = (dt, t) => {
    for (const a of arms) for (const m of a.moons) m.piv.rotation.y += dt * m.speed;
    rays.rotation.y += dt * 0.15;
    halo.material.opacity = (0.85 + Math.sin(t * 2.1) * 0.08) * (g.userData.haloDim ?? 1);
  };
  return g;
}

let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.25, 'rgba(255,190,110,0.35)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

// ---------------------------------------------------------------------------------------------
// Lectern (faces +Z). userData: lid (pivot group), page (Mesh), topY
// ---------------------------------------------------------------------------------------------
export function lectern({ pageDraw } = {}) {
  const g = new THREE.Group(); g.name = 'r3.lectern';
  const wood = M.walnut();
  const brass = M.brass();
  g.add(F.lathe([[0, 0], [0.22, 0], [0.22, 0.03], [0.17, 0.06], [0.06, 0.1], [0.045, 0.2], [0.05, 0.5], [0.04, 0.8], [0.07, 0.86], [0.1, 0.9], [0, 0.9]], wood, 24));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 8, 20), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; g.add(ring);
  // slanted desk
  const desk = new THREE.Group(); desk.position.set(0, 1.0, 0); desk.rotation.x = 0.42; g.add(desk);
  const board = F.rbox(0.52, 0.035, 0.4, wood, 0.01); desk.add(board);
  const ledge = F.rbox(0.52, 0.04, 0.025, brass, 0.006); ledge.position.set(0, 0.03, 0.2); desk.add(ledge);
  const brace = F.rbox(0.12, 0.14, 0.12, wood, 0.01); brace.position.set(0, -0.08, -0.04); desk.add(brace);
  // the page (hidden until placed)
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), pageDraw ? new THREE.MeshStandardMaterial({ map: tex(pageDraw()), roughness: 0.9 }) : M.parchment());
  page.rotation.x = -Math.PI / 2; page.position.set(0, 0.019, 0.0); page.visible = false;
  desk.add(page);
  // lid hinged along the back (top) edge
  const lid = new THREE.Group(); lid.position.set(0, 0.0175, -0.2); desk.add(lid);
  const cover = F.rbox(0.5, 0.025, 0.39, M.mahogany(), 0.01); cover.position.set(0, 0.0125, 0.195); lid.add(cover);
  const clasp = F.rbox(0.06, 0.03, 0.02, brass, 0.004); clasp.position.set(0, 0.012, 0.39); lid.add(clasp);
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 32), brass); emblem.rotation.x = Math.PI / 2; emblem.position.set(0, 0.027, 0.195); lid.add(emblem);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), brass); star.scale.y = 0.25; star.position.set(0, 0.028, 0.195); lid.add(star);
  F.shadowAll(g);
  g.userData = { ...g.userData, lid, page, desk };
  return g;
}

/** Page canvas for the lectern from the incantation paper def. */
export function drawPage(def) {
  const W = 600, H = 720;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.8);
  gr.addColorStop(0, '#f1e3bd'); gr.addColorStop(1, '#c9ac72');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#5a3a18'; g.lineWidth = 4; g.strokeRect(18, 18, W - 36, H - 36); g.lineWidth = 1.5; g.strokeRect(28, 28, W - 56, H - 56);
  g.fillStyle = '#2e1d0e'; g.textAlign = 'center';
  g.font = `700 40px ${SERIF}`; g.fillText(def?.title || '', W / 2, 92);
  g.font = `italic 27px ${SERIF}`;
  (def?.body || '').split('\n').forEach((line, i) => g.fillText(line, W / 2, 160 + i * 40));
  return c;
}

// ---------------------------------------------------------------------------------------------
// Small things
// ---------------------------------------------------------------------------------------------
export function bowl() {
  const g = new THREE.Group(); g.name = 'r3.bowl';
  const brass = M.brass({ polished: true });
  const b = F.lathe([[0, 0.05], [0.04, 0.05], [0.09, 0.07], [0.125, 0.11], [0.13, 0.125], [0.122, 0.128], [0.115, 0.115], [0.08, 0.08], [0.0, 0.065]], brass, 36);
  g.add(b);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.06, 8), brass);
    leg.position.set(Math.sin(a) * 0.05, 0.03, Math.cos(a) * 0.05); g.add(leg);
  }
  const liquidMat = new THREE.MeshStandardMaterial({ color: '#6a2a8a', emissive: '#a24ae0', emissiveIntensity: 0, roughness: 0.15, transparent: true, opacity: 0.95 });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.108, 32), liquidMat);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = 0.105; liquid.visible = false;
  g.add(liquid);
  F.shadowAll(g);
  g.userData = { ...g.userData, liquid, liquidMat };
  return g;
}

export function sardineTin() {
  const g = new THREE.Group(); g.name = 'r3.tin';
  const tinMat = M.brass({ color: '#c8ccd2', roughness: 0.3 });
  const shape = new THREE.Shape();
  const w = 0.13, d = 0.085, r = 0.025;
  shape.moveTo(-w / 2 + r, -d / 2); shape.lineTo(w / 2 - r, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); shape.lineTo(-w / 2, -d / 2 + r); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const hole = new THREE.Path();
  const i = 0.006;
  hole.moveTo(-w / 2 + r, -d / 2 + i); hole.lineTo(w / 2 - r, -d / 2 + i); hole.quadraticCurveTo(w / 2 - i, -d / 2 + i, w / 2 - i, -d / 2 + r);
  hole.lineTo(w / 2 - i, d / 2 - r); hole.quadraticCurveTo(w / 2 - i, d / 2 - i, w / 2 - r, d / 2 - i); hole.lineTo(-w / 2 + r, d / 2 - i);
  hole.quadraticCurveTo(-w / 2 + i, d / 2 - i, -w / 2 + i, d / 2 - r); hole.lineTo(-w / 2 + i, -d / 2 + r); hole.quadraticCurveTo(-w / 2 + i, -d / 2 + i, -w / 2 + r, -d / 2 + i);
  shape.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: false }), tinMat);
  wall.rotation.x = -Math.PI / 2; g.add(wall);
  const floor = F.rbox(w - 0.004, 0.003, d - 0.004, tinMat, 0.001); floor.position.y = 0.002; g.add(floor);
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.012, d - 0.012), new THREE.MeshStandardMaterial({ color: '#c99a3a', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6 }));
  oil.rotation.x = -Math.PI / 2; oil.position.y = 0.021; g.add(oil);
  const fishMat = M.brass({ color: '#9aa4b0', roughness: 0.25 });
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.085, 4, 10), fishMat);
    f.rotation.z = Math.PI / 2; f.scale.set(1, 1, 0.7);
    f.position.set((k % 2 ? 0.004 : -0.004), 0.016, -0.03 + k * 0.02); g.add(f);
  }
  // peeled lid curled back, with its key
  const curl = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, d - 0.006, 16), tinMat);
  curl.rotation.x = Math.PI / 2; curl.position.set(-w / 2 - 0.01, 0.03, 0); g.add(curl);
  const key = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 6, 14), tinMat);
  key.position.set(-w / 2 - 0.01, 0.03, d / 2 + 0.008); g.add(key);
  F.shadowAll(g);
  return g;
}

export function astrolabe() {
  const g = new THREE.Group(); g.name = 'r3.astrolabe';
  const brass = M.brass({ polished: true });
  const mater = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 48), M.brass({ color: M.palette.brassDark }));
  mater.rotation.x = Math.PI / 2; mater.position.y = 0.16; g.add(mater);
  for (const [r, t] of [[0.11, 0.008], [0.085, 0.003], [0.05, 0.003]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 48), brass); ring.position.set(0, 0.16, 0.008); g.add(ring);
  }
  const rule = F.rbox(0.2, 0.008, 0.004, brass, 0.001); rule.position.set(0, 0.16, 0.012); rule.rotation.z = 0.5; g.add(rule);
  const throne = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 16), brass); throne.position.set(0, 0.29, 0); g.add(throne);
  const stand = F.lathe([[0, 0], [0.06, 0], [0.06, 0.01], [0.012, 0.02], [0.01, 0.05], [0, 0.05]], brass, 20); g.add(stand);
  F.shadowAll(g);
  return g;
}

export function sextant() {
  const g = new THREE.Group(); g.name = 'r3.sextant';
  const brass = M.brass({ polished: true });
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.absarc(0, 0, 0.17, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55, false); shape.lineTo(0, 0);
  const hole = new THREE.Path(); hole.moveTo(0, -0.04); hole.absarc(0, 0, 0.14, -Math.PI / 2 + 0.45, -Math.PI / 2 - 0.45, true); hole.lineTo(0, -0.04);
  shape.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }), brass);
  g.add(frame);
  const arm = F.rbox(0.008, 0.17, 0.004, brass, 0.001); arm.position.set(0.02, -0.085, 0.008); arm.rotation.z = 0.12; g.add(arm);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.09, 12), brass); scope.rotation.z = Math.PI / 2; scope.position.set(0, -0.06, 0.02); g.add(scope);
  F.shadowAll(g);
  return g;
}

export function celestialGlobe() {
  const g = new THREE.Group(); g.name = 'r3.globe';
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1b2a5c'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(240,205,120,${0.4 + Math.random() * 0.6})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 256, 0.6 + Math.random() * 1.8, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(240,205,120,0.5)'; x.lineWidth = 1;
  for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(0, k * 42); x.lineTo(512, k * 42); x.stroke(); }
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.45, metalness: 0.1 }));
  sphere.position.y = 0.2; sphere.rotation.z = 0.41; g.add(sphere);
  const mer = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.005, 8, 48, Math.PI * 1.4), M.brass());
  mer.position.y = 0.2; mer.rotation.z = -Math.PI * 0.2; g.add(mer);
  g.add(F.lathe([[0, 0], [0.07, 0], [0.07, 0.012], [0.015, 0.03], [0.012, 0.09], [0, 0.09]], M.walnut(), 20));
  F.shadowAll(g);
  g.userData.sphere = sphere;
  return g;
}

export function scroll(len = 0.32, r = 0.022, tint = '#e2cf9e') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), M.parchment({ tint }));
  body.rotation.z = Math.PI / 2; g.add(body);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(r + 0.001, 0.003, 6, 16), M.matte('#7a1c22'));
  tie.rotation.y = Math.PI / 2; g.add(tie);
  F.shadowAll(g);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Stairwell: a dark well with spiral steps going down, brass railing with a gap toward `gapDir`.
// Origin at the hole centre on the floor.
// ---------------------------------------------------------------------------------------------
export function stairwell({ radius = 0.7, gapAngle = 0, gapWidth = 1.0 } = {}) {
  const g = new THREE.Group(); g.name = 'r3.stairs';
  const well = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 3.2, 40, 1, true), M.stone({ tint: '#3a3e4a', repeat: [3, 2] }));
  well.material.side = THREE.BackSide;
  well.position.y = -1.6; well.receiveShadow = true; g.add(well);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), new THREE.MeshBasicMaterial({ color: '#2a1508' }));
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -3.0; g.add(bottom);
  // warm glow from the laboratory below
  const glow = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.98, 32), new THREE.MeshBasicMaterial({ color: '#ff9a4a', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -1.2; glow.raycast = () => {}; g.add(glow);
  const stepMat = M.wood({ tint: '#5a3a22', seed: 21 });
  const newel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 14), M.smoothStone({ color: '#5a5650' }));
  newel.position.y = -1.6; g.add(newel);
  for (let i = 0; i < 12; i++) {
    const a = gapAngle + i * 0.5;
    const step = F.rbox(radius - 0.08, 0.05, 0.26, stepMat, 0.01);
    step.position.set(Math.sin(a) * (radius / 2 + 0.02), -0.2 - i * 0.2, -Math.cos(a) * (radius / 2 + 0.02));
    step.rotation.y = -a + Math.PI / 2;
    g.add(step);
  }
  // railing
  const brass = M.brass({ polished: true });
  const rr = radius + 0.05;
  const a0 = gapAngle + gapWidth / 2, a1 = gapAngle + Math.PI * 2 - gapWidth / 2;
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.95, 10), brass);
    post.position.set(Math.sin(a) * rr, 0.475, -Math.cos(a) * rr); g.add(post);
    if (i === 0 || i === n) {
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), brass);
      fin.position.set(Math.sin(a) * rr, 0.99, -Math.cos(a) * rr); g.add(fin);
    }
  }
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 32; return new THREE.Vector3(Math.sin(a) * rr, 0.95, -Math.cos(a) * rr); }));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.022, 10, false), brass));
  const curve2 = new THREE.CatmullRomCurve3(Array.from({ length: 33 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 32; return new THREE.Vector3(Math.sin(a) * rr, 0.5, -Math.cos(a) * rr); }));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, 96, 0.01, 8, false), brass));
  F.shadowAll(g);
  return g;
}
