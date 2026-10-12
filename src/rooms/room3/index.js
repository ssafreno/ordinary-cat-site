// ROOM 3 — THE OBSERVATORY. Owner: room3 agent. See docs/DESIGN.md §5 and docs/notes/room3.md.
// Puzzles: telescope (find Felis) → orrery (inner 12, middle 3, outer 9) → rite (E, W, N, SW, SE) → lure (sardines).
// Engine convention: north = −Z, east = +X. The ritual circle's compass rose agrees with it.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as L from '../../engine/props/lights.js';
import { skyDome, moonTextures, moonMesh, shootingStar } from './sky.js';
import { ScopeView } from './scope.js';
import { drawInlay, drawStarChart, drawDomePaint, tex, INLAY_HALF, CANDLE_R, BEARINGS, bearingVec, SOLUTION } from './art.js';
import { telescope, orrery, lectern, drawPage, bowl, sardineTin, astrolabe, sextant, celestialGlobe, scroll, stairwell, glowTexture } from './props.js';

const R = 4.2;                 // tower radius
const WALL_H = 2.6;            // dome springs from here
const SLIT_HW = 0.5;           // half-width of the dome slit
const SLIT_Z = 0.2 * R;        // slit runs from the horizon over the zenith to here (dome-local z)
const C = new THREE.Vector3(-1.1, 0, -0.4);          // ritual circle centre
const TEL = new THREE.Vector3(2.3, 0, -1.1);         // telescope pier
const STAIRS = new THREE.Vector3(2.6, 0, 1.9);       // stairwell centre
const STAIRS_R = 0.7;
const ORRERY = new THREE.Vector3(0.3, 0, -2.4);
const LECTERN = C.clone().add(new THREE.Vector3(-0.707, 0, 0.707).multiplyScalar(1.55));
const RITE_ORDER = ['E', 'W', 'N', 'SW', 'SE'];
const CAT_SPOT = C.clone().add(new THREE.Vector3(0, 0, 0.3));    // where he sits in the circle
const TIN_SPOT = C.clone().add(new THREE.Vector3(0.02, 0, 0.52));
const DEG = Math.PI / 180;

const wallPos = (bearingDeg, inset, y = 0) => {
  const a = bearingDeg * DEG;
  return new THREE.Vector3(Math.sin(a) * (R - inset), y, -Math.cos(a) * (R - inset));
};
const onWall = (obj, bearingDeg, inset, y = 0) => { obj.position.copy(wallPos(bearingDeg, inset, y)); obj.rotation.y = -bearingDeg * DEG; return obj; };

export default class Room3 extends Room {
  static id = 'room3';
  static title = 'The Observatory';
  static vantage = { position: [1.35, 1.6, 2.75], lookAt: [-0.2, 1.15, -1.45], yawLimit: 95, pitchLimit: 38, fov: 60 };
  static puzzleOrder = ['telescope', 'orrery', 'rite', 'lure'];

  prereqMet(id) {
    const s = this.ctx.state;
    if (id === 'rite') return s.isSolved('orrery');
    if (id === 'lure') return s.isSolved('rite');
    return true;
  }

  // ===========================================================================================
  async build() {
    const { ctx } = this;
    const { state } = ctx;
    const G = this.group;
    this.background = new THREE.Color('#03050c');
    this.fog = null;
    this.envIntensity = 0.62;
    this.exposure = 1.12;
    this.bloom = { strength: 0.55, threshold: 0.78, radius: 0.55 };
    this._timers = [];
    this._busy = false;

    this._buildShell(G);
    this._buildSky(G);
    this._buildLights(G);
    this._buildStairs(G);
    this._buildTelescope(G);
    this._buildOrrery(G);
    this._buildChart(G);
    this._buildShelves(G);
    this._buildDoor(G);
    this._buildCircle(G);

    // ---- restore state ----------------------------------------------------------------------
    if (state.isSolved('telescope')) this.scope.showSolved();
    else { const pan = state.get('room3.scope.pan', [0, 0]); this.scope.setOffset(pan[0], pan[1]); }
    if (state.isSolved('telescope')) { const t = this.scope.felisTarget(); this.scope.setOffset(t.x, t.y); }
    if (state.isSolved('orrery')) this._showOrrerySolved(false);
    const riteDone = state.isSolved('rite');
    if (riteDone || state.get('room3.page.placed')) this.lecternObj.userData.page.visible = true;
    if (riteDone || state.get('room3.elixir.poured')) this._showElixir(false);
    const lit = riteDone ? RITE_ORDER : state.get('room3.candles', []);
    for (const k of lit) this.candles[k].userData.setLit(true);
    this._updateCircleTarget(true);
    if (state.isSolved('lure')) this.tin.visible = true;
  }

  // ---- architecture --------------------------------------------------------------------------
  _buildShell(G) {
    // floor with a hole for the stairwell
    const shape = new THREE.Shape(); shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(STAIRS.x, -STAIRS.z, STAIRS_R, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const fgeo = new THREE.ShapeGeometry(shape, 64); fgeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(fgeo, M.stone({ tint: '#5a5d6c', rows: 4, cols: 3, repeat: [0.62, 0.62], seed: 31 }));
    floor.receiveShadow = true; floor.name = 'r3.floor';
    G.add(floor);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(STAIRS_R, 0.03, 8, 48), M.smoothStone({ color: '#6b6a70' }));
    lip.rotation.x = Math.PI / 2; lip.position.set(STAIRS.x, 0.0, STAIRS.z); G.add(lip);

    // cylindrical stone wall + walnut wainscot + rails
    const wallMat = M.stone({ tint: '#454c62', rows: 4, cols: 3, repeat: [11, 1.3], seed: 7, unique: true });
    wallMat.side = THREE.BackSide;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL_H, 96, 1, true), wallMat);
    wall.position.y = WALL_H / 2; wall.receiveShadow = true; wall.name = 'r3.wall';
    G.add(wall);
    const wainMat = M.wood({ tint: '#3a2416', seed: 14, repeat: [14, 1], unique: true });
    wainMat.side = THREE.BackSide;
    const wain = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.9, 96, 1, true), wainMat);
    wain.position.y = 0.45; wain.receiveShadow = true; G.add(wain);
    const brass = M.brass();
    for (const [y, rr, t] of [[0.9, R - 0.05, 0.03], [WALL_H, R - 0.06, 0.06], [0.08, R - 0.04, 0.04]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, t, 10, 160), y === 0.08 ? M.walnut() : brass);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; G.add(ring);
    }
    // stone cornice under the dome
    const cornice = F.lathe([[R, WALL_H - 0.25], [R - 0.14, WALL_H - 0.2], [R - 0.18, WALL_H - 0.08], [R - 0.12, WALL_H], [R, WALL_H]], M.smoothStone({ color: '#7d7a80' }), 96);
    G.add(cornice);

    // the dome, slit cut by a shader (raycasts still hit it: the dome is the slit's hotspot)
    const domeMat = new THREE.MeshStandardMaterial({ map: tex(drawDomePaint()), side: THREE.BackSide, roughness: 0.85, metalness: 0.05 });
    domeMat.onBeforeCompile = (sh) => {
      sh.uniforms.uHW = { value: SLIT_HW }; sh.uniforms.uZ = { value: SLIT_Z };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vDomePos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDomePos = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDomePos;\nuniform float uHW; uniform float uZ;')
        .replace('void main() {', 'void main() {\n  if (abs(vDomePos.x) < uHW && vDomePos.z < uZ) discard;');
    };
    domeMat.customProgramCacheKey = () => 'r3-dome-slit';
    const domeG = this.domeGroup = new THREE.Group();
    domeG.position.y = WALL_H;
    const az = Math.atan2(TEL.x, -TEL.z); // slit faces the telescope
    domeG.rotation.y = -az;
    G.add(domeG);
    const dome = this.dome = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 40, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.name = 'r3.dome';
    domeG.add(dome);
    // brass ribs (stop at the slit) + slit rails
    const Rr = R - 0.05;
    const ribMat = M.brass({ color: '#b08a3a', roughness: 0.38 });
    const inSlit = (p, m = 0.08) => Math.abs(p.x) < SLIT_HW + m && p.z < SLIT_Z + m;
    for (let k = 0; k < 10; k++) {
      const psi = (k + 0.5) * (Math.PI * 2 / 10);
      const pts = [];
      for (let e = 0; e <= 30; e++) {
        const el = (e / 30) * (Math.PI / 2) * 0.98, rho = Rr * Math.cos(el);
        const p = new THREE.Vector3(rho * Math.sin(psi), Rr * Math.sin(el), -rho * Math.cos(psi));
        if (inSlit(p)) break;
        pts.push(p);
      }
      if (pts.length > 2) domeG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 8, false), ribMat));
    }
    for (const sx of [-1, 1]) {
      const x = sx * (SLIT_HW + 0.03), rho = Math.sqrt(Rr * Rr - x * x);
      const phiMax = Math.acos(-SLIT_Z / rho);
      const pts = [];
      for (let i = 0; i <= 40; i++) { const ph = (i / 40) * phiMax; pts.push(new THREE.Vector3(x, rho * Math.sin(ph), -rho * Math.cos(ph))); }
      domeG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.05, 10, false), brass));
    }
    const capPts = [];
    for (let i = 0; i <= 12; i++) { const x = -SLIT_HW - 0.03 + (i / 12) * (SLIT_HW * 2 + 0.06); capPts.push(new THREE.Vector3(x, Math.sqrt(Rr * Rr - x * x - SLIT_Z * SLIT_Z), SLIT_Z)); }
    domeG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(capPts), 16, 0.05, 10, false), brass));
    domeG.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

    this.ctx.hotspots.add({ id: 'r3.dome', object: dome, label: 'The dome', highlight: false, onClick: (info) => this._clickDome(info) });
  }

  /** World point on the slit's centre line at a given elevation (radians, from the dome's base). */
  _slitPoint(el, across = 0) {
    const p = new THREE.Vector3(across, R * Math.sin(el), -R * Math.cos(el));
    return this.domeGroup.localToWorld(p);
  }

  _buildSky(G) {
    const pivot = new THREE.Group(); pivot.position.y = WALL_H; pivot.rotation.set(0.42, 0, 0.2);
    const sky = this.sky = skyDome({ radius: 70 });
    pivot.add(sky);
    G.add(pivot);
    this.domeGroup.updateMatrixWorld(true);
    const V = new THREE.Vector3(...Room3.vantage.position);
    this._eye = V;
    // crescent moon, low in the slit as seen from the stairs
    const Q = this._slitPoint(19 * DEG, -0.05);
    const dir = Q.clone().sub(V).normalize();
    const [m0] = moonTextures();
    const moon = this.skyMoon = moonMesh(5.2, m0, { intensity: 1.7 });
    moon.position.copy(V).addScaledVector(dir, 50);
    moon.lookAt(V);
    moon.renderOrder = -7;
    moon.raycast = () => {}; moon.userData.noRaycast = true;
    G.add(moon);
    this.shooter = shootingStar({ length: 7, width: 0.22 });
    G.add(this.shooter);
    this._nextShoot = 6 + Math.random() * 8;
    this._shootAt = -99;
  }

  _fireShootingStar() {
    const V = this._eye;
    const el1 = (24 + Math.random() * 14) * DEG, el2 = el1 - (6 + Math.random() * 6) * DEG;
    const side = Math.random() < 0.5 ? 1 : -1;
    const a = this._slitPoint(el1, side * 1.6), b = this._slitPoint(el2, -side * 1.6);
    const from = V.clone().addScaledVector(a.sub(V).normalize(), 48);
    const to = V.clone().addScaledVector(b.sub(V).normalize(), 48);
    this.shooter.userData.fire(from, to, 0.75 + Math.random() * 0.3, V);
    this._shootAt = this._t || 0;
  }

  _clickDome() {
    const { dialogue } = this.ctx;
    const recent = (this._t || 0) - this._shootAt < 1.8;
    if (recent) { dialogue.caption('caption.shootingstar'); this.ctx.audio.play('sparkle', { gain: 0.5 }); return; }
    if (Math.random() < 0.3) {
      this._fireShootingStar();
      this.ctx.audio.play('sparkle', { gain: 0.5 });
      dialogue.caption('caption.shootingstar');
    } else dialogue.caption('caption.dome');
  }

  _buildLights(G) {
    G.add(L.ambientRig({ sky: '#5a6fb0', ground: '#17121c', hemi: 0.55, ambient: '#1c2442', ambientIntensity: 0.4 }));
    // moonlight through the slit (the one shadow caster)
    const src = this._slitPoint(28 * DEG).lerp(new THREE.Vector3(0, WALL_H + 1, 0), 0.12);
    const target = new THREE.Vector3(-0.2, 0, -0.3);
    const moonKey = L.keyLight({ color: '#9db7ff', intensity: 9, position: src.toArray(), target: target.toArray(), angle: 0.42, penumbra: 0.7, distance: 14, decay: 1.2, castShadow: true, mapSize: 1024 });
    G.add(moonKey);
    const shaft = L.lightShaft({ from: src.toArray(), to: [target.x - 0.1, 0, target.z], radiusTop: 0.35, radiusBottom: 1.0, color: '#9fb8ff', opacity: 0.12, square: false });
    G.add(shaft);
    G.add(P.dustMotes({ box: [1.8, 3.2, 1.8], center: [src.x * 0.45 + target.x * 0.55, 1.8, src.z * 0.45 + target.z * 0.55], count: 220, color: '#cfe0ff', opacity: 0.45 }));
    // warm lamp by the shelves (the one cosy light)
    const lamp = L.flickerLight({ color: '#ffae5a', intensity: 1.8, distance: 6, flicker: 0.1, speed: 0.7 });
    lamp.position.copy(wallPos(250, 0.7, 1.75));
    G.add(lamp);
    // cool moon fill so the telescope brass reads against the dark wall
    const fill = new THREE.PointLight('#8fa6ff', 1.6, 4.5, 1.6);
    fill.position.set(TEL.x - 0.9, 2.3, TEL.z + 0.9);
    G.add(fill);
    // golden light that pours from the dome when the orrery is set
    this.pourShaft = L.lightShaft({ from: [C.x * 0.35, WALL_H + 3.6, C.z * 0.35], to: [C.x, 0, C.z], radiusTop: 0.3, radiusBottom: 1.25, color: '#ffd88a', opacity: 0, square: false });
    G.add(this.pourShaft);
  }

  _buildStairs(G) {
    const V = new THREE.Vector3(...Room3.vantage.position);
    const toV = Math.atan2(V.x - STAIRS.x, -(V.z - STAIRS.z));
    const st = stairwell({ radius: STAIRS_R, gapAngle: toV, gapWidth: 1.1 });
    st.position.copy(STAIRS);
    G.add(st);
    const proxy = this.ctx.hotspots.proxyBox(STAIRS_R * 2, 1.0, STAIRS_R * 2);
    proxy.position.set(STAIRS.x, 0.4, STAIRS.z);
    G.add(proxy);
    this.ctx.hotspots.add({
      id: 'r3.stairs', object: proxy, label: 'Stairs down to the laboratory', highlight: st,
      enabled: () => !this._busy,
      onClick: () => { if (this.ctx.game.registry.has('room2')) this.ctx.game.goToRoom('room2'); else this.ctx.dialogue.caption('caption.step11'); },
    });
  }

  // ---- telescope + eyepiece view -----------------------------------------------------------
  _buildTelescope(G) {
    const { ctx } = this;
    const s = new THREE.Vector3(TEL.x, 0, TEL.z).normalize();
    const el = 50 * DEG;
    const dir = new THREE.Vector3(s.x * Math.cos(el), Math.sin(el), s.z * Math.cos(el)).normalize();
    const side = new THREE.Vector3(s.z, 0, -s.x);        // north-ish: barrel hangs behind the cat
    const tel = this.telescope = telescope({ dir, side });
    tel.position.copy(TEL);
    G.add(tel);
    tel.updateMatrixWorld(true);
    this.catPerch = TEL.clone().setY(tel.userData.headTopY);
    // eyepiece camera pose
    const eye = tel.userData.barrel.localToWorld(tel.userData.eyeLocal.clone());
    this.scopeCam = eye.clone().addScaledVector(dir, -0.16);
    this.scopeLook = eye.clone().addScaledVector(dir, 3);
    const scope = this.scope = new ScopeView(ctx);
    scope.place(this.scopeCam, this.scopeLook);
    G.add(scope.group);
    this.animate((dt, t) => scope.update(dt, t));

    ctx.hotspots.add({
      id: 'r3.telescope', object: tel, label: 'Telescope',
      enabled: () => !this._busy,
      onClick: () => this._openScope(),
    });
    // eyepiece hotspots
    const panEnd = () => this._scopeDragEnd();
    ctx.hotspots.add({
      id: 'r3.scope.sky', object: scope.dragProxy, label: 'The sky (drag)', scope: 'focus:r3.scope', highlight: false,
      onDragStart: () => { this._panning = true; },
      onDrag: ({ dx, dy }) => this._scopeDrag(dx, dy),
      onDragEnd: panEnd,
      onClick: () => { if (!ctx.state.isSolved('telescope') && !this._scopeDragged) ctx.dialogue.caption('caption.scope.drag'); }, // final: not after the first drag
    });
    ctx.hotspots.add({
      id: 'r3.scope.moon', object: scope.moon, label: 'The moon', scope: 'focus:r3.scope', highlight: false,
      onDrag: ({ dx, dy }) => this._scopeDrag(dx, dy),
      onDragEnd: panEnd,
      onClick: () => { scope.wink(); ctx.audio.play('sparkle', { gain: 0.35 }); ctx.dialogue.caption('caption.moon.wink'); },
    });
  }

  async _openScope() {
    const { camera, transitions, state, dialogue } = this.ctx;
    dialogue.hideCaption();
    await camera.focus({
      position: this.scopeCam, lookAt: this.scopeLook, scope: 'focus:r3.scope', fov: 40, duration: 0.85,
      onExit: () => { this.scope.group.visible = false; dialogue.hideCaption(); },
    });
    if (camera.scope !== 'focus:r3.scope') return;
    await transitions.fadeOut(0.16);
    if (camera.scope === 'focus:r3.scope') this.scope.group.visible = true;
    await transitions.fadeIn(0.4);
    if (!state.get('room3.scope.tip') && !state.isSolved('telescope')) {
      state.set('room3.scope.tip', true);
      dialogue.caption('caption.scope.drag');
    }
  }

  _scopeDrag(dx, dy) {
    if (this._scopeSolving) return;
    this.scope.dragBy(dx, dy);
    if (!this.ctx.state.isSolved('telescope') && this.scope.felisDist() < 0.05) this._solveTelescope();
  }

  _scopeDragEnd() {
    this._panning = false;
    const { state, dialogue } = this.ctx;
    const sc = this.scope;
    state.set('room3.scope.pan', [sc.offset.x, sc.offset.y]);
    // final: the "Drag to sweep the sky" tip has done its job once the player drags
    if (!this._scopeDragged) { this._scopeDragged = true; dialogue.hideCaption(); }
    if (this._scopeSolving) return;
    if (!state.isSolved('telescope') && sc.felisDist() < 0.12) { this._solveTelescope(); return; }
    const o = sc.otherAtCentre();
    if (o >= 0 && o !== this._lastOther) {
      const other = sc.others[o];
      const pool = this.ctx.script['caption.constellation.other'];
      dialogue.caption(Array.isArray(pool) ? pool[other.name % pool.length] : 'caption.constellation.other');
      if (!other.shown) {
        other.shown = true;
        this.ctx.tween.run(1.1, (k) => other.lines.userData.setProgress(k), { ease: 'inOutSine' });
      }
    }
    this._lastOther = o;
  }

  async _solveTelescope() {
    if (this._scopeSolving || this.ctx.state.isSolved('telescope')) return;
    const { ctx } = this;
    const { state, tween, audio, hotspots, dialogue } = ctx;
    this._scopeSolving = true;
    this.scope.cueEnabled = false;
    state.solve('telescope');
    hotspots.lock();
    dialogue.hideCaption();
    const sc = this.scope;
    const tgt = sc.felisTarget();
    const from = sc.offset.clone();
    await tween.run(0.6, (k) => sc.setOffset(from.x + (tgt.x - from.x) * k, from.y + (tgt.y - from.y) * k), { ease: 'outCubic' });
    state.set('room3.scope.pan', [tgt.x, tgt.y]);
    audio.play('sparkle', { gain: 0.6 });
    await tween.run(2.0, (k) => sc.felisLines.forEach((l, i) => l.userData.setProgress(THREE.MathUtils.clamp(k * 1.25 - i * 0.25, 0, 1))), { ease: 'inOutSine' });
    audio.play('chime');
    const m0 = sc.moon.position.clone();
    tween.run(2.4, (k) => sc.moon.position.lerpVectors(m0, sc.moonUnderFelis, k), { ease: 'inOutCubic' });
    await tween.delay(1.4);
    tween.to(sc.glyph.material, { opacity: 0.8 }, { duration: 1.6, ease: 'inOutSine' });
    await tween.delay(1.4);
    hotspots.unlock();
    this._scopeSolving = false;
    await dialogue.say('react.telescope.solved');
  }

  // ---- orrery ------------------------------------------------------------------------------
  _buildOrrery(G) {
    const { ctx } = this;
    const { state, hotspots } = ctx;
    const ped = F.pedestal({ h: 0.95, r: 0.2, material: M.smoothStone({ color: '#77727a' }) });
    ped.position.copy(ORRERY); G.add(ped);
    const orr = this.orrery = orrery();
    orr.position.copy(ORRERY).setY(0.95);
    G.add(orr);
    const pos = this.orreryPos = state.isSolved('orrery') ? [...SOLUTION] : state.get('room3.orrery.pos', [5, 8, 2]);
    orr.userData.arms.forEach((a, i) => { a.arm.rotation.y = -pos[i] * Math.PI / 6; });
    // final: near top-down focus camera (was [x, 1.52, z+0.5] → [x, 1.02, z-0.02], fov 50) so the rings read as a
    // plan and no planet hides another; the sun's halo is dimmed while focused so the numerals stay legible.
    const focus = () => ctx.camera.focus({
      position: [ORRERY.x, 1.85, ORRERY.z + 0.14], lookAt: [ORRERY.x, 1.0, ORRERY.z + 0.02], scope: 'focus:r3.orrery', fov: 54,
      onExit: () => {
        ctx.dialogue.hideCaption(); orr.userData.haloDim = 1;
        if (!state.isSolved('orrery')) orr.userData.sunMat.emissiveIntensity = 2.2;
      },
    }).then(() => {
      if (ctx.camera.scope === 'focus:r3.orrery') {
        orr.userData.haloDim = 0.4;
        if (!state.isSolved('orrery')) orr.userData.sunMat.emissiveIntensity = 1.1;
      }
      if (!state.get('room3.orrery.tip') && !state.isSolved('orrery')) {
        state.set('room3.orrery.tip', true);
        ctx.dialogue.caption('caption.orrery.look');
        ctx.tween.delay(3.2).then(() => { if (ctx.camera.scope === 'focus:r3.orrery') ctx.dialogue.caption('caption.orrery.help', { duration: 5 }); });
      }
    });
    const proxy = hotspots.proxyBox(0.62, 1.4, 0.62); proxy.position.set(ORRERY.x, 0.7, ORRERY.z); G.add(proxy);
    hotspots.add({ id: 'r3.orrery', object: proxy, label: 'Orrery', highlight: orr, enabled: () => !this._busy, onClick: focus });
    const names = ['Inner planet', 'Middle planet', 'Outer planet'];
    // dir +1 = forward (click), -1 = back (right-click or shift+click)
    const step = (i, dir) => {
      const a = orr.userData.arms[i];
      pos[i] = (pos[i] + dir + 12) % 12;
      ctx.audio.play('ratchet', dir < 0 ? { pitch: 0.85 } : undefined);
      ctx.tween.to(a.arm.rotation, { y: a.arm.rotation.y - dir * Math.PI / 6 }, { duration: 0.32, ease: 'outBack' });
      state.set('room3.orrery.pos', [...pos]);
      if (pos.every((p, j) => p === SOLUTION[j])) this._solveOrrery();
    };
    orr.userData.arms.forEach((a, i) => {
      hotspots.add({
        id: `r3.orrery.p${i}`, object: a.proxy, label: names[i], scope: 'focus:r3.orrery', highlight: a.planet,
        enabled: () => !state.isSolved('orrery'),
        onClick: (info) => step(i, info?.event?.shiftKey ? -1 : 1),
      });
    });
    // right-click on a planet steps it back (the engine's own contextmenu handler only deselects items)
    const canvas = ctx.renderer?.three?.domElement || document.querySelector('canvas');
    canvas?.addEventListener('contextmenu', (e) => {
      if (ctx.game.currentRoom !== this || hotspots.scope !== 'focus:r3.orrery' || hotspots.locked) return;
      if (ctx.dialogue?.isOpen || ctx.inventory?.selected || state.isSolved('orrery')) return;
      e.preventDefault();
      hotspots.pointer.copy(hotspots._ndc(e));
      const id = hotspots.pick()?.hotspot?.id || '';
      const m = /^r3\.orrery\.p(\d)$/.exec(id);
      if (m) step(+m[1], -1);
    });
    hotspots.add({ id: 'r3.orrery.sun', object: orr.userData.sun, label: 'The sun', scope: 'focus:r3.orrery', onClick: () => ctx.dialogue.caption('caption.orrery.look') });
  }

  _showOrrerySolved(animate) {
    const ud = this.orrery.userData;
    if (!animate) {
      ud.sunMat.emissiveIntensity = 3.2; ud.sunLight.intensity = 0.3; ud.halo.scale.setScalar(0.34);
      this.lecternObj && (this.lecternObj.userData.lid.rotation.x = -1.95);
      this.pourShaft.userData.setOpacity(0.07);
    }
  }

  async _solveOrrery() {
    const { ctx } = this;
    const { state, tween, audio, hotspots, camera, dialogue } = ctx;
    if (state.isSolved('orrery')) return;
    state.solve('orrery');
    hotspots.lock();
    this._busy = true;
    const ud = this.orrery.userData;
    await tween.delay(0.4);
    audio.play('chime');
    const sunWorld = ud.sun.getWorldPosition(new THREE.Vector3());
    P.burst(ctx, this.group, sunWorld.toArray(), { color: '#ffd27a', color2: '#ff9a4a', count: 120, radius: 0.35, size: 0.02 });
    tween.to(ud.sunMat, { emissiveIntensity: 10 }, { duration: 0.35, ease: 'outCubic' }).then(() => tween.to(ud.sunMat, { emissiveIntensity: 3.2 }, { duration: 1.8, ease: 'inOutSine' }));
    tween.to(ud.halo.scale, { x: 0.7, y: 0.7 }, { duration: 0.35, ease: 'outCubic' }).then(() => tween.to(ud.halo.scale, { x: 0.34, y: 0.34 }, { duration: 1.8 }));
    tween.to(ud.sunLight, { intensity: 1.2 }, { duration: 0.35 }).then(() => tween.to(ud.sunLight, { intensity: 0.3 }, { duration: 1.8 }));
    await tween.delay(1.3);
    await camera.exitFocus({ all: true });
    camera.lookAtPoint([C.x, 0.4, C.z]);
    // light pours down from the dome onto the circle
    audio.play('sparkle');
    const sh = this.pourShaft.userData;
    await tween.run(1.0, (k) => sh.setOpacity(0.55 * k), { ease: 'inQuad' });
    this._updateCircleTarget();
    this._circleFlash = 1.6;
    P.burst(ctx, this.group, [C.x, 0.15, C.z], { color: '#ffe2a0', color2: '#c9a0ff', count: 140, radius: 1.0, size: 0.03 });
    tween.run(2.6, (k) => sh.setOpacity(0.55 - 0.48 * k), { ease: 'inOutSine' });
    await tween.delay(0.6);
    // the lectern cover slides open
    camera.lookAtPoint([LECTERN.x, 0.9, LECTERN.z]);
    audio.play('drawerOpen');
    await tween.to(this.lecternObj.userData.lid.rotation, { x: -1.95 }, { duration: 1.3, ease: 'outCubic' });
    hotspots.unlock();
    this._busy = false;
    await dialogue.say('react.orrery.solved');
  }

  // ---- wall chart ----------------------------------------------------------------------------
  _buildChart(G) {
    const { ctx } = this;
    const body = ctx.paperDefs?.star_chart_note?.body || '';
    const note = body.split('\n').filter((l) => l.trim() && !l.startsWith('('));
    const names = ctx.script?.['caption.constellation.other'] || [];
    const chartTex = tex(drawStarChart({ note, names }));
    const frame = F.pictureFrame({ w: 1.5, h: 1.0, style: 'walnut', texture: chartTex });
    onWall(frame, Math.atan2(ORRERY.x, -ORRERY.z) / DEG, 0.12, 1.85);
    G.add(frame);
    ctx.hotspots.add({ id: 'r3.chart', object: frame, label: 'Star chart', onClick: () => { ctx.audio.play('paperRustle', { gain: 0.6 }); ctx.papers.show('star_chart_note'); } });
  }

  // ---- shelves of instruments ---------------------------------------------------------------
  _buildShelves(G) {
    const { ctx } = this;
    const shelf = F.bookshelf({ w: 1.5, h: 2.2, d: 0.36, shelves: 4, fill: 0.7, seed: 33, reserve: [{ shelf: 1, from: 0.0, to: 0.55 }, { shelf: 2, from: 0.45, to: 1.0 }, { shelf: 3, from: 0.0, to: 1.0 }] });
    onWall(shelf, 252, 0.26);
    G.add(shelf);
    const ys = shelf.userData.shelfYs;
    const put = (obj, x, shelfIdx, z = 0.02) => { obj.position.set(x, ys[shelfIdx] + 0.005, z); shelf.add(obj); return obj; };
    const astro = put(astrolabe(), -0.42, 1);
    const sext = put(sextant(), -0.12, 1); sext.rotation.x = -0.25; sext.position.y += 0.18;
    const globe = put(celestialGlobe(), 0.35, 2);
    for (let i = 0; i < 4; i++) { const sc = put(scroll(0.3 + i * 0.03, 0.02 + (i % 2) * 0.005, i % 2 ? '#e8d5a6' : '#d9c28c'), 0.05 + (i % 2) * 0.04, 2, -0.04 + i * 0.035); sc.position.y += 0.022 + (i > 1 ? 0.04 : 0); sc.rotation.y = 0.1 * i; }
    for (let i = 0; i < 3; i++) { const cd = F.candle({ holder: 'dish', light: false, lit: i !== 1, h: 0.12 + i * 0.03 }); put(cd, -0.5 + i * 0.16, 3); }
    const brassScope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.5, 16), M.brass({ polished: true }));
    brassScope.rotation.z = Math.PI / 2 - 0.08; put(brassScope, 0.35, 3, 0.0).position.y += 0.04;
    const hs = ctx.hotspots;
    hs.add({ id: 'r3.shelves', object: shelf, label: 'Shelves of instruments', onClick: () => ctx.dialogue.caption('caption.r3.shelves') });
    hs.add({ id: 'r3.astrolabe', object: astro, label: 'Astrolabe', onClick: () => { ctx.audio.play('click'); ctx.dialogue.caption('caption.r3.astrolabe'); } });
    hs.add({ id: 'r3.sextant', object: sext, label: 'Sextant', onClick: () => ctx.dialogue.caption('caption.r3.sextant') });
    hs.add({
      id: 'r3.globe', object: globe, label: 'Celestial globe',
      onClick: () => { this._globeSpin = 9; ctx.audio.play('swoosh', { gain: 0.5 }); ctx.dialogue.caption('caption.r3.globe'); },
    });
    this._globe = globe.userData.sphere;
    this._globeSpin = 0;
  }

  // ---- the tower's other door (used by the ending) -----------------------------------------
  _buildDoor(G) {
    const { ctx } = this;
    const door = this.exitDoor = F.door({ w: 1.05, h: 2.1, rune: true, runeColor: '#bfe0ff', frame: 'stone', seed: 9, tint: '#5a3a22' });
    onWall(door, 302, 0.1);
    G.add(door);
    ctx.hotspots.add({
      id: 'r3.exitdoor', object: door, label: 'Sealed door',
      onClick: () => {
        ctx.audio.play('zap');
        ctx.transitions.flash('#bfe3ff', 0.4);
        ctx.camera.shake(0.05);
        ctx.cat.react?.('flinch');
        ctx.dialogue.say('react.frontdoor.zap');
      },
    });
  }

  // ---- ritual circle -------------------------------------------------------------------------
  _buildCircle(G) {
    const { ctx } = this;
    const { hotspots, state } = ctx;
    const size = INLAY_HALF * 2;
    const inlayMat = this.inlayMat = new THREE.MeshStandardMaterial({
      map: tex(drawInlay('base')), emissiveMap: tex(drawInlay('mask', 1024)), emissive: new THREE.Color('#ffc870'), emissiveIntensity: 0,
      transparent: true, roughness: 0.35, metalness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    const inlay = new THREE.Mesh(new THREE.PlaneGeometry(size, size), inlayMat);
    inlay.rotation.x = -Math.PI / 2; inlay.position.set(C.x, 0.003, C.z); inlay.receiveShadow = true;
    inlay.raycast = () => {}; inlay.userData.noRaycast = true;
    G.add(inlay);
    const glowMat = this.glowMat = new THREE.MeshBasicMaterial({ map: tex(drawInlay('glow', 1024)), color: new THREE.Color('#ffb85a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glowMat);
    glow.rotation.x = -Math.PI / 2; glow.position.set(C.x, 0.012, C.z);
    glow.raycast = () => {}; glow.userData.noRaycast = true; glow.renderOrder = 4;
    G.add(glow);
    // soft violet pool of light above the circle when it comes alive
    const pool = this.poolLight = new THREE.PointLight('#c79bff', 0, 4.5, 1.6);
    pool.position.set(C.x, 0.7, C.z); G.add(pool);
    this.sparks = P.embers({ origin: [C.x, 0.02, C.z], spread: 1.05, rise: 1.9, count: 160, color: '#c9a0ff', color2: '#ffe2a0', size: 0.035, opacity: 0 });
    G.add(this.sparks);
    this.circleCur = { e: 0, glow: 0, spark: 0, pool: 0 };
    this.circleTarget = { ...this.circleCur };
    this._circleFlash = 0;

    // centre bowl on the compass rose
    const b = this.bowl = bowl();
    b.position.copy(C); G.add(b);
    this.elixirSparkle = P.sparkles({ box: [0.22, 0.18, 0.22], center: [C.x, 0.2, C.z], count: 26, color: '#e2b8ff', color2: '#ffffff', size: 0.04 });
    this.elixirSparkle.visible = false; G.add(this.elixirSparkle);
    const bowlProxy = hotspots.proxyBox(0.32, 0.3, 0.32); bowlProxy.position.set(C.x, 0.12, C.z); G.add(bowlProxy);
    const sardines = () => this._sardinesOnCircle();
    hotspots.add({
      id: 'r3.bowl', object: bowlProxy, label: 'Brass bowl', highlight: b,
      enabled: () => !this._busy,
      onClick: () => ctx.dialogue.caption(state.get('room3.elixir.poured') || state.isSolved('rite') ? 'caption.bowl.full' : 'caption.bowl.empty'),
      useItem: { elixir: () => this._pourElixir(), sardines },
    });

    // candles at the five points
    this.candles = {};
    for (const [k, bdeg] of Object.entries(BEARINGS)) {
      const [x, z] = bearingVec(bdeg);
      const cd = F.candle({ h: 0.24, r: 0.03, holder: 'dish', light: true, intensity: 1.15, distance: 3.6, lit: false });
      cd.scale.setScalar(1.35);
      cd.position.set(C.x + x * CANDLE_R, 0, C.z + z * CANDLE_R);
      cd.userData.key = k;
      cd.userData.seed = Math.random() * 10;
      G.add(cd);
      this.candles[k] = cd;
      const proxy = hotspots.proxyBox(0.22, 0.42, 0.22);   // hugs the candle (top ~0.4 m) so it no longer hides the bowl behind it (release-qa)
      proxy.position.set(cd.position.x, 0.21, cd.position.z); G.add(proxy);
      hotspots.add({
        id: `r3.candle.${k}`, object: proxy, label: 'Candle', highlight: cd,
        enabled: () => !this._busy,
        onClick: () => this._clickCandle(k),
        useItem: { sardines },
      });
    }

    // the circle itself (a flat click volume over the inlay)
    const circleProxy = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.04, 40), new THREE.MeshBasicMaterial({ visible: false }));
    circleProxy.position.set(C.x, 0.02, C.z); G.add(circleProxy);
    hotspots.add({
      id: 'r3.circle', object: circleProxy, label: 'Ritual circle', highlight: false,
      enabled: () => !this._busy,
      onClick: () => {
        const s = state;
        if (s.isSolved('rite')) ctx.dialogue.caption('caption.circle.ready');
        else if (s.isSolved('orrery')) ctx.dialogue.caption('caption.circle.waiting');
        else ctx.dialogue.caption('caption.circle.unready');
      },
      useItem: { elixir: () => this._pourElixir(), sardines },
    });

    // lectern at the south-west edge
    const lec = this.lecternObj = lectern({ pageDraw: () => drawPage(ctx.paperDefs?.page_incantation) });
    lec.position.copy(LECTERN);
    lec.rotation.y = -0.45;           // reading face toward the south (and the player)
    G.add(lec);
    if (state.isSolved('orrery')) lec.userData.lid.rotation.x = -1.95;
    hotspots.add({
      id: 'r3.lectern', object: lec, label: 'Lectern',
      enabled: () => !this._busy,
      onClick: () => {
        if (!state.isSolved('orrery')) return ctx.dialogue.caption('caption.lectern.closed');
        if (lec.userData.page.visible) { ctx.audio.play('page'); return ctx.papers.show('page_incantation'); }
        ctx.dialogue.caption('caption.lectern.open');
      },
      useItem: {
        page_incantation: () => {
          if (!state.isSolved('orrery')) { ctx.audio.play('error'); ctx.dialogue.caption('caption.lectern.closed'); return false; }
          ctx.inventory.remove('page_incantation');
          state.set('room3.page.placed', true);
          ctx.audio.play('page');
          const page = lec.userData.page;
          page.visible = true; page.scale.setScalar(0.01);
          ctx.tween.to(page.scale, { x: 1, y: 1, z: 1 }, { duration: 0.5, ease: 'outBack' });
          this._updateCircleTarget();
        },
      },
    });

    // the sardine tin (appears for the lure)
    const tin = this.tin = sardineTin();
    tin.position.copy(TIN_SPOT); tin.rotation.y = 0.3; tin.visible = false;
    G.add(tin);
  }

  _pourElixir() {
    const { ctx } = this;
    if (ctx.state.get('room3.elixir.poured')) return;
    ctx.inventory.remove('elixir');
    ctx.state.set('room3.elixir.poured', true);
    ctx.audio.play('pour');
    this._showElixir(true);
    this._updateCircleTarget();
  }

  _showElixir(animate) {
    const { liquid, liquidMat } = this.bowl.userData;
    liquid.visible = true;
    this.elixirSparkle.visible = true;
    if (!animate) { liquidMat.emissiveIntensity = 1.6; return; }
    liquid.scale.setScalar(0.2);
    this.ctx.tween.to(liquid.scale, { x: 1, y: 1, z: 1 }, { duration: 1.2, ease: 'outCubic' });
    this.ctx.tween.to(liquidMat, { emissiveIntensity: 1.6 }, { duration: 1.6, ease: 'inOutSine' });
    P.burst(this.ctx, this.group, [C.x, 0.18, C.z], { color: '#d6a8ff', color2: '#ffffff', count: 60, radius: 0.3, size: 0.02 });
  }

  _riteReady() {
    const s = this.ctx.state;
    return s.isSolved('orrery') && !!s.get('room3.page.placed') && !!s.get('room3.elixir.poured');
  }

  /** Recompute how bright the circle should be from state (the update loop eases toward it). */
  _updateCircleTarget(instant = false) {
    const s = this.ctx.state;
    const t = { e: 0, glow: 0, spark: 0, pool: 0 };
    if (s.isSolved('orrery')) {
      const n = s.isSolved('rite') ? 5 : s.get('room3.candles', []).length;
      t.e = 0.55 + n * 0.32; t.glow = 0.12 + n * 0.09; t.spark = 0.15 + n * 0.12; t.pool = 0.3 + n * 0.35;
      if (this._riteReady()) { t.e += 0.2; t.glow += 0.05; }
      if (s.isSolved('rite')) { t.e = 2.6; t.glow = 0.75; t.spark = 1.0; t.pool = 3.2; }
    }
    this.circleTarget = t;
    if (instant) this.circleCur = { ...t };
  }

  _clickCandle(k) {
    const { ctx } = this;
    const { state, dialogue, audio } = ctx;
    const cd = this.candles[k];
    if (state.isSolved('rite') || cd.userData.lit) { dialogue.caption('caption.candle.lit'); return; }
    if (!this._riteReady()) {
      if (!state.isSolved('orrery')) dialogue.caption('caption.circle.unready');
      else dialogue.caption('caption.candle.unlit');
      return;
    }
    const lit = state.get('room3.candles', []);
    audio.play('candleLight');
    cd.userData.setLit(true);
    const fy = cd.userData.flameY * cd.scale.y;
    P.burst(ctx, this.group, [cd.position.x, fy + 0.03, cd.position.z], { color: '#ffd27a', color2: '#ff8a3a', count: 30, radius: 0.15, size: 0.015, duration: 0.8 });
    if (k === RITE_ORDER[lit.length]) {
      lit.push(k);
      state.set('room3.candles', lit);
      this._updateCircleTarget();
      this._circleFlash = 0.8;
      if (lit.length === RITE_ORDER.length) this._solveRite();
    } else this._riteWrong();
  }

  async _riteWrong() {
    const { ctx } = this;
    const { state, tween, audio, dialogue, hotspots } = ctx;
    this._busy = true;
    hotspots.lock();
    await tween.delay(0.6);
    audio.play('gust');
    this._gust = 1.6;
    await tween.delay(0.45);
    for (const cd of Object.values(this.candles)) cd.userData.setLit(false);
    state.set('room3.candles', []);
    this._updateCircleTarget();
    ctx.cat.react?.('flinch');
    await tween.delay(0.5);
    hotspots.unlock();
    this._busy = false;
    await dialogue.say('react.rite.wrong');
  }

  async _solveRite() {
    const { ctx } = this;
    const { state, tween, audio, dialogue, hotspots } = ctx;
    state.solve('rite');
    this._busy = true;
    hotspots.lock();
    await tween.delay(0.5);
    audio.play('chime');
    audio.loop('hum', { gain: 0.7, fade: 2 });
    this._updateCircleTarget();
    this._circleFlash = 2.2;
    P.burst(ctx, this.group, [C.x, 0.2, C.z], { color: '#e7c4ff', color2: '#ffe2a0', count: 180, radius: 1.3, size: 0.035, duration: 2 });
    ctx.camera.shake(0.012, 0.8);
    await tween.delay(1.4);
    hotspots.unlock();
    this._busy = false;
    await dialogue.say('react.rite.solved');
  }

  // ---- the lure ------------------------------------------------------------------------------
  _sardinesOnCircle() {
    const { ctx } = this;
    if (ctx.state.isSolved('rite') && !ctx.state.isSolved('lure')) { this._lure(); return; }
    ctx.dialogue.say('react.sardines.early');
    return false;
  }

  _catClick() {
    const { ctx } = this;
    const s = ctx.state;
    if (ctx.game.currentRoom !== this) return ctx.hints.ask();
    if (this._luring) return;
    if (s.isSolved('rite') && !s.isSolved('lure') && !ctx.dialogue.busy) {
      if (!s.get('room3.confront.seen')) { s.set('room3.confront.seen', true); ctx.cat.react?.('perk'); return ctx.dialogue.choice('choice.room3.confront'); }
      if (!s.get('room3.subject.seen')) { s.set('room3.subject.seen', true); ctx.cat.react?.('tailFlick'); return ctx.dialogue.say('react.lure.subject'); }
    }
    return ctx.hints.ask();
  }

  _catSardines() {
    const { ctx } = this;
    const pool = ctx.script['react.sardines.cat'];
    if (ctx.game.currentRoom !== this) { ctx.dialogue.say(pool?.[0] || 'react.sardines.cat'); return false; }
    if (this._luring) return false;
    if (ctx.state.isSolved('rite') && !ctx.state.isSolved('lure')) { this._lure(); return; }
    const n = ctx.state.inc('room3.sardines.cat');
    ctx.cat.react?.('perk');
    ctx.dialogue.say(pool ? pool[Math.min(n - 1, pool.length - 1)] : 'react.sardines.cat');
    return false;
  }

  async _lure() {
    if (this._luring) return;
    const { ctx } = this;
    const { tween, audio, dialogue, hotspots, camera, cat, state } = ctx;
    this._luring = true;
    this._busy = true;
    hotspots.lock();
    ctx.inventory.remove('sardines');
    if (camera.inFocus) await camera.exitFocus({ all: true });
    // the tin appears in the circle, lid peeled back
    audio.play('tinPeel');
    const tin = this.tin;
    tin.visible = true; tin.scale.setScalar(0.01);
    tween.to(tin.scale, { x: 1, y: 1, z: 1 }, { duration: 0.6, ease: 'outBack' });
    P.burst(ctx, this.group, [TIN_SPOT.x, 0.08, TIN_SPOT.z], { color: '#fff2c0', color2: '#c9d4e0', count: 30, radius: 0.18, size: 0.015, duration: 0.9 });
    camera.lookAtPoint([(TIN_SPOT.x + TEL.x) / 2, 0.8, (TIN_SPOT.z + TEL.z) / 2]);
    const tinWorld = tin.getWorldPosition(new THREE.Vector3()).setY(0.05);
    cat.lookAt(tinWorld);
    await cat.react('perk');
    await tween.delay(2.2);                                   // the long look
    await dialogue.say('react.lure.beat1');
    cat.react('tailFlick');
    await tween.delay(1.6);
    await dialogue.say('react.lure.beat2');
    // down from the telescope, across, into the circle
    cat.lookAt(null);
    await cat.setPose('stand', 0.4);
    const g = cat.group;
    const p0 = g.position.clone();
    const land = TEL.clone().add(new THREE.Vector3(-0.55, 0, 0.5));
    g.rotation.y = Math.atan2(land.x - p0.x, land.z - p0.z);
    audio.play('swoosh', { gain: 0.4 });
    await tween.run(0.55, (k) => {
      g.position.lerpVectors(p0, land, k);
      g.position.y = p0.y * (1 - k) + Math.sin(Math.PI * k) * 0.35 + land.y * k;
    }, { ease: 'linear' });
    audio.play('footstep', { gain: 0.6 });
    camera.lookAtPoint([C.x + 0.4, 0.5, C.z]);
    await cat.walkTo([0.15, 0, 0.12]);
    await cat.walkTo(CAT_SPOT.toArray());
    // face the tin (south), sit, eat
    await tween.to(g.rotation, { y: Math.atan2(TIN_SPOT.x - CAT_SPOT.x, TIN_SPOT.z - CAT_SPOT.z) }, { duration: 0.6, ease: 'inOutSine' });
    cat.lookAt(tinWorld);
    audio.play('purr', { gain: 0.8 });
    await tween.delay(0.8);
    await dialogue.say('react.lure.solved');
    await this._ending();
  }

  /** ENDING TRIGGER — contract with the ending room (see docs/notes/room3.md). */
  async _ending() {
    const { ctx } = this;
    const { state, tween, audio, camera, renderer, transitions, game } = ctx;
    state.solve('lure');
    audio.play('ritualSwell');
    this._endingRun = true;
    const bp = renderer.bloomPass;
    const b0 = { s: bp?.strength ?? 0.55, th: bp?.threshold ?? 0.78, r: bp?.radius ?? 0.55 };
    const e0 = renderer.three.toneMappingExposure;
    for (const cd of Object.values(this.candles)) { const l = cd.userData.light; if (l) l.userData.baseIntensity = l.userData.baseIntensity * 3.5; cd.userData.setLit(true); }
    camera.lookAtPoint([C.x, 0.6, C.z]);
    camera.shake(0.018, 2.5);
    tween.delay(2.0).then(() => { audio.play('whiteout'); audio.setRoomAmbience('ending'); });
    await tween.run(2.5, (k) => {
      this._endK = k;
      renderer.setBloom(b0.s + k * 2.4, { threshold: b0.th - k * 0.6, radius: b0.r + k * 0.35 });
      renderer.setExposure(e0 + k * 0.9);
    }, { ease: 'inQuad' });
    await transitions.whiteOut(1.2);
    audio.stopLoop('hum', 2);
    if (game.registry.has('ending')) {
      await game.goToRoom('ending', { fade: false });
    } else {
      console.warn('[room3] ending room is not registered; staying in room3 (expected until the ENDING agent lands)');
      renderer.setBloom(b0.s, { threshold: b0.th, radius: b0.r });
      renderer.setExposure(e0);
      this._endK = 0;
      ctx.hotspots.unlock();
      this._busy = false;
      await transitions.fadeIn(1.5);
    }
  }

  // ===========================================================================================
  _placeCat() {
    const { ctx, state } = this;
    const hotspot = {
      onClick: () => this._catClick(),
      onHover: (on) => { this._stare = on ? 0 : -1; },
      useItem: {
        sardines: () => this._catSardines(),
        parcel: () => { ctx.dialogue.say('react.parcel.cat'); return false; },
      },
    };
    if (state.isSolved('lure')) {
      ctx.cat.placeAt(this.group, { position: CAT_SPOT.toArray(), rotationY: 0, pose: 'sit', hotspot });
    } else {
      ctx.cat.placeAt(this.group, { position: this.catPerch.toArray(), rotationY: -0.24, pose: 'loaf', hotspot });
    }
    this._perchAlt = 0;
  }

  get state() { return this.ctx.state; }

  enter() {
    const { ctx } = this;
    const { state } = ctx;
    ctx.audio.setRoomAmbience('room3');
    this._placeCat();
    this._stare = -1;
    this._stareCool = 0;
    this._busy = false;
    this._luring = false;
    if (state.isSolved('rite') && !state.isSolved('lure')) ctx.audio.loop('hum', { gain: 0.7, fade: 2 });
    if (!state.get('room3.intro.seen')) {
      state.set('room3.intro.seen', true);
      ctx.tween.delay(1.0).then(() => { if (ctx.game.currentRoom === this) ctx.dialogue.say('room3.intro'); });
    }
  }

  enterTitle() {
    this._placeCat();
  }

  exit() {
    this.ctx.audio.stopLoop('hum', 1);
    this.ctx.cat.lookAt(null);
    this.scope.group.visible = false;
    this._stare = -1;
  }

  update(dt, t) {
    this._t = t;
    const { ctx } = this;
    // sky
    this.sky.rotation.y += dt * 0.0045;
    this._nextShoot -= dt;
    if (this._nextShoot <= 0) { this._fireShootingStar(); this._nextShoot = 9 + Math.random() * 14; }
    // celestial globe spin-down
    if (this._globeSpin > 0.01) { this._globe.rotation.y += this._globeSpin * dt; this._globeSpin *= Math.pow(0.45, dt); }
    // candle draft: flames lean together in slow gusts
    if (this._gust > 0) this._gust -= dt;
    const draft = Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
    const gust = Math.max(0, this._gust || 0);
    for (const cd of Object.values(this.candles)) {
      const f = cd.userData.flame, sd = cd.userData.seed;
      f.rotation.z = draft * 0.16 + Math.sin(t * 7.1 + sd) * 0.05 + gust * 0.5;
      f.rotation.x = Math.sin(t * 5.3 + sd * 2) * 0.05 + draft * 0.06;
    }
    // circle glow eases toward its target; hum pulse when ready; flash on events
    const tg = this.circleTarget, cur = this.circleCur;
    const a = Math.min(1, dt * 1.6);
    for (const k of Object.keys(cur)) cur[k] += (tg[k] - cur[k]) * a;
    if (this._circleFlash > 0) this._circleFlash = Math.max(0, this._circleFlash - dt * 1.2);
    const ready = ctx.state.isSolved('rite');
    const pulse = ready ? 1 + 0.18 * Math.sin(t * 2.4) : 1 + 0.05 * Math.sin(t * 1.3);
    const fl = this._circleFlash;
    const ek = this._endK || 0;
    this.inlayMat.emissiveIntensity = (cur.e * pulse + fl * 1.2) * (1 + ek * 4);
    this.glowMat.opacity = Math.min(1, (cur.glow * pulse + fl * 0.3) * (1 + ek * 2));
    this.sparks.userData.setOpacity(Math.min(2.5, cur.spark * (ready ? pulse : 1) + fl * 0.4 + ek * 1.5));
    this.poolLight.intensity = (cur.pool * pulse + fl * 2) * (1 + ek * 3);
    // the cat shifts if stared at
    this._stareCool = Math.max(0, (this._stareCool || 0) - dt);
    if (this._stare >= 0) {
      this._stare += dt;
      if (this._stare > 4 && this._stareCool <= 0 && !this._luring && !ctx.dialogue.busy && !ctx.state.isSolved('lure')) {
        this._stare = 0; this._stareCool = 14;
        this._shiftCat();
      }
    }
  }

  async _shiftCat() {
    const { ctx } = this;
    const cat = ctx.cat;
    if (cat.group.parent !== this.group) return;
    await cat.react('stretch');
    if (this._luring) return;
    this._perchAlt = (this._perchAlt + 1) % 3;
    const offs = [[0, 0, -0.24], [0.06, -0.05, -0.55], [-0.05, 0.04, 0.1]][this._perchAlt];
    const to = this.catPerch.clone().add(new THREE.Vector3(offs[0], 0, offs[1]));
    ctx.tween.to(cat.group.position, { x: to.x, z: to.z }, { duration: 0.8, ease: 'inOutSine' });
    ctx.tween.to(cat.group.rotation, { y: offs[2] }, { duration: 0.8, ease: 'inOutSine' });
  }
}
