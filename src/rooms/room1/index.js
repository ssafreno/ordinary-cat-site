// ROOM 1 — THE STUDY (`room1`). Owner: ROOM1 agent. See docs/DESIGN.md §5 and docs/notes/room1.md.
//
// Layout (metres, floor centre origin; north = −Z is the back wall, the player stands near +Z):
//   west  (−X): fireplace + mantel (sampler, candlesticks, hourglass), armchair with the cushion, rug, BEAN bowl
//   north (−Z): puzzle bookshelf (swings open → alcove with the grimoire), arched window + moon shaft, portrait
//   east  (+X): lab door (NE corner), grandfather clock, writing desk (cat, quill, drawer), globe
//   south (+Z): the front door behind the player (sealed — zaps), hat pegs
// Puzzles: clock → desk → shelf → grimoire (ids per DESIGN). Every visual consequence of progress is derived from
// state in build(), so `?room=room1&keep` and `&solve=…` restore correctly.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Room } from '../../engine/Room.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as L from '../../engine/props/lights.js';
import { makeCanvasPlane, makeTextPlane } from '../../engine/props/text.js';
import { makeCanvas, canvasTexture } from '../../engine/props/textures.js';
import * as R from './props.js';

const TAU = Math.PI * 2;
const W = 7, D = 7, H = 3.6;
const ALCOVE = { x0: -2.25, x1: -0.55, h: 2.35, depth: 0.8 };
const SHELF_SOLUTION = ['green', 'violet', 'red', 'gold'];
const PUZZLE_BOOKS = { red: '#a3201c', blue: '#1d3d94', green: '#24803a', gold: '#d8a61e', violet: '#6e2c9e', black: '#151313' };
const LOCK_WORD = 'BEAN';
const CLOCK_SOLUTION = { h: 7, m: 35 };
const TITLE_VANTAGE = { position: [-0.9, 1.55, 2.35], lookAt: [1.4, 1.2, -0.9], yawLimit: 70, pitchLimit: 20, fov: 60 };

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

/** Merge static meshes under `root` by material (draw-call saver). Keeps hotspot groups intact (merged meshes stay children of root). */
function mergeStatic(root, exclude = []) { return mergeStaticFn(root, exclude); }
function mergeStaticFn(root, exclude = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const ex = new Set(exclude);
  const skip = (o) => { for (let p = o; p && p !== root; p = p.parent) if (ex.has(p) || p.userData.keep) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.visible || skip(o)) return;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.isShaderMaterial || m.visible === false || o.userData.hitProxy || o.renderOrder || o.userData.noRaycast) return;
    if (typeof o.userData.update === 'function') return;
    const key = `${m.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.geometry.attributes.color ? 'c' : ''}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow;
    mm.name = 'merged';
    for (const o of list) o.parent.remove(o);
    root.add(mm);
  }
  return root;
}

export default class Room1 extends Room {
  static id = 'room1';
  static title = 'The Study';
  // QA: turned ~34° east so the cat on the desk (and the clock, puzzle 1) is in the opening frame
  static vantage = { position: [0.1, 1.6, 2.0], lookAt: [1.85, 1.35, -1.03], yawLimit: 180, pitchLimit: 30, fov: 62 };
  static puzzleOrder = ['clock', 'desk', 'shelf', 'grimoire'];

  async build() {
    const { ctx } = this;
    this.background = new THREE.Color('#090604');
    this.fog = new THREE.FogExp2('#0d0805', 0.04);
    this.envIntensity = 0.42;
    this.exposure = 1.08;
    this.bloom = { strength: 0.42, threshold: 0.8, radius: 0.5 };
    this._timers = [];
    this._raycaster = new THREE.Raycaster();

    this._buildShell();
    this._buildLights();
    this._buildFireplace();
    this._buildNorthWall();
    this._buildShelfAndAlcove();
    this._buildPortrait();
    this._buildEast();
    this._buildClock();
    this._buildDesk();
    this._buildSouth();
    this._buildDressing();
    this._buildVignette();
    this._mergeDressing();
    this.group.updateMatrixWorld(true);
    this._restoreFromState();
    void ctx;
  }

  // ──────────────────────────────────────────────────────────────────────────── helpers
  _hs(spec) { return this.ctx.hotspots.add(spec); }
  _proxy(w, h, d, pos, parent = this.group) { const p = this.ctx.hotspots.proxyBox(w, h, d); p.position.set(...pos); parent.add(p); return p; }
  _caption(key) { this.ctx.dialogue.caption(key); }
  _isCurrent() { return this.ctx.game.currentRoom === this && !this.ctx.game._titleMode; }
  _worldPos(obj) { obj.updateMatrixWorld(true); return obj.getWorldPosition(new THREE.Vector3()); }
  /** Say one random entry from a pool of line-arrays (react.*.wrong). */
  _sayPool(key) {
    const pool = this.ctx.script?.[key];
    if (!Array.isArray(pool) || !pool.length) return this.ctx.dialogue.say(key);
    return this.ctx.dialogue.sayLines(pool[Math.floor(Math.random() * pool.length)]);
  }
  _catLook(point, seconds = 3) {
    const cat = this.ctx.cat; if (!cat) return;
    cat.lookAt(point instanceof THREE.Vector3 ? point : v3(point));
    this._catLookUntil = this._t + seconds;
  }

  // ──────────────────────────────────────────────────────────────────────────── shell
  _buildShell() {
    const G = this.group;
    this.wallMat = M.plaster({ tint: '#94795a', repeat: [2.3, 1.2] });
    const shell = F.roomShell({
      w: W, d: D, h: H, floor: M.floorboards({ repeat: [3.5, 3.5] }), wall: this.wallMat,
      ceiling: M.plaster({ tint: '#5e4e3c', repeat: [2.3, 2.3] }), beams: 4, wainscot: 1.0, omit: ['north'],
    });
    G.add(shell);
    mergeStatic(shell, [shell.userData.floor, shell.userData.ceiling, ...Object.values(shell.userData.walls)]);
    this.shell = shell;
  }

  _buildLights() {
    const G = this.group;
    G.add(L.ambientRig({ sky: '#ffcf9a', ground: '#1a0e08', hemi: 0.26, ambient: '#3a2a22', ambientIntensity: 0.16 }));
    // moonlight through the window (shadow caster #1): mullion shadows on the floor
    const moon = L.keyLight({ color: '#8fb0ff', intensity: 16, position: [1.0, 3.6, -5.2], target: [0.45, 0, -0.6], angle: 0.36, penumbra: 0.75, distance: 12, decay: 1.4, castShadow: true, mapSize: 1024 });
    G.add(moon);
    this.moon = moon;
    // fire (shadow caster #2)
    // the fire: an unshadowed flicker point light, plus a wide spot facing into the room that follows its flicker and
    // casts the shadows (a shadowed point light costs six extra scene passes; a spot costs one)
    const fireL = L.flickerLight({ color: '#ff8a3a', intensity: 3.2, distance: 10, decay: 1.55, flicker: 0.22, speed: 1.1, castShadow: false });
    fireL.position.set(-2.82, 0.55, -1.1);
    G.add(fireL);
    this.fireLight = fireL;
    const fireSpot = new THREE.SpotLight('#ff8a3a', 4.5, 10, 1.3, 0.9, 1.55);
    fireSpot.position.set(-2.9, 0.6, -1.1); fireSpot.target.position.set(1.5, 0.9, -1.1);
    fireSpot.castShadow = true; fireSpot.shadow.mapSize.set(1024, 1024); fireSpot.shadow.bias = -0.0015; fireSpot.shadow.normalBias = 0.02; fireSpot.shadow.radius = 4;
    fireSpot.shadow.camera.near = 0.15;
    G.add(fireSpot, fireSpot.target);
    this.fireSpot = fireSpot;
    // a soft warm fill on the east side (no shadow) so the desk/clock read in firelight
    const fill = new THREE.PointLight('#ffb070', 1.2, 6, 1.8);
    fill.position.set(1.6, 2.6, 0.6);
    G.add(fill);
  }

  // ──────────────────────────────────────────────────────────────────────────── west: fireplace, chair, rug, bowl
  _buildFireplace() {
    const { ctx } = this; const G = this.group;
    const fp = R.fireplace({ w: 1.7, h: H, depth: 0.4 });
    fp.position.set(-3.1, 0, -1.1); fp.rotation.y = Math.PI / 2;
    G.add(fp);
    mergeStatic(fp, [fp.userData.fire]);
    this.fireplace = fp;
    const fire = fp.userData.fire;
    G.add(P.embers({ origin: [-3.25, 0.16, -1.1], spread: 0.2, rise: 0.75, count: 46, size: 0.026 }));
    G.add(P.embers({ origin: [-3.2, 0.1, -1.1], spread: 0.3, rise: 0.35, count: 30, size: 0.018, color: '#ff5a1a' }));
    const fireProxy = this._proxy(0.5, 0.75, 0.9, [-3.25, 0.4, -1.1]);
    this._hs({
      id: 'r1.fire', object: fireProxy, label: 'Fire', highlight: false,
      onClick: () => this._flareFire(),
    });

    // mantel dressing
    const my = fp.userData.mantelY;
    this.candles = [];
    for (const [z, light] of [[-1.78, true], [-0.42, false]]) {
      const cd = F.candle({ holder: 'stick', light, intensity: 0.9, distance: 3.2, h: 0.2 });
      cd.position.set(-3.02, my, z); G.add(cd); this.candles.push(cd);
    }
    const hg = R.hourglass({ h: 0.19 }); hg.position.set(-3.08, my, -1.42); G.add(hg);
    const jar1 = F.jar({ r: 0.04, h: 0.11, contents: '#c9a24a', glow: 0.3, label: 'Dried\nMoonwort', lid: 'cork' }); jar1.position.set(-3.05, my, -0.72); jar1.rotation.y = Math.PI / 2; G.add(jar1);
    const jar2 = F.jar({ r: 0.035, h: 0.09, contents: '#6a3a6a', glow: 0.1, lid: 'brass' }); jar2.position.set(-3.1, my, -0.6); G.add(jar2);
    // sampler (framed embroidery) on the chimney breast
    const sampler = F.pictureFrame({ w: 0.56, h: 0.46, border: 0.05, style: 'walnut', draw: R.paintSampler, px: 512 });
    sampler.position.set(-3.1, 1.98, -1.1); sampler.rotation.y = Math.PI / 2;
    G.add(sampler);
    this._hs({ id: 'r1.sampler', object: sampler, label: 'Embroidery', onClick: () => this._caption('caption.r1.sampler') });
    this.candles.forEach((cd, i) => this._hs({ id: `r1.candle${i}`, object: cd, label: 'Candlestick', onClick: () => this._caption('caption.r1.candles') }));
    this._hs({ id: 'r1.hourglass', object: hg, label: 'Hourglass', onClick: () => this._caption('caption.r1.hourglass') });
    // fire irons
    const irons = new THREE.Group(); irons.position.set(-2.95, 0, -0.08);
    const ironM = M.iron({ color: '#24221f' });
    const stand = F.lathe([[0, 0], [0.08, 0], [0.08, 0.02], [0.012, 0.03], [0.01, 0.62], [0.025, 0.65], [0, 0.66]], ironM, 12); irons.add(stand);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6), ironM); t.position.set(Math.cos(a) * 0.03, 0.32, Math.sin(a) * 0.03); t.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08); t.castShadow = true; irons.add(t); }
    G.add(irons);

    // rug in front of the hearth
    const rug = F.rug({ w: 2.0, d: 2.7, base: '#6a1a1e', accent: '#c9a24a', dark: '#2a1410' });
    rug.position.set(-1.45, 0, -0.7); rug.rotation.y = Math.PI / 2;
    G.add(rug);
    this._hs({ id: 'r1.rug', object: rug, label: 'Rug', onClick: () => this._caption('caption.rug') });

    // armchair angled beside the fire, facing into the room, with the embroidered cushion
    const chair = F.armchair({ color: '#6a1a1e' });
    chair.position.set(-2.45, 0, 0.9); chair.rotation.y = 1.12;
    G.add(chair);
    const cushTex = canvasTexture((() => { const c = makeCanvas(512, 512); R.paintCushion(c.getContext('2d'), 512, 512); return c; })());
    const cushion = F.cushion({ w: 0.4, h: 0.38, d: 0.12, color: '#2a3c2a', faceTexture: cushTex });
    cushion.position.set(0, 0.64, -0.06); cushion.rotation.x = -0.22;
    chair.add(cushion);
    // the face plane is opaque art; stop it from being transparent-sorted
    cushion.userData.face.material.transparent = false;
    { const fm = cushion.userData.face.material; fm.emissive = new THREE.Color('#ffffff'); fm.emissiveMap = fm.map; fm.emissiveIntensity = 0.12; fm.needsUpdate = true; }
    mergeStatic(chair, [cushion]);
    this.chair = chair; this.cushion = cushion;
    this._hs({ id: 'r1.armchair', object: chair, label: 'Armchair', onClick: () => this._caption('caption.r1.armchair') });
    this._hs({
      id: 'r1.cushion', object: cushion, label: 'Embroidered cushion', scope: ['room', 'focus:r1.cushion'],
      onClick: () => this._clickCushion(),
      useItem: { magnifier: () => { this._magnifyCushion(); } },
    });
    // the lens shown in the magnified view (hidden until used)
    const lens = new THREE.Group(); lens.visible = false;
    const lensArt = makeCanvasPlane(0.2, 0.2, R.paintMagnified, { px: 512 });
    lensArt.material.emissive = new THREE.Color('#ffffff'); lensArt.material.emissiveMap = lensArt.material.map; lensArt.material.emissiveIntensity = 0.35;
    const circ = new THREE.Mesh(new THREE.CircleGeometry(0.1, 48), lensArt.material); lens.add(circ);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.008, 10, 48), M.brass({ polished: true })); lens.add(rim);
    const handle = F.lathe([[0, 0], [0.012, 0], [0.015, 0.04], [0.014, 0.12], [0.01, 0.13], [0, 0.13]], M.wood({ tint: '#2e1a0e' }), 12);
    handle.rotation.z = Math.PI * 0.8; handle.position.set(0.07, -0.08, 0); lens.add(handle);
    lens.traverse((o) => { o.userData.noRaycast = true; o.raycast = () => {}; });
    cushion.add(lens);
    lens.position.set(0, -0.07, 0.11);
    this.lens = lens;

    // BEAN's bowl by the hearth
    const bowl = R.catBowl(); bowl.position.set(-2.5, 0, 0.06); bowl.rotation.y = 0.95; // polish: was (-2.55, 0, -0.12), half inside the hearth slab
    G.add(bowl);
    // QA: the hearth lip occluded half the bowl; a generous proxy makes it easy to click
    const bowlProxy = ctx.hotspots.proxyBox(0.36, 0.16, 0.36); bowlProxy.position.y = 0.07; bowl.add(bowlProxy);
    this.bowl = bowl;
    this._hs({ id: 'r1.bowl', object: bowl, label: 'Cat bowl', scope: ['room', 'focus:r1.bowl'], onClick: () => this._clickBowl() });
  }

  _flareFire() {
    const { ctx } = this;
    const fire = this.fireplace.userData.fire;
    fire.userData.setBoost(1);
    const L0 = 3.2;
    this.fireLight.userData.baseIntensity = 6.5; this.fireLight.userData.setLit(true, 0.08);
    ctx.audio.play('flameIgnite');
    ctx.audio.setLoopGain?.('fire', 1.6, 0.2);
    ctx.cat?.react('flinch');
    this._caption('caption.fire');
    this._later(1.2, () => {
      fire.userData.setBoost(0);
      this.fireLight.userData.baseIntensity = L0; this.fireLight.userData.setLit(true, 1.2);
      ctx.audio.setLoopGain?.('fire', 1, 1.5);
    });
  }

  async _clickBowl() {
    const { ctx } = this;
    // polish: a close-up on the engraving, so BEAN is read off the bowl itself, not only from the caption
    if (ctx.camera.scope !== 'focus:r1.bowl') {
      const b = this.bowl, c = new THREE.Vector3(), face = new THREE.Vector3(0, 0, 1);
      b.getWorldPosition(c);
      face.applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      const cam = c.clone().addScaledVector(face, 0.46); cam.y = 0.24;
      ctx.camera.focus({ position: cam.toArray(), lookAt: [c.x + face.x * 0.08, 0.04, c.z + face.z * 0.08], scope: 'focus:r1.bowl', fov: 38 });
    }
    this._caption('caption.bowl');
    if (!ctx.state.get('room1.bowl.seen')) {
      ctx.state.set('room1.bowl.seen', true);
      await ctx.tween.delay(1.4);
      ctx.dialogue.hideCaption();
      await ctx.dialogue.say('react.bowl');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────── north wall
  _buildNorthWall() {
    const G = this.group;
    // wall plane with the alcove opening cut out
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0); s.lineTo(ALCOVE.x0, 0); s.lineTo(ALCOVE.x0, ALCOVE.h); s.lineTo(ALCOVE.x1, ALCOVE.h); s.lineTo(ALCOVE.x1, 0);
    s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, pos.getY(i) / H);
    const wall = new THREE.Mesh(geo, this.wallMat);
    wall.position.z = -D / 2; wall.receiveShadow = true; wall.name = 'wall_north';
    G.add(wall);
    // wainscot / baseboard / rail either side of the opening
    const trim = new THREE.Group();
    for (const [a, b] of [[-W / 2, ALCOVE.x0 - 0.06], [ALCOVE.x1 + 0.06, W / 2]]) {
      const len = b - a, cx = (a + b) / 2;
      const base = F.rbox(len, 0.14, 0.03, M.walnut(), 0.006); base.position.set(cx, 0.07, -D / 2 + 0.03); trim.add(base);
      const panel = F.rbox(len, 1.0, 0.025, M.walnut({ tint: '#4a2f1e' }), 0.004); panel.position.set(cx, 0.5, -D / 2 + 0.0125); trim.add(panel);
      const rail = F.rbox(len, 0.05, 0.05, M.walnut(), 0.01); rail.position.set(cx, 1.0, -D / 2 + 0.025); trim.add(rail);
    }
    // jambs + header around the opening
    const jm = M.walnut({ tint: '#3a2416' });
    for (const x of [ALCOVE.x0 - 0.03, ALCOVE.x1 + 0.03]) { const j = F.rbox(0.06, ALCOVE.h + 0.06, 0.06, jm, 0.008); j.position.set(x, (ALCOVE.h + 0.06) / 2, -D / 2 + 0.02); trim.add(j); }
    const hd = F.rbox(ALCOVE.x1 - ALCOVE.x0 + 0.12, 0.08, 0.07, jm, 0.01); hd.position.set((ALCOVE.x0 + ALCOVE.x1) / 2, ALCOVE.h + 0.04, -D / 2 + 0.025); trim.add(hd);
    G.add(trim);
    mergeStatic(trim);

    // tall arched window with moonlight, rain and a dust-filled shaft
    const win = F.windowFrame({ w: 1.0, h: 1.9, arch: true, panes: [2, 4], rain: 0.75, shaftTarget: [0.25, -1.05, 3.0], shaftOpacity: 0.17, moon: [0.66, 0.8], skyTop: '#0a1430', skyBottom: '#1a2a52' });
    win.position.set(0.6, 1.08, -D / 2 + 0.03);
    G.add(win);
    this.window = win;
    // deep window reveal (plaster)
    const reveal = new THREE.Group();
    for (const sx of [-1, 1]) { const r = F.rbox(0.05, 1.45, 0.2, M.plaster({ tint: '#7e6a50' }), 0.01); r.position.set(0.6 + sx * 0.6, 1.08 + 0.72, -D / 2 + 0.06); reveal.add(r); }
    G.add(reveal); mergeStatic(reveal);
    G.add(P.dustMotes({ box: [1.0, 1.9, 2.6], center: [0.72, 1.05, -1.95], count: 240, size: 0.016, opacity: 0.6, color: '#dfe8ff' }));
    G.add(P.dustMotes({ box: [5.5, 2.6, 5], center: [0, 1.4, 0], count: 120, size: 0.012, opacity: 0.25 }));
    this._hs({ id: 'r1.window', object: win.userData.glass, label: 'Window', onClick: () => this._caption('caption.window') });
    // curtain swags either side (velvet)
    const cm = M.velvet({ color: '#4a1418', pattern: 'damask' });
    for (const sx of [-1, 1]) {
      const geo2 = new THREE.CylinderGeometry(0.11, 0.17, 2.2, 14, 6, true, 0, Math.PI);
      const p = geo2.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const a = Math.atan2(p.getX(i), p.getZ(i)); p.setX(i, p.getX(i) + Math.sin(a * 6 + y * 2) * 0.012); }
      geo2.computeVertexNormals();
      const c = new THREE.Mesh(geo2, cm); c.castShadow = true; c.receiveShadow = true;
      c.position.set(0.6 + sx * 0.72, 1.85, -D / 2 + 0.12); c.rotation.y = Math.PI;
      G.add(c);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 8), M.brass()); rod.rotation.z = Math.PI / 2; rod.position.set(0.6, 2.98, -D / 2 + 0.12); G.add(rod);
  }

  _buildShelfAndAlcove() {
    const { ctx } = this; const G = this.group; const { state } = ctx;
    // ── alcove (behind the opening)
    const al = new THREE.Group(); al.name = 'alcove';
    const stoneM = M.stone({ tint: '#5e564c', rows: 5, cols: 3, seed: 31 });
    const aw = ALCOVE.x1 - ALCOVE.x0, ad = ALCOVE.depth, ah = ALCOVE.h;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), stoneM); back.position.set((ALCOVE.x0 + ALCOVE.x1) / 2, ah / 2, -D / 2 - ad); al.add(back);
    for (const [x, ry] of [[ALCOVE.x0, Math.PI / 2], [ALCOVE.x1, -Math.PI / 2]]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(ad, ah), stoneM); sw.position.set(x, ah / 2, -D / 2 - ad / 2); sw.rotation.y = ry; al.add(sw); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(aw, ad), M.stone({ tint: '#3e3830', rows: 3, cols: 3, seed: 32 })); ceil.rotation.x = Math.PI / 2; ceil.position.set((ALCOVE.x0 + ALCOVE.x1) / 2, ah, -D / 2 - ad / 2); al.add(ceil);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(aw, ad), M.floorboards({ repeat: [1, 0.4] })); floor.rotation.x = -Math.PI / 2; floor.position.set((ALCOVE.x0 + ALCOVE.x1) / 2, 0.001, -D / 2 - ad / 2); al.add(floor);
    al.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
    G.add(al);
    // a little stone ledge with a candle in the alcove
    const ledge = F.rbox(0.26, 0.05, 0.16, M.smoothStone({ color: '#7a7266' }), 0.01); ledge.position.set(ALCOVE.x1 - 0.2, 1.45, -D / 2 - ad + 0.08); G.add(ledge);
    const acandle = F.candle({ holder: 'dish', light: true, intensity: 1.4, distance: 2.6, lit: false, h: 0.12 });
    acandle.position.set(ALCOVE.x1 - 0.2, 1.475, -D / 2 - ad + 0.08); G.add(acandle);
    this.alcoveCandle = acandle;
    // the grimoire on its stand
    const stand = R.grimoireStand();
    stand.position.set((ALCOVE.x0 + ALCOVE.x1) / 2, 0, -D / 2 - 0.45);
    G.add(stand);
    mergeStatic(stand, [stand.userData.book, stand.userData.diary]);
    this.stand = stand;
    const sparkle = P.sparkles({ box: [0.5, 0.35, 0.4], center: [(ALCOVE.x0 + ALCOVE.x1) / 2, 1.18, -D / 2 - 0.45], count: 26, size: 0.035, color: '#ffe2a0', color2: '#9fc4ff' });
    sparkle.visible = false; G.add(sparkle); this.grimoireSparkle = sparkle;

    // ── the puzzle bookshelf on a hinge at the opening's left edge
    const pivot = new THREE.Group(); pivot.name = 'shelfPivot';
    pivot.position.set(ALCOVE.x0, 0, -D / 2);
    G.add(pivot);
    const shelf = F.bookshelf({ w: 1.7, h: 2.45, d: 0.38, shelves: 6, seed: 7, fill: 0.93, reserve: [{ shelf: 3, from: 0.0, to: 1.0 }] });
    shelf.position.set(0.85, 0, 0.19);
    pivot.add(shelf);
    this.shelfPivot = pivot; this.shelf = shelf;
    // soft reading light on the puzzle row (no shadows)
    const sl = new THREE.PointLight('#ffc890', 0.9, 2.4, 2); sl.position.set(-1.3, 1.85, -2.7); G.add(sl);
    const rowY = shelf.userData.shelfYs[3] + 0.005;
    const innerW = shelf.userData.innerWidth;
    // the puzzle row: 6 pushable books among static ones (merged)
    const order = ['S', 'S', 'violet', 'S', 'S', 'red', 'S', 'black', 'S', 'S', 'S', 'green', 'S', 'gold', 'S', 'S', 'blue', 'S', 'S', 'S', 'S', 'S', 'S', 'S'];
    const muted = ['#6b4a2b', '#4a3826', '#7a6248', '#3e4a4c', '#5c5040', '#2f3a3a', '#8a7a5a', '#5a4a3a', '#46382c'];
    let rr = 7; const rnd = () => ((rr = (rr * 16807) % 2147483647) / 2147483647);
    const items = order.map((k) => ({ k, w: k === 'S' ? 0.03 + rnd() * 0.035 : 0.052, h: k === 'S' ? 0.22 + rnd() * 0.05 : 0.3 }));
    const total = items.reduce((s2, b) => s2 + b.w + 0.003, 0);
    let x = -total / 2;
    const staticGeos = [];
    this.puzzleBooks = {};
    const pushed = state.get('room1.shelf.pushed', []);
    for (const b of items) {
      const cx = x + b.w / 2;
      if (b.k === 'S') {
        const gg = F.bookGeometry(b.w, b.h, 0.25, muted[Math.floor(rnd() * muted.length)]);
        gg.translate(cx, rowY, 0.02);
        staticGeos.push(gg);
      } else {
        const bk = F.book({ w: b.w, h: b.h, d: 0.25, color: PUZZLE_BOOKS[b.k] });
        // a touch of self-light so the six loose spines read as *the* colours among the muted row
        bk.material = bk.material.clone(); bk.material.emissive = new THREE.Color(PUZZLE_BOOKS[b.k]); bk.material.emissiveIntensity = 0.35;
        // final: the black spine vanished into the shadowed row, so the caption's "six" read as five. Give it a cool
        // pewter sheen so it still reads black but is plainly one of the six loose books.
        if (b.k === 'black') { bk.material.emissive = new THREE.Color('#3a3a46'); bk.material.emissiveIntensity = 0.32; bk.material.roughness = 0.45; }
        bk.position.set(cx, rowY, 0.065);
        bk.userData.color = b.k; bk.userData.outZ = 0.065; bk.userData.inZ = 0.022;
        if (pushed.includes(b.k)) bk.position.z = bk.userData.inZ;
        shelf.add(bk);
        // gilt band decals on the spine (shared material)
        this.puzzleBooks[b.k] = bk;
      }
      x += b.w + 0.003;
    }
    void innerW;
    const staticRow = new THREE.Mesh(mergeGeometries(staticGeos), F.bookMaterial());
    staticRow.castShadow = true; staticRow.receiveShadow = true;
    shelf.add(staticRow);
    mergeStatic(shelf, Object.values(this.puzzleBooks));

    this._hs({
      id: 'r1.shelf', object: shelf, label: 'Bookshelf',
      enabled: () => !state.isSolved('shelf'),
      onClick: () => this._focusShelf(),
    });
    this._hs({
      id: 'r1.shelf.books', object: shelf, label: 'Books', scope: 'focus:r1.shelf',
      onClick: () => { ctx.audio.play('bookSlide', { gain: 0.25, pitch: 1.3 }); this._caption('caption.books'); },
    });
    for (const [color, bk] of Object.entries(this.puzzleBooks)) {
      this._hs({
        id: `r1.book.${color}`, object: bk, label: 'A book that sticks out', scope: 'focus:r1.shelf',
        enabled: () => !state.isSolved('shelf'),
        onClick: () => this._pushBook(color),
      });
    }

    // alcove contents
    const ud = stand.userData;
    this._hs({
      id: 'r1.grimoire', object: ud.book, label: () => (state.isSolved('grimoire') ? 'Grimoire' : 'Chained grimoire'),
      enabled: () => state.isSolved('shelf'),
      onClick: () => this._clickGrimoire(),
    });
    this._hs({
      id: 'r1.diary', object: ud.diary, label: 'Diary page', scope: ['room', 'focus:r1.grimoire'],
      enabled: () => state.isSolved('shelf'),
      onClick: () => { ctx.audio.play('paperRustle'); ctx.papers.show('diary_page'); },
    });
    this._hs({
      id: 'r1.alcove', object: back, label: 'Alcove', enabled: () => state.isSolved('shelf'),
      onClick: () => this._caption('caption.r1.alcove'),
    });
    // word lock dials
    const letters = state.get('room1.lock.letters', [0, 0, 0, 0]);
    this.lockLetters = [...letters];
    this.lockAngles = letters.map((v) => (v + 0.5) * ud.STEP);
    ud.dials.forEach((d, i) => {
      d.rotation.x = this.lockAngles[i];
      const proxy = ctx.hotspots.proxyBox(0.028, 0.04, 0.04); d.add(proxy);
      this._hs({
        id: `r1.lock.dial${i}`, object: d, label: 'Letter dial', scope: 'focus:r1.grimoire',
        enabled: () => !state.isSolved('grimoire'),
        onClick: (info) => {
          const wy = this._worldPos(d).y;
          this._turnDial(i, info.point && info.point.y < wy ? -1 : 1);
        },
      });
      const { up, down } = ud.arrows[i];
      const pu = ctx.hotspots.proxyBox(0.026, 0.022, 0.03); up.add(pu);
      const pd = ctx.hotspots.proxyBox(0.026, 0.022, 0.03); down.add(pd);
      this._hs({ id: `r1.lock.up${i}`, object: up, label: 'Next letter', scope: 'focus:r1.grimoire', enabled: () => !state.isSolved('grimoire'), onClick: () => this._turnDial(i, 1) });
      this._hs({ id: `r1.lock.down${i}`, object: down, label: 'Previous letter', scope: 'focus:r1.grimoire', enabled: () => !state.isSolved('grimoire'), onClick: () => this._turnDial(i, -1) });
    });
    this._hs({
      id: 'r1.page', object: ud.page, label: 'Incantation page', scope: ['room', 'focus:r1.grimoire'],
      enabled: () => state.isSolved('grimoire') && !state.get('room1.page.taken') && ud.page.visible,
      onClick: () => this._takePage(),
    });
  }

  // ──────────────────────────────────────────────────────────────────────────── portrait
  _buildPortrait() {
    const { ctx } = this; const G = this.group;
    let info = null;
    const frame = F.pictureFrame({ w: 0.74, h: 0.98, border: 0.08, style: 'gilt', px: 1024, draw: (g, w, h) => { info = R.paintPortrait(g, w, h); } });
    frame.position.set(1.85, 1.72, -D / 2 + 0.005);
    G.add(frame);
    this.portrait = frame;
    const iw = frame.userData.innerW, ih = frame.userData.innerH;
    const picZ = 0.05 * 0.25 + 0.002;
    const toLocal = (u, v) => new THREE.Vector3((u - 0.5) * iw, (0.5 - v) * ih, picZ);
    // irises that follow the cursor (amber, with slit pupils)
    const irisMat = new THREE.MeshBasicMaterial({ color: '#d98a1c' });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#120a04' });
    const f = info.face;
    const eyeR = f.fh * ih * 0.12 * 0.62;
    this.portraitEyes = [-1, 1].map((s) => {
      const home = toLocal(f.x + s * f.fw * 0.42, f.y - f.fh * 0.12);
      const eye = new THREE.Group(); eye.position.copy(home);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(eyeR, 20), irisMat);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(eyeR * 0.5, 12), pupilMat); pupil.scale.set(0.38, 1.15, 1); pupil.position.z = 0.0005;
      eye.add(iris, pupil);
      eye.traverse((o) => { o.userData.noRaycast = true; o.raycast = () => {}; });
      frame.add(eye);
      return { eye, home, maxX: f.fw * iw * 0.2 - eyeR * 1.1, maxY: f.fh * ih * 0.12 - eyeR * 0.95 };
    });
    // the pocket watch (crisp overlay) reading 7:35
    const wr = info.watch.r * iw;
    const watch = new THREE.Group(); watch.position.copy(toLocal(info.watch.x, info.watch.y)); watch.position.z += 0.003;
    const wtex = R.watchTexture();
    const wface = new THREE.Mesh(new THREE.CircleGeometry(wr, 40), new THREE.MeshStandardMaterial({ map: wtex, emissive: '#ffffff', emissiveMap: wtex, emissiveIntensity: 0.18, roughness: 0.4 }));
    const wrim = new THREE.Mesh(new THREE.TorusGeometry(wr, wr * 0.07, 8, 40), M.gold({ roughness: 0.3 }));
    const crown = new THREE.Mesh(new THREE.SphereGeometry(wr * 0.12, 10, 8), M.gold()); crown.position.y = wr * 1.1;
    watch.add(wface, wrim, crown);
    frame.add(watch);
    this.watch = watch;
    // nameplate
    const plate = makeTextPlane('BARTHOLOMEW QUINCE', { width: 0.26, font: `700 44px "Cormorant Garamond", Georgia, serif`, color: '#2a1a08', bg: '#c9a24a', padding: 16 });
    plate.position.set(0, -0.98 / 2 + 0.04, 0.056); frame.add(plate);
    const lamp = new THREE.Group(); // a little brass picture light above
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), M.brass()); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0.55, 0.06); lamp.add(arm);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 12, 1, true), M.brass({ roughness: 0.25 })); hood.rotation.z = Math.PI / 2; hood.position.set(0, 0.56, 0.12); lamp.add(hood);
    frame.add(lamp);
    const pl = new THREE.SpotLight('#ffcf90', 2.2, 2.2, 0.75, 0.8, 1.5); pl.position.set(1.85, 2.28, -D / 2 + 0.2); pl.target.position.set(1.85, 1.55, -D / 2); G.add(pl, pl.target);

    const focusPortrait = () => ctx.camera.focus({ position: [1.86, 1.66, -2.42], lookAt: [1.85, 1.66, -3.5], scope: 'focus:r1.portrait', fov: 55 });
    this._hs({
      id: 'r1.portrait', object: frame, label: 'Portrait',
      onClick: () => { this._caption('caption.portrait'); focusPortrait(); },
    });
    const wproxy = ctx.hotspots.proxyBox(wr * 2.4, wr * 2.6, 0.02); watch.add(wproxy);
    this._hs({
      id: 'r1.watch', object: watch, label: 'Pocket watch', scope: ['focus:r1.portrait'],
      onClick: () => {
        const wp = this._worldPos(watch);
        ctx.camera.focus({ position: [wp.x, wp.y + 0.01, wp.z + 0.32], lookAt: [wp.x, wp.y, wp.z], scope: 'focus:r1.watch', fov: 40 });
        this._caption('caption.r1.watch');
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────── east: lab door, wall shelf, globe
  _buildEast() {
    const { ctx } = this; const G = this.group; const { state } = ctx;
    const door = F.door({ w: 1.1, h: 2.15, tint: '#5e3a20', rune: true, runeColor: '#bfe0ff', frame: 'stone', seed: 5 });
    door.position.set(W / 2 - 0.07, 0, -2.62); door.rotation.y = -Math.PI / 2;
    G.add(door);
    mergeStatic(door, [door.userData.leaf]);
    this.labDoor = door;
    const runeLight = new THREE.PointLight('#a8ccff', 0.9, 2.4, 2); runeLight.position.set(W / 2 - 0.4, 1.4, -2.62); G.add(runeLight);
    this.labRuneLight = runeLight;
    this._hs({
      id: 'r1.labdoor', object: door, label: () => (state.isSolved('grimoire') ? 'To the laboratory' : 'Laboratory door'),
      onClick: () => this._clickLabDoor(),
    });
    // wall shelf above the desk
    const ws = F.wallShelf({ w: 1.25, d: 0.24 });
    ws.position.set(W / 2, 1.72, 0.5); ws.rotation.y = -Math.PI / 2;
    G.add(ws);
    const stack = R.bookStack({ count: 3, seed: 5 }); stack.position.set(-0.4, 0, 0.12); ws.add(stack);
    const upright = [];
    let bx = -0.2;
    for (let i = 0; i < 7; i++) { const w = 0.03 + (i * 37 % 11) / 400, h = 0.2 + (i * 53 % 7) / 70; const g = F.bookGeometry(w, h, 0.17, F.BOOK_COLORS[(i * 5) % F.BOOK_COLORS.length]); g.translate(bx + w / 2, 0, 0.11); upright.push(g); bx += w + 0.002; }
    const ub = new THREE.Mesh(mergeGeometries(upright), F.bookMaterial()); ub.castShadow = true; ws.add(ub);
    const potion = F.bottle({ r: 0.04, h: 0.2, shape: 'round', color: '#5a3a7a', contents: '#8a4ad0', glow: 0.9, label: 'SLEEP' });
    potion.position.set(0.3, 0, 0.12); ws.add(potion);
    this._hs({ id: 'r1.potion', object: potion, label: 'Potion', onClick: () => this._caption('caption.r1.potion') });
    const jar = F.jar({ r: 0.045, h: 0.13, contents: '#4a7a3a', glow: 0.15, label: 'Newt\n(dried)', lid: 'cloth' }); jar.position.set(0.47, 0, 0.12); ws.add(jar);
    // globe in the front-right corner
    const gl = R.globe({ r: 0.24 });
    gl.position.set(2.45, 0, 2.2);
    G.add(gl);
    this.globe = gl;
    this._hs({
      id: 'r1.globe', object: gl, label: 'Globe',
      onClick: () => { gl.userData.spin(5 + Math.random() * 3); ctx.audio.play('swoosh', { gain: 0.5 }); this._caption('caption.globe'); },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────── grandfather clock (R1-P1)
  _buildClock() {
    const { ctx } = this; const G = this.group; const { state } = ctx;
    const clock = R.grandfatherClock();
    clock.position.set(W / 2 - 0.2, 0, -1.2); clock.rotation.y = -Math.PI / 2;
    G.add(clock);
    const ud = clock.userData;
    mergeStatic(clock, [ud.hourHand, ud.minuteHand, ud.pendulum, ud.panel, ud.keySpot, ud.face]);
    this.clock = clock;
    const t = state.get('room1.clock.time', { h: 0, m: 0 });
    this.clockTime = { h: t.h, m: t.m };
    // the key in the base
    const key = R.brassKey(); key.rotation.y = 0.3; key.position.y = 0.0;
    const plate = F.rbox(0.12, 0.012, 0.08, M.walnut({ tint: '#2a140c' }), 0.003); ud.keySpot.add(plate);
    key.position.set(-0.03, 0.01, 0); ud.keySpot.add(key);
    this.clockKey = key;
    const keyGlow = P.sparkles({ box: [0.12, 0.08, 0.08], center: [0, 0.04, 0], count: 10, size: 0.02, color: '#ffe2a0', color2: '#fff' });
    ud.keySpot.add(keyGlow); this.keyGlow = keyGlow;

    this._hs({
      id: 'r1.clock', object: clock, label: 'Grandfather clock',
      onClick: () => this._clickClock(),
    });
    // hands: click to step, drag to set
    const fc = ud.faceCenter;
    const mProxy = ctx.hotspots.proxyBox(0.03, ud.faceRadius * 0.9, 0.01); mProxy.position.set(0, ud.faceRadius * 0.45, 0); ud.minuteHand.add(mProxy);
    const hProxy = ctx.hotspots.proxyBox(0.034, ud.faceRadius * 0.6, 0.01); hProxy.position.set(0, ud.faceRadius * 0.3, 0); ud.hourHand.add(hProxy);
        const enabled = () => !state.isSolved('clock');
    let dragM = null;
    this._hs({
      id: 'r1.clock.minute', object: ud.minuteHand, label: 'Minute hand (drag, or click)', scope: 'focus:r1.clock', enabled,
      onClick: () => { this._stepClock(0, 5); this._checkClock(); },
      onDragStart: () => { dragM = this.clockTime.m; },
      onDrag: ({ ray }) => {
        const a = this._faceAngle(ray); if (a == null) return;
        let m = Math.round((a / TAU) * 12) * 5 % 60; if (m < 0) m += 60;
        if (m !== this.clockTime.m) {
          const prev = this.clockTime.m;
          let h = this.clockTime.h;
          if (prev >= 45 && m < 15) h = (h + 1) % 12; else if (prev < 15 && m >= 45) h = (h + 11) % 12;
          this._setClock(h, m); ctx.audio.play('clockTick', { gain: 0.6 });
        }
      },
      onDragEnd: () => { if (dragM !== this.clockTime.m) this._checkClock(); dragM = null; },
    });
    this._hs({
      id: 'r1.clock.hour', object: ud.hourHand, label: 'Hour hand (drag, or click)', scope: 'focus:r1.clock', enabled,
      onClick: () => { this._stepClock(1, 0); this._checkClock(); },
      onDrag: ({ ray }) => {
        const a = this._faceAngle(ray); if (a == null) return;
        let h = Math.round((a / TAU) * 12 - this.clockTime.m / 60) % 12; if (h < 0) h += 12;
        if (h !== this.clockTime.h) { this._setClock(h, this.clockTime.m); ctx.audio.play('clockTick', { gain: 0.6, pitch: 0.8 }); }
      },
      onDragEnd: () => this._checkClock(),
    });
    // final: four small brass buttons in the dial plate's corners — left pair sets the hour, right pair the minutes
    // (top +, bottom −), so an overshoot is one click back instead of another lap.
    const btnMat = M.brass({ polished: true });
    const btnSpecs = [
      { id: 'hourUp', x: -1, y: 1, sym: '+', word: 'HOUR', dh: 1, dm: 0, label: 'Hour forward' },
      { id: 'hourDown', x: -1, y: -1, sym: '\u2212', word: 'HOUR', dh: -1, dm: 0, label: 'Hour back' },
      { id: 'minUp', x: 1, y: 1, sym: '+', word: 'MIN', dh: 0, dm: 5, label: 'Minutes forward (+5)' },
      { id: 'minDown', x: 1, y: -1, sym: '\u2212', word: 'MIN', dh: 0, dm: -5, label: 'Minutes back (\u22125)' },
    ];
    const off = ud.faceRadius + 0.003;
    for (const b of btnSpecs) {
      const btn = new THREE.Group();
      btn.position.set(fc.x + b.x * off, fc.y + b.y * off, fc.z + 0.002);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.019, 0.008, 28), btnMat);
      knob.rotation.x = Math.PI / 2; knob.position.z = 0.004; knob.castShadow = false; btn.add(knob);
      // self-lit face so the symbol reads even where the brass falls into shadow
      const top = makeCanvasPlane(0.034, 0.034, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        const gr = g.createRadialGradient(w * 0.38, h * 0.34, w * 0.05, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#f3d58e'); gr.addColorStop(0.7, '#b98a3e'); gr.addColorStop(1, '#6e4a1c');
        g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a1608'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `700 ${Math.round(h * 0.6)}px Georgia, serif`; g.fillText(b.sym, w / 2, h * 0.42);
        g.font = `700 ${Math.round(h * 0.17)}px Georgia, serif`; g.fillText(b.word, w / 2, h * 0.8);
      }, { px: 128, transparent: true, emissive: true });
      top.material.color.setScalar(0.7);
      top.position.z = 0.0085; top.userData.noRaycast = true; top.material.alphaTest = 0.05;
      btn.add(top);
      clock.add(btn);
      this._hs({
        id: `r1.clock.${b.id}`, object: knob, label: b.label, scope: 'focus:r1.clock', enabled,
        onClick: () => {
          ctx.tween.to(btn.position, { z: fc.z - 0.002 }, { duration: 0.06 }).then(() => ctx.tween.to(btn.position, { z: fc.z + 0.002 }, { duration: 0.14, ease: 'outBack' }));
          this._stepClock(b.dh, b.dm); this._checkClock();
        },
      });
    }
    this._hs({
      id: 'r1.clock.face', object: ud.face, label: 'Clock face', scope: 'focus:r1.clock', highlight: false,
      onClick: () => this._caption(state.isSolved('clock') ? 'caption.clock.running' : 'caption.clock.stopped'),
    });
    const keyProxy = ctx.hotspots.proxyBox(0.14, 0.08, 0.1); keyProxy.position.set(0, 0.03, 0); ud.keySpot.add(keyProxy);
    this._hs({
      id: 'r1.key', object: ud.keySpot, label: 'Brass key', scope: ['room', 'focus:r1.clockbase', 'focus:r1.clock'],
      enabled: () => state.isSolved('clock') && !state.get('room1.key.taken'),
      onClick: () => this._takeKey(),
    });
  }

  _faceAngle(ray) {
    const ud = this.clock.userData;
    const inv = new THREE.Matrix4().copy(this.clock.matrixWorld).invert();
    const r = ray.clone().applyMatrix4(inv);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ud.faceCenter.z);
    const p = r.intersectPlane(plane, new THREE.Vector3());
    if (!p) return null;
    const dx = p.x - ud.faceCenter.x, dy = p.y - ud.faceCenter.y;
    let a = Math.atan2(dx, dy); if (a < 0) a += TAU;
    return a;
  }
  _stepClock(dh, dm) {
    let { h, m } = this.clockTime;
    m += dm; if (m >= 60) { m -= 60; h += 1; } else if (m < 0) { m += 60; h -= 1; }
    h = (((h + dh) % 12) + 12) % 12;
    this._setClock(h, m, true);
    this.ctx.audio.play('clockTick', { gain: 0.7, pitch: dh ? 0.8 : 1 });
  }
  _setClock(h, m, animate = false) {
    this.clockTime = { h, m };
    if (!this._clockChanged) this.ctx.dialogue.hideCaption(); // final: "Stopped at twelve" no longer lingers once the hands move
    this._clockChanged = true;
    this.ctx.state.set('room1.clock.time', { h, m });
    this._applyHands(h + m / 60, animate);
  }
  /** hours (0..12, fractional) → hand rotations. */
  _applyHands(hours, animate = false) {
    const ud = this.clock.userData;
    const mins = (hours % 1) * 60;
    const ha = -((hours % 12) / 12) * TAU, ma = -(mins / 60) * TAU;
    if (!animate) { ud.hourHand.rotation.z = ha; ud.minuteHand.rotation.z = ma; return; }
    const tw = this.ctx.tween;
    const near = (from, to) => from + wrap(to - from);
    tw.to(ud.hourHand.rotation, { z: near(ud.hourHand.rotation.z, ha) }, { duration: 0.22, ease: 'outBack' });
    tw.to(ud.minuteHand.rotation, { z: near(ud.minuteHand.rotation.z, ma) }, { duration: 0.22, ease: 'outBack' });
  }
  _checkClock() {
    const { h, m } = this.clockTime;
    if (h === CLOCK_SOLUTION.h && m === CLOCK_SOLUTION.m && !this.ctx.state.isSolved('clock')) this._solveClock();
  }
  _clickClock() {
    const { ctx } = this; const { state } = ctx;
    this._catLook(this._worldPos(this.clock).setY(1.6));
    if (state.isSolved('clock')) {
      this._caption('caption.clock.running');
      if (!state.get('room1.key.taken')) this._focusClockBase();
      return;
    }
    this._caption('caption.clock.stopped');
    this._clockChanged = false;
    const fc = this.clock.localToWorld(this.clock.userData.faceCenter.clone());
    ctx.camera.focus({
      position: [fc.x - 0.74, fc.y + 0.02, fc.z], lookAt: [fc.x, fc.y, fc.z], scope: 'focus:r1.clock', fov: 42, // final: was 0.62 back; room for the corner buttons
      onExit: () => {
        if (this._clockChanged && !state.isSolved('clock')) {
          const n = state.inc('room1.clock.wrong');
          if (n % 3 === 0) this._later(0.7, () => this._sayPool('react.clock.wrong'));
        }
        this._clockChanged = false;
      },
    });
  }
  _focusClockBase(nested = false) {
    const p = this._worldPos(this.clock.userData.keySpot);
    void nested;
    return this.ctx.camera.focus({ position: [p.x - 0.6, p.y + 0.42, p.z], lookAt: [p.x + 0.05, p.y + 0.02, p.z], scope: 'focus:r1.clockbase', fov: 45 });
  }
  async _solveClock() {
    const { ctx } = this; const { state } = ctx;
    state.solve('clock');
    state.set('room1.clock.runStart', state.elapsed);
    ctx.hotspots.lock();
    try {
      ctx.audio.play('success', { gain: 0.6 });
      ctx.audio.clockChime(7);
      this.clockRunning = true;
      this._lastChimeHour = 7;
      this._pendAmp = 0;
      ctx.cat?.react('perk');
      await ctx.tween.delay(1.4);
      const ud = this.clock.userData;
      ctx.audio.play('drawerOpen', { gain: 0.6, pitch: 1.4 });
      ctx.tween.to(ud.panel.rotation, { y: -1.95 }, { duration: 0.9, ease: 'outBack' });
      ctx.tween.to(ud.cavLight, { intensity: 0.35 }, { duration: 1.2 });
      await ctx.camera.exitFocus({ all: true, duration: 0.5 });
      P.burst(ctx, this.group, this._worldPos(ud.keySpot).toArray(), { count: 50, radius: 0.25, size: 0.018 });
      await this._focusClockBase();
    } finally { ctx.hotspots.unlock(); }
    ctx.audio.setClockRunning(true);
    await ctx.dialogue.say('react.clock.solved');
  }
  async _takeKey() {
    const { ctx } = this; const { state } = ctx;
    if (state.get('room1.key.taken')) return;
    state.set('room1.key.taken', true);
    this.clockKey.visible = false; this.keyGlow.visible = false;
    ctx.tween.to(this.clock.userData.cavLight, { intensity: 0 }, { duration: 1.5 });
    ctx.inventory.add('key_brass', { from: this.clockKey.parent });
    this._caption('caption.r1.key');
    await ctx.tween.delay(1.0);
    if (ctx.camera.scope === 'focus:r1.clockbase') ctx.camera.exitFocus({ all: true });
  }

  // ──────────────────────────────────────────────────────────────────────────── desk + drawer (R1-P2)
  _buildDesk() {
    const { ctx } = this; const G = this.group; const { state } = ctx;
    const desk = F.desk({ w: 1.5, d: 0.72, h: 0.78, material: M.walnut() });
    desk.position.set(W / 2 - 0.375, 0, 0.45); desk.rotation.y = -Math.PI / 2;
    G.add(desk);
    const drawer = desk.userData.drawer;
    drawer.userData.closedZ = drawer.position.z;
    mergeStatic(desk, [drawer]);
    this.desk = desk; this.drawer = drawer;
    const top = 0.78;
    // desk dressing (desk-local: +x = world +z, +z = toward the room)
    const add = (obj, x, z, ry = 0) => { obj.position.set(x, top, z); obj.rotation.y = ry; desk.add(obj); return obj; };
    const dc = F.candle({ holder: 'dish', light: true, intensity: 1.3, distance: 3.6, h: 0.13 }); add(dc, -0.62, -0.18);
    const ink = add(R.inkpot(), -0.38, 0.06);
    const quill = R.quill({ len: 0.28 });
    quill.position.set(-0.38, top + 0.06, 0.06); quill.rotation.set(0.0, 0.4, -0.32);
    desk.add(quill);
    this.quill = quill; this.quillHome = { p: quill.position.clone(), r: quill.rotation.clone() };
    const stack = R.bookStack({ count: 3, seed: 11 }); add(stack, -0.6, 0.12, 0.3);
    // scattered papers
    const papers = new THREE.Group(); desk.add(papers); this.deskPapers = papers;
    const pm = M.parchment();
    [[-0.12, 0.08, 0.25, 0.21, 0.29], [0.06, -0.04, -0.4, 0.21, 0.28], [-0.02, 0.18, 0.1, 0.16, 0.22]].forEach(([x, z, r, w, h], i) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); p.rotation.set(-Math.PI / 2, 0, r); p.position.set(x, top + 0.002 + i * 0.0015, z); p.receiveShadow = true; p.castShadow = true; papers.add(p);
    });
    // a tiny scrawled note texture on the top paper
    const note = makeCanvasPlane(0.14, 0.18, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(30,20,10,0.75)'; g.lineWidth = 3; for (let l = 0; l < 9; l++) { g.beginPath(); let x = 30; const y = 50 + l * 45; g.moveTo(x, y); while (x < w - 40) { x += 8; g.lineTo(x, y + Math.sin(x * 0.3 + l) * 5); } g.stroke(); } }, { px: 256, transparent: true });
    note.rotation.set(-Math.PI / 2, 0, 0.1); note.position.set(-0.02, top + 0.0065, 0.18); note.userData.noRaycast = true; note.raycast = () => {}; desk.add(note);
    const scrollO = R.scroll({ len: 0.3 }); add(scrollO, 0.05, -0.22, 0.2);

    this._hs({
      id: 'r1.desk', object: desk, label: 'Writing desk',
      onClick: () => this._caption('caption.r1.papers'),
      useItem: {
        key_brass: () => this._unlockDrawer(),
        parcel: async () => { await ctx.dialogue.say('react.parcel.open'); this._caption('caption.parcel'); return false; },
      },
    });
    this._hs({ id: 'r1.papers', object: papers, label: 'Papers', onClick: () => { ctx.audio.play('paperRustle'); this._caption('caption.r1.papers'); } });
    this._hs({ id: 'r1.ink', object: ink, label: 'Inkpot', onClick: () => this._caption('caption.r1.ink') });
    this._hs({ id: 'r1.quill', object: quill, label: 'Quill', enabled: () => !this._quillFallen, onClick: () => this._knockQuill() });
    this._hs({ id: 'r1.deskcandle', object: dc, label: 'Candle', onClick: () => this._caption('caption.r1.candles') });

    // drawer contents
    const di = desk.userData.drawerInterior;
    const mag = R.magnifier(); mag.position.set(-0.14, 0, 0.17); mag.rotation.y = 0.5; di.add(mag);
    const sard = R.sardineTin(); sard.position.set(0.13, 0, 0.18); sard.rotation.y = -0.25; di.add(sard);
    const letter = new THREE.Group(); letter.position.set(0.0, 0.003, 0.08); letter.rotation.y = 0.12; di.add(letter);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), M.parchment({ tint: '#efe0ba' })); lp.rotation.x = -Math.PI / 2; lp.castShadow = true; letter.add(lp);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 16), M.matte('#8a1a14', { roughness: 0.4 })); seal.position.y = 0.002; letter.add(seal);
    this.drawerItems = { mag, sard, letter };
    const magP = ctx.hotspots.proxyBox(0.17, 0.04, 0.11); magP.position.set(0.05, 0.01, 0); mag.add(magP);
    const sardP = ctx.hotspots.proxyBox(0.13, 0.05, 0.09); sardP.position.y = 0.012; sard.add(sardP);
    const letP = ctx.hotspots.proxyBox(0.18, 0.02, 0.13); letter.add(letP);
    const open = () => state.isSolved('desk');
    const dScope = ['room', 'focus:r1.drawer'];
    this._hs({ id: 'r1.magnifier', object: mag, label: 'Magnifying glass', scope: dScope, enabled: () => open() && !state.get('room1.magnifier.taken'), onClick: () => this._takeFromDrawer('magnifier', mag, 'caption.r1.magnifier') });
    this._hs({ id: 'r1.sardines', object: sard, label: 'Tin of sardines', scope: dScope, enabled: () => open() && !state.get('room1.sardines.taken'), onClick: () => this._takeFromDrawer('sardines', sard, 'caption.r1.sardines') });
    this._hs({ id: 'r1.letter', object: letter, label: 'Letter', scope: dScope, enabled: open, onClick: () => { ctx.audio.play('paperRustle'); state.set('room1.letter.read', true); ctx.papers.show('letter_guild'); } });
    this._hs({
      id: 'r1.drawer', object: drawer, label: () => (open() ? 'Desk drawer' : 'Locked drawer'), scope: dScope,
      onClick: () => { if (open()) this._focusDrawer(); else { ctx.audio.play('keyTurn', { gain: 0.35, pitch: 0.7 }); this._caption('caption.r1.drawer.locked'); } },
      useItem: { key_brass: () => this._unlockDrawer() },
    });
  }

  async _unlockDrawer() {
    const { ctx } = this; const { state } = ctx;
    if (state.isSolved('desk')) return;
    state.solve('desk');
    ctx.inventory.remove('key_brass');
    ctx.hotspots.lock();
    try {
      ctx.audio.play('keyTurn');
      await ctx.tween.delay(0.45);
      ctx.audio.play('drawerOpen');
      ctx.cat?.react('perk');
      this._catLook(this._worldPos(this.drawer));
      await ctx.tween.to(this.drawer.position, { z: this.drawer.userData.closedZ + 0.38 }, { duration: 0.8, ease: 'outCubic' });
      await this._focusDrawer();
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('react.drawer.open');
  }
  _focusDrawer() {
    const p = this.desk.localToWorld(new THREE.Vector3(0, 0.62, 0.36 + 0.38 - 0.1));
    return this.ctx.camera.focus({ position: [p.x - 0.62, p.y + 0.62, p.z + 0.02], lookAt: [p.x + 0.02, p.y, p.z], scope: 'focus:r1.drawer', fov: 50 });
  }
  _takeFromDrawer(id, obj, captionKey) {
    const { ctx } = this;
    ctx.state.set(`room1.${id}.taken`, true);
    obj.visible = false;
    ctx.inventory.add(id, { from: this._worldPos(obj) });
    this._caption(captionKey);
    if (id === 'sardines') { ctx.cat?.react('perk'); this._catLook(this._worldPos(obj), 4); }
  }
  _knockQuill() {
    const { ctx } = this;
    if (this._quillFallen) return;
    this._quillFallen = true;
    const q = this.quill;
    this._caption('caption.quill');
    ctx.cat?.react('tailFlick');
    // tip off the room-side edge, tumble to the floor (desk-local: +z toward the room, floor at y=0)
    ctx.tween.to(q.position, { z: 0.55, y: 0.95 }, { duration: 0.25, ease: 'outQuad' }).then(() =>
      ctx.tween.to(q.position, { z: 0.75, y: 0.004 }, { duration: 0.55, ease: 'inQuad' }).then(() => ctx.audio.play('drop', { gain: 0.25, pitch: 2 })));
    ctx.tween.to(q.rotation, { x: Math.PI / 2, z: 1.9 }, { duration: 0.8, ease: 'outQuad' });
    this._later(18, () => { // it "respawns" — back in the inkpot when you next look
      q.position.copy(this.quillHome.p); q.rotation.copy(this.quillHome.r); this._quillFallen = false;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────── south: front door + hat pegs
  _buildSouth() {
    const { ctx } = this; const G = this.group;
    const door = F.door({ w: 1.1, h: 2.2, tint: '#5a3a22', rune: true, runeColor: '#cfe6ff', frame: 'stone', seed: 3 });
    door.position.set(-0.3, 0, D / 2 - 0.07); door.rotation.y = Math.PI;
    G.add(door);
    mergeStatic(door, [door.userData.leaf]);
    this.frontDoor = door;
    const fl = new THREE.PointLight('#a8ccff', 0.7, 2.2, 2); fl.position.set(-0.3, 1.4, D / 2 - 0.4); G.add(fl);
    this._hs({ id: 'r1.frontdoor', object: door, label: 'Front door', onClick: () => this._zapFrontDoor() });
    // peg rail with the wizard's spare hat
    const rail = F.rbox(0.9, 0.08, 0.03, M.walnut(), 0.008); rail.position.set(1.35, 1.75, D / 2 - 0.02); G.add(rail);
    for (let i = 0; i < 3; i++) { const peg = F.lathe([[0, 0], [0.012, 0], [0.01, 0.06], [0.018, 0.075], [0, 0.08]], M.walnut(), 10); peg.rotation.x = -Math.PI / 2 - 0.3; peg.position.set(1.05 + i * 0.3, 1.75, D / 2 - 0.035); G.add(peg); }
    const hat = new THREE.Group();
    const hatM = M.velvet({ color: '#1f2a52' });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 20, 6, true), hatM);
    const cp = cone.geometry.attributes.position; for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y > 0.05) { const k = (y - 0.05) / 0.16; cp.setX(i, cp.getX(i) + k * k * 0.05); } } cone.geometry.computeVertexNormals();
    cone.position.y = 0.2; hat.add(cone);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.012, 28), hatM); hat.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.04, 20, 1, true), M.matte('#c9a24a', { metalness: 0.6, roughness: 0.4 })); band.position.y = 0.03; hat.add(band);
    F.shadowAll(hat);
    hat.position.set(1.35, 1.58, D / 2 - 0.2); hat.rotation.set(-1.25, 0, 0.15);
    G.add(hat);
    this._hs({ id: 'r1.hat', object: hat, label: 'Pointed hat', onClick: () => this._caption('caption.r1.hat') });
    // a framed certificate
    const cert = F.pictureFrame({ w: 0.42, h: 0.32, border: 0.035, style: 'walnut', draw: (g, w, h) => {
      g.fillStyle = '#e9d9b0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a3a1a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#2a1a08'; g.textAlign = 'center'; g.font = `700 ${h * 0.12}px "Cormorant Garamond", Georgia, serif`; g.fillText('Guild of Thaumaturges', w / 2, h * 0.3);
      g.font = `italic 600 ${h * 0.09}px "Cormorant Garamond", Georgia, serif`; g.fillText('B. Quince — Master of the Tower', w / 2, h * 0.5); g.fillText('(dues outstanding)', w / 2, h * 0.68);
      g.fillStyle = '#8a1a14'; g.beginPath(); g.arc(w * 0.8, h * 0.8, h * 0.07, 0, TAU); g.fill();
    } });
    cert.position.set(-1.7, 1.7, D / 2 - 0.005); cert.rotation.y = Math.PI; G.add(cert);
  }

  _zapFrontDoor() {
    const { ctx } = this;
    if (this._zapping) return;
    this._zapping = true;
    ctx.audio.play('zap');
    ctx.transitions.flash('#cfe6ff', 0.4, 0.85);
    ctx.camera.shake(0.05, 0.5);
    ctx.cat?.react('flinch');
    this.frontDoor.userData.setRune(2.2); this.frontDoor.userData.setRune(1, 0.6);
    ctx.dialogue.say('react.frontdoor.zap').then(() => { this._zapping = false; });
  }

  // ──────────────────────────────────────────────────────────────────────────── dressing
  _buildDressing() {
    const { ctx } = this; const G = this.group;
    // NW corner side table: skull with candle, scroll, books
    const tbl = F.table({ w: 0.56, d: 0.5, h: 0.72, legs: 'turned', material: M.walnut() });
    tbl.position.set(-2.95, 0, -2.95); tbl.rotation.y = 0.5; G.add(tbl);
    mergeStatic(tbl);
    const sk = R.skull(); sk.position.set(-2.98, 0.72, -2.93); sk.rotation.y = 0.75; G.add(sk);
    const skc = F.candle({ holder: 'none', light: false, h: 0.06, r: 0.016 }); skc.position.set(-2.98, 0.72 + 0.155, -2.935); G.add(skc);
    this._hs({ id: 'r1.skull', object: sk, label: 'Skull', onClick: () => this._caption('caption.r1.skull') });
    const sc = R.scroll({ len: 0.3 }); sc.position.set(-2.82, 0.72, -2.75); sc.rotation.y = 0.9; G.add(sc);
    const bs = R.bookStack({ count: 2, seed: 3 }); bs.position.set(-3.1, 0.72, -3.08); bs.rotation.y = 0.4; G.add(bs);
    // floor book piles
    const pile1 = R.bookStack({ count: 6, seed: 21 }); pile1.position.set(-0.32, 0, -3.15); pile1.rotation.y = 0.3; G.add(pile1);
    const pile2 = R.bookStack({ count: 4, seed: 22 }); pile2.position.set(3.15, 0, 1.55); pile2.rotation.y = -0.2; G.add(pile2);
    const pile3 = R.bookStack({ count: 3, seed: 23 }); pile3.position.set(-0.32, 0.0, -2.75); pile3.rotation.y = -0.5; G.add(pile3);
    // west wall, south of the hearth: an apothecary shelf and a tall iron candle stand by the chair
    const aw = F.wallShelf({ w: 1.1, d: 0.22 });
    aw.position.set(-W / 2, 1.68, 1.7); aw.rotation.y = Math.PI / 2; G.add(aw);
    const apo = [
      F.jar({ r: 0.05, h: 0.15, contents: '#b84a2a', glow: 0.25, label: 'Salamander\nAsh', lid: 'cork' }),
      F.bottle({ r: 0.035, h: 0.22, shape: 'tall', color: '#2a5a3a', contents: '#4ad08a', glow: 0.5 }),
      F.jar({ r: 0.04, h: 0.12, contents: '#d8d0b0', glow: 0, label: 'Owl\nPellets', lid: 'cloth' }),
      F.bottle({ r: 0.04, h: 0.16, shape: 'round', color: '#3a3a6a', contents: '#6a8ad8', glow: 0.35 }),
    ];
    apo.forEach((o, i) => { o.position.set(-0.42 + i * 0.17, 0, 0.11); aw.add(o); });
    const aws = R.bookStack({ count: 3, seed: 41 }); aws.position.set(0.36, 0, 0.11); aws.rotation.y = 0.2; aw.add(aws);
    this._hs({ id: 'r1.apothecary', object: aw, label: 'Jars and bottles', onClick: () => this._caption('Salamander ash, owl pellets, and two bottles that glow when nobody is looking.') });
    const stand = new THREE.Group(); stand.position.set(-3.05, 0, 2.15);
    const ironM = M.iron({ color: '#1e1c1a' });
    stand.add(F.lathe([[0, 0], [0.14, 0], [0.13, 0.03], [0.02, 0.06], [0.014, 0.4], [0.024, 0.42], [0.012, 0.44], [0.012, 1.18], [0.06, 1.2], [0.065, 1.23], [0, 1.23]], ironM, 16));
    const sc2 = F.candle({ holder: 'none', light: true, intensity: 1.0, distance: 3.2, h: 0.2, r: 0.028 });
    sc2.position.y = 1.23; stand.add(sc2);
    F.shadowAll(stand);
    G.add(stand);
    this._hs({ id: 'r1.candlestand', object: stand, label: 'Candle stand', onClick: () => this._caption('caption.r1.candles') });
    // cobwebs in the upper corners
    const webs = [[-W / 2 + 0.3, H - 0.3, -D / 2 + 0.01, 0, 1], [W / 2 - 0.3, H - 0.3, -D / 2 + 0.01, 0, -1], [W / 2 - 0.01, H - 0.3, D / 2 - 0.3, -Math.PI / 2, 1]];
    for (const [x, y, z, ry, sx] of webs) { const w = R.cobweb({ size: 0.6 }); w.position.set(x, y, z); w.rotation.y = ry; w.scale.x = sx; G.add(w); }
    void ctx;
  }

  /** Second merge pass once everything is dressed: collapse static sub-parts that stay put. */
  _mergeDressing() {
    // never pull meshes out of anything that is itself a hotspot target (it would lose its pick/highlight meshes)
    const targets = new Set([...this.ctx.hotspots._map.values()].map((h) => h.object));
    const mergeStatic = (root, exclude = []) => mergeStaticFn(root, [...exclude, ...[...targets].filter((t) => t !== root)]);
    const d = this.desk;
    mergeStatic(d, [this.drawer, this.quill, this.deskPapers]);
    for (const door of [this.labDoor, this.frontDoor]) mergeStatic(door.userData.leaf);
    const ud = this.stand.userData;
    mergeStatic(ud.cover);
    mergeStatic(ud.book, [ud.cover, ud.page, ud.chain, ud.lock]);
    mergeStatic(ud.lock, [...ud.dials, ...ud.arrows.flatMap((a) => [a.up, a.down])]);
    mergeStatic(this.globe, [this.globe.userData.sphere]);
    for (const c of this.group.children) {
      if (['skull', 'hourglass', 'catBowl', 'wallShelf', 'pictureFrame', 'bookStack', 'scroll', 'table'].includes(c.name)) mergeStatic(c, [this.watch]);
    }
    this.group.updateMatrixWorld(true);
  }

  _buildVignette() {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const mat = new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    const vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    vig.renderOrder = 9999; vig.frustumCulled = false;
    vig.raycast = () => {}; vig.userData.noRaycast = true;
    this.group.add(vig);
    this.vignette = vig;
  }

  // ──────────────────────────────────────────────────────────────────────────── cushion + magnifier (R1-P3 clue)
  _cushionFocusPose(dist = 0.62) {
    const c = this.cushion;
    const p = this._worldPos(c);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()));
    return { p, n, cam: p.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.06, 0)) };
  }
  _clickCushion() {
    const { ctx } = this;
    const mag = ctx.state.get('room1.cushion.magnified');
    this._caption(mag ? 'caption.cushion.magnified' : 'caption.cushion.plain');
    if (ctx.camera.scope !== 'focus:r1.cushion') {
      const { p, cam } = this._cushionFocusPose();
      ctx.camera.focus({ position: cam.toArray(), lookAt: p.toArray(), scope: 'focus:r1.cushion', fov: 50 });
    } else this._squashCushion();
  }
  /** polish delight: poke the cushion in its close-up and it sighs — a squash, a soft puff, a little dust. */
  _squashCushion() {
    const { ctx } = this; const c = this.cushion;
    if (this._squashing) return;
    this._squashing = true;
    ctx.audio.play('swoosh', { gain: 0.16, pitch: 0.45 });
    const wp = new THREE.Vector3(); c.getWorldPosition(wp);
    P.burst(ctx, this.group, [wp.x, wp.y + 0.12, wp.z], { color: '#e6d6b4', color2: '#bfae8a', count: 22, radius: 0.16, duration: 1.1, size: 0.012 });
    ctx.tween.to(c.scale, { x: 1.06, y: 0.9, z: 0.62 }, { duration: 0.12, ease: 'outQuad' })
      .then(() => ctx.tween.to(c.scale, { x: 1, y: 1, z: 1 }, { duration: 0.9, ease: 'outElastic' }))
      .then(() => { this._squashing = false; });
  }
  async _magnifyCushion() {
    const { ctx } = this;
    if (ctx.camera.scope !== 'focus:r1.cushion' && ctx.camera.scope !== 'focus:r1.cushion.mag') {
      const { p, cam } = this._cushionFocusPose();
      await ctx.camera.focus({ position: cam.toArray(), lookAt: p.toArray(), scope: 'focus:r1.cushion', fov: 50 });
    }
    if (ctx.camera.scope === 'focus:r1.cushion.mag') return;
    ctx.audio.play('select');
    this.lens.visible = true;
    this.lens.scale.setScalar(0.3);
    ctx.tween.to(this.lens.scale, { x: 1, y: 1, z: 1 }, { duration: 0.5, ease: 'outBack' });
    const lp = this._worldPos(this.lens);
    const { n } = this._cushionFocusPose();
    const cam = lp.clone().addScaledVector(n, 0.36);
    await ctx.camera.focus({ position: cam.toArray(), lookAt: lp.toArray(), scope: 'focus:r1.cushion.mag', fov: 45, onExit: () => { this.lens.visible = false; } });
    ctx.state.set('room1.cushion.magnified', true);
    this._caption('caption.cushion.magnified');
  }

  // ──────────────────────────────────────────────────────────────────────────── bookshelf (R1-P3)
  _focusShelf() {
    const { ctx } = this;
    const c = this._worldPos(this.shelf);
    const y = this.shelf.userData.shelfYs[3] + 0.16;
    ctx.camera.focus({ position: [c.x, y + 0.08, c.z + 1.05], lookAt: [c.x, y, c.z], scope: 'focus:r1.shelf', fov: 55 });
    this._caption('caption.r1.shelf');
  }
  _pushBook(color) {
    const { ctx } = this; const { state } = ctx;
    const bk = this.puzzleBooks[color];
    const pushed = [...state.get('room1.shelf.pushed', [])];
    if (pushed.includes(color)) { ctx.audio.play('click', { gain: 0.3 }); return; }
    ctx.audio.play('bookSlide');
    ctx.tween.to(bk.position, { z: bk.userData.inZ }, { duration: 0.28, ease: 'outCubic' });
    pushed.push(color);
    const i = pushed.length - 1;
    if (SHELF_SOLUTION[i] !== color) {
      state.set('room1.shelf.pushed', []);
      this._later(0.45, () => {
        ctx.audio.play('drop', { gain: 0.8, pitch: 0.7 });
        ctx.camera.shake(0.008, 0.25);
        for (const b of Object.values(this.puzzleBooks)) ctx.tween.to(b.position, { z: b.userData.outZ }, { duration: 0.3, ease: 'outBack' });
        const n = state.inc('room1.shelf.wrong');
        if (n % 3 === 0) this._later(0.5, () => this._sayPool('react.shelf.wrong'));
      });
      return;
    }
    state.set('room1.shelf.pushed', pushed);
    if (pushed.length === SHELF_SOLUTION.length) this._solveShelf();
  }
  async _solveShelf() {
    const { ctx } = this; const { state } = ctx;
    state.solve('shelf');
    ctx.hotspots.lock();
    try {
      await ctx.tween.delay(0.35);
      ctx.audio.play('unlock', { gain: 0.7 });
      await ctx.tween.delay(0.5);
      await ctx.camera.exitFocus({ all: true, duration: 0.6 });
      ctx.camera.lookAtPoint([-1.4, 1.2, -3.6]);
      ctx.audio.play('shelfSwing');
      ctx.camera.shake(0.012, 1.4);
      this.alcoveCandle.userData.setLit(true);
      ctx.tween.to(this.shelfPivot.rotation, { y: -1.32 }, { duration: 2.4, ease: 'inOutSine' });
      await ctx.tween.delay(0.9);
      P.burst(ctx, this.group, [-1.4, 1.0, -3.45], { color: '#c8b89a', color2: '#6a5a4a', count: 70, radius: 0.7, size: 0.02, duration: 2 });
      await ctx.tween.delay(1.5);
      this.grimoireSparkle.visible = !state.isSolved('grimoire');
      ctx.cat?.react('perk');
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('react.shelf.solved');
  }

  // ──────────────────────────────────────────────────────────────────────────── grimoire word lock (R1-P4)
  _clickGrimoire() {
    const { ctx } = this; const { state } = ctx;
    if (state.isSolved('grimoire')) {
      if (!state.get('room1.page.taken')) this._takePage();
      else this._caption('caption.r1.diary.empty');
      return;
    }
    this._caption('caption.r1.grimoire.locked');
    this._lockChanged = false;
    // look straight down the lock's own normal so the letters in the reading window face the camera
    const lock = this.stand.userData.lock;
    const lp = this._worldPos(lock);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(lock.getWorldQuaternion(new THREE.Quaternion()));
    const cp = lp.clone().addScaledVector(n, 0.27).add(new THREE.Vector3(0, 0.008, 0));
    ctx.camera.focus({
      position: cp.toArray(), lookAt: [lp.x, lp.y + 0.006, lp.z], scope: 'focus:r1.grimoire', fov: 36,
      onExit: () => {
        if (this._lockChanged && !state.isSolved('grimoire')) {
          const n = state.inc('room1.lock.wrong');
          if (n % 3 === 0) this._later(0.7, () => this._sayPool('react.grimoire.wrong'));
        }
        this._lockChanged = false;
      },
    });
  }
  _turnDial(i, dir) {
    const { ctx } = this; const { state } = ctx;
    const ud = this.stand.userData;
    this.lockLetters[i] = (this.lockLetters[i] + dir + 26) % 26;
    this.lockAngles[i] += dir * ud.STEP;
    ctx.tween.to(ud.dials[i].rotation, { x: this.lockAngles[i] }, { duration: 0.18, ease: 'outBack' });
    ctx.audio.play('ratchet', { gain: 0.4, pitch: 1.6 });
    state.set('room1.lock.letters', [...this.lockLetters]);
    this._lockChanged = true;
    const word = this.lockLetters.map((v) => String.fromCharCode(65 + v)).join('');
    if (word === LOCK_WORD) this._solveGrimoire();
  }
  async _solveGrimoire() {
    const { ctx } = this; const { state } = ctx;
    if (state.isSolved('grimoire')) return;
    state.solve('grimoire');
    const ud = this.stand.userData;
    ctx.hotspots.lock();
    try {
      await ctx.tween.delay(0.3);
      ctx.audio.play('unlock');
      // lock and chain fall away
      ctx.tween.to(ud.lock.position, { y: ud.lock.position.y - 0.95, z: ud.lock.position.z + 0.12 }, { duration: 0.6, ease: 'inQuad' });
      ctx.tween.to(ud.lock.rotation, { x: 1.2, z: 0.6 }, { duration: 0.6 });
      ctx.tween.to(ud.chain.position, { y: -0.9 }, { duration: 0.7, ease: 'inQuad' });
      await ctx.tween.delay(0.6);
      ctx.audio.play('drop', { gain: 0.9 });
      ud.chain.visible = false;
      ud.lock.visible = false;
      this.grimoireSparkle.visible = false;
      // the grimoire opens itself
      ctx.audio.play('page');
      await ctx.tween.to(ud.cover.rotation, { z: 2.95 }, { duration: 1.1, ease: 'outCubic' });
      ud.page.visible = true;
      ctx.audio.play('sparkle');
      P.burst(ctx, this.group, this._worldPos(ud.book).toArray(), { color: '#ffe8b0', color2: '#9fc4ff', count: 90, radius: 0.45 });
      await this._liftPage();
    } finally { ctx.hotspots.unlock(); }
    await ctx.camera.exitFocus({ all: true });
    // the lab door's rune fades
    ctx.camera.lookAtPoint([W / 2, 1.4, -2.62]);
    await ctx.dialogue.say('react.grimoire.solved');
    ctx.cat?.react('slowBlink');
    await ctx.tween.delay(0.3);
    ctx.audio.play('unlock');
    ctx.audio.play('swoosh');
    ctx.tween.to(this.labRuneLight, { intensity: 0 }, { duration: 1.6 });
    await this.labDoor.userData.setRune(0, 1.6);
    await ctx.dialogue.say('react.labdoor.open');
  }
  async _liftPage() {
    const { ctx } = this; const ud = this.stand.userData;
    const page = ud.page;
    ctx.tween.to(page.material, { emissiveIntensity: 0.9 }, { duration: 0.6 });
    await ctx.tween.to(page.position, { y: page.position.y + 0.14 }, { duration: 0.9, ease: 'outCubic' });
    await ctx.tween.delay(0.3);
    this._takePage();
  }
  _takePage() {
    const { ctx } = this; const { state } = ctx;
    if (state.get('room1.page.taken')) return;
    state.set('room1.page.taken', true);
    const ud = this.stand.userData;
    ctx.inventory.add('page_incantation', { from: this._worldPos(ud.page) });
    ud.page.visible = false;
  }

  async _clickLabDoor() {
    const { ctx } = this; const { state } = ctx;
    if (!state.isSolved('grimoire')) {
      ctx.audio.play('error', { gain: 0.4 });
      this.labDoor.userData.setRune(1.8); this.labDoor.userData.setRune(1, 0.5);
      this._caption('caption.r1.labdoor.sealed');
      return;
    }
    if (!ctx.game.registry.has('room2')) { ctx.hud.toast('The laboratory is not built yet.'); return; }
    ctx.audio.play('doorOpen');
    ctx.hotspots.lock();
    await ctx.tween.to(this.labDoor.userData.leaf.rotation, { y: -1.1 }, { duration: 0.7, ease: 'inOutSine' });
    ctx.hotspots.unlock();
    ctx.game.goToRoom('room2');
  }

  // ──────────────────────────────────────────────────────────────────────────── state → visuals
  _restoreFromState() {
    const { state } = this.ctx;
    // clock
    if (state.isSolved('clock')) {
      this.clockRunning = true;
      this.clock.userData.panel.rotation.y = -1.95; if (!state.get('room1.key.taken')) this.clock.userData.cavLight.intensity = 0.35;
      this._applyHands(this._runningHours());
      this._lastChimeHour = Math.floor(this._runningHours()) % 12 || 12;
      this._pendAmp = 1;
    } else {
      this.clockRunning = false;
      this._applyHands(this.clockTime.h + this.clockTime.m / 60);
    }
    const keyGone = state.get('room1.key.taken') || !state.isSolved('clock');
    this.clockKey.visible = !state.get('room1.key.taken');
    this.keyGlow.visible = !keyGone;
    // drawer
    if (state.isSolved('desk')) this.drawer.position.z = this.drawer.userData.closedZ + 0.38;
    this.drawerItems.mag.visible = !state.get('room1.magnifier.taken');
    this.drawerItems.sard.visible = !state.get('room1.sardines.taken');
    // shelf
    if (state.isSolved('shelf')) {
      this.shelfPivot.rotation.y = -1.32;
      for (const b of Object.values(this.puzzleBooks)) b.position.z = SHELF_SOLUTION.includes(b.userData.color) ? b.userData.inZ : b.userData.outZ;
    }
    this.alcoveCandle.userData.setLit(state.isSolved('shelf'));
    this.grimoireSparkle.visible = state.isSolved('shelf') && !state.isSolved('grimoire');
    // grimoire
    const ud = this.stand.userData;
    if (state.isSolved('grimoire')) {
      ud.chain.visible = false; ud.lock.visible = false;
      ud.cover.rotation.z = 2.95;
      ud.page.visible = !state.get('room1.page.taken');
      this.labDoor.userData.setRune(0);
      this.labRuneLight.intensity = 0;
    } else {
      ud.dials.forEach((d, i) => { d.rotation.x = this.lockAngles[i]; });
    }
  }

  _runningHours() {
    const { state } = this.ctx;
    const start = state.get('room1.clock.runStart', state.elapsed);
    return CLOCK_SOLUTION.h + CLOCK_SOLUTION.m / 60 + Math.max(0, state.elapsed - start) / 3600;
  }

  prereqMet(id) {
    const { state, inventory } = this.ctx;
    if (id === 'desk') return state.isSolved('clock') || inventory.has('key_brass');
    if (id === 'shelf') return state.isSolved('desk');
    if (id === 'grimoire') return state.isSolved('shelf');
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────── lifecycle
  _placeCat(pose = 'sit') {
    const { ctx } = this;
    ctx.cat.placeAt(this.group, {
      position: [3.08, 0.78, 0.92], rotationY: -1.2, pose,
      hotspot: {
        useItem: {
          sardines: () => {
            const n = ctx.state.inc('cat.sardines.offered');
            const pool = ctx.script['react.sardines.cat'];
            ctx.cat.react('perk');
            ctx.dialogue.sayLines(Array.isArray(pool) ? pool[n > 1 ? 1 : 0] : 'react.sardines.cat');
            return false; // keep the tin selected? no — but don't consume it
          },
          parcel: () => { ctx.dialogue.say('react.parcel.cat'); },
        },
      },
    });
  }

  enter({ from } = {}) {
    const { ctx } = this; const { state } = ctx;
    this._placeCat('sit');
    ctx.audio.setRoomAmbience('room1');
    ctx.audio.setClockRunning(state.isSolved('clock'));
    this.labDoor.userData.leaf.rotation.y = 0;
    // (the parcel is seeded into the inventory by the engine on New Game / ?room=)
    if (!state.get('room1.intro.seen')) {
      state.set('room1.intro.seen', true);
      ctx.inventory.hold('parcel'); // hidden until it flies in during the intro
      this._introSequence();
    } else if (!state.get('room1.thumbs.done') && from == null) {
      this._later(1.0, () => this._offerThumbs());
    }
  }

  async _introSequence() {
    const { ctx } = this;
    this.frontDoor.userData.setRune(0);
    await ctx.tween.delay(0.7);
    if (!this._isCurrent()) return;
    // the parcel (seeded silently by Game.js, held hidden in enter()) flies into the bar, then the door shuts
    ctx.inventory.flourish('parcel');
    await ctx.tween.delay(1.5);
    if (!this._isCurrent()) return;
    ctx.audio.play('drop', { gain: 1.1, pitch: 0.6 });
    ctx.audio.play('zap', { gain: 0.3 });
    ctx.transitions.flash('#bfe0ff', 0.5, 0.3);
    ctx.camera.shake(0.02, 0.4);
    this.frontDoor.userData.setRune(1, 0.9);
    await ctx.tween.delay(0.9);
    if (!this._isCurrent()) return;
    await ctx.dialogue.say('room1.intro');
    await this._offerThumbs();
  }
  async _offerThumbs() {
    const { ctx } = this;
    if (ctx.state.get('room1.thumbs.done') || !this._isCurrent()) return;
    ctx.state.set('room1.thumbs.done', true);
    await ctx.dialogue.choice('choice.room1.thumbs');
  }

  enterTitle() {
    const { ctx } = this;
    this._placeCat('loaf');
    ctx.camera.setVantage(TITLE_VANTAGE);
    ctx.audio.setRoomAmbience('room1');
    ctx.audio.setClockRunning(ctx.state.isSolved('clock'));
  }

  exit() {
    this.ctx.cat?.lookAt(null);
    for (const t of this._timers) t.cancel?.();
    this._timers = [];
    if (this._quillFallen) { this.quill.position.copy(this.quillHome.p); this.quill.rotation.copy(this.quillHome.r); this._quillFallen = false; }
  }

  _later(seconds, fn) {
    const p = this.ctx.tween.delay(seconds);
    let dead = false;
    p.then(() => { if (!dead) fn(); });
    const h = { cancel: () => { dead = true; p.cancel?.(); } };
    this._timers.push(h);
    if (this._timers.length > 40) this._timers.splice(0, 20);
    return h;
  }

  update(dt, t) {
    const { ctx } = this;
    this._t = t;
    const cam = ctx.camera.camera;
    // vignette glued to the camera
    if (this.vignette) {
      const d = 0.1;
      const hh = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
      this.vignette.position.copy(cam.position).add(new THREE.Vector3(0, 0, -d).applyQuaternion(cam.quaternion));
      this.vignette.quaternion.copy(cam.quaternion);
      this.vignette.scale.set(hh * cam.aspect * 1.02, hh * 1.02, 1);
    }
    if (this.fireSpot) this.fireSpot.intensity = this.fireLight.intensity * 1.4;
    // portrait eyes follow the cursor
    if (this.portraitEyes) {
      this._raycaster.setFromCamera(ctx.hotspots.pointer, cam);
      const ray = this._raycaster.ray;
      const pw = this._worldPos(this.portrait);
      const target = ray.origin.clone().addScaledVector(ray.direction, Math.max(0.3, ray.origin.distanceTo(pw) * 0.9));
      const local = this.portrait.worldToLocal(target);
      for (const e of this.portraitEyes) {
        const dx = local.x - e.home.x, dy = local.y - e.home.y, dz = Math.max(0.2, local.z - e.home.z);
        const tx = THREE.MathUtils.clamp((dx / dz) * e.maxX * 1.6, -e.maxX, e.maxX);
        const ty = THREE.MathUtils.clamp((dy / dz) * e.maxY * 1.6, -e.maxY, e.maxY);
        const k = Math.min(1, dt * 8);
        e.eye.position.x += (e.home.x + tx - e.eye.position.x) * k;
        e.eye.position.y += (e.home.y + ty - e.eye.position.y) * k;
      }
    }
    // clock: pendulum + hands + chime on the hour
    if (this.clockRunning) {
      this._pendAmp = Math.min(1, (this._pendAmp ?? 0) + dt * 0.5);
      this.clock.userData.pendulum.rotation.z = Math.sin(t * Math.PI) * 0.11 * this._pendAmp;
      const hrs = this._runningHours();
      this._applyHands(hrs);
      const hour = Math.floor(hrs) % 12 || 12;
      if (this._lastChimeHour != null && hour !== this._lastChimeHour && this._isCurrent()) ctx.audio.clockChime(hour);
      this._lastChimeHour = hour;
    }
    // the cat glances at you now and then
    if (ctx.cat && this._isCurrent()) {
      if (this._catLookUntil && t > this._catLookUntil) { this._catLookUntil = 0; ctx.cat.lookAt(null); }
      if (!this._catLookUntil) {
        this._nextGlance ??= t + 4;
        if (ctx.dialogue.isOpen) ctx.cat.lookAt(cam.position);
        else if (t > this._nextGlance) { this._nextGlance = t + 6 + Math.random() * 8; if (Math.random() < 0.6) { ctx.cat.lookAt(cam.position); this._catLookUntil = t + 2.5 + Math.random() * 2; } }
      }
    }
  }
}
